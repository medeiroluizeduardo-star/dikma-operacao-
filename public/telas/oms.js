// Operação › OMs: solicitação de ordem de manutenção. O líder abre (com a hora da solicitação), o Técnico de Processo
// aprova ou devolve, envia ao cliente e registra a hora da liberação; quem executou registra a hora da finalização.
// As contas ficam em contas/oms.js; o banco, em oms/{id} (nucleo/data.js), uma escuta por conjunto.
import { STATUS, COR, ABERTAS, PRIORIDADES, TIPOS, LIMITES, veOmsU, trataOmU, areasQueAbre, abreOmU, acoesDe, agoraLocal, horaBR, duracao, tempos, conferirSolicitacao, mudar, filtrar, resumo, linhasExcel, clientesUsados } from '../contas/oms.js';
import { AREA_S, SETS, today } from '../contas/cal.js';
import { etiqueta, vazio, carregando } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, SK, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';

const MES = today().slice(0, 7);
const U = () => (UI.om ||= { status: 'abertas', area: '', q: '' });
const v$ = id => (document.getElementById(id) || {}).value || '';
const areaNome = a => AREA_S[a] || a || '';

function base() {
  if (DB.omsWatch) DB.omsWatch(SK);
  return (DB.cache.oms || {})[SK] || { d: {}, loaded: false };
}
const lista = () => Object.values(base().d || {});
const achar = id => base().d[id];
const quem = () => ({ uid: ME.uid, nome: ME.nome || ME.login || '' });

/* ---------- desenho ---------- */
function item(o) {
  const x = tempos(o);
  const hora = o.status === 'finalizada' ? `finalizada ${horaBR(o.hFim)}${x.total != null ? ' · total ' + duracao(x.total) : ''}` : o.status === 'liberada' ? `liberada ${horaBR(o.hLib)}${x.espera != null ? ' · espera ' + duracao(x.espera) : ''}` : `solicitada ${horaBR(o.hSol)}`;
  const meta = [o.numero ? 'OM ' + o.numero : '', areaNome(o.area), o.cliente ? 'cliente ' + o.cliente : '', [o.equip, o.local].filter(Boolean).join(' · '), o.prio && o.prio !== 'media' ? 'prioridade ' + PRIORIDADES[o.prio].toLowerCase() : '', o.solNome, hora].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${ABERTAS.includes(o.status) ? '' : ' fechada'}" data-act="omAbrir" data-id="${esc(o.id)}"><span class="tr-it-s">${etiqueta(STATUS[o.status] || o.status, COR[o.status])}</span>
    <span class="tr-it-t"><b>${esc(o.titulo)}</b><small>${meta}</small>${o.status === 'devolvida' && o.motivo ? `<small class="om-mot">Devolvida: ${esc(o.motivo)}</small>` : ''}</span></button>`;
}
function cartoes(r, trata) {
  const u = U();
  const c = (k, rot, v, sub, cls) => `<button type="button" class="p-ind md-card ${cls}${u.status === k ? ' md-on' : ''}" data-act="omSit" data-v="${k}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></button>`;
  return `<div class="md-cards">${[
    c('solicitada', 'Aguardando técnico', r.solicitada, trata ? 'aprove ou devolva' : 'em análise', r.solicitada && trata ? 'atencao' : ''),
    c('devolvida', 'Devolvidas', r.devolvida, 'corrigir e reenviar', r.devolvida ? 'critico' : ''),
    c('enviada', 'Com o cliente', r.comCliente, 'aprovadas e enviadas', ''),
    c('liberada', 'Liberadas', r.liberada, 'em execução', r.liberada ? 'atencao' : ''),
    c('finalizada', 'Finalizadas no mês', r.finalizadasMes, r.esperaMedia != null ? `espera média ${duracao(r.esperaMedia)}` : 'tempo médio aparece aqui', '')
  ].join('')}</div>`;
}
function vTela() {
  if (!veOmsU(ME, SK)) return vazio('Sem acesso', 'As OMs ficam com quem tem a Operação neste conjunto.');
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const todos = lista(); const trata = trataOmU(ME, SK); const abre = abreOmU(ME, SK);
  const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const areas = [...new Set([...(SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []), ...todos.map(o => o.area)])].filter(Boolean);
  let h = b.erro ? `<p class="err">Não foi possível ler as OMs (${esc(b.erro)}).</p>` : '';
  h += `<p class="ic-placar">${trata ? 'Você aprova ou devolve as solicitações, envia ao cliente e registra a liberação.' : 'Abra a solicitação com a hora em que o serviço foi pedido. O Técnico de Processo confere e envia ao cliente.'} Caminho: solicitada → aprovada → com o cliente → liberada → finalizada.</p>`;
  h += cartoes(resumo(todos, MES), trata);
  h += `<div class="md-barra tr-barra">${abre ? `<button type="button" class="btn pri" data-act="omNova">${I.plus} Nova solicitação</button>` : ''}
    ${sel('omFSit', 'Situação', u.status, [['abertas', 'Em aberto'], ...Object.entries(STATUS), ['', 'Todas']])}
    ${sel('omFArea', 'Área', u.area, [['', 'Todas'], ...areas.map(a => [a, areaNome(a)])])}
    <label class="sel md-busca"><span>Buscar</span><input class="in" id="omQ" type="search" value="${esc(u.q || '')}" placeholder="Nº, serviço, equipamento, quem pediu…" autocomplete="off"></label>
    <button type="button" class="btn sm ghost" data-act="omExcel" ${todos.length ? '' : 'disabled'}>${I.dl} Excel</button></div>`;
  const L = filtrar(todos, u);
  h += L.length ? `<div class="tr-lista">${L.map(item).join('')}</div>`
    : vazio(todos.length ? 'Nenhuma OM com esses filtros' : 'Nenhuma solicitação ainda', todos.length ? 'Mude a situação ou a área lá em cima.' : 'O líder abre a solicitação; ela aparece aqui para o Técnico de Processo.', !todos.length && abre ? `<button type="button" class="btn pri" data-act="omNova">${I.plus} Nova solicitação</button>` : '');
  return h;
}

