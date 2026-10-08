// Modo demonstração (abra com ?demo): mesma interface do data.js, sem Firebase.
// Os dados ficam só neste navegador. Os apontamentos antes de hoje são exemplos.
import { AREAS, MOTIVOS, ATIVOS, add, today, weekOf, monthOfWeek, addMonth, weeksOfMonth, novaSemana, seedParaBanco } from './cal.js';

export const isMock = true;
export const cache = { config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, semanas: {}, monthsLoaded: new Set(), log: [], usuarios: [] };
const LS = 'coqueria-demo-v1';
let cb = {}, me = null;

const changed = () => { persist(); cb.onData && cb.onData(); };
function persist() {
  try { localStorage.setItem(LS, JSON.stringify({ config: cache.config, plano: cache.plano, colabs: cache.colabs, sitByMonth: cache.sitByMonth, semanas: Object.fromEntries(Object.entries(cache.semanas).map(([k, v]) => [k, { ...v, d: undefined, ev: undefined }])), log: cache.log.slice(0, 40), usuarios: cache.usuarios, me: me && me.uid })); } catch (e) { /* sem armazenamento */ }
}
const toLocal = (id, x) => ({ ...x, id, m: x.m || {}, ev: x.ev || {}, d: x.ids.map(p => x.s[p] || '_______') });
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed) { let t = seed + 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }

async function fresh() {
  const seed = await (await fetch('seed.json')).json();
  const x = seedParaBanco(seed);
  Object.assign(cache, { config: x.config, configLoaded: true, plano: x.plano, colabs: x.colabs, sitByMonth: x.sit, semanas: {}, log: [] });
  const hoje = today(), cur = monthOfWeek(weekOf(hoje));
  for (const m of [addMonth(cur, -1), cur, addMonth(cur, 1), addMonth(cur, 2)]) {
    for (const ini of weeksOfMonth(m)) for (const a of AREAS) {
      const w = novaSemana(a, ini, x.plano[a]);
      for (const pid of w.ids) {
        const arr = [...w.s[pid]];
        for (let k = 0; k < 7; k++) {
          if (add(ini, k) >= hoje) continue;
          const r = rnd(hash(a + ini + pid + k));
          if (arr[k] === 'P') { if (r < .86) arr[k] = 'R'; else if (r < .93) { arr[k] = 'N'; w.m[pid + '|' + k] = MOTIVOS[Math.floor(r * 1000) % 6]; } }
          else if (k < 5 && r < .012) arr[k] = 'E';
        }
        w.s[pid] = arr.join('');
      }
      cache.semanas[a + '|' + ini] = toLocal(a + '|' + ini, w);
    }
    cache.config.meses.push(m);
  }
  const lideres = Object.values(x.colabs).flat().filter(c => c.funcao === 'LÍDER' || c.funcao === 'SUPERVISOR');
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').filter(Boolean);
  cache.usuarios = [{ uid: 'admin', nome: 'Administrador (demonstração)', login: 'admin', senha: '123456', papel: 'admin', area: null },
    ...lideres.map(c => { const p = slug(c.nome); return { uid: c.id, nome: c.nome, login: p[0] + '.' + p[p.length - 1], senha: '123456', papel: c.funcao === 'LÍDER' ? 'lider' : 'supervisor', area: c.area }; }),
    { uid: 'leitor', nome: 'Visitante', login: 'visitante', senha: '123456', papel: 'leitor', area: null },
    { uid: 'novo', nome: 'Novo usuário', login: 'novo', senha: '123456', papel: 'leitor', area: null, trocarSenha: true },
    { uid: 'bloq', nome: 'Usuário bloqueado', login: 'bloqueado', senha: '123456', papel: 'bloqueado', area: null }];
}

