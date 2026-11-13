// Modo demonstração (abra com ?demo): mesma interface do data.js, sem Firebase.
// Os dados ficam só neste navegador. Os apontamentos antes de hoje são exemplos.
import { SETS, SET_KEYS, setDaArea, MOTIVOS, ATIVOS, add, today, weekOf, monthOfWeek, addMonth, weeksOfMonth, novaSemana, seedParaBanco } from '../contas/cal.js';
import { legadoDoAcesso, marcasDe, ehAdminU, modsHistorico, MODS_HIST } from '../contas/acessos.js';
import { prepararImportacao } from '../contas/planilhas-adm.js';
import { veRegSeg, fotosDoReg } from '../contas/segcalc.js';
import { aplicarCampos } from '../contas/limpeza.js';
import { mapaFeriados, aplicarNaSemana } from '../contas/feriados.js';
import { incrementosFt, cfgFotos, exigeFoto, metaFoto, refCel } from '../contas/fotos.js';
import { shaDe } from '../ui/fotos.js';
import { QZ_EQUIP, QZ_LOCAIS, QZ_MOTIVOS, calcQZ } from '../contas/queda-zero.js';

export const isMock = true;
const novoSet = () => ({ config: null, configLoaded: false, plano: {}, colabs: {}, sitByMonth: {}, sitExtra: {}, semanas: {}, aprov: {}, acoes: {}, monthsLoaded: new Set() });
const S = { patio: novoSet(), bateria: novoSet() };
let cur = 'patio';
export const useSet = k => { if (S[k]) cur = k; };
export const setAtual = () => cur;
export const dados = k => S[k];
export const cache = { log: [], usuarios: [], g: { loaded: false, config: null, colabs: [], ocorr: [] }, gAssin: {}, gVersao: 0, e: { loaded: false, config: null, cad: { operadores: [], frota: [] }, lanc: [], par: [], insp: [], aval: {}, meses: new Set() }, eVersao: 0 };
for (const k of Object.keys(novoSet())) Object.defineProperty(cache, k, { get: () => S[cur][k], set: v => { S[cur][k] = v; }, enumerable: true });
export const temSet = (u, k) => marcasDe(u).includes(SETS[k].mod);
export const temEquip = u => marcasDe(u).includes('equipamentos');
export const temGestao = u => marcasDe(u).includes('gestao');
const LS = 'coqueria-demo-v2';
// Demonstração: dados de exemplo com nomes e matrículas fictícios (pasta demo/). Os dados reais não ficam no site.
const seed_ = async nome => { const r = await fetch('demo/' + nome.replace(/^seed/, 'exemplo')); if (!r.ok) throw new Error('Dados de exemplo não encontrados: ' + nome); return r.json(); };
export const seed = seed_;
let cb = {}, me = null;

