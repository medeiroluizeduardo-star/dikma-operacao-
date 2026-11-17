// Administração › Documentos e OMs (era Campo › Documentos e OMs do Meu painel): POP, PT, OS, ASO, treinamentos e OMs
// com validade, situação e responsável. Mostra o que está vencido ou vence em 30 dias. O administrador e o Gestor e o
// Coordenador da Gestão veem e cadastram. As contas ficam em contas/documentos.js; o banco, em documentos/{id} (nucleo/data.js).
import { TIPOS, SITUACOES, ONDE, ALERTAS, LIMITES, ANTECEDENCIA, veDocsU, alerta, textoAlerta, nomeDoc, linkOk, filtrar, resumo, conferir, linhasExcel } from '../contas/documentos.js';
import { today } from '../contas/cal.js';
import { etiqueta, vazio, carregando } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';

const TODAY = today();
const U = () => (UI.dc ||= { tipo: '', onde: '', alerta: '', q: '' });
const v$ = id => (document.getElementById(id) || {}).value || '';
const SIT = { vencido: 'critico', vence: 'atencao', ok: 'ok', sem: 'neutro', fim: 'neutro' };

function base() {
  if (DB.docsWatch) DB.docsWatch();
  return DB.cache.docs || { d: {}, loaded: false };
}
const lista = () => Object.values(base().d || {});

/* ---------- desenho ---------- */
function item(d) {
  const meta = [d.tipo, ONDE[d.conj], d.resp ? 'resp. ' + d.resp : '', d.validade ? 'validade ' + dataBR(d.validade) : 'sem validade', d.situacao].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${alerta(d, TODAY) === 'fim' ? ' fechada' : ''}" data-act="dcAbrir" data-id="${esc(d.id)}"><span class="tr-it-s">${etiqueta(textoAlerta(d, TODAY), SIT[alerta(d, TODAY)])}</span>
    <span class="tr-it-t"><b>${esc(nomeDoc(d))}</b><small>${meta}</small></span></button>`;
}
function cartoes(r) {
  const u = U();
  const c = (k, rot, v, sub, cls) => `<button type="button" class="p-ind md-card ${cls}${u.alerta === k ? ' md-on' : ''}" data-act="dcAlerta" data-v="${k}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></button>`;
  return `<div class="md-cards">${[
    c('', 'Cadastrados', r.total, `${r.fim} encerrado${r.fim !== 1 ? 's' : ''}`, ''),
    c('vencido', 'Vencidos', r.vencido, r.vencido ? 'renove ou encerre' : 'nenhum vencido', r.vencido ? 'critico' : ''),
    c('vence', `Vencem em ${ANTECEDENCIA} dias`, r.vence, 'programe a renovação', r.vence ? 'atencao' : '')
  ].join('')}</div>`;
}
function vTela() {
  if (!veDocsU(ME)) return vazio('Sem acesso', 'Documentos e OMs é do administrador e do Gestor e do Coordenador da Gestão.');
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const todos = lista(); const r = resumo(todos, TODAY); const L = filtrar(todos, u, TODAY);
  const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  let h = b.erro ? `<p class="err">Não foi possível ler os documentos (${esc(b.erro)}).</p>` : '';
  if (r.alerta) h += `<p class="ic-placar">${r.vencido ? `<b>${r.vencido} vencido${r.vencido > 1 ? 's' : ''}</b>` : ''}${r.vencido && r.vence ? ' e ' : ''}${r.vence ? `${r.vence} vence${r.vence > 1 ? 'm' : ''} nos próximos ${ANTECEDENCIA} dias` : ''}. Renove ou mude a situação para Concluído, Cancelado ou Arquivado.</p>`;
  h += cartoes(r);
  h += `<div class="md-barra tr-barra">${sel('dcFTipo', 'Tipo', u.tipo, [['', 'Todos'], ...TIPOS.map(t => [t, t])])}
    ${sel('dcFAlerta', 'Vencimento', u.alerta, [['', 'Qualquer'], ...Object.entries(ALERTAS)])}
    ${sel('dcFOnde', 'Onde', u.onde, [['', 'Todos'], ...Object.entries(ONDE)])}
    <label class="sel md-busca"><span>Buscar</span><input class="in" id="dcQ" type="search" value="${esc(u.q || '')}" placeholder="Número, descrição, responsável…" autocomplete="off"></label>
    <button type="button" class="btn sm ghost" data-act="dcExcel" ${todos.length ? '' : 'disabled'}>${I.dl} Excel</button></div>`;
  h += L.length ? `<div class="tr-lista">${L.map(item).join('')}</div>`
    : vazio(todos.length ? 'Nenhum documento com esses filtros' : 'Nenhum documento cadastrado', todos.length ? 'Mude os filtros lá em cima.' : 'Cadastre POP, PT, OS, ASO, treinamentos e OMs com a validade para receber o alerta.', todos.length ? '' : `<button type="button" class="btn pri" data-act="dcNovo">${I.plus} Novo documento</button>`);
  return h;
}

