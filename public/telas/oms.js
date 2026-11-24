// Operação › OMs: solicitação de ordem de manutenção. A OM pode nascer como plano (data prevista) e a tela mostra a
// agenda em Hoje, Semana e Mês (mais a Lista com busca e Excel). O líder abre (com a hora da solicitação), o Técnico de Processo
// aprova e envia ao cliente num toque; o cliente marca "OM gerada" (com o número), registra as horas que a sala de controle
// passa (sala → eletricista, eletricista liberou) e marca Liberado ou Não liberado (o técnico registra só se ele liberou por
// fora); o líder registra a hora em que avisou a sala que terminou e a hora do desbloqueio. Cada OM tem a lista de documentação (não obrigatória) e o prazo do cliente.
// As contas ficam em contas/oms.js; o banco, em oms/{id} (nucleo/data.js), uma escuta por conjunto.
import { STATUS, ABERTAS, PRIORIDADES, TIPOS, LIMITES, veOmsU, trataOmU, abreOmU, planejaOmU, areasQuePlaneja, acoesDe, agoraLocal, horaBR, dataBR, duracao, tempos, minutosEntre, conferirSolicitacao, mudar, filtrar, resumo, linhasExcel, clienteDe, palpiteCliente, diaDe, atrasada, visaoHoje, visaoSemana, visaoMes, DOCS, DOC_SIT, PASSOS, PRAZO_MAX, prazosDe, prazoOm, foraDoPrazo, docsResumo, conferirDocs, conferirPrazos, passo, ehClienteDa, docsTxt, observacoes, pidFotoOM, nomeSit, corSit, etapas, comQuem, proximo, HORAS_EDIT, conferirHoras, mudouTxt } from '../contas/oms.js';
import { FREQ, DIAS_SEM, conferirRecorrente, freqTxt, proximaData, aCriar, datasDa, HORIZONTE } from '../contas/oms-recorrentes.js';
import { metaFoto } from '../contas/fotos.js';
import { statusFoto } from '../contas/fotos-arquivo.js';
import { verFotoGrande } from '../ui/fotos.js';
import { passoFotos, cfgF } from './fotos.js';
import { AREA_S, SETS, DAYS, today, add, weekOf, addMonth, monthLabel, ddmm, pd } from '../contas/cal.js';
import { etiqueta, vazio, carregando, abas } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, SK, salvarUI, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';
import { imprimirProgramacao, excelProgramacao } from './oms-programacao.js';
import { semanaDaProgramacao } from '../contas/oms-programacao.js';

