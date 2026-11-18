// Troca a função de muitas pessoas de uma vez (a mesma conta da tela Administração › Funções, contas/funcoes.js).
// Só manual (Actions › Trocar função). Rode antes a Cópia de segurança.
//   FUNCAO_DE    função que sai (ex.: AJUDANTE)
//   FUNCAO_ADM / FUNCAO_TURNO   para onde vai quem é ADM / de turno (ex.: EXECUTANTE / EXECUTANTE TURNO)
//   FUNCAO_TODOS (opcional)     todos para uma função só (no lugar de ADM/turno)
//   FUNCAO_MODO = simular (padrão): só mostra quantos mudam · gravar: cópia (arquivo da execução + coleção backups) e grava.
// Grava nos três lugares: fichas (gcolab), Atividades (colaboradores e b_colaboradores) e Equipamentos (eq/cadastro,
// eq/config.funcoes), e a lista oficial config/funcoes. Sem nomes no resumo: só os números.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, resumo, codificar, gravarGz } from './comum.mjs';
import { planoTroca, regraValida, juntarListas, resumoFuncoes } from '../../public/contas/funcoes.js';
import { criarEscala } from '../../public/contas/escala.js';
import { SETS, SET_KEYS } from '../../public/contas/cal.js';

const env = k => String(process.env[k] || '').trim();
const DE = env('FUNCAO_DE'); const gravar = env('FUNCAO_MODO') === 'gravar';
const regra = env('FUNCAO_TODOS') ? { todos: env('FUNCAO_TODOS') } : { adm: env('FUNCAO_ADM'), turno: env('FUNCAO_TURNO') };
const erro = regraValida(DE, regra);
if (erro) { console.error('::error::' + erro); process.exit(1); }

const { db, F } = await conectar();
const docs = new Map(); // caminho → { ref, data }
const ler = async col => { const qs = await db.collection(col).get(); for (const d of qs.docs) docs.set(`${col}/${d.id}`, { ref: d.ref, data: d.data() }); return qs.docs; };
const um = async p => { const d = await db.doc(p).get(); if (d.exists) docs.set(p, { ref: d.ref, data: d.data() }); return d.exists ? d.data() : null; };

// fichas: uma lista por área; guarda de onde veio cada item para regravar por documento
const gDocs = await ler('gcolab');
const fichas = []; const fichaDoc = new Map();
for (const d of gDocs) for (const c of d.data().itens || []) { fichas.push(c); fichaDoc.set(c, `gcolab/${d.id}`); }
const ativ = [], ativPorArea = new Map();
for (const k of SET_KEYS) {
  const col = SETS[k].pre + 'colaboradores';
  for (const d of await ler(col)) { const l = d.data().itens || []; ativPorArea.set(`${col}/${d.id}`, l); for (const x of l) ativ.push({ set: k, area: d.id, x }); }
}
const cad = await um('eq/cadastro'); const eqCfg = await um('eq/config');
const ops = (cad && cad.operadores) || [];
const lista = ((await um('config/funcoes')) || {}).lista || [];
const esc = criarEscala((await db.doc('config/escalas').get()).data() || {}, (eqCfg && eqCfg.turmas) || {});
const eqFuncoes = (eqCfg && eqCfg.funcoes) || [];

