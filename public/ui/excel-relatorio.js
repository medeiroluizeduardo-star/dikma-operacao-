// Dikma Gestão — relatório em Excel (.xlsx) com formatação e gráficos, para mandar aos gerentes (Indicadores › OMs e Queda zero).
// Monta o arquivo à mão (o Excel é um .zip de XMLs): a biblioteca de planilhas do site não faz cores nem gráficos.
// Sem tela: montarXlsx(rel) devolve os bytes (usado nos testes); baixarRelatorioExcel(arquivo, rel) baixa no navegador.
//
// rel = {
//   titulo, meta: ['Coqueria', 'Mês: Novembro/2026', ...],
//   kpis: [{ rot, v, fmt, det }],                       // números do topo (aba Painel)
//   tabelas: [{ id, titulo, sub, aba, cols: [{ t, fmt }], linhas: [[...]], total: [...], lista, filtro, papel, excel }],
//   graficos: [{ tipo: 'barra'|'coluna'|'linha'|'rosca', titulo, tabela: id, series: [índice da coluna], max, largo }]
// }
// fmt: 'txt' (padrão) | 'int' | 'pct' (0 a 100) | 't' (toneladas) | 'h' (horas). Valor null fica em branco.

// Cores da marca, as mesmas do site (estilo.css: --accent e --navy).
const COR = { marca: 'F05A26', escuro: '272662', tinta: '1F2328', cinza: '6B7280', linha: 'D0D4DA', zebra: 'F6F7F9', total: 'E9EBEE', claro: 'FDF0EB' };
export const PALETA = ['272662', 'F05A26', '8A94A6', 'F2A65A', '2F7D6D', 'B4BAC5'];
const COLS_PAINEL = 12; // a aba Painel tem 12 colunas iguais: os gráficos ficam alinhados, dois por linha

const xe = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const letra = c => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const ref = (c, r) => letra(c) + (r + 1);
const abs = (c, r) => `$${letra(c)}$${r + 1}`;
const nomeAba = n => String(n || 'Planilha').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Planilha';
const qAba = n => `'${n.replace(/'/g, "''")}'`;
// Valor guardado na célula: a porcentagem vai como fração (formato 0%), o resto como número.
const valorCel = (v, fmt) => (v == null || v === '' ? null : fmt && fmt !== 'txt' && typeof v === 'number' && Number.isFinite(v) ? (fmt === 'pct' ? v / 100 : v) : String(v));

