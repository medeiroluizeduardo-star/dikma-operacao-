// Dikma Gestão — interface. Atividades Pátio e Atividades Bateria usam as mesmas telas (conjunto ativo em SK).
// Os dados vêm de data.js (Firebase) ou data-mock.js (abrir com ?demo).
import { SETS, SET_KEYS, AREAS_ATIV, setDaArea, AREA_S, DAYS, DL, MOTIVOS, SITS, AUSENTE, AUSENCIA, PAPEIS, pad, pd, add, ddmm, today, weeksOfMonth, weekOf, monthOfWeek, weekLabel, monthLabel, addMonth } from './cal.js';
import { competenciaDe, diasDaCompetencia, canonLideres, criarBusca as buscaNomes } from './planilhas-adm.js';
import { abrirLancamento } from './presenca.js';
import { APROV_DESDE, aprovaPapel, estadoAprov } from './aprovacao.js';
import { baixarExcel, dataBR } from './exportar.js';

// Demonstração: ?demo, ou sempre que o site é uma prévia de proposta (endereço com "--", ex.: projeto--pr3-abc.web.app).
// Assim a prévia nunca mexe nos dados reais.
const PREVIA = location.hostname.includes('--');
const DEMO = PREVIA || new URLSearchParams(location.search).has('demo');
// Modo TV (?tv): Painel em tela cheia para a sala de controle, trocando de área sozinho a cada 30 s.
const TV = new URLSearchParams(location.search).has('tv');
// Fontes carregam sem travar a página (sem script dentro do HTML, por causa da política de segurança do site).
{ const f = document.getElementById('fontes'); if (f) { if (f.sheet) f.media = 'all'; else f.addEventListener('load', () => { f.media = 'all'; }); } }
const DB = await import(DEMO ? './data-mock.js' : './data.js');
import { criarGestao, VIEWS_G, SUB_G } from './gestao.js';
import { criarEquip, VIEWS_E, SUB_E } from './equip.js';
import { criarPessoas, chaveFicha } from './pessoas.js';
import * as M from './movimento.js';
import { criarMeuDia } from './meudia.js';
import { ACESSOS, ACESSO, acessosDe, podeAcesso, indiceFerias, modulosDe } from './acessos.js';
import { criarAdministrativo, VIEWS_A, SUB_A } from './administrativo.js';
import { semAcento, casa, caixaBusca, filtrarLista, campoBusca } from './busca.js';
import { criarEscala, normRegime, letra, fatorRota, PERIODO, periodosDe } from './escala.js';
import { PERFIS_ABAS, GRUPOS_ABAS, configuravel, doPerfil, podeVer, resumoExcecao } from './permissoes.js';
const PAINEL_URL = 'https://gestao-eduardo.web.app/';

