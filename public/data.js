// Camada de dados — Firebase (Auth + Firestore).
// Login por USUÁRIO e SENHA. Só o administrador cadastra pessoas.
// Por baixo, o Firebase Auth usa um e-mail interno gerado pelo sistema (ninguém precisa saber dele).
// Estrutura no Firestore:
//   config/bootstrap          { uid }                 quem criou o primeiro administrador
//   config/sistema            { rotas[], tipos[], meses[] }
//   logins/{login}            { email, uid }          liga o usuário digitado à conta interna
//   usuarios/{uid}            { nome, login, papel, area, trocarSenha }
//   plano/{ÁREA}              { itens: [ {id, area, rota, local, ativ, tipo, dias:"1111100", ativo} ] }
//   colaboradores/{ÁREA}      { itens: [ {id, area, rota, nome, funcao, regime} ] }
//   situacao/{AAAA-MM}        { v: { "C001|2026-10-03": "F" } }
//   semanas/{ÁREA|AAAA-MM-DD} { area, ini, mes, ids[], s: { "REC-001": "RRNPP__" }, m: { "REC-001|2": "motivo" } }
//   historico/{auto}          { at, uid, nome, t }
//   evidencias/{id}           { ref, semana, area, pid, k, nome, tipo, tamanho, thumb, por, porNome, at }  (lista leve)
//   evidenciasArquivo/{id}    { area, por, dados }   foto/arquivo completo (até ~900 KB), lido só ao abrir
// Um documento por área+semana: cada tela lê poucos documentos (cabe no plano grátis).

import {
  initializeApp, getAuth, initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, FieldPath, deleteField, arrayUnion, increment
} from './vendor/firebase.js';
import { AREAS, ATIVOS, weeksOfMonth, novaSemana, seedParaBanco } from './cal.js';

export const isMock = false;
export const cache = { config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, semanas: {}, monthsLoaded: new Set(), log: [], usuarios: [] };

let cfg, auth, db, me = null, cb = {}, userSub = null, dataSubs = [], monthSubs = new Map(), pending = 0, aux = null;

export const pendingWrites = () => pending;
const changed = () => cb.onData && cb.onData();
function track(p) {
  pending++; changed();
  return p.catch(e => { cb.onError && cb.onError(e); }).finally(() => { pending--; changed(); });
}

// ---------- login ----------
export const normLogin = s => String(s || '').trim().toLowerCase();
export const loginValido = s => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(s);
const emailInterno = login => `${login}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@usuarios.dikma.app`;
const erroAuth = e => {
  const c = (e && e.code) || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'login/nao-existe'].includes(c)) return 'Usuário ou senha incorretos.';
  if (c === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (c === 'auth/network-request-failed') return 'Sem conexão com a internet.';
  if (c === 'auth/weak-password') return 'A senha precisa ter pelo menos 6 caracteres.';
  if (c === 'auth/operation-not-allowed') return 'O login por senha não está ativado no Firebase (Authentication > Método de login > E-mail/senha).';
  if (c === 'auth/requires-recent-login') return 'Por segurança, saia e entre de novo antes de trocar a senha.';
  return (e && e.message) || 'Erro inesperado.';
};
export { erroAuth };

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
  cfg = await loadConfig();
  if (!cfg) { cb.onAuth({ status: 'noConfig' }); return; }
  const app = initializeApp(cfg);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  getRedirectResult(auth).catch(e => cb.onError && cb.onError(e));
  onAuthStateChanged(auth, u => {
    stopAll();
    if (!u) { me = null; signedOutState(); return; }
    cb.onAuth({ status: 'loading' });
    // O perfil é criado pelo administrador; aqui só acompanhamos.
    userSub = onSnapshot(doc(db, 'usuarios', u.uid), s => {
      if (!s.exists()) { me = null; stopData(); cb.onAuth({ status: 'noProfile', user: { email: u.email } }); return; }
      const first = !me;
      me = { uid: u.uid, email: u.email, ...s.data() };
      if (first) updateDoc(s.ref, { ultimoAcesso: serverTimestamp() }).catch(() => {});
      if (!ATIVOS.has(me.papel)) { stopData(); cb.onAuth({ status: 'blocked', user: me }); return; }
      if (me.trocarSenha) { stopData(); cb.onAuth({ status: 'mustChange', user: me }); return; }
      if (!dataSubs.length) startData();
      cb.onAuth({ status: 'ready', user: me });
    }, e => cb.onAuth({ status: 'error', msg: e.message }));
  });
}

async function signedOutState() {
  let temAdmin = true;
  try { temAdmin = (await getDoc(doc(db, 'config', 'bootstrap'))).exists(); } catch (e) { /* sem sinal: mostra o login normal */ }
  cb.onAuth({ status: temAdmin ? 'signedOut' : 'firstAdmin' });
}

export async function signIn(loginDigitado, senha) {
  const login = normLogin(loginDigitado);
  if (!login || !senha) throw { code: 'login/nao-existe' };
  const l = await getDoc(doc(db, 'logins', login));
  if (!l.exists()) throw { code: 'login/nao-existe' };
  await signInWithEmailAndPassword(auth, l.data().email, senha);
}
// Entrada de emergência do administrador antigo (abrir o sistema com ?google).
export async function signInGoogle() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) return signInWithRedirect(auth, p); if (e.code !== 'auth/popup-closed-by-user') throw e; }
}
export const signOut = () => fbSignOut(auth);

