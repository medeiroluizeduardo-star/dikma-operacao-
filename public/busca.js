// Dikma Gestão — busca e seleção com digitação (operadores, equipamentos, colaboradores).
// A lista de sugestões abre ABAIXO do campo, dentro da própria janela: nunca cobre o que a pessoa digita.
// Acha por qualquer parte do texto, sem acento: "joao sil", "silva", "25001".
export const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const casa = (chave, q) => { const t = semAcento(q).trim().split(/\s+/).filter(Boolean); return !t.length || t.every(p => chave.includes(p)); };

const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REG = new Map(); // id -> { opcoes: () => [{v, t, d, tag, k}], livre, vazio, aoEscolher }

// Monta o campo. opcoes é uma função (lida de novo a cada busca, para refletir a data escolhida no formulário).
// v = valor gravado · t = texto mostrado · d = detalhe (2ª linha) · tag = html à direita · k = texto extra para a busca
export function campoBusca(id, valor, opcoes, { livre = false, vazio = '', placeholder = 'Digite para buscar', aoEscolher = null, maiusculas = false } = {}) {
  REG.set(id, { opcoes, livre, vazio, aoEscolher, maiusculas });
  const atual = opcoes().find(o => o.v === valor);
  const txt = atual ? atual.t : (valor || '');
  return `<div class="cbx" data-cbx="${id}"><div class="cbx-in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input class="in" id="${id}_q" value="${escH(txt)}" placeholder="${escH(placeholder)}" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="${id}_l" ${maiusculas ? 'style="text-transform:uppercase"' : ''}>${vazio ? `<button type="button" class="cbx-x" data-cbx-limpar="${id}" aria-label="Limpar" ${valor ? '' : 'hidden'}>✕</button>` : ''}</div><input type="hidden" id="${id}" value="${escH(valor || '')}"><div class="cbx-l" id="${id}_l" role="listbox" hidden></div></div>`;
}

function chaveDe(o) { return o._k || (o._k = semAcento([o.t, o.d, o.v, o.k].filter(Boolean).join(' '))); }
function abrir(id, mostrarTudo) {
  const R = REG.get(id); const q = document.getElementById(id + '_q'); const l = document.getElementById(id + '_l'); if (!R || !q || !l) return;
  const texto = mostrarTudo ? '' : q.value;
  const ops = R.opcoes().filter(o => casa(chaveDe(o), texto));
  const lim = ops.slice(0, 60);
  l.innerHTML = (lim.length ? lim.map((o, i) => `<button type="button" class="cbx-o" role="option" data-cbx-v="${escH(o.v)}" data-i="${i}" ${i === 0 ? 'aria-selected="true"' : ''}><span class="minw"><b>${escH(o.t)}</b>${o.d ? `<small>${escH(o.d)}</small>` : ''}</span>${o.tag || ''}</button>`).join('')
    : `<p class="cbx-vz">${R.livre && q.value.trim() ? `Nenhum cadastrado com “${escH(q.value.trim())}”. Enter usa o que foi digitado.` : 'Nada encontrado.'}</p>`) + (ops.length > 60 ? `<p class="cbx-vz">+ ${ops.length - 60} · continue digitando</p>` : '');
  l.hidden = false; q.setAttribute('aria-expanded', 'true');
}
function fechar(id) { const l = document.getElementById(id + '_l'); const q = document.getElementById(id + '_q'); if (l) l.hidden = true; if (q) q.setAttribute('aria-expanded', 'false'); }
function escolher(id, v) {
  const R = REG.get(id); const h = document.getElementById(id); const q = document.getElementById(id + '_q'); if (!R || !h || !q) return;
  const o = R.opcoes().find(x => x.v === v);
  h.value = v; q.value = o ? o.t : v; fechar(id);
  const x = document.querySelector(`[data-cbx-limpar="${id}"]`); if (x) x.hidden = !v;
  h.dispatchEvent(new Event('change', { bubbles: true }));
  if (R.aoEscolher) R.aoEscolher(v, o);
}
// Texto digitado sem escolher da lista: campo livre aceita o texto; senão volta ao que estava escolhido.
function confirmarTexto(id) {
  const R = REG.get(id); const h = document.getElementById(id); const q = document.getElementById(id + '_q'); if (!R || !h || !q) return;
  const txt = q.value.trim();
  const exato = R.opcoes().find(o => semAcento(o.v) === semAcento(txt) || semAcento(o.t) === semAcento(txt));
  if (exato) { if (exato.v !== h.value) escolher(id, exato.v); else q.value = exato.t; return; }
  if (R.livre) { const v = R.maiusculas ? txt.toUpperCase() : txt; if (v !== h.value) escolher(id, v); return; }
  if (!txt && R.vazio !== '') { if (h.value) escolher(id, ''); return; }
  const o = R.opcoes().find(x => x.v === h.value); q.value = o ? o.t : '';
}
const idDe = el => { const c = el && el.closest && el.closest('.cbx'); return c ? c.dataset.cbx : null; };

