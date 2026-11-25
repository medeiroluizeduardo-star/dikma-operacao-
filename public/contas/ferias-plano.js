// Dikma Gestão — planejamento das férias (sem tela): etapas de cada período, quadro do mês, plano do ano e pendências.
// Usado por RH › Férias (telas/ferias-plano.js) e pelos testes (testes/ferias-plano.test.mjs).
// Período = ferias/{id} ({ mat, nome, inicio, dias, termino, retorno, limite, mesPlanejado, substituto, avisoEm }).
// Etapas: Planejada (só o mês) → Marcada (com datas) → Aviso entregue (avisoEm) → Em gozo → Gozada.
// O aviso de férias é entregue com pelo menos 30 dias de antecedência (CLT, art. 135).
import { resumoFeriasPessoa } from './ferias.js';
import { normNome } from './planilhas-adm.js';

export const AVISO_DIAS = 30;
export const MAX_TURMA_PADRAO = 2;
const pd = s => new Date(s + 'T12:00:00');
export const somarDias = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const diasEntre = (a, b) => Math.round((+pd(b) - +pd(a)) / 864e5);
export const fimDoMes = m => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10); };
export const somarMeses = (m, n) => { const [y, mm] = m.split('-').map(Number); const t = y * 12 + (mm - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const nomeMes = m => `${NOMES_MES[+m.slice(5, 7) - 1]}/${m.slice(0, 4)}`;
export const mesCurto = m => `${NOMES_MES[+m.slice(5, 7) - 1].slice(0, 3)}/${m.slice(2, 4)}`;
const terminoDe = f => f.termino || (f.inicio ? somarDias(f.inicio, (+f.dias || 30) - 1) : null);

// Data até a qual o aviso precisa ser entregue (30 dias antes do início).
export const prazoAviso = f => (f && f.inicio ? somarDias(f.inicio, -AVISO_DIAS) : null);

// Etapa de um período hoje: { k, t, s } (k = chave, t = texto, s = situação da etiqueta).
export function etapaFerias(f, hoje) {
  if (!f || !f.inicio) return { k: 'planejada', t: f && f.mesPlanejado ? `Planejada · ${mesCurto(f.mesPlanejado)}` : 'Planejada', s: 'neutro' };
  const fim = terminoDe(f);
  if (fim && fim < hoje) return { k: 'gozada', t: 'Gozada', s: 'ok' };
  if (f.inicio <= hoje) return { k: 'gozo', t: 'Em gozo', s: 'atencao' };
  if (f.avisoEm) return { k: 'avisada', t: 'Aviso entregue', s: 'ok' };
  return { k: 'marcada', t: 'Marcada', s: 'info' };
}

// Turma curta da ficha ("TURMA C", "4X4 C" → "C"; "ADM" fica "ADM"; vazio = "").
export function turmaCurta(t) {
  const s = String(t || '').trim().toUpperCase(); if (!s) return '';
  const m = s.match(/(?:^|[\s\-/])([A-Z])$/); return m ? m[1] : s;
}

// Liga cada período à pessoa do cadastro: pela matrícula Dikma, senão pelo nome. Devolve f → pessoa | null.
export function pessoaDoPeriodo(cadastro = []) {
  const porMat = new Map(), porNome = new Map();
  for (const c of cadastro) { if (c.mat) porMat.set(String(c.mat), c); if (c.nome && !porNome.has(normNome(c.nome))) porNome.set(normNome(c.nome), c); }
  return f => (f.mat && porMat.get(String(f.mat))) || (f.nome && porNome.get(normNome(f.nome))) || null;
}

// O período toca o mês? (com datas: algum dia dentro do mês; sem datas: mês planejado igual)
export function noMes(f, mes) {
  if (!f.inicio) return f.mesPlanejado === mes;
  const fim = terminoDe(f) || f.inicio; return f.inicio <= fimDoMes(mes) && fim >= mes + '-01';
}

// Maior número de pessoas de férias no mesmo dia, dentro do mês (só os períodos com data).
export function picoNoMes(periodos, mes) {
  const ini = mes + '-01', fim = fimDoMes(mes); const ev = [];
  for (const f of periodos) {
    if (!f.inicio) continue; const t = terminoDe(f) || f.inicio;
    const a = f.inicio > ini ? f.inicio : ini, b = t < fim ? t : fim; if (a > b) continue;
    ev.push([a, 1], [somarDias(b, 1), -1]);
  }
  ev.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]));
  let n = 0, max = 0; for (const [, d] of ev) { n += d; if (n > max) max = n; } return max;
}

