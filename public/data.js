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
//   gestao/config             { codigo, revisao, declaracao, tipos[] }      (módulo Gestão)
//   gestao/colaboradores      { itens: [ {mat, nome, area, funcao, turma, lider, adm, dem, intAnt} ] }
//   gocorr/{id}               { data, mat, nome, tipo, desc, lider, status, assinadoEm, assinaturaId, metodo, testemunha }
//   gassin/{id}               { mat, ocorrIds[], metodo: tela|papel|recusa, colab, resp, respNome, foto, testemunhas[], em }
//   eq/config, eq/cadastro    módulo Operação: turnos, causas, metas, pesos, feriados · operadores e frota
//   eqlanc/{id} eqpar/{id} eqinsp/{id}   lançamentos, paradas e inspeções (campo mes = AAAA-MM)
//   integracao/senior        { estado, modo, recebidoEm, total, registros[], erro, aplicadoEm }  (ponte com o Senior)
//   eqaval/{AAAA-MM}          { itens: { OPERADOR: {proat, s5, seg, faltas, atrasos, atest, obs} } }
//   evidencias/{id}           { ref, semana, area, pid, k, nome, tipo, tamanho, thumb, por, porNome, at }  (lista leve)
//   evidenciasArquivo/{id}    { area, por, dados }   foto/arquivo completo (até ~900 KB), lido só ao abrir
// Atividades Bateria: as mesmas coleções com o prefixo b_ (b_config/sistema, b_plano, b_colaboradores, b_situacao,
//   b_semanas, b_evidencias, b_evidenciasArquivo). O conjunto ativo é escolhido com useSet('patio' | 'bateria').
// Um documento por área+semana: cada tela lê poucos documentos (cabe no plano grátis).

import {
  initializeApp, getAuth, initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut as fbSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, FieldPath, deleteField, arrayUnion, increment,
  getMessaging, getToken, deleteToken, mensagensSuportadas
} from './vendor/firebase.js';
import { SETS, SET_KEYS, ATIVOS, weeksOfMonth, novaSemana, seedParaBanco, setDaArea, today, addMonth } from './cal.js';

export const isMock = false;
// Dados de cada conjunto de atividades (Pátio e Bateria). cache.config, cache.plano etc. apontam para o conjunto ativo.
const novoSet = () => ({ config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, semanas: {}, monthsLoaded: new Set() });
const S = { patio: novoSet(), bateria: novoSet() };
let cur = 'patio';
export const useSet = k => { if (S[k]) cur = k; };
export const setAtual = () => cur;
export const dados = k => S[k];
const C = (n, k = cur) => SETS[k].pre + n;
export const cache = { log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, gVersao: 0, e: novoE(), eVersao: 0 };
for (const k of Object.keys(novoSet())) Object.defineProperty(cache, k, { get: () => S[cur][k], set: v => { S[cur][k] = v; }, enumerable: true });
function novoE() { return { loaded: false, config: null, cad: { operadores: [], frota: [] }, lanc: [], par: [], insp: [], aval: {}, meses: new Set() }; }
export const temEquip = u => !!u && (u.papel === 'admin' || (u.modulos || []).includes('equipamentos'));
export const temSet = (u, k) => !!u && (u.papel === 'admin' || (u.modulos || (k === 'patio' ? ['operacao'] : [])).includes(SETS[k].mod));
export const temOperacao = u => temSet(u, 'patio');
export const temBateria = u => temSet(u, 'bateria');
export const temGestao = u => !!u && (u.papel === 'admin' || (u.modulos || []).includes('gestao'));

let fbApp = null;
let gestaoOn = false, eqOn = false; const eMonthSubs = new Map();
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
  const app = fbApp = initializeApp(cfg);
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
      if (!dataSubs.length) startData(); else { if (temGestao(me) && !gestaoOn) startGestao(); if (temEquip(me) && !eqOn) startEquip(); }
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
  b.set(doc(db, 'usuarios', uid), { nome, login, papel: 'admin', area: null, modulos: ['operacao', 'gestao'], trocarSenha: false, criadoEm: serverTimestamp() });
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

