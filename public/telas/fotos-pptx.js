// Relatório fotográfico em PowerPoint (.pptx) e o arquivo .zip das fotos — só no navegador, carregado sob demanda
// (a biblioteca é grande: fica fora do pacote que abre sem sinal). A biblioteca PptxGenJS (com o JSZip dentro) está em
// vendor/pptxgen.bundle.js e entra por uma tag <script> criada aqui (a política de segurança só aceita scripts do
// próprio site; nada inline). O conteúdo (indicadores, grupos de fotos, limite) vem de fotos-arquivo.js.
import { DAYS, AREA_S } from '../contas/cal.js';
import * as FA from '../contas/fotos-arquivo.js';

let carregando = null;
// Carrega a biblioteca uma vez só. Depois ficam window.PptxGenJS e window.JSZip.
export function carregarBiblioteca() {
  if (globalThis.PptxGenJS && globalThis.JSZip) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'vendor/pptxgen.bundle.js'; s.async = true;
    s.onload = () => (globalThis.PptxGenJS && globalThis.JSZip ? ok() : ko(new Error('Biblioteca do PowerPoint incompleta')));
    s.onerror = () => { carregando = null; s.remove(); ko(new Error('Não foi possível carregar a biblioteca (sem sinal?)')); };
    document.head.appendChild(s);
  });
  return carregando;
}
// Imagem do próprio site em texto data: (logotipos do relatório).
export async function imagemDoSite(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('Imagem não encontrada: ' + url);
  const b = await r.blob();
  return new Promise((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ko(fr.error); fr.readAsDataURL(b); });
}
// Bytes do JPEG guardado em texto data:… e o SHA-256 (hex) deles.
export function bytesDeDataUrl(d) { const bin = atob(String(d).split(',')[1] || ''); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
export async function sha256(u8) {
  if (!(globalThis.crypto && crypto.subtle)) return '';
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8)); return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ---------- cores e textos (modelo visual da Dikma: creme, azul-marinho e laranja) ----------
const COR = { navy: '272662', barra: '10243E', laranja: 'F15A24', vermelho: 'FF0000', creme: 'F7ECDA', cremeClaro: 'FBF6EE', tinta: '16172E', cinza: '666880', linha: 'E4D9C6', branco: 'FFFFFF', R: '1E8A4C', N: 'D23B3B', E: '7A4FD6', P: '5F6385', ok: '1E8A4C', atencao: 'D99A00', critico: 'D23B3B', semNum: '666880', trilho: 'EFE7DA' };
const SIT = { R: 'Realizada', N: 'Não realizada', E: 'Extra', P: 'Programada' };
const FONTE = 'Red Hat Display', FONTE_FORTE = 'Red Hat Display Heavy';
const W = 13.333, H = 7.5;
const TOPO = 0.72, BASE = 6.73; // barra de cima e faixa de baixo dos slides internos
const diaSemana = d => DAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7];
const corta = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const hora = v => { const t = FA.ms(v); if (!t) return ''; const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const pctTxt = v => (v == null ? '—' : `${v}%`);
const nTxt = n => Number(n || 0).toLocaleString('pt-BR');
const nomeProprio = s => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());

// Imagens do modelo (img/relatorio/): capa, faixas, logotipos e o fecho. Falta de uma não impede o relatório.
export async function imagensModelo() {
  const nomes = { capa: 'capa.jpg', faixaCapa: 'faixa-capa.png', faixa: 'faixa.png', logos: 'logos.png', fecho: 'final-deco.png', dikma: 'dikma.png' };
  const out = {};
  await Promise.all(Object.entries(nomes).map(async ([k, n]) => { out[k] = await imagemDoSite('img/relatorio/' + n).catch(() => null); }));
  return out;
}