const P = planoTroca({ fichas, ativ, ativPorArea, ops }, DE, regra, { lista: juntarListas(lista), eqFuncoes, regimes: esc.regimes, tirarDaLista: true });
const conta = f => P.mudancas.filter(f).length;
const md = [
  gravar ? `### Função ${DE.toUpperCase()} trocada` : `### Trocar função ${DE.toUpperCase()}: só conferência (nada foi gravado)`, '',
  `Regra: ${regra.todos ? `todos para **${regra.todos.toUpperCase()}**` : `ADM para **${regra.adm.toUpperCase()}**, turno para **${regra.turno.toUpperCase()}**`}.`, '',
  `**${P.mudancas.length} pessoa(s)** ${gravar ? 'mudaram' : 'mudariam'}: ${P.adm} ADM e ${P.turno} turno (${conta(m => m.desligado)} desligada(s)).`, '',
  '| De onde veio o regime | Pessoas |', '|---|---|',
  ...[...new Set(P.mudancas.map(m => m.origem))].map(o => `| ${o} | ${conta(m => m.origem === o)} |`), '',
  `Onde muda: RH ${conta(m => m.onde.includes('RH'))} · Atividades ${conta(m => m.onde.includes('Atividades'))} · Equipamentos ${conta(m => m.onde.includes('Equipamentos'))}.`, ''
];
// Na simulação, todas as funções do banco com quantas pessoas têm cada uma (sem nomes): ajuda a achar o nome exato.
const todas = resumoFuncoes({ fichas, ativ, ops }, { lista, eqFuncoes, regimes: esc.regimes });
const tabela = ['#### Todas as funções do banco', '', '| Função | Pessoas | ADM | Turno | RH | Atividades | Equipamentos |', '|---|---|---|---|---|---|---|',
  ...todas.map(f => `| ${f.nome} | ${f.pessoas} | ${f.adm} | ${f.turno} | ${f.fichas} | ${f.ativ} | ${f.ops} |`), ''];
if (!gravar) { resumo([...md, P.mudancas.length ? 'Para gravar, rode de novo com o modo **gravar**.' : 'Nada a fazer.', '', ...tabela].join('\n')); process.exit(0); }

// documentos que mudam
const novo = new Map(); // caminho → patch
if (P.fichas) {
  const porDoc = new Map();
  P.fichas.forEach((c, i) => { const p = fichaDoc.get(fichas[i]); (porDoc.get(p) || porDoc.set(p, []).get(p)).push(c); });
  for (const [p, itens] of porDoc) if (JSON.stringify(itens) !== JSON.stringify(docs.get(p).data.itens)) novo.set(p, { itens });
}
for (const [p, itens] of P.ativ) novo.set(p, { itens });
if (P.ops) novo.set('eq/cadastro', { operadores: P.ops });
if (P.eqFuncoes) novo.set('eq/config', { funcoes: P.eqFuncoes });

// cópia antes de gravar
const copia = {}; for (const p of novo.keys()) copia[p] = codificar(docs.get(p).data, F);
copia['config/funcoes'] = docs.has('config/funcoes') ? codificar(docs.get('config/funcoes').data, F) : null;
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-funcao'); fs.mkdirSync(pasta, { recursive: true });
const quando = new Date().toISOString(); const marca = quando.slice(0, 19).replace(/[:T]/g, '-');
const arq = path.join(pasta, `antes-trocar-funcao-${marca}.json.gz`);
gravarGz(arq, { em: quando, de: DE, regra, docs: copia });
let onde = `arquivo ${path.basename(arq)} guardado nesta execução`;
const json = JSON.stringify(copia);
if (json.length < 900000) {
  const id = 'antes-trocar-funcao-' + marca;
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: `antes de trocar a função ${DE}`, n: Object.keys(copia).length, json });
  onde += ` e no banco em backups/${id}`;
} else console.log('::warning::Cópia grande demais para um documento do banco; fica só o arquivo da execução.');

const b = db.batch(); const m = { atualizadoEm: F.FieldValue.serverTimestamp(), atualizadoPor: 'rotina trocar-funcao' };
for (const [p, patch] of novo) b.update(db.doc(p), p.startsWith('eq/') ? patch : { ...patch, ...m });
b.set(db.doc('config/funcoes'), { lista: P.lista, ...m });
await b.commit();
const txt = regra.todos ? `todos para ${regra.todos.toUpperCase()}` : `ADM para ${regra.adm.toUpperCase()}, turno para ${regra.turno.toUpperCase()}`;
await db.collection('historico').add({ at: F.FieldValue.serverTimestamp(), uid: 'rotina', nome: 'Rotina do GitHub', mod: 'administracao', t: `Funções: ${DE.toUpperCase()} → ${txt} (${P.mudancas.length} pessoas: ${P.adm} ADM, ${P.turno} turno); ${DE.toUpperCase()} saiu da lista` });
resumo([...md, `**Gravado:** ${novo.size + 1} documento(s).`, `**Cópia antes de gravar:** ${onde}.`].join('\n'));