// Períodos do mês com a pessoa e o grupo (área · turma). grupoDe(pessoa, periodo) → { area, areaNome, turma }.
export function quadroDoMes({ ferias = [], mes, achar, grupoDe, hoje }) {
  const linhas = ferias.filter(f => !f.apagado && noMes(f, mes)).map(f => {
    const p = achar(f); const g = grupoDe(p, f);
    return { f, p, g, etapa: etapaFerias(f, hoje), aviso: prazoAviso(f), termino: terminoDe(f) };
  });
  linhas.sort((a, b) => String(a.f.inicio || '9999').localeCompare(String(b.f.inicio || '9999')) || String(a.f.nome).localeCompare(String(b.f.nome)));
  return linhas;
}

// Grupos (área · turma) com mais gente de férias ao mesmo tempo do que o máximo. Só turmas conhecidas entram na conta.
export function conflitosDoMes(linhas, mes, max = MAX_TURMA_PADRAO) {
  const por = new Map();
  for (const l of linhas) { if (!l.g || !l.g.turma || !l.f.inicio) continue; const k = `${l.g.area}|${l.g.turma}`; if (!por.has(k)) por.set(k, { g: l.g, ls: [] }); por.get(k).ls.push(l); }
  const out = [];
  for (const { g, ls } of por.values()) { const pico = picoNoMes(ls.map(l => l.f), mes); if (pico > max) out.push({ g, pico, nomes: ls.map(l => l.f.nome) }); }
  return out.sort((a, b) => b.pico - a.pico);
}

// Pendências do planejamento, da mais grave para a mais leve.
// tipo: vencido | depoisLimite | lim30 | lim60 | lim90 | aviso | semSub | conflito
export function pendenciasFerias({ cadastro = [], ferias = [], hoje, feriasDe, grupoDe, achar, max = MAX_TURMA_PADRAO, meses = 12 }) {
  const out = [];
  const ativos = cadastro.filter(c => !c.dem || c.dem > hoje);
  for (const c of ativos) {
    const per = feriasDe(c); const r = resumoFeriasPessoa(per, hoje);
    if (r.limite) {
      const n = diasEntre(hoje, r.limite);
      const plan = per.find(f => !f.inicio && f.mesPlanejado && f.mesPlanejado >= hoje.slice(0, 7));
      if (n < 0) out.push({ tipo: 'vencido', s: 'critico', p: c, data: r.limite, plan, t: 'Limite vencido sem férias marcadas: risco de pagar em dobro' });
      else if (n <= 90) out.push({ tipo: n <= 30 ? 'lim30' : n <= 60 ? 'lim60' : 'lim90', s: n <= 30 ? 'critico' : n <= 60 ? 'atencao' : 'info', p: c, data: r.limite, plan, t: `Limite em ${n} dia${n === 1 ? '' : 's'}, sem férias marcadas${plan ? ` (planejada para ${mesCurto(plan.mesPlanejado)})` : ''}` });
    }
  }
  for (const f of ferias) {
    if (f.apagado || !f.inicio) continue;
    const fim = terminoDe(f); if (fim && fim < hoje) continue;
    const p = achar(f);
    if (p && p.dem && p.dem <= hoje) continue;
    if (f.limite && fim && fim > f.limite) out.push({ tipo: 'depoisLimite', s: 'critico', p, f, data: f.limite, t: `Termina depois da data limite (${f.limite.slice(8, 10)}/${f.limite.slice(5, 7)}): risco de pagar em dobro` });
    if (f.inicio > hoje && !f.avisoEm) {
      const pz = prazoAviso(f); const n = diasEntre(hoje, pz);
      if (n <= 15) out.push({ tipo: 'aviso', s: n < 0 ? 'critico' : 'atencao', p, f, data: pz, t: n < 0 ? `Aviso de férias atrasado (era até ${pz.slice(8, 10)}/${pz.slice(5, 7)})` : `Entregar o aviso de férias até ${pz.slice(8, 10)}/${pz.slice(5, 7)}` });
    }
    if (!String(f.substituto || '').trim() && diasEntre(hoje, f.inicio) <= 60) out.push({ tipo: 'semSub', s: 'atencao', p, f, data: f.inicio, t: 'Sem substituto definido' });
  }
  const mes0 = hoje.slice(0, 7);
  for (let i = 0; i < meses; i++) {
    const mes = somarMeses(mes0, i);
    for (const c of conflitosDoMes(quadroDoMes({ ferias, mes, achar, grupoDe, hoje }), mes, max)) out.push({ tipo: 'conflito', s: 'atencao', mes, g: c.g, pico: c.pico, nomes: c.nomes, data: mes + '-01', t: `${c.pico} pessoas de ${c.g.areaNome || c.g.area} · turma ${c.g.turma} de férias ao mesmo tempo em ${nomeMes(mes)} (máximo ${max})` });
  }
  const ORD = { vencido: 0, depoisLimite: 1, lim30: 2, aviso: 3, conflito: 4, lim60: 5, semSub: 6, lim90: 7 };
  return out.sort((a, b) => ORD[a.tipo] - ORD[b.tipo] || String(a.data || '').localeCompare(String(b.data || '')));
}