/* ---------- estilos (fontes, fundos, bordas e formatos de número, sem repetir) ---------- */
function Estilos() {
  const fontes = [], fundos = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const fmts = { '#,##0.00': 164, '#,##0.0" h"': 165 }; const xfs = []; const idx = new Map();
  const add = (l, x) => { let i = l.indexOf(x); if (i < 0) { i = l.length; l.push(x); } return i; };
  const fonte = ({ sz = 10, b, i, cor = '333333' } = {}) => add(fontes, `<font>${b ? '<b/>' : ''}${i ? '<i/>' : ''}<sz val="${sz}"/><color rgb="FF${cor}"/><name val="Calibri"/><family val="2"/></font>`);
  const fundo = cor => (cor ? add(fundos, `<fill><patternFill patternType="solid"><fgColor rgb="FF${cor}"/><bgColor indexed="64"/></patternFill></fill>`) : 0);
  const lado = (n, w, c) => (w ? `<${n} style="${w}"><color rgb="FF${c}"/></${n}>` : `<${n}/>`);
  const borda = b => (b ? add(bordas, `<border>${lado('left', b.l, b.c)}${lado('right', b.r, b.c)}${lado('top', b.t, b.c)}${lado('bottom', b.b, b.c)}<diagonal/></border>`) : 0);
  fonte(); // fonte 0 = padrão
  const fmtId = f => ({ int: 3, pct: 9, t: 164, h: 165 }[f] || 0); // 'num' (número com ou sem casas) fica no Geral
  // s = { fonte, fundo, borda, fmt, h: 'left'|'center'|'right', v, quebra }
  const xf = s => {
    const k = JSON.stringify(s); if (idx.has(k)) return idx.get(k);
    const f = fonte(s.fonte), fi = fundo(s.fundo), bo = borda(s.borda), nf = fmtId(s.fmt);
    const al = `<alignment${s.h ? ` horizontal="${s.h}"` : ''} vertical="${s.v || 'center'}"${s.quebra ? ' wrapText="1"' : ''}/>`;
    const i = xfs.length + 1; xfs.push(`<xf numFmtId="${nf}" fontId="${f}" fillId="${fi}" borderId="${bo}" xfId="0"${nf ? ' applyNumberFormat="1"' : ''} applyFont="1"${fi ? ' applyFill="1"' : ''}${bo ? ' applyBorder="1"' : ''} applyAlignment="1">${al}</xf>`);
    idx.set(k, i); return i;
  };
  const xml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="${Object.keys(fmts).length}">${Object.entries(fmts).map(([c, i]) => `<numFmt numFmtId="${i}" formatCode="${xe(c)}"/>`).join('')}</numFmts><fonts count="${fontes.length}">${fontes.join('')}</fonts><fills count="${fundos.length}">${fundos.join('')}</fills><borders count="${bordas.length}">${bordas.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xf, xml };
}
const FINA = { l: 'thin', r: 'thin', t: 'thin', b: 'thin', c: COR.linha };
function estilosPadrao(E) {
  const num = f => (f && f !== 'txt' ? 'right' : 'left');
  return {
    titulo: E.xf({ fonte: { sz: 16, b: 1, cor: COR.tinta }, v: 'center' }),
    marca: E.xf({ fonte: { sz: 12, b: 1, cor: COR.marca }, h: 'right' }),
    meta: E.xf({ fonte: { sz: 10, cor: COR.cinza } }),
    linhaMarca: E.xf({ borda: { b: 'medium', c: COR.tinta } }),
    secao: E.xf({ fonte: { sz: 12, b: 1, cor: COR.marca } }),
    sub: E.xf({ fonte: { sz: 9, i: 1, cor: COR.cinza } }),
    cab: f => E.xf({ fonte: { sz: 10, b: 1, cor: 'FFFFFF' }, fundo: COR.escuro, borda: { ...FINA, c: COR.escuro }, h: num(f) === 'right' ? 'right' : 'left', quebra: 1 }),
    cel: (f, z) => E.xf({ fonte: { sz: 10, cor: '333333' }, fundo: z ? COR.zebra : null, borda: FINA, fmt: f, h: num(f), quebra: f === 'txt' || !f ? 1 : 0 }),
    tot: f => E.xf({ fonte: { sz: 10, b: 1, cor: COR.tinta }, fundo: COR.total, borda: { ...FINA, t: 'medium', c: COR.linha }, fmt: f, h: num(f) }),
    cabC: E.xf({ fonte: { sz: 10, b: 1, cor: 'FFFFFF' }, fundo: COR.escuro, borda: { ...FINA, c: COR.escuro }, h: 'center' }),
    kpiRot: E.xf({ fonte: { sz: 10, b: 1, cor: COR.tinta }, borda: FINA, quebra: 1 }),
    kpiVal: f => E.xf({ fonte: { sz: 14, b: 1, cor: COR.marca }, fundo: COR.claro, borda: FINA, fmt: f, h: 'center' }),
    kpiDet: E.xf({ fonte: { sz: 10, cor: '4B5563' }, borda: FINA, quebra: 1 })
  };
}

