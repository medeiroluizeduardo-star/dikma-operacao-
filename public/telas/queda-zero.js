// Queda zero (telas): aba própria em Operação › Queda zero (separada do Apontar e das fotos), janela para lançar ou
// corrigir e o formulário com a tabela. As contas ficam em contas/queda-zero.js; a gravação, em data.js ›
// salvarQuedaZero (mapa qz da semana).
import { AREA_S, DAYS, ddmm, add, pd, setDaArea } from '../contas/cal.js';
import { DB, TODAY, esc, $ } from '../nucleo/base.js';
import { PL, UI, AREAS, ME, SK, canEdit, areaScope, myArea, myAreas, isAdmin, perfil } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { diasDe, rotasDa } from '../calc/atividades.js';
import { metaFoto } from '../contas/fotos.js';
import { statusFoto } from '../contas/fotos-arquivo.js';
import { reduzirFotoAtividade, verFotoGrande } from '../ui/fotos.js';
import { cfgF } from './fotos.js';
import { QZ_EQUIP, QZ_PRODUTOS, QZ_MAX_LINHAS, calcQZ, valorQZ, resultadoQZ, fatorQZ, fmtT, textoQZ, qzDoDia, totalDiaQZ, chaveNovaQZ, QZ_LOCAIS, QZ_MOTIVOS, QZ_NOME_MAX, listaQZ, novoNomeQZ, pidFotoQZ, fotosQZ } from '../contas/queda-zero.js';

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
function gravarQZ(doc, key, k, novo, rotulo, fotos = []) {
  if (!canEdit(doc.area)) return;
  const antes = (doc.qz || {})[key] || null;
  if (!fotos.length && JSON.stringify(novo) === JSON.stringify(antes)) return;
  doc.qz = doc.qz || {}; if (novo) doc.qz[key] = novo; else delete doc.qz[key];
  Promise.resolve(DB.salvarQuedaZero(doc.id, doc.area, key, novo, fotos)).catch(() => toast('Não foi possível gravar a queda zero'));
  DB.log(`Queda zero · ${rotulo} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → ${novo ? `${fmtT(novo.t)} (${textoQZ(novo)})${fotos.length ? ` + ${fotos.length} foto${fotos.length > 1 ? 's' : ''}` : ''}` : 'apagada'}`);
}
// Fotos do lançamento: o administrador e o líder da área apagam (o líder só a foto ainda não exportada), como nas
// fotos das atividades; as regras do banco conferem o mesmo.
const podeApagarFotoQZ = (doc, x) => isAdmin() || (perfil('operacao') === 'lider' && canEdit(doc.area) && statusFoto(x) === 'banco');
const conjDe = doc => setDaArea(doc.area) || SK;
const legFoto = x => `${x.porNome || ''}${x.at ? ' · ' + x.at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}`;
const abrirFoto = (doc, x) => (statusFoto(x) === 'arquivada' ? verFotoGrande(async () => x.thumb, x.thumb, 'Foto da queda zero (miniatura)', legFoto(x) + ' · arquivada fora do banco')
  : verFotoGrande(() => DB.abrirEvidencia(x.id, conjDe(doc)), x.thumb, 'Foto da queda zero', legFoto(x)));
// Bloco de fotos do formulário (opcional, até o máximo da configuração das fotos das atividades).
const blocoFotosQZ = () => `<div class="qzfotos" id="qzFotos"><div class="row-between"><b>Fotos (opcional)</b><span class="muted small" id="qzFCont" aria-live="polite"></span></div>
  <div class="sgfotos" id="qzFLista"></div>
  <div class="row-gap"><label class="btn sm fadd" for="qzFIn" id="qzFAdd">${I.cam} Tirar foto / escolher</label><label class="btn ghost sm" for="qzFInG" id="qzFAddG">Da galeria</label><span class="muted small" id="qzFProc" aria-live="polite"></span></div>
  <input type="file" id="qzFIn" accept="image/*" capture="environment" multiple hidden><input type="file" id="qzFInG" accept="image/*" multiple hidden></div>`;
