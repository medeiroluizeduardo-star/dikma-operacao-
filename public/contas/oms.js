// Operação › OMs: solicitação de ordem de manutenção, do líder ao cliente. Contas sem tela.
// Caminho: a OM pode nascer como plano ("Planejada", com a data prevista), cadastrada pelo líder ou pelo técnico, e no dia
// vira solicitação com um toque. O líder (ou supervisor, coordenador, gestor) abre a solicitação → o Técnico de Processo aprova ou devolve →
// envia ao cliente → o cliente libera, recusa ou cancela → quem executou (líder da área ou o técnico) finaliza.
// Recusada: o cliente não aceitou a OM como veio (motivo obrigatório); o técnico ajusta e envia de novo, ou cancela.
// Cancelada pelo cliente: com a OM com ele ou já liberada, o serviço não vai mais acontecer (motivo obrigatório).
// Em cada passo dá para deixar uma observação, que fica no histórico da OM (campo obs da linha).
// Processo real do bloqueio (2026-11-19): o técnico aprova e envia ao cliente num toque só → o cliente gera a OM
// ("OM gerada", com o número: hCiente) e passa à sala de controle → a sala passa ao eletricista (hSala) → o eletricista
// libera o equipamento e avisa a sala (hEletr) → a sala avisa o cliente, que marca Liberado (hLib) ou Não liberado →
// o líder executa e avisa a sala que terminou (hFim) → a sala desbloqueia (hDesb). A sala e o eletricista não entram no
// sistema: o cliente registra as horas que eles passam. Tempo de bloqueio = OM gerada até o eletricista liberar.
// Usado pela tela (telas/oms.js), pelos testes (testes/oms.test.mjs) e pela rotina dos avisos no celular.
import { perfilDe, ehAdminU, escoposDe, areasDoCadastro } from './acessos.js';
import { add, weekOf } from './cal.js';

