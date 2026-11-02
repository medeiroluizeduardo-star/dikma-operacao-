// Contas das atividades (sem tela): semanas do período, totais, atrasadas, apontamentos e aprovação.
import { SETS, DAYS, add, ddmm } from '../cal.js';
import { APROV_DESDE, aprovaPapel, acompanhaPapel, estadoAprov, listarAprov } from '../aprovacao.js';
import { listaAtrasadas } from '../hoje.js';
import { perfilDe, escoposDe } from '../acessos.js';
import { DB, TODAY, esc } from '../nucleo/base.js';
import { ME, PL, SK, AREAS, DATAV, mudouDados, UI, rotas, podeItem, todasAreas, myAreas, canEdit, podeForaProg, perfil, isAdmin, modAqui } from '../nucleo/estado.js';
import { sheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';


/* ---------------- consultas ---------------- */
export const docsFor = ({ mes, ini, area }) => Object.values(DB.cache.semanas).filter(d => (!mes || d.mes === mes) && (!ini || d.ini === ini) && (!area || area === 'TODAS' || d.area === area));
// Datas dos 7 dias de cada semana, calculadas uma vez só (as telas grandes chamam isso milhares de vezes).
export const diasDe = doc => (doc._dias && doc._dias.ini === doc.ini ? doc._dias.v : (doc._dias = { ini: doc.ini, v: DAYS.map((_, k) => add(doc.ini, k)) }).v);
export function st(doc, i, k) { const c = doc.d[i][k]; if (c === 'P' && diasDe(doc)[k] < TODAY) return 'A'; return c === '_' ? 'X' : c; }
export function stats(docs, { rota = 'TODAS', tipo = 'TODOS' } = {}) {
  const s = { prog: 0, R: 0, N: 0, P: 0, A: 0, E: 0, FP: 0, progHoje: 0, Rhoje: 0, day: Array.from({ length: 7 }, () => ({ R: 0, N: 0, P: 0, A: 0, E: 0 })) };
  for (const doc of docs) for (let i = 0; i < doc.ids.length; i++) {
    const p = PL.get(doc.ids[i]); if (!p) continue;
    if (rota !== 'TODAS' && p.rota !== rota) continue; if (tipo !== 'TODOS' && p.tipo !== tipo) continue;
    const str = doc.d[i];
    for (let k = 0; k < 7; k++) {
      const c = str[k]; if (c === '_') continue;
      const dt = diasDe(doc)[k];
      if (c === 'E') { s.E++; s.day[k].E++; continue; }
      if (doc.fp && doc.fp[doc.ids[i] + '|' + k]) s.FP++;
      s.prog++; if (dt <= TODAY) s.progHoje++;
      if (c === 'R') { s.R++; s.day[k].R++; if (dt <= TODAY) s.Rhoje++; }
      else if (c === 'N') { s.N++; s.day[k].N++; }
      else { s.P++; if (dt < TODAY) { s.A++; s.day[k].A++; } else s.day[k].P++; }
    }
  }
  return s;
}
export const rotasDa = area => rotas().filter(r => area === 'TODAS' || r.area === area);
const ATR_MEMO = new Map();
// Atrasadas dos últimos 60 dias (janela fixa, a mesma do Meu dia e de Pendências: hoje.js)
export function atrasadasAll(area) {
  const mk = `${typeof DATAV === 'undefined' ? 0 : DATAV}|${SK}|${TODAY}|${area}`; // o menu pede isto a cada desenho
  if (ATR_MEMO.has(mk)) return ATR_MEMO.get(mk);
  if (ATR_MEMO.size > 20) ATR_MEMO.clear();
  const out = listaAtrasadas(DB.cache.semanas, { areas: area && area !== 'TODAS' ? [area] : null, hoje: TODAY });
  ATR_MEMO.set(mk, out); return out;
}

/* ---------------- gravações ---------------- */
export function localChange(doc, i, k, c, motivo) {
  mudouDados();
  const a = [...doc.d[i]]; a[k] = c; const str = a.join('');
  const pid = doc.ids[i];
  doc.d[i] = str; if (doc.s) doc.s[pid] = str;
  const mk = pid + '|' + k; if (c === 'N' && motivo) doc.m[mk] = motivo; else delete doc.m[mk];
  return { pid, str, k, motivo: c === 'N' ? motivo : null };
}
export function setSt(doc, i, k, c, motivo) {
  if (!canEdit(doc.area)) { toast('Seu perfil não pode apontar nesta área'); return; }
  const ch = localChange(doc, i, k, c, motivo);
  UI.flash = { id: doc.id, i, k, t: Date.now() };
  gravarApont(doc, [ch]);
  const p = PL.get(doc.ids[i]); const nm = { R: 'realizada', N: 'não realizada', P: 'voltou para programada', E: 'extra', _: 'extra removida' }[c];
  DB.log(`${p ? p.ativ : doc.ids[i]} · ${p ? p.rota : ''} · ${DAYS[k]} ${ddmm(add(doc.ini, k))} → ${nm}${c === 'N' && motivo ? ' (' + motivo + ')' : ''}`);
}

// Inclui no dia uma atividade que não estava programada: ela entra como "a fazer" e o líder aponta se foi feita.
export function incluirFora(doc, i, k) {
  if (!podeForaProg(doc.area)) { toast('Só o coordenador e o supervisor da área incluem atividades fora da programação'); return; }
  const pid = doc.ids[i]; const a = [...doc.d[i]]; if (a[k] !== '_') return; a[k] = 'P'; const str = a.join('');
  mudouDados(); doc.d[i] = str; if (doc.s) doc.s[pid] = str; doc.fp = doc.fp || {};
  const info = { por: ME.uid, nome: ME.nome || ME.login || '', em: new Date().toISOString() }; doc.fp[pid + '|' + k] = info;
  DB.setForaProg(doc.id, pid, k, str, info);
  const p = PL.get(pid); DB.log(`${p ? p.ativ : pid} · ${p ? p.rota : ''} · ${DAYS[k]} ${ddmm(add(doc.ini, k))} → incluída fora da programação`);
  toast('Incluída fora da programação · o líder aponta se foi feita'); render();
}
// Tira a atividade incluída, enquanto o líder ainda não apontou.
export function tirarFora(doc, i, k) {
  if (!podeForaProg(doc.area)) return;
  const pid = doc.ids[i]; const a = [...doc.d[i]]; if (a[k] !== 'P' || !(doc.fp && doc.fp[pid + '|' + k])) { toast('Já foi apontada: não dá para tirar'); return; }
  a[k] = '_'; const str = a.join(''); mudouDados(); doc.d[i] = str; if (doc.s) doc.s[pid] = str; delete doc.fp[pid + '|' + k];
  DB.setForaProg(doc.id, pid, k, str, null);
  const p = PL.get(pid); DB.log(`${p ? p.ativ : pid} · ${DAYS[k]} ${ddmm(add(doc.ini, k))} → tirada da programação`);
  toast('Atividade tirada do dia'); render();
}
export function escolherFora(doc, k, rota) {
  const opts = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === rota && doc.d[x.i][k] === '_');
  if (!opts.length) { toast('Todas as atividades desta rota já estão programadas neste dia'); return; }
  sheet('Incluir fora da programação', `${esc(rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}<br>A atividade entra no dia como "a fazer" e o líder aponta se foi feita ou não.`, opts.map(x => ({ t: x.p.ativ, d: x.p.local, i: x.i })), o => incluirFora(doc, o.i, k));
}

