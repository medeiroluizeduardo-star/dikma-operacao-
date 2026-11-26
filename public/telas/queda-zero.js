// Queda zero (telas): aba própria em Operação › Queda zero (separada do Apontar e das fotos), janela para lançar ou
// corrigir e o formulário com a tabela. As contas ficam em contas/queda-zero.js; a gravação, em data.js ›
// salvarQuedaZero (mapa qz da semana).
import { AREA_S, DAYS, ddmm, add, pd, setDaArea, monthLabel, SETS, weekOf, monthOfWeek } from '../contas/cal.js';
import { DB, TODAY, esc, $ } from '../nucleo/base.js';
import { PL, UI, AREAS, ME, SK, canEdit, areaScope, myArea, myAreas, isAdmin, modsDe } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { diasDe, rotasDa } from '../calc/atividades.js';
import { metaFoto } from '../contas/fotos.js';
import { statusFoto } from '../contas/fotos-arquivo.js';
import { reduzirFotoAtividade, verFotoGrande } from '../ui/fotos.js';
import { cfgF } from './fotos.js';
import { campoBusca, semAcento } from '../ui/busca.js';
import { registrarRelatorio, agoraTxt } from '../ui/indicadores-acoes.js';
import { QZ_EQUIP, QZ_PRODUTOS, QZ_MAX_LINHAS, calcQZ, valorQZ, resultadoQZ, fatorQZ, fmtT, textoQZ, qzDoDia, totalDiaQZ, chaveNovaQZ, QZ_LOCAIS, QZ_MOTIVOS, QZ_NOME_MAX, listaQZ, novoNomeQZ, pidFotoQZ, fotosQZ, lancamentosMesQZ, lancamentosFaixaQZ, resumoQZ } from '../contas/queda-zero.js';

