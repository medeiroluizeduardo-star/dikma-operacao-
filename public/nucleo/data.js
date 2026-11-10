// Camada de dados — Firebase (Auth + Firestore).
// Login por USUÁRIO e SENHA. Só o administrador cadastra pessoas.
// Por baixo, o Firebase Auth usa um e-mail interno gerado pelo sistema (ninguém precisa saber dele).
// Estrutura no Firestore:
//   config/bootstrap          { uid }                 quem criou o primeiro administrador (gravado só pela rotina do GitHub)
//   seeds/{nome}              { json, atualizadoEm }  dados das planilhas para importar (gravado na publicação; só administração lê)
//   config/sistema            { rotas[], tipos[], meses[] }
//   logins/{login}            { email, uid }          liga o usuário digitado à conta interna
//   usuarios/{uid}            { nome, login, papel, area, trocarSenha }
//   plano/{ÁREA}              { itens: [ {id, area, rota, local, ativ, tipo, dias:"1111100", ativo} ] }
//   colaboradores/{ÁREA}      { itens: [ {id, area, rota, nome, funcao, regime} ] }
//   situacao/{AAAA-MM}        { v: { "C001|2026-10-03": "F" } }
//   semanas/{ÁREA|AAAA-MM-DD} { area, ini, mes, ids[], s: { "REC-001": "RRNPP__" }, m: { "REC-001|2": "motivo" },
//                             dx: { "REC-001|3": "AAAA-MM-DD" },   dx = pendência dispensada na Limpeza de dados (a célula fica "_")
//                             fe: { "REC-001|0": "Finados" } }     fe = feriado sem operação (a célula fica "_"; feriados.js)
//   historico/{auto}          { at, uid, nome, t }
//   treinos/{id}              { mat, nome, setor, tipo, realizado, validade, obs }  treinamentos, NRs e ASO (RH e Segurança; contas/treinos.js)
//   gestao/config             { codigo, revisao, declaracao, tipos[] }      (módulo Gestão)
//   gcolab/{ÁREA}             { itens: [ {mat, nome, area, funcao, turma, lider, adm, dem, intAnt} ] }  fichas, uma por área
//                             (área das Atividades, OPERAÇÃO DE EQUIPAMENTOS ou GERAL). Cada um lê só as áreas dele.
//   gocorr/{id}               { area, data, mat, nome, tipo, desc, lider, recolhe, status, assinadoEm, assinaturaId, metodo, testemunha }
//   gassin/{id}               { area, mat, ocorrIds[], metodo: tela|papel|recusa, colab, resp, respNome, foto, testemunhas[], em }
//   eq/config, eq/cadastro    módulo Operação: turnos, causas, metas, pesos, feriados · operadores e frota
//   eqlanc/{id} eqpar/{id} eqinsp/{id}   lançamentos, paradas e inspeções (campo mes = AAAA-MM)
//   integracao/senior        { estado, modo, recebidoEm, total, registros[], erro, aplicadoEm }  (ponte com o Senior)
//   eqaval/{AAAA-MM}          { itens: { OPERADOR: {proat, s5, seg, faltas, atrasos, atest, obs} } }
//   ---- FOTOS DAS ATIVIDADES (contas em fotos.js; explicação completa em docs/fotos-atividades.md) ----
//   config/fotos              { obrig, min, max, situacoes: ['R','E'(,'N')], desde: 'AAAA-MM-DD', atualizadoEm, por }
//                             grava só o administrador (Administração › Fotos das atividades). Sem o documento vale o
//                             padrão de fotos.js (obrig true, min 1, max 3, R e E). desde = a partir de quando contam as
//                             realizadas "sem foto" (antes disso não se pedia foto: não é retroativo).
//   semanas/{id}.ft           { 'PID|k': n }  quantas fotos cada célula tem (sobe no MESMO lote que grava a foto); as telas
//                             mostram 📷n sem ler as fotos. ev = contagem do código antigo de evidências (somada a ft).
//   evidencias/{id}           documento leve, um por foto (a mesma foto pode valer para várias atividades do dia e rota):
//     refs[]       'ÁREA|AAAA-MM-DD|PID|k' (semana|pid|dia da semana) de cada atividade que a foto comprova (até 100)
//     semana, area, conj ('patio'|'bateria'), pid (o 1º de refs), k (0 = segunda), dia 'AAAA-MM-DD', mes 'AAAA-MM'
//     rota, local, ativ   descrição (com várias atividades: "N atividades: a; b; …") · sit  situação ao fotografar (R|N|E)
//     thumb        miniatura JPEG 240 px em texto data:… (até 40 mil caracteres; ~15 KB)
//     nome, tipo ('image/jpeg'), tamanho = bytes (tamanho do JPEG completo), w, h (pixels da foto completa)
//     sha          SHA-256 (hex) dos bytes do JPEG completo, calculado no aparelho ('' se o navegador não deixar)
//     por, porNome, at (hora do servidor)                                         ← gravados na criação, não mudam
//     exportadoEm, exportLote, lixeiraEm, removidaEm   null na criação; SÓ O ADMINISTRADOR altera (Parte 2: exportação
//                  em .zip, lixeira e remoção do arquivo). exportConf = conferência do SHA-256 na exportação ('ok' |
//                  'divergente' | 'sem-sha'). As telas escondem a foto na lixeira; a arquivada fora do banco (removidaEm:
//                  arquivo completo apagado) aparece só com a miniatura e o selo. A contagem ft da semana não diminui.
//     atualizadoEm, atualizadoPor   quando alguém altera depois
//     Quem altera: o autor só ajusta refs (até 24 h depois da foto, na área em que aponta); o administrador altera refs
//     e os campos de exportação/lixeira/remoção. Apagar: só o administrador.
//   evidenciasArquivo/{id}    { area, semana, dia, sha, por, dados }  mesmo id do leve; dados = JPEG completo em texto data:…
//                             (até 900 mil caracteres; alvo ~200 mil). Lido só ao abrir a foto grande ou exportar.
//   Gravação: semana (s, m, ft) + evidencias + evidenciasArquivo no MESMO writeBatch (apontarComFotos): sem sinal fica tudo
//   na fila do aparelho e sobe junto — nunca fica apontamento sem foto nem foto sem apontamento.
//   config/seguranca          { areas[{nome, conj}], tipos[], regimes[], desvios[] }   listas dos formulários da Segurança
//   segdds/{id}               DDS antigos (a função saiu do site em 2026-11; os dados ficam guardados no banco)
//   seginter/{id}             registro de interação { data, mes, area, conj, local, tipoAtiv, risco, desvios[], desvioOutro,
//                             desc, acao, resp, mat, fotos[ids], minis[], por, porNome, em }
//   seganom/{id}              registro de anomalia { data, hora, mes, area, conj, local, regime, desc, conseq, acao, causas,
//                             sugest, comunic, mat, fotos[], minis[], por, porNome, em, status, trat{resp, respUid, prazo,
//                             coment, fotoDepois, miniDepois, hist[]}, conclEm }
//   segfotos/{id}             { reg, col, tipo: antes|depois, mini, dados, ordem, autor, por, conj, area, mes, em }  uma foto
//                             por documento (até ~700 KB); a lista usa só as miniaturas que ficam no registro
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
  getMessaging, getToken, deleteToken, mensagensSuportadas, initializeAppCheck, ReCaptchaEnterpriseProvider
} from '../vendor/firebase.js';
import { CHAVE_SITE } from './appcheck.js';
import { SETS, SET_KEYS, ATIVOS, weeksOfMonth, novaSemana, seedParaBanco, setDaArea, today, addMonth, add, weekOf, monthOfWeek } from '../contas/cal.js';
import { chaveFicha, veTodasFichas, areasFichaDe, FICHA_GERAL } from '../contas/pessoas.js';
import { temFreq, resumoFerias, marcasDe, ehAdminU } from '../contas/acessos.js';
import { veTreinos } from '../contas/treinos.js';
import { competenciaDe } from '../contas/planilhas-adm.js';
import { temSeg, veTudoSeg, registraSeg, supConjs, fotosDoReg } from '../contas/segcalc.js';
import { mapaFeriados, aplicarNaSemana } from '../contas/feriados.js';
import { incrementosFt } from '../contas/fotos.js';

export const isMock = false;
// Dados de cada conjunto de atividades (Pátio e Bateria). cache.config, cache.plano etc. apontam para o conjunto ativo.
const novoSet = () => ({ config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, sitExtra: {}, semanas: {}, aprov: {}, acoes: {}, monthsLoaded: new Set() });
const S = { patio: novoSet(), bateria: novoSet() };
let cur = 'patio';
export const useSet = k => { if (S[k]) cur = k; };
export const setAtual = () => cur;
export const dados = k => S[k];
const C = (n, k = cur) => SETS[k].pre + n;
export const cache = { treinos: [], tLoaded: false, log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, gVersao: 0, e: novoE(), eVersao: 0 };
for (const k of Object.keys(novoSet())) Object.defineProperty(cache, k, { get: () => S[cur][k], set: v => { S[cur][k] = v; }, enumerable: true });
function novoE() { return { loaded: false, config: null, cad: { operadores: [], frota: [] }, lanc: [], par: [], insp: [], aval: {}, meses: new Set() }; }
// Que dados carregar: tirado do acesso por módulo (escopos com Operação ou Gestão, Fichas, RH).
export const temEquip = u => marcasDe(u).includes('equipamentos');
export const temSet = (u, k) => marcasDe(u).includes(SETS[k].mod);
export const temOperacao = u => temSet(u, 'patio');
export const temBateria = u => temSet(u, 'bateria');
export const temGestao = u => marcasDe(u).includes('gestao');