export const STATUS = {
  planejada: 'Planejada', solicitada: 'Aguardando técnico', devolvida: 'Devolvida', aprovada: 'Aprovada', enviada: 'Com o cliente',
  recusada: 'Não liberada', liberada: 'Liberada', finalizada: 'Finalizada', cancelada: 'Cancelada'
};
// Situação do selo na lista (ui/padrao.js › etiqueta).
export const COR = { planejada: 'neutro', solicitada: 'atencao', devolvida: 'critico', aprovada: 'info', enviada: 'info', recusada: 'critico', liberada: 'atencao', finalizada: 'ok', cancelada: 'neutro' };
export const ABERTAS = ['planejada', 'solicitada', 'devolvida', 'aprovada', 'enviada', 'recusada', 'liberada'];
// Nome da situação na tela (2026-11-24, mais fácil de entender): a finalizada sem o desbloqueio aparece como
// "Aguardando desbloqueio" (o último passo é a sala desbloquear) e a aprovada (só quando o cliente do conjunto ainda não
// foi escolhido) como "Aguardando envio". No banco a situação continua a mesma.
export const nomeSit = o => (o.status === 'finalizada' && !o.hDesb ? 'Aguardando desbloqueio' : o.status === 'aprovada' ? 'Aguardando envio' : STATUS[o.status] || o.status);
export const corSit = o => (o.status === 'finalizada' && !o.hDesb ? 'atencao' : COR[o.status] || 'neutro');
// Barra de passos da OM: pedido → técnico → cliente gerou a OM → liberado → executado → desbloqueio.
// Cada passo: { k, nome, quando ('AAAA-MM-DDTHH:MM' ou data), feito, atual }. A recusa e a devolução marcam o passo atual
// como problema (prob) para a tela pintar de vermelho.
export const ETAPAS = [['pedido', 'Pedido'], ['tecnico', 'Técnico'], ['om', 'OM gerada'], ['lib', 'Liberado'], ['fim', 'Executado'], ['desb', 'Desbloqueio']];
export function etapas(o) {
  const q = { pedido: o.hSol || '', tecnico: o.hAprov || '', om: o.hCiente || '', lib: o.hLib || '', fim: o.hFim || '', desb: o.hDesb || '' };
  // Até onde a OM chegou (índice do próximo passo).
  const ate = { planejada: 0, solicitada: 1, devolvida: 0, aprovada: 2, enviada: o.hCiente ? 3 : 2, recusada: 2, liberada: 4, finalizada: o.hDesb ? 6 : 5, cancelada: -1 }[o.status];
  const prob = ['devolvida', 'recusada'].includes(o.status);
  return ETAPAS.map(([k, nome], i) => ({ k, nome, quando: k === 'pedido' && !q.pedido ? o.dPrev || '' : q[k], feito: ate < 0 ? !!q[k] : i < ate, atual: i === ate, prob: prob && i === ate }));
}
// Com quem a OM está agora (frase curta para a lista e para a janela).
export function comQuem(o) {
  return {
    planejada: 'Planejada: no dia, o líder solicita', solicitada: 'Com o Técnico de Processo (aprovar)', devolvida: 'Com quem abriu (corrigir e reenviar)',
    aprovada: 'Com o Técnico de Processo (enviar ao cliente)', enviada: o.hCiente ? 'Com o cliente (esperando o eletricista liberar)' : 'Com o cliente (gerar a OM)',
    recusada: 'Com o Técnico de Processo (cliente não liberou)', liberada: 'Com o líder da área (executar o serviço)',
    finalizada: o.hDesb ? 'Encerrada' : 'Com o líder da área (marcar o desbloqueio)', cancelada: 'Cancelada'
  }[o.status] || '';
}
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
export const PASSOS = { ciente: 'OM gerada pelo cliente', observacao: 'Observação', desbloqueio: 'Desbloqueio', editada: 'Editada' };
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
  if (cli && om.status === 'enviada') { if (!om.hCiente) a.push('ciente'); a.push('liberar', 'recusar'); }
  // O cliente também cancela (o serviço não vai mais acontecer), com a OM com ele ou já liberada.
  if (cli && ['enviada', 'liberada'].includes(om.status)) a.push('cancelar');
  // Editar (2026-11-24): quem abriu, enquanto a OM não foi aprovada; quem trata no conjunto (Técnico de Processo,
  // coordenador, gestor, administrador), em qualquer situação, inclusive as horas já registradas.
  if ((dono && ['planejada', 'solicitada', 'devolvida'].includes(om.status)) || trata) a.push('editar');
  // No dia (ou antes), a planejada vira solicitação: quem cadastrou, quem trata ou o líder da área.
  if ((dono || trata || daArea) && om.status === 'planejada') a.push('solicitar');
  if (trata && om.status === 'solicitada') a.push('aprovar', 'devolver');
  // Recusada: o técnico ajusta e envia de novo ao cliente (ou cancela).
  if (trata && ['aprovada', 'recusada'].includes(om.status)) a.push('enviar');
  if (trata && om.status === 'enviada' && !a.includes('liberar')) a.push('liberar', 'recusar');
  if ((trata || daArea) && om.status === 'liberada') a.push('finalizar');
  // Desbloqueio pela sala de controle: a hora pode ser marcada depois da finalização.
  if ((trata || daArea) && om.status === 'finalizada' && !om.hDesb) a.push('desbloqueio');
  if (!a.includes('cancelar') && ((dono && ['planejada', 'solicitada', 'devolvida'].includes(om.status)) || (trata && ABERTAS.includes(om.status)))) a.push('cancelar');
  // Observação avulsa no histórico (sem mudar a situação): quem participa da OM, enquanto ela está aberta.
  // (o cliente, com a OM com ele ou liberada; quem abriu, enquanto ela não foi aprovada.)
  if (((trata || daArea) && ABERTAS.includes(om.status)) || (cli && ['enviada', 'liberada'].includes(om.status)) || (dono && ['planejada', 'solicitada'].includes(om.status))) a.push('obs');
  // Apagar de vez (aberta por engano, repetida): quem trata no conjunto e o administrador, em qualquer situação.
  // Documentação (PT, APR, bloqueio…): quem trata e o líder da área, enquanto a OM está aberta.
  if ((trata || daArea) && ABERTAS.includes(om.status)) a.push('docs');
  if (trata) a.push('apagar');
  return a;
}
// O próximo passo desta pessoa nesta OM (o botão grande da janela); o resto fica em "Mais".
// Para quem trata, "liberar" e "recusar" com a OM com o cliente são só o registro do que o cliente passou por fora: não
// são o passo principal (o principal é o cliente tocar). null = nada a fazer agora.
const ORDEM_PASSO = ['ciente', 'liberar', 'solicitar', 'aprovar', 'enviar', 'finalizar', 'desbloqueio'];
export function proximo(om, u, ac = acoesDe(om, u)) {
  const cli = ehClienteDa(om, u);
  if (om.status === 'devolvida' && ac.includes('editar')) return 'editar';
  return ORDEM_PASSO.find(a => ac.includes(a) && (a !== 'liberar' || cli || !om.clienteUid)) || null;
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
// Bloqueio (o que o cliente mais acompanha): OM gerada → eletricista liberou; em partes: OM gerada → sala passou ao
// eletricista (sala), sala → eletricista liberou (eletricista) e eletricista liberou → liberado no sistema (aviso).
export const tempos = om => ({
  espera: minutosEntre(om.hSol, om.hLib), execucao: minutosEntre(om.hLib, om.hFim), total: minutosEntre(om.hSol, om.hFim),
  bloqueio: minutosEntre(om.hCiente, om.hEletr), sala: minutosEntre(om.hCiente, om.hSala), eletricista: minutosEntre(om.hSala, om.hEletr),
  aviso: minutosEntre(om.hEletr, om.hLib), desbloqueio: minutosEntre(om.hFim, om.hDesb)
});

/* ---------- conferência e mudanças ---------- */
const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const erro = (m, campo) => { const e = /** @type {Error & { campo?: string }} */ (new Error(m)); e.campo = campo; throw e; };
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
// Horas que quem trata pode corrigir ao editar (só as que já foram registradas na OM), na ordem do caminho.
export const HORAS_EDIT = [['hSol', 'Solicitação'], ['hAprov', 'Aprovação do técnico'], ['hEnvio', 'Envio ao cliente'], ['hCiente', 'OM gerada pelo cliente'], ['hSala', 'Sala passou ao eletricista'], ['hEletr', 'Eletricista liberou'], ['hLib', 'Liberação'], ['hFim', 'Avisou a sala que terminou'], ['hDesb', 'Sala desbloqueou']];
// Confere as horas corrigidas: cada uma no formato certo e a ordem do caminho respeitada. x = { campo: valor digitado }.
// Hora já registrada não pode ficar em branco. Devolve só as que mudaram.
export function conferirHoras(om, x) {
  const y = {};
  for (const [k, nome] of HORAS_EDIT) {
    if (!ehHora(om[k])) continue;
    const v = String(x[k] == null ? om[k] : x[k]).trim();
    if (!ehHora(v)) erro(`Informe a hora: ${nome.toLowerCase()}.`, 'omE_' + k);
    if (v !== om[k]) y[k] = v;
  }
  const h = k => (k in y ? y[k] : om[k]);
  const antes = (a, b, msg) => { if (ehHora(h(a)) && ehHora(h(b)) && h(b) < h(a)) erro(msg, 'omE_' + b); };
  antes('hSol', 'hAprov', 'A aprovação não pode ser antes da solicitação.');
  antes('hAprov', 'hEnvio', 'O envio não pode ser antes da aprovação.');
  antes('hEnvio', 'hCiente', 'A OM gerada não pode ser antes do envio ao cliente.');
  antes('hCiente', 'hSala', 'A sala não pode ter passado ao eletricista antes de a OM ser gerada.');
  antes('hSala', 'hEletr', 'O eletricista não pode ter liberado antes de receber da sala.');
  antes('hCiente', 'hEletr', 'O eletricista não pode ter liberado antes de a OM ser gerada.');
  antes('hEletr', 'hLib', 'A liberação no sistema não pode ser antes do eletricista liberar.');
  antes('hSol', 'hLib', 'A liberação não pode ser antes da solicitação.');
  antes('hLib', 'hFim', 'A finalização não pode ser antes da liberação.');
  antes('hFim', 'hDesb', 'O desbloqueio não pode ser antes do aviso de fim do serviço.');
  return y;
}
// Linha do histórico da edição: o que mudou (nomes dos campos), para quem acompanha saber.
const NOMES_CAMPOS = { area: 'área', local: 'local', equip: 'equipamento', titulo: 'serviço', desc: 'detalhes', tipo: 'tipo', prio: 'prioridade', dPrev: 'data prevista', numero: 'nº da OM', docs: 'documentação', ...Object.fromEntries(HORAS_EDIT.map(([k, n]) => [k, 'hora: ' + n.toLowerCase()])) };
export function mudouTxt(om, y) {
  const l = Object.keys(y).filter(k => NOMES_CAMPOS[k] && (k === 'docs' ? JSON.stringify(conferirDocs(y[k])) !== JSON.stringify(conferirDocs(om[k])) : String(y[k] ?? '') !== String(om[k] ?? ''))).map(k => NOMES_CAMPOS[k]);
  return l.length ? 'mudou ' + l.join(', ') : '';
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
// Prazo do cliente (2026-11-24: um relógio só, o mesmo do tempo de bloqueio): conta da OM gerada pelo cliente até o
// eletricista liberar. Enquanto o cliente não gera a OM, conta do envio (a OM está parada com ele). Sem a hora do
// eletricista (OMs antigas ou liberação registrada pelo técnico), termina na liberação. Com a OM ainda com o cliente, conta
// até agora. null quando a OM não foi enviada ou a prioridade está sem prazo.
export const inicioPrazo = om => (ehHora(om.hCiente) ? om.hCiente : ehHora(om.hEnvio) ? om.hEnvio : '');
export function prazoOm(om, cfg, agora = agoraLocal()) {
  const ini = om ? inicioPrazo(om) : '';
  if (!ini || !['enviada', 'liberada', 'finalizada'].includes(om.status)) return null;
  const horas = prazosDe(cfg)[om.prio || 'media']; if (!horas) return null;
  const ate = om.status === 'enviada' ? agora : ehHora(om.hEletr) ? om.hEletr : om.hLib; const usado = minutosEntre(ini, ate); if (usado == null) return null;
  return { horas, usado, resta: horas * 60 - usado, fora: usado > horas * 60, aberta: om.status === 'enviada' };
}
// Com o cliente e já passou do prazo (fica vermelha na tela e gera aviso).
export const foraDoPrazo = (om, cfg, agora) => { const p = prazoOm(om, cfg, agora); return !!(p && p.aberta && p.fora); };
// Linha do histórico da OM.
// obs = observação livre de quem fez o passo (opcional, em todos os passos).
export const passo = (s, quem, txt = '', em = agoraLocal(), obs = '') => {
  const o = t(obs, LIMITES.obs);
  return { s, em, por: quem.uid || '', nome: quem.nome || '', ...(txt ? { txt: t(txt, LIMITES.motivo) } : {}), ...(o ? { obs: o } : {}) };
};
// Observações da OM, na ordem (para a tela, a impressão e o Excel).
export const observacoes = om => (om && Array.isArray(om.hist) ? om.hist : []).filter(p => p && p.obs).map(p => ({ s: p.s, em: p.em, nome: p.nome || '', obs: p.obs }));
const comHist = (om, linha) => [...(om.hist || []), ...[].concat(linha)].slice(-LIMITES.hist);
// Mudança de situação: devolve só os campos que mudam (para gravar). d = dados digitados na janela.
export function mudar(om, acao, quem, d = {}) {
  const ag = agoraLocal(); const obs = d.obs;
  switch (acao) {
    case 'solicitar': {
      const h = ehHora(d.hSol) ? d.hSol : ag;
      return { status: 'solicitada', hSol: h, hist: comHist(om, passo('solicitada', quem, om.dPrev ? 'planejada para ' + dataBR(om.dPrev) : '', h, obs)) };
    }
    case 'reenviar': return { status: 'solicitada', motivo: '', hist: comHist(om, passo('solicitada', quem, 'corrigida e reenviada', ag, obs)) };
    case 'aprovar': {
      const ap = { status: 'aprovada', hAprov: ag, aprovPor: quem.uid, aprovNome: quem.nome || '', hist: comHist(om, passo('aprovada', quem, '', ag, obs)) };
      // Aprovar e enviar ao cliente num toque só (com o cliente do conjunto definido).
      if (!d.enviar) return ap;
      return { ...ap, ...mudar({ ...om, ...ap }, 'enviar', quem, { cliente: d.cliente, contato: d.contato, hEnvio: ag }) };
    }
    case 'devolver': {
      const m = t(d.motivo, LIMITES.motivo); if (m.length < 5) erro('Diga o que precisa corrigir (mínimo 5 letras).', 'omMotivo');
      return { status: 'devolvida', motivo: m, hist: comHist(om, passo('devolvida', quem, m, ag, obs)) };
    }
    case 'enviar': {
      const h = ehHora(d.hEnvio) ? d.hEnvio : ag;
      const c = d.cliente || {}; const cliente = t(c.nome, LIMITES.cliente), contato = t(d.contato, LIMITES.contato), numero = t(d.numero, LIMITES.numero);
      if (!c.uid || cliente.length < 2) erro('O cliente deste conjunto ainda não foi definido. O administrador escolhe o usuário do cliente no topo da tela.', 'omCli');
      const txt = [om.status === 'recusada' ? 'reenviada' : '', 'para ' + cliente, contato, numero ? 'OM ' + numero : ''].filter(Boolean).join(' · ');
      // Reenvio depois da recusa: a recusa fica no histórico e a OM volta limpa para o cliente (novo prazo, novo ciente).
      const limpa = om.status === 'recusada' ? { motivo: '', hCanc: '', cancNome: '', cancCli: false, hCiente: '', cienteNome: '' } : {};
      return { status: 'enviada', hEnvio: h, numero, cliente, clienteUid: c.uid, contato, ...limpa, hist: comHist(om, passo('enviada', quem, txt, h, obs)) };
    }
    case 'ciente': {
      // "OM gerada": o cliente gerou a OM (com o número) e passou à sala de controle. Começa o tempo de bloqueio.
      const numero = t(d.numero, LIMITES.numero) || t(om.numero, LIMITES.numero);
      if (!numero) erro('Informe o número da OM gerada.', 'omNum');
      return { hCiente: ag, cienteNome: t(quem.nome, 150), numero, hist: comHist(om, passo('ciente', quem, 'OM ' + numero, ag, obs)) };
    }
    case 'obs': {
      const o = t(obs, LIMITES.obs); if (o.length < 3) erro('Escreva a observação.', 'omObs');
      return { hist: comHist(om, passo('observacao', quem, '', ag, o)) };
    }
    case 'recusar': {
      // O cliente recusa pelo sistema (hora do toque); o técnico registra a recusa que o cliente passou por fora.
      const m = t(d.motivo, LIMITES.motivo); if (m.length < 5) erro('Diga o motivo da recusa (mínimo 5 letras).', 'omMotivo');
      const cli = !!d.peloCliente;
      return { status: 'recusada', motivo: m, hCanc: ag, cancNome: t(quem.nome, 150), cancCli: cli, hist: comHist(om, passo('recusada', quem, (cli ? '' : 'registrada pelo técnico: ') + m, ag, obs)) };
    }
    case 'liberar': {
      // O cliente libera pelo sistema: vale a hora do toque (a real). O técnico registra a hora que o cliente informou.
      // Horas que a sala de controle passa: quando passou ao eletricista (opcional) e quando o eletricista liberou
      // (obrigatória para o cliente). Sem "OM gerada" antes, o cliente informa também a hora em que gerou a OM.
      const cli = !!d.peloCliente; const h = cli ? ag : d.hLib;
      if (!ehHora(h)) erro('Informe a hora da liberação.', 'omHLib');
      if (om.hSol && h < om.hSol) erro('A liberação não pode ser antes da solicitação.', 'omHLib');
      const hOm = om.hCiente || (ehHora(d.hCiente) ? d.hCiente : '');
      const hSala = ehHora(d.hSala) ? d.hSala : ''; const hEletr = ehHora(d.hEletr) ? d.hEletr : '';
      if (cli && !hOm) erro('Informe a hora em que a OM foi gerada.', 'omHOm');
      if (cli && !hEletr) erro('Informe a hora em que o eletricista liberou o equipamento.', 'omHEletr');
      if (hOm && hSala && hSala < hOm) erro('A sala não pode ter passado ao eletricista antes de a OM ser gerada.', 'omHSala');
      if (hEletr && ((hSala && hEletr < hSala) || (hOm && hEletr < hOm))) erro('O eletricista não pode ter liberado antes de receber a OM.', 'omHEletr');
      if (hEletr && hEletr > h) erro('A liberação do eletricista não pode ser depois da liberação no sistema.', 'omHEletr');
      const ciente = !om.hCiente && hOm ? { hCiente: hOm, cienteNome: t(quem.nome, 150) } : {};
      const txt = [cli ? 'liberada pelo cliente' : 'registrada pelo técnico', hEletr ? 'eletricista liberou ' + horaBR(hEletr) : ''].filter(Boolean).join(' · ');
      return { status: 'liberada', hLib: h, libNome: t(quem.nome, 150), libCli: cli, ...ciente, ...(hSala ? { hSala } : {}), ...(hEletr ? { hEletr } : {}), ...(d.numero ? { numero: t(d.numero, LIMITES.numero) } : {}), hist: comHist(om, passo('liberada', quem, txt, h, obs)) };
    }
    case 'finalizar': {
      if (!ehHora(d.hFim)) erro('Informe a hora da finalização.', 'omHFim');
      if (om.hLib && d.hFim < om.hLib) erro('A finalização não pode ser antes da liberação.', 'omHFim');
      // Hora do desbloqueio pela sala de controle: opcional aqui (pode ser marcada depois).
      const hDesb = ehHora(d.hDesb) ? d.hDesb : '';
      if (hDesb && hDesb < d.hFim) erro('O desbloqueio não pode ser antes do aviso de fim do serviço.', 'omHDesb');
      const fim = passo('finalizada', quem, d.obs, d.hFim);
      return { status: 'finalizada', hFim: d.hFim, obsFim: t(d.obs, LIMITES.obs), ...(hDesb ? { hDesb } : {}), hist: comHist(om, hDesb ? [fim, passo('desbloqueio', quem, '', hDesb)] : fim) };
    }
    case 'desbloqueio': {
      if (!ehHora(d.hDesb)) erro('Informe a hora do desbloqueio.', 'omHDesb');
      if (om.hFim && d.hDesb < om.hFim) erro('O desbloqueio não pode ser antes do aviso de fim do serviço.', 'omHDesb');
      return { hDesb: d.hDesb, hist: comHist(om, passo('desbloqueio', quem, '', d.hDesb, obs)) };
    }
    case 'cancelar': {
      const m = t(d.motivo, LIMITES.motivo); if (m.length < 5) erro('Diga o motivo do cancelamento (mínimo 5 letras).', 'omMotivo');
      const cli = !!d.peloCliente;
      return { status: 'cancelada', motivo: m, hCanc: ag, cancNome: t(quem.nome, 150), cancCli: cli, hist: comHist(om, passo('cancelada', quem, (cli ? 'pelo cliente: ' : '') + m, ag, obs)) };
    }
    default: throw new Error('Ação desconhecida');
  }
}

/* ---------- lista ---------- */
const ORDEM = { recusada: 0, devolvida: 0, solicitada: 1, aprovada: 2, enviada: 3, liberada: 4, planejada: 5, finalizada: 6, cancelada: 7 };
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
  const r = { planejada: 0, solicitada: 0, devolvida: 0, aprovada: 0, enviada: 0, recusada: 0, liberada: 0, finalizadasMes: 0, esperaMedia: null, execMedia: null, bloqMedia: null };
  const esp = [], exe = [], blq = [];
  for (const o of l) {
    if (r[o.status] != null) r[o.status]++;
    if (o.status === 'finalizada' && String(o.hFim || '').startsWith(mes)) {
      r.finalizadasMes++; const x = tempos(o);
      if (x.espera != null && x.espera >= 0) esp.push(x.espera); if (x.execucao != null && x.execucao >= 0) exe.push(x.execucao);
      if (x.bloqueio != null && x.bloqueio >= 0) blq.push(x.bloqueio);
    }
  }
  const m = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  r.esperaMedia = m(esp); r.execMedia = m(exe); r.bloqMedia = m(blq); r.comCliente = r.aprovada + r.enviada;
  return r;
}
/* ---------- planejamento: Hoje, Semana e Mês ---------- */
// Dia da OM na agenda: a data prevista; nas antigas (sem data prevista), o dia da solicitação.
// Fotos da OM (só quem abre a solicitação): na coleção das fotos das atividades, com a "atividade" OM-<id>.
export const pidFotoOM = id => 'OM-' + id;
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
  const lista = doDia.sort((a, b) => (+ABERTAS.includes(b.status) - +ABERTAS.includes(a.status)) || urg(a) - urg(b) || PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || ORDEM[a.status] - ORDEM[b.status] || diaDe(a).localeCompare(diaDe(b)));
  return { pedir: pedir.length, comCliente: cli.length, recusadas: l.filter(o => o.status === 'recusada').length, foraPrazo: cli.filter(o => foraDoPrazo(o, cfg, agora)).length, liberadas: lib.length, atrasadas: atr.length, lista };
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
  return [['Nº OM', 'Situação', 'Área', 'Equipamento ou local', 'Serviço', 'Tipo', 'Prioridade', 'Solicitante', 'Data prevista', 'Hora da solicitação', 'Aprovada em', 'Cliente', 'Contato no cliente', 'Enviada ao cliente', 'Hora da liberação', 'Hora da finalização', 'Espera até liberar', 'Execução', 'Detalhes', 'Motivo (devolução/cancelamento)', 'Observação da finalização', 'Documentação', 'OM gerada pelo cliente', 'Liberada por', 'Prazo do cliente', 'Não liberada/cancelamento', 'Observações', 'Sala passou ao eletricista', 'Eletricista liberou', 'Tempo de bloqueio (OM gerada até o eletricista liberar)', 'Hora do desbloqueio'],
    ...ordenar(l).map(o => { const x = tempos(o); return [o.numero || '', STATUS[o.status] || o.status, areaNome(o.area), [o.equip, o.local].filter(Boolean).join(' · '), o.titulo || '', TIPOS[o.tipo] || '', PRIORIDADES[o.prio] || '', o.solNome || '', dataBR(o.dPrev), horaBR(o.hSol), horaBR(o.hAprov), o.cliente || '', o.contato || '', horaBR(o.hEnvio), horaBR(o.hLib), horaBR(o.hFim), duracao(x.espera), duracao(x.execucao), o.desc || '', o.motivo || '', o.obsFim || '', docsTxt(o), horaBR(o.hCiente), o.libNome ? `${o.libNome}${o.libCli ? ' (cliente)' : ' (técnico)'}` : '', prazoTxt(prazoOm(o, cfg)), o.hCanc ? `${horaBR(o.hCanc)} · ${o.cancNome || ''}${o.cancCli ? ' (cliente)' : ''}` : '', observacoes(o).map(x => `${horaBR(x.em)} ${x.nome}: ${x.obs}`).join(' | '), horaBR(o.hSala), horaBR(o.hEletr), duracao(x.bloqueio), horaBR(o.hDesb)]; })];
}

