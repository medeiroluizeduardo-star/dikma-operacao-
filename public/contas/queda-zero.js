// Dikma Gestão — QUEDA ZERO: contas sem tela (as mesmas no navegador e nos testes do Node).
// Registro opcional junto das fotos da atividade: quanto material caído (coque ou carvão) foi recolhido.
// Cada equipamento tem um fator por produto (quanto cabe em 1 equipamento, em toneladas); a pessoa informa quantos
// equipamentos encheu e o resultado é fator × quantidade. Tabela da planilha da operação (12/11/2026).
// Lançamento próprio do Apontar (por área e dia, separado das atividades e das fotos). Gravado na semana, no mapa qz:
// qz['Z|k|id'] = { i: [{ e, p, q }], t, r, o } (e = equipamento, p = produto, q = quantidade, t = total em toneladas,
// r = rota em que foi lançado, o = local/observação). Os registros antigos, feitos junto das fotos de uma atividade
// (12/11/2026), ficam com a chave 'PID|k' e continuam aparecendo no dia.

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
// Local (transportador) e motivo da queda: listas da operação (12/11/2026). Os itens novos que o pessoal cadastra
// ficam em config/quedazero ({ locais, motivos }) e aparecem para todos depois destes.
export const QZ_LOCAIS = [
  'C5601', 'C5602', 'C5604', 'C5605', 'C5607', 'C5608', 'ST0801', 'ST0802', 'SR205', 'BC211', 'BC211A', 'BC214',
  'BC215', 'BC215A', 'BC216', 'RE1201', 'RE1202', 'C5610', 'C5610A', 'C5611', 'C5611A', 'C5613A', 'C5614', 'C5614A',
  'C5613', 'C5615', 'C1', 'C2', 'C3', 'C4', 'C5617', 'C5617AR', 'C5618', 'C5619', 'C5620', 'C5621', 'WF13,14E15',
  'C5618A', 'C5619A', 'C5620A', 'C5625A', 'WF1À12', 'C5', 'C6', 'C7', 'C9', 'C10', 'C11', 'C12', 'C13', 'BC331',
  'BC332', 'BC332A', 'BC332B', 'BC333', 'BC334', 'RECLAME 02', 'TECO TECO', 'CK1', 'CK2', 'CK3', 'CK3BIS', 'CK7',
  'CK7BIS', 'CK4', 'CK5', 'CK5BIS', 'CK6', 'CK8', 'CBK1', 'CK9', 'CK10', 'CK10 BIS', 'CK11', 'CK21', 'CK22', 'CKE1',
  'CKE2', 'CK202', 'CK203', 'CK204', 'CK205', 'CK206', 'CR1', 'CR2', 'CR3', 'SC5601', 'SC5602', 'TT3', 'TT1', 'TT4',
  'TT5', 'TT9', 'PV25A', 'PV20A', 'DG1-COQUE', 'DG2', 'DG-3', 'HC5605', 'LCK1', 'SK1', 'SK2', 'MH5601', 'MH5602'
];
export const QZ_MOTIVOS = [
  'Transbordo', 'Furo em calha', 'Chuva', 'Vedação', 'Limpeza estruturas', 'Umidade', 'Desalinhamento', 'Lama da Vale', 'Sonda', 'Retorno de material', 'Falha elétrica', 'Sobrecarga', 'Operacional', 'Em análise', 'Perda de correia', 'Limpeza pista', 'Limpeza máquina', 'Limpeza canaleta', 'Raspador ineficiente', 'Arrastador ineficiente', 'Queda no processo', 'Acúmulo', 'Rasgo de borda', 'Outros'
];
export const QZ_NOME_MAX = 40;
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
// Chave de um lançamento novo do dia k.
export const chaveNovaQZ = (k, agora = Date.now(), sorte = Math.random()) => `Z|${k}|${agora.toString(36).padStart(9, '0')}${Math.floor(sorte * 1296).toString(36).padStart(2, '0')}`;
// Lançamentos do dia k de uma semana, do mais antigo para o mais novo: [{ key, v, pid (só nos antigos, da atividade) }].
export function qzDoDia(doc, k) {
  const out = [];
  for (const [key, v] of Object.entries((doc && doc.qz) || {})) {
    if (!v) continue; const p = key.split('|');
    if (p[0] === 'Z') { if (+p[1] === k) out.push({ key, v, ord: p[2] || '' }); }
    else if (+p[p.length - 1] === k) out.push({ key, v, pid: p.slice(0, -1).join('|'), ord: '' });
  }
  return out.sort((a, b) => (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0)).map(({ ord, ...x }) => x);
}
// Total do dia (toneladas).
export const totalDiaQZ = (doc, k) => Math.round(qzDoDia(doc, k).reduce((n, x) => n + (Number(x.v.t) || 0), 0) * 1e6) / 1e6;
// Compara nomes sem diferença de maiúsculas, acentos e espaços ("SR 205" = "SR205", "Falha eletrica" = "Falha elétrica").
export const chaveNomeQZ = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase();
// Lista completa (padrão + cadastrados, sem repetir). extras = config/quedazero.locais ou .motivos.
export function listaQZ(padrao, extras) {
  const vistos = new Set(padrao.map(chaveNomeQZ)); const mais = [];
  for (const x of Array.isArray(extras) ? extras : []) { const t = String(x || '').replace(/\s+/g, ' ').trim(); const c = chaveNomeQZ(t); if (t && !vistos.has(c)) { vistos.add(c); mais.push(t); } }
  return [...padrao, ...mais.sort((a, b) => a.localeCompare(b, 'pt-BR'))];
}
// Confere um nome novo digitado: devolve { nome, existe (o nome igual que já está na lista), erro }.
export function novoNomeQZ(txt, lista) {
  const nome = String(txt || '').replace(/\s+/g, ' ').trim();
  if (nome.length < 2) return { nome, erro: 'Escreva o nome (pelo menos 2 letras).' };
  if (nome.length > QZ_NOME_MAX) return { nome, erro: `Nome muito grande (até ${QZ_NOME_MAX} letras).` };
  const igual = lista.find(x => chaveNomeQZ(x) === chaveNomeQZ(nome));
  return { nome: igual || nome, existe: !!igual, erro: '' };
}

