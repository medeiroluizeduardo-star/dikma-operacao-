// Aplicar feriados nas atividades (Pátio e Bateria), pela chave de serviço. Usado pela rotina "Avisos no celular"
// (de hora em hora; avisos.mjs) e pelo workflow manual "Aplicar feriados" (aplicar-feriados.mjs).
// As contas são as do site (public/contas/feriados.js, copiado para lib/): em feriado sem operação, a atividade programada
// e não apontada sai da conta (célula '_' com a marca fe); feriado removido, ela volta. Só grava o que muda.
//
// fonte = de onde ler: fonteBanco(db) (Firestore) ou fonteArquivo(json) (dados locais, para testar).
//   doc(colecao, id) → dados ou null · porMes(colecao, mes) → [{ id, ...dados }]
import { SETS, SET_KEYS } from './lib/cal.mjs';
import { mapaFeriados, planoFeriados, contarPlano, resumoPorFeriado, assinaturaFeriados } from './lib/feriados.mjs';

export const LOTE = 400;

export function fonteBanco(db) {
  return {
    doc: async (c, id) => { const s = await db.doc(`${c}/${id}`).get(); return s.exists ? s.data() : null; },
    porMes: async (c, mes) => (await db.collection(c).where('mes', '==', mes).get()).docs.map(d => ({ id: d.id, ...d.data() }))
  };
}
// Arquivo: { "config": { "escalas": {...}, "sistema": {...} }, "eq": { "config": {...} }, "semanas": { "ÁREA|AAAA-MM-DD": {...} }, ... }
export function fonteArquivo(json) {
  return {
    doc: async (c, id) => ((json[c] || {})[id]) || null,
    porMes: async (c, mes) => Object.entries(json[c] || {}).filter(([, d]) => d && d.mes === mes).map(([id, d]) => ({ id, ...d }))
  };
}

// Lê os feriados e as semanas de todos os meses gerados e monta o que muda. Não grava.
// Devolve { fer, assinatura, meses: { conj: [meses] }, planos: [{ conj, col, plano }], total, resumo, leituras }
export async function planejarFeriados(fonte) {
  const esc = (await fonte.doc('config', 'escalas')) || {};
  const eq = await fonte.doc('eq', 'config');
  const fer = mapaFeriados(esc, eq);
  let leituras = 2;
  const planos = [], meses = {};
  for (const k of SET_KEYS) {
    const C = n => SETS[k].pre + n;
    const cfg = await fonte.doc(C('config'), 'sistema'); leituras++;
    if (!cfg) continue;
    meses[k] = (cfg.meses || []).slice().sort();
    const plano = [];
    for (const m of meses[k]) {
      const [sem, ap] = await Promise.all([fonte.porMes(C('semanas'), m), fonte.porMes(C('aprov'), m)]);
      leituras += sem.length + ap.length;
      plano.push(...planoFeriados(sem, fer, { aprov: Object.fromEntries(ap.map(a => [a.id, a.v || {}])) }));
    }
    planos.push({ conj: k, col: C('semanas'), plano });
  }
  const total = planos.reduce((t, x) => { const c = contarPlano(x.plano); return { feriado: t.feriado + c.feriado, volta: t.volta + c.volta, outras: t.outras + c.outras, semanas: t.semanas + c.semanas }; }, { feriado: 0, volta: 0, outras: 0, semanas: 0 });
  const assinatura = assinaturaFeriados(fer) + '#' + SET_KEYS.map(k => (meses[k] || []).join(',')).join('/');
  return { fer, assinatura, meses, planos, total, resumo: resumoPorFeriado(planos), leituras };
}

// Grava o plano em lotes de até 400 (uma alteração por semana). Devolve quantas semanas foram gravadas.
export async function gravarFeriados(db, FieldPath, FieldValue, planos) {
  const ops = planos.flatMap(x => x.plano.map(p => ({ col: x.col, ...p })));
  for (let i = 0; i < ops.length; i += LOTE) {
    const b = db.batch();
    for (const o of ops.slice(i, i + LOTE)) {
      const a = [];
      for (const [p, v] of o.campos) a.push(new FieldPath(...p), v === null ? FieldValue.delete() : v);
      a.push('atualizadoEm', FieldValue.serverTimestamp(), 'atualizadoPor', 'rotina-feriados');
      b.update(db.doc(`${o.col}/${o.id}`), ...a);
    }
    await b.commit();
  }
  return ops.length;
}

// Texto do resultado: os feriados encontrados e, por feriado, conjunto e área, quantas atividades mudam.
const dBR = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export function relatorio(r) {
  const l = [];
  l.push(`Feriados sem operação encontrados: ${r.fer.size}`);
  for (const [d, t] of [...r.fer.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) l.push(`  ${dBR(d)} · ${t}`);
  l.push(`Meses gerados: ${SET_KEYS.map(k => `${SETS[k].curto} ${(r.meses[k] || []).join(', ') || '(nenhum)'}`).join(' · ')}`);
  if (!r.resumo.length && !r.total.outras) { l.push('Nada a mudar: as atividades já estão certas.'); return l; }
  l.push('Por feriado, conjunto e área:');
  for (const x of r.resumo) l.push(`  ${dBR(x.dt)} · ${x.desc} · ${SETS[x.conj].curto} · ${x.area}: ${x.feriado ? `${x.feriado} saem da conta` : ''}${x.feriado && x.volta ? ' · ' : ''}${x.volta ? `${x.volta} voltam a programadas (não é mais feriado)` : ''}`);
  l.push(`Total: ${r.total.feriado} atividade(s) saem da conta · ${r.total.volta} voltam · ${r.total.outras} marca(s) acertada(s) · ${r.total.semanas} semana(s) a gravar.`);
  return l;
}
