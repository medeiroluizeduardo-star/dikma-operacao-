// Relatório fotográfico em PowerPoint (.pptx) e o arquivo .zip das fotos — só no navegador, carregado sob demanda
// (a biblioteca é grande: fica fora do pacote que abre sem sinal). A biblioteca PptxGenJS (com o JSZip dentro) está em
// vendor/pptxgen.bundle.js e entra por uma tag <script> criada aqui (a política de segurança só aceita scripts do
// próprio site; nada inline). O conteúdo (indicadores, grupos de fotos, limite) vem de fotos-arquivo.js.
import { DAYS } from '../cal.js';
import * as FA from '../fotos-arquivo.js';

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

// ---------- cores e textos ----------
const COR = { navy: '272662', rail: '1C1B4A', laranja: 'F05A26', tinta: '16172E', cinza: '666880', claro: 'F5F5F9', linha: 'D9DAE4', branco: 'FFFFFF', R: '1E8A4C', N: 'D23B3B', E: '7A4FD6', P: '5F6385' };
const SIT = { R: 'Realizada', N: 'Não realizada', E: 'Extra', P: 'Programada' };
const FONTE = 'Arial';
const W = 13.333, H = 7.5;
const diaSemana = d => DAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7];
const corta = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const hora = v => { const t = FA.ms(v); if (!t) return ''; const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const pctTxt = v => (v == null ? '—' : `${v}%`);
const nTxt = n => Number(n || 0).toLocaleString('pt-BR');
const nomeProprio = s => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());

