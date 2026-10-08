// Dikma Operação — interface (módulo Programação do Pátio de Carvão).
// Os dados vêm de data.js (Firebase) ou data-mock.js (abrir com ?demo).
import { AREAS, AREA_S, DAYS, DL, MOTIVOS, SITS, AUSENTE, PAPEIS, pad, pd, add, ddmm, today, weeksOfMonth, weekOf, monthOfWeek, weekLabel, monthLabel, addMonth } from './cal.js';

const DEMO = new URLSearchParams(location.search).has('demo');
const DB = await import(DEMO ? './data-mock.js' : './data.js');

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
const UI = { view: 'painel', mes: null, ini: null, area: 'TODAS', rota: 'TODAS', tipo: 'TODOS', q: '', soPend: false, escopo: 'semana', dia: null, aRota: null, eRota: null, pArea: 'RECEBIMENTO', confirm: null, iRota: 'TODAS', lider: '', more: 0, gMes: null, impIni: CUR_WEEK, busy: false };
try { const v = JSON.parse(localStorage.getItem('coqueria-ui') || '{}'); if (v.view) UI.view = v.view; } catch (e) { /* ignora */ }

const rotas = () => (DB.cache.config && DB.cache.config.rotas) || [];
const tipos = () => (DB.cache.config && DB.cache.config.tipos) || [];
const meses = () => ((DB.cache.config && DB.cache.config.meses) || []).slice().sort();
const isAdmin = () => ME && ME.papel === 'admin';
const myArea = () => (ME && (ME.papel === 'lider' || ME.papel === 'supervisor') ? ME.area : null);
const areaScope = () => myArea() || UI.area;
const canEdit = area => isAdmin() || (!!myArea() && myArea() === area);
const canEditSit = area => isAdmin() || (!!myArea() && myArea() === area);
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
function st(doc, i, k) { const c = doc.d[i][k]; if (c === 'P' && add(doc.ini, k) < TODAY) return 'A'; return c === '_' ? 'X' : c; }
function stats(docs, { rota = 'TODAS', tipo = 'TODOS' } = {}) {
  const s = { prog: 0, R: 0, N: 0, P: 0, A: 0, E: 0, progHoje: 0, Rhoje: 0, day: Array.from({ length: 7 }, () => ({ R: 0, N: 0, P: 0, A: 0, E: 0 })) };
  for (const doc of docs) for (let i = 0; i < doc.ids.length; i++) {
    const p = PL.get(doc.ids[i]); if (!p) continue;
    if (rota !== 'TODAS' && p.rota !== rota) continue; if (tipo !== 'TODOS' && p.tipo !== tipo) continue;
    const str = doc.d[i];
    for (let k = 0; k < 7; k++) {
      const c = str[k]; if (c === '_') continue;
      const dt = add(doc.ini, k);
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
function atrasadasAll(area) {
  const out = [];
  for (const doc of docsFor({ area })) for (let i = 0; i < doc.ids.length; i++) for (let k = 0; k < 7; k++)
    if (doc.d[i][k] === 'P' && add(doc.ini, k) < TODAY) out.push({ doc, i, k, dt: add(doc.ini, k) });
  return out.sort((a, b) => (a.dt < b.dt ? -1 : 1));
}

/* ---------------- gravações ---------------- */
function localChange(doc, i, k, c, motivo) {
  const a = [...doc.d[i]]; a[k] = c; const str = a.join('');
  const pid = doc.ids[i];
  doc.d[i] = str; if (doc.s) doc.s[pid] = str;
  const mk = pid + '|' + k; if (c === 'N' && motivo) doc.m[mk] = motivo; else delete doc.m[mk];
  return { pid, str, k, motivo: c === 'N' ? motivo : null };
}
function setSt(doc, i, k, c, motivo) {
  if (!canEdit(doc.area)) { toast('Seu perfil não pode apontar nesta área'); return; }
  const ch = localChange(doc, i, k, c, motivo);
  DB.setStatusMany(doc.id, [ch]);
  const p = PL.get(doc.ids[i]); const nm = { R: 'realizada', N: 'não realizada', P: 'voltou para programada', E: 'extra', _: 'extra removida' }[c];
  DB.log(`${p ? p.ativ : doc.ids[i]} · ${p ? p.rota : ''} · ${DAYS[k]} ${ddmm(add(doc.ini, k))} → ${nm}${c === 'N' && motivo ? ' (' + motivo + ')' : ''}`);
}

/* ---------------- ícones ---------------- */
const I = {
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
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  google: '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};
const VIEWS = [
  { id: 'painel', nome: 'Painel', ic: 'painel', grp: 'Acompanhar' },
  { id: 'prog', nome: 'Programação', ic: 'prog', grp: 'Acompanhar' },
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Acompanhar' },
  { id: 'escala', nome: 'Escala e efetivo', ic: 'escala', grp: 'Acompanhar' },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Acompanhar' },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Acompanhar' },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Administração', admin: true },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Administração', admin: true },
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Administração', admin: true },
  { id: 'config', nome: 'Rotas e configurações', ic: 'config', grp: 'Administração', admin: true }
];
const CHIP = { P: '', R: '✓', N: '✕', E: '+', A: '!', X: '·' };
const ST_NOME = { P: 'Programado', R: 'Realizado', N: 'Não realizado', E: 'Extra', A: 'Atrasado', X: 'Não programada' };

/* ---------------- telas de acesso ---------------- */
const $ = id => document.getElementById(id);
function gate(html) { $('shell').hidden = true; $('gate').hidden = false; $('gate').innerHTML = `<div class="gatecard"><div class="brand big"><img class="logo on-light" src="img/dikma-logo.png" alt="Dikma"><img class="logo on-dark" src="img/dikma-logo-branco.png" alt="Dikma"><div class="prod"><b>OPERAÇÃO</b></div></div>${html}</div>`; }
const GOOGLE = new URLSearchParams(location.search).has('google');
const senhaField = (id, label, ac) => `<label class="sel"><span>${label}</span><div class="pwd"><input class="in" id="${id}" type="password" autocomplete="${ac}" required minlength="6"><button type="button" class="btn ghost eye" data-eye="${id}" aria-label="Mostrar senha">${I.eye}</button></div></label>`;
function renderGate() {
  const s = AUTH.status;
  const sair = `<button class="btn" data-act="logout">${I.out} Sair</button>`;
  if (s === 'loading') return gate('<p class="muted">Carregando…</p>');
  if (s === 'noConfig') return gate(`<h2>Sistema ainda não conectado</h2><p>Este endereço não encontrou a configuração do Firebase. Publique pelo Firebase Hosting (veja o README do projeto).</p><a class="btn" href="?demo">Abrir a demonstração</a>`);
  if (s === 'signedOut') return gate(`<h2>Entrar</h2><form id="fLogin" class="stackform" novalidate>
    <label class="sel"><span>Usuário</span><input class="in" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    ${senhaField('lgPass', 'Senha', 'current-password')}
    <p class="err" id="lgErr" role="alert" hidden></p>
    <button class="btn pri big" type="submit" ${UI.busy ? 'disabled' : ''}>${UI.busy ? 'Entrando…' : 'Entrar'}</button></form>
    <p class="muted small m0">Não tem acesso ou esqueceu a senha? Fale com o administrador do sistema.</p>
    ${GOOGLE ? `<button class="btn gbtn" data-act="loginGoogle">${I.google} Entrar com Google (administrador)</button>` : ''}
    ${DEMO ? '<p class="muted small m0">Demonstração: usuário <b>admin</b>, senha <b>123456</b>.</p>' : ''}`);
  if (s === 'firstAdmin') return gate(`<h2>Primeiro acesso</h2><p class="muted">Ainda não existe nenhum administrador. Crie o seu acesso.</p><form id="fFirst" class="stackform" novalidate>
    <label class="sel"><span>Seu nome</span><input class="in" id="faNome" required></label>
    <label class="sel"><span>Usuário</span><input class="in" id="faUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ex.: luiz.eduardo" required></label>
    ${senhaField('faPass', 'Senha (mínimo 6 caracteres)', 'new-password')}
    <p class="err" id="faErr" role="alert" hidden></p>
    <button class="btn pri big" type="submit">Criar administrador</button></form>`);
  if (s === 'mustChange') return gate(`<h2>Crie sua senha</h2><p>Olá, <b>${esc(title(AUTH.user.nome))}</b>. No primeiro acesso, troque a senha provisória por uma só sua.</p><form id="fMust" class="stackform" novalidate>
    ${senhaField('mcPass', 'Nova senha (mínimo 6 caracteres)', 'new-password')}
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
function render() {
  if (AUTH.status !== 'ready') return renderGate();
  $('gate').hidden = true; $('shell').hidden = false;
  rebuild();
  if (!DB.cache.configLoaded) { $('top').innerHTML = '<h1>Carregando…</h1>'; $('view').innerHTML = ''; renderNav(); return; }
  if (!DB.cache.config) { renderNav(); $('top').innerHTML = `<h1>Primeiro acesso<small>Importar os dados da planilha</small></h1>`; $('view').innerHTML = vImportar(); return; }
  ensurePeriod();
  const v = VIEWS.find(x => x.id === UI.view) || VIEWS[0];
  if (v.admin && !isAdmin()) UI.view = 'painel';
  renderNav(); renderTop();
  const needWeeks = ['painel', 'prog', 'apontar', 'escala', 'imprimir'].includes(UI.view);
  if (needWeeks && !DB.cache.monthsLoaded.has(UI.mes)) { $('view').innerHTML = '<div class="card"><div class="empty">Carregando a programação…</div></div>'; return; }
  const fn = { painel: vPainel, prog: vProg, apontar: vApontar, escala: vEscala, pend: vPend, imprimir: vImprimir, plano: vPlano, gerador: vGerador, usuarios: vUsuarios, config: vConfig }[UI.view];
  $('view').innerHTML = fn();
  afterRender();
}
let raf = 0;
const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const a = document.activeElement; const keep = a && a.id === 'fQ' ? [a.selectionStart] : null; render(); if (keep) { const n = $('fQ'); if (n) { n.focus(); n.setSelectionRange(keep[0], keep[0]); } } }); };

function renderNav() {
  const atr = DB.cache.config ? atrasadasAll(myArea() || 'TODAS').length : 0;
  const pendUsers = 0;
  let h = '', g = '';
  for (const v of VIEWS) {
    if (v.admin && !isAdmin()) continue;
    if (v.grp !== g) { g = v.grp; h += `<div class="grp">${g}</div>`; }
    const badge = v.id === 'pend' && atr ? atr : v.id === 'usuarios' && pendUsers ? pendUsers : 0;
    h += `<button data-go="${v.id}" ${UI.view === v.id ? 'aria-current="page"' : ''}>${I[v.ic]}<span>${v.nome}</span>${badge ? `<span class="badge num">${badge > 999 ? '999+' : badge}</span>` : ''}</button>`;
  }
  $('nav').innerHTML = h;
  $('who').innerHTML = DEMO
    ? `${mockSwitcher()}<div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div><button class="btn rail-btn" data-act="mockReset">Restaurar demonstração</button>`
    : `<div class="me"><span class="av">${esc((ME.nome || '?')[0].toUpperCase())}</span><div><b>${esc(title(ME.nome || ME.login || ''))}</b><small>${ME.login ? esc(ME.login) + ' · ' : ''}${papelNome(ME.papel)}${ME.area ? ' · ' + AREA_S[ME.area] : ''}</small></div></div><div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Alterar senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div>`;
  const tb = [['painel', 'Painel', 'painel'], ['prog', 'Programação', 'prog'], ['apontar', 'Apontar', 'apontar'], ['escala', 'Escala', 'escala'], ['__more', 'Mais', 'more']];
  const inMore = !['painel', 'prog', 'apontar', 'escala'].includes(UI.view);
  const moreBadge = atr + pendUsers;
  $('tabbar').innerHTML = tb.map(([id, n, ic]) => `<button data-go="${id}" class="${id === 'apontar' ? 'big' : ''}" ${(UI.view === id || (id === '__more' && inMore)) ? 'aria-current="page"' : ''}><span class="ic">${I[ic]}</span>${n}${id === '__more' && moreBadge ? `<span class="badge">${moreBadge > 99 ? '99+' : moreBadge}</span>` : ''}</button>`).join('');
}
function syncPill() {
  const n = DB.pendingWrites(); const off = !navigator.onLine;
  if (DEMO) return '<span class="pill neu" title="Os dados ficam só neste navegador">Demonstração</span>';
  if (off) return `<span class="pill warn" role="status">Sem sinal${n ? ` · ${n} aguardando envio` : ''}</span>`;
  if (n) return `<span class="pill neu" role="status">Sincronizando ${n}…</span>`;
  return '<span class="pill ok" title="Tudo salvo no servidor">Sincronizado</span>';
}
function periodControls({ semana = true, area = true, mes = true } = {}) {
  let h = '<div class="filters">';
  if (mes) h += `<label class="sel"><span>Mês</span><select class="in" id="fMes">${meses().map(m => `<option value="${m}" ${m === UI.mes ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>`;
  if (semana) h += `<label class="sel"><span>Semana</span><select class="in" id="fSem">${weeksOfMonth(UI.mes).map(w => `<option value="${w}" ${w === UI.ini ? 'selected' : ''}>${weekLabel(w)}${w === CUR_WEEK ? ' · atual' : ''}</option>`).join('')}</select></label>`;
  if (area) {
    if (myArea()) h += `<label class="sel"><span>Área</span><select class="in" disabled><option>${AREA_S[myArea()]}</option></select></label>`;
    else h += `<label class="sel"><span>Área</span><select class="in" id="fArea"><option value="TODAS">Todas as áreas</option>${AREAS.map(a => `<option value="${a}" ${a === UI.area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>`;
  }
  if (semana && UI.ini !== CUR_WEEK && meses().includes(CUR_MONTH)) h += `<button class="btn" data-act="hoje" style="align-self:flex-end">Semana atual</button>`;
  return h + '</div>';
}
function renderTop() {
  const v = VIEWS.find(x => x.id === UI.view);
  const sub = { painel: 'Produtividade do período', prog: 'Programado × realizado por atividade', apontar: 'Marque o que foi feito no dia', escala: 'Disponíveis × necessários por rota', pend: 'Atividades sem apontamento em dias que já passaram', imprimir: 'Folha semanal para marcação em campo', plano: 'Modelo semanal usado pelo gerador', gerador: 'Cria as semanas do mês a partir do plano padrão', usuarios: 'Quem acessa o sistema e o que pode fazer', config: 'Efetivo padrão, carga e listas' }[UI.view];
  let ctr = '';
  if (['painel', 'prog', 'escala', 'imprimir', 'apontar'].includes(UI.view)) ctr = periodControls();
  $('top').innerHTML = `<h1>${v.nome}<small>${sub}</small></h1>${ctr}<div class="syncwrap" id="sync">${syncPill()}</div>`;
}

/* ---------------- PAINEL ---------------- */
function vPainel() {
  const area = areaScope();
  const scope = UI.escopo === 'semana' ? { ini: UI.ini, area } : { mes: UI.mes, area };
  const docs = docsFor(scope); const s = stats(docs);
  const ef = pct(s.Rhoje, s.progHoje), ap = pct(s.R + s.N, s.progHoje);
  const seg = `<div class="filters" role="group" aria-label="Período"><button class="btn ${UI.escopo === 'semana' ? 'dark' : ''}" data-esc="semana">Semana</button><button class="btn ${UI.escopo === 'mes' ? 'dark' : ''}" data-esc="mes">Mês inteiro</button></div>`;
  let h = `<div class="row-between">${seg}<span class="muted">${UI.escopo === 'semana' ? weekLabel(UI.ini) : monthLabel(UI.mes)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span></div>`;
  if (!docs.length) return h + '<div class="card"><div class="empty">Nenhuma programação gerada para este período.</div></div>';
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
  const rs = rotasDa(area).filter(r => r.carga > 0).map(r => ({ r, x: stats(docsFor({ ...scope, area: r.area }), { rota: r.rota }) })).sort((a, b) => b.x.A - a.x.A || pct(a.x.Rhoje, a.x.progHoje) - pct(b.x.Rhoje, b.x.progHoje));
  h += `<div class="card"><header><h2>Rotas que pedem atenção</h2><p>Ordenadas por atrasadas</p></header><div class="tw"><table><thead><tr><th>Rota</th><th>Área</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realiz.</th><th class="r">Atrasadas</th><th>Eficiência até hoje</th></tr></thead><tbody>
  ${rs.map(({ r, x }) => { const e = pct(x.Rhoje, x.progHoje); return `<tr><td><b>${esc(r.rota)}</b></td><td class="muted">${AREA_S[r.area]}</td><td class="r num">${x.prog}</td><td class="r num">${x.R}</td><td class="r num">${x.N}</td><td class="r num">${x.A ? `<span class="pill warn">${x.A}</span>` : '0'}</td><td><span class="ef"><i style="width:${e}%"></i></span><span class="num">${e}%</span></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
  h += `<div class="card"><header><h2>Últimos registros</h2><p>Quem apontou o quê, em tempo real</p></header><div class="body">${logHtml(8)}</div></div>`;
  return h;
}
function logHtml(n) {
  const L = DB.cache.log;
  if (!L.length) return '<div class="empty">Nenhum registro ainda. Os apontamentos feitos em Programação ou Apontar aparecem aqui.</div>';
  return `<div class="log">${L.slice(0, n).map(l => `<div><time>${fmtAt(l.at)}</time><span><b>${esc(title(l.nome))}</b> · ${esc(l.t)}</span></div>`).join('')}</div>`;
}

/* ---------------- PROGRAMAÇÃO ---------------- */
const isMobile = () => matchMedia('(max-width:860px)').matches;
function vProg() {
  const area = areaScope();
  const docs = docsFor({ ini: UI.ini, area }).sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
  const rts = [...new Set(docs.flatMap(d => d.ids.map(id => PL.get(id) && PL.get(id).rota)))].filter(Boolean);
  if (UI.rota !== 'TODAS' && !rts.includes(UI.rota)) UI.rota = 'TODAS';
  const s = stats(docs, { rota: UI.rota, tipo: UI.tipo });
  let h = `<div class="filters">
   <label class="sel"><span>Rota</span><select class="in" id="fRota"><option value="TODAS">Todas as rotas</option>${rts.map(r => `<option ${r === UI.rota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Tipo</span><select class="in" id="fTipo"><option value="TODOS">Todos</option>${tipos().map(t => `<option ${t === UI.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
   <label class="sel grow"><span>Buscar</span><input class="in" id="fQ" type="search" placeholder="Local, atividade ou ID" value="${esc(UI.q)}"></label>
   <label class="btn" style="align-self:flex-end"><input type="checkbox" id="fPend" ${UI.soPend ? 'checked' : ''}> Só com pendência</label>
   ${!framed ? `<button class="btn" data-act="csv" style="align-self:flex-end">${I.dl} Exportar Excel</button>` : ''}
  </div>
  <div class="mini"><div><b class="num">${s.prog}</b><span>Programadas</span></div><div><b class="num" style="color:var(--st-real)">${s.R}</b><span>Realizadas</span></div><div><b class="num" style="color:var(--st-nreal)">${s.N}</b><span>Não realizadas</span></div><div><b class="num" style="color:var(--st-atr)">${s.A}</b><span>Atrasadas</span></div><div><b class="num">${s.P - s.A}</b><span>A fazer</span></div><div><b class="num" style="color:var(--st-extra)">${s.E}</b><span>Extras</span></div></div>
  <div class="legend">${['P', 'R', 'N', 'A', 'E'].map(c => `<span><span class="chip sm ${c}">${CHIP[c]}</span>${ST_NOME[c]}</span>`).join('')}<span class="muted">${canEdit(area === 'TODAS' ? null : area) || isAdmin() ? 'Clique em um dia para apontar' : 'Somente leitura'}</span></div>`;
  const q = UI.q.trim().toLowerCase();
  const rows = [];
  for (const doc of docs) doc.ids.forEach((id, i) => {
    const p = PL.get(id); if (!p) return;
    if (UI.rota !== 'TODAS' && p.rota !== UI.rota) return; if (UI.tipo !== 'TODOS' && p.tipo !== UI.tipo) return;
    if (q && !(p.id + ' ' + p.local + ' ' + p.ativ).toLowerCase().includes(q)) return;
    if (UI.soPend && ![...doc.d[i]].some((c, k) => c === 'P' && add(doc.ini, k) <= TODAY)) return;
    rows.push({ doc, i, p });
  });
  if (!rows.length) return h + '<div class="card"><div class="empty">Nenhuma atividade com esses filtros nesta semana.</div></div>';
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  const chip = (doc, i, k) => { const c = st(doc, i, k); const m = doc.m[doc.ids[i] + '|' + k]; return `<button class="chip ${c}" data-cell="${esc(doc.id)}|${i}|${k}" aria-label="${DAYS[k]}: ${ST_NOME[c]}" title="${DAYS[k]} ${ddmm(add(doc.ini, k))} · ${ST_NOME[c]}${m ? ' · ' + esc(m) : ''}">${CHIP[c]}</button>`; };
  const LIM = UI.more || (isMobile() ? 120 : 600);
  const shown = rows.slice(0, LIM);
  let g = '';
  if (isMobile()) {
    h += '<div class="mlist">';
    for (const { doc, i, p } of shown) {
      const key = doc.area + p.rota;
      if (key !== g) { g = key; h += `<div class="mgrp">${esc(p.rota)}${area === 'TODAS' ? ` <small>${AREA_S[doc.area]}</small>` : ''}</div>`; }
      h += `<div class="mcard"><div><div class="t">${esc(p.ativ)}</div><div class="loc wrapit">${esc(p.local)}</div></div><div class="row-gap"><span class="tag">${esc(p.tipo)}</span><span class="mono muted">${p.id}</span></div><div class="days">${DAYS.map((d, k) => `<div>${DL[k]}${chip(doc, i, k)}</div>`).join('')}</div></div>`;
    }
    h += '</div>';
  } else {
    h += `<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${d}<br><span class="thd">${ddmm(add(UI.ini, k))}</span></th>`).join('')}</tr></thead><tbody>`;
    for (const { doc, i, p } of shown) {
      const key = doc.area + p.rota;
      if (key !== g) { g = key; const n = rows.filter(r => r.doc.area === doc.area && r.p.rota === p.rota).length; h += `<tr class="grp"><td colspan="11">${esc(p.rota)}<small>${area === 'TODAS' ? AREA_S[doc.area] + ' · ' : ''}${n} atividades</small></td></tr>`; }
      h += `<tr><td class="mono muted">${p.id}</td><td><div class="loc" title="${esc(p.local)}">${esc(p.local)}</div></td><td>${esc(p.ativ)}</td><td><span class="tag">${esc(p.tipo)}</span></td>${DAYS.map((_, k) => `<td class="c ${tk[k] ? 'today' : ''}">${chip(doc, i, k)}</td>`).join('')}</tr>`;
    }
    h += '</tbody></table></div></div>';
  }
  if (rows.length > shown.length) h += `<button class="btn center" data-act="more" data-n="${LIM + 400}">Mostrar mais ${Math.min(400, rows.length - shown.length)} de ${rows.length - shown.length}</button>`;
  return h;
}

/* ---------------- APONTAR ---------------- */
function vApontar() {
  const area = areaScope();
  if (area === 'TODAS') return `<div class="card"><div class="body"><p class="m0 mb">Escolha a área para apontar:</p><div class="rchips">${AREAS.map(a => `<button class="rchip" data-area="${a}">${AREA_S[a]}</button>`).join('')}</div></div></div>`;
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  if (!doc) return '<div class="card"><div class="empty">Esta semana ainda não foi gerada. O administrador gera os meses em Gerador de meses.</div></div>';
  if (UI.dia == null || UI.dia < 0 || UI.dia > 6) { const t = Math.round((pd(TODAY) - pd(UI.ini)) / 864e5); UI.dia = t >= 0 && t < 7 ? t : 0; }
  const k = UI.dia;
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  if (!rts.includes(UI.aRota)) UI.aRota = rts[0];
  const edit = canEdit(area);
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] !== '_');
  const cnt = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] !== '_' ? 1 : 0), 0);
  const pendR = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] === 'P' ? 1 : 0), 0);
  const done = items.filter(x => 'RNE'.includes(doc.d[x.i][k])).length;
  const R = items.filter(x => doc.d[x.i][k] === 'R').length, N = items.filter(x => doc.d[x.i][k] === 'N').length, E = items.filter(x => doc.d[x.i][k] === 'E').length;
  const t = items.length || 1;
  let h = `<div class="dayscroll" role="group" aria-label="Dia">${DAYS.map((d, j) => { const dt = add(UI.ini, j); return `<button class="dbtn ${dt === TODAY ? 'hoje' : ''}" data-dia="${j}" aria-pressed="${j === k}"><small>${d}</small><b>${dt.slice(8)}</b></button>`; }).join('')}</div>
  <div class="rchips" role="group" aria-label="Rota">${rts.map(r => { const c = cnt(r), p = pendR(r); return `<button class="rchip" data-arota="${esc(r)}" aria-pressed="${r === UI.aRota}">${esc(r)}<span class="c num">${p ? p + ' pend.' : c ? '✓' : '—'}</span></button>`; }).join('')}</div>
  <div class="card"><div class="body prog"><div class="row-between"><b class="disp">${esc(UI.aRota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}</b><span class="muted num">${done} de ${items.length} apontadas</span></div>
  <div class="stack"><i style="width:${R / t * 100}%;background:var(--st-real)"></i><i style="width:${N / t * 100}%;background:var(--st-nreal)"></i><i style="width:${E / t * 100}%;background:var(--st-extra)"></i></div>
  ${edit ? `<div class="row-gap">${items.length - done > 0 ? (UI.confirm === 'all' ? `<span class="confirm">Marcar as ${items.length - done} restantes como realizadas? <button class="btn pri" data-act="allok">Confirmar</button><button class="btn" data-act="cancel">Cancelar</button></span>` : '<button class="btn" data-act="askAll">✓ Marcar restantes como feitas</button>') : ''}<button class="btn" data-act="extra">${I.plus} Atividade extra</button></div>` : '<p class="muted m0">Seu perfil é somente leitura nesta área.</p>'}</div></div>`;
  if (!items.length) h += `<div class="card"><div class="empty">Nada programado para esta rota em ${DAYS[k]}. Se algo foi feito, registre como atividade extra.</div></div>`;
  h += '<div class="mlist">';
  for (const { i, p } of items) {
    const c = st(doc, i, k); const raw = doc.d[i][k]; const m = doc.m[p.id + '|' + k];
    h += `<div class="act ${c}"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${esc(p.local)} · <span class="mono">${p.id}</span>${raw === 'E' ? ' · <span class="pill ext">extra</span>' : ''}${c === 'A' ? ' · <span class="pill warn">atrasada</span>' : ''}</div>${m ? `<div class="m">Motivo: ${esc(m)}</div>` : ''}</div>
    ${edit ? `<div class="bt">${raw === 'E' ? `<button class="no-btn" data-ap="${i}|${k}|rmE" aria-label="Remover extra" title="Remover extra">✕</button>` : `<button class="ok-btn" data-ap="${i}|${k}|R" aria-pressed="${raw === 'R'}" aria-label="Realizada">✓</button><button class="no-btn" data-ap="${i}|${k}|N" aria-pressed="${raw === 'N'}" aria-label="Não realizada">✕</button>`}</div>` : `<span class="chip ${c}">${CHIP[c]}</span>`}</div>`;
  }
  return h + '</div>';
}

/* ---------------- ESCALA ---------------- */
function escalaRota(r, ini) {
  const cs = COLABS.filter(c => c.area === r.area && c.rota === r.rota);
  const doc = DB.cache.semanas[r.area + '|' + ini];
  const out = [];
  for (let k = 0; k < 7; k++) {
    const dt = add(ini, k);
    const aloc = cs.filter(c => DB.sit(c.id + '|' + dt) !== 'DS').length;
    const aus = cs.filter(c => AUSENTE.has(DB.sit(c.id + '|' + dt))).length;
    let prog = 0; if (doc) doc.ids.forEach((id, i) => { if (PL.get(id) && PL.get(id).rota === r.rota && doc.d[i][k] !== '_') prog++; });
    const nec = r.carga > 0 ? Math.ceil(r.ef * prog / r.carga) : (r.rota === 'GESTÃO' ? Math.min(r.ef, aloc) : 0);
    out.push({ disp: aloc - aus, nec, prog, aloc });
  }
  return { cs, days: out };
}
function vEscala() {
  const area = areaScope();
  const rs = rotasDa(area);
  let def = 0, ausT = 0;
  const rows = rs.map(r => { const e = escalaRota(r, UI.ini); const dd = e.days.filter(d => d.prog > 0 && d.disp < d.nec).length; if (dd) def++; ausT += e.days.reduce((n, d) => n + (d.aloc - d.disp), 0); return { r, e, dd }; });
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  const totalCol = COLABS.filter(c => area === 'TODAS' || c.area === area).length;
  let h = `<div class="mini"><div><b class="num">${totalCol}</b><span>Colaboradores</span></div><div><b class="num">${rs.length}</b><span>Rotas</span></div><div><b class="num" style="color:${def ? 'var(--st-nreal)' : 'inherit'}">${def}</b><span>Rotas com déficit</span></div><div><b class="num">${ausT}</b><span>Ausências (pessoa-dia)</span></div></div>
  <div class="card"><header><h2>Dimensionamento por rota</h2><p>Disponíveis / necessários. Necessário = efetivo padrão × atividades do dia ÷ carga padrão</p></header><div class="tw"><table><thead><tr><th>Rota</th>${area === 'TODAS' ? '<th>Área</th>' : ''}<th class="r">Ef. padrão</th><th class="r">Carga</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${d}<br><span class="thd">${ddmm(add(UI.ini, k))}</span></th>`).join('')}<th>Situação</th></tr></thead><tbody>
  ${rows.map(({ r, e, dd }) => `<tr><td><button class="btn ghost link" data-erota="${esc(r.area + '|' + r.rota)}">${esc(r.rota)}</button></td>${area === 'TODAS' ? `<td class="muted">${AREA_S[r.area]}</td>` : ''}<td class="r num">${r.ef}</td><td class="r num">${r.carga}</td>${e.days.map((d, k) => `<td class="c ${tk[k] ? 'today' : ''}"><span class="cell num ${!d.prog && r.rota !== 'GESTÃO' ? 'neu' : d.disp < d.nec ? 'bad' : 'ok'}" title="${d.prog} atividades · ${d.aloc} alocados">${d.disp}/${d.nec}</span></td>`).join('')}<td>${r.rota === 'GESTÃO' ? '<span class="pill neu">Gestão</span>' : dd ? `<span class="pill bad">Déficit · ${dd} ${dd > 1 ? 'dias' : 'dia'}</span>` : '<span class="pill ok">Adequado</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
  const opts = rs.map(r => r.area + '|' + r.rota);
  if (!opts.includes(UI.eRota)) { const f = rows.find(x => x.dd); UI.eRota = f ? f.r.area + '|' + f.r.rota : opts[0]; }
  if (!UI.eRota) return h;
  const [ea, er] = UI.eRota.split('|');
  const cs = COLABS.filter(c => c.area === ea && c.rota === er);
  const ed = canEditSit(ea);
  h += `<div class="card"><header><h2>Efetivo diário</h2><p>${ed ? 'Toque no dia para mudar a situação. Vazio = presente' : 'Somente leitura'}</p><span class="r"><select class="in" id="fERota" aria-label="Rota">${rs.map(r => `<option value="${esc(r.area + '|' + r.rota)}" ${r.area + '|' + r.rota === UI.eRota ? 'selected' : ''}>${esc(r.rota)}${area === 'TODAS' ? ' · ' + AREA_S[r.area] : ''}</option>`).join('')}</select></span></header>
  <div class="body pb0"><div class="legend">${SITS.filter(s => s[0] !== 'P').map(s => `<span><b>${s[0]}</b> ${s[1]}</span>`).join('')}</div></div>
  <div class="tw"><table><thead><tr><th>Colaborador</th><th>Função</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(UI.ini, k).slice(8)}</span></th>`).join('')}</tr></thead><tbody>
  ${cs.length ? cs.map(c => `<tr><td><b>${esc(title(c.nome))}</b><div class="muted small">${esc(title(c.regime))}</div></td><td class="muted small">${esc(title(c.funcao))}</td>${DAYS.map((_, k) => { const v = DB.sit(c.id + '|' + add(UI.ini, k)) || 'P'; return `<td class="c ${tk[k] ? 'today' : ''}"><button class="sit ${v}" ${ed ? `data-sit="${c.id}|${add(UI.ini, k)}"` : 'disabled'} aria-label="${(SITS.find(s => s[0] === v) || [v, v])[1]}">${v === 'P' ? '' : v}</button></td>`; }).join('')}</tr>`).join('') : '<tr><td colspan="9" class="empty">Nenhum colaborador nesta rota.</td></tr>'}
  </tbody></table></div></div>`;
  return h;
}

/* ---------------- PENDÊNCIAS ---------------- */
function vPend() {
  const area = myArea() || UI.area;
  const at = atrasadasAll(area);
  const byR = new Map();
  for (const x of at) { const p = PL.get(x.doc.ids[x.i]); if (!p) continue; const key = x.doc.area + '|' + p.rota; if (!byR.has(key)) byR.set(key, []); byR.get(key).push(x); }
  const lista = [...byR.entries()].sort((a, b) => b[1].length - a[1].length);
  let h = '';
  if (!myArea()) h += `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fArea"><option value="TODAS">Todas as áreas</option>${AREAS.map(a => `<option value="${a}" ${a === UI.area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label></div>`;
  h += `<div class="mini"><div><b class="num" style="color:var(--st-atr)">${at.length}</b><span>Atrasadas</span></div><div><b class="num">${lista.length}</b><span>Rotas com atraso</span></div><div><b class="num">${at.length ? ddmm(at[0].dt) : '—'}</b><span>Mais antiga</span></div></div><p class="muted small m0">Considera o mês atual e o anterior.</p>`;
  if (!at.length) h += '<div class="card"><div class="empty">Tudo apontado. Nenhuma atividade atrasada.</div></div>';
  h += '<div class="grid2"><div class="stackcol">';
  for (const [key, xs] of lista.slice(0, 12)) {
    const [a, r] = key.split('|'); const ed = canEdit(a);
    h += `<div class="card"><header><h2>${esc(r)}</h2><p>${AREA_S[a]} · ${xs.length} atrasada${xs.length > 1 ? 's' : ''}</p>${ed ? `<span class="r">${UI.confirm === 'rota:' + key ? `<span class="confirm">Marcar todas como feitas? <button class="btn pri" data-act="rotaok" data-k="${esc(key)}">Confirmar</button><button class="btn" data-act="cancel">Cancelar</button></span>` : `<button class="btn" data-act="askRota" data-k="${esc(key)}">✓ Todas feitas</button>`}</span>` : ''}</header><div class="body"><div class="plist">
    ${xs.slice(0, 6).map(x => { const p = PL.get(x.doc.ids[x.i]); return `<div class="pitem"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${DAYS[x.k]} ${ddmm(x.dt)} · ${esc(p.local)}</div></div>${ed ? `<div class="bt"><button class="ok-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|R" aria-label="Realizada">✓</button><button class="no-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|N" aria-label="Não realizada">✕</button></div>` : ''}</div>`; }).join('')}
    ${xs.length > 6 ? `<div class="pitem"><span class="muted">+ ${xs.length - 6} nesta rota</span><button class="btn" data-goprog="${esc(key)}|${xs[0].doc.ini}">Abrir na programação</button></div>` : ''}
    </div></div></div>`;
  }
  h += '</div>';
  const mot = {}; for (const d of docsFor({ area })) for (const v of Object.values(d.m)) mot[v] = (mot[v] || 0) + 1;
  const mt = Object.entries(mot).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...mt.map(x => x[1]));
  h += `<div class="stackcol"><div class="card"><header><h2>Por que não foi feito</h2><p>Motivos das não realizadas</p></header><div class="body">${mt.length ? `<div class="bars">${mt.map(([m, n]) => `<div class="barrow mot"><span class="n">${esc(m)}</span><div class="stack clear"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Sem registros.</div>'}</div></div>
  <div class="card"><header><h2>Histórico</h2></header><div class="body">${logHtml(15)}</div></div></div></div>`;
  return h;
}

/* ---------------- FOLHA DO LÍDER ---------------- */
function vImprimir() {
  const area = myArea() || (UI.area === 'TODAS' ? 'RECEBIMENTO' : UI.area);
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  if (UI.iRota !== 'TODAS' && !rts.includes(UI.iRota)) UI.iRota = 'TODAS';
  const lid = COLABS.find(c => c.area === area && c.funcao === 'LÍDER');
  const lider = UI.lider || (lid ? title(lid.nome) : '');
  let h = `<div class="filters noprint">
   ${!myArea() ? `<label class="sel"><span>Área da folha</span><select class="in" id="fArea">${AREAS.map(a => `<option value="${a}" ${a === area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>` : ''}
   <label class="sel"><span>Rota</span><select class="in" id="fIRota"><option value="TODAS">Todas</option>${rts.map(r => `<option ${r === UI.iRota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Líder</span><input class="in" id="fLider" value="${esc(lider)}"></label>
   ${!framed ? `<button class="btn pri" data-act="print" style="align-self:flex-end">${I.print} Imprimir / salvar PDF</button>` : ''}
  </div>`;
  if (!doc) return h + '<div class="card"><div class="empty">Semana não gerada.</div></div>';
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && (UI.iRota === 'TODAS' || x.p.rota === UI.iRota) && doc.d[x.i] !== '_______');
  let g = '', n = 0;
  h += `<div class="tw"><div class="paper"><div class="hd"><div><h3>PROGRAMAÇÃO SEMANAL DE ATIVIDADES</h3><div class="meta"><span><b>Área:</b> ${AREA_S[area]}</span><span><b>Mês:</b> ${monthLabel(doc.mes)}</span><span><b>Semana:</b> ${weekLabel(doc.ini)}</span><span><b>Rota:</b> ${UI.iRota === 'TODAS' ? 'Todas' : esc(UI.iRota)}</span></div><div class="meta"><span id="liderTxt"><b>Líder responsável:</b> ${esc(lider || '_______________________')}</span><span>☐ programado — marque ✓ feito ou ✕ não feito · — sem programação</span></div></div><div class="rt small"><img class="plogo" src="img/dikma-logo.png" alt="Dikma"><br>Pátio de Carvão</div></div>
  <table><thead><tr><th>Nº</th><th>Local / equipamento</th><th>Atividade</th>${DAYS.map((d, k) => `<th class="c">${d}<br>${ddmm(add(doc.ini, k))}</th>`).join('')}<th style="width:120px">Observação</th></tr></thead><tbody>
  ${items.map(({ i, p }) => { let r = ''; if (p.rota !== g) { g = p.rota; r += `<tr class="grp"><td colspan="11">${esc(p.rota)}</td></tr>`; } n++; return r + `<tr><td class="c">${n}</td><td>${esc(p.local)}</td><td>${esc(p.ativ)}</td>${DAYS.map((_, k) => `<td class="c">${doc.d[i][k] === '_' ? '—' : '<span class="box"></span>'}</td>`).join('')}<td></td></tr>`; }).join('')}
  </tbody></table><div class="sign"><div>Líder</div><div>Supervisor</div></div></div></div>`;
  return h;
}

/* ---------------- PLANO PADRÃO ---------------- */
function vPlano() {
  const a = UI.pArea;
  const ps = (DB.cache.plano[a] || []).filter(p => p.ativo !== false);
  const rts = rotasDa(a).filter(r => r.rota !== 'GESTÃO').map(r => r.rota);
  return `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fPArea">${AREAS.map(x => `<option value="${x}" ${x === a ? 'selected' : ''}>${AREA_S[x]}</option>`).join('')}</select></label><span class="muted" style="align-self:flex-end">${ps.length} atividades · alterações valem para os meses gerados depois</span></div>
  <div class="card"><header><h2>Nova atividade</h2></header><div class="body"><form id="fNova" class="form">
   <label class="sel"><span>Rota</span><select class="in" id="nRota">${rts.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel wide"><span>Local / equipamento</span><input class="in" id="nLocal" required placeholder="Ex.: CORREIA C5613A"></label>
   <label class="sel wide"><span>Atividade</span><input class="in" id="nAtiv" required placeholder="Ex.: Mesa impacto - Lavagem"></label>
   <label class="sel"><span>Tipo</span><select class="in" id="nTipo">${tipos().map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
   <div class="sel"><span>Dias</span><div class="row-gap tight">${DL.map((d, k) => `<button type="button" class="tog lbl-on" data-ntog="${k}" aria-pressed="${k < 5}" aria-label="${DAYS[k]}">${d}</button>`).join('')}</div></div>
   <button class="btn pri" type="submit">${I.plus} Adicionar</button>
  </form></div></div>
  <div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Rota</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map(d => `<th class="c">${d}</th>`).join('')}<th class="r">Freq.</th><th></th></tr></thead><tbody>
  ${ps.map(p => `<tr><td class="mono muted">${p.id}</td><td class="small">${esc(p.rota)}</td><td><div class="loc" title="${esc(p.local)}">${esc(p.local)}</div></td><td>${esc(p.ativ)}</td><td><span class="tag">${esc(p.tipo)}</span></td>${[...p.dias].map((c, k) => `<td class="c"><button class="tog" data-ptog="${p.id}|${k}" aria-pressed="${c === '1'}" aria-label="${DAYS[k]}">✓</button></td>`).join('')}<td class="r num">${[...p.dias].filter(c => c === '1').length}</td><td>${UI.confirm === 'del:' + p.id ? `<span class="confirm"><button class="btn danger" data-act="del" data-id="${p.id}">Excluir</button><button class="btn" data-act="cancel">Não</button></span>` : `<button class="btn ghost danger" data-act="askDel" data-id="${p.id}" aria-label="Excluir ${p.id}">✕</button>`}</td></tr>`).join('')}
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
  const areaSel = (id, v, dis) => `<select class="in" ${id} ${dis ? 'disabled' : ''}><option value="">—</option>${AREAS.map(a => `<option value="${a}" ${v === a ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select>`;
  return `<div class="mini"><div><b class="num">${ativos}</b><span>Ativos</span></div><div><b class="num">${us.length - ativos}</b><span>Bloqueados</span></div></div>
  <div class="card"><header><h2>Novo usuário</h2><p>A pessoa entra com o usuário e a senha provisória e cria a própria senha no primeiro acesso.</p></header><div class="body"><form id="fNovoUser" class="form" novalidate>
   <label class="sel wide"><span>Nome</span><input class="in" id="nuNome" required placeholder="Ex.: Edmar Lucas Gomes de Araujo"></label>
   <label class="sel"><span>Usuário</span><input class="in" id="nuLogin" required autocapitalize="none" spellcheck="false" placeholder="ex.: edmar.araujo"></label>
   <label class="sel"><span>Senha provisória</span><input class="in" id="nuSenha" required minlength="6" value="${esc(UI.senhaSug || (UI.senhaSug = senhaAleatoria()))}"></label>
   <label class="sel"><span>Perfil</span><select class="in" id="nuPapel">${PAPEIS.filter(p => p[0] !== 'bloqueado').map(([v, n]) => `<option value="${v}" ${v === 'lider' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
   <label class="sel"><span>Área</span>${areaSel('id="nuArea"', '', false)}</label>
   <button class="btn pri" type="submit" ${UI.busy ? 'disabled' : ''}>${I.plus} ${UI.busy ? 'Cadastrando…' : 'Cadastrar'}</button>
   <p class="err wide" id="nuErr" role="alert" hidden></p>
  </form></div></div>
  <div class="card"><header><h2>Acessos</h2><p>Líder e supervisor apontam só na área deles. Somente leitura vê tudo e não altera nada. Bloqueado não entra.</p></header><div class="tw"><table><thead><tr><th>Pessoa</th><th>Usuário</th><th>Perfil</th><th>Área</th><th></th></tr></thead><tbody>
  ${us.map(u => `<tr><td><b>${esc(title(u.nome))}</b>${u.trocarSenha ? '<div class="small" style="color:var(--st-atr)">Ainda não criou a própria senha</div>' : ''}</td><td class="mono">${u.login ? esc(u.login) : '<span class="muted">conta Google</span>'}</td><td><select class="in" data-upapel="${u.uid}" aria-label="Perfil de ${esc(u.nome)}">${PAPEIS.map(([v, n]) => `<option value="${v}" ${u.papel === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td><td>${areaSel(`data-uarea="${u.uid}" aria-label="Área de ${esc(u.nome)}"`, u.area, !['lider', 'supervisor'].includes(u.papel))}</td><td>${u.login && u.uid !== ME.uid ? `<button class="btn" data-reset="${u.uid}">${I.key} Redefinir senha</button>` : u.uid === ME.uid ? '<span class="muted small">você</span>' : ''}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
function senhaAleatoria() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(8)); for (const n of r) s += c[n % c.length]; return s; }

/* ---------------- CONFIG ---------------- */
function vConfig() {
  return `<div class="card"><header><h2>Rotas</h2><p>Efetivo padrão (quadro previsto) e carga padrão (pico diário de atividades)</p></header><div class="tw"><table><thead><tr><th>Área</th><th>Rota</th><th class="r">Efetivo padrão</th><th class="r">Carga padrão</th><th class="r">Colaboradores</th></tr></thead><tbody>
  ${rotas().map((r, i) => `<tr><td class="muted">${AREA_S[r.area]}</td><td><b>${esc(r.rota)}</b></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|ef" value="${r.ef}" aria-label="Efetivo padrão ${esc(r.rota)}"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|carga" value="${r.carga}" aria-label="Carga padrão ${esc(r.rota)}"></td><td class="r num">${COLABS.filter(c => c.area === r.area && c.rota === r.rota).length}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="card"><header><h2>Tipos de atividade</h2></header><div class="body"><div class="rchips">${tipos().map(t => `<span class="rchip">${esc(t)}</span>`).join('')}</div></div></div>`;
}

/* ---------------- IMPORTAR (primeiro acesso) ---------------- */
function vImportar() {
  if (!isAdmin()) return '<div class="card"><div class="empty">O administrador ainda não importou os dados da planilha.</div></div>';
  const ws = []; for (const m of [CUR_MONTH]) for (const w of weeksOfMonth(m)) ws.push(w);
  return `<div class="card"><header><h2>Importar dados da planilha</h2><p>Plano padrão (894 atividades), 32 rotas, 95 colaboradores e as situações já lançadas no Efetivo</p></header><div class="body stackcol">
   <label class="sel"><span>Começar a programação na semana</span><select class="in" id="impIni">${ws.map(w => `<option value="${w}" ${w === UI.impIni ? 'selected' : ''}>${weekLabel(w)}${w === CUR_WEEK ? ' · atual' : ''}</option>`).join('')}</select></label>
   <p class="muted m0">Gera ${monthLabel(CUR_MONTH)} a partir dessa semana e os dois meses seguintes. Semanas anteriores não são criadas, para não aparecerem como atrasadas.</p>
   <button class="btn pri" data-act="importar" ${UI.busy ? 'disabled' : ''} style="align-self:flex-start">${UI.busy ? 'Importando…' : 'Importar e gerar a programação'}</button>
  </div></div>`;
}

/* ---------------- interação ---------------- */
function sheet(titleTxt, sub, opts, onPick) {
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleTxt)}"><h3>${esc(titleTxt)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="opts">${opts.map((o, i) => `<button class="opt" data-o="${i}" ${o.cur ? 'aria-current="true"' : ''}>${o.ic || ''}<span>${esc(o.t)}${o.d ? `<br><small class="muted">${esc(o.d)}</small>` : ''}</span></button>`).join('')}</div><button class="btn center" data-o="x">Cancelar</button></div></div>`;
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
function alterarSenhaSheet() {
  formSheet('Alterar minha senha', esc(ME.login || ''), senhaField('asAtual', 'Senha atual', 'current-password') + senhaField('asNova', 'Nova senha (mínimo 6 caracteres)', 'new-password') + senhaField('asNova2', 'Repita a nova senha', 'new-password'), 'Salvar', async () => {
    const a = $('asAtual').value, n = $('asNova').value, n2 = $('asNova2').value;
    if (n.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
    if (n !== n2) throw new Error('As duas senhas novas não são iguais.');
    await DB.alterarSenha(a, n); toast('Senha alterada');
  });
}
function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2400); }
const chipIc = c => `<span class="chip ${c}">${CHIP[c]}</span>`;
function cellMenu(doc, i, k) {
  if (!canEdit(doc.area)) { toast('Seu perfil não pode apontar nesta área'); return; }
  const p = PL.get(doc.ids[i]); const raw = doc.d[i][k]; const c = st(doc, i, k);
  const sub = `${esc(p.rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}<br>${esc(p.local)}`;
  const o = (raw === '_' || raw === 'E')
    ? [{ t: 'Registrar como extra', d: 'Feita fora da programação', v: 'E', ic: chipIc('E'), cur: raw === 'E' }, { t: 'Não programada', v: '_', ic: chipIc('X'), cur: raw === '_' }]
    : [{ t: 'Realizado', v: 'R', ic: chipIc('R'), cur: raw === 'R' }, { t: 'Não realizado', d: 'Pede o motivo', v: 'N', ic: chipIc('N'), cur: raw === 'N' }, { t: 'Programado', d: c === 'A' ? 'Continua atrasado' : 'Sem apontamento', v: 'P', ic: chipIc(c === 'A' ? 'A' : 'P'), cur: raw === 'P' }];
  sheet(p.ativ, sub, o, x => apply(doc, i, k, x.v));
}
function apply(doc, i, k, v, motivo) {
  if (v === 'N' && !motivo) return sheet('Motivo', esc(PL.get(doc.ids[i]).ativ), MOTIVOS.map(m => ({ t: m })), x => apply(doc, i, k, 'N', x.t));
  setSt(doc, i, k, v, motivo);
  toast({ R: 'Marcada como realizada', N: 'Marcada como não realizada', P: 'Apontamento desfeito', E: 'Extra registrada', _: 'Extra removida' }[v]);
  render();
}
function exportCSV() {
  const area = areaScope(); const rows = [['ÁREA', 'SEMANA', 'ID', 'ROTA', 'LOCAL', 'ATIVIDADE', 'TIPO', ...DAYS, 'MOTIVOS']];
  for (const d of docsFor({ ini: UI.ini, area })) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p) return; rows.push([d.area, weekLabel(d.ini), id, p.rota, p.local, p.ativ, p.tipo, ...[...d.d[i]].map(c => ({ P: 'PROGRAMADO', R: 'REALIZADO', N: 'NÃO REALIZADO', E: 'EXTRA', _: '' }[c])), Object.entries(d.m).filter(([k]) => k.startsWith(id + '|')).map(([k, v]) => DAYS[k.split('|')[1]] + ': ' + v).join('; ')]); });
  const csv = '﻿' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `programacao_${UI.ini}.csv`; a.click();
}

function afterRender() {
  const on = (id, ev, fn) => { const e = $(id); if (e) e.addEventListener(ev, fn); };
  on('fMes', 'change', e => { UI.mes = e.target.value; const ws = weeksOfMonth(UI.mes); UI.ini = ws.includes(CUR_WEEK) ? CUR_WEEK : ws[0]; UI.more = 0; UI.dia = null; render(); });
  on('fSem', 'change', e => { UI.ini = e.target.value; UI.dia = null; UI.more = 0; render(); });
  on('fArea', 'change', e => { UI.area = e.target.value; UI.rota = 'TODAS'; UI.more = 0; render(); });
  on('fRota', 'change', e => { UI.rota = e.target.value; UI.more = 0; render(); });
  on('fTipo', 'change', e => { UI.tipo = e.target.value; render(); });
  on('fPend', 'change', e => { UI.soPend = e.target.checked; render(); });
  on('fQ', 'input', e => { UI.q = e.target.value; clearTimeout(window._qt); window._qt = setTimeout(schedule, 250); });
  on('fERota', 'change', e => { UI.eRota = e.target.value; render(); });
  on('fIRota', 'change', e => { UI.iRota = e.target.value; render(); });
  on('fLider', 'input', e => { UI.lider = e.target.value; const t = $('liderTxt'); if (t) t.innerHTML = '<b>Líder responsável:</b> ' + esc(UI.lider); });
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

document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-area]'); if (!t || t.closest('#layer')) return;
  const d = t.dataset;
  if (d.go) {
    if (d.go === '__more') {
      const vs = VIEWS.filter(v => !['painel', 'prog', 'apontar', 'escala'].includes(v.id) && (!v.admin || isAdmin()));
      const extra = [{ t: 'Alterar minha senha', id: '__senha', ic: `<span class="opt-ic">${I.key}</span>` }, ...(DEMO ? [{ t: 'Trocar usuário (demonstração)', id: '__user', d: title(ME.nome) + ' · ' + papelNome(ME.papel) }] : []), { t: 'Sair', id: '__out', d: title(ME.nome || '') + ' · ' + papelNome(ME.papel), ic: `<span class="opt-ic">${I.out}</span>` }];
      return sheet('Mais', '', [...vs.map(v => ({ t: v.nome, id: v.id, ic: `<span class="opt-ic">${I[v.ic]}</span>` })), ...extra], o => { if (o.id === '__out') return DB.signOut(); if (o.id === '__senha') return alterarSenhaSheet(); if (o.id === '__user') return sheet('Entrar como', 'Simula o login de cada perfil', DB.cache.usuarios.map(u => ({ t: title(u.nome), d: papelNome(u.papel) + (u.area ? ' · ' + AREA_S[u.area] : ''), uid: u.uid, cur: u.uid === ME.uid })), x => { DB.mockSwitch(x.uid); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(x.t)); }); UI.view = o.id; UI.confirm = null; render(); scrollTo(0, 0); });
    }
    UI.view = d.go; UI.confirm = null; UI.more = 0; render(); scrollTo(0, 0); return;
  }
  if (d.esc) { UI.escopo = d.esc; render(); return; }
  if (d.area) { UI.area = d.area; render(); return; }
  if (d.cell) { const [id, i, k] = d.cell.split('|').length === 4 ? [d.cell.split('|').slice(0, 2).join('|'), ...d.cell.split('|').slice(2)] : d.cell.split('|'); cellMenu(DB.cache.semanas[id], +i, +k); return; }
  if (d.dia != null) { UI.dia = +d.dia; UI.confirm = null; render(); return; }
  if (d.arota) { UI.aRota = d.arota; UI.confirm = null; render(); return; }
  if (d.ap) {
    const [i, k, v] = d.ap.split('|'); const doc = DB.cache.semanas[areaScope() + '|' + UI.ini];
    if (v === 'rmE') return apply(doc, +i, +k, '_');
    return apply(doc, +i, +k, doc.d[+i][+k] === v ? 'P' : v);
  }
  if (d.pend) { const parts = d.pend.split('|'); const id = parts[0] + '|' + parts[1]; return apply(DB.cache.semanas[id], +parts[2], +parts[3], parts[4]); }
  if (d.goprog) { const [a, r, ini] = d.goprog.split('|'); UI.view = 'prog'; if (!myArea()) UI.area = a; UI.rota = r; UI.ini = ini; UI.mes = monthOfWeek(ini); UI.soPend = true; render(); scrollTo(0, 0); return; }
  if (d.erota) { UI.eRota = d.erota; render(); const s = $('fERota'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (d.sit) {
    const [id, dt] = d.sit.split('|'); const c = COLABS.find(x => x.id === id); const cur = DB.sit(d.sit) || 'P';
    return sheet(title(c.nome), `${DAYS[(pd(dt).getDay() + 6) % 7]} ${ddmm(dt)}`, SITS.map(s => ({ t: s[1], v: s[0], ic: `<span class="sit ${s[0]}">${s[0] === 'P' ? '' : s[0]}</span>`, cur: s[0] === cur })), o => { DB.setSit(d.sit, o.v === 'P' ? null : o.v); DB.log(`${title(c.nome)} · ${ddmm(dt)} → ${o.t}`); render(); });
  }
  if (d.ptog) {
    const [id, k] = d.ptog.split('|'); const p = PL.get(id); const itens = DB.cache.plano[p.area].map(x => (x.id === id ? { ...x, dias: [...x.dias].map((c, j) => (j === +k ? (c === '1' ? '0' : '1') : c)).join('') } : x));
    DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); render(); return;
  }
  if (d.eye) { toggleEye(t); return; }
  if (d.reset) {
    const u = DB.cache.usuarios.find(x => x.uid === d.reset); const nova = senhaAleatoria();
    return formSheet('Redefinir senha', `${esc(title(u.nome))} · <span class="mono">${esc(u.login)}</span>`, `<label class="sel"><span>Nova senha provisória</span><input class="in" id="rsSenha" minlength="6" value="${nova}"></label><p class="muted small m0">Passe essa senha para a pessoa. No próximo acesso ela cria a própria senha.</p>`, 'Redefinir', async () => {
      const v = $('rsSenha').value.trim(); if (v.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      await DB.redefinirSenha(u.uid, v); DB.log(`Redefiniu a senha de ${u.login}`); toast(`Senha de ${u.login} redefinida`);
    });
  }
  if (d.ntog != null) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); return; }
  switch (d.act) {
    case 'loginGoogle': try { await DB.signInGoogle(); } catch (err) { toast('Não foi possível entrar: ' + msgErro(err)); } break;
    case 'senha': alterarSenhaSheet(); break;
    case 'logout': DB.signOut(); break;
    case 'mockReset': await DB.mockReset(); toast('Demonstração restaurada'); break;
    case 'hoje': UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; UI.dia = null; render(); break;
    case 'more': UI.more = +d.n; render(); break;
    case 'cancel': UI.confirm = null; render(); break;
    case 'askAll': UI.confirm = 'all'; render(); break;
    case 'allok': {
      const doc = DB.cache.semanas[areaScope() + '|' + UI.ini]; const k = UI.dia; const ch = [];
      doc.ids.forEach((id, i) => { const p = PL.get(id); if (p && p.rota === UI.aRota && doc.d[i][k] === 'P') ch.push(localChange(doc, i, k, 'R')); });
      if (ch.length) DB.setStatusMany(doc.id, ch);
      DB.log(`${UI.aRota} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}: ${ch.length} atividades marcadas como realizadas`);
      UI.confirm = null; toast(`${ch.length} atividades marcadas como realizadas`); render(); break;
    }
    case 'extra': {
      const doc = DB.cache.semanas[areaScope() + '|' + UI.ini]; const k = UI.dia;
      const opts = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] === '_');
      if (!opts.length) { toast('Todas as atividades desta rota já estão no dia'); break; }
      sheet('Atividade extra', `${esc(UI.aRota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}`, opts.map(x => ({ t: x.p.ativ, d: x.p.local, i: x.i })), o => apply(doc, o.i, k, 'E'));
      break;
    }
    case 'askRota': UI.confirm = 'rota:' + d.k; render(); break;
    case 'rotaok': {
      const [a, r] = d.k.split('|'); const byDoc = new Map();
      for (const x of atrasadasAll(a)) { const p = PL.get(x.doc.ids[x.i]); if (!p || p.rota !== r) continue; if (!byDoc.has(x.doc)) byDoc.set(x.doc, []); byDoc.get(x.doc).push(localChange(x.doc, x.i, x.k, 'R')); }
      let n = 0; for (const [doc, ch] of byDoc) { n += ch.length; DB.setStatusMany(doc.id, ch); }
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
        const seed = await (await fetch('seed.json')).json();
        await DB.importar(seed, [CUR_MONTH, addMonth(CUR_MONTH, 1), addMonth(CUR_MONTH, 2)], UI.impIni);
        DB.log('Importou os dados da planilha e gerou a programação'); toast('Dados importados');
      } catch (err) { toast('Erro ao importar: ' + err.message); }
      UI.busy = false; render(); break;
    }
    case 'print': window.print(); break;
    case 'csv': exportCSV(); break;
  }
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!['fLogin', 'fFirst', 'fMust', 'fNovoUser'].includes(f.id)) return;
  e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try {
    if (f.id === 'fLogin') { await DB.signIn($('lgUser').value, $('lgPass').value); return; }
    if (f.id === 'fFirst') {
      const nome = $('faNome').value.trim(), login = DB.normLogin($('faUser').value), senha = $('faPass').value;
      if (!nome) throw new Error('Informe seu nome.'); if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      await DB.criarPrimeiroAdmin({ nome, login, senha }); return;
    }
    if (f.id === 'fMust') {
      const n = $('mcPass').value, n2 = $('mcPass2').value;
      if (n.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.'); if (n !== n2) throw new Error('As duas senhas não são iguais.');
      await DB.definirNovaSenha(n); toast('Senha criada'); return;
    }
    if (f.id === 'fNovoUser') {
      const nome = $('nuNome').value.trim(), login = DB.normLogin($('nuLogin').value), senha = $('nuSenha').value.trim(), papel = $('nuPapel').value, area = $('nuArea').value || null;
      if (!nome) throw new Error('Informe o nome.');
      if (!DB.loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado (sem espaço e sem acento).');
      if (senha.length < 6) throw new Error('A senha provisória precisa ter pelo menos 6 caracteres.');
      if (['lider', 'supervisor'].includes(papel) && !area) throw new Error('Escolha a área do líder ou supervisor.');
      UI.busy = true;
      await DB.criarUsuario({ nome: nome.toUpperCase(), login, senha, papel, area: ['lider', 'supervisor'].includes(papel) ? area : null });
      DB.log(`Cadastrou o usuário ${login} (${papelNome(papel)})`);
      UI.busy = false; UI.senhaSug = null; render();
      formSheet('Usuário cadastrado', '', `<p class="m0">Passe estes dados para <b>${esc(title(nome))}</b>:</p><div class="credbox"><div><span>Endereço</span><b>${esc(location.origin)}</b></div><div><span>Usuário</span><b>${esc(login)}</b></div><div><span>Senha provisória</span><b>${esc(senha)}</b></div></div><p class="muted small m0">No primeiro acesso a pessoa cria a própria senha.</p>`, 'Fechar', async () => {});
      return;
    }
  } catch (err) {
    UI.busy = false;
    const id = { fLogin: 'lgErr', fFirst: 'faErr', fMust: 'mcErr', fNovoUser: 'nuErr' }[f.id];
    showErr(id, err);
  } finally { const b = f.querySelector('[type=submit]'); if (b && f.isConnected) b.disabled = false; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'mockUser') { DB.mockSwitch(t.value); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(ME ? ME.nome : '')); return; }
  if (t.dataset.rcfg) { const [i, f] = t.dataset.rcfg.split('|'); const rs = rotas().map((r, j) => (j === +i ? { ...r, [f]: Math.max(0, +t.value || 0) } : r)); DB.cache.config.rotas = rs; DB.saveRotas(rs); toast('Rota atualizada'); }
  if (t.dataset.upapel) {
    const uid = t.dataset.upapel; const admins = DB.cache.usuarios.filter(u => u.papel === 'admin').length;
    if (uid === ME.uid && t.value !== 'admin' && admins < 2) { toast('Antes, deixe outra pessoa como administrador'); t.value = 'admin'; return; }
    const patch = { papel: t.value }; if (!['lider', 'supervisor'].includes(t.value)) patch.area = null;
    DB.setUsuario(uid, patch); toast('Perfil atualizado');
  }
  if (t.dataset.uarea) { DB.setUsuario(t.dataset.uarea, { area: t.value || null }); toast('Área atualizada'); }
});
matchMedia('(max-width:860px)').addEventListener('change', () => { if (UI.view === 'prog') render(); });
window.addEventListener('online', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('offline', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('pagehide', () => { try { localStorage.setItem('coqueria-ui', JSON.stringify({ view: UI.view })); } catch (e) { /* ignora */ } });

DB.start({
  onAuth: a => { AUTH = a; ME = a.user || null; if (ME && myArea()) UI.area = myArea(); render(); },
  onData: () => { if (AUTH.status === 'ready') schedule(); },
  onError: err => { console.error(err); toast(err.code === 'permission-denied' ? 'Sem permissão para essa alteração' : 'Erro: ' + (err.message || err)); }
});

if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
