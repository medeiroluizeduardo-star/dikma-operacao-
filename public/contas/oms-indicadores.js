// Indicadores › OMs: os números das solicitações de OM para acompanhar o serviço e deixar o cliente informado e preparado.
// Contas sem tela (a tela fica em telas/oms-indicadores.js; os testes, em testes/oms.test.mjs).
// O mês (ym = 'AAAA-MM') conta cada coisa pela data em que aconteceu:
// - Aderência à programação: das OMs previstas para o mês até hoje (data prevista; sem as canceladas), quantas já foram finalizadas.
//   As de dias que ainda não chegaram não contam, para o número do mês corrente não começar baixo.
// - Liberadas no prazo: das liberadas no mês, quantas o cliente liberou dentro do prazo da prioridade (do envio à liberação).
// - Recusas e cancelamentos do cliente: quantas vezes no mês o cliente recusou ou cancelou, sobre os envios do mês.
// - Documentação pronta: das enviadas ao cliente no mês com a lista de documentos, quantas estão com tudo pronto.
import { PRIORIDADES, ABERTAS, prazoOm, minutosEntre, docsResumo, diaDe, visaoMes, prazosDe } from './oms.js';
import { add } from './cal.js';

const noMes = (s, ym) => typeof s === 'string' && s.startsWith(ym);
const media = v => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
const pct = (n, d) => (d ? Math.round(n / d * 100) : null);
const hist = o => (Array.isArray(o.hist) ? o.hist.filter(p => p && typeof p.em === 'string') : []);
// Recusa ou cancelamento feito pelo cliente (ou registrado pelo técnico em nome dele), com o motivo limpo.
const PREFIXO = /^(registrada pelo técnico: |pelo cliente: )/;
function doCliente(o) {
  const l = [];
  for (const p of hist(o)) {
    if (p.s === 'recusada') l.push({ tipo: 'recusa', em: p.em, motivo: String(p.txt || '').replace(PREFIXO, '') });
    else if (p.s === 'cancelada' && /^pelo cliente: /.test(String(p.txt || ''))) l.push({ tipo: 'cancelamento', em: p.em, motivo: String(p.txt || '').replace(PREFIXO, '') });
  }
  // OM antiga sem a linha no histórico: vale o que está na própria OM.
  if (!l.length && o.status === 'cancelada' && o.cancCli && o.hCanc) l.push({ tipo: 'cancelamento', em: o.hCanc, motivo: o.motivo || '' });
  return l;
}
// Envios ao cliente (o reenvio depois de uma recusa conta de novo).
function envios(o) {
  const l = hist(o).filter(p => p.s === 'enviada').map(p => p.em);
  return l.length ? l : o.hEnvio ? [o.hEnvio] : [];
}

// Números de uma lista de OMs no mês.
export function numerosOms(l, ym, hoje, cfg = null) {
  const v = visaoMes(l.filter(o => diaDe(o) <= hoje), ym, hoje);
  // Liberação: as liberadas no mês, dentro ou fora do prazo do cliente (as prioridades sem prazo ficam fora do %).
  const lib = l.filter(o => noMes(o.hLib, ym));
  const comPrazo = lib.map(o => prazoOm(o, cfg)).filter(Boolean);
  const noPrazo = comPrazo.filter(p => !p.fora).length;
  const resp = lib.map(o => minutosEntre(o.hEnvio, o.hLib)).filter(m => m != null && m >= 0);
  // Cliente: envios, recusas e cancelamentos do mês.
  const nEnvios = l.reduce((n, o) => n + envios(o).filter(e => noMes(e, ym)).length, 0);
  const eventos = l.flatMap(o => doCliente(o).filter(e => noMes(e.em, ym)).map(e => ({ ...e, id: o.id, titulo: o.titulo || '', area: o.area || '', conj: o.conj || '' })));
  // Documentação das enviadas ao cliente no mês (as antigas, sem a lista, não entram).
  const docs = l.filter(o => envios(o).some(e => noMes(e, ym))).map(docsResumo).filter(Boolean);
  return {
    previstas: v.previstas, finalizadas: v.finalizadas, atrasadas: v.atrasadas, aderencia: v.aderencia,
    liberadas: lib.length, comPrazo: comPrazo.length, noPrazo, pctPrazo: pct(noPrazo, comPrazo.length), respMedia: media(resp),
    envios: nEnvios, recusas: eventos.filter(e => e.tipo === 'recusa').length, cancelamentos: eventos.filter(e => e.tipo === 'cancelamento').length,
    doCliente: eventos.length, pctCliente: pct(eventos.length, nEnvios), eventos: eventos.sort((a, b) => b.em.localeCompare(a.em)),
    comDocs: docs.length, docsProntos: docs.filter(r => r.completa).length, pctDocs: pct(docs.filter(r => r.completa).length, docs.length)
  };
}

