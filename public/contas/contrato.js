// Indicadores do contrato (Indicadores › Visão geral e Histórico), sem tela: os 8 indicadores com meta, as contas de cada
// um a partir dos números do mês e a soma de Pátio e Bateria. Usado pela tela (telas/contrato.js) e pelos testes.
// As metas e os valores de ICCC e ICCP (digitados pelo Gestor dos Indicadores) e o histórico dos meses ficam em
// config/indicadores: { metas: { abs: 3, ... }, valores: { 'AAAA-MM': { iccc, iccp } }, hist: { 'conj|AAAA-MM': números } }.
// Competência = mês civil (1º ao último dia), como no Meu painel.
import { lancamentosMesQZ } from './queda-zero.js';

// dir -1: quanto menor, melhor (a meta é o máximo) · dir 1: quanto maior, melhor (a meta é o mínimo).
// fonte: de onde vem o número (p = presença do conjunto, a = atividades, e = equipamentos, m = digitado no mês).
export const IND_CONTRATO = [
  { k: 'abs', nome: 'Absenteísmo', u: '%', dir: -1, meta: 3, fonte: 'p', aba: 'fpainel' },
  { k: 'he', nome: 'Horas extras', u: 'h', dir: -1, meta: 200, fonte: 'p', aba: 'eshe' },
  { k: 'hp', nome: 'Horas perdidas', u: 'h', dir: -1, meta: 50, fonte: 'e', aba: 'epainel' },
  { k: 'iccc', nome: 'ICCC', u: '%', dir: 1, meta: 95, fonte: 'm' },
  { k: 'iccp', nome: 'ICCP', u: '%', dir: 1, meta: 95, fonte: 'm' },
  { k: 'efic', nome: 'Eficiência da programação', u: '%', dir: 1, meta: 90, fonte: 'a', aba: 'painel' },
  { k: 'queda', nome: 'Queda Zero', u: 'quedas', dir: -1, meta: 0, fonte: 'a', aba: 'qpainel' },
  { k: 's5', nome: 'Nota 5S', u: '%', dir: 1, meta: 90, fonte: 'e', aba: 'epainel' }
];
export const indDe = k => IND_CONTRATO.find(i => i.k === k) || null;
const numOk = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));

// Meta em uso: a gravada em config/indicadores ou, sem ela, a padrão (as do Meu painel, aprovadas pelo Eduardo).
export const metaDe = (cfg, k) => { const m = ((cfg && cfg.metas) || {})[k]; return numOk(m) ? Number(m) : (indDe(k) || {}).meta; };
// Dentro da meta? true / false / null (sem número).
export function naMeta(cfg, k, v) {
  const i = indDe(k); if (!i || !numOk(v)) return null;
  return i.dir < 0 ? Number(v) <= metaDe(cfg, k) : Number(v) >= metaDe(cfg, k);
}
// Situação para a cor do cartão (guia visual): ok · critico · neutro.
export const situacaoInd = (cfg, k, v) => { const n = naMeta(cfg, k, v); return n === true ? 'ok' : n === false ? 'critico' : 'neutro'; };
// "≤ 3%" ou "≥ 95%".
export function textoMeta(cfg, k) {
  const i = indDe(k); if (!i) return '';
  return `${i.dir < 0 ? '≤' : '≥'} ${fmtNum(metaDe(cfg, k))}${i.u === '%' ? '%' : ' ' + i.u}`;
}
// Número com vírgula e até 1 casa (— sem número).
export const fmtNum = v => (numOk(v) ? (Math.round(Number(v) * 10) / 10).toLocaleString('pt-BR') : '—');

