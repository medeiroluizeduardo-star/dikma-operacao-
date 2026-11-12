// Queda zero (telas): bloco opcional no passo de fotos, janela para lançar ou corrigir depois e o selo na lista
// do Apontar. As contas (tabela de fatores e resultado) ficam em contas/queda-zero.js; a gravação, em data.js ›
// salvarQuedaZero (mapa qz da semana).
import { DAYS, ddmm } from '../contas/cal.js';
import { DB, esc, $ } from '../nucleo/base.js';
import { PL, canEdit } from '../nucleo/estado.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { diasDe } from '../calc/atividades.js';
import { QZ_EQUIP, QZ_PRODUTOS, QZ_MAX_LINHAS, calcQZ, valorQZ, resultadoQZ, fatorQZ, fmtT, textoQZ, qzDaCel } from '../contas/queda-zero.js';

const num = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
function linhaQZ(l = {}) {
  const e = l.e || '', p = l.p || 'coque', q = l.q != null ? String(l.q).replace('.', ',') : '';
  return `<div class="qzlin" data-qzlin>
    <label class="sel"><span>Equipamento</span><select class="in" data-qze><option value="">Escolha…</option>${QZ_EQUIP.map(x => `<option value="${x.id}"${x.id === e ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
    <label class="sel"><span>Produto</span><select class="in" data-qzp>${QZ_PRODUTOS.map(([v, t]) => `<option value="${v}"${v === p ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="sel"><span>Quantidade</span><input class="in" data-qzq inputmode="decimal" autocomplete="off" maxlength="7" placeholder="0" value="${esc(q)}"></label>
    <div class="qzres"><span class="muted small" data-qzf></span><b data-qzr></b></div>
    <button type="button" class="btn sm ghost qzrm" data-qzrm aria-label="Tirar esta linha">✕</button>
  </div>`;
}
// Bloco do formulário. aberto = já vem aberto (janela própria); no passo de fotos começa fechado (é opcional).
export function blocoQZ(inicial, aberto = false) {
  const linhas = inicial && Array.isArray(inicial.i) && inicial.i.length ? inicial.i : [{}];
  return `<details class="qzbox" id="qzBox"${aberto || inicial ? ' open' : ''}><summary><b>Queda zero</b> <span class="muted small">(opcional) · material recolhido</span></summary>
    <p class="muted small m0">Informe quantos equipamentos foram enchidos; o resultado é calculado pela tabela da operação.</p>
    <div id="qzLinhas">${linhas.map(linhaQZ).join('')}</div>
    <div class="row-gap"><button type="button" class="btn sm" id="qzMais">+ Outro equipamento</button><span class="qztot" id="qzTot" aria-live="polite"></span></div>
  </details>`;
}
// Liga os campos do bloco e devolve ler() → { itens, t, erro } (itens vazio = nada preenchido).
export function ligarQZ() {
  const box = $('qzBox'); if (!box) return () => ({ itens: [], t: 0, erro: '' });
  const linhas = () => [...box.querySelectorAll('[data-qzlin]')].map(d => ({ d, e: d.querySelector('[data-qze]').value, p: d.querySelector('[data-qzp]').value, q: d.querySelector('[data-qzq]').value }));
  const pintar = () => {
    const ls = linhas();
    for (const l of ls) {
      const f = fatorQZ(l.e, l.p); const q = Number(String(l.q).trim().replace(',', '.'));
      l.d.querySelector('[data-qzf]').textContent = f == null ? '' : `${num(f)} t cada`;
      l.d.querySelector('[data-qzr]').textContent = f != null && q > 0 ? `= ${fmtT(resultadoQZ(l.e, l.p, q))}` : '';
      l.d.querySelector('[data-qzrm]').hidden = ls.length < 2;
    }
    const r = calcQZ(ls);
    $('qzTot').textContent = !r.erro && r.itens.length ? `Total: ${fmtT(r.t)}` : '';
    $('qzMais').hidden = ls.length >= QZ_MAX_LINHAS;
  };
  box.addEventListener('input', pintar); box.addEventListener('change', pintar);
  box.addEventListener('click', e => {
    if (e.target.closest('#qzMais')) { $('qzLinhas').insertAdjacentHTML('beforeend', linhaQZ()); pintar(); const s = box.querySelectorAll('[data-qze]'); s[s.length - 1].focus(); return; }
    const rm = e.target.closest('[data-qzrm]'); if (rm) { rm.closest('[data-qzlin]').remove(); pintar(); }
  });
  pintar();
  return () => calcQZ(linhas());
}
// Grava (ou apaga) o registro da célula, só se mudou. r = resultado de ler().
export function gravarQZ(doc, i, k, r) {
  if (!r || !canEdit(doc.area)) return;
  const pid = doc.ids[i]; const key = pid + '|' + k; const novo = valorQZ(r); const antes = qzDaCel(doc, pid, k);
  if (JSON.stringify(novo) === JSON.stringify(antes)) return;
  doc.qz = doc.qz || {}; if (novo) doc.qz[key] = novo; else delete doc.qz[key];
  Promise.resolve(DB.salvarQuedaZero(doc.id, doc.area, key, novo)).catch(() => toast('Não foi possível gravar a queda zero'));
  const p = PL.get(pid) || {};
  DB.log(`${p.ativ || pid} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → queda zero ${novo ? `${fmtT(novo.t)} (${textoQZ(novo)})` : 'apagada'}`);
}
// Janela para lançar ou corrigir a queda zero de uma atividade já apontada.
export function editarQZ(doc, i, k) {
  const p = PL.get(doc.ids[i]) || {}; const atual = qzDaCel(doc, doc.ids[i], k);
  let ler = null;
  formSheet('Queda zero', `<b>${esc(p.ativ || doc.ids[i])}</b><br>${esc(p.rota || '')} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}`, blocoQZ(atual, true) + (atual ? '<p class="muted small m0">Para apagar o registro, tire todas as quantidades e salve.</p>' : ''), 'Salvar', async () => {
    const r = ler(); if (r.erro) throw new Error(r.erro);
    gravarQZ(doc, i, k, r); toast(r.itens.length ? `Queda zero: ${fmtT(r.t)}` : 'Queda zero apagada'); render();
  });
  ler = ligarQZ();
}
// Selo na lista do Apontar: "queda zero 1,2 t".
export function seloQZ(doc, i, k) {
  const v = qzDaCel(doc, doc.ids[i], k); if (!v) return '';
  return ` · <span class="pill qz" title="${esc(textoQZ(v))}">queda zero ${esc(fmtT(v.t).replace(/ \(.*\)$/, ''))}</span>`;
}
// Linha de resumo (fotos da atividade).
export function resumoQZ(doc, i, k) { const v = qzDaCel(doc, doc.ids[i], k); return v ? `Queda zero: <b>${esc(fmtT(v.t))}</b> · ${esc(textoQZ(v))}` : ''; }