/* ---------- ações ---------- */
function abrir(id) {
  const d = id ? base().d[id] : null; if (id && !d) return;
  const u = U();
  const x = d || { tipo: u.tipo || 'POP', numero: '', titulo: '', conj: u.onde || 'coq', resp: '', emissao: TODAY, validade: '', situacao: 'Vigente', link: '', obs: '' };
  const op = (l, val) => l.map(([k, n]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const html = `<div class="p-form">
    <div class="row2"><label class="sel"><span>Tipo</span><select class="in" id="dcTipo">${op(TIPOS.map(t => [t, t]), x.tipo)}</select></label><label class="sel"><span>Número</span><input class="in" id="dcNum" maxlength="${LIMITES.numero}" value="${esc(x.numero || '')}" placeholder="Ex.: POP-012, OM 4500123"></label></div>
    <label class="sel"><span>Descrição</span><input class="in" id="dcTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo || '')}" placeholder="Ex.: Limpeza das correias transportadoras"></label>
    <div class="row2"><label class="sel"><span>Onde</span><select class="in" id="dcOnde">${op(Object.entries(ONDE), x.conj)}</select></label><label class="sel"><span>Responsável</span><input class="in" id="dcResp" maxlength="${LIMITES.resp}" value="${esc(x.resp || '')}" placeholder="Nome ou função"></label></div>
    <div class="row2"><label class="sel"><span>Emissão</span><input class="in" type="date" id="dcEmi" value="${esc(x.emissao || '')}"></label><label class="sel"><span>Validade</span><input class="in" type="date" id="dcVal" value="${esc(x.validade || '')}"></label></div>
    <label class="sel"><span>Situação</span><select class="in" id="dcSit">${op(SITUACOES.map(s => [s, s]), x.situacao)}</select></label>
    <p class="muted small m0">Concluído, Cancelado e Arquivado não geram alerta.</p>
    <label class="sel"><span>Link do arquivo (opcional)</span><input class="in" type="url" id="dcLink" maxlength="${LIMITES.link}" value="${esc(x.link || '')}" placeholder="https://… (SharePoint, Drive)"></label>
    ${linkOk(x.link) ? `<a class="btn sm ghost" href="${esc(x.link.trim())}" target="_blank" rel="noopener noreferrer">Abrir o arquivo</a>` : ''}
    <label class="sel"><span>Observação (opcional)</span><textarea class="in" id="dcObs" rows="2" maxlength="${LIMITES.obs}">${esc(x.obs || '')}</textarea></label>
    ${d ? '<label class="tr-del"><input type="checkbox" id="dcDel"> Excluir este documento</label>' : ''}</div>`;
  const sub = d ? `${esc(textoAlerta(d, TODAY))}${d.criadoNome ? ' · cadastrado por ' + esc(d.criadoNome) : ''}` : 'Com a validade, o sistema avisa 30 dias antes de vencer';
  formSheet(d ? nomeDoc(d) : 'Novo documento', sub, html, d ? 'Salvar' : 'Cadastrar', async () => {
    if (d && (document.getElementById('dcDel') || {}).checked) {
      await DB.docApagar(d.id); DB.log(`Documentos e OMs: excluiu ${nomeDoc(d)}`, 'gestao'); toast('Documento excluído'); render(); return;
    }
    const y = conferir({ tipo: v$('dcTipo'), numero: v$('dcNum'), titulo: v$('dcTit'), conj: v$('dcOnde'), resp: v$('dcResp'), emissao: v$('dcEmi'), validade: v$('dcVal'), situacao: v$('dcSit'), link: v$('dcLink'), obs: v$('dcObs') });
    if (!d && lista().length >= LIMITES.docs) throw new Error(`No máximo ${LIMITES.docs} documentos.`);
    const nid = d ? d.id : DB.docNovoId();
    await DB.docSalvar(nid, y, !d);
    DB.log(`Documentos e OMs: ${d ? 'alterou' : 'cadastrou'} ${nomeDoc(y)}`, 'gestao'); toast(d ? 'Documento salvo' : 'Documento cadastrado'); render();
  });
}

acoes.dcAbrir = (el, d) => abrir(d.id);
acoes.dcNovo = () => abrir('');
acoes.dcAlerta = (el, d) => { U().alerta = d.v; salvarUI(); render(); };
acoes.dcExcel = async () => {
  try { await baixarExcel(`documentos-e-oms-${TODAY}`, [{ nome: 'Documentos e OMs', linhas: linhasExcel(lista(), TODAY, dataBR) }]); }
  catch (e) { toast('Não foi possível gerar o Excel'); }
};
const FILTROS = { dcFTipo: 'tipo', dcFAlerta: 'alerta', dcFOnde: 'onde' };
document.addEventListener('change', e => { const k = e.target && FILTROS[e.target.id]; if (k) { U()[k] = e.target.value; salvarUI(); render(); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'dcQ') { U().q = e.target.value; clearTimeout(window._dcq); window._dcq = setTimeout(() => { render(); const i = document.getElementById('dcQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

export function topo() { return `<button type="button" class="btn pri" data-act="dcNovo">${I.plus} Novo documento</button>`; }
export const renderView = () => vTela();