export async function criarUsuario({ nome, login, senha, papel, area, area2, modulos }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if ((await getDoc(doc(db, 'logins', login))).exists()) throw new Error(`O usuário "${login}" já existe.`);
  const { email, uid } = await novaConta(login, senha);
  const b = writeBatch(db);
  b.set(doc(db, 'usuarios', uid), { nome, login, papel, area: area || null, area2: area2 || null, modulos: modulos || ['operacao'], trocarSenha: true, criadoEm: serverTimestamp(), criadoPor: me.uid });
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
  for (const k of SET_KEYS) {
    const st = S[k];
    if (!temSet(me, k)) { st.configLoaded = true; continue; }
    on(doc(db, C('config', k), 'sistema'), s => { st.config = s.exists() ? s.data() : null; st.configLoaded = true; changed(); });
    on(collection(db, C('plano', k)), qs => { st.plano = {}; qs.forEach(d => { st.plano[d.id] = d.data().itens || []; }); changed(); });
    on(collection(db, C('colaboradores', k)), qs => { st.colabs = {}; qs.forEach(d => { st.colabs[d.id] = d.data().itens || []; }); changed(); });
  }
  on(query(collection(db, 'historico'), orderBy('at', 'desc'), limit(40)), qs => {
    cache.log = qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { ...x, at: x.at ? x.at.toDate() : new Date() }; });
    changed();
  });
  if (temGestao(me)) startGestao();
  if (temEquip(me)) startEquip();
  // Avisos no celular: chave pública (config/avisos) e as preferências deste usuário (avisos/{uid}).
  // Abas por perfil (tela Perfis e permissões).
  on(doc(db, 'config', 'permissoes'), s => { cache.permissoes = s.exists() ? (s.data().abas || {}) : {}; changed(); });
  on(doc(db, 'config', 'avisos'), s => { cache.avisosCfg = s.exists() ? s.data() : {}; changed(); });
  on(doc(db, 'avisos', me.uid), s => { cache.meusAvisos = s.exists() ? s.data() : null; changed(); });
  if (me.papel === 'admin') on(collection(db, 'usuarios'), qs => { cache.usuarios = qs.docs.map(d => ({ uid: d.id, ...d.data() })); changed(); });
  const keep = [...monthSubs.keys()]; monthSubs.clear();
  // já liga os meses de todos os conjuntos da pessoa: trocar de módulo ou abrir o Meu dia não espera o servidor
  for (const k of SET_KEYS) watchSet(k, keep.filter(x => x.startsWith(k + '|')).map(x => x.slice(k.length + 1)));
}
function stopData() {
  dataSubs.forEach(f => f()); dataSubs = []; gestaoOn = false; eqOn = false;
  for (const fs of eMonthSubs.values()) fs.forEach(f => f()); eMonthSubs.clear();
  for (const fs of monthSubs.values()) fs.forEach(f => f());
  monthSubs.clear();
  for (const k of SET_KEYS) S[k] = novoSet();
  Object.assign(cache, { log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, e: novoE() });
}
function stopAll() { if (userSub) { userSub(); userSub = null; } stopData(); }

const toLocal = (id, x) => ({ id, ...x, m: x.m || {}, ev: x.ev || {}, d: x.ids.map(p => (x.s && x.s[p]) || '_______') });