// Do planejado ao finalizado: as OMs da agenda do mês (pela data prevista) e até onde cada uma chegou.
export function caminhoOms(l, ym) {
  const m = l.filter(o => noMes(diaDe(o), ym));
  const chegou = k => m.filter(o => o[k]).length;
  return [
    ['Na agenda do mês', m.length], ['Solicitadas', chegou('hSol')], ['Enviadas ao cliente', chegou('hEnvio')],
    ['Liberadas', chegou('hLib')], ['Finalizadas', m.filter(o => o.status === 'finalizada').length], ['Canceladas', m.filter(o => o.status === 'cancelada').length]
  ];
}

// Tempos médios (em minutos) dos passos que terminaram no mês.
export function temposOms(l, ym) {
  const t = (a, b) => media(l.filter(o => noMes(o[b], ym)).map(o => minutosEntre(o[a], o[b])).filter(x => x != null && x >= 0));
  return [
    ['Solicitação até a aprovação do técnico', t('hSol', 'hAprov')], ['Envio até a liberação do cliente', t('hEnvio', 'hLib')],
    ['Liberação até a finalização', t('hLib', 'hFim')], ['Da solicitação à finalização', t('hSol', 'hFim')]
  ];
}

// Próximos dias (hoje e os 6 seguintes): o que vem por aí para o cliente se preparar, com a documentação de cada OM.
export function proximasOms(l, hoje, dias = 7) {
  const fim = add(hoje, dias - 1);
  const ord = { emergencia: 0, alta: 1, media: 2, baixa: 3 };
  return l.filter(o => ABERTAS.includes(o.status) && o.status !== 'liberada' && diaDe(o) >= hoje && diaDe(o) <= fim)
    .sort((a, b) => diaDe(a).localeCompare(diaDe(b)) || ord[a.prio || 'media'] - ord[b.prio || 'media']);
}

// Painel completo: números do mês, do mês anterior (variação), os 6 meses para a tendência, por área e por prioridade.
export function painelOms(l, { ym, meses = [ym], hoje, cfg = null, anterior = '' }) {
  const atual = numerosOms(l, ym, hoje, cfg);
  const ant = anterior ? numerosOms(l, anterior, hoje, cfg) : null;
  const serie = meses.map(m => (m === ym ? atual : numerosOms(l, m, hoje, cfg)));
  const areas = [...new Set(l.filter(o => noMes(diaDe(o), ym) || noMes(o.hLib, ym) || doCliente(o).some(e => noMes(e.em, ym))).map(o => o.area || ''))];
  const porArea = areas.map(a => ({ area: a, ...numerosOms(l.filter(o => (o.area || '') === a), ym, hoje, cfg) }))
    .sort((x, y) => y.previstas - x.previstas || String(x.area).localeCompare(String(y.area)));
  const pz = prazosDe(cfg);
  const porPrio = Object.keys(PRIORIDADES).reverse().map(k => ({ prio: k, prazo: pz[k], ...numerosOms(l.filter(o => (o.prio || 'media') === k), ym, hoje, cfg) }))
    .filter(x => x.previstas || x.liberadas || x.envios);
  return { atual, ant, serie, porArea, porPrio, caminho: caminhoOms(l, ym), tempos: temposOms(l, ym), proximas: proximasOms(l, hoje) };
}
// Faixas das porcentagens (as mesmas da Execução): 90% ou mais ok, 70% ou mais atenção, abaixo crítico.
export const faixaPct = p => (p == null ? '' : p >= 90 ? 'ok' : p >= 70 ? 'atencao' : 'critico');
