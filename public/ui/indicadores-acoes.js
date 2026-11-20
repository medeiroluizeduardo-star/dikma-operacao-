// Indicadores: "Imprimir resumo" e "Exportar para o Excel" em cada aba (botões no topo, montados em ui/shell.js).
// - Imprimir resumo: as abas com resumo próprio (Atividades, Equipamentos, Frequência) abrem a página do resumo; as outras
//   imprimem a própria aba, com um cabeçalho de papel (nome da aba, filtros escolhidos e a data em que foi gerado).
// - Exportar para o Excel: lê os quadros que estão na tela (números do topo, tabelas, barras e colunas por dia), uma folha
//   por quadro; a aba pode juntar folhas com a lista completa (registrarExcel: OMs do mês, lançamentos da queda zero).
import { baixarExcel } from './exportar.js';
import { fmtTexto } from './excel-relatorio.js';
import { $, esc, TODAY, MARCA_PAPEL } from '../nucleo/base.js';
import { acoes } from '../nucleo/acoes.js';
import { UI } from '../nucleo/estado.js';

// Folhas extras por aba: id da aba → () => [{ nome, linhas }]
const EXTRAS = {};
export const registrarExcel = (id, fn) => { EXTRAS[id] = fn; };
// Relatório próprio da aba (OMs, Queda zero): id → () => rel (ver ui/excel-relatorio.js) ou null enquanto carrega.
// Com ele, "Imprimir resumo" sai no modelo do Resumo do dia e o Excel sai formatado, com gráficos.
// Com { periodo: () => ({ tipo, data }) }, os dois botões perguntam antes o período (dia, semana ou mês) e a data;
// a função recebe { tipo: 'dia'|'semana'|'mes', data: 'AAAA-MM-DD' }.
const RELATORIOS = {}; const PERIODO = {};
export const registrarRelatorio = (id, fn, o = {}) => { RELATORIOS[id] = fn; if (o.periodo) PERIODO[id] = o.periodo; };
const TIPOS_PER = [['dia', 'Dia'], ['semana', 'Semana (segunda a domingo)'], ['mes', 'Mês']];
const ultimaEscolha = {};
async function comPeriodo(oque, faz) {
  const id = UI.view;
  if (!PERIODO[id]) { faz(RELATORIOS[id]()); return; }
  const { formSheet } = await import('./janelas.js');
  const p = { ...PERIODO[id](), ...(ultimaEscolha[id] || {}) };
  formSheet(oque, 'Escolha o período do resumo', `<label class="sel"><span>Período</span><select class="in" id="indPerTipo">${TIPOS_PER.map(([k, t]) => `<option value="${k}" ${k === p.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="sel"><span>Data (o dia, um dia da semana ou um dia do mês)</span><input class="in" type="date" id="indPerData" value="${esc(p.data)}" required></label>`, oque, async () => {
    const tipo = $('indPerTipo').value, data = $('indPerData').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Escolha a data.');
    ultimaEscolha[id] = { tipo, data };
    // Depois de fechar a janela: a impressão para a tela até terminar.
    setTimeout(() => faz(RELATORIOS[id]({ tipo, data })), 60);
  });
}
export const agoraTxt = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const limpo = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const txt = e => (e ? limpo(e.innerText || e.textContent) : '');
// Texto sem as linhas pequenas de apoio (o <small> dentro do nome das barras).
const semSmall = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('small').forEach(s => s.remove()); return txt(c); };
// "1.234,5" → 1234.5 (só número puro; com unidade ou % fica como texto, igual à tela).
export const numero = s => (/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : s);
const ePrincipal = (e, raiz) => { for (let p = e.parentElement; p && p !== raiz; p = p.parentElement) if (p.matches('.card,.sgp-card,.ic-card')) return false; return true; };

// Quadros da tela em folhas de planilha. Exportada para os testes (recebe o elemento da tela).
export function folhasDaTela(raiz) {
  const folhas = []; const nomes = new Set();
  const nomeUnico = n => { let b = String(n || 'Quadro').replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Quadro', x = b, i = 2; while (nomes.has(x.toLowerCase())) x = `${b} ${i++}`; nomes.add(x.toLowerCase()); return x; };
  // Números do topo (cartões de indicador), numa folha só.
  const res = [['Indicador', 'Valor', 'Meta', 'Detalhe']];
  raiz.querySelectorAll('.kpi').forEach(k => res.push([txt(k.querySelector('.lbl')), numero(txt(k.querySelector('.v'))), '', txt(k.querySelector('.s'))]));
  raiz.querySelectorAll('.p-ind').forEach(k => { const c = k.closest('.ic-card'); res.push([txt(k.querySelector('.p-ind-rot')), numero(txt(k.querySelector('.p-ind-v'))), txt(c && c.querySelector('.ic-meta')), txt(k.querySelector('.p-ind-pe'))]); });
  const comMeta = res.slice(1).some(l => l[2]);
  if (res.length > 1) folhas.push({ nome: nomeUnico('Resumo'), linhas: comMeta ? res : res.map(([a, b, , d]) => [a, b, d]) });
  // Cada quadro: tabelas, barras e colunas por dia.
  [...raiz.querySelectorAll('.card,.sgp-card')].filter(c => ePrincipal(c, raiz)).forEach((c, i) => {
    const h = c.querySelector('header h2, h2, h3'); const titulo = (h && limpo(h.textContent)) || `Quadro ${i + 1}`; const linhas = [];
    c.querySelectorAll('table').forEach(t => {
      if (linhas.length) linhas.push([]);
      t.querySelectorAll('tr').forEach(tr => { const l = [...tr.children].map(td => (td.tagName === 'TH' ? txt(td) : numero(txt(td)))); if (l.some(x => x !== '')) linhas.push(l); });
    });
    const barras = c.querySelectorAll('.barrow');
    if (barras.length) {
      if (linhas.length) linhas.push([]);
      const comSub = [...barras].some(b => b.querySelector('.n small'));
      linhas.push(comSub ? ['Item', 'Detalhe', 'Valor'] : ['Item', 'Valor']);
      barras.forEach(b => { const n = b.querySelector('.n'); const v = numero(txt(b.querySelector('.p'))); linhas.push(comSub ? [semSmall(n), txt(n && n.querySelector('small')), v] : [semSmall(n), v]); });
    }
    const cols = c.querySelectorAll('.col[title]');
    if (cols.length) {
      if (linhas.length) linhas.push([]);
      linhas.push(['Dia', 'Valor']);
      cols.forEach(x => { const t = x.getAttribute('title') || ''; const p = t.indexOf(': '); linhas.push(p > 0 ? [t.slice(0, p), numero(t.slice(p + 2))] : [t, '']); });
    }
    if (linhas.length) folhas.push({ nome: nomeUnico(titulo), linhas });
  });
  return folhas;
}

// Filtros escolhidos no topo (conjunto, mês, semana, área), para o nome do arquivo e o cabeçalho impresso.
function filtrosTopo() {
  const fb = $('fbarra'), view = $('view');
  const els = [...(fb ? fb.querySelectorAll('.seg [aria-selected="true"], select, .compnav b') : []), ...(view ? view.querySelectorAll('.filters select') : [])];
  return els
    .filter(e => !e.closest('.atalhos, .indsw'))
    .map(e => (e.tagName === 'SELECT' ? txt(e.selectedOptions && e.selectedOptions[0]) : txt(e))).filter(Boolean);
}
const tituloTela = () => { const h = document.querySelector('#top h1'); return h ? limpo(h.firstChild ? h.firstChild.textContent : h.textContent) : 'Indicadores'; };
const nomeArquivo = (t, f) => [t, ...f].join(' - ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s*·\s*/g, ' ').slice(0, 120);

acoes.indExcel = async () => {
  const { toast } = await import('./janelas.js');
  const view = $('view'); if (!view) return;
  if (RELATORIOS[UI.view]) {
    comPeriodo('Exportar para o Excel', async rel => {
      if (!rel) { toast('Os dados ainda estão carregando. Tente de novo em instantes.'); return; }
      try { const { baixarRelatorioExcel } = await import('./excel-relatorio.js'); baixarRelatorioExcel(nomeArquivo(tituloTela(), rel.arquivo || filtrosTopo()), rel); toast('Planilha baixada'); } catch (e) { toast('Não foi possível exportar: ' + (e.message || e)); }
    });
    return;
  }
  const extra = EXTRAS[UI.view] ? EXTRAS[UI.view]() : [];
  const folhas = [...folhasDaTela(view), ...(extra || [])];
  if (!folhas.length) { toast('Nada para exportar nesta tela'); return; }
  try { await baixarExcel(nomeArquivo(tituloTela(), filtrosTopo()), folhas); toast('Planilha baixada'); } catch (e) { toast('Não foi possível exportar: ' + (e.message || e)); }
};

// Papel do relatório no modelo do Resumo do dia: título, linha de filtros, números do topo e tabelas em grade.
// Duas tabelas seguidas marcadas com meia: true ficam lado a lado.
const metaSpan = m => { const i = String(m).indexOf(': '); return i > 0 ? `<span><b>${esc(m.slice(0, i))}:</b> ${esc(m.slice(i + 2))}</span>` : `<span><b>${esc(m)}</b></span>`; };
const ehNum = f => f && f !== 'txt';
function tabelaPapel(t) {
  const corpo = t.linhas.length
    ? `<table><thead><tr>${t.cols.map(c => `<th${ehNum(c.fmt) ? ' class="r"' : ''}>${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${t.linhas.map(l => `<tr>${t.cols.map((c, i) => `<td${ehNum(c.fmt) ? ' class="r"' : ''}>${esc(fmtTexto(l[i], c.fmt))}</td>`).join('')}</tr>`).join('')}${t.total ? `<tr class="tot">${t.cols.map((c, i) => `<td${ehNum(c.fmt) ? ' class="r"' : ''}>${esc(fmtTexto(t.total[i], c.fmt))}</td>`).join('')}</tr>` : ''}</tbody></table>`
    : `<p class="muted">${esc(t.vazio || 'Nada no período.')}</p>`;
  return `<div><h4>${esc(t.titulo)}</h4>${t.sub ? `<p class="muted small rsub">${esc(t.sub)}</p>` : ''}${corpo}</div>`;
}
export function papelRelatorio(rel) {
  const ts = (rel.tabelas || []).filter(t => t.papel !== false); let corpo = '';
  for (let i = 0; i < ts.length; i++) {
    if (ts[i].meia && ts[i + 1] && ts[i + 1].meia) { corpo += `<div class="rcols">${tabelaPapel(ts[i])}${tabelaPapel(ts[i + 1])}</div>`; i++; } else corpo += tabelaPapel(ts[i]);
  }
  const kp = (rel.kpis || []).slice(0, 6);
  return `<div class="paper resumo indpapel"><div class="hd"><div><h3>${esc(rel.papel || rel.titulo)}</h3><div class="meta">${(rel.meta || []).map(metaSpan).join('')}</div></div>${MARCA_PAPEL}</div>
  ${kp.length ? `<div class="rkpis">${kp.map(k => `<div><b>${esc(k.v == null ? '—' : fmtTexto(k.v, k.fmt || 'int'))}</b><span>${esc(k.rot)}</span>${k.det ? `<small>${esc(k.det)}</small>` : ''}</div>`).join('')}</div>` : ''}${corpo}</div>`;
}
function imprimirRelatorio(view, rel) {
  const box = document.createElement('div'); box.className = 'indpapelbox'; box.innerHTML = papelRelatorio(rel);
  view.prepend(box); document.body.classList.add('indpapel');
  let feito = false;
  const volta = () => { if (feito) return; feito = true; box.remove(); document.body.classList.remove('indpapel'); window.removeEventListener('afterprint', volta); };
  window.addEventListener('afterprint', volta);
  window.print();
}

// Imprimir a própria aba: cabeçalho de papel no topo, quadros recolhidos abertos e, depois, tudo volta como estava.
acoes.indPrint = async () => {
  const view = $('view'); if (!view) return;
  if (RELATORIOS[UI.view]) {
    comPeriodo('Imprimir resumo', async rel => {
      if (rel) { imprimirRelatorio(view, rel); return; }
      const { toast } = await import('./janelas.js'); toast('Os dados ainda estão carregando. Tente de novo em instantes.');
    });
    return;
  }
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const cab = document.createElement('div');
  cab.className = 'paper resumo indcab';
  cab.innerHTML = `<div class="hd"><div><h3>RESUMO · ${esc(tituloTela().toUpperCase())}</h3><div class="meta">${filtrosTopo().map(f => `<span>${esc(f)}</span>`).join('')}<span><b>Gerado em:</b> ${esc(agora || TODAY)}</span></div></div>${MARCA_PAPEL}</div>`;
  const fechados = [...view.querySelectorAll('details:not([open])')];
  fechados.forEach(d => { d.open = true; });
  view.prepend(cab); document.body.classList.add('indimp');
  let feito = false;
  const volta = () => { if (feito) return; feito = true; cab.remove(); fechados.forEach(d => { d.open = false; }); document.body.classList.remove('indimp'); window.removeEventListener('afterprint', volta); };
  window.addEventListener('afterprint', volta);
  // Se o aparelho não avisar o fim da impressão, o próximo desenho da tela limpa o cabeçalho.
  window.print();
};
