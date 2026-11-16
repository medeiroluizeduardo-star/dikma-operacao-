// Volta dados de uma cópia de segurança. Roda pelo GitHub: Actions › Restaurar cópia de segurança › Run workflow.
//   RESTAURAR_PASTA       pasta com o pacote baixado da cópia (manifesto.json + <coleção>.NNN.json.gz)
//   RESTAURAR_COLECOES    "todas" ou nomes separados por vírgula (ex.: gestao,gocorr; painel = todo o Meu painel)
//   RESTAURAR_DOCUMENTOS  opcional: só estes documentos (ids separados por vírgula), para voltar um item só
//   RESTAURAR_APAGAR      "1" apaga, nas coleções escolhidas, o que foi criado depois da cópia
//   RESTAURAR_APLICAR     "1" grava de verdade; sem isso, só mostra o que mudaria (padrão)
// Antes de gravar, guarda o estado atual dos documentos que vão mudar (pasta "antes"), para dar para desfazer.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, codificar, decodificar, gravarGz, lerGz, resumo, arquivoDe } from './comum.mjs';

const pasta = path.resolve(process.env.RESTAURAR_PASTA || 'copia');
const aplicar = process.env.RESTAURAR_APLICAR === '1';
const apagar = process.env.RESTAURAR_APAGAR === '1';
const lista = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const pedidas = lista(process.env.RESTAURAR_COLECOES || 'todas');
const soDocs = new Set(lista(process.env.RESTAURAR_DOCUMENTOS));
const manArq = path.join(pasta, 'manifesto.json');
if (!fs.existsSync(manArq)) { console.error('::error::Pacote da cópia não encontrado (falta manifesto.json). Confira o número da execução.'); process.exit(1); }
const man = JSON.parse(fs.readFileSync(manArq, 'utf8'));
const naCopia = Object.keys(man.colecoes);
// Pedir "painel" traz também as subcoleções dele (painel/UID/tasks...); dá para pedir uma só pelo caminho.
const colecoes = pedidas.includes('todas') ? naCopia : [...new Set(pedidas.flatMap(p => naCopia.filter(c => c === p || c.startsWith(p + '/')).concat(naCopia.some(c => c === p || c.startsWith(p + '/')) ? [] : [p])))];
const faltam = colecoes.filter(c => !naCopia.includes(c));
if (faltam.length) { console.error(`::error::Não estão nesta cópia: ${faltam.join(', ')}. Na cópia: ${naCopia.join(', ')}.`); process.exit(1); }
if (soDocs.size && colecoes.length !== 1) { console.error('::error::Para escolher documentos, informe uma coleção só.'); process.exit(1); }

const { db, F, projeto } = await conectar();
if (man.projeto && man.projeto !== projeto) { console.error(`::error::A cópia é do projeto ${man.projeto} e a chave é do projeto ${projeto}.`); process.exit(1); }

// JSON com as chaves em ordem, para comparar o conteúdo sem depender da ordem dos campos.
const estavel = v => (v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}') : JSON.stringify(v));

const antesPasta = path.resolve('antes');
fs.mkdirSync(antesPasta, { recursive: true });
const manAntes = { projeto, tipo: 'estado antes da restauração', inicio: new Date().toISOString(), colecoes: {} };
const linhas = [];
let totGravar = 0, totApagar = 0;

for (const c of colecoes) {
  const copia = {};
  for (const f of fs.readdirSync(pasta).filter(f => f.startsWith(arquivoDe(c) + '.') && f.endsWith('.json.gz')).sort()) Object.assign(copia, lerGz(path.join(pasta, f)));
  // estado atual (lê só os documentos pedidos, ou a coleção inteira)
  const atual = {};
  if (soDocs.size) {
    for (const id of soDocs) { const d = await db.collection(c).doc(id).get(); if (d.exists) atual[id] = codificar(d.data(), F); }
  } else {
    for (const d of (await db.collection(c).get()).docs) atual[d.id] = codificar(d.data(), F);
  }
  const ids = soDocs.size ? [...soDocs] : Object.keys(copia);
  const gravar = [], semCopia = [];
  let iguais = 0;
  for (const id of ids) {
    if (!(id in copia)) { semCopia.push(id); continue; }
    if (id in atual && estavel(atual[id]) === estavel(copia[id])) iguais++; else gravar.push(id);
  }
  const novos = apagar ? Object.keys(atual).filter(id => !(id in copia) && (!soDocs.size || soDocs.has(id))) : [];
  const voltam = gravar.filter(id => !(id in atual)).length;
  linhas.push(`| ${c} | ${gravar.length - voltam} | ${voltam} | ${iguais} | ${apagar ? novos.length : '—'} |`);
  if (semCopia.length) console.log(`::warning::${c}: não estão na cópia: ${semCopia.join(', ')}`);
  totGravar += gravar.length; totApagar += novos.length;

  if (!aplicar || (!gravar.length && !novos.length)) continue;
  gravarGz(path.join(antesPasta, `${arquivoDe(c)}.000.json.gz`), Object.fromEntries([...gravar, ...novos].filter(id => id in atual).map(id => [id, atual[id]])));
  manAntes.colecoes[c] = { documentos: [...gravar, ...novos].filter(id => id in atual).length, partes: 1 };
  const ops = [...gravar.map(id => ['set', id]), ...novos.map(id => ['del', id])];
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const [op, id] of ops.slice(i, i + 400)) {
      const ref = db.collection(c).doc(id);
      if (op === 'set') b.set(ref, decodificar(copia[id], F, db)); else b.delete(ref);
    }
    await b.commit();
  }
}

if (aplicar) fs.writeFileSync(path.join(antesPasta, 'manifesto.json'), JSON.stringify(manAntes, null, 2));
resumo([
  aplicar ? '### Restauração aplicada' : '### Restauração — só conferência (nada foi gravado)',
  `Cópia ${man.tipo} de ${new Date(man.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${soDocs.size ? ` · documentos: ${[...soDocs].join(', ')}` : ''}`,
  '',
  '| Coleção | Voltam ao que era | Voltam a existir | Já iguais | Apagados (criados depois) |', '|---|---|---|---|---|',
  ...linhas,
  '',
  aplicar
    ? `${totGravar + totApagar} documento(s) alterado(s). O estado de antes ficou no pacote **estado-antes-da-restauracao** desta execução; para desfazer, restaure informando o número desta execução.`
    : `Para aplicar, rode de novo com **Aplicar de verdade** marcado. Seriam ${totGravar + totApagar} gravação(ões) (a cota grátis é de 20 mil por dia).`
].join('\n'));
