// Cópia de segurança do Firestore. Roda pelo GitHub (Actions › Cópia de segurança), todo dia de madrugada.
// Cada execução gera um pacote (artefato) com um arquivo por coleção, que fica guardado no GitHub.
//   BACKUP_TIPO = diaria    tudo, menos o histórico e as fotos                      (guardada 30 dias)
//               = semanal   tudo, menos as fotos em tamanho cheio                    (guardada 90 dias)
//               = completa  tudo, inclusive as fotos e arquivos (só manual; pesado)  (guardada 7 dias)
// Cada documento lido conta 1 leitura na cota grátis do Firestore (50 mil por dia). O resumo mostra quantas foram.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, codificar, gravarGz, resumo, tamanho } from './comum.mjs';

const tipo = process.env.BACKUP_TIPO || 'diaria';
if (!['diaria', 'semanal', 'completa'].includes(tipo)) { console.error('::error::BACKUP_TIPO deve ser diaria, semanal ou completa.'); process.exit(1); }
const destino = path.resolve(process.env.BACKUP_PASTA || 'backup');
fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

const SO_SEMANAL = ['historico', 'evidencias', 'b_evidencias'];
const SO_COMPLETA = ['evidenciasArquivo', 'b_evidenciasArquivo'];
const NUNCA = ['seeds']; // já estão no repositório (pasta dados-importacao)
const entra = c => !NUNCA.includes(c) && (tipo === 'completa' || (!SO_COMPLETA.includes(c) && (tipo === 'semanal' || !SO_SEMANAL.includes(c))));

const { db, F, projeto } = await conectar();
const todas = (await db.listCollections()).map(c => c.id).sort();
const POR_PARTE = 300;
const man = { projeto, tipo, inicio: new Date().toISOString(), colecoes: {}, fora: todas.filter(c => !entra(c)) };
let leituras = 0, bytes = 0;

for (const c of todas.filter(entra)) {
  let ultimo = null, parte = 0, n = 0, sub = 0;
  for (;;) {
    let q = db.collection(c).orderBy(F.FieldPath.documentId()).limit(POR_PARTE);
    if (ultimo) q = q.startAfter(ultimo);
    const s = await q.get();
    if (s.empty) break;
    const docs = {};
    for (const d of s.docs) {
      docs[d.id] = codificar(d.data(), F);
      // subcoleções (o sistema não usa hoje; se aparecerem, avisa em vez de perder em silêncio)
      if (n < 3) sub += (await d.ref.listCollections()).length;
    }
    const arq = path.join(destino, `${c}.${String(parte).padStart(3, '0')}.json.gz`);
    gravarGz(arq, docs);
    bytes += fs.statSync(arq).size;
    n += s.size; leituras += s.size; parte++;
    ultimo = s.docs[s.docs.length - 1];
    if (s.size < POR_PARTE) break;
  }
  man.colecoes[c] = { documentos: n, partes: parte };
  if (sub) console.log(`::warning::A coleção ${c} tem subcoleções, que não entram nesta cópia.`);
}
man.fim = new Date().toISOString();
man.leituras = leituras;
fs.writeFileSync(path.join(destino, 'manifesto.json'), JSON.stringify(man, null, 2));

resumo([
  `### Cópia de segurança ${tipo} (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
  `**${leituras.toLocaleString('pt-BR')} documentos lidos** (contam na cota grátis de 50 mil leituras por dia) · pacote com ${tamanho(bytes)}`,
  '',
  '| Coleção | Documentos |', '|---|---|',
  ...Object.entries(man.colecoes).map(([c, x]) => `| ${c} | ${x.documentos.toLocaleString('pt-BR')} |`),
  '',
  man.fora.length ? `Fora desta cópia: ${man.fora.join(', ')}.` : 'Todas as coleções entraram.',
  '',
  'Para voltar dados desta cópia: Actions › **Restaurar cópia de segurança** › Run workflow, informando o número desta execução: `' + (process.env.GITHUB_RUN_ID || '?') + '`.'
].join('\n'));