/* ---------- janelas ---------- */
const op = (l, val) => l.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('');
const ob = '<i class="dc-ob" aria-hidden="true">*</i>';
const focar = e => { const el = e.campo && document.getElementById(e.campo); if (el) { el.focus(); el.setAttribute('aria-invalid', 'true'); } throw e; };
// Abrir ou corrigir a solicitação (corrigir uma devolvida já reenvia ao técnico).
function editar(id) {
  const o = id ? achar(id) : null; if (id && !o) return;
  const lim = areasQueAbre(ME, SK);
  const areas = lim === null ? (SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []) : lim;
  const x = o || { area: areas.length === 1 ? areas[0] : '', local: '', equip: '', titulo: '', desc: '', tipo: 'corretiva', prio: 'media', hSol: agoraLocal() };
  const html = `<div class="dc-form">
    ${o && o.status === 'devolvida' && o.motivo ? `<p class="om-mot dc-full">Devolvida: ${esc(o.motivo)}</p>` : ''}
    <label class="sel"><span>Área ${ob}</span><select class="in" id="omArea"><option value="">Escolha</option>${op(areas.map(a => [a, areaNome(a)]), x.area)}</select></label>
    <label class="sel"><span>Hora da solicitação ${ob}</span><input class="in" type="datetime-local" id="omHSol" value="${esc(x.hSol || '')}"></label>
    <label class="sel"><span>Equipamento (TAG)</span><input class="in" id="omEquip" maxlength="${LIMITES.equip}" value="${esc(x.equip || '')}" placeholder="Ex.: TC-03" autocomplete="off"></label>
    <label class="sel"><span>Local ${ob}</span><input class="in" id="omLocal" maxlength="${LIMITES.local}" value="${esc(x.local || '')}" placeholder="Ex.: Correia transportadora 3" autocomplete="off"></label>
    <label class="sel dc-full"><span>Serviço a executar ${ob}</span><input class="in" id="omTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo || '')}" placeholder="Ex.: Troca de rolete travado" autocomplete="off"></label>
    <label class="sel"><span>Tipo</span><select class="in" id="omTipo">${op(Object.entries(TIPOS), x.tipo)}</select></label>
    <label class="sel"><span>Prioridade</span><select class="in" id="omPrio">${op(Object.entries(PRIORIDADES), x.prio)}</select></label>
    <label class="sel dc-full"><span>Detalhes</span><textarea class="in" id="omDesc" rows="3" maxlength="${LIMITES.desc}" placeholder="O que está acontecendo, riscos, o que precisa para liberar">${esc(x.desc || '')}</textarea></label>
    <p class="muted small m0 dc-full">${ob} campo obrigatório. Ao enviar, a solicitação vai para o Técnico de Processo.</p></div>`;
  formSheet(o ? 'Corrigir solicitação' : 'Nova solicitação de OM', o ? `${esc(STATUS[o.status])} · aberta por ${esc(o.solNome || '')}` : 'O Técnico de Processo confere antes de ir ao cliente', html, o && o.status === 'devolvida' ? 'Salvar e reenviar' : o ? 'Salvar' : 'Enviar ao técnico', async () => {
    let y; try { y = conferirSolicitacao({ area: v$('omArea'), hSol: v$('omHSol'), equip: v$('omEquip'), local: v$('omLocal'), titulo: v$('omTit'), tipo: v$('omTipo'), prio: v$('omPrio'), desc: v$('omDesc') }, lim); } catch (e) { focar(e); }
    if (!o) {
      await DB.omSalvar(DB.omNovoId(), SK, { ...y, status: 'solicitada', hist: [{ s: 'solicitada', em: y.hSol, por: ME.uid, nome: quem().nome }] }, true);
      DB.log(`OMs: solicitação aberta (${y.titulo}, ${areaNome(y.area)})`, 'operacao'); toast('Solicitação enviada ao técnico'); render(); return;
    }
    const extra = o.status === 'devolvida' ? mudar(o, 'reenviar', quem()) : {};
    await DB.omSalvar(o.id, SK, { ...y, ...extra });
    DB.log(`OMs: solicitação ${o.status === 'devolvida' ? 'corrigida e reenviada' : 'alterada'} (${y.titulo})`, 'operacao'); toast(o.status === 'devolvida' ? 'Solicitação reenviada' : 'Solicitação salva'); render();
  });
}
// Uma mudança de situação, com a janela do que é preciso digitar.
function agir(id, acao) {
  const o = achar(id); if (!o || !acoesDe(o, ME).includes(acao)) return;
  const ag = agoraLocal();
  const cli = acao === 'enviar' ? clientesUsados(lista()) : []; const ult = cli[0] || {};
  const campos = {
    aprovar: `<label class="sel"><span>Observação (opcional)</span><input class="in" id="omObs" maxlength="${LIMITES.motivo}" autocomplete="off"></label>`,
    devolver: `<label class="sel"><span>O que precisa corrigir ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>`,
    cancelar: `<label class="sel"><span>Motivo do cancelamento ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>`,
    enviar: `<div class="dc-form"><label class="sel"><span>Cliente (setor ou área) ${ob}</span><input class="in" id="omCli" list="omCliL" maxlength="${LIMITES.cliente}" value="${esc(o.cliente || ult.cliente || '')}" placeholder="Ex.: Manutenção mecânica da Coqueria" autocomplete="off"></label><label class="sel"><span>Contato no cliente</span><input class="in" id="omCont" list="omContL" maxlength="${LIMITES.contato}" value="${esc(o.contato || ult.contato || '')}" placeholder="Nome ou ramal (opcional)" autocomplete="off"></label><datalist id="omCliL">${cli.map(c => `<option value="${esc(c.cliente)}">`).join('')}</datalist><datalist id="omContL">${[...new Set(cli.map(c => c.contato).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" placeholder="Se já tiver" autocomplete="off"></label><label class="sel"><span>Hora do envio</span><input class="in" type="datetime-local" id="omHEnv" value="${ag}"></label></div>`,
    liberar: `<div class="dc-form"><label class="sel"><span>Hora da liberação ${ob}</span><input class="in" type="datetime-local" id="omHLib" value="${ag}"></label><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off"></label></div>`,
    apagar: `<p class="m0">A OM some da lista e dos números. <b>Não dá para desfazer.</b> Se ela só não vai mais acontecer, prefira <b>Cancelar</b>, que guarda o motivo no histórico.</p>`,
    finalizar: `<label class="sel"><span>Hora da finalização ${ob}</span><input class="in" type="datetime-local" id="omHFim" value="${ag}"></label><label class="sel"><span>Como ficou (opcional)</span><textarea class="in" id="omObs" rows="2" maxlength="${LIMITES.obs}" placeholder="Serviço feito, testado, pendências"></textarea></label>`
  }[acao];
  const nome = { aprovar: 'Aprovar a solicitação', devolver: 'Devolver ao solicitante', cancelar: 'Cancelar a OM', enviar: 'Enviar ao cliente', liberar: 'Registrar a liberação', finalizar: 'Finalizar a OM', apagar: 'Apagar a OM de vez?' }[acao];
  const btn = { aprovar: 'Aprovar', devolver: 'Devolver', cancelar: 'Cancelar a OM', enviar: 'Marcar como enviada', liberar: 'Registrar liberação', finalizar: 'Finalizar', apagar: 'Apagar de vez' }[acao];
  formSheet(nome, `${esc(o.titulo)} · ${esc(areaNome(o.area))}`, `<div class="p-form">${campos}</div>`, btn, async () => {
    if (acao === 'apagar') {
      await DB.omApagar(o.id, SK);
      DB.log(`OMs: apagada (${o.titulo}${o.numero ? ', OM ' + o.numero : ''})`, 'operacao'); toast('OM apagada'); render(); return;
    }
    let y; try { y = mudar(o, acao, quem(), { obs: v$('omObs'), motivo: v$('omMotivo'), numero: v$('omNum'), cliente: v$('omCli'), contato: v$('omCont'), hEnvio: v$('omHEnv'), hLib: v$('omHLib'), hFim: v$('omHFim') }); } catch (e) { focar(e); }
    await DB.omSalvar(o.id, SK, y);
    DB.log(`OMs: ${STATUS[y.status].toLowerCase()} (${o.titulo}${y.numero || o.numero ? ', OM ' + (y.numero || o.numero) : ''})`, 'operacao'); toast(STATUS[y.status]); render();
  }, { cancelarTxt: 'Voltar' });
}
function abrir(id) {
  const o = achar(id); if (!o) return;
  const ac = acoesDe(o, ME); const x = tempos(o);
  const linha = (r, v) => (v ? `<div><dt>${esc(r)}</dt><dd>${v}</dd></div>` : '');
  const html = `<dl class="p-dados om-dados">
      ${linha('Situação', etiqueta(STATUS[o.status], COR[o.status]))}${linha('Nº OM no cliente', esc(o.numero || ''))}
      ${linha('Área', esc(areaNome(o.area)))}${linha('Equipamento / local', esc([o.equip, o.local].filter(Boolean).join(' · ')))}
      ${linha('Tipo e prioridade', esc(`${TIPOS[o.tipo] || ''} · ${PRIORIDADES[o.prio] || ''}`))}${linha('Solicitante', esc(o.solNome || ''))}
      ${linha('Hora da solicitação', esc(horaBR(o.hSol)))}${linha('Aprovada', esc([horaBR(o.hAprov), o.aprovNome].filter(Boolean).join(' · ')))}${linha('Cliente', esc([o.cliente, o.contato].filter(Boolean).join(' · ')))}
      ${linha('Enviada ao cliente', esc(horaBR(o.hEnvio)))}${linha('Hora da liberação', esc(horaBR(o.hLib)))}${linha('Hora da finalização', esc(horaBR(o.hFim)))}
      ${linha('Espera até liberar', esc(duracao(x.espera)))}${linha('Execução', esc(duracao(x.execucao)))}
      ${o.desc ? `<div class="dc-full"><dt>Detalhes</dt><dd>${esc(o.desc)}</dd></div>` : ''}${o.motivo ? `<div class="dc-full"><dt>${o.status === 'cancelada' ? 'Motivo do cancelamento' : 'O que corrigir'}</dt><dd>${esc(o.motivo)}</dd></div>` : ''}
      ${o.obsFim ? `<div class="dc-full"><dt>Como ficou</dt><dd>${esc(o.obsFim)}</dd></div>` : ''}</dl>
    ${(o.hist || []).length ? `<p class="dc-sec">Histórico</p><ol class="om-hist">${o.hist.map(p => `<li><b>${esc(STATUS[p.s] || p.s)}</b> · ${esc(horaBR(p.em))}${p.nome ? ' · ' + esc(p.nome) : ''}${p.txt ? `<br><small>${esc(p.txt)}</small>` : ''}</li>`).join('')}</ol>` : ''}
    ${ac.length ? `<div class="row-gap om-acoes">${ac.map(a => `<button type="button" class="btn sm${['aprovar', 'enviar', 'liberar', 'finalizar'].includes(a) ? ' pri' : a === 'cancelar' || a === 'apagar' ? ' ghost' : ''}" data-act="omAcao" data-id="${esc(o.id)}" data-v="${a}">${esc({ editar: o.status === 'devolvida' ? 'Corrigir e reenviar' : 'Editar', aprovar: 'Aprovar', devolver: 'Devolver', enviar: 'Enviar ao cliente', liberar: 'Registrar liberação', finalizar: 'Finalizar', cancelar: 'Cancelar', apagar: 'Apagar' }[a])}</button>`).join('')}</div>` : ''}`;
  formSheet(o.titulo, `${o.numero ? 'OM ' + esc(o.numero) + ' · ' : ''}${esc(areaNome(o.area))}`, html, 'Fechar', async () => {}, {});
  const f = document.getElementById('fSheet'); if (!f) return;
  const c = f.querySelector('[data-close]'); if (c) c.hidden = true;
  const s = f.querySelector('[type=submit]'); if (s) s.classList.remove('pri');
  // A janela não deixa o clique subir até a página: os botões das ações são ligados aqui.
  f.querySelectorAll('[data-act="omAcao"]').forEach(b => b.addEventListener('click', () => acoes.omAcao(b, b.dataset)));
}

acoes.omNova = () => editar('');
acoes.omAbrir = (el, d) => abrir(d.id);
acoes.omSit = (el, d) => { U().status = U().status === d.v ? 'abertas' : d.v; salvarUI(); render(); };
acoes.omAcao = (el, d) => { document.getElementById('layer').innerHTML = ''; if (d.v === 'editar') editar(d.id); else agir(d.id, d.v); };
acoes.omExcel = async () => {
  try { await baixarExcel(`oms-${SK}-${today()}`, [{ nome: 'OMs', linhas: linhasExcel(lista(), areaNome) }]); }
  catch (e) { toast('Não foi possível gerar o Excel'); }
};
const FILTROS = { omFSit: 'status', omFArea: 'area' };
document.addEventListener('change', e => { const k = e.target && FILTROS[e.target.id]; if (k) { U()[k] = e.target.value; salvarUI(); render(); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'omQ') { U().q = e.target.value; clearTimeout(window._omq); window._omq = setTimeout(() => { render(); const i = document.getElementById('omQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

export const renderView = () => vTela();
