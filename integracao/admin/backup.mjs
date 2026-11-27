// Cópia de segurança do Firestore. Roda pelo GitHub (Actions › Cópia de segurança), todo dia de madrugada.
// Cada execução gera um pacote (artefato) com um arquivo por coleção, que fica guardado no GitHub.
//   BACKUP_TIPO = diaria    tudo, menos o histórico e as fotos                      (guardada 30 dias)
//               = semanal   tudo, menos as fotos em tamanho cheio                    (guardada 90 dias)
//               = completa  tudo, inclusive as fotos e arquivos (só manual; pesado)  (guardada 7 dias)
// O Meu painel (painel/{uid}/...) entra em todas, com as subcoleções; no pacote, cada subcoleção vira um arquivo
// com o caminho trocando / por ~ (ex.: painel~UID~tasks.000.json.gz) e, no manifesto, aparece pelo caminho.
// Cada documento lido conta 1 leitura na cota grátis do Firestore (50 mil por dia). O resumo mostra quantas foram.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, codificar, gravarGz, resumo, tamanho, arquivoDe } from './comum.mjs';

const tipo = process.env.BACKUP_TIPO || 'diaria';
if (!['diaria', 'semanal', 'completa'].includes(tipo)) { console.error('::error::BACKUP_TIPO deve ser diaria, semanal ou completa.'); process.exit(1); }
const destino = path.resolve(process.env.BACKUP_PASTA || 'backup');
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

const SO_SEMANAL = ['historico', 'evidencias', 'b_evidencias', 's_evidencias'];
const SO_COMPLETA = ['evidenciasArquivo', 'b_evidenciasArquivo', 's_evidenciasArquivo'];
const NUNCA = []; // seeds (planilhas originais) entram: não ficam mais no repositório
// Coleções com subcoleções que entram inteiras (painel/{uid}/tasks, registros, config... do Meu painel)
const SUBCOLECOES = ['painel'];
const entra = c => !NUNCA.includes(c) && (tipo === 'completa' || (!SO_COMPLETA.includes(c) && (tipo === 'semanal' || !SO_SEMANAL.includes(c))));

const { db, F, auth, projeto } = await conectar();
const todas = (await db.listCollections()).map(c => c.id).sort();
const POR_PARTE = 300;
const man = { projeto, tipo, inicio: new Date().toISOString(), colecoes: {}, fora: todas.filter(c => !entra(c)) };
let leituras = 0, bytes = 0;

// Copia uma coleção (ou subcoleção, pelo caminho, ex.: painel/UID/tasks) em partes de 300 documentos.
// fundo = true: entra também em todas as subcoleções de cada documento (usado no Meu painel, que é pequeno).
async function copiar(ref, fundo) {
  const c = ref.path;
  let ultimo = null, parte = 0, n = 0, sub = 0;
  for (;;) {
    let q = ref.orderBy(F.FieldPath.documentId()).limit(POR_PARTE);
    if (ultimo) q = q.startAfter(ultimo);
    const s = await q.get();
    if (s.empty) break;
    const docs = {};
    for (const d of s.docs) {
      docs[d.id] = codificar(d.data(), F);
      if (fundo) for (const sc of await d.ref.listCollections()) await copiar(sc, true);
      // nas outras coleções o sistema não usa subcoleções; se aparecerem, avisa em vez de perder em silêncio
      else if (n < 3) sub += (await d.ref.listCollections()).length;
    }
    const arq = path.join(destino, `${arquivoDe(c)}.${String(parte).padStart(3, '0')}.json.gz`);
    gravarGz(arq, docs);
    bytes += fs.statSync(arq).size;
    n += s.size; leituras += s.size; parte++;
    ultimo = s.docs[s.docs.length - 1];
    if (s.size < POR_PARTE) break;
  }
  if (n) man.colecoes[c] = { documentos: n, partes: parte };
  if (sub) console.log(`::warning::A coleção ${c} tem subcoleções, que não entram nesta cópia.`);
}

for (const c of todas.filter(entra)) {
  if (!SUBCOLECOES.includes(c)) { await copiar(db.collection(c), false); continue; }
  // Meu painel: painel/{uid} costuma não ter campos (só as subcoleções tasks, registros, config...), por isso
  // listDocuments, que acha também os documentos "vazios" que só guardam subcoleções.
  await copiar(db.collection(c), true);
  for (const d of await db.collection(c).listDocuments()) {
    if ((await d.get()).exists) continue; // os que têm campos já entraram acima, com as subcoleções
    for (const sc of await d.listCollections()) await copiar(sc, true);
  }
  if (!man.colecoes[c]) man.colecoes[c] = { documentos: 0, partes: 0 };
}
man.fim = new Date().toISOString();

// Uso do plano grátis (tela Administração do sistema › Uso do plano): tamanho aproximado, documentos, fotos e contas.
const uso = { em: F.FieldValue.serverTimestamp(), tipo, leiturasCopia: leituras, pacoteBytes: bytes, colecoes: Object.fromEntries(Object.entries(man.colecoes).filter(([c]) => !c.includes('/')).map(([c, x]) => [c, x.documentos])) };
try {
  let n = 0, b = 0;
  for (const c of ['evidencias', 'b_evidencias', 's_evidencias']) {
    if (!todas.includes(c)) continue;
    const a = (await db.collection(c).aggregate({ n: F.AggregateField.count(), t: F.AggregateField.sum('tamanho') }).get()).data();
    n += a.n || 0; b += a.t || 0;
  }
  uso.fotos = { n, bytes: b };
} catch (e) { console.log('::warning::Não deu para somar as fotos: ' + e.message); }
try {
  const perfis = new Set((await db.collection('usuarios').select().get()).docs.map(d => d.id));
  let contas = 0, orfas = 0, token;
  do { const r = await auth.listUsers(1000, token); for (const u of r.users) { contas++; if (!perfis.has(u.uid)) orfas++; } token = r.pageToken; } while (token);
  uso.contas = { total: contas, semPerfil: orfas };
} catch (e) { console.log('::warning::Não deu para contar as contas: ' + e.message); }
await db.doc('sistema/uso').set(uso);
man.leituras = leituras;
fs.writeFileSync(path.join(destino, 'manifesto.json'), JSON.stringify(man, null, 2));

// No resumo, as subcoleções somam na coleção de cima (painel = tudo do Meu painel de todas as pessoas).
const porRaiz = {};
for (const [c, x] of Object.entries(man.colecoes)) { const r = c.split('/')[0]; porRaiz[r] = (porRaiz[r] || 0) + x.documentos; }
resumo([
  `### Cópia de segurança ${tipo} (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
  `**${leituras.toLocaleString('pt-BR')} documentos lidos** (contam na cota grátis de 50 mil leituras por dia) · pacote com ${tamanho(bytes)}`,
  '',
  '| Coleção | Documentos |', '|---|---|',
  ...Object.entries(porRaiz).map(([c, x]) => `| ${c} | ${x.toLocaleString('pt-BR')} |`),
  '',
  man.fora.length ? `Fora desta cópia: ${man.fora.join(', ')}.` : 'Todas as coleções entraram.',
  '',
  'Para voltar dados desta cópia: Actions › **Restaurar cópia de segurança** › Run workflow, informando o número desta execução: `' + (process.env.GITHUB_RUN_ID || '?') + '`.'
].join('\n'));