// o = { rel (FA.montarRelatorio + FA.limitarFotos), nomeConj ('Atividades Pátio'), autor, geradoEm (Date),
//       carregarFoto(f) → data:… ou null, progresso(feito, total, texto), logo (data:), logoBranco (data:), fora }
// Devolve o Blob do .pptx.
export async function gerarPptx(o) {
  await carregarBiblioteca();
  const { rel } = o; const pptx = new globalThis.PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = o.autor || 'Dikma Gestão'; pptx.company = 'Dikma'; pptx.title = `Relatório fotográfico · ${o.nomeConj}`;
  pptx.subject = `Período ${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  const periodo = `${FA.dBR(rel.de)} a ${FA.dBR(rel.ate)}`;
  const rodape = `Dikma · Relatório fotográfico · ${o.nomeConj}${rel.rota ? ' · ' + rel.rota : ''} · ${periodo}`;
  pptx.defineSlideMaster({
    title: 'DIKMA', background: { color: COR.branco },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.95, fill: { color: COR.navy } } },
      { rect: { x: 0, y: 0.95, w: W, h: 0.06, fill: { color: COR.laranja } } },
      ...(o.logoBranco ? [{ image: { x: 0.4, y: 0.2, w: 1.66, h: 0.55, data: o.logoBranco } }] : []),
      { rect: { x: 0, y: H - 0.42, w: W, h: 0.42, fill: { color: COR.claro } } },
      { text: { text: rodape, options: { x: 0.4, y: H - 0.42, w: 10.5, h: 0.42, fontFace: FONTE, fontSize: 9, color: COR.cinza, valign: 'middle' } } }
    ],
    slideNumber: { x: W - 1.0, y: H - 0.36, w: 0.6, h: 0.3, fontFace: FONTE, fontSize: 9, color: COR.cinza, align: 'right' }
  });
  const titulo = (s, t, sub) => {
    s.addText(t, { x: 2.35, y: 0.12, w: W - 2.75, h: sub ? 0.46 : 0.72, fontFace: FONTE, fontSize: sub ? 20 : 22, bold: true, color: COR.branco, valign: sub ? 'bottom' : 'middle', fit: 'shrink', margin: 0 });
    if (sub) s.addText(sub, { x: 2.35, y: 0.58, w: W - 2.75, h: 0.3, fontFace: FONTE, fontSize: 11.5, color: 'CFCFE6', valign: 'top', margin: 0 });
  };

  // ---- capa ----
  {
    const s = pptx.addSlide();
    s.background = { color: COR.rail };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.28, h: H, fill: { color: COR.laranja }, line: { color: COR.laranja } });
    s.addShape(pptx.ShapeType.rect, { x: 7.9, y: 0, w: W - 7.9, h: H, fill: { color: COR.navy }, line: { color: COR.navy } });
    if (o.logoBranco) s.addImage({ data: o.logoBranco, x: 0.9, y: 0.75, w: 3.02, h: 1.0 });
    s.addText('RELATÓRIO FOTOGRÁFICO', { x: 0.9, y: 2.35, w: 6.8, h: 0.4, fontFace: FONTE, fontSize: 14, bold: true, color: COR.laranja, charSpacing: 3, margin: 0 });
    s.addText('Atividades programadas e realizadas', { x: 0.9, y: 2.8, w: 6.8, h: 1.2, fontFace: FONTE, fontSize: 34, bold: true, color: COR.branco, valign: 'top', margin: 0 });
    s.addText([
      { text: o.nomeConj, options: { bold: true, breakLine: true } },
      { text: `Período: ${periodo}`, options: { breakLine: true } },
      { text: rel.rota ? `Rota: ${rel.rota}` : 'Todas as rotas' }
    ], { x: 0.9, y: 4.25, w: 6.8, h: 1.2, fontFace: FONTE, fontSize: 16, color: 'CFCFE6', valign: 'top', margin: 0, paraSpaceAfter: 4 });
    const g = o.geradoEm || new Date();
    s.addText(`Gerado em ${g.toLocaleDateString('pt-BR')} às ${hora(g)}${o.autor ? ` por ${nomeProprio(o.autor)}` : ''} · Dikma Gestão`, { x: 0.9, y: 6.65, w: 6.8, h: 0.3, fontFace: FONTE, fontSize: 10, color: '8E8FB8', margin: 0 });
    // resumo na faixa da direita
    const i = rel.ind; const linhas = [['% de cumprimento', pctTxt(i.cumpr)], ['% com foto', pctTxt(i.pctFoto)], ['Realizadas', nTxt(i.R)], ['Registros fotográficos', nTxt(rel.nFotos)]];
    linhas.forEach(([t, v], j) => {
      const y = 1.3 + j * 1.35;
      s.addText(v, { x: 8.5, y, w: 4.3, h: 0.75, fontFace: FONTE, fontSize: 40, bold: true, color: j < 2 ? COR.laranja : COR.branco, margin: 0 });
      s.addText(t.toUpperCase(), { x: 8.5, y: y + 0.75, w: 4.3, h: 0.3, fontFace: FONTE, fontSize: 11, color: 'CFCFE6', charSpacing: 1, margin: 0 });
    });
  }

  // ---- indicadores ----
  {
    const s = pptx.addSlide({ masterName: 'DIKMA' });
    titulo(s, 'Indicadores do período', `${periodo}${rel.fim < rel.ate ? ` · contado até ${FA.dBR(rel.fim)}` : ''}${rel.rota ? ' · ' + rel.rota : ''}`);
    const i = rel.ind;
    const cards = [['Programadas', nTxt(i.prog), COR.P], ['Realizadas', nTxt(i.R), COR.R], ['Não realizadas', nTxt(i.N), COR.N], ['Extras', nTxt(i.E), COR.E], ['% de cumprimento', pctTxt(i.cumpr), COR.laranja], ['% com foto', pctTxt(i.pctFoto), COR.navy]];
    cards.forEach(([t, v, c], j) => {
      const x = 0.5 + (j % 2) * 2.85, y = 1.35 + Math.floor(j / 2) * 1.62;
      s.addShape(pptx.ShapeType.rect, { x, y, w: 2.65, h: 1.42, fill: { color: COR.claro }, line: { color: COR.linha, width: 0.75 } });
      s.addShape(pptx.ShapeType.rect, { x, y, w: 0.09, h: 1.42, fill: { color: c }, line: { color: c } });
      s.addText(v, { x: x + 0.25, y: y + 0.14, w: 2.3, h: 0.78, fontFace: FONTE, fontSize: 34, bold: true, color: c, margin: 0 });
      s.addText(t.toUpperCase(), { x: x + 0.25, y: y + 0.92, w: 2.3, h: 0.36, fontFace: FONTE, fontSize: 10.5, color: COR.cinza, bold: true, margin: 0 });
    });
    const notas = [`Pendentes (programadas sem apontamento): ${nTxt(i.P)}`, `Realizadas e extras com foto: ${nTxt(i.comFoto)} de ${nTxt(i.exigem)}`, `Registros fotográficos no período: ${nTxt(rel.nFotos)}${o.fora ? ` (${nTxt(o.fora)} fora deste relatório pelo limite de ${FA.MAX_FOTOS_PPTX})` : ''}`];
    s.addText(notas.map((t, j) => ({ text: t, options: { breakLine: j < notas.length - 1, bullet: { indent: 12 } } })), { x: 0.5, y: 6.25, w: 5.7, h: 0.8, fontFace: FONTE, fontSize: 10.5, color: COR.tinta, valign: 'top', margin: 0 });
    // gráfico por rota: % de cumprimento e % com foto
    const rr = rel.porRota.slice(0, 14);
    if (rr.length) {
      s.addText('Por rota', { x: 6.6, y: 1.25, w: 6.2, h: 0.35, fontFace: FONTE, fontSize: 14, bold: true, color: COR.navy, margin: 0 });
      s.addChart(pptx.ChartType.bar, [
        { name: '% de cumprimento', labels: rr.map(r => corta(r.rota, 22)), values: rr.map(r => r.cumpr || 0) },
        { name: '% com foto', labels: rr.map(r => corta(r.rota, 22)), values: rr.map(r => r.pctFoto || 0) }
      ], { x: 6.5, y: 1.6, w: 6.4, h: 5.3, barDir: 'bar', barGrouping: 'clustered', chartColors: [COR.laranja, COR.navy], valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFontSize: 9, catAxisLabelFontSize: 9, catAxisOrientation: 'maxMin',
        showLegend: true, legendPos: 'b', legendFontSize: 9, showValue: true, dataLabelFontSize: 8, dataLabelFormatCode: '0"%"', valGridLine: { color: 'E7E8EF', size: 0.5 }, catAxisLabelFontFace: FONTE, valAxisLabelFontFace: FONTE });
      if (rel.porRota.length > rr.length) s.addText(`As outras ${rel.porRota.length - rr.length} rotas estão na tabela a seguir.`, { x: 6.6, y: 6.85, w: 6.2, h: 0.2, fontFace: FONTE, fontSize: 9, color: COR.cinza, margin: 0 });
    } else s.addText('Nenhuma atividade programada ou apontada no período.', { x: 6.6, y: 3, w: 6.2, h: 0.5, fontFace: FONTE, fontSize: 14, color: COR.cinza });
  }

  // ---- tabela por rota ----
  const cab = (t, opt = {}) => ({ text: t, options: { bold: true, color: COR.branco, fill: { color: COR.navy }, fontSize: 10, align: opt.align || 'left', valign: 'middle' } });
  const cel = (t, opt = {}) => ({ text: String(t ?? ''), options: { fontSize: 10, color: opt.cor || COR.tinta, align: opt.align || 'left', bold: !!opt.bold, valign: 'middle', fill: opt.fill ? { color: opt.fill } : undefined } });
  const tabOpts = (colW, y = 1.3) => ({ x: 0.5, y, w: W - 1, colW, fontFace: FONTE, border: { type: 'solid', pt: 0.5, color: COR.linha }, rowH: 0.34, margin: [2, 6, 2, 6], autoPage: false });
  if (rel.porRota.length) {
    const pags = FA.paginar(rel.porRota, 14);
    pags.forEach((pg, n) => {
      const s = pptx.addSlide({ masterName: 'DIKMA' });
      titulo(s, 'Resultado por rota', `${periodo}${pags.length > 1 ? ` · parte ${n + 1} de ${pags.length}` : ''}`);
      const rows = [[cab('Área'), cab('Rota'), cab('Programadas', { align: 'right' }), cab('Realizadas', { align: 'right' }), cab('Não realizadas', { align: 'right' }), cab('Extras', { align: 'right' }), cab('% cumprimento', { align: 'right' }), cab('% com foto', { align: 'right' })]];
      pg.forEach((r, j) => { const f = j % 2 ? COR.claro : undefined; rows.push([cel(r.area, { fill: f }), cel(r.rota, { fill: f, bold: true }), cel(nTxt(r.prog), { align: 'right', fill: f }), cel(nTxt(r.R), { align: 'right', fill: f, cor: COR.R }), cel(nTxt(r.N), { align: 'right', fill: f, cor: r.N ? COR.N : COR.tinta }), cel(nTxt(r.E), { align: 'right', fill: f }), cel(pctTxt(r.cumpr), { align: 'right', fill: f, bold: true }), cel(pctTxt(r.pctFoto), { align: 'right', fill: f, bold: true })]); });
      if (n === pags.length - 1) { const i = rel.ind; rows.push([cel('Total', { bold: true, fill: 'E7E8EF' }), cel('', { fill: 'E7E8EF' }), cel(nTxt(i.prog), { align: 'right', bold: true, fill: 'E7E8EF' }), cel(nTxt(i.R), { align: 'right', bold: true, fill: 'E7E8EF' }), cel(nTxt(i.N), { align: 'right', bold: true, fill: 'E7E8EF' }), cel(nTxt(i.E), { align: 'right', bold: true, fill: 'E7E8EF' }), cel(pctTxt(i.cumpr), { align: 'right', bold: true, fill: 'E7E8EF' }), cel(pctTxt(i.pctFoto), { align: 'right', bold: true, fill: 'E7E8EF' })]); }
      s.addTable(rows, tabOpts([2.2, 3.3, 1.1, 1.1, 1.2, 0.9, 1.25, 1.28]));
    });
  }

  // ---- registros fotográficos ----
  // Slide de uma atividade: o cabeçalho tem a atividade e a faixa traz rota, local, colaborador e situação.
  // Slide com várias atividades (poucas fotos cada, mesmo dia e rota): cada foto tem a legenda da sua atividade.
  const total = rel.grupos.reduce((n, g) => n + g.fotos.length, 0); let feitas = 0;
  const pilula = (s, sit, x, y, w = 1.63, h = 0.36, fs = 11) => {
    const c = COR[sit] || COR.P;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: c }, line: { color: c }, rectRadius: 0.08 });
    s.addText(SIT[sit] || sit || '—', { x, y, w, h, fontFace: FONTE, fontSize: fs, bold: true, color: COR.branco, align: 'center', valign: 'middle', margin: 0 });
  };
  for (const pag of FA.paginasFotos(rel.grupos, FA.FOTOS_POR_SLIDE)) {
    const s = pptx.addSlide({ masterName: 'DIKMA' });
    const g = pag.grupos[0]; const so = pag.grupos.length === 1; const um = so && g.itens.length <= 1;
    const colabs = [...new Set(pag.grupos.flatMap(x => x.colabs))];
    if (so) titulo(s, corta(um ? g.titulo || 'Atividade' : `${g.itens.length} atividades da rota`, 90), `${diaSemana(g.dia)} ${FA.dBR(g.dia)} · ${g.area}${pag.parte && pag.parte[1] > 1 ? ` · parte ${pag.parte[0]} de ${pag.parte[1]} (${g.fotos.length} fotos)` : ''}`);
    else titulo(s, corta(`${g.rota || 'Rota'} · ${pag.grupos.length} atividades`, 90), `${diaSemana(g.dia)} ${FA.dBR(g.dia)} · ${g.area}`);
    const info = [{ text: 'Rota  ', options: { color: COR.cinza, fontSize: 10 } }, { text: (g.rota || '—') + '     ', options: { bold: true } }];
    if (so) info.push({ text: 'Local / equipamento  ', options: { color: COR.cinza, fontSize: 10 } }, { text: corta(g.local || '—', 48) + '     ', options: { bold: true } });
    info.push({ text: 'Colaborador  ', options: { color: COR.cinza, fontSize: 10 } }, { text: corta(colabs.map(nomeProprio).join(', ') || '—', so ? 42 : 90), options: { bold: true } });
    s.addText(info, { x: 0.5, y: 1.12, w: so ? 10.6 : W - 1, h: 0.42, fontFace: FONTE, fontSize: 11, color: COR.tinta, valign: 'middle', margin: 0, fit: 'shrink' });
    if (so) pilula(s, g.sit || '', 11.2, 1.15);
    let caixa = { x: 0.5, y: 1.68, w: W - 1, h: 5.25 };
    if (so && !um) {
      const lista = g.itens.map(x => x.ativ).filter(Boolean); const mostra = lista.slice(0, 6).map(t => corta(t, 70));
      s.addText(`Vale para: ${mostra.join(' · ')}${lista.length > mostra.length ? ` · e mais ${lista.length - mostra.length}` : ''}`, { x: 0.5, y: 1.56, w: W - 1, h: 0.42, fontFace: FONTE, fontSize: 9.5, color: COR.cinza, valign: 'top', margin: 0, fit: 'shrink' });
      caixa = { x: 0.5, y: 2.02, w: W - 1, h: 4.9 };
    }
    const leg = so ? 0.32 : 0.62;
    const pos = FA.gradeFotos(pag.fotos.length, caixa, leg);
    for (let j = 0; j < pag.fotos.length; j++) {
      const { f, g: gf } = pag.fotos[j]; const cx = pos[j]; const st = FA.statusFoto(f);
      o.progresso && o.progresso(feitas, total, `Fotos ${feitas + 1} de ${total}`);
      let dados = null;
      try { dados = st === 'arquivada' ? f.thumb : await o.carregarFoto(f); } catch (e) { dados = null; }
      if (!dados && f.thumb) dados = f.thumb;
      s.addShape(pptx.ShapeType.rect, { x: cx.x, y: cx.y, w: cx.w, h: cx.h, fill: { color: COR.claro }, line: { color: COR.linha, width: 0.5 } });
      if (dados) {
        const e = FA.encaixar(f.w || 4, f.h || 3, { x: cx.x + 0.04, y: cx.y + 0.04, w: cx.w - 0.08, h: cx.h - 0.08 });
        s.addImage({ data: dados, x: e.x, y: e.y, w: e.w, h: e.h, altText: `Foto: ${gf.titulo || ''}` });
      } else s.addText('Foto não encontrada no banco', { x: cx.x, y: cx.y, w: cx.w, h: cx.h, fontFace: FONTE, fontSize: 12, color: COR.cinza, align: 'center', valign: 'middle' });
      const extra = st === 'arquivada' ? ' · miniatura (foto completa arquivada fora do banco)' : !dados || dados === f.thumb ? ' · miniatura' : '';
      const num = so ? (pag.parte ? (pag.parte[0] - 1) * FA.FOTOS_POR_SLIDE : 0) + j + 1 : 0;
      if (so) {
        s.addText([
          { text: `Foto ${num}`, options: { bold: true, color: COR.navy } },
          { text: ` · ${FA.ddmm(f.dia)} ${hora(f.at)} · ${nomeProprio(f.porNome || '')}${extra}` }
        ], { x: cx.x, y: cx.y + cx.h + 0.02, w: cx.w, h: leg - 0.04, fontFace: FONTE, fontSize: 9.5, color: COR.cinza, valign: 'top', margin: 0, fit: 'shrink' });
      } else {
        const t = gf.itens.length > 1 ? `${gf.itens.length} atividades` : gf.titulo || '';
        pilula(s, gf.sit || '', cx.x + cx.w - 1.25, cx.y + cx.h + 0.05, 1.25, 0.26, 9);
        s.addText([
          { text: corta(t, 80), options: { bold: true, color: COR.tinta, breakLine: true } },
          { text: `${corta(gf.local || '', 50)}${gf.local ? ' · ' : ''}${FA.ddmm(f.dia)} ${hora(f.at)} · ${nomeProprio(f.porNome || '')}${extra}` }
        ], { x: cx.x, y: cx.y + cx.h + 0.03, w: cx.w - 1.35, h: leg - 0.05, fontFace: FONTE, fontSize: 9.5, color: COR.cinza, valign: 'top', margin: 0, fit: 'shrink' });
      }
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
      pg.forEach((x, j) => rows.push(linha(x).map(t => cel(t, { fill: j % 2 ? COR.claro : undefined }))));
      s.addTable(rows, tabOpts(cols.map(c => c[1])));
    });
  };
  tabela(rel.naoReal, 'Atividades não realizadas', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.0], ['Atividade', 3.2], ['Motivo', 2.43]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, x.area, x.rota, corta(x.local, 40), corta(x.ativ, 70), corta(x.motivo || '—', 60)]);
  tabela(rel.semFoto, 'Realizadas sem registro fotográfico', [['Data', 1.1], ['Área', 1.7], ['Rota', 1.9], ['Local', 2.3], ['Atividade', 4.13], ['Situação', 1.2]], x => [`${diaSemana(x.dia)} ${FA.ddmm(x.dia)}`, x.area, x.rota, corta(x.local, 44), corta(x.ativ, 80), SIT[x.sit] || x.sit], 3);

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
