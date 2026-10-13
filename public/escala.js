// Dikma Operação — escala de turno (fonte única para todos os módulos).
// Diz se uma pessoa está prevista para trabalhar num dia, pelo regime e pela letra da turma:
//   Administrativo: dias da semana marcados (padrão seg a sex) e feriados sem operação = folga.
//   Turnos em ciclo (4x4, 3x3…): a partir do 1º dia de trabalho de um ciclo de cada turma, conta N dias de trabalho e N de folga.
// Fica em config/escalas. Sem esse documento, usa as turmas 4x4 da Operação (eq/config), para não perder o que já existe.
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const NOME_DIA = DIAS;
export const REGIMES_PADRAO = {
  ADM: { nome: 'Administrativo', tipo: 'semana', dias: [1, 2, 3, 4, 5] },
  '4x4': { nome: 'Turno 4x4', tipo: 'ciclo', trab: 4, folga: 4, turmas: { A: '', B: '', C: '', D: '' } },
  '3x3': { nome: 'Turno 3x3', tipo: 'ciclo', trab: 3, folga: 3, turmas: { I: '', J: '' } }
};
const dif = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
const dow = d => new Date(d + 'T12:00:00').getDay();
// "TURNO 4X4", "4x4", "Turno 4 x 4" → 4x4 · "ADMINISTRATIVO", "Adm", vazio → ADM
export function normRegime(txt, regimes = REGIMES_PADRAO) {
  const t = String(txt || '').toUpperCase();
  const m = t.match(/(\d+)\s*X\s*(\d+)/); if (m) { const k = `${m[1]}x${m[2]}`; return regimes[k] ? k : k; }
  if (!t.trim() || /ADM/.test(t)) return 'ADM';
  const k = Object.keys(regimes).find(x => t.includes(String(regimes[x].nome || x).toUpperCase())); return k || 'ADM';
}
const letraOk = s => /^[A-Z]{1,2}$/.test(String(s || '').trim().toUpperCase());
export const letra = s => (letraOk(s) ? String(s).trim().toUpperCase() : '');

// Parte do quadro que trabalha num dia típico: administrativo = 1; 4x4 = 4/8; 3x3 = 3/6.
// Usado no "necessário" de rotas de turno, cujo efetivo padrão é o quadro inteiro e não o de um dia.
export function fatorRota(cs, regimes = REGIMES_PADRAO) {
  if (!cs || !cs.length) return 1; let s = 0;
  for (const c of cs) { const r = regimes[normRegime(c.regime, regimes)]; const n = r && r.tipo === 'ciclo' ? (+r.trab || 0) + (+r.folga || 0) : 0; s += n ? (+r.trab || 0) / n : 1; }
  return s / cs.length;
}
// cfg = config/escalas · eqTurmas = turmas da Operação (reserva) · feriados = [{data, semOp}]
export function criarEscala(cfg = {}, eqTurmas = {}, feriadosEq = []) {
  const R = {};
  for (const [k, base] of Object.entries(REGIMES_PADRAO)) R[k] = { ...base, ...((cfg.regimes || {})[k] || {}) };
  for (const [k, v] of Object.entries(cfg.regimes || {})) if (!R[k]) R[k] = v;
  // 4x4 sem datas na configuração central: aproveita as da Operação
  const t4 = R['4x4'].turmas || {};
  if (!Object.values(t4).some(Boolean)) { const n = {}; for (const [l, d] of Object.entries(eqTurmas || {})) if (letraOk(l) && d) n[l] = d; if (Object.keys(n).length) R['4x4'] = { ...R['4x4'], turmas: { ...t4, ...n } }; }
  const fer = new Map(); for (const f of [...(feriadosEq || []), ...(cfg.feriados || [])]) if (f && f.data && f.semOp !== false) fer.set(f.data, f.desc || 'feriado');
  // { trab: true|false, motivo } ou null quando não dá para saber (turno sem letra ou sem data da turma)
  function previsto(regime, turma, data) {
    const r = R[regime]; if (!r) return null;
    if (r.tipo === 'semana') {
      if (!(r.dias || [1, 2, 3, 4, 5]).includes(dow(data))) return { trab: false, motivo: 'fim de semana' };
      if (fer.has(data)) return { trab: false, motivo: fer.get(data) };
      return { trab: true, motivo: '' };
    }
    const base = (r.turmas || {})[turma]; if (!base) return null;
    const n = (+r.trab || 0) + (+r.folga || 0); if (!n) return null;
    const i = ((dif(base, data) % n) + n) % n;
    return i < r.trab ? { trab: true, motivo: '' } : { trab: false, motivo: `folga da turma ${turma}` };
  }
  // letras que trabalham no dia, por regime de ciclo
  const turmasDoDia = (regime, data) => Object.keys((R[regime] || {}).turmas || {}).filter(l => { const p = previsto(regime, l, data); return p && p.trab; });
  return { regimes: R, previsto, turmasDoDia, feriados: fer };
}
