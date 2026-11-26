// Justificativa de atividade não feita: alguns motivos da lista pedem um detalhe escrito pelo líder.
//   "Equipamento indisponível" → qual equipamento.  "Prioridade operacional" → quem solicitou e qual demanda.
// O texto gravado continua sendo uma frase só (doc.m), começando pelo motivo da lista, para aparecer inteiro
// na Aprovação, nos resumos e no Excel. Ex.: "Equipamento indisponível: caminhão de vácuo 02".
import { MOTIVOS } from './cal.js';

// k = chave do campo · rot = pergunta · ex = exemplo · max = tamanho máximo
export const DETALHE_MOTIVO = {
  'Equipamento indisponível': { titulo: 'Qual equipamento estava indisponível?', campos: [{ k: 'eq', rot: 'Equipamento indisponível', ex: 'Ex.: caminhão de vácuo 02', max: 80 }] },
  'Prioridade operacional': { titulo: 'Quem solicitou e qual a demanda?', campos: [{ k: 'quem', rot: 'Quem solicitou', ex: 'Ex.: supervisor da operação, João', max: 60 }, { k: 'dem', rot: 'Qual a demanda', ex: 'Ex.: limpeza urgente na correia TC-12', max: 120 }] }
};
const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();

// Motivo da lista a que a justificativa pertence (com ou sem detalhe); '' quando foi escrita pela pessoa.
export function motivoBase(m) {
  const t = limpa(m); if (!t) return '';
  if (MOTIVOS.includes(t)) return t;
  return MOTIVOS.find(x => t.startsWith(x + ':')) || '';
}
// Monta a frase gravada a partir do motivo e dos campos ({ eq } ou { quem, dem }).
export function montarMotivo(base, v = {}) {
  const d = DETALHE_MOTIVO[base]; if (!d) return base;
  if (base === 'Prioridade operacional') return `${base}: solicitado por ${limpa(v.quem)} · demanda: ${limpa(v.dem)}`;
  return `${base}: ${limpa(v.eq)}`;
}
// Lê de volta os campos de uma frase gravada (para editar). Frase antiga, sem detalhe, devolve os campos vazios.
export function lerMotivo(m) {
  const t = limpa(m); const base = motivoBase(t); const out = { base };
  if (!DETALHE_MOTIVO[base] || t === base) return out;
  const resto = t.slice(base.length + 1).trim();
  if (base === 'Prioridade operacional') {
    const x = /^solicitado por (.*?) · demanda: (.*)$/.exec(resto);
    if (x) { out.quem = x[1]; out.dem = x[2]; } else out.dem = resto;
  } else out.eq = resto;
  return out;
}
// Confere os campos: devolve a mensagem do que falta ou ''.
export function faltaDetalhe(base, v = {}) {
  const d = DETALHE_MOTIVO[base]; if (!d) return '';
  for (const c of d.campos) if (limpa(v[c.k]).length < 2) return `Preencha: ${c.rot.toLowerCase()}.`;
  return '';
}
