// Guia visual (padrão 2.0): monta o HTML dos componentes padrão (estilos em ui/padrao.css).
// As telas novas usam estas funções para nascerem iguais; as antigas passam para o padrão aos poucos.
// Sem dependências: dá para testar no Node (testes/padrao.test.mjs).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SITUACOES = ['ok', 'atencao', 'critico', 'info', 'neutro'];
const sit = s => (SITUACOES.includes(s) ? s : 'neutro');

// Cabeçalho de tela: módulo (ícone + nome), título, frase curta, a ação principal (HTML pronto) e os filtros (HTML pronto).
export function cabecalho({ modulo = '', icone = '', titulo = '', frase = '', acao = '', filtros = '' } = {}) {
  return `<header class="p-cab"><div class="p-cab-txt">${modulo ? `<div class="p-cab-mod">${icone}${esc(modulo)}</div>` : ''}<h1 class="p-t1">${esc(titulo)}</h1>${frase ? `<p>${esc(frase)}</p>` : ''}</div>`
    + `${acao ? `<div class="p-cab-acao">${acao}</div>` : ''}${filtros ? `<div class="p-cab-filtros">${filtros}</div>` : ''}</header>`;
}

// Botão da ação principal (o único laranja da tela). Os atributos vêm prontos (ex.: 'data-act="novo"').
export const botaoAcao = (texto, attrs = '', icone = '') => `<button type="button" class="p-acao" ${attrs}>${icone}${esc(texto)}</button>`;

// Mini-tendência: linha simples com os valores (sem eixos). Sem valores suficientes, não desenha.
export function tendencia(vals = []) {
  const v = vals.filter(x => Number.isFinite(x));
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), amp = max - min || 1;
  const pts = v.map((x, i) => `${Math.round(i / (v.length - 1) * 100)},${Math.round(26 - (x - min) / amp * 24)}`).join(' ');
  return `<svg class="p-ind-tend" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

// Variação contra o período anterior. maiorMelhor=false para indicadores em que subir é ruim (faltas, ocorrências).
export function variacao(atual, anterior, { maiorMelhor = true, unidade = '' } = {}) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return '';
  const d = Math.round((atual - anterior) * 10) / 10;
  const classe = d === 0 ? 'neutro' : (d > 0) === maiorMelhor ? 'bom' : 'ruim';
  const txt = d === 0 ? 'igual' : `${d > 0 ? '▲ +' : '▼ '}${String(d).replace('.', ',')}${unidade}`;
  return `<span class="p-ind-var ${classe}">${txt}</span>`;
}

// Cartão de indicador: rótulo, número grande (com unidade), meta, variação e mini-tendência. situacao pinta a borda.
export function indicador({ rotulo = '', valor = '', unidade = '', meta = '', variacao: vr = '', serie = [], situacao = '' } = {}) {
  const s = SITUACOES.includes(situacao) && situacao !== 'neutro' && situacao !== 'info' ? ' ' + situacao : '';
  return `<div class="p-ind${s}"><span class="p-ind-rot">${esc(rotulo)}</span><span class="p-ind-v">${esc(valor)}${unidade ? `<small>${esc(unidade)}</small>` : ''}</span>`
    + `<span class="p-ind-pe">${meta !== '' ? `<span>Meta ${esc(meta)}${esc(unidade)}</span>` : ''}${vr}</span>${tendencia(serie)}</div>`;
}
// No topo do painel, no máximo 4 números (o resto vai para o detalhe embaixo).
export const indicadores = lista => `<div class="p-inds">${lista.slice(0, 4).map(indicador).join('')}</div>`;

// Etiqueta de situação: sempre cor + texto.
export const etiqueta = (texto, situacao = 'neutro') => `<span class="p-etq ${sit(situacao)}">${esc(texto)}</span>`;

// Tabela padrão. colunas: [{ t: 'Título', n: true (número, à direita) }]; linhas: listas de HTML pronto (já escapado);
// acoes(linha, i): HTML dos botões da última coluna (opcional).
export function tabela(colunas = [], linhas = [], { acoes = null, rotulo = '' } = {}) {
  const th = colunas.map(c => `<th scope="col"${c.n ? ' class="n"' : ''}>${esc(c.t)}</th>`).join('') + (acoes ? '<th scope="col" class="acoes"><span class="p-sr">Ações</span></th>' : '');
  const tr = linhas.map((l, i) => `<tr>${l.map((x, j) => `<td${colunas[j]?.n ? ' class="n"' : ''}>${x}</td>`).join('')}${acoes ? `<td class="acoes">${acoes(l, i)}</td>` : ''}</tr>`).join('');
  return `<div class="p-tabela" role="region" tabindex="0"${rotulo ? ` aria-label="${esc(rotulo)}"` : ''}><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

// Tela vazia: o que aconteceu e o que fazer (acao = HTML de um botão, opcional).
export const vazio = (titulo, texto = '', acao = '', icone = '') => `<div class="p-vazio">${icone}<b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${acao}</div>`;

// Carregando (esqueleto). aria-busy faz o teste das telas esperar terminar.
export const carregando = () => '<div class="p-carregando" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i></div>';

// Área recolhida (o que não pede ação agora).
export const recolhido = (titulo, html, aberto = false) => `<details class="p-recolhe"${aberto ? ' open' : ''}><summary>${esc(titulo)}</summary><div>${html}</div></details>`;

// Abas de uma ficha (ex.: Dados | Lotação). lista: [[valor, texto]]; attr: nome do data-* que leva o valor
// (o clique é tratado pela tela, ex.: attr 'co-aba' → data-co-aba="dados").
export const abas = (lista = [], atual = '', attr = 'aba', rotulo = '') => `<div class="p-abas" role="tablist"${rotulo ? ` aria-label="${esc(rotulo)}"` : ''}>`
  + lista.map(([v, t]) => `<button type="button" role="tab" data-${attr}="${esc(v)}" aria-selected="${v === atual}">${esc(t)}</button>`).join('') + '</div>';

// Lista de dados (rótulo e valor) da ficha. itens: [[rótulo, valor (HTML pronto)]]; valor vazio mostra "—".
export const dados = (itens = []) => `<dl class="p-dados">${itens.map(([r, v]) => `<div><dt>${esc(r)}</dt><dd>${v === '' || v == null ? '<span class="p-falta">—</span>' : v}</dd></div>`).join('')}</dl>`;
