// Camada de dados — Firebase (Auth + Firestore).
// Estrutura no Firestore:
//   config/bootstrap          { uid }                 primeiro login vira administrador
//   config/sistema            { rotas[], tipos[], meses[] }
//   usuarios/{uid}            { nome, email, foto, papel, area }
//   plano/{ÁREA}              { itens: [ {id, area, rota, local, ativ, tipo, dias:"1111100", ativo} ] }
//   colaboradores/{ÁREA}      { itens: [ {id, area, rota, nome, funcao, regime} ] }
//   situacao/{AAAA-MM}        { v: { "C001|2026-10-03": "F" } }
//   semanas/{ÁREA|AAAA-MM-DD} { area, ini, mes, ids[], s: { "REC-001": "RRNPP__" }, m: { "REC-001|2": "motivo" } }
//   historico/{auto}          { at, uid, nome, t }
// Um documento por área+semana: cada tela lê poucos documentos (cabe no plano grátis).

import {
  initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, FieldPath, deleteField, arrayUnion
} from './vendor/firebase.js';
import { AREAS, ATIVOS, weeksOfMonth, novaSemana, seedParaBanco } from './cal.js';

export const isMock = false;
export const cache = { config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, semanas: {}, monthsLoaded: new Set(), log: [], usuarios: [] };

let auth, db, me = null, cb = {}, userSub = null, dataSubs = [], monthSubs = new Map(), pending = 0;

export const pendingWrites = () => pending;
const changed = () => cb.onData && cb.onData();
function track(p) {
  pending++; changed();
  return p.catch(e => { cb.onError && cb.onError(e); }).finally(() => { pending--; changed(); });
}

async function loadConfig() {
  // No Firebase Hosting a configuração vem pronta deste endereço reservado.
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (r.ok) { const c = await r.json(); try { localStorage.setItem('coqueria-fbcfg', JSON.stringify(c)); } catch (e) { /* ignora */ } return c; }
  } catch (e) { /* sem sinal ou fora do Firebase Hosting */ }
  try { const c = JSON.parse(localStorage.getItem('coqueria-fbcfg') || 'null'); if (c && c.apiKey) return c; } catch (e) { /* ignora */ }
  try { const m = await import('./firebase-config.js'); if (m.default && m.default.apiKey) return m.default; } catch (e) { /* sem arquivo local */ }
  return null;
}

export async function start(callbacks) {
  cb = callbacks;
  const cfg = await loadConfig();
  if (!cfg) { cb.onAuth({ status: 'noConfig' }); return; }
  const app = initializeApp(cfg);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  getRedirectResult(auth).catch(e => cb.onError && cb.onError(e));
  onAuthStateChanged(auth, async u => {
    stopAll();
    if (!u) { me = null; cb.onAuth({ status: 'signedOut' }); return; }
    cb.onAuth({ status: 'loading' });
    try { await ensureProfile(u); }
    catch (e) { cb.onAuth({ status: 'error', msg: e.message }); return; }
    userSub = onSnapshot(doc(db, 'usuarios', u.uid), s => {
      me = { uid: u.uid, email: u.email, foto: u.photoURL || '', ...s.data() };
      if (!ATIVOS.has(me.papel)) { stopData(); cb.onAuth({ status: 'pending', user: me }); return; }
      if (!dataSubs.length) startData();
      cb.onAuth({ status: 'ready', user: me });
    }, e => cb.onAuth({ status: 'error', msg: e.message }));
  });
}

async function ensureProfile(u) {
  const ref = doc(db, 'usuarios', u.uid);
  const s = await getDoc(ref);
  const nome = u.displayName || u.email;
  if (s.exists()) { updateDoc(ref, { nome, foto: u.photoURL || '', ultimoAcesso: serverTimestamp() }).catch(() => {}); return; }
  const base = { nome, email: u.email, foto: u.photoURL || '', area: null, criadoEm: serverTimestamp(), ultimoAcesso: serverTimestamp() };
  const boot = await getDoc(doc(db, 'config', 'bootstrap'));
  if (!boot.exists()) {
    const b = writeBatch(db);
    b.set(doc(db, 'config', 'bootstrap'), { uid: u.uid, email: u.email });
    b.set(ref, { ...base, papel: 'admin' });
    await b.commit();
    return;
  }
  await setDoc(ref, { ...base, papel: 'pendente' });
}

function startData() {
  const on = (q, fn) => dataSubs.push(onSnapshot(q, fn, e => cb.onError && cb.onError(e)));
  on(doc(db, 'config', 'sistema'), s => { cache.config = s.exists() ? s.data() : null; cache.configLoaded = true; changed(); });
  on(collection(db, 'plano'), qs => { cache.plano = {}; qs.forEach(d => { cache.plano[d.id] = d.data().itens || []; }); changed(); });
  on(collection(db, 'colaboradores'), qs => { cache.colabs = {}; qs.forEach(d => { cache.colabs[d.id] = d.data().itens || []; }); changed(); });
  on(query(collection(db, 'historico'), orderBy('at', 'desc'), limit(40)), qs => {
    cache.log = qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { ...x, at: x.at ? x.at.toDate() : new Date() }; });
    changed();
  });
  if (me.papel === 'admin') on(collection(db, 'usuarios'), qs => { cache.usuarios = qs.docs.map(d => ({ uid: d.id, ...d.data() })); changed(); });
  const keep = [...monthSubs.keys()]; monthSubs.clear(); watchMonths(keep);
}
function stopData() {
  dataSubs.forEach(f => f()); dataSubs = [];
  for (const fs of monthSubs.values()) fs.forEach(f => f());
  monthSubs.clear();
  Object.assign(cache, { config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, semanas: {}, monthsLoaded: new Set(), log: [], usuarios: [] });
}
function stopAll() { if (userSub) { userSub(); userSub = null; } stopData(); }

