// Administração › Funções: a lista das funções (cargos) dos colaboradores, com quantas pessoas têm cada uma.
// O administrador cria, renomeia, junta e exclui funções. Renomear e juntar trocam a função de todas as pessoas de uma vez,
// nos três lugares em que ela fica (RH › Colaboradores, Atividades e Equipamentos), com prévia de quem muda e cópia antes.
// Juntar pelo regime: a mesma função com nomes diferentes no ADM e no turno (ex.: AJUDANTE → EXECUTANTE / EXECUTANTE TURNO).
// As contas ficam em contas/funcoes.js; a lista oficial, em config/funcoes (nucleo/data.js).
import { resumoFuncoes, planoTroca, regraValida, juntarListas, semFuncao, normFuncao, chaveFuncao, MAX_FUNCAO } from '../contas/funcoes.js';
import { SET_KEYS, areasDoSet } from '../contas/cal.js';
import { escala } from '../calc/presenca.js';
import { indicadores, tabela, etiqueta, vazio, carregando } from '../ui/padrao.js';
import { DB, esc, title, TODAY } from '../nucleo/base.js';
import { UI, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const U = () => (UI.fn ||= { troca: null });
const v$ = id => (document.getElementById(id) || {}).value || '';
// Sugestão do pedido do Eduardo (2026-11): Ajudante e Executante são a mesma função; muda só o regime.
const SUGESTAO = { de: 'AJUDANTE', adm: 'EXECUTANTE', turno: 'EXECUTANTE TURNO' };

/* ---------- dados ---------- */
const carregou = () => !!(DB.cache.g && DB.cache.g.loaded) && (!DB.cache.funcoes || DB.cache.funcoes.loaded !== false);
function fontes() {
  const ativ = [], ativPorArea = new Map();
  for (const k of SET_KEYS) {
    const st = DB.dados(k); if (!st || !st.config) continue;
    for (const a of areasDoSet(k)) { const l = (st.colabs || {})[a]; if (!l || !l.length) continue; ativPorArea.set(k + '|' + a, l); for (const x of l) ativ.push({ set: k, area: a, x }); }
  }
  const e = DB.cache.e || {};
  return { fichas: (DB.cache.g && DB.cache.g.colabs) || [], ativ, ativPorArea, ops: (e.cad && e.cad.operadores) || [] };
}
const opcoes = () => ({ lista: (DB.cache.funcoes && DB.cache.funcoes.lista) || [], eqFuncoes: (DB.cache.e && DB.cache.e.config && DB.cache.e.config.funcoes) || [], regimes: escala().regimes });
const resumo = () => resumoFuncoes(fontes(), opcoes());

/* ---------- desenho ---------- */
const onde = f => [f.fichas && `RH ${f.fichas}`, f.ativ && `Atividades ${f.ativ}`, f.ops && `Equipamentos ${f.ops}`].filter(Boolean).join(' · ');
function vLista() {
  const R = resumo();
  const semNinguem = R.filter(f => !f.pessoas);
  const temLista = opcoes().lista.length > 0; // antes da primeira gravação a lista oficial está vazia: não marca nada
  const sug = R.find(f => chaveFuncao(f.nome) === chaveFuncao(SUGESTAO.de) && f.pessoas);
  const topo = indicadores([
    { rotulo: 'Funções', valor: String(R.length) },
    { rotulo: 'Em uso', valor: String(R.length - semNinguem.length) },
    { rotulo: 'Sem ninguém', valor: String(semNinguem.length), situacao: semNinguem.length ? 'atencao' : '' }
  ]);
  const cartaoSug = sug ? `<div class="card fn-sug"><div class="body"><b>${esc(title(SUGESTAO.de))} e ${esc(title(SUGESTAO.adm))} são a mesma função?</b>
    <p class="muted small m0">${sug.pessoas} pessoa${sug.pessoas === 1 ? '' : 's'} como ${esc(title(SUGESTAO.de))}: ${sug.adm} no ADM e ${sug.turno} no turno. Passa quem é ADM para ${esc(title(SUGESTAO.adm))}, quem é de turno para ${esc(title(SUGESTAO.turno))} e tira ${esc(title(SUGESTAO.de))} da lista. Antes de gravar, você vê a lista de quem muda.</p>
    <div class="row-gap"><button type="button" class="btn sm" data-act="fnSugestao">Ver quem muda</button></div></div></div>` : '';
  const linhas = R.map(f => [`<b>${esc(f.nome)}</b>${f.naLista || !temLista ? '' : ' ' + etiqueta('fora da lista', 'info')}`, String(f.pessoas), String(f.adm), String(f.turno), `<span class="small muted">${esc(onde(f) || '—')}</span>`]);
  const tab = R.length ? tabela([{ t: 'Função' }, { t: 'Pessoas', n: true }, { t: 'ADM', n: true }, { t: 'Turno', n: true }, { t: 'Onde está' }], linhas, {
    rotulo: 'Funções',
    acoes: (l, i) => `<span class="row-gap fn-bts"><button type="button" class="btn sm ghost" data-act="fnTrocar" data-i="${i}">Renomear ou juntar</button><button type="button" class="btn sm ghost" data-act="fnExcluir" data-i="${i}">Excluir</button></span>`
  }) : vazio('Nenhuma função cadastrada', 'Crie a primeira em Nova função.');
  return `${topo}${cartaoSug}<div class="card"><div class="body"><p class="muted small m0">Pessoas = quem tem a função em pelo menos um lugar (RH, Atividades ou Equipamentos). ADM e Turno pelo regime de hoje.</p></div></div>${tab}`;
}

function vTroca() {
  const t = U().troca; const R = resumo();
  const lista = `<datalist id="fnDl">${R.map(f => `<option value="${esc(f.nome)}"></option>`).join('')}</datalist>`;
  const fixo = t.plano ? 'disabled' : '';
  const campo = (id, rot, v) => `<label class="sel"><span>${rot}</span><input class="in" id="${id}" list="fnDl" maxlength="${MAX_FUNCAO}" autocomplete="off" value="${esc(v || '')}" ${fixo}></label>`;
  const seg = `<div class="seg fn-modo" role="tablist" aria-label="Como trocar">${[['todos', 'Todos para uma função'], ['regime', 'Depende do regime']].map(([m, n]) => `<button type="button" role="tab" data-act="fnModo" data-m="${m}" aria-selected="${t.modo === m}" ${fixo}>${n}</button>`).join('')}</div>`;
  const form = `<div class="card"><div class="body">
    <h2 class="disp">Trocar a função ${esc(t.de)}</h2>
    <p class="muted small">Para renomear, escreva o nome novo. Para juntar, escolha uma função que já existe. A troca vale no RH › Colaboradores, nas Atividades e nos Equipamentos.</p>
    ${seg}
    <div class="row2">${t.modo === 'todos' ? campo('fnTodos', 'Todos passam para', t.todos) : campo('fnAdm', 'Quem é ADM passa para', t.adm) + campo('fnTurno', 'Quem é de turno passa para', t.turno)}</div>
    ${lista}
    <div class="row-gap">${t.plano ? '<button type="button" class="btn sm ghost" data-act="fnMudar">Mudar a troca</button>' : '<button type="button" class="btn pri" data-act="fnPrevia">Ver quem muda</button>'}<button type="button" class="btn sm ghost" data-act="fnFechar">Cancelar</button></div>
    <p class="err" id="fnErr" ${t.erro ? '' : 'hidden'}>${esc(t.erro || '')}</p>
  </div></div>`;
  if (!t.plano) return form;
  const P = t.plano;
  if (!P.mudancas.length) return form + vazio('Ninguém muda', `Nenhuma pessoa tem a função ${t.de} agora. Ao gravar, a lista oficial é atualizada.`, `<button type="button" class="btn pri" data-act="fnGravar">Atualizar a lista</button>`);
  const topo = indicadores([{ rotulo: 'Pessoas que mudam', valor: String(P.mudancas.length) }, { rotulo: 'ADM', valor: String(P.adm) }, { rotulo: 'Turno', valor: String(P.turno) }, { rotulo: 'Documentos gravados', valor: String((P.fichas ? 1 : 0) + P.ativ.size + (P.ops ? 1 : 0) + (P.eqFuncoes ? 1 : 0) + 1) }]);
  const linhas = P.mudancas.map(m => [`<b>${esc(title(m.nome))}</b>${m.desligado ? ' ' + etiqueta('desligado', 'neutro') : ''}`, `<span class="mono">${esc(m.mat || '—')}</span>`, `${esc(m.regime === 'ADM' ? 'ADM' : 'Turno')}<div class="muted small">${esc(m.origem)}</div>`, `${esc(m.de)} → <b>${esc(m.para)}</b>`, `<span class="small">${esc(m.onde.join(', '))}</span>`]);
  const passos = `<div class="card"><div class="body">
    <b>Antes de gravar</b>
    <p class="muted small">1) Baixe a cópia de como está hoje (arquivo no seu aparelho, para desfazer se precisar). 2) Grave. A troca fica no Histórico de alterações.</p>
    <div class="row-gap"><button type="button" class="btn" data-act="fnCopia">${I.dl || ''} ${t.baixou ? 'Cópia baixada' : 'Baixar cópia'}</button><button type="button" class="btn pri" data-act="fnGravar" ${t.baixou && !t.gravando ? '' : 'disabled'}>${t.gravando ? 'Gravando…' : `Gravar a troca (${P.mudancas.length} pessoa${P.mudancas.length === 1 ? '' : 's'})`}</button></div>
  </div></div>`;
  return form + topo + tabela([{ t: 'Nome' }, { t: 'Matrícula' }, { t: 'Regime' }, { t: 'Função' }, { t: 'Onde muda' }], linhas, { rotulo: 'Quem muda' }) + passos;
}

function vTela() {
  if (!isAdmin()) return vazio('Só o administrador', 'Esta tela é do administrador do sistema.');
  if (!carregou()) return carregando();
  return `<div class="fn-tela">${U().troca ? vTroca() : vLista()}</div>`;
}

/* ---------- ações ---------- */
const doItem = i => resumo()[+i];
function abrirTroca(de, extra = {}) { UI.fn = { troca: { de: normFuncao(de), modo: 'todos', todos: '', adm: '', turno: '', plano: null, baixou: false, ...extra } }; render(); window.scrollTo(0, 0); }
function lerCampos() {
  const t = U().troca;
  if (t.modo === 'todos') t.todos = v$('fnTodos'); else { t.adm = v$('fnAdm'); t.turno = v$('fnTurno'); }
}
const regraDe = t => (t.modo === 'todos' ? { todos: normFuncao(t.todos) } : { adm: normFuncao(t.adm), turno: normFuncao(t.turno) });
acoes.fnSugestao = () => abrirTroca(SUGESTAO.de, { modo: 'regime', adm: SUGESTAO.adm, turno: SUGESTAO.turno });
acoes.fnTrocar = (el, d) => { const f = doItem(d.i); if (f) abrirTroca(f.nome); };
acoes.fnFechar = () => { UI.fn = { troca: null }; render(); };
acoes.fnModo = (el, d) => { const t = U().troca; if (!t || t.plano) return; lerCampos(); t.modo = d.m; render(); };
acoes.fnMudar = () => { const t = U().troca; t.plano = null; t.baixou = false; render(); };
acoes.fnPrevia = () => {
  const t = U().troca; lerCampos();
  const regra = regraDe(t); const erro = regraValida(t.de, regra);
  t.erro = erro; if (erro) { render(); return; }
  t.plano = planoTroca(fontes(), t.de, regra, { ...opcoes(), tirarDaLista: true }); t.baixou = false; render();
};
acoes.fnCopia = () => {
  const t = U().troca; if (!t || !t.plano) return;
  const f = fontes(); const o = opcoes();
  const antes = { fichas: f.fichas, atividades: Object.fromEntries([...t.plano.ativ.keys()].map(k => [k, f.ativPorArea.get(k)])), operadores: f.ops, eqFuncoes: o.eqFuncoes, lista: o.lista };
  try {
    const blob = new Blob([JSON.stringify({ tipo: 'dikma-funcoes', versao: 1, geradoEm: new Date().toISOString(), de: t.de, regra: regraDe(t), mudancas: t.plano.mudancas, antes }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `copia-funcoes-${TODAY}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    t.baixou = true; toast('Cópia baixada · guarde o arquivo antes de gravar'); render();
  } catch (e) { toast('Não foi possível gerar a cópia neste aparelho'); }
};
acoes.fnGravar = async () => {
  const t = U().troca; if (!t || !t.plano || t.gravando) return;
  // Refaz o plano com os dados de agora (alguém pode ter mexido no cadastro depois da prévia).
  const regra = regraDe(t);
  const P = planoTroca(fontes(), t.de, regra, { ...opcoes(), tirarDaLista: true });
  if (P.mudancas.length !== t.plano.mudancas.length) { t.plano = P; t.baixou = false; toast('O cadastro mudou depois da prévia: confira a lista e baixe a cópia de novo'); render(); return; }
  if (P.mudancas.length && !t.baixou) return;
  t.gravando = true; render();
  try {
    const w = [];
    if (P.fichas) w.push(DB.gSalvarColabs(P.fichas));
    for (const [ka, l] of P.ativ) { const [k, a] = ka.split('|'); DB.dados(k).colabs[a] = l; w.push(DB.salvarColabsArea(a, l, k)); }
    if (P.ops) { DB.cache.e.cad = { ...DB.cache.e.cad, operadores: P.ops }; w.push(DB.eSalvarCad({ operadores: P.ops })); }
    if (P.eqFuncoes) w.push(DB.eSalvarConfig({ funcoes: P.eqFuncoes }));
    w.push(DB.funcoesSalvar(P.lista));
    await Promise.all(w);
    const txt = regra.todos ? `todos para ${regra.todos}` : `ADM para ${regra.adm}, turno para ${regra.turno}`;
    DB.log(`Funções: ${t.de} → ${txt} (${P.mudancas.length} pessoas: ${P.adm} ADM, ${P.turno} turno); ${t.de} saiu da lista`, 'administracao');
    UI.fn = { troca: null }; toast(`Função trocada para ${P.mudancas.length} pessoa${P.mudancas.length === 1 ? '' : 's'}`); render();
  } catch (e) { t.gravando = false; toast('Erro ao gravar: ' + ((e && e.message) || e)); render(); }
};
acoes.fnNova = () => {
  formSheet('Nova função', 'Fica na lista para escolher no cadastro das pessoas.', `<label class="sel"><span>Nome da função</span><input class="in" id="fnNome" maxlength="${MAX_FUNCAO}" autocomplete="off" required></label><p class="err" id="shErr" hidden></p>`, 'Criar', async () => {
    const nome = normFuncao(v$('fnNome')); if (!nome) throw new Error('Escreva o nome da função.');
    if (resumo().some(f => chaveFuncao(f.nome) === chaveFuncao(nome))) throw new Error(`A função ${nome} já existe.`);
    await DB.funcoesSalvar(juntarListas(opcoes().lista, resumo().map(f => f.nome), [nome]));
    DB.log(`Funções: criou ${nome}`, 'administracao'); toast(`Função ${nome} criada`);
  });
};
acoes.fnExcluir = (el, d) => {
  const f = doItem(d.i); if (!f) return;
  if (f.pessoas) { toast(`${f.pessoas} pessoa${f.pessoas === 1 ? ' tem' : 's têm'} a função ${f.nome}: use Renomear ou juntar para passá-las a outra`); return; }
  formSheet(`Excluir ${f.nome}?`, 'Ninguém tem esta função. Ela sai da lista oficial e da lista dos Equipamentos.', '<p class="err" id="shErr" hidden></p>', 'Excluir', async () => {
    const o = opcoes(); const w = [DB.funcoesSalvar(semFuncao(juntarListas(o.lista, resumo().map(x => x.nome)), f.nome))];
    if (o.eqFuncoes.some(x => chaveFuncao(x) === f.chave)) w.push(DB.eSalvarConfig({ funcoes: semFuncao(o.eqFuncoes, f.nome) }));
    await Promise.all(w); DB.log(`Funções: excluiu ${f.nome}`, 'administracao'); toast(`Função ${f.nome} excluída`);
  });
};

export function topo() { return U().troca ? '' : `<button type="button" class="btn pri" data-act="fnNova">${I.plus} Nova função</button>`; }
export const renderView = () => vTela();
