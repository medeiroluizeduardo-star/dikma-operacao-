// Dikma Gestão — Segurança: listas dos formulários, quem vê e quem trata cada registro e as contas do painel.
// Sem tela e sem banco: usado pelo site (telas/seguranca.js, Meu dia, dados) e pela rotina de avisos
// (integracao/avisos, que copia este arquivo para lib/). As regras do Firestore fazem as mesmas contas.
//
// Quem faz o quê (perfil no módulo Segurança, campo acesso.seguranca do cadastro):
//   registra → registra interações e anomalias e vê só o que registrou
//   trata    → vê tudo e trata as anomalias de todas as áreas (técnico de segurança)
//   gestor   → igual ao trata (e, com a Administração 'Dos módulos', cuida das listas)
//   leitor   → vê tudo, sem registrar nem tratar
// Supervisor da área (Operação · Supervisor com a área dele dentro do Pátio ou da Bateria): vê e trata as anomalias
// e vê as interações da área, mesmo sem perfil na Segurança.
import { SETS, SET_KEYS } from './cal.js';
import { perfilDe, escoposDe, areasDoCadastro } from './acessos.js';

// Valores padrão das listas (os mesmos dos formulários do Google). Editáveis em Administração › Segurança.
export const DESVIOS_PADRAO = ['ADESIVO DE QUALIFICAÇÃO', 'ANÁLISE DE RISCO', 'CELULAR', 'EPI', 'FERRAMENTAS MANUAIS', 'IÇAMENTO DE CARGA', 'INSPEÇÃO DE PRÉ-USO', 'SEGURANÇA EM TRILHOS', 'VEÍCULOS E DIREÇÃO', 'ADORNOS', 'ARRUMAÇÃO E LIMPEZA', 'EMERGÊNCIA', 'ESPAÇO CONFINADO', 'GÁS', 'IMPEDIMENTO/BLOQUEIO', 'ISOLAMENTO DE ÁREA', 'TRABALHO EM ALTURA', 'OUTROS'];
// conj = conjunto das Atividades da área (patio | bateria): diz quem é o supervisor da área.
export const SEG_PADRAO = {
  areas: [{ nome: 'PÁTIO DE CARVÃO', conj: 'patio' }, { nome: 'BATERIA', conj: 'bateria' }, { nome: 'SINTER', conj: 'sinter' }],
  tipos: ['ROTINA', 'PARADA'],
  regimes: ['ADM', 'TURNO'],
  desvios: DESVIOS_PADRAO
};
const limpa = l => [...new Set((Array.isArray(l) ? l : []).map(x => String(x || '').replace(/\s+/g, ' ').trim().toUpperCase()).filter(Boolean))];
// Listas em uso: as gravadas (config/seguranca) ou as padrão. "OUTROS" fica sempre por último nos desvios.
export function listasSeg(cfg) {
  const c = cfg || {};
  const areas = Array.isArray(c.areas) && c.areas.length ? c.areas.map(a => ({ nome: String(a.nome || '').trim().toUpperCase(), conj: SETS[a.conj] ? a.conj : '' })).filter(a => a.nome) : SEG_PADRAO.areas;
  const tipos = limpa(c.tipos).length ? limpa(c.tipos) : SEG_PADRAO.tipos;
  const regimes = limpa(c.regimes).length ? limpa(c.regimes) : SEG_PADRAO.regimes;
  const d = limpa(c.desvios).length ? limpa(c.desvios) : DESVIOS_PADRAO;
  return { areas, tipos, regimes, desvios: [...d.filter(x => x !== 'OUTROS'), 'OUTROS'] };
}
export const conjDaArea = (cfg, area) => (listasSeg(cfg).areas.find(a => a.nome === area) || {}).conj || '';

