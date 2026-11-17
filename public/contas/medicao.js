// Gestão › Medição (sem tela): faltas, horas extras, horas perdidas e correções de ICCC/ICCP do mês, para passar
// para a medição oficial. Faltas e horas extras vêm da Escala do dia (situação de Pátio e Bateria); horas perdidas, das
// paradas dos equipamentos. Nada disso é redigitado: o que fica gravado é só o que é de todos.
// Banco: medicao/{AAAA-MM} = { l: { id: marca }, oc: { id: marca }, man: { id: registro digitado } }
//   l  = registros marcados "lançado" (já passaram para a medição oficial), com quem marcou e quando;
//   oc = registros ocultos (somem da Medição; na Escala do dia e nos Equipamentos continuam);
//   man = registros digitados (falta, hora extra ou hora perdida fora do sistema, e as correções de ICCC/ICCP).
// Os ids dos registros automáticos são os mesmos do Meu painel (dk_patio_..., dk_bateria_..., dk_par_...), para a
// migração do painel trazer o que já estava marcado.

export const TIPOS = {
  falta: { l: 'Faltas', one: 'falta', who: 'Colaborador', cat: 'Tipo', cats: ['Sem justificativa', 'Atestado médico', 'Justificada', 'Folga compensada', 'Afastamento'], desc: 'Justificativa', horas: false },
  he: { l: 'Horas extras', one: 'hora extra', who: 'Colaborador', cat: null, desc: 'Motivo', horas: true },
  hp: { l: 'Horas perdidas', one: 'hora perdida', who: 'Equipamento', cat: 'Motivo', cats: ['Manutenção corretiva', 'Manutenção preventiva', 'Falta de operador', 'Aguardando liberação', 'Condição climática', 'Outro'], desc: 'Observação', horas: true },
  ind: { l: 'ICCC / ICCP', one: 'correção', who: null, cat: 'Indicador', cats: ['ICCC', 'ICCP'], desc: 'Divergência encontrada', horas: false }
};
export const CONJ_NOME = { patio: 'Pátio', bateria: 'Bateria' };
// Códigos da Escala do dia que entram como falta na medição (os mesmos do Meu painel).
export const FALTA_COD = { FT: 'falta', AT: 'atestado', AF: 'afastamento', AB: 'abono', SP: 'suspensão' };

const r2 = h => Math.round(h * 100) / 100;
const limpo = s => String(s || '').replace(/[^\w-]/g, '_');
export const idPres = (k, key) => `dk_${k}_${limpo(key)}`;
export const idPar = id => `dk_par_${limpo(id)}`;
const mot = j => (j && j.mot ? [j.mot, j.chegada ? 'chegou às ' + j.chegada : '', j.saida ? 'saiu às ' + j.saida : '', j.obs].filter(Boolean).join(' · ') : '');
const hmin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
export const horasDe = d => { if (!d) return null; const a = hmin(d.ini), b = hmin(d.fim); if (a == null || b == null) return null; const t = ((b - a + 1440) % 1440 || 1440) - (+d.int || 0); return t > 0 ? r2(t / 60) : null; };
const nomeBonito = n => String(n || '').toLowerCase().replace(/(^|\s)(\S)/g, (a, b, c) => b + c.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, x => x.toLowerCase());

// Faltas e horas extras de um conjunto no mês (até hoje), a partir da Escala do dia.
// sit: { 'colab|data': código } do mês · info(key) → { jus, hed, he } · estimativa(c, data) = horas de HE sem horário.
export function registrosPresenca({ k, colabs, sit, info, ym, hoje, estimativa }) {
  const porId = new Map((colabs || []).map(c => [String(c.id), c]));
  const out = [];
  for (const [key, cod] of Object.entries(sit || {})) {
    const i = key.lastIndexOf('|'); const cid = key.slice(0, i), dt = key.slice(i + 1);
    if (!dt || dt.slice(0, 7) !== ym || dt > hoje) continue;
    const c = porId.get(cid); const quem = c ? nomeBonito(c.nome) : 'Colaborador ' + cid;
    const base = { id: idPres(k, key), data: dt, quem, conj: k, origem: 'auto', area: c ? c.area || '' : '' };
    const x = info(key) || {};
    if (FALTA_COD[cod]) {
      const j = x.jus && (!x.jus.cod || x.jus.cod === cod) ? x.jus : null;
      const cat = cod === 'AT' ? 'Atestado médico' : cod === 'AF' ? 'Afastamento' : cod === 'AB' ? 'Justificada' : cod === 'FT' && j && j.mot && j.mot !== 'Sem justificativa' ? 'Justificada' : 'Sem justificativa';
      out.push({ ...base, tipo: 'falta', cod, cat, horas: 0, desc: [cod === 'SP' ? 'Suspensão' : cod === 'AB' ? 'Abono' : '', mot(j)].filter(Boolean).join(' · ') });
    } else if (cod === 'HE') {
      const d = x.hed; const h = horasDe(d);
      const est = h == null && estimativa ? estimativa(c, dt) : null;
      out.push({ ...base, tipo: 'he', horas: h != null ? h : est || 0, semHora: h == null, desc: [d && d.ini ? `${d.ini} às ${d.fim}` : 'sem horário na Escala do dia' + (est ? ` (estimado ${String(est).replace('.', ',')} h)` : ''), d && d.mot, x.he ? 'a pedido da ' + (x.he === 'ARCELOR' ? 'ArcelorMittal' : 'Dikma') : ''].filter(Boolean).join(' · ') });
    }
  }
  return out;
}

