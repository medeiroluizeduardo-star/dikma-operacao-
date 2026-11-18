// Operação › OMs: solicitação de ordem de manutenção, do líder ao cliente. Contas sem tela.
// Caminho: o líder (ou supervisor, coordenador, gestor) abre a solicitação → o Técnico de Processo aprova ou devolve →
// envia ao cliente → registra a liberação → quem executou (líder da área ou o técnico) finaliza.
// Usado pela tela (telas/oms.js), pelos testes (testes/oms.test.mjs) e pela rotina dos avisos no celular.
import { perfilDe, ehAdminU, escoposDe, areasDoCadastro } from './acessos.js';

export const STATUS = {
  solicitada: 'Aguardando técnico', devolvida: 'Devolvida', aprovada: 'Aprovada', enviada: 'Com o cliente',
  liberada: 'Liberada', finalizada: 'Finalizada', cancelada: 'Cancelada'
};
// Situação do selo na lista (ui/padrao.js › etiqueta).
export const COR = { solicitada: 'atencao', devolvida: 'critico', aprovada: 'info', enviada: 'info', liberada: 'atencao', finalizada: 'ok', cancelada: 'neutro' };
export const ABERTAS = ['solicitada', 'devolvida', 'aprovada', 'enviada', 'liberada'];
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', emergencia: 'Emergência' };
export const TIPOS = { corretiva: 'Corretiva', preventiva: 'Preventiva', melhoria: 'Melhoria', seguranca: 'Segurança' };
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