// ---- Perfis ----
export const perfilSeg = u => perfilDe(u, 'seguranca');
// Conjuntos (patio, bateria) em que a pessoa é supervisora da área: Operação · Supervisor, com o escopo e a área
// (uma das áreas dele) dentro do conjunto. As regras conferem do mesmo jeito.
export function supConjs(u) {
  if (!u || perfilDe(u, 'operacao') !== 'supervisor') return [];
  const esc = escoposDe(u);
  return SET_KEYS.filter(k => esc.includes(k) && areasDoCadastro(u, true).some(a => SETS[k].areas.includes(a)));
}
export const registraSeg = u => ['admin', 'registra', 'trata', 'gestor'].includes(perfilSeg(u));
export const veTudoSeg = u => ['admin', 'trata', 'gestor', 'leitor'].includes(perfilSeg(u));
export const trataTudoSeg = u => ['admin', 'trata', 'gestor'].includes(perfilSeg(u));
// Tem o módulo Segurança: perfil na Segurança ou supervisor de alguma área.
export const temSeg = u => !!u && u.papel !== 'bloqueado' && (!!perfilSeg(u) || supConjs(u).length > 0);
// Vê o registro: quem vê tudo, o autor, ou o supervisor da área do registro.
export const veRegSeg = (u, r) => !!u && !!r && (veTudoSeg(u) || (registraSeg(u) && r.por === u.uid) || supConjs(u).includes(r.conj));
// Trata a anomalia (acompanhamento): trata, gestor, administrador e o supervisor da área.
export const trataAnom = (u, a) => !!u && !!a && (trataTudoSeg(u) || supConjs(u).includes(a.conj));
// O autor edita o próprio registro por 24 horas (a anomalia, só enquanto estiver aberta).
export const PRAZO_EDICAO_H = 24;
export const editaProprio = (u, r, agoraMs, anom) => registraSeg(u) && !!r && r.por === u.uid && (!anom || r.status === 'aberta') && agoraMs - (+r.em || 0) < PRAZO_EDICAO_H * 36e5;

// ---- Situação das anomalias ----
export const STATUS_SEG = { aberta: 'Aberta', tratamento: 'Em tratamento', concluida: 'Concluída' };
export const abertaSeg = a => !!a && a.status !== 'concluida';
export const vencidaSeg = (a, hoje) => abertaSeg(a) && !!(a.trat && a.trat.prazo) && a.trat.prazo < hoje;
export const normNomeSeg = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
// A anomalia está com a pessoa (responsável pelo tratamento): pelo usuário escolhido ou pelo nome digitado.
export const comigoSeg = (u, a) => !!u && !!a && !!a.trat && ((!!a.trat.respUid && a.trat.respUid === u.uid) || (!!a.trat.resp && normNomeSeg(a.trat.resp) === normNomeSeg(u.nome)));
// Dias corridos entre o registro e a conclusão (tempo de tratamento).
// Fotos guardadas (segfotos) de um registro: as do registro e a do depois do tratamento. Vão junto quando ele é apagado.
export const fotosDoReg = r => [...new Set([...((r && r.fotos) || []), ...(r && r.trat && r.trat.fotoDepois ? [r.trat.fotoDepois] : [])].filter(Boolean))];
export const diasTratamento = a => (a && a.status === 'concluida' && a.conclEm && a.em ? Math.max(0, (Date.parse(a.conclEm) - (+a.em)) / 864e5) : null);

// ---- Cartão Amarelo (Direito ao Trabalho Seguro) ----
// As 3 perguntas do cartão de papel: quem dá o cartão marca a que teve resposta NÃO.
export const PERG_CARTAO = ['OS RECURSOS ESTÃO SUFICIENTES E ADEQUADOS?', 'ME SINTO EM CONDIÇÕES PARA A TAREFA?', 'O AMBIENTE ESTÁ SEGURO?'];
// Quem valida (o "Validação" do cartão): Seg. do Trabalho = perfil trata/gestor da Segurança (e o administrador);
// Líder imediato = o supervisor da área do cartão. Os mesmos que tratam as anomalias; as regras conferem igual.
export const VALIDA_CARTAO = { lider: 'Líder imediato', seg: 'Seg. do Trabalho' };
export const validaCartao = (u, c) => !!u && !!c && (trataTudoSeg(u) || supConjs(u).includes(c.conj));
export const pendenteCartao = c => !!c && c.status !== 'validado';

