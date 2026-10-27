// Dikma Gestão — aprovação dos apontamentos das Atividades.
// O líder aponta (realizada, não realizada, extra); o supervisor, coordenador, gestor ou administrador aprova ou devolve
// com o motivo. O que ainda espera aprovação já conta nos números, com o selo "aguardando".
// Guardado em aprov/{área|semana} (b_aprov na Bateria): { area, mes, v: { 'atividade|dia': { s: 'A'|'D', c, por, nome, em, mot, ant } } }
export const APROV_DESDE = '2026-10-15'; // apontamentos de antes desta data não entram na aprovação
// Só o supervisor aprova ou devolve (nas áreas dele). Administrador, gestor e coordenador acompanham sem aprovar.
export const APROVADORES = ['supervisor'];
export const aprovaPapel = papel => APROVADORES.includes(papel);
export const ACOMPANHA = ['admin', 'gestor', 'coordenador', 'supervisor'];
export const acompanhaPapel = papel => ACOMPANHA.includes(papel);
// c = código da célula, dt = data, a = registro de aprovação (ou nada), hoje = AAAA-MM-DD
// devolve 'pend' (aguardando) · 'ok' (aprovada) · 'dev' (devolvida ao líder) · null (nada a aprovar)
// m = justificativa atual da não realizada: se o líder trocar depois de aprovada, volta a esperar aprovação.
export function estadoAprov(c, dt, a, hoje, m) {
  if (dt < APROV_DESDE || dt > hoje) return null;
  if (c === 'R' || c === 'N' || c === 'E') return a && a.s === 'A' && a.c === c && (c !== 'N' || a.m == null || m == null || a.m === m) ? 'ok' : 'pend';
  return a && a.s === 'D' && (c === 'P' || (c === '_' && a.ant === 'E')) ? 'dev' : null;
}
// Apontamentos que esperam aprovação ('pend') e os devolvidos ao líder ('dev') nas áreas, olhando as semanas carregadas
// de um conjunto (Pátio ou Bateria). A mesma lista no menu, na Aprovação, no Painel e no Meu dia.
// noPlano(pid) opcional: só conta atividade que ainda está no plano (a que saiu do plano não aparece na Aprovação).
// Devolve { pend: [{ doc, i, k, dt, pid }], dev: [...] }
export function listarAprov(semanas, aprov, areas, hoje, noPlano) {
  const res = { pend: [], dev: [] };
  for (const doc of Object.values(semanas || {})) {
    if (!areas.includes(doc.area)) continue;
    if (somaDias(doc.ini, 6) < APROV_DESDE || doc.ini > hoje) continue;
    const a = (aprov || {})[doc.id] || {}; const m = doc.m || {};
    for (let i = 0; i < doc.ids.length; i++) {
      const pid = doc.ids[i]; if (noPlano && !noPlano(pid)) continue;
      for (let k = 0; k < 7; k++) {
        const dt = somaDias(doc.ini, k); if (dt < APROV_DESDE || dt > hoje) continue;
        const e = estadoAprov(doc.d[i][k], dt, a[pid + '|' + k], hoje, m[pid + '|' + k]);
        if (e === 'pend' || e === 'dev') res[e].push({ doc, i, k, dt, pid });
      }
    }
  }
  return res;
}
// Quantos apontamentos esperam aprovação (ou foram devolvidos, est = 'dev'): a contagem de listarAprov.
export function contarPendentes(semanas, aprov, areas, hoje, est = 'pend', noPlano) {
  return listarAprov(semanas, aprov, areas, hoje, noPlano)[est].length;
}
// Datas somadas pelo calendário local (as semanas guardam AAAA-MM-DD da segunda-feira)
const SOMA = new Map();
function somaDias(s, n) {
  const ch = s + '|' + n; let r = SOMA.get(ch); if (r) return r;
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n);
  r = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (SOMA.size > 5000) SOMA.clear(); SOMA.set(ch, r); return r;
}
