// Gestão › Minha agenda: compromissos, tarefas e anotações de cada pessoa (só ela vê; firestore.rules › agenda).
// As contas ficam em contas/agenda.js; o banco, em agenda/{id} (nucleo/data.js › agendaWatch). A aba começa
// desligada para todos os perfis (desligada: true em navegacao.js) e é ligada em Perfis ou na exceção da pessoa.
// Partes: Agenda (por dia), Calendário (mês), Anotações (as minhas e as compartilhadas comigo), Concluídos e Lixeira.
// O botão "Lembrar disto" das outras telas (ui/lembrar.js) abre o formulário daqui já ligado ao registro (novoComLink).
import { today } from '../contas/cal.js';
import { TIPOS, REPETE, PRIO, LIMITES, LIXEIRA_DIAS, conferir, agrupar, GRUPOS, notas, concluidos, lixeira, vencidosLixeira, resumo, buscar, grupo, quando, marcarFeita, adiar, andamento, etiquetas, corEtq, calendario, mesMais, semanaPdf, normLogin } from '../contas/agenda.js';
import { vazio, carregando, abas, etiqueta } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, salvarUI, aplicarSet } from '../nucleo/estado.js';
import { irParaModuloDa } from '../nucleo/navegacao.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, trocarTela } from '../ui/shell.js';