// ---- Painel ----
const conta = (l, f) => { const m = new Map(); for (const x of l) for (const k of [].concat(f(x) || [])) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
// Interações por pessoa (o RESPONSÁVEL do formulário): junta grafias diferentes do mesmo nome e mostra a primeira.
function porNome(l) {
  const m = new Map();
  for (const r of l) { const nome = String(r.resp || r.porNome || '').replace(/\s+/g, ' ').trim(); const k = normNomeSeg(nome); if (!k) continue; const x = m.get(k) || [nome, 0]; x[1]++; m.set(k, x); }
  return [...m.values()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}
// inter/anom: registros já carregados; mes = AAAA-MM do painel; meses = os meses do gráfico (antigo → novo).
export function indicadoresSeg({ inter = [], anom = [], mes, meses = [], hoje, areas = [] }) {
  const iM = inter.filter(r => r.mes === mes), aM = anom.filter(a => a.mes === mes);
  const comDesvio = iM.filter(r => (r.desvios || []).length);
  const conclM = anom.filter(a => a.status === 'concluida' && String(a.conclEm || '').slice(0, 7) === mes);
  const tempos = conclM.map(diasTratamento).filter(x => x != null);
  const abertasAgora = anom.filter(abertaSeg);
  const nomesArea = [...new Set([...areas, ...iM.map(r => r.area), ...aM.map(a => a.area)])].filter(Boolean);
  return {
    interMes: iM.length, comDesvio: comDesvio.length,
    anomMes: aM.length, abertasMes: aM.filter(abertaSeg).length, concluidasMes: aM.filter(a => a.status === 'concluida').length,
    concluidasNoMes: conclM.length, abertasAgora: abertasAgora.length, vencidas: abertasAgora.filter(a => vencidaSeg(a, hoje)).length,
    tempoMedio: tempos.length ? tempos.reduce((s, x) => s + x, 0) / tempos.length : null,
    porMes: meses.map(m => ({ mes: m, inter: inter.filter(r => r.mes === m).length, anom: anom.filter(a => a.mes === m).length })),
    porPessoa: porNome(iM),
    desvios: conta(iM, r => (r.desvios || []).map(d => (d === 'OUTROS' && r.desvioOutro ? 'OUTROS' : d))),
    porArea: nomesArea.map(a => ({ area: a, inter: iM.filter(r => r.area === a).length, abertas: aM.filter(x => x.area === a && abertaSeg(x)).length, concluidas: aM.filter(x => x.area === a && x.status === 'concluida').length }))
  };
}

// Dia (AAAA-MM-DD, hora local) em que a anomalia foi concluída.
const diaLocal = iso => { const d = new Date(Date.parse(iso)); return isNaN(+d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Concluída dentro do prazo? null quando não tinha prazo (não entra na conta).
export const noPrazoSeg = a => (a && a.status === 'concluida' && a.trat && a.trat.prazo && a.conclEm ? diaLocal(a.conclEm) <= a.trat.prazo : null);

// Painel da Segurança: os números do indicadoresSeg + Cartão Amarelo, prazo, pendências, áreas e reincidência.
// cartao: cartões carregados (os do mês e os pendentes de qualquer mês); area: '' = todas.
export function painelSeg({ inter = [], anom = [], cartao = [], mes, meses = [], hoje, areas = [], area = '' }) {
  const daArea = l => (area ? l.filter(x => x.area === area) : l);
  inter = daArea(inter); anom = daArea(anom); cartao = daArea(cartao);
  const base = indicadoresSeg({ inter, anom, mes, meses, hoje, areas: area ? [area] : areas });
  const cM = cartao.filter(c => c.mes === mes);
  const concl = anom.filter(a => a.status === 'concluida' && diaLocal(a.conclEm).slice(0, 7) === mes);
  const comPrazo = concl.filter(a => noPrazoSeg(a) != null), noPrazo = comPrazo.filter(noPrazoSeg).length;
  const abertas = anom.filter(abertaSeg);
  // Reincidência: o mesmo desvio na mesma área 3 vezes ou mais no mês.
  const rep = new Map(); for (const r of inter) if (r.mes === mes) for (const dv of r.desvios || []) { const k = r.area + '|' + dv; rep.set(k, (rep.get(k) || 0) + 1); }
  const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
  return {
    ...base,
    porMes: base.porMes.map(x => ({ ...x, cartao: cartao.filter(c => c.mes === x.mes).length })),
    prazo: { concluidas: comPrazo.length, noPrazo, pct: pct(noPrazo, comPrazo.length), semPrazo: concl.length - comPrazo.length },
    semResp: abertas.filter(a => !(a.trat && a.trat.resp)).length,
    cartaoMes: cM.length, cartaoValidados: cM.filter(c => c.status === 'validado').length,
    cartaoPendentes: cartao.filter(pendenteCartao).length,
    faltou: PERG_CARTAO.map(p => [p, cM.filter(c => (c.faltou || []).includes(p)).length]),
    repetidos: [...rep].filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [ar, dv] = k.split('|'); return { area: ar, desvio: dv, vezes: v }; }),
    porArea: base.porArea.map(x => {
      const iA = inter.filter(r => r.mes === mes && r.area === x.area), ab = abertas.filter(a => a.area === x.area);
      return { ...x, comDesvio: pct(iA.filter(r => (r.desvios || []).length).length, iA.length), anomMes: anom.filter(a => a.mes === mes && a.area === x.area).length,
        abertasAgora: ab.length, vencidas: ab.filter(a => vencidaSeg(a, hoje)).length, cartoes: cM.filter(c => c.area === x.area).length };
    }).filter(x => x.inter || x.anomMes || x.abertasAgora || x.cartoes)
      .sort((a, b) => b.vencidas - a.vencidas || b.abertasAgora - a.abertasAgora || b.inter - a.inter || (a.area < b.area ? -1 : 1))
  };
}

// ---- Avisos no celular (rotina do GitHub) ----
// anom: anomalias em aberto (aberta ou em tratamento) · usuarios: { uid: cadastro } · agoraMs, hoje, amanha.
// Devolve [{ tipo: 'nova' | 'amanha' | 'vencida', uid, a, chave }]: anomalia nova (até 24 h) para quem trata e para
// o supervisor da área (menos o próprio autor); prazo amanhã e prazo vencido para o responsável pelo tratamento.
export function avisosSeg({ anom = [], usuarios = {}, agoraMs, hoje, amanha }) {
  const l = [];
  const us = Object.entries(usuarios).map(([uid, u]) => ({ uid, ...u })).filter(u => u.papel !== 'bloqueado');
  for (const a of anom) {
    if (!abertaSeg(a)) continue;
    // o administrador não entra aqui (recebe só se for o responsável): o aviso é para quem trata no dia a dia
    if (a.em && agoraMs - (+a.em) < 864e5) for (const u of us) if (u.uid !== a.por && (['trata', 'gestor'].includes(perfilSeg(u)) || supConjs(u).includes(a.conj))) l.push({ tipo: 'nova', uid: u.uid, a, chave: `sga|${a.id}` });
    const p = a.trat && a.trat.prazo; if (!p || (p !== amanha && p >= hoje)) continue;
    const tipo = p === amanha ? 'amanha' : 'vencida';
    for (const u of us) if (comigoSeg(u, a)) l.push({ tipo, uid: u.uid, a, chave: `sg${tipo === 'amanha' ? 'p1' : 'pv'}|${a.id}|${p}` });
  }
  return l;
}
