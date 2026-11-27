// Gestão › Tratativas: os planos de ação de todas as origens num lugar só (era Ações, Planos 5W2H e Atas do Meu painel).
// Três partes: Ações (a lista, com o 5W2H, responsável, prazo e a evolução em comentários), Planos 5W2H (agrupam ações)
// e Atas de reunião (os encaminhamentos viram ações). As contas ficam em contas/tratativas.js; o banco, em
// tratativas/{id} (nucleo/data.js). As ações antigas de Causas e ações aparecem junto, como origem Atividades.
// Quem vê: quem tem a Gestão. Quem cria e edita: administrador e Gestão (Gestor, Coordenador e Supervisor), com o item
// "Criar e acompanhar tratativas" de Perfis e permissões.
import { ORIGENS, STATUS, CONJ, W5, w5, w5n, aberta, atrasada, conferirAcao, conferirPlano, conferirAta, acoesDaAta, novoComentario, deAcaoAntiga, filtrar, ordenar, resumo, andamentoPlano, textoAta, linhasExcel } from '../contas/tratativas.js';
import { AREA_S, today } from '../contas/cal.js';
import { etiqueta, vazio, carregando, abas, dados } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, isAdmin, podeItem, perfil, setsDe, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';

const TODAY = today();
const U = () => (UI.tr ||= { aba: 'acoes', sit: 'abertas', origem: 'todas', conj: 'todos', plano: 'todos', q: '', minhas: false });
const dm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const dmy = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const v$ = id => (document.getElementById(id) || {}).value || '';
const marcado = id => !!(document.getElementById(id) || {}).checked;

export const veTratativas = () => isAdmin() || !!perfil('gestao');
export const editaTratativas = () => isAdmin() || (['gestor', 'coordenador', 'supervisor'].includes(perfil('gestao')) && podeItem('i_acoes', 'gestao'));
const podeApagar = t => isAdmin() || (editaTratativas() && (perfil('gestao') === 'gestor' || t.criadoPor === ME.uid));

/* ---------- dados ---------- */
function base() { if (DB.tratWatch) DB.tratWatch(); return DB.cache.trat || { d: {}, loaded: false }; }
// Ações antigas de Causas e ações (Pátio e Bateria do acesso à Gestão), no formato das tratativas.
function antigas() {
  const out = [];
  for (const k of setsDe(ME, 'gestao').filter(x => x === 'patio' || x === 'bateria' || x === 'sinter')) {
    const st = DB.dados(k); if (!st || !st.acoes) continue;
    for (const a of Object.values(st.acoes)) if (a && a.acao) out.push(deAcaoAntiga(a, k));
  }
  return out;
}
function tudo() {
  const b = base(); const docs = Object.values(b.d || {});
  return { b, acoesL: [...docs.filter(x => x.tipo === 'acao'), ...antigas()], planos: Object.fromEntries(docs.filter(x => x.tipo === 'plano').map(x => [x.id, x])), atas: docs.filter(x => x.tipo === 'ata') };
}
const achar = id => { const { acoesL } = tudo(); return acoesL.find(t => t.id === id); };

