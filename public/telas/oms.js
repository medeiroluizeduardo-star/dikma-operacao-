// Operação › OMs: solicitação de ordem de manutenção. A OM pode nascer como plano (data prevista) e a tela mostra a
// agenda em Hoje, Semana e Mês (mais a Lista com busca e Excel). O líder abre (com a hora da solicitação), o Técnico de Processo
// aprova ou devolve e envia ao cliente; o cliente toca em Ciente e em Liberar (o técnico registra só se ele liberou por fora);
// quem executou registra a hora da finalização. Cada OM tem a lista de documentação (não obrigatória) e o prazo do cliente.
// As contas ficam em contas/oms.js; o banco, em oms/{id} (nucleo/data.js), uma escuta por conjunto.
import { STATUS, COR, ABERTAS, PRIORIDADES, TIPOS, LIMITES, veOmsU, trataOmU, abreOmU, planejaOmU, areasQuePlaneja, acoesDe, agoraLocal, horaBR, dataBR, duracao, tempos, minutosEntre, conferirSolicitacao, mudar, filtrar, resumo, linhasExcel, clienteDe, palpiteCliente, diaDe, atrasada, visaoHoje, visaoSemana, visaoMes, DOCS, DOC_SIT, PASSOS, PRAZO_MAX, prazosDe, prazoOm, foraDoPrazo, docsResumo, conferirDocs, conferirPrazos, ehClienteDa, docsTxt } from '../contas/oms.js';
import { AREA_S, SETS, DAYS, today, add, weekOf, addMonth, monthLabel, ddmm, pd } from '../contas/cal.js';
import { etiqueta, vazio, carregando, abas } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, SK, salvarUI, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';

const MES = today().slice(0, 7);
// A aba fica guardada; o dia escolhido volta para hoje a cada vez que o app abre.
let diaPronto = false;
const U = () => { const u = (UI.om ||= { status: 'abertas', area: '', q: '' }); u.aba ||= 'hoje'; if (!diaPronto || !u.dia) { u.dia = today(); diaPronto = true; } return u; };
const v$ = id => (document.getElementById(id) || {}).value || '';
const areaNome = a => AREA_S[a] || a || '';

function base() {
  if (DB.omsWatch) DB.omsWatch(SK);
  return (DB.cache.oms || {})[SK] || { d: {}, loaded: false };
}
const lista = () => Object.values(base().d || {});
const achar = id => base().d[id];
const quem = () => ({ uid: ME.uid, nome: ME.nome || ME.login || '' });
const cfg = () => (DB.cache.omsCfg || {}).d || null;
const cliente = () => clienteDe(cfg(), SK);
const conjNome = () => (SETS[SK] && SETS[SK].local) || SK;

