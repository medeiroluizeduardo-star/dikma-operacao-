// Dikma Gestão — módulo SEGURANÇA: registros de interação e de anomalia (os mesmos formulários do Google, na mesma
// ordem), o Cartão Amarelo (Direito ao Trabalho Seguro, igual ao cartão de papel, com a validação), fila das anomalias com o acompanhamento, painel do mês, Excel e as listas (Administração › Segurança).
// Carregado sob demanda (nucleo/modulos.js). As abas ficam em navegacao.js; quem vê e quem trata, em segcalc.js;
// o banco, em data.js (seginter, seganom, segfotos e config/seguranca).
// Celular primeiro: o formulário ocupa a tela inteira, guarda o rascunho no aparelho enquanto a pessoa preenche e
// funciona sem sinal (o registro e as fotos ficam na fila do aparelho e sobem quando a conexão voltar).
import { MESES_L, SETS, add, addMonth, today } from '../contas/cal.js';
import { campoBusca } from '../ui/busca.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { ESQUELETO } from '../ui/movimento.js';
import { listasSeg, conjDaArea, perfilSeg, supConjs, registraSeg, trataTudoSeg, trataAnom, editaProprio, STATUS_SEG, abertaSeg, vencidaSeg, comigoSeg, diasTratamento, indicadoresSeg, normNomeSeg, SEG_PADRAO, PRAZO_EDICAO_H, fotosDoReg, PERG_CARTAO, VALIDA_CARTAO, validaCartao, pendenteCartao, painelSeg } from '../contas/segcalc.js';
import { indicadores, variacao, etiqueta, tabela, recolhido } from '../ui/padrao.js';
import { DB, framed, esc, title, $ } from '../nucleo/base.js';
import { ME, UI, isAdmin, salvarUI, modsDe } from '../nucleo/estado.js';
import { temIndU, conjsInd } from '../contas/acessos.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast, formSheet } from '../ui/janelas.js';
import { render, schedule, isMobile, trocarTela } from '../ui/shell.js';
import { carregarImg, jpeg, verFotoGrande } from '../ui/fotos.js';
import { telaTreinos } from './treinos.js';
import { criarInspecoes } from './inspecoes.js';
import { veTreinos, painelTreinos, vigentes, situacaoTreino, diasAte, tipoOficial, areaDe, ehNA, ANTECEDENCIA } from '../contas/treinos.js';

// Painel: situação dos treinamentos hoje, por Pátio/Bateria e área, os treinamentos com mais pendências e quem vence logo.
const tArea = a => (/^[A-Z]{2,4}$/.test(a) ? a : title(a)); // CDQ fica em maiúsculas
function painelTr() {
  if (DB.treinosCarregar) DB.treinosCarregar();
  const L = DB.cache.treinos || [], d = today(), p = painelTreinos(L, d), t = p.total;
  const abrir = modsDe(ME).includes('seguranca') && veTreinos(ME) ? '<span class="r"><button class="btn sm" data-go="sgtrein">Abrir</button></span>' : '';
  if (!L.length) return `<div class="card"><header><h2>Treinamentos e ASO</h2><p>Situação hoje</p>${abrir}</header><div class="body"><p class="muted small m0">${DB.cache.tLoaded ? 'Nenhum treinamento cadastrado. Importe a planilha de controle em Treinamentos.' : 'Carregando…'}</p></div></div>`;
  const pct = x => (x == null ? '—' : x + '%');
  const barra = x => `<span class="trbar" title="${pct(x)} em dia"><i style="width:${x || 0}%;${x != null && x < 90 ? 'background:var(--st-atr)' : ''}${x != null && x < 75 ? ';background:var(--st-nreal)' : ''}"></i></span>`;
  const pend = o => (o.vencido || o.vence ? `${o.vencido ? `<b style="color:var(--st-nreal)">${o.vencido} vencido${o.vencido > 1 ? 's' : ''}</b>` : ''}${o.vencido && o.vence ? ' · ' : ''}${o.vence ? `${o.vence} a vencer` : ''}` : '<span class="muted">em dia</span>');
  const conj = k => (SETS[k] ? SETS[k].curto + ' · ' : '');
  const vig = vigentes(L);
  const logo = L.filter(x => !ehNA(x) && vig.has(x.id) && situacaoTreino(x, d, vig) === 'vence').sort((a, b) => String(a.validade).localeCompare(String(b.validade))).slice(0, 5);
  return `<div class="card"><header><h2>Treinamentos e ASO</h2><p>Situação hoje · ${p.pessoas} colaborador${p.pessoas === 1 ? '' : 'es'}</p>${abrir}</header><div class="body">
    <div class="mini"><div><b class="num">${pct(t.conformidade)}</b><span>Em dia</span></div><div><b class="num" style="${t.vencido ? 'color:var(--st-nreal)' : ''}">${t.vencido}</b><span>Vencidos</span></div><div><b class="num" style="${t.vence ? 'color:var(--st-atr)' : ''}">${t.vence}</b><span>Vencem em ${ANTECEDENCIA} dias</span></div><div><b class="num">${p.pessoasComPendencia}</b><span>Colaboradores com pendência</span></div></div>
    <div class="trpn" style="margin-top:14px"><div><h4>Por área</h4><div class="trl">${p.areas.map(a => `<span>${esc(conj(a.conj))}${esc(tArea(a.area))} <small class="muted">${a.pessoas}</small></span>${barra(a.conformidade)}<small>${pct(a.conformidade)} · ${pend(a)}</small>`).join('')}</div></div>
    <div><h4>Treinamentos com mais pendências</h4><div class="trl">${p.tipos.slice(0, 6).map(x => `<span title="${esc(x.tipo)}">${esc(x.tipo)}</span>${barra(x.conformidade)}<small>${pend(x)}</small>`).join('')}</div>
    ${logo.length ? `<h4 style="margin-top:12px">Vencem logo</h4><div class="trl trl3">${logo.map(x => `<span>${esc(title(x.nome || ''))} <small class="muted">${esc(tArea(areaDe(x)))}</small></span><span class="small">${esc(tipoOficial(x.tipo))}</span><small>${diasAte(d, x.validade) === 0 ? 'hoje' : 'em ' + diasAte(d, x.validade) + ' d'}</small>`).join('')}</div>` : ''}</div></div>
    ${t.sem ? `<p class="muted small m0" style="margin-top:10px">${t.sem} registro${t.sem > 1 ? 's' : ''} sem validade (pendências da planilha ou sem data) não entram na porcentagem.</p>` : ''}</div></div>`;
}