// Liga o bloco: mostra as fotos que o lançamento já tem (com apagar para quem pode) e as novas escolhidas.
// Devolve { novas: () => imgs, tem: () => quantas já tem, salvas: () => lista das já gravadas, pronto: () => sem foto preparando }.
function ligarFotosQZ(doc, k, key) {
  const max = cfgF().max; const novas = []; let salvas = []; let tem = key ? fotosQZ((doc.qz || {})[key]) : 0; let ocupado = 0; let carregou = !tem;
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
      DB.log(`Queda zero · ${AREA_S[doc.area] || doc.area} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → foto apagada`); toast('Foto apagada'); pintar();
    }).catch(() => { a.disabled = false; toast('Não deu para apagar a foto agora. Confira o sinal e tente de novo.'); });
  });
  if (tem) DB.listarFotosCel(doc.id, pidFotoQZ(key), k, conjDe(doc)).then(l => { salvas = l; carregou = true; pintar(); }).catch(() => { carregou = true; pintar(); });
  pintar();
  return { novas: () => novas.slice(), tem: () => tem, salvas: () => salvas, carregou: () => carregou, pronto: () => !ocupado };
}
const areaQZ = () => { const a = areaScope(); return a === 'TODAS' ? (AREAS.includes(UI.apArea) ? UI.apArea : AREAS[0]) : a; };
const docAtual = () => DB.cache.semanas[areaQZ() + '|' + UI.ini];
// Campo de lista (local ou motivo) com "+ Novo…": escolher na lista ou cadastrar um nome novo (vale para todos).
const NOVO = '__novo__';
function campoLista(id, rotulo, nomeItem, lista, atual) {
  const opc = lista.includes(atual) || !atual ? lista : [atual, ...lista];
  return `<label class="sel"><span>${rotulo} (opcional)</span><select class="in" id="${id}"><option value="">Escolha…</option>${opc.map(x => `<option${x === atual ? ' selected' : ''}>${esc(x)}</option>`).join('')}<option value="${NOVO}">+ Novo ${nomeItem}…</option></select></label>
    <label class="sel" id="${id}NovoL" hidden><span>Nome do novo ${nomeItem}</span><input class="in" id="${id}Novo" maxlength="${QZ_NOME_MAX}" autocomplete="off"></label>`;
}
function ligarLista(id) {
  const s = $(id); if (!s) return;
  const f = () => { const novo = s.value === NOVO; $(id + 'NovoL').hidden = !novo; if (novo) $(id + 'Novo').focus(); };
  s.addEventListener('change', f);
}
// Valor escolhido; um nome novo entra na lista de todos (config/quedazero). Erro de digitação vira exceção (a janela mostra).
function lerLista(id, lista, tipo) {
  const v = $(id).value;
  if (v !== NOVO) return v;
  const x = novoNomeQZ($(id + 'Novo').value, lista); if (x.erro) throw new Error(x.erro);
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
    blocoQZ(atual, true) + `<label class="sel"><span>Rota (opcional)</span><select class="in" id="qzRota"><option value="">Sem rota</option>${rotas.map(x => `<option${x === rota0 ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>${campoLista('qzLoc', 'Local (transportador)', 'local', locais, atual && atual.l)}${campoLista('qzMot', 'Motivo', 'motivo', motivos, atual && atual.m)}<label class="sel"><span>Observação (opcional)</span><input class="in" id="qzObs" maxlength="120" autocomplete="off" placeholder="Ex.: perto da torre" value="${esc((atual && atual.o) || '')}"></label>` + blocoFotosQZ()
    + (atual ? `<button type="button" class="btn sm danger" id="qzApagar">${I.lixo} Apagar este lançamento</button>` : ''), 'Salvar', async () => {
      const r = ler(); if (r.erro) throw new Error(r.erro);
      if (!fts.pronto()) throw new Error('Espere as fotos ficarem prontas.');
      if (!r.itens.length) {
        if (!atual) throw new Error('Preencha pelo menos um equipamento com a quantidade.');
        if (fts.tem()) throw new Error('Este lançamento tem fotos: para apagar, use "Apagar este lançamento".');
        gravarQZ(doc, key, k, null, rotulo0); toast('Lançamento apagado'); render(); return;
      }
      const o = ($('qzObs').value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      const rota = $('qzRota').value || '';
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
  ler = ligarQZ(); ligarLista('qzLoc'); ligarLista('qzMot');
  const fts = ligarFotosQZ(doc, k, key);
  const ap = $('qzApagar');
  if (ap) ap.addEventListener('click', () => {
    const erro = t => { const e = $('shErr'); e.textContent = t; e.hidden = false; };
    // Com fotos: as fotos saem junto (só o líder da área e o administrador apagam fotos).
    if (fts.tem()) {
      if (!fts.carregou()) return erro('Espere carregar as fotos (precisa de sinal).');
      const l = fts.salvas();
      if (l.length < fts.tem() || !l.every(x => podeApagarFotoQZ(doc, x))) return erro('Este lançamento tem fotos: só o líder da área ou o administrador pode apagar (foto já exportada, só o administrador).');
      if (!ap.dataset.conf) { ap.dataset.conf = '1'; ap.innerHTML = `${I.lixo} Confirmar: apagar com ${l.length} foto${l.length > 1 ? 's' : ''}`; return; }
      ap.disabled = true;
      DB.apagarFotosQZ(doc.id, doc.area, key, l, true).then(() => {
        delete doc.qz[key]; DB.log(`Queda zero · ${rotulo0} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → apagada (com ${l.length} foto${l.length > 1 ? 's' : ''})`);
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