// Categoria da parada pela causa e por quem responde por ela (cadastro de causas dos Equipamentos).
export function catParada(causa, resp) {
  const cz = String(causa || '').toUpperCase();
  return /PREVENT/.test(cz) ? 'Manutenção preventiva' : /CHUV|CLIMA|TEMPO/.test(cz) ? 'Condição climática' : /LIBERA/.test(cz) ? 'Aguardando liberação' : resp === 'OPERADOR' ? 'Falta de operador' : resp === 'EQUIPAMENTO' ? 'Manutenção corretiva' : 'Outro';
}
// Horas perdidas do mês a partir das paradas: [{ id, eq, data, ini, fim, causa, desc, os, subst, conj }].
// Paradas com substituição não contam (o operador seguiu em outro equipamento), como na Visão geral.
export function registrosParadas(paradas, ym, hoje, respDe = () => '') {
  const out = [];
  for (const p of paradas || []) {
    if (!p || !p.ini || !p.fim || p.subst || !p.data || p.data.slice(0, 7) !== ym || p.data > hoje) continue;
    const a = hmin(p.ini), b = hmin(p.fim); if (a == null || b == null) continue;
    const h = ((b - a) + 1440) % 1440 / 60; if (!h) continue;
    out.push({ id: idPar(p.id), tipo: 'hp', data: p.data, quem: p.eq, conj: p.conj || '', origem: 'auto', cat: catParada(p.causa, respDe(p.causa)), horas: r2(h), desc: [p.causa, p.desc, `${p.ini} às ${p.fim}`, p.os ? 'OS ' + p.os : ''].filter(Boolean).join(' · ') });
  }
  return out;
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const chave = r => r.tipo + '|' + r.data + '|' + norm(r.quem);
// Junta os registros automáticos do mês com o documento medicao/{mês}: marca lançado, tira os ocultos e soma os digitados.
// Digitado que repete um automático (mesmo tipo, data e nome) aparece uma vez só (fica o digitado, com o selo).
export function juntarMes(auto, docMes) {
  const d = docMes || {}; const L = d.l || {}, OC = d.oc || {}, MAN = d.man || {};
  const vivos = (auto || []).filter(r => !OC[r.id]).map(r => ({ ...r, lanc: L[r.id] || null }));
  const idx = new Map(); vivos.forEach(r => { if (r.tipo !== 'ind' && !idx.has(chave(r))) idx.set(chave(r), r); });
  const usados = new Set();
  const man = Object.entries(MAN).filter(([, r]) => r && r.tipo && r.data).map(([id, r]) => {
    const x = { ...r, id, origem: 'man', lanc: L[id] || null };
    if (x.tipo === 'ind') return x;
    const a = idx.get(chave(x)); if (!a || usados.has(a)) return x;
    usados.add(a); return { ...x, tambem: a.id, lanc: x.lanc || a.lanc };
  });
  return man.concat(vivos.filter(r => !usados.has(r))).sort((a, b) => (b.data || '').localeCompare(a.data || '') || String(a.quem || '').localeCompare(String(b.quem || ''), 'pt-BR'));
}
// Ocultos do mês: os automáticos que alguém tirou da Medição (para mostrar e poder voltar).
export const ocultosDoMes = (auto, docMes) => (auto || []).filter(r => ((docMes || {}).oc || {})[r.id]);
// Está pendente? Falta, HE e hora perdida: sem "lançado". Correção de ICCC/ICCP: enquanto não corrigida.
export const pendente = r => (r.tipo === 'ind' ? r.st !== 'corrigido' : !r.lanc);

// Números dos cartões do topo.
export function resumoMes(regs) {
  const de = t => regs.filter(r => r.tipo === t);
  const soma = l => r2(l.reduce((s, r) => s + (Number(r.horas) || 0), 0));
  const F = de('falta'), HE = de('he'), HP = de('hp'), IND = de('ind');
  return {
    falta: { n: F.length, pend: F.filter(pendente).length, semJus: F.filter(r => r.cat === 'Sem justificativa').length },
    he: { n: HE.length, horas: soma(HE), pend: HE.filter(pendente).length, semHora: HE.filter(r => r.semHora).length },
    hp: { n: HP.length, horas: soma(HP), pend: HP.filter(pendente).length, eqs: new Set(HP.map(r => r.quem)).size },
    ind: { n: IND.length, pend: IND.filter(pendente).length, ok: IND.length - IND.filter(pendente).length }
  };
}

// Texto de horas digitado ("2,5") → número entre 0 e 24; NaN se inválido.
export const lerHoras = s => { const t = String(s ?? '').trim().replace(',', '.'); if (!t || !/^\d+(\.\d+)?$/.test(t)) return NaN; const n = Number(t); return n > 0 && n <= 24 ? r2(n) : NaN; };
// Confere um registro digitado e devolve o que vai para o banco (ou lança o erro em português).
export function conferirManual(tipo, f, ym) {
  const T = TIPOS[tipo]; if (!T) throw new Error('Tipo de registro inválido.');
  const data = String(f.data || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Informe a data.');
  if (ym && data.slice(0, 7) !== ym) throw new Error('A data precisa ser do mês aberto.');
  const r = { tipo, data };
  if (T.who) { const q = String(f.quem || '').trim(); if (q.length < 2) throw new Error(`Informe o ${T.who.toLowerCase()}.`); r.quem = q.slice(0, 120); }
  if (tipo !== 'ind') { if (!CONJ_NOME[f.conj]) throw new Error('Escolha o conjunto (Pátio ou Bateria).'); r.conj = f.conj; }
  if (T.cat) { if (!T.cats.includes(f.cat)) throw new Error(`Escolha o ${T.cat.toLowerCase()}.`); r.cat = f.cat; }
  if (T.horas) { const h = lerHoras(f.horas); if (Number.isNaN(h)) throw new Error('Horas inválidas: use um número maior que 0 e até 24, com vírgula (ex.: 2,5).'); r.horas = h; }
  const desc = String(f.desc || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (tipo === 'ind' && desc.length < 3) throw new Error('Descreva a divergência encontrada.');
  r.desc = desc;
  if (tipo === 'ind') r.st = 'pendente';
  return r;
}

// Planilha do mês: uma aba por tipo, com quem lançou.
export function linhasExcel(regs, nomeConj = k => CONJ_NOME[k] || '') {
  const dt = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const lanc = r => (r.lanc ? 'Sim' : 'Não'); const por = r => (r.lanc ? r.lanc.nome || '' : '');
  const fonte = r => (r.origem === 'auto' ? 'Sistema' : 'Digitado');
  const de = t => regs.filter(r => r.tipo === t).slice().sort((a, b) => a.data.localeCompare(b.data));
  return [
    { nome: 'Faltas', linhas: [['Data', 'Colaborador', 'Conjunto', 'Tipo', 'Justificativa', 'Lançado', 'Lançado por', 'Fonte'], ...de('falta').map(r => [dt(r.data), r.quem, nomeConj(r.conj), r.cat, r.desc || '', lanc(r), por(r), fonte(r)])] },
    { nome: 'Horas extras', linhas: [['Data', 'Colaborador', 'Conjunto', 'Horas', 'Motivo', 'Lançado', 'Lançado por', 'Fonte'], ...de('he').map(r => [dt(r.data), r.quem, nomeConj(r.conj), r.horas, r.desc || '', lanc(r), por(r), fonte(r)])] },
    { nome: 'Horas perdidas', linhas: [['Data', 'Equipamento', 'Conjunto', 'Motivo', 'Horas', 'Observação', 'Lançado', 'Lançado por', 'Fonte'], ...de('hp').map(r => [dt(r.data), r.quem, nomeConj(r.conj), r.cat, r.horas, r.desc || '', lanc(r), por(r), fonte(r)])] },
    { nome: 'ICCC-ICCP', linhas: [['Data', 'Indicador', 'Divergência', 'Situação'], ...de('ind').map(r => [dt(r.data), r.cat, r.desc || '', r.st === 'corrigido' ? 'Corrigido' : 'Pendente'])] }
  ];
}