// o = { rel (FA.montarRelatorio + FA.limitarFotos), gruposTodos (os grupos antes do limite, para os números do painel),
//       tipo ('ativ'|'qz'|'om'), nomeConj ('Atividades Pátio'), area ('Tratamento de Coque' ou o local do conjunto),
//       responsavel, autor, geradoEm (Date), img (imagensModelo()), carregarFoto(f) → data:… ou null,
//       progresso(feito, total, texto), fora }
// Ordem dos slides: capa (com os 3 números principais) → registros fotográficos → painel de resultados (cartões,
// gráficos, tabela por rota com barras coloridas e pontos de atenção) → anexos (listas) → encerramento.
// Devolve o Blob do .pptx.
export async function gerarPptx(o) {
  await carregarBiblioteca();
  // tipo 'qz' (Queda zero) e 'om' (OMs): sem os indicadores e as tabelas das atividades.
  const { rel } = o; const img = o.img || {}; const qz = o.tipo === 'qz' || o.tipo === 'om';
  const nomeTipo = o.tipo === 'qz' ? 'Queda zero' : o.tipo === 'om' ? 'Solicitações de OM' : '';
  const todos = o.gruposTodos || rel.grupos; const reg = FA.resumoRegistros(todos); const i = rel.ind || {};
  const pptx = new globalThis.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = o.responsavel || o.autor || 'Dikma Gestão'; pptx.company = 'Dikma'; pptx.title = `Relatório fotográfico${qz ? ' · ' + nomeTipo : ''} · ${o.nomeConj}`;
  pptx.subject = `Período ${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  const periodo = `${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  // Comparação com o período anterior (só atividades; vem pronta da tela em o.anterior = { de, ate, cumpr, pctFoto }).
  const ant = !qz && o.anterior ? o.anterior : null;
  const nomeAnt = ant && FA.ehSemanaCheia(ant.de, ant.ate) ? 'semana anterior' : 'período anterior';
  const compara = campoAnt => { const v = ant ? FA.variacaoPts(i[campoAnt], ant[campoAnt]) : ''; return !v ? '' : v === '= igual' ? `= igual à ${nomeAnt}` : `${v} sobre a ${nomeAnt}`; };
  const filtro = `${o.area ? ' · ' + o.area : ''}${rel.rota ? ' · ' + rel.rota : ''}`;
  pptx.defineSlideMaster({
    title: 'DIKMA', background: { color: COR.branco },
    objects: [
      ...(img.logos ? [{ image: { x: 0.07, y: 0, w: 3.4, h: 0.729, data: img.logos } }] : []),
      { rect: { x: 3.54, y: 0.06, w: W - 3.54, h: 0.63, fill: { color: COR.barra } } },
      ...(img.faixa ? [{ image: { x: 0, y: BASE, w: W, h: H - BASE, data: img.faixa } }] : [{ rect: { x: 0, y: BASE, w: W, h: H - BASE, fill: { color: COR.navy } } }])
    ]
  });
  // Texto da barra azul (título do slide) e a linha de baixo (detalhe).
  // Slides internos (com a barra e a faixa); o número da página ("5 / 14") entra no fim, quando o total é conhecido.
  const internas = []; const interno = () => { const s = pptx.addSlide({ masterName: 'DIKMA' }); internas.push(s); return s; };
  const titulo = (s, t, sub) => {
    s.addText(t, { x: 3.7, y: 0.06, w: W - 4.75, h: 0.63, fontFace: FONTE_FORTE, fontSize: 24, bold: true, color: COR.branco, valign: 'middle', fit: 'shrink', margin: 0 });
    if (sub) s.addText(sub, { x: 3.7, y: 0.74, w: W - 3.85, h: 0.22, fontFace: FONTE, fontSize: 11, color: COR.cinza, valign: 'top', margin: 0, fit: 'shrink' });
  };
  const ret = (s, x, y, w, h, cor, raio) => s.addShape(raio ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { x, y, w, h, fill: { color: cor }, line: { color: cor, width: 0 }, ...(raio ? { rectRadius: raio } : {}) });
  const txt = (s, t, x, y, w, h, op = {}) => s.addText(t, { x, y, w, h, fontFace: FONTE, fontSize: 11, color: COR.tinta, margin: 0, valign: 'middle', ...op });
  // Cartão branco com borda fina e título (as caixas do painel).
  const cartao = (s, x, y, w, h, tit, sub) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: COR.branco }, line: { color: COR.linha, width: 0.75 }, rectRadius: 0.06 });
    if (tit) txt(s, tit, x + 0.22, y + 0.12, w - 0.44, 0.34, { fontFace: FONTE_FORTE, fontSize: 13.5, bold: true, color: COR.navy });
    if (sub) txt(s, sub, x + 0.22, y + 0.45, w - 0.44, 0.24, { fontSize: 9.5, color: COR.cinza });
  };
  // Número grande do painel: faixa colorida à esquerda, valor, nome e uma nota curta.
  const numero = (s, x, y, w, h, valor, nome, cor, nota) => {
    ret(s, x, y, w, h, COR.creme, 0.06); ret(s, x, y + 0.14, 0.07, h - 0.28, cor);
    txt(s, valor, x + 0.22, y + 0.08, w - 0.3, h * 0.5, { fontFace: FONTE_FORTE, fontSize: 28, bold: true, color: cor, valign: 'bottom', fit: 'shrink' });
    txt(s, nome.toUpperCase(), x + 0.22, y + h * 0.56, w - 0.3, 0.24, { fontSize: 9.5, bold: true, color: COR.navy, charSpacing: 0.5, fit: 'shrink' });
    if (nota) txt(s, nota, x + 0.22, y + h * 0.56 + 0.22, w - 0.3, 0.2, { fontSize: 8.5, color: /^[▲▼]/.test(nota) ? corVar(nota) : COR.cinza, fit: 'shrink' });
  };
  // Lista de barras horizontais (desenhadas, para ler fácil): nome · barra · valor.
  const barras = (s, itens, { x, y, w, h, cor, fmt = nTxt, max, rotW = 0.42, linhaMax = 0.46 }) => {
    if (!itens.length) return;
    const lh = Math.min(linhaMax, h / itens.length); const rw = w * rotW, nw = 0.62, bw = w - rw - nw - 0.12;
    const mx = max || Math.max(1, ...itens.map(it => it.n));
    itens.forEach((it, j) => {
      const yy = y + j * lh; const c = typeof cor === 'function' ? cor(it) : cor;
      txt(s, corta(it.rot, 46), x, yy, rw - 0.08, lh, { fontSize: 10.5, fit: 'shrink' });
      ret(s, x + rw, yy + lh * 0.28, bw, lh * 0.44, COR.trilho);
      if (it.n > 0) ret(s, x + rw, yy + lh * 0.28, Math.max(0.04, bw * Math.min(1, it.n / mx)), lh * 0.44, c);
      txt(s, fmt(it.n), x + rw + bw + 0.1, yy, nw, lh, { fontSize: 11, bold: true, color: c === COR.trilho ? COR.cinza : COR.tinta });
    });
  };
  const corPct = p => COR[FA.semaforo(p) || 'semNum'];
  const corVar = t => (String(t).startsWith('▲') ? COR.ok : String(t).startsWith('▼') ? COR.critico : COR.cinza);
  const legendaFaixas = (s, x, y, w) => txt(s, [
    { text: '■ ', options: { color: COR.ok } }, { text: `${FA.FAIXA_OK}% ou mais    ` },
    { text: '■ ', options: { color: COR.atencao } }, { text: `${FA.FAIXA_ATENCAO}% a ${FA.FAIXA_OK - 1}%    ` },
    { text: '■ ', options: { color: COR.critico } }, { text: `abaixo de ${FA.FAIXA_ATENCAO}%` }
  ], x, y, w, 0.24, { fontSize: 9.5, color: COR.cinza, align: 'right' });

  // ---- capa ----
  {
    const s = pptx.addSlide();
    s.background = { color: COR.creme };
    if (img.capa) s.addImage({ data: img.capa, x: 0, y: 0, w: 5.73, h: 6.35, sizing: { type: 'cover', w: 5.73, h: 6.35 } });
    else ret(s, 0, 0, 5.73, 6.35, COR.navy);
    if (img.faixaCapa) s.addImage({ data: img.faixaCapa, x: 0, y: 6.35, w: W, h: H - 6.35 });
    else ret(s, 0, 6.35, W, H - 6.35, COR.laranja);
    if (img.logos) s.addImage({ data: img.logos, x: 6.0, y: 0.32, w: 3.4, h: 0.729 });
    const cheia = FA.ehSemanaCheia(rel.de, rel.ate);
    const oQue = o.tipo === 'om' ? 'das OMs' : o.tipo === 'qz' ? 'da queda zero' : 'de atividades';
    txt(s, `Relatório fotográfico${cheia ? ' semanal' : ''} ${oQue}`, 6.3, 1.25, 6.75, 1.45, { fontFace: FONTE_FORTE, fontSize: 38, bold: true, color: COR.navy, valign: 'bottom', fit: 'shrink', lineSpacingMultiple: 0.9 });
    txt(s, [{ text: FA.periodoExtenso(rel.de, rel.ate), options: { bold: true, breakLine: true } }, { text: FA.textoSemanas(rel.de, rel.ate) }],
      6.32, 2.85, 6.6, 0.7, { fontSize: 17, color: COR.laranja, valign: 'top', fit: 'shrink' });
    const linhas = [[{ text: 'Área: ', options: { bold: true } }, { text: o.area || o.nomeConj, options: { breakLine: true } }]];
    if (rel.rota) linhas.push([{ text: 'Rota: ', options: { bold: true } }, { text: rel.rota, options: { breakLine: true } }]);
    linhas.push([{ text: 'Responsável: ', options: { bold: true } }, { text: nomeProprio(o.responsavel) || '—' }]);
    txt(s, linhas.flat(), 6.32, 3.65, 6.6, 0.95, { fontSize: 14, color: COR.navy, valign: 'top', fit: 'shrink', paraSpaceAfter: 2 });
    // os 3 números principais
    const tres = qz ? [[nTxt(reg.fotos), 'registros fotográficos'], [nTxt(reg.ocorrencias), o.tipo === 'om' ? 'OMs com foto' : 'ocorrências'], [nTxt(reg.locais), 'locais']]
      : [[nTxt(reg.fotos), 'registros fotográficos'], [pctTxt(i.cumpr), 'de cumprimento', compara('cumpr')], [pctTxt(i.pctFoto), 'das atividades com foto', compara('pctFoto')]];
    tres.forEach(([v, t, cmp], j) => {
      const x = 6.32 + j * 2.22; ret(s, x, 4.78, 2.07, 1.0, COR.branco, 0.06);
      txt(s, v, x + 0.15, 4.84, 1.8, 0.52, { fontFace: FONTE_FORTE, fontSize: 26, bold: true, color: j === 0 ? COR.navy : COR.laranja, fit: 'shrink' });
      txt(s, cmp ? [{ text: t, options: { breakLine: true } }, { text: cmp, options: { fontSize: 8.5, color: corVar(cmp) } }] : t,
        x + 0.15, 5.36, 1.8, 0.38, { fontSize: 10, color: COR.navy, valign: 'top', fit: 'shrink' });
    });
    const g = o.geradoEm || new Date();
    txt(s, `${nomeTipo || o.nomeConj}${o.fora ? ` · ${nTxt(o.fora)} fotos fora deste arquivo pelo limite de ${FA.MAX_FOTOS_PPTX}` : ''} · gerado em ${g.toLocaleDateString('pt-BR')} às ${hora(g)} · Dikma Gestão`, 6.32, 5.92, 6.6, 0.26, { fontSize: 9.5, color: COR.cinza, fit: 'shrink' });
  }

  // ---- painel de resultados (dashboard) ----
  const porDia = FA.fotosPorPeriodo(todos, rel.de, rel.fim || rel.ate);
  const graficoDias = (s, x, y, w, h) => {
    if (!porDia.some(d => d.n)) { txt(s, 'Sem fotos no período.', x, y, w, h, { fontSize: 12, color: COR.cinza, align: 'center' }); return; }
    s.addChart(pptx.ChartType.bar, [{ name: 'Fotos', labels: porDia.map(d => d.rot), values: porDia.map(d => d.n) }], {
      x, y, w, h, barDir: 'col', chartColors: [COR.navy], barGapWidthPct: 45, showValue: porDia.length <= 16, dataLabelFontSize: 9, dataLabelColor: COR.navy, dataLabelPosition: 'outEnd',
      catAxisLabelFontSize: porDia.length > 16 ? 7 : 9, valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLineShow: true, catAxisLineColor: COR.linha,
      catAxisLabelFontFace: FONTE, catAxisLabelColor: COR.cinza, showLegend: false
    });
  };
  if (!qz) {
    // 1) painel geral
    {
      const s = interno();
      titulo(s, 'Painel de resultados', `${periodo}${rel.fim < rel.ate ? ` · contado até ${FA.dBR(rel.fim)}` : ''}${filtro}`);
      const nums = [[nTxt(i.prog), 'Programadas', COR.P, 'no período'], [nTxt(i.R), 'Realizadas', COR.R, i.prog ? `${pctTxt(i.cumpr)} das programadas` : ''],
        [nTxt(i.N), 'Não realizadas', COR.N, i.P ? `${nTxt(i.P)} sem apontamento` : ''], [nTxt(i.E), 'Extras', COR.E, 'fora da programação'],
        [pctTxt(i.cumpr), 'Cumprimento', corPct(i.cumpr), compara('cumpr') || 'realizadas ÷ programadas'],
        [pctTxt(i.pctFoto), 'Com foto', corPct(i.pctFoto), compara('pctFoto') || `${nTxt(i.comFoto)} de ${nTxt(i.exigem)} atividades`]];
      const nw = (W - 1 - 5 * 0.15) / 6;
      nums.forEach(([v, t, c, n], j) => numero(s, 0.5 + j * (nw + 0.15), 1.05, nw, 1.12, v, t, c, n));
      const y2 = 2.35, h2 = 4.2;
      // rosca: situação das programadas
      cartao(s, 0.5, y2, 3.7, h2, 'Situação das programadas', 'Realizadas, não realizadas e pendentes');
      if (i.prog) {
        s.addChart(pptx.ChartType.doughnut, [{ name: 'Situação', labels: ['Realizadas', 'Não realizadas', 'Pendentes'], values: [i.R, i.N, i.P] }], {
          x: 0.75, y: y2 + 0.75, w: 3.2, h: 2.6, holeSize: 62, chartColors: [COR.R, COR.N, COR.trilho], showLegend: false, showValue: false, showPercent: false, dataBorder: { pt: 1, color: COR.branco } });
        txt(s, pctTxt(i.cumpr), 0.75, y2 + 1.7, 3.2, 0.5, { fontFace: FONTE_FORTE, fontSize: 26, bold: true, color: corPct(i.cumpr), align: 'center' });
        txt(s, 'cumprimento', 0.75, y2 + 2.17, 3.2, 0.26, { fontSize: 10, color: COR.cinza, align: 'center' });
        const leg = [['Realizadas', i.R, COR.R], ['Não realizadas', i.N, COR.N], ['Pendentes', i.P, COR.cinza]];
        leg.forEach(([t, v, c], j) => txt(s, [{ text: '■ ', options: { color: c } }, { text: t, options: { breakLine: true } }, { text: nTxt(v), options: { bold: true, fontSize: 12 } }], 0.7 + j * 1.12, y2 + 3.45, 1.12, 0.55, { fontSize: 9.5, align: 'center', valign: 'top' }));
      } else txt(s, 'Nada programado no período.', 0.7, y2 + 1.5, 3.3, 0.5, { fontSize: 12, color: COR.cinza, align: 'center' });
      // cumprimento por rota (menor primeiro)
      const rr = rel.porRota.filter(r => r.prog).sort((a, b) => (a.cumpr ?? 101) - (b.cumpr ?? 101) || String(a.rota).localeCompare(String(b.rota)));
      cartao(s, 4.35, y2, 4.55, h2, 'Cumprimento por rota', rr.length > 8 ? `As 8 com menor cumprimento (de ${rr.length}); todas no slide seguinte` : 'Da menor para a maior');
      if (rr.length) barras(s, rr.slice(0, 8).map(r => ({ rot: r.rota, n: r.cumpr || 0 })), { x: 4.57, y: y2 + 0.8, w: 4.15, h: h2 - 1.25, cor: it => corPct(it.n), fmt: v => v + '%', max: 100, rotW: 0.4 });
      else txt(s, 'Nenhuma rota com atividade programada.', 4.5, y2 + 1.5, 4.2, 0.5, { fontSize: 12, color: COR.cinza, align: 'center' });
      legendaFaixas(s, 4.5, y2 + h2 - 0.38, 4.25);
      // fotos por dia
      cartao(s, 9.05, y2, W - 9.55, h2, 'Registros fotográficos', `${nTxt(reg.fotos)} fotos · ${porDia.length > 0 && porDia[0].rot.startsWith('Sem') ? 'por semana' : 'por dia'}`);
      graficoDias(s, 9.15, y2 + 0.75, W - 9.75, h2 - 0.9);
    }
    // 2) painel por rota: tabela com barras coloridas
    if (rel.porRota.length) {
      const pr = FA.paginar(rel.porRota, 12);
      pr.forEach((pg, n) => {
        const s = interno();
        titulo(s, 'Painel por rota', `${periodo}${filtro}${pr.length > 1 ? ` · parte ${n + 1} de ${pr.length}` : ''}`);
        const cols = [['Rota', 2.85, 'left'], ['Programadas', 1.2], ['Realizadas', 1.1], ['Não realizadas', 1.25], ['Extras', 0.8], ['Cumprimento', 2.55, 'barra'], ['Com foto', 2.55, 'barra']];
        const xs = []; let xx = 0.5; for (const c of cols) { xs.push(xx); xx += c[1]; }
        const tw = xx - 0.5, y0 = 1.05, rh = pg.length <= 8 ? 0.46 : 0.37;
        ret(s, 0.5, y0, tw, 0.4, COR.navy, 0);
        cols.forEach(([t, w, al], j) => txt(s, t, xs[j] + 0.1, y0, w - 0.2, 0.4, { fontSize: 10, bold: true, color: COR.branco, align: al ? 'left' : 'right', fit: 'shrink' }));
        const linha = (r, y, fundo, forte) => {
          if (fundo) ret(s, 0.5, y, tw, rh, fundo);
          txt(s, forte ? [{ text: 'Total', options: { bold: true } }] : [{ text: r.rota || '—', options: { bold: true } }, { text: '  ' + (AREA_S[r.area] || nomeProprio(r.area) || ''), options: { color: COR.cinza, fontSize: 9 } }], xs[0] + 0.1, y, cols[0][1] - 0.2, rh, { fontSize: 10.5, fit: 'shrink' });
          [[r.prog], [r.R, COR.R], [r.N, r.N ? COR.N : COR.tinta], [r.E]].forEach(([v, c], j) => txt(s, nTxt(v), xs[j + 1] + 0.1, y, cols[j + 1][1] - 0.2, rh, { fontSize: 10.5, align: 'right', color: c || COR.tinta, bold: forte }));
          [r.cumpr, r.pctFoto].forEach((p, j) => {
            const x = xs[5 + j] + 0.12, bw = cols[5 + j][1] - 0.95;
            ret(s, x, y + rh * 0.3, bw, rh * 0.4, COR.trilho);
            if (p) ret(s, x, y + rh * 0.3, Math.max(0.04, bw * Math.min(1, p / 100)), rh * 0.4, corPct(p));
            txt(s, pctTxt(p), x + bw + 0.08, y, 0.7, rh, { fontSize: 10.5, bold: true, color: p == null ? COR.cinza : corPct(p) });
          });
        };
        pg.forEach((r, j) => linha(r, y0 + 0.4 + j * rh, j % 2 ? COR.cremeClaro : null));
        let yf = y0 + 0.4 + pg.length * rh;
        if (n === pr.length - 1) { linha(i, yf, COR.creme, true); yf += rh; }
        s.addShape(pptx.ShapeType.line, { x: 0.5, y: yf, w: tw, h: 0, line: { color: COR.linha, width: 0.75 } });
        legendaFaixas(s, 0.5, Math.min(6.38, yf + 0.12), tw);
      });
    }
    // 3) pontos de atenção
    {
      const s = interno();
      titulo(s, 'Pontos de atenção', `${periodo}${filtro}`);
      const ch = 5.5, y = 1.05, cw = (W - 1.15) / 2;
      cartao(s, 0.5, y, cw, ch);
      txt(s, [{ text: nTxt(rel.naoReal.length), options: { fontFace: FONTE_FORTE, fontSize: 26, bold: true, color: rel.naoReal.length ? COR.N : COR.R } }, { text: '  não realizadas', options: { fontFace: FONTE_FORTE, fontSize: 14, bold: true, color: COR.navy } }], 0.72, y + 0.12, cw - 0.44, 0.55);
      if (rel.naoReal.length) {
        txt(s, 'MOTIVOS INFORMADOS', 0.72, y + 0.8, cw - 0.44, 0.24, { fontSize: 9, bold: true, color: COR.laranja, charSpacing: 0.6 });
        barras(s, FA.contarPor(rel.naoReal, x => x.motivo, 5), { x: 0.72, y: y + 1.05, w: cw - 0.44, h: 2.1, cor: COR.N, rotW: 0.5, linhaMax: 0.42 });
        txt(s, 'ROTAS COM MAIS NÃO REALIZADAS', 0.72, y + 3.3, cw - 0.44, 0.24, { fontSize: 9, bold: true, color: COR.laranja, charSpacing: 0.6 });
        barras(s, FA.contarPor(rel.naoReal, x => x.rota, 4), { x: 0.72, y: y + 3.55, w: cw - 0.44, h: 1.75, cor: COR.N, rotW: 0.5, linhaMax: 0.42 });
      } else txt(s, 'Todas as atividades programadas e apontadas foram realizadas.', 0.72, y + 1.2, cw - 0.44, 0.6, { fontSize: 13, color: COR.R });
      const x2 = 0.5 + cw + 0.15;
      cartao(s, x2, y, cw, ch);
      txt(s, [{ text: nTxt(rel.semFoto.length), options: { fontFace: FONTE_FORTE, fontSize: 26, bold: true, color: rel.semFoto.length ? COR.atencao : COR.R } }, { text: '  realizadas sem foto', options: { fontFace: FONTE_FORTE, fontSize: 14, bold: true, color: COR.navy } }], x2 + 0.22, y + 0.12, cw - 0.44, 0.55);
      if (rel.semFoto.length) {
        txt(s, `POR ROTA · ${pctTxt(i.pctFoto)} DAS ATIVIDADES TÊM FOTO`, x2 + 0.22, y + 0.8, cw - 0.44, 0.24, { fontSize: 9, bold: true, color: COR.laranja, charSpacing: 0.6 });
        barras(s, FA.contarPor(rel.semFoto, x => x.rota, 9), { x: x2 + 0.22, y: y + 1.05, w: cw - 0.44, h: 4.25, cor: COR.atencao, rotW: 0.5, linhaMax: 0.44 });
      } else txt(s, 'Todas as atividades realizadas têm registro fotográfico.', x2 + 0.22, y + 1.2, cw - 0.44, 0.6, { fontSize: 13, color: COR.R });
    }
  } else {
    // Queda zero e OMs: números dos registros, fotos por dia e os locais com mais registros
    const s = interno();
    titulo(s, 'Painel de registros', `${periodo}${filtro}`);
    const nums = [[nTxt(reg.fotos), 'Registros fotográficos', COR.navy], [nTxt(reg.ocorrencias), o.tipo === 'om' ? 'OMs com foto' : 'Ocorrências', COR.laranja],
      [nTxt(reg.dias), 'Dias com registro', COR.P], [nTxt(reg.locais), 'Locais', COR.E], [nTxt(reg.pessoas), 'Colaboradores', COR.R]];
    const nw = (W - 1 - 4 * 0.15) / 5;
    nums.forEach(([v, t, c], j) => numero(s, 0.5 + j * (nw + 0.15), 1.05, nw, 1.12, v, t, c));
    const y2 = 2.35, h2 = 4.2, w1 = 6.6;
    cartao(s, 0.5, y2, w1, h2, 'Registros fotográficos', porDia.length && porDia[0].rot.startsWith('Sem') ? 'Por semana' : 'Por dia');
    graficoDias(s, 0.6, y2 + 0.75, w1 - 0.2, h2 - 0.9);
    cartao(s, 0.65 + w1, y2, W - 1.15 - w1, h2, 'Locais com mais registros', 'Quantidade de fotos');
    barras(s, FA.contarPor(todos, g => g.local || g.rota, 8, g => g.fotos.length), { x: 0.87 + w1, y: y2 + 0.8, w: W - 1.6 - w1, h: h2 - 1.0, cor: COR.navy, rotW: 0.5 });
  }

  // ---- registros fotográficos ----
  // Fotos à esquerda (a marca Antes/Durante/Depois fica numa etiqueta em cima da foto) e, à direita, um cartão com
  // os dados do registro: data, local, atividade (ou o motivo da queda / o serviço da OM), rota e área, colaborador
  // e a situação colorida.
  const total = rel.grupos.reduce((n, g) => n + g.fotos.length, 0); let feitas = 0;
  const rotDesc = o.tipo === 'qz' ? 'Motivo da queda / descrição' : o.tipo === 'om' ? 'Serviço da OM' : 'Atividade';
  const COR_MARCA = { Antes: COR.laranja, Durante: COR.navy, Depois: COR.R };
  const campo = (rot, val, op = {}) => [
    { text: rot.toUpperCase(), options: { fontSize: 10, bold: true, color: COR.laranja, charSpacing: 0.6, breakLine: true } },
    { text: val || '—', options: { fontSize: op.fs || 14, bold: !!op.bold, color: COR.tinta, breakLine: true, paraSpaceAfter: 14 } }
  ];
  const pags = FA.paginasFotos(rel.grupos, FA.FOTOS_POR_SLIDE); let nPag = 0;
  if (!pags.length) {
    const s = interno(); titulo(s, 'Registros fotográficos', periodo + filtro);
    txt(s, 'Nenhum registro fotográfico no período.', 0.5, 3, W - 1, 0.6, { fontSize: 18, color: COR.cinza, align: 'center' });
  }
  for (const pag of pags) {
    nPag++;
    const s = interno();
    const g = pag.grupos[0]; const so = pag.grupos.length === 1; const um = so && g.itens.length <= 1;
    const colabs = [...new Set(pag.grupos.flatMap(x => x.colabs))];
    const parte = pag.parte && pag.parte[1] > 1 ? ` (parte ${pag.parte[0]} de ${pag.parte[1]})` : '';
    // título: o local; slide com várias atividades da mesma rota: "ROTA 4 · 2 atividades"
    titulo(s, corta(so ? `Local: ${g.local || g.rota || '—'}` : `${g.rota || '—'} · ${pag.grupos.length} atividades`, 90), `Registro ${nPag} de ${pags.length}`);
    const desc = so ? (um ? g.titulo : g.itens.map(x => x.ativ).filter(Boolean).slice(0, 6).map(t => '• ' + corta(t, 60)).join('\n') + (g.itens.length > 6 ? `\ne mais ${g.itens.length - 6}` : ''))
      : pag.grupos.map((x, j) => `${j + 1}. ${corta(x.itens.length > 1 ? `${x.itens.length} atividades` : x.titulo, 60)}`).join('\n');
    const info = [
      ['Data do registro', `${diaSemana(g.dia)} · ${FA.dBR(g.dia)}${parte}`, { bold: true }],
      [so ? rotDesc : 'Atividades neste slide', desc, { bold: um, fs: um ? 15 : 13 }],
      ['Rota · área', `${g.rota || '—'} · ${AREA_S[g.area] || nomeProprio(g.area) || '—'}`],
      [colabs.length > 1 ? 'Colaboradores' : 'Colaborador', corta(colabs.map(nomeProprio).join(', ') || '—', 120)]
    ];
    const comSit = so && g.sit && !qz;
    const selo = (x, y, w) => {
      txt(s, 'SITUAÇÃO', x, y, w, 0.2, { fontSize: 9, bold: true, color: COR.laranja, charSpacing: 0.6 });
      const c = COR[g.sit] || COR.P; ret(s, x, y + 0.24, Math.min(w, 1.75), 0.4, c, 0.08);
      txt(s, SIT[g.sit] || g.sit, x, y + 0.24, Math.min(w, 1.75), 0.4, { fontSize: 12, bold: true, color: COR.branco, align: 'center' });
    };
    // Duas fotos deitadas (o Antes e o Depois, quase sempre): fotos grandes lado a lado e os dados numa faixa embaixo.
    // Nos outros casos: fotos à esquerda e o cartão com os dados à direita.
    const faixa = FA.fotosEmFaixa(pag.fotos.map(x => x.f));
    let caixaFotos;
    if (faixa) {
      const fy = 5.38, fh = 1.22; ret(s, 0.45, fy, W - 0.9, fh, COR.creme, 0.05);
      const cols = comSit ? [2.0, 4.0, 2.3, 1.9] : [2.15, 5.4, 2.45, 2.0]; let x = 0.7;
      info.forEach(([rot, val, op = {}], j) => {
        txt(s, [...campo(rot, corta(val, 220), { ...op, fs: Math.min(op.fs || 13, 13) })], x, fy + 0.12, cols[j] - 0.2, fh - 0.2, { valign: 'top', fit: 'shrink' });
        x += cols[j];
      });
      if (comSit) selo(x, fy + 0.14, W - 0.7 - x);
      caixaFotos = { x: 0.45, y: 0.95, w: W - 0.9, h: 4.3 };
    } else {
      const cx0 = 8.78, cw = W - cx0 - 0.45;
      ret(s, cx0, 0.95, cw, 5.62, COR.creme, 0.05);
      txt(s, info.flatMap(([rot, val, op]) => campo(rot, corta(val, 420), op)), cx0 + 0.25, 1.15, cw - 0.5, 4.6, { valign: 'top', fit: 'shrink' });
      if (comSit) selo(cx0 + 0.25, 5.62, cw - 0.5);
      caixaFotos = { x: 0.45, y: 0.95, w: 8.1, h: 5.65 };
    }
    // fotos
    const leg = 0.3;
    const pos = FA.gradeFotos(pag.fotos.length, caixaFotos, leg, 0.2);
    for (let j = 0; j < pag.fotos.length; j++) {
      const { f, g: gf } = pag.fotos[j]; const cx = pos[j]; const st = FA.statusFoto(f);
      o.progresso && o.progresso(feitas, total, `Fotos ${feitas + 1} de ${total}`);
      let dados = null;
      try { dados = st === 'arquivada' ? f.thumb : await o.carregarFoto(f); } catch (e) { dados = null; }
      if (!dados && f.thumb) dados = f.thumb;
      const e = FA.encaixar(f.w || 4, f.h || 3, { x: cx.x + 0.05, y: cx.y + 0.05, w: cx.w - 0.1, h: cx.h - 0.1 });
      if (dados) {
        s.addShape(pptx.ShapeType.rect, { x: e.x - 0.05, y: e.y - 0.05, w: e.w + 0.1, h: e.h + 0.1, fill: { color: COR.branco }, line: { color: COR.linha, width: 0.75 }, shadow: { type: 'outer', blur: 4, offset: 1.5, angle: 90, color: '000000', opacity: 0.18 } });
        s.addImage({ data: dados, x: e.x, y: e.y, w: e.w, h: e.h, altText: `Foto: ${gf.titulo || ''}` });
      } else {
        ret(s, cx.x, cx.y, cx.w, cx.h, COR.creme, 0.06);
        txt(s, 'Foto não encontrada no banco', cx.x, cx.y, cx.w, cx.h, { fontSize: 12, color: COR.cinza, align: 'center' });
      }
      const marca = FA.marcaDaFoto(f, gf.fotos);
      if (marca && dados) {
        ret(s, e.x + 0.1, e.y + 0.1, 1.05, 0.32, COR_MARCA[marca] || COR.navy, 0.06);
        txt(s, marca.toUpperCase(), e.x + 0.1, e.y + 0.1, 1.05, 0.32, { fontFace: FONTE_FORTE, fontSize: 10.5, bold: true, color: COR.branco, align: 'center', charSpacing: 0.8 });
      }
      const extra = st === 'arquivada' ? ' · miniatura (foto completa arquivada)' : !dados || dados === f.thumb ? ' · miniatura' : '';
      const ref = so ? '' : `Atividade ${pag.grupos.indexOf(gf) + 1} · `;
      txt(s, [
        { text: ref, options: { bold: true, color: COR.navy } },
        { text: hora(f.at) ? `${hora(f.at)}` : FA.ddmm(f.dia), options: { color: COR.navy } },
        ...(!marca || dados ? [] : [{ text: ' · ' + marca }]),
        { text: extra }
      ], cx.x, e.y + e.h + 0.08, cx.w, 0.24, { fontSize: 10.5, color: COR.cinza, align: 'center', valign: 'top', fit: 'shrink' });
      feitas++;
    }
  }

  // ---- anexos: listas das não realizadas e das realizadas sem foto ----
  const cab = (t, opt = {}) => ({ text: t, options: { bold: true, color: COR.branco, fill: { color: COR.navy }, fontSize: 10, align: opt.align || 'left', valign: 'middle' } });
  const cel = (t, opt = {}) => ({ text: String(t ?? ''), options: { fontSize: 10, color: opt.cor || COR.tinta, align: opt.align || 'left', bold: !!opt.bold, valign: 'middle', fill: opt.fill ? { color: opt.fill } : undefined } });
  const tabOpts = (colW, y = 1.05) => ({ x: 0.5, y, w: W - 1, colW, fontFace: FONTE, border: { type: 'solid', pt: 0.5, color: COR.linha }, rowH: 0.34, margin: [2, 6, 2, 6], autoPage: false });
  const tabela = (lista, tituloT, cols, linha, max = 4) => {
    if (!lista.length) return;
    const pgs = FA.paginar(lista, 13); const usar = pgs.slice(0, max);
    usar.forEach((pg, n) => {
      const s = interno();
      titulo(s, tituloT, `${nTxt(lista.length)} no período${usar.length > 1 ? ` · parte ${n + 1} de ${usar.length}` : ''}${n === usar.length - 1 && pgs.length > usar.length ? ` · mostrando ${nTxt(usar.length * 13)} (veja a lista completa no sistema)` : ''}`);
      const rows = [cols.map(([t]) => cab(t))];
      pg.forEach((x, j) => rows.push(linha(x).map(t => cel(t, { fill: j % 2 ? COR.cremeClaro : undefined }))));
      s.addTable(rows, tabOpts(cols.map(c => c[1])));
    });
  };
  if (!qz) tabela(rel.naoReal, 'Anexo · Atividades não realizadas', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.0], ['Atividade', 3.2], ['Motivo', 2.43]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, AREA_S[x.area] || x.area, x.rota, corta(x.local, 40), corta(x.ativ, 70), corta(x.motivo || '—', 60)]);
  if (!qz) tabela(rel.semFoto, 'Anexo · Realizadas sem foto', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.3], ['Atividade', 4.13], ['Situação', 1.2]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, AREA_S[x.area] || x.area, x.rota, corta(x.local, 44), corta(x.ativ, 80), SIT[x.sit] || x.sit], 3);

  // ---- encerramento ----
  {
    const s = pptx.addSlide();
    s.background = { color: COR.creme };
    if (img.fecho) s.addImage({ data: img.fecho, x: 6.05, y: 0, w: W - 6.05, h: H });
    else ret(s, 8.9, 0, W - 8.9, H, COR.navy);
    txt(s, 'Obrigado pela atenção!', 0.75, 2.4, 5.0, 1.4, { fontFace: FONTE_FORTE, fontSize: 40, bold: true, color: COR.navy, fit: 'shrink' });
    if (img.dikma) s.addImage({ data: img.dikma, x: 0.75, y: 5.4, w: 3.9, h: 1.3 });
  }

  // número da página em todos os slides internos (a capa é a 1 e o encerramento, a última)
  const nSlides = internas.length + 2;
  internas.forEach((s, j) => txt(s, `${j + 2} / ${nSlides}`, W - 1.0, 0.06, 0.85, 0.63, { fontSize: 11, color: COR.branco, align: 'right' }));

  o.progresso && o.progresso(total, total, 'Montando o arquivo…');
  return pptx.write({ outputType: 'blob' });
}

