// Dikma Gestão — Medição do contrato (sem tela): real × contratado por função, no mesmo jeito da planilha de medição.
// Fonte: a Presença lançada no sistema (não o ponto). Cada função do contrato tem uma linha ADM e uma de turno.
// Regras (as da planilha):
//   - ADM: conta nos dias de segunda a sexta (sábado e domingo valem 0); turno: todos os dias.
//   - No dia, vale quem está presente (presente, atrasado ou saída antecipada), no máximo o número de postos do dia.
//     O que passa dos postos fica em "acima do contratado". Sem postos cadastrados, conta todo mundo.
//   - Coordenador: valor fixo (os postos, ex.: 0,5) em cada dia útil já passado, porque é dividido entre as áreas.
//   - Real (FTE) = soma do mês ÷ dias de referência (ADM: dias úteis do mês, sem feriados; turno: 16, ajustável).
//   - Diferença = real − contratado. Dias depois de hoje não contam.
// Hora extra: a do Banco de horas extras (informada ou estimada); a noturna é a parte entre 22h e 5h (só com horário).
// Configuração (config/sistema.medicao de cada conjunto): { refTurno, n: { 'base|ADM': { postos, cont } }, mapa: { FUNÇÃO: base | '' } }

export const REGS = ['ADM', 'TURNO'];
export const REG_NOME = { ADM: 'ADM', TURNO: 'Turno' };
// Funções do contrato na ordem da medição.
export const BASES = [
  { k: 'coord', nome: 'Coordenador', fixo: true },
  { k: 'sup', nome: 'Supervisor' },
  { k: 'lider', nome: 'Líder' },
  { k: 'tst', nome: 'TST' },
  { k: 'artifice', nome: 'Artífice' },
  { k: 'exec', nome: 'Executante' },
  { k: 'opproc', nome: 'Operador de processos' },
  { k: 'retro', nome: 'Operador de retro' },
  { k: 'escav', nome: 'Operador de mini escavadeira' },
  { k: 'mpres', nome: 'Motorista op. equipamentos (média pressão)' },
  { k: 'apres', nome: 'Motorista op. equipamentos (alta pressão)' },
  { k: 'jatista', nome: 'Jatista' },
  { k: 'minipa', nome: 'Operador de mini pá carregadeira' }
];
export const BASE = Object.fromEntries(BASES.map(b => [b.k, b]));
// Reconhecimento automático da função do cadastro (sem acento, em maiúsculas). A ordem importa: o mais específico primeiro.
const REGRAS = [
  ['minipa', /MINI ?PA\b|PA CARREGADEIRA/], ['escav', /ESCAVADEIRA/], ['retro', /RETRO/], ['apres', /ALTA PRESSAO/],
  ['mpres', /MEDIA PRESSAO|MOTORISTA/], ['jatista', /JATISTA/], ['coord', /COORDENADOR/], ['sup', /SUPERVISOR/],
  ['tst', /\bTST\b|TECNICO DE SEGURANCA|TEC\.? SEGURANCA/], ['lider', /LIDER|ENCARREGADO/], ['artifice', /ARTIFICE/],
  ['exec', /EXECUTANTE|AJUDANTE/], ['opproc', /OPERADOR/]
];
// Nome da função como chave: sem acento, maiúsculas, sem a turma no fim ("EXECUTANTE TURNO (B)" → "EXECUTANTE TURNO").
export const chaveFuncao = f => String(f || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\(\s*[A-Z]\s*\)\s*$/, '').replace(/\s+/g, ' ').trim();
// Função do contrato da pessoa: a escolhida pelo administrador (mapa; '' = fora da medição) ou a reconhecida pelo nome.
export function baseDe(funcao, mapa = {}) {
  const k = chaveFuncao(funcao); if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(mapa || {}, k)) return mapa[k] && BASE[mapa[k]] ? mapa[k] : null;
  for (const [b, re] of REGRAS) if (re.test(k)) return b;
  return null;
}
export const idLinha = (base, reg) => base + '|' + reg;
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
export function cfgMedicao(c) {
  const x = (c && typeof c === 'object' ? c : {});
  const n = {}; for (const [k, v] of Object.entries(x.n || {})) n[k] = { postos: num(v && v.postos), cont: num(v && v.cont) };
  const rt = num(x.refTurno);
  return { refTurno: rt > 0 ? rt : 16, n, mapa: { ...(x.mapa || {}) } };
}

const dow = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay();
export const fimDeSemana = d => { const w = dow(d); return w === 0 || w === 6; };
export function diasDoMes(m) { const out = []; const [y, mm] = m.split('-').map(Number); const n = new Date(y, mm, 0).getDate(); for (let i = 1; i <= n; i++) out.push(`${m}-${String(i).padStart(2, '0')}`); return out; }
// Dias úteis do mês: segunda a sexta, sem os feriados (Map ou Set de 'AAAA-MM-DD').
export const diasUteis = (m, feriados) => diasDoMes(m).filter(d => !fimDeSemana(d) && !(feriados && feriados.has(d))).length;
// Situações que contam como dia trabalhado na medição (a hora extra em dia de folga conta à parte).
export const TRABALHOU = new Set(['P', 'ATR', 'SA']);