/* ---------- desenho ---------- */
function item(o) {
  const x = tempos(o);
  const hora = o.status === 'finalizada' ? `finalizada ${horaBR(o.hFim)}${x.total != null ? ' · total ' + duracao(x.total) : ''}` : o.status === 'liberada' ? `liberada ${horaBR(o.hLib)}${x.espera != null ? ' · espera ' + duracao(x.espera) : ''}` : o.status === 'planejada' ? `prevista ${dataBR(o.dPrev)}` : `solicitada ${horaBR(o.hSol)}${o.dPrev && o.dPrev !== String(o.hSol || '').slice(0, 10) ? ' · prevista ' + dataBR(o.dPrev) : ''}`;
  const meta = [comCliente(o), o.hCiente && o.status === 'enviada' ? 'cliente ciente ' + horaBR(o.hCiente) : '', o.numero ? 'OM ' + o.numero : '', areaNome(o.area), o.cliente ? 'cliente ' + o.cliente : '', [o.equip, o.local].filter(Boolean).join(' · '), o.prio && o.prio !== 'media' ? 'prioridade ' + PRIORIDADES[o.prio].toLowerCase() : '', o.solNome, hora].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${ABERTAS.includes(o.status) ? '' : ' fechada'}" data-act="omAbrir" data-id="${esc(o.id)}"><span class="tr-it-s">${etiqueta(STATUS[o.status] || o.status, COR[o.status])}${atrasada(o, today()) ? etiqueta('Atrasada', 'critico') : ''}${foraDoPrazo(o, cfg()) ? etiqueta('Fora do prazo', 'critico') : ''}</span>
    <span class="tr-it-t"><b>${esc(o.titulo)}</b><small>${meta}</small>${docsChips(o)}${o.status === 'devolvida' && o.motivo ? `<small class="om-mot">Devolvida: ${esc(o.motivo)}</small>` : ''}</span></button>`;
}
// "com o cliente há 5 h · prazo 24 h" (enviada e ainda não liberada: conta desde o envio).
function comCliente(o) {
  if (o.status !== 'enviada' || !o.hEnvio) return '';
  const m = minutosEntre(o.hEnvio, agoraLocal()); if (m == null || m < 0) return '';
  const p = prazoOm(o, cfg()); return `com o cliente há ${duracao(m)}${p ? ` · prazo ${p.horas} h` : ''}`;
}
// Documentação da OM: PT, APR, bloqueio… em verde (pronto) ou cinza (pendente); os "não precisa" não aparecem.
function docsChips(o) {
  const r = docsResumo(o); if (!r || !r.total) return '';
  return `<span class="om-docs" aria-label="Documentação: ${r.prontos} de ${r.total} pronta${r.total > 1 ? 's' : ''}">${r.itens.map(i => `<i class="${i.ok ? 'ok' : ''}" title="${esc(i.nome)}: ${i.ok ? 'pronto' : 'pendente'}">${esc(i.k === 'acomp' ? 'Acomp.' : i.nome)}</i>`).join('')}</span>`;
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
const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const nav = (attr, rot, txt, extra = '') => `<div class="compnav om-nav"><button type="button" class="btn ghost sm" data-${attr}="-1" aria-label="${rot} anterior">‹</button><b>${esc(txt)}</b><button type="button" class="btn ghost sm" data-${attr}="1" aria-label="Próxim${rot === 'Semana' ? 'a' : 'o'} ${rot.toLowerCase()}">›</button>${extra}</div>`;
const prioCls = o => 'om-p-' + (o.prio || 'media');
// Cartão pequeno da agenda (Semana e dia do Mês).
const cartao = o => `<button type="button" class="om-c ${prioCls(o)}${ABERTAS.includes(o.status) ? '' : ' fechada'}" data-act="omAbrir" data-id="${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc([areaNome(o.area), o.equip].filter(Boolean).join(' · '))}</small><span>${etiqueta(STATUS[o.status] || o.status, COR[o.status])}${atrasada(o, today()) ? etiqueta('Atrasada', 'critico') : ''}${foraDoPrazo(o, cfg()) ? etiqueta('Fora do prazo', 'critico') : ''}</span>${docsChips(o)}${comCliente(o) ? `<small>${esc(comCliente(o))}</small>` : ''}</button>`;
const diaNome = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${ddmm(d)}`;

function vHoje(l) {
  const hj = today(); const v = visaoHoje(l, hj, cfg());
  const c = (rot, n, sub, cls) => `<div class="p-ind md-card ${n ? cls : ''}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${n}</span><span class="p-ind-pe">${esc(sub)}</span></div>`;
  let h = `<div class="md-cards om-cards4">${[
    c('Pedir hoje', v.pedir, 'planejadas para hoje ou antes', 'atencao'),
    c('Com o cliente', v.comCliente, v.foraPrazo ? `${v.foraPrazo} fora do prazo` : 'aprovadas e enviadas', v.foraPrazo ? 'critico' : ''),
    c('Liberadas', v.liberadas, 'em execução', 'atencao'),
    c('Atrasadas', v.atrasadas, 'passaram da data prevista', 'critico')
  ].join('')}</div>`;
  h += v.lista.length ? `<div class="tr-lista">${v.lista.map(item).join('')}</div>` : vazio('Nada para hoje', 'As OMs planejadas aparecem aqui no dia previsto.');
  return h;
}
function vSemana(l) {
  const u = U(); const ini = weekOf(u.dia); const hj = today();
  const dias = visaoSemana(l, u.dia);
  const sel = dias.some(d => d.dia === u.dia) ? u.dia : ini;
  let h = nav('om-sem', 'Semana', `${ddmm(ini)} a ${ddmm(add(ini, 6))}`, ini !== weekOf(hj) ? '<button type="button" class="btn ghost sm" data-om-hoje="1">Esta semana</button>' : '');
  // No celular, um dia por vez: os botões dos dias trocam o dia mostrado.
  h += `<div class="om-dias" role="tablist" aria-label="Dias da semana">${dias.map(d => `<button type="button" role="tab" data-om-dia="${d.dia}" aria-selected="${d.dia === sel}" class="${d.dia === hj ? 'hj' : ''}">${esc(DAYS[(pd(d.dia).getDay() + 6) % 7])}<small>${ddmm(d.dia)}</small><i>${d.oms.length || ''}</i></button>`).join('')}</div>`;
  h += `<div class="om-sem">${dias.map(d => `<section class="om-dia${d.dia === sel ? ' on' : ''}${d.dia === hj ? ' hj' : ''}" aria-label="${esc(diaNome(d.dia))}"><h3>${esc(diaNome(d.dia))}<span>${d.oms.length || ''}</span></h3>${d.oms.length ? d.oms.map(cartao).join('') : '<p class="om-nada">—</p>'}</section>`).join('')}</div>`;
  return h;
}
function vMes(l) {
  const u = U(); const ym = u.dia.slice(0, 7); const hj = today();
  const v = visaoMes(l, ym, hj);
  let h = nav('om-mes', 'Mês', monthLabel(ym), ym !== hj.slice(0, 7) ? '<button type="button" class="btn ghost sm" data-om-hoje="1">Este mês</button>' : '');
  h += `<p class="ic-placar">${v.previstas} OM${v.previstas === 1 ? '' : 's'} na agenda do mês · ${v.finalizadas} finalizada${v.finalizadas === 1 ? '' : 's'}${v.aderencia != null ? ` (${v.aderencia}%)` : ''} · ${v.planejadas} ainda planejada${v.planejadas === 1 ? '' : 's'}${v.atrasadas ? ` · <b class="om-atr">${v.atrasadas} atrasada${v.atrasadas === 1 ? '' : 's'}</b>` : ''}</p>`;
  // Calendário de segunda a domingo.
  let cel = DAYS.map(d => `<span class="om-cal-dow">${d}</span>`).join('');
  for (let d = weekOf(ym + '-01'); d.slice(0, 7) <= ym; d = add(d, 1)) {
    if (d.slice(0, 7) < ym) { cel += '<span class="om-cal-x"></span>'; continue; }
    const x = v.dias[d];
    cel += `<button type="button" class="om-cal-d${d === hj ? ' hj' : ''}${d === u.dia ? ' on' : ''}${x && x.atrasadas ? ' atr' : ''}" data-om-dia="${d}" aria-label="${esc(diaNome(d))}: ${x ? x.previstas : 0} OM"><b>${+d.slice(8, 10)}</b>${x ? `<i>${x.previstas}</i>${x.finalizadas ? `<small>${x.finalizadas} feita${x.finalizadas > 1 ? 's' : ''}</small>` : ''}` : ''}</button>`;
    if ((pd(d).getDay() + 6) % 7 === 6 && add(d, 1).slice(0, 7) > ym) break;
  }
  h += `<div class="om-cal">${cel}</div>`;
  // Planejado contra realizado, semana a semana.
  const max = Math.max(1, ...v.semanas.map(s => s.previstas));
  h += `<div class="om-graf" aria-label="Previstas e finalizadas por semana"><p class="dc-sec">Previstas × finalizadas por semana</p>${v.semanas.map(s => `<div class="om-gl"><span>${ddmm(s.ini)}</span><div class="om-gb"><i class="om-gp" style="width:${s.previstas / max * 100}%"></i><i class="om-gf" style="width:${s.finalizadas / max * 100}%"></i></div><b>${s.finalizadas}/${s.previstas}</b></div>`).join('')}<p class="muted small m0"><i class="om-leg om-gp"></i> previstas <i class="om-leg om-gf"></i> finalizadas</p></div>`;
  const doDia = visaoSemana(l, u.dia).find(d => d.dia === u.dia);
  if (u.dia.startsWith(ym)) h += `<p class="dc-sec">${esc(diaNome(u.dia))}</p>${doDia && doDia.oms.length ? `<div class="om-lista-c">${doDia.oms.map(cartao).join('')}</div>` : '<p class="muted small">Nenhuma OM neste dia.</p>'}`;
  return h;
}
function vLista(todos, trata) {
  const u = U();
  let h = cartoes(resumo(todos, MES), trata);
  h += `<div class="md-barra tr-barra">${sel('omFSit', 'Situação', u.status, [['abertas', 'Em aberto'], ...Object.entries(STATUS), ['', 'Todas']])}
    <label class="sel md-busca"><span>Buscar</span><input class="in" id="omQ" type="search" value="${esc(u.q || '')}" placeholder="Nº, serviço, equipamento, quem pediu…" autocomplete="off"></label>
    <button type="button" class="btn sm ghost" data-act="omExcel" ${todos.length ? '' : 'disabled'}>${I.dl} Excel</button></div>`;
  const L = filtrar(todos, { ...u, area: '' });
  h += L.length ? `<div class="tr-lista">${L.map(item).join('')}</div>`
    : vazio(todos.length ? 'Nenhuma OM com esses filtros' : 'Nenhuma OM ainda', todos.length ? 'Mude a situação ou a área lá em cima.' : 'O líder abre a solicitação ou planeja a OM com a data prevista.');
  return h;
}
// O que o cliente vê primeiro: as OMs que estão com ele, com os botões Ciente e Liberar à mão.
function vCliente(l) {
  let h = `<section class="om-cliv" aria-label="Para você liberar"><h3>Para você liberar${l.length ? ` <span>${l.length}</span>` : ''}</h3>`;
  if (!l.length) return h + `<p class="muted small m0">Nenhuma OM esperando você. As que o Técnico de Processo enviar aparecem aqui; as programadas ficam em <b>Semana</b>.</p></section>`;
  const L = [...l].sort((a, b) => foraDoPrazo(b, cfg()) - foraDoPrazo(a, cfg()) || String(a.hEnvio || '').localeCompare(String(b.hEnvio || '')));
  h += L.map(o => `<div class="om-cliv-it${foraDoPrazo(o, cfg()) ? ' fora' : ''}"><button type="button" class="om-cliv-t" data-act="omAbrir" data-id="${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc([areaNome(o.area), [o.equip, o.local].filter(Boolean).join(' · '), o.numero ? 'OM ' + o.numero : '', PRIORIDADES[o.prio || 'media'] ? 'prioridade ' + PRIORIDADES[o.prio || 'media'].toLowerCase() : ''].filter(Boolean).join(' · '))}</small><small>${esc(comCliente(o))}${foraDoPrazo(o, cfg()) ? ' · <b>fora do prazo</b>' : ''}${o.hCiente ? ' · ciente ' + esc(horaBR(o.hCiente)) : ''}</small>${docsChips(o)}</button>
    <div class="om-cliv-b">${o.hCiente ? '' : `<button type="button" class="btn" data-act="omAcao" data-id="${esc(o.id)}" data-v="ciente">Ciente</button>`}<button type="button" class="btn pri" data-act="omAcao" data-id="${esc(o.id)}" data-v="liberar">Liberar</button></div></div>`).join('');
  return h + '</section>';
}
function vTela() {
  if (!veOmsU(ME, SK)) return vazio('Sem acesso', 'As OMs ficam com quem tem a Operação neste conjunto.');
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const todos = lista(); const trata = trataOmU(ME, SK); const planeja = planejaOmU(ME, SK);
  const areas = [...new Set([...(SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []), ...todos.map(o => o.area)])].filter(Boolean);
  let h = b.erro ? `<p class="err">Não foi possível ler as OMs (${esc(b.erro)}).</p>` : '';
  const cli = cliente(); const souCliente = !!cli && cli.uid === ME.uid;
  if (souCliente && !trata) h += `<p class="ic-placar">Você é o cliente do ${esc(conjNome())}. Toque em <b>Ciente</b> quando receber a OM e em <b>Liberar</b> quando o serviço puder começar: a hora fica registrada na mesma hora. As programadas ficam em <b>Semana</b>.</p>`;
  else h += `<p class="ic-placar">${trata ? 'Planeje as OMs com a data prevista, aprove ou devolva as solicitações, envie ao cliente e registre a liberação.' : 'Planeje a OM com a data prevista ou abra a solicitação com a hora em que o serviço foi pedido. O Técnico de Processo confere e envia ao cliente.'} Caminho: planejada → solicitada → aprovada → com o cliente → liberada → finalizada.</p>`;
  const minhas = todos.filter(o => o.status === 'enviada' && ehClienteDa(o, ME));
  if (souCliente || minhas.length) h += vCliente(minhas);
  if (!souCliente && (trata || isAdmin())) {
    const pz = prazosDe(cfg());
    h += `<p class="om-cli${cli ? '' : ' falta'}">Cliente do ${esc(conjNome())}: <b>${cli ? esc(cli.nome) : 'não definido'}</b>${isAdmin() ? ` <button type="button" class="btn sm ghost" data-act="omCliente">${cli ? 'Trocar' : 'Escolher o usuário do cliente'}</button>` : cli ? '' : ' (o administrador escolhe o usuário do cliente)'}
      <span class="om-pz">Prazo do cliente: ${Object.entries(PRIORIDADES).reverse().map(([k, n]) => `${esc(n.toLowerCase())} ${pz[k] ? pz[k] + ' h' : 'sem prazo'}`).join(' · ')}</span>${isAdmin() ? ' <button type="button" class="btn sm ghost" data-act="omPrazos">Mudar prazos</button>' : ''}</p>`;
  }
  h += `<div class="md-barra tr-barra">${planeja ? `<button type="button" class="btn pri" data-act="omNova">${I.plus} Nova OM</button>` : ''}
    ${sel('omFArea', 'Área', u.area, [['', 'Todas'], ...areas.map(a => [a, areaNome(a)])])}</div>`;
  h += abas([['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista']], u.aba, 'om-aba', 'Visões das OMs');
  const l = u.area ? todos.filter(o => o.area === u.area) : todos;
  h += `<div class="om-vis">${u.aba === 'semana' ? vSemana(l) : u.aba === 'mes' ? vMes(l) : u.aba === 'lista' ? vLista(l, trata) : vHoje(l)}</div>`;
  if (!todos.length && planeja) h += `<p class="muted small">Comece pela <b>Nova OM</b>: escolha "Planejar para uma data" para montar a agenda da semana.</p>`;
  return h;
}

