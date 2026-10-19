// Dikma Gestão — aprovação dos apontamentos das Atividades.
// O líder aponta (realizada, não realizada, extra); o supervisor, coordenador, gestor ou administrador aprova ou devolve
// com o motivo. O que ainda espera aprovação já conta nos números, com o selo "aguardando".
// Guardado em aprov/{área|semana} (b_aprov na Bateria): { area, mes, v: { 'atividade|dia': { s: 'A'|'D', c, por, nome, em, mot, ant } } }
export const APROV_DESDE = '2026-10-15'; // apontamentos de antes desta data não entram na aprovação
export const APROVADORES = ['admin', 'gestor', 'coordenador', 'supervisor'];
export const aprovaPapel = papel => APROVADORES.includes(papel);
// c = código da célula, dt = data, a = registro de aprovação (ou nada), hoje = AAAA-MM-DD
// devolve 'pend' (aguardando) · 'ok' (aprovada) · 'dev' (devolvida ao líder) · null (nada a aprovar)
// m = justificativa atual da não realizada: se o líder trocar depois de aprovada, volta a esperar aprovação.
export function estadoAprov(c, dt, a, hoje, m) {
  if (dt < APROV_DESDE || dt > hoje) return null;
  if (c === 'R' || c === 'N' || c === 'E') return a && a.s === 'A' && a.c === c && (c !== 'N' || a.m == null || m == null || a.m === m) ? 'ok' : 'pend';
  return a && a.s === 'D' && (c === 'P' || (c === '_' && a.ant === 'E')) ? 'dev' : null;
}
// Quantos apontamentos esperam aprovação (ou foram devolvidos, est = 'dev') nas áreas, olhando as semanas carregadas de um conjunto (Pátio ou Bateria).
export function contarPendentes(semanas, aprov, areas, hoje, est = 'pend') {
  let n = 0;
  for (const doc of Object.values(semanas || {})) {
    if (!areas.includes(doc.area)) continue;
    const a = (aprov || {})[doc.id] || {};
    for (let k = 0; k < 7; k++) {
      const dt = somaDias(doc.ini, k); if (dt < APROV_DESDE || dt > hoje) continue;
      for (let i = 0; i < doc.ids.length; i++) if (estadoAprov(doc.d[i][k], dt, a[doc.ids[i] + '|' + k], hoje, (doc.m || {})[doc.ids[i] + '|' + k]) === est) n++;
    }
  }
  return n;
}
function somaDias(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