/* ---------- avisos no celular (rotina de hora em hora) ---------- */
// Quem recebe o quê: solicitação nova → quem trata no conjunto; enviada → o usuário do cliente; devolvida e liberada → quem abriu;
// recusada ou cancelada pelo cliente → quem abriu e quem trata.
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
      // (a chave segue com a hora do envio: um aviso de prazo por envio, mesmo quando o relógio recomeça na OM gerada)
    }
    const ult = (o.hist || []).slice(-1)[0]; const quando = (ult && ult.em) || o.hSol || '';
    if (String(quando).slice(0, 10) < desde) continue;
    if (o.status === 'solicitada') {
      // Não avisa quem acabou de pedir (o líder que abriu ou que transformou a planejada em solicitação).
      const autor = (ult && ult.s === 'solicitada' && ult.por) || o.solPor;
      for (const [uid, u] of Object.entries(usuarios)) if (uid !== autor && trataOmU({ ...u, uid }, o.conj)) l.push({ uid, tipo: 'nova', om: o, chave: `om|${uid}|${o.id}|${quando}` });
    } else if (o.status === 'enviada' && o.clienteUid && usuarios[o.clienteUid]) {
      l.push({ uid: o.clienteUid, tipo: 'enviada', om: o, chave: `om|${o.clienteUid}|${o.id}|enviada|${quando}` });
    } else if (o.status === 'recusada' || (o.status === 'cancelada' && o.cancCli)) {
      // Recusa ou cancelamento pelo cliente: quem trata no conjunto e quem abriu (sem avisar quem fez).
      const autor = ult && ult.por;
      const alvo = [...new Set([...(o.solPor && usuarios[o.solPor] ? [o.solPor] : []), ...tratam(o)])].filter(uid => uid !== autor);
      for (const uid of alvo) l.push({ uid, tipo: o.status, om: o, chave: `om|${uid}|${o.id}|${o.status}|${quando}` });
    } else if (['devolvida', 'liberada'].includes(o.status)) {
      const alvo = o.solPor && usuarios[o.solPor] ? [o.solPor] : [];
      if (o.status === 'liberada' && o.libCli) for (const uid of tratam(o, o.solPor)) alvo.push(uid);
      for (const uid of alvo) l.push({ uid, tipo: o.status, om: o, chave: `om|${uid}|${o.id}|${o.status}|${quando}` });
    }
  }
  return l;
}