const hoje = () => today();
const U = () => (UI.ag ||= { aba: 'agenda', q: '', etq: '', mes: hoje().slice(0, 7) });
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dia = s => (s ? `${SEM[new Date(s + 'T12:00:00Z').getUTCDay()]} ${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const v$ = id => (document.getElementById(id) || {}).value || '';
const marcado = id => !!(document.getElementById(id) || {}).checked;

function base() { if (DB.agendaWatch) DB.agendaWatch(); return DB.cache.agenda || { d: {}, loaded: false }; }
const meus = () => Object.values(base().d || {});
const deOutros = () => Object.values((DB.cache.agendaComp || { d: {} }).d || {}).filter(x => x.uid !== ME.uid && !x.apagadoEm);
const achar = id => meus().find(x => x.id === id) || deOutros().find(x => x.id === id);
// O que passou de LIXEIRA_DIAS na lixeira some de vez (uma vez por abertura do sistema).
let limpou = false;
function limparLixeira() {
  if (limpou || !base().loaded) return; limpou = true;
  for (const it of vencidosLixeira(meus(), hoje())) DB.agendaApagar(it.id).catch(() => {});
}

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
const etq = s => (s ? `<span class="ag-etq c${corEtq(s)}">${esc(s)}</span>` : '');
function selos(it) {
  const a = andamento(it);
  return [it.prio === 'alta' ? etiqueta('Alta', 'critico') : it.prio === 'baixa' ? etiqueta('Baixa', 'neutro') : '', etq(it.etq),
    it.rep ? `<span class="ag-selo" title="${esc(REPETE[it.rep])}">↻ ${esc(REPETE[it.rep].split(' (')[0].toLowerCase())}</span>` : '',
    a ? `<span class="ag-selo">${a.feitos} de ${a.total} passos</span>` : '',
    it.link ? `<span class="ag-selo">${esc(it.link.r || 'ligado a outra tela')}</span>` : '',
    (it.compL || []).length ? `<span class="ag-selo">compartilhada com ${(it.compL || []).length}</span>` : ''].filter(Boolean).join('');
}
function linha(it, h, lix = false) {
  const g = grupo(it, h); const d = quando(it, h);
  const meta = [TIPOS[it.tipo], d ? dia(d) : '', it.hora || ''].filter(Boolean).join(' · ');
  const marca = it.tipo === 'tarefa' && !lix
    ? `<button type="button" class="ag-ck${it.feito ? ' on' : ''}" data-act="agFeito" data-id="${esc(it.id)}" aria-pressed="${!!it.feito}" aria-label="${it.feito ? 'Desmarcar' : 'Marcar como feita'}: ${esc(it.titulo)}">${it.feito ? I.ok : ''}</button>`
    : `<span class="ag-ic" aria-hidden="true">${it.tipo === 'compromisso' ? I.relogio : it.tipo === 'nota' ? I.nota : I.ok}</span>`;
  const adia = !lix && it.tipo === 'tarefa' && ['atrasada', 'hoje'].includes(g)
    ? `<span class="ag-adia"><button type="button" class="btn sm ghost" data-act="agAdiar" data-id="${esc(it.id)}" data-n="1">Amanhã</button><button type="button" class="btn sm ghost" data-act="agAdiar" data-id="${esc(it.id)}" data-n="7">+7 dias</button></span>` : '';
  const lx = lix ? `<span class="ag-adia"><button type="button" class="btn sm" data-act="agRestaurar" data-id="${esc(it.id)}">Restaurar</button><button type="button" class="btn sm ghost danger" data-act="agApagarJa" data-id="${esc(it.id)}">Apagar de vez</button></span>` : '';
  const sl = selos(it);
  return `<div class="ag-it${it.feito || g === 'passou' ? ' fechada' : ''}${g === 'atrasada' && !lix ? ' atr' : ''}">${marca}<button type="button" class="ag-it-t" data-act="${lix ? 'agNada' : 'agAbrir'}" data-id="${esc(it.id)}"${lix ? ' disabled' : ''}><b>${esc(it.titulo)}</b><small>${esc(meta)}${it.texto ? ' · ' + esc(it.texto.slice(0, 90)) + (it.texto.length > 90 ? '…' : '') : ''}</small>${sl ? `<span class="ag-selos">${sl}</span>` : ''}</button>${adia}${lx}</div>`;
}
function vAgenda(l, h) {
  const gs = agrupar(l, h);
  if (!GRUPOS.some(([k]) => gs[k].length)) return vazio('Nada marcado', 'Anote seus compromissos e tarefas: aparecem aqui por dia, com as atrasadas no alto.', `<button type="button" class="btn pri" data-act="agNovo" data-tipo="tarefa">${I.plus} Novo</button>`);
  return GRUPOS.filter(([k]) => gs[k].length).map(([k, t]) => `<section class="ag-grp"><h3 class="ag-gt${k === 'atrasada' ? ' atr' : ''}">${esc(t)} <span class="muted">${gs[k].length}</span></h3><div class="ag-lista">${gs[k].map(it => linha(it, h)).join('')}</div></section>`).join('');
}
function vCalendario(l, h) {
  const u = U(); const ym = u.mes || h.slice(0, 7);
  const sem = calendario(l, ym);
  const nome = `${MESES[+ym.slice(5, 7) - 1]} de ${ym.slice(0, 4)}`;
  let x = `<div class="ag-calnav"><button type="button" class="btn sm ghost" data-act="agMes" data-n="-1" aria-label="Mês anterior">‹</button><b>${esc(nome.replace(/^./, c => c.toUpperCase()))}</b><button type="button" class="btn sm ghost" data-act="agMes" data-n="1" aria-label="Próximo mês">›</button>${ym !== h.slice(0, 7) ? '<button type="button" class="btn sm" data-act="agMes" data-n="0">Hoje</button>' : ''}</div>`;
  x += `<div class="ag-cal" role="grid" aria-label="Calendário de ${esc(nome)}"><div class="ag-cal-h" role="row">${SEM.map(s => `<span role="columnheader">${s}</span>`).join('')}</div>${sem.map(s => `<div class="ag-cal-s" role="row">${s.map(c => `<div role="gridcell" class="ag-cal-d${c.fora ? ' fora' : ''}${c.d === h ? ' hoje' : ''}"><button type="button" class="ag-cal-n" data-act="agNovoDia" data-d="${c.d}" aria-label="Novo item em ${esc(dia(c.d))}">${+c.d.slice(8)}</button>${c.itens.slice(0, 3).map(it => `<button type="button" class="ag-cal-i${it.tipo === 'compromisso' ? ' comp' : ''}${it.feito ? ' feito' : ''}" data-act="agAbrir" data-id="${esc(it.id)}" title="${esc(it.titulo)}">${it.hora ? `<i>${esc(it.hora)}</i> ` : ''}${esc(it.titulo)}</button>`).join('')}${c.itens.length > 3 ? `<small class="muted">+${c.itens.length - 3}</small>` : ''}</div>`).join('')}</div>`).join('')}</div>`;
  return x + '<p class="muted small">Toque no número do dia para marcar algo nele. Compromissos que se repetem aparecem em todas as datas.</p>';
}
function vNotas(l) {
  const ns = notas(l); const cs = buscar(deOutros().filter(x => x.tipo === 'nota'), U().q, U().etq);
  const cartao = (n, outro) => `<button type="button" class="card ag-nota${n.fixa && !outro ? ' fixa' : ''}" data-act="agAbrir" data-id="${esc(n.id)}"><b>${n.fixa && !outro ? '<span class="ag-pin">Fixada</span> ' : ''}${esc(n.titulo)}</b>${n.texto ? `<span class="ag-txt">${esc(n.texto.slice(0, 400))}${n.texto.length > 400 ? '…' : ''}</span>` : ''}${outro ? `<small class="muted">De ${esc(n.donoNome || 'outra pessoa')} · só leitura</small>` : selos(n) ? `<span class="ag-selos">${selos(n)}</span>` : ''}</button>`;
  let x = ns.length ? `<div class="ag-notas">${ns.map(n => cartao(n, false)).join('')}</div>` : vazio('Nenhuma anotação', 'Guarde ideias, contatos e lembretes sem data.', `<button type="button" class="btn pri" data-act="agNovo" data-tipo="nota">${I.plus} Nova anotação</button>`);
  if (cs.length) x += `<h3 class="ag-gt">Compartilhadas comigo <span class="muted">${cs.length}</span></h3><div class="ag-notas">${cs.map(n => cartao(n, true)).join('')}</div>`;
  return x;
}
function vFeitos(l, h) {
  const fs = concluidos(l, h).slice(0, 200);
  if (!fs.length) return vazio('Nada concluído ainda', 'As tarefas feitas e os compromissos que já passaram ficam aqui.');
  return `<div class="ag-lista">${fs.map(it => linha(it, h)).join('')}</div>`;
}
function vLixeira(l, h) {
  const ls = lixeira(l);
  const txt = `<p class="ic-placar">O que você apaga fica aqui por ${LIXEIRA_DIAS} dias e depois some de vez.</p>`;
  if (!ls.length) return txt + vazio('Lixeira vazia', 'Nada foi apagado nos últimos dias.');
  return txt + `<div class="ag-lista">${ls.map(it => linha(it, h, true)).join('')}</div>`;
}
function vMinhaAgenda() {
  const b = base(); if (!b.loaded) return carregando();
  limparLixeira();
  const u = U(); const h = hoje(); const todos = meus(); const ets = etiquetas(todos);
  if (u.etq && !ets.includes(u.etq)) u.etq = '';
  const l = buscar(todos, u.q, u.etq);
  const r = resumo(todos, h); const nCom = deOutros().filter(x => x.tipo === 'nota').length;
  let x = cartoes(r);
  x += abas([['agenda', 'Agenda'], ['cal', 'Calendário'], ['notas', `Anotações (${r.notas + nCom})`], ['feitos', 'Concluídos'], ['lixeira', 'Lixeira']], u.aba, 'ag-aba', 'Partes da agenda');
  x += `<div class="md-barra"><label class="sel md-busca"><span>Buscar</span><input class="in" id="agQ" type="search" value="${esc(u.q || '')}" placeholder="Título, texto, passo ou etiqueta" autocomplete="off"></label>${ets.length ? `<label class="sel"><span>Etiqueta</span><select class="in" id="agFEtq"><option value="">Todas</option>${ets.map(e => `<option ${e === u.etq ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>` : ''}</div>`;
  if (b.erro) x += `<p class="err">Não foi possível ler a sua agenda (${esc(b.erro)}).</p>`;
  x += u.aba === 'notas' ? vNotas(l) : u.aba === 'feitos' ? vFeitos(l, h) : u.aba === 'lixeira' ? vLixeira(l, h) : u.aba === 'cal' ? vCalendario(l, h) : vAgenda(l, h);
  x += '<p class="muted small">Só você vê o que está aqui (nem o administrador). Anotação compartilhada: quem você escolher só lê.</p>';
  return x;
}

/* ---------- formulário ---------- */
const linhaPasso = (p, i) => `<div class="ag-passo" data-i="${i}"><input type="checkbox" class="ag-pok" ${p.ok ? 'checked' : ''} aria-label="Passo feito"><input class="in ag-pt" maxlength="${LIMITES.passo}" value="${esc(p.t)}" placeholder="O que fazer" aria-label="Passo"><button type="button" class="btn sm ghost" data-ag-passo="tirar" aria-label="Tirar este passo">✕</button></div>`;
const lerPassos = () => [...document.querySelectorAll('.ag-passo')].map(r => ({ t: r.querySelector('.ag-pt').value, ok: r.querySelector('.ag-pok').checked }));
// Abrir o link de um item: troca de tela e chama a ação que abre o registro (quando a tela já chegou).
function irPara(l) {
  const lay = document.getElementById('layer'); if (lay) lay.innerHTML = '';
  if (l.v === 'oms' && ['patio', 'bateria', 'sinter'].includes(l.col)) UI.esSet = l.col; // a OM é do conjunto dela
  irParaModuloDa(l.v); aplicarSet();
  UI.view = l.v; UI.more = 0;
  if (l.mat && l.v === 'gcolab' && UI.g) UI.g.mat = l.mat;
  salvarUI(); trocarTela(l.v);
  if (!l.act) return;
  let n = 0; const tentar = () => { if (Object.hasOwn(acoes, l.act)) acoes[l.act](null, { id: l.id || '', col: l.col || '', mat: l.mat || '' }); else if (n++ < 40) setTimeout(tentar, 150); };
  setTimeout(tentar, 150);
}
function verCompartilhada(n) {
  formSheet(n.titulo, `De ${esc(n.donoNome || 'outra pessoa')} · só leitura`, `<p class="ag-txt">${esc(n.texto || '')}</p>`, 'Fechar', async () => {});
}
// Formulário. pre = campos já preenchidos (dia escolhido no calendário, link do "Lembrar disto").
function abrir(id, pre = {}) {
  const t = id ? achar(id) : null; if (id && !t) return;
  if (t && t.uid !== ME.uid && (t.comp || []).includes(ME.uid)) return verCompartilhada(t);
  const x = t || { tipo: 'tarefa', titulo: '', texto: '', data: '', hora: '', rep: '', prio: 'normal', etq: '', passos: [], feito: false, fixa: false, compL: [], ...pre };
  if (!t && x.tipo === 'compromisso' && !x.data) x.data = hoje();
  const ets = etiquetas(meus());
  const html = `<div class="p-form ag-form">
    <div class="row2"><label class="sel"><span>Tipo</span><select class="in" id="agTipo">${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}" ${k === x.tipo ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="sel"><span>Prioridade</span><select class="in" id="agPrio">${Object.entries(PRIO).map(([k, n]) => `<option value="${k}" ${k === (x.prio || 'normal') ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <label class="sel"><span>Título</span><input class="in" id="agTit" maxlength="${LIMITES.titulo}" autocomplete="off" value="${esc(x.titulo)}" placeholder="Ex.: reunião com o cliente, ligar para a manutenção"></label>
    <div class="row2 ag-quando"><label class="sel"><span>Dia</span><input class="in" type="date" id="agData" value="${esc(x.data || '')}"></label><label class="sel"><span>Hora (opcional)</span><input class="in" type="time" id="agHora" value="${esc(x.hora || '')}"></label></div>
    <label class="sel ag-quando"><span>Repetir</span><select class="in" id="agRep">${Object.entries(REPETE).map(([k, n]) => `<option value="${k}" ${k === (x.rep || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="sel"><span>Etiqueta (opcional)</span><input class="in" id="agEtq" list="agEtqs" maxlength="${LIMITES.etq}" autocomplete="off" value="${esc(x.etq || '')}" placeholder="Ex.: Pátio, Bateria, Cliente, Pessoal"><datalist id="agEtqs">${ets.map(e => `<option value="${esc(e)}">`).join('')}</datalist></label>
    <label class="sel"><span>Detalhes (opcional)</span><textarea class="in" id="agTxt" rows="4" maxlength="${LIMITES.texto}">${esc(x.texto || '')}</textarea></label>
    <div class="ag-so-tarefa"><span class="ag-rot">Passos (opcional)</span><div id="agPassos">${(x.passos || []).map(linhaPasso).join('')}</div><button type="button" class="btn sm" data-ag-passo="mais">${I.plus} Passo</button></div>
    <label class="ag-op ag-so-tarefa"><input type="checkbox" id="agFeito" ${x.feito ? 'checked' : ''}> Feita${x.rep ? ' (a repetida vai para a próxima data)' : ''}</label>
    <label class="ag-op ag-so-nota"><input type="checkbox" id="agFixa" ${x.fixa ? 'checked' : ''}> Fixar no alto das anotações</label>
    <label class="sel ag-so-nota"><span>Compartilhar com (opcional, só leitura)</span><input class="in" id="agComp" autocomplete="off" value="${esc((x.compL || []).join(', '))}" placeholder="Usuários de quem vai ler, separados por vírgula"></label>
    ${x.link ? `<div class="ag-link"><span>Ligado a: <b>${esc(x.link.r || x.link.v)}</b></span><button type="button" class="btn sm" data-ag-ir="1">Abrir</button></div>` : ''}
    ${t ? '<label class="tr-del"><input type="checkbox" id="agDel"> Mandar para a lixeira</label>' : ''}</div>`;
  formSheet(t ? TIPOS[t.tipo] : 'Novo item', 'Só você vê', html, t ? 'Salvar' : 'Criar', async () => {
    if (t && marcado('agDel')) { await DB.agendaSalvar(t.id, { apagadoEm: new Date().toISOString() }); toast(`Foi para a lixeira (fica ${LIXEIRA_DIAS} dias)`); render(); return; }
    const compL = v$('agComp').split(/[,;\s]+/).map(normLogin).filter(Boolean);
    let c = conferir({ tipo: v$('agTipo'), titulo: v$('agTit'), texto: v$('agTxt'), data: v$('agData'), hora: v$('agHora'), rep: v$('agRep'), prio: v$('agPrio'), etq: v$('agEtq'), passos: lerPassos(), feito: marcado('agFeito'), fixa: marcado('agFixa'), compL, link: x.link });
    if (!c.ok) throw new Error(c.erro);
    let y = c.item;
    // Tarefa repetida marcada agora como feita: vai para a próxima data em vez de ficar feita.
    if (y.tipo === 'tarefa' && y.feito && y.rep && !(t && t.feito)) y = marcarFeita({ ...y, feito: false }, hoje());
    // Compartilhar: troca os usuários digitados pelo uid de cada um (quem não existe é avisado).
    const comp = [];
    for (const lg of y.compL) {
      const uid = await DB.uidDoLogin(lg);
      if (!uid) throw new Error(`Não existe o usuário "${lg}". Confira como a pessoa entra no sistema.`);
      if (uid !== ME.uid) comp.push(uid);
    }
    y.comp = [...new Set(comp)];
    if (!x.link) delete y.link;
    await DB.agendaSalvar(t ? t.id : DB.agendaNovoId(), { ...y, apagadoEm: '' }, !t);
    toast(t ? 'Salvo' : 'Criado'); render();
  });
  ajustarForm();
  const f = document.getElementById('fSheet');
  if (f) f.addEventListener('click', e => {
    const p = e.target.closest('[data-ag-passo]'); const ir = e.target.closest('[data-ag-ir]');
    if (p && p.dataset.agPasso === 'mais') { const box = document.getElementById('agPassos'); if (box.children.length >= LIMITES.passos) return; box.insertAdjacentHTML('beforeend', linhaPasso({ t: '', ok: false }, box.children.length)); box.lastElementChild.querySelector('.ag-pt').focus(); }
    if (p && p.dataset.agPasso === 'tirar') p.closest('.ag-passo').remove();
    if (ir && x.link) irPara(x.link);
  });
  const ti = document.getElementById('agTit'); if (ti && !t) ti.focus();
}
// Mostra só os campos do tipo escolhido (anotação não tem dia; passos e "Feita" só na tarefa; fixar e compartilhar só na anotação).
function ajustarForm() {
  const tp = v$('agTipo'); const f = document.querySelector('.ag-form'); if (!f) return;
  f.querySelectorAll('.ag-quando').forEach(e => { /** @type {HTMLElement} */ (e).hidden = tp === 'nota'; });
  f.querySelectorAll('.ag-so-tarefa').forEach(e => { /** @type {HTMLElement} */ (e).hidden = tp !== 'tarefa'; });
  f.querySelectorAll('.ag-so-nota').forEach(e => { /** @type {HTMLElement} */ (e).hidden = tp !== 'nota'; });
}
// "Lembrar disto" (ui/lembrar.js): novo item já ligado ao registro de outra tela.
export function novoComLink(link, titulo = '') { abrir('', { tipo: 'tarefa', titulo: titulo.slice(0, LIMITES.titulo), data: hoje(), link }); }

/* ---------- PDF da semana ---------- */
function imprimirSemana() {
  const h = hoje(); const s = semanaPdf(meus(), h);
  const li = it => `<li><b>${it.hora ? esc(it.hora) + ' · ' : ''}${esc(it.titulo)}</b>${it.prio === 'alta' ? ' <i>(alta)</i>' : ''}${it.etq ? ` · ${esc(it.etq)}` : ''}${(it.passos || []).length ? `<ul>${it.passos.map(p => `<li>${p.ok ? '☑' : '☐'} ${esc(p.t)}</li>`).join('')}</ul>` : ''}</li>`;
  const html = `<header class="omi-top"><img src="img/dikma-logo.png" alt="Dikma"><div><h1>Minha agenda · próximos 7 dias</h1><p>${esc(ME.nome || ME.login || '')} · ${esc(dia(h))} a ${esc(dia(s.dias[6].d))}</p></div></header>
    ${s.atrasadas.length ? `<h3>Atrasadas</h3><ul class="ag-imp">${s.atrasadas.map(li).join('')}</ul>` : ''}
    ${s.dias.map(x => `<h3>${esc(dia(x.d))}</h3>${x.itens.length ? `<ul class="ag-imp">${x.itens.map(li).join('')}</ul>` : '<p class="ag-imp-v">Nada marcado.</p>'}`).join('')}
    ${s.fixadas.length ? `<h3>Anotações fixadas</h3>${s.fixadas.map(n => `<p><b>${esc(n.titulo)}</b><br><span class="omi-txt">${esc(n.texto || '')}</span></p>`).join('')}` : ''}
    <footer class="omi-pe">Impresso pelo Dikma Gestão · só para uso pessoal</footer>`;
  let box = document.getElementById('omImp');
  if (!box) { box = document.createElement('div'); box.id = 'omImp'; document.body.appendChild(box); }
  box.innerHTML = html;
  document.body.classList.add('om-imprimindo');
  const fim = () => { document.body.classList.remove('om-imprimindo'); window.removeEventListener('afterprint', fim); };
  window.addEventListener('afterprint', fim);
  const img = box.querySelector('img'); const ir = () => window.print();
  if (img && !img.complete) { img.addEventListener('load', ir, { once: true }); img.addEventListener('error', ir, { once: true }); } else ir();
}

/* ---------- ações ---------- */
const salvarItem = async (it, msg) => {
  const c = conferir(it); if (!c.ok) return;
  await DB.agendaSalvar(it.id, c.item, false).catch(e => toast(e.message || 'Não foi possível salvar'));
  if (msg) toast(msg); render();
};
acoes.agAbrir = (t, d) => abrir(d.id);
acoes.agNada = () => {};
acoes.agNovo = (t, d) => abrir('', { tipo: d.tipo || (U().aba === 'notas' ? 'nota' : 'tarefa') });
acoes.agNovoDia = (t, d) => abrir('', { tipo: 'compromisso', data: d.d });
acoes.agFeito = async (t, d) => {
  const it = meus().find(x => x.id === d.id); if (!it || it.tipo !== 'tarefa') return;
  if (it.feito) return salvarItem({ ...it, feito: false }, 'Tarefa reaberta');
  const y = marcarFeita(it, hoje());
  return salvarItem(y, y.feito ? 'Tarefa feita' : `Feita. Próxima: ${dia(y.data)}`);
};
acoes.agAdiar = (t, d) => { const it = meus().find(x => x.id === d.id); if (it) salvarItem(adiar(it, hoje(), +d.n), +d.n === 1 ? 'Adiada para amanhã' : 'Adiada uma semana'); };
acoes.agRestaurar = async (t, d) => { await DB.agendaSalvar(d.id, { apagadoEm: '' }); toast('Restaurado'); render(); };
acoes.agApagarJa = async (t, d) => { const it = meus().find(x => x.id === d.id); if (!it) return; formSheet('Apagar de vez', esc(it.titulo), '<p class="m0">Não dá para desfazer.</p>', 'Apagar de vez', async () => { await DB.agendaApagar(d.id); toast('Apagado de vez'); render(); }); };
acoes.agMes = (t, d) => { const u = U(); u.mes = +d.n === 0 ? hoje().slice(0, 7) : mesMais(u.mes || hoje().slice(0, 7), +d.n); render(); };
acoes.agPdf = () => imprimirSemana();
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ag-aba]'); if (b) { U().aba = b.dataset.agAba; salvarUI(); render(); } });
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'agTipo') ajustarForm();
  if (e.target && e.target.id === 'agFEtq') { U().etq = e.target.value; render(); }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'agQ') { U().q = e.target.value; clearTimeout(window._agq); window._agq = setTimeout(() => { render(); const i = document.getElementById('agQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

/* ---------- topo ---------- */
export const topo = () => `<button type="button" class="btn pri" data-act="agNovo">${I.plus} Novo</button><button type="button" class="btn" data-act="agPdf">${I.print} Semana em PDF</button>`;
export const renderView = () => vMinhaAgenda();