let fbApp = null;
let gestaoOn = false, eqOn = false; const eMonthSubs = new Map();
let cfg, auth, db, me = null, cb = {}, userSub = null, dataSubs = [], monthSubs = new Map(), pending = 0, aux = null;

export const pendingWrites = () => pending;
const changed = () => cb.onData && cb.onData();
// Só o selo de sincronização muda aqui: o dado em si já chega pelo onSnapshot (sem redesenhar a tela inteira de novo).
const syncMudou = () => (cb.onSync ? cb.onSync() : changed());
function track(p) {
  pending++; syncMudou();
  return p.catch(e => { cb.onError && cb.onError(e); }).finally(() => { pending--; syncMudou(); });
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
  if (c === 'auth/weak-password' || c === 'auth/password-does-not-meet-requirements') return 'A senha precisa ter pelo menos 8 caracteres.';
  if (c === 'auth/operation-not-allowed') return 'O login por senha não está ativado no Firebase (Authentication > Método de login > E-mail/senha).';
  if (c === 'auth/requires-recent-login') return 'Por segurança, saia e entre de novo antes de trocar a senha.';
  return (e && e.message) || 'Erro inesperado.';
};
export { erroAuth };

async function loadConfig() {
  // Abertura rápida: com a configuração já guardada neste aparelho, entra na hora e só confere a do servidor em segundo plano.
  try {
    const c = JSON.parse(localStorage.getItem('coqueria-fbcfg') || 'null');
    if (c && c.apiKey) {
      fetch('/__/firebase/init.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(n => { if (n && n.apiKey) localStorage.setItem('coqueria-fbcfg', JSON.stringify(n)); }).catch(() => { /* sem sinal */ });
      return c;
    }
  } catch (e) { /* ignora */ }
  // No Firebase Hosting a configuração vem pronta deste endereço reservado.
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (r.ok) { const c = await r.json(); try { localStorage.setItem('coqueria-fbcfg', JSON.stringify(c)); } catch (e) { /* ignora */ } return c; }
  } catch (e) { /* sem sinal ou fora do Firebase Hosting */ }
  try { const c = JSON.parse(localStorage.getItem('coqueria-fbcfg') || 'null'); if (c && c.apiKey) return c; } catch (e) { /* ignora */ }
  try { const m = await import('../firebase-config.js'); if (m.default && m.default.apiKey) return m.default; } catch (e) { /* sem arquivo local */ }
  return null;
}

// Sessão expira depois de 7 dias sem abrir o sistema (celular compartilhado ou perdido). O uso fica marcado neste aparelho.
const USO_LS = 'dikma-ultimo-uso', SEM_USO_MAX = 7 * 864e5;
let sessaoExpirou = false;
export function marcarUso() { try { const agora = Date.now(); if (agora - (+localStorage.getItem(USO_LS) || 0) > 6e5) localStorage.setItem(USO_LS, String(agora)); } catch (e) { /* sem armazenamento: não expira */ } }
function expirouSemUso() { try { const t = +localStorage.getItem(USO_LS) || 0; return !!t && Date.now() - t > SEM_USO_MAX; } catch (e) { return false; } }

export async function start(callbacks) {
  cb = callbacks;
  cfg = await loadConfig();
  if (!cfg) { cb.onAuth({ status: 'noConfig' }); return; }
  const app = fbApp = initializeApp(cfg);
  // App Check (nucleo/appcheck.js): só com chave e só no endereço oficial (no computador de teste não funciona).
  if (CHAVE_SITE && /(^|\.)(web\.app|firebaseapp\.com)$/.test(location.hostname)) {
    try { initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(CHAVE_SITE), isTokenAutoRefreshEnabled: true }); } catch (e) { console.warn('App Check não ligou', e); }
  }
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  getRedirectResult(auth).catch(e => cb.onError && cb.onError(e));
  onAuthStateChanged(auth, u => {
    stopAll();
    if (!u) { me = null; signedOutState(); return; }
    if (expirouSemUso()) { sessaoExpirou = true; try { localStorage.removeItem(USO_LS); } catch (e) { /* ignora */ } fbSignOut(auth); return; }
    marcarUso();
    cb.onAuth({ status: 'loading' });
    // O perfil é criado pelo administrador; aqui só acompanhamos.
    userSub = onSnapshot(doc(db, 'usuarios', u.uid), s => {
      if (!s.exists()) { me = null; stopData(); cb.onAuth({ status: 'noProfile', user: { email: u.email } }); return; }
      const first = !me;
      me = { uid: u.uid, email: u.email, ...s.data() };
      if (first) updateDoc(s.ref, { ultimoAcesso: serverTimestamp() }).catch(() => {});
      if (!ATIVOS.has(me.papel)) { stopData(); cb.onAuth({ status: 'blocked', user: me }); return; }
      if (me.trocarSenha) { stopData(); cb.onAuth({ status: 'mustChange', user: me }); return; }
      // Sem nenhum módulo (nem perfil em algum módulo) não entra.
      if (!temAlgumModulo(me)) { stopData(); cb.onAuth({ status: 'semAcesso', user: me }); return; }
      if (!dataSubs.length) startData(); else { if (temGestao(me) && !gestaoOn) startGestao(); if (temEquip(me) && !eqOn) startEquip(); if (temSeg(me) && !segOn) startSeg(); }
      cb.onAuth({ status: 'ready', user: me });
    }, e => cb.onAuth({ status: 'error', msg: e.message }));
  });
}