// Plano dos próximos meses: por mês, quantos saem, quantos ficam de férias, o pico no mesmo dia, as planejadas sem
// data, os limites que vencem no mês sem férias marcadas e, por área, quantas pessoas têm férias no mês.
export function planoDoAno({ cadastro = [], ferias = [], hoje, feriasDe, grupoDe, achar, max = MAX_TURMA_PADRAO, meses = 12 }) {
  const mes0 = hoje.slice(0, 7); const ativos = cadastro.filter(c => !c.dem || c.dem > hoje);
  const limites = new Map();
  for (const c of ativos) { const r = resumoFeriasPessoa(feriasDe(c), hoje); if (r.limite && r.limite >= mes0 + '-01') { const m = r.limite.slice(0, 7); limites.set(m, (limites.get(m) || 0) + 1); } }
  const areas = new Map();
  const lista = [];
  for (let i = 0; i < meses; i++) {
    const mes = somarMeses(mes0, i);
    const ls = quadroDoMes({ ferias, mes, achar, grupoDe, hoje });
    const comData = ls.filter(l => l.f.inicio);
    const porArea = {};
    for (const l of ls) { const a = (l.g && l.g.area) || ''; porArea[a] = (porArea[a] || 0) + 1; if (!areas.has(a)) areas.set(a, (l.g && l.g.areaNome) || a || 'Sem área'); }
    lista.push({ mes, saem: comData.filter(l => l.f.inicio.slice(0, 7) === mes).length, ferias: comData.length, pico: picoNoMes(comData.map(l => l.f), mes),
      planejadas: ls.length - comData.length, limites: limites.get(mes) || 0, conflitos: conflitosDoMes(ls, mes, max).length, porArea });
  }
  return { meses: lista, areas: [...areas.entries()].map(([k, nome]) => ({ k, nome })).sort((a, b) => a.nome.localeCompare(b.nome)) };
}

// Mês sugerido para planejar: o mês anterior ao da data limite (para terminar antes), nunca antes do mês atual.
export function mesSugerido(limite, hoje) {
  const m0 = hoje.slice(0, 7); if (!limite) return m0;
  const m = somarMeses(limite.slice(0, 7), -1); return m < m0 ? m0 : m;
}