/* ---------- janelas ---------- */
const op = (l, val) => l.map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('');
const ob = '<i class="dc-ob" aria-hidden="true">*</i>';
// Documentação (não obrigatória): um seletor por item, Pendente, Pronto ou Não precisa.
const docsCampos = d => `<fieldset class="om-docf dc-full"><legend>Documentação <small>(não obrigatória: marque o que já está pronto)</small></legend>${Object.entries(DOCS).map(([k, n]) => `<label class="sel"><span>${esc(n)}</span><select class="in" id="omDoc_${k}">${op(Object.entries(DOC_SIT), (d && d[k]) || 'pend')}</select></label>`).join('')}</fieldset>`;
const docsLidos = () => conferirDocs(Object.fromEntries(Object.keys(DOCS).map(k => [k, v$('omDoc_' + k)])));
const focar = e => { const el = e.campo && document.getElementById(e.campo); if (el) { el.focus(); el.setAttribute('aria-invalid', 'true'); } throw e; };
// Nova OM (planejada ou já solicitada), ou corrigir (corrigir uma devolvida já reenvia ao técnico).
function editar(id) {
  const o = id ? achar(id) : null; if (id && !o) return;
  const lim = areasQuePlaneja(ME, SK);
  const areas = lim === null ? (SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []) : lim;
  // Quem só trata (o Técnico de Processo) planeja; a solicitação é aberta pelo líder da área.
  const soPlaneja = !abreOmU(ME, SK);
  const u = U(); const diaSug = ['semana', 'mes'].includes(u.aba) && u.dia >= today() ? u.dia : today();
  const x = o || { area: areas.length === 1 ? areas[0] : '', local: '', equip: '', titulo: '', desc: '', tipo: 'corretiva', prio: 'media', hSol: agoraLocal(), dPrev: diaSug };
  const plano = o ? o.status === 'planejada' : soPlaneja || ['semana', 'mes'].includes(u.aba);
  const html = `<div class="dc-form">
    ${o && o.status === 'devolvida' && o.motivo ? `<p class="om-mot dc-full">Devolvida: ${esc(o.motivo)}</p>` : ''}
    ${o || soPlaneja ? '' : `<label class="sel dc-full"><span>O que fazer</span><select class="in" id="omQuando">${op([['agora', 'Solicitar agora (vai ao Técnico de Processo)'], ['planejar', 'Planejar para uma data (pedir no dia)']], plano ? 'planejar' : 'agora')}</select></label>`}
    <label class="sel"><span>Área ${ob}</span><select class="in" id="omArea"><option value="">Escolha</option>${op(areas.map(a => [a, areaNome(a)]), x.area)}</select></label>
    <label class="sel"><span>Data prevista${plano ? ' ' + ob : ''}</span><input class="in" type="date" id="omDPrev" value="${esc(x.dPrev || '')}"></label>
    <label class="sel" id="omHSolL" ${plano ? 'hidden' : ''}><span>Hora da solicitação ${ob}</span><input class="in" type="datetime-local" id="omHSol" value="${esc(x.hSol || agoraLocal())}"></label>
    <label class="sel"><span>Equipamento (TAG)</span><input class="in" id="omEquip" maxlength="${LIMITES.equip}" value="${esc(x.equip || '')}" placeholder="Ex.: TC-03" autocomplete="off"></label>
    <label class="sel"><span>Local ${ob}</span><input class="in" id="omLocal" maxlength="${LIMITES.local}" value="${esc(x.local || '')}" placeholder="Ex.: Correia transportadora 3" autocomplete="off"></label>
    <label class="sel dc-full"><span>Serviço a executar ${ob}</span><input class="in" id="omTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo || '')}" placeholder="Ex.: Troca de rolete travado" autocomplete="off"></label>
    <label class="sel"><span>Tipo</span><select class="in" id="omTipo">${op(Object.entries(TIPOS), x.tipo)}</select></label>
    <label class="sel"><span>Prioridade</span><select class="in" id="omPrio">${op(Object.entries(PRIORIDADES), x.prio)}</select></label>
    <label class="sel dc-full"><span>Detalhes</span><textarea class="in" id="omDesc" rows="3" maxlength="${LIMITES.desc}" placeholder="O que está acontecendo, riscos, o que precisa para liberar">${esc(x.desc || '')}</textarea></label>
    ${docsCampos(x.docs)}
    <p class="muted small m0 dc-full" id="omDica">${ob} campo obrigatório. ${plano ? 'A OM fica planejada na agenda; no dia, um toque em <b>Solicitar</b> a envia ao Técnico de Processo.' : 'Ao enviar, a solicitação vai para o Técnico de Processo.'}</p></div>`;
  const titulo = o ? (o.status === 'planejada' ? 'Editar OM planejada' : 'Corrigir solicitação') : 'Nova OM';
  formSheet(titulo, o ? `${esc(STATUS[o.status])} · cadastrada por ${esc(o.solNome || '')}` : 'Planeje com a data prevista ou solicite agora', html, o && o.status === 'devolvida' ? 'Salvar e reenviar' : o ? 'Salvar' : 'Salvar', async () => {
    const planejar = o ? o.status === 'planejada' : soPlaneja || v$('omQuando') === 'planejar';
    let y; try { y = conferirSolicitacao({ area: v$('omArea'), hSol: v$('omHSol'), dPrev: v$('omDPrev'), equip: v$('omEquip'), local: v$('omLocal'), titulo: v$('omTit'), tipo: v$('omTipo'), prio: v$('omPrio'), desc: v$('omDesc') }, lim, planejar); } catch (e) { focar(e); }
    y.docs = docsLidos();
    if (!o) {
      const st = planejar ? 'planejada' : 'solicitada';
      const h0 = planejar ? { s: 'planejada', em: agoraLocal(), por: ME.uid, nome: quem().nome, txt: 'prevista para ' + dataBR(y.dPrev) } : { s: 'solicitada', em: y.hSol, por: ME.uid, nome: quem().nome };
      await DB.omSalvar(DB.omNovoId(), SK, { ...y, status: st, hist: [h0] }, true);
      DB.log(`OMs: ${planejar ? 'planejada para ' + dataBR(y.dPrev) : 'solicitação aberta'} (${y.titulo}, ${areaNome(y.area)})`, 'operacao'); toast(planejar ? 'OM planejada para ' + dataBR(y.dPrev) : 'Solicitação enviada ao técnico'); render(); return;
    }
    if (planejar) delete y.hSol;
    const extra = o.status === 'devolvida' ? mudar(o, 'reenviar', quem()) : {};
    await DB.omSalvar(o.id, SK, { ...y, ...extra });
    DB.log(`OMs: solicitação ${o.status === 'devolvida' ? 'corrigida e reenviada' : 'alterada'} (${y.titulo})`, 'operacao'); toast(o.status === 'devolvida' ? 'Solicitação reenviada' : 'Solicitação salva'); render();
  });
}
// Uma mudança de situação, com a janela do que é preciso digitar.
function agir(id, acao) {
  const o = achar(id); if (!o || !acoesDe(o, ME).includes(acao)) return;
  const ag = agoraLocal();
  const cli = cliente(); const souCli = ehClienteDa(o, ME);
  // O cliente libera com um toque (vale a hora do toque); o técnico registra a hora que o cliente informou.
  const libCli = acao === 'liberar' && souCli;
  const campos = {
    ciente: `<p class="m0">Você confirma que recebeu esta OM. A hora (${esc(horaBR(ag))}) fica no histórico, e o Dikma vê que você já está ciente.</p>`,
    docs: docsCampos(o.docs),
    solicitar: `<p class="m0">Planejada para <b>${esc(dataBR(o.dPrev))}</b>. A solicitação vai para o Técnico de Processo conferir.</p><label class="sel"><span>Hora da solicitação ${ob}</span><input class="in" type="datetime-local" id="omHSol" value="${ag}"></label>`,
    aprovar: `<label class="sel"><span>Observação (opcional)</span><input class="in" id="omObs" maxlength="${LIMITES.motivo}" autocomplete="off"></label>`,
    devolver: `<label class="sel"><span>O que precisa corrigir ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>`,
    cancelar: `<label class="sel"><span>Motivo do cancelamento ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>`,
    enviar: `<div class="dc-form"><div class="sel dc-full"><span>Cliente</span><p class="om-cli m0${cli ? '' : ' falta'}" id="omCli" tabindex="-1">${cli ? `<b>${esc(cli.nome)}</b> · usuário do cliente no ${esc(conjNome())}` : 'Ainda não definido: o administrador escolhe o usuário do cliente no topo da tela.'}</p></div><label class="sel"><span>Contato no cliente</span><input class="in" id="omCont" maxlength="${LIMITES.contato}" value="${esc(o.contato || '')}" placeholder="Nome ou ramal (opcional)" autocomplete="off"></label><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" placeholder="Se já tiver" autocomplete="off"></label><label class="sel"><span>Hora do envio</span><input class="in" type="datetime-local" id="omHEnv" value="${ag}"></label></div>`,
    liberar: libCli ? `<p class="m0">A liberação fica registrada agora, <b>${esc(horaBR(ag))}</b>, e a equipe do Dikma é avisada para executar.</p><label class="sel"><span>Nº da OM (se tiver)</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off"></label>`
      : `<div class="dc-form">${o.clienteUid ? '<p class="muted small m0 dc-full">O cliente libera pelo sistema. Registre aqui só se ele liberou por fora (telefone, rádio).</p>' : ''}<label class="sel"><span>Hora da liberação ${ob}</span><input class="in" type="datetime-local" id="omHLib" value="${ag}"></label><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off"></label></div>`,
    apagar: `<p class="m0">A OM some da lista e dos números. <b>Não dá para desfazer.</b> Se ela só não vai mais acontecer, prefira <b>Cancelar</b>, que guarda o motivo no histórico.</p>`,
    finalizar: `<label class="sel"><span>Hora da finalização ${ob}</span><input class="in" type="datetime-local" id="omHFim" value="${ag}"></label><label class="sel"><span>Como ficou (opcional)</span><textarea class="in" id="omObs" rows="2" maxlength="${LIMITES.obs}" placeholder="Serviço feito, testado, pendências"></textarea></label>`
  }[acao];
  const nome = { ciente: 'Ciente da OM', docs: 'Documentação da OM', solicitar: 'Solicitar a OM agora', aprovar: 'Aprovar a solicitação', devolver: 'Devolver ao solicitante', cancelar: 'Cancelar a OM', enviar: 'Enviar ao cliente', liberar: libCli ? 'Liberar a OM' : 'Registrar a liberação', finalizar: 'Finalizar a OM', apagar: 'Apagar a OM de vez?' }[acao];
  const btn = { ciente: 'Estou ciente', docs: 'Salvar', solicitar: 'Enviar ao técnico', aprovar: 'Aprovar', devolver: 'Devolver', cancelar: 'Cancelar a OM', enviar: 'Marcar como enviada', liberar: libCli ? 'Liberar agora' : 'Registrar liberação', finalizar: 'Finalizar', apagar: 'Apagar de vez' }[acao];
  formSheet(nome, `${esc(o.titulo)} · ${esc(areaNome(o.area))}`, `<div class="p-form">${campos}</div>`, btn, async () => {
    if (acao === 'apagar') {
      await DB.omApagar(o.id, SK);
      DB.log(`OMs: apagada (${o.titulo}${o.numero ? ', OM ' + o.numero : ''})`, 'operacao'); toast('OM apagada'); render(); return;
    }
    if (acao === 'docs') {
      const docs = docsLidos(); await DB.omSalvar(o.id, SK, { docs });
      DB.log(`OMs: documentação atualizada (${o.titulo}: ${docsTxt({ docs }) || 'nada a preparar'})`, 'operacao'); toast('Documentação salva'); render(); return;
    }
    let y; try { y = mudar(o, acao, quem(), { obs: v$('omObs'), motivo: v$('omMotivo'), numero: v$('omNum'), hSol: v$('omHSol'), cliente: cli, contato: v$('omCont'), hEnvio: v$('omHEnv'), hLib: v$('omHLib'), hFim: v$('omHFim'), peloCliente: libCli }); } catch (e) { focar(e); }
    await DB.omSalvar(o.id, SK, y);
    if (acao === 'ciente') { DB.log(`OMs: cliente ciente (${o.titulo})`, 'operacao'); toast('Ciente registrado'); render(); return; }
    DB.log(`OMs: ${STATUS[y.status].toLowerCase()}${libCli ? ' pelo cliente' : ''} (${o.titulo}${y.numero || o.numero ? ', OM ' + (y.numero || o.numero) : ''})`, 'operacao'); toast(STATUS[y.status]); render();
  }, { cancelarTxt: 'Voltar' });
}
function abrir(id) {
  const o = achar(id); if (!o) return;
  const ac = acoesDe(o, ME); const x = tempos(o); const pz = prazoOm(o, cfg()); const dr = docsResumo(o); const souCli = ehClienteDa(o, ME);
  const linha = (r, v) => (v ? `<div><dt>${esc(r)}</dt><dd>${v}</dd></div>` : '');
  const html = `<dl class="p-dados om-dados">
      ${linha('Situação', etiqueta(STATUS[o.status], COR[o.status]))}${linha('Nº OM no cliente', esc(o.numero || ''))}
      ${linha('Área', esc(areaNome(o.area)))}${linha('Equipamento / local', esc([o.equip, o.local].filter(Boolean).join(' · ')))}
      ${linha('Tipo e prioridade', esc(`${TIPOS[o.tipo] || ''} · ${PRIORIDADES[o.prio] || ''}`))}${linha('Solicitante', esc(o.solNome || ''))}
      ${linha('Data prevista', esc(dataBR(o.dPrev)))}${linha('Hora da solicitação', esc(horaBR(o.hSol)))}${linha('Aprovada', esc([horaBR(o.hAprov), o.aprovNome].filter(Boolean).join(' · ')))}${linha('Cliente', esc([o.cliente, o.contato].filter(Boolean).join(' · ')))}
      ${linha('Enviada ao cliente', esc(horaBR(o.hEnvio)))}${linha('Cliente ciente', esc([horaBR(o.hCiente), o.cienteNome].filter(Boolean).join(' · ')))}
      ${linha('Prazo do cliente', pz ? `${pz.horas} h · ${pz.fora ? etiqueta('Fora do prazo', 'critico') : pz.aberta ? 'resta ' + esc(duracao(pz.resta)) : 'liberada no prazo'}` : '')}
      ${linha('Hora da liberação', esc([horaBR(o.hLib), o.libNome ? `${o.libNome}${o.libCli ? ' (cliente)' : ' (registrada pelo técnico)'}` : ''].filter(Boolean).join(' · ')))}${linha('Hora da finalização', esc(horaBR(o.hFim)))}
      ${linha('Espera até liberar', esc(duracao(x.espera)))}${linha('Execução', esc(duracao(x.execucao)))}
      ${o.desc ? `<div class="dc-full"><dt>Detalhes</dt><dd>${esc(o.desc)}</dd></div>` : ''}${o.motivo ? `<div class="dc-full"><dt>${o.status === 'cancelada' ? 'Motivo do cancelamento' : 'O que corrigir'}</dt><dd>${esc(o.motivo)}</dd></div>` : ''}
      ${o.obsFim ? `<div class="dc-full"><dt>Como ficou</dt><dd>${esc(o.obsFim)}</dd></div>` : ''}
      ${dr ? `<div class="dc-full"><dt>Documentação (${dr.prontos} de ${dr.total} pronta${dr.total === 1 ? '' : 's'})</dt><dd>${dr.total ? docsChips(o) : 'Nada a preparar'}</dd></div>` : ''}</dl>
    ${(o.hist || []).length ? `<p class="dc-sec">Histórico</p><ol class="om-hist">${o.hist.map(p => `<li><b>${esc(STATUS[p.s] || PASSOS[p.s] || p.s)}</b> · ${esc(horaBR(p.em))}${p.nome ? ' · ' + esc(p.nome) : ''}${p.txt ? `<br><small>${esc(p.txt)}</small>` : ''}</li>`).join('')}</ol>` : ''}
    <div class="row-gap om-acoes"><button type="button" class="btn sm" data-act="omImprimir" data-id="${esc(o.id)}">${I.dl} Imprimir ou salvar em PDF</button></div>
    ${ac.length ? `<div class="row-gap om-acoes">${ac.map(a => `<button type="button" class="btn sm${['solicitar', 'aprovar', 'enviar', 'finalizar'].includes(a) || (a === 'liberar' && (souCli || !o.clienteUid)) ? ' pri' : a === 'cancelar' || a === 'apagar' ? ' ghost' : ''}" data-act="omAcao" data-id="${esc(o.id)}" data-v="${a}">${esc({ editar: o.status === 'devolvida' ? 'Corrigir e reenviar' : 'Editar', solicitar: 'Solicitar agora', aprovar: 'Aprovar', devolver: 'Devolver', enviar: 'Enviar ao cliente', ciente: 'Ciente', docs: 'Documentação', liberar: souCli ? 'Liberar' : o.clienteUid ? 'Registrar liberação (cliente liberou por fora)' : 'Registrar liberação', finalizar: 'Finalizar', cancelar: 'Cancelar', apagar: 'Apagar' }[a])}</button>`).join('')}</div>` : ''}`;
  formSheet(o.titulo, `${o.numero ? 'OM ' + esc(o.numero) + ' · ' : ''}${esc(areaNome(o.area))}`, html, 'Fechar', async () => {}, {});
  const f = document.getElementById('fSheet'); if (!f) return;
  const c = f.querySelector('[data-close]'); if (c) c.hidden = true;
  const s = f.querySelector('[type=submit]'); if (s) s.classList.remove('pri');
  // A janela não deixa o clique subir até a página: os botões das ações são ligados aqui.
  f.querySelectorAll('[data-act="omAcao"]').forEach(b => b.addEventListener('click', () => acoes.omAcao(b, b.dataset)));
  f.querySelectorAll('[data-act="omImprimir"]').forEach(b => b.addEventListener('click', () => imprimir(b.dataset.id)));
}