// ---- meses ----
export const mesMais = (ym, n) => { let [a, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; };
// Os n meses até ym (o mais antigo primeiro).
export const mesesAte = (ym, n) => Array.from({ length: n }, (_, i) => mesMais(ym, i - n + 1));
// Dias do mês até hoje (o mês que ainda não começou fica vazio).
export function diasDoMes(ym, hoje) {
  const out = []; const [a, m] = ym.split('-').map(Number); const fim = new Date(Date.UTC(a, m, 0)).getUTCDate();
  for (let d = 1; d <= fim; d++) { const dt = `${ym}-${String(d).padStart(2, '0')}`; if (dt > hoje) break; out.push(dt); }
  return out;
}

// ---- contas de cada fonte (números brutos do conjunto no mês) ----
// Atividades: realizadas ÷ programadas nos dias que já passaram (hoje entra), pelas semanas do mês (campo mes).
// Célula '_' = sem programação (também feriado e dispensada) · 'E' = extra (não entra na conta).
export function contarProgramacao(semanas, ym, hoje) {
  let R = 0, prog = 0;
  for (const w of semanas || []) {
    if (!w || w.mes !== ym || !w.ini) continue;
    const linhas = Array.isArray(w.d) ? w.d : (w.ids || []).map(p => (w.s && w.s[p]) || '');
    for (const str of linhas) for (let k = 0; k < 7; k++) {
      const c = String(str || '')[k]; if (!c || c === '_' || c === 'E') continue;
      if (addDia(w.ini, k) > hoje) continue;
      prog++; if (c === 'R') R++;
    }
  }
  return { R, prog };
}
const addDia = (ini, k) => { const d = new Date(ini + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
// Queda Zero: lançamentos de queda no mês (cada recolhimento registrado conta uma queda).
export const contarQuedas = (semanas, ym) => lancamentosMesQZ(semanas || [], ym).length;
// Presença: contagens de cada dia ({ escalados, porCodigo }) → escalados e ausências (falta e atestado, como no Meu painel).
export function contarAusencias(contagens) {
  let esc = 0, aus = 0;
  for (const c of contagens || []) { esc += c.escalados || 0; aus += ((c.porCodigo || {}).FT || 0) + ((c.porCodigo || {}).AT || 0); }
  return { esc, aus };
}

// ---- números brutos → indicadores ----
// Números de um conjunto no mês (o que fica guardado no histórico):
// esc, aus (dias escalados e ausências) · he (horas extras, h) · heD (dias de HE) · R, prog (atividades) · qz (quedas)
// · hp (horas paradas) · npar (paradas) · s5s, s5n (soma e quantidade das notas 5S, de 0 a 1).
export const CAMPOS = ['esc', 'aus', 'he', 'heD', 'R', 'prog', 'qz', 'hp', 'npar', 's5s', 's5n'];
// Soma dos conjuntos (Coqueria = Pátio + Bateria). Campo que falta em todos fica de fora (sem dado).
export function somarNumeros(lista) {
  const out = {}; const l = (lista || []).filter(Boolean);
  for (const c of CAMPOS) { const vs = l.map(x => x[c]).filter(numOk); if (vs.length) out[c] = Math.round(vs.reduce((s, v) => s + Number(v), 0) * 1000) / 1000; }
  return out;
}
// Indicadores a partir dos números (e dos valores digitados no mês: { iccc, iccp }).
export function calcularIndicadores(n = {}, dig = {}) {
  const v = x => (numOk(x) ? Number(x) : null);
  return {
    abs: v(n.esc) ? (v(n.aus) || 0) / n.esc * 100 : null,
    he: v(n.he),
    hp: v(n.hp),
    iccc: v((dig || {}).iccc),
    iccp: v((dig || {}).iccp),
    efic: v(n.prog) ? (v(n.R) || 0) / n.prog * 100 : null,
    queda: v(n.qz),
    s5: v(n.s5n) ? (v(n.s5s) || 0) / n.s5n * 100 : null
  };
}
// Quantos dos indicadores com número estão dentro da meta: { dentro, comValor }.
export function placar(cfg, vals) {
  let dentro = 0, comValor = 0;
  for (const i of IND_CONTRATO) { const n = naMeta(cfg, i.k, vals[i.k]); if (n === null) continue; comValor++; if (n) dentro++; }
  return { dentro, comValor };
}
// Os números mudaram (para não gravar o histórico à toa)? Compara com 2 casas.
export function mudouNumeros(a, b) {
  const r = x => (numOk(x) ? Math.round(Number(x) * 100) / 100 : null);
  return CAMPOS.some(c => r((a || {})[c]) !== r((b || {})[c]));
}

// ---- metas e valores digitados (Gestor dos Indicadores) ----
// Texto digitado ("96,5") → número; vazio = null; inválido = NaN.
export const lerNumero = s => { const t = String(s ?? '').trim().replace(/\s/g, ''); if (!t) return null; const n = Number(t.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
// Confere as metas e os valores de ICCC/ICCP do formulário. Devolve { metas, valores } ou lança o erro em português.
export function conferirMetas(metasTxt, iccTxt) {
  const metas = {};
  for (const i of IND_CONTRATO) {
    const n = lerNumero((metasTxt || {})[i.k]);
    if (n === null) continue;
    if (Number.isNaN(n) || n < 0 || (i.u === '%' && n > 100) || n > 100000) throw new Error(`Meta de ${i.nome} inválida.`);
    metas[i.k] = n;
  }
  const valores = {};
  for (const k of ['iccc', 'iccp']) {
    const n = lerNumero((iccTxt || {})[k]);
    if (Number.isNaN(n) || (n !== null && (n < 0 || n > 100))) throw new Error(`${k.toUpperCase()} inválido: use um número de 0 a 100.`);
    valores[k] = n;
  }
  return { metas, valores };
}