// Meses em tempo real. O mês anterior, o atual e o próximo ficam sempre ligados (Meu dia, Painel, avisos);
// os outros que a pessoa abrir ficam ligados até 4 de cada vez (os mais antigos saem). Assim, voltar a uma
// tela já vista não recarrega nada.
const mesesBase = () => { const m = today().slice(0, 7); return [addMonth(m, -1), m, addMonth(m, 1)]; };
const usoMes = new Map(); // "conjunto|mês" → último uso
export function watchMonths(meses) { watchSet(cur, meses); }
function watchSet(k, meses) {
  const st = S[k], key = m => k + '|' + m;
  if (me && !temSet(me, k)) return;
  const want = [...new Set([...mesesBase(), ...meses.filter(Boolean)])];
  if (!me || !ATIVOS.has(me.papel) || !db) { want.forEach(m => monthSubs.set(key(m), [])); return; }
  const agora = Date.now(); meses.filter(Boolean).forEach(m => usoMes.set(key(m), agora));
  for (const m of want) if (!monthSubs.has(key(m)) || !monthSubs.get(key(m)).length) {
    const a = onSnapshot(query(collection(db, C('semanas', k)), where('mes', '==', m)), qs => {
      qs.docChanges().forEach(c => { if (c.type === 'removed') delete st.semanas[c.doc.id]; else st.semanas[c.doc.id] = toLocal(c.doc.id, c.doc.data()); });
      st.monthsLoaded.add(m); changed();
    }, e => cb.onError && cb.onError(e));
    const b = onSnapshot(doc(db, C('situacao', k), m), s => { st.sitByMonth[m] = (s.exists() && s.data().v) || {}; changed(); });
    monthSubs.set(key(m), [a, b]);
  }
  // limita os meses extras (fora da base) a 4 por conjunto
  const base = new Set(mesesBase());
  const extras = [...monthSubs.keys()].filter(x => x.startsWith(k + '|') && !base.has(x.slice(k.length + 1))).sort((x, y) => (usoMes.get(y) || 0) - (usoMes.get(x) || 0));
  for (const mk of extras.slice(4)) {
    const m = mk.slice(k.length + 1); if (want.includes(m)) continue;
    (monthSubs.get(mk) || []).forEach(f => f()); monthSubs.delete(mk); st.monthsLoaded.delete(m); delete st.sitByMonth[m];
    for (const id of Object.keys(st.semanas)) if (st.semanas[id].mes === m) delete st.semanas[id];
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
  return track(updateDoc(doc(db, C('semanas'), docId), ...args));
}
export function setSit(key, code) {
  const m = key.split('|')[1].slice(0, 7);
  return track(setDoc(doc(db, C('situacao'), m), { v: { [key]: code || deleteField() } }, { merge: true }));
}
export const savePlano = (area, itens) => track(setDoc(doc(db, C('plano'), area), { itens }));
// k = conjunto (patio | bateria); o cadastro do Efetivo grava nos dois, seja qual for o módulo aberto.
export const salvarColabsArea = (area, itens, k = setDaArea(area) || cur) => track(setDoc(doc(db, C('colaboradores', k), area), { itens }));
export const saveRotas = rotas => track(updateDoc(doc(db, C('config'), 'sistema'), { rotas }));
export const saveConfig = patch => track(updateDoc(doc(db, C('config'), 'sistema'), patch));

// ---------- evidências (fotos e arquivos) ----------
// Guardadas no próprio Firestore (plano grátis): a foto já chega reduzida pelo app.
const refEv = (docId, pid, k) => `${docId}#${pid}|${k}`;
export async function listarEvidencias(docId, pid, k) {
  const qs = await getDocs(query(collection(db, C('evidencias')), where('ref', '==', refEv(docId, pid, k))));
  return qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at ? x.at.toDate() : new Date() }; }).sort((a, b) => a.at - b.at);
}
// Relatório fotográfico: lista leve (miniaturas) de várias semanas de uma vez.
export async function listarEvidenciasSemanas(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 30) {
    const qs = await getDocs(query(collection(db, C('evidencias')), where('semana', 'in', ids.slice(i, i + 30))));
    qs.docs.forEach(d => { const x = d.data({ serverTimestamps: 'estimate' }); out.push({ id: d.id, ...x, at: x.at ? x.at.toDate() : new Date() }); });
  }
  return out;
}
export async function abrirEvidencia(id) { const s = await getDoc(doc(db, C('evidenciasArquivo'), id)); return s.exists() ? s.data().dados : null; }
// Não espera o servidor: sem sinal, fica na fila e sobe quando a conexão voltar.
export function addEvidencia(e) {
  const k = setDaArea(e.area) || cur;
  const r = doc(collection(db, C('evidencias', k)));
  const meta = { ref: refEv(e.docId, e.pid, e.k), semana: e.docId, area: e.area, pid: e.pid, k: e.k, nome: e.nome, tipo: e.tipo, tamanho: e.tamanho, thumb: e.thumb || '', por: me.uid, porNome: me.nome || me.login || '', at: serverTimestamp() };
  const b = writeBatch(db);
  b.set(r, meta);
  b.set(doc(db, C('evidenciasArquivo', k), r.id), { area: e.area, por: me.uid, dados: e.dados });
  b.update(doc(db, C('semanas', k), e.docId), new FieldPath('ev', e.pid + '|' + e.k), increment(1), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  track(b.commit());
  return { id: r.id, ...meta, at: new Date() };
}
export function removerEvidencia(ev) {
  const k = setDaArea(ev.area) || cur;
  const b = writeBatch(db);
  b.delete(doc(db, C('evidencias', k), ev.id));
  b.delete(doc(db, C('evidenciasArquivo', k), ev.id));
  b.update(doc(db, C('semanas', k), ev.semana), new FieldPath('ev', ev.pid + '|' + ev.k), increment(-1), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  return track(b.commit());
}
// Apaga o acesso: sem o cadastro e sem o login, a pessoa não entra mais.
// (A conta interna do Firebase Authentication fica órfã e pode ser apagada no console, se quiser.)
export async function excluirUsuario(uid) {
  if (uid === me.uid) throw new Error('Você não pode apagar o seu próprio usuário.');
  const u = (await getDoc(doc(db, 'usuarios', uid))).data();
  const b = writeBatch(db);
  b.delete(doc(db, 'usuarios', uid));
  if (u && u.login) { const l = await getDoc(doc(db, 'logins', u.login)); if (l.exists() && l.data().uid === uid) b.delete(l.ref); }
  await track(b.commit());
}
// ---------- avisos no celular ----------
const TOKEN_LS = 'dikma-aviso-token';
export async function avisosSuportados() {
  try { return 'Notification' in window && 'serviceWorker' in navigator && location.protocol === 'https:' && await mensagensSuportadas(); } catch (e) { return false; }
}
export async function ativarAvisos(prefs) {
  const vapid = cache.avisosCfg && cache.avisosCfg.vapid;
  if (!vapid) throw new Error('O administrador ainda não configurou os avisos (falta a chave Web Push).');
  if (!(await avisosSuportados())) throw new Error('Este navegador não recebe avisos. No iPhone, primeiro adicione o sistema à tela de início (Compartilhar › Adicionar à Tela de Início) e abra por lá.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Os avisos foram bloqueados neste aparelho. Libere nas configurações do navegador (cadeado ao lado do endereço › Notificações).');
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(fbApp), { vapidKey: vapid, serviceWorkerRegistration: reg });
  if (!token) throw new Error('Não foi possível ativar os avisos neste aparelho.');
  try { localStorage.setItem(TOKEN_LS, token); } catch (e) { /* ignora */ }
  await setDoc(doc(db, 'avisos', me.uid), { tokens: arrayUnion(token), prefs, atualizadoEm: serverTimestamp() }, { merge: true });
}
export const avisoAtivoAqui = () => { try { const t = localStorage.getItem(TOKEN_LS); return !!t && !!(cache.meusAvisos && (cache.meusAvisos.tokens || []).includes(t)); } catch (e) { return false; } };
export async function desativarAvisos() {
  let t = null; try { t = localStorage.getItem(TOKEN_LS); localStorage.removeItem(TOKEN_LS); } catch (e) { /* ignora */ }
  try { await deleteToken(getMessaging(fbApp)); } catch (e) { /* já estava sem token */ }
  const atual = (cache.meusAvisos && cache.meusAvisos.tokens) || [];
  await setDoc(doc(db, 'avisos', me.uid), { tokens: atual.filter(x => x !== t), atualizadoEm: serverTimestamp() }, { merge: true });
}
export const salvarPrefsAvisos = prefs => track(setDoc(doc(db, 'avisos', me.uid), { prefs, atualizadoEm: serverTimestamp() }, { merge: true }));
export const salvarPermissoes = abas => track(setDoc(doc(db, 'config', 'permissoes'), { abas, atualizadoEm: serverTimestamp(), por: me.nome || me.login || '' }));
export const salvarChaveAvisos = vapid => track(setDoc(doc(db, 'config', 'avisos'), { vapid: String(vapid || '').trim() }, { merge: true }));

export const setUsuario = (uid, patch) => track(updateDoc(doc(db, 'usuarios', uid), patch));
export function log(t) { if (!me) return; addDoc(collection(db, 'historico'), { at: serverTimestamp(), uid: me.uid, nome: me.nome || me.email, t }).catch(() => {}); }

export async function gerarMes(ym, planoPorArea, aPartirDe, k = cur) {
  const exist = await getDocs(query(collection(db, C('semanas', k)), where('mes', '==', ym)));
  const have = new Set(exist.docs.map(d => d.id));
  const b = writeBatch(db); let n = 0;
  for (const ini of weeksOfMonth(ym)) {
    if (aPartirDe && ini < aPartirDe) continue;
    for (const area of SETS[k].areas) {
      const id = area + '|' + ini; if (have.has(id)) continue;
      const w = novaSemana(area, ini, planoPorArea[area] || []);
      b.set(doc(db, C('semanas', k), id), { ...w, criadoEm: serverTimestamp() }); n += w.ids.length;
    }
  }
  b.update(doc(db, C('config', k), 'sistema'), { meses: arrayUnion(ym) });
  await b.commit();
  return n;
}

export async function importar(seed, meses, aPartirDe) {
  const k = cur, areas = SETS[k].areas;
  const x = seedParaBanco(seed, areas);
  const b = writeBatch(db);
  b.set(doc(db, C('config', k), 'sistema'), { ...x.config, importadoEm: serverTimestamp() });
  for (const a of areas) { b.set(doc(db, C('plano', k), a), { itens: x.plano[a] }); b.set(doc(db, C('colaboradores', k), a), { itens: x.colabs[a] }); }
  for (const [m, v] of Object.entries(x.sit)) b.set(doc(db, C('situacao', k), m), { v });
  await b.commit();
  for (const m of meses) await gerarMes(m, x.plano, aPartirDe, k);
}

// ---------- módulo Gestão (fichas de acompanhamento) ----------
function startGestao() {
  gestaoOn = true;
  const ok = { c: false, l: false, o: false };
  const g = () => { cache.g.loaded = ok.c && ok.l && ok.o; cache.gVersao++; changed(); };
  const on = (q, fn) => dataSubs.push(onSnapshot(q, fn, e => cb.onError && cb.onError(e)));
  on(doc(db, 'gestao', 'config'), s => { cache.g.config = s.exists() ? s.data() : null; ok.c = true; g(); });
  on(doc(db, 'gestao', 'colaboradores'), s => { cache.g.colabs = (s.exists() && s.data().itens) || []; ok.l = true; g(); });
  on(collection(db, 'gocorr'), qs => { cache.g.ocorr = qs.docs.map(d => ({ id: d.id, ...d.data() })); ok.o = true; g(); });
  // Ponte com o Senior: o que a rotina do GitHub trouxe (só o administrador vê).
  if (me.papel === 'admin') on(doc(db, 'integracao', 'senior'), s => { const x = s.exists() ? s.data({ serverTimestamps: 'estimate' }) : null; cache.g.senior = x ? { ...x, recebidoEm: x.recebidoEm && x.recebidoEm.toDate ? x.recebidoEm.toDate() : null, tentativaEm: x.tentativaEm && x.tentativaEm.toDate ? x.tentativaEm.toDate() : null, aplicadoEm: x.aplicadoEm && x.aplicadoEm.toDate ? x.aplicadoEm.toDate() : null } : null; changed(); });
}
export const gSeniorAplicado = () => track(updateDoc(doc(db, 'integracao', 'senior'), { aplicadoEm: serverTimestamp(), aplicadoPor: me.nome || me.login || '' }));
const gch = () => { cache.gVersao++; changed(); };
export async function gImportar(seed) {
  const b = writeBatch(db);
  b.set(doc(db, 'gestao', 'config'), { codigo: seed.codigo, revisao: seed.revisao, declaracao: seed.declaracao, tipos: seed.tipos, importadoEm: serverTimestamp() });
  b.set(doc(db, 'gestao', 'colaboradores'), { itens: seed.colabs });
  for (const o of seed.ocorrencias) b.set(doc(collection(db, 'gocorr')), { ...o, metodo: o.status === 'assinada' ? 'importado' : null, assinaturaId: null, criadoPor: me.uid, criadoEm: serverTimestamp() });
  await b.commit();
}
// Importação: grava várias ocorrências de uma vez (lotes de 400 por gravação).
export async function gImportarOcorrencias(lista) {
  for (let i = 0; i < lista.length; i += 400) {
    const b = writeBatch(db);
    for (const o of lista.slice(i, i + 400)) b.set(doc(collection(db, 'gocorr')), { assinadoEm: null, testemunha: '', ...o, metodo: o.status === 'pendente' ? null : 'importado', assinaturaId: null, criadoPor: me.uid, criadoEm: serverTimestamp() });
    await track(b.commit());
  }
}
export const gSalvarColabs = itens => track(setDoc(doc(db, 'gestao', 'colaboradores'), { itens }));
export const gSalvarConfig = patch => track(setDoc(doc(db, 'gestao', 'config'), patch, { merge: true }));
export function gNovaOcorrencia(o) {
  const r = doc(collection(db, 'gocorr'));
  track(setDoc(r, { ...o, assinadoEm: null, assinaturaId: null, metodo: null, testemunha: '', criadoPor: me.uid, criadoEm: serverTimestamp() }));
  return { id: r.id, ...o };
}
export async function gExcluirOcorrencias(ids) {
  for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(doc(db, 'gocorr', id))); await track(b.commit()); }
}
export function gExcluirOcorrencia(id) { const b = writeBatch(db); b.delete(doc(db, 'gocorr', id)); return track(b.commit()); }
export function gAssinar(a) {
  const r = doc(collection(db, 'gassin'));
  const b = writeBatch(db);
  const reg = { ...a, por: me.uid, porNome: me.nome || me.login || '' };
  b.set(r, { ...reg, criadoEm: serverTimestamp() });
  for (const id of a.ocorrIds) b.update(doc(db, 'gocorr', id), { status: a.metodo === 'recusa' ? 'recusada' : 'assinada', assinadoEm: a.metodo === 'recusa' ? null : a.em, assinaturaId: r.id, metodo: a.metodo, testemunha: (a.testemunhas || []).join(' e ') });
  cache.gAssin[r.id] = reg;
  track(b.commit());
  return r.id;
}
export async function gAbrirAssinatura(id) {
  if (cache.gAssin[id]) return cache.gAssin[id];
  const s = await getDoc(doc(db, 'gassin', id)); if (!s.exists()) return null;
  cache.gAssin[id] = s.data(); return cache.gAssin[id];
}
const carregando = new Set();
export function gCarregarAssin(id) {
  if (!id || cache.gAssin[id] || carregando.has(id)) return; carregando.add(id);
  getDoc(doc(db, 'gassin', id)).then(s => { if (s.exists()) { cache.gAssin[id] = s.data(); gch(); } }).catch(() => {}).finally(() => carregando.delete(id));
}