/* ---------- impressão (ou "Salvar como PDF" na janela de impressão) para enviar ao cliente ---------- */
function imprimir(id) {
  const o = achar(id); if (!o) return;
  const x = tempos(o); const cli = o.cliente ? { nome: o.cliente } : cliente();
  const lin = (r, v) => `<tr><th>${esc(r)}</th><td>${v ? esc(v) : '—'}</td></tr>`;
  const html = `<header class="omi-top"><img src="img/dikma-logo.png" alt="Dikma"><div><h1>${o.status === 'planejada' ? 'OM planejada' : 'Solicitação de OM'}</h1><p>${esc(conjNome())}${o.numero ? ' · OM ' + esc(o.numero) : ''} · ${esc(STATUS[o.status] || o.status)}</p></div></header>
    <h2>${esc(o.titulo)}</h2>
    <table class="omi-tab"><tbody>
      ${lin('Cliente', [cli && cli.nome, o.contato].filter(Boolean).join(' · '))}${lin('Nº da OM no cliente', o.numero)}
      ${lin('Área', areaNome(o.area))}${lin('Equipamento', o.equip)}${lin('Local', o.local)}
      ${lin('Tipo', TIPOS[o.tipo])}${lin('Prioridade', PRIORIDADES[o.prio])}
      ${lin('Data prevista', dataBR(o.dPrev))}${lin('Solicitante', o.solNome)}${lin('Hora da solicitação', horaBR(o.hSol))}
      ${lin('Aprovada por', [o.aprovNome, horaBR(o.hAprov)].filter(Boolean).join(' · '))}${lin('Enviada ao cliente', horaBR(o.hEnvio))}
      ${lin('Hora da liberação', horaBR(o.hLib))}${lin('Hora da finalização', horaBR(o.hFim))}
      ${lin('Documentação', docsTxt(o))}${o.hCiente ? lin('Cliente ciente', horaBR(o.hCiente)) : ''}
      ${x.espera != null ? lin('Espera até liberar', duracao(x.espera)) : ''}${x.execucao != null ? lin('Execução', duracao(x.execucao)) : ''}
    </tbody></table>
    ${o.desc ? `<h3>Detalhes do serviço</h3><p class="omi-txt">${esc(o.desc)}</p>` : ''}
    ${o.obsFim ? `<h3>Como ficou</h3><p class="omi-txt">${esc(o.obsFim)}</p>` : ''}
    <div class="omi-ass">${['Solicitante (Dikma)', 'Técnico de Processo (Dikma)', 'Cliente'].map(t => `<div><span></span><small>${t}</small></div>`).join('')}</div>
    <footer class="omi-pe">Impresso em ${esc(horaBR(agoraLocal()))} pelo Dikma Gestão</footer>`;
  let box = document.getElementById('omImp');
  if (!box) { box = document.createElement('div'); box.id = 'omImp'; document.body.appendChild(box); }
  box.innerHTML = html;
  document.body.classList.add('om-imprimindo');
  const fim = () => { document.body.classList.remove('om-imprimindo'); window.removeEventListener('afterprint', fim); };
  window.addEventListener('afterprint', fim);
  const img = box.querySelector('img');
  // A classe só vale na impressão (estilo.css › @media print): pode ficar até o afterprint, mesmo no celular, onde a
  // janela de impressão não segura o código.
  const ir = () => window.print();
  if (img && !img.complete) { img.addEventListener('load', ir, { once: true }); img.addEventListener('error', ir, { once: true }); } else ir();
}

