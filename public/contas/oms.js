// Operação › OMs: solicitação de ordem de manutenção, do líder ao cliente. Contas sem tela.
// Caminho: a OM pode nascer como plano ("Planejada", com a data prevista), cadastrada pelo líder ou pelo técnico, e no dia
// vira solicitação com um toque. O líder (ou supervisor, coordenador, gestor) abre a solicitação → o Técnico de Processo aprova ou devolve →
// envia ao cliente → registra a liberação → quem executou (líder da área ou o técnico) finaliza.
// Usado pela tela (telas/oms.js), pelos testes (testes/oms.test.mjs) e pela rotina dos avisos no celular.
import { perfilDe, ehAdminU, escoposDe, areasDoCadastro } from './acessos.js';
import { add, weekOf } from './cal.js';

export const STATUS = {
  planejada: 'Planejada', solicitada: 'Aguardando técnico', devolvida: 'Devolvida', aprovada: 'Aprovada', enviada: 'Com o cliente',
  liberada: 'Liberada', finalizada: 'Finalizada', cancelada: 'Cancelada'
};
// Situação do selo na lista (ui/padrao.js › etiqueta).
export const COR = { planejada: 'neutro', solicitada: 'atencao', devolvida: 'critico', aprovada: 'info', enviada: 'info', liberada: 'atencao', finalizada: 'ok', cancelada: 'neutro' };
export const ABERTAS = ['planejada', 'solicitada', 'devolvida', 'aprovada', 'enviada', 'liberada'];
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', emergencia: 'Emergência' };
export const TIPOS = { corretiva: 'Corretiva', preventiva: 'Preventiva', melhoria: 'Melhoria', seguranca: 'Segurança' };
// Documentação de cada OM (não obrigatória: só mostra o que está pronto). Cada item: pronto, pendente ou não precisa.
export const DOCS = { pt: 'PT', apr: 'APR', bloq: 'Bloqueio', isol: 'Isolamento', acomp: 'Acompanhamento do cliente' };
export const DOC_SIT = { pend: 'Pendente', ok: 'Pronto', na: 'Não precisa' };
// Prazo de resposta do cliente, em horas, por prioridade (contado de "enviada ao cliente" até a liberação).
// Os números são só a sugestão inicial: o administrador muda na tela (config/oms.prazos). 0 = sem prazo.
export const PRAZO_PADRAO = { emergencia: 2, alta: 24, media: 48, baixa: 120 };
export const PRAZO_MAX = 720;
// Nomes das linhas do histórico que não são situação.
export const PASSOS = { ciente: 'Ciente do cliente' };
export const LIMITES = { titulo: 200, local: 120, equip: 80, desc: 1000, motivo: 400, numero: 40, obs: 600, hist: 60, cliente: 120, contato: 120 };

/* ---------- quem faz o quê ---------- */
// Quem abre: líder, supervisor, coordenador e gestor da Operação no conjunto (líder e supervisor só nas áreas deles).
const ABRE = ['lider', 'supervisor', 'coordenador', 'gestor'];
// Quem trata (aprova, devolve, envia ao cliente, registra a liberação): o Técnico de Processo, o coordenador e o
// gestor da Operação no conjunto, e o administrador.
const TRATA = ['tecnico', 'coordenador', 'gestor'];
const noConj = (u, conj) => escoposDe(u).includes(conj);
export const veOmsU = (u, conj) => !!u && u.papel !== 'bloqueado' && (ehAdminU(u) || (!!perfilDe(u, 'operacao') && noConj(u, conj)));
export const trataOmU = (u, conj) => !!u && u.papel !== 'bloqueado' && (ehAdminU(u) || (TRATA.includes(perfilDe(u, 'operacao')) && noConj(u, conj)));
// Áreas em que a pessoa abre (null = todas do conjunto).
export function areasQueAbre(u, conj) {
  if (!u || u.papel === 'bloqueado') return [];
  if (ehAdminU(u)) return null;
  const p = perfilDe(u, 'operacao'); if (!ABRE.includes(p) || !noConj(u, conj)) return [];
  return ['gestor', 'coordenador'].includes(p) ? null : areasDoCadastro(u, p === 'supervisor');
}
export const abreOmU = (u, conj, area) => { const l = areasQueAbre(u, conj); return l === null || (Array.isArray(l) && (area ? l.includes(area) : l.length > 0)); };
// Quem planeja (cadastra a OM com a data prevista): quem abre e também quem trata (o Técnico de Processo planeja
// em todas as áreas do conjunto, mas não abre a solicitação em nome do líder).
export const planejaOmU = (u, conj, area) => abreOmU(u, conj, area) || trataOmU(u, conj);
export const areasQuePlaneja = (u, conj) => (trataOmU(u, conj) ? null : areasQueAbre(u, conj));

