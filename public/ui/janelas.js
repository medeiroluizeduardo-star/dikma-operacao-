// Janelas e avisos: lista de opções (sheet), formulário (formSheet), mensagem de erro, aviso rápido (toast) e foto.
import { DB, esc, $ } from '../nucleo/base.js';
import { I } from './icones.js';


export const senhaField = (id, label, ac) => `<label class="sel"><span>${label}</span><div class="pwd"><input class="in" id="${id}" type="password" autocomplete="${ac}" required minlength="8"><button type="button" class="btn ghost eye" data-eye="${id}" aria-label="Mostrar senha">${I.eye}</button></div></label>`;

/* ---------------- interação ---------------- */
// opts: [{ t, d, ic, cur, larga }] · cfg.grade: as opções curtas viram uma grade (situações do dia), as largas ficam embaixo
export function sheet(titleTxt, sub, opts, onPick, cfg = {}) {
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet${cfg.grade ? ' comgrade' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titleTxt)}"><h3>${esc(titleTxt)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="opts${cfg.grade ? ' grade' : ''}">${opts.map((o, i) => `${o.sec ? `<div class="opt-sec">${esc(o.sec)}</div>` : ''}<button class="opt${o.larga ? ' larga' : ''}${o.cls ? ' ' + o.cls : ''}" data-o="${i}" ${o.cur ? 'aria-current="true"' : ''}>${o.ic || ''}<span>${esc(o.t)}${o.d ? `<br><small class="muted">${esc(o.d)}</small>` : ''}</span>${o.fim || ''}</button>`).join('')}</div><button class="btn center" data-o="x">${cfg.fechar || 'Cancelar'}</button></div></div>`;
  const kd = e => { if (e.key === 'Escape') close(); };
  const close = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim') return close(); const b = e.target.closest('[data-o]'); if (!b) return; const v = b.dataset.o; close(); if (v !== 'x') onPick(opts[+v]); };
  L.querySelector('[data-o]').focus();
}
export function formSheet(titleTxt, sub, fieldsHtml, submitTxt, onSubmit, opts = {}) {
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><form class="sheet" id="fSheet" role="dialog" aria-modal="true" aria-label="${esc(titleTxt)}" novalidate><h3>${esc(titleTxt)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${fieldsHtml}<p class="err" id="shErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri" type="submit">${esc(submitTxt)}</button><button class="btn" type="button" data-close>Cancelar</button></div></form></div>`;
  const kd = e => { if (e.key === 'Escape') cancelar(); };
  const close = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  const cancelar = () => { close(); if (opts.aoCancelar) opts.aoCancelar(); };
  if (opts.cancelarTxt) { const b = L.querySelector('#fSheet [data-close]'); if (b) b.textContent = opts.cancelarTxt; }
  document.addEventListener('keydown', kd);
  $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim' || e.target.closest('[data-close]')) cancelar(); const eye = e.target.closest('[data-eye]'); if (eye) toggleEye(eye); };
  $('fSheet').onsubmit = async e => { e.preventDefault(); const b = e.submitter || e.target.querySelector('[type=submit]'); b.disabled = true; try { await onSubmit(); close(); } catch (err) { showErr('shErr', err); b.disabled = false; } };
  const f = L.querySelector('input'); if (f) f.focus();
}
export function showErr(id, err) { const el = $(id); if (!el) return toast(msgErro(err)); el.textContent = msgErro(err); el.hidden = false; }
const msgErro = err => (DB.erroAuth ? DB.erroAuth(err) : (err && err.message) || String(err));
export function toggleEye(b) { const i = $(b.dataset.eye); if (!i) return; i.type = i.type === 'password' ? 'text' : 'password'; b.setAttribute('aria-label', i.type === 'password' ? 'Mostrar senha' : 'Ocultar senha'); }
/* ---------------- FOTO (via em papel das fichas do Efetivo) ---------------- */
function carregarImg(file) { return new Promise((ok, ko) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => ko(new Error('Não foi possível abrir esta imagem.')); im.src = u; }); }
// Reduz a foto (máx. 1600 px) e grava um carimbo com data, hora, atividade e usuário.
export async function prepararFoto(file, carimbo) {
  const im = await carregarImg(file);
  const sc = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0, w, h);
  const bar = Math.max(26, Math.round(Math.min(w, h) * 0.05));
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, h - bar, w, bar);
  g.fillStyle = '#fff'; g.font = `600 ${Math.round(bar * 0.48)}px system-ui,sans-serif`; g.textBaseline = 'middle';
  let txt = carimbo; while (g.measureText(txt).width > w - bar * 0.6 && txt.length > 10) txt = txt.slice(0, -2);
  if (txt !== carimbo) txt = txt.slice(0, -1) + '…';
  g.fillText(txt, bar * 0.3, h - bar / 2);
  let q = 0.75, dados = cv.toDataURL('image/jpeg', q);
  while (dados.length > 880000 && q > 0.3) { q -= 0.1; dados = cv.toDataURL('image/jpeg', q); }
  const ts = 240 / Math.max(w, h), tc = document.createElement('canvas'); tc.width = Math.round(w * ts); tc.height = Math.round(h * ts);
  tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
  return { dados, thumb: tc.toDataURL('image/jpeg', 0.6), tipo: 'image/jpeg', tamanho: Math.round(dados.length * 0.75) };
}
// Aviso rápido no rodapé. Com { desfazer }, mostra o botão Desfazer por alguns segundos.
export function toast(t, o = {}) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  const erro = /^(erro|sem permissão|não |seu perfil não)/i.test(t);
  el.innerHTML = `<span class="ti ${erro ? 'bad' : 'ok'}" aria-hidden="true">${erro ? '!' : '✓'}</span><span></span>${o.desfazer ? '<button type="button" class="tbtn">Desfazer</button>' : ''}`; el.children[1].textContent = t;
  const dur = o.desfazer ? 6000 : 2600;
  if (o.desfazer) el.querySelector('.tbtn').onclick = () => { el.remove(); o.desfazer(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('sai'), dur); setTimeout(() => el.remove(), dur + 300);
}