async function signedOutState() {
  let temAdmin = true;
  try { temAdmin = (await getDoc(doc(db, 'config', 'bootstrap'))).exists(); } catch (e) { /* sem sinal: mostra o login normal */ }
  cb.onAuth({ status: temAdmin ? 'signedOut' : 'firstAdmin', expirou: sessaoExpirou });
  sessaoExpirou = false;
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

// O primeiro administrador (e a recuperação de um administrador) é criado pela rotina do GitHub
// "Administrador do sistema" (.github/workflows/administrador.yml). Pelo site não dá: as regras bloqueiam.

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

export async function criarUsuario({ nome, login, senha, papel, area, area2, modulos, acessos, acesso, escopos }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if ((await getDoc(doc(db, 'logins', login))).exists()) throw new Error(`O usuário "${login}" já existe.`);
  const { email, uid } = await novaConta(login, senha);
  const b = writeBatch(db);
  b.set(doc(db, 'usuarios', uid), { nome, nomeUp: String(nome || '').toUpperCase(), login, papel, area: area || null, area2: area2 || null, modulos: modulos || ['operacao'], acessos: acessos || ['operacao'], ...(acesso ? { acesso, escopos: escopos || [] } : {}), trocarSenha: true, criadoEm: serverTimestamp(), criadoPor: me.uid });
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
  // Todos: férias de agora e dos próximos meses (marca FE sozinho no Efetivo diário).
  on(doc(db, 'adm', 'feriasAtivas'), s => { cache.feriasAtivas = (s.exists() && s.data().itens) || []; changed(); });
  // Desligamentos (data de demissão das fichas), refeitos todo dia pela rotina do GitHub: DS automático para quem não lê as fichas.
  on(doc(db, 'adm', 'desligados'), s => { cache.desligados = (s.exists() && s.data().itens) || []; changed(); });
  if (ehAdminU(me)) on(doc(db, 'sistema', 'uso'), s => { cache.uso = s.exists() ? s.data({ serverTimestamps: 'estimate' }) : null; changed(); });
  // RH (Frequência e férias): férias, cadastro do RH e pessoas das Atividades; as folhas chegam por admWatch.
  if (temFreq(me)) startAdm(on);
  // Administração: férias completas e a folha da competência (Conferência) chegam ao abrir o módulo (iniciarAdministracao).
  for (const k of SET_KEYS) {
    const st = S[k];
    if (!temSet(me, k)) { st.configLoaded = true; continue; }
    on(doc(db, C('config', k), 'sistema'), s => { st.config = s.exists() ? s.data() : null; st.configLoaded = true; changed(); });
    on(collection(db, C('plano', k)), qs => { st.plano = {}; qs.forEach(d => { st.plano[d.id] = d.data().itens || []; }); changed(); });
    // plano de ação das causas de não realização (acoes/{id}: { causa, area, acao, resp, prazo, status, em, por })
    on(collection(db, C('acoes', k)), qs => { st.acoes = {}; qs.forEach(d => { st.acoes[d.id] = { id: d.id, ...d.data() }; }); changed(); });
    on(collection(db, C('colaboradores', k)), qs => { st.colabs = {}; qs.forEach(d => { st.colabs[d.id] = d.data().itens || []; st.maiorId = Math.max(st.maiorId || 0, +d.data().maiorId || 0); }); st.colabsLoaded = !qs.metadata.fromCache || qs.size > 0; changed(); if (gestaoOn) conferirAreas(); });
  }
  on(query(collection(db, 'historico'), orderBy('at', 'desc'), limit(40)), qs => {
    cache.log = qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { ...x, at: x.at ? x.at.toDate() : new Date() }; });
    changed();
  });
  if (temGestao(me)) startGestao();
  if (temEquip(me)) startEquip();
  if (temSeg(me)) startSeg();
  // Treinamentos, NRs e ASO: RH e Segurança (contas/treinos.js).
  if (veTreinos(me)) on(collection(db, 'treinos'), qs => { cache.treinos = qs.docs.map(d => ({ id: d.id, ...d.data() })); cache.tLoaded = true; changed(); });
  // Avisos no celular: chave pública (config/avisos) e as preferências deste usuário (avisos/{uid}).
  // Escala de turno (fonte única: regimes, turmas e feriados) — Configurações › Escalas e turnos.
  on(doc(db, 'config', 'escalas'), s => { cache.escalas = s.exists() ? s.data() : null; cache.escalasLoaded = true; changed(); });
  // Abas por perfil (tela Perfis e permissões).
  on(doc(db, 'config', 'permissoes'), s => { cache.permissoes = s.exists() ? (s.data().abas || {}) : {}; changed(); });
  on(doc(db, 'config', 'avisos'), s => { cache.avisosCfg = s.exists() ? s.data() : {}; changed(); });
  // Fotos das atividades: obrigatoriedade, mínimo, máximo e situações (Administração › Fotos das atividades).
  on(doc(db, 'config', 'fotos'), s => { cache.fotosCfg = s.exists() ? s.data() : null; cache.fotosCfgLoaded = true; changed(); });
  if (ehAdminU(me)) on(doc(db, 'avisos_enviados', 'estado'), s => { const x = s.exists() ? s.data() : null; cache.avisosEstado = x ? { ...x, enviados: undefined, ultimaExecucao: x.ultimaExecucao && x.ultimaExecucao.toDate ? x.ultimaExecucao.toDate() : null } : null; changed(); });
  on(doc(db, 'avisos', me.uid), s => { cache.meusAvisos = s.exists() ? s.data() : null; changed(); });
  if (ehAdminU(me)) on(collection(db, 'usuarios'), qs => { cache.usuarios = qs.docs.map(d => ({ uid: d.id, ...d.data() })); changed(); });
  const keep = [...monthSubs.keys()]; monthSubs.clear();
  // já liga os meses de todos os conjuntos da pessoa: trocar de módulo ou abrir o Meu dia não espera o servidor
  for (const k of SET_KEYS) watchSet(k, keep.filter(x => x.startsWith(k + '|')).map(x => x.slice(k.length + 1)));
}
// Módulo Administração (só o administrador): a Conferência do cadastro olha também as férias completas e a folha da
// competência atual. Liga ao abrir o módulo, sem recarregar a página; quem tem o RH já tem as férias.
let admSisOn = false;
export function iniciarAdministracao() {
  if (admSisOn || !db || !me || !ehAdminU(me) || !dataSubs.length) return;
  admSisOn = true;
  const on = (q, fn) => dataSubs.push(onSnapshot(q, fn, e => cb.onError && cb.onError(e)));
  if (!admOn) {
    cache.adm = { loaded: false, ferias: [], fLoaded: false, comps: {}, sit: { patio: {}, bateria: {} }, jus: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
    on(collection(db, 'ferias'), qs => { cache.adm.ferias = qs.docs.map(d => ({ id: d.id, ...d.data() })); cache.adm.fLoaded = true; changed(); });
  }
  const comp = competenciaDe(today());
  for (const k of SET_KEYS) on(doc(db, 'freqcomp', k + '|' + comp), s => { cache.adm.comps[k + '|' + comp] = s.exists() ? s.data() : null; changed(); });
  on(query(collection(db, 'erros'), orderBy('quando', 'desc'), limit(100)), qs => { cache.erros = qs.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })); changed(); });
}
// Erros nos aparelhos (nucleo/erros.js). Sem login não grava (devolve false e tenta de novo depois).
// Não espera o banco responder: sem sinal, o registro fica guardado no aparelho e sobe quando voltar.
export function registrarErro(e) {
  if (!db || !me) return false;
  addDoc(collection(db, 'erros'), { quando: serverTimestamp(), uid: me.uid, msg: e.msg, onde: e.onde || '', tela: e.tela || '', versao: e.versao || '', aparelho: e.aparelho || '', vezes: e.vezes || 1 }).catch(() => {});
  return true;
}
export async function apagarErros(ids) {
  for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(doc(db, 'erros', id))); await track(b.commit()); }
}
// Alguma coisa para abrir: perfil em algum módulo.
const temAlgumModulo = u => ehAdminU(u) || marcasDe(u).length > 0 || temSeg(u) || !!(u.acesso && (u.acesso.seguranca || u.acesso.administracao));
function stopData() {
  dataSubs.forEach(f => f()); dataSubs = []; gestaoOn = false; eqOn = false; admSisOn = false;
  for (const fs of eMonthSubs.values()) fs.forEach(f => f()); eMonthSubs.clear();
  for (const fs of monthSubs.values()) fs.forEach(f => f());
  monthSubs.clear();
  eqFreqSubs.clear(); heOpSubs.clear(); cache.heOp = {}; cache.eqFreq = { comps: {}, sit: { patio: {}, bateria: {} }, v: 0 }; admOn = false;
  for (const f of admSubs.values()) { try { f(); } catch (e) { /* já fechado */ } } admSubs.clear();
  for (const f of segSubs.values()) { try { f(); } catch (e) { /* já fechado */ } } segSubs.clear(); segRes.clear(); segOn = false; segIniciais = []; cache.seg = novoSeg();
  for (const k of SET_KEYS) S[k] = novoSet();
  Object.assign(cache, { treinos: [], tLoaded: false, log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, e: novoE() });
}
function stopAll() { if (userSub) { userSub(); userSub = null; } stopData(); }

const toLocal = (id, x) => ({ id, ...x, m: x.m || {}, ev: x.ev || {}, ft: x.ft || {}, fp: x.fp || {}, d: x.ids.map(p => (x.s && x.s[p]) || '_______') });