// ---------- módulo Operação (controle de equipamentos) ----------
const EQCOL = { lanc: 'eqlanc', par: 'eqpar', insp: 'eqinsp' };
function startEquip() {
  eqOn = true;
  const ok = { c: false, d: false };
  const g = () => { cache.e.loaded = ok.c && ok.d; cache.eVersao++; changed(); };
  const on = (q, fn) => dataSubs.push(onSnapshot(q, fn, e => cb.onError && cb.onError(e)));
  on(doc(db, 'eq', 'config'), s => { cache.e.config = s.exists() ? s.data() : null; ok.c = true; g(); });
  on(doc(db, 'eq', 'cadastro'), s => { const d = s.exists() ? s.data() : {}; cache.e.cad = { operadores: (d.operadores || []).filter(o => !/^SITUA[ÇC][ÃA]O:/i.test(o.nome || '')), frota: d.frota || [] }; ok.d = true; g(); });
  { const m = today().slice(0, 7); eWatch([addMonth(m, -1), m]); } // paradas e lançamentos já chegam antes de abrir a tela
}
// Mantém em tempo real só os meses que a tela usa (economiza leituras do plano grátis).
export function eWatch(meses) {
  if (!db || !eqOn) return;
  for (const m of new Set(meses.filter(Boolean))) {
    if (eMonthSubs.has(m)) continue;
    const st = { l: false, p: false, i: false, a: false };
    const done = () => { if (st.l && st.p && st.i && st.a) cache.e.meses.add(m); cache.eVersao++; changed(); };
    const err = e => cb.onError && cb.onError(e);
    const sub = (col, key, f) => onSnapshot(query(collection(db, col), where('mes', '==', m)), qs => {
      cache.e[key] = cache.e[key].filter(x => x.mes !== m).concat(qs.docs.map(d => ({ id: d.id, ...d.data() }))); st[f] = true; done();
    }, err);
    eMonthSubs.set(m, [sub('eqlanc', 'lanc', 'l'), sub('eqpar', 'par', 'p'), sub('eqinsp', 'insp', 'i'),
      onSnapshot(doc(db, 'eqaval', m), s => { cache.e.aval[m] = (s.exists() && s.data().itens) || {}; st.a = true; done(); }, err)]);
  }
}
export function eAdd(tipo, o) { const r = doc(collection(db, EQCOL[tipo])); track(setDoc(r, { ...o, mes: o.data.slice(0, 7), por: me.uid, em: serverTimestamp() })); return r.id; }
export function eUpd(tipo, id, patch) { const p = { ...patch }; if (p.data) p.mes = p.data.slice(0, 7); return track(updateDoc(doc(db, EQCOL[tipo], id), p)); }
export function eDel(tipo, id) { const b = writeBatch(db); b.delete(doc(db, EQCOL[tipo], id)); return track(b.commit()); }
export const eSalvarConfig = patch => track(setDoc(doc(db, 'eq', 'config'), patch, { merge: true }));
export const eSalvarCad = patch => track(setDoc(doc(db, 'eq', 'cadastro'), patch, { merge: true }));
export const eSalvarAval = (mes, op, vals) => track(setDoc(doc(db, 'eqaval', mes), { itens: { [op]: vals } }, { merge: true }));
export async function eCarregarTudo() {
  const ler = async c => (await getDocs(collection(db, c))).docs.map(d => ({ id: d.id, ...d.data() }));
  const [lanc, par, insp] = await Promise.all([ler('eqlanc'), ler('eqpar'), ler('eqinsp')]);
  return { lanc, par, insp };
}
export async function eImportar(seed) {
  const b0 = writeBatch(db);
  b0.set(doc(db, 'eq', 'config'), { ...seed.config, importadoEm: serverTimestamp() });
  b0.set(doc(db, 'eq', 'cadastro'), { operadores: seed.operadores, frota: seed.frota });
  for (const [m, itens] of Object.entries(seed.aval || {})) b0.set(doc(db, 'eqaval', m), { itens });
  await b0.commit();
  const todos = [...seed.lanc.map(x => ['eqlanc', x]), ...seed.paradas.map(x => ['eqpar', x])];
  for (let i = 0; i < todos.length; i += 400) {
    const b = writeBatch(db);
    for (const [c, x] of todos.slice(i, i + 400)) b.set(doc(collection(db, c)), { ...x, mes: x.data.slice(0, 7), por: me.uid, em: serverTimestamp() });
    await b.commit();
  }
}