const TODAY = today();
const CUR_WEEK = weekOf(TODAY);
const CUR_MONTH = monthOfWeek(CUR_WEEK);
const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const title = s => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());
const fmtAt = d => { if (!(d instanceof Date) || isNaN(d)) return ''; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const n0 = v => Number(v).toLocaleString('pt-BR');

/* ---------------- estado ---------------- */
let AUTH = { status: 'loading' }, ME = null;
let PLANO = [], PL = new Map(), COLABS = [];
let SK = 'patio', AREAS = SETS.patio.areas; // conjunto de atividades aberto (patio | bateria)
const UI = { view: 'painel', mes: null, ini: null, area: 'TODAS', rota: 'TODAS', tipo: 'TODOS', q: '', soPend: false, escopo: 'semana', dia: null, aRota: null, eRota: null, pArea: 'RECEBIMENTO', confirm: null, iRota: 'TODAS', lider: '', more: 0, gMes: null, impIni: CUR_WEEK, busy: false };
UI.modulo = 'operacao';
try { const v = JSON.parse(localStorage.getItem('coqueria-ui') || '{}'); if (v.view) UI.view = v.view; if (v.modulo) UI.modulo = v.modulo === 'escala' ? 'gestao' : v.modulo === 'adm' ? 'frequencia' : v.modulo; if (v.esSet) UI.esSet = v.esSet; if (v.cfSet) UI.cfSet = v.cfSet; if (v.apArea) UI.apArea = v.apArea; if (v.aRotaPor) UI.aRotaPor = v.aRotaPor; if (v.progAbertas) UI.progAbertas = v.progAbertas; } catch (e) { /* ignora */ }
// Acesso (porta de entrada) desta sessão: operacao | sistema (o antigo Administrativo agora é um módulo da Operação).
try { const a = localStorage.getItem('dikma-acesso'); if (ACESSO[a]) UI.acesso = a; } catch (e) { /* ignora */ }
if (!UI.acesso) UI.acesso = 'operacao';
if (TV) { document.body.classList.add('tv'); UI.acesso = 'operacao'; UI.view = 'painel'; if (!['operacao', 'bateria'].includes(UI.modulo)) UI.modulo = 'operacao'; }
const ultimoLogin = () => { try { return localStorage.getItem('dikma-ultimo-login') || ''; } catch (e) { return ''; } };
const salvarAcesso = () => { try { localStorage.setItem('dikma-acesso', UI.acesso); } catch (e) { /* ignora */ } };
const salvarUI = () => { try { localStorage.setItem('coqueria-ui', JSON.stringify({ view: UI.view, modulo: UI.modulo, esSet: UI.esSet, cfSet: UI.cfSet, apArea: UI.apArea, aRotaPor: UI.aRotaPor })); } catch (e) { /* ignora */ } };

const rotas = () => (DB.cache.config && DB.cache.config.rotas) || [];
const tipos = () => (DB.cache.config && DB.cache.config.tipos) || [];
const meses = () => ((DB.cache.config && DB.cache.config.meses) || []).slice().sort();
const isAdmin = () => ME && ME.papel === 'admin';
// Perfis: admin (tudo) · gestor (todas as áreas + administração dos módulos dele, menos usuários)
// coordenador (aponta em todas as áreas dos módulos dele) · supervisor (até 2 áreas) · líder (1 área) · leitor · bloqueado
const ehDoModulo = () => !!ME && modsDe(ME).includes(UI.modulo);
const admMod = () => isAdmin() || (!!ME && ME.papel === 'gestor' && ehDoModulo());
const todasAreas = () => isAdmin() || (!!ME && ['gestor', 'coordenador'].includes(ME.papel) && ehDoModulo());
const myAreas = () => (ME && (ME.papel === 'lider' || ME.papel === 'supervisor') ? [...new Set([ME.area, ME.papel === 'supervisor' ? ME.area2 : null].filter(a => a && AREAS.includes(a)))] : []);
const myArea = () => { const l = myAreas(); return l.length ? (l.includes(UI.area) ? UI.area : l[0]) : null; };
const areaScope = () => myArea() || UI.area;
const canEdit = area => todasAreas() || myAreas().includes(area);
const canEditSit = area => todasAreas() || myAreas().includes(area);
// Seletor de área para quem tem área fixa: uma área = travado; duas (supervisor) = escolhe entre as dele.
const selMinhaArea = (id, rot = 'Área') => myAreas().length > 1
  ? `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${myAreas().map(a => `<option value="${a}" ${a === myArea() ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>`
  : `<label class="sel"><span>${rot}</span><select class="in" disabled><option>${AREA_S[myArea()]}</option></select></label>`;
const papelNome = p => (PAPEIS.find(x => x[0] === p) || [p, p])[1];

function rebuild() {
  PLANO = AREAS.flatMap(a => DB.cache.plano[a] || []);
  PL = new Map(PLANO.map(p => [p.id, p]));
  COLABS = AREAS.flatMap(a => DB.cache.colabs[a] || []);
}
function ensurePeriod() {
  const ms = meses();
  if (!ms.length) return;
  if (!UI.mes || !ms.includes(UI.mes)) UI.mes = ms.includes(CUR_MONTH) ? CUR_MONTH : ms[ms.length - 1];
  const ws = weeksOfMonth(UI.mes);
  if (!UI.ini || !ws.includes(UI.ini)) UI.ini = ws.includes(CUR_WEEK) ? CUR_WEEK : ws[0];
  DB.watchMonths([UI.mes, CUR_MONTH, addMonth(CUR_MONTH, -1)]);
}

/* ---------------- consultas ---------------- */
const docsFor = ({ mes, ini, area }) => Object.values(DB.cache.semanas).filter(d => (!mes || d.mes === mes) && (!ini || d.ini === ini) && (!area || area === 'TODAS' || d.area === area));
// Datas dos 7 dias de cada semana, calculadas uma vez só (as telas grandes chamam isso milhares de vezes).
const diasDe = doc => (doc._dias && doc._dias.ini === doc.ini ? doc._dias.v : (doc._dias = { ini: doc.ini, v: DAYS.map((_, k) => add(doc.ini, k)) }).v);
function st(doc, i, k) { const c = doc.d[i][k]; if (c === 'P' && diasDe(doc)[k] < TODAY) return 'A'; return c === '_' ? 'X' : c; }
function stats(docs, { rota = 'TODAS', tipo = 'TODOS' } = {}) {
  const s = { prog: 0, R: 0, N: 0, P: 0, A: 0, E: 0, progHoje: 0, Rhoje: 0, day: Array.from({ length: 7 }, () => ({ R: 0, N: 0, P: 0, A: 0, E: 0 })) };
  for (const doc of docs) for (let i = 0; i < doc.ids.length; i++) {
    const p = PL.get(doc.ids[i]); if (!p) continue;
    if (rota !== 'TODAS' && p.rota !== rota) continue; if (tipo !== 'TODOS' && p.tipo !== tipo) continue;
    const str = doc.d[i];
    for (let k = 0; k < 7; k++) {
      const c = str[k]; if (c === '_') continue;
      const dt = diasDe(doc)[k];
      if (c === 'E') { s.E++; s.day[k].E++; continue; }
      s.prog++; if (dt <= TODAY) s.progHoje++;
      if (c === 'R') { s.R++; s.day[k].R++; if (dt <= TODAY) s.Rhoje++; }
      else if (c === 'N') { s.N++; s.day[k].N++; }
      else { s.P++; if (dt < TODAY) { s.A++; s.day[k].A++; } else s.day[k].P++; }
    }
  }
  return s;
}
const rotasDa = area => rotas().filter(r => area === 'TODAS' || r.area === area);
const ATR_MEMO = new Map();
function atrasadasAll(area) {
  const mk = `${typeof DATAV === 'undefined' ? 0 : DATAV}|${SK}|${TODAY}|${area}`; // o menu pede isto a cada desenho
  if (ATR_MEMO.has(mk)) return ATR_MEMO.get(mk);
  if (ATR_MEMO.size > 20) ATR_MEMO.clear();
  const out = [];
  for (const doc of docsFor({ area })) for (let i = 0; i < doc.ids.length; i++) for (let k = 0; k < 7; k++)
    if (doc.d[i][k] === 'P' && diasDe(doc)[k] < TODAY) out.push({ doc, i, k, dt: diasDe(doc)[k] });
  out.sort((a, b) => (a.dt < b.dt ? -1 : 1)); ATR_MEMO.set(mk, out); return out;
}

/* ---------------- gravações ---------------- */
function localChange(doc, i, k, c, motivo) {
  DATAV++;
  const a = [...doc.d[i]]; a[k] = c; const str = a.join('');
  const pid = doc.ids[i];
  doc.d[i] = str; if (doc.s) doc.s[pid] = str;
  const mk = pid + '|' + k; if (c === 'N' && motivo) doc.m[mk] = motivo; else delete doc.m[mk];
  return { pid, str, k, motivo: c === 'N' ? motivo : null };
}
function setSt(doc, i, k, c, motivo) {
  if (!canEdit(doc.area)) { toast('Seu perfil não pode apontar nesta área'); return; }
  const ch = localChange(doc, i, k, c, motivo);
  UI.flash = { id: doc.id, i, k, t: Date.now() };
  gravarApont(doc, [ch]);
  const p = PL.get(doc.ids[i]); const nm = { R: 'realizada', N: 'não realizada', P: 'voltou para programada', E: 'extra', _: 'extra removida' }[c];
  DB.log(`${p ? p.ativ : doc.ids[i]} · ${p ? p.rota : ''} · ${DAYS[k]} ${ddmm(add(doc.ini, k))} → ${nm}${c === 'N' && motivo ? ' (' + motivo + ')' : ''}`);
}

/* ---------------- aprovação dos apontamentos ---------------- */
// O líder aponta; o supervisor (ou coordenador, gestor, administrador) aprova ou devolve com o motivo.
// O que ainda espera aprovação já conta nos números, com o selo "aguardando". Vale dos apontamentos a partir de APROV_DESDE.
const aprovador = () => !!ME && aprovaPapel(ME.papel);
const areasAprov = () => (!aprovador() ? [] : todasAreas() ? AREAS : myAreas());
const aprovDe = (doc, pid, k) => ((DB.cache.aprov || {})[doc.id] || {})[pid + '|' + k];
// 'pend' (aguardando) · 'ok' (aprovada) · 'dev' (devolvida ao líder) · null (nada a aprovar)
const estAprov = (doc, i, k) => estadoAprov(doc.d[i][k], diasDe(doc)[k], aprovDe(doc, doc.ids[i], k), TODAY, doc.m[doc.ids[i] + '|' + k]);
// A lista é usada no menu, no Painel, no Apontar e no Meu dia a cada desenho: guarda até os dados mudarem.
let DATAV = 0; const APROV_MEMO = new Map();
function listaAprov(areas, est = 'pend') {
  const mk = `${DATAV}|${SK}|${TODAY}|${est}|${areas.join(',')}`;
  if (APROV_MEMO.has(mk)) return APROV_MEMO.get(mk);
  if (APROV_MEMO.size > 40) APROV_MEMO.clear();
  const out = [];
  for (const doc of Object.values(DB.cache.semanas)) {
    if (!areas.includes(doc.area)) continue;
    const ds = diasDe(doc); if (ds[6] < APROV_DESDE || ds[0] > TODAY) continue;
    for (let i = 0; i < doc.ids.length; i++) { if (!PL.get(doc.ids[i])) continue; for (let k = 0; k < 7; k++) if (estAprov(doc, i, k) === est) out.push({ doc, i, k, dt: ds[k], p: PL.get(doc.ids[i]) }); }
  }
  out.sort((a, b) => (a.dt < b.dt ? 1 : a.dt > b.dt ? -1 : a.p.rota.localeCompare(b.p.rota) || a.p.id.localeCompare(b.p.id)));
  APROV_MEMO.set(mk, out); return out;
}
// Grava o apontamento; quando quem aponta é supervisor para cima, já fica aprovado.
function gravarApont(doc, ch) {
  DATAV++;
  if (!ch.length) return;
  DB.setStatusMany(doc.id, ch);
  if (!aprovador() || !canEdit(doc.area)) return;
  const it = {};
  for (const x of ch) { const c = x.str[x.k]; if ((c === 'R' || c === 'N' || c === 'E') && add(doc.ini, x.k) >= APROV_DESDE) it[x.pid + '|' + x.k] = c === 'N' ? { s: 'A', c, m: x.motivo || '' } : { s: 'A', c }; }
  if (Object.keys(it).length) Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, it)).catch(() => toast('Não foi possível registrar a aprovação'));
}
function aprovar(itens) {
  DATAV++;
  const porDoc = new Map();
  for (const x of itens) { if (!porDoc.has(x.doc)) porDoc.set(x.doc, {}); const c = x.doc.d[x.i][x.k]; const key = x.doc.ids[x.i] + '|' + x.k; porDoc.get(x.doc)[key] = c === 'N' ? { s: 'A', c, m: x.doc.m[key] || '' } : { s: 'A', c }; }
  for (const [doc, it] of porDoc) Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, it)).catch(() => toast('Não foi possível aprovar'));
  if (itens.length) DB.log(`Aprovou ${itens.length === 1 ? `${itens[0].p.ativ} · ${itens[0].p.rota} · ${ddmm(itens[0].dt)}` : `${itens.length} apontamentos`}`);
}
function devolver(x, mot) {
  const { doc, i, k } = x; const ant = doc.d[i][k];
  const ch = localChange(doc, i, k, ant === 'E' ? '_' : 'P');
  DB.setStatusMany(doc.id, [ch]);
  Promise.resolve(DB.setAprov(doc.id, doc.area, doc.mes, { [doc.ids[i] + '|' + k]: { s: 'D', c: 'P', ant, mot } })).catch(() => toast('Não foi possível devolver'));
  DB.log(`Devolveu ao líder: ${x.p.ativ} · ${x.p.rota} · ${ddmm(x.dt)} (${mot})`);
}

/* ---------------- ícones ---------------- */
const I = {
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  causas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16"/><path d="M6 17V7M10 17V10M14 17v-4M18 17v-2"/><path d="M5 5l5 3 4 2 5 1"/></svg>',
  aprov: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  painel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  prog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h3M7 17h3M14 13h3"/></svg>',
  apontar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  escala: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.6 0 4.4 1.6 5 4.3"/></svg>',
  pend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/></svg>',
  plano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/><path d="M18 16l2 2 3-4"/></svg>',
  gerador: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/></svg>',
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  google: '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};
const VIEWS = [
  { id: 'meudia', nome: 'Meu dia', ic: 'sol', grp: 'Hoje', mod: 'all' },
  { id: 'painel', nome: 'Painel', ic: 'painel', grp: 'Acompanhar', mod: 'op' },
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Acompanhar', mod: 'op' },
  { id: 'aprovar', nome: 'Aprovação', ic: 'aprov', grp: 'Acompanhar', mod: 'op', req: () => aprovador() },
  { id: 'causas', nome: 'Causas e ações', ic: 'causas', grp: 'Acompanhar', mod: 'op' },
  { id: 'resumo', nome: 'Resumo da semana', ic: 'print', grp: 'Acompanhar', mod: 'op' },
  { id: 'etiquetas', nome: 'Etiquetas QR das rotas', ic: 'qr', grp: 'Acompanhar', mod: 'op', req: () => aprovador() || admMod() },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Acompanhar', mod: 'op' },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Acompanhar', mod: 'op' },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Administração', admin: true, mod: 'op' },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Administração', admin: true, mod: 'op' },
  { id: 'config', nome: 'Rotas e configurações', ic: 'config', grp: 'Administração', admin: true, mod: 'op' },
  { id: 'esdia', nome: 'Efetivo diário', ic: 'escala', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esdim', nome: 'Dimensionamento', ic: 'painel', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esbal', nome: 'Balanço e ausências', ic: 'prog', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'eshe', nome: 'Banco de horas extras', ic: 'relogio', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  ...VIEWS_E,
  ...VIEWS_G,
  ...VIEWS_A,
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Administração', admin: true, mod: 'all' },
  { id: 'perfis', nome: 'Perfis e permissões', ic: 'key', grp: 'Administração', admin: true, mod: 'all' },
  { id: 'cfgeral', nome: 'Visão geral', ic: 'painel', grp: 'Geral', admin: true, mod: 'cf' },
  { id: 'cfconf', nome: 'Conferência do cadastro', ic: 'pend', grp: 'Geral', admin: true, mod: 'cf' },
  { id: 'cfuso', nome: 'Uso do plano grátis', ic: 'prog', grp: 'Geral', admin: true, mod: 'cf' },
  { id: 'cfescala', nome: 'Escalas e turnos', ic: 'escala', grp: 'Geral', admin: true, mod: 'cf' }
];
// As telas de administração de cada módulo passam a morar no módulo Configurações (mesmas telas, mesmos dados).
{
  const gestorDe = m => () => isAdmin() || (!!ME && ME.papel === 'gestor' && modsReais(ME).includes(m));
  const gestorAtiv = () => isAdmin() || (!!ME && ME.papel === 'gestor' && setsDe(ME).length > 0);
  const CFV = {
    cfgeral: { ord: 1 }, cfconf: { ord: 1.2, req: () => isAdmin() }, cfuso: { ord: 1.4, req: () => isAdmin() }, cfescala: { ord: 2 },
    config: { ord: 3, grp: 'Atividades', req: gestorAtiv }, plano: { ord: 4, grp: 'Atividades', req: gestorAtiv }, gerador: { ord: 5, grp: 'Atividades', req: gestorAtiv },
    econfig: { ord: 6, grp: 'Operação', nome: 'Operação (equipamentos)', req: gestorDe('equipamentos') },
    gtipos: { ord: 7, grp: 'Efetivo', req: gestorDe('gestao') }, gimport: { ord: 8, grp: 'Efetivo', req: () => isAdmin() },
    usuarios: { ord: 9, grp: 'Acesso', req: () => isAdmin() }, perfis: { ord: 10, grp: 'Acesso', req: () => isAdmin() }
  };
  for (const v of VIEWS) if (CFV[v.id]) Object.assign(v, { mod: 'cf', admin: true }, CFV[v.id]);
  // fichas de acompanhamento: só quem tem o Efetivo marcado no usuário (os dados das fichas só chegam para essas pessoas)
  for (const v of VIEWS) if (v.mod === 'ge' && !v.reqU) v.reqU = u => temFichas(u);
}
const CHIP = { P: '', R: '✓', N: '✕', E: '+', A: '!', X: '·' };
const MODS = { operacao: { nome: 'Atividades Pátio', curto: 'Pátio', sub: 'Pátio de Carvão', key: 'op', inicio: 'painel' }, bateria: { nome: 'Atividades Bateria', curto: 'Bateria', sub: 'Bateria, Trilho e CDQ', key: 'op', inicio: 'painel' }, equipamentos: { nome: 'Operação', curto: 'Operação', sub: 'Equipamentos e operadores', key: 'eq', inicio: 'epainel' }, gestao: { nome: 'Efetivo', curto: 'Efetivo', sub: 'Escala, presença e fichas', key: 'ge', inicio: 'esdia' } , config: { nome: 'Administração do sistema', curto: 'Sistema', sub: 'Ajustes de todo o sistema', key: 'cf', inicio: 'cfgeral' }, frequencia: { nome: 'Frequência e férias', curto: 'Frequência', sub: 'Folha de 16 a 15 e férias', key: 'ad', inicio: 'afreq' } };
const TODOS_MODS = Object.keys(MODS);
// Ícones dos módulos: pilha de carvão (Pátio), fornos lado a lado (Bateria), engrenagem de equipamento (Operação), pessoas (Efetivo).
const MOD_IC = {
  operacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 19h18M5 19l4.5-8 3 4.5L15 12l4 7"/><circle cx="16.5" cy="6.5" r="1.8"/></svg>',
  bateria: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20h18M5 20V9h14v11M9 20V9M13 20V9M17 20V9M7 9V5h10v4"/></svg>',
  escala: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="9" cy="15" r="1.6"/><path d="M13 15.5l1.6 1.6 3-3.2"/></svg>',
  equipamentos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17h2l2-6h7l3 6h4v3H3z"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/><path d="M14 11V6h3"/></svg>',
  config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>',
  gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.6 0 4.4 1.6 5 4.3"/></svg>'
};
const ACESSO_IC = {
  operacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20h18M5 20V9h14v11M9 20V9M13 20V9M17 20V9M7 9V5h10v4"/></svg>',
  administrativo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  sistema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>'
};
MOD_IC.frequencia = ACESSO_IC.administrativo;
function menuModulos(abrir) {
  UI.modOpen = abrir;
  const p = document.querySelector('.modpick'); if (!p) return;
  p.classList.toggle('aberto', abrir);
  const b = p.querySelector('[data-modmenu]'); if (b) b.setAttribute('aria-expanded', abrir);
  if (abrir) { const it = p.querySelector('.modmenu [aria-checked="true"]') || p.querySelector('.modmenu button'); if (it) it.focus(); }
}
// Escala e Efetivo não se marca no usuário: vem junto com Atividades Pátio ou Bateria.
const MODS_MARCAVEIS = ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'];
// Módulos marcados no usuário (os que trazem dados) · modsDe = o que aparece no menu:
// Efetivo também aparece para quem tem Atividades (parte da escala); Configurações para administrador e gestor.
const modsReais = u => (!u ? [] : u.papel === 'admin' ? MODS_MARCAVEIS : modulosDe(u).filter(m => MODS_MARCAVEIS.includes(m)));
const temFichas = u => modsReais(u).includes('gestao');
// Módulos que aparecem no menu, conforme o acesso aberto: Operação (os módulos da pessoa) ou Administração do sistema.
const modsDe = u => {
  if (!u) return [];
  if (UI.acesso === 'sistema') return u.papel === 'admin' ? ['config'] : [];
  const b = modsReais(u); return MODS_MARCAVEIS.filter(m => b.includes(m) || (m === 'gestao' && (b.includes('operacao') || b.includes('bateria'))));
};
const setsDe = u => ['patio', 'bateria'].filter(k => modsReais(u).includes(SETS[k].mod));
const permCfg = () => DB.cache.permissoes || {};
const viewsDoModulo = () => { const l = VIEWS.filter(v => (v.mod === MODS[UI.modulo].key || (v.mod === 'all' && ((UI.acesso === 'operacao' && UI.modulo !== 'frequencia') || v.id !== 'meudia'))) && (!v.admin || (v.mod === 'all' ? isAdmin() : admMod())) && (!v.req || v.req()) && (!v.reqU || v.reqU(ME)) && podeVer(ME, v, permCfg())); return UI.modulo === 'config' ? l.sort((a, b) => (a.ord || 0) - (b.ord || 0)) : l; };
// Liga as telas de atividades ao conjunto do módulo aberto (Pátio ou Bateria).
function aplicarSet() {
  let k = UI.modulo === 'bateria' ? 'bateria' : 'patio';
  if (UI.modulo === 'gestao') { const ss = setsDe(ME); k = ss.includes(UI.esSet) ? UI.esSet : (ss[0] || 'patio'); UI.esSet = k; }
  if (UI.modulo === 'config') { const ss = setsDe(ME); k = ss.includes(UI.cfSet) ? UI.cfSet : (ss[0] || 'patio'); UI.cfSet = k; }
  if (k !== SK) { SK = k; Object.assign(UI, { area: 'TODAS', rota: 'TODAS', aRota: null, eRota: null, iRota: 'TODAS', dia: null, mes: null, ini: null, confirm: null }); }
  DB.useSet(k); AREAS = SETS[k].areas;
  if (!AREAS.includes(UI.pArea)) UI.pArea = AREAS[0];
  if (UI.area !== 'TODAS' && !AREAS.includes(UI.area)) UI.area = 'TODAS';
  if (myArea()) UI.area = myArea();
}
// Abas que foram juntadas ou tiradas: links antigos, avisos do celular e o que ficou salvo no aparelho caem na aba nova.
const VIEW_NOVA = { prog: 'apontar', gocorr: 'gcolab', gcontrole: 'gcolab', epar: 'elanc', apainel: 'afreq', relfoto: 'painel' };
function normalizarView() {
  const v0 = UI.view; if (!VIEW_NOVA[v0]) return;
  UI.view = VIEW_NOVA[v0];
  if (v0 === 'gocorr' && UI.g) { UI.g.mat = null; UI.g.filtro = 'pend'; }
  if (v0 === 'epar' && UI.e) { UI.e.aba = 'par'; UI.e.pf = 'aberta'; }
}
function ensureModulo() {
  normalizarView();
  const ms = modsDe(ME); if (!ms.length) return;
  if (UI.modulo === 'escala') UI.modulo = 'gestao'; // módulo antigo, agora dentro do Efetivo
  if (!ms.includes(UI.modulo)) { UI.modulo = ms[0]; }
  // Aba desligada para o perfil some do menu e não abre nem por link: cai na primeira aba liberada do módulo.
  const vs = viewsDoModulo();
  if (!vs.some(v => v.id === UI.view)) UI.view = vs.some(v => v.id === MODS[UI.modulo].inicio) ? MODS[UI.modulo].inicio : (vs.find(v => v.id !== 'meudia') || vs[0] || { id: MODS[UI.modulo].inicio }).id;
}
const ST_NOME = { P: 'Programado', R: 'Realizado', N: 'Não realizado', E: 'Extra', A: 'Atrasado', X: 'Não programada' };

// Só troca o HTML de um bloco quando ele mudou: atualização de dados que não muda a tela não mexe em nada (sem piscar).
let VIEW_MUDOU = false;
function pintar(id, html) { const el = document.getElementById(id); if (!el || el._h === html) return false; el.innerHTML = html; el._h = html; if (id === 'view') VIEW_MUDOU = true; return true; }
/* ---------------- telas de acesso ---------------- */
const $ = id => document.getElementById(id);
function gate(html) { const ly = document.getElementById('layer'); if (ly && ly.innerHTML) ly.innerHTML = ''; fecharSitPop(); ['view', 'top', 'nav', 'who', 'tabbar'].forEach(id => { const e = document.getElementById(id); if (e) e._h = null; }); $('shell').hidden = true; $('gate').hidden = false; $('gate').innerHTML = `<div class="gatecard"><div class="brand big"><img class="logo on-light" src="img/dikma-logo.png" alt="Dikma"><img class="logo on-dark" src="img/dikma-logo-branco.png" alt="Dikma"><div class="prod"><b>GESTÃO</b></div></div>${html}</div>`; }

const senhaField = (id, label, ac) => `<label class="sel"><span>${label}</span><div class="pwd"><input class="in" id="${id}" type="password" autocomplete="${ac}" required minlength="8"><button type="button" class="btn ghost eye" data-eye="${id}" aria-label="Mostrar senha">${I.eye}</button></div></label>`;
// Tema da tela neste aparelho: automático (segue o aparelho), claro ou escuro.
const TEMAS = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };
const temaAtual = () => { try { const t = localStorage.getItem('dikma-tema'); return TEMAS[t] ? t : 'auto'; } catch (e) { return 'auto'; } };
const IC_TEMA = { auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>', light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' };
function aplicarTema(t) {
  try { if (t === 'auto') localStorage.removeItem('dikma-tema'); else localStorage.setItem('dikma-tema', t); } catch (e) { /* sem armazenamento: vale só agora */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const escuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', escuro ? '#14132e' : '#1C1B4A');
  const w = $('who'); if (w) { const b = w.querySelector('[data-act="tema"]'); if (b) b.remove(); } render();
}
const proxTema = () => ({ auto: 'light', light: 'dark', dark: 'auto' })[temaAtual()];
function temaSheet() { const t = temaAtual(); sheet('Tema da tela', 'Vale só neste aparelho', Object.entries(TEMAS).map(([k, n]) => ({ t: n, d: k === 'auto' ? 'Segue o claro ou escuro do aparelho' : '', k, cur: k === t, ic: `<span class="opt-ic">${IC_TEMA[k]}</span>` })), o => { aplicarTema(o.k); toast(`Tema ${o.t.toLowerCase()}`); }); }
// Troca entre a Operação e a Administração do sistema (só o administrador): recarrega para buscar os dados certos.
function irAcesso(k) {
  if (!isAdmin() || !ACESSO[k]) return;
  UI.acesso = k; salvarAcesso(); if (DB.definirAcesso) DB.definirAcesso(k);
  UI.modulo = k === 'sistema' ? 'config' : 'operacao'; UI.view = ACESSO[k].inicio; UI.modOpen = false; salvarUI();
  $('view').innerHTML = M.ESQUELETO; location.reload();
}
function renderGate() {
  const s = AUTH.status;
  const sair = `<button class="btn" data-act="logout">${I.out} Sair</button>`;
  if (s === 'loading') return gate('<p class="muted">Carregando…</p>');
  if (s === 'noConfig') return gate(`<h2>Sistema ainda não conectado</h2><p>Este endereço não encontrou a configuração do Firebase. Publique pelo Firebase Hosting (veja o README do projeto).</p><a class="btn" href="?demo">Abrir a demonstração</a>`);
  if (s === 'signedOut') {
    // Todo mundo entra direto na Operação; a Administração do sistema o administrador abre lá dentro.
    return gate(`<h2>Entrar</h2><p class="muted m0">Use o usuário e a senha que o administrador passou.</p>
    ${AUTH.expirou ? '<p class="small m0" role="status"><b>Sua sessão terminou depois de 7 dias sem uso.</b> Entre de novo.</p>' : ''}
    ${AUTH.msg ? `<p class="err m0" role="alert">${esc(AUTH.msg)}</p>` : ''}
    <form id="fLogin" class="stackform" novalidate>
    <label class="sel"><span>Usuário</span><input class="in" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(ultimoLogin())}"></label>
    ${senhaField('lgPass', 'Senha', 'current-password')}
    <p class="err" id="lgErr" role="alert" hidden></p>
    <button class="btn pri big" type="submit" ${UI.busy ? 'disabled' : ''}>${UI.busy ? 'Entrando…' : 'Entrar'}</button></form>
    <p class="muted small m0">Não tem acesso ou esqueceu a senha? Fale com o administrador do sistema.</p>
    <button type="button" class="btn ghost sm temab" data-act="tema">${IC_TEMA[temaAtual()]} Tema: ${TEMAS[temaAtual()].toLowerCase()}</button>
    ${DEMO ? '<p class="muted small m0">Demonstração: usuário <b>admin</b>, senha <b>123456</b>.</p>' : ''}`);
  }
  if (s === 'semAcesso') return gate(`<h2>Sem acesso</h2><p>O usuário <b>${esc(AUTH.user.login || AUTH.user.nome || '')}</b> não entra em <b>${esc((ACESSO[AUTH.acesso] || {}).nome || '')}</b>.${AUTH.acesso === 'sistema' ? ' Esse acesso é só do administrador.' : ' Fale com o administrador do sistema.'}</p><button class="btn pri" data-act="trocarAcesso">Entrar em outro acesso</button>`);
  if (s === 'firstAdmin') return gate(`<h2>Sistema sem administrador</h2><p>Por segurança, o administrador não é criado por esta tela.</p><p class="muted small">Quem cuida do sistema cria pelo GitHub: <b>Actions › Administrador do sistema › Run workflow</b>, informando nome e usuário. A senha provisória aparece no resultado da execução.</p>`);
  if (s === 'mustChange') return gate(`<h2>Crie sua senha</h2><p>Olá, <b>${esc(title(AUTH.user.nome))}</b>. No primeiro acesso, troque a senha provisória por uma só sua.</p><form id="fMust" class="stackform" novalidate>
    ${senhaField('mcPass', 'Nova senha (mínimo 8 caracteres, sem o seu nome)', 'new-password')}
    ${senhaField('mcPass2', 'Repita a nova senha', 'new-password')}
    <p class="err" id="mcErr" role="alert" hidden></p>
    <button class="btn pri big" type="submit">Salvar e entrar</button></form>${DEMO ? mockSwitcher() : sair}`);
  if (s === 'blocked') return gate(`<h2>Acesso bloqueado</h2><p>O usuário <b>${esc(AUTH.user.login || '')}</b> está bloqueado. Fale com o administrador do sistema.</p>${DEMO ? mockSwitcher() : sair}`);
  if (s === 'noProfile') return gate(`<h2>Usuário sem cadastro</h2><p>Esta conta não tem cadastro no sistema. Fale com o administrador.</p>${sair}`);
  if (s === 'error') return gate(`<h2>Não foi possível entrar</h2><p class="muted">${esc(AUTH.msg || '')}</p>${sair}`);
}
function mockSwitcher() {
  return `<label class="sel"><span>Entrar como (demonstração)</span><select class="in" id="mockUser">${ME ? '' : '<option value="">—</option>'}${DB.cache.usuarios.map(u => `<option value="${u.uid}" ${ME && u.uid === ME.uid ? 'selected' : ''}>${esc(title(u.nome))} · ${papelNome(u.papel)}${u.area ? ' · ' + AREA_S[u.area] : ''}</option>`).join('')}</select></label>`;
}

/* ---------------- shell ---------------- */
// Desenha a tela. Trocar de tela anima a entrada; atualização de dados mantém a rolagem das tabelas.
let ULT = '';
function render() {
  const view = $('view');
  const k = AUTH.status === 'ready' ? `${UI.modulo}|${UI.view}|${(UI.g && UI.g.mat) || ''}` : '';
  const nav = k !== ULT || !!view.querySelector('.skel');
  const pos = nav ? null : M.guardarRolagem(view);
  VIEW_MUDOU = false;
  renderTela();
  if (AUTH.status !== 'ready') { ULT = ''; return; }
  ULT = k;
  if (nav && !view.querySelector('.skel')) M.entrarTela(view); else if (!nav && VIEW_MUDOU) { M.semRepetir(view); M.restaurarRolagem(view, pos); }
  M.moverIndicador();
  if (UI.flash && Date.now() - UI.flash.t > 500) UI.flash = null;
  if (UI.flash) {
    const f = UI.flash; // vale por meio segundo: a atualização de dados que chega logo depois redesenha a tela
    M.pulsar(view.querySelector(`[data-cell="${CSS.escape(f.id + '|' + f.i + '|' + f.k)}"]`));
    const ap = view.querySelector(`[data-ap^="${f.i}|${f.k}|"]`); if (ap) M.pulsar(ap.closest('.act'));
  }
}
const ES_VIEWS = ['esdia', 'esdim', 'esbal', 'eshe'];
function renderTela() {
  if (AUTH.status !== 'ready') return renderGate();
  $('gate').hidden = true; $('shell').hidden = false;
  ensureModulo(); aplicarSet(); rebuild();
  if (UI.modulo === 'frequencia') { renderNav(); renderTop(); pintar('view', AD.render(UI.view)); afterRender(); return; }
  if (UI.modulo === 'config' && !['plano', 'gerador', 'config'].includes(UI.view)) { renderNav(); renderTop(); pintar('view', UI.view === 'meudia' ? MD.view() : vConfigModulo(UI.view)); afterRender(); return; }
  if ((UI.modulo === 'gestao' && !ES_VIEWS.includes(UI.view)) || UI.modulo === 'equipamentos') { renderNav(); renderTop(); pintar('view', UI.view === 'usuarios' ? vUsuarios() : UI.view === 'perfis' ? vPerfis() : UI.view === 'meudia' ? MD.view() : UI.modulo === 'gestao' ? GE.render(UI.view) : EQ.render(UI.view)); afterRender(); return; }
  if (UI.view === 'meudia' || UI.view === 'perfis') { renderNav(); renderTop(); pintar('view', UI.view === 'perfis' ? vPerfis() : MD.view()); afterRender(); return; }
  if (!DB.cache.configLoaded) { pintar('top', '<h1>Carregando…</h1>'); pintar('view', M.ESQUELETO); renderNav(); return; }
  if (!DB.cache.config) { renderNav(); pintar('top', `<h1>Primeiro acesso<small>Importar os dados da planilha</small></h1>`); pintar('view', vImportar()); return; }
  ensurePeriod();
  const v = VIEWS.find(x => x.id === UI.view) || VIEWS[0];
  if (v.admin && !admMod()) UI.view = 'painel';
  renderNav(); renderTop();
  const needWeeks = ['painel', 'prog', 'apontar', 'aprovar', 'esdia', 'esdim', 'esbal', 'imprimir', 'causas', 'resumo', 'eshe'].includes(UI.view);
  if (needWeeks && !DB.cache.monthsLoaded.has(UI.mes)) { pintar('view', M.ESQUELETO); return; }
  const fn = { painel: vPainel, apontar: vApontar, aprovar: vAprovar, pend: vPend, imprimir: vImprimir, causas: vCausas, resumo: vResumo, etiquetas: vEtiquetas, eshe: vEsHe, plano: vPlano, gerador: vGerador, usuarios: vUsuarios, config: vConfig, esdia: vEsDia, esdim: vEsDim, esbal: vEsBal }[UI.view];
  pintar('view', fn());
  afterRender();
}
let raf = 0;
// Atualizações de dados chegam em rajadas (várias coleções de uma vez): junta tudo num só desenho.
const schedule = () => { if (raf) return; raf = setTimeout(() => requestAnimationFrame(() => { raf = 0; const a = document.activeElement; const keep = a && a.id && a.matches('input[type=search],input[type=text],input:not([type])') ? [a.id, a.selectionStart] : null; render(); if (keep) { const n = $(keep[0]); if (n && document.activeElement !== n) { n.focus(); try { n.setSelectionRange(keep[1], keep[1]); } catch (e) { /* ignora */ } } } }), 40); };

function renderNav() {
  const ge = UI.modulo === 'gestao', eqm = UI.modulo === 'equipamentos';
  // Selo de Pendências: só os atrasos dos últimos 7 dias, na área da pessoa (um número que dá para resolver).
  const atr = !ge && !eqm && UI.modulo !== 'config' && UI.modulo !== 'frequencia' && DB.cache.config ? atrasadasAll(myArea() || 'TODAS').filter(x => x.dt >= add(TODAY, -7)).length : 0;
  const gb = ge ? (temFichas(ME) ? GE.badge() : 0) : eqm ? EQ.badge() : 0;
  const apv = !ge && !eqm && UI.modulo !== 'config' && UI.modulo !== 'frequencia' && DB.cache.config && aprovador() ? listaAprov(areasAprov()).length : 0;
  const ms = modsDe(ME);
  const cur = MODS[UI.modulo];
  const linha = m => `<span class="mi">${MOD_IC[m]}</span><span class="mt"><b>${MODS[m].nome}</b><small>${MODS[m].sub}</small></span>`;
  let h = `<div class="modpick${UI.modOpen ? ' aberto' : ''}">
    <button class="modbtn" ${ms.length > 1 ? `data-modmenu="1" aria-haspopup="menu" aria-expanded="${!!UI.modOpen}" aria-label="Módulo atual: ${cur.nome}. Trocar de módulo"` : 'tabindex="-1" aria-disabled="true"'}>${linha(UI.modulo)}${ms.length > 1 ? `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4"/></svg>` : ''}</button>
    ${ms.length > 1 ? `<div class="modmenu" role="menu" aria-label="Módulos">${ms.map(m => `<button role="menuitemradio" aria-checked="${UI.modulo === m}" data-mod="${m}">${linha(m)}${UI.modulo === m ? '<svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</button>`).join('')}</div>` : ''}
  </div>`, g = '';
  for (const v of viewsDoModulo()) {
    if (v.grp !== g) { g = v.grp; h += `<div class="grp">${g}</div>`; }
    const badge = v.id === 'pend' && atr ? atr : v.id === 'aprovar' && apv ? apv : (v.id === 'gcolab' || v.id === 'elanc') && gb ? gb : 0;
    h += `<button data-go="${v.id}" ${UI.view === v.id ? 'aria-current="page"' : ''}>${I[v.ic]}<span>${v.nome}</span>${badge ? `<span class="badge num" title="${v.id === 'pend' ? 'Atrasadas nos últimos 7 dias' : v.id === 'aprovar' ? 'Aguardando aprovação' : ''}">${badge > 99 ? '99+' : badge}</span>` : ''}</button>`;
  }
  pintar('nav', h);
  pintar('who', DEMO
    ? `${mockSwitcher()}<div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div><button class="btn rail-btn" data-act="mockReset">Restaurar demonstração</button>`
    : `<div class="me"><span class="av">${esc((ME.nome || '?')[0].toUpperCase())}</span><div><b>${esc(title(ME.nome || ME.login || ''))}</b><small>${ME.login ? esc(ME.login) + ' · ' : ''}${papelNome(ME.papel)}${ME.area ? ' · ' + AREA_S[ME.area] : ''}</small></div></div><div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Alterar senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div>`);
  { const w = $('who'); if (w && !w.querySelector('[data-act="tema"]')) { const t = temaAtual(); w.insertAdjacentHTML('beforeend', `<button class="btn rail-btn temab" data-act="tema" title="Trocar o tema da tela">${IC_TEMA[t]} Tema: ${TEMAS[t].toLowerCase()}</button>`); } }
  // Só o administrador vê a Administração do sistema: um botão leva para lá e outro volta para a Operação.
  // Atalho para o Painel Coqueria (site próprio, mesmo login): só para o administrador.
  { const w = $('who'); if (w && !w.querySelector('[data-painel]') && isAdmin()) w.insertAdjacentHTML('afterbegin', `<a class="btn rail-btn" data-painel href="${PAINEL_URL}" target="_blank" rel="noopener">${I.painel} Meu painel</a>`); }
  { const w = $('who'); if (w && !w.querySelector('[data-act="irAcesso"]') && isAdmin()) { const k = UI.acesso === 'sistema' ? 'operacao' : 'sistema'; w.insertAdjacentHTML('afterbegin', `<button class="btn rail-btn trocaac" data-act="irAcesso">${ACESSO_IC[k] || ''} ${k === 'sistema' ? 'Administração do sistema' : 'Voltar para a Operação'}</button>`); } }
  const tb = barraDe();
  pintarBarra(tb, atr, gb, apv);
}
// Barra de baixo (celular): até 4 atalhos do módulo + Mais.
function barraDe() {
  const ge = UI.modulo === 'gestao', eqm = UI.modulo === 'equipamentos';
  const tb = ge ? [['meudia', 'Hoje', 'sol'], ['esdia', 'Escala', 'escala'], ['gcolab', 'Pessoas', 'users'], ['esbal', 'Balanço', 'prog'], ['gpainel', 'Painel', 'painel'], ['__more', 'Mais', 'more']]
    : eqm ? [['meudia', 'Hoje', 'sol'], ['elanc', 'Lançar', 'apontar'], ['eequipe', 'Equipe', 'users'], ['epainel', 'Painel', 'painel'], ['__more', 'Mais', 'more']]
    : UI.modulo === 'config' ? [['cfgeral', 'Geral', 'config'], ['cfconf', 'Conferência', 'pend'], ['cfescala', 'Escalas', 'escala'], ['usuarios', 'Usuários', 'users'], ['__more', 'Mais', 'more']]
    : UI.modulo === 'frequencia' ? [['afreq', 'Frequência', 'prog'], ['aferias', 'Férias', 'sol'], ['aimport', 'Importar', 'dl'], ['__more', 'Mais', 'more']]
    : aprovador() ? [['meudia', 'Hoje', 'sol'], ['painel', 'Painel', 'painel'], ['apontar', 'Apontar', 'apontar'], ['aprovar', 'Aprovar', 'aprov'], ['pend', 'Pendências', 'pend'], ['__more', 'Mais', 'more']]
    : [['meudia', 'Hoje', 'sol'], ['painel', 'Painel', 'painel'], ['apontar', 'Apontar', 'apontar'], ['pend', 'Pendências', 'pend'], ['__more', 'Mais', 'more']];
  { const ok = new Set(viewsDoModulo().map(v => v.id)); for (let i = tb.length - 1; i >= 0; i--) if (tb[i][0] !== '__more' && !ok.has(tb[i][0])) tb.splice(i, 1); }
  return [...tb.filter(x => x[0] !== '__more').slice(0, 4), ['__more', 'Mais', 'more']];
}
function pintarBarra(tb, atr, gb, apv = 0) {
  const inMore = !tb.some(x => x[0] === UI.view);
  const moreBadge = (tb.some(x => x[0] === 'pend') ? 0 : atr) + (tb.some(x => x[0] === 'aprovar') ? 0 : apv);
  pintar('tabbar', tb.map(([id, n, ic]) => `<button data-go="${id}" class="${id === 'apontar' || id === 'elanc' ? 'big' : ''}" ${(UI.view === id || (id === '__more' && inMore)) ? 'aria-current="page"' : ''}><span class="ic">${I[ic]}</span>${n}${id === '__more' && moreBadge ? `<span class="badge">${moreBadge > 99 ? '99+' : moreBadge}</span>` : ''}${(id === 'elanc' || id === 'gcolab') && gb ? `<span class="badge">${gb}</span>` : ''}${id === 'aprovar' && apv ? `<span class="badge">${apv > 99 ? '99+' : apv}</span>` : ''}${id === 'pend' && atr ? `<span class="badge">${atr > 99 ? '99+' : atr}</span>` : ''}</button>`).join(''));
}
function syncPill() {
  const n = DB.pendingWrites(); const off = !navigator.onLine;
  if (DEMO) return '<span class="pill neu" title="Os dados ficam só neste navegador">Demonstração</span>';
  if (off) return `<span class="pill warn" role="status">Sem sinal${n ? ` · ${n} aguardando envio` : ''}</span>`;
  if (n) return `<span class="pill neu sync" role="status">Sincronizando ${n}…</span>`;
  return '<span class="pill ok" title="Tudo salvo no servidor">Sincronizado</span>';
}
function periodControls({ semana = true, area = true, mes = true } = {}) {
  let h = '<div class="filters">';
  if (mes) h += `<label class="sel"><span>Mês</span><select class="in" id="fMes">${meses().map(m => `<option value="${m}" ${m === UI.mes ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>`;
  if (semana) h += `<label class="sel"><span>Semana</span><select class="in" id="fSem">${weeksOfMonth(UI.mes).map(w => `<option value="${w}" ${w === UI.ini ? 'selected' : ''}>${weekLabel(w)}${w === CUR_WEEK ? ' · atual' : ''}</option>`).join('')}</select></label>`;
  if (area) {
    if (myArea()) h += selMinhaArea('fArea');
    else h += `<label class="sel"><span>Área</span><select class="in" id="fArea"><option value="TODAS">Todas as áreas</option>${AREAS.map(a => `<option value="${a}" ${a === UI.area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>`;
  }
  if (semana && UI.ini !== CUR_WEEK && meses().includes(CUR_MONTH)) h += `<button class="btn" data-act="hoje" style="align-self:flex-end">Semana atual</button>`;
  return h + '</div>';
}
// Filtros de período e área. No celular viram uma linha só (botão), que abre um painel com as mesmas escolhas.
function mudarFiltro(id, v) {
  if (id === 'fMes') { UI.mes = v; const ws = weeksOfMonth(UI.mes); UI.ini = ws.includes(CUR_WEEK) ? CUR_WEEK : ws[0]; UI.more = 0; UI.dia = null; }
  else if (id === 'fSem') { UI.ini = v; UI.dia = null; UI.more = 0; }
  else if (id === 'fArea') { UI.area = v; UI.rota = 'TODAS'; UI.more = 0; }
  render();
}
const semanaCurta = ini => { const f = add(ini, 6); return ini === CUR_WEEK ? `Esta semana · ${ini.slice(8)} a ${ddmm(f)}` : `${ini.slice(8)}/${ini.slice(5, 7)} a ${ddmm(f)}`; };
function filtroCompacto(comSet) {
  const area = ['apontar', 'imprimir'].includes(UI.view) ? '' : myArea() ? (myAreas().length > 1 ? AREA_S[myArea()] : '') : (UI.area === 'TODAS' ? 'Todas as áreas' : AREA_S[UI.area]);
  const partes = [comSet ? SETS[SK].curto : '', UI.view === 'etiquetas' ? '' : ['causas', 'eshe'].includes(UI.view) ? monthLabel(UI.mes) : semanaCurta(UI.ini), area].filter(Boolean);
  return `<button type="button" class="fcomp" data-act="filtros" aria-label="Filtros: ${esc(partes.join(', '))}. Tocar para mudar"><span>${esc(partes.join(' · '))}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
function filtroSheet() {
  const L = $('layer');
  const comSet = ES_VIEWS.includes(UI.view) && setsDe(ME).length > 1;
  const corpo = () => `${comSet ? `<div class="seg setsw" role="tablist" aria-label="Conjunto">${setsDe(ME).map(k => `<button type="button" role="tab" data-esset="${k}" aria-selected="${SK === k}">${SETS[k].curto}</button>`).join('')}</div>` : ''}${periodControls({ area: !['apontar', 'imprimir'].includes(UI.view), semana: !['causas', 'etiquetas', 'eshe'].includes(UI.view), mes: UI.view !== 'etiquetas' })}`;
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Filtros"><h3>Mostrar</h3><div id="fsCorpo" class="stackcol">${corpo()}</div><button class="btn pri center" data-close>Pronto</button></div></div>`;
  const kd = e => { if (e.key === 'Escape') fechar(); };
  const fechar = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  const redesenhar = () => { const c = $('fsCorpo'); if (c) c.innerHTML = corpo(); };
  $('scrim').onclick = e => {
    e.stopPropagation();
    if (e.target.id === 'scrim' || e.target.closest('[data-close]')) return fechar();
    const set = e.target.closest('[data-esset]'); if (set) { UI.esSet = set.dataset.esset; UI.eRota = '*'; UI.area = 'TODAS'; salvarUI(); render(); redesenhar(); return; }
    if (e.target.closest('[data-act="hoje"]')) { UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; UI.dia = null; render(); redesenhar(); }
  };
  $('scrim').onchange = e => { if (['fMes', 'fSem', 'fArea'].includes(e.target.id)) { mudarFiltro(e.target.id, e.target.value); redesenhar(); } };
  const f = L.querySelector('select'); if (f) f.focus();
}
// Busca rápida (lupa no topo, Ctrl+K ou /): pessoa, equipamento, rota ou tela, e leva direto para lá.
function indiceBusca() {
  const out = []; const ms = modsDe(ME);
  for (const v of viewsDoModulo()) out.push({ t: v.nome, d: `Tela · ${MODS[UI.modulo].nome}`, k: 'tela', ir: () => { UI.view = v.id; } });
  for (const m of ms) if (m !== UI.modulo) out.push({ t: MODS[m].nome, d: `Módulo · ${MODS[m].sub}`, k: 'tela', ir: () => { UI.modulo = m; UI.view = MODS[m].inicio; } });
  if (UI.modulo === 'frequencia') { // Frequência e férias: pessoas das folhas e das férias
    const vistos = new Set(); const A = DB.cache.adm || {};
    for (const f of A.ferias || []) { const k = f.mat || f.nome; if (vistos.has(k)) continue; vistos.add(k); out.push({ t: title(f.nome), d: `Férias · ${f.setor || ''}${f.mat ? ' · matrícula ' + f.mat : ''}`, k: 'pessoa', ir: () => { UI.view = 'aferias'; if (UI.a) { UI.a.fQ = f.nome; UI.a.fAba = 'todas'; } } }); }
    for (const [id, c] of Object.entries(A.comps || {})) if (c) for (const g of c.grupos || []) for (const p of g.pessoas) { const k = p.mat || p.nome; if (vistos.has('f' + k)) continue; vistos.add('f' + k); out.push({ t: title(p.nome), d: `Frequência · ${id.startsWith('bateria') ? 'Bateria' : 'Pátio'} · ${g.nome}`, k: 'pessoa', ir: () => { UI.view = 'afreq'; if (UI.a) { UI.a.conj = id.split('|')[0]; UI.a.q = p.nome; } } }); }
    return out;
  }
  for (const k of setsDe(ME)) {
    const st = DB.dados(k); if (!st || !st.config) continue;
    for (const r of st.config.rotas || []) if (r.carga > 0 && (!myAreas().length || myAreas().includes(r.area))) out.push({ t: r.rota, d: `Rota · ${SETS[k].curto} · ${AREA_S[r.area]}`, k: 'rota', ir: () => { UI.modulo = SETS[k].mod; UI.view = 'apontar'; UI.area = r.area; UI.aRota = r.rota; } });
    for (const a of Object.keys(st.colabs || {})) for (const c of st.colabs[a]) out.push({ t: title(c.nome), d: `Escala · ${SETS[k].curto} · ${AREA_S[c.area] || c.area} · ${c.rota}`, k: 'pessoa', ir: () => { UI.modulo = 'gestao'; UI.view = 'esdia'; UI.esSet = k; UI.eRota = '*'; UI.eQ = title(c.nome); } });
  }
  if (temFichas(ME)) for (const c of (DB.cache.g && DB.cache.g.colabs) || []) out.push({ t: title(c.nome), d: `Ficha · matrícula ${c.mat}`, k: 'pessoa', ir: () => { UI.modulo = 'gestao'; UI.view = 'gcolab'; if (UI.g) UI.g.mat = c.mat; else UI.g = { mat: c.mat }; } });
  if (ms.includes('equipamentos') && DB.cache.e && DB.cache.e.cad) {
    for (const f of DB.cache.e.cad.frota || []) out.push({ t: f.id, d: `Equipamento · ${title(f.tipo || '')}`, k: 'eq', ir: () => { UI.modulo = 'equipamentos'; UI.view = 'eequipe'; } });
    for (const o of DB.cache.e.cad.operadores || []) out.push({ t: title(o.nome), d: `Operador · ${title(o.funcao || '')}`, k: 'pessoa', ir: () => { UI.modulo = 'equipamentos'; UI.view = 'eequipe'; } });
  }
  return out.map(x => ({ ...x, n: semAcento(x.t + ' ' + x.d).toLowerCase() }));
}
function abrirBusca() {
  const L = $('layer'); let idx = null, sel = 0, res = [];
  L.innerHTML = `<div class="scrim busca" id="scrim"><div class="sheet buscasheet" role="dialog" aria-modal="true" aria-label="Buscar"><div class="buscain">${I.lupa}<input class="in" id="bqIn" type="search" autocomplete="off" placeholder="Pessoa, equipamento, rota ou tela" aria-controls="bqRes"></div><div class="opts" id="bqRes" role="listbox"></div><p class="muted small m0">Enter abre · Esc fecha</p></div></div>`;
  const kd = e => { if (e.key === 'Escape') fechar(); };
  const fechar = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  const pintarRes = () => {
    const q = semAcento($('bqIn').value).toLowerCase().trim(); const tk = q.split(/\s+/).filter(Boolean);
    if (!idx) idx = indiceBusca();
    res = tk.length ? idx.filter(x => tk.every(t => x.n.includes(t))).slice(0, 12) : idx.filter(x => x.k === 'tela').slice(0, 8);
    if (sel >= res.length) sel = 0;
    $('bqRes').innerHTML = res.length ? res.map((x, i) => `<button class="opt" role="option" data-bq="${i}" aria-selected="${i === sel}"><span>${esc(x.t)}<br><small class="muted">${esc(x.d)}</small></span></button>`).join('') : '<p class="muted m0">Nada encontrado.</p>';
  };
  const abrir = i => { const x = res[i]; if (!x) return; fechar(); UI.confirm = null; UI.modOpen = false; x.ir(); ensureModulo(); aplicarSet(); salvarUI(); render(); scrollTo(0, 0); };
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim') return fechar(); const b = e.target.closest('[data-bq]'); if (b) abrir(+b.dataset.bq); };
  $('bqIn').oninput = () => { sel = 0; pintarRes(); };
  $('bqIn').onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); pintarRes(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); pintarRes(); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(sel); }
  };
  pintarRes(); $('bqIn').focus();
}
document.addEventListener('keydown', e => {
  if (AUTH.status !== 'ready' || $('layer').innerHTML) return;
  const digitando = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
  if (e.key === 'k' && (e.ctrlKey || e.metaKey) && !digitando) { e.preventDefault(); abrirBusca(); }
  else if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); abrirBusca(); }
});
const BUSCA_BTN = '<button type="button" class="btn ghost buscabtn" data-act="busca" aria-label="Buscar pessoa, equipamento, rota ou tela (Ctrl+K)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><span>Buscar</span><kbd>Ctrl K</kbd></button>';
function renderTop() {
  const v = VIEWS.find(x => x.id === UI.view);
  if (UI.modulo === 'config' && v.mod === 'cf') {
    const sub = { cfgeral: 'Ajustes de todos os módulos, num lugar só', cfescala: 'Regimes, turmas e feriados: a folga é marcada sozinha pela escala', config: `Efetivo padrão, carga e listas · ${SETS[SK].nome}`, plano: `Modelo semanal usado pelo gerador · ${SETS[SK].nome}`, gerador: `Cria as semanas do mês a partir do plano padrão · ${SETS[SK].nome}`, econfig: SUB_E.econfig, gtipos: SUB_G.gtipos, gimport: SUB_G.gimport, usuarios: 'Quem acessa o sistema e o que pode fazer', perfis: 'Quais abas cada perfil vê, módulo por módulo' }[v.id] || '';
    const sw = ['config', 'plano', 'gerador'].includes(v.id) && setsDe(ME).length > 1 ? `<div class="seg setsw" role="tablist" aria-label="Conjunto">${setsDe(ME).map(k => `<button type="button" role="tab" data-cfset="${k}" aria-selected="${SK === k}">${SETS[k].curto}</button>`).join('')}</div>` : '';
    pintar('top', `<h1>${v.nome}<small>${sub}</small></h1>${sw}${BUSCA_BTN}<div class="syncwrap" id="sync">${syncPill()}</div>`); return;
  }
  if (UI.modulo === 'frequencia') { pintar('top', `<h1>${v.nome}<small>${SUB_A[v.id] || ''}</small></h1>${AD.topo(v.id)}${BUSCA_BTN}<div class="syncwrap" id="sync">${syncPill()}</div>`); return; }
  if ((UI.modulo === 'gestao' && !ES_VIEWS.includes(v.id)) || UI.modulo === 'equipamentos' || v.mod === 'all') { pintar('top', `<h1>${v.nome}<small>${v.id === 'meudia' ? 'O que é seu hoje, em todos os módulos' : v.id === 'perfis' ? 'Quais abas cada perfil vê, módulo por módulo' : SUB_G[v.id] || SUB_E[v.id] || 'Quem acessa o sistema e o que pode fazer'}</small></h1>${BUSCA_BTN}<div class="syncwrap" id="sync">${syncPill()}</div>`); return; }
  const sub = { painel: 'Produtividade do período', prog: 'Programado × realizado por atividade', apontar: 'Marque o que foi feito no dia', aprovar: 'Confira e aprove o que os líderes apontaram', causas: 'Por que as atividades não foram feitas, e o que está sendo feito', resumo: 'A semana numa página, pronta para imprimir ou salvar em PDF', etiquetas: 'Cole no local: o líder aponta a câmera e abre a rota no Apontar', eshe: `Dias de hora extra por pessoa e por origem · ${SETS[SK].nome}`, escala: 'Disponíveis × necessários por rota', pend: 'Atividades sem apontamento em dias que já passaram', imprimir: 'Folha semanal para marcação em campo', plano: 'Modelo semanal usado pelo gerador', gerador: 'Cria as semanas do mês a partir do plano padrão', usuarios: 'Quem acessa o sistema e o que pode fazer', config: 'Efetivo padrão, carga e listas', esdia: `Presença de cada pessoa, dia a dia · ${SETS[SK].nome}`, esdim: `Disponíveis × necessários por rota · ${SETS[SK].nome}`, esbal: `Quem está fora e o saldo da semana · ${SETS[SK].nome}` }[UI.view];
  let ctr = '';
  const comFiltro = ['painel', 'prog', 'esdia', 'esdim', 'esbal', 'imprimir', 'apontar', 'causas', 'resumo', 'etiquetas', 'eshe'].includes(UI.view);
  const comSet = ES_VIEWS.includes(UI.view) && setsDe(ME).length > 1;
  if (comFiltro && isMobile()) ctr = `<div class="fbar">${filtroCompacto(comSet)}</div>`;
  else {
    if (comFiltro) ctr = periodControls({ area: !['apontar', 'imprimir'].includes(UI.view), semana: !['causas', 'etiquetas', 'eshe'].includes(UI.view), mes: UI.view !== 'etiquetas' });
    if (comSet) ctr = `<div class="seg setsw" role="tablist" aria-label="Conjunto">${setsDe(ME).map(k => `<button type="button" role="tab" data-esset="${k}" aria-selected="${SK === k}">${SETS[k].curto}</button>`).join('')}</div>` + ctr;
  }
  pintar('top', `<h1>${v.nome}<small>${sub}</small></h1>${ctr}${BUSCA_BTN}<div class="syncwrap" id="sync">${syncPill()}</div>`);
}

/* ---------------- PAINEL ---------------- */
let tvT = 0;
function tvGirar() {
  clearTimeout(tvT); if (DB.marcarUso) DB.marcarUso(); // a TV fica ligada o dia todo: conta como uso tvT = setTimeout(() => { if (AUTH.status === 'ready' && UI.view === 'painel' && !myArea()) { const l = ['TODAS', ...AREAS]; UI.area = l[(l.indexOf(UI.area) + 1) % l.length]; render(); } tvGirar(); }, 30000);
}
function vPainel() {
  if (TV) { UI.escopo = 'semana'; if (UI.ini !== CUR_WEEK) { UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; } if (!tvT) tvGirar(); }
  const area = areaScope();
  const scope = UI.escopo === 'semana' ? { ini: UI.ini, area } : { mes: UI.mes, area };
  const docs = docsFor(scope); const s = stats(docs);
  const ef = pct(s.Rhoje, s.progHoje), ap = pct(s.R + s.N, s.progHoje);
  const seg = `<div class="filters" role="group" aria-label="Período"><button class="btn ${UI.escopo === 'semana' ? 'dark' : ''}" data-esc="semana">Semana</button><button class="btn ${UI.escopo === 'mes' ? 'dark' : ''}" data-esc="mes">Mês inteiro</button></div>`;
  const hm = new Date().toTimeString().slice(0, 5);
  let h = TV ? `<div class="tvhead"><b>${area === 'TODAS' ? 'Todas as áreas' : AREA_S[area]}</b><span>${SETS[SK].nome} · ${weekLabel(UI.ini)} · atualizado às ${hm}</span><a class="btn sm ghost" href="${location.pathname}${DEMO ? '?demo' : ''}">Sair do modo TV</a></div>`
    : `<div class="row-between">${seg}<span class="muted">${UI.escopo === 'semana' ? weekLabel(UI.ini) : monthLabel(UI.mes)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span>${!framed && !isMobile() ? `<a class="btn sm ghost" href="${location.pathname}?tv${DEMO ? '&demo' : ''}" target="_blank" rel="noopener" title="Painel em tela cheia, trocando de área sozinho (sala de controle)">Modo TV</a>` : ''}</div>`;
  if (!docs.length) return h + '<div class="card"><div class="empty">Nenhuma programação gerada para este período.</div></div>';
  {
    const as = area === 'TODAS' ? AREAS : [area]; const ids = new Set(docs.map(d => d.id)); // só o período que o Painel mostra
    const pa = listaAprov(as).filter(x => ids.has(x.doc.id)).length, dv = listaAprov(as, 'dev').filter(x => ids.has(x.doc.id)).length;
    if (pa || dv) h += `<div class="aprovbar"><span>${I.aprov}<span>${pa ? `<b class="num">${pa}</b> apontamento${pa > 1 ? 's' : ''} aguardando aprovação` : ''}${pa && dv ? ' · ' : ''}${dv ? `<b class="num">${dv}</b> devolvido${dv > 1 ? 's' : ''} ao líder para corrigir` : ''}<small>${UI.escopo === 'semana' ? 'Nesta semana' : 'Neste mês'} · já contam nos números abaixo.</small></span></span>${pa && aprovador() ? '<button class="btn pri sm" data-go="aprovar">Aprovar</button>' : dv && canEdit(as[0]) ? '<button class="btn sm" data-go="apontar">Abrir o Apontar</button>' : ''}</div>`;
  }
  h += `<div class="kpis">
   <div class="kpi hero"><span class="lbl">Eficiência até hoje</span><span class="v num">${ef}%</span><span class="s num">${n0(s.Rhoje)} realizadas de ${n0(s.progHoje)} programadas até ${ddmm(TODAY)}</span><div class="meter"><i style="width:${ef}%"></i></div></div>
   <div class="kpi"><span class="lbl">Programadas</span><span class="v num">${n0(s.prog)}</span><span class="s">no período</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-real)"></i>Realizadas</span><span class="v num">${n0(s.R)}</span><span class="s">${pct(s.R, s.prog)}% do período</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Não realizadas</span><span class="v num">${n0(s.N)}</span><span class="s">${pct(s.N, s.progHoje)}% até hoje</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Atrasadas</span><span class="v num">${n0(s.A)}</span><span class="s">dia passou, sem apontamento</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-extra)"></i>Extras</span><span class="v num">${s.E}</span><span class="s">fora da programação · apontamento ${ap}%</span></div>
  </div>`;
  const legend = `<div class="legend"><span><i style="background:var(--st-real)"></i>Realizada</span><span><i style="background:var(--st-nreal)"></i>Não realizada</span><span><i style="background:var(--st-atr)"></i>Atrasada</span><span><i style="background:var(--st-prog);opacity:.45"></i>A fazer</span></div>`;
  const bar = x => { const t = x.prog || 1; return `<div class="stack">${[['R', 'st-real', 1], ['N', 'st-nreal', 1], ['A', 'st-atr', 1], ['Pf', 'st-prog', 0.45]].map(([k, c, o]) => { const v = k === 'Pf' ? x.P - x.A : x[k]; return v ? `<i style="width:${v / t * 100}%;background:var(--${c});opacity:${o}" title="${ST_NOME[k === 'Pf' ? 'P' : k]}: ${v}"></i>` : ''; }).join('')}</div>`; };
  let left;
  if (area === 'TODAS') {
    left = `<div class="card"><header><h2>Resultado por área</h2><p>Toque para filtrar</p></header><div class="body">${legend}<div class="bars">${AREAS.map(a => { const x = stats(docsFor({ ...scope, area: a })); return `<button class="barrow" data-area="${a}"><span class="n">${AREA_S[a]}<small class="num">${x.R} de ${x.prog}</small></span>${bar(x)}<span class="p num">${pct(x.Rhoje, x.progHoje)}%</span></button>`; }).join('')}</div></div></div>`;
  } else {
    left = `<div class="card"><header><h2>Resultado por rota</h2><p>${AREA_S[area]}</p></header><div class="body">${legend}<div class="bars">${rotasDa(area).filter(r => r.carga > 0).map(r => { const x = stats(docs, { rota: r.rota }); return `<div class="barrow"><span class="n">${esc(r.rota)}<small class="num">${x.R} de ${x.prog}</small></span>${bar(x)}<span class="p num">${pct(x.Rhoje, x.progHoje)}%</span></div>`; }).join('')}</div></div></div>`;
  }
  let right;
  if (UI.escopo === 'semana') {
    const mx = Math.max(1, ...s.day.map(d => d.R + d.N + d.P + d.A + d.E));
    right = `<div class="card"><header><h2>Dia a dia</h2><p>${weekLabel(UI.ini)}</p></header><div class="body">${legend.replace('</div>', '<span><i style="background:var(--st-extra)"></i>Extra</span></div>')}
    <div class="cols" role="img" aria-label="Atividades por dia da semana">${s.day.map((d, k) => { const t = d.R + d.N + d.P + d.A + d.E; return `<div class="col" title="${DAYS[k]}: ${d.R} realizadas, ${d.N} não realizadas, ${d.A} atrasadas, ${d.P} a fazer, ${d.E} extras"><span class="tot num">${t || ''}</span>${[['P', 'st-prog', 0.45], ['A', 'st-atr', 1], ['N', 'st-nreal', 1], ['E', 'st-extra', 1], ['R', 'st-real', 1]].map(([kk, c, o]) => (d[kk] ? `<i style="height:${d[kk] / mx * 100}%;background:var(--${c});opacity:${o}"></i>` : '')).join('')}</div>`; }).join('')}</div>
    <div class="colx">${DAYS.map((d, k) => `<div class="${add(UI.ini, k) === TODAY ? 'today' : ''}"><b>${d}</b>${ddmm(add(UI.ini, k))}</div>`).join('')}</div></div></div>`;
  } else {
    right = `<div class="card"><header><h2>Semana a semana</h2><p>${monthLabel(UI.mes)}</p></header><div class="body">${legend}<div class="bars">${weeksOfMonth(UI.mes).map(w => { const x = stats(docsFor({ ini: w, area })); return `<div class="barrow"><span class="n">${weekLabel(w).split(' · ')[0]}<small>${weekLabel(w).split(' · ')[1]}</small></span>${bar(x)}<span class="p num">${x.progHoje ? pct(x.Rhoje, x.progHoje) + '%' : '—'}</span></div>`; }).join('')}</div></div></div>`;
  }
  h += `<div class="grid2">${left}${right}</div>`;
  h += `<div class="grid2 g-ef">${cardAusencias(area)}${cardBalanco(area, UI.ini)}</div>`;
  const rs = rotasDa(area).filter(r => r.carga > 0).map(r => ({ r, x: stats(docsFor({ ...scope, area: r.area }), { rota: r.rota }) })).sort((a, b) => b.x.A - a.x.A || pct(a.x.Rhoje, a.x.progHoje) - pct(b.x.Rhoje, b.x.progHoje));
  const todasRotas = !!UI.rotasTodas || rs.length <= 8;
  h += `<div class="card"><header><h2>Rotas que pedem atenção</h2><p>Ordenadas por atrasadas${todasRotas ? '' : ` · as 8 primeiras de ${rs.length}`}</p>${rs.length > 8 ? `<span class="r"><button class="btn sm" data-act="rotasTodas">${UI.rotasTodas ? 'Só as 8 primeiras' : `Ver todas (${rs.length})`}</button></span>` : ''}</header><div class="tw"><table><thead><tr><th>Rota</th><th>Área</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realiz.</th><th class="r">Atrasadas</th><th>Eficiência até hoje</th></tr></thead><tbody>
  ${(todasRotas ? rs : rs.slice(0, 8)).map(({ r, x }) => { const e = pct(x.Rhoje, x.progHoje); return `<tr><td><b>${esc(r.rota)}</b></td><td class="muted">${AREA_S[r.area]}</td><td class="r num">${x.prog}</td><td class="r num">${x.R}</td><td class="r num">${x.N}</td><td class="r num">${x.A ? `<span class="pill warn">${x.A}</span>` : '0'}</td><td><span class="ef"><i style="width:${e}%"></i></span><span class="num">${e}%</span></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
  h += `<div class="card"><header><h2>Últimos registros</h2><p>Quem apontou o quê, em tempo real</p></header><div class="body">${logHtml(8)}</div></div>`;
  return h;
}
function logHtml(n) {
  const L = DB.cache.log;
  if (!L.length) return '<div class="empty">Nenhum registro ainda. Os apontamentos feitos no Apontar aparecem aqui.</div>';
  return `<div class="log">${L.slice(0, n).map(l => `<div><time>${fmtAt(l.at)}</time><span><b>${esc(title(l.nome))}</b> · ${esc(l.t)}</span></div>`).join('')}</div>`;
}

/* ---------------- PROGRAMAÇÃO ---------------- */
const isMobile = () => matchMedia('(max-width:860px)').matches;
/* ---------------- APONTAR ---------------- */
// Área aberta no Apontar (quem vê todas as áreas usa a última escolhida).
const apArea = () => { const a = areaScope(); return a === 'TODAS' ? (UI.apArea || AREAS[0]) : a; };
// Pendentes de uma área num dia da semana (para escolher a área e a rota que abrem primeiro).
function pendDia(area, k) { const d = DB.cache.semanas[area + '|' + UI.ini]; return d ? d.ids.reduce((n, id, i) => n + (d.d[i][k] === 'P' ? 1 : 0), 0) : 0; }
function vApontar() {
  // Quem vê todas as áreas não precisa escolher antes: abre na última área usada ou na que tem mais coisa para apontar hoje.
  if (UI.dia == null || UI.dia < 0 || UI.dia > 6) { const t = Math.round((pd(TODAY) - pd(UI.ini)) / 864e5); UI.dia = t >= 0 && t < 7 ? t : 0; }
  let area = areaScope();
  const varias = !myArea() || myAreas().length > 1;
  if (area === 'TODAS') { area = AREAS.includes(UI.apArea) ? UI.apArea : AREAS.slice().sort((a, b) => pendDia(b, UI.dia) - pendDia(a, UI.dia))[0]; }
  UI.apArea = area;
  const areasLista = myArea() ? myAreas() : AREAS;
  const chipsArea = varias ? `<div class="rchips linha" role="group" aria-label="Área">${areasLista.map(a => { const p = pendDia(a, UI.dia); return `<button class="rchip" data-aparea="${a}" aria-pressed="${a === area}">${AREA_S[a]}${p ? `<span class="c num">${p}</span>` : ''}</button>`; }).join('')}</div>` : '';
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  if (!doc) return chipsArea + `<div class="card"><div class="empty">Esta semana ainda não foi gerada para ${AREA_S[area]}.${admMod() ? ' <button class="btn sm" data-go="gerador">Abrir o Gerador de meses</button>' : ' O administrador gera os meses em Gerador de meses.'}</div></div>`;
  const k = UI.dia;
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  const edit = canEdit(area);
  const cnt = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] !== '_' ? 1 : 0), 0);
  const pendR = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] === 'P' ? 1 : 0), 0);
  // Rota: a escolhida antes nesta área; senão a primeira com algo para apontar
  UI.aRotaPor = UI.aRotaPor || {};
  if (UI.aRota && rts.includes(UI.aRota)) UI.aRotaPor[area] = UI.aRota;
  UI.aRota = rts.includes(UI.aRotaPor[area]) ? UI.aRotaPor[area] : (rts.find(r => pendR(r)) || rts[0]);
  UI.aRotaPor[area] = UI.aRota;
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] !== '_');
  const proxima = rts.find(r => r !== UI.aRota && pendR(r));
  const done = items.filter(x => 'RNE'.includes(doc.d[x.i][k])).length;
  const R = items.filter(x => doc.d[x.i][k] === 'R').length, N = items.filter(x => doc.d[x.i][k] === 'N').length, E = items.filter(x => doc.d[x.i][k] === 'E').length;
  const t = items.length || 1;
  const apAqui = areasAprov().includes(area) ? items.filter(x => estAprov(doc, x.i, k) === 'pend').length : 0;
  let h = chipsArea + `<div class="dayscroll" role="group" aria-label="Dia">${DAYS.map((d, j) => { const dt = add(UI.ini, j); return `<button class="dbtn ${dt === TODAY ? 'hoje' : ''}" data-dia="${j}" aria-pressed="${j === k}"><small>${d}</small><b>${dt.slice(8)}</b></button>`; }).join('')}</div>
  <div class="rchips linha" role="group" aria-label="Rota">${rts.map(r => { const c = cnt(r), p = pendR(r); return `<button class="rchip" data-arota="${esc(r)}" aria-pressed="${r === UI.aRota}">${esc(r)}<span class="c num">${p ? p : c ? '✓' : '—'}</span></button>`; }).join('')}</div>
  <div class="apbar"><div class="row-between"><b>${esc(UI.aRota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}</b><span class="muted num">${done} de ${items.length} feitas</span></div>
  <div class="stack"><i style="width:${R / t * 100}%;background:var(--st-real)"></i><i style="width:${N / t * 100}%;background:var(--st-nreal)"></i><i style="width:${E / t * 100}%;background:var(--st-extra)"></i></div>
  ${edit ? `<div class="row-gap">${items.length - done > 0 ? (UI.confirm === 'all' ? `<span class="confirm">Marcar as ${items.length - done} restantes como realizadas? <button class="btn pri sm" data-act="allok">Confirmar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>` : '<button class="btn sm" data-act="askAll">✓ Marcar restantes</button>') : ''}<button class="btn sm" data-act="extra">${I.plus} Extra</button>${apAqui ? `<button class="btn sm" data-act="aprvGrupo" data-k="${esc(add(UI.ini, k) + '|' + area + '|' + UI.aRota)}">${I.ok} Aprovar ${apAqui}</button>` : ''}</div>` : '<p class="muted small m0">Somente leitura nesta área.</p>'}</div>`;
  if (items.length && done === items.length) h += `<div class="card fimrota"><div class="body row-between"><span><b>Rota concluída.</b>${proxima ? ` Próxima com pendência: ${esc(proxima)} (${pendR(proxima)}).` : ' Nenhuma outra rota pendente neste dia.'}</span>${proxima ? `<button class="btn pri sm" data-arota="${esc(proxima)}">Ir para ${esc(proxima)}</button>` : ''}</div></div>`;
  if (!items.length) h += `<div class="card"><div class="empty">Nada programado para esta rota em ${DAYS[k]}. Se algo foi feito, registre como atividade extra.</div></div>`;
  // extras que o supervisor devolveu (saíram da lista): o líder vê o motivo e registra de novo se for o caso
  const exDev = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] === '_' && estAprov(doc, x.i, k) === 'dev');
  if (exDev.length) h += `<p class="aviso">${exDev.map(x => { const a = aprovDe(doc, x.p.id, k) || {}; return `Extra devolvida: <b>${esc(x.p.ativ)}</b> — ${esc(a.mot || '')}${a.nome ? ` (${esc(title(curto(a.nome)))})` : ''}`; }).join('<br>')}</p>`;
  h += '<div class="mlist">';
  for (const { i, p } of items) {
    const c = st(doc, i, k); const raw = doc.d[i][k]; const m = doc.m[p.id + '|' + k];
    const ea = estAprov(doc, i, k); const av = ea ? aprovDe(doc, p.id, k) || {} : null;
    const selo = ea === 'pend' ? ' · <span class="pill neu">aguardando aprovação</span>' : ea === 'ok' ? ' · <span class="pill ok">aprovada</span>' : ea === 'dev' ? ' · <span class="pill bad">devolvida</span>' : '';
    h += `<div class="act ${c}${ea === 'dev' ? ' devolvida' : ''}"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${esc(p.local)} · <span class="mono">${p.id}</span>${raw === 'E' ? ' · <span class="pill ext">extra</span>' : ''}${c === 'A' ? ' · <span class="pill warn">atrasada</span>' : ''}${selo}</div>${raw === 'N' ? `<div class="m">${m ? `Justificativa: ${esc(m)}` : '<span class="semt">Sem justificativa</span>'}${edit ? ` <button class="btn ghost link" data-just="${i}|${k}">${m ? 'editar' : 'justificar'}</button>` : ''}</div>` : ''}${ea === 'dev' ? `<div class="m devm">Devolvida${av.nome ? ` por ${esc(title(curto(av.nome)))}` : ''}: ${esc(av.mot || '')}. Confira e aponte de novo.</div>` : ''}</div>
    ${edit ? `<div class="bt">${raw === 'E' ? `<button class="no-btn" data-ap="${i}|${k}|rmE" aria-label="Remover extra" title="Remover extra">✕</button>` : `<button class="ok-btn" data-ap="${i}|${k}|R" aria-pressed="${raw === 'R'}" aria-label="Realizada">✓</button><button class="no-btn" data-ap="${i}|${k}|N" aria-pressed="${raw === 'N'}" aria-label="Não realizada">✕</button>`}</div>` : `<span class="pill ${{ R: 'ok', E: 'ok', N: 'bad', A: 'warn' }[c] || 'neu'}">${{ R: 'Realizada', E: 'Extra', N: 'Não realizada', A: 'Atrasada', P: 'A fazer' }[c] || ST_NOME[c] || ''}</span>`}</div>`;
  }
  return h + '</div>';
}