// O que esta pessoa pode fazer nesta OM agora (botões da tela; as regras do banco conferem o mesmo).
// O cliente da OM (o usuário que a recebeu do técnico) toca em Ciente e em Liberar.
export const ehClienteDa = (om, u) => !!u && u.papel !== 'bloqueado' && !!om.clienteUid && om.clienteUid === u.uid;
export function acoesDe(om, u) {
  const trata = trataOmU(u, om.conj); const dono = !!u && om.solPor === u.uid;
  const daArea = abreOmU(u, om.conj, om.area); const cli = ehClienteDa(om, u);
  const a = [];
  // O cliente vem primeiro: a liberação é dele; o técnico registra só se o cliente liberou por fora.
  if (cli && om.status === 'enviada') { if (!om.hCiente) a.push('ciente'); a.push('liberar'); }
  if ((dono || trata) && ['planejada', 'solicitada', 'devolvida'].includes(om.status)) a.push('editar');
  // No dia (ou antes), a planejada vira solicitação: quem cadastrou, quem trata ou o líder da área.
  if ((dono || trata || daArea) && om.status === 'planejada') a.push('solicitar');
  if (trata && om.status === 'solicitada') a.push('aprovar', 'devolver');
  if (trata && om.status === 'aprovada') a.push('enviar');
  if (trata && om.status === 'enviada' && !a.includes('liberar')) a.push('liberar');
  if ((trata || daArea) && om.status === 'liberada') a.push('finalizar');
  if ((dono && ['planejada', 'solicitada', 'devolvida'].includes(om.status)) || (trata && ABERTAS.includes(om.status))) a.push('cancelar');
  // Apagar de vez (aberta por engano, repetida): quem trata no conjunto e o administrador, em qualquer situação.
  // Documentação (PT, APR, bloqueio…): quem trata e o líder da área, enquanto a OM está aberta.
  if ((trata || daArea) && ABERTAS.includes(om.status)) a.push('docs');
  if (trata) a.push('apagar');
  return a;
}

