// Treinamentos, NRs e ASO: validade de cada registro e situação da pessoa (vencido, a vencer, em dia).
// Conta sem tela: usada pela aba Segurança › Treinamentos e ASO, pelo Meu dia e pela rotina de avisos.
// treinos/{id}: { mat, nome, setor, turno, funcao, admissao, tipo, realizado: 'AAAA-MM-DD' | null, validade: 'AAAA-MM-DD' | null,
//   obs, na: true (não se aplica à pessoa) }. Um documento por treinamento feito (a renovação é um documento novo).
import { normNome } from './planilhas-adm.js';
import { perfilDe } from './acessos.js';

// Os treinamentos da planilha de controle da empresa (aba Configurações), na mesma ordem, e a validade em meses
// (0 = a planilha não informa). O ASO vem no fim. A importação usa a validade da aba Configurações quando a planilha tiver.
export const TIPOS_TREINO = [['NR 35 TRABALHO EM ALTURA', 24], ['NR 33 ESPAÇO CONFINADO', 12], ['BENZENO (PPEOB)', 24], ['PINE', 24], ['PINE ÁREA', 24],
  ['FERRAMENTAS ABRASIVAS', 24], ['NR 06 EPI', 60], ['COMPORTAMENTO SEGURO', 0], ['GASES SIDERÚRGICOS', 36], ['REGRAS DE OURO', 0], ['PRODUTOS QUÍMICOS', 0],
  ['CAL', 0], ['ARL', 0], ['PADRINHOS E MADRINHAS', 0], ['NR 11 OPERADOR DE EQUIP. MÓVEIS', 0], ['BLOQUEIO', 36], ['ASO', 12]];
// Chave do tipo: sem acento, espaço e pontuação ('NR 06 EPI ' = 'nr06 epi'). 'NR-35' também acha 'NR 35 TRABALHO EM ALTURA'.
const chaveTipo = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export function tipoOficial(tipo) {
  const k = chaveTipo(tipo); if (!k) return String(tipo ?? '').replace(/\s+/g, ' ').trim();
  let a = TIPOS_TREINO.find(([t]) => chaveTipo(t) === k);
  const nr = k.match(/^NR0?(\d{1,2})$/);
  if (!a && nr) a = TIPOS_TREINO.find(([t]) => [`NR${nr[1].padStart(2, '0')}`, `NR${nr[1]}`].some(p => chaveTipo(t).startsWith(p) && !/\d/.test(chaveTipo(t)[p.length] || '')));
  return a ? a[0] : String(tipo).replace(/\s+/g, ' ').trim();
}
export const mesesSugeridos = tipo => (TIPOS_TREINO.find(([t]) => t === tipoOficial(tipo)) || [0, 0])[1];
// Dias de antecedência do aviso "vence em breve".
export const ANTECEDENCIA = 30;