let versao = 0;
// Gravar tudo no aparelho a cada toque deixava o toque lento: junta as gravações (e grava antes de fechar a página).
let persistT = 0;
const persistLogo = () => { clearTimeout(persistT); persistT = setTimeout(persist, 500); };
addEventListener('pagehide', () => { if (persistT) { clearTimeout(persistT); persist(); } });
const changed = () => { versao++; persistLogo(); cb.onData && cb.onData(); };
function persist() {
  const sets = Object.fromEntries(SET_KEYS.map(k => [k, { config: S[k].config, plano: S[k].plano, colabs: S[k].colabs, sitByMonth: S[k].sitByMonth, sitExtra: S[k].sitExtra, aprov: S[k].aprov, acoes: S[k].acoes, semanas: Object.fromEntries(Object.entries(S[k].semanas).map(([i, v]) => [i, { ...v, d: undefined, ev: undefined, ft: undefined, _dias: undefined }])) }]));
  try { localStorage.setItem(LS, JSON.stringify({ v: 2, sets, fotosCfg: cache.fotosCfg, log: cache.log.slice(0, 40), usuarios: cache.usuarios, me: me && me.uid, g: { config: cache.g.config, colabs: cache.g.colabs, ocorr: cache.g.ocorr }, gAssin: Object.fromEntries(Object.entries(cache.gAssin).filter(([, a]) => a.metodo !== 'papel')), e: { config: cache.e.config, cad: cache.e.cad, lanc: cache.e.lanc, par: cache.e.par, insp: cache.e.insp, aval: cache.e.aval } })); } catch (e) { /* sem armazenamento */ }
}
const toLocal = (id, x) => ({ ...x, id, m: x.m || {}, ev: x.ev || {}, ft: x.ft || {}, fp: x.fp || {}, d: x.ids.map(p => x.s[p] || '_______') });
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
  const fer = feriadosMock(); let exFer = false;
  for (const m of [addMonth(cur0, -1), cur0, addMonth(cur0, 1), addMonth(cur0, 2)]) {
    for (const ini of weeksOfMonth(m)) for (const a of SETS[k].areas) {
      const w = novaSemana(a, ini, x.plano[a]);
      // feriado sem operação: sai da programação antes dos apontamentos de exemplo (feriados.js)
      aplicarNaSemana(w, fer);
      // exemplo: a primeira atividade marcada num feriado da última semana foi feita mesmo assim (continua realizada)
      if (a === SETS[k].areas[0] && !exFer) for (const key of Object.keys(w.fe || {})) { const [pid, d] = key.split('|'); if (add(ini, +d) < hoje && add(ini, +d) >= add(hoje, -7)) { const arr = [...w.s[pid]]; arr[+d] = 'R'; w.s[pid] = arr.join(''); delete w.fe[key]; exFer = true; break; } }
      for (const pid of w.ids) {
        const arr = [...w.s[pid]];
        for (let d = 0; d < 7; d++) {
          if (add(ini, d) >= hoje) continue;
          const r = rnd(hash(a + ini + pid + d));
          if (arr[d] === 'P') { if (r < .86) arr[d] = 'R'; else if (r < .93) { arr[d] = 'N'; w.m[pid + '|' + d] = MOTIVOS[Math.floor(r * 1000) % 6]; } }
          else if (d < 5 && r < .012 && !(w.fe && w.fe[pid + '|' + d])) arr[d] = 'E';
        }
        w.s[pid] = arr.join('');
      }
      // demonstração: alguns lançamentos de queda zero nos dias que já passaram (para o painel dos Indicadores)
      for (let d = 0; d < 7; d++) {
        if (add(ini, d) >= hoje) continue;
        const r = rnd(hash('qz' + a + ini + d)); if (r > .3) continue;
        const pick = (l, x) => l[Math.floor(rnd(hash(x + a + ini + d)) * l.length) % l.length];
        const c = calcQZ([{ e: pick(QZ_EQUIP, 'e').id, p: r < .15 ? 'coque' : 'carvao', q: 1 + Math.floor(r * 20) }]);
        w.qz = w.qz || {}; w.qz[`Z|${d}|demo${d}`] = { i: c.itens, t: c.t, l: pick(QZ_LOCAIS.slice(0, 12), 'l'), m: pick(QZ_MOTIVOS.slice(0, 8), 'm') };
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
  // líder imediato de cada ficha: o da lista do RH de exemplo (como depois de Importar › Planilha EFETIVO)
  try { const ef = await seed_('seed-efetivo.json'); const lid = new Map(ef.linhas.filter(l => l[7]).map(l => [String(l[0]), String(l[7]).toUpperCase()])); cache.g.colabs = cache.g.colabs.map(c => (!c.lider && lid.has(String(c.mat)) ? { ...c, lider: lid.get(String(c.mat)) } : c)); } catch (e) { /* sem a lista de exemplo */ }
  cache.gAssin = {};
  await carregarE(null);
  const lideres = SET_KEYS.flatMap(k => Object.values(S[k].colabs).flat().filter(c => c.funcao === 'LÍDER' || c.funcao === 'SUPERVISOR').map(c => ({ ...c, set: k })));
  const slug = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').filter(Boolean);
  const usados = new Set();
  const loginDe = n => { const p = slug(n); let l = p[0] + '.' + p[p.length - 1], i = 2; while (usados.has(l)) l = p[0] + '.' + p[p.length - 1] + i++; usados.add(l); return l; };
  cache.usuarios = [{ uid: 'admin', nome: 'Administrador (demonstração)', login: 'admin', senha: '123456', papel: 'admin', area: null, modulos: ['operacao', 'bateria', 'equipamentos', 'gestao'], ...ac({ operacao: 'gestor', gestao: 'gestor', seguranca: 'gestor', rh: 'administrativo', administracao: 'admin' }, ['patio', 'bateria', 'equipamentos']) },
    { uid: 'eq', nome: 'Supervisor de Equipamentos', login: 'operacao', senha: '123456', papel: 'supervisor', area: null, modulos: ['equipamentos'], ...ac({ operacao: 'supervisor' }, ['equipamentos']) },
    { uid: 'rh', nome: 'Analista de Gestão', login: 'gestao', senha: '123456', papel: 'supervisor', area: null, modulos: ['gestao'], ...ac({ gestao: 'supervisor' }, []) },
    ...lideres.map(c => liderGestao({ uid: c.id, nome: c.nome, login: loginDe(c.nome), senha: '123456', papel: c.funcao === 'LÍDER' ? 'lider' : 'supervisor', area: c.area, modulos: c.funcao === 'SUPERVISOR' ? [SETS[c.set].mod, 'gestao'] : [SETS[c.set].mod] })),
    { uid: 'gest', nome: 'Gestor (demonstração)', login: 'gestor', senha: '123456', papel: 'gestor', area: null, modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'], ...ac({ operacao: 'gestor', gestao: 'gestor', rh: 'administrativo', administracao: 'modulo' }, ['patio', 'bateria', 'equipamentos']) },
    { uid: 'coord', nome: 'Coordenador (demonstração)', login: 'coordenador', senha: '123456', papel: 'coordenador', area: null, modulos: ['operacao', 'bateria'], ...ac({ operacao: 'coordenador', gestao: 'coordenador' }, ['patio', 'bateria']) },
    { uid: 'tec', nome: 'Técnico de Processo (demonstração)', login: 'tecnico', senha: '123456', papel: 'leitor', area: null, modulos: ['operacao', 'bateria'], ...ac({ operacao: 'tecnico', gestao: 'leitor' }, ['patio', 'bateria']) },
    { uid: 'sup2', nome: 'Supervisor de duas áreas', login: 'supervisor2', senha: '123456', papel: 'supervisor', area: 'RECEBIMENTO', area2: 'PREPARAÇÃO', modulos: ['operacao', 'bateria'], ...ac({ operacao: 'supervisor', gestao: 'supervisor' }, ['patio', 'bateria']) },
    { uid: 'leitor', nome: 'Visitante', login: 'visitante', senha: '123456', papel: 'leitor', area: null, modulos: ['operacao', 'frequencia'], ...ac({ operacao: 'leitor', gestao: 'leitor', rh: 'leitor' }, ['patio']) },
    { uid: 'adm1', nome: 'Analista de Frequência', login: 'frequencia', senha: '123456', papel: 'supervisor', area: null, modulos: ['frequencia'], ...ac({ rh: 'administrativo' }, []) },
    { uid: 'admv', nome: 'Assistente Administrativo', login: 'administrativo', senha: '123456', papel: 'administrativo', area: null, modulos: ['operacao', 'gestao', 'frequencia'], ...ac({ operacao: 'leitor', gestao: 'administrativo', rh: 'administrativo' }, ['patio']) },
    ...usuariosSeguranca(), ...usuariosMistos(),
    { uid: 'novo', nome: 'Novo usuário', login: 'novo', senha: '123456', papel: 'leitor', area: null, modulos: ['operacao'], trocarSenha: true, ...ac({ operacao: 'leitor', gestao: 'leitor' }, ['patio']) },
    { uid: 'bloq', nome: 'Usuário bloqueado', login: 'bloqueado', senha: '123456', papel: 'bloqueado', area: null, ...ac({}, []) }];
}
// Acesso por módulo de cada usuário de demonstração (campos acesso e escopos).
const ac = (acesso, escopos) => ({ acesso, escopos });
// Segurança: um técnico que registra, um supervisor de área que trata as anomalias e uma consulta (somente leitura).
// Os campos antigos (papel, modulos, área) saem do acesso, como a tela de usuários grava.
function usuariosSeguranca() {
  const reg = { acesso: { seguranca: 'registra' }, escopos: [] };
  const tra = { acesso: { operacao: 'supervisor', gestao: 'supervisor', seguranca: 'trata' }, escopos: ['patio'] };
  const lei = { acesso: { seguranca: 'leitor' }, escopos: [] };
  const leg = (x, extras) => { const v = legadoDoAcesso(x.acesso, x.escopos, extras); return { papel: v.papel, modulos: v.modulos, acessos: v.acessos, area: v.area, area2: v.area2 }; };
  return [{ uid: 'segr', nome: 'Técnico de Segurança', login: 'seguranca', senha: '123456', ...reg, ...leg(reg, {}) },
    { uid: 'segt', nome: 'Supervisor da Preparação (Segurança)', login: 'seguranca.trata', senha: '123456', ...tra, ...leg(tra, { fichas: true, area: 'PREPARAÇÃO' }) },
    { uid: 'segl', nome: 'Consulta da Segurança', login: 'seguranca.leitor', senha: '123456', ...lei, ...leg(lei, {}) }];
}

// Líderes: como os reais, Operação · Líder e Gestão · Líder (Programação, Folha do líder), sem as Fichas.
// Supervisores: Operação e Gestão · Supervisor, com as Fichas.
function liderGestao(u) {
  const k = setDaArea(u.area) || 'patio';
  const p = u.papel === 'lider' ? 'lider' : 'supervisor';
  return { ...u, acesso: { operacao: p, gestao: p }, escopos: [k] };
}
// Perfis diferentes por módulo: aponta na Operação como líder e só consulta a Gestão; e uma Administração
// "Dos módulos" de quem é Gestor só na Gestão do Pátio.
function usuariosMistos() {
  const leg = (x, extras) => { const v = legadoDoAcesso(x.acesso, x.escopos, extras); return { papel: v.papel, modulos: v.modulos, acessos: v.acessos, area: v.area, area2: v.area2 }; };
  const mis = { acesso: { operacao: 'lider', gestao: 'leitor' }, escopos: ['patio'] };
  const mod = { acesso: { gestao: 'gestor', rh: 'leitor', administracao: 'modulo' }, escopos: ['patio'] };
  return [{ uid: 'misto', nome: 'Líder (Gestão só leitura)', login: 'misto', senha: '123456', ...mis, ...leg(mis, { fichas: false, area: 'RECEBIMENTO' }) },
    { uid: 'gmod', nome: 'Gestor da Gestão do Pátio', login: 'gestor.patio', senha: '123456', ...mod, ...leg(mod, { fichas: true }) }];
}

export async function start(callbacks) {
  cb = callbacks;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { /* ignora */ }
  if (saved && saved.v === 2 && saved.sets) {
    for (const k of SET_KEYS) { const x = saved.sets[k]; const st = S[k] = novoSet(); if (!x || !x.config) { await freshSet(k); continue; } Object.assign(st, { config: x.config, configLoaded: true, plano: x.plano, colabs: x.colabs, sitByMonth: x.sitByMonth, sitExtra: x.sitExtra || {}, aprov: x.aprov || {}, acoes: x.acoes || {}, semanas: Object.fromEntries(Object.entries(x.semanas).map(([i, v]) => [i, toLocal(i, v)])) }); }
    Object.assign(cache, { log: (saved.log || []).map(l => ({ ...l, at: new Date(l.at) })), usuarios: saved.usuarios });
    await carregarE(saved.e);
    if (saved.g && saved.g.config) { cache.g = { loaded: true, ...saved.g }; cache.gAssin = saved.gAssin || {}; } else { const sg = await seed_('seed-gestao.json'); cache.g = { loaded: true, config: { codigo: sg.codigo, revisao: sg.revisao, declaracao: sg.declaracao, tipos: sg.tipos }, colabs: sg.colabs, ocorr: sg.ocorrencias.map((o, i) => ({ id: 'oc' + i, ...o })) }; }
  } else { saved = null; await fresh(); }
  for (const k of SET_KEYS) S[k].config.meses.forEach(m => S[k].monthsLoaded.add(m));
  aplicarFeriadosMock();
  cache.fotosCfg = (saved && saved.fotosCfg) || cfgFotosDemo(); cache.fotosCfgLoaded = true;
  fotosDemo();
  await seniorExemplo();
  me = saved && 'me' in saved ? (cache.usuarios.find(u => u.uid === saved.me) || null) : cache.usuarios[0];
  if (me && !cache.usuarios.some(u => u.uid === 'admv')) cache.usuarios.push({ uid: 'admv', nome: 'Assistente Administrativo', login: 'administrativo', senha: '123456', papel: 'administrativo', area: null, modulos: ['operacao', 'gestao', 'frequencia'] });
  if (me && !cache.usuarios.some(u => u.uid === 'adm1')) cache.usuarios.push({ uid: 'adm1', nome: 'Analista de Frequência', login: 'frequencia', senha: '123456', papel: 'supervisor', area: null, modulos: ['frequencia'] });
  if (me) for (const u of [...usuariosSeguranca(), ...usuariosMistos()]) if (!cache.usuarios.some(x => x.uid === u.uid || x.login === u.login)) cache.usuarios.push(u);
  if (me) cache.usuarios = cache.usuarios.map(u => (u.papel === 'lider' && u.acesso && !u.acesso.gestao && !u.acesso.seguranca && u.uid !== 'misto' ? liderGestao(u) : u));
  if (me) me = cache.usuarios.find(u => u.uid === me.uid) || me;
  await iniciarAdm();
  iniciarSeg();
  emitAuth(); changed();
}
// Módulo Administração: na demonstração tudo já está em memória.
export function iniciarAdministracao() { /* nada a carregar */ }
// Erros nos aparelhos: na demonstração ficam só na memória (um de exemplo para ver a tela).
cache.erros = [{ id: 'ex1', quando: new Date(Date.now() - 36e5), uid: 'gest', msg: 'TypeError: Cannot read properties of undefined (exemplo da demonstração)', onde: 'telas/apontar.js:120', tela: 'apontar', versao: 'demonstração', aparelho: 'Android 14 · Chrome/130 · 390x844', vezes: 2 }];
export function registrarErro(e) { if (!me) return false; cache.erros.unshift({ id: 'e' + Date.now(), quando: new Date(), uid: me.uid, ...e }); changed(); return true; }
export async function apagarErros(ids) { const t = new Set(ids); cache.erros = cache.erros.filter(e => !t.has(e.id)); changed(); }
function emitAuth() {
  if (!me) return cb.onAuth({ status: 'signedOut' });
  if (!ATIVOS.has(me.papel)) return cb.onAuth({ status: 'blocked', user: me });
  if (!(ehAdminU(me) || marcasDe(me).length || (me.acesso && (me.acesso.seguranca || me.acesso.administracao)))) return cb.onAuth({ status: 'semAcesso', user: me });
  if (me.trocarSenha) return cb.onAuth({ status: 'mustChange', user: me });
  cb.onAuth({ status: 'ready', user: me });
}
export async function mockSwitch(uid) { me = cache.usuarios.find(u => u.uid === uid) || me; persist(); await iniciarAdm(); emitAuth(); changed(); }
export async function mockReset() { try { localStorage.removeItem(LS); localStorage.removeItem(LSA); localStorage.removeItem(LSS); } catch (e) { /* ignora */ } admPronto = false; EV.length = 0; SEG = null; iniciarSeg(); await fresh(); for (const k of SET_KEYS) S[k].config.meses.forEach(m => S[k].monthsLoaded.add(m)); cache.fotosCfg = cfgFotosDemo(); fotosDemo(); me = cache.usuarios[0]; await iniciarAdm(); emitAuth(); changed(); }
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
export async function criarUsuario({ nome, login, senha, papel, area, area2, modulos, acessos, acesso, escopos }) {
  login = normLogin(login);
  if (!loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  if (cache.usuarios.some(u => u.login === login)) throw new Error(`O usuário "${login}" já existe.`);
  if (String(senha).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  cache.usuarios.push({ uid: 'u' + Date.now().toString(36), nome, login, senha, papel, area: area || null, area2: area2 || null, modulos: modulos || ['operacao'], acessos: acessos || ['operacao'], ...(acesso ? { acesso, escopos: escopos || [] } : {}), trocarSenha: true }); changed();
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
export async function setForaProg(docId, pid, k, str, info) {
  const w = cache.semanas[docId]; w.s[pid] = str; w.fp = w.fp || {}; const key = pid + '|' + k; if (info) w.fp[key] = info; else delete w.fp[key];
  Object.assign(w, toLocal(docId, w)); changed();
}
export const sitInfo = (key, k = cur) => { const m = key.split('|')[1].slice(0, 7); const x = ((S[k] || S[cur]).sitExtra || {})[m] || {}; return { cob: (x.cob || {})[key] || '', he: (x.he || {})[key] || '', hed: (x.hed || {})[key] || null, jus: (x.jus || {})[key] || null }; };
export const sitExtraMes = m => (S[cur].sitExtra || {})[m] || { cob: {}, he: {}, hed: {}, jus: {} };
export async function setSitExtra(campo, key, val, k = cur) { const m = key.split('|')[1].slice(0, 7); const x = (S[k].sitExtra[m] ||= { cob: {}, he: {} }); const o = (x[campo] ||= {}); if (val) o[key] = val; else delete o[key]; changed(); }
export async function salvarAcao(id, dados) {
  const i = id || 'ac' + Date.now().toString(36); const x = id ? { ...dados, atualizadoEm: new Date().toISOString() } : { ...dados, em: new Date().toISOString(), por: me.uid, porNome: me.nome };
  S[cur].acoes[i] = { ...(S[cur].acoes[i] || {}), id: i, ...x }; changed();
}
export async function setAprov(docId, area, mes, itens) {
  const em = new Date().toISOString(); const a = (S[cur].aprov[docId] ||= {});
  for (const [k, x] of Object.entries(itens)) a[k] = { ...x, por: me.uid, nome: me.nome, em };
  changed();
}
export async function setSit(key, code, k = cur) { const m = key.split('|')[1].slice(0, 7); const o = (S[k].sitByMonth[m] ||= {}); if (code) o[key] = code; else delete o[key]; changed(); }
export async function semanasDaArea(area, k = cur) { return Object.values(S[k].semanas).filter(w => w.area === area).map(w => ({ ...w, s: { ...w.s }, ids: [...w.ids] })); }
export async function gravarPlanoNasSemanas(muda, k = cur) {
  for (const x of muda) { const w = S[k].semanas[x.id]; if (!w) continue; w.s[x.pid] = x.linha; if (x.novo && !w.ids.includes(x.pid)) w.ids.push(x.pid); Object.assign(w, toLocal(x.id, w)); }
  changed();
}
export async function savePlano(area, itens) { cache.plano[area] = itens; changed(); }
// Número do colaborador: o maior já usado só cresce (o mesmo de data.js)
const numId = id => parseInt(String(id || '').replace(/\D/g, ''), 10) || 0;
export function maiorIdUsado(k) { const st = S[k]; let m = st.maiorId || 0; for (const l of Object.values(st.colabs || {})) for (const x of l) m = Math.max(m, numId(x.id)); return m; }
export async function salvarColabsArea(area, itens, k = setDaArea(area) || cur) { S[k].maiorId = Math.max(maiorIdUsado(k), ...itens.map(x => numId(x.id))); S[k].colabs[area] = itens; changed(); }
export async function saveRotas(rotas) { cache.config.rotas = rotas; changed(); }
// Avisos na demonstração: não há servidor de mensagens; mostra um aviso local para testar.
cache.avisosCfg = { vapid: 'demonstracao' }; cache.meusAvisos = null; cache.permissoes = {};
export async function salvarPermissoes(abas) { cache.permissoes = abas; changed(); }
// Escala na demonstração: 3x3 com datas de exemplo (o 4x4 vem das turmas da Operação).
// Feriados de exemplo (sem operação): as atividades programadas nesses dias ficam fora da conta (feriados.js).
cache.escalas = { regimes: { '3x3': { turmas: { I: '2026-10-01', J: '2026-10-04' } } }, feriados: [
  { data: '2026-10-12', desc: 'Nossa Senhora Aparecida' }, { data: '2026-11-02', desc: 'Finados' }, { data: '2026-11-15', desc: 'Proclamação da República' },
  { data: '2026-11-20', desc: 'Dia da Consciência Negra' }, { data: '2026-12-25', desc: 'Natal' }, { data: '2027-01-01', desc: 'Confraternização Universal' }] };
cache.escalasLoaded = true;
function feriadosMock() { return mapaFeriados(cache.escalas, cache.e && cache.e.config); }
export async function feriadosAtuais() { return { fer: feriadosMock(), completo: true }; }
// A demonstração aplica a regra ao abrir (vale também para dados já guardados neste navegador).
function aplicarFeriadosMock() { const fer = feriadosMock(); for (const k of SET_KEYS) for (const w of Object.values(S[k].semanas)) aplicarNaSemana(w, fer); }
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
// O mesmo filtro das regras: o administrador vê tudo; o gestor, só os registros dos módulos dele.
export async function historicoLer(n = 500) { const ms = modsHistorico(me); return cache.log.filter(x => ehAdminU(me) || ms.includes(x.mod)).slice(0, n).map(x => ({ ...x, at: x.at instanceof Date ? x.at : new Date(x.at) })); }
export function log(t, mod) { cache.log.unshift({ id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date(), uid: me.uid, nome: me.nome, t, mod: MODS_HIST.includes(mod) ? mod : 'administracao' }); cache.log = cache.log.slice(0, 40); changed(); }
export async function gerarMes(ym, planoPorArea, aPartirDe) {
  let n = 0;
  for (const ini of weeksOfMonth(ym)) { if (aPartirDe && ini < aPartirDe) continue; for (const a of SETS[cur].areas) { const id = a + '|' + ini; if (cache.semanas[id]) continue; const w = novaSemana(a, ini, planoPorArea[a]); aplicarNaSemana(w, feriadosMock()); cache.semanas[id] = toLocal(id, w); n += w.ids.length; } }
  if (!cache.config.meses.includes(ym)) { cache.config.meses.push(ym); cache.config.meses.sort(); }
  cache.monthsLoaded.add(ym); changed(); return n;
}
export async function importar() { /* a demonstração já começa com os dados da planilha */ }

// Fotos das atividades na demonstração: ficam só na memória desta aba (as de exemplo são refeitas ao abrir).
// A configuração padrão já vem ligada (foto obrigatória em Realizada e Extra, 1 a 3 fotos), valendo de 5 dias atrás.
const EV = [];
export async function saveConfig(patch) { Object.assign(cache.config, patch); changed(); }
const cfgFotosDemo = () => ({ ...cfgFotos(null), desde: add(today(), -5) });
export async function salvarCfgFotos(c) { cache.fotosCfg = { obrig: c.obrig, min: c.min, max: c.max, situacoes: [...c.situacoes], desde: c.desde, atualizadoEm: new Date().toISOString(), por: me.nome }; changed(); }
// Fotos de exemplo: parte das realizadas dos últimos 5 dias. Numa parte das rotas uma foto vale para a rota toda
// (como o "Marcar restantes"); noutra, cada atividade tem a própria; o resto fica sem foto (aparece no indicador).
// Só os dados leves são criados aqui; a imagem é desenhada (canvas) quando alguém abre.
function fotosDemo() {
  for (let i = EV.length - 1; i >= 0; i--) if (EV[i].demo) EV.splice(i, 1);
  const hoje = today(); const ini = add(hoje, -5);
  for (const k of SET_KEYS) {
    const plano = new Map(Object.values(S[k].plano || {}).flat().map(p => [p.id, p]));
    for (const w of Object.values(S[k].semanas)) {
      w.ft = {}; const d = w.d || w.ids.map(p => w.s[p] || '_______');
      if (add(w.ini, 6) < ini || w.ini >= hoje) continue;
      for (let dk = 0; dk < 7; dk++) {
        const dia = add(w.ini, dk); if (dia < ini || dia >= hoje) continue;
        const porRota = new Map();
        w.ids.forEach((pid, i) => { const c = d[i][dk]; const p = plano.get(pid); if (!p || !(c === 'R' || c === 'E')) return; if (!porRota.has(p.rota)) porRota.set(p.rota, []); porRota.get(p.rota).push({ pid, ativ: p.ativ, local: p.local, c }); });
        for (const [rota, itens] of porRota) {
          const r = rnd(hash(w.id + rota + dk + 'foto'));
          const base = { semana: w.id, area: w.area, conj: k, rota, dia, k: dk };
          const nova = (its, n) => { const m = metaFoto({ ...base, sit: its[0].c, itens: its, img: { bytes: 118000 + Math.round(rnd(hash(its[0].pid + dia + n)) * 40000), w: 1280, h: 960, sha: '', nome: `foto-${n + 1}.jpg`, thumb: '' }, por: 'demo', porNome: `Líder ${w.area.toLowerCase().replace(/(^|\s)(\S)/g, (x, a, b) => a + b.toUpperCase())} (exemplo)` }); EV.push({ ...m, id: 'evd' + EV.length.toString(36), demo: true, at: new Date(dia + 'T' + String(8 + (EV.length % 9)).padStart(2, '0') + ':' + String(EV.length % 60).padStart(2, '0') + ':00') }); for (const [key, v] of Object.entries(incrementosFt(m.refs, 1))) w.ft[key] = (w.ft[key] || 0) + v; };
          if (r < 0.4) nova(itens, 0);
          else if (r < 0.8) itens.forEach((it, j) => { if (rnd(hash(it.pid + dia)) < 0.8) { nova([it], 0); if (j % 5 === 0) nova([it], 1); } });
        }
      }
    }
  }
  // Relatórios e arquivo de fotos (Parte 2): para a demonstração mostrar todas as situações, as fotos do dia mais
  // antigo com foto já foram exportadas (lote de exemplo); de cada conjunto, 2 estão na lixeira e 1 foi arquivada fora do banco.
  // Uma foto de ontem tem o SHA-256 "errado" de propósito, para mostrar o aviso de foto divergente na exportação.
  const agora = Date.now(); const D = 864e5;
  for (const k of SET_KEYS) {
    const doConj = EV.filter(e => e.demo && e.conj === k);
    const dia0 = doConj.reduce((m, e) => (e.dia < m ? e.dia : m), hoje); const antigas = doConj.filter(e => e.dia === dia0);
    antigas.forEach((e, j) => {
      Object.assign(e, { exportadoEm: new Date(agora - 4 * D), exportLote: 'EXP-DEMO-1', exportConf: 'ok' });
      if (j < 2) e.lixeiraEm = new Date(agora - (j ? 2 : 1) * D);
      else if (j === 2) Object.assign(e, { lixeiraEm: new Date(agora - 3 * D), removidaEm: new Date(agora - D) });
    });
    const ontem = doConj.find(e => e.dia === add(hoje, -1)); if (ontem) ontem.sha = 'f'.repeat(64);
  }
}
// Imagem da foto de exemplo: um quadro colorido com a atividade, a rota e o dia.
const corDemo = s => `hsl(${hash(s) % 360} 45% 42%)`;
function desenharDemo(e, lado) {
  const cv = document.createElement('canvas'); cv.width = lado; cv.height = Math.round(lado * 0.75);
  const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, cv.width, cv.height);
  gr.addColorStop(0, corDemo(e.rota + e.dia)); gr.addColorStop(1, corDemo(e.ativ)); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(255,255,255,.9)'; const f = Math.round(lado / 18); g.font = `700 ${f}px system-ui,sans-serif`; g.textBaseline = 'top';
  const linhas = ['FOTO DE EXEMPLO', e.rota, e.dia.split('-').reverse().join('/'), String(e.ativ).slice(0, 48)];
  linhas.forEach((t, i) => { g.font = `${i ? 500 : 700} ${i ? Math.round(f * 0.7) : f}px system-ui,sans-serif`; g.fillText(t, f * 0.6, f * 0.6 + i * f * 1.2); });
  return cv.toDataURL('image/jpeg', lado > 400 ? 0.7 : 0.6);
}
const semDados = ({ dados, demo, ...m }) => m;
// A cópia leve lê o sha da foto de exemplo na hora (ele é calculado quando a foto é desenhada pela primeira vez, como
// se o celular tivesse calculado ao tirar a foto): assim a exportação confere o SHA-256 também na demonstração.
const leve = e => { if (!e.thumb) e.thumb = desenharDemo(e, 240); const c = semDados(e); if (e.demo) Object.defineProperty(c, 'sha', { get: () => e.sha, enumerable: true }); return c; };
export async function listarFotosCel(semana, pid, k) {
  const ref = refCel(semana, pid, k);
  return EV.filter(e => (e.refs || []).includes(ref) && (!e.lixeiraEm || e.removidaEm)).map(leve).sort((a, b) => a.at - b.at);
}
export async function listarEvidenciasSemanas(ids) { return EV.filter(e => ids.includes(e.semana)).map(leve); }
// Foto completa: desenhada na primeira vez (a de exemplo ganha o SHA-256 como se o aparelho tivesse calculado).
export async function abrirEvidencia(id) {
  const e = EV.find(x => x.id === id); if (!e || e.removidaEm) return null;
  if (!e.dados) e.dados = desenharDemo(e, 1280);
  if (!e.sha) e.sha = await shaDe(e.dados);
  return e.dados;
}
// Relatórios e arquivo de fotos (Parte 2), como no data.js.
const conjDe = e => e.conj || setDaArea(e.area) || 'patio';
export async function listarEvidenciasPeriodo(conj, de, ate) { return EV.filter(e => conjDe(e) === conj && e.dia >= de && e.dia <= ate).map(leve); }
export async function listarEvidenciasLixeira(conj) { return EV.filter(e => conjDe(e) === conj && e.lixeiraEm && !e.removidaEm).map(leve); }
export async function semanasPeriodo(conj, meses) { return Object.fromEntries(Object.entries(S[conj].semanas).filter(([, w]) => meses.includes(w.mes))); }
const pausa = () => new Promise(r => setTimeout(r, 30));
const acharEv = id => { const e = EV.find(x => x.id === id); if (!e) throw new Error('Foto não encontrada: ' + id); return e; };
export async function marcarExportadas(conj, itens, lote) { await pausa(); for (const x of itens) Object.assign(acharEv(x.id), { exportadoEm: new Date(), exportLote: lote, exportConf: x.conf }); changed(); }
export async function moverLixeira(conj, ids) { await pausa(); for (const id of ids) { const e = acharEv(id); if (!e.exportadoEm) throw new Error('Só foto exportada vai para a lixeira'); e.lixeiraEm = new Date(); } changed(); }
export async function restaurarLixeira(conj, ids) { await pausa(); for (const id of ids) { const e = acharEv(id); if (e.removidaEm) throw new Error('Foto já apagada'); e.lixeiraEm = null; } changed(); }
export async function apagarDefinitivo(conj, ids) { await pausa(); for (const id of ids) { const e = acharEv(id); if (!e.lixeiraEm) throw new Error('Só foto da lixeira é apagada'); delete e.dados; e.removidaEm = new Date(); } changed(); }
export function apontarComFotos(docId, changes, fotos) {
  const k = setDaArea((fotos[0] && fotos[0].meta.area) || '') || cur; const w = S[k].semanas[docId];
  for (const c of changes) { w.s[c.pid] = c.str; const mk = c.pid + '|' + c.k; if (c.motivo) w.m[mk] = c.motivo; else delete w.m[mk]; }
  w.ft = w.ft || {}; const ids = [];
  for (const f of fotos) {
    const id = 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    EV.push({ ...f.meta, id, por: me.uid, porNome: me.nome, at: new Date(), dados: f.dados }); ids.push(id);
    for (const [key, n] of Object.entries(incrementosFt(f.meta.refs, 1))) w.ft[key] = (w.ft[key] || 0) + n;
  }
  Object.assign(w, toLocal(docId, w)); changed();
  return ids;
}
export async function salvarItemQZ(tipo, nome) { cache.qzListas = cache.qzListas || {}; const l = cache.qzListas[tipo] = cache.qzListas[tipo] || []; if (!l.includes(nome)) l.push(nome); changed(); }
export function salvarQuedaZero(docId, area, key, v, fotos = []) {
  const w = S[setDaArea(area || '') || cur].semanas[docId]; if (!w) return;
  w.qz = w.qz || {}; if (v) w.qz[key] = v; else delete w.qz[key];
  for (const f of fotos) EV.push({ ...f.meta, id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), por: me.uid, porNome: me.nome, at: new Date(), dados: f.dados });
  Object.assign(w, toLocal(docId, w)); changed();
}
export async function apagarFotosQZ(docId, area, key, fotos, apagarLanc = false) {
  await pausa(); const w = S[setDaArea(area || '') || cur].semanas[docId];
  for (const f of fotos) { const i = EV.findIndex(x => x.id === f.id); if (i >= 0) EV.splice(i, 1); }
  if (w && w.qz && w.qz[key]) { if (apagarLanc) delete w.qz[key]; else w.qz[key].f = Math.max(0, (w.qz[key].f || 0) - fotos.length); Object.assign(w, toLocal(docId, w)); }
  changed();
}
export async function apagarFotoAtividade(f) {
  await pausa(); const i = EV.findIndex(x => x.id === f.id); if (i < 0) throw new Error('Foto não encontrada');
  const e = EV[i]; EV.splice(i, 1);
  const k = conjDe(e); const w = S[k] && S[k].semanas[e.semana];
  if (w && w.ft) { for (const [key, n] of Object.entries(incrementosFt(e.refs || [], 1))) w.ft[key] = Math.max(0, (w.ft[key] || 0) - n); Object.assign(w, toLocal(e.semana, w)); }
  changed();
}
// Para os testes da tela (Playwright) conferirem o que foi gravado: tamanhos da foto e da miniatura.
export const _fotosGravadas = () => EV.filter(e => !e.demo).map(e => ({ id: e.id, refs: e.refs, bytes: e.bytes, w: e.w, h: e.h, sha: e.sha, thumbCar: (e.thumb || '').length, dadosCar: (e.dados || '').length, dia: e.dia, rota: e.rota, sit: e.sit }));
export async function ajustarRefsFoto(id, refs) { const e = EV.find(x => x.id === id); if (e) { e.refs = [...refs]; changed(); } }

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
  // Demonstração: cada equipamento trabalha sempre no mesmo local (área das Atividades), para a frota por área ter o que mostrar.
  { const h = t => [...t].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7); for (const l of e.lanc) if (!l.setor) { const as = SETS[/BATERIA/i.test(l.area || '') ? 'bateria' : 'patio'].areas; l.setor = as[h(l.eq) % as.length]; } }
  cache.e = { loaded: true, ...e, meses: new Set([...e.lanc.map(x => x.mes), new Date().toISOString().slice(0, 7)]) };
}
const ech = () => { cache.eVersao++; changed(); };
const ECOL = { lanc: 'lanc', par: 'par', insp: 'insp' };
export function eWatch(ms) { ms.forEach(m => m && cache.e.meses.add(m)); }
export function eAdd(t, o) { const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); cache.e[ECOL[t]] = [...cache.e[ECOL[t]], { id, ...o, mes: o.data.slice(0, 7), por: me && me.uid }]; ech(); return id; }
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
cache.feriasAtivas = []; cache.desligados = []; cache.uso = null;
let admPronto = false;
const sitProxy = k => new Proxy({}, { get: (_, m) => S[k].sitByMonth[m] || {} });
const jusProxy = k => new Proxy({}, { get: (_, m) => ((S[k].sitExtra || {})[m] || {}).jus || {} });
function admPersist() { try { localStorage.setItem(LSA, JSON.stringify({ ferias: cache.adm.ferias, comps: cache.adm.comps })); } catch (e) { /* sem espaço */ } }
const admCh = () => { cache.feriasAtivas = cache.adm.ferias.filter(f => f.inicio && f.termino).map(f => ({ mat: f.mat, nome: f.nome, inicio: f.inicio, termino: f.termino })); admPersist(); changed(); };
async function iniciarAdm() {
  for (const k of SET_KEYS) cache.adm.colabs[k] = Object.values(S[k].colabs).flat();
  cache.adm.sit = { patio: sitProxy('patio'), bateria: sitProxy('bateria') };
  cache.adm.jus = { patio: jusProxy('patio'), bateria: jusProxy('bateria') };
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
export async function admSetJus(conj, comp, p, data, val) {
  if (p.ativ) { const m = data.slice(0, 7); const x = (S[conj].sitExtra[m] ||= { cob: {}, he: {} }); const o = (x.jus ||= {}); const key = p.ativ + '|' + data; if (val) o[key] = val; else delete o[key]; return changed(); }
  const doc = cache.adm.comps[conj + '|' + comp]; const j = ((doc.jus ||= {})[p.k] ||= {}); if (val) j[data] = val; else delete j[data]; admCh();
}
export async function admSalvarComp(conj, comp, dados) { cache.adm.comps[conj + '|' + comp] = { ...(cache.adm.comps[conj + '|' + comp] || {}), ...dados, conj, competencia: comp }; admCh(); }
export async function admSalvarGrupos(conj, comp, grupos) { cache.adm.comps[conj + '|' + comp].grupos = grupos; admCh(); }
export async function feriasSalvar(id, dados) { const nid = id || 'fe' + Date.now().toString(36); const i = cache.adm.ferias.findIndex(f => f.id === nid); if (i >= 0) cache.adm.ferias[i] = { ...cache.adm.ferias[i], ...dados }; else cache.adm.ferias.push({ id: nid, ...dados }); cache.adm.ferias = [...cache.adm.ferias]; admCh(); return nid; }
// Treinamentos de exemplo (Segurança): pessoas fictícias, com validades espalhadas em volta de hoje.
cache.treinos = []; cache.tLoaded = false;
function treinosExemplo() {
  if (cache.tLoaded) return; const hoje = today();
  let ps = ((cache.g && cache.g.colabs) || []).filter(c => c.nome).slice(0, 14);
  if (!ps.length) ps = ['ANA SOUZA', 'BRUNO LIMA', 'CARLA DIAS', 'DIEGO REIS', 'EDSON ROCHA', 'FABIO NUNES', 'GABRIEL MOTA', 'HELENA CRUZ', 'IGOR PAIVA', 'JULIA PRADO', 'KAIO MELO', 'LUCAS VAZ', 'MARCOS LIMA', 'NINA ROCHA'].map((nome, i) => ({ nome, mat: String(5000 + i), area: i % 2 ? 'BATERIA' : 'PÁTIO' }));
  const desl = [-40, -5, 6, 18, 25, 60, 120, 200, 300, 15, -12, 90, 400, 33];
  // Os treinamentos da planilha de controle da empresa: alguns feitos, alguns 'não se aplica', um pendente.
  const tipos = ['NR 35 TRABALHO EM ALTURA', 'NR 33 ESPAÇO CONFINADO', 'BENZENO (PPEOB)', 'PINE', 'GASES SIDERÚRGICOS', 'ASO'], meses = [24, 12, 24, 24, 36, 12];
  cache.treinos = ps.flatMap((c, i) => {
    const conj = i % 2 ? 'bateria' : 'patio', ars = conj === 'bateria' ? ['BATERIA 1', 'BATERIA 2', 'TRILHO', 'CDQ'] : ['RECEBIMENTO', 'FINAL DO PÁTIO', 'PREPARAÇÃO', 'TRATAMENTO DE COQUE'];
    const p = { mat: c.mat || '', nome: c.nome, conj, area: ars[(i >> 1) % 4], turno: i % 3 ? 'Adm' : 'Turno', funcao: i % 4 ? 'AJUDANTE' : 'OPERADOR DE PROCESSOS', admissao: add(hoje, -400 - i * 90) };
    const naTipos = tipos.filter((_, j) => (i + j) % 7 === 5);
    return (naTipos.length ? [{ id: 'trna' + i, ...p, tipo: 'NÃO SE APLICA', naTipos, realizado: null, validade: null, obs: '' }] : []).concat(tipos.flatMap((tipo, j) => {
      const id = 'tr' + i + '_' + j, k = (i + j) % 7;
      if (k === 6 || k === 5) return [];
      if (i === 3 && j === 2) return [{ id, ...p, tipo, realizado: null, validade: null, obs: 'INAPTO' }];
      const venc = add(hoje, desl[(i + j) % 14]);
      return [{ id, ...p, tipo, realizado: add(venc, -meses[j] * 30), validade: venc, obs: '' }];
    }));
  });
  cache.tLoaded = true;
}
export async function treinoSalvar(id, dados) { treinosExemplo(); const nid = id || 'tr' + Date.now().toString(36); const i = cache.treinos.findIndex(t => t.id === nid); if (i >= 0) cache.treinos[i] = { ...cache.treinos[i], ...dados }; else cache.treinos.push({ id: nid, ...dados }); changed(); return nid; }
export function treinoExcluir(id) { cache.treinos = cache.treinos.filter(t => t.id !== id); changed(); }
export async function treinosImportar(itens) {
  treinosExemplo();
  itens.forEach((t, i) => { const { id, ...d } = t; const j = id ? cache.treinos.findIndex(x => x.id === id) : -1; if (j >= 0) cache.treinos[j] = { ...cache.treinos[j], ...d }; else cache.treinos.push({ id: 'ti' + Date.now().toString(36) + i, ...d }); });
  changed();
}
export function treinosCarregar() { treinosExemplo(); }
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
// Hora extra lançada na Operação: na demonstração vem dos lançamentos que já estão em memória.
export function heOpWatch(ym) {
  cache.heOp = cache.heOp || {};
  const l = (cache.e.lanc || []).filter(x => x.data && x.data.slice(0, 7) === ym && ['HORA EXTRA', 'HE NOTURNA'].includes(x.status) && x.op)
    .map(x => ({ data: x.data, op: x.op, eq: x.eq || '', status: x.status, he: +x.he || 0, ini: x.ini || '', fim: x.fim || '' }));
  const sig = l.length + '|' + l.map(x => x.data + x.op).join(); if (cache.heOp[ym] && cache.heOp[ym]._sig === sig) return;
  l._sig = sig; cache.heOp[ym] = l; cache.heOpV = (cache.heOpV || 0) + 1;
}

// ---------- Segurança (demonstração) ----------
// Registros de exemplo com os nomes fictícios da demonstração e fotos desenhadas na hora (cor lisa com texto).
// Cada pessoa vê só o que as regras deixariam ver (veRegSeg), como no banco de verdade.
const LSS = 'coqueria-demo-seg-v1';
let SEG = null, segVer = 0, segMemo = { k: '', v: null };
function segPersist() {
  try { localStorage.setItem(LSS, JSON.stringify(SEG)); }
  catch (e) { try { localStorage.setItem(LSS, JSON.stringify({ ...SEG, fotos: Object.fromEntries(Object.entries(SEG.fotos).map(([k, f]) => [k, { ...f, dados: f.mini }])) })); } catch (e2) { /* sem espaço: fica só nesta aba */ } }
}
const segCh = () => { segVer++; segPersist(); changed(); };
function fotoExemplo(txt, cor, w, h, q) {
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    g.fillStyle = cor; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `700 ${Math.round(h / 9)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FOTO DE EXEMPLO', w / 2, h / 2 - h / 12); g.font = `600 ${Math.round(h / 13)}px system-ui,sans-serif`; g.fillText(txt, w / 2, h / 2 + h / 10);
    return cv.toDataURL('image/jpeg', q);
  } catch (e) { return ''; }
}
function segExemplo() {
  const hoje = today();
  const dia = n => add(hoje, -n); const ms = (d, h = 9) => new Date(`${d}T${String(h).padStart(2, '0')}:20:00`).getTime();
  const fotos = {}; let nf = 0;
  const CORES = ['#5b6b7a', '#7a5b3a', '#3a6b5b', '#6b3a5b', '#4a4a8a'];
  const nova = (reg, col, autor, area, conj, m, txt, tipo = 'antes') => { const id = 'sf' + (nf++); const cor = CORES[nf % CORES.length]; fotos[id] = { reg, col, tipo, mini: fotoExemplo(txt, cor, 160, 120, 0.6), dados: fotoExemplo(txt, cor, 640, 480, 0.7), ordem: 0, autor, por: autor, conj, area, mes: m }; return id; };
  const TEC = { por: 'segr', porNome: 'Técnico de Segurança', resp: 'TÉCNICO DE SEGURANÇA', mat: '90001' };
  const SUP = { por: 'segt', porNome: 'Supervisor da Preparação (Segurança)', resp: 'SUPERVISOR DA PREPARAÇÃO', mat: '90002' };
  const PAT = { area: 'PÁTIO DE CARVÃO', conj: 'patio' }, BAT = { area: 'BATERIA', conj: 'bateria' };
  const inter = [
    [1, PAT, TEC, 'CORREIA C5613A', 'ROTINA', '', ['EPI'], 'Colaborador sem protetor auricular perto da correia.', 'Orientado e protetor entregue na hora.'],
    [2, BAT, TEC, 'TOPO DA BATERIA 1', 'ROTINA', 'Queda de mesmo nível', ['ARRUMAÇÃO E LIMPEZA', 'ISOLAMENTO DE ÁREA'], 'Mangueira solta no caminho e área sem isolamento.', 'Mangueira recolhida e área isolada com fita.'],
    [3, PAT, SUP, 'PREPARAÇÃO - PENEIRAS', 'PARADA', 'Prensamento de mãos', ['FERRAMENTAS MANUAIS'], 'Ferramenta improvisada para destravar a peneira.', 'Troca pela ferramenta certa.'],
    [5, PAT, TEC, 'RECEBIMENTO - MOEGA', 'ROTINA', '', [], 'Interação sobre uso correto do cinto na escada.', ''],
    [6, BAT, SUP, 'CDQ', 'PARADA', 'Gás', ['GÁS', 'ESPAÇO CONFINADO'], 'Entrada sem medição de gás registrada.', 'Atividade parada até a medição.'],
    [9, BAT, TEC, 'TRILHO', 'ROTINA', 'Atropelamento', ['SEGURANÇA EM TRILHOS', 'CELULAR'], 'Pedestre usando celular ao cruzar o trilho.', 'Conversa sobre a regra de ouro.'],
    [33, PAT, TEC, 'FINAL DO PÁTIO', 'ROTINA', '', ['EPI', 'OUTROS'], 'Óculos riscado em uso.', 'Óculos trocado.', 'ÓCULOS DANIFICADO'],
    [40, BAT, SUP, 'BATERIA 2', 'ROTINA', '', ['ADORNOS'], 'Colaborador com anel na área de máquinas.', 'Anel retirado.']
  ].map(([n, A, P, local, tipoAtiv, risco, desvios, desc, acao, outro], i) => { const id = 'si' + i; const data = dia(n); return { id, data, mes: data.slice(0, 7), ...A, local, tipoAtiv, risco, desvios, desvioOutro: outro || '', desc, acao, resp: P.resp, mat: P.mat, fotos: [nova(id, 'seginter', P.por, A.area, A.conj, data.slice(0, 7), 'Interação ' + (i + 1))], minis: [], por: P.por, porNome: P.porNome, em: ms(data, 8 + i % 6) }; });
  const h = (d, n, t) => ({ em: new Date(ms(d, 10 + n)).toISOString(), por: 'segt', nome: 'Supervisor da Preparação (Segurança)', t });
  const anom = [
    [1, PAT, TEC, 'aberta', null, 'CORREIA C5613A', 'Proteção da polia de retorno solta.', 'Prensamento de membros.', 'Área isolada.', 'Fixação vibrou com o uso.', 'Incluir a proteção na inspeção semanal.'],
    [5, PAT, TEC, 'tratamento', { resp: 'Supervisor da Preparação (Segurança)', respUid: 'segt', prazo: dia(1), coment: 'Pedido de compra do guarda-corpo aberto.' }, 'PREPARAÇÃO - PASSARELA', 'Guarda-corpo da passarela com corrosão.', 'Queda de altura.', 'Passarela interditada.', 'Corrosão por umidade.', 'Trocar o trecho e pintar.'],
    [3, BAT, SUP, 'tratamento', { resp: 'Técnico de Segurança', respUid: 'segr', prazo: add(hoje, 1), coment: 'Manutenção programada.' }, 'BATERIA 1 - PORTA 12', 'Vazamento de gás pela porta do forno.', 'Intoxicação.', 'Área sinalizada.', 'Vedação gasta.', 'Trocar a vedação na próxima parada.'],
    [20, PAT, TEC, 'concluida', { resp: 'Supervisor da Preparação (Segurança)', respUid: 'segt', prazo: dia(15), coment: 'Extintor recarregado e lacrado.' }, 'RECEBIMENTO', 'Extintor vencido no posto.', 'Sem combate a princípio de incêndio.', 'Extintor reserva colocado.', 'Falta de controle de validade.', 'Controle mensal dos extintores.', 18],
    [4, BAT, SUP, 'concluida', { resp: 'Técnico de Segurança', respUid: 'segr', prazo: dia(1), coment: 'Sinalização refeita.' }, 'TRILHO', 'Sinalização do cruzamento apagada.', 'Atropelamento.', 'Cones colocados.', 'Desgaste da pintura.', 'Repintar a cada 6 meses.', 2],
    [0, BAT, SUP, 'aberta', null, 'CDQ', 'Detector de gás sem bateria.', 'Exposição a gás sem alarme.', 'Detector reserva entregue.', 'Sem rotina de troca.', 'Checklist de pré-uso do detector.']
  ].map(([n, A, P, status, trat, local, desc, conseq, acao, causas, sugest, concl], i) => {
    const id = 'sa' + i; const data = dia(n); const m = data.slice(0, 7);
    const a = { id, data, hora: `${String(7 + i).padStart(2, '0')}:30`, mes: m, ...A, local, regime: i % 2 ? 'TURNO' : 'ADM', desc, conseq, acao, causas, sugest, comunic: P.resp, mat: P.mat, fotos: [nova(id, 'seganom', P.por, A.area, A.conj, m, 'Anomalia ' + (i + 1))], minis: [], por: P.por, porNome: P.porNome, em: ms(data, 7 + i), status };
    if (trat) { a.trat = { ...trat, hist: [h(data, 1, 'Responsável: ' + trat.resp), h(data, 2, 'Situação: Aberta → Em tratamento')] }; }
    if (status === 'concluida') { const fd = nova(id, 'seganom', P.por, A.area, A.conj, m, 'Depois ' + (i + 1), 'depois'); const cd = dia(concl); a.trat.fotoDepois = fd; a.trat.miniDepois = fotos[fd].mini; a.conclEm = new Date(ms(cd, 15)).toISOString(); a.trat.hist.push({ ...h(cd, 5, 'Situação: Em tratamento → Concluída') }); }
    return a;
  });
  for (const r of [...inter, ...anom]) r.minis = r.fotos.map(f => fotos[f].mini);
  return { cfg: null, inter, anom, fotos };
}
function iniciarSeg() {
  if (SEG) return;
  try { SEG = JSON.parse(localStorage.getItem(LSS) || 'null'); } catch (e) { SEG = null; }
  if (!SEG || !Array.isArray(SEG.inter)) { SEG = segExemplo(); segPersist(); }
  segVer++;
}
Object.defineProperty(cache, 'seg', {
  get: () => {
    if (!SEG) return { on: false, loaded: false, cfg: null, cfgLoaded: false, inter: [], anom: [], meses: new Set(), v: 0 };
    const k = segVer + '|' + (me ? me.uid : '');
    if (segMemo.k !== k) segMemo = { k, v: { on: true, loaded: true, cfg: SEG.cfg, cfgLoaded: true, inter: SEG.inter.filter(r => veRegSeg(me, r)), anom: SEG.anom.filter(r => veRegSeg(me, r)), meses: new Set(), v: segVer } };
    return segMemo.v;
  },
  enumerable: false
});
const segId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function segWatch() { /* tudo já está em memória */ }
export function segNovo(col, dados, fotos) {
  const id = segId(col === 'seginter' ? 'si' : 'sa'); const ids = fotos.map(() => segId('sf'));
  fotos.forEach((f, i) => { SEG.fotos[ids[i]] = { reg: id, col, tipo: 'antes', mini: f.mini, dados: f.dados, ordem: i, autor: me.uid, por: me.uid, conj: dados.conj || '', area: dados.area, mes: dados.mes }; });
  SEG[col === 'seginter' ? 'inter' : 'anom'].push({ ...dados, id, fotos: ids, minis: fotos.map(f => f.mini), por: me.uid, porNome: me.nome || me.login || '', em: Date.now() });
  segCh(); return id;
}
export async function segEditar(col, id, patch) { const l = SEG[col === 'seginter' ? 'inter' : 'anom']; const i = l.findIndex(x => x.id === id); if (i >= 0) l[i] = { ...l[i], ...patch }; segCh(); }
export function segTratar(a, patch, foto) {
  const p = { ...patch };
  if (foto) { const fid = segId('sf'); SEG.fotos[fid] = { reg: a.id, col: 'seganom', tipo: 'depois', mini: foto.mini, dados: foto.dados, ordem: 0, autor: a.por, por: me.uid, conj: a.conj || '', area: a.area, mes: a.mes }; p.trat = { ...p.trat, fotoDepois: fid, miniDepois: foto.mini }; }
  const i = SEG.anom.findIndex(x => x.id === a.id); if (i >= 0) SEG.anom[i] = { ...SEG.anom[i], ...p, atualizadoPor: me.uid };
  segCh();
}
export async function segFoto(id) { const f = SEG && SEG.fotos[id]; return f ? f.dados : null; }
export async function segSalvarCfg(cfg) { SEG.cfg = { ...cfg }; segCh(); }
// Apagar um registro e as fotos dele (a tela só oferece ao administrador).
export async function segExcluir(col, r) {
  const k = col === 'seginter' ? 'inter' : 'anom'; SEG[k] = SEG[k].filter(x => x.id !== r.id);
  for (const f of fotosDoReg(r)) delete SEG.fotos[f];
  segCh();
}

// ---------- Limpeza de dados (demonstração): as mesmas consultas e gravações de data.js, sobre o que está em memória ----------
const setDaCol = col => (col.startsWith('b_') ? 'bateria' : 'patio');
const semPre = col => col.replace(/^b_/, '');
const copia = x => JSON.parse(JSON.stringify(x));
// Documentos da coleção no formato do banco, com o id.
function docsMock(col) {
  const k = setDaCol(col), c = semPre(col);
  if (c === 'semanas') return Object.values(S[k].semanas).map(({ d, _dias, ...x }) => ({ ...x, id: x.id }));
  if (c === 'aprov') return Object.entries(S[k].aprov).map(([id, v]) => ({ id, area: id.split('|')[0], mes: monthOfWeek(id.split('|')[1]), v }));
  if (c === 'config') return S[k].config ? [{ id: 'sistema', ...S[k].config }] : [];
  if (col === 'eqlanc') return cache.e.lanc; if (col === 'eqpar') return cache.e.par; if (col === 'eqinsp') return cache.e.insp;
  if (col === 'seginter') return SEG.inter; if (col === 'seganom') return SEG.anom;
  if (col === 'segfotos') return Object.entries(SEG.fotos).map(([id, f]) => ({ id, ...f }));
  if (col === 'historico') { cache.log.forEach((l, i) => { if (!l.id) l.id = 'h' + i + Date.now().toString(36); }); return cache.log; }
  return [];
}
const valorCmp = v => (v instanceof Date ? v.getTime() : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : v);
const OPS = { '==': (a, b) => a === b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
export async function limpezaLer(col, conds = []) {
  return copia(docsMock(col).filter(x => conds.every(([c, o, v]) => x[c] != null && OPS[o](valorCmp(x[c]), valorCmp(v)))));
}
export async function limpezaLerIds(col, ids) { const s = new Set(ids); return copia(docsMock(col).filter(x => s.has(x.id))); }
export async function limpezaGravar(ops) {
  let seg = false, eq = false;
  for (const o of ops) {
    const k = setDaCol(o.col), c = semPre(o.col);
    if (c === 'semanas') { if (o.tipo === 'apagar') delete S[k].semanas[o.id]; else { const w = S[k].semanas[o.id]; if (w) Object.assign(w, toLocal(o.id, aplicarCampos(w, o.campos))); } }
    else if (c === 'aprov') delete S[k].aprov[o.id];
    else if (c === 'config') { if (o.tipo === 'alterar') aplicarCampos(S[k].config, o.campos); }
    else if (['eqlanc', 'eqpar', 'eqinsp'].includes(o.col)) { const f = { eqlanc: 'lanc', eqpar: 'par', eqinsp: 'insp' }[o.col]; cache.e[f] = cache.e[f].filter(x => x.id !== o.id); eq = true; }
    else if (o.col === 'seginter' || o.col === 'seganom') { const f = o.col === 'seginter' ? 'inter' : 'anom'; SEG[f] = SEG[f].filter(x => x.id !== o.id); seg = true; }
    else if (o.col === 'segfotos') { delete SEG.fotos[o.id]; seg = true; }
    else if (o.col === 'historico') cache.log = cache.log.filter(x => x.id !== o.id);
  }
  if (eq) cache.eVersao++;
  if (seg) segCh(); else changed();
}