// Primeiro administrador de um sistema novo (só aparece enquanto não existe nenhum).
export async function criarPrimeiroAdmin({ nome, login, senha }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  const email = emailInterno(login);
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  const uid = cred.user.uid;
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'bootstrap'), { uid, login });
  b.set(doc(db, 'usuarios', uid), { nome, login, papel: 'admin', area: null, trocarSenha: false, criadoEm: serverTimestamp() });
  b.set(doc(db, 'logins', login), { email, uid });
  await b.commit();
}

// Instância auxiliar: cria contas sem derrubar a sessão do administrador.
function authAux() {
  if (!aux) aux = initializeAuth(initializeApp(cfg, 'cadastro'), { persistence: inMemoryPersistence });
  return aux;
}
async function novaConta(login, senha) {
  const a = authAux();
  const email = emailInterno(login);
  const cred = await createUserWithEmailAndPassword(a, email, senha);
  const uid = cred.user.uid;
  await fbSignOut(a);
  return { email, uid };
}

export async function criarUsuario({ nome, login, senha, papel, area }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if ((await getDoc(doc(db, 'logins', login))).exists()) throw new Error(`O usuário "${login}" já existe.`);
  const { email, uid } = await novaConta(login, senha);
  const b = writeBatch(db);
  b.set(doc(db, 'usuarios', uid), { nome, login, papel, area: area || null, trocarSenha: true, criadoEm: serverTimestamp(), criadoPor: me.uid });
  b.set(doc(db, 'logins', login), { email, uid });
  await b.commit();
}

// Sem servidor pago não dá para trocar a senha de outra conta diretamente.
// Então o sistema cria uma conta interna nova para o mesmo usuário e desativa a antiga.
export async function redefinirSenha(uidAntigo, senhaNova) {
  if (uidAntigo === me.uid) throw new Error('Para a sua própria senha, use "Alterar minha senha".');
  const antigo = (await getDoc(doc(db, 'usuarios', uidAntigo))).data();
  if (!antigo || !antigo.login) throw new Error('Este usuário não tem login cadastrado.');
  const { email, uid } = await novaConta(antigo.login, senhaNova);
  const b = writeBatch(db);
  b.set(doc(db, 'usuarios', uid), { ...antigo, trocarSenha: true, senhaRedefinidaEm: serverTimestamp() });
  b.delete(doc(db, 'usuarios', uidAntigo));
  b.set(doc(db, 'logins', antigo.login), { email, uid });
  await b.commit();
}

// Troca obrigatória no primeiro acesso (logo depois de entrar, então não pede a senha atual).
export async function definirNovaSenha(nova) {
  await updatePassword(auth.currentUser, nova);
  await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { trocarSenha: false });
}
export async function alterarSenha(atual, nova) {
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, atual));
  await updatePassword(u, nova);
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

const toLocal = (id, x) => ({ id, ...x, m: x.m || {}, ev: x.ev || {}, d: x.ids.map(p => (x.s && x.s[p]) || '_______') });

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
export const saveConfig = patch => track(updateDoc(doc(db, 'config', 'sistema'), patch));

// ---------- evidências (fotos e arquivos) ----------
// Guardadas no próprio Firestore (plano grátis): a foto já chega reduzida pelo app.
const refEv = (docId, pid, k) => `${docId}#${pid}|${k}`;
export async function listarEvidencias(docId, pid, k) {
  const qs = await getDocs(query(collection(db, 'evidencias'), where('ref', '==', refEv(docId, pid, k))));
  return qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at ? x.at.toDate() : new Date() }; }).sort((a, b) => a.at - b.at);
}
export async function abrirEvidencia(id) { const s = await getDoc(doc(db, 'evidenciasArquivo', id)); return s.exists() ? s.data().dados : null; }
// Não espera o servidor: sem sinal, fica na fila e sobe quando a conexão voltar.
export function addEvidencia(e) {
  const r = doc(collection(db, 'evidencias'));
  const meta = { ref: refEv(e.docId, e.pid, e.k), semana: e.docId, area: e.area, pid: e.pid, k: e.k, nome: e.nome, tipo: e.tipo, tamanho: e.tamanho, thumb: e.thumb || '', por: me.uid, porNome: me.nome || me.login || '', at: serverTimestamp() };
  const b = writeBatch(db);
  b.set(r, meta);
  b.set(doc(db, 'evidenciasArquivo', r.id), { area: e.area, por: me.uid, dados: e.dados });
  b.update(doc(db, 'semanas', e.docId), new FieldPath('ev', e.pid + '|' + e.k), increment(1), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  track(b.commit());
  return { id: r.id, ...meta, at: new Date() };
}
export function removerEvidencia(ev) {
  const b = writeBatch(db);
  b.delete(doc(db, 'evidencias', ev.id));
  b.delete(doc(db, 'evidenciasArquivo', ev.id));
  b.update(doc(db, 'semanas', ev.semana), new FieldPath('ev', ev.pid + '|' + ev.k), increment(-1), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  return track(b.commit());
}
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
