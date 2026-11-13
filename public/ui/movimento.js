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
// prepararEntrada vem ANTES de desenhar: a classe e o conteúdo novo são calculados juntos, num passe só.
export function prepararEntrada(view) {
  if (reduzir()) return;
  clearTimeout(view._entra); view.classList.add('entra', 'barras');
}
export function entrarTela(view) {
  if (reduzir()) return;
  if (!view.classList.contains('entra')) view.classList.add('entra', 'barras');
  clearTimeout(view._entra); view._entra = setTimeout(() => view.classList.remove('entra', 'barras'), 650);
  contarNumeros(view);
}
export function cancelarEntrada(view) { clearTimeout(view._entra); view.classList.remove('entra', 'barras'); }

// Números dos indicadores sobem de zero até o valor (formato brasileiro: 1.182 · 94,3% · 1,63).
function contarNumeros(root) {
  const els = [...root.querySelectorAll('.kpi .v, .mini b, .kpi2 .v')].slice(0, 10); // só os primeiros: cada número mexendo pede um novo cálculo da tela
  els.forEach(el => {
    if (el.children.length) return;
    const t = el.textContent.trim(); const m = t.match(/^([^\d-]*)(-?[\d.]*\d(?:,\d+)?)(.*)$/);
    if (!m) return;
    const bruto = m[2]; const dec = (bruto.split(',')[1] || '').length; const alvo = parseFloat(bruto.replace(/\./g, '').replace(',', '.'));
    if (!isFinite(alvo) || alvo === 0) return;
    const fmt = v => m[1] + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
    const t0 = performance.now(), dur = 420;
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
// ---------- mantém o campo com o cursor (e a rolagem da página) quando a tela é redesenhada ----------
// Sem isto, depois de salvar um campo o cursor sumia e o próximo Tab (ou "próximo" no teclado do celular) levava ao topo.
// O campo é achado de novo pelo id ou pelos atributos data-* (ex.: data-rcfg="3|ef").
const CAMPOS = 'input,select,textarea,button';
export function guardarFoco(view) {
  const a = document.activeElement;
  if (!a || a === document.body || !view.contains(a) || !a.matches(CAMPOS)) return null;
  // Seletor do campo: id; senão os data-*; senão a posição entre os campos da tela. k = qual deles, se houver vários iguais.
  let sel = CAMPOS;
  if (a.id) sel = '#' + CSS.escape(a.id);
  else {
    const ds = [...a.attributes].filter(x => x.name.startsWith('data-'));
    if (ds.length) sel = a.tagName.toLowerCase() + ds.map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
  }
  let k = 0; try { k = [...view.querySelectorAll(sel)].indexOf(a); } catch (e) { return null; }
  let pos = null; try { pos = [a.selectionStart, a.selectionEnd]; } catch (e) { /* campo sem cursor (número, lista) */ }
  return { sel, k: Math.max(0, k), pos, y: scrollY };
}
export function restaurarFoco(view, f) {
  if (!f) return;
  const a = document.activeElement;
  if (a && a !== document.body && view.contains(a)) return; // o foco já está num campo da tela
  let n = null; try { n = view.querySelectorAll(f.sel)[f.k]; } catch (e) { return; }
  if (!n || n.disabled) return;
  n.focus({ preventScroll: true });
  if (f.pos && f.pos[0] != null) { try { n.setSelectionRange(f.pos[0], f.pos[1]); } catch (e) { /* ignora */ } }
  if (scrollY !== f.y) scrollTo(scrollX, f.y);
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

// ---------- faixa de indicadores: um componente só em todas as telas ----------
// faixa([{ r: 'Rótulo', v: 12, s: 'linha de apoio', tom: 'ok' | 'warn' | 'bad' | 'ext' }]) monta a faixa (o estado vai só na cor do número).
// ajustarFaixas(raiz) roda depois de cada desenho, em .kpis, .mini e .kpis5: deixa no máximo 6 indicadores à vista
// (os outros ficam em "Ver mais") e, no celular (2 colunas), faz o último ocupar a linha inteira quando sobra um.
const TOM = { ok: 'var(--st-real)', warn: 'var(--st-atr)', bad: 'var(--st-nreal)', ext: 'var(--st-extra)' };
export const faixa = (itens, cls = '') => `<div class="mini${cls ? ' ' + cls : ''}">${itens.filter(Boolean).map(x => `<div${x.t ? ` title="${x.t}"` : ''}><b class="num"${TOM[x.tom] ? ` style="color:${TOM[x.tom]}"` : ''}>${x.v}</b><span>${x.r}</span>${x.s ? `<small>${x.s}</small>` : ''}</div>`).join('')}</div>`;
const MAX_FAIXA = 6;
const faixasAbertas = new Set();
export function ajustarFaixas(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('.kpis,.mini,.kpis5').forEach(f => {
    const its = [...f.children].filter(x => !x.classList.contains('kmais'));
    const chave = its.length + '|' + its.slice(0, 3).map(x => ((x.querySelector('span,.lbl') || x).textContent || '').trim()).join('|');
    const aberta = faixasAbertas.has(chave);
    // faixa "compacta" (Efetivo diário): no celular só 4 à vista, para a lista de pessoas subir
    const max = f.classList.contains('compacta') && matchMedia('(max-width:860px)').matches ? 4 : MAX_FAIXA;
    its.forEach((x, i) => x.classList.toggle('k-oculto', !aberta && i >= max));
    let b = f.querySelector(':scope > .kmais');
    if (its.length > max) {
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'kmais'; f.appendChild(b); }
      b.textContent = aberta ? 'Ver menos' : `Ver mais (${its.length - max})`;
      b.setAttribute('aria-expanded', String(aberta));
      b.onclick = ev => { ev.stopPropagation(); if (faixasAbertas.has(chave)) faixasAbertas.delete(chave); else faixasAbertas.add(chave); ajustarFaixas(f.parentNode || raiz); };
    } else if (b) b.remove();
    const vis = its.filter(x => !x.classList.contains('k-oculto'));
    let cel = 0; vis.forEach(x => { x.classList.remove('k-larga'); cel += x.classList.contains('hero') ? 2 : 1; });
    if (cel % 2 && vis.length && !vis[vis.length - 1].classList.contains('hero')) vis[vis.length - 1].classList.add('k-larga');
  });
}

// Esqueleto exibido enquanto os dados chegam.
export const ESQUELETO = '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
