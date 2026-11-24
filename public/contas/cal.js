// Calendário operacional e constantes compartilhadas.
// Regra da planilha: a semana (seg–dom) pertence ao mês da sua quinta-feira.

// Conjuntos de atividades: cada um é um módulo com as próprias áreas, plano, semanas e efetivo diário.
// pre = prefixo das coleções no Firestore (o Pátio usa os nomes originais).
export const SETS = {
  patio: { mod: 'operacao', nome: 'Atividades Pátio', curto: 'Pátio', local: 'Pátio de Carvão', pre: '', seed: 'seed.json', idp: 'C', areas: ['RECEBIMENTO', 'FINAL DO PÁTIO', 'PREPARAÇÃO', 'TRATAMENTO DE COQUE'], gerais: ['COQUERIA GERAL', 'COQUERIA PÁTIO', 'SINTER'] },
  bateria: { mod: 'bateria', nome: 'Atividades Bateria', curto: 'Bateria', local: 'Bateria', pre: 'b_', seed: 'seed-bateria.json', idp: 'B', areas: ['BATERIA 1', 'BATERIA 2', 'TRILHO', 'CDQ'], gerais: ['COQUERIA BATERIA'] }
};
export const SET_KEYS = Object.keys(SETS);
export const AREAS = SETS.patio.areas;
export const AREAS_ATIV = SET_KEYS.flatMap(k => SETS[k].areas);
// Áreas de atuação sem rota de atividades (coordenação, técnicos, apoio): a pessoa entra na Escala do dia do
// conjunto, mas a área não tem plano, apontamento nem indicador de atividades. Ficam em colaboradores/{ÁREA} como as outras.
export const AREAS_GERAIS = SET_KEYS.flatMap(k => SETS[k].gerais);
export const ehAreaGeral = a => AREAS_GERAIS.includes(a);
// Áreas que não são da Coqueria (Sinter, 24/11/2026): ficam na Escala do dia e na Frequência do Pátio, como a Coqueria
// Geral, mas saem da Medição e dos números do contrato da Coqueria (ICCC/ICCP, Visão geral).
export const AREAS_FORA_COQUERIA = ['SINTER'];
export const foraDaCoqueria = a => AREAS_FORA_COQUERIA.includes(a);
// Todas as áreas onde ficam pessoas do conjunto (atividades + gerais).
export const areasDoSet = k => [...SETS[k].areas, ...SETS[k].gerais];
export const setDaArea = a => SET_KEYS.find(k => areasDoSet(k).includes(a)) || null;
export const AREA_S = { 'COQUERIA GERAL': 'Coqueria Geral', 'COQUERIA PÁTIO': 'Coqueria Pátio', 'COQUERIA BATERIA': 'Coqueria Bateria', 'SINTER': 'Sinter', 'RECEBIMENTO': 'Recebimento', 'FINAL DO PÁTIO': 'Final do Pátio', 'PREPARAÇÃO': 'Preparação', 'TRATAMENTO DE COQUE': 'Tratamento de Coque', 'BATERIA 1': 'Bateria 1', 'BATERIA 2': 'Bateria 2', 'TRILHO': 'Trilho', 'CDQ': 'CDQ' };
export const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
export const DL = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
export const MESES_L = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MOTIVOS = ['Efetivo insuficiente', 'Equipamento indisponível', 'Área não liberada pela operação', 'Chuva / condição climática', 'Prioridade operacional', 'Falta de material / EPI', 'Outro'];
// Códigos de situação: a tabela única fica em situacao.js; estes nomes continuam valendo para quem já usa.
export { SITS, AUSENTE, AUSENCIA } from './situacao.js';
export const PAPEIS = [['admin', 'Administrador'], ['gestor', 'Gestor'], ['coordenador', 'Coordenador'], ['supervisor', 'Supervisor'], ['tecnico', 'Técnico de Processo'], ['lider', 'Líder'], ['administrativo', 'Administrativo'], ['leitor', 'Somente leitura'], ['bloqueado', 'Bloqueado']];
export const ATIVOS = new Set(['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor']);

export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const pd = s => (s.length === 10 ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : (([y, m, d]) => new Date(y, m - 1, d))(s.split('-').map(Number)));
// add() é chamada milhares de vezes por tela (semanas, escalas, prazos): guarda as contas já feitas.
const ADD = new Map();
export const add = (s, n) => {
  const k = s + '|' + n; let r = ADD.get(k); if (r !== undefined) return r;
  const d = pd(s); d.setDate(d.getDate() + n); r = iso(d);
  if (ADD.size > 50000) ADD.clear(); ADD.set(k, r); return r;
};
export const ddmm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
export const today = () => iso(new Date());

export function weeksOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const dow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  let mon = iso(new Date(y, m - 1, 1 - dow));
  if (add(mon, 3).slice(0, 7) < ym) mon = add(mon, 7);
  const out = [];
  while (add(mon, 3).slice(0, 7) === ym) { out.push(mon); mon = add(mon, 7); }
  return out;
}
export const weekOf = s => { const d = pd(s); return add(s, -((d.getDay() + 6) % 7)); };
export const monthOfWeek = ini => add(ini, 3).slice(0, 7);
export const weekLabel = ini => { const n = weeksOfMonth(monthOfWeek(ini)).indexOf(ini) + 1; return `S${n} · ${ddmm(ini)} a ${ddmm(add(ini, 6))}`; };
export const monthLabel = ym => `${MESES_L[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

// Monta o documento de uma semana a partir do plano padrão da área.
export function novaSemana(area, ini, itens) {
  const acts = itens.filter(p => p.ativo !== false);
  const s = {};
  for (const p of acts) s[p.id] = [...p.dias].map(c => (c === '1' ? 'P' : '_')).join('');
  return { area, ini, mes: monthOfWeek(ini), ids: acts.map(p => p.id), s, m: {} };
}

// Converte o seed (extraído da planilha) para a estrutura do banco.
export function seedParaBanco(seed, areas = AREAS) {
  const plano = {}, colabs = {}, sit = {};
  for (const a of areas) { plano[a] = []; colabs[a] = []; }
  for (const p of seed.plano) plano[p[1]].push({ id: p[0], area: p[1], rota: p[2], local: p[3], ativ: p[4], tipo: p[5], dias: p[6], ativo: true });
  for (const c of seed.colabs) colabs[c.area].push(c);
  for (const [k, v] of Object.entries(seed.sit)) { const m = k.split('|')[1].slice(0, 7); (sit[m] ||= {})[k] = v; }
  const config = { rotas: seed.rotas.map(r => ({ area: r[0], rota: r[1], ef: r[2], carga: r[3] })), tipos: seed.tipos, meses: [] };
  return { config, plano, colabs, sit };
}
