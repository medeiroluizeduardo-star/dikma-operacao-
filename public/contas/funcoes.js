// Dikma Gestão — lista de funções (cargos) e troca de função de muitas pessoas de uma vez (Administração › Funções).
// Sem tela e sem banco: as mesmas contas servem à tela (telas/funcoes.js) e aos testes (testes/funcoes.test.mjs).
//
// A função de uma pessoa fica gravada em até três lugares, que precisam andar juntos:
//   fichas (gcolab/{ÁREA}.itens[].funcao)   · cadastro único do RH (RH › Colaboradores)
//   Atividades (colaboradores/{ÁREA} e b_colaboradores/{ÁREA}.itens[].funcao)
//   Equipamentos (eq/cadastro.operadores[].funcao; a lista do formulário fica em eq/config.funcoes)
// A lista oficial (config/funcoes.lista) guarda também as funções criadas que ainda não têm ninguém.
//
// Trocar pelo regime: a mesma função com nomes diferentes para ADM e turno (ex.: AJUDANTE → EXECUTANTE no
// administrativo e EXECUTANTE TURNO no turno). O regime de hoje sai, nesta ordem, das Atividades (regime), dos
// Equipamentos (escala) e da turma da ficha (letra = turno); sem nada disso, vale ADM. O que valia antes de uma troca de
// escala (escHist) não importa aqui: a função não tem histórico, vale o regime de hoje.
import { normRegime, letra } from './escala.js';