// Meses em tempo real. O mês anterior, o atual e o próximo ficam sempre ligados (Meu dia, Painel, avisos);
// os outros que a pessoa abrir ficam ligados até 4 de cada vez (os mais antigos saem). Assim, voltar a uma
// tela já vista não recarrega nada.
// Também os meses que cobrem os últimos 60 dias: a conta de "atrasadas" usa essa janela fixa (hoje.js) no menu,
// em Pendências e no Meu dia.
const mesesBase = () => { const m = today().slice(0, 7); const out = []; for (let x = monthOfWeek(weekOf(add(today(), -60))); x <= m; x = addMonth(x, 1)) out.push(x); return [...new Set([...out, addMonth(m, -1), m, addMonth(m, 1)])]; };
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
    const b = onSnapshot(doc(db, C('situacao', k), m), s => { st.sitByMonth[m] = (s.exists() && s.data().v) || {}; st.sitExtra[m] = { cob: (s.exists() && s.data().cob) || {}, he: (s.exists() && s.data().he) || {}, hed: (s.exists() && s.data().hed) || {}, jus: (s.exists() && s.data().jus) || {}, ck: (s.exists() && s.data().ck) || {} }; changed(); });
    // aprovação dos apontamentos pelo supervisor (aprov/{área|semana}: { area, mes, v: { 'pid|dia': { s, c, por, nome, em, mot } } })
    const c = onSnapshot(query(collection(db, C('aprov', k)), where('mes', '==', m)), qs => {
      qs.docChanges().forEach(x => { if (x.type === 'removed') delete st.aprov[x.doc.id]; else st.aprov[x.doc.id] = x.doc.data().v || {}; });
      changed();
    }, () => {});
    monthSubs.set(key(m), [a, b, c]);
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
// Extras do dia: cob = quem cobre a ausência (id do substituto) · he = hora extra a pedido de quem (DIKMA | ARCELOR)
export const sitInfo = (key, k = cur) => { const m = key.split('|')[1].slice(0, 7); const x = ((S[k] || S[cur]).sitExtra || {})[m] || {}; return { cob: (x.cob || {})[key] || '', he: (x.he || {})[key] || '', hed: (x.hed || {})[key] || null, jus: (x.jus || {})[key] || null }; };
export const sitExtraMes = m => (S[cur].sitExtra || {})[m] || { cob: {}, he: {}, hed: {}, jus: {} };


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
// Atividade fora da programação: o coordenador ou supervisor programa uma atividade num dia (s fica 'P') e marca fp;
// o líder aponta como qualquer outra. info = { por, nome, em } para incluir; null para tirar (volta a '_').
export function setForaProg(docId, pid, k, str, info) {
  return track(updateDoc(doc(db, C('semanas'), docId), new FieldPath('s', pid), str, new FieldPath('fp', pid + '|' + k), info || deleteField(), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid));
}
// Aprovar ou devolver apontamentos (supervisor, coordenador, gestor, administrador). itens: { 'pid|dia': { s, c, mot? } }
export function setAprov(docId, area, mes, itens) {
  const v = {}; const em = new Date().toISOString();
  for (const [k, x] of Object.entries(itens)) v[k] = { ...x, por: me.uid, nome: me.nome || me.login || '', em };
  st0().aprov[docId] = { ...(st0().aprov[docId] || {}), ...v };
  return track(setDoc(doc(db, C('aprov'), docId), { area, mes, v }, { merge: true }));
}
const st0 = () => S[cur];
// Plano de ação das causas: cria (id vazio) ou altera uma ação.
export function salvarAcao(id, dados) {
  const ref = id ? doc(db, C('acoes'), id) : doc(collection(db, C('acoes')));
  const x = id ? { ...dados, atualizadoEm: new Date().toISOString(), atualizadoPor: me.uid } : { ...dados, em: new Date().toISOString(), por: me.uid, porNome: me.nome || me.login || '' };
  st0().acoes[ref.id] = { ...(st0().acoes[ref.id] || {}), id: ref.id, ...x };
  return track(setDoc(ref, x, { merge: true }));
}
// k = conjunto (Pátio ou Bateria); sem k, o conjunto aberto. Usado para lançar a hora extra de quem cobre em outro conjunto.
export function setSit(key, code, k = cur) {
  const m = key.split('|')[1].slice(0, 7);
  return track(setDoc(doc(db, C('situacao', k), m), { v: { [key]: code || deleteField() } }, { merge: true }));
}
export function setSitExtra(campo, key, val, k = cur) {
  const m = key.split('|')[1].slice(0, 7);
  return track(setDoc(doc(db, C('situacao', k), m), { [campo]: { [key]: val || deleteField() } }, { merge: true }));
}
export const savePlano = (area, itens) => track(setDoc(doc(db, C('plano'), area), { itens }));
// k = conjunto (patio | bateria); o cadastro do Efetivo grava nos dois, seja qual for o módulo aberto.
// Número do colaborador (C012, B034): o maior já usado no conjunto fica guardado junto da lista (maiorId) e só cresce,
// para que um número liberado (pessoa excluída ou que mudou de conjunto) nunca seja dado a outra pessoa.
const numId = id => parseInt(String(id || '').replace(/\D/g, ''), 10) || 0;
export function maiorIdUsado(k) { const st = S[k]; let m = st.maiorId || 0; for (const l of Object.values(st.colabs || {})) for (const x of l) m = Math.max(m, numId(x.id)); return m; }
export function salvarColabsArea(area, itens, k = setDaArea(area) || cur) {
  const maiorId = Math.max(maiorIdUsado(k), ...itens.map(x => numId(x.id))); S[k].maiorId = maiorId;
  return track(setDoc(doc(db, C('colaboradores', k), area), { itens, maiorId }));
}
export const saveRotas = rotas => track(updateDoc(doc(db, C('config'), 'sistema'), { rotas }));
export const saveConfig = patch => track(updateDoc(doc(db, C('config'), 'sistema'), patch));

// ---------- fotos das atividades (evidencias + evidenciasArquivo) ----------
// Guardadas no próprio Firestore (plano grátis): a foto já chega reduzida pelo aparelho (ui/fotos.js).
// Grava o apontamento (changes, pode ser vazio para só juntar fotos) e as fotos num lote só. Não espera o servidor:
// sem sinal, fica tudo na fila do aparelho e sobe junto quando a conexão voltar.
// fotos: [{ meta (fotos.js › metaFoto, sem por/at), dados }] · devolve os ids das fotos
export function apontarComFotos(docId, changes, fotos) {
  const k = setDaArea((fotos[0] && fotos[0].meta.area) || '') || cur;
  const args = []; const finalStr = {};
  for (const c of changes) finalStr[c.pid] = c.str;
  for (const [pid, str] of Object.entries(finalStr)) args.push(new FieldPath('s', pid), str);
  for (const c of changes) args.push(new FieldPath('m', c.pid + '|' + c.k), c.motivo ? c.motivo : deleteField());
  const inc = {};
  for (const f of fotos) for (const [key, n] of Object.entries(incrementosFt(f.meta.refs, 1))) inc[key] = (inc[key] || 0) + n;
  for (const [key, n] of Object.entries(inc)) args.push(new FieldPath('ft', key), increment(n));
  args.push('atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
  const b = writeBatch(db);
  b.update(doc(db, C('semanas', k), docId), ...args);
  const ids = [];
  for (const f of fotos) {
    const r = doc(collection(db, C('evidencias', k)));
    b.set(r, { ...f.meta, por: me.uid, porNome: me.nome || me.login || '', at: serverTimestamp() });
    b.set(doc(db, C('evidenciasArquivo', k), r.id), { area: f.meta.area, semana: f.meta.semana, dia: f.meta.dia, sha: f.meta.sha || '', por: me.uid, dados: f.dados });
    ids.push(r.id);
  }
  track(b.commit());
  return ids;
}
const dataDe = v => (v && v.toDate ? v.toDate() : v || null);
const comoFoto = d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at && x.at.toDate ? x.at.toDate() : new Date(), exportadoEm: dataDe(x.exportadoEm), lixeiraEm: dataDe(x.lixeiraEm), removidaEm: dataDe(x.removidaEm) }; };
// Fotos (leves, com miniatura) de uma atividade num dia. Também as do código antigo (campo ref).
// As da lixeira ficam de fora; as arquivadas fora do banco (removidaEm) vêm, para a tela mostrar a miniatura e o selo.
export async function listarFotosCel(semana, pid, k, conj = setDaArea(semana.split('|')[0]) || cur) {
  const col = collection(db, C('evidencias', conj));
  const [a, b] = await Promise.all([
    getDocs(query(col, where('refs', 'array-contains', `${semana}|${pid}|${k}`))),
    getDocs(query(col, where('ref', '==', `${semana}#${pid}|${k}`))).catch(() => ({ docs: [] }))
  ]);
  const vistos = new Set(); const out = [];
  for (const d of [...a.docs, ...b.docs]) if (!vistos.has(d.id)) { vistos.add(d.id); out.push(comoFoto(d)); }
  return out.filter(f => !f.lixeiraEm || f.removidaEm).sort((x, y) => x.at - y.at);
}
// Relatório fotográfico (Parte 2): lista leve (miniaturas) de várias semanas de uma vez.
export async function listarEvidenciasSemanas(ids, conj = cur) {
  const out = [];
  for (let i = 0; i < ids.length; i += 30) {
    const qs = await getDocs(query(collection(db, C('evidencias', conj)), where('semana', 'in', ids.slice(i, i + 30))));
    qs.docs.forEach(d => out.push(comoFoto(d)));
  }
  return out;
}
// Foto completa (só ao abrir grande ou exportar).
export async function abrirEvidencia(id, conj = cur) { const s = await getDoc(doc(db, C('evidenciasArquivo', conj), id)); return s.exists() ? s.data().dados : null; }
// O autor ajusta a quais atividades a foto vale (até 24 h depois; as regras conferem).
export const ajustarRefsFoto = (id, refs, conj = cur) => track(updateDoc(doc(db, C('evidencias', conj), id), { refs, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }));
// ---------- Relatórios e arquivo de fotos (Parte 2; só o administrador; contas em fotos-arquivo.js) ----------
// Fotos (leves) de um período: lidas por mês e filtradas pelo dia. Todas as situações (a tela separa).
export async function listarEvidenciasPeriodo(conj, de, ate) {
  const meses = []; for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = addMonth(m, 1)) meses.push(m);
  const out = [];
  for (let i = 0; i < meses.length; i += 10) {
    const qs = await getDocs(query(collection(db, C('evidencias', conj)), where('mes', 'in', meses.slice(i, i + 10))));
    qs.docs.forEach(d => { const f = comoFoto(d); if (f.dia >= de && f.dia <= ate) out.push(f); });
  }
  return out;
}
// Lixeira: fotos com lixeiraEm (de qualquer período), sem as já apagadas de vez.
export async function listarEvidenciasLixeira(conj) {
  const qs = await getDocs(query(collection(db, C('evidencias', conj)), where('lixeiraEm', '!=', null)));
  return qs.docs.map(comoFoto).filter(f => !f.removidaEm);
}
// Semanas do período (para os indicadores do relatório), lidas por mês (campo mes da semana).
export async function semanasPeriodo(conj, meses) {
  const out = {};
  for (let i = 0; i < meses.length; i += 10) {
    const qs = await getDocs(query(collection(db, C('semanas', conj)), where('mes', 'in', meses.slice(i, i + 10))));
    qs.docs.forEach(d => { out[d.id] = toLocal(d.id, d.data()); });
  }
  return out;
}
// Grava um lote e espera o servidor (sem sinal a tela nem começa): a tela mostra o progresso e para no erro.
async function gravarLote(b) { pending++; syncMudou(); try { await b.commit(); } finally { pending--; syncMudou(); } }
const marca = () => ({ atualizadoEm: serverTimestamp(), atualizadoPor: me.uid });
// Exportada: itens [{ id, conf: 'ok' | 'divergente' | 'sem-sha' }] num lote só (até 400).
export async function marcarExportadas(conj, itens, lote) {
  const b = writeBatch(db);
  for (const x of itens) b.update(doc(db, C('evidencias', conj), x.id), { exportadoEm: serverTimestamp(), exportLote: lote, exportConf: x.conf, ...marca() });
  await gravarLote(b);
}
export async function moverLixeira(conj, ids) { const b = writeBatch(db); for (const id of ids) b.update(doc(db, C('evidencias', conj), id), { lixeiraEm: serverTimestamp(), ...marca() }); await gravarLote(b); }
export async function restaurarLixeira(conj, ids) { const b = writeBatch(db); for (const id of ids) b.update(doc(db, C('evidencias', conj), id), { lixeiraEm: null, ...marca() }); await gravarLote(b); }
// Apagar de vez: apaga a foto completa (evidenciasArquivo) e marca removidaEm no documento leve, no mesmo lote
// (até 200 fotos). O documento leve fica, com a miniatura, os dados da atividade, o sha e o lote da exportação.
export async function apagarDefinitivo(conj, ids) {
  const b = writeBatch(db);
  for (const id of ids) { b.delete(doc(db, C('evidenciasArquivo', conj), id)); b.update(doc(db, C('evidencias', conj), id), { removidaEm: serverTimestamp(), ...marca() }); }
  await gravarLote(b);
}
// Configuração das fotos (só o administrador).
export const salvarCfgFotos = c => track(setDoc(doc(db, 'config', 'fotos'), { obrig: c.obrig, min: c.min, max: c.max, situacoes: c.situacoes, desde: c.desde, atualizadoEm: serverTimestamp(), por: me.nome || me.login || '' }));
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
export const salvarEscalas = cfg => track(setDoc(doc(db, 'config', 'escalas'), { ...cfg, atualizadoEm: serverTimestamp(), por: me.nome || me.login || '' }));
export const salvarPermissoes = abas => track(setDoc(doc(db, 'config', 'permissoes'), { abas, atualizadoEm: serverTimestamp(), por: me.nome || me.login || '' }));
export const salvarChaveAvisos = vapid => track(setDoc(doc(db, 'config', 'avisos'), { vapid: String(vapid || '').trim() }, { merge: true }));

