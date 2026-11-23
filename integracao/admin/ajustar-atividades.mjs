// Acerta a lista de pessoas das Atividades (colaboradores / b_colaboradores) sem passar pela tela:
//   tira cadastros repetidos ou de quem não trabalha mais (pelo número, ex.: C037, B024) e
//   inclui quem tem ficha (RH › Colaboradores) mas não está em nenhuma lista (pela matrícula) numa área geral sem rota.
// Só manual (Actions › Ajustar pessoas das Atividades). Rode antes a Cópia de segurança.
//   AJ_REMOVER  números separados por vírgula (ex.: C037,C039,B024) · só sai quem NÃO tem matrícula ou tem matrícula
//               repetida em outro cadastro (para nunca apagar a única entrada de alguém)
//   AJ_INCLUIR  matrículas separadas por vírgula (ex.: 4612,8190) · precisa ter ficha e não estar em nenhuma lista
//   AJ_AREA     área geral onde entram (padrão COQUERIA GERAL)
//   AJ_MODO     simular (padrão): só mostra · gravar: cópia (arquivo da execução + coleção backups) e grava
// O resumo não mostra nomes: só números e matrículas.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, resumo, codificar, gravarGz } from './comum.mjs';
import { SETS, SET_KEYS, setDaArea, AREAS_GERAIS } from '../../public/contas/cal.js';

const env = k => String(process.env[k] || '').trim();
const lista = k => env(k).toUpperCase().split(/[\s,;]+/).filter(Boolean);
const REMOVER = lista('AJ_REMOVER'), INCLUIR = lista('AJ_INCLUIR');
const AREA = (env('AJ_AREA') || 'COQUERIA GERAL').toUpperCase();
const gravar = env('AJ_MODO') === 'gravar';
if (!REMOVER.length && !INCLUIR.length) { console.error('::error::Informe números para tirar ou matrículas para incluir.'); process.exit(1); }
if (INCLUIR.length && !AREAS_GERAIS.includes(AREA)) { console.error(`::error::Área "${AREA}" não é uma área geral (${AREAS_GERAIS.join(', ')}).`); process.exit(1); }

const { db, F } = await conectar();
const docs = new Map(); // caminho → { itens, maiorId }
for (const k of SET_KEYS) {
  const col = SETS[k].pre + 'colaboradores';
  for (const d of (await db.collection(col).get()).docs) docs.set(`${col}/${d.id}`, { k, area: d.id, data: d.data() });
}
const todos = [...docs.values()].flatMap(d => (d.data.itens || []).map(x => ({ ...d, x })));
const fichas = (await db.collection('gcolab').get()).docs.flatMap(d => d.data().itens || []);
const numId = id => parseInt(String(id || '').replace(/\D/g, ''), 10) || 0;
const novo = new Map(); // caminho → itens
const itensDe = p => novo.get(p) || (docs.get(p).data.itens || []).slice();
const linhas = [], erros = [];

for (const id of REMOVER) {
  const y = todos.find(t => String(t.x.id).toUpperCase() === id);
  if (!y) { erros.push(`${id}: não encontrado`); continue; }
  const mat = y.x.mat ? String(y.x.mat) : '';
  const outro = mat && todos.some(t => t.x !== y.x && String(t.x.mat || '') === mat);
  if (mat && !outro) { erros.push(`${id}: tem matrícula e é o único cadastro dela; não sai`); continue; }
  const p = `${SETS[y.k].pre}colaboradores/${y.area}`;
  novo.set(p, itensDe(p).filter(x => x.id !== y.x.id));
  linhas.push(`| tirar | ${id} | ${y.area} | ${mat ? 'repetido' : 'sem matrícula'} |`);
}

const kNovo = setDaArea(AREA);
const pNovo = `${SETS[kNovo].pre}colaboradores/${AREA}`;
let maior = Math.max(0, ...[...docs.values()].filter(d => d.k === kNovo).map(d => Math.max(+d.data.maiorId || 0, ...(d.data.itens || []).map(x => numId(x.id)))));
for (const mat of INCLUIR) {
  const f = fichas.find(c => String(c.mat) === mat);
  if (!f) { erros.push(`matrícula ${mat}: sem ficha`); continue; }
  if (f.dem) { erros.push(`matrícula ${mat}: ficha com demissão`); continue; }
  if (todos.some(t => String(t.x.mat || '') === mat)) { erros.push(`matrícula ${mat}: já está numa lista`); continue; }
  const id = SETS[kNovo].idp + String(++maior).padStart(3, '0');
  const item = { id, mat, nome: f.nome, funcao: f.funcao || '', area: AREA, rota: AREA, regime: 'ADMINISTRATIVO' };
  novo.set(pNovo, itensDe(pNovo).concat([item]).sort((a, b) => a.nome.localeCompare(b.nome)));
  linhas.push(`| incluir | ${id} | ${AREA} | matrícula ${mat} |`);
}

const md = [gravar ? '### Pessoas das Atividades ajustadas' : '### Ajustar pessoas das Atividades: só conferência (nada foi gravado)', '',
  '| Ação | Número | Área | Detalhe |', '|---|---|---|---|', ...linhas, '',
  ...(erros.length ? ['**Não feito:**', ...erros.map(e => `- ${e}`), ''] : [])];
if (!gravar || !novo.size) { resumo([...md, novo.size ? 'Para gravar, rode de novo com o modo **gravar**.' : 'Nada a gravar.'].join('\n')); process.exit(0); }

// cópia antes de gravar
const copia = {}; for (const p of novo.keys()) copia[p] = docs.has(p) ? codificar(docs.get(p).data, F) : null;
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-ajuste'); fs.mkdirSync(pasta, { recursive: true });
const quando = new Date().toISOString(); const marca = quando.slice(0, 19).replace(/[:T]/g, '-');
const arq = path.join(pasta, `antes-ajustar-atividades-${marca}.json.gz`);
gravarGz(arq, { em: quando, remover: REMOVER, incluir: INCLUIR, area: AREA, docs: copia });
const json = JSON.stringify(copia);
let onde = `arquivo ${path.basename(arq)} guardado nesta execução`;
if (json.length < 900000) {
  const id = 'antes-ajustar-atividades-' + marca;
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: 'antes de ajustar pessoas das Atividades', n: Object.keys(copia).length, json });
  onde += ` e no banco em backups/${id}`;
}

const b = db.batch(); const m = { atualizadoEm: F.FieldValue.serverTimestamp(), atualizadoPor: 'rotina ajustar-atividades' };
for (const [p, itens] of novo) {
  const k = docs.has(p) ? docs.get(p).k : kNovo;
  const maiorId = Math.max(...[...docs.values()].filter(d => d.k === k).map(d => +d.data.maiorId || 0), ...itens.map(x => numId(x.id)), k === kNovo ? maior : 0);
  b.set(db.doc(p), { itens, maiorId, ...m }, { merge: true });
}
await b.commit();
await db.collection('historico').add({ at: F.FieldValue.serverTimestamp(), uid: 'rotina', nome: 'Rotina do GitHub', mod: 'administracao', t: `Atividades: ${REMOVER.length ? 'tirados ' + REMOVER.join(', ') : ''}${REMOVER.length && INCLUIR.length ? '; ' : ''}${INCLUIR.length ? `incluídas ${INCLUIR.length} pessoa(s) em ${AREA}` : ''}` });
resumo([...md, `**Gravado:** ${novo.size} documento(s).`, `**Cópia antes de gravar:** ${onde}.`].join('\n'));
