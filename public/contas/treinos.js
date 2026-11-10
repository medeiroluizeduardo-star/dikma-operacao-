// Treinamentos, NRs e ASO: validade de cada registro e situação da pessoa (vencido, vence em breve, em dia).
// Conta sem tela: usada pela aba RH › Treinamentos e ASO, pelo Meu dia e pela rotina de avisos.
// treinos/{id}: { mat, nome, setor, tipo, realizado: 'AAAA-MM-DD' | null, validade: 'AAAA-MM-DD' | null, obs }
import { normNome } from './planilhas-adm.js';
import { perfilDe } from './acessos.js';

// Tipos mais comuns e a validade sugerida em meses (0 = sem sugestão). É só sugestão no formulário: quem cadastra confere.
export const TIPOS_TREINO = [['ASO', 12], ['NR-10', 24], ['NR-11', 0], ['NR-12', 0], ['NR-20', 0], ['NR-33', 12], ['NR-35', 24], ['Brigada de incêndio', 0], ['Direção defensiva', 0]];
export const mesesSugeridos = tipo => (TIPOS_TREINO.find(([t]) => t === tipo) || [0, 0])[1];
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
const chave = t => chavePessoa(t) + '|' + normNome(t.tipo || '');

// Ids dos registros que valem hoje: de cada pessoa e tipo, o de validade mais longa (os outros foram renovados).
export function vigentes(lista) {
  const melhor = new Map();
  for (const t of lista || []) {
    const k = chave(t), b = melhor.get(k);
    if (!b || String(t.validade || '9999') > String(b.validade || '9999') || (!t.validade && b.validade)) melhor.set(k, t);
  }
  return new Set([...melhor.values()].map(t => t.id));
}

// Situação de um registro: vencido | vence (nos próximos ANTECEDENCIA dias) | ok | sem (sem validade) | renovado.
export function situacaoTreino(t, hoje, vig) {
  if (vig && !vig.has(t.id)) return 'renovado';
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
// Colunas (o nome pode variar, sem acento e sem maiúscula): Matrícula, Nome, Setor (ou Área), Tipo (ou Treinamento, NR),
// Feito em (ou Realizado, Data), Validade (ou Vencimento, Vence em), Observação. Uma linha por treinamento.
export const MODELO_TREINOS = [['Matrícula', 'Nome', 'Setor', 'Tipo', 'Feito em', 'Validade', 'Observação'], ['12345', 'NOME COMPLETO DO COLABORADOR', 'PÁTIO', 'NR-35', '10/01/2026', '10/01/2028', '']];
const COLS = { mat: ['matricula', 'mat', 'chapa', 'registro'], nome: ['nome', 'colaborador', 'funcionario', 'nome completo'], setor: ['setor', 'area', 'local'],
  tipo: ['tipo', 'treinamento', 'curso', 'nr', 'norma'], realizado: ['feito em', 'realizado', 'realizado em', 'data', 'data do treinamento', 'data de realizacao', 'conclusao', 'emissao'],
  validade: ['validade', 'vencimento', 'vence em', 'valido ate', 'data de validade', 'data de vencimento'], obs: ['observacao', 'obs', 'observacoes'] };
const chaveCol = s => normNome(String(s ?? '')).toLowerCase();
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
// abas: [{ nome, linhas: [[célula]] }] (a mesma leitura das outras planilhas). Lê a 1ª aba que tiver Nome e Tipo.
// Devolve { itens: [{ mat, nome, setor, tipo, realizado, validade, obs }], erros: ['linha N: motivo'], aba }.
export function lerPlanilhaTreinos(abas) {
  for (const aba of abas || []) {
    const ls = aba.linhas || [];
    const h = ls.findIndex(l => { const k = (l || []).map(chaveCol); return k.some(x => COLS.nome.includes(x)) && k.some(x => COLS.tipo.includes(x)); });
    if (h < 0) continue;
    const cab = ls[h].map(chaveCol); const col = {};
    for (const [c, nomes] of Object.entries(COLS)) { const i = cab.findIndex(x => nomes.includes(x)); if (i >= 0) col[c] = i; }
    const itens = [], erros = [];
    for (let r = h + 1; r < ls.length; r++) {
      const l = ls[r] || []; const v = c => (col[c] == null ? null : l[col[c]]);
      const nome = String(v('nome') ?? '').replace(/\s+/g, ' ').trim().toUpperCase(), tipo = String(v('tipo') ?? '').replace(/\s+/g, ' ').trim();
      if (!nome && !tipo) continue;
      if (!nome || !tipo) { erros.push(`linha ${r + 1}: falta ${nome ? 'o tipo' : 'o nome'}`); continue; }
      const realizado = dataCelula(v('realizado')); let validade = dataCelula(v('validade'));
      if (!validade && realizado && mesesSugeridos(tipo)) validade = addMeses(realizado, mesesSugeridos(tipo));
      if (v('validade') != null && v('validade') !== '' && !dataCelula(v('validade'))) { erros.push(`linha ${r + 1}: validade "${v('validade')}" não é uma data`); continue; }
      itens.push({ mat: String(v('mat') ?? '').replace(/\.0$/, '').trim(), nome, setor: String(v('setor') ?? '').trim().toUpperCase(), tipo, realizado, validade, obs: String(v('obs') ?? '').trim() });
    }
    return { itens, erros, aba: aba.nome };
  }
  return { itens: [], erros: ['Não achei a linha de títulos com as colunas Nome e Tipo.'], aba: null };
}
// Já cadastrado: mesma pessoa, mesmo tipo e mesma validade.
export const chaveTreino = t => chavePessoa(t) + '|' + normNome(t.tipo || '') + '|' + (t.validade || '');
