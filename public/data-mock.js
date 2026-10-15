// Modo demonstração (abra com ?demo): mesma interface do data.js, sem Firebase.
// Os dados ficam só neste navegador. Os apontamentos antes de hoje são exemplos.
import { SETS, SET_KEYS, setDaArea, MOTIVOS, ATIVOS, add, today, weekOf, monthOfWeek, addMonth, weeksOfMonth, novaSemana, seedParaBanco } from './cal.js';
import { podeAcesso } from './acessos.js';
import { prepararImportacao } from './planilhas-adm.js';

export const isMock = true;
const novoSet = () => ({ config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, sitExtra: {}, semanas: {}, aprov: {}, monthsLoaded: new Set() });
const S = { patio: novoSet(), bateria: novoSet() };
let cur = 'patio';
export const useSet = k => { if (S[k]) cur = k; };
export const setAtual = () => cur;
export const dados = k => S[k];
export const cache = { log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, gVersao: 0, e: { loaded: false, config: null, cad: { operadores: [], frota: [] }, lanc: [], par: [], insp: [], aval: {}, meses: new Set() }, eVersao: 0 };
for (const k of Object.keys(novoSet())) Object.defineProperty(cache, k, { get: () => S[cur][k], set: v => { S[cur][k] = v; }, enumerable: true });
export const temSet = (u, k) => !!u && (u.papel === 'admin' || (u.modulos || (k === 'patio' ? ['operacao'] : [])).includes(SETS[k].mod));
export const temEquip = u => !!u && (u.papel === 'admin' || (u.modulos || []).includes('equipamentos'));
export const temGestao = u => !!u && (u.papel === 'admin' || (u.modulos || []).includes('gestao'));
const LS = 'coqueria-demo-v2';
// Demonstração: dados de exemplo com nomes e matrículas fictícios (pasta demo/). Os dados reais não ficam no site.
const seed_ = async nome => { const r = await fetch('demo/' + nome.replace(/^seed/, 'exemplo')); if (!r.ok) throw new Error('Dados de exemplo não encontrados: ' + nome); return r.json(); };
export const seed = seed_;
let cb = {}, me = null;

let versao = 0;
const changed = () => { versao++; persist(); cb.onData && cb.onData(); };
function persist() {
  const sets = Object.fromEntries(SET_KEYS.map(k => [k, { config: S[k].config, plano: S[k].plano, colabs: S[k].colabs, sitByMonth: S[k].sitByMonth, sitExtra: S[k].sitExtra, aprov: S[k].aprov, semanas: Object.fromEntries(Object.entries(S[k].semanas).map(([i, v]) => [i, { ...v, d: undefined, ev: undefined }])) }]));
  try { localStorage.setItem(LS, JSON.stringify({ v: 2, sets, log: cache.log.slice(0, 40), usuarios: cache.usuarios, me: me && me.uid, g: { config: cache.g.config, colabs: cache.g.colabs, ocorr: cache.g.ocorr }, gAssin: Object.fromEntries(Object.entries(cache.gAssin).filter(([, a]) => a.metodo !== 'papel')), e: { config: cache.e.config, cad: cache.e.cad, lanc: cache.e.lanc, par: cache.e.par, insp: cache.e.insp, aval: cache.e.aval } })); } catch (e) { /* sem armazenamento */ }
}
const toLocal = (id, x) => ({ ...x, id, m: x.m || {}, ev: x.ev || {}, d: x.ids.map(p => x.s[p] || '_______') });
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed) { let t = seed + 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }

