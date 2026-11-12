// Dikma Gestão — aprovação dos apontamentos das Atividades.
// O líder aponta (realizada, não realizada, extra); o supervisor, o técnico de processo ou o administrador aprova ou
// devolve com o motivo. O que ainda espera aprovação já conta nos números, com o selo "aguardando".
// Guardado em aprov/{área|semana} (b_aprov na Bateria): { area, mes, v: { 'atividade|dia': { s: 'A'|'D', c, por, nome, em, mot, ant } } }
export const APROV_DESDE = '2026-10-15'; // apontamentos de antes desta data não entram na aprovação
// Aprovam ou devolvem (perfil da Operação): o supervisor, nas áreas dele, e o técnico de processo, em todas as áreas
// do conjunto (Pátio ou Bateria) que estão no escopo dele. O administrador aprova em todas as áreas.
// Gestor e coordenador acompanham sem aprovar.
export const APROVADORES = ['supervisor', 'tecnico'];
export const aprovaPapel = papel => APROVADORES.includes(papel);
export const aprovaTodas = papel => papel === 'tecnico'; // aprova em todas as áreas do conjunto (sem área fixa)
export const ACOMPANHA = ['admin', 'gestor', 'coordenador', 'supervisor', 'tecnico'];
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
// Agrupa a fila da Aprovação por dia (mais antigo primeiro) e, dentro do dia, por rota.
// itens: [{ dt, area, rota, c }] (c = R realizada · N não realizada · E extra; o resto do item vai junto em itens).
// Devolve [{ dt, n, rotas: [{ key: 'dia|área|rota', area, rota, n, R, N, E, itens }] }]
export function agruparAprov(itens) {
  const dias = new Map();
  for (const x of itens || []) {
    let d = dias.get(x.dt); if (!d) dias.set(x.dt, d = { dt: x.dt, n: 0, rotas: new Map() });
    const key = x.dt + '|' + x.area + '|' + x.rota;
    let r = d.rotas.get(key); if (!r) d.rotas.set(key, r = { key, area: x.area, rota: x.rota, n: 0, R: 0, N: 0, E: 0, itens: [] });
    d.n++; r.n++; if (x.c in r && x.c.length === 1) r[x.c]++; r.itens.push(x);
  }
  return [...dias.values()].sort((a, b) => (a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0))
    .map(d => ({ dt: d.dt, n: d.n, rotas: [...d.rotas.values()].sort((a, b) => a.rota.localeCompare(b.rota, 'pt-BR') || a.area.localeCompare(b.area)) }));
}