document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('.cbx input[role=combobox]')) { e.target.select(); abrir(idDe(e.target), true); } });
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('.cbx input[role=combobox]')) abrir(idDe(e.target)); });
document.addEventListener('focusout', e => {
  if (!(e.target.matches && e.target.matches('.cbx input[role=combobox]'))) return;
  const id = idDe(e.target);
  setTimeout(() => { const c = document.querySelector(`[data-cbx="${id}"]`); if (c && !c.contains(document.activeElement)) { confirmarTexto(id); fechar(id); } }, 150);
});
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.cbx-o')) e.preventDefault(); });
document.addEventListener('click', e => {
  const o = e.target.closest && e.target.closest('.cbx-o'); if (o) { escolher(idDe(o), o.dataset.cbxV); return; }
  const x = e.target.closest && e.target.closest('[data-cbx-limpar]'); if (x) { const id = x.dataset.cbxLimpar; escolher(id, ''); const q = document.getElementById(id + '_q'); if (q) q.focus(); }
});
document.addEventListener('keydown', e => {
  if (!(e.target.matches && e.target.matches('.cbx input[role=combobox]'))) return;
  const id = idDe(e.target); const l = document.getElementById(id + '_l');
  const ops = l ? [...l.querySelectorAll('.cbx-o')] : []; const at = ops.findIndex(x => x.getAttribute('aria-selected') === 'true');
  const marcar = i => { ops.forEach((x, j) => x.setAttribute('aria-selected', j === i ? 'true' : 'false')); if (ops[i]) ops[i].scrollIntoView({ block: 'nearest' }); };
  if (e.key === 'ArrowDown') { e.preventDefault(); if (l.hidden) abrir(id); else marcar(Math.min(ops.length - 1, at + 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(Math.max(0, at - 1)); }
  else if (e.key === 'Enter') { e.preventDefault(); if (!l.hidden && ops[at]) escolher(id, ops[at].dataset.cbxV); else confirmarTexto(id); fechar(id); }
  else if (e.key === 'Escape' && !l.hidden) { e.stopPropagation(); fechar(id); }
}, true);

// Filtro de lista na própria tela (sem redesenhar): esconde quem não casa com a busca.
// Os itens precisam de data-k (texto de busca já sem acento). Grupos com data-grupo somem quando ficam vazios.
export function filtrarLista(raiz, q, contador) {
  if (!raiz) return 0;
  let n = 0;
  raiz.querySelectorAll('[data-k]').forEach(el => { const ok = casa(el.dataset.k, q); el.hidden = !ok; if (ok) n++; });
  raiz.querySelectorAll('[data-grupo]').forEach(g => { g.hidden = !g.querySelector('[data-k]:not([hidden])'); });
  if (contador) contador.textContent = String(n);
  const vz = raiz.querySelector('[data-vazio]'); if (vz) vz.hidden = n > 0;
  return n;
}
export const caixaBusca = (id, valor, placeholder) => `<label class="srch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input class="in" type="search" id="${id}" value="${escH(valor || '')}" placeholder="${escH(placeholder)}" autocomplete="off" spellcheck="false" aria-label="${escH(placeholder)}"></label>`;
// Troca o valor escolhido por código (ex.: preencher o operador ao escolher o equipamento).
export function definirValor(id, v) {
  const R = REG.get(id); const h = document.getElementById(id); const q = document.getElementById(id + '_q'); if (!R || !h || !q) return;
  const o = R.opcoes().find(x => x.v === v); h.value = v || ''; q.value = o ? o.t : (v || '');
  const x = document.querySelector(`[data-cbx-limpar="${id}"]`); if (x) x.hidden = !v;
}
