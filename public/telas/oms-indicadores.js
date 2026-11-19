// Indicadores › OMs: aderência à programação, liberação no prazo do cliente, recusas e cancelamentos e documentação pronta,
// mais o que vem nos próximos 7 dias, o caminho do planejado ao finalizado, os tempos médios e os números por área e prioridade.
// Só leitura. As contas ficam em contas/oms-indicadores.js; os dados são os de Operação › OMs (oms/{id}, uma escuta por conjunto).
import { painelOms, faixaPct } from '../contas/oms-indicadores.js';
import { PRIORIDADES, STATUS, COR, duracao, dataBR, docsResumo, diaDe, linhasExcel } from '../contas/oms.js';
import { registrarExcel } from '../ui/indicadores-acoes.js';
import { AREA_S, SETS, MESES_L, DAYS, today, addMonth, pd } from '../contas/cal.js';
import { conjsInd, areasInd } from '../contas/acessos.js';
import { indicadores, variacao, etiqueta, tabela, vazio, carregando, recolhido } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { render } from '../ui/shell.js';

const HOJE = today();
const MES_HOJE = HOJE.slice(0, 7);
const U = () => (UI.oi ||= { mes: MES_HOJE, vista: 'coq' });
const mesNome = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
const mesCurto = ym => MESES_L[+ym.slice(5, 7) - 1].slice(0, 3);
const areaNome = a => AREA_S[a] || a || 'Sem área';
const cfg = () => (DB.cache.omsCfg || {}).d || null;

// Conjuntos que a pessoa vê nos Indicadores e a vista escolhida (Coqueria = Pátio + Bateria).
const conjs = () => conjsInd(ME);
function vista() {
  const u = U(); const cs = conjs();
  if (cs.length < 2) u.vista = cs[0] || 'coq';
  else if (u.vista !== 'coq' && !cs.includes(u.vista)) u.vista = 'coq';
  return u.vista;
}
const daVista = () => { const v = vista(); return v === 'coq' ? conjs() : [v]; };
// As OMs da vista; quem vê só a própria área nos Indicadores vê só as OMs dela.
function dados() {
  const cs = daVista(); let ok = true; const l = [];
  for (const k of cs) { if (DB.omsWatch) DB.omsWatch(k); const b = (DB.cache.oms || {})[k]; if (!b || !b.loaded) ok = false; else l.push(...Object.values(b.d || {})); }
  const lim = areasInd(ME);
  return { ok, l: lim.length ? l.filter(o => lim.includes(o.area)) : l, lim };
}