/* ---------- datas e horas ---------- */
const pad = n => String(n).padStart(2, '0');
// 'AAAA-MM-DDTHH:MM' na hora local (o que o campo datetime-local usa).
export const agoraLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const ehHora = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);
const min = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 6e4;
// Minutos entre duas horas (null se faltar alguma).
export const minutosEntre = (a, b) => (ehHora(a) && ehHora(b) ? min(b) - min(a) : null);
export function duracao(m) {
  if (m == null || m < 0) return '';
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = Math.round(m % 60);
  return d ? `${d}d ${h}h` : h ? `${h}h${mm ? ' ' + pad(mm) : ''}` : `${mm} min`;
}
export const ehData = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s);
export const dataBR = s => (ehData(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
export const horaBR = s => (ehHora(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '');
// Tempos da OM: espera até liberar (solicitação → liberação) e execução (liberação → finalização).
export const tempos = om => ({ espera: minutosEntre(om.hSol, om.hLib), execucao: minutosEntre(om.hLib, om.hFim), total: minutosEntre(om.hSol, om.hFim) });

/* ---------- conferência e mudanças ---------- */
const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const erro = (m, campo) => { const e = new Error(m); e.campo = campo; throw e; };
// Dados da solicitação (abrir ou corrigir). areasOk = áreas que a pessoa pode escolher (null = todas).
// planejar = a OM é só um plano (pede a data prevista; a hora da solicitação fica para o dia em que for pedida).
export function conferirSolicitacao(x, areasOk = null, planejar = false) {
  const y = {
    area: t(x.area, 40), local: t(x.local, LIMITES.local), equip: t(x.equip, LIMITES.equip), titulo: t(x.titulo, LIMITES.titulo),
    desc: t(x.desc, LIMITES.desc), tipo: TIPOS[x.tipo] ? x.tipo : 'corretiva', prio: PRIORIDADES[x.prio] ? x.prio : 'media', hSol: planejar ? '' : ehHora(x.hSol) ? x.hSol : '',
    dPrev: ehData(x.dPrev) ? x.dPrev : ''
  };
  if (!y.area) erro('Escolha a área.', 'omArea');
  if (areasOk && !areasOk.includes(y.area)) erro('Você só abre OM nas áreas que lidera.', 'omArea');
  if (!y.titulo || y.titulo.length < 5) erro('Diga em poucas palavras o serviço (mínimo 5 letras).', 'omTit');
  if (!y.local) erro('Informe o equipamento ou o local.', 'omLocal');
  if (planejar && !y.dPrev) erro('Informe a data prevista do serviço.', 'omDPrev');
  if (!planejar && !y.hSol) erro('Informe a hora da solicitação.', 'omHSol');
  // Sem data prevista, a solicitação fica prevista para o dia em que foi pedida.
  if (!y.dPrev) y.dPrev = y.hSol.slice(0, 10);
  return y;
}
// Documentação: só os itens conhecidos, cada um pronto, pendente ou não precisa (o que vier diferente fica pendente).
export const conferirDocs = x => Object.fromEntries(Object.keys(DOCS).map(k => [k, DOC_SIT[x && x[k]] ? x[k] : 'pend']));
// Itens que entram na conta (os "não precisa" saem) e quantos estão prontos. null = OM sem a lista (as antigas).
export function docsResumo(om) {
  const d = om && om.docs; if (!d || typeof d !== 'object' || !Object.keys(d).length) return null;
  const itens = Object.keys(DOCS).filter(k => d[k] !== 'na').map(k => ({ k, nome: DOCS[k], ok: d[k] === 'ok' }));
  return { itens, prontos: itens.filter(i => i.ok).length, total: itens.length, completa: itens.every(i => i.ok) };
}
// Prazos do administrador sobre os padrões. Cada um em horas inteiras, de 0 (sem prazo) a 720 (30 dias).
export const prazosDe = cfg => {
  const p = (cfg && cfg.prazos) || {}; const r = { ...PRAZO_PADRAO };
  for (const k of Object.keys(PRAZO_PADRAO)) if (Number.isInteger(p[k]) && p[k] >= 0 && p[k] <= PRAZO_MAX) r[k] = p[k];
  return r;
};
export function conferirPrazos(x) {
  const r = {};
  for (const k of Object.keys(PRAZO_PADRAO)) {
    const v = String(x && x[k] != null ? x[k] : '').trim().replace(',', '.'); const n = Number(v);
    if (v === '' || !Number.isInteger(n) || n < 0 || n > PRAZO_MAX) erro(`Prazo da prioridade ${PRIORIDADES[k].toLowerCase()}: use horas inteiras de 0 a ${PRAZO_MAX} (0 = sem prazo).`, 'omPz_' + k);
    r[k] = n;
  }
  return r;
}
// Prazo de resposta da OM com o cliente: conta da hora do envio até a liberação (ou até agora, se ainda está com ele).
// null quando a OM não foi enviada ou a prioridade está sem prazo.
export function prazoOm(om, cfg, agora = agoraLocal()) {
  if (!om || !ehHora(om.hEnvio) || !['enviada', 'liberada', 'finalizada'].includes(om.status)) return null;
  const horas = prazosDe(cfg)[om.prio || 'media']; if (!horas) return null;
  const ate = om.status === 'enviada' ? agora : om.hLib; const usado = minutosEntre(om.hEnvio, ate); if (usado == null) return null;
  return { horas, usado, resta: horas * 60 - usado, fora: usado > horas * 60, aberta: om.status === 'enviada' };
}
// Com o cliente e já passou do prazo (fica vermelha na tela e gera aviso).
export const foraDoPrazo = (om, cfg, agora) => { const p = prazoOm(om, cfg, agora); return !!(p && p.aberta && p.fora); };
// Linha do histórico da OM.
export const passo = (s, quem, txt = '', em = agoraLocal()) => ({ s, em, por: quem.uid || '', nome: quem.nome || '', ...(txt ? { txt: t(txt, LIMITES.motivo) } : {}) });
const comHist = (om, linha) => [...(om.hist || []), linha].slice(-LIMITES.hist);
// Mudança de situação: devolve só os campos que mudam (para gravar). d = dados digitados na janela.
export function mudar(om, acao, quem, d = {}) {
  const ag = agoraLocal();
  switch (acao) {
    case 'solicitar': {
      const h = ehHora(d.hSol) ? d.hSol : ag;
      return { status: 'solicitada', hSol: h, hist: comHist(om, passo('solicitada', quem, om.dPrev ? 'planejada para ' + dataBR(om.dPrev) : '', h)) };
    }
    case 'reenviar': return { status: 'solicitada', motivo: '', hist: comHist(om, passo('solicitada', quem, 'corrigida e reenviada', ag)) };
    case 'aprovar': return { status: 'aprovada', hAprov: ag, aprovPor: quem.uid, aprovNome: quem.nome || '', hist: comHist(om, passo('aprovada', quem, d.obs, ag)) };
    case 'devolver': {
      const m = t(d.motivo, LIMITES.motivo); if (m.length < 5) erro('Diga o que precisa corrigir (mínimo 5 letras).', 'omMotivo');
      return { status: 'devolvida', motivo: m, hist: comHist(om, passo('devolvida', quem, m, ag)) };
    }
    case 'enviar': {
      const h = ehHora(d.hEnvio) ? d.hEnvio : ag;
      const c = d.cliente || {}; const cliente = t(c.nome, LIMITES.cliente), contato = t(d.contato, LIMITES.contato), numero = t(d.numero, LIMITES.numero);
      if (!c.uid || cliente.length < 2) erro('O cliente deste conjunto ainda não foi definido. O administrador escolhe o usuário do cliente no topo da tela.', 'omCli');
      const txt = ['para ' + cliente, contato, numero ? 'OM ' + numero : ''].filter(Boolean).join(' · ');
      return { status: 'enviada', hEnvio: h, numero, cliente, clienteUid: c.uid, contato, hist: comHist(om, passo('enviada', quem, txt, h)) };
    }
    case 'ciente': return { hCiente: ag, cienteNome: t(quem.nome, 150), hist: comHist(om, passo('ciente', quem, '', ag)) };
    case 'liberar': {
      // O cliente libera pelo sistema: vale a hora do toque (a real). O técnico registra a hora que o cliente informou.
      const cli = !!d.peloCliente; const h = cli ? ag : d.hLib;
      if (!ehHora(h)) erro('Informe a hora da liberação.', 'omHLib');
      if (om.hSol && h < om.hSol) erro('A liberação não pode ser antes da solicitação.', 'omHLib');
      const ciente = cli && !om.hCiente ? { hCiente: h, cienteNome: t(quem.nome, 150) } : {};
      return { status: 'liberada', hLib: h, libNome: t(quem.nome, 150), libCli: cli, ...ciente, ...(d.numero ? { numero: t(d.numero, LIMITES.numero) } : {}), hist: comHist(om, passo('liberada', quem, cli ? 'liberada pelo cliente' : 'registrada pelo técnico', h)) };
    }
    case 'finalizar': {
      if (!ehHora(d.hFim)) erro('Informe a hora da finalização.', 'omHFim');
      if (om.hLib && d.hFim < om.hLib) erro('A finalização não pode ser antes da liberação.', 'omHFim');
      return { status: 'finalizada', hFim: d.hFim, obsFim: t(d.obs, LIMITES.obs), hist: comHist(om, passo('finalizada', quem, d.obs, d.hFim)) };
    }
    case 'cancelar': {
      const m = t(d.motivo, LIMITES.motivo); if (m.length < 5) erro('Diga o motivo do cancelamento (mínimo 5 letras).', 'omMotivo');
      return { status: 'cancelada', motivo: m, hist: comHist(om, passo('cancelada', quem, m, ag)) };
    }
    default: throw new Error('Ação desconhecida');
  }
}

/* ---------- lista ---------- */
const ORDEM = { devolvida: 0, solicitada: 1, aprovada: 2, enviada: 3, liberada: 4, planejada: 5, finalizada: 6, cancelada: 7 };
const PRIO_ORD = { emergencia: 0, alta: 1, media: 2, baixa: 3 };
export const ordenar = l => [...l].sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || String(b.hSol || '').localeCompare(String(a.hSol || '')));
// f = { status: '' | 'abertas' | um status, area, q, mes ('AAAA-MM', para finalizadas e canceladas) }
export function filtrar(l, f = {}) {
  const q = String(f.q || '').toLowerCase().trim();
  return ordenar(l.filter(o => (!f.status || (f.status === 'abertas' ? ABERTAS.includes(o.status) : o.status === f.status))
    && (!f.area || o.area === f.area)
    && (!f.mes || ABERTAS.includes(o.status) || String(o.hFim || o.hSol || o.dPrev || '').startsWith(f.mes))
    && (!q || [o.numero, o.titulo, o.local, o.equip, o.desc, o.solNome, o.area, o.cliente, o.contato, STATUS[o.status]].join(' ').toLowerCase().includes(q))));
}
// Contagens dos cartões. mes = 'AAAA-MM' (finalizadas e tempo médio do mês).
export function resumo(l, mes) {
  const r = { planejada: 0, solicitada: 0, devolvida: 0, aprovada: 0, enviada: 0, liberada: 0, finalizadasMes: 0, esperaMedia: null, execMedia: null };
  const esp = [], exe = [];
  for (const o of l) {
    if (r[o.status] != null) r[o.status]++;
    if (o.status === 'finalizada' && String(o.hFim || '').startsWith(mes)) {
      r.finalizadasMes++; const x = tempos(o);
      if (x.espera != null && x.espera >= 0) esp.push(x.espera); if (x.execucao != null && x.execucao >= 0) exe.push(x.execucao);
    }
  }
  const m = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  r.esperaMedia = m(esp); r.execMedia = m(exe); r.comCliente = r.aprovada + r.enviada;
  return r;
}
/* ---------- planejamento: Hoje, Semana e Mês ---------- */
// Dia da OM na agenda: a data prevista; nas antigas (sem data prevista), o dia da solicitação.
export const diaDe = o => (ehData(o.dPrev) ? o.dPrev : String(o.hSol || '').slice(0, 10));
// Atrasada: ainda aberta e a data prevista já passou.
export const atrasada = (o, hoje) => ABERTAS.includes(o.status) && !!diaDe(o) && diaDe(o) < hoje;
// Hoje: o que pedir (planejadas até hoje), o que está com o cliente, as liberadas e as atrasadas; a lista do dia
// traz tudo o que pede atenção, das atrasadas para as de mais prioridade (planejadas de dias seguintes ficam de fora).
export function visaoHoje(l, hoje, cfg = null, agora = agoraLocal()) {
  const pedir = l.filter(o => o.status === 'planejada' && diaDe(o) <= hoje);
  const cli = l.filter(o => ['aprovada', 'enviada'].includes(o.status));
  const lib = l.filter(o => o.status === 'liberada');
  const atr = l.filter(o => atrasada(o, hoje));
  const doDia = l.filter(o => (ABERTAS.includes(o.status) && !(o.status === 'planejada' && diaDe(o) > hoje)) || String(o.hFim || '').startsWith(hoje));
  const urg = o => (atrasada(o, hoje) ? 0 : 1);
  const lista = doDia.sort((a, b) => (ABERTAS.includes(b.status) - ABERTAS.includes(a.status)) || urg(a) - urg(b) || PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || ORDEM[a.status] - ORDEM[b.status] || diaDe(a).localeCompare(diaDe(b)));
  return { pedir: pedir.length, comCliente: cli.length, foraPrazo: cli.filter(o => foraDoPrazo(o, cfg, agora)).length, liberadas: lib.length, atrasadas: atr.length, lista };
}
const doDiaOrd = l => [...l].sort((a, b) => PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || ORDEM[a.status] - ORDEM[b.status]);
// Semana de segunda a domingo: [{ dia, oms }] (as canceladas ficam de fora).
export function visaoSemana(l, dia) {
  const ini = weekOf(dia);
  return Array.from({ length: 7 }, (_, i) => { const d = add(ini, i); return { dia: d, oms: doDiaOrd(l.filter(o => o.status !== 'cancelada' && diaDe(o) === d)) }; });
}
// Mês: quantas OMs há em cada dia (previstas, finalizadas, atrasadas) e o planejado contra o realizado por semana.
// previstas = OMs do dia na agenda (sem as canceladas); finalizadas = das previstas, as já finalizadas.
export function visaoMes(l, ym, hoje) {
  const ok = l.filter(o => o.status !== 'cancelada' && diaDe(o).startsWith(ym));
  const dias = {};
  for (const o of ok) {
    const d = (dias[diaDe(o)] ||= { previstas: 0, finalizadas: 0, atrasadas: 0, planejadas: 0 });
    d.previstas++; if (o.status === 'finalizada') d.finalizadas++; if (o.status === 'planejada') d.planejadas++; if (atrasada(o, hoje)) d.atrasadas++;
  }
  // Semanas do calendário que tocam o mês (a primeira e a última podem ter dias do mês vizinho, que não contam).
  const semanas = [];
  for (let ini = weekOf(ym + '-01'); ini.slice(0, 7) <= ym; ini = add(ini, 7)) {
    const x = ok.filter(o => diaDe(o) >= ini && diaDe(o) <= add(ini, 6));
    semanas.push({ ini, previstas: x.length, finalizadas: x.filter(o => o.status === 'finalizada').length });
  }
  const previstas = ok.length, finalizadas = ok.filter(o => o.status === 'finalizada').length;
  return { dias, semanas, previstas, finalizadas, planejadas: ok.filter(o => o.status === 'planejada').length, atrasadas: ok.filter(o => atrasada(o, hoje)).length, aderencia: previstas ? Math.round(finalizadas / previstas * 100) : null };
}

/* ---------- cliente de cada conjunto ---------- */
// O cliente é um usuário do sistema (Pátio: o usuário do Pátio; Bateria: o usuário da Bateria), escolhido pelo
// administrador e guardado em config/oms { clientes: { patio: { uid, nome }, bateria: { uid, nome } } }.
export const clienteDe = (cfg, conj) => { const c = cfg && cfg.clientes && cfg.clientes[conj]; return c && c.uid ? { uid: c.uid, nome: c.nome || '' } : null; };
const sem = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Sugestão para o administrador: o usuário cujo nome ou login fala do conjunto ("Usuário Pátio", "patio"…).
export function palpiteCliente(usuarios, conj) {
  const chave = conj === 'patio' ? 'patio' : 'bateria';
  const l = (usuarios || []).filter(u => u && u.papel !== 'bloqueado' && (sem(u.nome).includes(chave) || sem(u.login).includes(chave)));
  return l.sort((a, b) => (sem(a.nome).startsWith('usuario') ? 0 : 1) - (sem(b.nome).startsWith('usuario') ? 0 : 1) || sem(a.nome).length - sem(b.nome).length)[0] || null;
}
// "PT ok, APR pendente…" (Excel e impressão).
export const docsTxt = o => { const r = docsResumo(o); return r ? r.itens.map(i => `${i.nome} ${i.ok ? 'pronto' : 'pendente'}`).join(', ') : ''; };
export const prazoTxt = p => (p ? `${p.horas} h · ${p.fora ? 'fora do prazo' : p.aberta ? 'resta ' + duracao(p.resta) : 'no prazo'}` : '');
export function linhasExcel(l, areaNome = a => a, cfg = null) {
  return [['Nº OM', 'Situação', 'Área', 'Equipamento ou local', 'Serviço', 'Tipo', 'Prioridade', 'Solicitante', 'Data prevista', 'Hora da solicitação', 'Aprovada em', 'Cliente', 'Contato no cliente', 'Enviada ao cliente', 'Hora da liberação', 'Hora da finalização', 'Espera até liberar', 'Execução', 'Detalhes', 'Motivo (devolução/cancelamento)', 'Observação da finalização', 'Documentação', 'Ciente do cliente', 'Liberada por', 'Prazo do cliente'],
    ...ordenar(l).map(o => { const x = tempos(o); return [o.numero || '', STATUS[o.status] || o.status, areaNome(o.area), [o.equip, o.local].filter(Boolean).join(' · '), o.titulo || '', TIPOS[o.tipo] || '', PRIORIDADES[o.prio] || '', o.solNome || '', dataBR(o.dPrev), horaBR(o.hSol), horaBR(o.hAprov), o.cliente || '', o.contato || '', horaBR(o.hEnvio), horaBR(o.hLib), horaBR(o.hFim), duracao(x.espera), duracao(x.execucao), o.desc || '', o.motivo || '', o.obsFim || '', docsTxt(o), horaBR(o.hCiente), o.libNome ? `${o.libNome}${o.libCli ? ' (cliente)' : ' (técnico)'}` : '', prazoTxt(prazoOm(o, cfg))]; })];
}

/* ---------- avisos no celular (rotina de hora em hora) ---------- */
// Quem recebe o quê: solicitação nova → quem trata no conjunto; enviada → o usuário do cliente; devolvida e liberada → quem abriu.
// Só mudanças dos últimos 2 dias (as marcas de enviado duram 15 dias). usuarios = { uid: perfil }.
// Prazo: a OM que passa do prazo com o cliente avisa uma vez o cliente e quem trata no conjunto (cfg = config/oms).
// Liberada pelo cliente: avisa também quem trata (o técnico acompanha sem precisar registrar nada).
export function avisosOms(oms, usuarios, hoje, cfg = null, agora = agoraLocal()) {
  const desde = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); })();
  const l = [];
  const tratam = (o, menos) => Object.entries(usuarios).filter(([uid, u]) => uid !== menos && trataOmU({ ...u, uid }, o.conj)).map(([uid]) => uid);
  for (const o of oms) {
    if (foraDoPrazo(o, cfg, agora)) {
      const alvo = [...new Set([...(o.clienteUid && usuarios[o.clienteUid] ? [o.clienteUid] : []), ...tratam(o)])];
      for (const uid of alvo) l.push({ uid, tipo: 'prazo', om: o, chave: `om|${uid}|${o.id}|prazo|${o.hEnvio}` });
    }
    const ult = (o.hist || []).slice(-1)[0]; const quando = (ult && ult.em) || o.hSol || '';
    if (String(quando).slice(0, 10) < desde) continue;
    if (o.status === 'solicitada') {
      // Não avisa quem acabou de pedir (o líder que abriu ou que transformou a planejada em solicitação).
      const autor = (ult && ult.s === 'solicitada' && ult.por) || o.solPor;
      for (const [uid, u] of Object.entries(usuarios)) if (uid !== autor && trataOmU({ ...u, uid }, o.conj)) l.push({ uid, tipo: 'nova', om: o, chave: `om|${uid}|${o.id}|${quando}` });
    } else if (o.status === 'enviada' && o.clienteUid && usuarios[o.clienteUid]) {
      l.push({ uid: o.clienteUid, tipo: 'enviada', om: o, chave: `om|${o.clienteUid}|${o.id}|enviada|${quando}` });
    } else if (['devolvida', 'liberada'].includes(o.status)) {
      const alvo = o.solPor && usuarios[o.solPor] ? [o.solPor] : [];
      if (o.status === 'liberada' && o.libCli) for (const uid of tratam(o, o.solPor)) alvo.push(uid);
      for (const uid of alvo) l.push({ uid, tipo: o.status, om: o, chave: `om|${uid}|${o.id}|${o.status}|${quando}` });
    }
  }
  return l;
}
