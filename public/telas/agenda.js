// Gestão › Minha agenda: compromissos, tarefas e anotações de cada pessoa (só ela vê; firestore.rules › agenda).
// As contas ficam em contas/agenda.js; o banco, em agenda/{id} (nucleo/data.js › agendaWatch). A aba começa
// desligada para todos os perfis (desligada: true em navegacao.js) e é ligada em Perfis ou na exceção da pessoa.
import { today } from '../contas/cal.js';
import { TIPOS, LIMITES, conferir, agrupar, GRUPOS, notas, concluidos, resumo, buscar, grupo } from '../contas/agenda.js';
import { vazio, carregando, abas } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { UI, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const U = () => (UI.ag ||= { aba: 'agenda', q: '' });
const hoje = () => today();
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dia = s => (s ? `${SEM[new Date(s + 'T12:00:00Z').getUTCDay()]} ${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const v$ = id => (document.getElementById(id) || {}).value || '';
const marcado = id => !!(document.getElementById(id) || {}).checked;

function base() { if (DB.agendaWatch) DB.agendaWatch(); return DB.cache.agenda || { d: {}, loaded: false }; }
const itens = () => Object.values(base().d || {});
const achar = id => itens().find(x => x.id === id);

/* ---------- desenho ---------- */
function cartoes(r) {
  const c = (rot, v, sub, cls) => `<div class="p-ind md-card ${cls}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></div>`;
  return `<div class="md-cards">${[
    c('Hoje', r.hoje, 'compromissos e tarefas', ''),
    c('Atrasadas', r.atrasadas, 'tarefas com o dia vencido', r.atrasadas ? 'critico' : ''),
    c('Próximos 7 dias', r.semana, 'incluindo hoje', ''),
    c('Anotações', r.notas, 'guardadas', '')
  ].join('')}</div>`;
}
function linha(it, h) {
  const g = grupo(it, h);
  const meta = [TIPOS[it.tipo], it.data ? dia(it.data) : '', it.hora || ''].filter(Boolean).join(' · ');
  const marca = it.tipo === 'tarefa'
    ? `<button type="button" class="ag-ck${it.feito ? ' on' : ''}" data-act="agFeito" data-id="${esc(it.id)}" aria-pressed="${!!it.feito}" aria-label="${it.feito ? 'Desmarcar' : 'Marcar como feita'}: ${esc(it.titulo)}">${it.feito ? I.ok : ''}</button>`
    : `<span class="ag-ic" aria-hidden="true">${it.tipo === 'compromisso' ? I.relogio : I.nota}</span>`;
  return `<div class="ag-it${it.feito || g === 'passou' ? ' fechada' : ''}${g === 'atrasada' ? ' atr' : ''}">${marca}<button type="button" class="ag-it-t" data-act="agAbrir" data-id="${esc(it.id)}"><b>${esc(it.titulo)}</b><small>${esc(meta)}${it.texto ? ' · ' + esc(it.texto.slice(0, 90)) + (it.texto.length > 90 ? '…' : '') : ''}</small></button></div>`;
}
function vAgenda(l, h) {
  const gs = agrupar(l, h);
  const tem = GRUPOS.some(([k]) => gs[k].length);
  if (!tem) return vazio('Nada marcado', 'Anote seus compromissos e tarefas: aparecem aqui por dia, com as atrasadas no alto.', `<button type="button" class="btn pri" data-act="agNovo" data-tipo="tarefa">${I.plus} Novo</button>`);
  return GRUPOS.filter(([k]) => gs[k].length).map(([k, t]) => `<section class="ag-grp"><h3 class="ag-gt${k === 'atrasada' ? ' atr' : ''}">${esc(t)} <span class="muted">${gs[k].length}</span></h3><div class="ag-lista">${gs[k].map(it => linha(it, h)).join('')}</div></section>`).join('');
}
function vNotas(l) {
  const ns = notas(l);
  if (!ns.length) return vazio('Nenhuma anotação', 'Guarde ideias, contatos e lembretes sem data.', `<button type="button" class="btn pri" data-act="agNovo" data-tipo="nota">${I.plus} Nova anotação</button>`);
  return `<div class="ag-notas">${ns.map(n => `<button type="button" class="card ag-nota${n.fixa ? ' fixa' : ''}" data-act="agAbrir" data-id="${esc(n.id)}"><b>${n.fixa ? '<span class="ag-pin">Fixada</span> ' : ''}${esc(n.titulo)}</b>${n.texto ? `<span class="ag-txt">${esc(n.texto.slice(0, 400))}${n.texto.length > 400 ? '…' : ''}</span>` : ''}</button>`).join('')}</div>`;
}
function vFeitos(l, h) {
  const fs = concluidos(l, h).slice(0, 200);
  if (!fs.length) return vazio('Nada concluído ainda', 'As tarefas feitas e os compromissos que já passaram ficam aqui.');
  return `<div class="ag-lista">${fs.map(it => linha(it, h)).join('')}</div>`;
}
function vMinhaAgenda() {
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const h = hoje(); const todos = itens(); const l = buscar(todos, u.q);
  const r = resumo(todos, h);
  let h2 = cartoes(r);
  h2 += abas([['agenda', 'Agenda'], ['notas', `Anotações (${r.notas})`], ['feitos', 'Concluídos']], u.aba, 'ag-aba', 'Partes da agenda');
  h2 += `<div class="md-barra"><label class="sel md-busca"><span>Buscar</span><input class="in" id="agQ" type="search" value="${esc(u.q || '')}" placeholder="Título ou texto" autocomplete="off"></label></div>`;
  if (b.erro) h2 += `<p class="err">Não foi possível ler a sua agenda (${esc(b.erro)}).</p>`;
  h2 += u.aba === 'notas' ? vNotas(l) : u.aba === 'feitos' ? vFeitos(l, h) : vAgenda(l, h);
  h2 += '<p class="muted small">Só você vê o que está aqui. Nem o administrador tem acesso à sua agenda.</p>';
  return h2;
}

/* ---------- formulário ---------- */
function abrir(id, tipo0) {
  const t = id ? achar(id) : null; if (id && !t) return;
  const x = t || { tipo: TIPOS[tipo0] ? tipo0 : 'tarefa', titulo: '', texto: '', data: tipo0 === 'compromisso' ? hoje() : '', hora: '', feito: false, fixa: false };
  const html = `<div class="p-form ag-form">
    <label class="sel"><span>Tipo</span><select class="in" id="agTipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}" ${k === x.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="sel"><span>Título</span><input class="in" id="agTit" maxlength="${LIMITES.titulo}" autocomplete="off" value="${esc(x.titulo)}" placeholder="Ex.: reunião com o cliente, ligar para a manutenção"></label>
    <div class="row2 ag-quando"><label class="sel"><span>Dia</span><input class="in" type="date" id="agData" value="${esc(x.data || '')}"></label><label class="sel"><span>Hora (opcional)</span><input class="in" type="time" id="agHora" value="${esc(x.hora || '')}"></label></div>
    <label class="sel"><span>Detalhes (opcional)</span><textarea class="in" id="agTxt" rows="4" maxlength="${LIMITES.texto}">${esc(x.texto || '')}</textarea></label>
    <label class="ag-op ag-so-tarefa"><input type="checkbox" id="agFeito" ${x.feito ? 'checked' : ''}> Feita</label>
    <label class="ag-op ag-so-nota"><input type="checkbox" id="agFixa" ${x.fixa ? 'checked' : ''}> Fixar no alto das anotações</label>
    ${t ? '<label class="tr-del"><input type="checkbox" id="agDel"> Apagar este item de vez</label>' : ''}</div>`;
  formSheet(t ? TIPOS[t.tipo] : 'Novo item', 'Só você vê', html, t ? 'Salvar' : 'Criar', async () => {
    if (t && marcado('agDel')) { await DB.agendaApagar(t.id); toast('Item apagado'); return; }
    const c = conferir({ tipo: v$('agTipo'), titulo: v$('agTit'), texto: v$('agTxt'), data: v$('agData'), hora: v$('agHora'), feito: marcado('agFeito'), fixa: marcado('agFixa') });
    if (!c.ok) throw new Error(c.erro);
    await DB.agendaSalvar(t ? t.id : DB.agendaNovoId(), c.item, !t);
    toast(t ? 'Salvo' : 'Criado'); render();
  });
  ajustarForm();
  const ti = document.getElementById('agTit'); if (ti && !t) ti.focus();
}
// Mostra só os campos do tipo escolhido (anotação não tem dia; "Feita" só na tarefa; "Fixar" só na anotação).
function ajustarForm() {
  const tp = v$('agTipo'); const f = document.querySelector('.ag-form'); if (!f) return;
  f.querySelector('.ag-quando').hidden = tp === 'nota';
  f.querySelector('.ag-so-tarefa').hidden = tp !== 'tarefa';
  f.querySelector('.ag-so-nota').hidden = tp !== 'nota';
}

acoes.agAbrir = (t, d) => abrir(d.id);
acoes.agNovo = (t, d) => abrir('', d.tipo || (U().aba === 'notas' ? 'nota' : 'tarefa'));
acoes.agFeito = async (t, d) => {
  const it = achar(d.id); if (!it || it.tipo !== 'tarefa') return;
  const c = conferir({ ...it, feito: !it.feito }); if (!c.ok) return;
  await DB.agendaSalvar(it.id, c.item, false).catch(e => toast(e.message || 'Não foi possível salvar'));
  toast(c.item.feito ? 'Tarefa feita' : 'Tarefa reaberta'); render();
};
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ag-aba]'); if (b) { U().aba = b.dataset.agAba; salvarUI(); render(); } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'agTipo') ajustarForm(); });
document.addEventListener('input', e => { if (e.target && e.target.id === 'agQ') { U().q = e.target.value; clearTimeout(window._agq); window._agq = setTimeout(() => { render(); const i = document.getElementById('agQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

/* ---------- topo ---------- */
export const topo = () => `<button type="button" class="btn pri" data-act="agNovo">${I.plus} Novo</button>`;
export const renderView = () => vMinhaAgenda();