// O que esta pessoa pode fazer nesta OM agora (botões da tela; as regras do banco conferem o mesmo).
export function acoesDe(om, u) {
  const trata = trataOmU(u, om.conj); const dono = !!u && om.solPor === u.uid;
  const daArea = abreOmU(u, om.conj, om.area);
  const a = [];
  if ((dono || trata) && ['solicitada', 'devolvida'].includes(om.status)) a.push('editar');
  if (trata && om.status === 'solicitada') a.push('aprovar', 'devolver');
  if (trata && om.status === 'aprovada') a.push('enviar');
  if (trata && om.status === 'enviada') a.push('liberar');
  if ((trata || daArea) && om.status === 'liberada') a.push('finalizar');
  if ((dono && ['solicitada', 'devolvida'].includes(om.status)) || (trata && ABERTAS.includes(om.status))) a.push('cancelar');
  // Apagar de vez (aberta por engano, repetida): quem trata no conjunto e o administrador, em qualquer situação.
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
export const horaBR = s => (ehHora(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '');
// Tempos da OM: espera até liberar (solicitação → liberação) e execução (liberação → finalização).
export const tempos = om => ({ espera: minutosEntre(om.hSol, om.hLib), execucao: minutosEntre(om.hLib, om.hFim), total: minutosEntre(om.hSol, om.hFim) });

/* ---------- conferência e mudanças ---------- */
const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const erro = (m, campo) => { const e = new Error(m); e.campo = campo; throw e; };
// Dados da solicitação (abrir ou corrigir). areasOk = áreas que a pessoa pode escolher (null = todas).
export function conferirSolicitacao(x, areasOk = null) {
  const y = {
    area: t(x.area, 40), local: t(x.local, LIMITES.local), equip: t(x.equip, LIMITES.equip), titulo: t(x.titulo, LIMITES.titulo),
    desc: t(x.desc, LIMITES.desc), tipo: TIPOS[x.tipo] ? x.tipo : 'corretiva', prio: PRIORIDADES[x.prio] ? x.prio : 'media', hSol: ehHora(x.hSol) ? x.hSol : ''
  };
  if (!y.area) erro('Escolha a área.', 'omArea');
  if (areasOk && !areasOk.includes(y.area)) erro('Você só abre OM nas áreas que lidera.', 'omArea');
  if (!y.titulo || y.titulo.length < 5) erro('Diga em poucas palavras o serviço (mínimo 5 letras).', 'omTit');
  if (!y.local) erro('Informe o equipamento ou o local.', 'omLocal');
  if (!y.hSol) erro('Informe a hora da solicitação.', 'omHSol');
  return y;
}
// Linha do histórico da OM.
export const passo = (s, quem, txt = '', em = agoraLocal()) => ({ s, em, por: quem.uid || '', nome: quem.nome || '', ...(txt ? { txt: t(txt, LIMITES.motivo) } : {}) });
const comHist = (om, linha) => [...(om.hist || []), linha].slice(-LIMITES.hist);
// Mudança de situação: devolve só os campos que mudam (para gravar). d = dados digitados na janela.
export function mudar(om, acao, quem, d = {}) {
  const ag = agoraLocal();
  switch (acao) {
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
    case 'liberar': {
      if (!ehHora(d.hLib)) erro('Informe a hora da liberação.', 'omHLib');
      if (om.hSol && d.hLib < om.hSol) erro('A liberação não pode ser antes da solicitação.', 'omHLib');
      return { status: 'liberada', hLib: d.hLib, ...(d.numero ? { numero: t(d.numero, LIMITES.numero) } : {}), hist: comHist(om, passo('liberada', quem, '', d.hLib)) };
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
const ORDEM = { devolvida: 0, solicitada: 1, aprovada: 2, enviada: 3, liberada: 4, finalizada: 5, cancelada: 6 };
const PRIO_ORD = { emergencia: 0, alta: 1, media: 2, baixa: 3 };
export const ordenar = l => [...l].sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || String(b.hSol || '').localeCompare(String(a.hSol || '')));
// f = { status: '' | 'abertas' | um status, area, q, mes ('AAAA-MM', para finalizadas e canceladas) }
export function filtrar(l, f = {}) {
  const q = String(f.q || '').toLowerCase().trim();
  return ordenar(l.filter(o => (!f.status || (f.status === 'abertas' ? ABERTAS.includes(o.status) : o.status === f.status))
    && (!f.area || o.area === f.area)
    && (!f.mes || ABERTAS.includes(o.status) || String(o.hFim || o.hSol || '').startsWith(f.mes))
    && (!q || [o.numero, o.titulo, o.local, o.equip, o.desc, o.solNome, o.area, o.cliente, o.contato, STATUS[o.status]].join(' ').toLowerCase().includes(q))));
}
// Contagens dos cartões. mes = 'AAAA-MM' (finalizadas e tempo médio do mês).
export function resumo(l, mes) {
  const r = { solicitada: 0, devolvida: 0, aprovada: 0, enviada: 0, liberada: 0, finalizadasMes: 0, esperaMedia: null, execMedia: null };
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
export function linhasExcel(l, areaNome = a => a) {
  return [['Nº OM', 'Situação', 'Área', 'Equipamento ou local', 'Serviço', 'Tipo', 'Prioridade', 'Solicitante', 'Hora da solicitação', 'Aprovada em', 'Cliente', 'Contato no cliente', 'Enviada ao cliente', 'Hora da liberação', 'Hora da finalização', 'Espera até liberar', 'Execução', 'Detalhes', 'Motivo (devolução/cancelamento)', 'Observação da finalização'],
    ...ordenar(l).map(o => { const x = tempos(o); return [o.numero || '', STATUS[o.status] || o.status, areaNome(o.area), [o.equip, o.local].filter(Boolean).join(' · '), o.titulo || '', TIPOS[o.tipo] || '', PRIORIDADES[o.prio] || '', o.solNome || '', horaBR(o.hSol), horaBR(o.hAprov), o.cliente || '', o.contato || '', horaBR(o.hEnvio), horaBR(o.hLib), horaBR(o.hFim), duracao(x.espera), duracao(x.execucao), o.desc || '', o.motivo || '', o.obsFim || '']; })];
}

/* ---------- avisos no celular (rotina de hora em hora) ---------- */
// Quem recebe o quê: solicitação nova → quem trata no conjunto; enviada → o usuário do cliente; devolvida e liberada → quem abriu.
// Só mudanças dos últimos 2 dias (as marcas de enviado duram 15 dias). usuarios = { uid: perfil }.
export function avisosOms(oms, usuarios, hoje) {
  const desde = (() => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); })();
  const l = [];
  for (const o of oms) {
    const ult = (o.hist || []).slice(-1)[0]; const quando = (ult && ult.em) || o.hSol || '';
    if (String(quando).slice(0, 10) < desde) continue;
    if (o.status === 'solicitada') {
      for (const [uid, u] of Object.entries(usuarios)) if (uid !== o.solPor && trataOmU({ ...u, uid }, o.conj)) l.push({ uid, tipo: 'nova', om: o, chave: `om|${uid}|${o.id}|${quando}` });
    } else if (o.status === 'enviada' && o.clienteUid && usuarios[o.clienteUid]) {
      l.push({ uid: o.clienteUid, tipo: 'enviada', om: o, chave: `om|${o.clienteUid}|${o.id}|enviada|${quando}` });
    } else if (['devolvida', 'liberada'].includes(o.status) && o.solPor && usuarios[o.solPor]) {
      l.push({ uid: o.solPor, tipo: o.status, om: o, chave: `om|${o.solPor}|${o.id}|${o.status}|${quando}` });
    }
  }
  return l;
}
