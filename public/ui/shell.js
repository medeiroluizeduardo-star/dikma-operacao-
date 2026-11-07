// Moldura da tela: entrada (login), desenho da tela (render), menu lateral, barra de baixo, topo, filtros, busca e tema.
import { SETS, AREA_S, add, ddmm, weeksOfMonth, weekLabel, monthLabel } from '../contas/cal.js';
import * as M from './movimento.js';
import { semAcento, filtrarLista } from './busca.js';
import { DEMO, TV, DB, PAINEL_URL, CUR_WEEK, CUR_MONTH, esc, title, $ } from '../nucleo/base.js';
import { AUTH, ME, SK, AREAS, UI, ultimoLogin, salvarUI, gravarUI, meses, isAdmin, perfil, myAreas, myArea, selMinhaArea, papelNome, rebuild, ensurePeriod, temFichas, modsDe, modsReais, setsDe, temEquipEm, aplicarSet } from '../nucleo/estado.js';
import { I, MOD_IC } from './icones.js';
import { atrasadasAll, aprovador, areasAprov, listaAprov } from '../calc/atividades.js';
import { VIEWS, SUB_E, SUB_G, SUB_A, SUB_S, nomeCurto, MODS, viewsDoModulo, abasDoMenu, modsMenu, mesmoItem, subMod, ensureModulo, SET_VIEWS, barraDe, trocarModulo, abaMarcada, juntasDe, NOME_JUNTO } from '../nucleo/navegacao.js';
import { senhaField, sheet, formSheet, toast } from './janelas.js';
import { vPainel, vAprovar, vCausas, vEtiquetas, vProg, vPend, vImprimir } from '../telas/atividades.js';
import { vApontar } from '../telas/apontar.js';
import { fecharSitPop, vEsDim, vEsBal, vEsDia } from '../telas/efetivo.js';
import { vEsJus, vEsHe } from '../telas/horas-justificativas.js';
import { resTipo, rConj, vResumoOutro, vResumo } from '../telas/relatorios.js';
import { vConfigModulo, vPlano, vGerador, vUsuarios, vPerfis, problemaSenha, vConfig, vImportar } from '../telas/config.js';
import { renderTV } from '../telas/tv.js';
import { MD, EQ, AD, GE, comModulo } from '../nucleo/modulos.js';

// Telas da Segurança (telas/seguranca.js, carregado sob demanda); sgconfig fica na Administração.
const SG_VIEWS = ['sginter', 'sganom', 'sgpainel', 'sgconfig'];

export function menuModulos(abrir) {
  UI.modOpen = abrir;
  const p = document.querySelector('.modpick'); if (!p) return;
  p.classList.toggle('aberto', abrir);
  const b = p.querySelector('[data-modmenu]'); if (b) b.setAttribute('aria-expanded', abrir);
  if (abrir) { const it = p.querySelector('.modmenu [aria-checked="true"]') || p.querySelector('.modmenu button'); if (it) it.focus(); }
}