export const setUsuario = (uid, patch) => track(updateDoc(doc(db, 'usuarios', uid), patch.nome ? { ...patch, nomeUp: String(patch.nome).toUpperCase() } : patch));
// Histórico de alterações completo (Administração › Histórico): lido só quando a tela abre.
export async function historicoLer(n = 500) {
  const qs = await getDocs(query(collection(db, 'historico'), orderBy('at', 'desc'), limit(n)));
  return qs.docs.map(d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at && x.at.toDate ? x.at.toDate() : new Date() }; });
}
export function log(t) { if (!me) return; addDoc(collection(db, 'historico'), { at: serverTimestamp(), uid: me.uid, nome: me.nome || me.email, t }).catch(() => {}); }

// Feriados sem operação lidos do servidor: Escalas e turnos (config/escalas) e os da Operação (eq/config).
// completo = false quando não deu para ler os da Operação (aí quem aplica não desfaz nada; feriados.js).
export async function feriadosAtuais() {
  let esc = cache.escalas || {}, eq = (cache.e && cache.e.config) || null, completo = true;
  try { const s = await getDoc(doc(db, 'config', 'escalas')); esc = s.exists() ? s.data() : {}; } catch (e) { completo = false; }
  try { const s = await getDoc(doc(db, 'eq', 'config')); eq = s.exists() ? s.data() : null; } catch (e) { completo = !!eq && completo; }
  return { fer: mapaFeriados(esc, eq), completo };
}
// Plano padrão → Programação já gerada (planoaplica.js): lê as semanas da área e grava as linhas que mudam.
export async function semanasDaArea(area, k = cur) {
  const qs = await getDocs(query(collection(db, C('semanas', k)), where('area', '==', area)));
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function gravarPlanoNasSemanas(muda, k = cur) {
  for (let i = 0; i < muda.length; i += 400) {
    const b = writeBatch(db);
    for (const x of muda.slice(i, i + 400)) b.update(doc(db, C('semanas', k), x.id), new FieldPath('s', x.pid), x.linha, ...(x.novo ? ['ids', arrayUnion(x.pid)] : []), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', me.uid);
    await track(b.commit());
  }
}
export async function gerarMes(ym, planoPorArea, aPartirDe, k = cur) {
  const exist = await getDocs(query(collection(db, C('semanas', k)), where('mes', '==', ym)));
  const have = new Set(exist.docs.map(d => d.id));
  // feriado sem operação já sai sem programação, com a marca (feriados.js)
  const { fer } = await feriadosAtuais().catch(() => ({ fer: new Map() }));
  const b = writeBatch(db); let n = 0;
  for (const ini of weeksOfMonth(ym)) {
    if (aPartirDe && ini < aPartirDe) continue;
    for (const area of SETS[k].areas) {
      const id = area + '|' + ini; if (have.has(id)) continue;
      const w = novaSemana(area, ini, planoPorArea[area] || []); aplicarNaSemana(w, fer);
      b.set(doc(db, C('semanas', k), id), { ...w, criadoEm: serverTimestamp() }); n += w.ids.length;
    }
  }
  b.update(doc(db, C('config', k), 'sistema'), { meses: arrayUnion(ym) });
  await b.commit();
  return n;
}

// Dados das planilhas originais (pasta dados-importacao do repositório). Não ficam no site: a publicação
// grava cada arquivo em seeds/{nome} e só a administração do módulo consegue ler (regras do Firestore).
export async function seed(nome) {
  const id = String(nome).replace(/\.json$/, '');
  const d = await getDoc(doc(db, 'seeds', id));
  if (!d.exists()) throw new Error(`Os dados de importação (${id}) ainda não foram enviados ao banco. Restaure a cópia de segurança ou envie de novo as planilhas (integracao/admin/enviar-dados.mjs).`);
  return JSON.parse(d.data().json);
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

// ---------- Acesso Administrativo (Frequência e Férias) ----------
// freqcomp/{conj|AAAA-MM}: { conj, competencia, ini, fim, grupos: [{ nome, turno, pessoas: [{ k, nome, mat, turma, obs, ativ }] }], d: { k: { data: código } } }
//   ativ = id da pessoa nas Atividades (C012, B034): a presença dela fica em situacao (a mesma do Efetivo diário).
// ferias/{id}: { mat, nome, setor, funcao, horario, admissao, limite, inicio, dias, termino, retorno, substituto }
// adm/feriasAtivas: { itens: [{ mat, nome, inicio, termino }] } resumo para a Operação.
cache.adm = { loaded: false, ferias: [], fLoaded: false, comps: {}, sit: { patio: {}, bateria: {} }, jus: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
const admSubs = new Map();
function startAdm(on) {
  cache.adm = { loaded: false, ferias: [], fLoaded: false, comps: {}, sit: { patio: {}, bateria: {} }, jus: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
  for (const f of admSubs.values()) { try { f(); } catch (e) { /* já fechado */ } } admSubs.clear();
  on(collection(db, 'ferias'), qs => { cache.adm.ferias = qs.docs.map(d => ({ id: d.id, ...d.data() })); cache.adm.fLoaded = true; cache.adm.loaded = true; changed(); });
  on(collection(db, 'gcolab'), qs => { cache.adm.rh = qs.docs.flatMap(d => d.data().itens || []); changed(); });
  for (const k of SET_KEYS) on(collection(db, C('colaboradores', k)), qs => { cache.adm.colabs[k] = qs.docs.flatMap(d => d.data().itens || []); changed(); });
  admOn = true;
}
let admOn = false;
// Liga uma competência (folha) e os meses de presença que ela cobre.
export function admWatch(conj, comp) {
  if (!db || !me || !admOn) return;
  const id = conj + '|' + comp;
  if (!admSubs.has(id)) admSubs.set(id, onSnapshot(doc(db, 'freqcomp', id), s => { cache.adm.comps[id] = s.exists() ? s.data() : null; changed(); }, e => cb.onError && cb.onError(e)));
  const [a, m] = comp.split('-').map(Number); const ant = `${m === 1 ? a - 1 : a}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  for (const mes of [ant, comp]) {
    const k = 's|' + conj + '|' + mes; if (admSubs.has(k)) continue;
    admSubs.set(k, onSnapshot(doc(db, C('situacao', conj), mes), s => { cache.adm.sit[conj][mes] = (s.exists() && s.data().v) || {}; (cache.adm.jus[conj] ||= {})[mes] = (s.exists() && s.data().jus) || {}; changed(); }, e => cb.onError && cb.onError(e)));
  }
}
// Grava o código de uma pessoa num dia. Quem está nas Atividades grava na presença do dia (situacao) — a mesma do Efetivo diário.
export function admSetCodigo(conj, comp, p, data, cod) {
  if (p.ativ) return track(setDoc(doc(db, C('situacao', conj), data.slice(0, 7)), { v: { [p.ativ + '|' + data]: cod || deleteField() } }, { merge: true }));
  return track(updateDoc(doc(db, 'freqcomp', conj + '|' + comp), new FieldPath('d', p.k, data), cod || deleteField(), 'atualizadoEm', serverTimestamp()));
}
// Justificativa na Frequência: quem está nas Atividades grava junto da presença (situacao); os demais, na folha.
export function admSetJus(conj, comp, p, data, val) {
  if (p.ativ) return track(setDoc(doc(db, C('situacao', conj), data.slice(0, 7)), { jus: { [p.ativ + '|' + data]: val || deleteField() } }, { merge: true }));
  return track(updateDoc(doc(db, 'freqcomp', conj + '|' + comp), new FieldPath('jus', p.k, data), val || deleteField(), 'atualizadoEm', serverTimestamp()));
}
export const admSalvarComp = (conj, comp, dados) => track(setDoc(doc(db, 'freqcomp', conj + '|' + comp), { ...dados, conj, competencia: comp, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }, { merge: true }));
export const admSalvarGrupos = (conj, comp, grupos) => track(updateDoc(doc(db, 'freqcomp', conj + '|' + comp), { grupos, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }));
// Férias: grava e refaz o resumo que a Operação lê.
// (a mesma conta da rotina diária do GitHub, que também refaz o resumo todo dia: resumoFerias em acessos.js)
function gravarResumoFerias() { return track(setDoc(doc(db, 'adm', 'feriasAtivas'), { itens: resumoFerias(cache.adm.ferias, today()), atualizadoEm: serverTimestamp() }, { merge: true })); }
export async function feriasSalvar(id, dados) {
  const ref = id ? doc(db, 'ferias', id) : doc(collection(db, 'ferias'));
  const x = { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid };
  const i = cache.adm.ferias.findIndex(f => f.id === ref.id);
  if (i >= 0) cache.adm.ferias[i] = { ...cache.adm.ferias[i], ...dados }; else cache.adm.ferias.push({ id: ref.id, ...dados });
  track(setDoc(ref, x, { merge: true })); gravarResumoFerias();
  return ref.id;
}
export function feriasExcluir(id) { cache.adm.ferias = cache.adm.ferias.filter(f => f.id !== id); const b = writeBatch(db); b.delete(doc(db, 'ferias', id)); track(b.commit()); gravarResumoFerias(); }
// Treinamentos, NRs e ASO (RH): um documento por treinamento feito. A conta da situação fica em contas/treinos.js.
export function treinoSalvar(id, dados) {
  const ref = id ? doc(db, 'treinos', id) : doc(collection(db, 'treinos'));
  const i = cache.treinos.findIndex(t => t.id === ref.id);
  if (i >= 0) cache.treinos[i] = { ...cache.treinos[i], ...dados }; else cache.treinos.push({ id: ref.id, ...dados });
  track(setDoc(ref, { ...dados, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }, { merge: true }));
  return ref.id;
}
export function treinoExcluir(id) { cache.treinos = cache.treinos.filter(t => t.id !== id); const b = writeBatch(db); b.delete(doc(db, 'treinos', id)); track(b.commit()); }
// Importar treinamentos de uma planilha: lotes de até 400; espera o servidor confirmar cada lote.
// Item com id: atualiza o registro que já existe (o "não se aplica" da pessoa, que é um registro só).
export async function treinosImportar(itens) {
  for (let i = 0; i < itens.length; i += 400) {
    const b = writeBatch(db);
    for (const { id, ...t } of itens.slice(i, i + 400)) b.set(id ? doc(db, 'treinos', id) : doc(collection(db, 'treinos')), { ...t, importadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }, { merge: true });
    await track(b.commit());
  }
}
// Importação das planilhas (administrador): folhas de frequência, presença de quem está nas Atividades e férias.
// presenca: { patio: { 'C012|2026-10-03': 'AT' }, bateria: {...} } — só grava os dias que ainda estão vazios no banco.
export async function admImportar({ comps, presenca, ferias, substituirFerias }) {
  for (const c of comps) { const b = writeBatch(db); b.set(doc(db, 'freqcomp', c.conj + '|' + c.competencia), { ...c, importadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: me.uid }); await track(b.commit()); }
  let n = 0;
  for (const k of Object.keys(presenca || {})) {
    const porMes = {};
    for (const [key, cod] of Object.entries(presenca[k])) { const m = key.split('|')[1].slice(0, 7); (porMes[m] ||= {})[key] = cod; }
    for (const [m, v] of Object.entries(porMes)) {
      const atual = (await getDoc(doc(db, C('situacao', k), m))).data();
      const ja = (atual && atual.v) || {};
      const novo = Object.fromEntries(Object.entries(v).filter(([key]) => !ja[key]));
      if (!Object.keys(novo).length) continue;
      n += Object.keys(novo).length;
      await track(setDoc(doc(db, C('situacao', k), m), { v: novo }, { merge: true }));
    }
  }
  if (ferias) {
    if (substituirFerias) for (let i = 0; i < cache.adm.ferias.length; i += 400) { const b = writeBatch(db); cache.adm.ferias.slice(i, i + 400).forEach(f => b.delete(doc(db, 'ferias', f.id))); await track(b.commit()); }
    const novas = [];
    for (let i = 0; i < ferias.length; i += 400) {
      const b = writeBatch(db);
      for (const f of ferias.slice(i, i + 400)) { const r = doc(collection(db, 'ferias')); b.set(r, { ...f, importadoEm: serverTimestamp() }); novas.push({ id: r.id, ...f }); }
      await track(b.commit());
    }
    cache.adm.ferias = substituirFerias ? novas : [...cache.adm.ferias, ...novas];
    await gravarResumoFerias();
  }
  return n;
}

// ---------- módulo Gestão (fichas de acompanhamento) ----------
// Fichas por área: quem vê todas as áreas acompanha a coleção gcolab inteira; os demais, só os documentos das áreas deles.
// Ocorrências: todas as áreas = coleção inteira; os demais = uma consulta por área + as que registrou + as que vai recolher.
let fichasPorArea = {};           // gcolab: { ÁREA: itens[] } como está no banco
let ocorrFontes = {};             // consulta → { id: ocorrência }
let chaveArea = () => null;       // área de atuação de uma ficha (definida pelo app; null = ainda não dá para saber)
export const definirChaveArea = fn => { chaveArea = fn; };
const montarFichas = () => { cache.g.colabs = Object.keys(fichasPorArea).sort().flatMap(a => fichasPorArea[a]).sort((x, y) => String(x.nome).localeCompare(String(y.nome))); };
const montarOcorr = () => { const m = {}; for (const f of Object.values(ocorrFontes)) Object.assign(m, f); cache.g.ocorr = Object.values(m); };
// Área em que a ficha está guardada hoje (pela matrícula).
export function areaDaFicha(mat) {
  for (const [a, l] of Object.entries(fichasPorArea)) if (!a.startsWith('_') && l.some(c => String(c.mat) === String(mat))) return a;
  return FICHA_GERAL;
}
function startGestao() {
  gestaoOn = true;
  fichasPorArea = {}; ocorrFontes = {}; antigaFichas = null;
  const todas = veTodasFichas(me);
  const areas = todas ? [] : areasFichaDe(me);
  const espera = new Set(['c', 'l', ...(todas ? ['o'] : ['oc', 'or', ...areas.map(a => 'o:' + a)]), ...areas.map(a => 'l:' + a)]);
  if (!todas) espera.delete('l');
  const pronto = k => { espera.delete(k); };
  const g = () => { cache.g.loaded = espera.size === 0; cache.gVersao++; changed(); };
  const on = (q, fn, k) => dataSubs.push(onSnapshot(q, fn, e => { if (k) pronto(k); g(); cb.onError && cb.onError(e); }));
  on(doc(db, 'gestao', 'config'), s => { cache.g.config = s.exists() ? s.data() : null; pronto('c'); g(); }, 'c');
  if (todas) {
    on(collection(db, 'gcolab'), qs => { fichasPorArea = Object.fromEntries(qs.docs.map(d => [d.id, d.data().itens || []])); usarAntigaSeVazio(); montarFichas(); pronto('l'); g(); conferirAreas(); }, 'l');
    // Antes da divisão por área a lista ficava num documento só. Enquanto gcolab estiver vazio, usa o antigo.
    on(doc(db, 'gestao', 'colaboradores'), s => { antigaFichas = s.exists() ? (s.data().itens || []) : null; usarAntigaSeVazio(); montarFichas(); g(); conferirAreas(); });
    on(collection(db, 'gocorr'), qs => { ocorrFontes = { todas: Object.fromEntries(qs.docs.map(d => [d.id, { id: d.id, ...d.data() }])) }; montarOcorr(); pronto('o'); g(); }, 'o');
  } else {
    for (const a of areas) on(doc(db, 'gcolab', a), s => { fichasPorArea[a] = s.exists() ? (s.data().itens || []) : []; montarFichas(); pronto('l:' + a); g(); }, 'l:' + a);
    const fonte = (k, q) => on(q, qs => { ocorrFontes[k] = Object.fromEntries(qs.docs.map(d => [d.id, { id: d.id, ...d.data() }])); montarOcorr(); pronto(k); g(); }, k);
    for (const a of areas) fonte('o:' + a, query(collection(db, 'gocorr'), where('area', '==', a)));
    fonte('oc', query(collection(db, 'gocorr'), where('criadoPor', '==', me.uid)));
    fonte('or', query(collection(db, 'gocorr'), where('recolhe', '==', me.nomeUp || String(me.nome || '').toUpperCase())));
  }
  g();
  // Ponte com o Senior: o que a rotina do GitHub trouxe (só o administrador vê).
  if (ehAdminU(me)) on(doc(db, 'integracao', 'senior'), s => { const x = s.exists() ? s.data({ serverTimestamps: 'estimate' }) : null; cache.g.senior = x ? { ...x, recebidoEm: x.recebidoEm && x.recebidoEm.toDate ? x.recebidoEm.toDate() : null, tentativaEm: x.tentativaEm && x.tentativaEm.toDate ? x.tentativaEm.toDate() : null, aplicadoEm: x.aplicadoEm && x.aplicadoEm.toDate ? x.aplicadoEm.toDate() : null } : null; changed(); });
}
let antigaFichas = null;
function usarAntigaSeVazio() {
  if (antigaFichas && antigaFichas.length && !Object.keys(fichasPorArea).some(a => !a.startsWith('_'))) fichasPorArea = { _antiga: antigaFichas };
}
// Administrador: quando alguém muda de área nos módulos (ou a lista ainda está no documento antigo),
// reorganiza as fichas por área e leva junto as ocorrências e assinaturas da pessoa. Só quando já dá para saber a área.
let conferindo = null;
function conferirAreas() {
  if (!me || !ehAdminU(me) || conferindo) return;
  conferindo = setTimeout(async () => {
    conferindo = null;
    const itens = cache.g.colabs || []; if (!itens.length) return;
    const antiga = !!fichasPorArea._antiga;
    const errado = itens.some(c => { const k = chaveArea(c); return k && k !== areaDaFicha(c.mat); });
    if (!antiga && !errado) return;
    if (itens.some(c => chaveArea(c) == null)) return; // dados dos módulos ainda chegando
    try { await gSalvarColabs(itens); if (antiga) { const b = writeBatch(db); b.delete(doc(db, 'gestao', 'colaboradores')); await b.commit(); } } catch (e) { cb.onError && cb.onError(e); }
  }, 4000);
}
export const gSeniorAplicado = () => track(updateDoc(doc(db, 'integracao', 'senior'), { aplicadoEm: serverTimestamp(), aplicadoPor: me.nome || me.login || '' }));
const gch = () => { cache.gVersao++; changed(); };
export async function gImportar(seed) {
  const b = writeBatch(db);
  b.set(doc(db, 'gestao', 'config'), { codigo: seed.codigo, revisao: seed.revisao, declaracao: seed.declaracao, tipos: seed.tipos, importadoEm: serverTimestamp() });
  await b.commit();
  await gSalvarColabs(seed.colabs);
  await gImportarOcorrencias(seed.ocorrencias.map(o => ({ ...o, metodo: o.status === 'assinada' ? 'importado' : null })));
}
// Importação: grava várias ocorrências de uma vez (lotes de 400 por gravação).
export async function gImportarOcorrencias(lista) {
  for (let i = 0; i < lista.length; i += 400) {
    const b = writeBatch(db);
    for (const o of lista.slice(i, i + 400)) b.set(doc(collection(db, 'gocorr')), { assinadoEm: null, testemunha: '', ...o, area: areaDaFicha(o.mat), metodo: o.status === 'pendente' ? null : 'importado', assinaturaId: null, criadoPor: me.uid, criadoEm: serverTimestamp() });
    await track(b.commit());
  }
}
// Grava a lista de fichas dividida por área (só administração do Efetivo). Quem mudou de área leva junto
// as ocorrências e as assinaturas. Sem como saber a área agora (chaveArea = null), a ficha fica onde está.
export function gSalvarColabs(itens) {
  const grupos = {};
  for (const c of itens) { const k = chaveArea(c) || (Object.keys(fichasPorArea).some(a => !a.startsWith('_')) ? areaDaFicha(c.mat) : chaveFicha(c.area)); (grupos[k] ||= []).push(c); }
  const ops = [];
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const a of new Set([...Object.keys(grupos), ...Object.keys(fichasPorArea)])) {
    if (a.startsWith('_')) continue;
    const novo = grupos[a] || [];
    if (!igual(novo, fichasPorArea[a] || [])) ops.push(['set', doc(db, 'gcolab', a), { itens: novo }]);
  }
  const areaNova = new Map(); for (const [a, l] of Object.entries(grupos)) for (const c of l) areaNova.set(String(c.mat), a);
  const mudou = new Set();
  for (const o of cache.g.ocorr || []) { const a = areaNova.get(String(o.mat)); if (a && o.area !== a) { ops.push(['upd', doc(db, 'gocorr', o.id), { area: a }]); mudou.add(String(o.mat)); } }
  fichasPorArea = grupos; cache.g.colabs = itens;
  // Não espera o servidor: sem sinal, as gravações ficam na fila e sobem quando a conexão voltar.
  const t = [];
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    for (const [k, ref, v] of ops.slice(i, i + 400)) (k === 'set' ? b.set(ref, v) : b.update(ref, v));
    t.push(track(b.commit()));
  }
  // assinaturas das pessoas que mudaram de área (precisa de sinal; se faltar, o administrador refaz na próxima conferência)
  for (const m of mudou) {
    t.push(getDocs(query(collection(db, 'gassin'), where('mat', '==', m))).then(qs => {
      const a = areaNova.get(m); const b = writeBatch(db); let n = 0;
      qs.forEach(d => { if (d.data().area !== a) { b.update(d.ref, { area: a }); n++; } });
      return n ? track(b.commit()) : null;
    }).catch(() => {}));
  }
  return Promise.all(t);
}
export const gSalvarConfig = patch => track(setDoc(doc(db, 'gestao', 'config'), patch, { merge: true }));
export function gNovaOcorrencia(o) {
  const r = doc(collection(db, 'gocorr'));
  const x = { ...o, area: areaDaFicha(o.mat) };
  track(setDoc(r, { ...x, assinadoEm: null, assinaturaId: null, metodo: null, testemunha: '', criadoPor: me.uid, criadoEm: serverTimestamp() }));
  return { id: r.id, ...x };
}
export const gAtualizarOcorrencia = (id, patch) => track(updateDoc(doc(db, 'gocorr', id), patch));
export async function gExcluirOcorrencias(ids) {
  for (let i = 0; i < ids.length; i += 400) { const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(doc(db, 'gocorr', id))); await track(b.commit()); }
}
export function gExcluirOcorrencia(id) { const b = writeBatch(db); b.delete(doc(db, 'gocorr', id)); return track(b.commit()); }
export function gAssinar(a) {
  const r = doc(collection(db, 'gassin'));
  const b = writeBatch(db);
  const oc = (cache.g.ocorr || []).find(o => a.ocorrIds.includes(o.id));
  const reg = { ...a, area: (oc && oc.area) || areaDaFicha(a.mat), por: me.uid, porNome: me.nome || me.login || '' };
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
// Equipe e frota em sincronia com a Frequência e o Efetivo diário: a folha (freqcomp) das competências que cobrem o mês
// e a presença do dia (situacao/b_situacao) do mês. Só leitura; quem lança é o Efetivo diário ou o Administrativo.
cache.eqFreq = { comps: {}, sit: { patio: {}, bateria: {} }, v: 0 };
const eqFreqSubs = new Set();
// Hora extra lançada na Operação (status HORA EXTRA / HE NOTURNA dos lançamentos de equipamento), por mês.
// Lida também por quem tem a Frequência ou as Atividades: entra na folha e no Banco de horas extras.
const heOpSubs = new Set();
export function heOpWatch(ym) {
  if (!db || !me || !ym || heOpSubs.has(ym)) return; heOpSubs.add(ym);
  cache.heOp = cache.heOp || {};
  dataSubs.push(onSnapshot(query(collection(db, 'eqlanc'), where('mes', '==', ym)), qs => {
    cache.heOp[ym] = qs.docs.map(d => d.data()).filter(l => ['HORA EXTRA', 'HE NOTURNA'].includes(l.status) && l.op && l.data)
      .map(l => ({ data: l.data, op: l.op, eq: l.eq || '', status: l.status, he: +l.he || 0, ini: l.ini || '', fim: l.fim || '' }));
    cache.heOpV = (cache.heOpV || 0) + 1; changed();
  }, () => { cache.heOp[ym] = []; })); // sem permissão: nada da Operação
}
export function eqFreqWatch(ym) {
  if (!db || !me || !eqOn || !ym) return;
  const [a, m] = ym.split('-').map(Number); const prox = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  const err = () => {}; // sem permissão ou sem folha: a Equipe usa a situação do cadastro
  const ch = () => { cache.eqFreq.v++; cache.eVersao++; changed(); };
  for (const k of SET_KEYS) {
    for (const comp of [ym, prox]) {
      const id = k + '|' + comp; if (eqFreqSubs.has('c' + id)) continue; eqFreqSubs.add('c' + id);
      dataSubs.push(onSnapshot(doc(db, 'freqcomp', id), s => { cache.eqFreq.comps[id] = s.exists() ? s.data() : null; ch(); }, err));
    }
    const sid = 's' + k + '|' + ym; if (eqFreqSubs.has(sid)) continue; eqFreqSubs.add(sid);
    dataSubs.push(onSnapshot(doc(db, C('situacao', k), ym), s => { cache.eqFreq.sit[k][ym] = (s.exists() && s.data().v) || {}; ch(); }, err));
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

// ---------- módulo Segurança (interações e anomalias) ----------
// Lido por mês (o atual e o anterior; a tela pede outros) e, à parte, todas as anomalias ainda em aberto.
// As regras só deixam ler o que é da pessoa: quem só registra pede os próprios (por == uid); o supervisor, os da área
// dele (conj); quem vê tudo, sem filtro. Cada consulta fica numa lista própria e o cache junta tudo.
function novoSeg() { return { on: false, loaded: false, cfg: null, cfgLoaded: false, inter: [], anom: [], meses: new Set(), v: 0 }; }
cache.seg = novoSeg();
let segOn = false; const segSubs = new Map(), segRes = new Map(); let segIniciais = [];
const segDoc = d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, em: x.em && x.em.toMillis ? x.em.toMillis() : (+x.em || Date.now()) }; };
function segJuntar() {
  const inter = {}, anom = {};
  for (const [k, l] of segRes) { const alvo = k.startsWith('seginter') ? inter : anom; for (const x of l) alvo[x.id] = x; }
  cache.seg.inter = Object.values(inter); cache.seg.anom = Object.values(anom);
  cache.seg.loaded = segIniciais.every(k => segRes.has(k)); cache.seg.v++; changed();
}
function segOuvir(key, q) {
  if (segSubs.has(key)) return;
  segSubs.set(key, onSnapshot(q, qs => { segRes.set(key, qs.docs.map(segDoc)); segJuntar(); }, e => { segRes.set(key, []); segJuntar(); if (e.code !== 'permission-denied') cb.onError && cb.onError(e); }));
}
// Filtros que as regras pedem para esta pessoa: [] = sem filtro (vê tudo).
function filtrosSeg() {
  if (veTudoSeg(me)) return [[]];
  const l = [];
  if (registraSeg(me)) l.push([where('por', '==', me.uid)]);
  for (const k of supConjs(me)) l.push([where('conj', '==', k)]);
  return l;
}
function startSeg() {
  segOn = true; cache.seg.on = true;
  dataSubs.push(onSnapshot(doc(db, 'config', 'seguranca'), s => { cache.seg.cfg = s.exists() ? s.data() : null; cache.seg.cfgLoaded = true; cache.seg.v++; changed(); }, e => { cache.seg.cfgLoaded = true; cb.onError && cb.onError(e); }));
  const m = today().slice(0, 7);
  // em aberto: uma consulta por situação (só igualdades: não precisa de índice composto no banco)
  for (const st of ['aberta', 'tratamento']) filtrosSeg().forEach((f, i) => { const k = `seganom|${st}|${i}`; segIniciais.push(k); segOuvir(k, query(collection(db, 'seganom'), where('status', '==', st), ...f)); });
  segWatch([addMonth(m, -1), m], true);
}
export function segWatch(meses, inicial) {
  if (!db || !me || !segOn) return;
  for (const m of new Set(meses.filter(Boolean))) {
    if (cache.seg.meses.has(m)) continue; cache.seg.meses.add(m);
    for (const col of ['seginter', 'seganom']) filtrosSeg().forEach((f, i) => { const k = `${col}|${m}|${i}`; if (inicial) segIniciais.push(k); segOuvir(k, query(collection(db, col), where('mes', '==', m), ...f)); });
  }
}
// Novo registro com as fotos: tudo num lote só. Sem sinal, fica na fila do aparelho (inclusive as fotos) e sobe
// quando a conexão voltar. fotos: [{ dados, mini }] já reduzidas pela tela.
export function segNovo(col, dados, fotos) {
  const r = doc(collection(db, col)); const ids = fotos.map(() => doc(collection(db, 'segfotos')).id);
  const b = writeBatch(db);
  b.set(r, { ...dados, fotos: ids, minis: fotos.map(f => f.mini), por: me.uid, porNome: me.nome || me.login || '', em: serverTimestamp() });
  fotos.forEach((f, i) => b.set(doc(db, 'segfotos', ids[i]), { reg: r.id, col, tipo: 'antes', mini: f.mini, dados: f.dados, ordem: i, autor: me.uid, por: me.uid, conj: dados.conj || '', area: dados.area, mes: dados.mes, em: serverTimestamp() }));
  track(b.commit());
  return r.id;
}
// O autor corrige o próprio registro (até 24 h; a anomalia, enquanto aberta).
export const segEditar = (col, id, patch) => track(updateDoc(doc(db, col, id), { ...patch, atualizadoEm: serverTimestamp() }));
// Acompanhamento da anomalia (só os campos do tratamento). foto = { dados, mini } do depois, quando houver.
export function segTratar(a, patch, foto) {
  const b = writeBatch(db); const p = { ...patch };
  if (foto) {
    const fid = doc(collection(db, 'segfotos')).id;
    b.set(doc(db, 'segfotos', fid), { reg: a.id, col: 'seganom', tipo: 'depois', mini: foto.mini, dados: foto.dados, ordem: 0, autor: a.por, por: me.uid, conj: a.conj || '', area: a.area, mes: a.mes, em: serverTimestamp() });
    p.trat = { ...p.trat, fotoDepois: fid, miniDepois: foto.mini };
  }
  b.update(doc(db, 'seganom', a.id), { ...p, atualizadoEm: serverTimestamp(), atualizadoPor: me.uid });
  track(b.commit());
}
// Foto grande (só ao tocar na miniatura).
export async function segFoto(id) { const s = await getDoc(doc(db, 'segfotos', id)); return s.exists() ? s.data().dados : null; }
// Apagar um registro (só o administrador; as regras conferem): o registro e as fotos dele, num lote só.
export function segExcluir(col, r) {
  const b = writeBatch(db); b.delete(doc(db, col, r.id));
  for (const f of fotosDoReg(r)) b.delete(doc(db, 'segfotos', f));
  return track(b.commit());
}
export const segSalvarCfg = cfg => track(setDoc(doc(db, 'config', 'seguranca'), { ...cfg, atualizadoEm: serverTimestamp(), por: me.nome || me.login || '' }));

// ---------- Limpeza de dados (Administração › Limpeza de dados, só o administrador) ----------
// A tela lê do servidor o que vai sair (para a prévia e a cópia de segurança) e grava em lotes de até 400.
// Datas do banco (Timestamp) viram texto ISO na cópia.
const cru = v => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : Array.isArray(v) ? v.map(cru) : v && typeof v === 'object' && !(v instanceof FieldPath) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cru(x)])) : v);
// conds: [[campo, operador, valor]] (ex.: [['mes', '==', '2026-08']] ou [['at', '<', new Date(...)]])
export async function limpezaLer(col, conds = []) {
  const qs = await getDocs(query(collection(db, col), ...conds.map(([c, o, v]) => where(c, o, v))));
  return qs.docs.map(d => ({ id: d.id, ...cru(d.data()) }));
}
export async function limpezaLerIds(col, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 20) {
    const l = await Promise.all(ids.slice(i, i + 20).map(id => getDoc(doc(db, col, id))));
    for (const s of l) if (s.exists()) out.push({ id: s.id, ...cru(s.data()) });
  }
  return out;
}
// Um lote: { tipo: 'apagar' | 'alterar', col, id, campos: [[caminho[], valor]] } (valor null apaga o campo).
// Espera o servidor confirmar (sem sinal, a tela nem começa): um erro no meio para a limpeza e mostra o que faltou.
export async function limpezaGravar(ops) {
  const b = writeBatch(db);
  for (const o of ops) {
    const r = doc(db, o.col, o.id);
    if (o.tipo === 'apagar') b.delete(r);
    else { const a = []; for (const [p, v] of o.campos) a.push(new FieldPath(...p), v === null ? deleteField() : v); b.update(r, ...a); }
  }
  pending++; syncMudou();
  try { await b.commit(); } finally { pending--; syncMudou(); }
}
