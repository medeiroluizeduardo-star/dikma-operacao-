// Dikma Gestão — módulo SEGURANÇA: registros de interação e de anomalia (os mesmos formulários do Google, na mesma
// ordem), fila das anomalias com o acompanhamento, painel do mês, Excel e as listas (Administração › Segurança).
// Carregado sob demanda (nucleo/modulos.js). As abas ficam em navegacao.js; quem vê e quem trata, em segcalc.js;
// o banco, em data.js (seginter, seganom, segfotos e config/seguranca).
// Celular primeiro: o formulário ocupa a tela inteira, guarda o rascunho no aparelho enquanto a pessoa preenche e
// funciona sem sinal (o registro e as fotos ficam na fila do aparelho e sobem quando a conexão voltar).
import { MESES_L, SETS, add, addMonth, today } from '../contas/cal.js';
import { campoBusca } from '../busca.js';
import { baixarExcel, dataBR } from '../exportar.js';
import { ESQUELETO } from '../movimento.js';
import { listasSeg, conjDaArea, perfilSeg, supConjs, registraSeg, trataTudoSeg, trataAnom, editaProprio, STATUS_SEG, abertaSeg, vencidaSeg, comigoSeg, diasTratamento, indicadoresSeg, normNomeSeg, SEG_PADRAO, PRAZO_EDICAO_H, fotosDoReg } from '../contas/segcalc.js';
import { DB, framed, esc, title, $ } from '../nucleo/base.js';
import { ME, UI, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast, formSheet } from '../ui/janelas.js';
import { render, schedule, isMobile } from '../ui/shell.js';
import { carregarImg, jpeg, verFotoGrande } from '../ui/fotos.js';

// ---- Perguntas dos formulários (ordem, textos e obrigatórias iguais aos do Google) ----
// t: date | time | text | area (texto longo) | radio (uma opção) | checks (várias) | fotos · obr: obrigatória
const P_DATA = { k: 'data', rot: 'DATA', t: 'date', obr: 1 };
const P_AREA = { k: 'area', rot: 'ÁREA', t: 'radio', ops: L => L.areas.map(a => a.nome), obr: 1 };
const P_LOCAL = { k: 'local', rot: 'LOCAL', t: 'text', obr: 1, max: 120, sug: 1, ajuda: 'Escolha uma rota da área ou escreva o local' };
const P_MAT = { k: 'mat', rot: 'MATRÍCULA', t: 'text', obr: 1, max: 30, num: 1 };
const P_FOTOS = { k: 'fotos', rot: 'REGISTRO FOTOGRÁFICO', t: 'fotos', obr: 1 };
const FORMS = {
  inter: {
    col: 'seginter', nome: 'Registro de interação', curto: 'interação',
    campos: [P_DATA, P_AREA, P_LOCAL,
      { k: 'tipoAtiv', rot: 'TIPO DE ATIVIDADE', t: 'radio', ops: L => L.tipos, obr: 1 },
      { k: 'risco', rot: 'HÁ RISCOS DE SO-PSIF ASSOCIADO? SE SIM, QUAL RISCO?', t: 'text', max: 500 },
      { k: 'desvios', rot: 'HOUVE DESVIOS? SE SIM, QUAL DESVIO?', t: 'checks', ops: L => L.desvios },
      { k: 'desc', rot: 'DESCRIÇÃO', t: 'area', max: 3000 },
      { k: 'acao', rot: 'AÇÃO IMEDIATA', t: 'area', max: 3000 },
      { k: 'resp', rot: 'RESPONSÁVEL', t: 'text', obr: 1, max: 120, eu: 1 },
      P_MAT, P_FOTOS]
  },
  anom: {
    col: 'seganom', nome: 'Registro de anomalia', curto: 'anomalia',
    campos: [P_DATA, { k: 'hora', rot: 'HORA', t: 'time', obr: 1 }, P_AREA, P_LOCAL,
      { k: 'regime', rot: 'REGIME DE TRABALHO', t: 'radio', ops: L => L.regimes, obr: 1 },
      { k: 'desc', rot: 'DESCRIÇÃO', t: 'area', obr: 1, max: 3000 },
      { k: 'conseq', rot: 'CONSEQUÊNCIA', ajuda: 'QUAL PERDA ESSA ANOMALIA PODE CAUSAR?', t: 'area', obr: 1, max: 3000 },
      { k: 'acao', rot: 'AÇÃO IMEDIATA', t: 'area', obr: 1, max: 3000 },
      { k: 'causas', rot: 'POSSÍVEIS CAUSAS', t: 'area', obr: 1, max: 3000 },
      { k: 'sugest', rot: 'SUGESTÕES', ajuda: 'O QUE PODE SER FEITO PARA MELHORAR?', t: 'area', obr: 1, max: 3000 },
      { k: 'comunic', rot: 'COMUNICADO POR?', t: 'text', obr: 1, max: 120, eu: 1 },
      P_MAT, P_FOTOS]
  }
};
const MAX_FOTOS = 5;