// Soma meses a uma data 'AAAA-MM-DD' (31/01 + 1 mês = 28 ou 29/02).
export function addMeses(data, n) {
  if (!data || !n) return null;
  const [a, m, d] = data.split('-').map(Number);
  const tot = a * 12 + (m - 1) + n, na = Math.floor(tot / 12), nm = tot % 12 + 1;
  const ult = new Date(Date.UTC(na, nm, 0)).getUTCDate();
  return `${na}-${String(nm).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}
const addDias = (data, n) => { const t = new Date(data + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Mesma pessoa: pela matrícula; sem matrícula, pelo nome.
export const chavePessoa = t => (t.mat ? 'm' + String(t.mat).trim() : 'n' + normNome(t.nome || ''));
const chave = t => chavePessoa(t) + '|' + chaveTipo(tipoOficial(t.tipo));

// Ids dos registros que valem hoje: de cada pessoa e tipo, o de validade mais longa (os outros foram renovados). Um
// registro com data vale mais que um sem data (não se aplica ou pendente), que fica como renovado.
const peso = t => (t.validade ? '3' + t.validade : t.realizado ? '2' + t.realizado : t.na ? '1' : '0');
export function vigentes(lista) {
  const melhor = new Map();
  for (const t of lista || []) {
    const k = chave(t), b = melhor.get(k);
    if (!b || peso(t) > peso(b)) melhor.set(k, t);
  }
  return new Set([...melhor.values()].map(t => t.id));
}

// Situação de um registro: vencido | vence (nos próximos ANTECEDENCIA dias) | ok | sem (sem validade) | na (não se aplica) | renovado.
export function situacaoTreino(t, hoje, vig) {
  if (vig && !vig.has(t.id)) return 'renovado';
  if (t.na) return 'na';
  if (!t.validade) return 'sem';
  if (t.validade < hoje) return 'vencido';
  if (t.validade <= addDias(hoje, ANTECEDENCIA)) return 'vence';
  return 'ok';
}
export const diasAte = (hoje, data) => Math.round((new Date(data + 'T12:00:00Z') - new Date(hoje + 'T12:00:00Z')) / 864e5);

// Contagem dos registros que valem hoje.
export function resumoTreinos(lista, hoje) {
  const vig = vigentes(lista); const r = { vencido: 0, vence: 0, ok: 0, sem: 0 };
  for (const t of lista || []) { const s = situacaoTreino(t, hoje, vig); if (s in r) r[s]++; }
  return r;
}

// Quem vê e quem altera: só a Segurança (registra, trata e gestor alteram; o somente leitura só vê) e o administrador.
// Desde 2026-11-10 os treinamentos não ficam mais no RH. As regras do banco conferem do mesmo jeito.
export const veTreinos = u => !!u && u.papel !== 'bloqueado' && !!perfilDe(u, 'seguranca');
export const editaTreinos = u => !!u && u.papel !== 'bloqueado' && ['admin', 'registra', 'trata', 'gestor'].includes(perfilDe(u, 'seguranca'));

// ---- Importar planilha ----
// Dois formatos. 1) O controle da empresa (uma linha por colaborador): Nº, Nome do colaborador, CPF, Matrícula, Data de
// admissão, Turno, Função e, para cada treinamento, 3 colunas (Data de realização, Vencimento, Status), com a aba
// Configurações (nome e validade em meses). O CPF não é lido. 2) Uma linha por treinamento: Matrícula, Nome, Setor, Tipo,
// Feito em, Validade, Observação. O nome das colunas pode variar (sem acento e sem maiúscula).
const MOD_PESSOA = ['Nº', 'Nome do colaborador', 'Matrícula', 'Data de admissão', 'Turno', 'Função'];
export const MODELO_TREINOS = [
  ['CONTROLE DE VALIDADE DOS TREINAMENTOS DE SEGURANÇA - BATERIA'],
  [...MOD_PESSOA, ...TIPOS_TREINO.flatMap(([t]) => [t, '', ''])],
  [...MOD_PESSOA.map(() => ''), ...TIPOS_TREINO.flatMap(() => ['Data de realização', 'Vencimento', 'Status'])],
  ['1', 'NOME COMPLETO DO COLABORADOR', '12345', '10/01/2025', 'Adm', 'AJUDANTE', '10/01/2026', '', '', 'NÃO SE APLICA', '', '']
];
const COLS = { mat: ['matricula', 'mat', 'chapa', 'registro'], nome: ['nome', 'colaborador', 'funcionario', 'nome completo', 'nome do colaborador', 'nome do funcionario'], setor: ['setor', 'area', 'local'],
  tipo: ['tipo', 'treinamento', 'curso', 'nr', 'norma'], realizado: ['feito em', 'realizado', 'realizado em', 'data', 'data do treinamento', 'data de realizacao', 'conclusao', 'emissao'],
  validade: ['validade', 'vencimento', 'vence em', 'valido ate', 'data de validade', 'data de vencimento'], obs: ['observacao', 'obs', 'observacoes'],
  turno: ['turno', 'regime'], funcao: ['funcao', 'cargo'], admissao: ['data de admissao', 'admissao', 'admitido em'] };
const chaveCol = s => normNome(String(s ?? '')).toLowerCase();
const txt = v => String(v ?? '').replace(/\s+/g, ' ').trim();
// Data da célula: objeto Date, número do Excel, 'dd/mm/aaaa' ou 'aaaa-mm-dd' → 'AAAA-MM-DD' (ou null).
export function dataCelula(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
// Validade em meses da aba Configurações do controle da empresa (Nomenclatura do treinamento | Validade (meses)).
function mesesDaPlanilha(abas) {
  const m = new Map();
  for (const aba of abas || []) {
    const ls = aba.linhas || [];
    const h = ls.findIndex(l => (l || []).some(x => chaveCol(x).startsWith('nomenclatura')));
    if (h < 0) continue;
    const ci = ls[h].findIndex(x => chaveCol(x).startsWith('nomenclatura')), cv = ls[h].findIndex(x => chaveCol(x).startsWith('validade'));
    for (const l of ls.slice(h + 1)) { const t = txt((l || [])[ci]), v = Number((l || [])[cv]); if (t && v > 0) m.set(tipoOficial(t), v); }
  }
  return m;
}
// Controle da empresa: títulos em duas linhas (treinamentos na de cima, "Data de realização" embaixo).
function lerMatriz(abas, avisos) {
  const meses = mesesDaPlanilha(abas);
  for (const aba of abas || []) {
    const ls = aba.linhas || [];
    const h = ls.findIndex((l, i) => (l || []).some(x => COLS.nome.includes(chaveCol(x))) && (ls[i + 1] || []).some(x => chaveCol(x) === 'data de realizacao'));
    if (h < 0) continue;
    const cab = ls[h].map(chaveCol), sub = ls[h + 1].map(chaveCol), col = {};
    for (const c of ['mat', 'nome', 'turno', 'funcao', 'admissao']) { const i = cab.findIndex(x => COLS[c].includes(x)); if (i >= 0) col[c] = i; }
    const grupos = [];
    sub.forEach((x, c) => { if (x === 'data de realizacao') { const tipo = tipoOficial(ls[h][c]); if (tipo) grupos.push({ tipo, c, cv: sub[c + 1] && COLS.validade.includes(sub[c + 1]) ? c + 1 : -1 }); } });
    // Setor pelo título ("... - BATERIA" ou "... - PÁTIO").
    const titulo = ls.slice(0, h).flat().map(chaveCol).join(' ');
    const setor = /\bbateria\b/.test(titulo) ? 'BATERIA' : /\bpatio\b/.test(titulo) ? 'PÁTIO' : '';
    const itens = [], erros = [], avisos = [], donoMat = new Map();
    for (let r = h + 2; r < ls.length; r++) {
      const l = ls[r] || []; const v = c => (col[c] == null ? null : l[col[c]]);
      const nome = txt(v('nome')).toUpperCase(); if (!nome) continue;
      // A mesma matrícula em duas pessoas (erro de digitação na planilha): a 2ª entra sem matrícula, pelo nome, e avisa.
      let mat = txt(v('mat')).replace(/\.0$/, '');
      if (mat && donoMat.has(mat) && normNome(donoMat.get(mat)) !== normNome(nome)) { avisos.push(`linha ${r + 1}: a matrícula ${mat} também está em outra pessoa; entra sem matrícula (confira na planilha)`); mat = ''; }
      else if (mat) donoMat.set(mat, nome);
      const pessoa = { mat, nome, setor, turno: txt(v('turno')), funcao: txt(v('funcao')).toUpperCase(), admissao: dataCelula(v('admissao')) };
      for (const g of grupos) {
        const cel = l[g.c]; if (cel == null || txt(cel) === '') continue;
        const realizado = dataCelula(cel);
        if (realizado) {
          const m = meses.get(g.tipo) || mesesSugeridos(g.tipo);
          itens.push({ ...pessoa, tipo: g.tipo, realizado, validade: (g.cv >= 0 && dataCelula(l[g.cv])) || addMeses(realizado, m), obs: '' });
        } else if (chaveTipo(cel) === 'NAOSEAPLICA') itens.push({ ...pessoa, tipo: g.tipo, realizado: null, validade: null, obs: '', na: true });
        else itens.push({ ...pessoa, tipo: g.tipo, realizado: null, validade: null, obs: txt(cel).toUpperCase() });
      }
    }
    if (avisos && !grupos.length) erros.push('Não achei as colunas dos treinamentos.');
    return { itens, erros, avisos, aba: aba.nome, formato: 'matriz', pessoas: new Set(itens.map(chavePessoa)).size };
  }
  return null;
}
// abas: [{ nome, linhas: [[célula]] }] (a mesma leitura das outras planilhas).
// Devolve { itens: [{ mat, nome, setor, tipo, realizado, validade, obs, ... }], erros: ['linha N: motivo'], aba, formato }.
export function lerPlanilhaTreinos(abas) {
  const mz = lerMatriz(abas, true); if (mz) return mz;
  for (const aba of abas || []) {
    const ls = aba.linhas || [];
    const h = ls.findIndex(l => { const k = (l || []).map(chaveCol); return k.some(x => COLS.nome.includes(x)) && k.some(x => COLS.tipo.includes(x)); });
    if (h < 0) continue;
    const cab = ls[h].map(chaveCol); const col = {};
    for (const [c, nomes] of Object.entries(COLS)) { const i = cab.findIndex(x => nomes.includes(x)); if (i >= 0) col[c] = i; }
    const itens = [], erros = [];
    for (let r = h + 1; r < ls.length; r++) {
      const l = ls[r] || []; const v = c => (col[c] == null ? null : l[col[c]]);
      const nome = txt(v('nome')).toUpperCase(), tipo = tipoOficial(v('tipo'));
      if (!nome && !tipo) continue;
      if (!nome || !tipo) { erros.push(`linha ${r + 1}: falta ${nome ? 'o tipo' : 'o nome'}`); continue; }
      const realizado = dataCelula(v('realizado')); let validade = dataCelula(v('validade'));
      if (!validade && realizado && mesesSugeridos(tipo)) validade = addMeses(realizado, mesesSugeridos(tipo));
      if (v('validade') != null && v('validade') !== '' && !dataCelula(v('validade'))) { erros.push(`linha ${r + 1}: validade "${v('validade')}" não é uma data`); continue; }
      const it = { mat: txt(v('mat')).replace(/\.0$/, ''), nome, setor: txt(v('setor')).toUpperCase(), tipo, realizado, validade, obs: txt(v('obs')) };
      if (col.turno != null && txt(v('turno'))) it.turno = txt(v('turno'));
      if (col.funcao != null && txt(v('funcao'))) it.funcao = txt(v('funcao')).toUpperCase();
      itens.push(it);
    }
    return { itens, erros, aba: aba.nome, formato: 'lista' };
  }
  return { itens: [], erros: ['Não achei a linha de títulos (Nome do colaborador e os treinamentos, ou Nome e Tipo).'], aba: null };
}
// Já cadastrado: mesma pessoa, mesmo tipo e mesma validade.
export const chaveTreino = t => chavePessoa(t) + '|' + chaveTipo(tipoOficial(t.tipo)) + '|' + (t.validade || '') + '|' + (t.na ? 'na' : t.validade ? '' : t.realizado || chaveTipo(t.obs));