export const MAX_FUNCAO = 60;
// Como a função é gravada: maiúsculas, um espaço entre as palavras.
export const normFuncao = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim().slice(0, MAX_FUNCAO);
// Para comparar: sem acento (LÍDER = LIDER).
export const chaveFuncao = s => normFuncao(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const normNome = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Pessoas juntando as três fontes (pela matrícula e, sem ela, pelo nome).
// f = { fichas: [ficha], ativ: [{ set, area, x }], ops: [operador] }
export function pessoasDe(f) {
  const P = new Map(); const porMat = new Map(), porNome = new Map();
  const nova = (k, x) => { const p = { chave: k, mat: x.mat ? String(x.mat) : '', nome: x.nome || '', ficha: null, ativ: [], ops: [] }; P.set(k, p); if (p.mat) porMat.set(p.mat, p); if (p.nome) porNome.set(normNome(p.nome), p); return p; };
  const achar = x => (x.mat && porMat.get(String(x.mat))) || (x.nome && porNome.get(normNome(x.nome))) || null;
  for (const c of f.fichas || []) { const p = achar(c) || nova(c.mat ? 'M:' + c.mat : 'N:' + normNome(c.nome), c); if (!p.ficha) p.ficha = c; }
  for (const y of f.ativ || []) (achar(y.x) || nova(y.x.mat ? 'M:' + y.x.mat : 'N:' + normNome(y.x.nome), y.x)).ativ.push(y);
  for (const o of f.ops || []) (achar(o) || nova(o.mat ? 'M:' + o.mat : 'N:' + normNome(o.nome), o)).ops.push(o);
  return [...P.values()];
}

// Regime de hoje da pessoa: { regime: 'ADM' | 'TURNO', origem }.
export function regimeDe(p, regimes) {
  const a = p.ativ[0] && p.ativ[0].x;
  if (a && a.regime) return { regime: normRegime(a.regime, regimes) === 'ADM' ? 'ADM' : 'TURNO', origem: 'Atividades' };
  const o = p.ops[0];
  if (o) return { regime: normRegime(o.escala, regimes) === 'ADM' ? 'ADM' : 'TURNO', origem: 'Equipamentos' };
  if (p.ficha && letra(p.ficha.turma) && !/^ADM/i.test(String(p.ficha.turma))) return { regime: 'TURNO', origem: 'turma da ficha' };
  return { regime: 'ADM', origem: p.ficha && String(p.ficha.turma || '').trim() ? 'turma da ficha' : 'sem regime no cadastro (vale ADM)' };
}

// Todas as funções em uso e as da lista oficial, com quantas pessoas têm cada uma.
// lista = config/funcoes.lista · eqFuncoes = eq/config.funcoes
export function resumoFuncoes(f, { lista = [], eqFuncoes = [], regimes } = {}) {
  const M = new Map();
  const item = nome => { const k = chaveFuncao(nome); if (!k) return null; if (!M.has(k)) M.set(k, { nome: normFuncao(nome), chave: k, pessoas: 0, adm: 0, turno: 0, fichas: 0, ativ: 0, ops: 0, naLista: false, naListaEq: false }); return M.get(k); };
  for (const n of lista) { const it = item(n); if (it) it.naLista = true; }
  for (const n of eqFuncoes) { const it = item(n); if (it) it.naListaEq = true; }
  for (const p of pessoasDe(f)) {
    const fs = new Set();
    const usa = (fn, campo) => { const it = item(fn); if (!it) return; it[campo]++; fs.add(it.chave); };
    if (p.ficha) usa(p.ficha.funcao, 'fichas');
    for (const y of p.ativ) usa(y.x.funcao, 'ativ');
    for (const o of p.ops) usa(o.funcao, 'ops');
    const r = regimeDe(p, regimes).regime;
    for (const k of fs) { const it = M.get(k); it.pessoas++; it[r === 'ADM' ? 'adm' : 'turno']++; }
  }
  return [...M.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

// Para onde vai cada pessoa: regra = { todos: 'NOVA' } ou { adm: 'X', turno: 'Y' }.
export const destinoDe = (regra, regime) => normFuncao(regra.todos != null && regra.todos !== '' ? regra.todos : regime === 'ADM' ? regra.adm : regra.turno);
export function regraValida(de, regra) {
  if (!chaveFuncao(de)) return 'Escolha a função que vai mudar.';
  const alvos = regra.todos != null ? [regra.todos] : [regra.adm, regra.turno];
  if (alvos.some(x => !chaveFuncao(x))) return regra.todos != null ? 'Escreva o novo nome da função.' : 'Escreva a função do ADM e a do turno.';
  if (alvos.every(x => chaveFuncao(x) === chaveFuncao(de))) return 'O nome novo é igual ao atual.';
  return '';
}

// Plano da troca, sem gravar. Devolve as pessoas que mudam e as listas novas de cada documento que muda.
//   mudancas: [{ chave, mat, nome, regime, origem, de, para, onde: ['RH', 'Atividades', 'Equipamentos'], desligado }]
//   fichas: lista nova (ou null se nada muda) · ativ: Map 'conjunto|ÁREA' → lista nova · ops: lista nova (ou null)
//   lista: lista oficial nova · eqFuncoes: lista nova do formulário dos Equipamentos (ou null se não muda)
// tirarDaLista: a função antiga sai da lista oficial (juntar e renomear: sim).
// fontes completas: f.ativPorArea = Map 'conjunto|ÁREA' → itens (para regravar a área inteira).
export function planoTroca(f, de, regra, { lista = [], eqFuncoes = [], regimes, tirarDaLista = true } = {}) {
  const kDe = chaveFuncao(de);
  const ehDe = x => chaveFuncao(x) === kDe;
  const mud = new Map(); // item original → função nova
  const mudancas = [];
  for (const p of pessoasDe(f)) {
    const itens = [p.ficha && ['RH', p.ficha], ...p.ativ.map(y => ['Atividades', y.x]), ...p.ops.map(o => ['Equipamentos', o])].filter(Boolean).filter(([, x]) => ehDe(x.funcao));
    if (!itens.length) continue;
    const r = regimeDe(p, regimes); const para = destinoDe(regra, r.regime);
    if (!para || chaveFuncao(para) === kDe && normFuncao(para) === normFuncao(itens[0][1].funcao)) continue;
    for (const [, x] of itens) mud.set(x, para);
    mudancas.push({ chave: p.chave, mat: p.mat, nome: p.nome, regime: r.regime, origem: r.origem, de: normFuncao(itens[0][1].funcao), para, onde: [...new Set(itens.map(([o]) => o))], desligado: !!(p.ficha && p.ficha.dem) });
  }
  mudancas.sort((a, b) => a.nome.localeCompare(b.nome));
  const troca = l => { let n = false; const out = l.map(x => (mud.has(x) ? ((n = true), { ...x, funcao: mud.get(x) }) : x)); return n ? out : null; };
  const fichas = troca(f.fichas || []);
  const ativ = new Map();
  for (const [k, l] of f.ativPorArea || new Map()) { const n = troca(l); if (n) ativ.set(k, n); }
  const ops = troca(f.ops || []);
  const alvos = [...new Set(mudancas.map(m => m.para).concat(regra.todos != null ? [normFuncao(regra.todos)] : [normFuncao(regra.adm), normFuncao(regra.turno)]).filter(Boolean))];
  const semDe = l => l.filter(x => !(tirarDaLista && ehDe(x)));
  const listaNova = juntarListas(semDe(lista), alvos);
  let eqNova = null;
  if (eqFuncoes.some(ehDe)) {
    const dosOps = [...new Set(mudancas.filter(m => m.onde.includes('Equipamentos')).map(m => m.para))];
    eqNova = juntarListas(eqFuncoes.filter(x => !ehDe(x)), dosOps.length ? dosOps : alvos.slice(0, 1));
  }
  return { mudancas, fichas, ativ, ops, lista: listaNova, eqFuncoes: eqNova, adm: mudancas.filter(m => m.regime === 'ADM').length, turno: mudancas.filter(m => m.regime === 'TURNO').length };
}

// Junta listas de funções sem repetir (comparando sem acento) e em ordem alfabética.
export function juntarListas(...ls) {
  const m = new Map();
  for (const l of ls) for (const x of l || []) { const k = chaveFuncao(x); if (k && !m.has(k)) m.set(k, normFuncao(x)); }
  return [...m.values()].sort((a, b) => a.localeCompare(b));
}
// Excluir só a função que ninguém usa: tira da lista oficial e da lista dos Equipamentos.
export function semFuncao(l, nome) { const k = chaveFuncao(nome); return (l || []).filter(x => chaveFuncao(x) !== k); }