const toLocal = (id, x) => ({ id, ...x, m: x.m || {}, d: x.ids.map(p => (x.s && x.s[p]) || '_______') });

// Mantém em tempo real só os meses que a tela precisa.
export function watchMonths(meses) {
  if (!me || !ATIVOS.has(me.papel) || !db) { meses.forEach(m => monthSubs.set(m, [])); return; }
  const want = new Set(meses.filter(Boolean));
  for (const [m, fs] of monthSubs) if (!want.has(m)) {
    fs.forEach(f => f()); monthSubs.delete(m); cache.monthsLoaded.delete(m); delete cache.sitByMonth[m];
    for (const k of Object.keys(cache.semanas)) if (cache.semanas[k].mes === m) delete cache.semanas[k];
  }
  for (const m of want) if (!monthSubs.has(m) || !monthSubs.get(m).length) {
    const a = onSnapshot(query(collection(db, 'semanas'), where('mes', '==', m)), qs => {
      qs.docChanges().forEach(c => { if (c.type === 'removed') delete cache.semanas[c.doc.id]; else cache.semanas[c.doc.id] = toLocal(c.doc.id, c.doc.data()); });
      cache.monthsLoaded.add(m); changed();
    }, e => cb.onError && cb.onError(e));
    const b = onSnapshot(doc(db, 'situacao', m), s => { cache.sitByMonth[m] = (s.exists() && s.data().v) || {}; changed(); });
    monthSubs.set(m, [a, b]);
  }
}

export const sit = key => { const m = key.split('|')[1].slice(0, 7); return (cache.sitByMonth[m] || {})[key]; };

export async function signIn() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) return signInWithRedirect(auth, p); if (e.code !== 'auth/popup-closed-by-user') throw e; }
}
export const signOut = () => fbSignOut(auth);

// ---------- gravações ----------
// changes: [{ pid, str, k, motivo }] — todos do mesmo documento de semana
export function setStatusMany(docId, changes) {
  const args = [];
  const finalStr = {};
  for (const c of changes) finalStr[c.pid] = c.str;
  for (const [pid, str] of Object.entries(finalStr)) args.push(new FieldPath('s', pid), str);
  for (const c of changes) args.push(new FieldPath('m', c.pid + '|' + c.k), c.motivo ? c.motivo : deleteField());
  args.push('atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  return track(updateDoc(doc(db, 'semanas', docId), ...args));
}
export function setSit(key, code) {
  const m = key.split('|')[1].slice(0, 7);
  return track(setDoc(doc(db, 'situacao', m), { v: { [key]: code || deleteField() } }, { merge: true }));
}
export const savePlano = (area, itens) => track(setDoc(doc(db, 'plano', area), { itens }));
export const saveRotas = rotas => track(updateDoc(doc(db, 'config', 'sistema'), { rotas }));
export const setUsuario = (uid, patch) => track(updateDoc(doc(db, 'usuarios', uid), patch));
export function log(t) { if (!me) return; addDoc(collection(db, 'historico'), { at: serverTimestamp(), uid: me.uid, nome: me.nome || me.email, t }).catch(() => {}); }

export async function gerarMes(ym, planoPorArea, aPartirDe) {
  const exist = await getDocs(query(collection(db, 'semanas'), where('mes', '==', ym)));
  const have = new Set(exist.docs.map(d => d.id));
  const b = writeBatch(db); let n = 0;
  for (const ini of weeksOfMonth(ym)) {
    if (aPartirDe && ini < aPartirDe) continue;
    for (const area of AREAS) {
      const id = area + '|' + ini; if (have.has(id)) continue;
      const w = novaSemana(area, ini, planoPorArea[area] || []);
      b.set(doc(db, 'semanas', id), { ...w, criadoEm: serverTimestamp() }); n += w.ids.length;
    }
  }
  b.update(doc(db, 'config', 'sistema'), { meses: arrayUnion(ym) });
  await b.commit();
  return n;
}

export async function importar(seed, meses, aPartirDe) {
  const x = seedParaBanco(seed);
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'sistema'), { ...x.config, importadoEm: serverTimestamp() });
  for (const a of AREAS) { b.set(doc(db, 'plano', a), { itens: x.plano[a] }); b.set(doc(db, 'colaboradores', a), { itens: x.colabs[a] }); }
  for (const [m, v] of Object.entries(x.sit)) b.set(doc(db, 'situacao', m), { v });
  await b.commit();
  for (const m of meses) await gerarMes(m, x.plano, aPartirDe);
}