// Valor de uma linha num dia (null = dia que ainda não chegou).
export function valorDia(linha, presentes, dia, hoje) {
  if (dia > hoje) return null;
  if (linha.reg === 'ADM' && fimDeSemana(dia)) return 0;
  if (linha.fixo) return linha.postos;
  return linha.postos > 0 ? Math.min(presentes, linha.postos) : presentes;
}

// Minutos de hora extra entre 22h e 5h. ini/fim 'HH:MM'; fim menor que o início = virou o dia.
const minDe = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
export function minutosNoturnos(ini, fim) {
  const a = minDe(ini); let b = minDe(fim); if (a == null || b == null) return 0;
  if (b <= a) b += 1440;
  let t = 0; for (const [x, y] of [[0, 300], [1320, 1740], [2760, 3180]]) t += Math.max(0, Math.min(b, y) - Math.max(a, x));
  return t;
}

const r2 = v => Math.round(v * 100) / 100;
// A medição do mês. pessoas: [{ id, nome, funcao }]; sitDe(c, d) = código do dia; regDe(c, d) = 'ADM' | 'TURNO';
// he: [{ c, d, conta (horas), det: { ini, fim } }] (Banco de horas extras); feriados: Map/Set; hoje: 'AAAA-MM-DD'.
export function medir({ m, pessoas = [], sitDe, regDe, he = [], feriados = null, hoje, cfg: cfg0 }) {
  const cfg = cfgMedicao(cfg0); const dias = diasDoMes(m);
  const refAdm = diasUteis(m, feriados) || 1; const refTurno = cfg.refTurno;
  const L = new Map();
  for (const b of BASES) for (const reg of REGS) {
    if (b.fixo && reg === 'TURNO') continue;
    const id = idLinha(b.k, reg); const nn = cfg.n[id] || { postos: 0, cont: 0 };
    L.set(id, { id, base: b.k, nome: b.nome, reg, fixo: !!b.fixo, postos: nn.postos, cont: nn.cont, pres: dias.map(() => 0), pessoas: new Set(), faltas: 0, he: 0, hen: 0, faltasLista: [] });
  }
  const semLinha = new Map(); const linhaDe = new Map();
  for (const c of pessoas) {
    const b = baseDe(c.funcao, cfg.mapa);
    if (!b) { const k = chaveFuncao(c.funcao) || '(sem função)'; const x = semLinha.get(k) || { n: 0, nome: String(c.funcao || '(sem função)').replace(/\(\s*[A-Za-z]\s*\)\s*$/, '').trim() }; x.n++; semLinha.set(k, x); continue; }
    linhaDe.set(c.id, b);
    dias.forEach((d, i) => {
      if (d > hoje) return;
      const reg = BASE[b].fixo ? 'ADM' : regDe(c, d) === 'TURNO' ? 'TURNO' : 'ADM';
      const l = L.get(idLinha(b, reg)); const v = sitDe(c, d);
      if (TRABALHOU.has(v)) { l.pres[i]++; l.pessoas.add(c.id); }
      if (v === 'FT') { l.faltas++; l.faltasLista.push({ c, d }); }
    });
  }
  for (const x of he) {
    const b = linhaDe.get(x.c.id); if (!b || x.d.slice(0, 7) !== m || x.d > hoje) continue;
    const reg = BASE[b].fixo ? 'ADM' : regDe(x.c, x.d) === 'TURNO' ? 'TURNO' : 'ADM';
    const l = L.get(idLinha(b, reg)); const h = Number(x.conta) || 0; l.he += h;
    if (x.det && x.det.ini && x.det.fim) l.hen += Math.min(h, minutosNoturnos(x.det.ini, x.det.fim) / 60);
  }
  const linhas = [];
  for (const l of L.values()) {
    const dia = dias.map((d, i) => valorDia(l, l.pres[i], d, hoje));
    const soma = dia.reduce((n, v) => n + (v || 0), 0);
    const acima = l.fixo || !(l.postos > 0) ? 0 : dias.reduce((n, d, i) => n + (d <= hoje && !(l.reg === 'ADM' && fimDeSemana(d)) ? Math.max(0, l.pres[i] - l.postos) : 0), 0);
    const ref = l.reg === 'TURNO' ? refTurno : refAdm; const real = r2(soma / ref);
    const usa = l.postos > 0 || l.cont > 0 || l.pessoas.size > 0 || l.he > 0 || l.faltas > 0;
    linhas.push({ ...l, pessoas: l.pessoas.size, dia, soma: r2(soma), acima, real, dif: r2(real - l.cont), he: r2(l.he), hen: r2(l.hen), usa });
  }
  const vis = linhas.filter(l => l.usa);
  const tot = k => r2(vis.reduce((n, l) => n + l[k], 0));
  return {
    dias, refAdm, refTurno, linhas: vis, todas: linhas,
    total: { cont: tot('cont'), real: tot('real'), dif: tot('dif'), he: tot('he'), hen: tot('hen'), faltas: tot('faltas'), acima: tot('acima'), postosAdm: r2(vis.filter(l => l.reg === 'ADM').reduce((n, l) => n + l.postos, 0)), postosTurno: r2(vis.filter(l => l.reg === 'TURNO').reduce((n, l) => n + l.postos, 0)) },
    semLinha: [...semLinha.entries()].map(([funcao, x]) => ({ funcao, nome: x.nome, n: x.n })).sort((a, b) => b.n - a.n || a.funcao.localeCompare(b.funcao))
  };
}