/* ---------- desenho ---------- */
const sitEtq = t => (atrasada(t, TODAY) ? etiqueta('Atrasada', 'critico') : t.status === 'feita' ? etiqueta('Concluída', 'ok') : t.status === 'cancelada' ? etiqueta('Cancelada', 'neutro') : t.status === 'andamento' ? etiqueta('Em andamento', 'info') : etiqueta('A fazer', 'atencao'));
const barra5 = t => { const f = w5(t); const n = w5n(t); return `<span class="tr-w5${n === 7 ? ' cheio' : ''}" title="5W2H: ${n} de 7 respondidos" aria-label="5W2H: ${n} de 7 respondidos">${W5.map(([k, l]) => `<i class="${f[k] ? 'on' : ''}" title="${esc(l)}">${k === 'como' || k === 'quanto' ? 'H' : 'W'}</i>`).join('')}</span>`; };
function itemAcao(t, planos) {
  const p = t.plano && planos[t.plano];
  const meta = [ORIGENS[t.origem] || '', CONJ[t.conj] || '', t.area ? AREA_S[t.area] || t.area : '', t.resp ? 'resp. ' + t.resp : '', t.prazo ? 'prazo ' + dm(t.prazo) : 'sem prazo'].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${aberta(t) ? '' : ' fechada'}" data-act="trAbrir" data-id="${esc(t.id)}"><span class="tr-it-s">${sitEtq(t)}</span>
    <span class="tr-it-t"><b>${esc(t.titulo)}</b><small>${meta}${p ? ` · <span class="tr-plano">${esc(p.nome)}</span>` : ''}${t.legado ? ' · <span class="tag" title="Criada em Causas e ações antes das Tratativas">antiga</span>' : ''}${(t.evol || []).length ? ` · ${(t.evol || []).length} comentário${(t.evol || []).length > 1 ? 's' : ''}` : ''}</small></span>${barra5(t)}</button>`;
}
function cartoes(r) {
  const c = (sit, rot, v, sub, cls) => `<button type="button" class="p-ind md-card ${cls}${U().sit === sit ? ' md-on' : ''}" data-act="trSit" data-v="${sit}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></button>`;
  return `<div class="md-cards">${[
    c('abertas', 'Abertas', r.abertas, 'a fazer e em andamento', ''),
    c('atrasadas', 'Atrasadas', r.atrasadas, 'prazo vencido', r.atrasadas ? 'critico' : ''),
    c('semana', 'Vencem em 7 dias', r.semana, 'até ' + dm(new Date(Date.parse(TODAY + 'T12:00:00Z') + 7 * 864e5).toISOString()), r.semana ? 'atencao' : ''),
    c('feitas', 'Concluídas no mês', r.feitasMes, 'clique para ver as concluídas', '')
  ].join('')}</div>`;
}
function vAcoes() {
  const u = U(); const { b, acoesL, planos } = tudo(); const ed = editaTratativas();
  const lista = ordenar(filtrar(acoesL, u, TODAY, { uid: ME.uid, nome: ME.nome }), TODAY);
  const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const pls = Object.values(planos).sort((a, b2) => String(a.nome).localeCompare(String(b2.nome), 'pt-BR'));
  let h = cartoes(resumo(acoesL.filter(t => t.status !== 'cancelada'), TODAY));
  h += `<div class="md-barra tr-barra">${sel('trFSit', 'Situação', u.sit, [['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['semana', 'Vencem em 7 dias'], ['feitas', 'Concluídas'], ['canceladas', 'Canceladas'], ['todas', 'Todas']])}
    ${sel('trFOrig', 'Origem', u.origem, [['todas', 'Todas'], ...Object.entries(ORIGENS)])}
    ${sel('trFConj', 'Onde', u.conj, [['todos', 'Todos'], ...Object.entries(CONJ)])}
    ${pls.length ? sel('trFPlano', 'Plano', u.plano, [['todos', 'Todos'], ['sem', 'Sem plano'], ...pls.map(p => [p.id, p.nome])]) : ''}
    <label class="sel md-busca"><span>Buscar</span><input class="in" id="trQ" type="search" value="${esc(u.q || '')}" placeholder="O quê, responsável, local…" autocomplete="off"></label>
    <button type="button" class="btn sm${u.minhas ? ' pri' : ''}" data-act="trMinhas" aria-pressed="${u.minhas}">Só as minhas</button></div>`;
  if (b.erro) h += `<p class="err">Não foi possível ler as tratativas (${esc(b.erro)}).</p>`;
  h += lista.length ? `<div class="tr-lista">${lista.map(t => itemAcao(t, planos)).join('')}</div>`
    : vazio(acoesL.length ? 'Nenhuma ação com esses filtros' : 'Nenhuma ação ainda', acoesL.length ? 'Mude a situação ou a origem lá em cima.' : 'Registre o que será feito, com responsável e prazo. As ações de Causas e ações também aparecem aqui.', ed ? `<button type="button" class="btn pri" data-act="trNova">${I.plus} Nova ação</button>` : '');
  return h;
}
function vPlanos() {
  const { acoesL, planos } = tudo(); const ed = editaTratativas();
  const pls = Object.values(planos).sort((a, b) => (a.status === 'concluido') - (b.status === 'concluido') || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  let h = '<p class="ic-placar">Um plano junta as ações de um mesmo objetivo (ex.: reduzir as paradas de um equipamento). Cada ação tem o seu 5W2H; o plano mostra o andamento de todas.</p>';
  if (!pls.length) return h + vazio('Nenhum plano ainda', 'Crie um plano e escolha-o nas ações que fazem parte dele.', ed ? `<button type="button" class="btn pri" data-act="trPlano">${I.plus} Novo plano</button>` : '');
  h += `<div class="tr-planos">${pls.map(p => { const a = andamentoPlano(acoesL, p.id, TODAY);
    return `<div class="card tr-pl"><header><h2>${esc(p.nome)}</h2><p>${esc(CONJ[p.conj] || '')}${p.status === 'concluido' ? ' · concluído' : ''}${a.fim ? ' · última entrega ' + dm(a.fim) : ''}</p></header><div class="body">
      ${p.objetivo ? `<p class="m0">${esc(p.objetivo)}</p>` : ''}
      <div class="tr-meter" role="img" aria-label="${a.pct}% concluído"><i style="width:${a.pct}%"></i></div>
      <p class="muted small m0">${a.feitas} de ${a.n} ação${a.n === 1 ? '' : 'ões'} concluída${a.n === 1 ? '' : 's'} (${a.pct}%)${a.atrasadas ? ` · <b class="tr-atr">${a.atrasadas} atrasada${a.atrasadas > 1 ? 's' : ''}</b>` : ''} · 5W2H ${a.w5}% respondido${a.previsto || a.realizado ? ` · custo ${brl(a.previsto)} previsto, ${brl(a.realizado)} realizado` : ''}</p>
      <div class="row-gap"><button type="button" class="btn sm" data-act="trVerPlano" data-id="${esc(p.id)}">Ver as ações</button>${ed ? `<button type="button" class="btn sm ghost" data-act="trPlano" data-id="${esc(p.id)}">Editar</button>` : ''}</div></div></div>`; }).join('')}</div>`;
  return h;
}
function vAtas() {
  const { atas } = tudo(); const ed = editaTratativas();
  const l = atas.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  let h = '<p class="ic-placar">Registre a reunião e transforme cada encaminhamento numa ação com responsável e prazo (origem Reunião).</p>';
  if (!l.length) return h + vazio('Nenhuma ata ainda', 'As atas ficam aqui, com os encaminhamentos e as ações que eles geraram.', ed ? `<button type="button" class="btn pri" data-act="trAta">${I.plus} Nova ata</button>` : '');
  h += `<div class="tr-lista">${l.map(a => { const enc = a.enc || []; const fe = enc.filter(e => e.trat).length;
    return `<div class="tr-it tr-ata"><span class="tr-it-s mono">${dm(a.data)}</span><span class="tr-it-t"><b>${esc(a.titulo)}</b><small>${esc([a.local, a.participantes].filter(Boolean).join(' · '))}</small></span>
      <span class="tr-ata-bts">${etiqueta(`${fe}/${enc.length} viraram ação`, enc.length && fe === enc.length ? 'ok' : 'neutro')}<button type="button" class="btn sm ghost" data-act="trCopiar" data-id="${esc(a.id)}" title="Copiar o texto para o WhatsApp ou e-mail">Copiar texto</button><button type="button" class="btn sm" data-act="trAta" data-id="${esc(a.id)}">${ed ? 'Abrir' : 'Ver'}</button></span></div>`; }).join('')}</div>`;
  return h;
}
function vTratativas() {
  const u = U(); const { b, acoesL, atas, planos } = tudo();
  if (!b.loaded) return carregando();
  const nAb = acoesL.filter(aberta).length;
  let h = abas([['acoes', `Ações (${nAb})`], ['planos', `Planos 5W2H (${Object.keys(planos).length})`], ['atas', `Atas de reunião (${atas.length})`]], u.aba, 'tr-aba', 'Partes das Tratativas');
  h += u.aba === 'planos' ? vPlanos() : u.aba === 'atas' ? vAtas() : vAcoes();
  if (!editaTratativas()) h += '<p class="muted small">Somente leitura: criar e editar tratativas é do Gestor, Coordenador e Supervisor da Gestão.</p>';
  return h;
}

/* ---------- formulários ---------- */
const opcoes = (obj, val) => Object.entries(obj).map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('');
const nomesUsados = () => { const s = new Set([ME.nome].filter(Boolean)); const { acoesL, atas } = tudo(); acoesL.forEach(t => t.resp && s.add(t.resp)); atas.forEach(a => (a.enc || []).forEach(e => e.quem && s.add(e.quem))); return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR')); };
const datalist = () => `<datalist id="trNomes">${nomesUsados().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
const quem = () => ({ em: new Date().toISOString(), nome: ME.nome || ME.login || '', uid: ME.uid });
function evolucao(t) {
  const ev = t.evol || [];
  return ev.length ? `<div class="tr-evol">${ev.slice().reverse().map(c => `<div><b>${esc(c.nome || '')}</b> <span class="muted small">${c.em ? dmy(c.em.slice(0, 10)) + ' ' + c.em.slice(11, 16) : ''}</span><p class="m0">${esc(c.t)}</p></div>`).join('')}</div>` : '<p class="muted small m0">Nenhum comentário ainda.</p>';
}
// Ação: nova (pre = campos já preenchidos, ex.: vinda de Causas e ações) ou existente (id).
export function abrirAcao(id, pre = {}) {
  const t = id ? achar(id) : null; if (id && !t) return;
  const ed = editaTratativas(); const { planos } = tudo();
  if (!ed) { // só leitura
    const x = t;
    return formSheet(x.titulo, `${esc(ORIGENS[x.origem] || '')}${x.ref ? ' · ' + esc(x.ref) : ''}`, `${dados([['Situação', sitEtq(x)], ['Por quê?', esc(x.por || '')], ['Onde?', esc([CONJ[x.conj], x.area ? AREA_S[x.area] : '', x.local].filter(Boolean).join(' · '))], ['Quando?', x.inicio || x.prazo ? `${x.inicio ? dm(x.inicio) : '?'} a ${x.prazo ? dmy(x.prazo) : '?'}` : ''], ['Quem?', esc(x.resp || '')], ['Como?', esc(x.como || '')], ['Quanto custa?', x.custo != null ? `${brl(x.custo)} previsto${x.custoReal != null ? ' · ' + brl(x.custoReal) + ' realizado' : ''}` : ''], ['Plano', esc((planos[x.plano] || {}).nome || '')]])}<h4>Evolução</h4>${evolucao(x)}`, 'Fechar', async () => {});
  }
  if (t && t.legado) return abrirAntiga(t);
  const x = t || { titulo: '', por: '', origem: 'outra', conj: 'coq', status: 'aberta', inicio: TODAY, prazo: '', plano: '', ...pre };
  const pls = Object.values(planos).filter(p => p.status !== 'concluido' || p.id === x.plano);
  const html = `<div class="p-form tr-form">
    <label class="sel"><span>O quê? · o que será feito</span><textarea class="in" id="trTit" rows="2" maxlength="300">${esc(x.titulo)}</textarea></label>
    <label class="sel"><span>Por quê? · motivo, problema ou meta</span><textarea class="in" id="trPor" rows="2" maxlength="2000">${esc(x.por || '')}</textarea></label>
    <div class="row2"><label class="sel"><span>Onde? · conjunto</span><select class="in" id="trConj">${opcoes(CONJ, x.conj)}</select></label><label class="sel"><span>Local (opcional)</span><input class="in" id="trLocal" maxlength="120" value="${esc(x.local || '')}" placeholder="Ex.: correia 3, oficina"></label></div>
    <div class="row2"><label class="sel"><span>Quando? · início</span><input class="in" type="date" id="trIni" value="${esc(x.inicio || '')}"></label><label class="sel"><span>Prazo</span><input class="in" type="date" id="trPrazo" value="${esc(x.prazo || '')}"></label></div>
    <label class="sel"><span>Quem? · responsável</span><input class="in" id="trResp" list="trNomes" maxlength="120" autocomplete="off" value="${esc(x.resp || '')}">${datalist()}</label>
    <label class="sel"><span>Como? · método e passos</span><textarea class="in" id="trComo" rows="2" maxlength="2000">${esc(x.como || '')}</textarea></label>
    <div class="row2"><label class="sel"><span>Quanto custa? · previsto (R$)</span><input class="in" id="trCusto" inputmode="decimal" autocomplete="off" value="${x.custo != null ? esc(String(x.custo).replace('.', ',')) : ''}"></label><label class="sel"><span>Realizado (R$)</span><input class="in" id="trReal" inputmode="decimal" autocomplete="off" value="${x.custoReal != null ? esc(String(x.custoReal).replace('.', ',')) : ''}"></label></div>
    <div class="row2"><label class="sel"><span>Origem</span><select class="in" id="trOrig">${opcoes(ORIGENS, x.origem)}</select></label><label class="sel"><span>Referência (opcional)</span><input class="in" id="trRef" maxlength="120" value="${esc(x.ref || '')}" placeholder="Ex.: causa, equipamento, registro"></label></div>
    <div class="row2"><label class="sel"><span>Plano 5W2H</span><select class="in" id="trPl"><option value="">Sem plano</option>${pls.map(p => `<option value="${esc(p.id)}" ${p.id === x.plano ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label><label class="sel"><span>Situação</span><select class="in" id="trSt">${opcoes(STATUS, x.status)}</select></label></div>
    ${t ? `<h4>Evolução</h4>${evolucao(t)}` : ''}
    <label class="sel"><span>${t ? 'Novo comentário (opcional)' : 'Primeiro comentário (opcional)'}</span><textarea class="in" id="trCom" rows="2" maxlength="600" placeholder="O que foi feito, o que falta, o que mudou"></textarea></label>
    ${t && podeApagar(t) ? '<label class="tr-del"><input type="checkbox" id="trDel"> Excluir esta ação de vez (para tirar da lista sem apagar, use a situação Cancelada)</label>' : ''}</div>`;
  formSheet(t ? 'Ação' : 'Nova ação', t ? `${esc(ORIGENS[t.origem] || '')} · criada por ${esc(t.criadoNome || '')}${t.criadoEm ? ' em ' + dm(t.criadoEm) : ''}` : 'Responda o 5W2H: quanto mais completo, mais fácil de acompanhar', html, t ? 'Salvar' : 'Criar ação', async () => {
    if (t && marcado('trDel')) { await DB.tratApagar(t.id); DB.log(`Tratativas: ação excluída (${t.titulo})`, 'gestao'); toast('Ação excluída'); return; }
    const y = conferirAcao({ titulo: v$('trTit'), por: v$('trPor'), conj: v$('trConj'), local: v$('trLocal'), inicio: v$('trIni'), prazo: v$('trPrazo'), resp: v$('trResp'), como: v$('trComo'), custo: v$('trCusto'), custoReal: v$('trReal'), origem: v$('trOrig'), ref: v$('trRef'), plano: v$('trPl'), status: v$('trSt'), causa: x.causa, area: x.area, ata: x.ata });
    let ev = (t && t.evol) || [];
    if (t && t.status !== y.status) ev = novoComentario(ev, `Situação: ${STATUS[t.status] || t.status} → ${STATUS[y.status]}`, quem());
    ev = novoComentario(ev, v$('trCom'), quem());
    if (ev.length) y.evol = ev;
    if (y.status === 'feita' && (!t || t.status !== 'feita')) y.feitaEm = new Date().toISOString();
    else if (y.status !== 'feita' && t && t.feitaEm) y.feitaEm = '';
    const nid = t ? t.id : DB.tratNovoId();
    await DB.tratSalvar(nid, y, !t);
    DB.log(`Tratativas: ação ${t ? 'alterada' : 'criada'} (${y.titulo}${t && t.status !== y.status ? ' · ' + STATUS[y.status] : ''})`, 'gestao');
    toast(t ? 'Ação salva' : 'Ação criada'); render();
  });
  const ti = document.getElementById('trTit'); if (ti && !t) ti.focus();
}
// Ação antiga de Causas e ações: muda só o que ela tem (texto, responsável, prazo e situação), no conjunto dela.
function abrirAntiga(t) {
  const st = { aberta: 'A fazer', feita: 'Concluída', cancelada: 'Cancelada' };
  formSheet('Ação de Causas e ações', `${esc(t.causa)} · ${esc(CONJ[t.conj] || '')}${t.area ? ' · ' + esc(AREA_S[t.area] || t.area) : ''}`, `<div class="p-form">
    <p class="muted small m0">Criada em Causas e ações antes das Tratativas: aqui dá para mudar o texto, o responsável, o prazo e a situação.</p>
    <label class="sel"><span>O que vai ser feito</span><textarea class="in" id="trTit" rows="3" maxlength="400">${esc(t.titulo)}</textarea></label>
    <div class="row2"><label class="sel"><span>Responsável</span><input class="in" id="trResp" maxlength="60" value="${esc(t.resp || '')}"></label><label class="sel"><span>Prazo</span><input class="in" type="date" id="trPrazo" value="${esc(t.prazo || '')}"></label></div>
    <label class="sel"><span>Situação</span><select class="in" id="trSt">${opcoes(st, t.status === 'andamento' ? 'aberta' : t.status)}</select></label></div>`, 'Salvar', async () => {
    const acao = v$('trTit').replace(/\s+/g, ' ').trim(); if (acao.length < 5) throw new Error('Descreva a ação.');
    await DB.salvarAcao(t.legado.id, { acao, resp: v$('trResp').trim(), prazo: v$('trPrazo'), status: v$('trSt') }, t.legado.k);
    DB.log(`Plano de ação: "${acao}" alterada nas Tratativas`, 'gestao'); toast('Ação salva'); render();
  });
}
function abrirPlano(id) {
  if (!editaTratativas()) return;
  const { planos } = tudo(); const p = id ? planos[id] : null; if (id && !p) return;
  const x = p || { nome: '', objetivo: '', conj: 'coq', status: 'ativo' };
  formSheet(p ? 'Plano 5W2H' : 'Novo plano 5W2H', 'Junta as ações de um mesmo objetivo; escolha o plano dentro de cada ação', `<div class="p-form">
    <label class="sel"><span>Nome</span><input class="in" id="plNome" maxlength="120" value="${esc(x.nome)}" placeholder="Ex.: Reduzir paradas das pás carregadeiras"></label>
    <label class="sel"><span>Objetivo</span><textarea class="in" id="plObj" rows="3" maxlength="2000">${esc(x.objetivo || '')}</textarea></label>
    <div class="row2"><label class="sel"><span>Onde</span><select class="in" id="plConj">${opcoes(CONJ, x.conj)}</select></label><label class="sel"><span>Situação</span><select class="in" id="plSt">${opcoes({ ativo: 'Em andamento', concluido: 'Concluído' }, x.status)}</select></label></div>
    ${p && podeApagar(p) ? '<label class="tr-del"><input type="checkbox" id="plDel"> Excluir este plano (as ações continuam, sem plano)</label>' : ''}</div>`, p ? 'Salvar' : 'Criar plano', async () => {
    if (p && marcado('plDel')) {
      const { acoesL } = tudo(); acoesL.filter(t => t.plano === p.id && !t.legado).forEach(t => DB.tratSalvar(t.id, { plano: '' }));
      await DB.tratApagar(p.id); DB.log(`Tratativas: plano excluído (${p.nome})`, 'gestao'); toast('Plano excluído'); render(); return;
    }
    const y = conferirPlano({ nome: v$('plNome'), objetivo: v$('plObj'), conj: v$('plConj'), status: v$('plSt') });
    await DB.tratSalvar(p ? p.id : DB.tratNovoId(), y, !p);
    DB.log(`Tratativas: plano ${p ? 'alterado' : 'criado'} (${y.nome})`, 'gestao'); toast(p ? 'Plano salvo' : 'Plano criado'); render();
  });
}
const linhaEnc = (e, i) => (e.trat
  ? `<div class="tr-enc feita"><span>${esc(e.oque)}${e.quem ? ' · ' + esc(e.quem) : ''}${e.prazo ? ' · até ' + dm(e.prazo) : ''}</span>${etiqueta('virou ação', 'ok')}<input type="hidden" data-enc="${i}" data-trat="${esc(e.trat)}"></div>`
  : `<div class="tr-enc" data-enc-l="${i}"><input class="in" data-enc-o="${i}" maxlength="300" placeholder="O que será feito" value="${esc(e.oque || '')}" aria-label="O que será feito"><input class="in" data-enc-q="${i}" list="trNomes" maxlength="120" placeholder="Quem" value="${esc(e.quem || '')}" aria-label="Quem"><input class="in" type="date" data-enc-p="${i}" value="${esc(e.prazo || '')}" aria-label="Prazo"></div>`);
function abrirAta(id) {
  const { atas, planos } = tudo(); const a = id ? atas.find(x => x.id === id) : null; if (id && !a) return;
  const ed = editaTratativas();
  if (!ed) return formSheet(a.titulo, dmy(a.data), `<pre class="tr-txt">${esc(textoAta(a))}</pre>`, 'Fechar', async () => {});
  const x = a || { titulo: '', data: TODAY, local: '', participantes: '', pauta: '', decisoes: '', enc: [], plano: '' };
  const enc = [...(x.enc || []), ...Array.from({ length: Math.max(2, 3 - (x.enc || []).filter(e => !e.trat).length) }, () => ({ oque: '', quem: '', prazo: '' }))];
  const pls = Object.values(planos).filter(p => p.status !== 'concluido' || p.id === x.plano);
  formSheet(a ? 'Ata de reunião' : 'Nova ata de reunião', 'Os encaminhamentos viram ações com responsável e prazo', `<div class="p-form tr-form">
    <div class="row2"><label class="sel"><span>Assunto</span><input class="in" id="atT" maxlength="300" value="${esc(x.titulo)}" placeholder="Ex.: Alinhamento semanal com a liderança"></label><label class="sel"><span>Data</span><input class="in" type="date" id="atD" value="${esc(x.data || '')}"></label></div>
    <div class="row2"><label class="sel"><span>Local</span><input class="in" id="atL" maxlength="120" value="${esc(x.local || '')}" placeholder="Sala, área, on-line"></label><label class="sel"><span>Participantes</span><input class="in" id="atP" maxlength="600" value="${esc(x.participantes || '')}" placeholder="Nomes ou funções"></label></div>
    <label class="sel"><span>Pauta e discussão</span><textarea class="in" id="atPa" rows="3" maxlength="5000">${esc(x.pauta || '')}</textarea></label>
    <label class="sel"><span>Decisões</span><textarea class="in" id="atDe" rows="2" maxlength="5000">${esc(x.decisoes || '')}</textarea></label>
    <div class="sel"><span>Encaminhamentos (o que · quem · prazo)</span><div id="atEnc" class="tr-encs">${enc.map(linhaEnc).join('')}</div><button type="button" class="btn sm" id="atMais">${I.plus} Mais uma linha</button></div>
    <label class="sel"><span>Plano das novas ações</span><select class="in" id="atPl"><option value="">Sem plano</option>${pls.map(p => `<option value="${esc(p.id)}" ${p.id === x.plano ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label class="tr-del tr-ok"><input type="checkbox" id="atCria" checked> Criar as ações dos encaminhamentos novos (origem Reunião)</label>
    ${a && podeApagar(a) ? '<label class="tr-del"><input type="checkbox" id="atDel"> Excluir esta ata (as ações criadas continuam)</label>' : ''}${datalist()}</div>`, a ? 'Salvar' : 'Salvar ata', async () => {
    if (a && marcado('atDel')) { await DB.tratApagar(a.id); DB.log(`Tratativas: ata excluída (${a.titulo})`, 'gestao'); toast('Ata excluída'); render(); return; }
    const box = document.getElementById('atEnc'); const linhas = [];
    box.querySelectorAll('[data-trat], [data-enc-l]').forEach(el => {
      if (el.dataset.trat) { const e = (x.enc || [])[+el.dataset.enc]; if (e) linhas.push({ ...e }); return; }
      const i = el.dataset.encL; const g = s => (el.querySelector(`[data-enc-${s}="${i}"]`) || {}).value || ''; linhas.push({ oque: g('o'), quem: g('q'), prazo: g('p'), trat: '' });
    });
    const y = conferirAta({ titulo: v$('atT'), data: v$('atD'), local: v$('atL'), participantes: v$('atP'), pauta: v$('atPa'), decisoes: v$('atDe'), enc: linhas, plano: v$('atPl') });
    const aid = a ? a.id : DB.tratNovoId(); let n = 0;
    if (marcado('atCria')) for (const { i, acao } of acoesDaAta({ ...y, id: aid }, TODAY)) { const tid = DB.tratNovoId(); DB.tratSalvar(tid, acao, true); y.enc[i].trat = tid; n++; }
    await DB.tratSalvar(aid, y, !a);
    DB.log(`Tratativas: ata ${a ? 'alterada' : 'registrada'} (${y.titulo})${n ? ` · ${n} ação${n > 1 ? 'ões' : ''} criada${n > 1 ? 's' : ''}` : ''}`, 'gestao');
    toast(n ? `Ata salva · ${n} ação${n > 1 ? 'ões' : ''} criada${n > 1 ? 's' : ''}` : 'Ata salva'); render();
  });
  const mais = document.getElementById('atMais');
  if (mais) mais.addEventListener('click', () => { const box = document.getElementById('atEnc'); const i = 1000 + box.children.length; box.insertAdjacentHTML('beforeend', linhaEnc({ oque: '', quem: '', prazo: '' }, i)); const o = box.querySelector(`[data-enc-o="${i}"]`); if (o) o.focus(); });
}

/* ---------- ações dos botões ---------- */
acoes.trAbrir = (t, d) => abrirAcao(d.id);
acoes.trNova = () => { if (editaTratativas()) abrirAcao(''); };
acoes.trPlano = (t, d) => abrirPlano(d.id || '');
acoes.trAta = (t, d) => abrirAta(d.id || '');
acoes.trSit = (t, d) => { const u = U(); u.sit = u.sit === d.v && d.v !== 'abertas' ? 'abertas' : d.v; render(); };
acoes.trMinhas = () => { U().minhas = !U().minhas; render(); };
acoes.trVerPlano = (t, d) => { const u = U(); Object.assign(u, { aba: 'acoes', plano: d.id, sit: 'todas', origem: 'todas', conj: 'todos' }); render(); };
acoes.trCopiar = async (t, d) => {
  const a = tudo().atas.find(x => x.id === d.id); if (!a) return;
  try { await navigator.clipboard.writeText(textoAta(a)); toast('Texto da ata copiado: cole no WhatsApp ou no e-mail'); } catch (e) { toast('Não foi possível copiar neste aparelho'); }
};
acoes.trExcel = async () => {
  const u = U(); const { acoesL, planos } = tudo();
  const lista = ordenar(filtrar(acoesL, u, TODAY, { uid: ME.uid, nome: ME.nome }), TODAY);
  if (!lista.length) { toast('Nenhuma ação com esses filtros para exportar'); return; }
  await baixarExcel(`Tratativas - ${TODAY}`, linhasExcel(lista, planos, TODAY)).catch(e => toast(e.message || 'Não foi possível exportar'));
};
acoes.trTopo = () => { const a = U().aba; if (a === 'planos') abrirPlano(''); else if (a === 'atas') abrirAta(''); else abrirAcao(''); };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-tr-aba]'); if (b) { U().aba = b.dataset.trAba; salvarUI(); render(); } });
const FILTROS = { trFSit: 'sit', trFOrig: 'origem', trFConj: 'conj', trFPlano: 'plano' };
document.addEventListener('change', e => { const k = e.target && FILTROS[e.target.id]; if (k) { U()[k] = e.target.value; render(); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'trQ') { U().q = e.target.value; clearTimeout(window._trq); window._trq = setTimeout(() => { render(); const i = document.getElementById('trQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

/* ---------- topo ---------- */
export function topo() {
  const a = U().aba; const ed = editaTratativas();
  const novo = ed ? `<button type="button" class="btn pri" data-act="trTopo">${I.plus} ${a === 'planos' ? 'Novo plano' : a === 'atas' ? 'Nova ata' : 'Nova ação'}</button>` : '';
  return novo + (a === 'acoes' ? `<button type="button" class="btn" data-act="trExcel">${I.dl} Exportar</button>` : '');
}
export const renderView = () => vTratativas();