/* ---------------- ESCALA ---------------- */
/* ---------------- ESCALA DE TURNO ---------------- */
// Fonte única (config/escalas, com as turmas da Operação como reserva). Sem lançamento no dia, a situação vem da escala:
// administrativo folga no fim de semana e feriado; turno folga nos dias de folga da letra da turma.
let ESC = null, ESCc = undefined, ESCe = undefined;
function escala() { const c = DB.cache.escalas || null; const e = (DB.cache.e && DB.cache.e.config) || null; if (!ESC || ESCc !== c || ESCe !== e) { ESC = criarEscala(c || {}, e && e.turmas, []); ESCc = c; ESCe = e; } return ESC; }
const nk = s => semAcento(s).replace(/\s+/g, ' ').trim();
let TURk = '', TUR = new Map();
// Turma pela ficha do Efetivo ou pelo cadastro da Operação (mesmo nome), quando a pessoa não tem letra nas Atividades.
function turmaFicha(nome) {
  const g = (DB.cache.g && DB.cache.g.colabs) || []; const ops = (DB.cache.e && DB.cache.e.cad && DB.cache.e.cad.operadores) || [];
  const k = `${g.length}|${ops.length}|${DB.cache.gVersao || 0}|${DB.cache.eVersao || 0}`;
  if (TURk !== k) { TUR = new Map(); ops.forEach(o => { const l = letra(o.turma); if (l && o.escala === '4x4') TUR.set(nk(o.nome), l); }); g.forEach(c => { const l = letra(c.turma); if (l) TUR.set(nk(c.nome), l); }); TURk = k; }
  return TUR.get(nk(nome)) || '';
}
const turmaDe = c => letra(c.turma) || turmaFicha(c.nome);
const regimeDe = c => normRegime(c.regime, escala().regimes);
const regimeNome = c => { const r = escala().regimes[regimeDe(c)]; return r ? r.nome : title(c.regime || ''); };
// { v: código, auto: veio da escala, motivo, semTurma }
// Férias marcadas em Frequência e férias entram sozinhas como FE (o lançamento do dia ainda vale mais).
let FERI = null, FERIv = null;
const feriasDe = (c, dt) => { const l = DB.cache.feriasAtivas || (DB.cache.adm && DB.cache.adm.ferias) || []; if (FERIv !== l) { FERI = indiceFerias(l); FERIv = l; } return FERI({ mat: c.mat, nome: c.nome }, dt); };
function sitDia(c, dt) {
  const m = DB.sit(c.id + '|' + dt); if (m) return { v: m, auto: false };
  if (feriasDe(c, dt)) return { v: 'FE', auto: false, ferias: true }; // ausência (não é folga da escala: não vira hora extra)
  const p = escala().previsto(regimeDe(c), turmaDe(c), dt);
  if (p && !p.trab) return { v: 'F', auto: true, motivo: p.motivo };
  return { v: 'P', auto: false, semTurma: !p };
}
// Turno do dia pela letra: 'D' diurno, 'N' noturno, '' administrativo / folga / sem turma (a noite conta no dia em que começa)
const periodoDe = (c, dt) => { const p = escala().previsto(regimeDe(c), turmaDe(c), dt); return p && p.trab && p.periodo ? p.periodo : ''; };
const marcaPer = per => (per ? `<i class="peri ${per}" aria-hidden="true">${per}</i>` : '');
const folgaEscala = (c, dt) => { const p = escala().previsto(regimeDe(c), turmaDe(c), dt); return !!(p && !p.trab); };
// mesma regra para outros conjuntos (Meu dia): get(chave) devolve o lançado
const sitDiaDe = get => (c, dt) => { const m = get(c.id + '|' + dt); if (m) return m; if (feriasDe(c, dt)) return 'FE'; const p = escala().previsto(normRegime(c.regime, escala().regimes), turmaDe(c), dt); return p && !p.trab ? 'F' : undefined; };
const indisponivel = (c, dt) => { const v = sitDia(c, dt).v; return v !== 'DS' && AUSENTE.has(v); };
function escalaRota(r, ini) {
  const cs = COLABS.filter(c => c.area === r.area && c.rota === r.rota);
  const doc = DB.cache.semanas[r.area + '|' + ini];
  const fator = fatorRota(cs, escala().regimes); // rota de turno: só parte do quadro trabalha por dia
  const out = [];
  for (let k = 0; k < 7; k++) {
    const dt = add(ini, k);
    const aloc = cs.filter(c => DB.sit(c.id + '|' + dt) !== 'DS').length;
    const aus = cs.filter(c => DB.sit(c.id + '|' + dt) !== 'DS' && indisponivel(c, dt)).length;
    const escd = cs.filter(c => DB.sit(c.id + '|' + dt) !== 'DS' && !sitDia(c, dt).auto).length;
    // substituições: quem cobre uma ausência desta rota soma aqui; quem sai desta rota para cobrir outra, sai daqui
    let mov = 0; const ids = new Set(cs.map(c => c.id));
    for (const x of cobDoDia(dt)) { if (ids.has(x.aus) && COLABS.some(c => c.id === x.sub)) mov++; if (ids.has(x.sub)) { const sc = cs.find(c => c.id === x.sub); if (sc && DB.sit(sc.id + '|' + dt) !== 'DS' && !indisponivel(sc, dt)) mov--; } }
    let prog = 0; if (doc) doc.ids.forEach((id, i) => { if (PL.get(id) && PL.get(id).rota === r.rota && doc.d[i][k] !== '_') prog++; });
    const nec = r.carga > 0 ? Math.ceil(r.ef * prog / r.carga * fator) : (r.rota === 'GESTÃO' ? Math.min(r.ef, escd) : 0);
    // quem está disponível de dia e de noite (turno pela letra)
    const per = { D: 0, N: 0 }; cs.forEach(c => { if (DB.sit(c.id + '|' + dt) === 'DS' || indisponivel(c, dt)) return; const p = periodoDe(c, dt); if (p) per[p]++; });
    out.push({ disp: aloc - aus + mov, nec, prog, aloc, mov, dispD: per.D, dispN: per.N });
  }
  return { cs, days: out };
}
/* ---------------- EFETIVO NO PAINEL ---------------- */
const SIT_NOME = Object.fromEntries(SITS);
const SIT_TOM = { F: 'neu', FE: 'ext', AT: 'warn', AF: 'warn', TR: 'neu', FT: 'bad' };
const colabsDa = area => COLABS.filter(c => area === 'TODAS' || c.area === area);
// Quem não está hoje (folga, férias, atestado, afastado, treinamento, falta). Desligado não conta como ausência.
function cardAusencias(area) {
  const cs = colabsDa(area).filter(c => DB.sit(c.id + '|' + TODAY) !== 'DS');
  const sh = new Map(cs.map(c => [c.id, sitDia(c, TODAY)]));
  const folgaHoje = cs.filter(c => { const x = sh.get(c.id); return x.auto || x.v === 'F'; }).length;
  const ferias = cs.filter(c => sh.get(c.id).v === 'FE').length;
  const aus = cs.map(c => ({ c, v: sh.get(c.id).v, auto: sh.get(c.id).auto })).filter(x => !x.auto && AUSENCIA.has(x.v)).sort((a, b) => a.v.localeCompare(b.v) || a.c.rota.localeCompare(b.c.rota) || a.c.nome.localeCompare(b.c.nome));
  const atr = cs.filter(c => DB.sit(c.id + '|' + TODAY) === 'ATR').length;
  const por = {}; aus.forEach(x => { por[x.v] = (por[x.v] || 0) + 1; });
  const pres = cs.length - aus.length - folgaHoje - ferias;
  const lista = aus.length ? `<div class="aus-l">${aus.slice(0, 40).map(x => `<button class="aus-it" data-goescala="${esc(x.c.area + '|' + x.c.rota)}"><span class="minw"><b>${esc(title(x.c.nome))}</b><small>${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}${AUS_COBRIVEL.has(x.v) ? (cobertoPor(x.c.id, TODAY) ? ` · coberto por ${esc(curto(nomeDe(cobertoPor(x.c.id, TODAY))))}` : ' · <em class="semt">sem substituto</em>') : ''}</small></span><span class="pill ${SIT_TOM[x.v] || 'neu'}">${SIT_NOME[x.v]}</span></button>`).join('')}${aus.length > 40 ? `<p class="muted small m0">+ ${aus.length - 40}</p>` : ''}</div>` : '<div class="empty small">Ninguém ausente hoje.</div>';
  return `<div class="card"><header><h2>Ausências de hoje</h2><p>${ddmm(TODAY)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</p></header><div class="body">
    <div class="mini aus-mini"><div><b class="num">${pres}</b><span>Presentes</span></div><div><b class="num">${folgaHoje}</b><span>Folga</span></div>${ferias ? `<div><b class="num">${ferias}</b><span>Férias</span></div>` : ''}<div><b class="num" style="color:${aus.length ? 'var(--st-nreal)' : 'inherit'}">${aus.length}</b><span>Ausentes</span></div><div><b class="num">${pct(pres, cs.length - folgaHoje - ferias)}%</b><span>Presença dos escalados</span></div></div>
    ${aus.length ? `<div class="rchips">${Object.entries(por).map(([k, n]) => `<span class="rchip">${SIT_NOME[k]} · <b class="num">${n}</b></span>`).join('')}${atr ? `<span class="rchip">Atrasados · <b class="num">${atr}</b></span>` : ''}</div>` : ''}
    ${lista}</div></div>`;
}
// Balanço da semana: quadro, ausências por motivo, disponíveis × necessários e rotas em déficit, dia a dia.
function cardBalanco(area, ini) {
  const cs = colabsDa(area); const rs = rotasDa(area); const tk = DAYS.map((_, k) => add(ini, k) === TODAY);
  const esc7 = rs.map(r => escalaRota(r, ini));
  const dias = DAYS.map((_, k) => {
    const dt = add(ini, k); const quadro = cs.filter(c => DB.sit(c.id + '|' + dt) !== 'DS');
    const mot = {}; let aus = 0, fe = 0, fer = 0;
    quadro.forEach(c => { const x = sitDia(c, dt); if (x.auto || x.v === 'F') { fe++; return; } if (x.v === 'FE') { fer++; return; } if (AUSENCIA.has(x.v)) { aus++; mot[x.v] = (mot[x.v] || 0) + 1; } });
    const nec = esc7.reduce((n, e) => n + e.days[k].nec, 0);
    const def = rs.filter((r, i) => r.rota !== 'GESTÃO' && esc7[i].days[k].prog > 0 && esc7[i].days[k].disp < esc7[i].days[k].nec).length;
    const ids = new Set(cs.map(c => c.id)); const cob = cobDoDia(dt).filter(x => ids.has(x.aus)).length;
    const heD = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && DB.sitInfo(c.id + '|' + dt).he === 'DIKMA').length, heA = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && DB.sitInfo(c.id + '|' + dt).he === 'ARCELOR').length, heN = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && !DB.sitInfo(c.id + '|' + dt).he).length;
    return { cob, heD, heA, heN, q: quadro.length, fe, fer, esc: quadro.length - fe - fer, aus, mot, disp: quadro.length - fe - fer - aus, nec, saldo: quadro.length - fe - fer - aus - nec, def };
  });
  const motivos = [...AUSENCIA].filter(m => dias.some(d => d.mot[m]));
  const soma = f => dias.reduce((n, d) => n + f(d), 0);
  const cel = (k, v, cls = '') => `<td class="c num ${tk[k] ? 'today' : ''} ${cls}">${v}</td>`;
  const linha = (rot, f, tot, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${rot}</th>${dias.map((d, k) => cel(k, f(d))).join('')}<td class="c num tot">${tot}</td></tr>`;
  const sinal = v => (v > 0 ? '+' + v : String(v));
  const pDisp = soma(d => d.disp), pQ = soma(d => d.esc);
  return `<div class="card"><header><h2>Balanço semanal do efetivo</h2><p>${weekLabel(ini)} · pessoas por dia</p></header>
    <div class="tw"><table class="bal"><thead><tr><th></th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(ini, k).slice(8)}</span></th>`).join('')}<th class="c">Semana</th></tr></thead><tbody>
    ${linha('Quadro', d => d.q, '')}
    ${linha('<span class="sub">Folga</span>', d => d.fe || '·', soma(d => d.fe), 'mot')}
    ${soma(d => d.fer) ? linha('<span class="sub">Férias</span>', d => d.fer || '·', soma(d => d.fer), 'mot') : ''}
    ${linha('Escalados', d => d.esc, '')}
    ${motivos.map(m => linha(`<span class="sub">${SIT_NOME[m]}</span>`, d => d.mot[m] || '·', soma(d => d.mot[m] || 0), 'mot')).join('')}
    ${linha('Ausências', d => d.aus, soma(d => d.aus), 'aus')}
    ${soma(d => d.cob) ? linha('<span class="sub">Cobertas por substituto</span>', d => d.cob || '·', soma(d => d.cob), 'mot') : ''}
    ${linha('Disponíveis', d => d.disp, pQ ? `${(Math.floor(pDisp / pQ * 1000) / 10).toLocaleString('pt-BR')}%` : '')}
    ${linha('Necessários', d => d.nec, '')}
    <tr class="saldo"><th scope="row">Saldo</th>${dias.map((d, k) => cel(k, sinal(d.saldo), d.saldo < 0 ? 'neg' : 'pos')).join('')}<td class="c num tot"></td></tr>
    ${soma(d => d.heD + d.heA + d.heN) ? `${linha('Hora extra', d => (d.heD + d.heA + d.heN) || '·', soma(d => d.heD + d.heA + d.heN))}${linha('<span class="sub">a pedido da Dikma</span>', d => d.heD || '·', soma(d => d.heD), 'mot')}${linha('<span class="sub">a pedido da ArcelorMittal</span>', d => d.heA || '·', soma(d => d.heA), 'mot')}${soma(d => d.heN) ? linha('<span class="sub">sem origem informada</span>', d => d.heN || '·', soma(d => d.heN), 'mot') : ''}` : ''}
    <tr><th scope="row">Rotas em déficit</th>${dias.map((d, k) => cel(k, d.def ? `<span class="pill bad">${d.def}</span>` : '0')).join('')}<td class="c num tot">${soma(d => d.def)}</td></tr>
    </tbody></table></div>
    <div class="body pt0"><p class="muted small m0">Escalados = quadro − folga (da escala ou lançada) − férias. Ausências = atestado, afastamento, treinamento, falta, abono e suspensão (folga e férias não contam). Disponíveis = escalados − ausências. Saldo = disponíveis − necessários. Necessário vem do dimensionamento por rota (efetivo padrão × atividades do dia ÷ carga). <button class="btn ghost link" data-goescala="">Abrir Escala e Efetivo</button></p></div></div>`;
}
// Seletor rápido da situação: abre colado no dia tocado, um toque aplica. "Repetir" leva até o fim da semana.
// ---- Substituição (quem cobre uma ausência) e origem da hora extra ----
const HE_ORIG = { DIKMA: 'Dikma', ARCELOR: 'ArcelorMittal' };
const HE_SIG = { DIKMA: 'D', ARCELOR: 'A' };
const AUS_COBRIVEL = new Set(['F', 'FE', 'AT', 'AF', 'TR', 'FT']);
// coberturas de um dia: [{ aus: id de quem faltou, sub: id de quem cobre }]
function cobDoDia(dt) { const x = (DB.sitExtraMes(dt.slice(0, 7)).cob) || {}; const out = []; for (const [k, sid] of Object.entries(x)) { const i = k.lastIndexOf('|'); if (k.slice(i + 1) === dt && sid) out.push({ aus: k.slice(0, i), sub: sid }); } return out; }
const cobertoPor = (id, dt) => DB.sitInfo(id + '|' + dt).cob;
const cobrindo = (id, dt) => { const x = cobDoDia(dt).find(y => y.sub === id); return x ? x.aus : ''; };
const nomeDe = id => { const c = COLABS.find(x => x.id === id); return c ? title(c.nome) : '—'; };
const curto = n => { const p = String(n || '').split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0]; };
// Tira a cobertura e desfaz a hora extra que ela tinha criado (quando o substituto estava de folga pela escala).
function removerCobertura(ausId, dt) {
  const sid = cobertoPor(ausId, dt); if (!sid) return;
  DB.setSitExtra('cob', ausId + '|' + dt, null);
  const s = COLABS.find(x => x.id === sid);
  if (s && DB.sit(sid + '|' + dt) === 'HE' && folgaEscala(s, dt)) { DB.setSit(sid + '|' + dt, null); DB.setSitExtra('he', sid + '|' + dt, null); }
}
function opcoesSubst(c, dt) {
  return () => COLABS.filter(x => x.id !== c.id).map(x => {
    const s = sitDia(x, dt); const cob = cobrindo(x.id, dt);
    if (s.v === 'DS' || (!s.auto && AUSENTE.has(s.v))) return null;
    const tag = cob ? `<span class="pill neu">já cobre ${esc(curto(nomeDe(cob)))}</span>` : s.auto ? '<span class="pill ext">de folga · vira hora extra</span>' : '<span class="pill ok">trabalhando</span>';
    const ord = cob ? 4 : (x.area === c.area && x.rota === c.rota) ? 0 : s.auto ? 1 : x.area === c.area ? 2 : 3;
    return { v: x.id, t: title(x.nome), d: `${x.rota} · ${AREA_S[x.area]}${s.auto ? ' · ' + s.motivo : ''}`, tag, ord, k: x.funcao };
  }).filter(Boolean).sort((a, b) => a.ord - b.ord || a.t.localeCompare(b.t));
}
function fecharSitPop() { const p = document.querySelector('.sitpop'); if (p) p.remove(); document.removeEventListener('keydown', sitPopEsc, true); }
function sitPopEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); fecharSitPop(); } }
function posicionar(pop, btn) {
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  let y = r.bottom + 6; if (y + hgt > innerHeight - 8) y = Math.max(8, r.top - hgt - 6);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
const botoesHE = (atual, extra = '') => `<div class="sp-heo" role="group" aria-label="Hora extra a pedido de">${Object.entries(HE_ORIG).map(([k, n]) => `<button type="button" class="btn ${atual === k ? 'pri' : ''}" data-heo="${k}"${extra}>${n}</button>`).join('')}</div>`;
// Efetivo diário: o mesmo lançamento da Frequência (janela com as situações → até quando),
// e depois, quando é ausência num dia de trabalho, quem cobre; quando é hora extra, a pedido de quem.
const CODS_EF = ['P', 'F', 'FT', 'AT', 'AB', 'HE', 'FE', 'AF', 'TR', 'SP', 'ATR', 'DS'];
function lancarEfetivo(key) {
  fecharSitPop();
  const [id, dt] = key.split('|'); const c = COLABS.find(x => x.id === id); if (!c) return;
  const sx = sitDia(c, dt); const info = DB.sitInfo(key); const cobre = cobrindo(id, dt);
  const prev = escala().previsto(regimeDe(c), turmaDe(c), dt);
  const linha = prev ? (prev.trab ? `Pela escala: trabalha${turmaDe(c) ? ` (turma ${esc(turmaDe(c))})` : ''}` : `Pela escala: folga (${esc(prev.motivo)})`) : 'Sem turma: a escala não marca folga sozinha';
  const extras = [];
  if (!sx.auto && AUS_COBRIVEL.has(sx.v)) {
    if (info.cob) extras.push({ t: 'Trocar substituto', d: `Hoje cobre: ${nomeDe(info.cob)}`, v: 'cob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` }, { t: 'Tirar o substituto', v: 'semcob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
    else extras.push({ t: 'Definir substituto', d: 'Ninguém cobrindo', v: 'cob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
  }
  if (cobre) extras.push({ t: `Deixar de cobrir ${nomeDe(cobre)}`, v: 'sairCob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
  if (sx.v === 'HE') extras.push({ t: 'Hora extra a pedido de…', d: info.he ? `Agora: ${HE_ORIG[info.he]}` : 'Não informado', v: 'heo', extra: true, ic: '<span class="sit HE">HE</span>' });
  const k = (pd(dt).getDay() + 6) % 7; const domingo = add(dt, 6 - k);
  const depois = []; for (let i = 1; i <= 30; i++) depois.push(add(dt, i));
  const fimToque = () => { render(); const nb = document.querySelector(`[data-sit="${CSS.escape(key)}"]`); if (nb) { nb.focus({ preventScroll: true }); M.pulsar(nb); } };
  abrirLancamento({
    sheet, nome: title(c.nome), dt, atual: sx.auto ? { v: sx.v, auto: true, motivo: 'pela escala' } : sx.ferias ? { v: 'FE', auto: true, motivo: 'férias' } : DB.sit(key) ? { v: sx.v } : { v: sx.v, auto: true, motivo: '' },
    codigos: CODS_EF, linhaInfo: linha, extras, depois, ok: I.ok,
    fim: k < 6 ? { t: 'Até domingo', v: domingo } : null,
    aoExtra: v => {
      if (v === 'cob') return passoCobertura(c, dt, [dt], null, fimToque);
      if (v === 'semcob') { removerCobertura(id, dt); DB.log(`${title(c.nome)} · ${ddmm(dt)} sem substituto`); fimToque(); toast('Substituto removido'); return; }
      if (v === 'sairCob') { removerCobertura(cobre, dt); fimToque(); toast('Cobertura removida'); return; }
      if (v === 'heo') return passoHE(c, [dt], null, fimToque);
    },
    aoEscolher: (v, dias) => {
      const antes = dias.map(d => [d, DB.sit(id + '|' + d) || null, DB.sitInfo(id + '|' + d)]);
      // grava só o que difere da escala: presente num dia de folga fica gravado; folga num dia de folga, não
      const gravar = d => { if (!v) return null; const fe = folgaEscala(c, d); if (v === 'P') return fe ? 'P' : null; if (v === 'F' && fe) return null; return v; };
      dias.forEach(d => { DB.setSit(id + '|' + d, gravar(d)); if (!AUS_COBRIVEL.has(v)) removerCobertura(id, d); if (v !== 'HE') DB.setSitExtra('he', id + '|' + d, null); });
      const nome = !v ? 'automático' : SIT_NOME[v];
      DB.log(`${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''} → ${nome}`);
      const desfazer = () => { antes.forEach(([d, x, inf]) => { DB.setSit(id + '|' + d, x); DB.setSitExtra('he', id + '|' + d, inf.he || null); }); DB.log(`${title(c.nome)} · desfez a mudança de ${ddmm(dt)}`); render(); };
      fimToque();
      if (AUS_COBRIVEL.has(v) && gravar(dt)) return passoCobertura(c, dt, dias, desfazer, fimToque);
      if (v === 'HE') return passoHE(c, dias, desfazer, fimToque);
      toast(dias.length > 1 ? `${curto(title(c.nome))}: ${nome.toLowerCase()} em ${dias.length} dias` : `${curto(title(c.nome))}: ${nome.toLowerCase()}`, { desfazer });
    }
  });
}
// Depois de uma ausência: quem cobre (opcional). Se quem cobre está de folga pela escala, vira hora extra.
function passoCobertura(c, dt, dias, desfazerBase, fimToque) {
  const id = c.id;
  formSheet('Quem vai cobrir?', `${esc(title(c.nome))} · ${SIT_NOME[DB.sit(id + '|' + dt)] || 'ausência'} ${dias.length > 1 ? `de ${ddmm(dt)} a ${ddmm(dias[dias.length - 1])}` : `em ${ddmm(dt)}`} · opcional`,
    `<div class="sel"><span>Substituto</span>${campoBusca('spSub', cobertoPor(id, dt), opcoesSubst(c, dt), { placeholder: 'Digite o nome de quem substitui', vazio: '—' })}</div>
     <div id="spSubHe" hidden><p class="small m0">Está de folga pela escala: vira <b>hora extra</b>. A pedido de:</p><div class="mchips">${Object.entries(HE_ORIG).map(([k, n], i) => `<label class="mchip"><input type="radio" name="spHeo" value="${k}" ${i === 0 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>`,
    'Confirmar substituto', async () => {
      const sid = $('spSub').value; if (!sid) { if (desfazerBase) toast('Lançado sem substituto', { desfazer: desfazerBase }); return; }
      const s = COLABS.find(x => x.id === sid); const heOrig = (document.querySelector('input[name="spHeo"]:checked') || {}).value || 'DIKMA'; const feitos = [];
      for (const d of dias) { removerCobertura(id, d); DB.setSitExtra('cob', id + '|' + d, sid); if (sitDia(s, d).auto) { DB.setSit(sid + '|' + d, 'HE'); DB.setSitExtra('he', sid + '|' + d, heOrig); feitos.push(d); } }
      DB.log(`${title(s.nome)} cobre ${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''}${feitos.length ? ` (hora extra a pedido da ${HE_ORIG[heOrig]})` : ''}`);
      fimToque();
      toast(`${curto(title(s.nome))} cobre ${curto(title(c.nome))}${feitos.length ? ' · hora extra ' + HE_ORIG[heOrig] : ''}`, { desfazer: () => { dias.forEach(d => removerCobertura(id, d)); if (desfazerBase) desfazerBase(); render(); } });
    });
  const cancelar = document.querySelector('#fSheet [data-close]'); if (cancelar) cancelar.textContent = 'Sem substituto';
  const mostrarHe = () => { const s = COLABS.find(x => x.id === $('spSub').value); $('spSubHe').hidden = !(s && dias.some(d => sitDia(s, d).auto)); };
  $('spSub').addEventListener('change', mostrarHe);
  setTimeout(() => { const q = $('spSub_q'); if (q) q.focus(); }, 60);
}
// Depois de uma hora extra: a pedido de quem
function passoHE(c, dias, desfazer, fimToque) {
  sheet('Hora extra a pedido de quem?', `${esc(title(c.nome))} · ${dias.length > 1 ? `${dias.length} dias` : ddmm(dias[0])}`, [...Object.entries(HE_ORIG).map(([k, n]) => ({ t: n, v: k })), { t: 'Não informar agora', v: '' }], o => {
    if (!o.v) { if (desfazer) toast('Hora extra lançada', { desfazer }); return; }
    dias.forEach(d => DB.setSitExtra('he', c.id + '|' + d, o.v)); DB.log(`${title(c.nome)} · hora extra ${ddmm(dias[0])} a pedido da ${HE_ORIG[o.v]}`); fimToque(); toast(`Hora extra · ${HE_ORIG[o.v]}`, desfazer ? { desfazer } : undefined);
  });
}
function sitPop(btn) {
  fecharSitPop();
  const key = btn.dataset.sit; const [id, dt] = key.split('|'); const c = COLABS.find(x => x.id === id); if (!c) return;
  const sx = sitDia(c, dt); const cur = sx.v; const k = (pd(dt).getDay() + 6) % 7; const fim = add(dt, 6 - k);
  const prev = escala().previsto(regimeDe(c), turmaDe(c), dt); const manual = !!DB.sit(key); const info = DB.sitInfo(key); const cobre = cobrindo(id, dt);
  const pop = document.createElement('div'); pop.className = 'sitpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Situação de ' + title(c.nome));
  const cab = `<div class="sp-h"><b>${esc(title(c.nome))}</b><small>${DAYS[k]} ${ddmm(dt)}</small></div>`;
  const extras = [
    !sx.auto && AUS_COBRIVEL.has(cur) ? (info.cob ? `<div class="sp-cob">${I.swap} Coberto por <b>${esc(nomeDe(info.cob))}</b> <button type="button" class="btn ghost link" data-spx="cob">trocar</button> · <button type="button" class="btn ghost link" data-spx="semcob">remover</button></div>` : `<div class="sp-cob none">Ninguém cobrindo · <button type="button" class="btn ghost link" data-spx="cob">definir substituto</button></div>`) : '',
    cobre ? `<div class="sp-cob">${I.swap} Cobrindo <b>${esc(nomeDe(cobre))}</b> <button type="button" class="btn ghost link" data-spx="sairCob">remover</button></div>` : '',
    cur === 'HE' ? `<div class="sp-cob"><span>Hora extra a pedido de:</span>${botoesHE(info.he)}</div>` : ''
  ].join('');
  pop.innerHTML = `${cab}
    <div class="sp-esc">${prev ? (prev.trab ? `Pela escala: <b>trabalha</b>${turmaDe(c) ? ` (turma ${esc(turmaDe(c))})` : ''}` : `Pela escala: <b>folga</b> · ${esc(prev.motivo)}`) : `Sem turma definida: a escala não marca folga sozinha`}${manual ? ' · <button type="button" class="btn ghost link" data-sp="__esc">voltar ao da escala</button>' : ''}</div>
    ${extras}
    <div class="sp-g">${SITS.map(([v, n]) => `<button type="button" class="sp-o" data-sp="${v}" ${v === cur ? 'aria-current="true"' : ''}><span class="sit ${v}">${v === 'P' ? I.ok : v}</span><span>${n}</span></button>`).join('')}</div>
    ${k < 6 ? `<label class="sp-rep"><input type="checkbox" id="spRep"> Repetir até ${DAYS[6].toLowerCase()} ${ddmm(fim)}</label>` : ''}`;
  document.body.appendChild(pop); posicionar(pop, btn);
  const at = pop.querySelector('[aria-current="true"]') || pop.querySelector('.sp-o'); at.focus();
  const fimToque = () => { render(); const nb = document.querySelector(`[data-sit="${CSS.escape(key)}"]`); if (nb) { nb.focus({ preventScroll: true }); M.pulsar(nb); } };

  // Passo 2a: quem cobre a ausência (opcional)
  const passoCobertura = (dias, desfazerBase) => {
    btn = document.querySelector(`[data-sit="${CSS.escape(key)}"]`) || btn;
    pop.innerHTML = `${cab}<div class="sp-ok">${I.ok} Lançado: ${esc(SIT_NOME[DB.sit(key)] || 'ausência')}${dias.length > 1 ? ` em ${dias.length} dias` : ''}</div>
      <div class="sel"><span>Quem vai cobrir? (opcional)</span>${campoBusca('spSub', cobertoPor(id, dt), opcoesSubst(c, dt), { placeholder: 'Digite o nome de quem substitui', vazio: '—' })}</div>
      <div id="spSubHe" hidden><p class="small m0">Está de folga: vira <b>hora extra</b>. A pedido de:</p>${botoesHE('DIKMA', ' data-sel="1"')}</div>
      <div class="row-gap"><button type="button" class="btn pri" data-spx="okCob">Confirmar substituto</button><button type="button" class="btn" data-spx="fechar">Sem substituto</button></div>`;
    posicionar(pop, btn);
    let heOrig = 'DIKMA';
    const mostrarHe = () => { const sid = $('spSub').value; const s = COLABS.find(x => x.id === sid); $('spSubHe').hidden = !(s && dias.some(d => sitDia(s, d).auto)); posicionar(pop, btn); };
    $('spSub').addEventListener('change', mostrarHe);
    pop.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); heOrig = b.dataset.heo; pop.querySelectorAll('[data-sel]').forEach(x => x.classList.toggle('pri', x === b)); }));
    setTimeout(() => { const q = $('spSub_q'); if (q) q.focus(); }, 30);
    pop._cob = () => {
      const sid = $('spSub').value; if (!sid) { fecharSitPop(); fimToque(); return; }
      const s = COLABS.find(x => x.id === sid); const feitos = [];
      for (const d of dias) {
        removerCobertura(id, d);
        DB.setSitExtra('cob', id + '|' + d, sid);
        if (sitDia(s, d).auto) { DB.setSit(sid + '|' + d, 'HE'); DB.setSitExtra('he', sid + '|' + d, heOrig); feitos.push(d); }
      }
      DB.log(`${title(s.nome)} cobre ${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''}${feitos.length ? ` (hora extra a pedido da ${HE_ORIG[heOrig]})` : ''}`);
      fecharSitPop(); fimToque();
      toast(`${curto(title(s.nome))} cobre ${curto(title(c.nome))}${feitos.length ? ' · hora extra ' + HE_ORIG[heOrig] : ''}`, { desfazer: () => { dias.forEach(d => removerCobertura(id, d)); if (desfazerBase) desfazerBase(); render(); } });
    };
  };
  // Passo 2b: hora extra a pedido de quem
  const passoHE = (dias, desfazer) => {
    btn = document.querySelector(`[data-sit="${CSS.escape(key)}"]`) || btn;
    pop.innerHTML = `${cab}<div class="sp-ok">${I.ok} Lançado: hora extra${dias.length > 1 ? ` em ${dias.length} dias` : ''}</div><p class="small m0">A pedido de:</p>${botoesHE(DB.sitInfo(key).he)}<button type="button" class="btn ghost" data-spx="fechar">Não informar agora</button>`;
    posicionar(pop, btn);
    pop._he = o => { dias.forEach(d => DB.setSitExtra('he', id + '|' + d, o)); DB.log(`${title(c.nome)} · hora extra ${ddmm(dt)} a pedido da ${HE_ORIG[o]}`); fecharSitPop(); fimToque(); toast(`Hora extra · ${HE_ORIG[o]}`, { desfazer }); };
    const b = pop.querySelector('[data-heo]'); if (b) b.focus();
  };

  pop.addEventListener('click', e => {
    const heo = e.target.closest('[data-heo]');
    if (heo && !heo.dataset.sel) { if (pop._he) return pop._he(heo.dataset.heo); DB.setSitExtra('he', key, heo.dataset.heo); fecharSitPop(); fimToque(); toast(`Hora extra · ${HE_ORIG[heo.dataset.heo]}`); return; }
    const x = e.target.closest('[data-spx]');
    if (x) {
      const a = x.dataset.spx;
      if (a === 'fechar') { fecharSitPop(); fimToque(); return; }
      if (a === 'okCob') { pop._cob(); return; }
      if (a === 'cob') { passoCobertura([dt]); return; }
      if (a === 'semcob') { removerCobertura(id, dt); DB.log(`${title(c.nome)} · ${ddmm(dt)} sem substituto`); fecharSitPop(); fimToque(); toast('Substituto removido'); return; }
      if (a === 'sairCob') { removerCobertura(cobre, dt); fecharSitPop(); fimToque(); toast('Cobertura removida'); return; }
      return;
    }
    const o = e.target.closest('[data-sp]'); if (!o) return;
    const v = o.dataset.sp; const rep = pop.querySelector('#spRep'); const dias = [dt]; if (rep && rep.checked) for (let d = add(dt, 1); d <= fim; d = add(d, 1)) dias.push(d);
    const antes = dias.map(d => [d, DB.sit(id + '|' + d) || null, DB.sitInfo(id + '|' + d)]);
    // Grava só o que difere da escala: presente num dia de folga fica gravado; folga num dia de folga, não.
    const gravar = d => { if (v === '__esc') return null; const fe = folgaEscala(c, d); if (v === 'P') return fe ? 'P' : null; if (v === 'F' && fe) return null; return v; };
    dias.forEach(d => { DB.setSit(id + '|' + d, gravar(d)); if (!AUS_COBRIVEL.has(v)) removerCobertura(id, d); if (v !== 'HE') DB.setSitExtra('he', id + '|' + d, null); });
    const nome = v === '__esc' ? 'como na escala' : SIT_NOME[v];
    DB.log(`${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''} → ${nome}`);
    const desfazer = () => { antes.forEach(([d, x, inf]) => { DB.setSit(id + '|' + d, x); DB.setSitExtra('he', id + '|' + d, inf.he || null); }); DB.log(`${title(c.nome)} · desfez a mudança de ${ddmm(dt)}`); render(); };
    // ausência num dia de trabalho: pergunta quem cobre · hora extra: pergunta a pedido de quem
    if (AUS_COBRIVEL.has(v) && gravar(dt)) { render(); passoCobertura(dias, desfazer); return; }
    if (v === 'HE') { render(); passoHE(dias, desfazer); return; }
    fecharSitPop(); fimToque();
    toast(dias.length > 1 ? `${curto(title(c.nome))}: ${nome.toLowerCase()} em ${dias.length} dias` : `${curto(title(c.nome))}: ${nome.toLowerCase()}`, { desfazer });
  });
  // setas movem entre as opções
  pop.addEventListener('keydown', e => { const os = [...pop.querySelectorAll('.sp-o')]; const i = os.indexOf(document.activeElement); if (i < 0) return; const col = 2; const m = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: col, ArrowUp: -col }[e.key]; if (m) { e.preventDefault(); const n = os[Math.min(os.length - 1, Math.max(0, i + m))]; n.focus(); } });
  document.addEventListener('keydown', sitPopEsc, true);
  setTimeout(() => { const fora = e => { if (!pop.isConnected) { document.removeEventListener('pointerdown', fora, true); return; } if (!pop.contains(e.target)) { fecharSitPop(); document.removeEventListener('pointerdown', fora, true); } }; document.addEventListener('pointerdown', fora, true); const rol = () => { if (!pop.isConnected) { removeEventListener('scroll', rol); return; } if (!pop.contains(document.activeElement)) { fecharSitPop(); removeEventListener('scroll', rol); } }; addEventListener('scroll', rol, { passive: true }); }, 0);
}
/* ---------------- MÓDULO CONFIGURAÇÕES ---------------- */
// Um lugar só para os ajustes de todos os módulos. Cada tela grava no mesmo lugar de sempre, então o que muda aqui
// vale na hora para Atividades Pátio e Bateria, Escala e Efetivo, Operação, Efetivo e Meu dia.
const ehGestor = () => !!ME && ME.papel === 'gestor';
const temMod = m => modsDe(ME).includes(m);
function vCfGeral() {
  const E = escala(); const card = (ic, t, sub, corpo, botoes) => `<div class="card cfc"><header><span class="cfi">${ic}</span><div class="minw"><h2>${t}</h2><p>${sub}</p></div></header><div class="body">${corpo}<div class="row-gap cfb">${botoes}</div></div></div>`;
  const ir = (view, txt, set) => `<button class="btn sm" data-cfgo="${view}${set ? '|' + set : ''}">${txt}</button>`;
  const kv = l => `<dl class="cfkv">${l.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  let h = '<div class="cfgrid">';
  // Escalas
  const semT = setsDe(ME).reduce((n, k) => n + SETS[k].areas.flatMap(a => (DB.dados(k).colabs || {})[a] || []).filter(c => { const r = E.regimes[normRegime(c.regime, E.regimes)]; return r && r.tipo === 'ciclo' && !turmaDe(c); }).length, 0);
  const hoje = Object.entries(E.regimes).filter(([, r]) => r.tipo === 'ciclo').map(([k]) => { const l = E.turmasDoDia(k, TODAY); return `<span class="tchip">${esc(k)} · ${l.length ? l.join(' ') : '—'}</span>`; }).join('');
  h += card(I.escala, 'Escalas e turnos', 'Regimes, turmas e feriados de todos os módulos', `<div class="hojeturma"><span class="muted small">Trabalham hoje:</span>${hoje}</div>${kv([['Regimes', Object.values(E.regimes).map(r => esc(r.nome)).join(', ')], ['Feriados cadastrados', E.feriados.size], ['Turno sem turma', semT ? `<span class="semt">${semT} pessoa${semT > 1 ? 's' : ''}</span>` : 'nenhum']])}`, ir('cfescala', 'Abrir escalas'));
  // Atividades
  for (const k of setsDe(ME)) {
    const st = DB.dados(k); const c = st.config;
    const nPlano = SETS[k].areas.reduce((n, a) => n + ((st.plano || {})[a] || []).length, 0);
    const ms = ((c && c.meses) || []).slice().sort();
    h += card(MOD_IC[SETS[k].mod], SETS[k].nome, SETS[k].areas.map(a => AREA_S[a]).join(' · '), c ? kv([['Rotas', (c.rotas || []).length], ['Atividades no plano', nPlano], ['Meses gerados', ms.length ? ms.slice(-3).map(monthLabel).join(', ') : '—']]) : '<p class="muted m0">Planilha ainda não importada.</p>', `${ir('config', 'Rotas e configurações', k)}${ir('plano', 'Plano padrão', k)}${ir('gerador', 'Gerador de meses', k)}`);
  }
  // Operação
  if (VIEWS.find(v => v.id === 'econfig').req()) { const e = DB.cache.e; const c = e && e.config; h += card(MOD_IC.equipamentos, 'Operação', 'Equipamentos e operadores', c ? kv([['Operadores', (e.cad.operadores || []).length], ['Frota', (e.cad.frota || []).length], ['Causas de parada', (c.causas || []).length], ['Turno ADM · 4x4', `${c.turno.admIni}–${c.turno.admFim} · ${c.turno.x4Ini}–${c.turno.x4Fim}`]]) : '<p class="muted m0">Planilha ainda não importada.</p>', ir('econfig', 'Configurações da Operação')); }
  // Efetivo
  if (VIEWS.find(v => v.id === 'gtipos').req()) { const g = DB.cache.g; h += card(MOD_IC.gestao, 'Efetivo', 'Fichas de acompanhamento', kv([['Fichas', (g.colabs || []).length], ['Tipos de ocorrência', ((g.config && g.config.tipos) || []).length], ['Na Folha 1', ((g.config && g.config.tipos) || []).filter(t => t.f1).length]]), `${ir('gtipos', 'Tipos de ocorrência')}${isAdmin() ? ir('gimport', 'Importar dados') : ''}`); }
  // Acesso
  if (isAdmin()) { const us = DB.cache.usuarios; const exc = us.filter(u => u.abas && Object.keys(u.abas).length).length; const av = DB.cache.avisosCfg && DB.cache.avisosCfg.vapid; h += card(I.users, 'Acesso', 'Usuários, perfis e avisos', kv([['Usuários ativos', us.filter(u => u.papel !== 'bloqueado').length], ['Bloqueados', us.filter(u => u.papel === 'bloqueado').length], ['Com abas personalizadas', exc], ['Avisos no celular', av ? 'chave configurada' : '<span class="semt">sem chave</span>']]), `${ir('usuarios', 'Usuários e acessos')}${ir('perfis', 'Perfis e permissões')}`); }
  return h + '</div>';
}

// Rascunho da escala até salvar (para mexer em várias coisas e gravar de uma vez).
function rascEsc() {
  if (!UI.escR) { const E = escala(); UI.escR = { regimes: JSON.parse(JSON.stringify(E.regimes)), feriados: JSON.parse(JSON.stringify((DB.cache.escalas && DB.cache.escalas.feriados) || [])) }; }
  return UI.escR;
}
function vCfEscala() {
  const R = rascEsc(); const E = criarEscala(R, {}, []); const ed = isAdmin() || ehGestor();
  const salvo = JSON.stringify({ r: escala().regimes, f: (DB.cache.escalas && DB.cache.escalas.feriados) || [] }) === JSON.stringify({ r: R.regimes, f: R.feriados });
  // calendário dos próximos 14 dias
  const dias = []; for (let i = 0; i < 14; i++) dias.push(add(TODAY, i));
  const linhasCal = [];
  for (const [k, r] of Object.entries(R.regimes)) {
    if (r.tipo === 'semana') linhasCal.push({ rot: esc(r.nome), cel: dias.map(d => E.previsto(k, '', d)) });
    else for (const l of Object.keys(r.turmas || {})) linhasCal.push({ rot: `${esc(r.nome)} · <b>${esc(l)}</b>`, cel: dias.map(d => E.previsto(k, l, d)) });
  }
  const cal = `<div class="card"><header><h2>Próximos 14 dias</h2><p>D turno diurno · N turno noturno (a noite conta no dia em que começa) · ● trabalha (administrativo) · ○ folga · ? turma sem data · é assim que o sistema marca a folga e o turno sozinho no Efetivo diário e na Frequência</p></header><div class="tw"><table class="calesc"><thead><tr><th></th>${dias.map(d => { const w = pd(d).getDay(); return `<th class="c ${d === TODAY ? 'today' : ''} ${w === 0 || w === 6 ? 'fds' : ''}">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][w]}<br><span class="thd">${d.slice(8)}</span></th>`; }).join('')}</tr></thead><tbody>
    ${linhasCal.map(x => `<tr><th scope="row">${x.rot}</th>${x.cel.map((p, i) => `<td class="c ${dias[i] === TODAY ? 'today' : ''}">${p && p.trab && p.periodo ? `<i class="peri ${p.periodo}" title="${PERIODO[p.periodo]}">${p.periodo}</i>` : `<span class="cdot ${p ? (p.trab ? 'on' : 'off') : 'nd'}" title="${p ? (p.trab ? 'trabalha' : esc(p.motivo)) : 'sem data da turma'}">${p ? (p.trab ? '●' : '○') : '?'}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  // regimes
  const dis = ed ? '' : 'disabled';
  const reg = Object.entries(R.regimes).map(([k, r]) => r.tipo === 'semana'
    ? `<div class="regc"><div class="regh"><b>${esc(r.nome)}</b><span class="muted small">trabalha nos dias marcados</span></div><div class="mchips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="mchip"><input type="checkbox" data-escdia="${k}|${d}" ${(r.dias || []).includes(d) ? 'checked' : ''} ${dis}><span>${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]}</span></label>`).join('')}</div><p class="muted small m0">Feriados da lista abaixo também são folga.</p></div>`
    : `<div class="regc"><div class="regh"><b>${esc(r.nome)}</b><span class="row-gap nowrap small"><label class="mini-in">trabalha <input class="in numin" type="number" min="1" max="15" data-escn="${k}|trab" value="${r.trab}" ${dis}></label><label class="mini-in">folga <input class="in numin" type="number" min="1" max="15" data-escn="${k}|folga" value="${r.folga}" ${dis}></label></span></div>
      <div class="perseq"><span class="muted small">Dia e noite nos ${r.trab} dias de trabalho (toque para trocar):</span><div class="row-gap tight">${[...periodosDe(r)].map((pp, i) => `<button type="button" class="btn sm perb ${pp}" data-escper="${k}|${i}" ${dis} aria-label="${i + 1}º dia: ${PERIODO[pp]}">${i + 1}º <i class="peri ${pp}">${pp}</i> ${pp === 'N' ? 'noite' : 'dia'}</button>`).join('')}</div></div>
      <p class="muted small m0">Para cada turma, informe qualquer dia em que ela <b>começou</b> um bloco de ${r.trab} dias de trabalho.</p>${(() => { // turmas no mesmo ponto do ciclo trabalham juntas no mesmo período: quase sempre é data errada
        const n = (+r.trab || 0) + (+r.folga || 0); if (!n) return ''; const fase = {}; for (const [l, d] of Object.entries(r.turmas || {})) if (d) { const f = ((Math.round((pd(d) - pd('2000-01-01')) / 864e5) % n) + n) % n; (fase[f] = fase[f] || []).push(l); }
        const rep = Object.values(fase).filter(x => x.length > 1); return rep.length ? `<p class="aviso">${rep.map(x => `As turmas <b>${x.join(' e ')}</b> estão no mesmo dia do ciclo: trabalham juntas, no mesmo período. Confira as datas.`).join('<br>')}</p>` : ''; })()}
      <div class="turl">${Object.entries(r.turmas || {}).map(([l, d]) => `<label class="turi"><span class="tl">${esc(l)}</span><input class="in" type="date" data-esct="${k}|${l}" value="${d || ''}" ${dis}>${ed ? `<button type="button" class="btn ghost sm" data-escdel="${k}|${l}" aria-label="Remover turma ${esc(l)}">✕</button>` : ''}</label>`).join('')}
      ${ed ? `<span class="turi add"><input class="in" maxlength="2" placeholder="Letra" data-escnova="${k}" aria-label="Nova turma"><button type="button" class="btn sm" data-escadd="${k}">${I.plus} Turma</button></span>` : ''}</div></div>`).join('');
  const fer = R.feriados.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  const eqF = ((DB.cache.e && DB.cache.e.config && DB.cache.e.config.feriados) || []).filter(f => f.semOp && !R.feriados.some(x => x.data === f.data));
  const ferH = `<div class="regc"><div class="regh"><b>Feriados</b><span class="muted small">folga do administrativo (turno segue a escala)</span></div>
    ${fer.length ? `<div class="rchips">${fer.map(f => `<span class="rchip">${dBRs(f.data)} · ${esc(f.desc || 'feriado')}${ed ? `<button type="button" class="btn ghost mini-x" data-escferdel="${f.data}" aria-label="Remover">✕</button>` : ''}</span>`).join('')}</div>` : '<p class="muted small m0">Nenhum feriado cadastrado.</p>'}
    ${ed ? `<div class="row-gap"><input class="in" type="date" id="escFerD"><input class="in grow" id="escFerT" placeholder="Descrição"><button type="button" class="btn" data-escfer="1">${I.plus} Feriado</button>${eqF.length ? `<button type="button" class="btn ghost" data-escfereq="1">Copiar ${eqF.length} da Operação</button>` : ''}</div>` : ''}</div>`;
  const barra = ed ? `<div class="body row-gap savebar"><button class="btn pri" data-act="escSalvar" ${salvo ? 'disabled' : ''}>${salvo ? 'Tudo salvo' : 'Salvar escalas'}</button>${salvo ? '' : '<button class="btn ghost" data-act="escDescartar">Descartar mudanças</button><span class="muted small">As mudanças só valem depois de salvar.</span>'}</div>` : '';
  // pessoas de turno e suas turmas
  const q = UI.escQ || '';
  const pessoas = []; for (const k of setsDe(ME)) for (const a of SETS[k].areas) for (const c of ((DB.dados(k).colabs || {})[a] || [])) { const rg = normRegime(c.regime, escala().regimes); const r = escala().regimes[rg]; if (r && r.tipo === 'ciclo') pessoas.push({ k, c, rg, r, t: letra(c.turma), tf: turmaFicha(c.nome) }); }
  pessoas.sort((x, y) => x.c.nome.localeCompare(y.c.nome));
  const kP = x => semAcento([x.c.nome, x.c.rota, AREA_S[x.c.area], SETS[x.k].curto, x.rg, x.t || x.tf || 'sem turma'].join(' '));
  const sem = pessoas.filter(x => !x.t && !x.tf).length; const daFicha = pessoas.filter(x => !x.t && x.tf).length;
  const tab = `<div class="card"><header><h2>Turma de cada pessoa de turno</h2><p>${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'} em regime de turno · ${sem ? `<span class="semt">${sem} sem turma</span>` : 'todas com turma'}${daFicha ? ` · ${daFicha} usando a turma da ficha do Efetivo` : ''}</p></header>
    <div class="body lbar">${caixaBusca('escQ', q, 'Buscar pessoa, rota ou turma')}${ed && daFicha ? `<button class="btn" data-act="escFicha">Gravar as ${daFicha} turmas das fichas</button>` : ''}</div>
    <div class="tw" id="escLista"><table><thead><tr><th>Colaborador</th><th>Onde</th><th>Regime</th><th>Turma</th><th>Hoje</th></tr></thead><tbody>
    ${pessoas.map(x => { const t = x.t || x.tf; const p = t ? escala().previsto(x.rg, t, TODAY) : null; return `<tr data-k="${esc(kP(x))}" ${casa(kP(x), q) ? '' : 'hidden'}><td><b>${esc(title(x.c.nome))}</b></td><td class="small">${esc(SETS[x.k].curto)} · ${esc(AREA_S[x.c.area])}<div class="muted">${esc(x.c.rota)}</div></td><td class="small">${esc(x.r.nome)}</td>
      <td>${ed ? `<select class="in" data-escpes="${x.k}|${esc(x.c.area)}|${esc(x.c.id)}" aria-label="Turma de ${esc(title(x.c.nome))}"><option value="">${x.tf && !x.t ? `Da ficha (${esc(x.tf)})` : 'Sem turma'}</option>${Object.keys(x.r.turmas || {}).map(l => `<option ${l === x.t ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : esc(t || '—')}</td>
      <td>${p ? (p.trab ? `<span class="pill ok">${p.periodo === 'N' ? 'noite' : 'dia'}</span>` : '<span class="pill neu">folga</span>') : '<span class="pill warn">sem turma</span>'}</td></tr>`; }).join('')}
    </tbody></table><p class="empty" data-vazio ${pessoas.some(x => casa(kP(x), q)) ? 'hidden' : ''}>${pessoas.length ? 'Ninguém encontrado.' : 'Nenhuma pessoa em regime de turno nas Atividades.'}</p></div></div>`;
  return `${cal}<div class="card"><header><h2>Regimes e turmas</h2><p>Vale para Escala e Efetivo, Atividades, Operação, Meu dia e avisos no celular</p></header><div class="body cfreg">${reg}${ferH}</div>${barra}</div>${tab}`;
}
const dBRs = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
// Conferência do cadastro: o que falta ou não bate entre os módulos, com o atalho para corrigir.
function vCfConf() {
  const E = escala(); const nk = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const itens = [];
  const item = (grav, t, d, nomes, ir, irTxt) => itens.push({ grav, t, d, nomes, ir, irTxt });
  // 1) turmas sem data de início (a folga automática não funciona para elas)
  const semData = Object.entries(E.regimes).filter(([, r]) => r.tipo === 'ciclo').flatMap(([k, r]) => Object.entries(r.turmas || {}).filter(([, d]) => !d).map(([l]) => `${r.nome || k} · turma ${l}`));
  if (semData.length) item('bad', 'Turmas sem data de início', 'Sem a data, a folga pela escala não é marcada sozinha para quem é dessas turmas.', semData, 'cfescala', 'Escalas e turnos');
  // 2) pessoas de turno sem turma
  const todos = setsDe(ME).flatMap(k => SETS[k].areas.flatMap(a => ((DB.dados(k).colabs || {})[a] || []).map(c => ({ ...c, set: k }))));
  const semTurma = todos.filter(c => { const r = E.regimes[normRegime(c.regime, E.regimes)]; return r && r.tipo === 'ciclo' && !turmaDe(c); });
  if (semTurma.length) item('bad', 'Pessoas de turno sem turma', 'Sem a letra da turma, o sistema não sabe as folgas delas.', semTurma.map(c => `${title(c.nome)} (${SETS[c.set].curto})`), 'cfescala', 'Escalas e turnos');
  // 3) Atividades × fichas do Efetivo (pelo nome)
  const fichas = (DB.cache.g && DB.cache.g.colabs) || [];
  if (fichas.length) {
    const fn = new Set(fichas.map(f => nk(f.nome)));
    const semFicha = todos.filter(c => !fn.has(nk(c.nome)));
    if (semFicha.length) item('warn', 'Nas Atividades sem ficha no Efetivo', 'O nome não bate com nenhuma ficha (apelido, abreviação ou ainda não cadastrado). Corrija no acesso Operação › Efetivo › Pessoas.', semFicha.map(c => title(c.nome)), null);
    if (DB.areaDaFicha) { const ger = fichas.filter(f => DB.areaDaFicha(f.mat) === 'GERAL'); if (ger.length) item('warn', 'Fichas na área GERAL', 'Não foi possível saber a área de atuação. Só quem vê todas as áreas enxerga essas fichas. Corrija no acesso Operação › Efetivo › Pessoas.', ger.map(f => title(f.nome)), null); }
  }
  // 4) usuários
  const us = DB.cache.usuarios || [];
  const semArea = us.filter(u => ['lider', 'supervisor'].includes(u.papel) && !u.area && (u.modulos || ['operacao']).some(m => m === 'operacao' || m === 'bateria'));
  if (semArea.length) item('bad', 'Líderes e supervisores sem área', 'Eles não veem nenhuma rota até a área ser escolhida.', semArea.map(u => title(u.nome)), 'usuarios', 'Usuários e acessos');
  const nunca = us.filter(u => u.trocarSenha && u.papel !== 'bloqueado');
  if (nunca.length) item('neu', 'Ainda não criaram a própria senha', 'Receberam a senha provisória e não entraram.', nunca.map(u => `${title(u.nome)} (${u.login || ''})`), 'usuarios', 'Usuários e acessos');
  // 5) Frequência e férias: folha atual e férias
  const A = DB.cache.adm || {}; const comp = competenciaDe(TODAY);
  for (const k of SET_KEYS) { const c = (A.comps || {})[k + '|' + comp]; if (c === null) item('warn', `Folha de ${(d => `${d[0].slice(8)}/${d[0].slice(5, 7)} a ${d.at(-1).slice(8)}/${d.at(-1).slice(5, 7)}`)(diasDaCompetencia(comp))} não aberta · ${SETS[k].curto}`, 'A frequência da competência atual ainda não foi aberta em Frequência e férias.', [], null); else if (c) { const sem = c.grupos.flatMap(g => g.pessoas.filter(p => !p.mat).map(p => title(p.nome))); if (sem.length) item('neu', `Na folha sem ficha no RH · ${SETS[k].curto}`, 'Entram na folha, mas sem matrícula as férias e o Efetivo não se ligam a elas.', sem, null); const sAt = c.grupos.flatMap(g => g.pessoas.filter(p => !p.ativ && !p.desligado && g.turno).map(p => title(p.nome))); if (sAt.length) item('neu', `Turno na folha, fora das Atividades · ${SETS[k].curto}`, 'A presença delas fica só na folha (não aparece no Efetivo diário).', sAt, null); } }
  if (A.fLoaded) {
    const marcadas = new Set((A.ferias || []).filter(f => f.inicio && f.inicio >= TODAY.slice(0, 7) + '-01').map(f => f.mat || nk(f.nome)));
    const venc = (A.ferias || []).filter(f => f.limite && f.limite < TODAY && !marcadas.has(f.mat || nk(f.nome)));
    if (venc.length) item('bad', 'Férias com data limite vencida', 'Data limite passou e não há férias marcadas daqui para frente.', venc.map(f => `${title(f.nome)} (limite ${dBRs(f.limite)})`), null);
  }
  const ord = { bad: 0, warn: 1, neu: 2 };
  itens.sort((a, b) => ord[a.grav] - ord[b.grav]);
  const ic = { bad: 'Corrigir', warn: 'Conferir', neu: 'Para saber' };
  return `<div class="mini"><div><b class="num" style="color:var(--st-nreal)">${itens.filter(i => i.grav === 'bad').length}</b><span>Corrigir</span></div><div><b class="num" style="color:var(--st-atr)">${itens.filter(i => i.grav === 'warn').length}</b><span>Conferir</span></div><div><b class="num">${itens.filter(i => i.grav === 'neu').length}</b><span>Para saber</span></div></div>
  ${itens.length ? itens.map(i => `<div class="card"><header><h2>${esc(i.t)}${i.nomes.length ? ` <span class="muted">(${i.nomes.length})</span>` : ''}</h2><p>${esc(i.d)}</p><span class="r"><span class="pill ${i.grav === 'neu' ? 'neu' : i.grav}">${ic[i.grav]}</span>${i.ir ? ` <button class="btn sm" data-cfgo="${i.ir}">${esc(i.irTxt)}</button>` : ''}</span></header>${i.nomes.length ? `<div class="body pt0"><details class="legdet"${i.nomes.length <= 8 ? ' open' : ''}><summary>Ver ${i.nomes.length > 8 ? 'os ' + i.nomes.length : 'quem'}</summary><p class="small m0">${i.nomes.map(esc).join(' · ')}</p></details></div>` : ''}</div>`).join('') : '<div class="card"><div class="empty">Tudo certo: nada para conferir no cadastro.</div></div>'}`;
}
// Uso do plano grátis do Firebase (Spark). O número vem da cópia de segurança diária.
function vCfUso() {
  const u = DB.cache.uso;
  const LIM = [['Banco (Firestore)', '1 GiB guardado · 50 mil leituras, 20 mil gravações e 20 mil exclusões por dia'], ['Site (Hosting)', '10 GB guardados · 360 MB de transferência por dia'], ['Contas (Authentication)', 'Sem limite de contas com usuário e senha']];
  const lim = `<div class="card"><header><h2>Limites do plano grátis</h2><p>Se passar do limite do dia, o banco para de responder até a meia-noite do horário do Pacífico (4h ou 5h em Brasília). Nada é cobrado.</p></header><div class="body"><dl class="cfkv">${LIM.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div></div>`;
  if (!u) return `<div class="card"><div class="empty">Ainda sem medição. Ela é feita pela cópia de segurança diária (GitHub › Actions › Cópia de segurança), às 3h.</div></div>${lim}`;
  const em = u.em && u.em.toDate ? u.em.toDate() : null;
  const cols = Object.entries(u.colecoes || {}).sort((a, b) => b[1] - a[1]);
  const totalDocs = cols.reduce((n, [, v]) => n + v, 0);
  const tam = b => (b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB');
  const pctBanco = Math.min(100, ((u.pacoteBytes || 0) * 4) / (1024 ** 3) * 100);
  return `<div class="mini"><div><b class="num">${totalDocs.toLocaleString('pt-BR')}</b><span>Documentos</span></div><div><b class="num">${tam((u.pacoteBytes || 0) * 4)}</b><span>Banco (estimado)</span></div><div><b class="num">${u.fotos ? u.fotos.n.toLocaleString('pt-BR') : '—'}</b><span>Fotos · ${u.fotos ? tam(u.fotos.bytes) : '—'}</span></div><div><b class="num">${u.contas ? u.contas.total : '—'}</b><span>Contas</span></div><div><b class="num">${(u.leiturasCopia || 0).toLocaleString('pt-BR')}</b><span>Leituras da cópia</span></div></div>
  <div class="card"><header><h2>Banco de dados</h2><p>Medido ${em ? 'em ' + em.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'} · cópia ${esc(u.tipo || '')}</p></header><div class="body stackcol">
    <div><div class="small">Espaço usado (estimado pelo tamanho da cópia): <b>${pctBanco < 1 ? 'menos de 1' : pctBanco.toFixed(0)}%</b> de 1 GiB</div><div class="barra"><i style="width:${Math.max(1, pctBanco)}%"></i></div></div>
    ${u.contas && u.contas.semPerfil ? `<p class="small m0"><b>${u.contas.semPerfil} conta(s) sem usuário</b> (sobram quando a senha de alguém é redefinida). Não atrapalham nem gastam cota; podem ser apagadas no console do Firebase › Authentication.</p>` : ''}
    <div class="tw"><table><thead><tr><th>Coleção</th><th class="r">Documentos</th></tr></thead><tbody>${cols.map(([c, n]) => `<tr><td class="mono">${esc(c)}</td><td class="r num">${n.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>
  </div></div>${lim}`;
}
function vConfigModulo(view) {
  if (view === 'cfconf') return vCfConf();
  if (view === 'cfuso') return vCfUso();
  if (view === 'cfescala') return vCfEscala();
  if (view === 'usuarios') return vUsuarios();
  if (view === 'perfis') return vPerfis();
  if (view === 'econfig') return EQ.render('econfig');
  if (view === 'gtipos' || view === 'gimport') return GE.render(view);
  return vCfGeral();
}

/* ---------------- MÓDULO ESCALA E EFETIVO ---------------- */
// Usa o conjunto (Pátio ou Bateria) escolhido no topo do módulo. Dados e permissões são os mesmos das atividades.
function dimRotas(area) {
  const rs = rotasDa(area); let def = 0, ausT = 0;
  const rows = rs.map(r => { const e = escalaRota(r, UI.ini); const dd = e.days.filter(d => d.prog > 0 && d.disp < d.nec).length; if (dd && r.rota !== 'GESTÃO') def++; ausT += e.days.reduce((n, d) => n + (d.aloc - d.disp), 0); return { r, e, dd }; });
  return { rs, rows, def, ausT };
}
function miniEscala(area) {
  const cs = colabsDa(area).filter(c => DB.sit(c.id + '|' + TODAY) !== 'DS');
  // folga (da escala ou lançada) e férias não são ausência: só tiram a pessoa da escala do dia
  const hoje = cs.map(c => sitDia(c, TODAY));
  const fe = hoje.filter(x => x.auto || x.v === 'F').length, fer = hoje.filter(x => x.v === 'FE').length;
  const aus = hoje.filter(x => !x.auto && AUSENCIA.has(x.v)).length;
  const { def } = dimRotas(area);
  // letras de cada turno hoje, separadas em dia e noite
  const ciclos = Object.entries(escala().regimes).filter(([, r]) => r.tipo === 'ciclo').map(([k, r]) => ({ k, nome: k, tp: escala().turmasPeriodo(k, TODAY) })).filter(x => x.tp.D.length || x.tp.N.length);
  // presentes hoje por período (só quem está em turno)
  const perHoje = { D: 0, N: 0 }; cs.forEach((c, i) => { const x = hoje[i]; if (!x.auto && !AUSENTE.has(x.v)) { const p = periodoDe(c, TODAY); if (p) perHoje[p]++; } });
  return `${ciclos.length ? `<div class="hojeturma"><span class="muted small">Trabalham hoje:</span>${ciclos.map(x => `<span class="tchip">${esc(x.nome)}${x.tp.D.length ? ` · <i class="peri D">D</i> dia ${x.tp.D.join(' ')}` : ''}${x.tp.N.length ? ` · <i class="peri N">N</i> noite ${x.tp.N.join(' ')}` : ''}</span>`).join('')}${[0, 6].includes(pd(TODAY).getDay()) || escala().feriados.has(TODAY) ? '<span class="tchip mut">ADM de folga</span>' : '<span class="tchip">ADM</span>'}</div>` : ''}<div class="mini"><div><b class="num">${cs.length}</b><span>No quadro</span></div><div><b class="num">${cs.length - fe - fer}</b><span>Escalados hoje</span></div><div><b class="num">${cs.length - fe - fer - aus}</b><span>Presentes hoje</span></div>${perHoje.D + perHoje.N ? `<div><b class="num">${perHoje.D}<small class="perx"> · ${perHoje.N}</small></b><span>Turno dia · noite</span></div>` : ''}<div><b class="num" style="color:${aus ? 'var(--st-nreal)' : 'inherit'}">${aus}</b><span>Ausentes hoje</span></div>${fer ? `<div><b class="num">${fer}</b><span>De férias</span></div>` : ''}<div><b class="num" style="color:${def ? 'var(--st-nreal)' : 'inherit'}">${def}</b><span>Rotas com déficit na semana</span></div></div>`;
}
// Regime e turma da pessoa; quem pode mexer no cadastro toca para escolher a letra.
const podeTurma = () => isAdmin() || (!!ME && ME.papel === 'gestor');
function turmaTag(c) {
  const rg = regimeDe(c); const r = escala().regimes[rg]; const t = turmaDe(c);
  if (!r || r.tipo !== 'ciclo') return esc(regimeNome(c));
  const txt = t ? `${esc(r.nome)} · turma <b>${esc(t)}</b>` : `${esc(r.nome)} · <span class="semt">sem turma</span>`;
  return podeTurma() ? `<button class="btn ghost link turma-b" data-turma="${esc(c.id)}" title="Escolher a turma">${txt}</button>` : txt;
}
function turmaSheet(id) {
  const c = COLABS.find(x => x.id === id); if (!c) return;
  const rg = regimeDe(c); const r = escala().regimes[rg]; if (!r || r.tipo !== 'ciclo') return;
  const letras = Object.keys(r.turmas || {}); const atual = turmaDe(c);
  const prox = l => { const ds = []; for (let i = 0; i < 8; i++) { const d = add(TODAY, i); const p = escala().previsto(rg, l, d); ds.push(p ? (p.trab ? '●' : '○') : '?'); } return ds.join(' '); };
  sheet(`Turma de ${title(c.nome)}`, `${esc(r.nome)} · ● trabalha ○ folga, a partir de hoje`, [...letras.map(l => ({ t: `Turma ${l}`, d: prox(l), v: l, cur: l === atual })), { t: 'Sem turma', d: 'A folga não é marcada sozinha', v: '' }], o => {
    const itens = (DB.cache.colabs[c.area] || []).map(x => (x.id === c.id ? { ...x, turma: o.v } : x));
    DB.salvarColabsArea(c.area, itens); DB.log(`${title(c.nome)} · turma ${o.v || 'removida'}`); toast(o.v ? `${title(c.nome).split(' ')[0]}: turma ${o.v}` : 'Turma removida'); render();
  });
}
// Abre o módulo Escala e Efetivo no conjunto atual, já na rota (area|rota) quando vier de um link.
function irEscala(rota) {
  if (!setsDe(ME).length) return;
  if (UI.modulo === 'operacao' || UI.modulo === 'bateria') UI.esSet = SK;
  UI.modulo = 'gestao'; UI.modOpen = false; aplicarSet(); UI.view = 'esdia'; UI.eRota = rota || '*'; UI.eQ = ''; UI.confirm = null;
  salvarUI(); render(); scrollTo(0, 0);
}
function vEsDim() {
  const area = areaScope(); const { rows } = dimRotas(area);
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  return miniEscala(area) + `<div class="card"><header><h2>Dimensionamento por rota</h2><p>Disponíveis / necessários por dia. Necessário = efetivo padrão × atividades do dia ÷ carga padrão (em rota de turno, só a parte do quadro que trabalha por dia). Disponível já desconta a folga da escala. Em rota de turno, D e N mostram quantos estão de dia e de noite (em vermelho quando um dos turnos fica sem ninguém). Toque na rota para ver as pessoas</p></header><div class="tw"><table class="dimt"><thead><tr><th>Rota</th>${area === 'TODAS' ? '<th>Área</th>' : ''}<th class="r">Ef. padrão</th><th class="r">Carga</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${d}<br><span class="thd">${ddmm(add(UI.ini, k))}</span></th>`).join('')}<th>Situação</th></tr></thead><tbody>
  ${rows.map(({ r, e, dd }) => `<tr><td><button class="btn ghost link" data-goescala="${esc(r.area + '|' + r.rota)}">${esc(r.rota)}</button></td>${area === 'TODAS' ? `<td class="muted">${AREA_S[r.area]}</td>` : ''}<td class="r num">${r.ef}</td><td class="r num">${r.carga}</td>${e.days.map((d, k) => `<td class="c ${tk[k] ? 'today' : ''}"><span class="cell num ${!d.prog && r.rota !== 'GESTÃO' ? 'neu' : d.disp < d.nec ? 'bad' : 'ok'}" title="${d.prog} atividades · ${d.aloc} alocados · ${d.aloc - d.disp} ausentes${d.dispD + d.dispN ? ` · turno: ${d.dispD} de dia e ${d.dispN} de noite` : ''}">${d.disp}/${d.nec}</span>${d.dispD + d.dispN ? `<small class="dnx${(d.dispD === 0 || d.dispN === 0) && d.prog ? ' bad' : ''}">D${d.dispD} · N${d.dispN}</small>` : ''}</td>`).join('')}<td>${r.rota === 'GESTÃO' ? '<span class="pill neu">Gestão</span>' : dd ? `<span class="pill bad">Déficit · ${dd} ${dd > 1 ? 'dias' : 'dia'}</span>` : '<span class="pill ok">Adequado</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
function vEsBal() {
  const area = areaScope();
  // quem tem alguma ausência na semana, com os dias
  const cs = colabsDa(area);
  const ehAus = y => !y.auto && AUSENCIA.has(y.v); // só ausência de verdade (folga e férias ficam de fora)
  const sem = cs.map(c => ({ c, d: DAYS.map((_, k) => sitDia(c, add(UI.ini, k))) })).filter(x => x.d.some(ehAus)).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  return miniEscala(area) + `<div class="grid2 g-ef">${cardAusencias(area)}${cardBalanco(area, UI.ini)}</div>
  <div class="card"><header><h2>Ausências da semana</h2><p>${weekLabel(UI.ini)} · ${sem.length} pessoa${sem.length === 1 ? '' : 's'} com alguma ausência · só atestado, afastamento, treinamento, falta, abono e suspensão (folga e férias não entram)</p></header>${sem.length ? `<div class="tw"><table class="efd"><thead><tr><th>Colaborador</th><th>Rota</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(UI.ini, k).slice(8)}</span></th>`).join('')}</tr></thead><tbody>
    ${sem.map(x => `<tr><td><button class="btn ghost link" data-goescala="${esc(x.c.area + '|' + x.c.rota)}"><b>${esc(title(x.c.nome))}</b></button></td><td class="muted small">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</td>${x.d.map((y, k) => `<td class="c ${tk[k] ? 'today' : ''}">${ehAus(y) ? `<span class="sit ${y.v} ro" title="${SIT_NOME[y.v] || y.v}">${y.v}</span>` : '<span class="muted" aria-hidden="true">·</span>'}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>` : '<div class="body"><div class="empty">Ninguém ausente nesta semana.</div></div>'}</div>`;
}
// Líder de cada pessoa das Atividades, pela ficha do Efetivo (só para quem tem as fichas). Nomes do mesmo líder viram um só.
let LIDc = null, LIDk = null;
function liderDosColabs() {
  const fichas = (temFichas(ME) && DB.cache.g && DB.cache.g.colabs) || []; if (!fichas.some(f => f.lider)) return null;
  if (LIDc && LIDk === fichas) return LIDc;
  const canon = canonLideres(fichas.map(f => f.lider).filter(Boolean), fichas); const busca = buscaNomes(fichas); const m = new Map();
  // grupo = o líder (chave do RH); o nome mostrado é o mais completo como foi escrito nas fichas
  const graf = new Map(); for (const f of fichas) if (f.lider) { const k = canon(f.lider), g = canon.grafia(f.lider); if (!graf.has(k) || g.length > graf.get(k).length) graf.set(k, g); }
  LIDk = fichas; LIDc = c => { if (!m.has(c.id)) { const r = busca(c.nome, c.mat); const k = r && r.item.lider ? canon(r.item.lider) : ''; m.set(c.id, k ? graf.get(k) || k : ''); } return m.get(c.id); };
  return LIDc;
}
/* ---------------- CHECK-IN DO TURNO ---------------- */
// O líder confirma a equipe no início do turno (dia, noite ou administrativo): presente, falta ou atraso, um toque por pessoa.
// Vira a presença do dia (o mesmo Efetivo diário) e fica registrado quem confirmou e a que horas.
const PER_NOME = { D: 'Turno diurno', N: 'Turno noturno', ADM: 'Administrativo' };
function equipeCheckin() {
  const areas = myAreas().filter(a => AREAS.includes(a)); const out = [];
  for (const a of areas) {
    const g = {};
    for (const c of COLABS.filter(c => c.area === a)) { const x = sitDia(c, TODAY); if (x.auto || ['F', 'FE', 'DS'].includes(x.v)) continue; const per = periodoDe(c, TODAY) || 'ADM'; (g[per] = g[per] || []).push({ c, v: x.v }); }
    for (const per of ['D', 'N', 'ADM']) if (g[per]) out.push({ a, per, ps: g[per].sort((x, y) => x.c.nome.localeCompare(y.c.nome)), ck: (DB.sitExtraMes(TODAY.slice(0, 7)).ck || {})[`ck|${TODAY}|${a}|${per}`] || '' });
  }
  return out;
}
function cardCheckin() {
  const gs = equipeCheckin(); if (!gs.length) return '';
  const tom = v => (v === 'FT' ? 'bad' : v === 'ATR' ? 'warn' : AUSENCIA.has(v) ? 'neu' : 'ok');
  return `<div class="card checkin"><header><h2>Check-in do turno</h2><p>${ddmm(TODAY)} · confirme quem está na equipe: presente, falta ou atraso</p></header><div class="body stackcol">${gs.map(g => {
    const [por, nome, hora, conta] = g.ck.split('|');
    if (g.ck) return `<div class="ckok"><span class="pill ok">✓</span> <b>${PER_NOME[g.per]}</b> · ${AREA_S[g.a]} · check-in às ${esc(hora || '')} por ${esc(nome || '')}${conta ? ` · ${esc(conta)} presentes` : ''} <button class="btn ghost link" data-ckre="${esc(g.a)}|${g.per}">refazer</button></div>`;
    const pres = g.ps.filter(x => !AUSENCIA.has(x.v) && x.v !== 'ATR').length;
    return `<div class="ckg"><div class="row-between"><b>${PER_NOME[g.per]} · ${AREA_S[g.a]}</b><span class="row-gap"><span class="muted small">${pres} de ${g.ps.length} presentes</span><button class="btn sm pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar</button></span></div><div class="plist">${g.ps.map(x => `<div class="pitem"><div class="minw"><div class="t">${esc(title(x.c.nome))}</div><div class="l">${esc(x.c.rota)}${turmaDe(x.c) ? ' · turma ' + esc(turmaDe(x.c)) : ''}</div></div><div class="bt ckbt"><button class="btn sm ${x.v === 'P' || x.v === 'HE' ? 'on ok' : ''}" data-ck="${esc(x.c.id)}|P" aria-pressed="${x.v === 'P' || x.v === 'HE'}">Presente</button><button class="btn sm ${x.v === 'ATR' ? 'on warn' : ''}" data-ck="${esc(x.c.id)}|ATR" aria-pressed="${x.v === 'ATR'}">Atraso</button><button class="btn sm ${x.v === 'FT' ? 'on bad' : ''}" data-ck="${esc(x.c.id)}|FT" aria-pressed="${x.v === 'FT'}">Falta</button>${!['P', 'HE', 'ATR', 'FT'].includes(x.v) ? `<span class="pill ${tom(x.v)}">${SIT_NOME[x.v] || x.v}</span>` : ''}</div></div>`).join('')}</div><button class="btn pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar check-in · ${pres} de ${g.ps.length} presentes</button></div>`;
  }).join('')}</div></div>`;
}
const checkinPendentes = () => { try { return equipeCheckin().filter(g => !g.ck && (g.per !== 'N' || new Date().getHours() >= 17)).length; } catch (e) { return 0; } };
function vEsDia() {
  const area = areaScope();
  const rs = rotasDa(area);
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  const opts = rs.map(r => r.area + '|' + r.rota);
  if (UI.eRota !== '*' && !opts.includes(UI.eRota)) UI.eRota = '*';
  // Busca: com texto, mostra quem casar em todas as rotas da área escolhida no topo.
  const q = UI.eQ || '';
  const kC = c => semAcento([c.nome, c.funcao, c.rota, c.regime, AREA_S[c.area]].filter(Boolean).join(' '));
  const todas = UI.eRota === '*' || UI.eAgr === 'lider' || UI.eAgr === 'periodo' || !!q.trim();
  const ordem = new Map(rs.map((r, i) => [r.area + '|' + r.rota, i]));
  // Agrupar por rota (padrão) ou por líder (o líder vem da ficha do Efetivo; nomes do mesmo líder viram um só)
  const lid = liderDosColabs(); const porLider = UI.eAgr === 'lider' && !!lid;
  // Período de hoje (turno diurno, noturno, administrativo, fora): quem trabalha de dia e quem trabalha de noite
  const porPer = UI.eAgr === 'periodo'; const porGrupo = porLider || porPer;
  const dRef = tk.includes(true) ? TODAY : UI.ini;
  const grpPer = c => { const s = sitDia(c, dRef); if (s.v === 'DS') return '5|Desligados'; if (s.auto || s.v === 'F' || s.v === 'FE') return '4|Folga ou férias'; const pr = periodoDe(c, dRef); if (pr) return pr === 'N' ? '2|Turno noturno' : '1|Turno diurno'; return escala().regimes[regimeDe(c)] && escala().regimes[regimeDe(c)].tipo === 'ciclo' ? '3|Turno sem turma' : '0|Administrativo'; };
  let cs = q.trim() ? colabsDa(area).filter(c => casa(kC(c), q)) : UI.eRota === '*' || porGrupo ? colabsDa(area) : COLABS.filter(c => c.area + '|' + c.rota === UI.eRota);
  const gk = c => (porPer ? grpPer(c) : porLider ? 'L|' + (lid(c) || '~') : c.area + '|' + c.rota);
  cs = cs.slice().sort((x, y) => porGrupo ? gk(x).localeCompare(gk(y)) || x.nome.localeCompare(y.nome) : (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999) || x.nome.localeCompare(y.nome));
  const pres = DAYS.map((_, k) => cs.filter(c => { const v = sitDia(c, add(UI.ini, k)).v; return v !== 'DS' && !AUSENTE.has(v); }).length);
  const quadro = DAYS.map((_, k) => cs.filter(c => { const dt = add(UI.ini, k); return DB.sit(c.id + '|' + dt) !== 'DS' && !folgaEscala(c, dt); }).length);
  const celula = (c, k) => {
    const dt = add(UI.ini, k); const x = sitDia(c, dt); const v = x.v; const ed = canEditSit(c.area);
    const inf = DB.sitInfo(c.id + '|' + dt); const cob = !x.auto && AUS_COBRIVEL.has(v) ? inf.cob : ''; const cobre = cobrindo(c.id, dt);
    const per = ['P', 'ATR', 'HE'].includes(v) ? periodoDe(c, dt) : '';
    const tt = (x.auto ? `Folga pela escala (${x.motivo})` : SIT_NOME[v] || v) + (per ? ` · turno ${PERIODO[per].toLowerCase()}` : '') + (v === 'HE' && inf.he ? ` a pedido da ${HE_ORIG[inf.he]}` : '') + (cob ? ` · coberto por ${nomeDe(cob)}` : (!x.auto && AUS_COBRIVEL.has(v) ? ' · sem substituto' : '')) + (cobre ? ` · cobrindo ${nomeDe(cobre)}` : '');
    return `<td class="c ${tk[k] ? 'today' : ''}"><button class="sit ${v}${x.auto ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}${cob || cobre ? ' cobm' : ''}" ${ed ? `data-sit="${c.id}|${dt}"` : 'disabled'} aria-label="${esc(title(c.nome))}, ${DAYS[k]} ${ddmm(dt)}: ${esc(tt)}" title="${esc(tt)}">${v === 'P' ? I.ok : v}${v === 'HE' && inf.he ? `<sup>${HE_SIG[inf.he]}</sup>` : ''}${cob || cobre ? '<i class="cobi" aria-hidden="true">⇄</i>' : ''}${marcaPer(per)}</button></td>`;
  };
  // agrupa por rota quando mostra várias rotas; com muitas rotas, os grupos começam fechados (toque para abrir)
  let ant = '';
  const nGrupos = todas && !q.trim() ? new Set(cs.map(gk)).size : 0;
  const recolhe = nGrupos > 4;
  const efAb = new Set(UI.efAbertas || []);
  const linhas = cs.map(c => {
    const g = gk(c); let cab = '';
    const fechado = recolhe && !efAb.has(g);
    if (todas && !q.trim() && g !== ant) {
      ant = g; const doG = cs.filter(x => gk(x) === g);
      const rot = porPer ? `${g.slice(2)}${['1', '2'].includes(g[0]) ? ` · turma ${[...new Set(doG.map(x => turmaDe(x)).filter(Boolean))].sort().join(', ')}` : ''}` : porLider ? (g === 'L|~' ? 'Sem líder na ficha' : 'LÍDER ' + g.slice(2)) : c.rota; const kh = DAYS.findIndex((_, k) => tk[k]);
      const ph = kh >= 0 ? doG.filter(x => { const v = sitDia(x, TODAY).v; return v !== 'DS' && !AUSENTE.has(v); }).length : null;
      const eh = kh >= 0 ? doG.filter(x => { const s = sitDia(x, TODAY); return s.v !== 'DS' && !s.auto && s.v !== 'F' && s.v !== 'FE'; }).length : null; // folga e férias não contam como escalado
      cab = `<tr class="grp-row"><th colspan="${isMobile() ? 8 : 9}">${recolhe ? `<button type="button" class="efg${fechado ? '' : ' on'}" data-efg="${esc(g)}" aria-expanded="${!fechado}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(rot)}</b>${area === 'TODAS' && !porGrupo ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}</button>` : porGrupo ? `<b>${esc(rot)}</b>` : `<button class="btn ghost link" data-erota="${esc(g)}">${esc(c.rota)}</button>${area === 'TODAS' ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}`}<span class="gcount">${porPer && g[0] >= '4' ? `${doG.length} pessoa${doG.length === 1 ? '' : 's'}` : ph != null ? `${ph}/${eh} presentes hoje${(() => { if (porPer) return ''; const pp = { D: 0, N: 0 }; doG.forEach(x => { const s = sitDia(x, TODAY); if (!s.auto && !AUSENTE.has(s.v)) { const p = periodoDe(x, TODAY); if (p) pp[p]++; } }); return pp.D + pp.N ? ` (${pp.D} dia · ${pp.N} noite)` : ''; })()}${doG.length > eh ? ` · ${doG.length - eh} de folga` : ''}` : `${doG.length} pessoa${doG.length > 1 ? 's' : ''}`}</span></th></tr>`;
    }
    if (fechado) return cab;
    return cab + `<tr><td class="fnome"><b>${esc(title(c.nome))}</b><div class="muted small">${q.trim() || porGrupo ? `${esc(c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[c.area] : ''} · ` : ''}${turmaTag(c)}${isMobile() && c.funcao ? ' · ' + esc(title(c.funcao)) : ''}</div></td>${isMobile() ? '' : `<td class="muted small">${esc(title(c.funcao))}</td>`}${DAYS.map((_, k) => celula(c, k)).join('')}</tr>`;
  }).join('');
  return miniEscala(area) + (tk.includes(true) ? cardCheckin() : '') + `<div class="card"><header><h2>Efetivo diário</h2><p>${canEditSit(area === 'TODAS' ? (myArea() || AREAS[0]) : area) ? 'Toque no dia para mudar a situação · ✓ = presente' : 'Somente leitura'}</p></header>
  <div class="body lbar efbar">${!framed && !isMobile() ? `<button class="btn sm" data-act="expEsdia" title="A semana inteira, de todas as rotas da área escolhida">${I.dl} Exportar semana</button>` : ''}${caixaBusca('fEQ', q, 'Buscar colaborador, função ou rota')}${q.trim() ? `<span class="muted small"><b>${cs.length}</b> encontrado${cs.length === 1 ? '' : 's'} em ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span><button class="btn sm ghost" data-act="limparEQ">Limpar busca</button>` : `<label class="sel"><span>Agrupar por</span><select class="in" id="fEAgr"><option value="rota" ${!porGrupo ? 'selected' : ''}>Rota</option><option value="periodo" ${porPer ? 'selected' : ''}>Dia e noite (${dRef === TODAY ? 'hoje' : ddmm(dRef)})</option>${lid ? `<option value="lider" ${porLider ? 'selected' : ''}>Líder</option>` : ''}</select></label>${porGrupo ? '' : `<label class="sel efrota"><span>Rota</span><select class="in" id="fERota"><option value="*" ${UI.eRota === '*' ? 'selected' : ''}>Todas as rotas (${colabsDa(area).length} pessoas)</option>${rs.map(r => `<option value="${esc(r.area + '|' + r.rota)}" ${r.area + '|' + r.rota === UI.eRota ? 'selected' : ''}>${esc(r.rota)}${area === 'TODAS' ? ' · ' + AREA_S[r.area] : ''}</option>`).join('')}</select></label>`}`}</div>
  ${recolhe ? `<div class="body pt0 pb0 row-gap"><button class="btn sm" data-act="efTodas">${efAb.size ? (porGrupo ? 'Recolher todos os grupos' : 'Recolher todas as rotas') : (porGrupo ? 'Abrir todos os grupos' : 'Abrir todas as rotas')}</button><span class="muted small">${nGrupos} ${porGrupo ? 'grupos · toque num grupo' : 'rotas · toque numa rota'} para ver as pessoas</span></div>` : ''}
  <details class="legdet body pb0 pt0"${isMobile() ? '' : ' open'}><summary>Legenda das siglas</summary><div class="legend sitleg"><span><span class="sit P">${I.ok}</span> Presente</span><span><span class="sit F auto">F</span> Folga pela escala</span><span><span class="sit FT cobm">FT<i class="cobi">⇄</i></span> Com substituto</span><span><span class="sit P">${I.ok}${marcaPer('D')}</span> Turno diurno</span><span><span class="sit P">${I.ok}${marcaPer('N')}</span> Turno noturno (conta no dia em que começa)</span><span><span class="sit HE">HE<sup>D</sup></span> Hora extra (D Dikma · A ArcelorMittal)</span>${SITS.filter(s => s[0] !== 'P').map(s => `<span><span class="sit ${s[0]}">${s[0]}</span> ${s[1]}</span>`).join('')}</div></details>
  <div class="tw"><table class="efd${isMobile() ? ' efmob' : ''}"><thead><tr><th>Colaborador</th>${isMobile() ? '' : '<th>Função</th>'}${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(UI.ini, k).slice(8)}</span></th>`).join('')}</tr></thead><tbody>
  ${cs.length ? linhas : `<tr><td colspan="${isMobile() ? 8 : 9}" class="empty">${q.trim() ? 'Ninguém encontrado com essa busca.' : 'Nenhum colaborador nesta rota.'}</td></tr>`}
  </tbody>${cs.length ? `<tfoot><tr><th colspan="${isMobile() ? 1 : 2}">Presentes</th>${DAYS.map((_, k) => `<td class="c num ${tk[k] ? 'today' : ''}"><b class="${pres[k] < quadro[k] ? 'menos' : ''}">${pres[k]}</b><span class="muted">/${quadro[k]}</span></td>`).join('')}</tr></tfoot>` : ''}</table></div></div>`;
}

/* ---------------- APROVAÇÃO ---------------- */
const NOME_AP = { R: 'Realizada', N: 'Não realizada', E: 'Extra' };
const TOM_AP = { R: 'ok', N: 'bad', E: 'ext' };
function vAprovar() {
  const minhas = areasAprov();
  if (!minhas.length) return '<div class="card"><div class="empty">Seu perfil não aprova apontamentos.</div></div>';
  const area = minhas.includes(UI.aprArea) ? UI.aprArea : 'TODAS';
  const todas = listaAprov(minhas);
  const xs = area === 'TODAS' ? todas : todas.filter(x => x.doc.area === area);
  const dev = listaAprov(area === 'TODAS' ? minhas : [area], 'dev');
  // prazo de aprovação: o que o líder apontou num dia deve ser aprovado até o fim do dia seguinte
  const PRAZO_APROV = 1; const limite = add(TODAY, -PRAZO_APROV); const foraPrazo = xs.filter(x => x.dt < limite).length;
  const grupos = new Map();
  for (const x of xs) { const key = `${x.dt}|${x.doc.area}|${x.p.rota}`; if (!grupos.has(key)) grupos.set(key, []); grupos.get(key).push(x); }
  let h = minhas.length > 1 ? `<div class="rchips linha" role="group" aria-label="Área"><button class="rchip" data-aprarea="TODAS" aria-pressed="${area === 'TODAS'}">Todas<span class="c num">${todas.length || '✓'}</span></button>${minhas.map(a => { const n = todas.filter(x => x.doc.area === a).length; return `<button class="rchip" data-aprarea="${a}" aria-pressed="${a === area}">${AREA_S[a]}<span class="c num">${n || '✓'}</span></button>`; }).join('')}</div>` : '';
  h += `<div class="mini"><div><b class="num" style="color:${xs.length ? 'var(--st-atr)' : 'inherit'}">${xs.length}</b><span>Aguardando aprovação</span></div><div><b class="num">${grupos.size}</b><span>Rotas e dias</span></div><div><b class="num">${dev.length}</b><span>Devolvidas ao líder</span></div><div><b class="num" style="color:${foraPrazo ? 'var(--st-nreal)' : 'inherit'}">${foraPrazo}</b><span>Fora do prazo (mais de 1 dia)</span></div></div>
  <div class="row-between"><p class="muted small m0">O que o líder aponta já conta nos números, com o selo “aguardando”. Aprove ou devolva com o motivo para ele corrigir.</p>${xs.length > 1 ? (UI.confirm === 'aprvTudo' ? `<span class="confirm">Aprovar os ${xs.length} apontamentos? <button class="btn pri sm" data-act="aprvTudo">Confirmar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>` : `<button class="btn pri sm" data-act="askAprvTudo">${I.ok} Aprovar tudo (${xs.length})</button>`) : ''}</div>`;
  if (!xs.length) h += '<div class="card"><div class="empty">Nada aguardando aprovação. Tudo o que os líderes apontaram já foi conferido.</div></div>';
  const abertos = UI.aprTodas || [];
  for (const [key, it] of [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 30)) { // mais antigos primeiro: o que está fora do prazo fica no topo
    const [dt, a, r] = key.split('|'); const tudo = abertos.includes(key);
    h += `<div class="card aprov"><header><h2>${esc(r)}</h2><p>${DAYS[(new Date(dt + 'T12:00:00').getDay() + 6) % 7]} ${ddmm(dt)}${minhas.length > 1 ? ' · ' + AREA_S[a] : ''} · ${it.length} para aprovar${dt < limite ? ` · <span class="pill bad">fora do prazo · há ${Math.round((pd(TODAY) - pd(dt)) / 864e5)} dias</span>` : ''}</p><span class="r"><button class="btn sm" data-act="aprvGrupo" data-k="${esc(key)}">${I.ok} Aprovar ${it.length > 1 ? 'todas' : ''}</button></span></header><div class="body"><div class="plist">
    ${(tudo ? it : it.slice(0, 8)).map(x => { const c = x.doc.d[x.i][x.k]; const m = x.doc.m[x.p.id + '|' + x.k]; const ref = `${esc(x.doc.id)}|${x.i}|${x.k}`; return `<div class="pitem"><div class="minw"><div class="t">${esc(x.p.ativ)}</div><div class="l">${esc(x.p.local)} · <span class="mono">${x.p.id}</span> · <span class="pill ${TOM_AP[c]}">${NOME_AP[c]}</span></div>${m ? `<div class="l just">Justificativa: ${esc(m)}</div>` : ''}</div><div class="bt"><button class="ok-btn sm" data-act="aprv" data-k="${ref}" aria-label="Aprovar" title="Aprovar">✓</button><button class="no-btn sm dev-btn" data-act="devl" data-k="${ref}" aria-label="Devolver ao líder" title="Devolver ao líder">↩</button></div></div>`; }).join('')}
    ${it.length > 8 ? `<div class="pitem"><span class="muted">${tudo ? `${it.length} nesta rota` : `+ ${it.length - 8} nesta rota`}</span><button class="btn" data-act="aprTodas" data-k="${esc(key)}">${tudo ? 'Mostrar menos' : 'Ver todas'}</button></div>` : ''}
    </div></div></div>`;
  }
  if (grupos.size > 30) h += `<p class="muted small">Mostrando as 30 rotas e dias mais antigos de ${grupos.size}. Aprove estas para ver as próximas.</p>`;
  if (dev.length) h += `<div class="card"><header><h2>Devolvidas ao líder</h2><p>Esperando a correção · ${dev.length}</p></header><div class="body"><div class="plist">${dev.slice(0, 12).map(x => { const a = aprovDe(x.doc, x.p.id, x.k) || {}; return `<div class="pitem"><div class="minw"><div class="t">${esc(x.p.ativ)}</div><div class="l">${esc(x.p.rota)} · ${ddmm(x.dt)} · por ${esc(title(curto(a.nome || '')))}: ${esc(a.mot || '')}</div></div></div>`; }).join('')}${dev.length > 12 ? `<p class="muted small m0">+ ${dev.length - 12}</p>` : ''}</div></div></div>`;
  return h;
}
function achaAprov(ref) {
  const [id, i, k] = [ref.slice(0, ref.lastIndexOf('|', ref.lastIndexOf('|') - 1)), ...ref.split('|').slice(-2).map(Number)];
  const doc = DB.cache.semanas[id]; if (!doc) return null; const p = PL.get(doc.ids[i]); if (!p) return null;
  return { doc, i, k, dt: diasDe(doc)[k], p };
}
const MOTIVOS_DEV = ['Não foi feita', 'Foi feita em outro dia', 'Justificativa não confere', 'Atividade errada'];
function pedirDevolucao(x) {
  const c = x.doc.d[x.i][x.k];
  sheet('Devolver ao líder', `${esc(x.p.ativ)} · ${esc(x.p.rota)} · ${ddmm(x.dt)} · apontada como <b>${NOME_AP[c] || c}</b>`, [...MOTIVOS_DEV.map(t => ({ t })), { t: 'Outro motivo…', d: 'Escrever o motivo', outro: true, larga: true }], o => {
    if (!o.outro) { devolver(x, o.t); toast('Devolvida ao líder'); render(); return; }
    formSheet('Motivo da devolução', esc(x.p.ativ), '<label class="sel"><span>Motivo</span><input class="in" id="devMot" maxlength="120" autocomplete="off"></label>', 'Devolver', async () => {
      const m = ($('devMot').value || '').trim(); if (!m) throw new Error('Escreva o motivo.');
      devolver(x, m); toast('Devolvida ao líder'); render();
    });
  });
}

/* ---------------- CAUSAS E AÇÕES ---------------- */
// Pareto das justificativas das não realizadas (mês e área do topo), semana a semana, por rota, e o plano de ação de cada causa.
const OUTRAS = 'Outras justificativas (escritas)';
const causaDe = m => (MOTIVOS.includes(m) ? m : OUTRAS);
const podeAcao = area => aprovador() && (area === 'TODAS' ? todasAreas() : areasAprov().includes(area));
function contarCausas(docs, rota) {
  const por = {}, escritas = {}; let total = 0;
  for (const d of docs) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p || (rota && p.rota !== rota)) return; for (let k = 0; k < 7; k++) if (d.d[i][k] === 'N') { const m = d.m[id + '|' + k] || 'Sem justificativa'; const c = m === 'Sem justificativa' ? m : causaDe(m); por[c] = (por[c] || 0) + 1; total++; if (c === OUTRAS) escritas[m] = (escritas[m] || 0) + 1; } });
  return { por, escritas, total };
}
// Quantas vezes a causa apareceu por semana nas 4 semanas antes e depois de uma data (só os meses carregados)
function efeitoAcao(causa, area, desde) {
  const ini = weekOf(desde.slice(0, 10)); let antes = 0, depois = 0, sa = 0, sd = 0;
  for (let w = -4; w <= 4; w++) {
    if (w === 0) continue; const wk = add(ini, 7 * w); if (wk > CUR_WEEK) continue;
    const ds = docsFor({ ini: wk, area: area === 'TODAS' ? 'TODAS' : area }); if (!ds.length) continue;
    const n = contarCausas(ds).por[causa] || 0; if (w < 0) { antes += n; sa++; } else { depois += n; sd++; }
  }
  return { antes: sa ? antes / sa : null, depois: sd ? depois / sd : null };
}
function vCausas() {
  const area = areaScope(); const docs = docsFor({ mes: UI.mes, area });
  const { por, escritas, total } = contarCausas(docs);
  const lista = Object.entries(por).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...lista.map(x => x[1]));
  let acum = 0; const nf = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const atrasadas = atrasadasAll(area).filter(x => x.doc.mes === UI.mes).length;
  const acoes = Object.values(DB.cache.acoes || {}).filter(a => a.status !== 'cancelada' && (area === 'TODAS' || a.area === area || a.area === 'TODAS'));
  const abertas = acoes.filter(a => a.status !== 'feita');
  const vencidas = abertas.filter(a => a.prazo && a.prazo < TODAY);
  let h = `<div class="mini"><div><b class="num" style="color:${total ? 'var(--st-nreal)' : 'inherit'}">${total}</b><span>Não realizadas no mês</span></div><div><b class="num">${lista.length}</b><span>Causas diferentes</span></div><div><b class="num">${atrasadas}</b><span>Atrasadas sem apontar</span></div><div><b class="num">${abertas.length}</b><span>Ações abertas</span></div><div><b class="num" style="color:${vencidas.length ? 'var(--st-nreal)' : 'inherit'}">${vencidas.length}</b><span>Ações com prazo vencido</span></div></div>`;
  if (!total) h += `<div class="card"><div class="empty">Nenhuma atividade não realizada em ${monthLabel(UI.mes)}${area === 'TODAS' ? '' : ' · ' + AREA_S[area]}.</div></div>`;
  else {
    const top = lista.slice(0, 3).reduce((n, x) => n + x[1], 0);
    h += `<div class="card"><header><h2>Pareto das causas</h2><p>${monthLabel(UI.mes)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · as ${Math.min(3, lista.length)} primeiras somam ${pct(top, total)}%</p></header><div class="body"><div class="bars pareto">${lista.map(([c, n]) => { acum += n; const ac = acoes.filter(a => a.causa === c && a.status !== 'feita'); return `<div class="barrow mot"><span class="n">${esc(c)}${ac.length ? ` <span class="pill neu">${ac.length} ação${ac.length > 1 ? 'ões' : ''}</span>` : ''}</span><div class="stack clear"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}<small class="muted"> · ${pct(acum, total)}%</small></span>${podeAcao(area === 'TODAS' ? (todasAreas() ? 'TODAS' : myArea()) : area) && c !== 'Sem justificativa' ? `<button class="btn sm ghost" data-act="novaAcao" data-k="${esc(c)}" title="Criar ação para esta causa">${I.plus} Ação</button>` : ''}</div>`; }).join('')}</div>
    <p class="muted small m0">O número à direita é o total da causa · o percentual é o acumulado (as causas de cima explicam a maior parte).</p>
    ${Object.keys(escritas).length ? `<details class="m0"><summary class="small">Ver as ${Object.keys(escritas).length} justificativas escritas</summary><div class="plist">${Object.entries(escritas).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => `<div class="pitem"><div class="minw"><div class="l">${esc(t)}</div></div><span class="num">${n}</span></div>`).join('')}</div></details>` : ''}</div></div>`;
    // semana a semana
    const ws = weeksOfMonth(UI.mes); const porSem = ws.map(w => contarCausas(docs.filter(d => d.ini === w)).por);
    h += `<div class="card"><header><h2>Semana a semana</h2><p>Quantas não realizadas por causa em cada semana do mês</p></header><div class="tw"><table><thead><tr><th>Causa</th>${ws.map(w => `<th class="r">${weekLabel(w).split(' · ')[0]}</th>`).join('')}<th class="r">Mês</th></tr></thead><tbody>${lista.slice(0, 8).map(([c, n]) => `<tr><td>${esc(c)}</td>${porSem.map(p => `<td class="r num">${p[c] || '·'}</td>`).join('')}<td class="r num"><b>${n}</b></td></tr>`).join('')}</tbody></table></div></div>`;
    // por rota
    const rs = rotasDa(area).map(r => ({ r, x: contarCausas(docsFor({ mes: UI.mes, area: r.area }), r.rota) })).filter(y => y.x.total).sort((a, b) => b.x.total - a.x.total).slice(0, 10);
    h += `<div class="card"><header><h2>Rotas com mais não realizadas</h2><p>E a causa principal de cada uma</p></header><div class="tw"><table><thead><tr><th>Rota</th>${area === 'TODAS' ? '<th>Área</th>' : ''}<th class="r">Não realizadas</th><th>Causa principal</th></tr></thead><tbody>${rs.map(({ r, x }) => { const [c, n] = Object.entries(x.por).sort((a, b) => b[1] - a[1])[0]; return `<tr><td><b>${esc(r.rota)}</b></td>${area === 'TODAS' ? `<td class="muted">${AREA_S[r.area]}</td>` : ''}<td class="r num">${x.total}</td><td>${esc(c)} <span class="muted small">(${n})</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
  }
  // plano de ação
  const ord = { aberta: 0, feita: 1 };
  h += `<div class="card"><header><h2>Plano de ação</h2><p>O que está sendo feito para cada causa · o efeito compara a média por semana nas 4 semanas antes e depois da ação</p></header><div class="body">${acoes.length ? `<div class="plist">${acoes.slice().sort((a, b) => (ord[a.status] || 0) - (ord[b.status] || 0) || String(a.prazo || '9').localeCompare(String(b.prazo || '9'))).map(a => {
    const ef = efeitoAcao(a.causa, a.area, a.em || TODAY); const venc = a.status !== 'feita' && a.prazo && a.prazo < TODAY; const ed = podeAcao(a.area);
    return `<div class="pitem acao"><div class="minw"><div class="t">${esc(a.acao)}</div><div class="l">${esc(a.causa)} · ${a.area === 'TODAS' ? 'todas as áreas' : AREA_S[a.area] || esc(a.area)}${a.resp ? ` · resp. ${esc(a.resp)}` : ''}${a.prazo ? ` · prazo ${ddmm(a.prazo)}` : ''}</div><div class="l">${ef.antes != null ? `Antes: ${nf(ef.antes)}/semana` : 'Antes: sem dados'} · ${ef.depois != null ? `depois: <b>${nf(ef.depois)}/semana</b>${ef.antes != null ? (ef.depois < ef.antes ? ' <span class="pill ok">caiu</span>' : ef.depois > ef.antes ? ' <span class="pill bad">subiu</span>' : ' <span class="pill neu">igual</span>') : ''}` : 'depois: aguardando a próxima semana'}</div></div><div class="row-gap">${a.status === 'feita' ? '<span class="pill ok">feita</span>' : venc ? '<span class="pill bad">prazo vencido</span>' : '<span class="pill warn">aberta</span>'}${ed ? (a.status === 'feita' ? `<button class="btn sm" data-act="acaoSt" data-k="${esc(a.id)}|aberta">Reabrir</button>` : `<button class="btn sm pri" data-act="acaoSt" data-k="${esc(a.id)}|feita">Concluir</button>`) + `<button class="btn sm ghost" data-act="acaoSt" data-k="${esc(a.id)}|cancelada" title="Tirar do plano">✕</button>` : ''}</div></div>`;
  }).join('')}</div>` : `<div class="empty">Nenhuma ação ainda.${aprovador() ? ' Toque em “+ Ação” ao lado de uma causa no Pareto.' : ''}</div>`}</div></div>`;
  return h;
}
function novaAcaoSheet(causa) {
  const area = areaScope(); const opts = area !== 'TODAS' ? [area] : todasAreas() ? ['TODAS', ...AREAS] : areasAprov();
  formSheet('Nova ação', esc(causa), `<label class="sel"><span>O que vai ser feito</span><textarea class="in" id="acTxt" rows="3" maxlength="300" placeholder="Ex.: combinar com a operação a liberação da área às 8h"></textarea></label>
    <div class="row2"><label class="sel"><span>Responsável</span><input class="in" id="acResp" maxlength="60" autocomplete="off"></label><label class="sel"><span>Prazo</span><input class="in" type="date" id="acPrazo" value="${add(TODAY, 7)}"></label></div>
    <label class="sel"><span>Área</span><select class="in" id="acArea">${opts.map(a => `<option value="${a}">${a === 'TODAS' ? 'Todas as áreas' : AREA_S[a]}</option>`).join('')}</select></label>`, 'Criar ação', async () => {
    const acao = ($('acTxt').value || '').replace(/\s+/g, ' ').trim(); if (acao.length < 5) throw new Error('Descreva a ação.');
    const ar = $('acArea').value; if (!podeAcao(ar)) throw new Error('Seu perfil não cria ação nesta área.');
    await DB.salvarAcao('', { causa, area: ar, acao, resp: ($('acResp').value || '').trim(), prazo: $('acPrazo').value || '', status: 'aberta' });
    DB.log(`Plano de ação: ${causa} → ${acao}`); toast('Ação criada'); render();
  });
}

/* ---------------- ETIQUETAS QR ---------------- */
// Uma etiqueta por rota: o link abre o Apontar de hoje já na rota (?r=ÁREA|ROTA). Imprimir e colar no local.
let QR = null;
const linkRota = r => `${location.origin}${location.pathname}?m=${UI.modulo}&v=apontar&r=${encodeURIComponent(r.area + '|' + r.rota)}`;
function vEtiquetas() {
  if (!QR) { import('./vendor/qrcode.js').then(m => { QR = m.default || m.qrcode; render(); }).catch(() => toast('Não foi possível carregar o gerador de QR Code')); return M.ESQUELETO; }
  const area = areaScope(); const rs = rotasDa(area).filter(r => r.carga > 0 || r.rota !== 'GESTÃO');
  const svg = url => { const q = QR(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); };
  return `<div class="row-between noprint"><p class="muted m0">${rs.length} etiqueta${rs.length === 1 ? '' : 's'} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}. Ao ler o código com a câmera do celular, abre o Apontar de hoje nesta rota (é preciso estar com o login feito).</p>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir etiquetas</button>` : ''}</div>
  <div class="qrgrid">${rs.map(r => `<div class="qret"><div class="qrsvg">${svg(linkRota(r))}</div><div class="qrtxt"><b>${esc(r.rota)}</b><span>${AREA_S[r.area]} · ${SETS[SK].nome}</span><small>Aponte a câmera para abrir esta rota no Dikma Gestão</small></div></div>`).join('')}</div>`;
}

/* ---------------- RESUMO DA SEMANA ---------------- */
function vResumo() {
  const area = areaScope(); const docs = docsFor({ ini: UI.ini, area }); const s = stats(docs);
  const ef = pct(s.Rhoje, s.progHoje);
  const porArea = (area === 'TODAS' ? AREAS : [area]).map(a => ({ a, x: stats(docsFor({ ini: UI.ini, area: a })) }));
  const { por, total } = contarCausas(docs); const causas = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const as = area === 'TODAS' ? AREAS : [area]; const ids = new Set(docs.map(d => d.id));
  const pa = listaAprov(as).filter(x => ids.has(x.doc.id)).length, dv = listaAprov(as, 'dev').filter(x => ids.has(x.doc.id)).length;
  const acoes = Object.values(DB.cache.acoes || {}).filter(a => a.status === 'aberta' && (area === 'TODAS' || a.area === area || a.area === 'TODAS'));
  const cs = colabsDa(area); const dias = DAYS.map((_, k) => add(UI.ini, k)); const he = { DIKMA: 0, ARCELOR: 0, '': 0 };
  cs.forEach(c => dias.forEach(d => { if (DB.sit(c.id + '|' + d) === 'HE') he[DB.sitInfo(c.id + '|' + d).he || '']++; }));
  const aus = {}; cs.forEach(c => dias.forEach(d => { const x = sitDia(c, d); if (!x.auto && AUSENCIA.has(x.v)) aus[x.v] = (aus[x.v] || 0) + 1; }));
  return `<div class="row-between noprint"><p class="muted m0">${weekLabel(UI.ini)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · troque a semana e a área no topo.</p>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>
  <div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO DA SEMANA</h3><div class="meta"><span><b>${SETS[SK].nome}</b></span><span><b>Área:</b> ${area === 'TODAS' ? 'Todas' : AREA_S[area]}</span><span><b>Semana:</b> ${weekLabel(UI.ini)}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis"><div><b>${ef}%</b><span>Eficiência até ${ddmm(TODAY < add(UI.ini, 6) ? TODAY : add(UI.ini, 6))}</span></div><div><b>${n0(s.prog)}</b><span>Programadas</span></div><div><b>${n0(s.R)}</b><span>Realizadas</span></div><div><b>${n0(s.N)}</b><span>Não realizadas</span></div><div><b>${n0(s.A)}</b><span>Atrasadas</span></div><div><b>${n0(s.E)}</b><span>Extras</span></div></div>
  <h4>Por área</h4><table><thead><tr><th>Área</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realizadas</th><th class="r">Atrasadas</th><th class="r">Eficiência</th></tr></thead><tbody>${porArea.map(({ a, x }) => `<tr><td>${AREA_S[a]}</td><td class="r">${x.prog}</td><td class="r">${x.R}</td><td class="r">${x.N}</td><td class="r">${x.A}</td><td class="r"><b>${pct(x.Rhoje, x.progHoje)}%</b></td></tr>`).join('')}</tbody></table>
  <div class="rcols"><div><h4>Principais causas das não realizadas</h4>${causas.length ? `<table><tbody>${causas.map(([c, n]) => `<tr><td>${esc(c)}</td><td class="r">${n}</td><td class="r">${pct(n, total)}%</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma não realizada.</p>'}</div>
  <div><h4>Aprovação e plano de ação</h4><table><tbody><tr><td>Aguardando aprovação</td><td class="r">${pa}</td></tr><tr><td>Devolvidas ao líder</td><td class="r">${dv}</td></tr><tr><td>Ações abertas</td><td class="r">${acoes.length}</td></tr><tr><td>Ações com prazo vencido</td><td class="r">${acoes.filter(a => a.prazo && a.prazo < TODAY).length}</td></tr></tbody></table></div></div>
  <div class="rcols"><div><h4>Ausências (pessoas × dias)</h4>${Object.keys(aus).length ? `<table><tbody>${Object.entries(aus).map(([k, n]) => `<tr><td>${SIT_NOME[k]}</td><td class="r">${n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma ausência.</p>'}</div>
  <div><h4>Horas extras (dias)</h4><table><tbody><tr><td>A pedido da Dikma</td><td class="r">${he.DIKMA}</td></tr><tr><td>A pedido da ArcelorMittal</td><td class="r">${he.ARCELOR}</td></tr>${he[''] ? `<tr><td>Sem origem informada</td><td class="r">${he['']}</td></tr>` : ''}</tbody></table></div></div>
  ${acoes.length ? `<h4>Ações em andamento</h4><table><thead><tr><th>Causa</th><th>Ação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>${acoes.slice(0, 10).map(a => `<tr><td>${esc(a.causa)}</td><td>${esc(a.acao)}</td><td>${esc(a.resp || '')}</td><td>${a.prazo ? ddmm(a.prazo) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
}

/* ---------------- BANCO DE HORAS EXTRAS ---------------- */
// Dias de hora extra (código HE no Efetivo diário) por pessoa no mês, por origem; horas = dias × horas por dia (ajustável).
const heCfg = () => ({ ciclo: 12, adm: 8, limite: 0, ...((DB.cache.config && DB.cache.config.he) || {}) });
function vEsHe() {
  const area = areaScope(); const cfg = heCfg(); const m = UI.mes;
  const dias = []; for (let d = m + '-01'; d.slice(0, 7) === m; d = add(d, 1)) dias.push(d);
  const linhas = colabsDa(area).map(c => { const x = { c, DIKMA: 0, ARCELOR: 0, '': 0 }; dias.forEach(d => { if (DB.sit(c.id + '|' + d) === 'HE') x[DB.sitInfo(c.id + '|' + d).he || '']++; }); x.dias = x.DIKMA + x.ARCELOR + x['']; const r = escala().regimes[regimeDe(c)]; x.hd = r && r.tipo === 'ciclo' ? cfg.ciclo : cfg.adm; x.horas = x.dias * x.hd; return x; }).filter(x => x.dias).sort((a, b) => b.dias - a.dias || a.c.nome.localeCompare(b.c.nome));
  const tot = k => linhas.reduce((n, x) => n + x[k], 0); const acima = cfg.limite ? linhas.filter(x => x.dias > cfg.limite).length : 0;
  const ed = admMod();
  return `<div class="mini"><div><b class="num">${tot('dias')}</b><span>Dias de hora extra</span></div><div><b class="num">${tot('horas').toLocaleString('pt-BR')}</b><span>Horas (estimadas)</span></div><div><b class="num">${tot('DIKMA')}</b><span>A pedido da Dikma</span></div><div><b class="num">${tot('ARCELOR')}</b><span>A pedido da ArcelorMittal</span></div><div><b class="num">${linhas.length}</b><span>Pessoas</span></div>${cfg.limite ? `<div><b class="num" style="color:${acima ? 'var(--st-nreal)' : 'inherit'}">${acima}</b><span>Acima do limite (${cfg.limite} dias)</span></div>` : ''}</div>
  <div class="card"><header><h2>Por pessoa</h2><p>${monthLabel(m)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · horas = dias × ${cfg.ciclo} h (turno) ou ${cfg.adm} h (administrativo)</p>${!framed && !isMobile() && linhas.length ? `<span class="r"><button class="btn sm" data-act="expHe">${I.dl} Exportar Excel</button></span>` : ''}</header>${linhas.length ? `<div class="tw"><table><thead><tr><th>Colaborador</th><th>Rota</th><th class="r">Dikma</th><th class="r">ArcelorMittal</th><th class="r">Sem origem</th><th class="r">Dias</th><th class="r">Horas</th></tr></thead><tbody>${linhas.map(x => `<tr${cfg.limite && x.dias > cfg.limite ? ' class="acima"' : ''}><td><b>${esc(title(x.c.nome))}</b></td><td class="muted small">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</td><td class="r num">${x.DIKMA || '·'}</td><td class="r num">${x.ARCELOR || '·'}</td><td class="r num">${x[''] || '·'}</td><td class="r num"><b>${x.dias}</b>${cfg.limite && x.dias > cfg.limite ? ' <span class="pill bad">acima</span>' : ''}</td><td class="r num">${x.horas}</td></tr>`).join('')}</tbody></table></div>` : '<div class="body"><div class="empty">Nenhuma hora extra lançada neste mês.</div></div>'}</div>
  <div class="card"><header><h2>Ajustes</h2><p>${ed ? 'Valem para todos' : 'Só o administrador ou o gestor altera'}</p></header><div class="body row-gap"><label class="sel"><span>Horas por dia · turno</span><input class="in numin" type="number" min="1" max="24" data-hecfg="ciclo" value="${cfg.ciclo}" ${ed ? '' : 'disabled'}></label><label class="sel"><span>Horas por dia · administrativo</span><input class="in numin" type="number" min="1" max="24" data-hecfg="adm" value="${cfg.adm}" ${ed ? '' : 'disabled'}></label><label class="sel"><span>Limite de dias no mês (0 = sem limite)</span><input class="in numin" type="number" min="0" max="31" data-hecfg="limite" value="${cfg.limite}" ${ed ? '' : 'disabled'}></label></div></div>`;
}
function exportHe() {
  const area = areaScope(); const cfg = heCfg(); const m = UI.mes; const dias = []; for (let d = m + '-01'; d.slice(0, 7) === m; d = add(d, 1)) dias.push(d);
  const linhas = [['Nome', 'Área', 'Rota', 'Dikma', 'ArcelorMittal', 'Sem origem', 'Dias', 'Horas (estimadas)']];
  colabsDa(area).forEach(c => { const x = { DIKMA: 0, ARCELOR: 0, '': 0 }; dias.forEach(d => { if (DB.sit(c.id + '|' + d) === 'HE') x[DB.sitInfo(c.id + '|' + d).he || '']++; }); const n = x.DIKMA + x.ARCELOR + x['']; if (!n) return; const r = escala().regimes[regimeDe(c)]; linhas.push([title(c.nome), AREA_S[c.area] || c.area, c.rota, x.DIKMA, x.ARCELOR, x[''], n, n * (r && r.tipo === 'ciclo' ? cfg.ciclo : cfg.adm)]); });
  baixarExcel(`horas-extras-${SETS[SK].curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}-${m}`, [{ nome: 'Horas extras ' + m, linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}

/* ---------------- PENDÊNCIAS ---------------- */
function vPend() {
  const area = myArea() || UI.area;
  const at = atrasadasAll(area);
  const byR = new Map();
  for (const x of at) { const p = PL.get(x.doc.ids[x.i]); if (!p) continue; const key = x.doc.area + '|' + p.rota; if (!byR.has(key)) byR.set(key, []); byR.get(key).push(x); }
  const lista = [...byR.entries()].sort((a, b) => b[1].length - a[1].length);
  let h = '';
  if (myAreas().length > 1) h += `<div class="filters">${selMinhaArea('fArea')}</div>`;
  if (!myArea()) h += `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fArea"><option value="TODAS">Todas as áreas</option>${AREAS.map(a => `<option value="${a}" ${a === UI.area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label></div>`;
  h += `<div class="mini"><div><b class="num" style="color:var(--st-atr)">${at.length}</b><span>Atrasadas</span></div><div><b class="num">${lista.length}</b><span>Rotas com atraso</span></div><div><b class="num">${at.filter(x => x.dt >= add(TODAY, -7)).length}</b><span>Últimos 7 dias</span></div><div><b class="num">${at.length ? ddmm(at[0].dt) : '—'}</b><span>Mais antiga</span></div></div><p class="muted small m0">Considera o mês atual e o anterior. Sem apontamento, a atividade conta como atrasada; marque o que foi feito ou justifique o que não foi.</p>`;
  if (!at.length) h += '<div class="card"><div class="empty">Tudo apontado. Nenhuma atividade atrasada.</div></div>';
  h += '<div class="grid2"><div class="stackcol">';
  for (const [key, xs] of lista.slice(0, 12)) {
    const [a, r] = key.split('|'); const ed = canEdit(a);
    h += `<div class="card"><header><h2>${esc(r)}</h2><p>${AREA_S[a]} · ${xs.length} atrasada${xs.length > 1 ? 's' : ''}</p>${ed ? `<span class="r">${UI.confirm === 'rota:' + key ? `<span class="confirm">Marcar todas como feitas? <button class="btn pri" data-act="rotaok" data-k="${esc(key)}">Confirmar</button><button class="btn" data-act="cancel">Cancelar</button></span>` : `<button class="btn" data-act="askRota" data-k="${esc(key)}">✓ Todas feitas</button>`}</span>` : ''}</header><div class="body"><div class="plist">
    ${xs.slice(0, (UI.pendTodas || []).includes(key) ? xs.length : 6).map(x => { const p = PL.get(x.doc.ids[x.i]); return `<div class="pitem"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${DAYS[x.k]} ${ddmm(x.dt)} · ${esc(p.local)}</div></div>${ed ? `<div class="bt"><button class="ok-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|R" aria-label="Realizada">✓</button><button class="no-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|N" aria-label="Não realizada">✕</button></div>` : ''}</div>`; }).join('')}
    ${xs.length > 6 ? `<div class="pitem"><span class="muted">${(UI.pendTodas || []).includes(key) ? `${xs.length} nesta rota` : `+ ${xs.length - 6} nesta rota`}</span><button class="btn" data-act="pendTodas" data-k="${esc(key)}">${(UI.pendTodas || []).includes(key) ? 'Mostrar menos' : 'Ver todas'}</button></div>` : ''}
    </div></div></div>`;
  }
  h += '</div>';
  const mot = {}; for (const d of docsFor({ area })) for (const v of Object.values(d.m)) { const key = MOTIVOS.includes(v) ? v : 'Outras justificativas (escritas)'; mot[key] = (mot[key] || 0) + 1; }
  const mt = Object.entries(mot).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...mt.map(x => x[1]));
  h += `<div class="stackcol"><div class="card"><header><h2>Por que não foi feito</h2><p>Justificativas das não realizadas</p></header><div class="body">${mt.length ? `<div class="bars">${mt.map(([m, n]) => `<div class="barrow mot"><span class="n">${esc(m)}</span><div class="stack clear"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Sem registros.</div>'}</div></div>
</div></div>`;
  return h;
}

/* ---------------- FOLHA DO LÍDER ---------------- */
function vImprimir() {
  const area = myArea() || (UI.area === 'TODAS' ? AREAS[0] : UI.area);
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  if (UI.iRota !== 'TODAS' && !rts.includes(UI.iRota)) UI.iRota = 'TODAS';
  const lid = COLABS.find(c => c.area === area && /^L[IÍ]DER/.test(c.funcao || ''));
  const lider = UI.lider || (lid ? title(lid.nome) : '');
  let h = `<div class="filters noprint">
   ${myAreas().length > 1 ? selMinhaArea('fArea', 'Área da folha') : ''}${!myArea() ? `<label class="sel"><span>Área da folha</span><select class="in" id="fArea">${AREAS.map(a => `<option value="${a}" ${a === area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>` : ''}
   <label class="sel"><span>Rota</span><select class="in" id="fIRota"><option value="TODAS">Todas</option>${rts.map(r => `<option ${r === UI.iRota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Líder</span><input class="in" id="fLider" value="${esc(lider)}"></label>
   ${!framed ? `<button class="btn pri" data-act="print" style="align-self:flex-end">${I.print} Imprimir / salvar PDF</button>` : ''}
   ${!framed && !isMobile() ? `<button class="btn" data-act="csv" style="align-self:flex-end" title="A programação da semana, com o que foi feito">${I.dl} Exportar Excel</button>` : ''}
  </div>`;
  if (!doc) return h + '<div class="card"><div class="empty">Semana não gerada.</div></div>';
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && (UI.iRota === 'TODAS' || x.p.rota === UI.iRota) && doc.d[x.i] !== '_______');
  // Uma folha por rota (página própria): o líder preenche a da rota dele, com o próprio cabeçalho e assinaturas.
  const porRota = new Map(); items.forEach(x => { if (!porRota.has(x.p.rota)) porRota.set(x.p.rota, []); porRota.get(x.p.rota).push(x); });
  if (porRota.size > 1) h += `<p class="muted small noprint">${porRota.size} rotas · cada rota sai numa folha separada.</p>`;
  h += '<div class="tw folhas">' + [...porRota.entries()].map(([rota, its]) => `<div class="paper folha"><div class="hd"><div><h3>PROGRAMAÇÃO SEMANAL DE ATIVIDADES</h3><div class="meta"><span><b>Área:</b> ${AREA_S[area]}</span><span><b>Mês:</b> ${monthLabel(doc.mes)}</span><span><b>Semana:</b> ${weekLabel(doc.ini)}</span><span><b>Rota:</b> ${esc(rota)}</span></div><div class="meta"><span class="liderTxt"><b>Líder responsável:</b> ${esc(lider || '_______________________')}</span><span>☐ programado — marque ✓ feito ou ✕ não feito · — sem programação</span></div></div><div class="rt small"><img class="plogo" src="img/dikma-logo.png" alt="Dikma"><br>${esc(SETS[SK].local)}</div></div>
  <table><thead><tr><th>Nº</th><th>Local / equipamento</th><th>Atividade</th>${DAYS.map((d, k) => `<th class="c">${d}<br>${ddmm(add(doc.ini, k))}</th>`).join('')}<th style="width:120px">Observação</th></tr></thead><tbody>
  ${its.map(({ i, p }, j) => `<tr><td class="c">${j + 1}</td><td>${esc(p.local)}</td><td>${esc(p.ativ)}</td>${DAYS.map((_, k) => `<td class="c">${doc.d[i][k] === '_' ? '—' : '<span class="box"></span>'}</td>`).join('')}<td class="obs">${DAYS.map((d, k) => (doc.d[i][k] === 'N' && doc.m[p.id + '|' + k] ? `${d}: ${esc(doc.m[p.id + '|' + k])}` : '')).filter(Boolean).join('; ')}</td></tr>`).join('')}
  </tbody></table><div class="sign"><div>Líder</div><div>Supervisor</div></div></div>`).join('') + '</div>';
  return h;
}

/* ---------------- PLANO PADRÃO ---------------- */
function vPlano() {
  const a = UI.pArea;
  const ps = (DB.cache.plano[a] || []).filter(p => p.ativo !== false);
  const rts = rotasDa(a).filter(r => r.rota !== 'GESTÃO').map(r => r.rota);
  return `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fPArea">${AREAS.map(x => `<option value="${x}" ${x === a ? 'selected' : ''}>${AREA_S[x]}</option>`).join('')}</select></label><span class="muted" style="align-self:flex-end">${ps.length} atividades · rota, local, atividade e tipo mudam na hora (inclusive nos meses já gerados); os dias valem para os meses gerados depois</span></div>
  <div class="card"><header><h2>Nova atividade</h2></header><div class="body"><form id="fNova" class="form">
   <label class="sel"><span>Rota</span><select class="in" id="nRota">${rts.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel wide"><span>Local / equipamento</span><input class="in" id="nLocal" required placeholder="Ex.: CORREIA C5613A"></label>
   <label class="sel wide"><span>Atividade</span><input class="in" id="nAtiv" required placeholder="Ex.: Mesa impacto - Lavagem"></label>
   <label class="sel"><span>Tipo</span><select class="in" id="nTipo">${tipos().map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
   <div class="sel"><span>Dias</span><div class="row-gap tight diastog">${DL.map((d, k) => `<button type="button" class="tog lbl-on" data-ntog="${k}" aria-pressed="${k < 5}" aria-label="${DAYS[k]}">${d}</button>`).join('')}</div></div>
   <button class="btn pri" type="submit">${I.plus} Adicionar</button>
  </form></div></div>
  <div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Rota</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map(d => `<th class="c">${d}</th>`).join('')}<th class="r">Freq.</th><th></th></tr></thead><tbody>
  ${ps.map(p => `<tr><td class="mono muted">${p.id}</td><td><select class="in pin" data-prota="${p.id}" aria-label="Rota de ${p.id}">${[...new Set([p.rota, ...rts])].map(r => `<option ${r === p.rota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></td><td><input class="in pin" data-pcampo="${p.id}|local" value="${esc(p.local)}" maxlength="120" aria-label="Local de ${p.id}" title="${esc(p.local)}"></td><td><input class="in pin" data-pcampo="${p.id}|ativ" value="${esc(p.ativ)}" maxlength="120" aria-label="Atividade ${p.id}"></td><td><select class="in pin" data-pcampo="${p.id}|tipo" aria-label="Tipo de ${p.id}">${[...new Set([p.tipo, ...tipos()])].map(t => `<option ${t === p.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>${[...p.dias].map((c, k) => `<td class="c"><button class="tog" data-ptog="${p.id}|${k}" aria-pressed="${c === '1'}" aria-label="${DAYS[k]}">✓</button></td>`).join('')}<td class="r num">${[...p.dias].filter(c => c === '1').length}</td><td>${UI.confirm === 'del:' + p.id ? `<span class="confirm"><button class="btn danger" data-act="del" data-id="${p.id}">Excluir</button><button class="btn" data-act="cancel">Não</button></span>` : `<button class="btn ghost danger" data-act="askDel" data-id="${p.id}" aria-label="Excluir ${p.id}">✕</button>`}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}

/* ---------------- GERADOR ---------------- */
function vGerador() {
  const ms = meses(); const last = ms[ms.length - 1] || CUR_MONTH;
  const opts = []; for (let i = 1; i <= 14; i++) opts.push(addMonth(last, i));
  if (!UI.gMes || ms.includes(UI.gMes)) UI.gMes = opts[0];
  const ws = weeksOfMonth(UI.gMes);
  const per = AREAS.map(a => ({ a, n: (DB.cache.plano[a] || []).filter(p => p.ativo !== false).length }));
  return `<div class="grid2"><div class="card"><header><h2>Gerar novo mês</h2><p>Cada semana (seg–dom) entra no mês da sua quinta-feira</p></header><div class="body stackcol">
   <label class="sel"><span>Mês</span><select class="in" id="gMes">${opts.map(o => `<option value="${o}" ${o === UI.gMes ? 'selected' : ''}>${monthLabel(o)}</option>`).join('')}</select></label>
   <div class="tw"><table><thead><tr><th>Semana</th>${per.map(x => `<th class="r">${AREA_S[x.a]}</th>`).join('')}</tr></thead><tbody>${ws.map((w, i) => `<tr><td>S${i + 1} · ${ddmm(w)} a ${ddmm(add(w, 6))}</td>${per.map(x => `<td class="r num">${x.n}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="row-gap"><button class="btn pri" data-act="gerar" ${UI.busy ? 'disabled' : ''}>${I.gerador} ${UI.busy ? 'Gerando…' : 'Gerar ' + monthLabel(UI.gMes)}</button><span class="muted num">${ws.length} semanas × ${per.reduce((n, x) => n + x.n, 0)} atividades</span></div>
  </div></div>
  <div class="card"><header><h2>Meses gerados</h2></header><div class="body"><div class="plist">${ms.map(m => `<div class="pitem"><div><div class="t">${monthLabel(m)}</div><div class="l num">${weeksOfMonth(m).length} semanas</div></div>${m === CUR_MONTH ? '<span class="pill ok">atual</span>' : m > CUR_MONTH ? '<span class="pill neu">futuro</span>' : '<span class="pill neu">anterior</span>'}</div>`).join('')}</div></div></div></div>`;
}

/* ---------------- USUÁRIOS ---------------- */
function vUsuarios() {
  const us = DB.cache.usuarios.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const ativos = us.filter(u => u.papel !== 'bloqueado').length;
  const areaSel = (id, v, dis) => `<select class="in" ${id} ${dis ? 'disabled' : ''}><option value="">—</option>${Object.values(SETS).map(st => `<optgroup label="${st.nome}">${st.areas.map(a => `<option value="${a}" ${v === a ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</optgroup>`).join('')}</select>`;
  return `<div class="mini"><div><b class="num">${ativos}</b><span>Ativos</span></div><div><b class="num">${us.length - ativos}</b><span>Bloqueados</span></div></div>
  <div class="card"><header><h2>Novo usuário</h2><p>A pessoa entra com o usuário e a senha provisória e cria a própria senha no primeiro acesso.</p></header><div class="body"><form id="fNovoUser" class="uform" novalidate>
   <div class="ur r1"><label class="sel"><span>Nome</span><input class="in" id="nuNome" required placeholder="Ex.: Maria Aparecida Souza"></label>
   <label class="sel"><span>Usuário</span><input class="in" id="nuLogin" required autocapitalize="none" spellcheck="false" placeholder="ex.: maria.souza"></label>
   <label class="sel"><span>Senha provisória</span><input class="in" id="nuSenha" required minlength="8" value="${esc(UI.senhaSug || (UI.senhaSug = senhaAleatoria()))}"></label></div>
   <div class="ur r2"><label class="sel"><span>Perfil</span><select class="in" id="nuPapel">${PAPEIS.filter(p => p[0] !== 'bloqueado').map(([v, n]) => `<option value="${v}" ${v === 'lider' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <label class="sel"><span>Área (líder e supervisor)</span>${areaSel('id="nuArea"', '', false)}</label>
   <label class="sel"><span>2ª área (só supervisor)</span>${areaSel('id="nuArea2"', '', true)}</label></div>
   <div class="ur r3"><div class="sel"><span>Módulos</span><div class="mchips">${MODS_MARCAVEIS.map(m => `<label class="mchip"><input type="checkbox" id="nuM_${m}" ${m === 'operacao' ? 'checked' : ''}><span>${MODS[m].nome}</span></label>`).join('')}</div></div>
   <button class="btn pri" type="submit" ${UI.busy ? 'disabled' : ''}>${I.plus} ${UI.busy ? 'Cadastrando…' : 'Cadastrar usuário'}</button></div>
   <p class="err m0" id="nuErr" role="alert" hidden></p>
  </form></div></div>
  <div class="card"><header><h2>Acessos</h2><p><b>Gestor:</b> todas as áreas e a administração dos módulos marcados (menos usuários). <b>Coordenador:</b> aponta em todas as áreas dos módulos marcados. <b>Supervisor:</b> até 2 áreas. <b>Líder:</b> 1 área. <b>Administrativo:</b> Frequência e férias e as fichas do Efetivo (ocorrências, assinaturas e impressão); vê as Atividades sem apontar. <b>Somente leitura</b> vê tudo e não altera nada. <b>Bloqueado</b> não entra. Cada pessoa vê só os <b>módulos</b> marcados (Frequência e férias inclusive); a Administração do sistema é só do administrador. O que cada perfil vê dentro dos módulos fica em <b>Perfis e permissões</b>.</p></header><div class="tw"><table><thead><tr><th>Pessoa</th><th>Usuário</th><th>Perfil</th><th>Área</th><th>Módulos</th><th>Abas</th><th></th></tr></thead><tbody>
  ${us.map(u => `<tr><td><b>${esc(title(u.nome))}</b>${u.trocarSenha ? '<div class="small" style="color:var(--st-atr)">Ainda não criou a própria senha</div>' : ''}</td><td class="mono">${u.login ? esc(u.login) : '<span class="muted">conta Google</span>'}</td><td><select class="in" data-upapel="${u.uid}" aria-label="Perfil de ${esc(u.nome)}">${PAPEIS.map(([v, n]) => `<option value="${v}" ${u.papel === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td><td><div class="areas2">${areaSel(`data-uarea="${u.uid}" aria-label="Área de ${esc(u.nome)}"`, u.area, !['lider', 'supervisor'].includes(u.papel))}${u.papel === 'supervisor' ? areaSel(`data-uarea2="${u.uid}" aria-label="Segunda área de ${esc(u.nome)}"`, u.area2, false).replace('<option value="">—</option>', '<option value="">+ 2ª área</option>') : ''}</div></td><td>${u.papel === 'admin' ? '<span class="muted small">Todos os módulos</span>' : `<div class="mchips">${MODS_MARCAVEIS.map(m => `<label class="mchip"><input type="checkbox" data-umod="${u.uid}|${m}" ${modsReais(u).includes(m) ? 'checked' : ''}><span>${MODS[m].curto}</span></label>`).join('')}</div>`}</td><td>${celulaAbas(u)}</td><td class="uacts">${u.uid !== ME.uid ? `${u.login ? `<button class="btn sm" data-reset="${u.uid}" title="Redefinir senha">${I.key} Senha</button>` : ''}<button class="btn sm ghost danger" data-udel="${u.uid}" aria-label="Apagar o usuário ${esc(u.login || u.nome)}">Apagar</button>` : '<span class="pill neu">você</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
// Abas que a pessoa pode ter, conforme os módulos dela (Pátio e Bateria contam como um grupo só).
const KEY_MOD = { operacao: 'op', bateria: 'op', config: 'cf', equipamentos: 'eq', gestao: 'ge', frequencia: 'ad' };
const viewsDaPessoa = u => { const ks = new Set(['all', ...modsDe(u).map(m => KEY_MOD[m])]); return VIEWS.filter(v => ks.has(v.mod) && configuravel(u.papel, v) && (!v.reqU || v.reqU(u))); };
function celulaAbas(u) {
  if (u.papel === 'admin') return '<span class="muted small">Todas</span>';
  if (u.papel === 'bloqueado') return '<span class="muted small">—</span>';
  const r = resumoExcecao(u, viewsDaPessoa(u), permCfg());
  const txt = [r.menos ? `${r.menos} a menos` : '', r.mais ? `${r.mais} a mais` : ''].filter(Boolean).join(' · ');
  return `<div class="row-gap nowrap">${r.tem ? `<span class="pill exc" title="Esta pessoa tem abas diferentes do perfil">Personalizado · ${txt}</span>` : '<span class="pill neu">Padrão do perfil</span>'}<button class="btn sm" data-uabas="${u.uid}">${r.tem ? 'Editar' : 'Personalizar'}</button></div>`;
}
function abasPessoaSheet(uid) {
  const u = DB.cache.usuarios.find(x => x.uid === uid); if (!u) return;
  const cfg = permCfg(); const vs = viewsDaPessoa(u);
  const grupos = GRUPOS_ABAS.map(g => [g, vs.filter(v => v.mod === g.mod)]).filter(([, l]) => l.length);
  const html = `<div class="abas-p">${grupos.map(([g, l]) => `<div class="abas-g"><b>${esc(g.t)}</b>${l.map(v => { const base = doPerfil(u.papel, v, cfg); const on = podeVer(u, v, cfg); return `<label class="tgl-row"><span>${esc(v.nome)}${on !== base ? ' <small class="exc-t">exceção</small>' : ''}</span><input type="checkbox" class="tgl" data-pabas="${v.id}" ${on ? 'checked' : ''} aria-label="${esc(v.nome)}"></label>`; }).join('')}</div>`).join('')}</div>
    <label class="switch"><input type="checkbox" id="paReset"><span>Voltar ao padrão do perfil (${esc(papelNome(u.papel))})</span></label>`;
  formSheet('Abas de ' + title(u.nome), `${papelNome(u.papel)} · o que for diferente do perfil fica como exceção só desta pessoa`, html, 'Salvar', async () => {
    let abas = null;
    if (!$('paReset').checked) {
      abas = {};
      document.querySelectorAll('[data-pabas]').forEach(i => { const v = VIEWS.find(x => x.id === i.dataset.pabas); if (i.checked !== doPerfil(u.papel, v, cfg)) abas[v.id] = i.checked; });
      if (!Object.keys(abas).length) abas = null;
    }
    await DB.setUsuario(uid, { abas });
    DB.log(`Ajustou as abas de ${u.nome}${abas ? '' : ' (padrão do perfil)'}`);
    toast(abas ? 'Abas personalizadas salvas' : 'Voltou ao padrão do perfil');
  });
}

/* ---------------- PERFIS E PERMISSÕES ---------------- */
// Rascunho em UI.perm até salvar; Pátio e Bateria dividem a mesma configuração.
function rascunhoPerm() {
  if (!UI.perm) { const c = permCfg(); UI.perm = Object.fromEntries(PERFIS_ABAS.map(([p]) => [p, { ...(c[p] || {}) }])); }
  return UI.perm;
}
function vPerfis() {
  const R = rascunhoPerm(); const cfg = permCfg();
  const mudou = PERFIS_ABAS.some(([p]) => VIEWS.some(v => configuravel(p, v) && doPerfil(p, v, R) !== doPerfil(p, v, cfg)));
  const us = DB.cache.usuarios.filter(u => !['admin', 'bloqueado'].includes(u.papel));
  const comExc = us.filter(u => resumoExcecao(u, viewsDaPessoa(u), cfg).tem);
  const linhas = GRUPOS_ABAS.map(g => {
    const vs = VIEWS.filter(v => v.mod === g.mod && !['usuarios', 'perfis'].includes(v.id));
    return `<tr class="grp-row"><th colspan="${PERFIS_ABAS.length + 2}">${esc(g.t)}</th></tr>` + vs.map(v => `<tr><td><b>${esc(v.nome)}</b>${v.admin ? ' <span class="tag-adm">Administração</span>' : ''}</td><td class="c muted" aria-label="Administrador sempre vê">✓</td>${PERFIS_ABAS.map(([p, n]) => { const ok = configuravel(p, v); const on = doPerfil(p, v, R); return `<td class="c"><input type="checkbox" class="tgl" data-perm="${p}|${v.id}" ${on ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="${esc(v.nome)} para ${n}"></td>`; }).join('')}</tr>`).join('');
  }).join('');
  return `<div class="card"><header><h2>Abas por perfil</h2><p>Desligado = a aba some do menu para esse perfil e não abre nem por link. O administrador vê tudo sempre. Pátio e Bateria usam a mesma configuração.</p></header>
  <div class="tw"><table class="perm"><thead><tr><th>Aba</th><th class="c">Admin<br><small>sempre tudo</small></th>${PERFIS_ABAS.map(([, n]) => `<th class="c">${n}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>
  <div class="body row-gap"><button class="btn pri" data-act="permSalvar" ${mudou ? '' : 'disabled'}>${mudou ? 'Salvar permissões' : 'Tudo salvo'}</button><button class="btn" data-act="permPadrao">Voltar ao padrão</button>${mudou ? '<button class="btn ghost" data-act="permDesfazer">Desfazer</button>' : ''}<span class="muted small">Abas de administração só podem ser ligadas para o Gestor. O que cada perfil pode alterar continua valendo pelo perfil.</span></div></div>
  <div class="card"><header><h2>Exceção por pessoa</h2><p>Opcional. Abra <b>Usuários e acessos</b> e use <b>Personalizar</b> na coluna Abas para dar ou tirar abas de uma pessoa sem mudar o perfil inteiro.</p></header>
  ${comExc.length ? `<div class="tw"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Módulos</th><th>Abas</th></tr></thead><tbody>${comExc.map(u => `<tr><td><b>${esc(title(u.nome))}</b></td><td>${papelNome(u.papel)}</td><td>${modsReais(u).map(m => MODS[m].curto).join(' · ')}</td><td>${celulaAbas(u)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="body"><p class="muted m0">Ninguém com exceção. Todos seguem o padrão do perfil.</p></div>'}</div>`;
}

// Senha: no mínimo 8 caracteres, sem sequência óbvia e sem o próprio usuário ou nome. Devolve o problema ou ''.
const SENHAS_OBVIAS = ['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'senha123', 'senha1234', 'password', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234', 'dikma123', 'dikma1234', 'coqueria', 'arcelor1', 'mudar123', 'trocar123'];
function problemaSenha(n, u = ME) {
  const s = String(n || '');
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  const b = semAcento(s).toLowerCase();
  if (/^(.)\1+$/.test(b) || SENHAS_OBVIAS.includes(b) || '0123456789012345678901234567890'.includes(b) || 'abcdefghijklmnopqrstuvwxyz'.includes(b)) return 'Essa senha é fácil de adivinhar. Misture letras e números.';
  const pessoais = [u && u.login, ...String((u && u.nome) || '').split(/\s+/)].map(x => semAcento(String(x || '')).toLowerCase()).filter(x => x.length >= 4);
  if (pessoais.some(x => b.includes(x))) return 'A senha não pode conter o seu usuário ou o seu nome.';
  return '';
}
function senhaAleatoria() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(10)); for (const n of r) s += c[n % c.length]; return s; }

/* ---------------- CONFIG ---------------- */
function vConfig() {
  return `<div class="card"><header><h2>Rotas</h2><p>Efetivo padrão (quadro previsto) e carga padrão (pico diário de atividades)</p></header><div class="tw"><table><thead><tr><th>Área</th><th>Rota</th><th class="r">Efetivo padrão</th><th class="r">Carga padrão</th><th class="r">Colaboradores</th></tr></thead><tbody>
  ${rotas().map((r, i) => `<tr><td class="muted">${AREA_S[r.area]}</td><td><input class="in pin" data-rnome="${i}" value="${esc(r.rota)}" maxlength="60" aria-label="Nome da rota ${esc(r.rota)}" title="Mudar o nome troca também no plano padrão e nos colaboradores da rota"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|ef" value="${r.ef}" aria-label="Efetivo padrão ${esc(r.rota)}"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|carga" value="${r.carga}" aria-label="Carga padrão ${esc(r.rota)}"></td><td class="r num">${COLABS.filter(c => c.area === r.area && c.rota === r.rota).length}</td></tr>`).join('')}
  </tbody></table></div></div>

  <div class="card"><header><h2>Tipos de atividade</h2></header><div class="body"><div class="rchips">${tipos().map(t => `<span class="rchip">${esc(t)}</span>`).join('')}</div></div></div>`;
}

/* ---------------- IMPORTAR (primeiro acesso) ---------------- */
function vImportar() {
  if (!admMod()) return '<div class="card"><div class="empty">O administrador ainda não importou os dados da planilha.</div></div>';
  const ws = []; for (const m of [CUR_MONTH]) for (const w of weeksOfMonth(m)) ws.push(w);
  return `<div class="card"><header><h2>Importar dados da planilha · ${esc(SETS[SK].nome)}</h2><p>Plano padrão, rotas, colaboradores e as situações já lançadas no efetivo diário da planilha ${SK === 'bateria' ? 'PLANEJAMENTO DE ATIVIDADES BATERIA (Bateria 1, Bateria 2, Trilho e CDQ)' : 'do Pátio de Carvão'}</p></header><div class="body stackcol">
   <label class="sel"><span>Começar a programação na semana</span><select class="in" id="impIni">${ws.map(w => `<option value="${w}" ${w === UI.impIni ? 'selected' : ''}>${weekLabel(w)}${w === CUR_WEEK ? ' · atual' : ''}</option>`).join('')}</select></label>
   <p class="muted m0">Gera ${monthLabel(CUR_MONTH)} a partir dessa semana e os dois meses seguintes. Semanas anteriores não são criadas, para não aparecerem como atrasadas.</p>
   <button class="btn pri" data-act="importar" ${UI.busy ? 'disabled' : ''} style="align-self:flex-start">${UI.busy ? 'Importando…' : 'Importar e gerar a programação'}</button>
  </div></div>`;
}

/* ---------------- interação ---------------- */
// opts: [{ t, d, ic, cur, larga }] · cfg.grade: as opções curtas viram uma grade (situações do dia), as largas ficam embaixo
function sheet(titleTxt, sub, opts, onPick, cfg = {}) {
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet${cfg.grade ? ' comgrade' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titleTxt)}"><h3>${esc(titleTxt)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="opts${cfg.grade ? ' grade' : ''}">${opts.map((o, i) => `<button class="opt${o.larga ? ' larga' : ''}" data-o="${i}" ${o.cur ? 'aria-current="true"' : ''}>${o.ic || ''}<span>${esc(o.t)}${o.d ? `<br><small class="muted">${esc(o.d)}</small>` : ''}</span></button>`).join('')}</div><button class="btn center" data-o="x">Cancelar</button></div></div>`;
  const kd = e => { if (e.key === 'Escape') close(); };
  const close = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim') return close(); const b = e.target.closest('[data-o]'); if (!b) return; const v = b.dataset.o; close(); if (v !== 'x') onPick(opts[+v]); };
  L.querySelector('[data-o]').focus();
}
function formSheet(titleTxt, sub, fieldsHtml, submitTxt, onSubmit) {
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><form class="sheet" id="fSheet" role="dialog" aria-modal="true" aria-label="${esc(titleTxt)}" novalidate><h3>${esc(titleTxt)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${fieldsHtml}<p class="err" id="shErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri" type="submit">${esc(submitTxt)}</button><button class="btn" type="button" data-close>Cancelar</button></div></form></div>`;
  const kd = e => { if (e.key === 'Escape') close(); };
  const close = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim' || e.target.closest('[data-close]')) close(); const eye = e.target.closest('[data-eye]'); if (eye) toggleEye(eye); };
  $('fSheet').onsubmit = async e => { e.preventDefault(); const b = e.submitter || e.target.querySelector('[type=submit]'); b.disabled = true; try { await onSubmit(); close(); } catch (err) { showErr('shErr', err); b.disabled = false; } };
  const f = L.querySelector('input'); if (f) f.focus();
}
function showErr(id, err) { const el = $(id); if (!el) return toast(msgErro(err)); el.textContent = msgErro(err); el.hidden = false; }
const msgErro = err => (DB.erroAuth ? DB.erroAuth(err) : (err && err.message) || String(err));
function toggleEye(b) { const i = $(b.dataset.eye); if (!i) return; i.type = i.type === 'password' ? 'text' : 'password'; b.setAttribute('aria-label', i.type === 'password' ? 'Mostrar senha' : 'Ocultar senha'); }
/* ---------------- FOTO (via em papel das fichas do Efetivo) ---------------- */
function carregarImg(file) { return new Promise((ok, ko) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => ko(new Error('Não foi possível abrir esta imagem.')); im.src = u; }); }
// Reduz a foto (máx. 1600 px) e grava um carimbo com data, hora, atividade e usuário.
async function prepararFoto(file, carimbo) {
  const im = await carregarImg(file);
  const sc = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  const bar = Math.max(26, Math.round(Math.min(w, h) * 0.05));
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, h - bar, w, bar);
  g.fillStyle = '#fff'; g.font = `600 ${Math.round(bar * 0.48)}px system-ui,sans-serif`; g.textBaseline = 'middle';
  let txt = carimbo; while (g.measureText(txt).width > w - bar * 0.6 && txt.length > 10) txt = txt.slice(0, -2);
  if (txt !== carimbo) txt = txt.slice(0, -1) + '…';
  g.fillText(txt, bar * 0.3, h - bar / 2);
  let q = 0.75, dados = cv.toDataURL('image/jpeg', q);
  while (dados.length > 880000 && q > 0.3) { q -= 0.1; dados = cv.toDataURL('image/jpeg', q); }
  const ts = 240 / Math.max(w, h), tc = document.createElement('canvas'); tc.width = Math.round(w * ts); tc.height = Math.round(h * ts);
  tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
  return { dados, thumb: tc.toDataURL('image/jpeg', 0.6), tipo: 'image/jpeg', tamanho: Math.round(dados.length * 0.75) };
}
function trocarModulo(m) { if (!modsDe(ME).includes(m)) return; if (m === 'gestao' && (UI.modulo === 'operacao' || UI.modulo === 'bateria')) { UI.esSet = SK; UI.eRota = '*'; } UI.modulo = m; UI.view = MODS[m].inicio; UI.confirm = null; salvarUI(); render(); scrollTo(0, 0); }
function alterarSenhaSheet() {
  formSheet('Alterar minha senha', esc(ME.login || ''), senhaField('asAtual', 'Senha atual', 'current-password') + senhaField('asNova', 'Nova senha (mínimo 8 caracteres, sem o seu nome)', 'new-password') + senhaField('asNova2', 'Repita a nova senha', 'new-password'), 'Salvar', async () => {
    const a = $('asAtual').value, n = $('asNova').value, n2 = $('asNova2').value;
    { const p = problemaSenha(n); if (p) throw new Error(p); }
    if (n !== n2) throw new Error('As duas senhas novas não são iguais.');
    await DB.alterarSenha(a, n); toast('Senha alterada');
  });
}
// Aviso rápido no rodapé. Com { desfazer }, mostra o botão Desfazer por alguns segundos.
function toast(t, o = {}) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const erro = /^(erro|sem permissão|não |seu perfil não)/i.test(t);
  el.innerHTML = `<span class="ti ${erro ? 'bad' : 'ok'}" aria-hidden="true">${erro ? '!' : '✓'}</span><span></span>${o.desfazer ? '<button type="button" class="tbtn">Desfazer</button>' : ''}`; el.children[1].textContent = t;
  const dur = o.desfazer ? 6000 : 2600;
  if (o.desfazer) el.querySelector('.tbtn').onclick = () => { el.remove(); o.desfazer(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('sai'), dur); setTimeout(() => el.remove(), dur + 300);
}
const chipIc = c => `<span class="chip ${c}">${CHIP[c]}</span>`;
function cellMenu(doc, i, k) {
  if (!canEdit(doc.area)) { toast('Seu perfil não pode apontar nesta área'); return; }
  const p = PL.get(doc.ids[i]); const raw = doc.d[i][k]; const c = st(doc, i, k);
  const sub = `${esc(p.rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}<br>${esc(p.local)}`;
  const o = (raw === '_' || raw === 'E')
    ? [{ t: 'Registrar como extra', d: 'Feita fora da programação', v: 'E', ic: chipIc('E'), cur: raw === 'E' }, { t: 'Não programada', v: '_', ic: chipIc('X'), cur: raw === '_' }]
    : [{ t: 'Realizado', v: 'R', ic: chipIc('R'), cur: raw === 'R' }, { t: 'Não realizado', d: 'Pede a justificativa', v: 'N', ic: chipIc('N'), cur: raw === 'N' }, { t: 'Programado', d: c === 'A' ? 'Continua atrasado' : 'Sem apontamento', v: 'P', ic: chipIc(c === 'A' ? 'A' : 'P'), cur: raw === 'P' }];
  sheet(p.ativ, sub, o, x => apply(doc, i, k, x.v));
}
// Justificativa de por que a atividade não foi feita: um motivo da lista ou escrito pela pessoa (obrigatória).
function pedirJustificativa(doc, i, k, ok) {
  const p = PL.get(doc.ids[i]); const atual = doc.m[p.id + '|' + k] || '';
  const sub = `${esc(p.ativ)} · ${esc(p.rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}${atual ? `<br>Agora: <b>${esc(atual)}</b>` : ''}`;
  sheet('Por que não foi feita?', sub, [...MOTIVOS.map(t => ({ t, cur: t === atual })), { t: 'Escrever a justificativa…', d: 'Explique com as suas palavras', outro: true, larga: true, cur: !!atual && !MOTIVOS.includes(atual) }], o => {
    if (!o.outro) return ok(o.t);
    formSheet('Justificativa', esc(p.ativ), `<label class="sel"><span>Por que não foi feita</span><textarea class="in" id="jsTxt" rows="6" maxlength="500" placeholder="Ex.: caminhão de vácuo quebrado desde as 8h">${MOTIVOS.includes(atual) ? '' : esc(atual)}</textarea></label><p class="muted small m0"><span id="jsCont">0</span> de 500 caracteres. O supervisor vê na Aprovação.</p>`, 'Salvar', async () => {
      const t = ($('jsTxt').value || '').replace(/\s+/g, ' ').trim(); if (t.length < 5) throw new Error('Escreva a justificativa (pelo menos 5 letras).');
      ok(t);
    });
    { const t = $('jsTxt'), n = $('jsCont'); if (t && n) { const f = () => { n.textContent = t.value.length; }; t.addEventListener('input', f); f(); } }
  }, { grade: false });
}
function apply(doc, i, k, v, motivo) {
  if (v === 'N' && !motivo) return pedirJustificativa(doc, i, k, m => apply(doc, i, k, 'N', m));
  setSt(doc, i, k, v, motivo);
  toast({ R: 'Marcada como realizada', N: 'Marcada como não realizada', P: 'Apontamento desfeito', E: 'Extra registrada', _: 'Extra removida' }[v]);
  render();
}
// Efetivo diário da semana (área escolhida no topo, todas as rotas) para o Excel: o mesmo código que aparece na tela.
function exportEsdia() {
  const area = areaScope(); const dias = DAYS.map((_, k) => add(UI.ini, k));
  const ordem = new Map(rotasDa(area).map((r, i) => [r.area + '|' + r.rota, i]));
  const cs = colabsDa(area).slice().sort((x, y) => (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999) || x.nome.localeCompare(y.nome));
  const linhas = [['Nome', 'Função', 'Área', 'Rota', 'Regime', 'Turma', ...dias.map((d, k) => `${DAYS[k]} ${dataBR(d).slice(0, 5)}`), 'Ausências na semana']];
  for (const c of cs) { const v = dias.map(d => sitDia(c, d).v); linhas.push([title(c.nome), c.funcao || '', AREA_S[c.area] || c.area, c.rota, regimeNome(c), turmaDe(c) || '', ...v, v.filter(x => AUSENCIA.has(x)).length]); }
  const leg = [['Código', 'Significado'], ...SITS];
  baixarExcel(`efetivo-${SETS[SK].curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}-${UI.ini}`, [{ nome: 'Efetivo ' + dataBR(UI.ini).slice(0, 5).replace('/', '-'), linhas }, { nome: 'Legenda', linhas: leg }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
function exportCSV() {
  const area = areaScope(); const rows = [['ÁREA', 'SEMANA', 'ID', 'ROTA', 'LOCAL', 'ATIVIDADE', 'TIPO', ...DAYS, 'JUSTIFICATIVAS']];
  for (const d of docsFor({ ini: UI.ini, area })) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p) return; rows.push([d.area, weekLabel(d.ini), id, p.rota, p.local, p.ativ, p.tipo, ...[...d.d[i]].map(c => ({ P: 'PROGRAMADO', R: 'REALIZADO', N: 'NÃO REALIZADO', E: 'EXTRA', _: '' }[c])), Object.entries(d.m).filter(([k]) => k.startsWith(id + '|')).map(([k, v]) => DAYS[k.split('|')[1]] + ': ' + v).join('; ')]); });
  baixarExcel(`programacao-${SETS[SK].curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}-${UI.ini}`, [{ nome: 'Programação ' + dataBR(UI.ini).slice(0, 5).replace('/', '-'), linhas: rows }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}

// Cabeçalho mais baixo ao rolar (celular) e altura do cabeçalho para o que fica preso logo abaixo dele.
addEventListener('scroll', () => { const r = scrollY > 40; if (document.body.classList.contains('rolou') !== r) { document.body.classList.toggle('rolou', r); medirTopo(); } }, { passive: true });
// Mede o cabeçalho sem forçar o navegador a recalcular a página a cada desenho (era o passo mais lento de cada toque).
let topoRO = null;
function medirTopo() {
  const t = document.querySelector('.top'); if (!t) return;
  const pos = h => document.documentElement.style.setProperty('--topo', Math.round(h) + 'px');
  if (!('ResizeObserver' in window)) return pos(t.offsetHeight);
  if (topoRO && topoRO._t === t) return;
  if (topoRO) topoRO.disconnect();
  topoRO = new ResizeObserver(es => { const b = es[0].borderBoxSize && es[0].borderBoxSize[0]; pos(b ? b.blockSize : t.offsetHeight); });
  topoRO._t = t; topoRO.observe(t);
}
function afterRender() {
  medirTopo();
  const on = (id, ev, fn) => { const e = $(id); if (e && !e['_on_' + ev]) { e['_on_' + ev] = 1; e.addEventListener(ev, fn); } };
  on('fMes', 'change', e => mudarFiltro('fMes', e.target.value));
  on('fSem', 'change', e => mudarFiltro('fSem', e.target.value));
  on('fArea', 'change', e => mudarFiltro('fArea', e.target.value));
  on('fRota', 'change', e => { UI.rota = e.target.value; UI.more = 0; render(); });
  on('fTipo', 'change', e => { UI.tipo = e.target.value; render(); });
  on('fPend', 'change', e => { UI.soPend = e.target.checked; render(); });
  on('fQ', 'input', e => { UI.q = e.target.value; clearTimeout(window._qt); window._qt = setTimeout(schedule, 250); });
  on('escQ', 'input', e => { UI.escQ = e.target.value; filtrarLista($('escLista'), e.target.value); });
  on('fEQ', 'input', e => { UI.eQ = e.target.value; clearTimeout(window._eqt); window._eqt = setTimeout(schedule, 180); });
  on('fERota', 'change', e => { UI.eRota = e.target.value; render(); });
  on('fEAgr', 'change', e => { UI.eAgr = e.target.value; UI.efAbertas = []; render(); });
  on('fIRota', 'change', e => { UI.iRota = e.target.value; render(); });
  on('fLider', 'input', e => { UI.lider = e.target.value; document.querySelectorAll('.liderTxt').forEach(t => { t.innerHTML = '<b>Líder responsável:</b> ' + esc(UI.lider); }); });
  on('fPArea', 'change', e => { UI.pArea = e.target.value; render(); });
  on('gMes', 'change', e => { UI.gMes = e.target.value; render(); });
  on('impIni', 'change', e => { UI.impIni = e.target.value; });
  on('fNova', 'submit', e => {
    e.preventDefault();
    const a = UI.pArea; const itens = (DB.cache.plano[a] || []).slice();
    const pre = ((itens[0] && itens[0].id) || 'NOV-0').split('-')[0];
    const max = Math.max(0, ...itens.filter(p => p.id.startsWith(pre + '-')).map(p => +p.id.split('-')[1] || 0));
    const dias = [...document.querySelectorAll('[data-ntog]')].map(b => (b.getAttribute('aria-pressed') === 'true' ? '1' : '0')).join('');
    if (!dias.includes('1')) { toast('Escolha pelo menos um dia'); return; }
    const p = { id: `${pre}-${String(max + 1).padStart(3, '0')}`, area: a, rota: $('nRota').value, local: $('nLocal').value.trim().toUpperCase(), ativ: $('nAtiv').value.trim(), tipo: $('nTipo').value, dias, ativo: true };
    itens.push(p); DB.cache.plano[a] = itens; DB.savePlano(a, itens); DB.log(`Plano padrão: nova atividade ${p.id} · ${p.ativ}`); toast(`${p.id} adicionada ao plano`); render();
  });
}

// Menu de módulos: fecha ao clicar fora ou com Esc; setas sobem e descem.
document.addEventListener('pointerdown', e => { if (UI.modOpen && !e.target.closest('.modpick')) menuModulos(false); });
document.addEventListener('keydown', e => {
  if (!UI.modOpen) return;
  const itens = [...document.querySelectorAll('.modmenu button')]; const i = itens.indexOf(document.activeElement);
  if (e.key === 'Escape') { menuModulos(false); const b = document.querySelector('[data-modmenu]'); if (b) b.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]; if (n) n.focus(); }
});
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-area]'); if (!t || t.closest('#layer')) return;
  const d = t.dataset;
  if ('escolha' in d) { UI.escolha = d.escolha || null; AUTH.msg = ''; render(); const u = $('lgUser'); if (u) (u.value ? $('lgPass') : u).focus(); return; }
  if (d.go) {
    if (d.go === '__more') {
      const naBarra = barraDe().map(x => x[0]);
      const vs = viewsDoModulo().filter(v => !naBarra.includes(v.id));
      const outros = modsDe(ME).filter(m => m !== UI.modulo).map(m => ({ t: 'Ir para ' + MODS[m].nome, d: MODS[m].sub, id: '__mod_' + m, ic: `<span class="opt-ic">${I.swap}</span>` }));
      const outroAc = UI.acesso === 'sistema' ? 'operacao' : 'sistema';
      const extra = [...(isAdmin() ? [{ t: 'Meu painel', id: '__painel', d: 'Gestão de processos e Medição · abre o Painel Coqueria', ic: `<span class="opt-ic">${I.painel}</span>` }] : []), ...(isAdmin() ? [{ t: outroAc === 'sistema' ? 'Administração do sistema' : 'Voltar para a Operação', id: '__acesso', d: outroAc === 'sistema' ? 'Ajustes de todo o sistema · só o administrador' : 'Atividades, equipamentos, efetivo, frequência e férias', ic: `<span class="opt-ic">${ACESSO_IC[outroAc]}</span>` }] : []), { t: 'Tema da tela', id: '__tema', d: TEMAS[temaAtual()], ic: `<span class="opt-ic">${IC_TEMA[temaAtual()]}</span>` }, { t: 'Alterar minha senha', id: '__senha', ic: `<span class="opt-ic">${I.key}</span>` }, ...(DEMO ? [{ t: 'Trocar usuário (demonstração)', id: '__user', d: title(ME.nome) + ' · ' + papelNome(ME.papel) }] : []), { t: 'Sair', id: '__out', d: title(ME.nome || '') + ' · ' + papelNome(ME.papel), ic: `<span class="opt-ic">${I.out}</span>` }];
      return sheet('Mais', '', [...outros, ...vs.map(v => ({ t: v.nome, id: v.id, ic: `<span class="opt-ic">${I[v.ic]}</span>` })), ...extra], o => { if (o.id.startsWith('__mod_')) return trocarModulo(o.id.slice(6)); if (o.id === '__out') return DB.signOut(); if (o.id === '__painel') { window.open(PAINEL_URL, '_blank', 'noopener'); return; } if (o.id === '__acesso') return irAcesso(outroAc); if (o.id === '__senha') return alterarSenhaSheet(); if (o.id === '__tema') return temaSheet(); if (o.id === '__user') return sheet('Entrar como', 'Simula o login de cada perfil', DB.cache.usuarios.map(u => ({ t: title(u.nome), d: papelNome(u.papel) + (u.area ? ' · ' + AREA_S[u.area] : ''), uid: u.uid, cur: u.uid === ME.uid })), x => { DB.mockSwitch(x.uid); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(x.t)); }); UI.view = o.id; UI.confirm = null; render(); scrollTo(0, 0); });
    }
    { const tv = VIEWS.find(v => v.id === d.go); if (tv && tv.mod === 'cf' && UI.modulo !== 'config' && modsDe(ME).includes('config')) { if (UI.modulo === 'operacao' || UI.modulo === 'bateria' || (UI.modulo === 'gestao' && ES_VIEWS.includes(UI.view))) UI.cfSet = SK; UI.modulo = 'config'; UI.modOpen = false; aplicarSet(); } }
    UI.view = d.go; UI.confirm = null; UI.more = 0; UI.perm = null; if (UI.g) UI.g.mat = null; salvarUI(); render(); scrollTo(0, 0); return;
  }
  if (d.cfgo) { const [view, set] = d.cfgo.split('|'); if (set) UI.cfSet = set; UI.modulo = 'config'; aplicarSet(); UI.view = view; UI.confirm = null; salvarUI(); render(); scrollTo(0, 0); return; }
  if (d.cfset) { UI.cfSet = d.cfset; salvarUI(); render(); return; }
  // Escalas e turnos (rascunho até salvar)
  if (d.escdel) { const [k, l] = d.escdel.split('|'); delete rascEsc().regimes[k].turmas[l]; render(); return; }
  if (d.escper) { const [k, i] = d.escper.split('|'); const r = rascEsc().regimes[k]; const a = [...periodosDe(r)]; a[+i] = a[+i] === 'N' ? 'D' : 'N'; r.periodos = a.join(''); render(); return; }
  if (d.escadd) { const inp = document.querySelector(`[data-escnova="${d.escadd}"]`); const l = letra(inp && inp.value); if (!l) { toast('Informe a letra da turma (A a Z)'); return; } const tt = rascEsc().regimes[d.escadd].turmas || (rascEsc().regimes[d.escadd].turmas = {}); if (tt[l] !== undefined) { toast('Essa turma já existe'); return; } tt[l] = ''; render(); return; }
  if (d.escfer) { const dt = $('escFerD').value, ds = $('escFerT').value.trim(); if (!dt) { toast('Informe a data do feriado'); return; } const R = rascEsc(); R.feriados = R.feriados.filter(f => f.data !== dt).concat([{ data: dt, desc: ds || 'Feriado', semOp: true }]); render(); return; }
  if (d.escferdel) { const R = rascEsc(); R.feriados = R.feriados.filter(f => f.data !== d.escferdel); render(); return; }
  if (d.escfereq) { const R = rascEsc(); const eqF = ((DB.cache.e && DB.cache.e.config && DB.cache.e.config.feriados) || []).filter(f => f.semOp && !R.feriados.some(x => x.data === f.data)); R.feriados = R.feriados.concat(eqF.map(f => ({ data: f.data, desc: f.desc, semOp: true }))); render(); toast(`${eqF.length} feriado(s) copiados · salve para valer`); return; }
  if (d.mdAv) { MD.onClick(t); return; }
  if (d.md) {
    const [mod, view, area] = d.md.split('|'); if (!modsDe(ME).includes(mod)) return;
    if (view === 'escala') { UI.esSet = mod === 'bateria' ? 'bateria' : 'patio'; UI.area = area || UI.area; irEscala(''); return; }
    const novaOc = view === 'gnovaoc';
    UI.modulo = mod; UI.modOpen = false; aplicarSet(); UI.view = { gcomigo: 'gcolab', gnovaoc: 'gcolab' }[view] || view; UI.confirm = null;
    if (area && (mod === 'operacao' || mod === 'bateria')) { UI.area = area; UI.aRota = null; UI.eRota = null; }
    if (view === 'gcomigo' && UI.g) { UI.g.mat = null; UI.g.filtro = 'comigo'; }
    salvarUI(); render(); scrollTo(0, 0);
    if (novaOc) { const b = document.querySelector('[data-g="novaOc"]'); if (b) b.click(); }
    return;
  }
  if (d.modmenu) { menuModulos(!UI.modOpen); if (!UI.modOpen) t.focus(); return; }
  if (d.mod) { UI.modOpen = false; trocarModulo(d.mod); return;
  }
  if (d.esc) { UI.escopo = d.esc; render(); return; }
  if (d.area) { UI.area = d.area; render(); return; }
  if (d.cell) { const [id, i, k] = d.cell.split('|').length === 4 ? [d.cell.split('|').slice(0, 2).join('|'), ...d.cell.split('|').slice(2)] : d.cell.split('|'); cellMenu(DB.cache.semanas[id], +i, +k); return; }
  if (d.dia != null) { UI.dia = +d.dia; UI.confirm = null; render(); return; }
  if (d.arota) { UI.aRota = d.arota; UI.confirm = null; render(); salvarUI(); { const a = document.querySelector('.rchips.linha [aria-pressed="true"]'); if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' }); } if (t.closest('.fimrota')) scrollTo(0, 0); return; }
  if (d.efg) { const l = new Set(UI.efAbertas || []); if (l.has(d.efg)) l.delete(d.efg); else l.add(d.efg); UI.efAbertas = [...l]; render(); return; }
  if (d.pgrp) { const l = new Set(UI.progAbertas || []); if (l.has(d.pgrp)) l.delete(d.pgrp); else l.add(d.pgrp); UI.progAbertas = [...l]; render(); return; }
  if (d.aprarea) { UI.aprArea = d.aprarea; UI.confirm = null; render(); return; }
  if (d.aparea) { UI.apArea = d.aparea; if (myAreas().length > 1) UI.area = d.aparea; UI.confirm = null; render(); salvarUI(); return; }
  if (d.ap) {
    const [i, k, v] = d.ap.split('|'); const doc = DB.cache.semanas[apArea() + '|' + UI.ini];
    if (v === 'rmE') return apply(doc, +i, +k, '_');
    return apply(doc, +i, +k, doc.d[+i][+k] === v ? 'P' : v);
  }
  if (d.pend) { const parts = d.pend.split('|'); const id = parts[0] + '|' + parts[1]; return apply(DB.cache.semanas[id], +parts[2], +parts[3], parts[4]); }
  if (d.goescala !== undefined) { irEscala(d.goescala); return; }
  if (d.esset) { UI.esSet = d.esset; UI.eRota = '*'; UI.area = 'TODAS'; salvarUI(); render(); return; }
  if (d.erota) { UI.eRota = d.erota; render(); const s = $('fERota'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (d.sit) { lancarEfetivo(d.sit); return; }
  if (d.turma) { turmaSheet(d.turma); return; }

  if (d.ptog) {
    const [id, k] = d.ptog.split('|'); const p = PL.get(id); const itens = DB.cache.plano[p.area].map(x => (x.id === id ? { ...x, dias: [...x.dias].map((c, j) => (j === +k ? (c === '1' ? '0' : '1') : c)).join('') } : x));
    DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); render(); return;
  }
  if (d.eye) { toggleEye(t); return; }
  if (d.ck) { const [id, v] = d.ck.split('|'); const c = COLABS.find(x => x.id === id); if (!c || !canEditSit(c.area)) return; const key = id + '|' + TODAY; const atual = DB.sit(key); const novo = v === 'P' ? (atual === 'HE' ? 'HE' : null) : v; DB.setSit(key, novo); if (v === 'P' || v === 'ATR') removerCobertura(id, TODAY); DB.log(`${title(c.nome)} · check-in ${v === 'P' ? 'presente' : v === 'FT' ? 'falta' : 'atraso'} em ${ddmm(TODAY)}`); render(); return; }
  if (d.ckok) { const [a, per] = d.ckok.split('|'); const g = equipeCheckin().find(x => x.a === a && x.per === per); if (!g) return; const pres = g.ps.filter(x => !AUSENCIA.has(x.v) && x.v !== 'ATR').length; DB.setSitExtra('ck', `ck|${TODAY}|${a}|${per}`, `${ME.uid}|${curto(title(ME.nome || ME.login || ''))}|${new Date().toTimeString().slice(0, 5)}|${pres}/${g.ps.length}`); DB.log(`Check-in ${PER_NOME[per].toLowerCase()} · ${AREA_S[a]}: ${pres} de ${g.ps.length} presentes`); toast('Check-in confirmado'); render(); return; }
  if (d.ckre) { const [a, per] = d.ckre.split('|'); if (!myAreas().includes(a)) return; DB.setSitExtra('ck', `ck|${TODAY}|${a}|${per}`, null); render(); return; }
  if (d.just) { const [i, k] = d.just.split('|').map(Number); const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; if (doc && canEdit(doc.area)) pedirJustificativa(doc, i, k, m => { setSt(doc, i, k, 'N', m); toast('Justificativa atualizada'); render(); }); return; }
  if (d.reset) {
    const u = DB.cache.usuarios.find(x => x.uid === d.reset); const nova = senhaAleatoria();
    return formSheet('Redefinir senha', `${esc(title(u.nome))} · <span class="mono">${esc(u.login)}</span>`, `<label class="sel"><span>Nova senha provisória</span><input class="in" id="rsSenha" minlength="8" value="${nova}"></label><p class="muted small m0">Passe essa senha para a pessoa. No próximo acesso ela cria a própria senha.</p>`, 'Redefinir', async () => {
      const v = $('rsSenha').value.trim(); if (v.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      await DB.redefinirSenha(u.uid, v); DB.log(`Redefiniu a senha de ${u.login}`); toast(`Senha de ${u.login} redefinida`);
    });
  }
  if (d.uabas) { abasPessoaSheet(d.uabas); return; }
  if (d.udel) {
    const u = DB.cache.usuarios.find(x => x.uid === d.udel); if (!u) return;
    if (u.papel === 'admin' && DB.cache.usuarios.filter(x => x.papel === 'admin').length < 2) { toast('Não dá para apagar o único administrador'); return; }
    return formSheet('Apagar usuário', `${esc(title(u.nome))}${u.login ? ` · <span class="mono">${esc(u.login)}</span>` : ''}`, `<p class="m0">A pessoa perde o acesso ao sistema na hora. O que ela já registrou (apontamentos, fotos, ocorrências, histórico) continua no sistema.</p><p class="muted small m0">Para só suspender o acesso sem apagar, mude o perfil para <b>Bloqueado</b>. O nome de usuário fica livre para ser cadastrado de novo.</p><label class="switch"><input type="checkbox" id="udOk"><span>Confirmo que quero apagar este usuário</span></label>`, 'Apagar usuário', async () => {
      if (!$('udOk').checked) throw new Error('Marque a confirmação.');
      await DB.excluirUsuario(u.uid); DB.log(`Apagou o usuário ${u.login || u.nome}`); toast(`Usuário ${u.login || title(u.nome)} apagado`);
    });
  }
  if (d.ntog != null) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); return; }
  switch (d.act) {
    case 'trocarAcesso': UI.escolha = null; UI.modOpen = false; await DB.signOut(); break;
    case 'tema': temaSheet(); break;
    case 'irAcesso': irAcesso(UI.acesso === 'sistema' ? 'operacao' : 'sistema'); break;
    case 'senha': alterarSenhaSheet(); break;
    case 'logout': DB.signOut(); break;
    case 'permSalvar': {
      const R = rascunhoPerm(); const out = {};
      for (const [p] of PERFIS_ABAS) { out[p] = {}; for (const v of VIEWS) if (configuravel(p, v) && !doPerfil(p, v, R)) out[p][v.id] = false; else if (configuravel(p, v) && v.admin) out[p][v.id] = true; }
      await DB.salvarPermissoes(out); UI.perm = null; DB.log('Alterou as abas por perfil'); toast('Permissões salvas'); render(); break;
    }
    case 'permPadrao': UI.perm = Object.fromEntries(PERFIS_ABAS.map(([p]) => [p, {}])); render(); toast('Padrão carregado. Salve para aplicar'); break;
    case 'permDesfazer': UI.perm = null; render(); break;
    case 'escSalvar': {
      const R = rascEsc(); DB.salvarEscalas({ regimes: R.regimes, feriados: R.feriados });
      // mantém a Operação igual: turmas 4x4 também no cadastro dela
      const t4 = (R.regimes['4x4'] || {}).turmas || {};
      if (VIEWS.find(v => v.id === 'econfig').req() && DB.cache.e && DB.cache.e.config) DB.eSalvarConfig({ turmas: Object.fromEntries(Object.entries(t4).filter(([, v]) => v)) });
      UI.escR = null; DB.log('Atualizou as escalas e turnos'); toast('Escalas salvas · valem para todos os módulos'); render(); break;
    }
    case 'escDescartar': UI.escR = null; render(); break;
    case 'escFicha': {
      let n = 0;
      for (const k of setsDe(ME)) for (const a of SETS[k].areas) {
        const itens = (DB.dados(k).colabs || {})[a] || []; let mudou = false;
        const novos = itens.map(c => { const rg = escala().regimes[normRegime(c.regime, escala().regimes)]; if (rg && rg.tipo === 'ciclo' && !letra(c.turma)) { const tf = turmaFicha(c.nome); if (tf) { mudou = true; n++; return { ...c, turma: tf }; } } return c; });
        if (mudou) DB.salvarColabsArea(a, novos, k);
      }
      DB.log(`Gravou ${n} turma(s) a partir das fichas do Efetivo`); toast(`${n} turma(s) gravadas`); render(); break;
    }
    case 'limparEQ': UI.eQ = ''; render(); { const n = $('fEQ'); if (n) n.focus(); } break;
    case 'mockReset': await DB.mockReset(); toast('Demonstração restaurada'); break;
    case 'hoje': UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; UI.dia = null; render(); break;
    case 'efTodas': { const area = areaScope(); const ks = [...new Set(colabsDa(area).map(c => c.area + '|' + c.rota))]; UI.efAbertas = (UI.efAbertas || []).length ? [] : ks; render(); break; }
    case 'limparProg': UI.q = ''; UI.soPend = false; UI.rota = 'TODAS'; UI.tipo = 'TODOS'; render(); break;
    case 'progTodas': { const area = areaScope(); const ks = new Set(); for (const doc of docsFor({ ini: UI.ini, area })) doc.ids.forEach(id => { const p = PL.get(id); if (p) ks.add(doc.area + '|' + p.rota); }); UI.progAbertas = (UI.progAbertas || []).length ? [] : [...ks]; render(); break; }
    case 'filtros': filtroSheet(); break;
    case 'busca': abrirBusca(); break;
    case 'more': UI.more = +d.n; render(); break;
    case 'cancel': UI.confirm = null; render(); break;
    case 'askAll': UI.confirm = 'all'; render(); break;
    case 'expHe': exportHe(); break;
    case 'novaAcao': novaAcaoSheet(d.k); break;
    case 'acaoSt': { const [id, stt] = d.k.split('|'); const a = (DB.cache.acoes || {})[id]; if (!a || !podeAcao(a.area)) break; DB.salvarAcao(id, { status: stt }); DB.log(`Plano de ação: "${a.acao}" ${stt === 'feita' ? 'concluída' : stt === 'cancelada' ? 'retirada' : 'reaberta'}`); toast(stt === 'feita' ? 'Ação concluída' : stt === 'cancelada' ? 'Ação retirada do plano' : 'Ação reaberta'); render(); break; }
    case 'aprv': { const x = achaAprov(d.k); if (x && areasAprov().includes(x.doc.area)) { aprovar([x]); toast('Aprovada'); render(); } break; }
    case 'devl': { const x = achaAprov(d.k); if (x && areasAprov().includes(x.doc.area)) pedirDevolucao(x); break; }
    case 'aprvGrupo': { const [dt, a, r] = d.k.split('|'); const xs = listaAprov(areasAprov().filter(z => z === a)).filter(x => x.dt === dt && x.p.rota === r); aprovar(xs); toast(`${xs.length} aprovada${xs.length > 1 ? 's' : ''}`); render(); break; }
    case 'askAprvTudo': UI.confirm = 'aprvTudo'; render(); break;
    case 'aprvTudo': { const m = areasAprov(); const xs = listaAprov(m.includes(UI.aprArea) ? [UI.aprArea] : m); aprovar(xs); UI.confirm = null; toast(`${xs.length} apontamentos aprovados`); render(); break; }
    case 'aprTodas': { const l = UI.aprTodas || []; UI.aprTodas = l.includes(d.k) ? l.filter(x => x !== d.k) : [...l, d.k]; render(); break; }
    case 'allok': {
      const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const k = UI.dia; const ch = [];
      doc.ids.forEach((id, i) => { const p = PL.get(id); if (p && p.rota === UI.aRota && doc.d[i][k] === 'P') ch.push(localChange(doc, i, k, 'R')); });
      gravarApont(doc, ch);
      DB.log(`${UI.aRota} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}: ${ch.length} atividades marcadas como realizadas`);
      UI.confirm = null; toast(`${ch.length} atividades marcadas como realizadas`); render(); break;
    }
    case 'extra': {
      const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const k = UI.dia;
      const opts = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] === '_');
      if (!opts.length) { toast('Todas as atividades desta rota já estão no dia'); break; }
      sheet('Atividade extra', `${esc(UI.aRota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}`, opts.map(x => ({ t: x.p.ativ, d: x.p.local, i: x.i })), o => apply(doc, o.i, k, 'E'));
      break;
    }
    case 'askRota': UI.confirm = 'rota:' + d.k; render(); break;
    case 'rotaok': {
      const [a, r] = d.k.split('|'); const byDoc = new Map();
      for (const x of atrasadasAll(a)) { const p = PL.get(x.doc.ids[x.i]); if (!p || p.rota !== r) continue; if (!byDoc.has(x.doc)) byDoc.set(x.doc, []); byDoc.get(x.doc).push(localChange(x.doc, x.i, x.k, 'R')); }
      let n = 0; for (const [doc, ch] of byDoc) { n += ch.length; gravarApont(doc, ch); }
      DB.log(`${r}: ${n} atrasadas marcadas como realizadas`); UI.confirm = null; toast(`${n} marcadas como realizadas`); render(); break;
    }
    case 'askDel': UI.confirm = 'del:' + d.id; render(); break;
    case 'del': {
      const p = PL.get(d.id); const itens = DB.cache.plano[p.area].map(x => (x.id === d.id ? { ...x, ativo: false } : x));
      DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); DB.log(`Plano padrão: removeu ${p.id} · ${p.ativ}`); UI.confirm = null; toast(`${p.id} removida do plano`); render(); break;
    }
    case 'gerar': {
      UI.busy = true; render();
      try { await DB.gerarMes(UI.gMes, DB.cache.plano); DB.log(`Gerou a programação de ${monthLabel(UI.gMes)}`); toast(`${monthLabel(UI.gMes)} gerado`); UI.mes = UI.gMes; UI.ini = null; UI.gMes = null; }
      catch (err) { toast('Erro ao gerar: ' + err.message); }
      UI.busy = false; render(); break;
    }
    case 'importar': {
      UI.busy = true; render();
      try {
        const seed = await DB.seed(SETS[SK].seed);
        await DB.importar(seed, [CUR_MONTH, addMonth(CUR_MONTH, 1), addMonth(CUR_MONTH, 2)], UI.impIni);
        DB.log('Importou os dados da planilha e gerou a programação'); toast('Dados importados');
      } catch (err) { toast('Erro ao importar: ' + err.message); }
      UI.busy = false; render(); break;
    }
    case 'print': window.print(); break;
    case 'csv': exportCSV(); break;
    case 'expEsdia': exportEsdia(); break;
    case 'rotasTodas': UI.rotasTodas = !UI.rotasTodas; render(); break;
    case 'pendTodas': { const k = t.dataset.k; const l = UI.pendTodas || []; UI.pendTodas = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; render(); break; }
  }
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!['fLogin', 'fMust', 'fNovoUser'].includes(f.id)) return;
  e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try {
    if (f.id === 'fLogin') {
      UI.acesso = 'operacao'; salvarAcesso(); DB.definirAcesso(UI.acesso);
      UI.modulo = MODS_MARCAVEIS.includes(UI.modulo) ? UI.modulo : 'operacao';
      UI.view = ACESSO[UI.acesso].inicio; salvarUI();
      try { localStorage.setItem('dikma-ultimo-login', DB.normLogin($('lgUser').value)); } catch (e) { /* ignora */ }
      await DB.signIn($('lgUser').value, $('lgPass').value); return;
    }
    if (f.id === 'fMust') {
      const n = $('mcPass').value, n2 = $('mcPass2').value;
      { const p = problemaSenha(n, AUTH.user); if (p) throw new Error(p); } if (n !== n2) throw new Error('As duas senhas não são iguais.');
      await DB.definirNovaSenha(n); toast('Senha criada'); return;
    }
    if (f.id === 'fNovoUser') {
      const nome = $('nuNome').value.trim(), login = DB.normLogin($('nuLogin').value), senha = $('nuSenha').value.trim(), papel = $('nuPapel').value, area = $('nuArea').value || null;
      const area2 = papel === 'supervisor' ? ($('nuArea2').value || null) : null;
      if (area2 && area2 === area) throw new Error('A 2ª área precisa ser diferente da primeira.');
      if (area2 && !area) throw new Error('Escolha a primeira área antes da segunda.');
      if (!nome) throw new Error('Informe o nome.');
      if (!DB.loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado (sem espaço e sem acento).');
      if (senha.length < 8) throw new Error('A senha provisória precisa ter pelo menos 8 caracteres.');
      const acessos = ['operacao'];
      const modulos = MODS_MARCAVEIS.filter(m => $('nuM_' + m).checked);
      if (!modulos.length && papel !== 'admin') throw new Error('Marque pelo menos um módulo.');
      if ((modulos.includes('operacao') || modulos.includes('bateria')) && ['lider', 'supervisor'].includes(papel) && !area) throw new Error('Escolha a área do líder ou supervisor (Atividades Pátio ou Bateria).');
      if (area && ['lider', 'supervisor'].includes(papel) && !modulos.includes(SETS[setDaArea(area)].mod)) throw new Error(`A área ${AREA_S[area]} é do módulo ${SETS[setDaArea(area)].nome}. Marque esse módulo.`);
      UI.busy = true;
      await DB.criarUsuario({ nome: nome.toUpperCase(), login, senha, papel, area: ['lider', 'supervisor'].includes(papel) ? area : null, area2, modulos: papel === 'admin' ? MODS_MARCAVEIS : modulos, acessos });
      DB.log(`Cadastrou o usuário ${login} (${papelNome(papel)})`);
      UI.busy = false; UI.senhaSug = null; render();
      formSheet('Usuário cadastrado', '', `<p class="m0">Passe estes dados para <b>${esc(title(nome))}</b>:</p><div class="credbox"><div><span>Endereço</span><b>${esc(location.origin)}</b></div><div><span>Usuário</span><b>${esc(login)}</b></div><div><span>Senha provisória</span><b>${esc(senha)}</b></div></div><p class="muted small m0">No primeiro acesso a pessoa cria a própria senha.</p>`, 'Fechar', async () => {});
      return;
    }
  } catch (err) {
    UI.busy = false;
    const id = { fLogin: 'lgErr', fMust: 'mcErr', fNovoUser: 'nuErr' }[f.id];
    showErr(id, err);
  } finally { const b = f.querySelector('[type=submit]'); if (b && f.isConnected) b.disabled = false; }
});
document.addEventListener('change', e => {
  { const t = e.target; const dd = t.dataset || {};
    if (dd.escdia) { const [k, d] = dd.escdia.split('|'); const r = rascEsc().regimes[k]; const l = new Set(r.dias || []); if (t.checked) l.add(+d); else l.delete(+d); r.dias = [...l].sort(); render(); return; }
    if (dd.escn) { const [k, f] = dd.escn.split('|'); rascEsc().regimes[k][f] = Math.max(1, +t.value || 1); render(); return; }
    if (dd.esct) { const [k, l] = dd.esct.split('|'); rascEsc().regimes[k].turmas[l] = t.value || ''; render(); return; }
    if (dd.escpes) { const [k, a, id] = dd.escpes.split('|'); const itens = ((DB.dados(k).colabs || {})[a] || []).map(c => (c.id === id ? { ...c, turma: t.value } : c)); DB.salvarColabsArea(a, itens, k); const c = itens.find(x => x.id === id); DB.log(`${title(c.nome)} · turma ${t.value || 'removida'}`); toast(t.value ? `Turma ${t.value} gravada` : 'Turma removida'); return; } }
  const t = e.target;
  if (t.dataset.mdPref) { MD.onChange(t); return; }
  if (t.dataset.perm) { const [p, id] = t.dataset.perm.split('|'); rascunhoPerm()[p][id] = t.checked; render(); return; }
  if (t.id === 'mockUser') { DB.mockSwitch(t.value); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(ME ? ME.nome : '')); return; }
  if (t.dataset.rcfg) { const [i, f] = t.dataset.rcfg.split('|'); const rs = rotas().map((r, j) => (j === +i ? { ...r, [f]: Math.max(0, +t.value || 0) } : r)); DB.cache.config.rotas = rs; DB.saveRotas(rs); toast('Rota atualizada'); }
  if (t.dataset.upapel) {
    const uid = t.dataset.upapel; const admins = DB.cache.usuarios.filter(u => u.papel === 'admin').length;
    if (uid === ME.uid && t.value !== 'admin' && admins < 2) { toast('Antes, deixe outra pessoa como administrador'); t.value = 'admin'; return; }
    const patch = { papel: t.value }; if (!['lider', 'supervisor'].includes(t.value)) patch.area = null; if (t.value !== 'supervisor') patch.area2 = null;
    // Administrativo: Frequência e férias e as fichas do Efetivo vêm marcados (dá para desmarcar depois)
    if (t.value === 'administrativo') { const u = DB.cache.usuarios.find(x => x.uid === uid); const m = modsReais(u); patch.modulos = [...new Set([...m, 'gestao', 'frequencia'])]; }
    DB.setUsuario(uid, patch); toast('Perfil atualizado');
  }
  if (t.dataset.umod) {
    const [uid, m] = t.dataset.umod.split('|'); const u = DB.cache.usuarios.find(x => x.uid === uid);
    const atual = modsReais(u); const novo = t.checked ? [...new Set([...atual, m])] : atual.filter(x => x !== m);
    if (!novo.length) { t.checked = true; toast('Deixe pelo menos um módulo'); return; }
    DB.setUsuario(uid, { modulos: novo, acessos: ['operacao'] }); toast('Módulos atualizados'); // acessos antigo (Administrativo) vira o módulo
  }
  if (t.dataset.uac) {
    const [uid, k] = t.dataset.uac.split('|'); const u = DB.cache.usuarios.find(x => x.uid === uid);
    const atual = acessosDe(u); const novo = t.checked ? [...new Set([...atual, k])] : atual.filter(x => x !== k);
    if (!novo.length) { t.checked = true; toast('Deixe pelo menos um acesso'); return; }
    DB.setUsuario(uid, { acessos: novo }); DB.log(`Acessos de ${u.login || u.nome}: ${novo.map(x => ACESSO[x].nome).join(', ')}`); toast('Acessos atualizados');
  }
  if (t.dataset.uarea) { DB.setUsuario(t.dataset.uarea, { area: t.value || null }); toast('Área atualizada'); }
  if (t.dataset.uarea2) {
    const u = DB.cache.usuarios.find(x => x.uid === t.dataset.uarea2);
    if (t.value && u && t.value === u.area) { toast('A 2ª área precisa ser diferente da primeira'); t.value = u.area2 || ''; return; }
    DB.setUsuario(t.dataset.uarea2, { area2: t.value || null }); toast(t.value ? '2ª área atualizada' : '2ª área removida');
  }
  // Plano padrão: rota, local, atividade e tipo editáveis na própria linha
  if (t.dataset.prota || t.dataset.pcampo) {
    if (!admMod()) return;
    const [id, campo] = t.dataset.prota ? [t.dataset.prota, 'rota'] : t.dataset.pcampo.split('|'); const p = PL.get(id); if (!p) return;
    const v = String(t.value || '').replace(/\s+/g, ' ').trim(); if (!v) { toast('O campo não pode ficar vazio'); t.value = p[campo]; return; }
    if (v === p[campo]) return;
    const itens = DB.cache.plano[p.area].map(x => (x.id === id ? { ...x, [campo]: v } : x));
    DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); rebuild();
    DB.log(`Plano padrão: ${id} · ${{ rota: 'rota', local: 'local', ativ: 'atividade', tipo: 'tipo' }[campo]} "${p[campo]}" → "${v}"`); toast('Plano atualizado · vale para os meses gerados e já gerados'); render(); return;
  }
  // Renomear rota: troca na lista de rotas, no plano padrão e nos colaboradores da rota (mesma área)
  if (t.dataset.rnome) {
    if (!admMod()) return;
    const i = +t.dataset.rnome; const r = rotas()[i]; const novo = String(t.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!r || !novo || novo === r.rota) { t.value = r ? r.rota : ''; return; }
    if (rotas().some((x, j) => j !== i && x.area === r.area && x.rota === novo)) { toast('Já existe uma rota com esse nome nesta área'); t.value = r.rota; return; }
    const velho = r.rota;
    const rs = rotas().map((x, j) => (j === i ? { ...x, rota: novo } : x)); DB.cache.config.rotas = rs; DB.saveRotas(rs);
    const pl = (DB.cache.plano[r.area] || []); if (pl.some(x => x.rota === velho)) { const itens = pl.map(x => (x.rota === velho ? { ...x, rota: novo } : x)); DB.cache.plano[r.area] = itens; DB.savePlano(r.area, itens); }
    const cs = (DB.cache.colabs[r.area] || []); if (cs.some(x => x.rota === velho)) { const itens = cs.map(x => (x.rota === velho ? { ...x, rota: novo } : x)); DB.cache.colabs[r.area] = itens; DB.salvarColabsArea(r.area, itens); }
    if (UI.aRotaPor && UI.aRotaPor[r.area] === velho) UI.aRotaPor[r.area] = novo; if (UI.aRota === velho) UI.aRota = novo;
    rebuild(); DB.log(`Rota renomeada: ${velho} → ${novo} (${AREA_S[r.area]})`); toast(`Rota renomeada para ${novo}`); render(); return;
  }
  if (t.dataset.hecfg) { if (!admMod()) return; const he = { ...heCfg(), [t.dataset.hecfg]: Math.max(0, Math.min(t.dataset.hecfg === 'limite' ? 31 : 24, +t.value || 0)) }; DB.saveConfig({ he }); toast('Ajuste salvo'); render(); return; }
  if (t.id === 'nuPapel') { const p = t.value; $('nuArea').disabled = !['lider', 'supervisor'].includes(p); $('nuArea2').disabled = p !== 'supervisor'; if (p !== 'supervisor') $('nuArea2').value = ''; if (p === 'administrativo') for (const m of ['operacao', 'gestao', 'frequencia']) { const c = $('nuM_' + m); if (c) c.checked = true; } }
});
// Atalho: "/" leva para a busca da tela (quando não está digitando em outro campo).
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement; if (a && a.matches('input,textarea,select,[contenteditable]')) return;
  const b = document.querySelector('#layer input[type=search], #view input[type=search], #view #fQ, #top #fQ'); if (!b) return;
  e.preventDefault(); b.focus(); b.select();
});
matchMedia('(max-width:860px)').addEventListener('change', () => { if (UI.view === 'elanc') render(); });
window.addEventListener('online', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('offline', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('pagehide', salvarUI);

const PES = criarPessoas(DB);
// Marca o uso deste aparelho (a sessão expira depois de 7 dias sem uso).
if (DB.marcarUso) ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (AUTH.status === 'ready') DB.marcarUso(); }, { passive: true }));
// Área de atuação de cada ficha do Efetivo (organiza as fichas por área no banco). Só o administrador calcula,
// e só depois que os dados de todos os módulos chegaram; antes disso devolve null e nada muda de lugar.
if (DB.definirChaveArea) DB.definirChaveArea(c => {
  if (!ME || ME.papel !== 'admin') return null;
  const ok = SET_KEYS.every(k => { const d = DB.dados(k); return d.configLoaded && (!d.config || d.colabsLoaded); }) && (!DB.cache.e || DB.cache.e.loaded);
  return ok ? chaveFicha(PES.lotacao(c).area) : null;
});
const MD = criarMeuDia({ checkinPend: () => checkinPendentes(), get ME() { return ME; }, DB, esc, title, I, toast, render: () => render(), modsDe: modsReais, sitEscala: sitDiaDe, fatorRota: cs => fatorRota(cs, escala().regimes) });
// Aberto por um aviso do celular: vai direto para o Meu dia.
// Links dos avisos no celular: ?m=<módulo>&v=<tela> (ex.: ?m=operacao&v=apontar). Tela que a pessoa não pode ver cai no início do módulo.
// Os avisos levam à Operação: se o sistema estava aberto em outro acesso, passa para a Operação (devolve true quando trocou).
let trocouAcessoPorLink = false;
function abrirLink(busca) {
  const p = new URLSearchParams(busca); const m = p.get('m'), v = p.get('v');
  const daOperacao = (m && MODS_MARCAVEIS.includes(m)) || (!m && v === 'meudia');
  if (daOperacao && UI.acesso !== 'operacao') { UI.acesso = 'operacao'; salvarAcesso(); trocouAcessoPorLink = true; }
  if (m && MODS[m]) UI.modulo = m;
  if (v) UI.view = v;
  // QR Code da rota: ?r=ÁREA|ROTA abre o Apontar de hoje já nessa rota
  const sem = p.get('s'); if (sem && /^\d{4}-\d{2}-\d{2}$/.test(sem)) { UI.ini = weekOf(sem); UI.mes = monthOfWeek(UI.ini); }
  const r = p.get('r'); if (r && r.includes('|')) { const [a, rota] = r.split('|'); UI.apArea = a; UI.aRotaPor = { ...(UI.aRotaPor || {}), [a]: rota }; UI.aRota = rota; UI.dia = null; UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; if (UI.area !== 'TODAS' && UI.area !== a) UI.area = 'TODAS'; }
  if (m || v) { UI.confirm = null; salvarUI(); }
  return !!(m || v);
}
if (abrirLink(location.search)) history.replaceState(null, '', location.pathname + (DEMO ? '?demo' : ''));
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (!e.data || e.data.tipo !== 'abrir' || AUTH.status !== 'ready') return;
  let busca = ''; try { busca = new URL(e.data.url).search; } catch (err) { /* link inválido: abre o Meu dia */ }
  trocouAcessoPorLink = false;
  if (!abrirLink(busca)) { UI.view = 'meudia'; if (UI.acesso !== 'operacao') { UI.acesso = 'operacao'; salvarAcesso(); trocouAcessoPorLink = true; } }
  // outro acesso aberto: recarrega já na Operação (os dados de cada acesso são carregados na entrada)
  if (trocouAcessoPorLink) { salvarUI(); location.reload(); return; }
  if (typeof ensureModulo === 'function') ensureModulo();
  aplicarSet(); render(); scrollTo(0, 0);
});
const EQ = criarEquip({ escala: () => escala(), PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, framed, UI });
const AD = criarAdministrativo({ pulsar: el => M.pulsar(el), get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), agendar: () => { clearTimeout(window._aqt); window._aqt = setTimeout(schedule, 200); }, UI, isMobile, escala: () => escala(), framed });
const GE = criarGestao({ PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, prepararFoto, framed, UI });
M.iniciarJanelas(); M.iniciarTopo();
if (DB.definirAcesso) DB.definirAcesso(UI.acesso);
DB.start({
  onAuth: a => { AUTH = a; ME = a.user || null; if (a.acesso && ACESSO[a.acesso] && a.acesso !== UI.acesso) { UI.acesso = a.acesso; salvarAcesso(); if (UI.acesso === 'operacao' && UI.modulo === 'config') { UI.modulo = 'operacao'; UI.view = 'meudia'; } } if (ME && myArea()) UI.area = myArea(); render(); },
  onData: () => { DATAV++; if (AUTH.status === 'ready') schedule(); },
  onError: err => { console.error(err); toast(err.code === 'permission-denied' ? 'Sem permissão para essa alteração' : 'Erro: ' + (err.message || err)); }
});

// Versão nova publicada: o navegador baixa em segundo plano e o sistema troca sozinho.
// Logo ao abrir (até 15 s) recarrega direto; depois disso mostra a barra "Atualizar" para não interromper ninguém.
if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') {
  const tinhaControle = !!navigator.serviceWorker.controller, t0 = Date.now(); let trocou = false;
  const ocupado = () => DB.pendingWrites() > 0 || !!$('layer').children.length || !!(document.activeElement && document.activeElement.matches('input:not([type=checkbox]):not([type=radio]),textarea'));
  const barra = () => {
    if (document.querySelector('.updbar')) return;
    const el = document.createElement('div'); el.className = 'updbar noprint'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>Nova versão do sistema disponível</span><button class="btn pri sm" type="button">Atualizar agora</button>';
    el.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(el);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || trocou) return; trocou = true;
    if (Date.now() - t0 < 15000 && !ocupado()) location.reload(); else barra();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const ver = () => reg.update().catch(() => {});
    setInterval(ver, 20 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ver(); });
  }).catch(() => {});
}
