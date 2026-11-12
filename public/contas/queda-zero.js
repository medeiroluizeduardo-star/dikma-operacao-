// Dikma Gestão — QUEDA ZERO: contas sem tela (as mesmas no navegador e nos testes do Node).
// Registro opcional junto das fotos da atividade: quanto material caído (coque ou carvão) foi recolhido.
// Cada equipamento tem um fator por produto (quanto cabe em 1 equipamento, em toneladas); a pessoa informa quantos
// equipamentos encheu e o resultado é fator × quantidade. Tabela da planilha da operação (12/11/2026).
// Gravado na semana, no mapa qz: qz['PID|k'] = { i: [{ e, p, q }], t } (e = equipamento, p = produto, q = quantidade,
// t = total em toneladas). Sem registro = sem chave (não é obrigatório).

export const QZ_PRODUTOS = [['coque', 'Coque'], ['carvao', 'Carvão']];
export const QZ_EQUIP = [
  { id: 'retro', nome: 'Retroescavadeira', coque: 0.5, carvao: 0.6 },
  { id: 'bobcat', nome: 'Bobcat', coque: 0.2, carvao: 0.4 },
  { id: 'cacamba', nome: 'Caçamba de caminhão', coque: 9, carvao: 12 },
  { id: 'carrinho', nome: 'Carrinho de mão', coque: 0.05, carvao: 0.07 },
  { id: 'balde', nome: 'Balde', coque: 0.003, carvao: 0.003 },
  { id: 'pa', nome: 'Pá', coque: 0.008, carvao: 0.009 }
];
export const QZ_MAX_LINHAS = 12;
export const QZ_MAX_QTD = 9999;

const eqDe = id => QZ_EQUIP.find(x => x.id === id);
// Arredonda sem o erro do ponto flutuante (0,05 × 3 = 0,15 e não 0,15000000000000002).
const arred = v => Math.round(v * 1e6) / 1e6;

// Fator de um equipamento para um produto (ou null se não existe).
export function fatorQZ(e, p) { const x = eqDe(e); return x && (p === 'coque' || p === 'carvao') ? x[p] : null; }
// Resultado de uma linha: fator × quantidade.
export function resultadoQZ(e, p, q) { const f = fatorQZ(e, p); const n = Number(q); return f == null || !Number.isFinite(n) || n <= 0 ? 0 : arred(f * n); }

// Lê o que a pessoa preencheu e devolve { itens, t, erro }. Linhas sem quantidade são ignoradas.
// Quantidade aceita vírgula ("2,5"); precisa ser maior que zero e até QZ_MAX_QTD.
export function calcQZ(linhas) {
  const itens = []; let t = 0;
  for (const l of linhas || []) {
    const txt = String(l.q == null ? '' : l.q).trim().replace(',', '.');
    if (!txt) continue;
    const q = Number(txt);
    if (!eqDe(l.e)) return { itens: [], t: 0, erro: 'Escolha o equipamento.' };
    if (fatorQZ(l.e, l.p) == null) return { itens: [], t: 0, erro: 'Escolha o produto (coque ou carvão).' };
    if (!Number.isFinite(q) || q <= 0) return { itens: [], t: 0, erro: 'A quantidade de equipamentos precisa ser um número maior que zero.' };
    if (q > QZ_MAX_QTD) return { itens: [], t: 0, erro: `A quantidade de equipamentos vai até ${QZ_MAX_QTD}.` };
    itens.push({ e: l.e, p: l.p, q: arred(q) }); t += resultadoQZ(l.e, l.p, q);
  }
  if (itens.length > QZ_MAX_LINHAS) return { itens: [], t: 0, erro: `No máximo ${QZ_MAX_LINHAS} linhas.` };
  return { itens, t: arred(t), erro: '' };
}
// Valor para gravar (ou null = apagar o registro).
export const valorQZ = r => (r && r.itens && r.itens.length ? { i: r.itens, t: r.t } : null);

// Toneladas no formato brasileiro: "1,25 t". Abaixo de 1 t mostra também em kg ("0,15 t (150 kg)").
export function fmtT(t) {
  const n = Number(t) || 0;
  const s = n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' t';
  return n > 0 && n < 1 ? `${s} (${Math.round(n * 1000).toLocaleString('pt-BR')} kg)` : s;
}
// Descrição curta de um registro: "2 Caçamba de caminhão (coque) + 3 Pá (carvão)".
export function textoQZ(v) {
  if (!v || !Array.isArray(v.i)) return '';
  return v.i.map(x => { const e = eqDe(x.e); const p = QZ_PRODUTOS.find(y => y[0] === x.p); return `${Number(x.q).toLocaleString('pt-BR')} × ${e ? e.nome : x.e} (${p ? p[1].toLowerCase() : x.p})`; }).join(' + ');
}
// Registro de uma célula da semana (ou null).
export const qzDaCel = (doc, pid, k) => (doc && doc.qz && doc.qz[pid + '|' + k]) || null;