// ---- Perguntas dos formulários (ordem, textos e obrigatórias iguais aos do Google) ----
// t: date | time | text | area (texto longo) | radio (uma opção) | checks (várias) | fotos · obr: obrigatória
// sn: pergunta de Sim ou Não; o campo só abre no Sim (Não grava vazio, como antes). snFalta: aviso se Sim e vazio.
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
      { k: 'risco', rot: 'HÁ RISCOS DE SO-PSIF ASSOCIADO? SE SIM, QUAL RISCO?', t: 'text', max: 500, sn: 1, snFalta: 'Escreva qual é o risco.' },
      { k: 'desvios', rot: 'HOUVE DESVIOS? SE SIM, QUAL DESVIO?', t: 'checks', ops: L => L.desvios, sn: 1, snFalta: 'Marque pelo menos um desvio.' },
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
  },
  // Cartão Amarelo: os campos do cartão de papel. A validação (Líder imediato ou Seg. do Trabalho) vem depois, em abrirValidar.
  cartao: {
    col: 'segcartao', nome: 'Cartão Amarelo', curto: 'cartão amarelo',
    campos: [P_DATA, P_AREA,
      { k: 'faltou', rot: 'O QUE FALTOU?', ajuda: 'MARQUE A PERGUNTA QUE TEVE RESPOSTA NÃO', t: 'checks', ops: () => PERG_CARTAO },
      { k: 'motivo', rot: 'MOTIVO DO CARTÃO AMARELO', t: 'area', obr: 1, max: 3000 },
      { k: 'comoSeguro', rot: 'COMO PODERIA FAZER COM SEGURANÇA?', t: 'area', obr: 1, max: 3000 },
      { k: 'comunic', rot: 'COMUNICADO POR (NOME)', ajuda: 'Quem deu o cartão. Busque no cadastro de colaboradores ou escreva o nome', t: 'text', obr: 1, max: 120, eu: 1, pessoas: 1 },
      { ...P_MAT, ajuda: 'Preenchida sozinha pelo cadastro (a da Arcelor, quando houver)' },
      { ...P_FOTOS, obr: 0, rot: 'FOTOS (SE QUISER)' }]
  }
};
const MAX_FOTOS = 5;
const tipoDaCol = col => (col === 'seginter' ? 'inter' : col === 'segcartao' ? 'cartao' : 'anom');

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
  const pillCartao = c => (c.status === 'validado' ? `<span class="pill ok">Validado${c.valid && VALIDA_CARTAO[c.valid.tipo] ? ' · ' + (c.valid.tipo === 'lider' ? 'Líder' : 'Seg. do Trabalho') : ''}</span>` : '<span class="pill warn">Falta validar</span>');
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
  // Colaboradores cadastrados (fichas), para o Cartão Amarelo: nome e matrícula (a da Arcelor quando houver; senão, a Dikma).
  function fichasColab() {
    const m = new Map();
    for (const c of [...((DB.cache.adm && DB.cache.adm.rh) || []), ...((DB.cache.g && DB.cache.g.colabs) || [])]) {
      if (!c || !c.nome || c.dem) continue; const k = normNomeSeg(c.nome); if (m.has(k)) continue;
      m.set(k, { nome: nomeP(c.nome), mat: String(c.matArc || c.mat || '') });
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
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
    else if (c.t === 'text') ctl = `<input class="in" id="${id}" value="${esc(v || '')}" maxlength="${c.max || 200}" autocomplete="off" ${c.num ? 'inputmode="numeric"' : ''} ${c.sug || c.pessoas ? `list="sgl_${c.k}"` : ''}>${c.sug ? `<datalist id="sgl_${c.k}"></datalist>` : c.pessoas ? `<datalist id="sgl_${c.k}">${fichasColab().map(f => `<option value="${esc(f.nome)}">${esc(f.mat)}</option>`).join('')}</datalist>` : ''}`;
    else if (c.t === 'area') ctl = `<textarea class="in" id="${id}" rows="3" maxlength="${c.max || 3000}">${esc(v || '')}</textarea>`;
    else if (c.t === 'radio') ctl = `<div class="sgops" role="radiogroup" aria-labelledby="sgr_${c.k}">${c.ops(L0).map(o => `<label class="sgop"><input type="radio" name="${id}" value="${esc(o)}" ${o === v ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    else if (c.t === 'checks') { const sel = new Set(v || []); ctl = `<div class="sgops chk" role="group" aria-labelledby="sgr_${c.k}">${c.ops(L0).map(o => `<label class="sgop"><input type="checkbox" name="${id}" value="${esc(o)}" ${sel.has(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>${c.k !== 'desvios' ? '' : `<label class="sel sgoutro" id="sgOutroW" ${sel.has('OUTROS') ? '' : 'hidden'}><span>Qual outro desvio?</span><input class="in" id="sgf_desvioOutro" maxlength="200" value="${esc((F && F.outro) || '')}"></label>`}`; }
    else if (c.t === 'fotos') ctl = F.reg ? `<div class="sgfotos">${minis(F.reg, 9)}</div><p class="muted small m0">As fotos já enviadas não mudam na correção.</p>` : `<div class="sgfotos" id="sgFotosL"></div><div class="row-gap"><label class="btn" for="sgf_fotos_in">${I.cam} Tirar ou escolher foto</label><span class="muted small">Até ${MAX_FOTOS} fotos · reduzidas no aparelho</span></div><input type="file" id="sgf_fotos_in" accept="image/*" multiple hidden>`;
    if (c.sn) {
      const sim = Array.isArray(v) ? v.length > 0 : !!v;
      ctl = `<div class="sgops sgsn" role="radiogroup" aria-labelledby="sgr_${c.k}">${['Não', 'Sim'].map(o => `<label class="sgop"><input type="radio" name="sgsn_${c.k}" value="${o}" ${(o === 'Sim') === sim ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div><div class="sgsn-c" id="sgsnc_${c.k}" ${sim ? '' : 'hidden'}>${ctl}</div>`;
    }
    return `<div class="sgq" id="q_${c.k}"><div class="sgq-rot" id="sgr_${c.k}"><span class="sgq-n">${i + 1}</span><span class="minw"><b>${esc(c.rot)}</b>${c.obr ? '<span class="obr" title="Obrigatória"> *</span>' : ''}${c.ajuda ? `<small>${esc(c.ajuda)}</small>` : ''}</span></div>${ctl}<p class="sgq-erro" id="e_${c.k}" role="alert" hidden></p></div>`;
  }
  const simEm = (c, raiz = document) => !!raiz.querySelector(`input[name="sgsn_${c.k}"][value="Sim"]:checked`);
  const valorDe = (c, raiz = document) => {
    const id = 'sgf_' + c.k;
    if (c.t === 'radio') { const x = raiz.querySelector(`input[name="${id}"]:checked`); return x ? x.value : ''; }
    if (c.t === 'checks') return [...raiz.querySelectorAll(`input[name="${id}"]:checked`)].map(x => x.value);
    if (c.t === 'fotos') return null;
    if (c.sn && !simEm(c, raiz)) return c.t === 'checks' ? [] : '';
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
    const corpo = `${aviso}${reg ? `<p class="muted small m0">Correção do seu registro: vale por ${PRAZO_EDICAO_H} horas depois de enviado${tipo === 'anom' ? ' e enquanto a anomalia estiver aberta' : tipo === 'cartao' ? ' e enquanto o cartão não for validado' : ''}.</p>` : '<p class="muted small m0">* obrigatória · o rascunho fica guardado neste aparelho enquanto você preenche.</p>'}
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
      if (t.id === 'sgf_comunic') { const f = fichasColab().find(x => normNomeSeg(x.nome) === normNomeSeg(t.value)); if (f && f.mat && $('sgf_mat')) { $('sgf_mat').value = f.mat; limparErro($('sgf_mat')); } }
      if (t.name && t.name.startsWith('sgsn_')) {
        const w = $('sgsnc_' + t.name.slice(5)); if (w) w.hidden = t.value !== 'Sim';
        const x = w && !w.hidden && w.querySelector('input.in,textarea'); if (x && !x.closest('[hidden]')) x.focus({ preventScroll: true });
      }
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
      if (c.sn && !msg && simEm(c) && !(Array.isArray(v[c.k]) ? v[c.k].length : v[c.k])) msg = c.snFalta;
      if (c.t === 'checks' && (v.desvios || []).includes('OUTROS') && !v.desvioOutro) msg = 'Escreva qual é o outro desvio.';
      const q = $('q_' + c.k), e = $('e_' + c.k);
      if (q) q.classList.toggle('inval', !!msg); if (e) { e.textContent = msg; e.hidden = !msg; }
      if (q) q.querySelectorAll('input:not([type=hidden]),textarea').forEach(x => { if (msg) x.setAttribute('aria-invalid', 'true'); else x.removeAttribute('aria-invalid'); });
      if (msg) faltam.push(c);
    }
    const er = $('sgErr');
    if (faltam.length) {
      er.textContent = `Falta${faltam.length > 1 ? 'm' : ''} ${faltam.length} ${faltam.length > 1 ? 'respostas' : 'resposta'}: ${faltam.map(c => c.rot.split('?')[0]).join(', ')}.`; er.hidden = false;
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
    if (dados.local != null) dados.local = dados.local.toUpperCase();
    if (def === FORMS.cartao) dados.comunic = dados.comunic.toUpperCase();
    dados.mes = dados.data.slice(0, 7); dados.conj = conjDaArea(S().cfg, dados.area);
    if (def === FORMS.inter) dados.desvioOutro = dados.desvios.includes('OUTROS') ? t(v.desvioOutro, 200) : '';
    try { localStorage.setItem('dikma-seg-mat|' + ME.uid, dados.mat); } catch (e) { /* ignora */ }
    const offline = !navigator.onLine;
    if (F.reg) {
      DB.segEditar(def.col, F.reg.id, dados);
      toast(`Correção salva${offline ? ' · sobe quando o sinal voltar' : ''}`);
    } else {
      DB.segNovo(def.col, def === FORMS.anom ? { ...dados, status: 'aberta' } : def === FORMS.cartao ? { ...dados, status: 'pendente' } : dados, F.fotos);
      apagarRasc(F.tipo);
      toast(`${def === FORMS.anom ? 'Anomalia registrada' : def === FORMS.cartao ? 'Cartão Amarelo registrado · falta a validação' : 'Interação registrada'}${offline ? ' · guardada no aparelho, sobe quando o sinal voltar' : ''}`);
      if (dados.mes !== U.mes) { U.mes = dados.mes; DB.segWatch([U.mes]); }
    }
    F.enviado = true; fo.fechar(); render();
  }

  // ---------- detalhe do registro ----------
  const linhaDet = (rot, v) => `<div><dt>${esc(rot)}</dt><dd>${v || '<span class="muted">—</span>'}</dd></div>`;
  const acharReg = (col, id) => S()[tipoDaCol(col)].find(r => r.id === id);
  function abrirDetalhe(col, id) {
    const r = acharReg(col, id); if (!r) { toast('Registro não encontrado'); return; }
    const tipo = tipoDaCol(col); const def = FORMS[tipo];
    const txt = s => esc(s || '').replace(/\n/g, '<br>');
    let corpo = `<dl class="sgdet">${def.campos.map(c => linhaDet(c.rot, c.t === 'fotos' ? `<div class="sgfotos">${minis(r, 9)}</div>` : c.t === 'date' ? dBR(r[c.k]) : c.t === 'checks' && c.k === 'faltou' ? ((r.faltou || []).length ? r.faltou.map(d => `<span class="pill warn">${esc(d)}</span>`).join(' ') : '<span class="muted">—</span>') : c.t === 'checks' ? ((r.desvios || []).length ? (r.desvios || []).map(d => `<span class="pill neu">${esc(d === 'OUTROS' && r.desvioOutro ? 'OUTROS: ' + r.desvioOutro : d)}</span>`).join(' ') : 'Não') : txt(r[c.k]))).join('')}</dl>
      <p class="muted small m0">Registrado por ${esc(nomeP(r.porNome))}${r.em ? ' em ' + umDia(r.em) : ''}.</p>`;
    let botoes = '';
    if (tipo === 'anom') {
      const tr = r.trat || {};
      corpo += `<div class="sgtrat"><h4>Acompanhamento</h4><dl class="sgdet">${linhaDet('Situação', pillSit(r))}${linhaDet('Responsável pelo tratamento', esc(nomeP(tr.resp)))}${linhaDet('Prazo', tr.prazo ? `${dBR(tr.prazo)}${vencidaSeg(r, hoje()) ? ' <span class="pill bad">vencido</span>' : ''}` : '')}${linhaDet('Comentário do tratamento', txt(tr.coment))}${linhaDet('Foto do depois', tr.fotoDepois ? `<div class="sgfotos"><button type="button" class="sgmini" data-act="sgFoto" data-id="${esc(tr.fotoDepois)}" aria-label="Ver a foto do depois">${tr.miniDepois ? `<img src="${tr.miniDepois}" alt="">` : 'Ver'}</button></div>` : '')}${r.status === 'concluida' && r.conclEm ? linhaDet('Concluída em', `${umDia(Date.parse(r.conclEm))}${diasTratamento(r) != null ? ` · ${fmtDias(diasTratamento(r))} de tratamento` : ''}`) : ''}</dl>
        ${(tr.hist || []).length ? `<details class="sghist"><summary>Histórico (${tr.hist.length})</summary><ol>${tr.hist.slice().reverse().map(h => `<li><time>${umDia(Date.parse(h.em))}</time> <b>${esc(curtoNome(h.nome))}</b> · ${esc(h.t)}</li>`).join('')}</ol></details>` : ''}</div>`;
      if (trataAnom(ME, r)) botoes += `<button type="button" class="btn pri" data-sgf="tratar">${r.status === 'concluida' ? 'Reabrir ou ajustar' : 'Acompanhar'}</button>`;
    }
    if (tipo === 'cartao') {
      const v = r.valid || {};
      corpo += `<div class="sgtrat"><h4>Validação</h4><dl class="sgdet">${linhaDet('Situação', pillCartao(r))}${r.status === 'validado' ? linhaDet('Validado por', `${esc(VALIDA_CARTAO[v.tipo] || '')}`) + linhaDet('Nome', esc(nomeP(v.nome))) + linhaDet('Matrícula', esc(v.mat)) + linhaDet('Quando', v.em ? umDia(Date.parse(v.em)) : '') : ''}</dl></div>`;
      if (validaCartao(ME, r)) botoes += `<button type="button" class="btn pri" data-sgf="validar">${r.status === 'validado' ? 'Ajustar validação' : 'Validar'}</button>`;
    }
    if (editaProprio(ME, r, Date.now(), tipo === 'anom') && (tipo !== 'cartao' || pendenteCartao(r))) botoes += `<button type="button" class="btn" data-sgf="editar">Corrigir</button>`;
    // Apagar: só o administrador (as regras também conferem). Leva as fotos do registro junto.
    if (isAdmin()) botoes += `<button type="button" class="btn danger" data-sgf="excluir">Excluir</button>`;
    const fo = folha({ titulo: def.nome.replace('Registro de ', '').replace(/^./, x => x.toUpperCase()), sub: `${dBR(r.data)}${r.hora ? ' às ' + esc(r.hora) : ''} · ${esc(r.area)}${r.local ? ' · ' + esc(r.local) : ''}`, corpo, rodape: `<div class="row-gap">${botoes}<button type="button" class="btn" data-sgclose>Fechar</button></div>` });
    folhaAcao = b => { if (b.dataset.sgf === 'tratar') { fo.fechar(); abrirTratar(r.id); } if (b.dataset.sgf === 'validar') { fo.fechar(); abrirValidar(r.id); } if (b.dataset.sgf === 'editar') { fo.fechar(); abrirForm(tipo, r); } if (b.dataset.sgf === 'excluir') { fo.fechar(); confirmarExclusao(col, r); } };
  }
  // Confirmação clara antes de apagar o registro e as fotos dele (não dá para desfazer).
  function confirmarExclusao(col, r) {
    if (!isAdmin()) return;
    const anom = col === 'seganom', cart = col === 'segcartao'; const n = fotosDoReg(r).length; const nome = anom ? 'esta anomalia' : cart ? 'este Cartão Amarelo' : 'esta interação';
    const fotos = n ? ` e ${n === 1 ? 'a foto' : `as ${n} fotos`}` : '';
    formSheet(anom ? 'Excluir anomalia' : cart ? 'Excluir Cartão Amarelo' : 'Excluir interação', `${dBR(r.data)} · ${esc(r.area)}${r.local ? ' · ' + esc(r.local) : ''}`,
      `<p class="m0"><b>Excluir ${nome}${fotos}?</b> Não dá para desfazer.</p>${anom && abertaSeg(r) ? '<p class="muted small m0">Ela ainda está em aberto: some da fila e dos indicadores.</p>' : ''}`,
      'Excluir', async () => {
        await DB.segExcluir(col, r);
        DB.log(`Segurança: excluiu ${anom ? 'uma anomalia' : cart ? 'um Cartão Amarelo' : 'uma interação'} de ${dBR(r.data)}${n ? ` (${n} foto${n > 1 ? 's' : ''})` : ''}`, 'seguranca');
        toast(`${anom ? 'Anomalia excluída' : cart ? 'Cartão Amarelo excluído' : 'Interação excluída'}${n ? ` com ${n === 1 ? 'a foto' : `as ${n} fotos`}` : ''}`); render();
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

  // ---------- validação do Cartão Amarelo (Líder imediato = supervisor da área; Seg. do Trabalho = trata/gestor) ----------
  function abrirValidar(id) {
    const c = S().cartao.find(x => x.id === id); if (!c || !validaCartao(ME, c)) return;
    const v = c.valid || {};
    const tipo0 = v.tipo || (supConjs(ME).includes(c.conj) && !trataTudoSeg(ME) ? 'lider' : 'seg');
    const corpo = `<div class="sgresumo"><div><b>${esc(nomeP(c.comunic))}</b> · ${esc(c.area)} · ${dBR(c.data)}</div><p class="m0">${esc(c.motivo)}</p></div>
      <div class="sgq" id="q_vtipo"><div class="sgq-rot"><span class="minw"><b>Validação</b><span class="obr" title="Obrigatória"> *</span></span></div><div class="sgops" role="radiogroup" aria-label="Validação">${Object.entries(VALIDA_CARTAO).map(([k, n]) => `<label class="sgop"><input type="radio" name="sgv_tipo" value="${k}" ${tipo0 === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      <label class="sel"><span>Nome *</span><input class="in" id="sgv_nome" maxlength="120" autocomplete="off" value="${esc(nomeP(v.nome || (ME && (ME.nome || ME.login)) || ''))}"></label>
      <label class="sel"><span>Matrícula *</span><input class="in" id="sgv_mat" maxlength="30" inputmode="numeric" autocomplete="off" value="${esc(v.mat || minhaMat())}"></label>`;
    const fo = folha({ titulo: 'Validar Cartão Amarelo', sub: 'Líder imediato ou Seg. do Trabalho', corpo, form: true, larga: false,
      rodape: `<p class="err" id="sgErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri big" type="submit">Validar</button>${c.status === 'validado' ? '<button class="btn" type="button" data-sgf="desfazer">Tirar a validação</button>' : ''}<button class="btn" type="button" data-sgclose>Cancelar</button></div>` });
    const el = fo.el;
    folhaAcao = b => { if (b.dataset.sgf === 'desfazer') { DB.segValidar(c, { status: 'pendente', valid: {} }); toast('Validação retirada'); fo.fechar(); render(); } };
    el.onsubmit = e => {
      e.preventDefault();
      const t = (el.querySelector('input[name="sgv_tipo"]:checked') || {}).value;
      const nome = $('sgv_nome').value.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 120), mat = $('sgv_mat').value.trim().slice(0, 30);
      const er = $('sgErr');
      if (!t || !nome || !mat) { er.textContent = 'Escolha quem valida e preencha o nome e a matrícula.'; er.hidden = false; return; }
      try { localStorage.setItem('dikma-seg-mat|' + ME.uid, mat); } catch (x) { /* ignora */ }
      DB.segValidar(c, { status: 'validado', valid: { tipo: t, nome, mat, uid: ME.uid, em: new Date().toISOString() } });
      toast(`Cartão Amarelo validado${navigator.onLine ? '' : ' · sobe quando o sinal voltar'}`); fo.fechar(); render();
    };
  }

  // ---------- telas ----------
  const selMes = (id, v) => `<label class="sel"><span>Mês</span><select class="in" id="${id}">${opcoesMes().map(m => `<option value="${m}" ${m === v ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select></label>`;
  const selArea = () => `<label class="sel"><span>Área</span><select class="in" id="sgArea"><option value="">Todas</option>${L().areas.map(a => `<option ${a.nome === U.area ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>`;
  const busca = ph => `<label class="sel sgbusca"><span>Buscar</span><input class="in" type="search" id="sgQ" value="${esc(U.q)}" placeholder="${ph}" autocomplete="off"></label>`;
  const rascBanner = tipo => { const r = lerRasc(tipo); return r && podeRegistrar() ? `<div class="sgrasc" role="status">${I.ok}<span>Você tem um rascunho de ${FORMS[tipo].curto} de ${umDia(r.em)} guardado neste aparelho.</span><button type="button" class="btn sm pri" data-act="sgNova" data-tipo="${tipo}">Continuar</button></div>` : ''; };
  // Nos Indicadores, quem não vê tudo pela Segurança vê os conjuntos do escopo.
  const quemVe = () => (trataTudoSeg(ME) || perfilSeg(ME) === 'leitor' ? 'todas as áreas' : UI.modulo === 'indicadores' ? conjsInd(ME).map(k => SETS[k].curto).join(' e ') || 'o seu escopo' : supConjs(ME).length && !podeRegistrar() ? 'a sua área' : supConjs(ME).length ? 'os seus registros e os da sua área' : 'os registros feitos por você');

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

  // Cartão Amarelo: a fila dos que faltam validar e os do mês.
  const CSITS = [['pendentes', 'Falta validar'], ['validados', 'Validados'], ['todos', 'Todos do mês']];
  const filtroCartao = c => (U.csit === 'pendentes' ? pendenteCartao(c) : U.csit === 'validados' ? c.status === 'validado' && c.mes === U.mes : c.mes === U.mes);
  function vCartao() {
    DB.segWatch([U.mes]);
    if (!CSITS.some(x => x[0] === U.csit)) U.csit = 'pendentes';
    const base = S().cartao.filter(c => !U.area || c.area === U.area);
    const l = base.filter(c => filtroCartao(c) && casaQ(c, ['area', 'motivo', 'comoSeguro', 'comunic', 'mat', 'faltou'])).sort(porData);
    const pend = base.filter(pendenteCartao), doMes = base.filter(c => c.mes === U.mes);
    const falta = new Map(); for (const c of doMes) for (const p of c.faltou || []) falta.set(p, (falta.get(p) || 0) + 1);
    const top = [...falta].sort((a, b) => b[1] - a[1])[0];
    let h = `<div class="sgcab"><span class="sgcab-ic" aria-hidden="true">${I.cartao}</span><div class="minw"><b>Falta de segurança? Dê Cartão Amarelo!</b><span>Os recursos estão suficientes e adequados? Me sinto em condições para a tarefa? O ambiente está seguro?</span></div></div>`;
    h += `<div class="filters"><div class="sgsit" role="tablist" aria-label="Situação">${CSITS.map(([k, n]) => `<button type="button" role="tab" data-act="sgCSit" data-sgsit="${k}" aria-selected="${U.csit === k}">${n}${k === 'pendentes' && pend.length ? ` <span class="badge num">${pend.length}</span>` : ''}</button>`).join('')}</div>
      ${U.csit !== 'pendentes' ? selMes('sgMes', U.mes) : ''}${selArea()}${busca('Nome, motivo…')}
      ${podeExportar() ? `<button class="btn" data-act="expSegCartao" style="align-self:flex-end">${I.dl} Exportar</button>` : ''}
      ${podeRegistrar() ? `<button class="btn pri" data-act="sgNova" data-tipo="cartao" style="align-self:flex-end">${I.plus} Novo cartão</button>` : ''}</div>`;
    h += rascBanner('cartao');
    h += `<div class="kpis">
      <div class="kpi hero"><span class="lbl">Cartões no mês</span><span class="v num">${doMes.length}</span><span class="s">${mesNome(U.mes)} · ${quemVe()}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Falta validar</span><span class="v num">${pend.length}</span><span class="s">${pend.length ? 'esperam o líder ou a segurança' : 'todos validados'}</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-real)"></i>Validados</span><span class="v num">${doMes.filter(c => c.status === 'validado').length}</span><span class="s">em ${mesNome(U.mes)}</span></div>
      <div class="kpi"><span class="lbl">O que mais faltou</span><span class="v vsm">${top ? esc(title(top[0].replace('?', ''))) : '—'}</span><span class="s">${top ? `${top[1]} vez${top[1] > 1 ? 'es' : ''} no mês` : 'nada marcado no mês'}</span></div></div>`;
    if (!l.length) return h + `<div class="card">${vazio(U.csit === 'pendentes' ? 'Nenhum cartão esperando validação' : `Nenhum Cartão Amarelo em ${mesNome(U.mes)}`, U.q || U.area ? 'Mude a área ou a busca.' : podeRegistrar() ? 'Registre pelo botão Novo cartão.' : 'Os cartões aparecem aqui assim que forem registrados.')}</div>`;
    h += `<div class="card"><div class="tw"><table class="tcard sgtab"><thead><tr><th>Data</th><th>Comunicado por</th><th>Motivo</th><th>Situação</th><th></th></tr></thead><tbody>
      ${l.map(c => `<tr><td data-l="Data" class="nowrap">${dm(c.data)}</td>
        <td class="tc-t"><b>${esc(curtoNome(c.comunic))}</b><small class="muted"> · ${esc(c.area)}</small></td>
        <td class="tc-full" data-l="Motivo"><div class="sgdesc">${esc(c.motivo)}</div>${(c.faltou || []).length ? `<div class="sgfalta">${c.faltou.map(p => `<span class="pill warn">${esc(title(p.replace('?', '')))}</span>`).join(' ')}</div>` : ''}</td>
        <td data-l="Situação">${pillCartao(c)}</td>
        <td class="tc-acao r nowrap">${pendenteCartao(c) && validaCartao(ME, c) ? `<button class="btn sm" data-act="sgValidar" data-id="${esc(c.id)}">Validar</button> ` : ''}<button class="btn sm" data-act="sgVer" data-col="segcartao" data-id="${esc(c.id)}">Abrir</button></td></tr>`).join('')}
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
    // O que pede atenção agora (antes ficava no Painel, que foi para Indicadores): no topo da fila.
    h += `<section class="card sgp-card sgatencao"><header><h2>Precisa de atenção</h2><p>Agora · ${esc(U.area ? title(U.area) : quemVe())}</p></header><div class="body">${atencao(U.area)}</div></section>`;
    h += `<div class="kpis compacta">
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
        <td class="tc-acao r nowrap">${pode && abertaSeg(a) && !tr.resp ? `<button class="btn sm" data-act="sgAssumir" data-id="${esc(a.id)}">Assumir</button> ` : ''}${pode ? `<button class="btn sm" data-act="sgTratar" data-id="${esc(a.id)}">${a.status === 'concluida' ? 'Ajustar' : 'Acompanhar'}</button> ` : ''}<button class="btn sm ghost" data-act="sgVer" data-col="seganom" data-id="${esc(a.id)}">Abrir</button></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    return h;
  }

  // ---------- Painel da Segurança ----------
  // Gráfico de colunas (SVG próprio): interações, anomalias e Cartões Amarelos dos últimos 6 meses.
  const SERIES = [['inter', 'Interações', 'var(--marca)'], ['anom', 'Anomalias', 'var(--critico)'], ['cartao', 'Cartões Amarelos', 'var(--atencao)']];
  function colunas(porMes) {
    const W = 600, H = 200, b = 26, top = 18, n = porMes.length || 1, gw = (W - 20) / n, bw = Math.min(22, (gw - 18) / 3);
    const mx = Math.max(1, ...porMes.map(x => Math.max(...SERIES.map(([k]) => x[k] || 0))));
    const y = v => H - b - (v / mx) * (H - b - top);
    const barras = porMes.map((x, i) => { const x0 = 10 + gw * i + gw / 2 - (bw * 3 + 6) / 2;
      return `<g>${SERIES.map(([k, nome, cor], j) => { const v = x[k] || 0, bx = x0 + j * (bw + 3);
        return `<rect x="${bx}" y="${y(v)}" width="${bw}" height="${H - b - y(v)}" rx="3" fill="${cor}"><title>${mesNome(x.mes)}: ${v} ${nome.toLowerCase()}</title></rect>${v ? `<text x="${bx + bw / 2}" y="${y(v) - 4}" text-anchor="middle" class="sgsv-n">${v}</text>` : ''}`; }).join('')}
      <text x="${10 + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle" class="sgsv-x${x.mes === U.pMes ? ' at' : ''}">${MESES_L[+x.mes.slice(5, 7) - 1].slice(0, 3)}</text></g>`; }).join('');
    return `<svg class="sgsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Por mês: ${porMes.map(x => `${mesNome(x.mes)}: ${x.inter} interações, ${x.anom} anomalias, ${x.cartao} cartões`).join('; ')}"><line x1="0" x2="${W}" y1="${H - b}" y2="${H - b}" stroke="var(--line)"/>${barras}</svg>`;
  }
  const legenda = () => `<div class="legend">${SERIES.map(([, n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>`;
  const barras = (l, cor, total, fmt = title) => { const mx = l.length ? Math.max(1, ...l.map(x => x[1])) : 1; return `<div class="bars">${l.map(([n, v]) => `<div class="barrow"><span class="n">${esc(fmt(n))}${total ? `<small>${Math.round(v / total * 100)}%</small>` : ''}</span><div class="stack"><i style="width:${v / mx * 100}%;background:${cor}"></i></div><span class="p num">${v}</span></div>`).join('')}</div>`; };
  const cartaoP = (titulo, sub, corpo, extra = '') => `<section class="card sgp-card"><header><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}${extra}</header><div class="body">${corpo}</div></section>`;
  const irBtn = (v, sit, txt = 'Ver') => `<button type="button" class="btn sm" data-act="sgIr" data-v="${v}"${sit ? ` data-sgsit="${sit}"` : ''}>${txt}</button>`;

  // O que pede ação agora (respeita a área escolhida): cada linha leva direto para a fila certa.
  function atencao(area) {
    const d = hoje(), em2 = add(d, 2), daA = l => l.filter(x => !area || x.area === area);
    const ab = daA(S().anom).filter(abertaSeg);
    const l = [
      ['critico', ab.filter(a => vencidaSeg(a, d)).length, 'anomalia com prazo vencido', 'anomalias com prazo vencido', 'sganom', 'vencidas'],
      ['atencao', ab.filter(a => a.trat && a.trat.prazo && a.trat.prazo >= d && a.trat.prazo <= em2).length, 'anomalia vence em até 2 dias', 'anomalias vencem em até 2 dias', 'sganom', 'abertas'],
      ['atencao', ab.filter(a => !(a.trat && a.trat.resp)).length, 'anomalia sem responsável', 'anomalias sem responsável', 'sganom', 'abertas'],
      ['info', ab.filter(a => comigoSeg(ME, a)).length, 'anomalia com você', 'anomalias com você', 'sganom', 'comigo'],
      ['atencao', daA(S().cartao).filter(c => pendenteCartao(c) && validaCartao(ME, c)).length, 'Cartão Amarelo para validar', 'Cartões Amarelos para validar', 'sgcartao', 'pendentes']
    ];
    if (veTreinos(ME) && (DB.cache.treinos || []).length) { const t = painelTreinos(DB.cache.treinos, d).total; l.push(['critico', t.vencido, 'treinamento ou ASO vencido', 'treinamentos ou ASO vencidos', 'sgtrein', '']); }
    const itens = l.filter(x => x[1] > 0);
    if (!itens.length) return `<div class="sgp-ok">${I.ok}<div><b>Nada pendente agora</b><span>Sem prazo vencido, sem anomalia sem dono e sem cartão esperando validação.</span></div></div>`;
    return `<ul class="sgp-at">${itens.map(([s, n, um, varios, v, sit]) => `<li class="${s}"><b class="num">${n}</b><span>${n === 1 ? um : varios}</span>${irBtn(v, sit)}</li>`).join('')}</ul>`;
  }

  function vPainel() {
    const meses = []; for (let i = 5; i >= 0; i--) meses.push(addMonth(U.pMes, -i));
    DB.segWatch(meses);
    const nomesArea = L().areas.map(a => a.nome);
    const p = painelSeg({ inter: S().inter, anom: S().anom, cartao: S().cartao, mes: U.pMes, meses, hoje: hoje(), areas: nomesArea, area: U.area });
    const ant = painelSeg({ inter: S().inter, anom: S().anom, cartao: S().cartao, mes: addMonth(U.pMes, -1), hoje: hoje(), area: U.area });
    const pctDesvio = p.interMes ? Math.round(p.comDesvio / p.interMes * 100) : 0;
    const serie = k => p.porMes.map(x => x[k]);
    const pe = (...l) => l.filter(Boolean).map(x => `<span>${x}</span>`).join('');
    const sitPrazo = p.prazo.pct == null ? '' : p.prazo.pct >= 90 ? 'ok' : p.prazo.pct >= 70 ? 'atencao' : 'critico';
    const ondeTxt = U.area ? title(U.area) : quemVe();
    // Indicadores › Segurança: só os números (registrar e o que pede atenção ficam em Segurança › Anomalias).
    let h = `<div class="filters">${selMes('sgPMes', U.pMes)}${selArea()}<span class="muted small" style="align-self:flex-end">Contas com ${esc(ondeTxt)}</span>
      ${podeExportar() ? `<button class="btn" data-act="expSegTudo" style="align-self:flex-end">${I.dl} Exportar o mês</button>` : ''}</div>`;
    h += indicadores([
      { rotulo: 'Interações no mês', valor: String(p.interMes), serie: serie('inter'), variacao: variacao(p.interMes, ant.interMes) + pe(`${pctDesvio}% com desvio`) },
      { rotulo: 'Anomalias em aberto', valor: String(p.abertasAgora), serie: serie('anom'), situacao: p.vencidas ? 'critico' : p.semResp ? 'atencao' : p.abertasAgora ? '' : 'ok',
        variacao: pe(p.vencidas ? `<b class="sgp-c">${p.vencidas} com prazo vencido</b>` : 'nenhuma vencida', p.semResp ? `${p.semResp} sem responsável` : '') },
      { rotulo: 'Tratadas no prazo', valor: p.prazo.pct == null ? '—' : String(p.prazo.pct), unidade: p.prazo.pct == null ? '' : '%', situacao: sitPrazo,
        variacao: pe(p.prazo.concluidas ? `${p.prazo.noPrazo} de ${p.prazo.concluidas} concluídas` : 'nenhuma concluída com prazo', p.tempoMedio == null ? '' : `média ${fmtDias(p.tempoMedio)}`) },
      { rotulo: 'Cartões Amarelos', valor: String(p.cartaoMes), serie: serie('cartao'), situacao: p.cartaoPendentes ? 'atencao' : '',
        variacao: pe(p.cartaoPendentes ? `${p.cartaoPendentes} falta${p.cartaoPendentes === 1 ? '' : 'm'} validar` : 'todos validados', p.cartaoValidados ? `${p.cartaoValidados} validado${p.cartaoValidados === 1 ? '' : 's'} no mês` : '') }
    ]);
    // Evolução ao lado dos desvios (o gráfico sozinho ficaria alto demais na tela larga).
    const rep = p.repetidos.length ? `<h4 class="sgp-h4">Se repetem na mesma área (3 vezes ou mais)</h4><ul class="sgp-rep">${p.repetidos.slice(0, 6).map(r => `<li><span>${esc(r.desvio)}</span><small class="muted">${esc(title(r.area))}</small>${etiqueta(r.vezes + 'x', 'critico')}</li>`).join('')}</ul>` : '<p class="muted small sgp-nota">Nenhum desvio repetido 3 vezes na mesma área.</p>';
    h += `<div class="grid2 sgp-g">${cartaoP('Evolução', 'Últimos 6 meses', legenda() + colunas(p.porMes))}
      ${cartaoP('Desvios mais frequentes', `${mesNome(U.pMes)} · nas interações`, (p.desvios.length ? barras(p.desvios.slice(0, 6), 'var(--critico)', p.interMes, x => x) : vazio('Nenhum desvio no mês', 'Os desvios marcados nas interações aparecem aqui.')) + rep)}</div>`;
    // Por área: uma linha por área com registro, as que têm prazo vencido primeiro.
    const etqN = (n, s) => (n ? etiqueta(String(n), s) : '<span class="muted">0</span>');
    h += cartaoP('Por área', `${mesNome(U.pMes)} · em aberto e vencidas contam o que está aberto hoje`, p.porArea.length
      ? tabela([{ t: 'Área' }, { t: 'Interações', n: true }, { t: 'Com desvio', n: true }, { t: 'Anomalias do mês', n: true }, { t: 'Em aberto', n: true }, { t: 'Vencidas', n: true }, { t: 'Cartões', n: true }],
        p.porArea.map(x => [`<b>${esc(title(x.area))}</b>`, x.inter, x.comDesvio == null ? '<span class="muted">—</span>' : x.comDesvio + '%', x.anomMes, x.abertasAgora, etqN(x.vencidas, 'critico'), x.cartoes]), { rotulo: 'Segurança por área' })
      : vazio('Nada registrado no mês', 'As áreas aparecem aqui quando houver registros.'));
    // Cartão Amarelo
    h += `${cartaoP('Cartão Amarelo', `${mesNome(U.pMes)} · o que faltou`, p.cartaoMes
        ? `${barras(p.faltou, 'var(--atencao)', p.cartaoMes, x => title(x.replace('?', '')))}<p class="muted small sgp-nota">${p.cartaoValidados} de ${p.cartaoMes} validado${p.cartaoMes === 1 ? '' : 's'} pelo líder ou pela segurança.</p>`
        : vazio(`Nenhum cartão em ${mesNome(U.pMes)}`, 'Os cartões dados em campo aparecem aqui.'), modsDe(ME).includes('seguranca') ? irBtn('sgcartao', 'todos', 'Abrir') : '')}`;
    if (veTreinos(ME) || temIndU(ME)) h += painelTr();
    // O que não pede ação fica recolhido.
    h += recolhido(`Interações por pessoa · ${mesNome(U.pMes)}`, p.porPessoa.length ? barras(p.porPessoa.slice(0, 10), 'var(--marca)') : '<p class="muted small m0">Nenhuma interação no mês.</p>');
    return `<div class="sgp">${h}</div>`;
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
  const COL_CARTAO = ['DATA', 'ÁREA', 'COMUNICADO POR', 'MATRÍCULA', 'O QUE FALTOU?', 'MOTIVO DO CARTÃO AMARELO', 'COMO PODERIA FAZER COM SEGURANÇA?', 'SITUAÇÃO', 'VALIDAÇÃO', 'NOME (VALIDAÇÃO)', 'MATRÍCULA (VALIDAÇÃO)', 'VALIDADO EM', 'REGISTRADO POR', 'REGISTRADO EM'];
  const linhaCartao = c => { const v = c.valid || {}; const ok = c.status === 'validado'; return [dBR(c.data), c.area, c.comunic, c.mat, (c.faltou || []).join(' · '), c.motivo, c.comoSeguro, ok ? 'VALIDADO' : 'FALTA VALIDAR', ok ? VALIDA_CARTAO[v.tipo] || '' : '', ok ? v.nome || '' : '', ok ? v.mat || '' : '', ok && v.em ? umDia(Date.parse(v.em)) : '', nomeP(c.porNome), umDia(c.em)]; };
  const nFotos = r => `${(r.fotos || []).length} foto${(r.fotos || []).length === 1 ? '' : 's'}`;
  const linhaInter = r => [dBR(r.data), r.area, r.local, r.tipoAtiv, r.risco || '', (r.desvios || []).map(d => (d === 'OUTROS' && r.desvioOutro ? `OUTROS: ${r.desvioOutro}` : d)).join(', '), r.desc || '', r.acao || '', r.resp, r.mat, nFotos(r), nomeP(r.porNome), umDia(r.em)];
  const linhaAnom = a => { const t = a.trat || {}; return [dBR(a.data), a.hora, a.area, a.local, a.regime, a.desc, a.conseq, a.acao, a.causas, a.sugest, a.comunic, a.mat, nFotos(a), vencidaSeg(a, hoje()) ? 'PRAZO VENCIDO' : (STATUS_SEG[a.status] || a.status).toUpperCase(), t.resp || '', dBR(t.prazo), t.coment || '', a.conclEm ? umDia(Date.parse(a.conclEm)) : '', nomeP(a.porNome), umDia(a.em)]; };
  async function exportar(o) {
    const abas = [];
    if (o.inter) abas.push({ nome: 'Interações', linhas: [COL_INTER, ...o.inter.slice().sort(porData).reverse().map(linhaInter)] });
    if (o.anom) abas.push({ nome: 'Anomalias', linhas: [COL_ANOM, ...o.anom.slice().sort(porData).reverse().map(linhaAnom)] });
    if (o.cartao) abas.push({ nome: 'Cartão Amarelo', linhas: [COL_CARTAO, ...o.cartao.slice().sort(porData).reverse().map(linhaCartao)] });
    try { await baixarExcel(o.arquivo, abas); toast('Planilha baixada'); } catch (e) { toast('Não foi possível gerar a planilha agora'); }
  }

  // ---------- ações (botões com data-act) ----------
  acoes.sgNova = (t, d) => abrirForm(d.tipo);
  acoes.sgVer = (t, d) => abrirDetalhe(d.col, d.id);
  acoes.sgTratar = (t, d) => abrirTratar(d.id);
  acoes.sgAssumir = (t, d) => assumir(d.id);
  acoes.sgSit = (t, d) => { U.sit = d.sgsit; render(); };
  acoes.sgCSit = (t, d) => { U.csit = d.sgsit; render(); };
  // Do painel para a fila certa (ex.: Anomalias › Vencidas).
  acoes.sgIr = (t, d) => { if (d.sgsit) { if (d.v === 'sgcartao') U.csit = d.sgsit; else U.sit = d.sgsit; } UI.view = d.v; salvarUI(); trocarTela(d.v); };
  acoes.sgValidar = (t, d) => abrirValidar(d.id);
  acoes.expSegCartao = () => exportar({ arquivo: `Cartão Amarelo ${U.csit === 'pendentes' ? 'falta validar' : U.mes}`, cartao: S().cartao.filter(c => (!U.area || c.area === U.area) && filtroCartao(c)) });
  acoes.sgFoto = (t, d) => verFoto(d.id, (t.querySelector('img') || {}).src);
  acoes.expSegInter = () => exportar({ arquivo: `Interações ${U.mes}`, inter: S().inter.filter(r => r.mes === U.mes && (!U.area || r.area === U.area)) });
  acoes.expSegAnom = () => exportar({ arquivo: `Anomalias ${U.sit === 'abertas' ? 'em aberto' : U.mes}`, anom: S().anom.filter(a => (!U.area || a.area === U.area) && filtroSit(a)) });
  acoes.expSegTudo = () => exportar({ arquivo: `Segurança ${U.pMes}`, inter: S().inter.filter(r => r.mes === U.pMes), anom: S().anom.filter(a => a.mes === U.pMes), cartao: S().cartao.filter(c => c.mes === U.pMes) });
  acoes.sgCfgArea = () => { lerCfgDaTela(); CFG.areas.push({ nome: '', conj: '' }); render(); };
  acoes.sgCfgTirar = (t, d) => { lerCfgDaTela(); if (CFG.areas.length <= 1) { toast('Deixe pelo menos uma área'); return; } CFG.areas.splice(+d.i, 1); render(); };
  acoes.sgCfgPadrao = () => { CFG = { areas: SEG_PADRAO.areas.map(a => ({ ...a })), tipos: SEG_PADRAO.tipos.join('\n'), regimes: SEG_PADRAO.regimes.join('\n'), desvios: SEG_PADRAO.desvios.join('\n') }; render(); toast('Valores padrão na tela · salve para valer'); };
  acoes.sgCfgSalvar = async () => {
    lerCfgDaTela();
    const areas = CFG.areas.map(a => ({ nome: String(a.nome || '').replace(/\s+/g, ' ').trim().toUpperCase(), conj: a.conj || '' })).filter(a => a.nome);
    const cfg = { areas, tipos: linhas(CFG.tipos), regimes: linhas(CFG.regimes), desvios: linhas(CFG.desvios) };
    if (!areas.length || !cfg.tipos.length || !cfg.regimes.length || !cfg.desvios.length) { toast('Nenhuma lista pode ficar vazia'); return; }
    if (new Set(areas.map(a => a.nome)).size !== areas.length) { toast('Há área repetida'); return; }
    await DB.segSalvarCfg(cfg); CFG = null; DB.log && DB.log('Segurança: listas dos formulários atualizadas', 'seguranca'); toast('Listas salvas'); render();
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
    if (v === 'sgtrein') return telaTreinos().view(); // a mesma tela do RH (telas/treinos.js)
    if (!S().on || !S().loaded) { if (!S().on && v !== 'sgconfig') return vazio('Sem acesso à Segurança', 'Fale com o administrador do sistema.'); if (!S().loaded && v !== 'sgconfig') return ESQUELETO; }
    if (v === 'sginter') return vInter();
    if (v === 'sganom') return vAnom();
    if (v === 'sgcartao') return vCartao();
    if (v === 'sginsp') return INSP.view();
    if (v === 'sgpainel') return vPainel();
    if (v === 'sgconfig') return vConfig();
    return vAnom();
  }
  // Inspeções (telas/inspecoes.js): usa a folha, os filtros e o detalhe da anomalia deste módulo.
  const INSP = criarInspecoes({ U, S, L, hoje, selMes, selArea, busca, vazio, mesNome, dm, quemVe, podeRegistrar, podeExportar, minhaMat, sugestoesLocal,
    folha: (o, acao) => { const f = folha(o); folhaAcao = acao; return f; }, abrirAnom: id => abrirDetalhe('seganom', id) });
  return { render: renderTela };
}
