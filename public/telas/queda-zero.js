// Queda zero (telas): cartão do dia no Apontar (separado das atividades e das fotos), janela para lançar ou
// corrigir e o formulário com a tabela. As contas ficam em contas/queda-zero.js; a gravação, em data.js ›
// salvarQuedaZero (mapa qz da semana).
import { AREA_S, DAYS, ddmm } from '../contas/cal.js';
import { DB, esc, $ } from '../nucleo/base.js';
import { PL, UI, canEdit } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { diasDe } from '../calc/atividades.js';
import { QZ_EQUIP, QZ_PRODUTOS, QZ_MAX_LINHAS, calcQZ, valorQZ, resultadoQZ, fatorQZ, fmtT, textoQZ, qzDoDia, totalDiaQZ, chaveNovaQZ } from '../contas/queda-zero.js';

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
// Bloco do formulário (a tabela). aberto = já vem aberto.
export function blocoQZ(inicial, aberto = false) {
  const linhas = inicial && Array.isArray(inicial.i) && inicial.i.length ? inicial.i : [{}];
  return `<details class="qzbox" id="qzBox"${aberto || inicial ? ' open' : ''}><summary><b>Equipamentos</b> <span class="muted small">· material recolhido</span></summary>
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
// Grava (ou apaga) um lançamento, só se mudou. novo = valor completo ou null.
function gravarQZ(doc, key, k, novo, rotulo) {
  if (!canEdit(doc.area)) return;
  const antes = (doc.qz || {})[key] || null;
  if (JSON.stringify(novo) === JSON.stringify(antes)) return;
  doc.qz = doc.qz || {}; if (novo) doc.qz[key] = novo; else delete doc.qz[key];
  Promise.resolve(DB.salvarQuedaZero(doc.id, doc.area, key, novo)).catch(() => toast('Não foi possível gravar a queda zero'));
  DB.log(`Queda zero · ${rotulo} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → ${novo ? `${fmtT(novo.t)} (${textoQZ(novo)})` : 'apagada'}`);
}
const docAtual = () => DB.cache.semanas[UI.apArea + '|' + UI.ini];
// Janela para lançar (key vazia) ou corrigir um lançamento do dia k.
export function editarQZ(doc, k, key) {
  const atual = key ? (doc.qz || {})[key] || null : null;
  const pid = key && !key.startsWith('Z|') ? key.split('|').slice(0, -1).join('|') : '';
  const ativ = pid ? (PL.get(pid) || {}).ativ || pid : '';
  const rota = atual ? atual.r || (PL.get(pid) || {}).rota || '' : UI.aRota || '';
  const rotulo = `${AREA_S[doc.area] || doc.area}${rota ? ' · ' + rota : ''}`;
  let ler = null;
  formSheet(atual ? 'Corrigir queda zero' : 'Lançar queda zero', `${esc(rotulo)} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}${ativ ? `<br>Lançada junto da atividade: ${esc(ativ)}` : ''}`,
    blocoQZ(atual, true) + `<label class="sel"><span>Local ou observação (opcional)</span><input class="in" id="qzObs" maxlength="120" autocomplete="off" placeholder="Ex.: correia 3, perto da torre" value="${esc((atual && atual.o) || '')}"></label>`
    + (atual ? `<button type="button" class="btn sm danger" id="qzApagar">${I.lixo} Apagar este lançamento</button>` : ''), 'Salvar', async () => {
      const r = ler(); if (r.erro) throw new Error(r.erro);
      if (!r.itens.length) { if (!atual) throw new Error('Preencha pelo menos um equipamento com a quantidade.'); gravarQZ(doc, key, k, null, rotulo); toast('Lançamento apagado'); render(); return; }
      const o = ($('qzObs').value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      const novo = { ...valorQZ(r), ...(rota ? { r: rota } : {}), ...(o ? { o } : {}) };
      gravarQZ(doc, key || chaveNovaQZ(k), k, novo, rotulo); toast(`Queda zero: ${fmtT(r.t)}`); render();
    });
  ler = ligarQZ();
  const ap = $('qzApagar');
  if (ap) ap.addEventListener('click', () => {
    if (ap.dataset.conf) { gravarQZ(doc, key, k, null, rotulo); $('layer').innerHTML = ''; toast('Lançamento apagado'); render(); return; }
    ap.dataset.conf = '1'; ap.innerHTML = `${I.lixo} Confirmar: apagar`;
  });
}
acoes.qzNovo = () => { const doc = docAtual(); if (doc && canEdit(doc.area)) editarQZ(doc, UI.dia); };
acoes.qzEditar = (t, d) => { const doc = docAtual(); if (doc && canEdit(doc.area) && (doc.qz || {})[d.k]) editarQZ(doc, UI.dia, d.k); };
// Cartão do dia no Apontar (todas as rotas da área): lançamentos, total e o botão de lançar.
export function cartaoQZ(doc, k, edit) {
  const l = qzDoDia(doc, k);
  if (!l.length && !edit) return '';
  const linha = ({ key, v, pid }) => {
    const onde = [v.r || (pid ? (PL.get(pid) || {}).rota : ''), v.o, pid ? (PL.get(pid) || {}).ativ || pid : ''].filter(Boolean).map(esc).join(' · ');
    const corpo = `<b class="num">${esc(fmtT(v.t))}</b> <span>${esc(textoQZ(v))}</span>${onde ? `<span class="muted small">${onde}</span>` : ''}`;
    return edit ? `<button type="button" class="qzitem" data-act="qzEditar" data-k="${esc(key)}" aria-label="Corrigir o lançamento de ${esc(fmtT(v.t))}">${corpo}</button>` : `<div class="qzitem">${corpo}</div>`;
  };
  return `<section class="card qzcard" aria-label="Queda zero do dia"><div class="body"><div class="row-between"><b>Queda zero · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}</b>${l.length ? `<span class="num">Total ${esc(fmtT(totalDiaQZ(doc, k)))}</span>` : ''}</div>
    ${l.length ? `<div class="qzlista">${l.map(linha).join('')}</div>` : '<p class="muted small m0">Nenhum lançamento neste dia. É opcional: registre o material caído recolhido (coque ou carvão).</p>'}
    ${edit ? `<div class="row-gap"><button type="button" class="btn sm" data-act="qzNovo">${I.plus} Lançar queda zero</button></div>` : ''}</div></section>`;
}
