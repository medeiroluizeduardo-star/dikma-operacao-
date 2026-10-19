// Dikma Gestão — movimento e fluidez da interface.
// Tudo aqui responde a uma ação da pessoa (trocar de tela, abrir/fechar janela, marcar um apontamento)
// e é desligado quando o aparelho pede "reduzir movimento".
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- marcador do menu lateral: desliza até o item ativo ----------
let indTop = null;
// mede no quadro seguinte, quando o navegador já calculou a página (não atrasa o toque)
let indRaf = 0;
export function moverIndicador() { cancelAnimationFrame(indRaf); indRaf = requestAnimationFrame(moverAgora); }
function moverAgora() {
  const nav = document.getElementById('nav'); if (!nav) return;
  const rail = nav.closest('.rail'); if (!rail || getComputedStyle(rail).display === 'none') return;
  let ind = rail.querySelector('.nav-ind');
  if (!ind) { ind = document.createElement('span'); ind.className = 'nav-ind'; ind.setAttribute('aria-hidden', 'true'); rail.prepend(ind); }
  const b = nav.querySelector('button[aria-current="page"]');
  if (!b) { ind.style.opacity = '0'; return; }
  const top = b.getBoundingClientRect().top - rail.getBoundingClientRect().top + rail.scrollTop;
  const sem = indTop === null || reduzir();
  if (sem) ind.style.transition = 'none';
  ind.style.opacity = '1';
  ind.style.transform = `translateY(${top}px)`;
  ind.style.height = b.offsetHeight + 'px';
  if (sem) { ind.getBoundingClientRect(); ind.style.transition = ''; }
  indTop = top;
}

// ---------- entrada da tela (só quando a pessoa troca de tela, não quando os dados atualizam) ----------
export function entrarTela(view) {
  if (reduzir()) return;
  // tira e põe a classe no quadro seguinte (sem forçar o recálculo da página na hora do toque)
  view.classList.remove('entra', 'barras'); cancelAnimationFrame(view._raf);
  view._raf = requestAnimationFrame(() => { view.classList.add('entra', 'barras'); clearTimeout(view._entra); view._entra = setTimeout(() => view.classList.remove('entra', 'barras'), 450); });
  contarNumeros(view);
}

// Números dos indicadores sobem de zero até o valor (formato brasileiro: 1.182 · 94,3% · 1,63).
function contarNumeros(root) {
  const els = root.querySelectorAll('.kpi .v, .mini b, .kpi2 .v');
  els.forEach(el => {
    if (el.children.length) return;
    const t = el.textContent.trim(); const m = t.match(/^([^\d-]*)(-?[\d.]*\d(?:,\d+)?)(.*)$/);
    if (!m) return;
    const bruto = m[2]; const dec = (bruto.split(',')[1] || '').length; const alvo = parseFloat(bruto.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(alvo) || alvo === 0) return;
    const fmt = v => m[1] + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
    const t0 = performance.now(), dur = 350;
    const passo = agora => {
      if (!el.isConnected) return;
      const p = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(alvo * e) : t;
      if (p < 1) requestAnimationFrame(passo);
    };
    el.textContent = fmt(0); requestAnimationFrame(passo);
  });
}

// ---------- mantém a rolagem horizontal das tabelas quando os dados atualizam ----------
export function guardarRolagem(view) {
  return [...view.querySelectorAll('.tw')].map(el => [el.scrollLeft, el.scrollTop]);
}
// Dados que chegam logo depois da troca de tela redesenham a tela: as barras não crescem de novo (piscavam).
export function semRepetir(view) { view.classList.remove('barras'); }
export function restaurarRolagem(view, pos) {
  if (!pos || !pos.length) return;
  view.querySelectorAll('.tw').forEach((el, i) => { if (pos[i]) { el.scrollLeft = pos[i][0]; el.scrollTop = pos[i][1]; } });
}

// ---------- confirmação visual de um apontamento ----------
export function pulsar(el) {
  if (!el) return;
  vibrar();
  if (reduzir()) return;
  el.classList.remove('pulsa');
  requestAnimationFrame(() => { el.classList.add('pulsa'); setTimeout(() => el.classList.remove('pulsa'), 600); });
}

// Toque curto de confirmação no celular (Android; no iPhone o navegador não vibra).
let ultVib = 0;
export function vibrar(ms = 10) { if (Date.now() - ultVib < 700) return; ultVib = Date.now(); try { if (navigator.vibrate && matchMedia('(pointer:coarse)').matches) navigator.vibrate(ms); } catch (e) { /* sem vibração */ } }

// ---------- janelas no celular: arrastar para baixo fecha ----------
function arrastarParaFechar() {
  let y0 = null, el = null, dy = 0;
  document.addEventListener('touchstart', e => {
    const sh = e.target.closest && e.target.closest('#layer .sheet'); if (!sh || sh.scrollTop > 0 || e.touches.length !== 1) return;
    if (e.target.closest('input,textarea,select,.cbx-l')) return;
    el = sh; y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 == null || !el) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 4) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 == null || !el) return;
    const sh = el; y0 = null; el = null;
    if (dy > 90) { const sc = document.getElementById('scrim'); if (sc) sc.dispatchEvent(new MouseEvent('click', { bubbles: true })); else sh.style.transform = ''; }
    else { sh.style.transition = 'transform .18s ease'; sh.style.transform = ''; setTimeout(() => { sh.style.transition = ''; }, 200); }
  });
}

// ---------- janelas: fecham com animação, sem mexer em cada tela ----------
// Quando uma janela sai da camada #layer, ela é devolvida por um instante a uma camada "fantasma",
// que toca a saída e some. Se outra janela abre no lugar, a troca é direta.
export function iniciarJanelas() {
  const layer = document.getElementById('layer'); if (!layer) return;
  arrastarParaFechar();
  const ghost = document.createElement('div'); ghost.className = 'layer-ghost'; ghost.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ghost);
  new MutationObserver(ms => {
    if (reduzir()) return;
    const entrou = ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.classList.contains('scrim')));
    if (entrou) { ghost.innerHTML = ''; return; }
    for (const m of ms) for (const n of m.removedNodes) {
      if (n.nodeType !== 1 || !n.classList.contains('scrim')) continue;
      n.removeAttribute('id'); n.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      n.classList.add('sai'); ghost.innerHTML = ''; ghost.appendChild(n);
      setTimeout(() => { if (n.parentNode === ghost) n.remove(); }, 170);
    }
  }).observe(layer, { childList: true });
}

// ---------- barra superior ganha sombra quando a página rola ----------
export function iniciarTopo() {
  let ok = false;
  const f = () => { const t = document.getElementById('top'); if (!t) return; const v = scrollY > 4; if (v !== ok) { ok = v; t.classList.toggle('rolou', v); } };
  addEventListener('scroll', f, { passive: true }); f();
  addEventListener('resize', () => moverIndicador(), { passive: true });
}

// Esqueleto exibido enquanto os dados chegam.
export const ESQUELETO = '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