/* ---------- uma aba: células, mesclas, alturas e larguras ---------- */
function Aba(nome) {
  const linhas = new Map(); const mescla = []; const alturas = {};
  const put = (c, r, v, s) => { if (!linhas.has(r)) linhas.set(r, new Map()); linhas.get(r).set(c, { v, s }); };
  const juntar = (c1, r, c2, v, s, r2 = r) => { for (let rr = r; rr <= r2; rr++) for (let c = c1; c <= c2; c++) put(c, rr, c === c1 && rr === r ? v : null, s); if (c2 > c1 || r2 > r) mescla.push(`${ref(c1, r)}:${ref(c2, r2)}`); };
  const xmlDados = () => [...linhas.keys()].sort((a, b) => a - b).map(r => {
    const cs = linhas.get(r); const ht = alturas[r];
    return `<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${[...cs.keys()].sort((a, b) => a - b).map(c => {
      const { v, s } = cs.get(c); const at = `r="${ref(c, r)}"${s ? ` s="${s}"` : ''}`;
      return v == null ? `<c ${at}/>` : typeof v === 'number' ? `<c ${at}><v>${v}</v></c>` : `<c ${at} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('')}</row>`;
  }).join('');
  return { nome, put, juntar, mescla, alturas, xmlDados, larguras: [], graficos: [], filtro: null, congela: 0 };
}

// Larguras pelo maior texto da coluna (entre 9 e 60 caracteres).
const largura = (l, c, min = 9) => Math.min(60, Math.max(min, ...l.map(x => String(x[c] == null ? '' : x[c]).length + 2)));

// Cabeçalho de cada aba: título, a marca e a linha com os filtros, igual ao papel impresso.
function cabecalho(A, S, rel, ncols) {
  A.juntar(0, 0, Math.max(0, ncols - 2), rel.titulo, S.titulo); A.put(ncols - 1, 0, 'DIKMA', S.marca); A.alturas[0] = 30;
  A.juntar(0, 1, ncols - 1, (rel.meta || []).join('   ·   '), S.meta); A.alturas[1] = 18;
  for (let c = 0; c < ncols; c++) A.put(c, 2, null, S.linhaMarca); A.alturas[2] = 6;
  return 4;
}

// Uma tabela a partir da linha r; devolve a próxima linha livre e onde ficaram os dados (para os gráficos).
function tabelaNaAba(A, S, t, r) {
  if (t.titulo) { A.put(0, r, t.titulo, S.secao); A.alturas[r] = 20; r++; }
  if (t.sub) { A.put(0, r, t.sub, S.sub); r++; }
  const cab = r; t.cols.forEach((c, i) => A.put(i, r, c.t, S.cab(c.fmt))); A.alturas[r] = 30; r++;
  const ini = r;
  t.linhas.forEach((l, j) => { t.cols.forEach((c, i) => A.put(i, r, valorCel(l[i], c.fmt), S.cel(c.fmt || 'txt', j % 2 === 1))); r++; });
  if (!t.linhas.length) { A.juntar(0, r, t.cols.length - 1, 'Nada no período.', S.cel('txt', false)); r++; }
  const fim = r - 1;
  if (t.total && t.linhas.length) { t.cols.forEach((c, i) => A.put(i, r, valorCel(t.total[i], c.fmt), S.tot(c.fmt || 'txt'))); r++; }
  return { prox: r + 2, pos: { aba: A.nome, cab, ini, fim: Math.max(ini, fim), n: t.linhas.length, cols: t.cols } };
}

/* ---------- gráficos ---------- */
const txPr = (sz = 900, cor = '4B5563', b = 0) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}"><a:solidFill><a:srgbClr val="${cor}"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;
const tituloG = t => `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:solidFill><a:srgbClr val="${COR.tinta}"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="pt-BR" sz="1200" b="1"><a:solidFill><a:srgbClr val="${COR.tinta}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${xe(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
const solido = c => `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>`;
const fmtCode = f => ({ pct: '0%', int: '#,##0', t: '#,##0.00', h: '#,##0.0' }[f] || 'General');
const rotulos = (fc, pos, extra = '') => `<c:dLbls><c:numFmt formatCode="${xe(fc)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900, extra ? 'FFFFFF' : '333333', 1)}${pos ? `<c:dLblPos val="${pos}"/>` : ''}<c:showLegendKey val="0"/><c:showVal val="${extra ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${extra ? 1 : 0}"/><c:showBubbleSize val="0"/>${extra}</c:dLbls>`;

export function graficoXml(g, d) {
  // d = { cat: { f, v: [...] }, series: [{ nome, fNome, f, v: [...], fmt }] }
  const n = d.cat.v.length; const fmt = d.series[0].fmt;
  const cat = `<c:cat><c:strRef><c:f>${xe(d.cat.f)}</c:f><c:strCache><c:ptCount val="${n}"/>${d.cat.v.map((v, i) => `<c:pt idx="${i}"><c:v>${xe(v)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat>`;
  const val = s => `<c:val><c:numRef><c:f>${xe(s.f)}</c:f><c:numCache><c:formatCode>${xe(fmtCode(s.fmt))}</c:formatCode><c:ptCount val="${n}"/>${s.v.map((v, i) => (v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache></c:numRef></c:val>`;
  const tx = s => `<c:tx><c:strRef><c:f>${xe(s.fNome)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${xe(s.nome)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`;
  const cor = i => g.cores ? g.cores[i % g.cores.length] : PALETA[i % PALETA.length];
  let plot = ''; let eixos = ''; const legenda = d.series.length > 1 || g.tipo === 'rosca';
  if (g.tipo === 'rosca') {
    const s = d.series[0];
    plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx(s)}${d.cat.v.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${solido(cor(i))}<a:ln w="19050">${solido('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('')}${rotulos('0%', '', '<c:showLeaderLines val="1"/>')}${cat}${val(s)}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  } else {
    const barra = g.tipo === 'barra', linha = g.tipo === 'linha';
    const sers = d.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}${linha
      ? `<c:spPr><a:ln w="28575" cap="rnd">${solido(cor(i))}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr>${solido(cor(i))}<a:ln w="9525">${solido('FFFFFF')}</a:ln></c:spPr></c:marker>`
      : `<c:spPr>${solido(cor(i))}</c:spPr><c:invertIfNegative val="0"/>`}${rotulos(fmtCode(s.fmt), linha ? 't' : 'outEnd')}${cat}${val(s)}${linha ? '<c:smooth val="0"/>' : ''}</c:ser>`).join('');
    plot = linha
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>`
      : `<c:barChart><c:barDir val="${barra ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${d.series.length > 1 ? 80 : 50}"/>${d.series.length > 1 ? '<c:overlap val="-5"/>' : ''}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>`;
    const pctMax = fmt === 'pct' ? '<c:max val="1"/>' : '';
    eixos = `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${barra ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${barra ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${solido(COR.linha)}</a:ln></c:spPr>${txPr()}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>${n > 16 && !barra ? '<c:tickLblSkip val="1"/>' : ''}<c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/>${pctMax}<c:min val="0"/></c:scaling><c:delete val="${barra ? 1 : 0}"/><c:axPos val="${barra ? 't' : 'l'}"/>${barra ? '' : `<c:majorGridlines><c:spPr><a:ln w="6350">${solido('E5E7EB')}</a:ln></c:spPr></c:majorGridlines>`}<c:numFmt formatCode="${xe(fmtCode(fmt))}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr()}<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:date1904 val="0"/><c:lang val="pt-BR"/><c:roundedCorners val="0"/><c:chart>${tituloG(g.titulo)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}${eixos}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legenda ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${txPr()}</c:legend>` : ''}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${solido('FFFFFF')}<a:ln w="9525">${solido(COR.linha)}</a:ln></c:spPr>${txPr(1000, '333333')}</c:chartSpace>`;
}

const ancora = (g, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${g.c1}</xdr:col><xdr:colOff>${g.o1}</xdr:colOff><xdr:row>${g.r1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${g.c2}</xdr:col><xdr:colOff>${g.o2}</xdr:colOff><xdr:row>${g.r2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

function abaXml(A, rel, temDesenho) {
  const cols = A.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const pane = A.congela ? `<pane ySplit="${A.congela}" topLeftCell="A${A.congela + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${A.congela + 1}" sqref="A${A.congela + 1}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"${A.primeira ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${A.xmlDados()}</sheetData>${A.filtro ? `<autoFilter ref="${A.filtro}"/>` : ''}${A.mescla.length ? `<mergeCells count="${A.mescla.length}">${A.mescla.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>${xe(`&L&8Dikma Gestão · ArcelorMittal · Coqueria · ${rel.titulo}&R&8Página &P de &N`)}</oddFooter></headerFooter>${(A.quebras || []).length ? `<rowBreaks count="${A.quebras.length}" manualBreakCount="${A.quebras.length}">${A.quebras.map(q => `<brk id="${q}" max="16383" man="1"/>`).join('')}</rowBreaks>` : ''}${temDesenho ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

// Monta o .xlsx: { nome do arquivo no zip: texto }.
export function arquivosXlsx(rel) {
  const E = Estilos(); const S = estilosPadrao(E);
  const abas = []; const pos = {};
  // Painel: números do topo e os gráficos, dois por linha, todos do mesmo tamanho.
  // rel.semPainel (listas dos botões Exportar): sem a aba Painel: a primeira aba já é a lista.
  const P = Aba('Painel'); if (!rel.semPainel || !(rel.tabelas || []).length) abas.push(P);
  P.larguras = Array(COLS_PAINEL).fill(12.7);
  let r = cabecalho(P, S, rel, COLS_PAINEL);
  if ((rel.kpis || []).length) {
    P.put(0, r, 'Indicadores', S.secao); P.alturas[r] = 20; r++;
    P.juntar(0, r, 2, 'Indicador', S.cab('txt')); P.put(3, r, 'Valor', S.cabC); P.juntar(4, r, COLS_PAINEL - 1, 'Detalhe', S.cab('txt')); P.alturas[r] = 22; r++;
    for (const k of rel.kpis) {
      const f = k.fmt || 'int';
      P.juntar(0, r, 2, k.rot, S.kpiRot); P.put(3, r, k.v == null ? '—' : valorCel(k.v, f), k.v == null ? S.kpiVal('txt') : S.kpiVal(f)); P.juntar(4, r, COLS_PAINEL - 1, k.det || '', S.kpiDet); P.alturas[r] = 26; r++;
    }
    r += 2;
  }
  const iniGraf = r;
  // As outras abas: as tabelas, cada uma no seu lugar, com uma tabela por vez de cima para baixo.
  const porAba = new Map();
  for (const t of rel.tabelas || []) { if (t.excel === false) continue; const n = nomeAba(t.aba || 'Quadros'); if (!porAba.has(n)) porAba.set(n, []); porAba.get(n).push(t); }
  for (const [n, ts] of porAba) {
    const A = Aba(n); abas.push(A);
    const ncols = Math.max(6, ...ts.map(t => t.cols.length));
    A.larguras = Array.from({ length: ncols }, (_, c) => Math.max(...ts.map(t => (c < t.cols.length ? largura([[t.cols[c].t.length > 14 ? '' : t.cols[c].t], ...t.linhas.map(l => [fmtTexto(l[c], t.cols[c].fmt)]), [fmtTexto((t.total || [])[c], t.cols[c].fmt)]], 0, c === 0 ? 16 : 11) : 9))));
    let rr = cabecalho(A, S, rel, ncols);
    for (const t of ts) {
      const x = tabelaNaAba(A, S, t, rr); pos[t.id] = x.pos; rr = x.prox;
      // Lista sozinha na aba: cabeçalho fixo e filtro. Lista com filtro: true embaixo de outras tabelas: só o filtro.
      if (t.lista && ts.length === 1) A.congela = x.pos.cab + 1;
      if (t.lista && (ts.length === 1 || t.filtro) && t.linhas.length) A.filtro = `${ref(0, x.pos.cab)}:${ref(t.cols.length - 1, x.pos.fim)}`;
    }
  }
  // Gráficos do Painel: a fonte é a tabela (sem a linha de total); limite de itens por gráfico (os maiores primeiro).
  const ALT = 16, LARG = COLS_PAINEL / 2; const graf = []; const faixas = []; let c = 0;
  for (const g of rel.graficos || []) {
    const p = pos[g.tabela]; const t = (rel.tabelas || []).find(x => x.id === g.tabela);
    if (!p || !t || !p.n) continue;
    const n = Math.min(p.n, g.max || p.n); const fim = p.ini + n - 1; const qa = qAba(p.aba);
    const d = {
      cat: { f: `${qa}!${abs(0, p.ini)}:${abs(0, fim)}`, v: t.linhas.slice(0, n).map(l => String(l[0] == null ? '' : l[0])) },
      series: g.series.map(i => ({ nome: t.cols[i].t, fNome: `${qa}!${abs(i, p.cab)}`, f: `${qa}!${abs(i, p.ini)}:${abs(i, fim)}`, fmt: t.cols[i].fmt, v: t.linhas.slice(0, n).map(l => { const v = valorCel(l[i], t.cols[i].fmt); return typeof v === 'number' ? v : null; }) }))
    };
    if (g.largo && c) { c = 0; r += ALT + 1; }
    const larg = g.largo ? COLS_PAINEL : LARG;
    if (!c) faixas.push(r);
    graf.push({ xml: graficoXml(g, d), c1: c, o1: c ? 76200 : 0, r1: r, c2: c + larg, o2: 0, r2: r + ALT });
    c += larg; if (c >= COLS_PAINEL) { c = 0; r += ALT + 1; }
  }
  if (graf.length) {
    P.put(0, iniGraf - 1, 'Gráficos', S.secao); P.alturas[iniGraf - 1] = 20;
    // Na impressão: os gráficos começam numa página nova, duas faixas por página, sem cortar nenhum ao meio.
    P.quebras = [iniGraf - 1, ...faixas.filter((_, i) => i && i % 2 === 0).map(x => x)];
  }
  abas[0].primeira = true;
  // Arquivos do zip.
  const f = {};
  const ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>', '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>', '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>', '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'];
  abas.forEach((A, i) => {
    const des = i === 0 && graf.length;
    f[`xl/worksheets/sheet${i + 1}.xml`] = abaXml(A, rel, des);
    ct.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  });
  if (graf.length) {
    f['xl/worksheets/_rels/sheet1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
    f['xl/drawings/drawing1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${graf.map(ancora).join('')}</xdr:wsDr>`;
    f['xl/drawings/_rels/drawing1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${graf.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${i + 1}.xml"/>`).join('')}</Relationships>`;
    ct.push('<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
    graf.forEach((g, i) => { f[`xl/charts/chart${i + 1}.xml`] = g.xml; ct.push(`<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`); });
  }
  const nomesDef = abas.map((A, i) => (A.filtro ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xe(`${qAba(A.nome)}!${A.filtro.split(':').map(x => x.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':')}`)}</definedName>` : '')).join('');
  f['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join('')}</Types>`;
  f['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  f['docProps/core.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(rel.titulo)}</dc:title><dc:creator>Dikma Gestão</dc:creator></cp:coreProperties>`;
  f['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${abas.map((A, i) => `<sheet name="${xe(A.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${nomesDef ? `<definedNames>${nomesDef}</definedNames>` : ''}</workbook>`;
  f['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  f['xl/styles.xml'] = E.xml();
  return f;
}

// Texto do valor como aparece (para medir a largura das colunas e para o papel impresso).
export function fmtTexto(v, fmt) {
  if (v == null || v === '') return '';
  if (typeof v !== 'number') return String(v);
  if (fmt === 'pct') return v > 0 && v < 1 ? '< 1%' : Math.round(v) + '%';
  if (fmt === 't') return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fmt === 'h') return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/* ---------- zip simples (sem compressão: o Excel abre normalmente) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipar(arquivos, quando = new Date()) {
  const enc = new TextEncoder(); const partes = []; const central = []; let off = 0;
  const hora = (quando.getHours() << 11) | (quando.getMinutes() << 5) | (quando.getSeconds() >> 1);
  const dia = ((quando.getFullYear() - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate();
  // [Content_Types].xml primeiro, como o Excel grava.
  const nomes = Object.keys(arquivos).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0));
  for (const nome of nomes) {
    const n = enc.encode(nome); const d = typeof arquivos[nome] === 'string' ? enc.encode(arquivos[nome]) : arquivos[nome]; const crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, hora, true); h.setUint16(12, dia, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
    partes.push(new Uint8Array(h.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, dia, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + d.length;
  }
  const tamC = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, nomes.length, true); e.setUint16(10, nomes.length, true); e.setUint32(12, tamC, true); e.setUint32(16, off, true);
  const tudo = [...partes, ...central, new Uint8Array(e.buffer)]; const out = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0)); let p = 0;
  for (const x of tudo) { out.set(x, p); p += x.length; }
  return out;
}

export const montarXlsx = rel => zipar(arquivosXlsx(rel));

export function baixarRelatorioExcel(arquivo, rel) {
  const blob = new Blob([montarXlsx(rel)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arquivo.endsWith('.xlsx') ? arquivo : arquivo + '.xlsx';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Listas dos botões "Exportar" (ui/exportar.js › baixarExcel) no mesmo modelo dos relatórios: título, contrato e data no topo,
// cabeçalho colorido, linhas listradas, cabeçalho fixo e filtro. abas: [{ nome, linhas: [[cabeçalho...], [valores...]] }]
export function relDeListas(arquivo, abas, agora = new Date()) {
  const cel = v => (v == null ? '' : typeof v === 'number' ? (Number.isFinite(v) ? v : '') : typeof v === 'boolean' ? (v ? 'Sim' : 'Não')
    : v instanceof Date ? v.toLocaleDateString('pt-BR') : String(v));
  const titulo = abas.length === 1 ? String(abas[0].nome || 'Planilha') : String(arquivo || 'Planilha').replace(/\.xlsx$/i, '').replace(/[-_]+/g, ' ').trim();
  const quando = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const tabelas = abas.map((a, i) => {
    const [cab = [], ...resto] = a.linhas || []; const linhas = resto.map(l => (l || []).map(cel));
    const n = Math.max(cab.length, ...linhas.map(l => l.length));
    const cols = Array.from({ length: n }, (_, c) => {
      const vs = linhas.map(l => l[c]).filter(v => v !== '' && v != null);
      const fmt = vs.length && vs.every(v => typeof v === 'number') ? (vs.every(Number.isInteger) ? 'int' : 'num') : 'txt';
      return { t: String(cab[c] == null ? '' : cab[c]), fmt };
    });
    return { id: 't' + i, titulo: abas.length === 1 ? '' : String(a.nome || ''), aba: a.nome, cols, linhas: linhas.map(l => cols.map((c, j) => (l[j] === '' && c.fmt !== 'txt' ? null : l[j]))), lista: true };
  });
  return { titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), meta: ['ArcelorMittal · Coqueria', `Gerado em ${quando}`], tabelas, semPainel: true };
}
