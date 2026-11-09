// Treinamentos, NRs e ASO: validade de cada registro e situação da pessoa (vencido, vence em breve, em dia).
// Conta sem tela: usada pela aba RH › Treinamentos e ASO, pelo Meu dia e pela rotina de avisos.
// treinos/{id}: { mat, nome, setor, tipo, realizado: 'AAAA-MM-DD' | null, validade: 'AAAA-MM-DD' | null, obs }
import { normNome } from './planilhas-adm.js';

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