/* ---------- resumo das 7h (rotina de hora em hora: das 7h em diante, uma vez por dia por pessoa) ---------- */
// Cada pessoa recebe só o que é dela, e só se houver algo:
// - quem trata no conjunto (Técnico de Processo, coordenador, gestor, administrador): para aprovar, não liberadas, com o
//   cliente (e fora do prazo), previstas para hoje;
// - o líder ou supervisor da área (quem abre): para solicitar hoje, liberadas para executar, devolvidas, falta o desbloqueio;
// - o usuário do cliente: com ele para gerar ou liberar.
// Devolve [{ uid, titulo, corpo, chave }] (a chave marca o dia: om7|uid|AAAA-MM-DD). usuarios = { uid: perfil }.
export function resumo7h(oms, usuarios, hoje, cfg = null, agora = agoraLocal()) {
  const s = n => (n > 1 ? 's' : '');
  const out = [];
  for (const [uid, u0] of Object.entries(usuarios || {})) {
    const u = { ...u0, uid }; if (!u || u.papel === 'bloqueado') continue;
    const partes = []; let total = 0;
    const conta = (n, txt) => { if (n) { partes.push(`${n} ${txt}`); total += n; } };
    const conjs = ['patio', 'bateria'];
    const trata = oms.filter(o => conjs.includes(o.conj) && trataOmU(u, o.conj));
    if (trata.length) {
      conta(trata.filter(o => o.status === 'solicitada').length, 'para aprovar');
      conta(trata.filter(o => o.status === 'recusada').length, 'não liberada' + (trata.filter(o => o.status === 'recusada').length > 1 ? 's' : '') + ' pelo cliente');
      const fora = trata.filter(o => foraDoPrazo(o, cfg, agora)).length;
      const comCli = trata.filter(o => o.status === 'enviada').length;
      if (comCli) { partes.push(`${comCli} com o cliente${fora ? ` (${fora} fora do prazo)` : ''}`); total += comCli; }
      conta(trata.filter(o => o.status === 'planejada' && diaDe(o) === hoje).length, 'prevista' + s(trata.filter(o => o.status === 'planejada' && diaDe(o) === hoje).length) + ' para hoje');
    } else {
      const minhas = oms.filter(o => conjs.includes(o.conj) && abreOmU(u, o.conj, o.area));
      if (minhas.length) {
        const pedir = minhas.filter(o => o.status === 'planejada' && diaDe(o) <= hoje).length;
        conta(pedir, `para solicitar hoje`);
        const lib = minhas.filter(o => o.status === 'liberada').length; conta(lib, `liberada${s(lib)} para executar`);
        const dev = minhas.filter(o => o.status === 'devolvida' && o.solPor === uid).length; conta(dev, `devolvida${s(dev)} para corrigir`);
        const desb = minhas.filter(o => o.status === 'finalizada' && !o.hDesb && String(o.hFim || '').slice(0, 10) >= add(hoje, -7)).length; conta(desb, `sem a hora do desbloqueio`);
      }
    }
    const doCli = oms.filter(o => o.status === 'enviada' && o.clienteUid === uid);
    if (doCli.length) { const g = doCli.filter(o => !o.hCiente).length; conta(g, `para gerar a OM`); conta(doCli.length - g, `esperando a liberação`); }
    if (!total) continue;
    out.push({ uid, titulo: `OMs hoje: ${partes[0]}`.slice(0, 120), corpo: partes.join(' · ') + '\nToque para abrir.', chave: `om7|${uid}|${hoje}` });
  }
  return out;
}
