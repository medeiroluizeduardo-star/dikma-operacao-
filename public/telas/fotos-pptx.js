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
const COR = { navy: '272662', barra: '10243E', laranja: 'F15A24', vermelho: 'FF0000', creme: 'F7ECDA', cremeClaro: 'FBF6EE', tinta: '16172E', cinza: '666880', linha: 'E4D9C6', branco: 'FFFFFF', R: '1E8A4C', N: 'D23B3B', E: '7A4FD6', P: '5F6385' };
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

// o = { rel (FA.montarRelatorio + FA.limitarFotos), tipo ('ativ'|'qz'|'om'), nomeConj ('Atividades Pátio'),
//       area ('Tratamento de Coque' ou o local do conjunto), responsavel, autor, geradoEm (Date),
//       img (imagensModelo()), carregarFoto(f) → data:… ou null, progresso(feito, total, texto), fora }
// Devolve o Blob do .pptx.
export async function gerarPptx(o) {
  await carregarBiblioteca();
  // tipo 'qz' (Queda zero) e 'om' (OMs): sem os indicadores e as tabelas das atividades.
  const { rel } = o; const img = o.img || {}; const qz = o.tipo === 'qz' || o.tipo === 'om';
  const nomeTipo = o.tipo === 'qz' ? 'Queda zero' : o.tipo === 'om' ? 'Solicitações de OM' : '';
  const pptx = new globalThis.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = o.responsavel || o.autor || 'Dikma Gestão'; pptx.company = 'Dikma'; pptx.title = `Relatório fotográfico${qz ? ' · ' + nomeTipo : ''} · ${o.nomeConj}`;
  pptx.subject = `Período ${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  const periodo = `${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  pptx.defineSlideMaster({
    title: 'DIKMA', background: { color: COR.branco },
    objects: [
      ...(img.logos ? [{ image: { x: 0.07, y: 0, w: 3.4, h: 0.729, data: img.logos } }] : []),
      { rect: { x: 3.54, y: 0.06, w: W - 3.54, h: 0.63, fill: { color: COR.barra } } },
      ...(img.faixa ? [{ image: { x: 0, y: BASE, w: W, h: H - BASE, data: img.faixa } }] : [{ rect: { x: 0, y: BASE, w: W, h: H - BASE, fill: { color: COR.navy } } }])
    ]
  });
  // Texto da barra azul (título do slide) e a linha de baixo (detalhe).
  const titulo = (s, t, sub) => {
    s.addText(t, { x: 3.7, y: 0.06, w: W - 3.85, h: 0.63, fontFace: FONTE_FORTE, fontSize: 24, bold: true, color: COR.branco, valign: 'middle', fit: 'shrink', margin: 0 });
    if (sub) s.addText(sub, { x: 3.7, y: 0.74, w: W - 3.85, h: 0.3, fontFace: FONTE, fontSize: 11.5, color: COR.navy, valign: 'top', margin: 0, fit: 'shrink' });
  };

  // ---- capa ----
  {
    const s = pptx.addSlide();
    s.background = { color: COR.creme };
    if (img.capa) s.addImage({ data: img.capa, x: 0, y: 0, w: 5.73, h: 6.35, sizing: { type: 'cover', w: 5.73, h: 6.35 } });
    else s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 5.73, h: 6.35, fill: { color: COR.navy }, line: { color: COR.navy } });
    if (img.faixaCapa) s.addImage({ data: img.faixaCapa, x: 0, y: 6.35, w: W, h: H - 6.35 });
    else s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.35, w: W, h: H - 6.35, fill: { color: COR.laranja }, line: { color: COR.laranja } });
    if (img.logos) s.addImage({ data: img.logos, x: 6.0, y: 0.32, w: 3.4, h: 0.729 });
    const cheia = FA.ehSemanaCheia(rel.de, rel.ate);
    const oQue = o.tipo === 'om' ? 'das OMs' : o.tipo === 'qz' ? 'da queda zero' : 'de atividades';
    s.addText(`Relatório fotográfico${cheia ? ' semanal' : ''} ${oQue}`, { x: 6.3, y: 1.55, w: 6.75, h: 1.6, fontFace: FONTE_FORTE, fontSize: 40, bold: true, color: COR.navy, valign: 'bottom', margin: 0, fit: 'shrink', lineSpacingMultiple: 0.9 });
    const lb = (t, v, ult) => [{ text: t, options: { bold: true } }, { text: ' ' + v, options: { bold: true, breakLine: !ult } }];
    s.addText([...lb('Data:', FA.periodoExtenso(rel.de, rel.ate)), { text: FA.textoSemanas(rel.de, rel.ate), options: { bold: true } }],
      { x: 6.37, y: 3.35, w: 6.6, h: 0.85, fontFace: FONTE, fontSize: 18, color: COR.laranja, valign: 'top', margin: 0, fit: 'shrink' });
    const linhas = [[{ text: 'Área:', options: { bold: true } }, { text: ' ' + (o.area || o.nomeConj), options: { breakLine: true } }]];
    if (rel.rota) linhas.push([{ text: 'Rota:', options: { bold: true } }, { text: ' ' + rel.rota, options: { breakLine: true } }]);
    linhas.push([{ text: 'Responsável:', options: { bold: true } }, { text: ' ' + (nomeProprio(o.responsavel) || '—') }]);
    s.addText(linhas.flat(), { x: 6.37, y: 4.4, w: 6.6, h: 1.3, fontFace: FONTE, fontSize: 18, color: COR.laranja, valign: 'top', margin: 0, fit: 'shrink' });
    const g = o.geradoEm || new Date();
    s.addText(`${nomeTipo || o.nomeConj} · ${nTxt(rel.nFotos)} registros fotográficos · gerado em ${g.toLocaleDateString('pt-BR')} às ${hora(g)} · Dikma Gestão`, { x: 6.37, y: 5.85, w: 6.6, h: 0.3, fontFace: FONTE, fontSize: 10, color: COR.cinza, margin: 0, fit: 'shrink' });
  }

  // ---- indicadores ----
  if (!qz) {
    const s = pptx.addSlide({ masterName: 'DIKMA' });
    titulo(s, 'Indicadores do período', `${periodo}${rel.fim < rel.ate ? ` · contado até ${FA.dBR(rel.fim)}` : ''}${o.area ? ' · ' + o.area : ''}${rel.rota ? ' · ' + rel.rota : ''}`);
    const i = rel.ind;
    const cards = [['Programadas', nTxt(i.prog), COR.P], ['Realizadas', nTxt(i.R), COR.R], ['Não realizadas', nTxt(i.N), COR.N], ['Extras', nTxt(i.E), COR.E], ['% de cumprimento', pctTxt(i.cumpr), COR.laranja], ['% com foto', pctTxt(i.pctFoto), COR.navy]];
    cards.forEach(([t, v, c], j) => {
      const x = 0.5 + (j % 2) * 2.85, y = 1.2 + Math.floor(j / 2) * 1.38;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.65, h: 1.22, fill: { color: COR.creme }, line: { color: COR.creme }, rectRadius: 0.1 });
      s.addShape(pptx.ShapeType.rect, { x: x + 0.18, y: y + 0.18, w: 0.07, h: 0.86, fill: { color: c }, line: { color: c } });
      s.addText(v, { x: x + 0.38, y: y + 0.1, w: 2.15, h: 0.7, fontFace: FONTE_FORTE, fontSize: 30, bold: true, color: c, margin: 0 });
      s.addText(t.toUpperCase(), { x: x + 0.38, y: y + 0.8, w: 2.15, h: 0.3, fontFace: FONTE, fontSize: 10, color: COR.navy, bold: true, margin: 0 });
    });
    const notas = [`Pendentes (programadas sem apontamento): ${nTxt(i.P)}`, `Realizadas e extras com foto: ${nTxt(i.comFoto)} de ${nTxt(i.exigem)}`, `Registros fotográficos no período: ${nTxt(rel.nFotos)}${o.fora ? ` (${nTxt(o.fora)} fora deste relatório pelo limite de ${FA.MAX_FOTOS_PPTX})` : ''}`];
    s.addText(notas.map((t, j) => ({ text: t, options: { breakLine: j < notas.length - 1, bullet: { indent: 12 } } })), { x: 0.5, y: 5.4, w: 5.7, h: 0.95, fontFace: FONTE, fontSize: 10.5, color: COR.navy, valign: 'top', margin: 0 });
    // gráfico por rota: % de cumprimento e % com foto
    const rr = rel.porRota.slice(0, 12);
    if (rr.length) {
      s.addText('Por rota', { x: 6.6, y: 1.15, w: 6.2, h: 0.35, fontFace: FONTE_FORTE, fontSize: 14, bold: true, color: COR.navy, margin: 0 });
      s.addChart(pptx.ChartType.bar, [
        { name: '% de cumprimento', labels: rr.map(r => corta(r.rota, 22)), values: rr.map(r => r.cumpr || 0) },
        { name: '% com foto', labels: rr.map(r => corta(r.rota, 22)), values: rr.map(r => r.pctFoto || 0) }
      ], { x: 6.5, y: 1.5, w: 6.4, h: 5.05, barDir: 'bar', barGrouping: 'clustered', chartColors: [COR.laranja, COR.navy], valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFontSize: 9, catAxisLabelFontSize: 9, catAxisOrientation: 'maxMin',
        showLegend: true, legendPos: 'b', legendFontSize: 9, showValue: true, dataLabelFontSize: 8, dataLabelFormatCode: '0"%"', valGridLine: { color: 'EDE5D8', size: 0.5 }, catAxisLabelFontFace: FONTE, valAxisLabelFontFace: FONTE });
      if (rel.porRota.length > rr.length) s.addText(`As outras ${rel.porRota.length - rr.length} rotas estão na tabela a seguir.`, { x: 6.6, y: 6.5, w: 6.2, h: 0.2, fontFace: FONTE, fontSize: 9, color: COR.cinza, margin: 0 });
    } else s.addText('Nenhuma atividade programada ou apontada no período.', { x: 6.6, y: 3, w: 6.2, h: 0.5, fontFace: FONTE, fontSize: 14, color: COR.cinza });
  }

  // ---- tabela por rota ----
  const cab = (t, opt = {}) => ({ text: t, options: { bold: true, color: COR.branco, fill: { color: COR.navy }, fontSize: 10, align: opt.align || 'left', valign: 'middle' } });
  const cel = (t, opt = {}) => ({ text: String(t ?? ''), options: { fontSize: 10, color: opt.cor || COR.tinta, align: opt.align || 'left', bold: !!opt.bold, valign: 'middle', fill: opt.fill ? { color: opt.fill } : undefined } });
  const tabOpts = (colW, y = 1.15) => ({ x: 0.5, y, w: W - 1, colW, fontFace: FONTE, border: { type: 'solid', pt: 0.5, color: COR.linha }, rowH: 0.34, margin: [2, 6, 2, 6], autoPage: false });
  if (!qz && rel.porRota.length) {
    const pags = FA.paginar(rel.porRota, 14);
    pags.forEach((pg, n) => {
      const s = pptx.addSlide({ masterName: 'DIKMA' });
      titulo(s, 'Resultado por rota', `${periodo}${pags.length > 1 ? ` · parte ${n + 1} de ${pags.length}` : ''}`);
      const rows = [[cab('Área'), cab('Rota'), cab('Programadas', { align: 'right' }), cab('Realizadas', { align: 'right' }), cab('Não realizadas', { align: 'right' }), cab('Extras', { align: 'right' }), cab('% cumprimento', { align: 'right' }), cab('% com foto', { align: 'right' })]];
      pg.forEach((r, j) => { const f = j % 2 ? COR.cremeClaro : undefined; rows.push([cel(r.area, { fill: f }), cel(r.rota, { fill: f, bold: true }), cel(nTxt(r.prog), { align: 'right', fill: f }), cel(nTxt(r.R), { align: 'right', fill: f, cor: COR.R }), cel(nTxt(r.N), { align: 'right', fill: f, cor: r.N ? COR.N : COR.tinta }), cel(nTxt(r.E), { align: 'right', fill: f }), cel(pctTxt(r.cumpr), { align: 'right', fill: f, bold: true }), cel(pctTxt(r.pctFoto), { align: 'right', fill: f, bold: true })]); });
      if (n === pags.length - 1) { const i = rel.ind; const t = COR.creme; rows.push([cel('Total', { bold: true, fill: t }), cel('', { fill: t }), cel(nTxt(i.prog), { align: 'right', bold: true, fill: t }), cel(nTxt(i.R), { align: 'right', bold: true, fill: t }), cel(nTxt(i.N), { align: 'right', bold: true, fill: t }), cel(nTxt(i.E), { align: 'right', bold: true, fill: t }), cel(pctTxt(i.cumpr), { align: 'right', bold: true, fill: t }), cel(pctTxt(i.pctFoto), { align: 'right', bold: true, fill: t })]); }
      s.addTable(rows, tabOpts([2.2, 3.3, 1.1, 1.1, 1.2, 0.9, 1.25, 1.28]));
    });
  }

  // ---- registros fotográficos (como no modelo) ----
  // Barra "Local:", fotos à esquerda com moldura creme e a marca Antes/Durante/Depois pela hora, e à direita
  // a data do registro, a descrição (ou o motivo da queda / o serviço da OM) e os demais dados.
  const total = rel.grupos.reduce((n, g) => n + g.fotos.length, 0); let feitas = 0;
  const rotDesc = o.tipo === 'qz' ? 'Motivo da queda / descrição' : o.tipo === 'om' ? 'Serviço da OM' : 'Descrição da atividade';
  const pilula = (s, sit, x, y, w = 1.63, h = 0.36, fs = 11) => {
    const c = COR[sit] || COR.P;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: c }, line: { color: c }, rectRadius: 0.08 });
    s.addText(SIT[sit] || sit || '—', { x, y, w, h, fontFace: FONTE, fontSize: fs, bold: true, color: COR.branco, align: 'center', valign: 'middle', margin: 0 });
  };
  const item = (rot, val, cor = COR.navy) => [
    { text: rot.toUpperCase() + ':', options: { bold: true, color: cor, bullet: { indent: 14 }, breakLine: true, fontFace: FONTE_FORTE } },
    { text: val || '—', options: { color: COR.tinta, breakLine: true, paraSpaceAfter: 8 } }
  ];
  for (const pag of FA.paginasFotos(rel.grupos, FA.FOTOS_POR_SLIDE)) {
    const s = pptx.addSlide({ masterName: 'DIKMA' });
    const g = pag.grupos[0]; const so = pag.grupos.length === 1; const um = so && g.itens.length <= 1;
    const colabs = [...new Set(pag.grupos.flatMap(x => x.colabs))];
    const parte = pag.parte && pag.parte[1] > 1 ? ` · parte ${pag.parte[0]} de ${pag.parte[1]}` : '';
    titulo(s, corta(`Local: ${so ? g.local || g.rota || '—' : g.rota || '—'}`, 90));
    // painel da direita
    const desc = so ? (um ? g.titulo : g.itens.map(x => x.ativ).filter(Boolean).slice(0, 6).map(t => corta(t, 60)).join('; ') + (g.itens.length > 6 ? `; e mais ${g.itens.length - 6}` : ''))
      : pag.grupos.map((x, j) => `${j + 1}. ${corta(x.itens.length > 1 ? `${x.itens.length} atividades` : x.titulo, 60)}`).join('\n');
    const painel = [
      ...item('Data do registro', `${diaSemana(g.dia)} ${FA.dBR(g.dia)}${parte}`, COR.vermelho),
      ...item(so ? rotDesc : 'Atividades neste slide', corta(desc, 420)),
      ...item('Rota · área', `${g.rota || '—'} · ${AREA_S[g.area] || nomeProprio(g.area) || '—'}`),
      ...item('Colaborador', corta(colabs.map(nomeProprio).join(', ') || '—', 120))
    ];
    s.addText(painel, { x: 8.45, y: 1.1, w: 4.5, h: so && g.sit ? 4.85 : 5.45, fontFace: FONTE, fontSize: 12.5, valign: 'top', margin: 0, fit: 'shrink', paraSpaceAfter: 2 });
    if (so && g.sit && !qz) pilula(s, g.sit, 8.45, 6.1, 1.8, 0.38, 11);
    const leg = 0.36;
    const pos = FA.gradeFotos(pag.fotos.length, { x: 0.45, y: 0.95, w: 7.7, h: 5.65 }, leg, 0.22);
    for (let j = 0; j < pag.fotos.length; j++) {
      const { f, g: gf } = pag.fotos[j]; const cx = pos[j]; const st = FA.statusFoto(f);
      o.progresso && o.progresso(feitas, total, `Fotos ${feitas + 1} de ${total}`);
      let dados = null;
      try { dados = st === 'arquivada' ? f.thumb : await o.carregarFoto(f); } catch (e) { dados = null; }
      if (!dados && f.thumb) dados = f.thumb;
      const e = FA.encaixar(f.w || 4, f.h || 3, { x: cx.x + 0.07, y: cx.y + 0.07, w: cx.w - 0.14, h: cx.h - 0.14 });
      if (dados) {
        s.addShape(pptx.ShapeType.roundRect, { x: e.x - 0.07, y: e.y - 0.07, w: e.w + 0.14, h: e.h + 0.14, fill: { color: COR.creme }, line: { color: COR.linha, width: 0.5 }, rectRadius: 0.12 });
        s.addImage({ data: dados, x: e.x, y: e.y, w: e.w, h: e.h, altText: `Foto: ${gf.titulo || ''}` });
      } else {
        s.addShape(pptx.ShapeType.roundRect, { x: cx.x, y: cx.y, w: cx.w, h: cx.h, fill: { color: COR.creme }, line: { color: COR.linha, width: 0.5 }, rectRadius: 0.12 });
        s.addText('Foto não encontrada no banco', { x: cx.x, y: cx.y, w: cx.w, h: cx.h, fontFace: FONTE, fontSize: 12, color: COR.cinza, align: 'center', valign: 'middle' });
      }
      const marca = FA.marcaFoto(gf.fotos.indexOf(f), gf.fotos.length);
      const extra = st === 'arquivada' ? ' · miniatura (foto completa arquivada)' : !dados || dados === f.thumb ? ' · miniatura' : '';
      const ref = so ? '' : `${pag.grupos.indexOf(gf) + 1}. `;
      s.addText([
        ...(marca ? [{ text: marca, options: { bold: true, color: COR.vermelho, fontFace: FONTE_FORTE } }, { text: ' · ' }] : []),
        { text: `${ref}${hora(f.at) || FA.ddmm(f.dia)}`, options: { bold: true, color: COR.navy } },
        { text: extra }
      ], { x: cx.x, y: e.y + e.h + 0.1, w: cx.w, h: 0.26, fontFace: FONTE, fontSize: 11, color: COR.cinza, align: 'center', valign: 'top', margin: 0, fit: 'shrink' });
      feitas++;
    }
  }

  // ---- tabelas: não realizadas e realizadas sem foto ----
  const tabela = (lista, tituloT, cols, linha, max = 4) => {
    if (!lista.length) return;
    const pags = FA.paginar(lista, 13); const usar = pags.slice(0, max);
    usar.forEach((pg, n) => {
      const s = pptx.addSlide({ masterName: 'DIKMA' });
      titulo(s, tituloT, `${nTxt(lista.length)} no período${pags.length > 1 ? ` · parte ${n + 1} de ${usar.length}` : ''}${n === usar.length - 1 && pags.length > usar.length ? ` · mostrando ${nTxt(usar.length * 13)} (veja a lista completa no sistema)` : ''}`);
      const rows = [cols.map(([t]) => cab(t))];
      pg.forEach((x, j) => rows.push(linha(x).map(t => cel(t, { fill: j % 2 ? COR.cremeClaro : undefined }))));
      s.addTable(rows, tabOpts(cols.map(c => c[1])));
    });
  };
  if (!qz) tabela(rel.naoReal, 'Atividades não realizadas', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.0], ['Atividade', 3.2], ['Motivo', 2.43]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, x.area, x.rota, corta(x.local, 40), corta(x.ativ, 70), corta(x.motivo || '—', 60)]);
  if (!qz) tabela(rel.semFoto, 'Realizadas sem registro fotográfico', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.3], ['Atividade', 4.13], ['Situação', 1.2]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, x.area, x.rota, corta(x.local, 44), corta(x.ativ, 80), SIT[x.sit] || x.sit], 3);

  // ---- fecho ----
  {
    const s = pptx.addSlide();
    s.background = { color: COR.creme };
    if (img.fecho) s.addImage({ data: img.fecho, x: 6.05, y: 0, w: W - 6.05, h: H });
    else s.addShape(pptx.ShapeType.rect, { x: 8.9, y: 0, w: W - 8.9, h: H, fill: { color: COR.navy }, line: { color: COR.navy } });
    s.addText('Obrigado pela atenção!', { x: 0.75, y: 2.4, w: 5.0, h: 1.4, fontFace: FONTE_FORTE, fontSize: 40, bold: true, color: COR.navy, valign: 'middle', margin: 0, fit: 'shrink' });
    if (img.dikma) s.addImage({ data: img.dikma, x: 0.75, y: 5.4, w: 3.9, h: 1.3 });
  }

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