const num = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
// Campos com busca ao digitar (o mesmo modelo de Operador e Equipamento na aba Equipamentos): ui/busca.js.
const opcoesEquipQZ = () => QZ_EQUIP.map(x => ({ v: x.id, t: x.nome, d: `Coque ${num(x.coque)} t · Carvão ${num(x.carvao)} t cada` }));
const opcoesTexto = lista => () => lista.map(x => ({ v: x, t: x }));
// Valor do campo de busca: o escolhido; ou o texto digitado, quando é igual a um da lista (salvar antes de sair do campo).
function valorBusca(id, opcoes) {
  const h = $(id), q = $(id + '_q'); if (!h) return '';
  if (h.value) return h.value;
  const t = semAcento((q && q.value) || '').trim(); if (!t) return '';
  const o = opcoes().find(x => semAcento(x.t) === t || semAcento(x.v) === t); return o ? o.v : '';
}
let nLinQZ = 0;
function linhaQZ(l = {}) {
  const e = l.e || '', p = l.p || 'coque', q = l.q != null ? String(l.q).replace('.', ',') : '';
  const id = 'qze' + (++nLinQZ);
  return `<div class="qzlin" data-qzlin data-qze="${id}">
    <div class="sel"><span>Equipamento</span>${campoBusca(id, e, opcoesEquipQZ, { placeholder: 'Digite: retro, bobcat, caçamba…' })}</div>
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
  const linhas = () => [...box.querySelectorAll('[data-qzlin]')].map(d => ({ d, e: valorBusca(d.dataset.qze, opcoesEquipQZ), p: d.querySelector('[data-qzp]').value, q: d.querySelector('[data-qzq]').value }));
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
    if (e.target.closest('#qzMais')) { $('qzLinhas').insertAdjacentHTML('beforeend', linhaQZ()); pintar(); const s = box.querySelectorAll('[data-qzlin] input[role=combobox]'); s[s.length - 1].focus(); return; }
    const rm = e.target.closest('[data-qzrm]'); if (rm) { rm.closest('[data-qzlin]').remove(); pintar(); }
  });
  pintar();
  return () => calcQZ(linhas());
}
// Grava (ou apaga) um lançamento, só se mudou. novo = valor completo ou null.
function gravarQZ(doc, key, k, novo, rotulo, fotos = []) {
  if (!canEdit(doc.area)) return;
  const antes = (doc.qz || {})[key] || null;
  if (!fotos.length && JSON.stringify(novo) === JSON.stringify(antes)) return;
  doc.qz = doc.qz || {}; if (novo) doc.qz[key] = novo; else delete doc.qz[key];
  Promise.resolve(DB.salvarQuedaZero(doc.id, doc.area, key, novo, fotos)).catch(() => toast('Não foi possível gravar a queda zero'));
  DB.log(`Queda zero · ${rotulo} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → ${novo ? `${fmtT(novo.t)} (${textoQZ(novo)})${fotos.length ? ` + ${fotos.length} foto${fotos.length > 1 ? 's' : ''}` : ''}` : 'apagada'}`, 'operacao');
}
// Fotos do lançamento: o administrador e quem aponta na área apagam (quem aponta só a foto ainda não exportada), como nas
// fotos das atividades; as regras do banco conferem o mesmo.
const podeApagarFotoQZ = (doc, x) => isAdmin() || (canEdit(doc.area) && statusFoto(x) === 'banco');
const conjDe = doc => setDaArea(doc.area) || SK;
const legFoto = x => `${x.porNome || ''}${x.at ? ' · ' + x.at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}`;
const abrirFoto = (doc, x) => (statusFoto(x) === 'arquivada' ? verFotoGrande(async () => x.thumb, x.thumb, 'Foto da queda zero (miniatura)', legFoto(x) + ' · arquivada fora do banco')
  : verFotoGrande(() => DB.abrirEvidencia(x.id, conjDe(doc)), x.thumb, 'Foto da queda zero', legFoto(x)));
// Bloco de fotos do formulário (opcional, até o máximo da Queda zero em Administração › Fotos › Regras das fotos).
const blocoFotosQZ = () => `<div class="qzfotos" id="qzFotos"><div class="row-between"><b>Fotos (opcional)</b><span class="muted small" id="qzFCont" aria-live="polite"></span></div>
  <div class="sgfotos" id="qzFLista"></div>
  <div class="row-gap"><label class="btn sm fadd" for="qzFIn" id="qzFAdd">${I.cam} Tirar foto / escolher</label><label class="btn ghost sm" for="qzFInG" id="qzFAddG">Da galeria</label><span class="muted small" id="qzFProc" aria-live="polite"></span></div>
  <input type="file" id="qzFIn" accept="image/*" capture="environment" multiple hidden><input type="file" id="qzFInG" accept="image/*" multiple hidden></div>`;
// Liga o bloco: mostra as fotos que o lançamento já tem (com apagar para quem pode) e as novas escolhidas.
// Devolve { novas: () => imgs, tem: () => quantas já tem, salvas: () => lista das já gravadas, pronto: () => sem foto preparando }.
function ligarFotosQZ(doc, k, key) {
  const max = cfgF().maxQZ; const novas = []; let salvas = []; let tem = key ? fotosQZ((doc.qz || {})[key]) : 0; let ocupado = 0; let carregou = !tem;
  const pintar = () => {
    const l = $('qzFLista'); if (!l) return;
    const velhas = salvas.map(x => `<div class="sgfth"><button type="button" class="sgmini" data-qzfv="${esc(x.id)}" aria-label="Ver a foto">${x.thumb ? `<img src="${x.thumb}" alt="">` : 'Ver'}</button>${podeApagarFotoQZ(doc, x) ? `<button type="button" class="btn sm ghost" data-qzfa="${esc(x.id)}" aria-label="Apagar esta foto">${I.lixo}</button>` : ''}</div>`).join('');
    const nov = novas.map((f, i) => `<div class="sgfth"><img src="${f.thumb}" alt="Foto nova ${i + 1}"><button type="button" class="btn sm ghost" data-qzfr="${i}" aria-label="Tirar a foto nova ${i + 1}">✕</button></div>`).join('');
    l.innerHTML = velhas + nov || `<p class="muted small m0">${carregou ? 'Nenhuma foto.' : 'Carregando as fotos…'}</p>`;
    const cabe = max - tem - novas.length - ocupado;
    $('qzFCont').textContent = `${tem + novas.length} de até ${max}`;
    for (const id of ['qzFAdd', 'qzFAddG']) { const b = $(id); b.classList.toggle('dis', cabe <= 0); b.setAttribute('aria-disabled', String(cabe <= 0)); }
    for (const id of ['qzFIn', 'qzFInG']) $(id).disabled = cabe <= 0;
    $('qzFProc').textContent = ocupado ? `Preparando ${ocupado} foto${ocupado > 1 ? 's' : ''}…` : '';
  };
  const escolher = async ev => {
    const fs = [...(ev.target.files || [])]; ev.target.value = ''; if (!fs.length) return;
    const cabe = Math.max(0, max - tem - novas.length - ocupado);
    if (fs.length > cabe) toast(`No máximo ${max} foto${max > 1 ? 's' : ''} por lançamento`);
    const usar = fs.slice(0, cabe); ocupado += usar.length; pintar();
    for (const f of usar) {
      try { const x = await reduzirFotoAtividade(f); if (x.sha && novas.some(y => y.sha === x.sha)) toast('Esta foto já foi escolhida'); else novas.push(x); }
      catch (err) { toast(err.message || 'Não foi possível usar esta foto'); }
      ocupado--; pintar();
    }
  };
  $('qzFIn').addEventListener('change', escolher); $('qzFInG').addEventListener('change', escolher);
  $('qzFotos').addEventListener('click', e => {
    const r = e.target.closest('[data-qzfr]'); if (r) { novas.splice(+r.dataset.qzfr, 1); pintar(); return; }
    const v = e.target.closest('[data-qzfv]'); if (v) { const x = salvas.find(y => y.id === v.dataset.qzfv); if (x) abrirFoto(doc, x); return; }
    const a = e.target.closest('[data-qzfa]'); if (!a) return;
    const x = salvas.find(y => y.id === a.dataset.qzfa); if (!x) return;
    if (!a.dataset.conf) { a.dataset.conf = '1'; a.innerHTML = 'Apagar?'; a.classList.add('danger'); return; }
    a.disabled = true;
    DB.apagarFotosQZ(doc.id, doc.area, key, [x]).then(() => {
      salvas = salvas.filter(y => y.id !== x.id); tem = Math.max(0, tem - 1);
      const v0 = (doc.qz || {})[key]; if (v0) v0.f = tem;
      DB.log(`Queda zero · ${AREA_S[doc.area] || doc.area} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → foto apagada`, 'operacao'); toast('Foto apagada'); pintar();
    }).catch(() => { a.disabled = false; toast('Não deu para apagar a foto agora. Confira o sinal e tente de novo.'); });
  });
  if (tem) DB.listarFotosCel(doc.id, pidFotoQZ(key), k, conjDe(doc)).then(l => { salvas = l; carregou = true; pintar(); }).catch(() => { carregou = true; pintar(); });
  pintar();
  return { novas: () => novas.slice(), tem: () => tem, salvas: () => salvas, carregou: () => carregou, pronto: () => !ocupado };
}
const areaQZ = () => { const a = areaScope(); return a === 'TODAS' ? (AREAS.includes(UI.apArea) ? UI.apArea : AREAS[0]) : a; };
const docAtual = () => DB.cache.semanas[areaQZ() + '|' + UI.ini];
// Local e motivo: busca ao digitar na lista; o que não está na lista pode ser escrito e entra para todos (config/quedazero).
function campoLista(id, rotulo, nomeItem, lista, atual) {
  const opc = lista.includes(atual) || !atual ? lista : [atual, ...lista];
  return `<div class="sel"><span>${rotulo} (opcional)</span>${campoBusca(id, atual || '', opcoesTexto(opc), { livre: true, vazio: '—', placeholder: 'Digite para buscar ou escrever' })}</div>`;
}
// Valor escolhido ou digitado; um nome novo entra na lista de todos (config/quedazero). Erro de digitação vira exceção (a janela mostra).
function lerLista(id, lista, tipo) {
  const v = (($(id + '_q') || {}).value || '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const x = novoNomeQZ(v, lista); if (x.erro) throw new Error(x.erro);
  if (!x.existe) Promise.resolve(DB.salvarItemQZ(tipo, x.nome)).catch(() => toast('Não foi possível cadastrar o novo nome na lista'));
  return x.nome;
}
// Janela para lançar (key vazia) ou corrigir um lançamento do dia k.
export function editarQZ(doc, k, key) {
  const atual = key ? (doc.qz || {})[key] || null : null;
  const pid = key && !key.startsWith('Z|') ? key.split('|').slice(0, -1).join('|') : '';
  const ativ = pid ? (PL.get(pid) || {}).ativ || pid : '';
  const rota0 = atual ? atual.r || (PL.get(pid) || {}).rota || '' : '';
  const rotas = rotasDa(doc.area).filter(x => x.carga > 0).map(x => x.rota);
  if (rota0 && !rotas.includes(rota0)) rotas.unshift(rota0);
  const rotulo0 = `${AREA_S[doc.area] || doc.area}${rota0 ? ' · ' + rota0 : ''}`;
  const L = DB.cache.qzListas || {};
  const locais = listaQZ(QZ_LOCAIS, L.locais), motivos = listaQZ(QZ_MOTIVOS, L.motivos);
  let ler = null;
  formSheet(atual ? 'Corrigir queda zero' : 'Lançar queda zero', `${esc(AREA_S[doc.area] || doc.area)} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}${ativ ? `<br>Lançada junto da atividade: ${esc(ativ)}` : ''}`,
    blocoQZ(atual, true) + `<div class="sel"><span>Rota (opcional)</span>${campoBusca('qzRota', rota0, opcoesTexto(rotas), { vazio: '—', placeholder: 'Sem rota · digite para buscar' })}</div>${campoLista('qzLoc', 'Local (transportador)', 'local', locais, atual && atual.l)}${campoLista('qzMot', 'Motivo', 'motivo', motivos, atual && atual.m)}<label class="sel"><span>Observação (opcional)</span><input class="in" id="qzObs" maxlength="120" autocomplete="off" placeholder="Ex.: perto da torre" value="${esc((atual && atual.o) || '')}"></label>` + blocoFotosQZ()
    + (atual ? `<button type="button" class="btn sm danger" id="qzApagar">${I.lixo} Apagar este lançamento</button>` : ''), 'Salvar', async () => {
      const r = ler(); if (r.erro) throw new Error(r.erro);
      if (!fts.pronto()) throw new Error('Espere as fotos ficarem prontas.');
      if (!r.itens.length) {
        if (!atual) throw new Error('Preencha pelo menos um equipamento com a quantidade.');
        if (fts.tem()) throw new Error('Este lançamento tem fotos: para apagar, use "Apagar este lançamento".');
        gravarQZ(doc, key, k, null, rotulo0); toast('Lançamento apagado'); render(); return;
      }
      const o = ($('qzObs').value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      const rota = valorBusca('qzRota', opcoesTexto(rotas));
      const l = lerLista('qzLoc', locais, 'locais'), m = lerLista('qzMot', motivos, 'motivos');
      const imgs = fts.novas(); const nf = fts.tem() + imgs.length;
      const novo = { ...valorQZ(r), ...(rota ? { r: rota } : {}), ...(l ? { l } : {}), ...(m ? { m } : {}), ...(o ? { o } : {}), ...(nf ? { f: nf } : {}) };
      const chave = key || chaveNovaQZ(k);
      const fotos = imgs.map(img => {
        const meta = metaFoto({ semana: doc.id, area: doc.area, conj: conjDe(doc), rota, dia: diasDe(doc)[k], k, sit: '', itens: [{ pid: pidFotoQZ(chave), ativ: `Queda zero: ${fmtT(r.t)} (${textoQZ(novo)})${m ? ' · ' + m : ''}`, local: l || o || '' }], img, por: ME.uid, porNome: ME.nome || ME.login || '' });
        delete meta.por; delete meta.porNome; return { meta, dados: img.dados };
      });
      gravarQZ(doc, chave, k, novo, `${AREA_S[doc.area] || doc.area}${rota ? ' · ' + rota : ''}`, fotos); toast(`Queda zero: ${fmtT(r.t)}${fotos.length ? ` · ${fotos.length} foto${fotos.length > 1 ? 's' : ''}` : ''}`); render();
    });
  ler = ligarQZ();
  const fts = ligarFotosQZ(doc, k, key);
  const ap = $('qzApagar');
  if (ap) ap.addEventListener('click', () => {
    const erro = t => { const e = $('shErr'); e.textContent = t; e.hidden = false; };
    // Com fotos: as fotos saem junto (só quem aponta na área e o administrador apagam fotos).
    if (fts.tem()) {
      if (!fts.carregou()) return erro('Espere carregar as fotos (precisa de sinal).');
      const l = fts.salvas();
      if (l.length < fts.tem() || !l.every(x => podeApagarFotoQZ(doc, x))) return erro('Este lançamento tem fotos: só quem aponta na área ou o administrador pode apagar (foto já exportada, só o administrador).');
      if (!ap.dataset.conf) { ap.dataset.conf = '1'; ap.innerHTML = `${I.lixo} Confirmar: apagar com ${l.length} foto${l.length > 1 ? 's' : ''}`; return; }
      ap.disabled = true;
      DB.apagarFotosQZ(doc.id, doc.area, key, l, true).then(() => {
        delete doc.qz[key]; DB.log(`Queda zero · ${rotulo0} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → apagada (com ${l.length} foto${l.length > 1 ? 's' : ''})`, 'operacao');
        $('layer').innerHTML = ''; toast('Lançamento apagado'); render();
      }).catch(() => { ap.disabled = false; erro('Não deu para apagar agora. Confira o sinal e tente de novo.'); });
      return;
    }
    if (ap.dataset.conf) { gravarQZ(doc, key, k, null, rotulo0); $('layer').innerHTML = ''; toast('Lançamento apagado'); render(); return; }
    ap.dataset.conf = '1'; ap.innerHTML = `${I.lixo} Confirmar: apagar`;
  });
}
acoes.qzNovo = () => { const doc = docAtual(); if (doc && canEdit(doc.area)) editarQZ(doc, UI.dia); };
// Só ver as fotos (quem não lança na área): miniaturas; tocar abre a foto grande.
acoes.qzVerFotos = async (t, d) => {
  const doc = docAtual(); const v = doc && (doc.qz || {})[d.k]; if (!v) return;
  const L = $('layer');
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet fotosheet" role="dialog" aria-modal="true" aria-label="Fotos da queda zero"><h3>Fotos da queda zero</h3><div class="sub">${esc(fmtT(v.t))} · ${esc(textoQZ(v))}<br>${DAYS[UI.dia]} ${ddmm(diasDe(doc)[UI.dia])}</div>
    <div class="sgfotos fgrade" id="qzVer"><p class="muted small m0">Carregando as fotos…</p></div><div class="row-gap"><button class="btn" type="button" data-close>Fechar</button></div></div></div>`;
  let lista = [];
  $('scrim').onclick = e => {
    e.stopPropagation(); if (e.target.id === 'scrim' || e.target.closest('[data-close]')) { L.innerHTML = ''; return; }
    const b = e.target.closest('[data-qzfv]'); const x = b && lista.find(y => y.id === b.dataset.qzfv); if (x) abrirFoto(doc, x);
  };
  try {
    lista = await DB.listarFotosCel(doc.id, pidFotoQZ(d.k), UI.dia, conjDe(doc));
    const el = $('qzVer'); if (!el) return;
    el.innerHTML = lista.length ? lista.map(x => `<button type="button" class="sgmini fmini" data-qzfv="${esc(x.id)}" aria-label="Ver a foto">${x.thumb ? `<img src="${x.thumb}" alt="">` : 'Ver'}</button>`).join('') : '<p class="muted small m0">As fotos ainda não chegaram a este aparelho (sem sinal).</p>';
  } catch (err) { const el = $('qzVer'); if (el) el.innerHTML = '<p class="muted small m0">Sem sinal: não deu para carregar as fotos agora.</p>'; }
};
acoes.qzEditar = (t, d) => { const doc = docAtual(); if (doc && canEdit(doc.area) && (doc.qz || {})[d.k]) editarQZ(doc, UI.dia, d.k); };
// Cartão do dia (todas as rotas da área): lançamentos, total e o botão de lançar.
function cartaoQZ(doc, k, edit) {
  const l = qzDoDia(doc, k);
  if (!l.length && !edit) return '';
  const linha = ({ key, v, pid }) => {
    const onde = [v.l, v.m, v.r || (pid ? (PL.get(pid) || {}).rota : ''), v.o, pid ? (PL.get(pid) || {}).ativ || pid : ''].filter(Boolean).map(esc).join(' · ');
    const nf = fotosQZ(v); const cam = nf ? ` <span class="qzcam" title="${nf} foto${nf > 1 ? 's' : ''}">${I.cam}<span class="num">${nf}</span></span>` : '';
    const corpo = `<b class="num">${esc(fmtT(v.t))}${cam}</b> <span>${esc(textoQZ(v))}</span>${onde ? `<span class="muted small">${onde}</span>` : ''}`;
    if (edit) return `<button type="button" class="qzitem" data-act="qzEditar" data-k="${esc(key)}" aria-label="Corrigir o lançamento de ${esc(fmtT(v.t))}">${corpo}</button>`;
    return nf ? `<button type="button" class="qzitem" data-act="qzVerFotos" data-k="${esc(key)}" aria-label="Ver as fotos do lançamento de ${esc(fmtT(v.t))}">${corpo}</button>` : `<div class="qzitem">${corpo}</div>`;
  };
  return `<section class="card qzcard" aria-label="Queda zero do dia"><div class="body"><div class="row-between"><b>Queda zero · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}</b>${l.length ? `<span class="num">Total ${esc(fmtT(totalDiaQZ(doc, k)))}</span>` : ''}</div>
    ${l.length ? `<div class="qzlista">${l.map(linha).join('')}</div>` : '<p class="muted small m0">Nenhum lançamento neste dia. É opcional: registre o material caído recolhido (coque ou carvão).</p>'}
    ${edit ? `<div class="row-gap"><button type="button" class="btn sm" data-act="qzNovo">${I.plus} Lançar queda zero</button></div>` : ''}</div></section>`;
}
/* ---------------- aba Operação › Queda zero ---------------- */
// Área (como no Apontar), semana do topo com o total de cada dia, o dia escolhido com os lançamentos e o total do mês.
export function vQuedaZero() {
  if (UI.dia == null || UI.dia < 0 || UI.dia > 6) { const t = Math.round((pd(TODAY) - pd(UI.ini)) / 864e5); UI.dia = t >= 0 && t < 7 ? t : 0; }
  const area = areaQZ(); UI.apArea = area; const k = UI.dia;
  const lista = myArea() ? myAreas() : AREAS;
  const chips = !myArea() || myAreas().length > 1 ? `<div class="rchips linha" role="group" aria-label="Área">${lista.map(a => `<button class="rchip" data-aparea="${a}" aria-pressed="${a === area}">${AREA_S[a]}</button>`).join('')}</div>` : '';
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  if (!doc) return chips + `<div class="card"><div class="empty">Esta semana ainda não foi gerada para ${AREA_S[area]}.</div></div>`;
  const dias = DAYS.map((d, j) => { const dt = add(UI.ini, j); const t = totalDiaQZ(doc, j); return `<button class="dbtn qzdia ${dt === TODAY ? 'hoje' : ''}" data-dia="${j}" aria-pressed="${j === k}" aria-label="${d} ${dt.slice(8)}${t ? ` · ${fmtT(t)}` : ''}"><small>${d}</small><b>${dt.slice(8)}</b><span class="num">${t ? esc(fmtCurto(t)) : '—'}</span></button>`; }).join('');
  const semana = DAYS.reduce((n, _, j) => n + totalDiaQZ(doc, j), 0);
  // Lançamentos do mês (semanas da área no mês escolhido, só os dias do mês): total e soma por local e por motivo.
  const doMes = Object.values(DB.cache.semanas).filter(w => w && w.area === area && w.mes === UI.mes)
    .flatMap(w => DAYS.flatMap((_, j) => (diasDe(w)[j].slice(0, 7) === UI.mes ? qzDoDia(w, j).map(x => x.v) : [])));
  const mes = doMes.reduce((n, v) => n + (Number(v.t) || 0), 0);
  const porMes = campo => { const m = new Map(); for (const v of doMes) { const c = v[campo] || 'Não informado'; m.set(c, (m.get(c) || 0) + (Number(v.t) || 0)); } return [...m].sort((x, y) => y[1] - x[1]); };
  const tabela = (tit, l) => `<div class="tw"><table><thead><tr><th>${tit}</th><th class="r">Toneladas</th></tr></thead><tbody>${l.map(([n, t]) => `<tr><td>${esc(n)}</td><td class="r num">${esc(fmtCurto(t))}</td></tr>`).join('')}</tbody></table></div>`;
  const resumoMes = doMes.length ? `<details class="calc qztab" open><summary>No mês: por local e por motivo</summary><div class="grid2">${tabela('Local', porMes('l'))}${tabela('Motivo', porMes('m'))}</div></details>` : '';
  return chips + `<div class="dayscroll" role="group" aria-label="Dia">${dias}</div>
    <div class="kpis qzkpis"><div class="kpi"><span class="lbl">Semana</span><span class="v num">${esc(fmtCurto(semana))}</span></div><div class="kpi"><span class="lbl">Mês ${esc(UI.mes.slice(5))}/${esc(UI.mes.slice(0, 4))}</span><span class="v num">${esc(fmtCurto(mes))}</span></div></div>`
    + cartaoQZ(doc, k, canEdit(area))
    + resumoMes
    + '<details class="calc qztab"><summary>Tabela usada no cálculo (toneladas por equipamento)</summary><div class="tw"><table><thead><tr><th>Equipamento</th><th class="r">Coque</th><th class="r">Carvão</th></tr></thead><tbody>'
    + QZ_EQUIP.map(x => `<tr><td>${esc(x.nome)}</td><td class="r num">${num(x.coque)}</td><td class="r num">${num(x.carvao)}</td></tr>`).join('') + '</tbody></table></div><p class="muted small m0">Resultado = valor da tabela × quantidade de equipamentos.</p></details>';
}
const fmtCurto = t => fmtT(Math.round(t * 1000) / 1000).replace(/ \(.*\)$/, '');