async function freshSet(k) {
  const seed = await seed_(SETS[k].seed);
  const x = seedParaBanco(seed, SETS[k].areas);
  const st = S[k] = novoSet();
  Object.assign(st, { config: x.config, configLoaded: true, plano: x.plano, colabs: x.colabs, sitByMonth: x.sit, semanas: {} });
  // demonstração: quem é de turno 4x4 recebe uma letra (A a D), para a folga automática da escala aparecer
  { let i = 0; for (const a of Object.keys(x.colabs)) x.colabs[a].forEach(c => { if (/4\s*X\s*4/i.test(c.regime || '') && !c.turma) c.turma = 'ABCD'[i++ % 4]; }); }
  const hoje = today(), cur0 = monthOfWeek(weekOf(hoje));
  for (const m of [addMonth(cur0, -1), cur0, addMonth(cur0, 1), addMonth(cur0, 2)]) {
    for (const ini of weeksOfMonth(m)) for (const a of SETS[k].areas) {
      const w = novaSemana(a, ini, x.plano[a]);
      for (const pid of w.ids) {
        const arr = [...w.s[pid]];
        for (let d = 0; d < 7; d++) {
          if (add(ini, d) >= hoje) continue;
          const r = rnd(hash(a + ini + pid + d));
          if (arr[d] === 'P') { if (r < .86) arr[d] = 'R'; else if (r < .93) { arr[d] = 'N'; w.m[pid + '|' + d] = MOTIVOS[Math.floor(r * 1000) % 6]; } }
          else if (d < 5 && r < .012) arr[d] = 'E';
        }
        w.s[pid] = arr.join('');
      }
      st.semanas[a + '|' + ini] = toLocal(a + '|' + ini, w);
    }
    st.config.meses.push(m);
  }
}
async function fresh() {
  cache.log = [];
  for (const k of SET_KEYS) await freshSet(k);
  const sg = await seed_('seed-gestao.json');
  cache.g = { loaded: true, config: { codigo: sg.codigo, revisao: sg.revisao, declaracao: sg.declaracao, tipos: sg.tipos }, colabs: sg.colabs, ocorr: sg.ocorrencias.map((o, i) => ({ id: 'oc' + i, ...o, assinaturaId: null, metodo: null })) };
  cache.gAssin = {};
  await carregarE(null);
  const lideres = SET_KEYS.flatMap(k => Object.values(S[k].colabs).flat().filter(c => c.funcao === 'LÍDER' || c.funcao === 'SUPERVISOR').map(c => ({ ...c, set: k })));
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').filter(Boolean);
  const usados = new Set();
  const loginDe = n => { const p = slug(n); let l = p[0] + '.' + p[p.length - 1], i = 2; while (usados.has(l)) l = p[0] + '.' + p[p.length - 1] + i++; usados.add(l); return l; };
  cache.usuarios = [{ uid: 'admin', nome: 'Administrador (demonstração)', login: 'admin', senha: '123456', papel: 'admin', area: null, modulos: ['operacao', 'bateria', 'equipamentos', 'gestao'] },
    { uid: 'eq', nome: 'Supervisor de Equipamentos', login: 'operacao', senha: '123456', papel: 'supervisor', area: null, modulos: ['equipamentos'] },
    { uid: 'rh', nome: 'Analista de Gestão', login: 'gestao', senha: '123456', papel: 'supervisor', area: null, modulos: ['gestao'] },
    ...lideres.map(c => ({ uid: c.id, nome: c.nome, login: loginDe(c.nome), senha: '123456', papel: c.funcao === 'LÍDER' ? 'lider' : 'supervisor', area: c.area, modulos: c.funcao === 'SUPERVISOR' ? [SETS[c.set].mod, 'gestao'] : [SETS[c.set].mod] })),
    { uid: 'gest', nome: 'Gestor (demonstração)', login: 'gestor', senha: '123456', papel: 'gestor', area: null, modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'] },
    { uid: 'coord', nome: 'Coordenador (demonstração)', login: 'coordenador', senha: '123456', papel: 'coordenador', area: null, modulos: ['operacao', 'bateria'] },
    { uid: 'sup2', nome: 'Supervisor de duas áreas', login: 'supervisor2', senha: '123456', papel: 'supervisor', area: 'RECEBIMENTO', area2: 'PREPARAÇÃO', modulos: ['operacao', 'bateria'] },
    { uid: 'leitor', nome: 'Visitante', login: 'visitante', senha: '123456', papel: 'leitor', area: null, modulos: ['operacao', 'frequencia'] },
    { uid: 'adm1', nome: 'Analista de Frequência', login: 'frequencia', senha: '123456', papel: 'supervisor', area: null, modulos: ['frequencia'] },
    { uid: 'admv', nome: 'Assistente Administrativo', login: 'administrativo', senha: '123456', papel: 'administrativo', area: null, modulos: ['operacao', 'gestao', 'frequencia'] },
    { uid: 'novo', nome: 'Novo usuário', login: 'novo', senha: '123456', papel: 'leitor', area: null, trocarSenha: true },
    { uid: 'bloq', nome: 'Usuário bloqueado', login: 'bloqueado', senha: '123456', papel: 'bloqueado', area: null }];
}

export async function start(callbacks) {
  cb = callbacks;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* ignora */ }
  if (saved && saved.v === 2 && saved.sets) {
    for (const k of SET_KEYS) { const x = saved.sets[k]; const st = S[k] = novoSet(); if (!x || !x.config) { await freshSet(k); continue; } Object.assign(st, { config: x.config, configLoaded: true, plano: x.plano, colabs: x.colabs, sitByMonth: x.sitByMonth, sitExtra: x.sitExtra || {}, aprov: x.aprov || {}, semanas: Object.fromEntries(Object.entries(x.semanas).map(([i, v]) => [i, toLocal(i, v)])) }); }
    Object.assign(cache, { log: (saved.log || []).map(l => ({ ...l, at: new Date(l.at) })), usuarios: saved.usuarios });
    await carregarE(saved.e);
    if (saved.g && saved.g.config) { cache.g = { loaded: true, ...saved.g }; cache.gAssin = saved.gAssin || {}; } else { const sg = await seed_('seed-gestao.json'); cache.g = { loaded: true, config: { codigo: sg.codigo, revisao: sg.revisao, declaracao: sg.declaracao, tipos: sg.tipos }, colabs: sg.colabs, ocorr: sg.ocorrencias.map((o, i) => ({ id: 'oc' + i, ...o })) }; }
  } else { saved = null; await fresh(); }
  for (const k of SET_KEYS) S[k].config.meses.forEach(m => S[k].monthsLoaded.add(m));
  try { amostras(); } catch (e) { /* sem canvas */ }
  await seniorExemplo();
  me = saved && 'me' in saved ? (cache.usuarios.find(u => u.uid === saved.me) || null) : cache.usuarios[0];
  if (me && !cache.usuarios.some(u => u.uid === 'admv')) cache.usuarios.push({ uid: 'admv', nome: 'Assistente Administrativo', login: 'administrativo', senha: '123456', papel: 'administrativo', area: null, modulos: ['operacao', 'gestao', 'frequencia'] });
  if (me && !cache.usuarios.some(u => u.uid === 'adm1')) cache.usuarios.push({ uid: 'adm1', nome: 'Analista de Frequência', login: 'frequencia', senha: '123456', papel: 'supervisor', area: null, modulos: ['frequencia'] });
  await iniciarAdm();
  emitAuth(); changed();
}
let acessoAtual = 'operacao';
export const definirAcesso = k => { acessoAtual = k === 'sistema' ? 'sistema' : 'operacao'; };
function emitAuth() {
  if (!me) return cb.onAuth({ status: 'signedOut' });
  if (!ATIVOS.has(me.papel)) return cb.onAuth({ status: 'blocked', user: me });
  if (acessoAtual === 'sistema' && me.papel !== 'admin') acessoAtual = 'operacao';
  if (!podeAcesso(me, acessoAtual)) return cb.onAuth({ status: 'semAcesso', user: me, acesso: acessoAtual });
  if (me.trocarSenha) return cb.onAuth({ status: 'mustChange', user: me });
  cb.onAuth({ status: 'ready', user: me, acesso: acessoAtual });
}
export async function mockSwitch(uid) { me = cache.usuarios.find(u => u.uid === uid) || me; persist(); await iniciarAdm(); emitAuth(); changed(); }
export async function mockReset() { try { localStorage.removeItem(LS); localStorage.removeItem(LSA); } catch (e) { /* ignora */ } admPronto = false; EV.length = 0; await fresh(); for (const k of SET_KEYS) S[k].config.meses.forEach(m => S[k].monthsLoaded.add(m)); try { amostras(); } catch (e) { /* sem canvas */ } me = cache.usuarios[0]; await iniciarAdm(); emitAuth(); changed(); }
export const pendingWrites = () => 0;
export function watchMonths() { /* tudo já está em memória */ }
export const sit = key => { const m = key.split('|')[1].slice(0, 7); return (cache.sitByMonth[m] || {})[key]; };
export const normLogin = s => String(s || '').trim().toLowerCase();
export const loginValido = s => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(s);
export const erroAuth = e => (e && e.message) || 'Erro inesperado.';
export async function signIn(login, senha) {
  const u = cache.usuarios.find(x => x.login === normLogin(login));
  if (!u || u.senha !== senha) throw new Error('Usuário ou senha incorretos.');
  me = u; persist(); await iniciarAdm(); emitAuth(); changed();
}
export async function signInGoogle() { throw new Error('Na demonstração use usuário e senha.'); }
export async function signOut() { me = null; persist(); cb.onAuth({ status: 'signedOut' }); }
export async function criarPrimeiroAdmin() { /* não usado na demonstração */ }
export async function criarUsuario({ nome, login, senha, papel, area, area2, modulos, acessos }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (cache.usuarios.some(u => u.login === login)) throw new Error(`O usuário "${login}" já existe.`);
  if (String(senha).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  cache.usuarios.push({ uid: 'u' + Date.now().toString(36), nome, login, senha, papel, area: area || null, area2: area2 || null, modulos: modulos || ['operacao'], acessos: acessos || ['operacao'], trocarSenha: true }); changed();
}
export async function redefinirSenha(uid, nova) {
  if (uid === me.uid) throw new Error('Para a sua própria senha, use "Alterar minha senha".');
  if (String(nova).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  Object.assign(cache.usuarios.find(u => u.uid === uid), { senha: nova, trocarSenha: true }); changed();
}
export async function definirNovaSenha(nova) { if (String(nova).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.'); Object.assign(me, { senha: nova, trocarSenha: false }); persist(); emitAuth(); changed(); }
export async function alterarSenha(atual, nova) { if (me.senha !== atual) throw new Error('A senha atual não confere.'); if (String(nova).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.'); me.senha = nova; changed(); }

export async function setStatusMany(docId, changes) {
  const w = cache.semanas[docId];
  for (const c of changes) { w.s[c.pid] = c.str; const mk = c.pid + '|' + c.k; if (c.motivo) w.m[mk] = c.motivo; else delete w.m[mk]; }
  Object.assign(w, toLocal(docId, w)); changed();
}
export const sitInfo = key => { const m = key.split('|')[1].slice(0, 7); const x = (S[cur].sitExtra || {})[m] || {}; return { cob: (x.cob || {})[key] || '', he: (x.he || {})[key] || '' }; };
export const sitExtraMes = m => (S[cur].sitExtra || {})[m] || { cob: {}, he: {} };
export async function setSitExtra(campo, key, val) { const m = key.split('|')[1].slice(0, 7); const x = (S[cur].sitExtra[m] ||= { cob: {}, he: {} }); const o = (x[campo] ||= {}); if (val) o[key] = val; else delete o[key]; changed(); }
export async function setAprov(docId, area, mes, itens) {
  const em = new Date().toISOString(); const a = (S[cur].aprov[docId] ||= {});
  for (const [k, x] of Object.entries(itens)) a[k] = { ...x, por: me.uid, nome: me.nome, em };
  changed();
}
export async function setSit(key, code) { const m = key.split('|')[1].slice(0, 7); const o = (cache.sitByMonth[m] ||= {}); if (code) o[key] = code; else delete o[key]; changed(); }
export async function savePlano(area, itens) { cache.plano[area] = itens; changed(); }
export async function salvarColabsArea(area, itens, k = setDaArea(area) || cur) { S[k].colabs[area] = itens; changed(); }
export async function saveRotas(rotas) { cache.config.rotas = rotas; changed(); }
// Avisos na demonstração: não há servidor de mensagens; mostra um aviso local para testar.
cache.avisosCfg = { vapid: 'demonstracao' }; cache.meusAvisos = null; cache.permissoes = {};
export async function salvarPermissoes(abas) { cache.permissoes = abas; changed(); }
// Escala na demonstração: 3x3 com datas de exemplo (o 4x4 vem das turmas da Operação).
cache.escalas = { regimes: { '3x3': { turmas: { I: '2026-10-01', J: '2026-10-04' } } } }; cache.escalasLoaded = true;
export async function salvarEscalas(cfg) { cache.escalas = JSON.parse(JSON.stringify(cfg)); changed(); }
export async function avisosSuportados() { return 'Notification' in window; }
export async function ativarAvisos(prefs) {
  if ('Notification' in window && Notification.permission !== 'granted') { try { await Notification.requestPermission(); } catch (e) { /* ignora */ } }
  cache.meusAvisos = { tokens: ['demo'], prefs }; changed();
}
export const avisoAtivoAqui = () => !!(cache.meusAvisos && cache.meusAvisos.tokens && cache.meusAvisos.tokens.length);
export async function desativarAvisos() { cache.meusAvisos = { ...(cache.meusAvisos || {}), tokens: [] }; changed(); }
export async function salvarPrefsAvisos(prefs) { cache.meusAvisos = { ...(cache.meusAvisos || { tokens: [] }), prefs }; changed(); }
export async function salvarChaveAvisos(vapid) { cache.avisosCfg = { vapid }; changed(); }
export async function excluirUsuario(uid) { if (uid === me.uid) throw new Error('Você não pode apagar o seu próprio usuário.'); cache.usuarios = cache.usuarios.filter(u => u.uid !== uid); changed(); }
export async function setUsuario(uid, patch) { Object.assign(cache.usuarios.find(u => u.uid === uid), patch); if (uid === me.uid) emitAuth(); changed(); }
export function log(t) { cache.log.unshift({ at: new Date(), uid: me.uid, nome: me.nome, t }); cache.log = cache.log.slice(0, 40); changed(); }
export async function gerarMes(ym, planoPorArea, aPartirDe) {
  let n = 0;
  for (const ini of weeksOfMonth(ym)) { if (aPartirDe && ini < aPartirDe) continue; for (const a of SETS[cur].areas) { const id = a + '|' + ini; if (cache.semanas[id]) continue; const w = novaSemana(a, ini, planoPorArea[a]); cache.semanas[id] = toLocal(id, w); n += w.ids.length; } }
  if (!cache.config.meses.includes(ym)) { cache.config.meses.push(ym); cache.config.meses.sort(); }
  cache.monthsLoaded.add(ym); changed(); return n;
}
export async function importar() { /* a demonstração já começa com os dados da planilha */ }

// Evidências na demonstração: ficam só na memória desta aba.
const EV = [];
export async function saveConfig(patch) { Object.assign(cache.config, patch); changed(); }
export async function listarEvidencias(docId, pid, k) { return EV.filter(e => e.semana === docId && e.pid === pid && e.k === k); }
export async function listarEvidenciasSemanas(ids) { return EV.filter(e => ids.includes(e.semana)).map(({ dados, ...m }) => m); }
// Fotos de exemplo para o relatório fotográfico (desenhadas na hora, só na demonstração).
function fotoExemplo(txt, cor, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, cor); gr.addColorStop(1, '#1C1B4A'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i * 137) % w, h * .7 + (i % 3) * 20, 40 + i * 12, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = `600 ${Math.round(h / 14)}px system-ui,sans-serif`; g.fillText('FOTO DE EXEMPLO', w * .06, h * .16);
  g.font = `${Math.round(h / 22)}px system-ui,sans-serif`; g.fillText(txt.slice(0, 48), w * .06, h * .26);
  return cv.toDataURL('image/jpeg', .7);
}
function amostras() {
  if (EV.length || typeof document === 'undefined') return;
  const hoje = today(); let n = 0;
  for (const sk of SET_KEYS) { n = 0; const plano = new Map(Object.values(S[sk].plano).flat().map(p => [p.id, p]));
  const cores = ['#F05A26', '#2E7D5B', '#3B5BA9', '#B98200'];
  for (const w of Object.values(S[sk].semanas).sort((a, b) => (a.ini < b.ini ? 1 : -1))) {
    if (w.ini > hoje || w.ini < add(hoje, -40)) continue;
    w.ids.forEach((pid, i) => {
      for (let k = 0; k < 7; k++) {
        if (n >= 18 || w.d[i][k] !== 'R' || add(w.ini, k) >= hoje) continue;
        const r = rnd(hash('ev' + w.id + pid + k)); if (r > .02) continue;
        const p = plano.get(pid); if (!p) continue;
        const q = 1 + Math.floor(r * 150) % 3;
        for (let j = 0; j < q; j++) {
          const dados = fotoExemplo(p.ativ, cores[(n + j) % 4], 640, 480), thumb = fotoExemplo(p.ativ, cores[(n + j) % 4], 240, 180);
          EV.push({ id: 'ex' + sk + n + '_' + j, semana: w.id, area: w.area, pid, k, nome: `foto-${j + 1}.jpg`, tipo: 'image/jpeg', tamanho: Math.round(dados.length * .75), thumb, dados, por: 'admin', porNome: 'Demonstração', at: new Date(add(w.ini, k) + 'T' + String(8 + j).padStart(2, '0') + ':15:00') });
        }
        w.ev[pid + '|' + k] = (w.ev[pid + '|' + k] || 0) + q; n++;
      }
    });
  }
  }
}
export async function abrirEvidencia(id) { const e = EV.find(x => x.id === id); return e ? e.dados : null; }
export function addEvidencia(e) {
  const x = { ...e, id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), semana: e.docId, por: me.uid, porNome: me.nome, at: new Date() };
  EV.push(x); const w = S[setDaArea(e.area) || cur].semanas[e.docId]; w.ev = w.ev || {}; const key = e.pid + '|' + e.k; w.ev[key] = (w.ev[key] || 0) + 1; changed();
  const { dados, ...meta } = x; return meta;
}
export async function removerEvidencia(ev) {
  const i = EV.findIndex(x => x.id === ev.id); if (i >= 0) EV.splice(i, 1);
  const w = S[setDaArea(ev.area) || cur].semanas[ev.semana]; const key = ev.pid + '|' + ev.k; w.ev[key] = Math.max(0, (w.ev[key] || 1) - 1); changed();
}

// ---------- Gestão (demonstração) ----------
const gch = () => { cache.gVersao++; changed(); };
const gid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export async function gImportar() { /* a demonstração já começa com a planilha */ }
export async function gSeniorAplicado() { if (cache.g.senior) { cache.g.senior.aplicadoEm = new Date(); cache.g.senior.aplicadoPor = me.nome; } changed(); }
// Demonstração da ponte com o Senior: simula uma leitura feita hoje às 06:00, com algumas mudanças.
async function seniorExemplo() {
  try {
    const s = await seed_('seed-efetivo.json');
    const registros = s.linhas.map(l => ({ mat: l[0], nome: l[1], funcao: l[2], area: l[3], rota: l[4], regime: l[5], turma: l[6], lider: l[7], adm: l[8] }));
    registros[0] = { ...registros[0], funcao: 'EXECUTOR II' };
    registros.push({ mat: '9001', nome: 'COLABORADOR NOVO DO SENIOR', funcao: 'AJUDANTE', area: 'Coqueria - Bateria', rota: 'Coqueria - Bateria 2', regime: 'Adm', turma: 'ADM', adm: new Date().toISOString().slice(0, 10) });
    const d = new Date(); d.setHours(6, 0, 0, 0);
    cache.g.senior = { estado: 'ok', modo: 'demonstração', total: registros.length, registros, recebidoEm: d, aplicadoEm: null, avisos: [] };
  } catch (e) { cache.g.senior = null; }
}
export async function gImportarOcorrencias(lista) { cache.g.ocorr = [...cache.g.ocorr, ...lista.map(o => ({ assinadoEm: null, testemunha: '', ...o, id: gid(), metodo: o.status === 'pendente' ? null : 'importado', assinaturaId: null }))]; gch(); }
export async function gSalvarColabs(itens) { cache.g.colabs = itens; gch(); }
export async function gSalvarConfig(patch) { cache.g.config = { ...cache.g.config, ...patch }; gch(); }
export async function gAtualizarOcorrencia(id, patch) { cache.g.ocorr = cache.g.ocorr.map(o => (o.id === id ? { ...o, ...patch } : o)); gch(); }
export function gNovaOcorrencia(o) { const x = { id: gid(), ...o, assinadoEm: null, assinaturaId: null, metodo: null, testemunha: '' }; cache.g.ocorr = [...cache.g.ocorr, x]; gch(); return x; }
export async function gExcluirOcorrencias(ids) { const s = new Set(ids); cache.g.ocorr = cache.g.ocorr.filter(o => !s.has(o.id)); gch(); }
export function gExcluirOcorrencia(id) { cache.g.ocorr = cache.g.ocorr.filter(o => o.id !== id); gch(); }
export function gAssinar(a) {
  const id = gid(); cache.gAssin[id] = { ...a, por: me.uid, porNome: me.nome };
  cache.g.ocorr = cache.g.ocorr.map(o => (a.ocorrIds.includes(o.id) ? { ...o, status: a.metodo === 'recusa' ? 'recusada' : 'assinada', assinadoEm: a.metodo === 'recusa' ? null : a.em, assinaturaId: id, metodo: a.metodo, testemunha: (a.testemunhas || []).join(' e ') } : o));
  gch(); return id;
}
export async function gAbrirAssinatura(id) { return cache.gAssin[id] || null; }
export function gCarregarAssin() { /* já está em memória */ }

// ---------- Operação / equipamentos (demonstração) ----------
async function carregarE(salvo) {
  let e = salvo;
  if (!e || !e.config) {
    const s = await seed_('seed-equip.json'); let n = 0;
    const id = () => 'e' + (n++).toString(36);
    e = { config: s.config, cad: { operadores: s.operadores, frota: s.frota }, lanc: s.lanc.map(x => ({ id: id(), ...x, mes: x.data.slice(0, 7) })), par: s.paradas.map(x => ({ id: id(), ...x, mes: x.data.slice(0, 7) })), insp: [], aval: s.aval || {} };
  }
  e.cad = { ...e.cad, operadores: (e.cad.operadores || []).filter(o => !/^SITUA[ÇC][ÃA]O:/i.test(o.nome || '')) };
  cache.e = { loaded: true, ...e, meses: new Set([...e.lanc.map(x => x.mes), new Date().toISOString().slice(0, 7)]) };
}
const ech = () => { cache.eVersao++; changed(); };
const ECOL = { lanc: 'lanc', par: 'par', insp: 'insp' };
export function eWatch(ms) { ms.forEach(m => m && cache.e.meses.add(m)); }
export function eAdd(t, o) { const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); cache.e[ECOL[t]] = [...cache.e[ECOL[t]], { id, ...o, mes: o.data.slice(0, 7) }]; ech(); return id; }
export function eUpd(t, id, p) { cache.e[ECOL[t]] = cache.e[ECOL[t]].map(x => (x.id === id ? { ...x, ...p, mes: (p.data || x.data).slice(0, 7) } : x)); ech(); }
export function eDel(t, id) { cache.e[ECOL[t]] = cache.e[ECOL[t]].filter(x => x.id !== id); ech(); }
export async function eSalvarConfig(p) { cache.e.config = { ...cache.e.config, ...p }; ech(); }
export async function eSalvarCad(p) { cache.e.cad = { ...cache.e.cad, ...p }; ech(); }
export async function eSalvarAval(mes, op, v) { const a = cache.e.aval[mes] || (cache.e.aval[mes] = {}); a[op] = { ...(a[op] || {}), ...v }; ech(); }
export async function eCarregarTudo() { return { lanc: cache.e.lanc, par: cache.e.par, insp: cache.e.insp }; }
export async function eImportar() { /* a demonstração já começa com a planilha */ }

// ---------- Administrativo (demonstração): folhas e férias de exemplo, ligadas às Atividades da demonstração ----------
const LSA = 'coqueria-demo-adm-v1';
cache.adm = { loaded: false, ferias: [], fLoaded: false, comps: {}, sit: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
cache.feriasAtivas = []; cache.uso = null;
let admPronto = false;
const sitProxy = k => new Proxy({}, { get: (_, m) => S[k].sitByMonth[m] || {} });
function admPersist() { try { localStorage.setItem(LSA, JSON.stringify({ ferias: cache.adm.ferias, comps: cache.adm.comps })); } catch (e) { /* sem espaço */ } }
const admCh = () => { cache.feriasAtivas = cache.adm.ferias.filter(f => f.inicio && f.termino).map(f => ({ mat: f.mat, nome: f.nome, inicio: f.inicio, termino: f.termino })); admPersist(); changed(); };
async function iniciarAdm() {
  for (const k of SET_KEYS) cache.adm.colabs[k] = Object.values(S[k].colabs).flat();
  cache.adm.sit = { patio: sitProxy('patio'), bateria: sitProxy('bateria') };
  cache.adm.rh = cache.g.colabs || [];
  if (admPronto) return;
  admPronto = true;
  let salvo = null; try { salvo = JSON.parse(localStorage.getItem(LSA) || 'null'); } catch (e) { /* ignora */ }
  if (salvo && salvo.comps) Object.assign(cache.adm, { ferias: salvo.ferias || [], comps: salvo.comps });
  else {
    try {
      const [fp, fb, fe] = await Promise.all(['seed-freq-patio.json', 'seed-freq-bateria.json', 'seed-ferias.json'].map(seed_));
      const prep = prepararImportacao({ freq: { patio: fp, bateria: fb }, ferias: fe, colabs: cache.adm.colabs, rh: cache.adm.rh });
      for (const c of prep.comps) cache.adm.comps[c.conj + '|' + c.competencia] = c;
      // presença de quem está nas Atividades: só preenche os dias vazios da demonstração
      for (const k of SET_KEYS) for (const [key, cod] of Object.entries(prep.presenca[k])) { const m = key.split('|')[1].slice(0, 7); const o = (S[k].sitByMonth[m] ||= {}); if (!o[key]) o[key] = cod; }
      cache.adm.ferias = prep.ferias.map((f, i) => ({ id: 'fe' + i, ...f }));
    } catch (e) { admPronto = false; console.warn('Demonstração sem dados do Administrativo', e); } // tenta de novo na próxima entrada
  }
  cache.adm.loaded = cache.adm.fLoaded = true;
  cache.feriasAtivas = cache.adm.ferias.filter(f => f.inicio && f.termino).map(f => ({ mat: f.mat, nome: f.nome, inicio: f.inicio, termino: f.termino }));
}
export function admWatch(conj, comp) { const k = conj + '|' + comp; if (!(k in cache.adm.comps)) cache.adm.comps[k] = null; }
export async function admSetCodigo(conj, comp, p, data, cod) {
  if (p.ativ) { const m = data.slice(0, 7); const o = (S[conj].sitByMonth[m] ||= {}); const key = p.ativ + '|' + data; if (cod) o[key] = cod; else delete o[key]; return changed(); }
  const doc = cache.adm.comps[conj + '|' + comp]; const d = (doc.d[p.k] ||= {}); if (cod) d[data] = cod; else delete d[data]; admCh();
}
export async function admSalvarComp(conj, comp, dados) { cache.adm.comps[conj + '|' + comp] = { ...(cache.adm.comps[conj + '|' + comp] || {}), ...dados, conj, competencia: comp }; admCh(); }
export async function admSalvarGrupos(conj, comp, grupos) { cache.adm.comps[conj + '|' + comp].grupos = grupos; admCh(); }
export async function feriasSalvar(id, dados) { const nid = id || 'fe' + Date.now().toString(36); const i = cache.adm.ferias.findIndex(f => f.id === nid); if (i >= 0) cache.adm.ferias[i] = { ...cache.adm.ferias[i], ...dados }; else cache.adm.ferias.push({ id: nid, ...dados }); cache.adm.ferias = [...cache.adm.ferias]; admCh(); return nid; }
export function feriasExcluir(id) { cache.adm.ferias = cache.adm.ferias.filter(f => f.id !== id); admCh(); }
export async function admImportar({ comps, presenca, ferias, substituirFerias }) {
  for (const c of comps) cache.adm.comps[c.conj + '|' + c.competencia] = c;
  let n = 0;
  for (const k of Object.keys(presenca || {})) for (const [key, cod] of Object.entries(presenca[k])) { const m = key.split('|')[1].slice(0, 7); const o = (S[k].sitByMonth[m] ||= {}); if (!o[key]) { o[key] = cod; n++; } }
  if (ferias) cache.adm.ferias = [...(substituirFerias ? [] : cache.adm.ferias), ...ferias.map((f, i) => ({ id: 'fi' + Date.now().toString(36) + i, ...f }))];
  admCh(); return n;
}

// Equipe e frota (Operação) lê a mesma folha e a mesma presença do dia
Object.defineProperty(cache, 'eqFreq', { get: () => ({ comps: cache.adm.comps, sit: { patio: S.patio.sitByMonth, bateria: S.bateria.sitByMonth }, v: versao }), enumerable: false });
export function eqFreqWatch() { /* tudo já está em memória */ }