// O administrador escolhe o usuário do cliente deste conjunto.
function escolherCliente() {
  if (!isAdmin()) return;
  const us = (DB.cache.usuarios || []).filter(u => u.papel !== 'bloqueado').sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const atual = cliente(); const pal = palpiteCliente(us, SK);
  const sel = (atual && atual.uid) || (pal && pal.uid) || '';
  const html = `<div class="p-form"><label class="sel"><span>Usuário do cliente no ${esc(conjNome())}</span><select class="in" id="omCliU"><option value="">Escolha…</option>${us.map(u => `<option value="${esc(u.uid)}" ${u.uid === sel ? 'selected' : ''}>${esc(u.nome)}${u.login ? ' (' + esc(u.login) + ')' : ''}</option>`).join('')}</select></label>
    <p class="muted small m0">Esse usuário vê as OMs do ${esc(conjNome())} enviadas ao cliente e recebe o aviso no celular. Ele precisa ter a Operação (pode ser Somente leitura) neste conjunto.</p></div>`;
  formSheet('Cliente das OMs', esc(conjNome()), html, 'Salvar', async () => {
    const uid = v$('omCliU'); const u = us.find(x => x.uid === uid);
    if (!u) { const e = new Error('Escolha o usuário do cliente.'); e.campo = 'omCliU'; focar(e); }
    await DB.omsClienteSalvar(SK, { uid: u.uid, nome: u.nome || u.login || '' });
    DB.log(`OMs: cliente do ${conjNome()} passou a ser ${u.nome || u.login}`, 'operacao'); toast('Cliente salvo'); render();
  });
}