const MES = today().slice(0, 7);
// A aba fica guardada; o dia escolhido volta para hoje a cada vez que o app abre.
let diaPronto = false;
const U = () => {
  const u = (UI.om ||= { status: 'abertas', area: '', q: '' }); u.aba ||= 'hoje';
  // Link do aviso da programação (sexta): abre a semana pedida.
  if (UI.omLink) { u.aba = 'semana'; u.dia = UI.omLink; delete UI.omLink; diaPronto = true; }
  if (!diaPronto || !u.dia) { u.dia = today(); diaPronto = true; }
  return u;
};
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
  const meta = [comCliente(o), o.hCiente && o.status === 'enviada' ? 'OM gerada ' + horaBR(o.hCiente) : '', o.numero ? 'OM ' + o.numero : '', areaNome(o.area), o.cliente ? 'cliente ' + o.cliente : '', [o.equip, o.local].filter(Boolean).join(' · '), o.prio && o.prio !== 'media' ? 'prioridade ' + PRIORIDADES[o.prio].toLowerCase() : '', o.solNome, hora].filter(Boolean).map(esc).join(' · ');
  return `<button type="button" class="tr-it${ABERTAS.includes(o.status) ? '' : ' fechada'}" data-act="omAbrir" data-id="${esc(o.id)}"><span class="tr-it-s">${etiqueta(nomeSit(o), corSit(o))}${atrasada(o, today()) ? etiqueta('Atrasada', 'critico') : ''}${foraDoPrazo(o, cfg()) ? etiqueta('Fora do prazo', 'critico') : ''}</span>
    <span class="tr-it-t"><b>${esc(o.titulo)}</b><small class="om-quem">${esc(comQuem(o))}</small><small>${meta}</small>${docsChips(o)}${['devolvida', 'recusada'].includes(o.status) && o.motivo ? `<small class="om-mot">${o.status === 'recusada' ? 'Recusada' : 'Devolvida'}: ${esc(o.motivo)}</small>` : ''}</span></button>`;
}
// "com o cliente há 5 h · prazo 24 h" (enviada e ainda não liberada: conta desde o envio).
// Com a OM já gerada, conta da OM gerada (é o tempo de bloqueio, o mesmo relógio do prazo).
function comCliente(o) {
  if (o.status !== 'enviada' || !o.hEnvio) return '';
  const m = minutosEntre(o.hCiente || o.hEnvio, agoraLocal()); if (m == null || m < 0) return '';
  const p = prazoOm(o, cfg()); return `${o.hCiente ? 'bloqueio há' : 'com o cliente há'} ${duracao(m) || '0 min'}${p ? ` · prazo ${p.horas} h` : ''}`;
}
// Barra de passos (pedido → técnico → OM gerada → liberado → executado → desbloqueio).
function barra(o) {
  const l = etapas(o); const canc = o.status === 'cancelada';
  return `<ol class="om-passos${canc ? ' canc' : ''}" aria-label="Passos da OM">${l.map(p => `<li class="${p.feito ? 'ok' : ''}${p.atual ? ' at' : ''}${p.prob ? ' prob' : ''}"${p.atual ? ' aria-current="step"' : ''}><i aria-hidden="true">${p.feito ? '✓' : ''}</i><b>${esc(p.nome)}</b><small>${esc(p.quando ? (p.quando.length > 10 ? horaBR(p.quando) : dataBR(p.quando)) : '')}</small></li>`).join('')}</ol>`;
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
    ...(r.recusada ? [c('recusada', 'Não liberadas', r.recusada, 'ajustar e reenviar', 'critico')] : []),
    c('liberada', 'Liberadas', r.liberada, 'em execução', r.liberada ? 'atencao' : ''),
    c('finalizada', 'Finalizadas no mês', r.finalizadasMes, r.bloqMedia != null ? `bloqueio médio ${duracao(r.bloqMedia)}` : r.esperaMedia != null ? `espera média ${duracao(r.esperaMedia)}` : 'tempo médio aparece aqui', '')
  ].join('')}</div>`;
}
const sel = (id, rot, val, ops) => `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${ops.map(([k, t]) => `<option value="${esc(k)}" ${k === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const nav = (attr, rot, txt, extra = '') => `<div class="compnav om-nav"><button type="button" class="btn ghost sm" data-${attr}="-1" aria-label="${rot} anterior">‹</button><b>${esc(txt)}</b><button type="button" class="btn ghost sm" data-${attr}="1" aria-label="Próxim${rot === 'Semana' ? 'a' : 'o'} ${rot.toLowerCase()}">›</button>${extra}</div>`;
const prioCls = o => 'om-p-' + (o.prio || 'media');
// Cartão pequeno da agenda (Semana e dia do Mês).
const cartao = o => `<button type="button" class="om-c ${prioCls(o)}${ABERTAS.includes(o.status) ? '' : ' fechada'}" data-act="omAbrir" data-id="${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc([areaNome(o.area), o.equip].filter(Boolean).join(' · '))}</small><span>${etiqueta(nomeSit(o), corSit(o))}${atrasada(o, today()) ? etiqueta('Atrasada', 'critico') : ''}${foraDoPrazo(o, cfg()) ? etiqueta('Fora do prazo', 'critico') : ''}</span>${docsChips(o)}${comCliente(o) ? `<small>${esc(comCliente(o))}</small>` : ''}</button>`;
const diaNome = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${ddmm(d)}`;

function vHoje(l) {
  const hj = today(); const v = visaoHoje(l, hj, cfg());
  const c = (rot, n, sub, cls) => `<div class="p-ind md-card ${n ? cls : ''}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${n}</span><span class="p-ind-pe">${esc(sub)}</span></div>`;
  let h = `<div class="md-cards om-cards4">${[
    c('Pedir hoje', v.pedir, 'planejadas para hoje ou antes', 'atencao'),
    c('Com o cliente', v.comCliente, [v.foraPrazo ? `${v.foraPrazo} fora do prazo` : '', v.recusadas ? `${v.recusadas} recusada${v.recusadas > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'aprovadas e enviadas', v.foraPrazo || v.recusadas ? 'critico' : ''),
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
  // Programação da semana para o cliente: PDF (imprimir) e Excel, no padrão dos resumos.
  h += `<div class="row-gap om-prog noprint"><button type="button" class="btn sm" data-act="omProg">${I.dl} Programação da semana (PDF)</button><button type="button" class="btn sm ghost" data-act="omProgXls">${I.dl} Excel</button>${ini === weekOf(hj) && semanaDaProgramacao(hj) !== ini ? '<button type="button" class="btn sm ghost" data-om-sem="1">Ver a próxima semana</button>' : ''}</div>`;
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
  h += L.map(o => `<div class="om-cliv-it${foraDoPrazo(o, cfg()) ? ' fora' : ''}"><button type="button" class="om-cliv-t" data-act="omAbrir" data-id="${esc(o.id)}"><b>${esc(o.titulo)}</b><small>${esc([areaNome(o.area), [o.equip, o.local].filter(Boolean).join(' · '), o.numero ? 'OM ' + o.numero : '', PRIORIDADES[o.prio || 'media'] ? 'prioridade ' + PRIORIDADES[o.prio || 'media'].toLowerCase() : ''].filter(Boolean).join(' · '))}</small><small>${esc(comCliente(o))}${foraDoPrazo(o, cfg()) ? ' · <b>fora do prazo</b>' : ''}${o.hCiente ? ' · OM gerada ' + esc(horaBR(o.hCiente)) : ''}</small>${docsChips(o)}</button>
    <div class="om-cliv-b">${o.hCiente ? '' : `<button type="button" class="btn" data-act="omAcao" data-id="${esc(o.id)}" data-v="ciente">OM gerada</button>`}<button type="button" class="btn ghost" data-act="omAcao" data-id="${esc(o.id)}" data-v="recusar">Não liberado</button><button type="button" class="btn pri" data-act="omAcao" data-id="${esc(o.id)}" data-v="liberar">Liberado</button></div></div>`).join('');
  return h + '</section>';
}
function vTela() {
  if (!veOmsU(ME, SK)) return vazio('Sem acesso', 'As OMs ficam com quem tem a Operação neste conjunto.');
  const b = base(); if (!b.loaded) return carregando();
  const u = U(); const todos = lista(); const trata = trataOmU(ME, SK); const planeja = planejaOmU(ME, SK);
  const areas = [...new Set([...(SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []), ...todos.map(o => o.area)])].filter(Boolean);
  let h = b.erro ? `<p class="err">Não foi possível ler as OMs (${esc(b.erro)}).</p>` : '';
  const cli = cliente(); const souCliente = !!cli && cli.uid === ME.uid;
  if (souCliente && !trata) h += `<p class="ic-placar">Você é o cliente do ${esc(conjNome())}: gere a OM e libere (ou não) as solicitações abaixo.</p>`;
  else h += `<p class="ic-placar">${trata ? 'Aprove (já vai para o cliente) ou devolva as solicitações. Toque numa OM para ver em que passo ela está e o próximo passo.' : 'Abra a solicitação ou planeje a OM para uma data. Toque numa OM para ver em que passo ela está e o próximo passo.'}</p>`;
  if (trata) gerarPreventivas(todos);
  const minhas = todos.filter(o => o.status === 'enviada' && ehClienteDa(o, ME));
  if (souCliente || minhas.length) h += vCliente(minhas);
  if (!souCliente && (trata || isAdmin())) {
    const pz = prazosDe(cfg());
    h += `<p class="om-cli${cli ? '' : ' falta'}">Cliente do ${esc(conjNome())}: <b>${cli ? esc(cli.nome) : 'não definido'}</b>${isAdmin() ? ` <button type="button" class="btn sm ghost" data-act="omCliente">${cli ? 'Trocar' : 'Escolher o usuário do cliente'}</button>` : cli ? '' : ' (o administrador escolhe o usuário do cliente)'}
      <span class="om-pz">Prazo do cliente: ${Object.entries(PRIORIDADES).reverse().map(([k, n]) => `${esc(n.toLowerCase())} ${pz[k] ? pz[k] + ' h' : 'sem prazo'}`).join(' · ')}</span>${isAdmin() ? ' <button type="button" class="btn sm ghost" data-act="omPrazos">Mudar prazos</button>' : ''}</p>`;
  }
  h += `<div class="md-barra tr-barra">${planeja ? `<button type="button" class="btn pri" data-act="omNova">${I.plus} Nova OM</button>` : ''}
    ${sel('omFArea', 'Área', u.area, [['', 'Todas'], ...areas.map(a => [a, areaNome(a)])])}
    ${trata ? `<button type="button" class="btn sm ghost" data-act="omRec">Preventivas que se repetem${nRec() ? ` (${nRec()})` : ''}</button>` : ''}
    <button type="button" class="btn sm ghost" data-act="omComo">Como funciona</button></div>`;
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
// Observação de cada passo (opcional): vai para o histórico da OM, com o nome e a hora.
const obsCampo = (rot = 'Observação (opcional)', dica = 'Fica no histórico da OM') => `<label class="sel dc-full"><span>${rot}</span><textarea class="in" id="omObs" rows="2" maxlength="${LIMITES.obs}" placeholder="${esc(dica)}"></textarea></label>`;
const docsLidos = () => conferirDocs(Object.fromEntries(Object.keys(DOCS).map(k => [k, v$('omDoc_' + k)])));
const focar = e => { const el = e.campo && document.getElementById(e.campo); if (el) { const d = el.closest('details'); if (d) d.open = true; el.focus(); el.setAttribute('aria-invalid', 'true'); } throw e; };
// Sugestões de local e equipamento da área: os locais do plano padrão da área e os já usados nas OMs.
const unicos = l => [...new Set(l.map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const locaisDe = area => unicos([...((DB.cache.plano || {})[area] || []).map(p => p.local), ...lista().filter(o => o.area === area).map(o => o.local)]);
const equipsDe = area => unicos(lista().filter(o => !area || o.area === area).map(o => o.equip));
const opcoes = l => l.slice(0, 200).map(v => `<option value="${esc(v)}"></option>`).join('');
// Nova OM (planejada ou já solicitada), ou corrigir (corrigir uma devolvida já reenvia ao técnico).
// modelo = OM de onde copiar os campos (Repetir esta OM): a nova nasce com o mesmo serviço, área, local e prioridade.
function editar(id, modelo = null) {
  const o = id ? achar(id) : null; if (id && !o) return;
  const lim = areasQuePlaneja(ME, SK);
  const areas = lim === null ? (SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : []) : lim;
  // Quem só trata (o Técnico de Processo) planeja; a solicitação é aberta pelo líder da área.
  const soPlaneja = !abreOmU(ME, SK);
  const u = U(); const diaSug = ['semana', 'mes'].includes(u.aba) && u.dia >= today() ? u.dia : today();
  const m = !o && modelo ? { area: areas.includes(modelo.area) ? modelo.area : '', local: modelo.local || '', equip: modelo.equip || '', titulo: modelo.titulo || '', desc: modelo.desc || '', tipo: modelo.tipo || 'corretiva', prio: modelo.prio || 'media' } : null;
  const x = o || { area: areas.length === 1 ? areas[0] : '', local: '', equip: '', titulo: '', desc: '', tipo: 'corretiva', prio: 'media', ...(m || {}), hSol: agoraLocal(), dPrev: diaSug };
  const plano = o ? o.status === 'planejada' : soPlaneja || ['semana', 'mes'].includes(u.aba);
  // Depois de aprovada, só quem trata edita: além dos dados, o nº da OM e as horas já registradas.
  const pos = !!o && !['planejada', 'solicitada', 'devolvida'].includes(o.status);
  const horas = pos ? HORAS_EDIT.filter(([k]) => o[k]) : [];
  const html = `<div class="dc-form">
    ${o && o.status === 'devolvida' && o.motivo ? `<p class="om-mot dc-full">Devolvida: ${esc(o.motivo)}</p>` : ''}
    ${o || soPlaneja ? '' : `<label class="sel dc-full"><span>O que fazer</span><select class="in" id="omQuando">${op([['agora', 'Solicitar agora (vai ao Técnico de Processo)'], ['planejar', 'Planejar para uma data (pedir no dia)']], plano ? 'planejar' : 'agora')}</select></label>`}
    <label class="sel"><span>Área ${ob}</span><select class="in" id="omArea"><option value="">Escolha</option>${op(areas.map(a => [a, areaNome(a)]), x.area)}</select></label>
    <label class="sel"><span>Data prevista${plano ? ' ' + ob : ''}</span><input class="in" type="date" id="omDPrev" value="${esc(x.dPrev || '')}"></label>
    <label class="sel dc-full"><span>Serviço a executar ${ob}</span><input class="in" id="omTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo || '')}" placeholder="Ex.: Troca de rolete travado" autocomplete="off"></label>
    <label class="sel"><span>Local ${ob}</span><input class="in" id="omLocal" list="omLocais" maxlength="${LIMITES.local}" value="${esc(x.local || '')}" placeholder="Escolha da lista ou digite" autocomplete="off"></label>
    <label class="sel"><span>Equipamento (TAG)</span><input class="in" id="omEquip" list="omEquips" maxlength="${LIMITES.equip}" value="${esc(x.equip || '')}" placeholder="Ex.: TC-03" autocomplete="off"></label>
    <datalist id="omLocais">${opcoes(locaisDe(x.area))}</datalist><datalist id="omEquips">${opcoes(equipsDe(x.area))}</datalist>
    <label class="sel"><span>Prioridade</span><select class="in" id="omPrio">${op(Object.entries(PRIORIDADES), x.prio)}</select></label>
    <details class="om-det dc-full"${o ? ' open' : ''}><summary>Mais detalhes (opcional): tipo, hora do pedido, detalhes e documentação</summary><div class="dc-form">
    <label class="sel"><span>Tipo</span><select class="in" id="omTipo">${op(Object.entries(TIPOS), x.tipo)}</select></label>
    <label class="sel" id="omHSolL" ${plano || pos ? 'hidden' : ''}><span>Hora da solicitação</span><input class="in" type="datetime-local" id="omHSol" value="${esc(x.hSol || agoraLocal())}"></label>
    <label class="sel dc-full"><span>Detalhes</span><textarea class="in" id="omDesc" rows="3" maxlength="${LIMITES.desc}" placeholder="O que está acontecendo, riscos, o que precisa para liberar">${esc(x.desc || '')}</textarea></label>
    ${docsCampos(x.docs)}</div></details>
    ${pos ? `<label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omENum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off"></label>
    <fieldset class="om-docf dc-full"><legend>Horas registradas <small>(corrija se alguma foi marcada errada)</small></legend><div class="dc-form">${horas.map(([k, n]) => `<label class="sel"><span>${esc(n)}</span><input class="in" type="datetime-local" id="omE_${k}" value="${esc(o[k])}"></label>`).join('')}</div></fieldset>` : ''}
    <div class="dc-full">${!o || o.status === 'devolvida' ? obsCampo('Observação para o técnico (opcional)', o ? 'O que foi corrigido' : 'Recado para quem vai conferir; fica no histórico') : ''}</div>
    <p class="muted small m0 dc-full" id="omDica">${ob} campo obrigatório. ${o && o.status !== 'devolvida' ? 'O que você mudar fica no histórico da OM, com o seu nome.' : plano ? 'A OM fica planejada na agenda; no dia, um toque em <b>Solicitar</b> a envia ao Técnico de Processo.' : 'Ao enviar, a solicitação vai para o Técnico de Processo, com a hora de agora.'}</p></div>`;
  const titulo = o ? (o.status === 'planejada' ? 'Editar OM planejada' : o.status === 'devolvida' ? 'Corrigir solicitação' : 'Editar OM') : m ? 'Repetir OM' : 'Nova OM';
  formSheet(titulo, o ? `${esc(STATUS[o.status])} · cadastrada por ${esc(o.solNome || '')}` : 'Planeje com a data prevista ou solicite agora', html, o && o.status === 'devolvida' ? 'Salvar e reenviar' : o ? 'Salvar' : 'Salvar', async () => {
    const planejar = o ? o.status === 'planejada' : soPlaneja || v$('omQuando') === 'planejar';
    let y; try { y = conferirSolicitacao({ area: v$('omArea'), hSol: pos ? v$('omE_hSol') || o.hSol : v$('omHSol'), dPrev: v$('omDPrev'), equip: v$('omEquip'), local: v$('omLocal'), titulo: v$('omTit'), tipo: v$('omTipo'), prio: v$('omPrio'), desc: v$('omDesc') }, lim, planejar); } catch (e) { focar(e); }
    y.docs = docsLidos();
    if (!o) {
      const st = planejar ? 'planejada' : 'solicitada';
      const h0 = planejar ? passo('planejada', quem(), 'prevista para ' + dataBR(y.dPrev), agoraLocal(), v$('omObs')) : passo('solicitada', quem(), '', y.hSol, v$('omObs'));
      const novoId = DB.omNovoId();
      await DB.omSalvar(novoId, SK, { ...y, status: st, hist: [h0] }, true);
      DB.log(`OMs: ${planejar ? 'planejada para ' + dataBR(y.dPrev) : 'solicitação aberta'} (${y.titulo}, ${areaNome(y.area)})`, 'operacao'); toast(planejar ? 'OM planejada para ' + dataBR(y.dPrev) : 'Solicitação enviada ao técnico'); render();
      // Quem abriu pode pôr fotos logo em seguida (opcional); a janela abre depois que esta fecha.
      const nova = { ...y, id: novoId, status: st };
      if (poeFotoOm(nova)) { FOTOS_OM[novoId] = []; setTimeout(() => fotosOm(nova), 0); }
      return;
    }
    if (planejar || pos) delete y.hSol;
    if (pos) {
      let hs; try { hs = conferirHoras(o, Object.fromEntries(horas.map(([k]) => [k, v$('omE_' + k)]))); } catch (e) { focar(e); }
      Object.assign(y, hs, { numero: v$('omENum').trim().slice(0, LIMITES.numero) });
    }
    const txt = mudouTxt(o, y);
    if (o.status !== 'devolvida' && !txt) { toast('Nada mudou'); return; }
    // O histórico guarda quem editou e o que mudou (a devolvida já ganha a linha "corrigida e reenviada").
    const extra = o.status === 'devolvida' ? mudar(o, 'reenviar', quem(), { obs: v$('omObs') }) : { hist: [...(o.hist || []), passo('editada', quem(), txt)].slice(-LIMITES.hist) };
    await DB.omSalvar(o.id, SK, { ...y, ...extra });
    DB.log(`OMs: ${o.status === 'devolvida' ? 'solicitação corrigida e reenviada' : 'OM editada, ' + txt} (${y.titulo})`, 'operacao'); toast(o.status === 'devolvida' ? 'Solicitação reenviada' : 'OM salva'); render();
  });
}
// Uma mudança de situação, com a janela do que é preciso digitar.
function agir(id, acao) {
  const o = achar(id); if (!o || !acoesDe(o, ME).includes(acao)) return;
  const ag = agoraLocal();
  const cli = cliente(); const souCli = ehClienteDa(o, ME);
  // O cliente libera com um toque (vale a hora do toque); o técnico registra a hora que o cliente informou.
  const libCli = acao === 'liberar' && souCli;
  // Recusa e cancelamento feitos pelo próprio cliente (pelo sistema) ficam marcados como dele.
  const peloCli = souCli && ['liberar', 'recusar', 'cancelar'].includes(acao);
  const OBS = obsCampo();
  const campos = {
    ciente: `<p class="m0">A OM foi gerada e passada à sala de controle. A hora (<b>${esc(horaBR(ag))}</b>) fica registrada: é aqui que começa o tempo de bloqueio.</p><label class="sel"><span>Nº da OM ${ob}</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off" inputmode="numeric"></label>${OBS}`,
    obs: `<p class="muted small m0">A observação entra no histórico da OM com o seu nome e a hora, sem mudar a situação. Todos que acompanham a OM veem.</p>${obsCampo('Observação ' + ob, 'Ex.: equipamento só para às 14h; trazer o bloqueio do painel 2')}`,
    recusar: `${peloCli ? `<p class="m0">Equipamento não liberado: a OM volta para o Técnico de Processo do Dikma com o motivo, para ajustar e enviar de novo. A hora (${esc(horaBR(ag))}) fica registrada.</p>` : '<p class="muted small m0">Registre aqui a recusa que o cliente passou por fora (telefone, rádio). Depois de ajustar, use <b>Enviar ao cliente</b> de novo.</p>'}<label class="sel"><span>Motivo ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}" placeholder="Ex.: falta a APR; equipamento em produção nesta data"></textarea></label>${OBS}`,
    docs: docsCampos(o.docs),
    solicitar: `<p class="m0">Planejada para <b>${esc(dataBR(o.dPrev))}</b>. A solicitação vai para o Técnico de Processo conferir.</p><label class="sel"><span>Hora da solicitação ${ob}</span><input class="in" type="datetime-local" id="omHSol" value="${ag}"></label>${obsCampo('Observação para o técnico (opcional)')}`,
    aprovar: cli ? `<p class="m0">Ao aprovar, a OM já vai para <b>${esc(cli.nome)}</b> (cliente do ${esc(conjNome())}) gerar a OM.</p><label class="sel"><span>Contato no cliente</span><input class="in" id="omCont" maxlength="${LIMITES.contato}" value="${esc(o.contato || '')}" placeholder="Nome ou ramal (opcional)" autocomplete="off"></label>${OBS}`
      : `<p class="muted small m0">O cliente deste conjunto ainda não foi definido: a OM fica aprovada e depois você usa <b>Enviar ao cliente</b>.</p>${OBS}`,
    devolver: `<label class="sel"><span>O que precisa corrigir ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>${OBS}`,
    cancelar: `${peloCli ? '<p class="m0">A OM é encerrada como <b>cancelada pelo cliente</b> e a equipe do Dikma é avisada. O motivo fica no histórico.</p>' : ''}<label class="sel"><span>Motivo do cancelamento ${ob}</span><textarea class="in" id="omMotivo" rows="3" maxlength="${LIMITES.motivo}"></textarea></label>${OBS}`,
    enviar: `<div class="dc-form"><div class="sel dc-full"><span>Cliente</span><p class="om-cli m0${cli ? '' : ' falta'}" id="omCli" tabindex="-1">${cli ? `<b>${esc(cli.nome)}</b> · usuário do cliente no ${esc(conjNome())}` : 'Ainda não definido: o administrador escolhe o usuário do cliente no topo da tela.'}</p></div><label class="sel"><span>Contato no cliente</span><input class="in" id="omCont" maxlength="${LIMITES.contato}" value="${esc(o.contato || '')}" placeholder="Nome ou ramal (opcional)" autocomplete="off"></label><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" placeholder="Se já tiver" autocomplete="off"></label><label class="sel"><span>Hora do envio</span><input class="in" type="datetime-local" id="omHEnv" value="${ag}"></label>${o.status === 'recusada' && o.motivo ? `<p class="om-mot dc-full">Recusada pelo cliente: ${esc(o.motivo)}</p>` : ''}${obsCampo('Observação para o cliente (opcional)', o.status === 'recusada' ? 'O que foi ajustado' : 'Recado para o cliente; fica no histórico')}</div>`,
    liberar: libCli ? `<p class="m0">Equipamento liberado: fica registrado agora, <b>${esc(horaBR(ag))}</b>, e a equipe do Dikma é avisada para executar. Informe as horas que a sala de controle passou.</p><div class="dc-form">${o.hCiente ? '' : `<label class="sel"><span>OM gerada em ${ob}</span><input class="in" type="datetime-local" id="omHOm" value="${ag}"></label>`}<label class="sel"><span>Sala passou ao eletricista (opcional)</span><input class="in" type="datetime-local" id="omHSala" value=""></label><label class="sel"><span>Eletricista liberou ${ob}</span><input class="in" type="datetime-local" id="omHEletr" value="${ag}"></label>${o.numero ? '' : `<label class="sel"><span>Nº da OM</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" autocomplete="off"></label>`}</div>${OBS}`
      : `<div class="dc-form">${o.clienteUid ? '<p class="muted small m0 dc-full">O cliente libera pelo sistema. Registre aqui só se ele liberou por fora (telefone, rádio).</p>' : ''}<label class="sel"><span>Hora da liberação ${ob}</span><input class="in" type="datetime-local" id="omHLib" value="${ag}"></label>${o.hCiente ? '' : '<label class="sel"><span>OM gerada em (opcional)</span><input class="in" type="datetime-local" id="omHOm" value=""></label>'}<label class="sel"><span>Sala passou ao eletricista (opcional)</span><input class="in" type="datetime-local" id="omHSala" value=""></label><label class="sel"><span>Eletricista liberou (opcional)</span><input class="in" type="datetime-local" id="omHEletr" value=""></label><label class="sel"><span>Nº da OM no cliente</span><input class="in" id="omNum" maxlength="${LIMITES.numero}" value="${esc(o.numero || '')}" autocomplete="off"></label>${obsCampo()}</div>`,
    desbloqueio: `<label class="sel"><span>Hora em que a sala de controle desbloqueou ${ob}</span><input class="in" type="datetime-local" id="omHDesb" value="${ag}"></label>${OBS}`,
    apagar: `<p class="m0">A OM some da lista e dos números. <b>Não dá para desfazer.</b> Se ela só não vai mais acontecer, prefira <b>Cancelar</b>, que guarda o motivo no histórico.</p>`,
    finalizar: `<p class="muted small m0">Serviço feito e sala de controle avisada. Se a sala já desbloqueou, marque as duas horas agora e a OM se encerra. Se ainda não, deixe em branco: a OM fica em <b>Aguardando desbloqueio</b> até você marcar.</p><label class="sel"><span>Avisou a sala que terminou ${ob}</span><input class="in" type="datetime-local" id="omHFim" value="${ag}"></label><label class="sel"><span>Sala desbloqueou (opcional)</span><input class="in" type="datetime-local" id="omHDesb" value=""></label><label class="sel"><span>Como ficou (opcional)</span><textarea class="in" id="omObs" rows="2" maxlength="${LIMITES.obs}" placeholder="Serviço feito, testado, pendências"></textarea></label>`
  }[acao];
  const nome = { obs: 'Adicionar observação', recusar: peloCli ? 'Equipamento não liberado' : 'Registrar que o cliente não liberou', ciente: 'OM gerada', desbloqueio: 'Desbloqueio pela sala de controle', docs: 'Documentação da OM', solicitar: 'Solicitar a OM agora', aprovar: cli ? 'Aprovar e enviar ao cliente' : 'Aprovar a solicitação', devolver: 'Devolver ao solicitante', cancelar: peloCli ? 'Cancelar a OM (cliente)' : 'Cancelar a OM', enviar: o.status === 'recusada' ? 'Reenviar ao cliente' : 'Enviar ao cliente', liberar: libCli ? 'Equipamento liberado' : 'Registrar a liberação', finalizar: 'Serviço terminado', apagar: 'Apagar a OM de vez?' }[acao];
  const btn = { obs: 'Salvar observação', recusar: peloCli ? 'Não liberado' : 'Registrar', ciente: 'OM gerada', desbloqueio: 'Salvar', docs: 'Salvar', solicitar: 'Enviar ao técnico', aprovar: cli ? 'Aprovar e enviar' : 'Aprovar', devolver: 'Devolver', cancelar: 'Cancelar a OM', enviar: o.status === 'recusada' ? 'Reenviar' : 'Marcar como enviada', liberar: libCli ? 'Liberado' : 'Registrar liberação', finalizar: 'Finalizar', apagar: 'Apagar de vez' }[acao];
  formSheet(nome, `${esc(o.titulo)} · ${esc(areaNome(o.area))}`, `<div class="p-form">${campos}</div>`, btn, async () => {
    if (acao === 'apagar') {
      await DB.omApagar(o.id, SK);
      DB.log(`OMs: apagada (${o.titulo}${o.numero ? ', OM ' + o.numero : ''})`, 'operacao'); toast('OM apagada'); render(); return;
    }
    if (acao === 'docs') {
      const docs = docsLidos(); await DB.omSalvar(o.id, SK, { docs });
      DB.log(`OMs: documentação atualizada (${o.titulo}: ${docsTxt({ docs }) || 'nada a preparar'})`, 'operacao'); toast('Documentação salva'); render(); return;
    }
    let y; try { y = mudar(o, acao, quem(), { obs: v$('omObs'), motivo: v$('omMotivo'), numero: v$('omNum'), hSol: v$('omHSol'), cliente: cli, contato: v$('omCont'), hEnvio: v$('omHEnv'), hLib: v$('omHLib'), hFim: v$('omHFim'), hCiente: v$('omHOm'), hSala: v$('omHSala'), hEletr: v$('omHEletr'), hDesb: v$('omHDesb'), enviar: acao === 'aprovar' && !!cli, peloCliente: peloCli }); } catch (e) { focar(e); }
    await DB.omSalvar(o.id, SK, y);
    if (acao === 'ciente') { DB.log(`OMs: OM gerada pelo cliente (${o.titulo}, OM ${y.numero})`, 'operacao'); toast('OM gerada registrada'); render(); return; }
    if (acao === 'desbloqueio') { DB.log(`OMs: desbloqueio (${o.titulo})`, 'operacao'); toast('Desbloqueio registrado'); render(); return; }
    if (acao === 'obs') { DB.log(`OMs: observação (${o.titulo})`, 'operacao'); toast('Observação salva'); render(); return; }
    DB.log(`OMs: ${STATUS[y.status].toLowerCase()}${peloCli && acao !== 'recusar' ? ' pelo cliente' : ''} (${o.titulo}${y.numero || o.numero ? ', OM ' + (y.numero || o.numero) : ''})`, 'operacao'); toast(STATUS[y.status]); render();
  }, { cancelarTxt: 'Voltar' });
}
/* ---------- fotos da OM (opcionais): só quem abre a solicitação na área (o líder) e o administrador põem;
   o técnico e o cliente veem. Ficam com as fotos das atividades (data.js › salvarFotosOM), na semana atual da área. ---------- */
const FIM_FOTO = ['finalizada', 'cancelada'];
const areaGeral = a => !!(SETS[SK] && (SETS[SK].gerais || []).includes(a));
const poeFotoOm = o => !!o && !FIM_FOTO.includes(o.status) && !areaGeral(o.area) && (isAdmin() || abreOmU(ME, SK, o.area));
const apagaFotoOm = (o, f) => isAdmin() || (abreOmU(ME, SK, o.area) && statusFoto(f) === 'banco');
const FOTOS_OM = {};
async function carregarFotosOm(id) { try { FOTOS_OM[id] = await DB.listarFotosOM(SK, id); } catch (e) { FOTOS_OM[id] = FOTOS_OM[id] || []; } return FOTOS_OM[id]; }
const legFotoOm = f => [f.porNome || '', f.at && f.at.toLocaleString ? f.at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''].filter(Boolean).join(' · ');
function pintarFotosOm(o) {
  const box = document.getElementById('omFotos'); if (!box) return;
  const l = FOTOS_OM[o.id]; const max = cfgF().maxOM;
  if (!l) { box.innerHTML = '<p class="muted small m0">Carregando as fotos…</p>'; return; }
  const pode = poeFotoOm(o) && l.length < max;
  box.innerHTML = (l.length ? `<div class="sgfotos">${l.map((f, i) => `<div class="sgfth"><img src="${f.thumb || ''}" alt="Foto ${i + 1} da OM" data-omft="${i}" tabindex="0" role="button">${apagaFotoOm(o, f) ? `<button type="button" class="btn sm ghost" data-omftx="${i}" aria-label="Apagar a foto ${i + 1}">✕</button>` : ''}</div>`).join('')}</div>` : `<p class="muted small m0">${poeFotoOm(o) ? 'Nenhuma foto ainda (opcional).' : 'Nenhuma foto.'}</p>`)
    + (pode ? `<div class="row-gap"><button type="button" class="btn sm" data-omfadd="1">${I.cam} Adicionar foto</button><span class="muted small">${l.length} de até ${max}</span></div>` : '');
  box.onclick = async e => {
    const v = e.target.closest('[data-omft]');
    if (v) { const f = l[+v.dataset.omft]; if (f) verFotoGrande(statusFoto(f) === 'arquivada' ? async () => f.thumb : () => DB.abrirEvidencia(f.id, SK), f.thumb, 'Foto da OM', legFotoOm(f)); return; }
    const x = e.target.closest('[data-omftx]');
    if (x) {
      if (x.dataset.certo !== '1') { x.dataset.certo = '1'; x.textContent = 'Apagar?'; return; }
      const f = l[+x.dataset.omftx]; if (!f) return; x.disabled = true;
      try { await DB.apagarFotoOM(SK, f); DB.log(`OMs: foto apagada (${o.titulo})`, 'operacao'); toast('Foto apagada'); } catch (err) { toast('Não foi possível apagar a foto agora'); }
      await carregarFotosOm(o.id); pintarFotosOm(o); return;
    }
    if (e.target.closest('[data-omfadd]')) fotosOm(o, () => abrir(o.id));
  };
}
// Passo de fotos da OM (opcional, até o máximo das OMs em Administração › Fotos). depois() roda ao salvar ou cancelar.
function fotosOm(o, depois = () => {}) {
  const tem = (FOTOS_OM[o.id] || []).length; const max = cfgF().maxOM;
  if (tem >= max) { toast(`A OM já tem ${max} foto${max > 1 ? 's' : ''}`); depois(); return; }
  passoFotos({ titulo: 'Fotos da OM', sub: `<b>${esc(o.titulo)}</b><br>Opcional: até ${max} foto${max > 1 ? 's' : ''} por OM. Para seguir sem foto, toque em Cancelar.`, cfg: { obrig: false, min: 0, max }, tem, rotuloOk: 'Salvar as fotos',
    aoCancelar: depois,
    aoConfirmar: async imgs => {
      if (!imgs.length) { depois(); return; }
      const hoje = today(); const semana = `${o.area}|${weekOf(hoje)}`; const k = (pd(hoje).getDay() + 6) % 7;
      const fotos = imgs.map(img => {
        const meta = metaFoto({ semana, area: o.area, conj: SK, rota: '', dia: hoje, k, sit: '', itens: [{ pid: pidFotoOM(o.id), ativ: `OM: ${o.titulo}`, local: [o.equip, o.local].filter(Boolean).join(' · ') }], img, por: ME.uid, porNome: ME.nome || ME.login || '' });
        delete meta.por; delete meta.porNome; return { meta, dados: img.dados };
      });
      try { await DB.salvarFotosOM(SK, fotos); DB.log(`OMs: ${fotos.length} foto${fotos.length > 1 ? 's' : ''} (${o.titulo})`, 'operacao'); toast(`${fotos.length} foto${fotos.length > 1 ? 's' : ''} na OM`); }
      catch (e) { toast('Não foi possível salvar as fotos agora'); }
      delete FOTOS_OM[o.id]; depois();
    } });
}
// Nome de cada botão (o mesmo na janela e no "Mais").
function nomeBotao(o, a) {
  const souCli = ehClienteDa(o, ME);
  return { editar: o.status === 'devolvida' ? 'Corrigir e reenviar' : '✎ Editar', solicitar: 'Solicitar agora', aprovar: cliente() ? 'Aprovar e enviar ao cliente' : 'Aprovar', devolver: 'Devolver', enviar: o.status === 'recusada' ? 'Reenviar ao cliente' : 'Enviar ao cliente', recusar: souCli ? 'Não liberado' : 'Registrar que o cliente não liberou', obs: '+ Observação', ciente: 'OM gerada', desbloqueio: 'Marcar o desbloqueio', docs: 'Documentação', liberar: souCli ? 'Liberado' : o.clienteUid ? 'Registrar liberação (cliente liberou por fora)' : 'Registrar liberação', finalizar: 'Serviço terminado', cancelar: 'Cancelar a OM', apagar: 'Apagar' }[a] || a;
}
// A alternativa do passo principal, ao lado dele: aprovar ou devolver; para o cliente, liberar ou não.
const ALT = { aprovar: 'devolver', liberar: 'recusar', ciente: 'recusar' };
function abrir(id) {
  const o = achar(id); if (!o) return;
  const ac = acoesDe(o, ME); const x = tempos(o); const pz = prazoOm(o, cfg()); const dr = docsResumo(o); const souCli = ehClienteDa(o, ME);
  const pri = proximo(o, ME, ac); const alt = pri && ALT[pri] && ac.includes(ALT[pri]) && (ALT[pri] !== 'recusar' || souCli) ? ALT[pri] : null;
  const mais = ac.filter(a => a !== pri && a !== alt && a !== 'editar');
  const ed = ac.includes('editar') && pri !== 'editar';
  const bt = (a, cls) => `<button type="button" class="btn${cls}" data-act="omAcao" data-id="${esc(o.id)}" data-v="${a}">${esc(nomeBotao(o, a))}</button>`;
  const linha = (r, v) => (v ? `<div><dt>${esc(r)}</dt><dd>${v}</dd></div>` : '');
  const html = `${barra(o)}
    <p class="om-agora"><b>${esc(comQuem(o))}</b>${pz && pz.aberta ? ` · ${pz.fora ? '<span class="om-fora">fora do prazo</span>' : 'prazo: resta ' + esc(duracao(pz.resta) || '0 min')}` : ''}</p>
    ${pri || ed ? `<div class="row-gap om-passo">${pri ? bt(pri, ' pri') : ''}${alt ? bt(alt, '') : ''}${ed ? bt('editar', pri ? ' ghost om-ed' : '') : ''}</div>` : ''}
    ${['devolvida', 'recusada'].includes(o.status) && o.motivo ? `<p class="om-mot">${o.status === 'recusada' ? 'Não liberada' : 'Devolvida'}: ${esc(o.motivo)}</p>` : ''}
    <dl class="p-dados om-dados">
      ${linha('Nº OM no cliente', esc(o.numero || ''))}${linha('Área', esc(areaNome(o.area)))}${linha('Equipamento / local', esc([o.equip, o.local].filter(Boolean).join(' · ')))}
      ${linha('Tipo e prioridade', esc(`${TIPOS[o.tipo] || ''} · ${PRIORIDADES[o.prio] || ''}`))}${linha('Solicitante', esc(o.solNome || ''))}${linha('Data prevista', esc(dataBR(o.dPrev)))}
      ${linha('Tempo de bloqueio', x.bloqueio != null && x.bloqueio >= 0 ? `<b>${esc(duracao(x.bloqueio) || '0 min')}</b>` : '')}
      ${linha('Prazo do cliente', pz ? `${pz.horas} h · ${pz.fora ? etiqueta('Fora do prazo', 'critico') : pz.aberta ? 'resta ' + esc(duracao(pz.resta)) : 'no prazo'}` : '')}
      ${o.desc ? `<div class="dc-full"><dt>Detalhes</dt><dd>${esc(o.desc)}</dd></div>` : ''}
      ${o.obsFim ? `<div class="dc-full"><dt>Como ficou</dt><dd>${esc(o.obsFim)}</dd></div>` : ''}
      ${dr ? `<div class="dc-full"><dt>Documentação (${dr.prontos} de ${dr.total} pronta${dr.total === 1 ? '' : 's'})</dt><dd>${dr.total ? docsChips(o) : 'Nada a preparar'}</dd></div>` : ''}</dl>
    <details class="om-det"><summary>Todas as horas e o histórico</summary><dl class="p-dados om-dados">
      ${linha('Hora da solicitação', esc(horaBR(o.hSol)))}${linha('Aprovada', esc([horaBR(o.hAprov), o.aprovNome].filter(Boolean).join(' · ')))}${linha('Cliente', esc([o.cliente, o.contato].filter(Boolean).join(' · ')))}
      ${linha('Enviada ao cliente', esc(horaBR(o.hEnvio)))}${linha('OM gerada pelo cliente', esc([horaBR(o.hCiente), o.cienteNome].filter(Boolean).join(' · ')))}
      ${linha('Sala passou ao eletricista', esc(horaBR(o.hSala)))}${linha('Eletricista liberou', esc(horaBR(o.hEletr)))}
      ${linha('Hora da liberação', esc([horaBR(o.hLib), o.libNome ? `${o.libNome}${o.libCli ? ' (cliente)' : ' (registrada pelo técnico)'}` : ''].filter(Boolean).join(' · ')))}${linha('Avisou a sala que terminou', esc(horaBR(o.hFim)))}${linha('Sala desbloqueou', esc(horaBR(o.hDesb)))}
      ${o.hCanc && ['recusada', 'cancelada'].includes(o.status) ? linha(o.status === 'recusada' ? 'Não liberada em' : 'Cancelada em', esc([horaBR(o.hCanc), o.cancNome ? `${o.cancNome}${o.cancCli ? ' (cliente)' : o.status === 'recusada' ? ' (registrada pelo técnico)' : ''}` : ''].filter(Boolean).join(' · '))) : ''}
      ${linha('Espera até liberar', esc(duracao(x.espera)))}${linha('Execução', esc(duracao(x.execucao)))}
      ${o.motivo && o.status === 'cancelada' ? `<div class="dc-full"><dt>Motivo do cancelamento</dt><dd>${esc(o.motivo)}</dd></div>` : ''}</dl>
      ${(o.hist || []).length ? `<ol class="om-hist">${o.hist.map(p => `<li><b>${esc(STATUS[p.s] || PASSOS[p.s] || p.s)}</b> · ${esc(horaBR(p.em))}${p.nome ? ' · ' + esc(p.nome) : ''}${p.txt ? `<br><small>${esc(p.txt)}</small>` : ''}${p.obs ? `<span class="om-obs">${esc(p.obs)}</span>` : ''}</li>`).join('')}</ol>` : ''}</details>
    <p class="dc-sec">Fotos</p><div id="omFotos" class="om-fotos"></div>
    <details class="om-det om-mais"><summary>Mais ações</summary><div class="row-gap om-acoes">
      <button type="button" class="btn sm" data-act="omImprimir" data-id="${esc(o.id)}">${I.dl} Imprimir ou salvar em PDF</button>
      ${planejaOmU(ME, SK) ? `<button type="button" class="btn sm" data-act="omRepetir" data-id="${esc(o.id)}">Repetir esta OM</button>` : ''}
      ${mais.map(a => bt(a, ` sm${['cancelar', 'apagar', 'recusar'].includes(a) ? ' ghost' : ''}`)).join('')}</div></details>`;
  formSheet(o.titulo, `${o.numero ? 'OM ' + esc(o.numero) + ' · ' : ''}${esc(areaNome(o.area))} · ${esc(nomeSit(o))}`, html, 'Fechar', async () => {}, {});
  const f = document.getElementById('fSheet'); if (!f) return;
  const c = f.querySelector('[data-close]'); if (c) c.hidden = true;
  const s = f.querySelector('[type=submit]'); if (s) s.classList.remove('pri');
  // A janela não deixa o clique subir até a página: os botões das ações são ligados aqui.
  f.querySelectorAll('[data-act="omAcao"]').forEach(b => b.addEventListener('click', () => acoes.omAcao(b, b.dataset)));
  f.querySelectorAll('[data-act="omImprimir"]').forEach(b => b.addEventListener('click', () => imprimir(b.dataset.id)));
  f.querySelectorAll('[data-act="omRepetir"]').forEach(b => b.addEventListener('click', () => { document.getElementById('layer').innerHTML = ''; editar('', o); }));
  pintarFotosOm(o); carregarFotosOm(o.id).then(() => pintarFotosOm(o));
}

/* ---------- impressão (ou "Salvar como PDF" na janela de impressão) para enviar ao cliente ---------- */
function imprimir(id) {
  const o = achar(id); if (!o) return;
  // Fotos já lidas ao abrir a OM (sem esperar o servidor: o celular só imprime logo depois do toque).
  const fotos = (FOTOS_OM[id] || []).filter(f => f.thumb);
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
      ${lin('OM gerada pelo cliente', horaBR(o.hCiente))}${lin('Sala passou ao eletricista', horaBR(o.hSala))}${lin('Eletricista liberou', horaBR(o.hEletr))}
      ${x.bloqueio != null && x.bloqueio >= 0 ? lin('Tempo de bloqueio', duracao(x.bloqueio) || '0 min') : ''}
      ${lin('Hora da liberação', horaBR(o.hLib))}${lin('Avisou a sala que terminou', horaBR(o.hFim))}${lin('Sala desbloqueou', horaBR(o.hDesb))}
      ${lin('Documentação', docsTxt(o))}${o.hCanc && ['recusada', 'cancelada'].includes(o.status) ? lin(o.status === 'recusada' ? 'Não liberada em' : 'Cancelada em', [horaBR(o.hCanc), o.cancNome, o.cancCli ? '(cliente)' : ''].filter(Boolean).join(' ')) : ''}
      ${x.espera != null ? lin('Espera até liberar', duracao(x.espera)) : ''}${x.execucao != null ? lin('Execução', duracao(x.execucao)) : ''}
    </tbody></table>
    ${o.desc ? `<h3>Detalhes do serviço</h3><p class="omi-txt">${esc(o.desc)}</p>` : ''}
    ${o.motivo && ['recusada', 'cancelada', 'devolvida'].includes(o.status) ? `<h3>${o.status === 'recusada' ? 'Por que não liberou' : o.status === 'cancelada' ? 'Motivo do cancelamento' : 'O que corrigir'}</h3><p class="omi-txt">${esc(o.motivo)}</p>` : ''}
    ${o.obsFim ? `<h3>Como ficou</h3><p class="omi-txt">${esc(o.obsFim)}</p>` : ''}
    ${observacoes(o).length ? `<h3>Observações</h3><table class="omi-tab"><tbody>${observacoes(o).map(x => `<tr><th>${esc(horaBR(x.em))}<br><small>${esc(STATUS[x.s] || PASSOS[x.s] || x.s)}${x.nome ? ' · ' + esc(x.nome) : ''}</small></th><td>${esc(x.obs)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${fotos.length ? `<h3>Fotos</h3><div class="omi-fotos">${fotos.map(f => `<figure><img src="${f.thumb}" alt=""><figcaption>${esc(legFotoOm(f))}</figcaption></figure>`).join('')}</div>` : ''}
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
  const html = `<div class="p-form"><p class="muted small m0">Horas que o cliente tem para liberar a OM. É o mesmo relógio do tempo de bloqueio: conta da OM gerada até o eletricista liberar (enquanto o cliente não gera a OM, conta do envio). Passou do prazo, a OM fica vermelha e o cliente e o Técnico de Processo recebem aviso. Use 0 para não ter prazo. Vale para o Pátio e a Bateria.</p>
    <div class="dc-form">${Object.entries(PRIORIDADES).reverse().map(([k, n]) => `<label class="sel"><span>${esc(n)} (horas)</span><input class="in" type="number" inputmode="numeric" min="0" max="${PRAZO_MAX}" step="1" id="omPz_${k}" value="${pz[k]}"></label>`).join('')}</div></div>`;
  formSheet('Prazos do cliente', 'Por prioridade', html, 'Salvar', async () => {
    let y; try { y = conferirPrazos(Object.fromEntries(Object.keys(pz).map(k => [k, v$('omPz_' + k)]))); } catch (e) { focar(e); }
    await DB.omsPrazosSalvar(y);
    DB.log(`OMs: prazos do cliente ${Object.entries(y).map(([k, v]) => `${PRIORIDADES[k].toLowerCase()} ${v} h`).join(', ')}`, 'operacao'); toast('Prazos salvos'); render();
  });
}

// Como funciona: o caminho da OM, em passos curtos, para cada um.
function comoFunciona() {
  const p = (t, l) => `<p class="dc-sec">${t}</p><ol class="om-como">${l.map(x => `<li>${x}</li>`).join('')}</ol>`;
  const html = `<div class="p-form">${barra({ status: 'liberada', hSol: '1', hAprov: '1', hCiente: '1', hLib: '1' })}
    <p class="muted small m0">Toda OM mostra esta barra: os passos feitos ficam marcados e o passo atual em destaque. Na OM aberta, o botão grande é sempre o próximo passo de quem está olhando; o resto fica em <b>Mais ações</b>.</p>
    ${p('Líder da área', ['Toque em <b>Nova OM</b>: área, serviço e local (o local tem sugestões da área). Pode <b>solicitar agora</b> ou <b>planejar para uma data</b>.', 'Planejada: no dia, toque em <b>Solicitar agora</b>.', 'Devolvida: corrija o que o técnico pediu e reenvie.', 'Liberada: execute, avise a sala e toque em <b>Serviço terminado</b>. Quando a sala desbloquear, toque em <b>Marcar o desbloqueio</b> (ou marque as duas horas juntas).', 'Para repetir um serviço, abra a OM antiga e use <b>Mais ações › Repetir esta OM</b>.'])}
    ${p('Técnico de Processo', ['Confira a solicitação e toque em <b>Aprovar e enviar ao cliente</b> (ou <b>Devolver</b> com o que corrigir).', 'Não liberada pelo cliente: ajuste e toque em <b>Reenviar ao cliente</b>, ou cancele.', 'Preventivas que se repetem: cadastre uma vez e o sistema planeja as OMs das próximas 3 semanas sozinho.'])}
    ${p('Cliente', ['Toque em <b>OM gerada</b> quando gerar a OM (com o número) e passar à sala de controle. Aqui começa o tempo de bloqueio e o prazo.', 'Quando a sala avisar que o eletricista liberou, toque em <b>Liberado</b> e informe as horas que a sala passou. Se não der, <b>Não liberado</b> com o motivo.'])}
    <p class="muted small m0">Tempo de bloqueio e prazo do cliente são o mesmo relógio: da OM gerada até o eletricista liberar.</p></div>`;
  formSheet('Como funcionam as OMs', 'Do pedido ao desbloqueio', html, 'Entendi', async () => {}, {});
  const f = document.getElementById('fSheet'); const c = f && f.querySelector('[data-close]'); if (c) c.hidden = true;
}

/* ---------- preventivas que se repetem (contas/oms-recorrentes.js) ---------- */
const recBase = () => { if (DB.omsRecWatch) DB.omsRecWatch(SK); return (DB.cache.omsRec || {})[SK] || { d: {}, loaded: false }; };
const recs = () => Object.values(recBase().d || {}).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
const nRec = () => recs().filter(r => r.ativa !== false).length;
// Quem trata, ao abrir a tela: cria as OMs planejadas que faltam (até 3 semanas para a frente). Uma vez por vez que as
// preventivas mudam (a marca evita repetir a cada desenho da tela).
let gerando = false; const jaGerou = new Set();
function gerarPreventivas(todos) {
  const b = recBase(); if (!b.loaded || gerando || !trataOmU(ME, SK)) return;
  const hoje = today(); const marca = SK + '|' + hoje + '|' + recs().map(r => `${r.id}:${r.ate || ''}:${r.ativa}`).join(',');
  if (jaGerou.has(marca)) return; jaGerou.add(marca);
  const { oms, ate } = aCriar(recs(), Object.fromEntries(todos.map(o => [o.id, 1])), hoje, quem());
  const mudar = recs().filter(r => ate[r.id] && ate[r.id] !== r.ate);
  if (!oms.length && !mudar.length) return;
  gerando = true;
  setTimeout(async () => {
    try {
      const n = oms.length ? await DB.omCriarPlanejadas(SK, oms) : 0;
      for (const r of mudar) await DB.omRecSalvar(r.id, SK, { ate: ate[r.id] });
      if (n) { DB.log(`OMs: ${n} preventiva${n > 1 ? 's' : ''} planejada${n > 1 ? 's' : ''} sozinha${n > 1 ? 's' : ''} (que se repetem)`, 'operacao'); toast(`${n} OM${n > 1 ? 's' : ''} preventiva${n > 1 ? 's' : ''} planejada${n > 1 ? 's' : ''} na agenda`); }
    } finally { gerando = false; render(); }
  }, 0);
}
// OMs planejadas (ainda não pedidas) que esta preventiva criou daqui para a frente.
const futurasDa = (rid, hoje) => lista().filter(o => o.id.startsWith(`R${rid}_`) && o.status === 'planejada' && o.dPrev >= hoje);
function listaRecorrentes() {
  const hoje = today(); const L = recs();
  const html = `<div class="p-form"><p class="muted small m0">Cadastre uma vez o serviço que se repete. O sistema põe na agenda, como <b>Planejada</b>, as OMs das próximas 3 semanas; no dia, o líder solicita como qualquer outra.</p>
    ${L.length ? `<div class="tr-lista">${L.map(r => { const px = proximaData(r, hoje); return `<button type="button" class="tr-it${r.ativa === false ? ' fechada' : ''}" data-orid="${esc(r.id)}"><span class="tr-it-s">${etiqueta(r.ativa === false ? 'Pausada' : 'Ativa', r.ativa === false ? 'neutro' : 'ok')}</span><span class="tr-it-t"><b>${esc(r.titulo)}</b><small>${esc([freqTxt(r), areaNome(r.area), [r.equip, r.local].filter(Boolean).join(' · '), px ? 'próxima ' + dataBR(px) : ''].filter(Boolean).join(' · '))}</small></span></button>`; }).join('')}</div>` : '<p class="muted small m0">Nenhuma ainda.</p>'}
    <div class="row-gap"><button type="button" class="btn pri" data-ornova="1">${I.plus} Nova preventiva que se repete</button></div></div>`;
  formSheet('Preventivas que se repetem', esc(conjNome()), html, 'Fechar', async () => {}, {});
  const f = document.getElementById('fSheet'); if (!f) return;
  const c = f.querySelector('[data-close]'); if (c) c.hidden = true;
  const s = f.querySelector('[type=submit]'); if (s) s.classList.remove('pri');
  f.querySelectorAll('[data-orid]').forEach(b => b.addEventListener('click', () => editarRecorrente(b.dataset.orid)));
  f.querySelectorAll('[data-ornova]').forEach(b => b.addEventListener('click', () => editarRecorrente('')));
}
function editarRecorrente(id) {
  const r = id ? recBase().d[id] : null; if (id && !r) return;
  const areas = SETS[SK] ? [...SETS[SK].areas, ...(SETS[SK].gerais || [])] : [];
  const x = r || { area: '', local: '', equip: '', titulo: '', desc: '', prio: 'media', freq: 'semana', dias: [], dia: 1, inicio: today(), ativa: true };
  const html = `<div class="dc-form">
    <label class="sel dc-full"><span>Serviço ${ob}</span><input class="in" id="orTit" maxlength="${LIMITES.titulo}" value="${esc(x.titulo)}" placeholder="Ex.: Lubrificar mancais da correia 2" autocomplete="off"></label>
    <label class="sel"><span>Área ${ob}</span><select class="in" id="orArea"><option value="">Escolha</option>${op(areas.map(a => [a, areaNome(a)]), x.area)}</select></label>
    <label class="sel"><span>Local ${ob}</span><input class="in" id="orLocal" list="orLocais" maxlength="${LIMITES.local}" value="${esc(x.local)}" autocomplete="off"></label>
    <label class="sel"><span>Equipamento (TAG)</span><input class="in" id="orEquip" list="orEquips" maxlength="${LIMITES.equip}" value="${esc(x.equip)}" autocomplete="off"></label>
    <datalist id="orLocais">${opcoes(locaisDe(x.area))}</datalist><datalist id="orEquips">${opcoes(equipsDe(x.area))}</datalist>
    <label class="sel"><span>Prioridade</span><select class="in" id="orPrio">${op(Object.entries(PRIORIDADES), x.prio)}</select></label>
    <label class="sel"><span>Repete</span><select class="in" id="orFreq">${op(Object.entries(FREQ), x.freq)}</select></label>
    <fieldset class="om-docf dc-full" id="orDiasF" ${x.freq === 'mes' ? 'hidden' : ''}><legend>Dias da semana ${ob}</legend><div class="row-gap">${DIAS_SEM.map((d, i) => `<label class="om-dsem"><input type="checkbox" id="orD${i}" ${(x.dias || []).includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div></fieldset>
    <label class="sel" id="orDiaL" ${x.freq === 'mes' ? '' : 'hidden'}><span>Dia do mês (1 a 28) ${ob}</span><input class="in" type="number" inputmode="numeric" min="1" max="28" id="orDia" value="${esc(String(x.dia || 1))}"></label>
    <label class="sel"><span>A partir de ${ob}</span><input class="in" type="date" id="orIni" value="${esc(x.inicio)}"></label>
    <label class="sel"><span>Situação</span><select class="in" id="orAtiva">${op([['1', 'Ativa'], ['0', 'Pausada (não planeja mais)']], x.ativa === false ? '0' : '1')}</select></label>
    <label class="sel dc-full"><span>Detalhes</span><textarea class="in" id="orDesc" rows="2" maxlength="${LIMITES.desc}">${esc(x.desc || '')}</textarea></label>
    <p class="muted small m0 dc-full">As OMs das próximas 3 semanas entram na agenda como Planejadas (tipo Preventiva). Ao mudar ou apagar, as planejadas que esta preventiva já criou e que não valem mais saem da agenda.</p>
    ${r ? '<div class="row-gap dc-full"><button type="button" class="btn sm ghost" id="orApagar">Apagar esta preventiva</button></div>' : ''}</div>`;
  formSheet(r ? 'Editar preventiva que se repete' : 'Nova preventiva que se repete', esc(conjNome()), html, 'Salvar', async () => {
    let y; try { y = conferirRecorrente({ area: v$('orArea'), local: v$('orLocal'), equip: v$('orEquip'), titulo: v$('orTit'), desc: v$('orDesc'), prio: v$('orPrio'), freq: v$('orFreq'), dias: DIAS_SEM.map((d, i) => (document.getElementById('orD' + i) || {}).checked ? i : -1).filter(i => i >= 0), dia: v$('orDia'), inicio: v$('orIni'), ativa: v$('orAtiva') !== '0' }); } catch (e) { focar(e); }
    const rid = r ? r.id : DB.omRecNovoId();
    // Recomeça a contar de hoje (o "ate" volta para vazio): as datas novas entram já; as que já existem não se repetem.
    await DB.omRecSalvar(rid, SK, { ...y, ate: '' }, !r);
    if (r) await tirarFuturas(rid, y.ativa ? new Set(datasDa({ ...y }, today(), add(today(), HORIZONTE))) : new Set());
    DB.log(`OMs: preventiva que se repete ${r ? 'alterada' : 'cadastrada'} (${y.titulo}, ${freqTxt(y).toLowerCase()})`, 'operacao'); toast('Preventiva salva'); jaGerou.clear(); render();
  }, { cancelarTxt: 'Voltar', aoCancelar: () => setTimeout(listaRecorrentes, 0) });
  const f = document.getElementById('fSheet'); if (!f) return;
  const fr = document.getElementById('orFreq');
  if (fr) fr.addEventListener('change', () => { const mes = fr.value === 'mes'; const a = document.getElementById('orDiasF'), b = document.getElementById('orDiaL'); if (a) a.hidden = mes; if (b) b.hidden = !mes; });
  const ap = document.getElementById('orApagar');
  if (ap) ap.addEventListener('click', async () => {
    if (ap.dataset.certo !== '1') { ap.dataset.certo = '1'; ap.textContent = 'Apagar mesmo? (toque de novo)'; return; }
    ap.disabled = true; await DB.omRecApagar(r.id, SK); await tirarFuturas(r.id, new Set());
    DB.log(`OMs: preventiva que se repete apagada (${r.titulo})`, 'operacao'); toast('Preventiva apagada'); document.getElementById('layer').innerHTML = ''; render();
  });
}
// Tira da agenda as planejadas futuras desta preventiva que não estão mais nas datas (manter = datas que continuam).
async function tirarFuturas(rid, manter) {
  for (const o of futurasDa(rid, today())) if (!manter.has(o.dPrev)) { try { await DB.omApagar(o.id, SK); } catch (e) { /* segue */ } }
}

// Programação da semana mostrada (com a área escolhida no topo).
const progDados = () => { const u = U(); const l = u.area ? lista().filter(o => o.area === u.area) : lista(); return [l, weekOf(u.dia), { hoje: today(), cfg: cfg(), onde: conjNome(), area: u.area, areaNome }]; };
acoes.omProg = () => imprimirProgramacao(...progDados());
acoes.omProgXls = () => excelProgramacao(...progDados());
acoes.omNova = () => editar('');
acoes.omComo = () => comoFunciona();
acoes.omRec = () => listaRecorrentes();
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
  // Nova OM: trocar a área troca as sugestões de local e equipamento.
  if (e.target && (e.target.id === 'omArea' || e.target.id === 'orArea')) {
    const dl = document.getElementById(e.target.id === 'omArea' ? 'omLocais' : 'orLocais'); if (dl) dl.innerHTML = opcoes(locaisDe(e.target.value));
    const de = document.getElementById(e.target.id === 'omArea' ? 'omEquips' : 'orEquips'); if (de) de.innerHTML = opcoes(equipsDe(e.target.value));
  }
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
