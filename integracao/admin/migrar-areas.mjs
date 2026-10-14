// Divide as fichas do Efetivo por área (gcolab/{ÁREA}) e marca a área em cada ocorrência e assinatura.
// Roda na publicação, antes de o site novo entrar no ar. Depois da primeira vez não faz nada (lê 2 documentos).
// A área de cada pessoa sai da mesma conta que o sistema usa (public/pessoas.js): onde ela está nas Atividades
// ou na Operação de equipamentos; sem lugar nos módulos, fica em GERAL.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, raiz, resumo } from './comum.mjs';

// As contas ficam em public/ (são as mesmas do site). Copia como .mjs para o Node.
const lib = path.join(path.dirname(new URL(import.meta.url).pathname), 'lib');
fs.mkdirSync(lib, { recursive: true });
for (const f of ['cal', 'pessoas']) {
  const src = fs.readFileSync(path.join(raiz, 'public', f + '.js'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'");
  fs.writeFileSync(path.join(lib, f + '.mjs'), src);
}
const { SETS, SET_KEYS } = await import('./lib/cal.mjs');
const { criarPessoas, chaveFicha, FICHA_GERAL } = await import('./lib/pessoas.mjs');

const { db } = await conectar();

// Nome em maiúsculas no cadastro de cada usuário (as regras usam para "ocorrências que eu vou recolher").
let nomesAcertados = 0;
{
  const b = db.batch();
  (await db.collection('usuarios').get()).forEach(d => { const up = String(d.get('nome') || '').toUpperCase(); if (d.get('nomeUp') !== up) { b.update(d.ref, { nomeUp: up }); nomesAcertados++; } });
  if (nomesAcertados) { await b.commit(); console.log(`Nome em maiúsculas gravado em ${nomesAcertados} usuário(s).`); }
}
const antigo = await db.doc('gestao/colaboradores').get();
const atuais = await db.collection('gcolab').get();
const linhas = [];
let fichas = 0, ocorrAcertadas = 0, assinAcertadas = 0;
const areaPorMat = new Map();

if (antigo.exists && atuais.empty) {
  // Dados dos módulos para saber onde cada pessoa está
  const dados = {};
  for (const k of SET_KEYS) {
    const C = n => SETS[k].pre + n;
    const cfg = await db.doc(`${C('config')}/sistema`).get();
    const colabs = {};
    (await db.collection(C('colaboradores')).get()).forEach(d => { colabs[d.id] = d.data().itens || []; });
    dados[k] = { config: cfg.exists ? cfg.data() : null, colabs };
  }
  const eqCfg = await db.doc('eq/config').get();
  const eqCad = await db.doc('eq/cadastro').get();
  const lista = antigo.data().itens || [];
  const DB = {
    dados: k => dados[k],
    cache: { e: { config: eqCfg.exists ? eqCfg.data() : null, cad: eqCad.exists ? eqCad.data() : { operadores: [] } }, g: { colabs: lista } }
  };
  const PES = criarPessoas(DB);
  const lot = PES.lotacoes(lista);
  const grupos = {};
  for (const c of lista) { const a = chaveFicha((lot.get(String(c.mat)) || {}).area); (grupos[a] ||= []).push(c); areaPorMat.set(String(c.mat), a); }
  const b = db.batch();
  for (const [a, itens] of Object.entries(grupos)) { b.set(db.doc(`gcolab/${a}`), { itens }); linhas.push(`| ${a} | ${itens.length} |`); }
  await b.commit();
  fichas = lista.length;
} else {
  atuais.forEach(d => { for (const c of d.data().itens || []) areaPorMat.set(String(c.mat), d.id); });
}

// Ocorrências e assinaturas sem área (ou com a área errada depois da divisão)
async function acertar(colecao, areaDe) {
  const qs = await db.collection(colecao).get();
  let n = 0, b = db.batch(), lote = 0;
  for (const d of qs.docs) {
    const a = areaDe(d.data());
    if (d.get('area') === a) continue;
    b.update(d.ref, { area: a }); n++; lote++;
    if (lote === 400) { await b.commit(); b = db.batch(); lote = 0; }
  }
  if (lote) await b.commit();
  return n;
}
// Só na primeira vez (lista antiga ainda existe). Depois disso, o sistema acerta sozinho quando alguém muda de área.
if (antigo.exists) {
  const deOcorr = new Map();
  ocorrAcertadas = await acertar('gocorr', o => areaPorMat.get(String(o.mat)) || FICHA_GERAL);
  (await db.collection('gocorr').get()).forEach(d => deOcorr.set(d.id, d.get('area')));
  assinAcertadas = await acertar('gassin', s => ((s.ocorrIds || []).map(id => deOcorr.get(id)).find(Boolean)) || areaPorMat.get(String(s.mat)) || FICHA_GERAL);
}
if (antigo.exists) await db.doc('gestao/colaboradores').delete();

if (!fichas && !ocorrAcertadas && !assinAcertadas) { console.log('Fichas já estão divididas por área. Nada a fazer.'); process.exit(0); }
resumo([
  '### Efetivo dividido por área',
  fichas ? `${fichas} fichas organizadas:` : 'Fichas já estavam divididas.',
  ...(fichas ? ['', '| Área | Fichas |', '|---|---|', ...linhas, ''] : []),
  `Ocorrências com a área acertada: ${ocorrAcertadas} · assinaturas: ${assinAcertadas}.`
].join('\n'));
