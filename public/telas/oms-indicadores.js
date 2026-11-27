// Indicadores › OMs: aderência à programação, liberação no prazo do cliente, recusas e cancelamentos e documentação pronta,
// mais o que vem nos próximos 7 dias, o caminho do planejado ao finalizado, os tempos médios e os números por área e prioridade.
// Só leitura. As contas ficam em contas/oms-indicadores.js; os dados são os de Operação › OMs (oms/{id}, uma escuta por conjunto).
import { painelOms, faixaPct, faixa, porDiaOms, porSemanaOms } from '../contas/oms-indicadores.js';
import { PRIORIDADES, STATUS, COR, duracao, dataBR, docsResumo, diaDe, linhasExcel } from '../contas/oms.js';
import { registrarRelatorio, agoraTxt } from '../ui/indicadores-acoes.js';
import { AREA_S, SETS, MESES_L, DAYS, today, addMonth, pd, add, weekOf } from '../contas/cal.js';
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
// Coqueria = Pátio + Bateria (a Sinter tem a vista própria).
const coq = () => conjs().filter(k => k === 'patio' || k === 'bateria');
function vista() {
  const u = U(); const cs = conjs();
  if (cs.length < 2) u.vista = cs[0] || 'coq';
  else if (!coq().length && !cs.includes(u.vista)) u.vista = cs[0];
  else if (u.vista !== 'coq' && !cs.includes(u.vista)) u.vista = coq().length ? 'coq' : cs[0];
  return u.vista;
}
const daVista = () => { const v = vista(); return v === 'coq' ? coq() : [v]; };
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
    // O número que o cliente mais acompanha: da OM gerada até o eletricista avisar a sala que liberou.
    { rotulo: 'Tempo de bloqueio', valor: a.bloqMedia == null ? '—' : esc(duracao(a.bloqMedia) || '0 min'), situacao: '', serie: serie('bloqMedia'),
      variacao: variacao(a.bloqMedia, b.bloqMedia, { maiorMelhor: false, unidade: ' min' }) + pe(a.bloqueios ? `média de ${a.bloqueios} OM${a.bloqueios > 1 ? 's' : ''}` : 'nenhum bloqueio registrado no mês', 'OM gerada até o eletricista liberar') },
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
  const sw = cs.length > 1 ? `<div class="seg setsw ic-sw" role="tablist" aria-label="Conjunto">${[...(coq().length ? [['coq', 'Coqueria']] : []), ...cs.map(k => [k, SETS[k].curto])].map(([k, t]) => `<button type="button" role="tab" data-act="oiVista" data-v="${k}" aria-selected="${v === k}">${esc(t)}</button>`).join('')}</div>` : '';
  return sw + `<label class="sel"><span>Mês</span><select class="in" id="oiMes">${ops.map(m => `<option value="${m}" ${m === u.mes ? 'selected' : ''}>${esc(mesNome(m))}</option>`).join('')}</select></label>`;
}
export const renderView = () => vPainel();
// Relatório para os gerentes ("Imprimir resumo" e "Exportar para o Excel"): os mesmos números da tela, em tabelas, com os
// gráficos no Excel. Antes, a pessoa escolhe o período: o dia, a semana (segunda a domingo) ou o mês.
// No Excel, a aba da lista (OMs do dia, da semana ou do mês) traz o resumo por mês, por semana e por dia e, embaixo,
// a lista completa com as colunas Dia, Semana e Mês, com filtro para ver um dia ou uma semana só.
// Minutos em horas sem arredondar: o Excel mostra 0,0 h e o papel volta a "14h 40" igual à tela (ui/excel-relatorio.js › fmtTexto).
const horas = m => (m == null ? null : m / 60);
const ddmmaa = d => `${dataBR(d)}/${d.slice(0, 4)}`;
const semanaTxt = (ini, fim) => (ini === fim ? ddmmaa(ini) : `${dataBR(ini)} a ${ddmmaa(fim)}`);
const diaLongo = d => `${diaNome(d)}/${d.slice(0, 4)}`;
// Período escolhido: faixa de datas, nomes e o período anterior (para o caso de um dia ou uma semana).
function periodoOM(per) {
  if (!per || per.tipo === 'mes') {
    const ym = per ? per.data.slice(0, 7) : U().mes; const f = faixa(ym);
    return { tipo: 'mes', ym, f, nome: mesNome(ym), papel: 'RESUMO DO MÊS · OMS', aba: 'OMs do mês', rot: `Mês: ${mesNome(ym)}`, curto: mesNome(ym) };
  }
  if (per.tipo === 'semana') {
    const ini = weekOf(per.data); const f = { ini, fim: add(ini, 6) };
    return { tipo: 'semana', ym: ini.slice(0, 7), f, nome: `semana de ${semanaTxt(f.ini, f.fim)}`, papel: 'RESUMO DA SEMANA · OMS', aba: 'OMs da semana', rot: `Semana: ${semanaTxt(f.ini, f.fim)}`, curto: `Semana ${dataBR(f.ini)} a ${dataBR(f.fim)}` };
  }
  const d = per.data;
  return { tipo: 'dia', ym: d.slice(0, 7), f: { ini: d, fim: d }, nome: diaLongo(d), papel: 'RESUMO DO DIA · OMS', aba: 'OMs do dia', rot: `Dia: ${diaLongo(d)}`, curto: `Dia ${dataBR(d)}` };
}
// Colunas dos resumos por período (mês, semana, dia), as mesmas no papel e no Excel.
const COLS_PER = prev => [{ t: prev, fmt: 'int' }, { t: 'Finalizadas', fmt: 'int' }, { t: 'Aderência', fmt: 'pct' }, { t: 'Atrasadas', fmt: 'int' }, { t: 'Liberadas', fmt: 'int' }, { t: 'No prazo do cliente', fmt: 'pct' }, { t: 'Recusas e cancel.', fmt: 'int' }, { t: 'Tempo de bloqueio', fmt: 'h' }];
const linhaPer = x => [x.previstas, x.finalizadas, x.aderencia, x.atrasadas, x.liberadas, x.pctPrazo, x.doCliente, horas(x.bloqMedia)];
function relatorioOM(per) {
  const { ok, l, lim } = dados(); if (!ok) return null;
  const P = periodoOM(per); const f = P.f; const ehMes = P.tipo === 'mes';
  const meses = []; for (let i = 5; i >= 0; i--) meses.push(addMonth(P.ym, -i));
  const p = painelOms(l, { ym: ehMes ? P.ym : f, meses: ehMes ? meses : [], hoje: HOJE, cfg: cfg() });
  const a = p.atual; const ateHoje = f.ini <= HOJE && HOJE <= f.fim;
  const onde = vista() === 'coq' ? 'Coqueria (Pátio e Bateria)' : SETS[vista()].nome;
  const prev = ateHoje ? 'Previstas até hoje' : 'Previstas';
  const noPer = 'no ' + (P.tipo === 'mes' ? 'mês' : P.tipo === 'semana' ? 'período' : 'dia');
  const docTxt = o => { const r = docsResumo(o); return !r ? '—' : r.completa ? (r.total ? 'Pronta' : 'Não precisa') : `${r.prontos} de ${r.total}`; };
  // As OMs do período: previstas, solicitadas ou finalizadas nele.
  const dentro = x => { const d = String(x || '').slice(0, 10); return !!d && d >= f.ini && d <= f.fim; };
  const doPer = l.filter(o => [diaDe(o), o.hSol, o.hFim].some(dentro));
  const ref = o => [diaDe(o), String(o.hSol || '').slice(0, 10), String(o.hFim || '').slice(0, 10)].find(dentro) || diaDe(o);
  // Em ordem de dia; cada linha do Excel começa com o dia, a semana e o mês (para o filtro).
  const ordem = [...doPer].sort((x, y) => ref(x).localeCompare(ref(y)) || String(x.hSol || '').localeCompare(String(y.hSol || '')));
  const cabLista = linhasExcel([], areaNome, cfg())[0];
  const linhasLista = ordem.map(o => { const d = ref(o); const s = weekOf(d); return [diaLongo(d), semanaTxt(s, add(s, 6)), mesNome(d.slice(0, 7)), ...linhasExcel([o], areaNome, cfg())[1]]; });
  // Resumos por período.
  const semanas = P.tipo === 'dia' ? [] : porSemanaOms(l, f, HOJE, cfg());
  const dias = P.tipo === 'dia' ? [] : porDiaOms(l, f, HOJE, cfg(), { todos: P.tipo === 'semana' });
  const tabelas = [];
  const tPer = (id, titulo, sub, col0, linhas, extra = {}) => tabelas.push({ id, titulo, sub, cols: [{ t: col0 }, ...COLS_PER(prev)], linhas, vazio: `Nenhuma OM ${noPer}.`, ...extra });
  if (P.tipo === 'semana') tPer('dias', 'Dia a dia', P.curto, 'Dia', dias.map(x => [diaNome(x.dia), ...linhaPer(x)]), { total: ['Semana', ...linhaPer(a)] });
  if (ehMes) tPer('semanas', 'Por semana', `${P.nome} · semanas de segunda a domingo (só os dias do mês contam)`, 'Semana', semanas.map(x => [semanaTxt(x.ini, x.fim), ...linhaPer(x)]), { total: ['Mês', ...linhaPer(a)] });
  tabelas.push(
    { id: 'area', titulo: 'Por área', sub: P.curto,
      cols: [{ t: 'Área' }, { t: prev, fmt: 'int' }, { t: 'Finalizadas', fmt: 'int' }, { t: 'Aderência', fmt: 'pct' }, { t: 'Atrasadas', fmt: 'int' }, { t: 'No prazo do cliente', fmt: 'pct' }, { t: 'Recusas e cancel.', fmt: 'int' }],
      linhas: p.porArea.map(x => [areaNome(x.area), x.previstas, x.finalizadas, x.aderencia, x.atrasadas, x.pctPrazo, x.doCliente]),
      total: ['Total', a.previstas, a.finalizadas, a.aderencia, a.atrasadas, a.pctPrazo, a.doCliente], vazio: `Nenhuma OM ${noPer}.` },
    { id: 'prio', titulo: 'Por prioridade', sub: 'Prazo do cliente para liberar, contado do envio',
      cols: [{ t: 'Prioridade' }, { t: 'Prazo do cliente' }, { t: prev, fmt: 'int' }, { t: 'Liberadas', fmt: 'int' }, { t: 'No prazo', fmt: 'pct' }, { t: 'Média até liberar', fmt: 'h' }],
      linhas: p.porPrio.map(x => [PRIORIDADES[x.prio], x.prazo ? `${x.prazo} h` : 'sem prazo', x.previstas, x.liberadas, x.pctPrazo, horas(x.respMedia)]), vazio: `Nenhuma OM ${noPer}.` },
    { id: 'caminho', titulo: 'Do planejado ao finalizado', sub: `OMs com data prevista ${noPer}`, meia: true,
      cols: [{ t: 'Etapa' }, { t: 'OMs', fmt: 'int' }], linhas: p.caminho[0][1] ? p.caminho.map(([n, v]) => [n === 'Na agenda do mês' ? 'Na agenda' : n, v]) : [], vazio: `Nenhuma OM prevista ${noPer}.` },
    { id: 'tempos', titulo: 'Tempos médios', sub: `Passos concluídos ${noPer}`, meia: true,
      cols: [{ t: 'Passo' }, { t: 'Média', fmt: 'h' }], linhas: p.tempos.map(([n, m]) => [n, horas(m)]) });
  if (ehMes) tabelas.push({ id: 'meses', titulo: 'Últimos 6 meses',
    cols: [{ t: 'Mês' }, { t: 'Previstas', fmt: 'int' }, { t: 'Aderência', fmt: 'pct' }, { t: 'No prazo do cliente', fmt: 'pct' }, { t: 'Recusas e cancel.', fmt: 'int' }, { t: 'Documentação pronta', fmt: 'pct' }],
    linhas: p.serie.map((x, i) => [`${mesCurto(meses[i])}/${meses[i].slice(2, 4)}`, x.previstas, x.aderencia, x.pctPrazo, x.doCliente, x.pctDocs]) });
  // No papel do dia e da semana: as OMs do período, em poucas colunas (o mês fica só no Excel, a lista é longa).
  if (!ehMes) tabelas.push({ id: 'omsper', titulo: P.tipo === 'dia' ? 'OMs do dia' : 'OMs da semana', sub: 'Previstas, solicitadas ou finalizadas no período', excel: false,
    cols: [{ t: 'Dia' }, { t: 'Nº OM' }, { t: 'Serviço' }, { t: 'Área' }, { t: 'Prioridade' }, { t: 'Situação' }, { t: 'Documentação' }],
    linhas: ordem.map(o => [diaNome(ref(o)), o.numero || '', [o.titulo, [o.equip, o.local].filter(Boolean).join(' · ')].filter(Boolean).join(' — '), areaNome(o.area), PRIORIDADES[o.prio || 'media'] || '', STATUS[o.status] || o.status, docTxt(o)]), vazio: `Nenhuma OM ${noPer}.` });
  if (ehMes || ateHoje) tabelas.push({ id: 'prox', titulo: 'Próximos 7 dias', sub: 'Para o cliente se preparar (documentação, bloqueios, acompanhamento)', aba: 'Próximos 7 dias', lista: true,
    cols: [{ t: 'Dia' }, { t: 'Serviço' }, { t: 'Equipamento ou local' }, { t: 'Área' }, { t: 'Prioridade' }, { t: 'Situação' }, { t: 'Documentação' }],
    linhas: p.proximas.map(o => [diaNome(diaDe(o)), o.titulo || '', [o.equip, o.local].filter(Boolean).join(' · '), areaNome(o.area), PRIORIDADES[o.prio || 'media'] || '', STATUS[o.status] || o.status, docTxt(o)]), vazio: 'Nada previsto para os próximos 7 dias.' });
  tabelas.push({ id: 'eventos', titulo: 'Recusas e cancelamentos do cliente', sub: P.curto, aba: 'Recusas e cancelamentos', lista: true,
    cols: [{ t: 'Data' }, { t: 'Serviço' }, { t: 'Área' }, { t: 'Tipo' }, { t: 'Motivo' }],
    linhas: a.eventos.map(e => [ddmmaa(e.em.slice(0, 10)), e.titulo, areaNome(e.area), e.tipo === 'recusa' ? 'Recusa' : 'Cancelamento', e.motivo || 'sem motivo']), vazio: `Nenhuma recusa ou cancelamento do cliente ${noPer}.` });
  // Aba da lista no Excel: resumo por mês, por semana e por dia e, embaixo, todas as OMs com filtro por dia, semana e mês.
  const ab = P.aba;
  tabelas.push({ id: 'xmes', titulo: 'Por mês', sub: P.tipo === 'mes' ? P.nome : `Só os dias ${P.tipo === 'dia' ? 'do dia escolhido' : 'da semana'}`, aba: ab, papel: false, cols: [{ t: 'Mês' }, ...COLS_PER(prev)], linhas: [[mesNome(P.ym) + (ehMes ? '' : ` (${P.curto.toLowerCase()})`), ...linhaPer(a)]] });
  if (!ehMes || semanas.length) tabelas.push({ id: 'xsem', titulo: 'Por semana', sub: 'Segunda a domingo (só os dias do período contam)', aba: ab, papel: false, cols: [{ t: 'Semana' }, ...COLS_PER(prev)],
    linhas: (P.tipo === 'dia' ? [{ ini: f.ini, fim: f.fim, ...a }] : semanas).map(x => [semanaTxt(x.ini, x.fim), ...linhaPer(x)]) });
  tabelas.push({ id: 'xdia', titulo: 'Por dia', sub: P.tipo === 'mes' ? 'Os dias com OM prevista, liberada, enviada ou recusada' : '', aba: ab, papel: false, cols: [{ t: 'Dia' }, ...COLS_PER(prev)],
    linhas: (P.tipo === 'dia' ? [{ dia: f.ini, ...a }] : dias).map(x => [diaNome(x.dia) + '/' + x.dia.slice(0, 4), ...linhaPer(x)]), vazio: `Nenhuma OM ${noPer}.` });
  tabelas.push({ id: 'lista', titulo: P.aba, sub: 'Previstas, solicitadas ou finalizadas no período · use o filtro nas colunas Dia, Semana ou Mês', aba: ab, lista: true, filtro: true, papel: false,
    cols: ['Dia', 'Semana', 'Mês', ...cabLista].map(t => ({ t })), linhas: linhasLista });
  const graficos = ehMes ? [
    { tipo: 'linha', titulo: 'Aderência e prazo do cliente (6 meses)', tabela: 'meses', series: [2, 3] },
    { tipo: 'coluna', titulo: 'Previstas e finalizadas por semana', tabela: 'semanas', series: [1, 2] },
    { tipo: 'coluna', titulo: 'Previstas e finalizadas por área', tabela: 'area', series: [1, 2], max: 10 },
    { tipo: 'barra', titulo: 'Do planejado ao finalizado', tabela: 'caminho', series: [1] }
  ] : [
    ...(P.tipo === 'semana' ? [{ tipo: 'coluna', titulo: 'Previstas e finalizadas por dia', tabela: 'dias', series: [1, 2] }] : []),
    { tipo: 'coluna', titulo: 'Previstas e finalizadas por área', tabela: 'area', series: [1, 2], max: 10 },
    { tipo: 'barra', titulo: 'Do planejado ao finalizado', tabela: 'caminho', series: [1] }
  ];
  return {
    titulo: `Indicadores das OMs · ${P.curto}`, papel: P.papel, arquivo: [vista() === 'coq' ? 'Coqueria' : SETS[vista()].curto, P.curto],
    meta: [onde + (lim.length ? ' (só a sua área)' : ''), P.rot, `Gerado em: ${agoraTxt()}`],
    kpis: [
      { rot: 'Tempo de bloqueio', v: horas(a.bloqMedia), fmt: 'h', det: a.bloqueios ? `Média de ${a.bloqueios} OM${a.bloqueios > 1 ? 's' : ''}: da OM gerada pelo cliente até o eletricista liberar (${duracao(a.bloqMedia) || '0 min'})` : `Nenhum bloqueio registrado ${noPer}` },
      { rot: 'Aderência à programação', v: a.aderencia, fmt: 'pct', det: a.previstas ? `${a.finalizadas} de ${a.previstas} previstas${ateHoje ? ' até hoje' : ''} finalizadas${a.atrasadas ? ` · ${a.atrasadas} atrasada${a.atrasadas > 1 ? 's' : ''}` : ''}` : 'Nenhuma OM prevista' },
      { rot: prev, v: a.previstas, fmt: 'int', det: `${a.atrasadas} atrasada${a.atrasadas === 1 ? '' : 's'}` },
      { rot: 'Finalizadas', v: a.finalizadas, fmt: 'int', det: `das previstas ${noPer}` },
      { rot: 'Liberadas no prazo do cliente', v: a.pctPrazo, fmt: 'pct', det: a.comPrazo ? `${a.noPrazo} de ${a.comPrazo} liberadas${a.respMedia != null ? ` · média ${duracao(a.respMedia)} até liberar` : ''}` : `Nenhuma liberada ${noPer}` },
      { rot: 'Recusas e cancelamentos do cliente', v: a.doCliente, fmt: 'int', det: a.envios ? `${pctTxt(a.pctCliente)}% dos ${a.envios} envio${a.envios > 1 ? 's' : ''} · ${a.recusas} recusa${a.recusas === 1 ? '' : 's'} e ${a.cancelamentos} cancelamento${a.cancelamentos === 1 ? '' : 's'}` : `Nenhum envio ${noPer}` },
      { rot: 'Documentação pronta', v: a.pctDocs, fmt: 'pct', det: a.comDocs ? `${a.docsProntos} de ${a.comDocs} enviadas com tudo pronto (PT, APR, bloqueio...)` : 'Nenhuma enviada com a lista' }
    ],
    tabelas, graficos
  };
}
// Período sugerido na janela: o mês escolhido no topo (hoje, se for o mês corrente; senão, o dia 1 dele).
registrarRelatorio('ompainel', relatorioOM, { periodo: () => ({ tipo: 'mes', data: U().mes === MES_HOJE ? HOJE : U().mes + '-01' }) });

acoes.oiVista = (t, d) => { U().vista = d.v; salvarUI(); render(); };
document.addEventListener('change', e => { if (e.target && e.target.id === 'oiMes') { U().mes = e.target.value; salvarUI(); render(); } });