// O administrador muda os prazos de resposta do cliente (combinados com a liderança e o cliente).
function mudarPrazos() {
  if (!isAdmin()) return;
  const pz = prazosDe(cfg());
  const html = `<div class="p-form"><p class="muted small m0">Horas que o cliente tem para liberar a OM, contadas do envio. Passou do prazo, a OM fica vermelha e o cliente e o Técnico de Processo recebem aviso. Use 0 para não ter prazo. Vale para o Pátio e a Bateria.</p>
    <div class="dc-form">${Object.entries(PRIORIDADES).reverse().map(([k, n]) => `<label class="sel"><span>${esc(n)} (horas)</span><input class="in" type="number" inputmode="numeric" min="0" max="${PRAZO_MAX}" step="1" id="omPz_${k}" value="${pz[k]}"></label>`).join('')}</div></div>`;
  formSheet('Prazos do cliente', 'Por prioridade', html, 'Salvar', async () => {
    let y; try { y = conferirPrazos(Object.fromEntries(Object.keys(pz).map(k => [k, v$('omPz_' + k)]))); } catch (e) { focar(e); }
    await DB.omsPrazosSalvar(y);
    DB.log(`OMs: prazos do cliente ${Object.entries(y).map(([k, v]) => `${PRIORIDADES[k].toLowerCase()} ${v} h`).join(', ')}`, 'operacao'); toast('Prazos salvos'); render();
  });
}