// ---------- arquivo .zip ----------
// o = { fotos (as que podem ser exportadas), itensDe(f), de, ate, lote, carregarFoto(f), progresso(feito, total, texto) }
// Baixa cada foto completa, confere o SHA-256 com o gravado pelo aparelho e monta as pastas + indice.csv.
// Devolve { blob, conf: { id: 'ok'|'divergente'|'sem-sha'|'sem-arquivo' }, incluidas: [ids], divergentes, semArquivo }.
export async function gerarZip(o) {
  await carregarBiblioteca();
  const zip = new globalThis.JSZip(); const conf = {}; const caminhos = {}; const incluidas = [];
  const total = o.fotos.length; let n = 0;
  for (const f of o.fotos) {
    o.progresso && o.progresso(n, total, `Fotos ${n + 1} de ${total}`);
    let dados = null; try { dados = await o.carregarFoto(f); } catch (e) { dados = null; }
    if (!dados) { conf[f.id] = 'sem-arquivo'; caminhos[f.id] = ''; n++; continue; }
    const u8 = bytesDeDataUrl(dados); const sha = await sha256(u8);
    conf[f.id] = FA.conferirSha(f.sha, sha);
    const cam = FA.caminhoZip(f, o.itensDe(f), o.de, o.ate); caminhos[f.id] = cam;
    zip.file(cam, u8, { binary: true, compression: 'STORE', date: new Date(FA.ms(f.at) || Date.now()) });
    incluidas.push(f.id); n++;
  }
  const linhas = FA.linhasIndice(o.fotos, { itensDe: o.itensDe, caminhoDe: f => caminhos[f.id], confDe: f => conf[f.id], lote: o.lote });
  zip.file(`${FA.pastaPeriodo(o.de, o.ate)}/indice.csv`, FA.gerarCsv(linhas));
  const leia = [`Arquivo de fotos das atividades — Dikma Gestão`, `Período: ${FA.dBR(o.de)} a ${FA.dBR(o.ate)} · ${o.nomeConj || ''}${o.rota ? ' · ' + o.rota : ''}`, `Lote: ${o.lote}`, `Fotos: ${incluidas.length}`,
    `Pastas: período / colaborador / ROTA - LOCAL - ATIVIDADE / data_id.jpg (a foto que vale para várias atividades fica numa pasta "VARIAS ATIVIDADES" e aparece em várias linhas do índice).`,
    `indice.csv: separado por ponto e vírgula; a coluna sha256 é a impressão digital gravada pelo celular na hora da foto e a coluna conferencia diz se o arquivo bate com ela.`];
  zip.file(`${FA.pastaPeriodo(o.de, o.ate)}/LEIA-ME.txt`, leia.join('\r\n') + '\r\n');
  o.progresso && o.progresso(total, total, 'Montando o arquivo .zip…');
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' }, m => o.progresso && o.progresso(total, total, `Montando o arquivo .zip… ${Math.round(m.percent)}%`));
  const vals = Object.values(conf);
  return { blob, conf, incluidas, divergentes: vals.filter(x => x === 'divergente').length, semArquivo: vals.filter(x => x === 'sem-arquivo').length };
}
// Entrega o arquivo para o navegador salvar.
export function baixarBlob(blob, nome) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