export async function start(callbacks) {
  cb = callbacks;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* ignora */ }
  if (saved && saved.config) {
    Object.assign(cache, { config: saved.config, configLoaded: true, plano: saved.plano, colabs: saved.colabs, sitByMonth: saved.sitByMonth, log: (saved.log || []).map(l => ({ ...l, at: new Date(l.at) })), usuarios: saved.usuarios });
    cache.semanas = Object.fromEntries(Object.entries(saved.semanas).map(([k, v]) => [k, toLocal(k, v)]));
  } else await fresh();
  cache.config.meses.forEach(m => cache.monthsLoaded.add(m));
  me = saved && 'me' in saved ? (cache.usuarios.find(u => u.uid === saved.me) || null) : cache.usuarios[0];
  emitAuth(); changed();
}
function emitAuth() {
  if (!me) return cb.onAuth({ status: 'signedOut' });
  if (!ATIVOS.has(me.papel)) return cb.onAuth({ status: 'blocked', user: me });
  if (me.trocarSenha) return cb.onAuth({ status: 'mustChange', user: me });
  cb.onAuth({ status: 'ready', user: me });
}
export function mockSwitch(uid) { me = cache.usuarios.find(u => u.uid === uid) || me; persist(); emitAuth(); changed(); }
export async function mockReset() { try { localStorage.removeItem(LS); } catch (e) { /* ignora */ } await fresh(); cache.config.meses.forEach(m => cache.monthsLoaded.add(m)); me = cache.usuarios[0]; emitAuth(); changed(); }
export const pendingWrites = () => 0;
export function watchMonths() { /* tudo já está em memória */ }
export const sit = key => { const m = key.split('|')[1].slice(0, 7); return (cache.sitByMonth[m] || {})[key]; };
export const normLogin = s => String(s || '').trim().toLowerCase();
export const loginValido = s => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(s);
export const erroAuth = e => (e && e.message) || 'Erro inesperado.';
export async function signIn(login, senha) {
  const u = cache.usuarios.find(x => x.login === normLogin(login));
  if (!u || u.senha !== senha) throw new Error('Usuário ou senha incorretos.');
  me = u; persist(); emitAuth(); changed();
}
export async function signInGoogle() { throw new Error('Na demonstração use usuário e senha.'); }
export async function signOut() { me = null; persist(); cb.onAuth({ status: 'signedOut' }); }
export async function criarPrimeiroAdmin() { /* não usado na demonstração */ }
export async function criarUsuario({ nome, login, senha, papel, area }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (cache.usuarios.some(u => u.login === login)) throw new Error(`O usuário "${login}" já existe.`);
  if (String(senha).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  cache.usuarios.push({ uid: 'u' + Date.now().toString(36), nome, login, senha, papel, area: area || null, trocarSenha: true }); changed();
}
export async function redefinirSenha(uid, nova) {
  if (uid === me.uid) throw new Error('Para a sua própria senha, use "Alterar minha senha".');
  if (String(nova).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  Object.assign(cache.usuarios.find(u => u.uid === uid), { senha: nova, trocarSenha: true }); changed();
}
export async function definirNovaSenha(nova) { if (String(nova).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.'); Object.assign(me, { senha: nova, trocarSenha: false }); persist(); emitAuth(); changed(); }
export async function alterarSenha(atual, nova) { if (me.senha !== atual) throw new Error('A senha atual não confere.'); if (String(nova).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.'); me.senha = nova; changed(); }

export async function setStatusMany(docId, changes) {
  const w = cache.semanas[docId];
  for (const c of changes) { w.s[c.pid] = c.str; const mk = c.pid + '|' + c.k; if (c.motivo) w.m[mk] = c.motivo; else delete w.m[mk]; }
  Object.assign(w, toLocal(docId, w)); changed();
}
export async function setSit(key, code) { const m = key.split('|')[1].slice(0, 7); const o = (cache.sitByMonth[m] ||= {}); if (code) o[key] = code; else delete o[key]; changed(); }
export async function savePlano(area, itens) { cache.plano[area] = itens; changed(); }
export async function saveRotas(rotas) { cache.config.rotas = rotas; changed(); }
export async function setUsuario(uid, patch) { Object.assign(cache.usuarios.find(u => u.uid === uid), patch); if (uid === me.uid) emitAuth(); changed(); }
export function log(t) { cache.log.unshift({ at: new Date(), uid: me.uid, nome: me.nome, t }); cache.log = cache.log.slice(0, 40); changed(); }
export async function gerarMes(ym, planoPorArea, aPartirDe) {
  let n = 0;
  for (const ini of weeksOfMonth(ym)) { if (aPartirDe && ini < aPartirDe) continue; for (const a of AREAS) { const id = a + '|' + ini; if (cache.semanas[id]) continue; const w = novaSemana(a, ini, planoPorArea[a]); cache.semanas[id] = toLocal(id, w); n += w.ids.length; } }
  if (!cache.config.meses.includes(ym)) { cache.config.meses.push(ym); cache.config.meses.sort(); }
  cache.monthsLoaded.add(ym); changed(); return n;
}
export async function importar() { /* a demonstração já começa com os dados da planilha */ }

// Evidências na demonstração: ficam só na memória desta aba.
const EV = [];
export async function saveConfig(patch) { Object.assign(cache.config, patch); changed(); }
export async function listarEvidencias(docId, pid, k) { return EV.filter(e => e.semana === docId && e.pid === pid && e.k === k); }
export async function abrirEvidencia(id) { const e = EV.find(x => x.id === id); return e ? e.dados : null; }
export function addEvidencia(e) {
  const x = { ...e, id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), semana: e.docId, por: me.uid, porNome: me.nome, at: new Date() };
  EV.push(x); const w = cache.semanas[e.docId]; w.ev = w.ev || {}; const key = e.pid + '|' + e.k; w.ev[key] = (w.ev[key] || 0) + 1; changed();
  const { dados, ...meta } = x; return meta;
}
export async function removerEvidencia(ev) {
  const i = EV.findIndex(x => x.id === ev.id); if (i >= 0) EV.splice(i, 1);
  const w = cache.semanas[ev.semana]; const key = ev.pid + '|' + ev.k; w.ev[key] = Math.max(0, (w.ev[key] || 1) - 1); changed();
}