/* ---------------- aprovação dos apontamentos ---------------- */
// O líder aponta; o supervisor (ou coordenador, gestor, administrador) aprova ou devolve com o motivo.
// O que ainda espera aprovação já conta nos números, com o selo "aguardando". Vale dos apontamentos a partir de APROV_DESDE.
// Aprovar é da Operação: vale o perfil da Operação, em qualquer tela.
export const aprovador = () => !!ME && (aprovaPapel(perfil('operacao')) || isAdmin()) && podeItem('i_aprovar', 'operacao');
 // supervisor; administrador como reserva
// Áreas sem supervisor ativo neste conjunto: o administrador aprova no lugar dele (aprovador reserva).
const areasSemSupervisor = () => AREAS.filter(a => !(DB.cache.usuarios || []).some(u => perfilDe(u, 'operacao') === 'supervisor' && !u.bloqueado && (u.area === a || u.area2 === a) && escoposDe(u).includes(SK)));
// Acompanha (vê a Aprovação, cria ações): supervisor para cima, no módulo pedido (padrão: o da tela).
export const acompanha = (mod = modAqui()) => !!ME && acompanhaPapel(perfil(mod));
export const areasAprov = () => (!aprovador() ? [] : isAdmin() ? areasSemSupervisor() : myAreas('operacao'));
export const areasVerAprov = () => (aprovador() && !isAdmin() ? myAreas('operacao') : acompanha() ? (todasAreas() ? AREAS : myAreas()) : []);
export const aprovDe = (doc, pid, k) => ((DB.cache.aprov || {})[doc.id] || {})[pid + '|' + k];
// 'pend' (aguardando) · 'ok' (aprovada) · 'dev' (devolvida ao líder) · null (nada a aprovar)
export const estAprov = (doc, i, k) => estadoAprov(doc.d[i][k], diasDe(doc)[k], aprovDe(doc, doc.ids[i], k), TODAY, doc.m[doc.ids[i] + '|' + k]);
// A lista é usada no menu, no Painel, no Apontar e no Meu dia a cada desenho: guarda até os dados mudarem.
const APROV_MEMO = new Map();
export function listaAprov(areas, est = 'pend') {
  // uma passada só separa aguardando e devolvidas (as telas pedem as duas)
  const mk = `${DATAV}|${SK}|${TODAY}|${areas.join(',')}`;
  if (!APROV_MEMO.has(mk)) {
    if (APROV_MEMO.size > 20) APROV_MEMO.clear();
    // a mesma conta do Meu dia (aprovacao.js): só atividade que ainda está no plano
    const l = listarAprov(DB.cache.semanas, DB.cache.aprov, areas, TODAY, pid => PL.has(pid));
    const res = { pend: l.pend.map(x => ({ ...x, p: PL.get(x.pid) })), dev: l.dev.map(x => ({ ...x, p: PL.get(x.pid) })) };
    const ord = (a, b) => (a.dt < b.dt ? 1 : a.dt > b.dt ? -1 : a.p.rota.localeCompare(b.p.rota) || a.p.id.localeCompare(b.p.id));
    res.pend.sort(ord); res.dev.sort(ord); APROV_MEMO.set(mk, res);
  }
  return APROV_MEMO.get(mk)[est] || [];
}
// Grava o apontamento; quando quem aponta é supervisor para cima, já fica aprovado.
export function gravarApont(doc, ch) {
  mudouDados();
  if (!ch.length) return;
  DB.setStatusMany(doc.id, ch);
  if (!areasAprov().includes(doc.area) || !canEdit(doc.area)) return; // quem aprova a área (supervisor, ou o administrador como reserva)
  const it = {};
  for (const x of ch) { const c = x.str[x.k]; if ((c === 'R' || c === 'N' || c === 'E') && add(doc.ini, x.k) >= APROV_DESDE) it[x.pid + '|' + x.k] = c === 'N' ? { s: 'A', c, m: x.motivo || '' } : { s: 'A', c }; }
  if (Object.keys(it).length) Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, it)).catch(() => toast('Não foi possível registrar a aprovação'));
}
export function aprovar(itens) {
  mudouDados();
  const porDoc = new Map();
  for (const x of itens) { if (!porDoc.has(x.doc)) porDoc.set(x.doc, {}); const c = x.doc.d[x.i][x.k]; const key = x.doc.ids[x.i] + '|' + x.k; porDoc.get(x.doc)[key] = c === 'N' ? { s: 'A', c, m: x.doc.m[key] || '' } : { s: 'A', c }; }
  for (const [doc, it] of porDoc) Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, it)).catch(() => toast('Não foi possível aprovar'));
  if (itens.length) DB.log(`Aprovou ${itens.length === 1 ? `${itens[0].p.ativ} · ${itens[0].p.rota} · ${ddmm(itens[0].dt)}` : `${itens.length} apontamentos`}`);
}
export function devolver(x, mot) {
  const { doc, i, k } = x; const ant = doc.d[i][k];
  const ch = localChange(doc, i, k, ant === 'E' ? '_' : 'P');
  DB.setStatusMany(doc.id, [ch]);
  Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, { [doc.ids[i] + '|' + k]: { s: 'D', c: 'P', ant, mot } })).catch(() => toast('Não foi possível devolver'));
  DB.log(`Devolveu ao líder: ${x.p.ativ} · ${x.p.rota} · ${ddmm(x.dt)} (${mot})`);
}
export const CHIP = { P: '', R: '✓', N: '✕', E: '+', A: '!', X: '·' };
export const ST_NOME = { P: 'Programado', R: 'Realizado', N: 'Não realizado', E: 'Extra', A: 'Atrasado', X: 'Não programada' };