// ---- Indicadores (Operação › Indicadores › Queda zero) ----
// Lançamentos do mês ym nas semanas dadas (só os dias do mês; area = 'TODAS' ou uma área): [{ v, area, dt }].
export function lancamentosMesQZ(semanas, ym, area = 'TODAS') {
  const out = [];
  for (const w of semanas) {
    if (!w || w.mes !== ym || (area !== 'TODAS' && w.area !== area)) continue;
    for (let k = 0; k < 7; k++) {
      const dt = addDias(w.ini, k); if (dt.slice(0, 7) !== ym) continue;
      for (const x of qzDoDia(w, k)) out.push({ v: x.v, area: w.area, dt });
    }
  }
  return out;
}
const addDias = (ini, k) => { const d = new Date(ini + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
// Soma por chave, do maior para o menor: [[nome, toneladas, lançamentos]].
const somar = (lancs, chave) => {
  const m = new Map();
  for (const x of lancs) for (const [c, t] of chave(x)) { const o = m.get(c) || [c, 0, 0]; o[1] += t; o[2]++; m.set(c, o); }
  return [...m.values()].map(([c, t, n]) => [c, arred(t), n]).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
};
// Números do painel: total, lançamentos, dias com queda, coque × carvão, por dia (dt → t), por local, motivo,
// equipamento e área. Lançamento sem local ou motivo entra como 'Não informado'.
export function resumoQZ(lancs) {
  const itens = x => (Array.isArray(x.v.i) ? x.v.i : []);
  const total = arred(lancs.reduce((n, x) => n + (Number(x.v.t) || 0), 0));
  const prod = { coque: 0, carvao: 0 };
  for (const x of lancs) for (const it of itens(x)) if (it.p in prod) prod[it.p] += resultadoQZ(it.e, it.p, it.q);
  const porDia = {};
  for (const x of lancs) porDia[x.dt] = arred((porDia[x.dt] || 0) + (Number(x.v.t) || 0));
  const dias = Object.values(porDia).filter(t => t > 0).length;
  const ni = 'Não informado';
  return {
    total, n: lancs.length, dias, media: dias ? arred(total / dias) : 0,
    coque: arred(prod.coque), carvao: arred(prod.carvao), porDia,
    porLocal: somar(lancs, x => [[x.v.l || ni, Number(x.v.t) || 0]]),
    porMotivo: somar(lancs, x => [[x.v.m || ni, Number(x.v.t) || 0]]),
    porArea: somar(lancs, x => [[x.area, Number(x.v.t) || 0]]),
    porEquip: somar(lancs, x => itens(x).map(it => [(eqDe(it.e) || { nome: it.e }).nome, resultadoQZ(it.e, it.p, it.q)]))
  };
}
