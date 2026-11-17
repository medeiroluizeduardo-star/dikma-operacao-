// Administração › Documentos e OMs (era Campo › Documentos e OMs do Meu painel): POP, PT, OS, ASO, treinamentos e OMs
// com validade, situação e responsável. Mostra o que está vencido ou vence dentro do aviso (padrão 30 dias). O administrador e o Gestor e o
// Coordenador da Gestão veem e cadastram. As contas ficam em contas/documentos.js; o banco, em documentos/{id} (nucleo/data.js).
import { TIPOS, TIPO_NOME, SITUACOES, ONDE, PRIORIDADES, PERIODOS, AVISOS, ALERTAS, LIMITES, ANTECEDENCIA, regraDoTipo, somaMeses, veDocsU, alerta, textoAlerta, nomeDoc, linkOk, filtrar, resumo, conferir, linhasExcel } from '../contas/documentos.js';
import { today, SETS, AREA_S } from '../contas/cal.js';
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
  const R = regraDoTipo(d.tipo);
  const meta = [d.tipo, d.prio && d.prio !== 'media' ? 'prioridade ' + (PRIORIDADES[d.prio] || '').toLowerCase() : '', d.colab ? d.colab + (d.mat ? ' (' + d.mat + ')' : '') : '', [ONDE[d.conj], AREA_S[d.area] || d.area, d.local].filter(Boolean).join(' › '), d.resp ? 'resp. ' + d.resp : '', d.validade ? R.validade.toLowerCase() + ' ' + dataBR(d.validade) : 'sem validade', d.situacao].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${alerta(d, TODAY) === 'fim' ? ' fechada' : ''}" data-act="dcAbrir" data-id="${esc(d.id)}"><span class="tr-it-s">${etiqueta(textoAlerta(d, TODAY), SIT[alerta(d, TODAY)])}</span>
    <span class="tr-it-t"><b>${esc(nomeDoc(d))}</b><small>${meta}</small></span></button>`;
}
function cartoes(r) {
  const u = U();
  const c = (k, rot, v, sub, cls) => `<button type="button" class="p-ind md-card ${cls}${u.alerta === k ? ' md-on' : ''}" data-act="dcAlerta" data-v="${k}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></button>`;
  return `<div class="md-cards">${[
    c('', 'Cadastrados', r.total, `${r.fim} encerrado${r.fim !== 1 ? 's' : ''}`, ''),
    c('vencido', 'Vencidos', r.vencido, r.vencido ? 'renove ou encerre' : 'nenhum vencido', r.vencido ? 'critico' : ''),
    c('vence', 'Vencem em breve', r.vence, 'dentro do prazo de aviso', r.vence ? 'atencao' : '')
  ].join('')}</div>`;
}
function vTela() {
  if (!veDocsU(ME)) return vazio('Sem acesso', 'Documentos e OMs é do administrador e do Gestor e do Coordenador da Gestão.');
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const todos = lista(); const r = resumo(todos, TODAY); const L = filtrar(todos, u, TODAY);
  const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  let h = b.erro ? `<p class="err">Não foi possível ler os documentos (${esc(b.erro)}).</p>` : '';
  if (r.alerta) h += `<p class="ic-placar">${r.vencido ? `<b>${r.vencido} vencido${r.vencido > 1 ? 's' : ''}</b>` : ''}${r.vencido && r.vence ? ' e ' : ''}${r.vence ? `${r.vence} vence${r.vence > 1 ? 'm' : ''} em breve` : ''}. Renove ou mude a situação para Concluído, Cancelado ou Arquivado.</p>`;
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
// Nomes para sugerir no responsável e no colaborador: usuários do sistema e colaboradores do Pátio e da Bateria já lidos.
function sugestoes() {
  const pessoas = new Map(); const add = (nome, mat) => { const n = String(nome || '').trim(); if (n && !pessoas.has(n.toUpperCase())) pessoas.set(n.toUpperCase(), { nome: n, mat: String(mat || '') }); };
  for (const k of Object.keys(SETS)) { const st = DB.dados ? DB.dados(k) : null; for (const l of Object.values((st && st.colabs) || {})) for (const c of l || []) add(c.nome, c.mat); }
  const usuarios = (DB.cache.usuarios || []).map(u => String(u.nome || '').trim()).filter(Boolean);
  return { colabs: [...pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), resp: [...new Set([...usuarios, ...[...pessoas.values()].map(p => p.nome)])].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
}
const areasDe = conj => (conj === 'coq' ? Object.keys(AREA_S) : (SETS[conj] ? [...SETS[conj].areas, ...(SETS[conj].gerais || [])] : Object.keys(AREA_S)));
const opAreas = (conj, val) => `<option value="">Sem área específica</option>${[...new Set(areasDe(conj))].map(a => `<option value="${esc(a)}" ${a === val ? 'selected' : ''}>${esc(AREA_S[a] || a)}</option>`).join('')}`;
// Mostra e esconde os campos e troca os nomes das datas conforme o tipo; calcula a validade pela periodicidade.
function ajustarForm() {
  const tipo = v$('dcTipo'); const R = regraDoTipo(tipo); const f = document.getElementById('fSheet'); if (!f) return;
  f.querySelectorAll('[data-dc-se]').forEach(el => { el.hidden = !R[el.dataset.dcSe]; });
  const txt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  txt('dcEmiR', R.emissao); txt('dcValR', R.validade); txt('dcEmitR', R.emitente); txt('dcTipoAj', TIPO_NOME[tipo] || '');
  txt('dcNumR', R.numero ? 'Número' : 'Número (opcional)'); txt('dcTitR', tipo === 'OM' ? 'Serviço a executar' : 'Descrição');
  const num = document.getElementById('dcNum'); if (num) num.placeholder = R.numeroEx;
  const per = v$('dcPer'); const val = document.getElementById('dcVal');
  if (val) { const calc = per !== '' && per !== '0'; val.readOnly = calc || per === '0'; if (per === '0') val.value = ''; else if (calc && v$('dcEmi')) val.value = somaMeses(v$('dcEmi'), +per); }
}
function abrir(id) {
  const d = id ? base().d[id] : null; if (id && !d) return;
  const u = U();
  const x = d || { tipo: u.tipo || 'POP', numero: '', rev: '', titulo: '', conj: u.onde || 'coq', area: '', local: '', resp: ME.nome || '', emitente: '', colab: '', mat: '', prio: 'media', emissao: TODAY, period: undefined, validade: '', aviso: ANTECEDENCIA, situacao: 'Vigente', link: '', obs: '' };
  const S = sugestoes();
  const op = (l, val) => l.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const per = x.period == null ? '' : String(x.period);
  const ob = '<i class="dc-ob" aria-hidden="true">*</i>';
  const html = `<div class="dc-form">
    <p class="dc-sec">Identificação</p>
    <label class="sel"><span>Tipo ${ob}</span><select class="in" id="dcTipo" required>${op(TIPOS.map(t => [t, t]), x.tipo)}</select><small class="muted" id="dcTipoAj"></small></label>
    <div class="dc-par"><label class="sel"><span><span id="dcNumR">Número</span> ${ob}</span><input class="in" id="dcNum" maxlength="${LIMITES.numero}" value="${esc(x.numero || '')}" autocomplete="off"></label>
      <label class="sel dc-rev" data-dc-se="rev"><span>Revisão</span><input class="in" id="dcRev" maxlength="${LIMITES.rev}" value="${esc(x.rev || '')}" placeholder="Ex.: 03" autocomplete="off"></label></div>
    <label class="sel dc-full"><span><span id="dcTitR">Descrição</span> ${ob}</span><input class="in" id="dcTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo || '')}" placeholder="Ex.: Limpeza das correias transportadoras" required></label>
    <label class="sel" data-dc-se="prio"><span>Prioridade ${ob}</span><select class="in" id="dcPrio">${op(Object.entries(PRIORIDADES), x.prio || 'media')}</select></label>
    <div class="dc-par dc-full" data-dc-se="pessoa"><label class="sel"><span>Colaborador ${ob}</span><input class="in" id="dcColab" list="dcColabs" maxlength="${LIMITES.colab}" value="${esc(x.colab || '')}" placeholder="Digite para buscar" autocomplete="off"></label>
      <label class="sel dc-rev"><span>Matrícula</span><input class="in" id="dcMat" maxlength="${LIMITES.mat}" value="${esc(x.mat || '')}" inputmode="numeric" autocomplete="off"></label></div>
    <p class="dc-sec">Onde e quem</p>
    <label class="sel"><span>Onde ${ob}</span><select class="in" id="dcOnde">${op(Object.entries(ONDE), x.conj)}</select></label>
    <label class="sel"><span>Área</span><select class="in" id="dcArea">${opAreas(x.conj, x.area)}</select></label>
    <label class="sel dc-full" data-dc-se="local"><span>Equipamento ou local</span><input class="in" id="dcLocal" maxlength="${LIMITES.local}" value="${esc(x.local || '')}" placeholder="Ex.: Correia TC-03, Bateria 2 lado máquina" autocomplete="off"></label>
    <label class="sel"><span>Responsável pelo acompanhamento ${ob}</span><input class="in" id="dcResp" list="dcResps" maxlength="${LIMITES.resp}" value="${esc(x.resp || '')}" placeholder="Nome ou função" autocomplete="off"></label>
    <label class="sel"><span id="dcEmitR">Emitido por</span><input class="in" id="dcEmit" maxlength="${LIMITES.emitente}" value="${esc(x.emitente || '')}" autocomplete="off"></label>
    <p class="dc-sec">Prazos e alerta</p>
    <label class="sel"><span><span id="dcEmiR">Emissão</span> ${ob}</span><input class="in" type="date" id="dcEmi" value="${esc(x.emissao || '')}" required></label>
    <label class="sel"><span>Periodicidade</span><select class="in" id="dcPer">${op(Object.entries(PERIODOS).sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : +a[0] - +b[0])), per)}</select></label>
    <label class="sel"><span><span id="dcValR">Validade</span> ${ob}</span><input class="in" type="date" id="dcVal" value="${esc(x.validade || '')}"></label>
    <label class="sel"><span>Avisar antes de vencer</span><select class="in" id="dcAviso">${op(AVISOS.map(n => [n, n + ' dias']), x.aviso || ANTECEDENCIA)}</select></label>
    <p class="dc-sec">Situação e arquivo</p>
    <label class="sel"><span>Situação ${ob}</span><select class="in" id="dcSit">${op(SITUACOES.map(s => [s, s]), x.situacao)}</select><small class="muted">Concluído, Cancelado e Arquivado não geram alerta.</small></label>
    <label class="sel"><span>Link do arquivo</span><input class="in" type="url" id="dcLink" maxlength="${LIMITES.link}" value="${esc(x.link || '')}" placeholder="https://… (SharePoint, Drive)"></label>
    ${linkOk(x.link) ? `<a class="btn sm ghost dc-full" href="${esc(x.link.trim())}" target="_blank" rel="noopener noreferrer">Abrir o arquivo</a>` : ''}
    <label class="sel dc-full"><span>Observação</span><textarea class="in" id="dcObs" rows="2" maxlength="${LIMITES.obs}" placeholder="Pendências, condições, o que falta para renovar">${esc(x.obs || '')}</textarea></label>
    <p class="muted small m0 dc-full">${ob} campo obrigatório</p>
    ${d ? '<label class="tr-del dc-full"><input type="checkbox" id="dcDel"> Excluir este documento</label>' : ''}
    <datalist id="dcColabs">${S.colabs.map(p => `<option value="${esc(p.nome)}">${p.mat ? 'mat. ' + esc(p.mat) : ''}</option>`).join('')}</datalist>
    <datalist id="dcResps">${S.resp.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist></div>`;
  const sub = d ? `${esc(textoAlerta(d, TODAY))}${d.criadoNome ? ' · cadastrado por ' + esc(d.criadoNome) : ''}` : 'Campos com * são obrigatórios. O sistema avisa antes de vencer.';
  formSheet(d ? nomeDoc(d) : 'Novo documento', sub, html, d ? 'Salvar' : 'Cadastrar', async () => {
    if (d && (document.getElementById('dcDel') || {}).checked) {
      await DB.docApagar(d.id); DB.log(`Documentos e OMs: excluiu ${nomeDoc(d)}`, 'gestao'); toast('Documento excluído'); render(); return;
    }
    let y;
    try {
      y = conferir({ tipo: v$('dcTipo'), numero: v$('dcNum'), rev: v$('dcRev'), titulo: v$('dcTit'), conj: v$('dcOnde'), area: v$('dcArea'), local: v$('dcLocal'), resp: v$('dcResp'), emitente: v$('dcEmit'), colab: v$('dcColab'), mat: v$('dcMat'), prio: v$('dcPrio'), emissao: v$('dcEmi'), period: v$('dcPer'), validade: v$('dcVal'), aviso: v$('dcAviso'), situacao: v$('dcSit'), link: v$('dcLink'), obs: v$('dcObs') }, lista(), d ? d.id : '');
    } catch (e) { const el = e.campo && document.getElementById(e.campo); if (el) { el.focus(); el.setAttribute('aria-invalid', 'true'); } throw e; }
    if (!d && lista().length >= LIMITES.docs) throw new Error(`No máximo ${LIMITES.docs} documentos.`);
    const nid = d ? d.id : DB.docNovoId();
    await DB.docSalvar(nid, y, !d);
    DB.log(`Documentos e OMs: ${d ? 'alterou' : 'cadastrou'} ${nomeDoc(y)}`, 'gestao'); toast(d ? 'Documento salvo' : 'Documento cadastrado'); render();
  });
  ajustarForm();
}

acoes.dcAbrir = (el, d) => abrir(d.id);
acoes.dcNovo = () => abrir('');
acoes.dcAlerta = (el, d) => { U().alerta = d.v; salvarUI(); render(); };
acoes.dcExcel = async () => {
  try { await baixarExcel(`documentos-e-oms-${TODAY}`, [{ nome: 'Documentos e OMs', linhas: linhasExcel(lista(), TODAY, dataBR) }]); }
  catch (e) { toast('Não foi possível gerar o Excel'); }
};
const FILTROS = { dcFTipo: 'tipo', dcFAlerta: 'alerta', dcFOnde: 'onde' };
document.addEventListener('change', e => {
  const id = e.target && e.target.id; const k = FILTROS[id]; if (k) { U()[k] = e.target.value; salvarUI(); render(); return; }
  if (id === 'dcOnde') { const a = document.getElementById('dcArea'); if (a) a.innerHTML = opAreas(e.target.value, a.value); }
  if (['dcTipo', 'dcPer', 'dcEmi'].includes(id)) ajustarForm();
  // Escolheu um colaborador da lista: a matrícula vem junto.
  if (id === 'dcColab') { const p = sugestoes().colabs.find(c => c.nome === e.target.value); const m = document.getElementById('dcMat'); if (p && p.mat && m && !m.value) m.value = p.mat; }
});
document.addEventListener('input', e => { if (e.target && e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid'); });
document.addEventListener('input', e => { if (e.target && e.target.id === 'dcQ') { U().q = e.target.value; clearTimeout(window._dcq); window._dcq = setTimeout(() => { render(); const i = document.getElementById('dcQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

export function topo() { return `<button type="button" class="btn pri" data-act="dcNovo">${I.plus} Novo documento</button>`; }
export const renderView = () => vTela();