export function criarSeguranca() {
  const U = UI.sg;
  const S = () => DB.cache.seg;
  const L = () => listasSeg(S().cfg);
  const hoje = () => today();
  const podeRegistrar = () => registraSeg(ME);
  const podeExportar = () => !framed;
  const mesNome = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
  const opcoesMes = () => { const l = []; for (let i = 0; i < 13; i++) l.push(addMonth(hoje().slice(0, 7), -i)); return l; };
  const dm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
  const dBR = s => dataBR(s);
  const nomeP = s => title(String(s || '').trim());
  const curtoNome = s => { const p = nomeP(s).split(/\s+/).filter(Boolean); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : p.join(' '); };
  const umDia = ms => { const d = new Date(+ms); return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const pillSit = a => (vencidaSeg(a, hoje()) ? '<span class="pill bad">Prazo vencido</span>' : a.status === 'concluida' ? '<span class="pill ok">Concluída</span>' : a.status === 'tratamento' ? '<span class="pill warn">Em tratamento</span>' : '<span class="pill neu">Aberta</span>');
  const minis = (r, n = 3) => (r.fotos || []).slice(0, n).map((id, i) => ((r.minis || [])[i] ? `<button type="button" class="sgmini" data-act="sgFoto" data-id="${esc(id)}" data-i="${i}" data-reg="${esc(r.id)}" aria-label="Ver a foto ${i + 1}"><img src="${(r.minis || [])[i]}" alt=""></button>` : '')).join('') + ((r.fotos || []).length > n ? `<span class="muted small">+${r.fotos.length - n}</span>` : '');
  const vazio = (t, s, bt = '') => `<div class="empty"><b>${t}</b><span>${s}</span>${bt}</div>`;
  const casaQ = (r, campos) => { const q = normNomeSeg(U.q); if (!q) return true; const t = normNomeSeg(campos.map(k => [].concat(r[k] || []).join(' ')).join(' ')); return q.split(' ').every(p => t.includes(p)); };
  const porData = (a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')) || (+b.em || 0) - (+a.em || 0);

  // ---------- rascunho no aparelho ----------
  const chaveR = tipo => `dikma-seg-rasc|${tipo}|${ME ? ME.uid : ''}`;
  const lerRasc = tipo => { try { return JSON.parse(localStorage.getItem(chaveR(tipo)) || 'null'); } catch (e) { return null; } };
  const apagarRasc = tipo => { try { localStorage.removeItem(chaveR(tipo)); } catch (e) { /* ignora */ } };
  function gravarRasc(tipo, v, fotos) {
    const x = { v, fotos, em: Date.now() };
    try { localStorage.setItem(chaveR(tipo), JSON.stringify(x)); return true; } catch (e) {
      try { localStorage.setItem(chaveR(tipo), JSON.stringify({ ...x, fotos: [], semFotos: fotos.length })); } catch (e2) { /* sem espaço */ }
      return false;
    }
  }
  const matGuardada = () => { try { return localStorage.getItem('dikma-seg-mat|' + (ME ? ME.uid : '')) || ''; } catch (e) { return ''; } };
  // Matrícula de quem está logado: a última usada neste aparelho; senão, a da ficha com o mesmo nome.
  function minhaMat() {
    const m = matGuardada(); if (m) return m;
    const n = normNomeSeg(ME && ME.nome); if (!n) return '';
    const fichas = [...((DB.cache.g && DB.cache.g.colabs) || []), ...((DB.cache.adm && DB.cache.adm.rh) || [])];
    const f = fichas.find(c => c && c.mat && normNomeSeg(c.nome) === n);
    return f ? String(f.mat) : '';
  }

  // ---------- fotos: reduzidas no aparelho (JPEG ~1280 px e miniatura ~320 px) ----------
  async function reduzirFoto(file) {
    if (!/^image\//.test(file.type || 'image/')) throw new Error('Escolha uma foto (imagem).');
    const im = await carregarImg(file);
    let lado = 1280, q = 0.7, dados = jpeg(im, lado, q);
    while (dados.length > 650000 && (q > 0.4 || lado > 640)) { if (q > 0.4) q -= 0.1; else lado = Math.round(lado * 0.8); dados = jpeg(im, lado, q); }
    return { dados, mini: jpeg(im, 320, 0.6) };
  }
  // Foto grande, ao tocar na miniatura (carrega só ela; ui/fotos.js).
  const verFoto = (id, mini) => verFotoGrande(() => DB.segFoto(id), mini, 'Registro fotográfico');

  // ---------- janela (folha) própria: tela cheia no celular ----------
  // Fecha no X, no Cancelar, no fundo e com Esc; o Voltar do celular também fecha (eventos.js cuida do #layer).
  function folha({ titulo, sub = '', corpo, rodape = '', form = false, aoFechar, larga = true }) {
    const Lr = $('layer');
    Lr.innerHTML = `<div class="scrim" id="scrim"><${form ? 'form novalidate' : 'div'} class="sheet sgsheet${larga ? ' wide' : ''}" id="sgSheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="sgs-top"><div class="minw"><h3>${esc(titulo)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button type="button" class="btn ghost sgs-x" data-sgclose aria-label="Fechar">✕</button></div><div class="sgs-corpo">${corpo}</div>${rodape ? `<div class="sgs-pe">${rodape}</div>` : ''}</${form ? 'form' : 'div'}></div>`;
    const kd = e => { if (e.key === 'Escape' && !document.querySelector('.sgfoto')) fechar(); };
    function fechar() { if (!Lr.querySelector('#sgSheet')) return; Lr.innerHTML = ''; document.removeEventListener('keydown', kd); if (aoFechar) aoFechar(); }
    document.addEventListener('keydown', kd);
    const sc = $('scrim');
    sc.onclick = e => {
      e.stopPropagation();
      if (e.target.id === 'scrim' || e.target.closest('[data-sgclose]')) return fechar();
      const f = e.target.closest('[data-act="sgFoto"]'); if (f) { verFoto(f.dataset.id, (f.querySelector('img') || {}).src); return; }
      const b = e.target.closest('[data-sgf]'); if (b && folhaAcao) folhaAcao(b);
    };
    return { el: $('sgSheet'), fechar };
  }
  let folhaAcao = null;

  // ---------- formulário de registro (novo ou correção do autor) ----------
  let F = null; // { tipo, reg, fotos: [{dados, mini}], salvarT }
  function campoHtml(c, i, v, cfg) {
    const id = 'sgf_' + c.k; const L0 = cfg;
    let ctl = '';
    if (c.t === 'date' || c.t === 'time') ctl = `<input class="in" type="${c.t}" id="${id}" value="${esc(v || '')}" ${c.t === 'date' ? `max="${add(hoje(), 1)}"` : ''}>`;
    else if (c.t === 'text') ctl = `<input class="in" id="${id}" value="${esc(v || '')}" maxlength="${c.max || 200}" autocomplete="off" ${c.num ? 'inputmode="numeric"' : ''} ${c.sug ? `list="sgl_${c.k}"` : ''}>${c.sug ? `<datalist id="sgl_${c.k}"></datalist>` : ''}`;
    else if (c.t === 'area') ctl = `<textarea class="in" id="${id}" rows="3" maxlength="${c.max || 3000}">${esc(v || '')}</textarea>`;
    else if (c.t === 'radio') ctl = `<div class="sgops" role="radiogroup" aria-labelledby="sgr_${c.k}">${c.ops(L0).map(o => `<label class="sgop"><input type="radio" name="${id}" value="${esc(o)}" ${o === v ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    else if (c.t === 'checks') { const sel = new Set(v || []); ctl = `<div class="sgops chk" role="group" aria-labelledby="sgr_${c.k}">${c.ops(L0).map(o => `<label class="sgop"><input type="checkbox" name="${id}" value="${esc(o)}" ${sel.has(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div><label class="sel sgoutro" id="sgOutroW" ${sel.has('OUTROS') ? '' : 'hidden'}><span>Qual outro desvio?</span><input class="in" id="sgf_desvioOutro" maxlength="200" value="${esc((F && F.outro) || '')}"></label>`; }
    else if (c.t === 'fotos') ctl = F.reg ? `<div class="sgfotos">${minis(F.reg, 9)}</div><p class="muted small m0">As fotos já enviadas não mudam na correção.</p>` : `<div class="sgfotos" id="sgFotosL"></div><div class="row-gap"><label class="btn" for="sgf_fotos_in">${I.cam} Tirar ou escolher foto</label><span class="muted small">Até ${MAX_FOTOS} fotos · reduzidas no aparelho</span></div><input type="file" id="sgf_fotos_in" accept="image/*" multiple hidden>`;
    return `<div class="sgq" id="q_${c.k}"><div class="sgq-rot" id="sgr_${c.k}"><span class="sgq-n">${i + 1}</span><span class="minw"><b>${esc(c.rot)}</b>${c.obr ? '<span class="obr" title="Obrigatória"> *</span>' : ''}${c.ajuda ? `<small>${esc(c.ajuda)}</small>` : ''}</span></div>${ctl}<p class="sgq-erro" id="e_${c.k}" role="alert" hidden></p></div>`;
  }
  const valorDe = (c, raiz = document) => {
    const id = 'sgf_' + c.k;
    if (c.t === 'radio') { const x = raiz.querySelector(`input[name="${id}"]:checked`); return x ? x.value : ''; }
    if (c.t === 'checks') return [...raiz.querySelectorAll(`input[name="${id}"]:checked`)].map(x => x.value);
    if (c.t === 'fotos') return null;
    const el = raiz.querySelector('#' + id); return el ? el.value.trim() : '';
  };
  const lerValores = def => { const o = {}; for (const c of def.campos) if (c.t !== 'fotos') o[c.k] = valorDe(c); if (def === FORMS.inter) o.desvioOutro = (($('sgf_desvioOutro') || {}).value || '').trim(); return o; };
  // Sugestões do LOCAL: as rotas da área (quem tem as Atividades) e os locais já usados nos registros da área.
  function sugestoesLocal(area) {
    const k = conjDaArea(S().cfg, area); const l = new Set();
    if (k && DB.dados) { const st = DB.dados(k); ((st && st.config && st.config.rotas) || []).forEach(r => r.rota && l.add(r.rota)); }
    [...S().inter, ...S().anom].filter(r => r.area === area && r.local).forEach(r => l.add(String(r.local).toUpperCase()));
    return [...l].sort();
  }
  function atualizarSugestoes() {
    const dl = $('sgl_local'); if (!dl) return; const area = valorDe(P_AREA);
    dl.innerHTML = (area ? sugestoesLocal(area) : []).map(x => `<option value="${esc(x)}"></option>`).join('');
  }
  function pintarFotos() {
    const l = $('sgFotosL'); if (!l || !F) return;
    l.innerHTML = F.fotos.map((f, i) => `<div class="sgfth"><img src="${f.mini}" alt="Foto ${i + 1}"><button type="button" class="btn sm ghost" data-sgf="tirarFoto" data-i="${i}" aria-label="Tirar a foto ${i + 1}">✕</button></div>`).join('') || '<p class="muted small m0">Nenhuma foto ainda.</p>';
    const b = document.querySelector('label[for="sgf_fotos_in"]'); if (b) b.classList.toggle('dis', F.fotos.length >= MAX_FOTOS);
  }
  function abrirForm(tipo, reg) {
    const def = FORMS[tipo]; if (!def) return;
    if (!reg && !podeRegistrar()) { toast('Seu perfil não registra na Segurança'); return; }
    const rasc = reg ? null : lerRasc(tipo);
    const padrao = { data: hoje(), hora: new Date().toTimeString().slice(0, 5), resp: ME ? title(ME.nome || ME.login || '') : '', comunic: ME ? title(ME.nome || ME.login || '') : '', mat: minhaMat(), desvios: [] };
    const v = reg ? { ...reg } : { ...padrao, ...((rasc && rasc.v) || {}) };
    F = { tipo, reg: reg || null, fotos: reg ? [] : ((rasc && rasc.fotos) || []), outro: v.desvioOutro || '' };
    const cfg = L();
    const aviso = rasc ? `<div class="sgrasc" role="status">${I.ok}<span>Rascunho recuperado de ${umDia(rasc.em)}${rasc.semFotos ? ` · as ${rasc.semFotos} foto(s) não couberam no aparelho, escolha de novo` : ''}.</span><button type="button" class="btn sm ghost" data-sgf="descartar">Descartar rascunho</button></div>` : '';
    const corpo = `${aviso}${reg ? `<p class="muted small m0">Correção do seu registro: vale por ${PRAZO_EDICAO_H} horas depois de enviado${tipo === 'anom' ? ' e enquanto a anomalia estiver aberta' : ''}.</p>` : '<p class="muted small m0">* obrigatória · o rascunho fica guardado neste aparelho enquanto você preenche.</p>'}
      ${def.campos.map((c, i) => campoHtml(c, i, v[c.k], cfg)).join('')}`;
    const rodape = `<p class="err" id="sgErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri big" type="submit">${reg ? 'Salvar correção' : 'Enviar registro'}</button><button class="btn" type="button" data-sgclose>${reg ? 'Cancelar' : 'Fechar e guardar rascunho'}</button></div>`;
    const fo = folha({ titulo: reg ? `Corrigir ${def.curto}` : def.nome, sub: reg ? `${dBR(reg.data)} · ${esc(reg.local || '')}` : 'Segurança', corpo, rodape, form: true, aoFechar: () => { if (F && !F.enviado && !F.reg && F.mexeu) toast('Rascunho guardado neste aparelho'); F = null; } });
    const el = fo.el;
    pintarFotos(); atualizarSugestoes();
    const salvarLogo = () => { if (!F || F.reg) return; F.mexeu = true; clearTimeout(F.salvarT); F.salvarT = setTimeout(() => { if (F) gravarRasc(tipo, lerValores(def), F.fotos); }, 250); };
    el.addEventListener('input', e => { if (e.target.id === 'sgf_fotos_in') return; limparErro(e.target); salvarLogo(); });
    el.addEventListener('change', async e => {
      const t = e.target;
      if (t.id === 'sgf_fotos_in') {
        const fs = [...t.files]; t.value = '';
        if (F.fotos.length + fs.length > MAX_FOTOS) toast(`No máximo ${MAX_FOTOS} fotos por registro`);
        for (const f of fs.slice(0, Math.max(0, MAX_FOTOS - F.fotos.length))) { try { F.fotos.push(await reduzirFoto(f)); } catch (err) { toast(err.message || 'Não foi possível usar esta foto'); } }
        pintarFotos(); limparErro($('sgFotosL')); F.mexeu = true; gravarRasc(tipo, lerValores(def), F.fotos); return;
      }
      if (t.name === 'sgf_area') atualizarSugestoes();
      if (t.name === 'sgf_desvios') { const w = $('sgOutroW'); if (w) w.hidden = !el.querySelector('input[name="sgf_desvios"][value="OUTROS"]:checked'); }
      limparErro(t); salvarLogo();
    });
    folhaAcao = b => {
      if (b.dataset.sgf === 'tirarFoto') { F.fotos.splice(+b.dataset.i, 1); pintarFotos(); gravarRasc(tipo, lerValores(def), F.fotos); }
      if (b.dataset.sgf === 'descartar') { apagarRasc(tipo); F.mexeu = false; fo.fechar(); abrirForm(tipo); }
    };
    el.onsubmit = e => { e.preventDefault(); enviar(def, fo); };
    if (!isMobile()) { const p = el.querySelector('input:not([type=hidden]),textarea'); if (p) p.focus(); }
  }
  function limparErro(t) {
    const q = t && t.closest && t.closest('.sgq'); if (!q) return;
    q.classList.remove('inval'); const m = q.querySelector('.sgq-erro'); if (m) m.hidden = true;
    q.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
  }
  // Confere as obrigatórias: mensagem em cada pergunta e um resumo no rodapé; leva até a primeira que falta.
  function validar(def, v) {
    const faltam = [];
    for (const c of def.campos) {
      let msg = '';
      if (c.t === 'fotos') { if (c.obr && !F.reg && !F.fotos.length) msg = 'Adicione pelo menos uma foto.'; }
      else if (c.obr && (Array.isArray(v[c.k]) ? !v[c.k].length : !v[c.k])) msg = c.t === 'radio' ? 'Escolha uma opção.' : 'Preencha este campo.';
      else if (c.t === 'date' && v[c.k] && !/^\d{4}-\d{2}-\d{2}$/.test(v[c.k])) msg = 'Data inválida.';
      else if (c.t === 'date' && v[c.k] > add(hoje(), 1)) msg = 'A data não pode ser no futuro.';
      if (c.t === 'checks' && (v.desvios || []).includes('OUTROS') && !v.desvioOutro) msg = 'Escreva qual é o outro desvio.';
      const q = $('q_' + c.k), e = $('e_' + c.k);
      if (q) q.classList.toggle('inval', !!msg); if (e) { e.textContent = msg; e.hidden = !msg; }
      if (q) q.querySelectorAll('input:not([type=hidden]),textarea').forEach(x => { if (msg) x.setAttribute('aria-invalid', 'true'); else x.removeAttribute('aria-invalid'); });
      if (msg) faltam.push(c);
    }
    const er = $('sgErr');
    if (faltam.length) {
      er.textContent = `Falta${faltam.length > 1 ? 'm' : ''} ${faltam.length} ${faltam.length > 1 ? 'perguntas obrigatórias' : 'pergunta obrigatória'}: ${faltam.map(c => c.rot.split('?')[0]).join(', ')}.`; er.hidden = false;
      const q = $('q_' + faltam[0].k); if (q) { q.scrollIntoView({ block: 'center' }); const x = q.querySelector('input:not([type=hidden]),textarea'); if (x && x.type !== 'file') x.focus({ preventScroll: true }); }
      return false;
    }
    er.hidden = true; return true;
  }
  function enviar(def, fo) {
    const v = lerValores(def);
    if (!validar(def, v)) return;
    const t = (x, n) => String(x || '').trim().slice(0, n);
    const dados = {};
    for (const c of def.campos) if (c.t !== 'fotos') dados[c.k] = Array.isArray(v[c.k]) ? v[c.k] : t(v[c.k], c.max || 120);
    dados.local = dados.local.toUpperCase(); dados.mes = dados.data.slice(0, 7); dados.conj = conjDaArea(S().cfg, dados.area);
    if (def === FORMS.inter) dados.desvioOutro = dados.desvios.includes('OUTROS') ? t(v.desvioOutro, 200) : '';
    try { localStorage.setItem('dikma-seg-mat|' + ME.uid, dados.mat); } catch (e) { /* ignora */ }
    const offline = !navigator.onLine;
    if (F.reg) {
      DB.segEditar(def.col, F.reg.id, dados);
      toast(`Correção salva${offline ? ' · sobe quando o sinal voltar' : ''}`);
    } else {
      DB.segNovo(def.col, def === FORMS.anom ? { ...dados, status: 'aberta' } : dados, F.fotos);
      apagarRasc(F.tipo);
      toast(`${def === FORMS.anom ? 'Anomalia registrada' : 'Interação registrada'}${offline ? ' · guardada no aparelho, sobe quando o sinal voltar' : ''}`);
      if (dados.mes !== U.mes) { U.mes = dados.mes; DB.segWatch([U.mes]); }
    }
    F.enviado = true; fo.fechar(); render();
  }

  // ---------- detalhe do registro ----------
  const linhaDet = (rot, v) => `<div><dt>${esc(rot)}</dt><dd>${v || '<span class="muted">—</span>'}</dd></div>`;
  const acharReg = (col, id) => (col === 'seginter' ? S().inter : S().anom).find(r => r.id === id);
  function abrirDetalhe(col, id) {
    const r = acharReg(col, id); if (!r) { toast('Registro não encontrado'); return; }
    const tipo = col === 'seginter' ? 'inter' : 'anom'; const def = FORMS[tipo];
    const txt = s => esc(s || '').replace(/\n/g, '<br>');
    let corpo = `<dl class="sgdet">${def.campos.map(c => linhaDet(c.rot, c.t === 'fotos' ? `<div class="sgfotos">${minis(r, 9)}</div>` : c.t === 'date' ? dBR(r[c.k]) : c.t === 'checks' ? ((r.desvios || []).length ? (r.desvios || []).map(d => `<span class="pill neu">${esc(d === 'OUTROS' && r.desvioOutro ? 'OUTROS: ' + r.desvioOutro : d)}</span>`).join(' ') : 'Não') : txt(r[c.k]))).join('')}</dl>
      <p class="muted small m0">Registrado por ${esc(nomeP(r.porNome))}${r.em ? ' em ' + umDia(r.em) : ''}.</p>`;
    let botoes = '';
    if (tipo === 'anom') {
      const tr = r.trat || {};
      corpo += `<div class="sgtrat"><h4>Acompanhamento</h4><dl class="sgdet">${linhaDet('Situação', pillSit(r))}${linhaDet('Responsável pelo tratamento', esc(nomeP(tr.resp)))}${linhaDet('Prazo', tr.prazo ? `${dBR(tr.prazo)}${vencidaSeg(r, hoje()) ? ' <span class="pill bad">vencido</span>' : ''}` : '')}${linhaDet('Comentário do tratamento', txt(tr.coment))}${linhaDet('Foto do depois', tr.fotoDepois ? `<div class="sgfotos"><button type="button" class="sgmini" data-act="sgFoto" data-id="${esc(tr.fotoDepois)}" aria-label="Ver a foto do depois">${tr.miniDepois ? `<img src="${tr.miniDepois}" alt="">` : 'Ver'}</button></div>` : '')}${r.status === 'concluida' && r.conclEm ? linhaDet('Concluída em', `${umDia(Date.parse(r.conclEm))}${diasTratamento(r) != null ? ` · ${fmtDias(diasTratamento(r))} de tratamento` : ''}`) : ''}</dl>
        ${(tr.hist || []).length ? `<details class="sghist"><summary>Histórico (${tr.hist.length})</summary><ol>${tr.hist.slice().reverse().map(h => `<li><time>${umDia(Date.parse(h.em))}</time> <b>${esc(curtoNome(h.nome))}</b> · ${esc(h.t)}</li>`).join('')}</ol></details>` : ''}</div>`;
      if (trataAnom(ME, r)) botoes += `<button type="button" class="btn pri" data-sgf="tratar">${r.status === 'concluida' ? 'Reabrir ou ajustar' : 'Acompanhar'}</button>`;
    }
    if (editaProprio(ME, r, Date.now(), tipo === 'anom')) botoes += `<button type="button" class="btn" data-sgf="editar">Corrigir</button>`;
    // Apagar: só o administrador (as regras também conferem). Leva as fotos do registro junto.
    if (isAdmin()) botoes += `<button type="button" class="btn danger" data-sgf="excluir">Excluir</button>`;
    const fo = folha({ titulo: tipo === 'anom' ? 'Anomalia' : 'Interação', sub: `${dBR(r.data)}${r.hora ? ' às ' + esc(r.hora) : ''} · ${esc(r.area)} · ${esc(r.local)}`, corpo, rodape: `<div class="row-gap">${botoes}<button type="button" class="btn" data-sgclose>Fechar</button></div>` });
    folhaAcao = b => { if (b.dataset.sgf === 'tratar') { fo.fechar(); abrirTratar(r.id); } if (b.dataset.sgf === 'editar') { fo.fechar(); abrirForm(tipo, r); } if (b.dataset.sgf === 'excluir') { fo.fechar(); confirmarExclusao(col, r); } };
  }
  // Confirmação clara antes de apagar o registro e as fotos dele (não dá para desfazer).
  function confirmarExclusao(col, r) {
    if (!isAdmin()) return;
    const anom = col === 'seganom'; const n = fotosDoReg(r).length; const nome = anom ? 'esta anomalia' : 'esta interação';
    const fotos = n ? ` e ${n === 1 ? 'a foto' : `as ${n} fotos`}` : '';
    formSheet(anom ? 'Excluir anomalia' : 'Excluir interação', `${dBR(r.data)} · ${esc(r.area)} · ${esc(r.local)}`,
      `<p class="m0"><b>Excluir ${nome}${fotos}?</b> Não dá para desfazer.</p>${anom && abertaSeg(r) ? '<p class="muted small m0">Ela ainda está em aberto: some da fila e dos indicadores.</p>' : ''}`,
      'Excluir', async () => {
        await DB.segExcluir(col, r);
        DB.log(`Segurança: excluiu ${anom ? 'uma anomalia' : 'uma interação'} de ${dBR(r.data)}${n ? ` (${n} foto${n > 1 ? 's' : ''})` : ''}`);
        toast(`${anom ? 'Anomalia excluída' : 'Interação excluída'}${n ? ` com ${n === 1 ? 'a foto' : `as ${n} fotos`}` : ''}`); render();
      });
    const b = document.querySelector('#fSheet [type=submit]'); if (b) { b.classList.remove('pri'); b.classList.add('perigo'); }
  }
  const fmtDias = d => (d < 1 ? 'menos de 1 dia' : `${Math.round(d).toLocaleString('pt-BR')} dia${Math.round(d) === 1 ? '' : 's'}`);

  // ---------- acompanhamento da anomalia (quem trata e o supervisor da área) ----------
  // Pessoas para o responsável: quem já registrou ou tratou, os usuários (administrador) e as fichas/efetivo carregados.
  function pessoas() {
    const m = new Map(); const put = (nome, uid, d) => { const k = normNomeSeg(nome); if (!k) return; const x = m.get(k) || { nome: nomeP(nome), uid: '', d: '' }; if (uid && !x.uid) x.uid = uid; if (d && !x.d) x.d = d; m.set(k, x); };
    if (ME) put(ME.nome || ME.login, ME.uid, 'Você');
    for (const u of DB.cache.usuarios || []) if (u.papel !== 'bloqueado' && (perfilSeg(u) || supConjs(u).length)) put(u.nome, u.uid, 'Usuário do sistema');
    for (const r of [...S().inter, ...S().anom]) { put(r.porNome, r.por, 'Registrou na Segurança'); if (r.trat && r.trat.resp) put(r.trat.resp, r.trat.respUid, 'Já tratou anomalias'); }
    for (const c of (DB.cache.g && DB.cache.g.colabs) || []) if (!c.dem) put(c.nome, '', [c.funcao, c.mat].filter(Boolean).join(' · '));
    for (const k of Object.keys(SETS)) { const st = DB.dados && DB.dados(k); for (const l of Object.values((st && st.colabs) || {})) for (const c of l) put(c.nome, '', [c.funcao, c.rota].filter(Boolean).join(' · ')); }
    return m;
  }
  const histNovo = t => ({ em: new Date().toISOString(), por: ME.uid, nome: ME.nome || ME.login || '', t });
  function salvarTrat(a, novo, foto) {
    const antes = a.trat || {}; const hist = [...(antes.hist || [])];
    if (novo.status !== a.status) hist.push(histNovo(`Situação: ${STATUS_SEG[a.status] || a.status} → ${STATUS_SEG[novo.status]}`));
    if (normNomeSeg(novo.resp) !== normNomeSeg(antes.resp)) hist.push(histNovo(`Responsável: ${nomeP(novo.resp) || '—'}`));
    if ((novo.prazo || '') !== (antes.prazo || '')) hist.push(histNovo(`Prazo: ${novo.prazo ? dBR(novo.prazo) : '—'}`));
    if ((novo.coment || '') !== (antes.coment || '')) hist.push(histNovo('Comentário do tratamento atualizado'));
    if (foto) hist.push(histNovo('Foto do depois anexada'));
    const trat = { resp: novo.resp || '', respUid: novo.respUid || '', prazo: novo.prazo || '', coment: novo.coment || '', fotoDepois: antes.fotoDepois || '', miniDepois: antes.miniDepois || '', hist: hist.slice(-150) };
    DB.segTratar(a, { status: novo.status, trat, conclEm: novo.status === 'concluida' ? (a.status === 'concluida' && a.conclEm ? a.conclEm : new Date().toISOString()) : '' }, foto);
  }
  function assumir(id) {
    const a = S().anom.find(x => x.id === id); if (!a || !trataAnom(ME, a)) return;
    const tr = a.trat || {};
    salvarTrat(a, { status: a.status === 'aberta' ? 'tratamento' : a.status, resp: title(ME.nome || ME.login || ''), respUid: ME.uid, prazo: tr.prazo || '', coment: tr.coment || '' });
    toast('Anomalia com você · em tratamento'); render();
  }
  function abrirTratar(id) {
    const a = S().anom.find(x => x.id === id); if (!a || !trataAnom(ME, a)) return;
    const tr = a.trat || {}; let foto = null;
    const pes = pessoas();
    const opcoes = () => [...pes.values()].map(p => ({ v: p.nome, t: p.nome, d: p.d }));
    const corpo = `<div class="sgresumo"><div><b>${esc(a.local)}</b> · ${esc(a.area)} · ${dBR(a.data)}</div><p class="m0">${esc(a.desc)}</p></div>
      <div class="sgq"><div class="sgq-rot"><span class="minw"><b>Situação</b></span></div><div class="sgops" role="radiogroup" aria-label="Situação">${Object.entries(STATUS_SEG).map(([k, n]) => `<label class="sgop"><input type="radio" name="sgt_st" value="${k}" ${a.status === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      <div class="sgq"><div class="sgq-rot"><span class="minw"><b>Responsável pelo tratamento</b><small>Busque no efetivo e nos usuários ou escreva o nome</small></span></div>${campoBusca('sgt_resp', nomeP(tr.resp), opcoes, { livre: true, placeholder: 'Nome de quem vai tratar' })}<button type="button" class="btn sm ghost" data-sgf="souEu" style="align-self:flex-start">Sou eu</button></div>
      <label class="sel"><span>Prazo</span><input class="in" type="date" id="sgt_prazo" value="${esc(tr.prazo || '')}"></label>
      <label class="sel"><span>Comentário do tratamento</span><textarea class="in" id="sgt_coment" rows="3" maxlength="3000">${esc(tr.coment || '')}</textarea></label>
      <div class="sgq" id="q_depois"><div class="sgq-rot"><span class="minw"><b>Foto do depois</b><small>Obrigatória para concluir</small></span></div><div class="sgfotos" id="sgtFoto">${tr.fotoDepois ? `<button type="button" class="sgmini" data-act="sgFoto" data-id="${esc(tr.fotoDepois)}" aria-label="Ver a foto do depois">${tr.miniDepois ? `<img src="${tr.miniDepois}" alt="">` : 'Ver'}</button>` : ''}</div><div class="row-gap"><label class="btn" for="sgt_foto_in">${I.cam} ${tr.fotoDepois ? 'Trocar a foto do depois' : 'Tirar ou escolher foto'}</label></div><input type="file" id="sgt_foto_in" accept="image/*" hidden><p class="sgq-erro" id="e_depois" role="alert" hidden></p></div>`;
    const fo = folha({ titulo: 'Acompanhamento', sub: 'Anomalia · só quem trata altera', corpo, form: true, rodape: '<p class="err" id="sgErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri big" type="submit">Salvar acompanhamento</button><button class="btn" type="button" data-sgclose>Cancelar</button></div>' });
    const el = fo.el;
    el.addEventListener('change', async e => {
      if (e.target.id !== 'sgt_foto_in') return;
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { foto = await reduzirFoto(f); $('sgtFoto').innerHTML = `<div class="sgfth"><img src="${foto.mini}" alt="Foto do depois"></div>`; const m = $('e_depois'); m.hidden = true; $('q_depois').classList.remove('inval'); } catch (err) { toast(err.message || 'Não foi possível usar esta foto'); }
    });
    folhaAcao = b => { if (b.dataset.sgf === 'souEu') { const q = $('sgt_resp_q'), h = $('sgt_resp'); q.value = h.value = title(ME.nome || ME.login || ''); } };
    el.onsubmit = e => {
      e.preventDefault();
      const st = (el.querySelector('input[name="sgt_st"]:checked') || {}).value || a.status;
      const resp = ($('sgt_resp').value || $('sgt_resp_q').value || '').trim();
      if (st === 'concluida' && !foto && !tr.fotoDepois) { const m = $('e_depois'); m.textContent = 'Para concluir, anexe a foto do depois.'; m.hidden = false; $('q_depois').classList.add('inval'); $('sgErr').textContent = 'Falta a foto do depois para concluir.'; $('sgErr').hidden = false; $('q_depois').scrollIntoView({ block: 'center' }); return; }
      const p = pes.get(normNomeSeg(resp));
      salvarTrat(a, { status: st, resp, respUid: p && p.uid ? p.uid : '', prazo: $('sgt_prazo').value, coment: $('sgt_coment').value.trim() }, foto);
      toast(st === 'concluida' ? 'Anomalia concluída' : 'Acompanhamento salvo'); fo.fechar(); render();
    };
  }

  // ---------- telas ----------
  const selMes = (id, v) => `<label class="sel"><span>Mês</span><select class="in" id="${id}">${opcoesMes().map(m => `<option value="${m}" ${m === v ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select></label>`;
  const selArea = () => `<label class="sel"><span>Área</span><select class="in" id="sgArea"><option value="">Todas</option>${L().areas.map(a => `<option ${a.nome === U.area ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>`;
  const busca = ph => `<label class="sel sgbusca"><span>Buscar</span><input class="in" type="search" id="sgQ" value="${esc(U.q)}" placeholder="${ph}" autocomplete="off"></label>`;
  const rascBanner = tipo => { const r = lerRasc(tipo); return r && podeRegistrar() ? `<div class="sgrasc" role="status">${I.ok}<span>Você tem um rascunho de ${FORMS[tipo].curto} de ${umDia(r.em)} guardado neste aparelho.</span><button type="button" class="btn sm pri" data-act="sgNova" data-tipo="${tipo}">Continuar</button></div>` : ''; };
  const quemVe = () => (trataTudoSeg(ME) || perfilSeg(ME) === 'leitor' ? 'todas as áreas' : supConjs(ME).length && !podeRegistrar() ? 'a sua área' : supConjs(ME).length ? 'os seus registros e os da sua área' : 'os registros feitos por você');

  function vInter() {
    DB.segWatch([U.mes]);
    const todas = S().inter.filter(r => r.mes === U.mes);
    const l = todas.filter(r => (!U.area || r.area === U.area) && casaQ(r, ['local', 'area', 'resp', 'desc', 'acao', 'risco', 'desvios', 'desvioOutro', 'tipoAtiv', 'mat'])).sort(porData);
    const ind = indicadoresSeg({ inter: l, anom: [], mes: U.mes, hoje: hoje() });
    let h = `<div class="filters">${selMes('sgMes', U.mes)}${selArea()}${busca('Local, responsável, desvio…')}
      ${podeExportar() ? `<button class="btn" data-act="expSegInter" style="align-self:flex-end">${I.dl} Exportar</button>` : ''}
      ${podeRegistrar() ? `<button class="btn pri" data-act="sgNova" data-tipo="inter" style="align-self:flex-end">${I.plus} Nova interação</button>` : ''}</div>`;
    h += rascBanner('inter');
    h += `<div class="kpis">
      <div class="kpi hero"><span class="lbl">Interações</span><span class="v num">${l.length}</span><span class="s">${mesNome(U.mes)} · ${quemVe()}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Com desvio</span><span class="v num">${ind.comDesvio}</span><span class="s">${l.length ? Math.round(ind.comDesvio / l.length * 100) : 0}% das interações</span></div>
      <div class="kpi"><span class="lbl">Desvio mais visto</span><span class="v vsm">${ind.desvios.length ? esc(ind.desvios[0][0]) : '—'}</span><span class="s">${ind.desvios.length ? `${ind.desvios[0][1]} vez${ind.desvios[0][1] > 1 ? 'es' : ''}` : 'nenhum desvio'}</span></div>
      <div class="kpi"><span class="lbl">Pessoas</span><span class="v num">${ind.porPessoa.length}</span><span class="s">responsáveis com registro</span></div></div>`;
    if (!l.length) return h + `<div class="card">${vazio(todas.length ? 'Nada encontrado com estes filtros' : `Nenhuma interação em ${mesNome(U.mes)}`, todas.length ? 'Mude a área ou a busca.' : podeRegistrar() ? 'Registre a primeira pelo botão Nova interação.' : 'Os registros aparecem aqui assim que forem feitos.', !todas.length && podeRegistrar() ? `<button class="btn pri" data-act="sgNova" data-tipo="inter">${I.plus} Nova interação</button>` : '')}</div>`;
    h += `<div class="card"><div class="tw"><table class="tcard sgtab"><thead><tr><th>Data</th><th>Local</th><th>Tipo</th><th>Desvios</th><th>Responsável</th><th>Fotos</th><th></th></tr></thead><tbody>
      ${l.map(r => `<tr><td data-l="Data" class="nowrap">${dm(r.data)}</td><td class="tc-t"><b>${esc(r.local)}</b><small class="muted"> · ${esc(r.area)}</small></td><td data-l="Tipo">${esc(r.tipoAtiv)}</td>
        <td class="tc-full" data-l="Desvios">${(r.desvios || []).length ? (r.desvios || []).map(d => `<span class="pill ${d === 'OUTROS' ? 'neu' : 'warn'}">${esc(d === 'OUTROS' && r.desvioOutro ? 'OUTROS: ' + r.desvioOutro : d)}</span>`).join(' ') : '<span class="muted small">Sem desvio</span>'}</td>
        <td data-l="Responsável">${esc(curtoNome(r.resp))}</td><td data-l="Fotos"><div class="sgfotos">${minis(r)}</div></td>
        <td class="tc-acao r"><button class="btn sm" data-act="sgVer" data-col="seginter" data-id="${esc(r.id)}">Abrir</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
    return h;
  }

  const SITS = [['abertas', 'Abertas'], ['vencidas', 'Vencidas'], ['comigo', 'Comigo'], ['concluidas', 'Concluídas'], ['todas', 'Todas']];
  function filtroSit(a) {
    const s = U.sit;
    if (s === 'abertas') return abertaSeg(a);
    if (s === 'vencidas') return vencidaSeg(a, hoje());
    if (s === 'comigo') return abertaSeg(a) && comigoSeg(ME, a);
    if (s === 'concluidas') return a.status === 'concluida' && (a.mes === U.mes || String(a.conclEm || '').slice(0, 7) === U.mes);
    return a.mes === U.mes || abertaSeg(a);
  }
  function vAnom() {
    DB.segWatch([U.mes]);
    if (!SITS.some(x => x[0] === U.sit)) U.sit = 'abertas';
    const base = S().anom.filter(a => !U.area || a.area === U.area);
    const l = base.filter(a => filtroSit(a) && casaQ(a, ['local', 'area', 'desc', 'conseq', 'acao', 'causas', 'sugest', 'comunic', 'mat'])).sort((a, b) => {
      const pa = vencidaSeg(a, hoje()) ? 0 : abertaSeg(a) ? 1 : 2, pb = vencidaSeg(b, hoje()) ? 0 : abertaSeg(b) ? 1 : 2;
      return pa - pb || (pa < 2 ? ((a.trat && a.trat.prazo) || '9999').localeCompare((b.trat && b.trat.prazo) || '9999') : 0) || porData(a, b);
    });
    const ab = base.filter(abertaSeg), venc = ab.filter(a => vencidaSeg(a, hoje())), sem = ab.filter(a => !(a.trat && a.trat.resp)), comigo = ab.filter(a => comigoSeg(ME, a));
    const ind = indicadoresSeg({ anom: base, mes: U.mes, hoje: hoje() });
    const cont = { abertas: ab.length, vencidas: venc.length, comigo: comigo.length };
    let h = `<div class="filters"><div class="sgsit" role="tablist" aria-label="Situação">${SITS.map(([k, n]) => `<button type="button" role="tab" data-act="sgSit" data-sgsit="${k}" aria-selected="${U.sit === k}">${n}${cont[k] ? ` <span class="badge num${k === 'vencidas' ? ' bad' : ''}">${cont[k]}</span>` : ''}</button>`).join('')}</div>
      ${['concluidas', 'todas'].includes(U.sit) ? selMes('sgMes', U.mes) : ''}${selArea()}${busca('Local, descrição, causa…')}
      ${podeExportar() ? `<button class="btn" data-act="expSegAnom" style="align-self:flex-end">${I.dl} Exportar</button>` : ''}
      ${podeRegistrar() ? `<button class="btn pri" data-act="sgNova" data-tipo="anom" style="align-self:flex-end">${I.plus} Nova anomalia</button>` : ''}</div>`;
    h += rascBanner('anom');
    h += `<div class="kpis">
      <div class="kpi hero"><span class="lbl">Em aberto</span><span class="v num">${ab.length}</span><span class="s">${ab.filter(a => a.status === 'tratamento').length} em tratamento · ${quemVe()}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Prazo vencido</span><span class="v num">${venc.length}</span><span class="s">${venc.length ? 'precisam de atenção' : 'nenhuma atrasada'}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Sem responsável</span><span class="v num">${sem.length}</span><span class="s">ninguém assumiu ainda</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-real)"></i>Concluídas</span><span class="v num">${ind.concluidasNoMes}</span><span class="s">em ${mesNome(U.mes)}</span></div>
      <div class="kpi"><span class="lbl">Tempo médio</span><span class="v vsm">${ind.tempoMedio == null ? '—' : fmtDias(ind.tempoMedio)}</span><span class="s">do registro à conclusão</span></div></div>`;
    if (!l.length) return h + `<div class="card">${vazio(U.sit === 'vencidas' ? 'Nenhuma anomalia com prazo vencido' : U.sit === 'comigo' ? 'Nenhuma anomalia com você' : U.sit === 'abertas' ? 'Nenhuma anomalia em aberto' : 'Nenhuma anomalia neste período', U.q || U.area ? 'Mude a área ou a busca.' : U.sit === 'abertas' ? 'Tudo tratado por aqui.' : 'Troque a situação ou o mês para ver outras.')}</div>`;
    h += `<div class="card"><div class="tw"><table class="tcard sgtab"><thead><tr><th>Data</th><th>Anomalia</th><th>Situação</th><th>Responsável</th><th>Prazo</th><th>Fotos</th><th></th></tr></thead><tbody>
      ${l.map(a => { const tr = a.trat || {}; const v = vencidaSeg(a, hoje()); const pode = trataAnom(ME, a);
        return `<tr class="${v ? 'sgvenc' : ''}"><td data-l="Data" class="nowrap">${dm(a.data)} <span class="muted small">${esc(a.hora || '')}</span></td>
        <td class="tc-t"><b>${esc(a.local)}</b><small class="muted"> · ${esc(a.area)}</small><div class="sgdesc">${esc(a.desc)}</div></td>
        <td data-l="Situação">${pillSit(a)}</td><td data-l="Responsável">${tr.resp ? esc(curtoNome(tr.resp)) : '<span class="muted small">ninguém</span>'}</td>
        <td data-l="Prazo" class="nowrap">${tr.prazo ? `<span class="${v ? 'bad b' : ''}">${dBR(tr.prazo)}</span>` : '<span class="muted small">—</span>'}</td>
        <td data-l="Fotos"><div class="sgfotos">${minis(a, 2)}${tr.miniDepois ? `<button type="button" class="sgmini depois" data-act="sgFoto" data-id="${esc(tr.fotoDepois)}" aria-label="Ver a foto do depois"><img src="${tr.miniDepois}" alt=""></button>` : ''}</div></td>
        <td class="tc-acao r nowrap">${pode && abertaSeg(a) && !tr.resp ? `<button class="btn sm pri" data-act="sgAssumir" data-id="${esc(a.id)}">Assumir</button> ` : ''}${pode ? `<button class="btn sm" data-act="sgTratar" data-id="${esc(a.id)}">${a.status === 'concluida' ? 'Ajustar' : 'Acompanhar'}</button> ` : ''}<button class="btn sm ghost" data-act="sgVer" data-col="seganom" data-id="${esc(a.id)}">Abrir</button></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    return h;
  }

  // Gráfico de colunas (SVG próprio): interações e anomalias por mês.
  function colunas(porMes) {
    const W = 560, H = 190, b = 26, top = 18, n = porMes.length || 1, gw = (W - 20) / n, bw = Math.min(26, gw / 3);
    const mx = Math.max(1, ...porMes.map(x => Math.max(x.inter, x.anom)));
    const y = v => H - b - (v / mx) * (H - b - top);
    const barras = porMes.map((x, i) => { const cx = 10 + gw * i + gw / 2; return `<g><rect x="${cx - bw - 2}" y="${y(x.inter)}" width="${bw}" height="${H - b - y(x.inter)}" rx="3" fill="var(--focus)"><title>${mesNome(x.mes)}: ${x.inter} interações</title></rect><rect x="${cx + 2}" y="${y(x.anom)}" width="${bw}" height="${H - b - y(x.anom)}" rx="3" fill="var(--st-atr)"><title>${mesNome(x.mes)}: ${x.anom} anomalias</title></rect>
      <text x="${cx - bw / 2 - 2}" y="${y(x.inter) - 4}" text-anchor="middle" class="sgsv-n">${x.inter || ''}</text><text x="${cx + bw / 2 + 2}" y="${y(x.anom) - 4}" text-anchor="middle" class="sgsv-n">${x.anom || ''}</text>
      <text x="${cx}" y="${H - 8}" text-anchor="middle" class="sgsv-x">${MESES_L[+x.mes.slice(5, 7) - 1].slice(0, 3)}</text></g>`; }).join('');
    return `<svg class="sgsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interações e anomalias por mês: ${porMes.map(x => `${mesNome(x.mes)} ${x.inter} e ${x.anom}`).join('; ')}"><line x1="0" x2="${W}" y1="${H - b}" y2="${H - b}" stroke="var(--line)"/>${barras}</svg>`;
  }
  const barras = (l, cor, total, fmt = title) => { const mx = l.length ? l[0][1] : 1; return `<div class="bars">${l.map(([n, v]) => `<div class="barrow"><span class="n">${esc(fmt(n))}${total ? `<small>${Math.round(v / total * 100)}%</small>` : ''}</span><div class="stack"><i style="width:${v / mx * 100}%;background:${cor}"></i></div><span class="p num">${v}</span></div>`).join('')}</div>`; };
  function vPainel() {
    const meses = []; for (let i = 5; i >= 0; i--) meses.push(addMonth(U.pMes, -i));
    DB.segWatch(meses);
    const inter = S().inter, anom = S().anom;
    const ind = indicadoresSeg({ inter, anom, mes: U.pMes, meses, hoje: hoje(), areas: L().areas.map(a => a.nome) });
    const ant = indicadoresSeg({ inter, anom, mes: addMonth(U.pMes, -1), hoje: hoje() });
    const dif = ind.interMes - ant.interMes;
    let h = `<div class="filters">${selMes('sgPMes', U.pMes)}<span class="muted small" style="align-self:flex-end">Contas com ${quemVe()}</span>${podeExportar() ? `<button class="btn" data-act="expSegTudo" style="align-self:flex-end">${I.dl} Exportar o mês</button>` : ''}</div>`;
    h += `<div class="kpis">
      <div class="kpi hero"><span class="lbl">Interações no mês</span><span class="v num">${ind.interMes}${ant.interMes || ind.interMes ? `<small class="dif ${dif >= 0 ? 'up' : 'down'}" title="Mês anterior: ${ant.interMes}">${dif === 0 ? '=' : dif > 0 ? '▲ ' + dif : '▼ ' + -dif}</small>` : ''}</span><span class="s">${ind.comDesvio} com desvio (${ind.interMes ? Math.round(ind.comDesvio / ind.interMes * 100) : 0}%)</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Anomalias do mês</span><span class="v num">${ind.anomMes}</span><span class="s">${ind.abertasMes} em aberto · ${ind.concluidasMes} concluída${ind.concluidasMes === 1 ? '' : 's'}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Em aberto agora</span><span class="v num">${ind.abertasAgora}</span><span class="s">${ind.vencidas} com prazo vencido</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-real)"></i>Concluídas no mês</span><span class="v num">${ind.concluidasNoMes}</span><span class="s">pela data da conclusão</span></div>
      <div class="kpi"><span class="lbl">Tempo médio de tratamento</span><span class="v vsm">${ind.tempoMedio == null ? '—' : fmtDias(ind.tempoMedio)}</span><span class="s">das concluídas no mês</span></div></div>`;
    h += `<div class="grid2"><div class="card"><header><h2>Por mês</h2><p>Últimos 6 meses</p></header><div class="body"><div class="legend"><span><i style="background:var(--focus)"></i>Interações</span><span><i style="background:var(--st-atr)"></i>Anomalias</span></div>${colunas(ind.porMes)}</div></div>
      <div class="card"><header><h2>Desvios mais frequentes</h2><p>${mesNome(U.pMes)} · nas interações</p></header><div class="body">${ind.desvios.length ? barras(ind.desvios.slice(0, 8), 'var(--st-nreal)', ind.interMes, x => x) : vazio('Nenhum desvio no mês', 'Os desvios marcados nas interações aparecem aqui.')}</div></div></div>`;
    h += `<div class="grid2"><div class="card"><header><h2>Interações por pessoa</h2><p>${mesNome(U.pMes)} · pelo responsável</p></header><div class="body">${ind.porPessoa.length ? barras(ind.porPessoa.slice(0, 10), 'var(--focus)') : vazio('Nenhuma interação no mês', 'Quem registra aparece aqui.')}</div></div>
      <div class="card"><header><h2>Por área</h2><p>${mesNome(U.pMes)} · anomalias abertas × concluídas</p></header><div class="body">${ind.porArea.some(x => x.inter || x.abertas || x.concluidas) ? `<div class="legend"><span><i style="background:var(--st-nreal)"></i>Abertas</span><span><i style="background:var(--st-real)"></i>Concluídas</span></div><div class="bars">${ind.porArea.map(x => { const t = Math.max(1, ...ind.porArea.map(z => z.abertas + z.concluidas)); return `<div class="barrow"><span class="n">${esc(title(x.area))}<small class="num">${x.inter} interaç${x.inter === 1 ? 'ão' : 'ões'}</small></span><div class="stack">${x.abertas ? `<i style="width:${x.abertas / t * 100}%;background:var(--st-nreal)" title="${x.abertas} abertas"></i>` : ''}${x.concluidas ? `<i style="width:${x.concluidas / t * 100}%;background:var(--st-real)" title="${x.concluidas} concluídas"></i>` : ''}</div><span class="p num">${x.abertas + x.concluidas}</span></div>`; }).join('')}</div>` : vazio('Nada registrado no mês', 'As áreas aparecem aqui quando houver registros.')}</div></div></div>`;
    return h;
  }

  // ---------- Administração › Segurança: listas dos formulários ----------
  let CFG = null; // rascunho até salvar
  function vConfig() {
    if (!CFG) { const l = L(); CFG = { areas: l.areas.map(a => ({ ...a })), tipos: l.tipos.join('\n'), regimes: l.regimes.join('\n'), desvios: l.desvios.join('\n') }; }
    const conjs = [['', 'Nenhum'], ...Object.entries(SETS).map(([k, s]) => [k, s.curto])];
    const lista = (k, rot, ajuda) => `<label class="sel"><span>${rot}</span><textarea class="in" id="sgc_${k}" rows="${k === 'desvios' ? 12 : 4}">${esc(CFG[k])}</textarea><small class="muted">${ajuda}</small></label>`;
    return `<div class="grid2"><div class="card"><header><h2>Áreas</h2><p>Lista ÁREA dos dois formulários</p></header><div class="body stackcol">
        <p class="muted small m0">O conjunto diz quem é o supervisor da área: quem é Supervisor na Operação numa área desse conjunto recebe e trata as anomalias dela.</p>
        ${CFG.areas.map((a, i) => `<div class="row-gap sgcarea"><label class="sel grow"><span>Nome</span><input class="in" data-sgca="${i}|nome" value="${esc(a.nome)}"></label><label class="sel"><span>Supervisores de</span><select class="in" data-sgca="${i}|conj">${conjs.map(([k, n]) => `<option value="${k}" ${a.conj === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button type="button" class="btn ghost" data-act="sgCfgTirar" data-i="${i}" aria-label="Tirar a área ${esc(a.nome)}" style="align-self:flex-end">✕</button></div>`).join('')}
        <div class="row-gap"><button type="button" class="btn sm" data-act="sgCfgArea">${I.plus} Área</button></div></div></div>
      <div class="card"><header><h2>Listas</h2><p>Uma opção por linha</p></header><div class="body stackcol">
        ${lista('tipos', 'Tipo de atividade (interação)', 'Padrão: ROTINA e PARADA')}
        ${lista('regimes', 'Regime de trabalho (anomalia)', 'Padrão: ADM e TURNO')}
        ${lista('desvios', 'Desvios (interação)', 'OUTROS fica sempre por último e abre um campo para escrever')}</div></div></div>
      <div class="row-gap"><button type="button" class="btn pri" data-act="sgCfgSalvar">Salvar listas</button><button type="button" class="btn" data-act="sgCfgPadrao">Voltar aos valores padrão</button><span class="muted small">Registros antigos não mudam; as listas novas valem para os próximos.</span></div>`;
  }
  const linhas = s => [...new Set(String(s || '').split('\n').map(x => x.replace(/\s+/g, ' ').trim().toUpperCase()).filter(Boolean))];
  function lerCfgDaTela() {
    if (!CFG) return;
    document.querySelectorAll('[data-sgca]').forEach(el => { const [i, f] = el.dataset.sgca.split('|'); if (CFG.areas[+i]) CFG.areas[+i][f] = f === 'nome' ? el.value.toUpperCase() : el.value; });
    for (const k of ['tipos', 'regimes', 'desvios']) { const el = $('sgc_' + k); if (el) CFG[k] = el.value; }
  }

  // ---------- Exportar para o Excel (mesmas colunas dos formulários) ----------
  const COL_INTER = ['DATA', 'ÁREA', 'LOCAL', 'TIPO DE ATIVIDADE', 'HÁ RISCOS DE SO-PSIF ASSOCIADO? SE SIM, QUAL RISCO?', 'HOUVE DESVIOS? SE SIM, QUAL DESVIO?', 'DESCRIÇÃO', 'AÇÃO IMEDIATA', 'RESPONSÁVEL', 'MATRÍCULA', 'REGISTRO FOTOGRÁFICO', 'REGISTRADO POR', 'REGISTRADO EM'];
  const COL_ANOM = ['DATA', 'HORA', 'ÁREA', 'LOCAL', 'REGIME DE TRABALHO', 'DESCRIÇÃO', 'CONSEQUÊNCIA', 'AÇÃO IMEDIATA', 'POSSÍVEIS CAUSAS', 'SUGESTÕES', 'COMUNICADO POR?', 'MATRÍCULA', 'REGISTRO FOTOGRÁFICO', 'SITUAÇÃO', 'RESPONSÁVEL PELO TRATAMENTO', 'PRAZO', 'COMENTÁRIO DO TRATAMENTO', 'CONCLUÍDA EM', 'REGISTRADO POR', 'REGISTRADO EM'];
  const nFotos = r => `${(r.fotos || []).length} foto${(r.fotos || []).length === 1 ? '' : 's'}`;
  const linhaInter = r => [dBR(r.data), r.area, r.local, r.tipoAtiv, r.risco || '', (r.desvios || []).map(d => (d === 'OUTROS' && r.desvioOutro ? `OUTROS: ${r.desvioOutro}` : d)).join(', '), r.desc || '', r.acao || '', r.resp, r.mat, nFotos(r), nomeP(r.porNome), umDia(r.em)];
  const linhaAnom = a => { const t = a.trat || {}; return [dBR(a.data), a.hora, a.area, a.local, a.regime, a.desc, a.conseq, a.acao, a.causas, a.sugest, a.comunic, a.mat, nFotos(a), vencidaSeg(a, hoje()) ? 'PRAZO VENCIDO' : (STATUS_SEG[a.status] || a.status).toUpperCase(), t.resp || '', dBR(t.prazo), t.coment || '', a.conclEm ? umDia(Date.parse(a.conclEm)) : '', nomeP(a.porNome), umDia(a.em)]; };
  async function exportar(o) {
    const abas = [];
    if (o.inter) abas.push({ nome: 'Interações', linhas: [COL_INTER, ...o.inter.slice().sort(porData).reverse().map(linhaInter)] });
    if (o.anom) abas.push({ nome: 'Anomalias', linhas: [COL_ANOM, ...o.anom.slice().sort(porData).reverse().map(linhaAnom)] });
    try { await baixarExcel(o.arquivo, abas); toast('Planilha baixada'); } catch (e) { toast('Não foi possível gerar a planilha agora'); }
  }

  // ---------- Meu dia ----------
  function meuDia() {
    if (!S().on || !ME) return null;
    const h0 = hoje(); const an = S().anom.filter(abertaSeg);
    const trata = trataTudoSeg(ME) || supConjs(ME).length > 0;
    const daArea = an.filter(a => trataAnom(ME, a));
    const comigo = an.filter(a => comigoSeg(ME, a));
    const venc = [...new Set([...daArea, ...comigo])].filter(a => vencidaSeg(a, h0));
    const sem = daArea.filter(a => !(a.trat && a.trat.resp));
    const minhas = an.filter(a => a.por === ME.uid);
    const ondeTxt = trataTudoSeg(ME) ? 'todas as áreas' : 'sua área';
    const tiles = [];
    if (venc.length) tiles.push({ n: venc.length, t: `${venc.length === 1 ? 'anomalia' : 'anomalias'} com prazo vencido · Segurança`, s: venc.slice(0, 2).map(a => a.local).join(', '), tom: 'bad', go: ['seguranca', 'sganom', 'vencidas'], acao: 'Ver vencidas' });
    if (comigo.length) tiles.push({ n: comigo.length, t: `${comigo.length === 1 ? 'anomalia com você' : 'anomalias com você'} para tratar`, s: comigo.slice(0, 2).map(a => a.local).join(', '), tom: 'warn', go: ['seguranca', 'sganom', 'comigo'], acao: 'Tratar' });
    if (trata && sem.length) tiles.push({ n: sem.length, t: `${sem.length === 1 ? 'anomalia aberta' : 'anomalias abertas'} sem responsável · ${ondeTxt}`, s: 'assuma ou defina quem trata', tom: 'warn', go: ['seguranca', 'sganom', 'abertas'], acao: 'Assumir' });
    if (!trata && minhas.length) tiles.push({ n: minhas.length, t: `${minhas.length === 1 ? 'anomalia sua em aberto' : 'anomalias suas em aberto'} · Segurança`, s: 'acompanhe o tratamento', tom: 'neu', go: ['seguranca', 'sganom', 'abertas'] });
    const lista = (trata ? [...new Set([...venc, ...comigo, ...daArea])] : minhas).slice(0, 5);
    const bt = podeRegistrar() ? `<button class="btn sm" data-act="sgNova" data-tipo="inter">${I.plus} Interação</button> <button class="btn sm" data-act="sgNova" data-tipo="anom">${I.plus} Anomalia</button>` : `<button class="btn sm" data-md="seguranca|sganom|abertas">Abrir anomalias</button>`;
    const bloco = `<div class="card md-card"><header><h2>Segurança</h2><p>${trata ? `Anomalias em aberto · ${ondeTxt}` : 'Suas anomalias em aberto'}</p><span class="r">${bt}</span></header><div class="body stackcol" style="gap:10px">
      ${lista.length ? `<div class="plist">${lista.map(a => `<div class="pitem${vencidaSeg(a, h0) ? ' aberta' : ''}"><div class="minw"><div class="t">${esc(a.local)} · ${esc(title(a.area))}</div><div class="l">${dm(a.data)} · ${esc(String(a.desc || '').slice(0, 80))}</div></div>${pillSit(a)}</div>`).join('')}</div>` : `<p class="muted small m0">${trata ? 'Nenhuma anomalia em aberto na sua área.' : 'Nenhuma anomalia sua em aberto.'}</p>`}
      ${lista.length && an.length > lista.length ? `<p class="muted small m0">+ ${an.length - lista.length} em aberto</p>` : ''}</div></div>`;
    return { tiles, bloco, trata };
  }

  // ---------- ações (botões com data-act) ----------
  acoes.sgNova = (t, d) => abrirForm(d.tipo);
  acoes.sgVer = (t, d) => abrirDetalhe(d.col, d.id);
  acoes.sgTratar = (t, d) => abrirTratar(d.id);
  acoes.sgAssumir = (t, d) => assumir(d.id);
  acoes.sgSit = (t, d) => { U.sit = d.sgsit; render(); };
  acoes.sgFoto = (t, d) => verFoto(d.id, (t.querySelector('img') || {}).src);
  acoes.expSegInter = () => exportar({ arquivo: `Interações ${U.mes}`, inter: S().inter.filter(r => r.mes === U.mes && (!U.area || r.area === U.area)) });
  acoes.expSegAnom = () => exportar({ arquivo: `Anomalias ${U.sit === 'abertas' ? 'em aberto' : U.mes}`, anom: S().anom.filter(a => (!U.area || a.area === U.area) && filtroSit(a)) });
  acoes.expSegTudo = () => exportar({ arquivo: `Segurança ${U.pMes}`, inter: S().inter.filter(r => r.mes === U.pMes), anom: S().anom.filter(a => a.mes === U.pMes) });
  acoes.sgCfgArea = () => { lerCfgDaTela(); CFG.areas.push({ nome: '', conj: '' }); render(); };
  acoes.sgCfgTirar = (t, d) => { lerCfgDaTela(); if (CFG.areas.length <= 1) { toast('Deixe pelo menos uma área'); return; } CFG.areas.splice(+d.i, 1); render(); };
  acoes.sgCfgPadrao = () => { CFG = { areas: SEG_PADRAO.areas.map(a => ({ ...a })), tipos: SEG_PADRAO.tipos.join('\n'), regimes: SEG_PADRAO.regimes.join('\n'), desvios: SEG_PADRAO.desvios.join('\n') }; render(); toast('Valores padrão na tela · salve para valer'); };
  acoes.sgCfgSalvar = async () => {
    lerCfgDaTela();
    const areas = CFG.areas.map(a => ({ nome: String(a.nome || '').replace(/\s+/g, ' ').trim().toUpperCase(), conj: a.conj || '' })).filter(a => a.nome);
    const cfg = { areas, tipos: linhas(CFG.tipos), regimes: linhas(CFG.regimes), desvios: linhas(CFG.desvios) };
    if (!areas.length || !cfg.tipos.length || !cfg.regimes.length || !cfg.desvios.length) { toast('Nenhuma lista pode ficar vazia'); return; }
    if (new Set(areas.map(a => a.nome)).size !== areas.length) { toast('Há área repetida'); return; }
    await DB.segSalvarCfg(cfg); CFG = null; DB.log && DB.log('Segurança: listas dos formulários atualizadas'); toast('Listas salvas'); render();
  };
  // Filtros das telas (mês, área, busca)
  document.addEventListener('change', e => {
    const t = e.target; if (!t.id || t.closest('#layer')) return;
    if (t.id === 'sgMes') { U.mes = t.value; DB.segWatch([U.mes]); render(); }
    else if (t.id === 'sgPMes') { U.pMes = t.value; render(); }
    else if (t.id === 'sgArea') { U.area = t.value; render(); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'sgQ') { U.q = e.target.value; clearTimeout(window._sgq); window._sgq = setTimeout(schedule, 220); } });

  function renderTela(v) {
    if (!S().on || !S().loaded) { if (!S().on && v !== 'sgconfig') return vazio('Sem acesso à Segurança', 'Fale com o administrador do sistema.'); if (!S().loaded && v !== 'sgconfig') return ESQUELETO; }
    if (v === 'sginter') return vInter();
    if (v === 'sganom') return vAnom();
    if (v === 'sgpainel') return vPainel();
    if (v === 'sgconfig') return vConfig();
    return vAnom();
  }
  return { render: renderTela, meuDia };
}