const cartao = (titulo, sub, corpo) => `<section class="card sgp-card"><header><h2>${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</header><div class="body">${corpo}</div></section>`;
const pe = (...l) => l.filter(Boolean).map(x => `<span>${x}</span>`).join('');
const pctTxt = p => (p == null ? '—' : String(p));
const barras = l => { const mx = Math.max(1, ...l.map(x => x[1])); return `<div class="bars">${l.map(([n, v]) => `<div class="barrow qzbar"><span class="n">${esc(n)}</span><div class="stack"><i style="width:${v / mx * 100}%;background:var(--marca)"></i></div><span class="p num">${v}</span></div>`).join('')}</div>`; };
const diaNome = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${dataBR(d)}`;

function vPainel() {
  const u = U(); const { ok, l, lim } = dados();
  if (!ok) return carregando();
  const meses = []; for (let i = 5; i >= 0; i--) meses.push(addMonth(u.mes, -i));
  const p = painelOms(l, { ym: u.mes, meses, hoje: HOJE, cfg: cfg(), anterior: addMonth(u.mes, -1) });
  const a = p.atual, b = p.ant || {};
  const serie = k => p.serie.map(x => x[k]);
  const onde = [vista() === 'coq' ? 'Coqueria (Pátio e Bateria)' : SETS[vista()].nome, lim.length ? 'só a sua área' : ''].filter(Boolean).join(' · ');
  let h = `<p class="muted small m0">Contas de ${esc(mesNome(u.mes))} · ${esc(onde)}</p>`;
  h += indicadores([
    { rotulo: 'Aderência à programação', valor: pctTxt(a.aderencia), unidade: a.aderencia == null ? '' : '%', situacao: faixaPct(a.aderencia), serie: serie('aderencia'),
      variacao: variacao(a.aderencia, b.aderencia, { unidade: ' p.p.' }) + pe(a.previstas ? `${a.finalizadas} de ${a.previstas} previstas${u.mes === MES_HOJE ? ' até hoje' : ''} finalizadas` : 'nenhuma OM prevista até hoje', a.atrasadas ? `<b class="sgp-c">${a.atrasadas} atrasada${a.atrasadas > 1 ? 's' : ''}</b>` : '') },
    { rotulo: 'Liberadas no prazo do cliente', valor: pctTxt(a.pctPrazo), unidade: a.pctPrazo == null ? '' : '%', situacao: faixaPct(a.pctPrazo), serie: serie('pctPrazo'),
      variacao: variacao(a.pctPrazo, b.pctPrazo, { unidade: ' p.p.' }) + pe(a.comPrazo ? `${a.noPrazo} de ${a.comPrazo} liberadas` : 'nenhuma liberada no mês', a.respMedia != null ? `média ${duracao(a.respMedia)} até liberar` : '') },
    { rotulo: 'Recusas e cancelamentos do cliente', valor: String(a.doCliente), situacao: a.doCliente ? 'atencao' : a.envios ? 'ok' : '', serie: serie('doCliente'),
      variacao: variacao(a.doCliente, b.doCliente, { maiorMelhor: false }) + pe(a.envios ? `${pctTxt(a.pctCliente)}% dos ${a.envios} envio${a.envios > 1 ? 's' : ''}` : 'nenhum envio no mês', a.doCliente ? `${a.recusas} recusa${a.recusas === 1 ? '' : 's'} · ${a.cancelamentos} cancelamento${a.cancelamentos === 1 ? '' : 's'}` : '') },
    { rotulo: 'Documentação pronta', valor: pctTxt(a.pctDocs), unidade: a.pctDocs == null ? '' : '%', situacao: faixaPct(a.pctDocs), serie: serie('pctDocs'),
      variacao: pe(a.comDocs ? `${a.docsProntos} de ${a.comDocs} enviadas com tudo pronto` : 'nenhuma enviada com a lista', 'PT, APR, bloqueio…') }
  ]);
  // O que vem por aí: para o cliente se preparar (documentação, bloqueios, acompanhamento).
  const px = p.proximas;
  const pend = px.filter(o => { const r = docsResumo(o); return r && !r.completa; }).length;
  h += cartao('Próximos 7 dias', px.length ? `${px.length} OM${px.length > 1 ? 's' : ''} prevista${px.length > 1 ? 's' : ''}${pend ? ` · ${pend} com documentação pendente` : ''}` : 'Para o cliente se preparar',
    px.length ? tabela([{ t: 'Dia' }, { t: 'Serviço' }, { t: 'Área' }, { t: 'Prioridade' }, { t: 'Situação' }, { t: 'Documentação' }],
      px.slice(0, 15).map(o => { const r = docsResumo(o); return [
        `<span class="nowrap">${esc(diaNome(diaDe(o)))}</span>`, `<b>${esc(o.titulo || '')}</b>${o.equip || o.local ? `<br><small class="muted">${esc([o.equip, o.local].filter(Boolean).join(' · '))}</small>` : ''}`,
        esc(areaNome(o.area)), o.prio && o.prio !== 'media' ? etiqueta(PRIORIDADES[o.prio] || o.prio, ['alta', 'emergencia'].includes(o.prio) ? 'critico' : 'neutro') : esc(PRIORIDADES.media),
        etiqueta(STATUS[o.status] || o.status, COR[o.status]), !r ? '<span class="muted">—</span>' : r.completa ? etiqueta(r.total ? 'Pronta' : 'Não precisa', 'ok') : etiqueta(`${r.prontos} de ${r.total}`, 'atencao')]; }), { rotulo: 'OMs dos próximos 7 dias' })
      + (px.length > 15 ? `<p class="muted small sgp-nota">E mais ${px.length - 15}. A lista completa fica em Operação › Solicitações de OM.</p>` : '')
      : vazio('Nada previsto para os próximos 7 dias', 'As OMs planejadas e solicitadas com data prevista aparecem aqui.'));
  // Caminho do mês e tempos médios, lado a lado na tela larga.
  const cam = p.caminho;
  h += `<div class="grid2 sgp-g">${cartao('Do planejado ao finalizado', `${mesNome(u.mes)} · OMs com data prevista no mês`, cam[0][1] ? barras(cam) : vazio('Nenhuma OM prevista no mês'))}
    ${cartao('Tempos médios', `${mesNome(u.mes)} · passos concluídos no mês`, `<div class="bars">${p.tempos.map(([n, m]) => `<div class="barrow qzbar"><span class="n">${esc(n)}</span><span></span><span class="p num">${m == null ? '<span class="muted">—</span>' : esc(duracao(m) || '0 min')}</span></div>`).join('')}</div>`)}</div>`;
  // Por área e por prioridade.
  const etqN = (n, s) => (n ? etiqueta(String(n), s) : '<span class="muted">0</span>');
  const pc = x => (x == null ? '<span class="muted">—</span>' : etiqueta(x + '%', faixaPct(x)));
  h += cartao('Por área', `${mesNome(u.mes)}`, p.porArea.length
    ? tabela([{ t: 'Área' }, { t: u.mes === MES_HOJE ? 'Previstas até hoje' : 'Previstas', n: true }, { t: 'Finalizadas', n: true }, { t: 'Aderência', n: true }, { t: 'Atrasadas', n: true }, { t: 'No prazo do cliente', n: true }, { t: 'Recusas e cancel.', n: true }],
      p.porArea.map(x => [`<b>${esc(areaNome(x.area))}</b>`, x.previstas, x.finalizadas, pc(x.aderencia), etqN(x.atrasadas, 'critico'), pc(x.pctPrazo), etqN(x.doCliente, 'atencao')]), { rotulo: 'OMs por área' })
    : vazio('Nenhuma OM no mês', 'As áreas aparecem aqui quando houver OMs.'));
  h += cartao('Por prioridade', 'Prazo do cliente para liberar, contado do envio', p.porPrio.length
    ? tabela([{ t: 'Prioridade' }, { t: 'Prazo', n: true }, { t: u.mes === MES_HOJE ? 'Previstas até hoje' : 'Previstas', n: true }, { t: 'Liberadas', n: true }, { t: 'No prazo', n: true }, { t: 'Média até liberar', n: true }],
      p.porPrio.map(x => [`<b>${esc(PRIORIDADES[x.prio])}</b>`, x.prazo ? `${x.prazo} h` : '<span class="muted">sem prazo</span>', x.previstas, x.liberadas, pc(x.pctPrazo), x.respMedia == null ? '<span class="muted">—</span>' : esc(duracao(x.respMedia) || '0 min')]), { rotulo: 'OMs por prioridade' })
    : vazio('Nenhuma OM no mês'));
  // Motivos: o que o cliente apontou (para corrigir antes do próximo envio).
  h += recolhido(`Recusas e cancelamentos do cliente · ${mesNome(u.mes)} (${a.eventos.length})`, a.eventos.length
    ? `<ul class="sgp-rep">${a.eventos.map(e => `<li><span><b>${esc(e.titulo)}</b><br><small class="muted">${esc(e.motivo || 'sem motivo')}</small></span><small class="muted">${esc(areaNome(e.area))} · ${esc(dataBR(e.em.slice(0, 10)))}</small>${etiqueta(e.tipo === 'recusa' ? 'Recusa' : 'Cancelamento', e.tipo === 'recusa' ? 'critico' : 'neutro')}</li>`).join('')}</ul>`
    : '<p class="muted small m0">Nenhuma recusa ou cancelamento do cliente no mês.</p>', a.eventos.length > 0 && a.eventos.length <= 5);
  // Evolução dos 6 meses em números (a tendência dos cartões, por extenso).
  h += recolhido('Últimos 6 meses', tabela([{ t: 'Mês' }, { t: 'Previstas', n: true }, { t: 'Aderência', n: true }, { t: 'No prazo do cliente', n: true }, { t: 'Recusas e cancel.', n: true }, { t: 'Documentação pronta', n: true }],
    p.serie.map((x, i) => [`<b>${esc(mesCurto(meses[i]))}/${meses[i].slice(2, 4)}</b>`, x.previstas, pc(x.aderencia), pc(x.pctPrazo), x.doCliente, pc(x.pctDocs)]), { rotulo: 'OMs nos últimos 6 meses' }));
  return `<div class="sgp">${h}</div>`;
}

export function topo() {
  const u = U(); const cs = conjs(); const v = vista();
  const ops = []; for (let i = 0; i < 13; i++) ops.push(addMonth(MES_HOJE, -i));
  const sw = cs.length > 1 ? `<div class="seg setsw ic-sw" role="tablist" aria-label="Conjunto">${[['coq', 'Coqueria'], ...cs.map(k => [k, SETS[k].curto])].map(([k, t]) => `<button type="button" role="tab" data-act="oiVista" data-v="${k}" aria-selected="${v === k}">${esc(t)}</button>`).join('')}</div>` : '';
  return sw + `<label class="sel"><span>Mês</span><select class="in" id="oiMes">${ops.map(m => `<option value="${m}" ${m === u.mes ? 'selected' : ''}>${esc(mesNome(m))}</option>`).join('')}</select></label>`;
}
export const renderView = () => vPainel();
// Exportar para o Excel: além dos quadros da tela, a lista das OMs do mês (previstas, solicitadas ou finalizadas nele).
registrarExcel('ompainel', () => {
  const { ok, l } = dados(); if (!ok) return [];
  const ym = U().mes; const doMes = l.filter(o => [diaDe(o), o.hSol, o.hFim].some(x => String(x || '').startsWith(ym)));
  return [{ nome: 'OMs do mês', linhas: linhasExcel(doMes, areaNome, cfg()) }];
});

acoes.oiVista = (t, d) => { U().vista = d.v; salvarUI(); render(); };
document.addEventListener('change', e => { if (e.target && e.target.id === 'oiMes') { U().mes = e.target.value; salvarUI(); render(); } });