/* ---------------- Operação › Indicadores › Queda zero (painel do mês) ---------------- */
// Mês e área do topo (todas as áreas ou uma). Números grandes, dia a dia do mês e as somas por local, motivo,
// área e equipamento. Os lançamentos ficam na aba Queda zero.
const diasDoMes = ym => { const out = []; for (let d = ym + '-01'; d.slice(0, 7) === ym; d = add(d, 1)) out.push(d); return out; };
const pctT = (t, tot) => (tot ? Math.round(t / tot * 100) : 0);
const pctTx = (t, tot) => { const p = pctT(t, tot); return p || !t ? p + '%' : 'menos de 1%'; };
function barrasQZ(l, tot, cor, max = 10) {
  if (!l.length) return '<div class="empty">Nada lançado no período.</div>';
  const mx = Math.max(...l.map(x => x[1]), 1e-9); const mais = l.length - max;
  return `<div class="bars">${l.slice(0, max).map(([n, t, q]) => `<div class="barrow qzbar"><span class="n">${esc(n)}<small>${q} lançamento${q > 1 ? 's' : ''} · ${pctTx(t, tot)}</small></span><div class="stack clear"><i style="width:${t / mx * 100}%;background:${cor}"></i></div><span class="p num">${esc(fmtCurto(t))}</span></div>`).join('')}</div>${mais > 0 ? `<p class="muted small m0">E mais ${mais} com valores menores.</p>` : ''}`;
}
// Período do resumo (pergunta antes de imprimir ou exportar): o mês, um dia ou uma semana (segunda a domingo).
function periodoQZ(per) {
  const diaTxt = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${ddmm(d)}/${d.slice(0, 4)}`;
  if (!per || per.tipo === 'mes') {
    const ym = per ? per.data.slice(0, 7) : UI.mes; const datas = diasDoMes(ym); const n = monthLabel(ym);
    return { tipo: 'mes', ym, meses: [ym], datas, nome: n, papel: 'RESUMO DO MÊS · QUEDA ZERO', rot: `Mês: ${n}`, curto: n, no: 'no mês', doPer: 'do mês', lanc: 'Lançamentos do mês' };
  }
  if (per.tipo === 'semana') {
    const ini = weekOf(per.data); const fim = add(ini, 6); const datas = []; for (let d = ini; d <= fim; d = add(d, 1)) datas.push(d);
    const n = `${ddmm(ini)} a ${ddmm(fim)}/${fim.slice(0, 4)}`;
    return { tipo: 'semana', ini, fim, meses: [monthOfWeek(ini)], datas, nome: `semana de ${n}`, papel: 'RESUMO DA SEMANA · QUEDA ZERO', rot: `Semana: ${n}`, curto: `Semana ${ddmm(ini).replace('/', '-')} a ${ddmm(fim).replace('/', '-')}`, no: 'na semana', doPer: 'da semana', lanc: 'Lançamentos da semana' };
  }
  const d = per.data;
  return { tipo: 'dia', ini: d, fim: d, meses: [monthOfWeek(weekOf(d))], datas: [d], nome: diaTxt(d), papel: 'RESUMO DO DIA · QUEDA ZERO', rot: `Dia: ${diaTxt(d)}`, curto: `Dia ${ddmm(d).replace('/', '-')}`, no: 'no dia', doPer: 'do dia', lanc: 'Lançamentos do dia' };
}
// Relatório para os gerentes ("Imprimir resumo" e "Exportar para o Excel" em Indicadores › Queda zero): os números da tela
// em tabelas (com a parte de cada item no total), os gráficos no Excel e cada lançamento do período (dia, semana ou mês).
function relatorioQZ(per) {
  const area = areaScope(); const P = periodoQZ(per); const ym = P.ym;
  // Semana de outro mês ainda não carregada: começa a ler e pede para tentar de novo.
  const falta = P.meses.filter(m => DB.cache.monthsLoaded && !DB.cache.monthsLoaded.has(m));
  if (falta.length) { DB.watchMonths(falta); return null; }
  const todas = Object.values(DB.cache.semanas);
  const lancs = (P.tipo === 'mes' ? lancamentosMesQZ(todas, ym, area) : lancamentosFaixaQZ(todas, P.ini, P.fim, area)).sort((a, b) => a.dt.localeCompare(b.dt));
  const r = resumoQZ(lancs); const datas = P.datas; const vazio = `Nada lançado ${P.no}.`;
  const parte = t => (r.total ? t / r.total * 100 : null);
  const t3 = t => Math.round(t * 1000) / 1000;
  const quadro = (id, titulo, sub, nome, l, extra = {}) => ({ id, titulo, sub, cols: [{ t: nome }, { t: 'Lançamentos', fmt: 'int' }, { t: 'Toneladas', fmt: 't' }, { t: '% do total', fmt: 'pct' }],
    linhas: l.map(([n, t, q]) => [n, q, t3(t), parte(t)]), total: ['Total', l.reduce((s, x) => s + x[2], 0), t3(l.reduce((s, x) => s + x[1], 0)), l.length ? 100 : null], vazio, ...extra });
  const nDia = {}; lancs.forEach(x => { nDia[x.dt] = (nDia[x.dt] || 0) + 1; });
  const diaTxt = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${ddmm(d)}`;
  const maior = Object.entries(r.porDia).sort((a, b) => b[1] - a[1])[0];
  const ehDia = P.tipo === 'dia';
  const tabs = [];
  if (area === 'TODAS') tabs.push(quadro('area', 'Por área', `Toneladas ${P.no}`, 'Área', r.porArea.map(([a, t, q]) => [AREA_S[a] || a, t, q]), { meia: true }));
  tabs.push(quadro('local', 'Por local', 'Onde mais caiu material', 'Local', r.porLocal, { meia: true }));
  tabs.push(quadro('motivo', 'Por motivo', 'Por que caiu', 'Motivo', r.porMotivo, { meia: true }));
  tabs.push(quadro('equip', 'Por equipamento', 'Com que foi recolhido (cada item do lançamento)', 'Equipamento', r.porEquip, { meia: true }));
  tabs.push({ id: 'prod', titulo: 'Coque e carvão', sub: 'Toneladas por produto', meia: true, cols: [{ t: 'Produto' }, { t: 'Toneladas', fmt: 't' }, { t: '% do total', fmt: 'pct' }],
    linhas: r.n ? [['Coque', t3(r.coque), parte(r.coque)], ['Carvão', t3(r.carvao), parte(r.carvao)]] : [], vazio });
  if (!ehDia) {
    tabs.push({ id: 'diap', titulo: 'Dias com queda', sub: 'Só os dias com lançamento', meia: true, excel: false, cols: [{ t: 'Dia' }, { t: 'Lançamentos', fmt: 'int' }, { t: 'Toneladas', fmt: 't' }],
      linhas: datas.filter(d => nDia[d]).map(d => [diaTxt(d), nDia[d], t3(r.porDia[d] || 0)]), total: ['Total', r.n, t3(r.total)], vazio });
    tabs.push({ id: 'dia', titulo: 'Dia a dia', sub: `Toneladas recolhidas por dia · ${P.nome}`, papel: false, cols: [{ t: 'Dia' }, { t: 'Lançamentos', fmt: 'int' }, { t: 'Toneladas', fmt: 't' }],
      linhas: r.n ? datas.map(d => [P.tipo === 'semana' ? diaTxt(d) : ddmm(d), nDia[d] || null, r.porDia[d] ? t3(r.porDia[d]) : null]) : [], total: ['Total', r.n, t3(r.total)], vazio });
  }
  tabs.push({ id: 'lancp', titulo: P.lanc, excel: false, cols: [{ t: 'Dia' }, { t: 'Área' }, { t: 'Rota' }, { t: 'Local' }, { t: 'Motivo' }, { t: 'Equipamento e produto' }, { t: 'Toneladas', fmt: 't' }],
    linhas: lancs.map(({ v, area: a, dt }) => [ddmm(dt), AREA_S[a] || a, v.r || '', v.l || '', v.m || '', textoQZ(v), t3(Number(v.t) || 0)]), vazio });
  tabs.push({ id: 'lanc', titulo: P.lanc, aba: 'Lançamentos', lista: true, papel: false,
    cols: [{ t: 'Dia' }, { t: 'Área' }, { t: 'Rota' }, { t: 'Local' }, { t: 'Motivo' }, { t: 'Toneladas', fmt: 't' }, { t: 'Equipamento e produto' }, { t: 'Observação' }, { t: 'Fotos', fmt: 'int' }],
    linhas: lancs.map(({ v, area: a, dt }) => [ddmm(dt) + '/' + dt.slice(0, 4), AREA_S[a] || a, v.r || '', v.l || '', v.m || '', t3(Number(v.t) || 0), textoQZ(v), v.o || '', fotosQZ(v)]), vazio });
  const kpis = [
    { rot: `Recolhido ${P.no} (t)`, v: t3(r.total), fmt: 't', det: ehDia ? (r.n ? P.nome : vazio) : maior ? `Maior dia: ${ddmm(maior[0])} · ${fmtCurto(maior[1])}` : vazio },
    { rot: 'Lançamentos', v: r.n, fmt: 'int', det: P.no },
    ...(ehDia ? [] : [
      { rot: 'Dias com queda', v: r.dias, fmt: 'int', det: `de ${datas.length} dias ${P.doPer}` },
      { rot: 'Média por dia (t)', v: t3(r.media), fmt: 't', det: 'nos dias com queda' }]),
    { rot: 'Coque (t)', v: t3(r.coque), fmt: 't', det: `${pctT(r.coque, r.total)}% do total` },
    { rot: 'Carvão (t)', v: t3(r.carvao), fmt: 't', det: `${pctT(r.carvao, r.total)}% do total` }
  ];
  return {
    titulo: `Queda zero · ${P.nome}`, papel: P.papel, arquivo: P.tipo === 'mes' ? undefined : [(SETS[SK] || {}).curto || '', area === 'TODAS' ? 'Todas' : AREA_S[area], P.curto].filter(Boolean),
    meta: [(SETS[SK] || {}).nome || '', `Área: ${area === 'TODAS' ? 'Todas' : AREA_S[area]}`, P.rot, `Gerado em: ${agoraTxt()}`].filter(Boolean),
    kpis,
    tabelas: tabs,
    graficos: [
      ...(ehDia ? [] : [{ tipo: 'coluna', titulo: `Toneladas por dia · ${P.nome}`, tabela: 'dia', series: [2], largo: true }]),
      { tipo: 'barra', titulo: 'Toneladas por local', tabela: 'local', series: [2], max: 10 },
      { tipo: 'barra', titulo: 'Toneladas por motivo', tabela: 'motivo', series: [2], max: 10, cores: ['3A3F47'] },
      { tipo: 'rosca', titulo: 'Coque e carvão', tabela: 'prod', series: [1] },
      ...(area === 'TODAS' ? [{ tipo: 'barra', titulo: 'Toneladas por área', tabela: 'area', series: [2], max: 10, cores: ['8A94A6'] }] : []),
      { tipo: 'barra', titulo: 'Toneladas por equipamento', tabela: 'equip', series: [2], max: 10, cores: ['F2A65A'] }
    ]
  };
}
// Antes de imprimir ou exportar, pergunta o período: dia, semana ou mês (começa no mês aberto na tela).
registrarRelatorio('qpainel', relatorioQZ, { periodo: () => ({ tipo: 'mes', data: UI.mes === TODAY.slice(0, 7) ? TODAY : UI.mes + '-01' }) });
export function vQzPainel() {
  const area = areaScope();
  const r = resumoQZ(lancamentosMesQZ(Object.values(DB.cache.semanas), UI.mes, area));
  const onde = area === 'TODAS' ? 'todas as áreas' : AREA_S[area];
  let h = `<div class="row-between"><span class="muted">${monthLabel(UI.mes)} · ${esc(onde)}</span>${modsDe(ME).includes('operacao') ? `<button class="btn sm" data-go="quedazero">${I.queda || ''} Lançamentos da queda zero</button>` : ''}</div>`;
  if (!r.n) return h + `<div class="card"><div class="empty">Nenhuma queda zero lançada em ${monthLabel(UI.mes)} (${esc(onde)}).</div></div>`;
  const kp = (lbl, v, s, cor) => `<div class="kpi"><span class="lbl">${cor ? `<i class="dot" style="background:${cor}"></i>` : ''}${lbl}</span><span class="v num">${v}</span><span class="s">${s}</span></div>`;
  h += `<div class="kpis qzpainel">
    <div class="kpi hero"><span class="lbl">Recolhido no mês</span><span class="v num">${esc(fmtCurto(r.total))}</span><span class="s num">${(() => { const [d, t] = Object.entries(r.porDia).sort((a, b) => b[1] - a[1])[0]; return `Maior dia: ${ddmm(d)} · ${esc(fmtCurto(t))}`; })()}</span></div>
    ${kp('Lançamentos', r.n, 'no mês')}
    ${kp('Dias com queda', r.dias, `de ${diasDoMes(UI.mes).length} dias do mês`)}
    ${kp('Média por dia', esc(fmtCurto(r.media)), 'nos dias com queda')}
    ${kp('Coque', esc(fmtCurto(r.coque)), `${pctT(r.coque, r.total)}% do total`, 'var(--st-prog)')}
    ${kp('Carvão', esc(fmtCurto(r.carvao)), `${pctT(r.carvao, r.total)}% do total`, 'var(--st-nreal)')}
  </div>`;
  const datas = diasDoMes(UI.mes); const mx = Math.max(...datas.map(d => r.porDia[d] || 0), 1e-9);
  h += `<div class="card"><header><h2>Dia a dia</h2><p>Toneladas recolhidas por dia · ${monthLabel(UI.mes)}</p></header><div class="body">
    <div class="cols cmes" role="img" aria-label="Queda zero por dia">${datas.map(d => { const t = r.porDia[d] || 0; return `<div class="col" title="${ddmm(d)}: ${t ? fmtT(t) : 'nada lançado'}">${t ? `<i style="height:${Math.max(3, t / mx * 100)}%;background:var(--st-nreal)"></i>` : ''}</div>`; }).join('')}</div>
    <div class="colx cmes">${datas.map((dt, i) => `<div class="${dt === TODAY ? 'today' : ''}">${i % 5 === 0 || dt === TODAY ? `<b>${dt.slice(8)}</b>` : ''}</div>`).join('')}</div></div></div>`;
  h += `<div class="grid2"><div class="card"><header><h2>Por local</h2><p>Onde mais caiu material</p></header><div class="body">${barrasQZ(r.porLocal, r.total, 'var(--st-nreal)')}</div></div>
    <div class="card"><header><h2>Por motivo</h2><p>Por que caiu</p></header><div class="body">${barrasQZ(r.porMotivo, r.total, 'var(--st-atr)')}</div></div></div>`;
  h += `<div class="grid2">${area === 'TODAS' ? `<div class="card"><header><h2>Por área</h2><p>Toneladas no mês</p></header><div class="body">${barrasQZ(r.porArea.map(([a, t, q]) => [AREA_S[a] || a, t, q]), r.total, 'var(--st-prog)')}</div></div>` : ''}
    <div class="card"><header><h2>Por equipamento</h2><p>Com que foi recolhido</p></header><div class="body">${barrasQZ(r.porEquip, r.total, 'var(--st-real)')}</div></div></div>`;
  return h;
}