// Só troca o HTML de um bloco quando ele mudou: atualização de dados que não muda a tela não mexe em nada (sem piscar).
let VIEW_MUDOU = false;
export function pintar(id, html) { const el = document.getElementById(id); if (!el || el._h === html) return false; el.innerHTML = html; el._h = html; if (id === 'view') VIEW_MUDOU = true; return true; }
function gate(html) { const ly = document.getElementById('layer'); if (ly && ly.innerHTML) ly.innerHTML = ''; fecharSitPop(); ['view', 'top', 'fbarra', 'nav', 'who', 'tabbar'].forEach(id => { const e = document.getElementById(id); if (e) e._h = null; }); $('shell').hidden = true; { const g = $('gate'); const novo = g.hidden || !g.querySelector('.brand'); g.hidden = false; const h = new Date().getHours(); const saud = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); g.innerHTML = `<div class="gatecard${novo ? ' anim' : ''}"><div class="gsimb" aria-hidden="true"><img src="img/dikma-simbolo.png" alt=""></div><div class="brand big"><img class="logo on-light" src="img/dikma-logo.png" alt="Dikma"><img class="logo on-dark" src="img/dikma-logo-branco.png" alt="Dikma"><div class="prod"><b>GESTÃO</b></div></div><p class="gsaud">${saud} · ${hoje}</p>${html}</div>`; } }
// Tema da tela neste aparelho: automático (segue o aparelho), claro ou escuro.
export const TEMAS = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };
export const temaAtual = () => { try { const t = localStorage.getItem('dikma-tema'); return TEMAS[t] ? t : 'auto'; } catch (e) { return 'auto'; } };
export const IC_TEMA = { auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>', light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>', dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' };
function aplicarTema(t) {
  try { if (t === 'auto') localStorage.removeItem('dikma-tema'); else localStorage.setItem('dikma-tema', t); } catch (e) { /* sem armazenamento: vale só agora */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const escuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', escuro ? '#14132e' : '#1C1B4A');
  const w = $('who'); if (w) { const b = w.querySelector('[data-act="tema"]'); if (b) b.remove(); } render();
}
export function temaSheet() { const t = temaAtual(); sheet('Tema da tela', 'Vale só neste aparelho', Object.entries(TEMAS).map(([k, n]) => ({ t: n, d: k === 'auto' ? 'Segue o claro ou escuro do aparelho' : '', k, cur: k === t, ic: `<span class="opt-ic">${IC_TEMA[k]}</span>` })), o => { aplicarTema(o.k); toast(`Tema ${o.t.toLowerCase()}`); }); }
function renderGate() {
  const s = AUTH.status;
  const sair = `<button class="btn" data-act="logout">${I.out} Sair</button>`;
  if (s === 'loading') return gate('<p class="muted">Carregando…</p>');
  if (s === 'noConfig') return gate(`<h2>Sistema ainda não conectado</h2><p>Este endereço não encontrou a configuração do Firebase. Publique pelo Firebase Hosting (veja o README do projeto).</p><a class="btn" href="?demo">Abrir a demonstração</a>`);
  if (s === 'signedOut') {
    // Todo mundo entra direto nos módulos que tem (Operação, Gestão, Segurança, RH, Administração).
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
  if (s === 'semAcesso') return gate(`<h2>Sem acesso</h2><p>O usuário <b>${esc(AUTH.user.login || AUTH.user.nome || '')}</b> ainda não tem acesso a nenhum módulo. Fale com o administrador do sistema.</p><button class="btn pri" data-act="trocarAcesso">Entrar com outro usuário</button>`);
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
export function render() {
  const view = $('view');
  const k = AUTH.status === 'ready' ? `${UI.modulo}|${UI.view}|${(UI.g && UI.g.mat) || ''}` : '';
  const nav = k !== ULT || !!view.querySelector('.skel');
  const pos = nav ? null : M.guardarRolagem(view);
  VIEW_MUDOU = false;
  if (nav && AUTH.status === 'ready') M.prepararEntrada(view);
  renderTela();
  if (AUTH.status !== 'ready') { ULT = ''; M.cancelarEntrada(view); return; }
  ULT = k;
  if (nav && view.querySelector('.skel')) M.cancelarEntrada(view);
  if (nav && !view.querySelector('.skel')) M.entrarTela(view); else if (!nav && VIEW_MUDOU) { M.semRepetir(view); M.restaurarRolagem(view, pos); }
  M.moverIndicador();
  if (UI.flash && Date.now() - UI.flash.t > 500) UI.flash = null;
  if (UI.flash) {
    const f = UI.flash; // vale por meio segundo: a atualização de dados que chega logo depois redesenha a tela
    M.pulsar(view.querySelector(`[data-cell="${CSS.escape(f.id + '|' + f.i + '|' + f.k)}"]`));
    const ap = view.querySelector(`[data-ap^="${f.i}|${f.k}|"]`); if (ap) M.pulsar(ap.closest('.act'));
  }
}
// Telas de cada arquivo carregado sob demanda: Equipamentos (EQ), fichas (GE) e Frequência (AD).
const EQ_VIEWS = ['elanc', 'eequipe', 'einsp', 'eaval', 'eanal', 'epainel', 'econfig'];
const GE_VIEWS = ['gcolab', 'gimpr', 'gpainel', 'gtipos', 'gimport'];
const CF_VIEWS = ['cfgeral', 'cfconf', 'cfuso', 'cferros', 'cflimpa', 'cfescala', 'cffotos', 'cfarqfotos', 'usuarios', 'perfis'];
function renderTela() {
  if (AUTH.status !== 'ready') return renderGate();
  $('gate').hidden = true; $('shell').hidden = false;
  { const antes = UI.modulo + '|' + UI.view; ensureModulo(); if (antes !== UI.modulo + '|' + UI.view && !TV) gravarUI(); } // levou para outro lugar: guarda no aparelho
  aplicarSet(); rebuild();
  if (TV) { renderTV(); return; }
  // Administração: férias completas e a folha da competência (Conferência) chegam ao abrir o módulo, sem recarregar.
  if (UI.modulo === 'administracao' && DB.iniciarAdministracao) DB.iniciarAdministracao();
  const v = UI.view;
  const tela = html => { renderNav(); renderTop(); pintar('view', html); afterRender(); };
  if (v === 'meudia') return tela(MD.view());
  if (SG_VIEWS.includes(v)) return tela(comModulo('SG', m => m.render(v)));
  if (v === 'tvmodo') return tela(vModoTV());
  if (UI.modulo === 'rh') return tela(v === 'fpainel' ? comModulo('AD', m => m.painel()) : v === 'fresumo' ? vResumoOutro() : comModulo('AD', m => m.render(v)));
  if (GE_VIEWS.includes(v)) return tela(comModulo('GE', m => m.render(v)));
  if (EQ_VIEWS.includes(v)) return tela(comModulo('EQ', m => m.render(v)));
  if (CF_VIEWS.includes(v)) return tela(vConfigModulo(v));
  if (v === 'resumo' && !['ativ', 'he'].includes(resTipo())) return tela(vResumoOutro());
  // Atividades (Pátio ou Bateria): Operação, Gestão e as configurações de rotas, plano e gerador.
  if (!DB.cache.configLoaded) { pintarTopo('Carregando…', ''); pintar('view', M.ESQUELETO); renderNav(); return; }
  if (!DB.cache.config) { renderNav(); pintarTopo('Primeiro acesso', 'Importar os dados da planilha'); pintar('view', vImportar()); return; }
  ensurePeriod();
  renderNav(); renderTop();
  const needWeeks = ['painel', 'prog', 'apontar', 'aprovar', 'esdia', 'esdim', 'esbal', 'imprimir', 'causas', 'resumo', 'eshe', 'esjus'].includes(v);
  if (needWeeks && !DB.cache.monthsLoaded.has(UI.mes)) { pintar('view', M.ESQUELETO); return; }
  const fn = { painel: vPainel, prog: vProg, apontar: vApontar, aprovar: vAprovar, pend: vPend, imprimir: vImprimir, causas: vCausas, resumo: vResumo, etiquetas: vEtiquetas, eshe: vEsHe, esjus: vEsJus, plano: vPlano, gerador: vGerador, config: vConfig, esdia: vEsDia, esdim: vEsDim, esbal: vEsBal }[v];
  pintar('view', fn ? fn() : MD.view());
  afterRender();
}
// Modo TV: tela cheia para a sala de controle, numa janela nova (o link pode ficar salvo na TV).
function vModoTV() {
  const url = `?tv${DEMO ? '&demo' : ''}`;
  return `<div class="card"><header><h2>Modo TV</h2><p>Tela cheia para a sala de controle: as cenas (hoje, rotas, semana, efetivo, equipamentos, atenção e causas) se revezam sozinhas.</p></header><div class="body stackcol">
    <p class="muted small m0">Abra numa janela nova e deixe na TV. Dentro do Modo TV, a engrenagem escolhe as cenas, a área e o tempo de cada cena, e copia o link já configurado.</p>
    <div class="row-gap"><a class="btn pri" href="${url}" target="_blank" rel="noopener">${I.tv} Abrir o Modo TV</a></div></div></div>`;
}
let raf = 0;
// Atualizações de dados chegam em rajadas (várias coleções de uma vez): junta tudo num só desenho.
export const schedule = () => { if (raf) return; raf = setTimeout(() => requestAnimationFrame(() => { raf = 0; const a = document.activeElement; const keep = a && a.id && a.matches('input[type=search],input[type=text],input:not([type])') ? [a.id, a.selectionStart] : null; render(); if (keep) { const n = $(keep[0]); if (n && document.activeElement !== n) { n.focus(); try { n.setSelectionRange(keep[1], keep[1]); } catch (e) { /* ignora */ } } } }), 40); };

function renderNav() {
  const op = UI.modulo === 'operacao', ge = UI.modulo === 'gestao';
  const ativOp = op && setsDe(ME, 'operacao').length > 0 && !!DB.cache.config;
  // Selo de Pendências: atrasadas dos últimos 60 dias na área da pessoa (a mesma janela de Pendências e do Meu dia).
  const atr = ativOp ? atrasadasAll(myArea() || 'TODAS').length : 0;
  // selos aparecem quando a tela do módulo já chegou: fichas (Gestão) e paradas (Operação)
  const gb = ge ? (temFichas(ME) && GE ? GE.badge() : 0) : op && temEquipEm(ME, 'operacao') && EQ ? EQ.badge() : 0;
  const apv = ativOp && aprovador() ? listaAprov(areasAprov()).length : 0;
  const ms = modsMenu();
  const cur = MODS[UI.modulo];
  const linha = (m, atual) => `<span class="mi">${MOD_IC[m]}</span><span class="mt"><b>${MODS[m].nome}</b><small>${atual ? MODS[m].sub : subMod(m)}</small></span>`; // no botão: o conjunto aberto; na lista: a área inteira
  let h = `<div class="modpick${UI.modOpen ? ' aberto' : ''}">
    <button class="modbtn" ${ms.length > 1 ? `data-modmenu="1" aria-haspopup="menu" aria-expanded="${!!UI.modOpen}" aria-label="Módulo atual: ${cur.nome}. Trocar de módulo"` : 'tabindex="-1" aria-disabled="true"'}>${linha(UI.modulo, true)}${ms.length > 1 ? `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4"/></svg>` : ''}</button>
    ${ms.length > 1 ? `<div class="modmenu" role="menu" aria-label="Módulos">${ms.map(m => `<button role="menuitemradio" aria-checked="${mesmoItem(UI.modulo, m)}" data-mod="${m}">${linha(m)}${mesmoItem(UI.modulo, m) ? '<svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</button>`).join('')}</div>` : ''}
  </div>`, g = '';
  const pai = abaMarcada(UI.view); // aba aberta por botão (Folha do líder, Etiquetas) ou junta (Indicadores): marca o item do menu
  for (const v of abasDoMenu()) {
    if (v.grp !== g) { g = v.grp; h += `<div class="grp">${g}</div>`; }
    const badge = v.id === 'pend' && atr ? atr : v.id === 'aprovar' && apv ? apv : (v.id === 'gcolab' || v.id === 'elanc') && gb ? gb : 0;
    h += `<button data-go="${v.id}" ${UI.view === v.id || pai === v.id ? 'aria-current="page"' : ''}${nomeCurto(v) !== v.nome ? ` title="${esc(v.nome)}"` : ''}>${I[v.ic]}<span>${nomeCurto(v)}</span>${badge ? `<span class="badge num" title="${v.id === 'pend' ? 'Atrasadas nos últimos 7 dias' : v.id === 'aprovar' ? 'Aguardando aprovação' : ''}">${badge > 99 ? '99+' : badge}</span>` : ''}</button>`;
  }
  pintar('nav', h);
  pintar('who', DEMO
    ? `${mockSwitcher()}<div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div><button class="btn rail-btn" data-act="mockReset">Restaurar demonstração</button>`
    : `<div class="me"><span class="av">${esc((ME.nome || '?')[0].toUpperCase())}</span><div><b>${esc(title(ME.nome || ME.login || ''))}</b><small>${ME.login ? esc(ME.login) + ' · ' : ''}${papelNome(ME.papel)}${ME.area ? ' · ' + AREA_S[ME.area] : ''}</small></div></div><div class="row-gap"><button class="btn rail-btn" data-act="senha">${I.key} Alterar senha</button><button class="btn rail-btn" data-act="logout">${I.out} Sair</button></div>`);
  { const w = $('who'); if (w && !w.querySelector('[data-act="tema"]')) { const t = temaAtual(); w.insertAdjacentHTML('beforeend', `<button class="btn rail-btn temab" data-act="tema" title="Trocar o tema da tela">${IC_TEMA[t]} Tema: ${TEMAS[t].toLowerCase()}</button>`); } }
  // Atalho para o Painel Coqueria (site próprio, mesmo login): só para o administrador.
  { const w = $('who'); if (w && !w.querySelector('[data-painel]') && isAdmin()) w.insertAdjacentHTML('afterbegin', `<a class="btn rail-btn" data-painel href="${PAINEL_URL}" target="_blank" rel="noopener">${I.painel} Meu painel</a>`); }
  const tb = barraDe();
  pintarBarra(tb, atr, gb, apv);
}
function pintarBarra(tb, atr, gb, apv = 0) {
  const pai = abaMarcada(UI.view);
  const aqui = id => UI.view === id || pai === id;
  const inMore = !tb.some(x => aqui(x[0]));
  const moreBadge = (tb.some(x => x[0] === 'pend') ? 0 : atr) + (tb.some(x => x[0] === 'aprovar') ? 0 : apv);
  const rot = (id, n) => (id === '__more' ? n : nomeCurto(VIEWS.find(v => v.id === id)) || n);
  pintar('tabbar', tb.map(([id, n, ic]) => `<button data-go="${id}" class="${(id === 'apontar' || id === 'elanc') && ME && perfil('operacao') !== 'leitor' ? 'big' : ''}" ${(aqui(id) || (id === '__more' && inMore)) ? 'aria-current="page"' : ''}><span class="ic">${I[ic]}</span>${rot(id, n)}${id === '__more' && moreBadge ? `<span class="badge">${moreBadge > 99 ? '99+' : moreBadge}</span>` : ''}${(id === 'elanc' || id === 'gcolab') && gb ? `<span class="badge">${gb}</span>` : ''}${id === 'aprovar' && apv ? `<span class="badge">${apv > 99 ? '99+' : apv}</span>` : ''}${id === 'pend' && atr ? `<span class="badge">${atr > 99 ? '99+' : atr}</span>` : ''}</button>`).join(''));
}
export function syncPill() {
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
function filtroCompacto() {
  const area = ['apontar', 'imprimir'].includes(UI.view) ? '' : myArea() ? (myAreas().length > 1 ? AREA_S[myArea()] : '') : (UI.area === 'TODAS' ? 'Todas as áreas' : AREA_S[UI.area]);
  const partes = [UI.view === 'etiquetas' ? '' : ['causas', 'eshe', 'esjus'].includes(UI.view) ? monthLabel(UI.mes) : semanaCurta(UI.ini), area].filter(Boolean);
  return `<button type="button" class="fcomp" data-act="filtros" aria-label="Filtros: ${esc(partes.join(', '))}. Tocar para mudar"><span>${esc(partes.join(' · '))}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
export function filtroSheet() {
  const L = $('layer');
  const corpo = () => `${periodControls({ area: !['apontar', 'imprimir'].includes(UI.view), semana: !['causas', 'etiquetas', 'eshe', 'esjus'].includes(UI.view), mes: UI.view !== 'etiquetas' })}`;
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
  for (const m of modsMenu()) if (!mesmoItem(m, UI.modulo)) out.push({ t: MODS[m].nome, d: `Módulo · ${subMod(m)}`, k: 'tela', ir: () => { trocarModulo(m); } });
  if (UI.modulo === 'rh') { // RH: pessoas das folhas de frequência e das férias
    const vistos = new Set(); const A = DB.cache.adm || {};
    for (const f of A.ferias || []) { const k = f.mat || f.nome; if (vistos.has(k)) continue; vistos.add(k); out.push({ t: title(f.nome), d: `Férias · ${f.setor || ''}${f.mat ? ' · matrícula ' + f.mat : ''}`, k: 'pessoa', ir: () => { UI.view = 'aferias'; if (UI.a) { UI.a.fQ = f.nome; UI.a.fAba = 'todas'; } } }); }
    for (const [id, c] of Object.entries(A.comps || {})) if (c) for (const g of c.grupos || []) for (const p of g.pessoas) { const k = p.mat || p.nome; if (vistos.has('f' + k)) continue; vistos.add('f' + k); out.push({ t: title(p.nome), d: `Frequência · ${id.startsWith('bateria') ? 'Bateria' : 'Pátio'} · ${g.nome}`, k: 'pessoa', ir: () => { UI.view = 'afreq'; if (UI.a) { UI.a.conj = id.split('|')[0]; UI.a.q = p.nome; } } }); }
  }
  for (const k of setsDe(ME)) {
    const st = DB.dados(k); const opk = setsDe(ME, 'operacao').includes(k); if (!st || !st.config) continue;
    for (const r of st.config.rotas || []) if (opk && r.carga > 0 && (!myAreas('operacao').length || myAreas('operacao').includes(r.area))) out.push({ t: r.rota, d: `Rota · ${SETS[k].curto} · ${AREA_S[r.area]}`, k: 'rota', ir: () => { UI.modulo = 'operacao'; UI.esSet = k; UI.view = 'apontar'; UI.area = r.area; UI.aRota = r.rota; } });
    for (const a of Object.keys(st.colabs || {})) for (const c of st.colabs[a]) if (opk) out.push({ t: title(c.nome), d: `Presença · ${SETS[k].curto} · ${AREA_S[c.area] || c.area} · ${c.rota}`, k: 'pessoa', ir: () => { UI.modulo = 'operacao'; UI.view = 'esdia'; UI.esSet = k; UI.eRota = '*'; UI.eQ = title(c.nome); } });
  }
  if (temFichas(ME)) for (const c of (DB.cache.g && DB.cache.g.colabs) || []) out.push({ t: title(c.nome), d: `Ficha · matrícula ${c.mat}`, k: 'pessoa', ir: () => { UI.modulo = 'gestao'; UI.view = 'gcolab'; if (UI.g) UI.g.mat = c.mat; else UI.g = { mat: c.mat }; } });
  if (temEquipEm(ME, 'operacao') && DB.cache.e && DB.cache.e.cad) {
    for (const f of DB.cache.e.cad.frota || []) out.push({ t: f.id, d: `Equipamento · ${title(f.tipo || '')}`, k: 'eq', ir: () => { UI.modulo = 'operacao'; UI.view = 'eequipe'; } });
    for (const o of DB.cache.e.cad.operadores || []) out.push({ t: title(o.nome), d: `Operador · ${title(o.funcao || '')}`, k: 'pessoa', ir: () => { UI.modulo = 'operacao'; UI.view = 'eequipe'; } });
  }
  return out.map(x => ({ ...x, n: semAcento(x.t + ' ' + x.d).toLowerCase() }));
}
export function abrirBusca() {
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
  const abrir = i => { const x = res[i]; if (!x) return; fechar(); UI.confirm = null; UI.modOpen = false; x.ir(); ensureModulo(); aplicarSet(); salvarUI(); trocarTela(UI.view); };
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim') return fechar(); const b = e.target.closest('[data-bq]'); if (b) abrir(+b.dataset.bq); };
  $('bqIn').oninput = () => { sel = 0; pintarRes(); };
  $('bqIn').onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); pintarRes(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); pintarRes(); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(sel); }
  };
  pintarRes(); $('bqIn').focus();
}
const BUSCA_BTN = '<button type="button" class="btn ghost buscabtn" data-act="busca" aria-label="Buscar pessoa, equipamento, rota ou tela (Ctrl+K)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><span>Buscar</span><kbd>Ctrl K</kbd></button>';
// Etiqueta do módulo no topo do celular: mostra em que módulo a pessoa está e abre a troca de módulo.
function modTag() {
  const cur = MODS[UI.modulo]; if (!cur || !ME) return '';
  const pode = modsMenu().length > 1;
  return `<button type="button" class="modtag" ${pode ? 'data-act="modsheet" aria-haspopup="dialog"' : 'aria-disabled="true" tabindex="-1"'} aria-label="Módulo: ${esc(cur.nome)}${pode ? '. Tocar para trocar de módulo' : ''}"><span class="mi">${MOD_IC[UI.modulo] || ''}</span><b>${esc(cur.curto)}</b><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>`;
}
export function modSheet() {
  const ms = modsMenu();
  const ok = '<svg class="ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  sheet('Trocar de módulo', '', ms.map(m => ({ t: MODS[m].nome, d: subMod(m), m, cur: mesmoItem(m, UI.modulo), cls: 'mod', ic: `<span class="mi">${MOD_IC[m] || ''}</span>`, fim: mesmoItem(m, UI.modulo) ? ok : '' })), o => { if (!mesmoItem(o.m, UI.modulo)) trocarModulo(o.m); });
}
// Topo: só título (1 linha), subtítulo (1 linha), Buscar e conexão. Os filtros vão para a barra logo abaixo (#fbarra).
function pintarTopo(titulo, sub, filtros = '') {
  pintar('top', `${modTag()}<h1>${titulo}${sub ? `<small>${sub}</small>` : ''}</h1>${BUSCA_BTN}<div class="syncwrap" id="sync">${syncPill()}</div>`);
  pintar('fbarra', filtros);
}
const SUB_ADM = { cfgeral: 'Ajustes de todos os módulos, num lugar só', cfconf: 'O que falta acertar no cadastro das pessoas', cfuso: 'Quanto do plano grátis do banco está sendo usado', cferros: 'Falhas do sistema nos celulares e computadores de quem usa', cflimpa: 'Apagar dados antigos, com prévia e cópia de segurança', cffotos: 'Foto obrigatória no Apontar: mínimo, máximo e situações', cfarqfotos: 'Relatório em PowerPoint, exportação em .zip e lixeira das fotos', cfescala: 'Regimes, turmas e feriados: a folga é marcada sozinha pela escala', usuarios: 'Quem acessa o sistema e o perfil em cada módulo', perfis: 'Quais abas cada perfil vê e o que pode fazer, em cada módulo' };
function renderTop() {
  const v = VIEWS.find(x => x.id === UI.view) || VIEWS[0];
  if (UI.modulo === 'administracao') {
    const sub = { ...SUB_ADM, config: `Efetivo padrão, carga e listas · ${SETS[SK].nome}`, plano: `Modelo semanal usado pelo gerador · ${SETS[SK].nome}`, gerador: `Cria as semanas do mês a partir do plano padrão · ${SETS[SK].nome}`, econfig: SUB_E.econfig, gtipos: SUB_G.gtipos, gimport: SUB_G.gimport, sgconfig: SUB_S.sgconfig }[v.id] || '';
    const sw = ['config', 'plano', 'gerador'].includes(v.id) && setsDe(ME).length > 1 ? `<div class="seg setsw" role="tablist" aria-label="Conjunto">${setsDe(ME).map(k => `<button type="button" role="tab" data-cfset="${k}" aria-selected="${SK === k}">${SETS[k].curto}</button>`).join('')}</div>` : '';
    pintarTopo(v.nome, sub, sw); return;
  }
  if (v.id === 'meudia') { pintarTopo(v.nome, 'O que é seu hoje, em todos os módulos'); return; }
  if (SUB_S[v.id]) { pintarTopo(v.nome, SUB_S[v.id]); return; }
  if (v.id === 'tvmodo') { pintarTopo(v.nome, 'Indicadores na tela da sala de controle'); return; }
  if (v.id === 'fpainel') { pintarTopo(v.nome, 'Presença, ocorrências e férias da folha de 16 a 15', AD ? AD.topo('fpainel') : ''); return; }
  if (v.id === 'fresumo' || (v.id === 'resumo' && !['ativ', 'he'].includes(resTipo()))) { pintarTopo(v.nome, `${resTipo() === 'oper' ? 'Equipamentos' : 'Frequência'} · pronto para imprimir`, resTipo() === 'freq' && setsDe(ME).length !== 1 ? `<div class="seg setsw" role="tablist" aria-label="Conjunto">${['patio', 'bateria'].map(k => `<button type="button" role="tab" data-rconj="${k}" aria-selected="${rConj() === k}">${SETS[k].curto}</button>`).join('')}</div>` : ''); return; }
  if (UI.modulo === 'rh') { pintarTopo(v.nome, SUB_A[v.id] || '', AD ? AD.topo(v.id) : ''); return; }
  if (SUB_G[v.id] || SUB_E[v.id]) { pintarTopo(v.nome, SUB_G[v.id] || SUB_E[v.id], seletorJuntas(v) + atalhosDe(v)); return; }
  const sub = { esjus: 'Faltas, atrasos e atestados do mês: o que já foi justificado e o que falta', painel: 'Produtividade do período', prog: 'Programado × realizado por atividade', apontar: 'Marque o que foi feito no dia', aprovar: 'Confira e aprove o que os líderes apontaram', causas: 'Por que as atividades não foram feitas, e o que está sendo feito', resumo: 'O dia ou a semana numa página, pronta para imprimir ou salvar em PDF', etiquetas: 'Cole no local: o líder aponta a câmera e abre a rota no Apontar', eshe: `Início, fim e horas de cada hora extra · ${SETS[SK].nome}`, pend: 'Atividades sem apontamento em dias que já passaram', imprimir: 'Folha semanal para marcação em campo', esdia: `Presença de cada pessoa, dia a dia · ${SETS[SK].nome}`, esdim: `Disponíveis × necessários por rota · ${SETS[SK].nome}`, esbal: `Quem está fora e o saldo da semana · ${SETS[SK].nome}` }[UI.view] || '';
  let ctr = '';
  const comFiltro = ['painel', 'prog', 'esdia', 'esdim', 'esbal', 'imprimir', 'apontar', 'causas', 'resumo', 'etiquetas', 'eshe', 'esjus'].includes(UI.view);
  if (comFiltro && isMobile()) ctr = `<div class="fbar">${filtroCompacto()}</div>`;
  else if (comFiltro) ctr = periodControls({ area: !['apontar', 'imprimir'].includes(UI.view), semana: !['causas', 'etiquetas', 'eshe', 'esjus'].includes(UI.view), mes: UI.view !== 'etiquetas' });
  // Seletor Pátio | Bateria (quem tem os dois conjuntos), também no celular: troca o conjunto e fica na mesma aba.
  const ss = setsDe(ME, UI.modulo);
  if (SET_VIEWS.includes(v.id) && (v.id !== 'resumo' || ['ativ', 'he'].includes(resTipo())) && ss.length > 1) ctr = `<div class="seg setsw" role="tablist" aria-label="Conjunto de atividades">${ss.map(k => `<button type="button" role="tab" data-atset="${k}" aria-selected="${SK === k}">${SETS[k].curto}</button>`).join('')}</div>` + ctr;
  pintarTopo(v.nome, sub, seletorJuntas(v) + ctr + atalhosDe(v));
}
// Abas juntas (Indicadores): Atividades | Equipamentos | Fichas no topo, só com as que a pessoa vê.
function seletorJuntas(v) {
  const l = juntasDe(v); if (!l.length) return '';
  return `<div class="seg indsw" role="tablist" aria-label="Indicadores de">${l.map(x => `<button type="button" role="tab" data-go="${x.id}" aria-selected="${x.id === v.id}">${NOME_JUNTO[x.id] || nomeCurto(x)}</button>`).join('')}</div>`;
}
// Abas fora do menu abrem por botões no topo da aba pai; nelas, um botão volta para a aba pai.
// Programação: Folha do líder e Etiquetas QR. Colaboradores: Impressão das fichas.
const ATALHOS = { prog: [['imprimir', 'Folha do líder', 'print'], ['etiquetas', 'Etiquetas QR', 'qr']], gcolab: [['gimpr', 'Impressão das fichas', 'print']] };
const VOLTA = { prog: ['Programação', 'prog'], gcolab: ['Colaboradores', 'users'] };
function atalhosDe(v) {
  if (UI.modulo !== 'gestao') return '';
  const vs = viewsDoModulo(), tem = id => vs.some(x => x.id === id);
  const bt = ATALHOS[v.id] ? ATALHOS[v.id].filter(([id]) => tem(id)) : VOLTA[v.pai] && tem(v.pai) ? [[v.pai, ...VOLTA[v.pai]]] : [];
  return bt.length ? `<div class="row-gap atalhos">${bt.map(([id, n, ic]) => `<button type="button" class="btn sm" data-go="${id}">${I[ic] || ''} ${n}</button>`).join('')}</div>` : '';
}

// Tela estreita (celular): filtros compactos, barra de baixo.
export const isMobile = () => matchMedia('(max-width:860px)').matches;
export function alterarSenhaSheet() {
  formSheet('Alterar minha senha', esc(ME.login || ''), senhaField('asAtual', 'Senha atual', 'current-password') + senhaField('asNova', 'Nova senha (mínimo 8 caracteres, sem o seu nome)', 'new-password') + senhaField('asNova2', 'Repita a nova senha', 'new-password'), 'Salvar', async () => {
    const a = $('asAtual').value, n = $('asNova').value, n2 = $('asNova2').value;
    { const p = problemaSenha(n); if (p) throw new Error(p); }
    if (n !== n2) throw new Error('As duas senhas novas não são iguais.');
    await DB.alterarSenha(a, n); toast('Senha alterada');
  });
}
// Redesenha no quadro seguinte (o toque é respondido antes); vários toques seguidos viram um desenho só.
let logoRaf = 0;
export function desenharLogo() { if (logoRaf) return; logoRaf = requestAnimationFrame(() => { logoRaf = requestAnimationFrame(() => { logoRaf = 0; render(); }); }); }
// Mede o cabeçalho sem forçar o navegador a recalcular a página a cada desenho (era o passo mais lento de cada toque).
let topoRO = null;
let topoV = '';
const topoCss = document.head.appendChild(document.createElement('style'));
export function medirTopo() {
  const t = document.querySelector('.top'); if (!t) return;
  const pos = h => { const v = Math.round(h) + 'px'; if (v === topoV) return; topoV = v; topoCss.textContent = `.apbar{top:${v}}`; }; // regra só da .apbar: não refaz o estilo da página inteira
  if (!('ResizeObserver' in window)) return pos(t.offsetHeight);
  if (topoRO && topoRO._t === t) return;
  if (topoRO) topoRO.disconnect();
  topoRO = new ResizeObserver(es => { const b = es[0].borderBoxSize && es[0].borderBoxSize[0]; pos(b ? b.blockSize : t.offsetHeight); });
  topoRO._t = t; topoRO.observe(t);
}
function afterRender() {
  medirTopo();
  M.ajustarFaixas($('view'));
  // Fitas que deslizam de lado (áreas e rotas no Apontar): rolam até o botão escolhido, que antes podia ficar fora da tela.
  document.querySelectorAll('#view .rchips.linha').forEach(f => { const a = f.querySelector('[aria-pressed="true"]'); if (!a || f.scrollWidth <= f.clientWidth) return; const fr = f.getBoundingClientRect(), ar = a.getBoundingClientRect(); if (ar.left < fr.left || ar.right > fr.right) f.scrollLeft += ar.left + ar.width / 2 - (fr.left + fr.width / 2); });
  const on = (id, ev, fn) => { const e = $(id); if (e && !e['_on_' + ev]) { e['_on_' + ev] = 1; e.addEventListener(ev, fn); } };
  on('fMes', 'change', e => mudarFiltro('fMes', e.target.value));
  on('fSem', 'change', e => mudarFiltro('fSem', e.target.value));
  on('fArea', 'change', e => mudarFiltro('fArea', e.target.value));
  on('fRota', 'change', e => { UI.rota = e.target.value; UI.more = 0; render(); });
  on('fTipo', 'change', e => { UI.tipo = e.target.value; render(); });
  on('fPend', 'change', e => { UI.soPend = e.target.checked; render(); });
  on('heSemH', 'change', e => { UI.heSemH = e.target.checked; UI.heMais = 0; render(); });
  on('fQ', 'input', e => { UI.q = e.target.value; clearTimeout(window._qt); window._qt = setTimeout(schedule, 250); });
  on('escQ', 'input', e => { UI.escQ = e.target.value; filtrarLista($('escLista'), e.target.value); });
  on('fEQ', 'input', e => { UI.eQ = e.target.value; clearTimeout(window._eqt); window._eqt = setTimeout(schedule, 180); });
  on('fERota', 'change', e => { UI.eRota = e.target.value; render(); });
  on('fEAgr', 'change', e => { UI.eAgr = e.target.value; UI.efAbertas = []; render(); });
  on('fIRota', 'change', e => { UI.iRota = e.target.value; render(); });
  on('fLider', 'input', e => { UI.lider = e.target.value; document.querySelectorAll('.liderTxt').forEach(t => { t.innerHTML = '<b>Líder responsável:</b> ' + esc(UI.lider); }); });
  on('fJusRota', 'change', e => { UI.jusRota = e.target.value; UI.more = 0; render(); });
  on('fPArea', 'change', e => { UI.pArea = e.target.value; UI.pRota = ''; UI.more = 0; render(); });
  on('fPRota', 'change', e => { UI.pRota = e.target.value; UI.more = 0; render(); });
  on('fPQ', 'input', e => { UI.pQ = e.target.value; UI.more = 0; clearTimeout(window._pqt); window._pqt = setTimeout(schedule, 180); });
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
    itens.push(p); DB.cache.plano[a] = itens; DB.savePlano(a, itens); DB.log(`Plano padrão: nova atividade ${p.id} · ${p.ativ}`); toast(`${p.id} adicionada ao plano`); render(); import('../telas/plano-prog.js').then(m => m.planoNaProgramacao(p));
  });
}

// Troca de tela em dois tempos: o toque responde na hora (item do menu marcado, tela atual esmaece)
// e a tela nova é desenhada no quadro seguinte. Assim o celular não parece travado enquanto monta a tela.
let trocaRaf = 0;
export function trocarTela(id = UI.view) {
  const pai = abaMarcada(id); // Folha do líder e Etiquetas marcam a Programação; Indicadores, o item do menu
  document.querySelectorAll('#nav [data-go], #tabbar [data-go]').forEach(b => { if (b.dataset.go === id || b.dataset.go === pai) b.setAttribute('aria-current', 'page'); else if (b.dataset.go !== '__more') b.removeAttribute('aria-current'); });
  M.moverIndicador();
  const v = $('view'); if (v) v.classList.add('saindo');
  cancelAnimationFrame(trocaRaf);
  trocaRaf = requestAnimationFrame(() => { trocaRaf = requestAnimationFrame(() => { trocaRaf = 0; if (v) v.classList.remove('saindo'); render(); scrollTo(0, 0); }); });
}