acoes.omNova = () => editar('');
acoes.omPrazos = () => mudarPrazos();
acoes.omCliente = () => escolherCliente();
acoes.omAbrir = (el, d) => abrir(d.id);
acoes.omSit = (el, d) => { U().status = U().status === d.v ? 'abertas' : d.v; salvarUI(); render(); };
acoes.omAcao = (el, d) => { document.getElementById('layer').innerHTML = ''; if (d.v === 'editar') editar(d.id); else agir(d.id, d.v); };
acoes.omExcel = async () => {
  try { await baixarExcel(`oms-${SK}-${today()}`, [{ nome: 'OMs', linhas: linhasExcel(lista(), areaNome, cfg()) }]); }
  catch (e) { toast('Não foi possível gerar o Excel'); }
};
const FILTROS = { omFSit: 'status', omFArea: 'area' };
document.addEventListener('change', e => {
  const k = e.target && FILTROS[e.target.id]; if (k) { U()[k] = e.target.value; salvarUI(); render(); return; }
  // Nova OM: "Planejar" esconde a hora da solicitação (fica para o dia em que for pedida).
  if (e.target && e.target.id === 'omQuando') {
    const pl = e.target.value === 'planejar'; const l = document.getElementById('omHSolL'); if (l) l.hidden = pl;
    const d = document.getElementById('omDica'); if (d) d.innerHTML = `${ob} campo obrigatório. ${pl ? 'A OM fica planejada na agenda; no dia, um toque em <b>Solicitar</b> a envia ao Técnico de Processo.' : 'Ao enviar, a solicitação vai para o Técnico de Processo.'}`;
  }
});
// Abas (Hoje, Semana, Mês, Lista), troca de semana/mês e dia escolhido.
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-om-aba],[data-om-sem],[data-om-mes],[data-om-dia],[data-om-hoje]'); if (!b) return;
  const u = U(); const ds = b.dataset;
  if (ds.omAba) u.aba = ds.omAba;
  else if (ds.omSem) u.dia = add(weekOf(u.dia), 7 * +ds.omSem);
  else if (ds.omMes) u.dia = addMonth(u.dia.slice(0, 7), +ds.omMes) + '-01';
  else if (ds.omDia) u.dia = ds.omDia;
  else if (ds.omHoje) u.dia = today();
  salvarUI(); render();
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'omQ') { U().q = e.target.value; clearTimeout(window._omq); window._omq = setTimeout(() => { render(); const i = document.getElementById('omQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

export const renderView = () => vTela();
