// Dikma Gestão — férias de cada colaborador (sem tela): usadas pela ficha e pelos filtros de RH › Colaboradores.
// Os períodos ficam em ferias/{id} ({ mat, nome, inicio, dias, termino, retorno, limite, mesPlanejado, substituto }).
// Liga o período à pessoa pela matrícula Dikma; sem matrícula, pelo nome (sem acento, maiúsculas).
import { normNome } from './planilhas-adm.js';

const somar = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// Índice: c (do cadastro) → períodos dele, os planejados sem data primeiro, depois do mais novo para o mais antigo.
// Pela matrícula; pelo nome só o período sem matrícula ou com matrícula que não está no cadastro.
export function indiceFeriasPessoa(lista, cadastro = []) {
  const mats = new Set(cadastro.map(c => String(c.mat)));
  const porMat = new Map(), porNome = new Map();
  const por = (m, k, f) => { const l = m.get(k) || []; l.push(f); m.set(k, l); };
  for (const f of lista || []) {
    if (f.mat && (mats.has(String(f.mat)) || !cadastro.length)) por(porMat, String(f.mat), f);
    else if (f.nome) por(porNome, normNome(f.nome), f);
  }
  return c => {
    if (!c) return [];
    const l = [...(porMat.get(String(c.mat)) || []), ...(porNome.get(normNome(c.nome)) || [])];
    return l.sort((a, b) => String(b.inicio || '9999').localeCompare(String(a.inicio || '9999')));
  };
}

// Situação de um período hoje.
export function situacaoPeriodo(f, hoje) {
  if (!f.inicio) return { t: 'Sem data', s: 'neutro' };
  if (f.termino && f.termino < hoje) return { t: 'Gozada', s: 'ok' };
  if (f.inicio <= hoje) return { t: 'Em férias', s: 'atencao' };
  const n = Math.round((+new Date(f.inicio + 'T12:00:00') - +new Date(hoje + 'T12:00:00')) / 864e5);
  return { t: n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`, s: n <= 15 ? 'atencao' : 'info' };
}

// Resumo das férias de uma pessoa: o período de agora, o próximo marcado e a data limite que ainda pede férias marcadas
// (a mesma conta da antiga aba Férias: limite sem férias marcadas a partir do mês atual).
export function resumoFeriasPessoa(periodos, hoje) {
  const atual = periodos.find(f => f.inicio && f.inicio <= hoje && (f.termino || '') >= hoje) || null;
  const proxima = periodos.filter(f => f.inicio && f.inicio > hoje).sort((a, b) => (a.inicio < b.inicio ? -1 : 1))[0] || null;
  const marcada = periodos.some(f => f.inicio && f.inicio >= hoje.slice(0, 7) + '-01');
  const limites = periodos.map(f => f.limite).filter(Boolean).sort();
  const limite = marcada ? null : (limites.find(l => l >= hoje) || limites[limites.length - 1] || null);
  return { atual, proxima, limite, marcada };
}

// Filtros da lista de Colaboradores.
export const deFeriasHoje = (periodos, hoje) => !!resumoFeriasPessoa(periodos, hoje).atual;
export const feriasEmBreve = (periodos, hoje, dias = 60) => { const p = resumoFeriasPessoa(periodos, hoje).proxima; return !!p && p.inicio <= somar(hoje, dias); };
// Data limite vencida ou nos próximos dias, sem férias marcadas.
export const limiteProximo = (periodos, hoje, dias = 60) => { const l = resumoFeriasPessoa(periodos, hoje).limite; return !!l && l <= somar(hoje, dias); };

// Períodos de férias que não acham ninguém no cadastro (nem pela matrícula, nem pelo nome).
export function feriasSemCadastro(lista, cadastro) {
  const mats = new Set((cadastro || []).map(c => String(c.mat))), nomes = new Set((cadastro || []).map(c => normNome(c.nome)));
  return (lista || []).filter(f => !(f.mat && mats.has(String(f.mat))) && !nomes.has(normNome(f.nome)));
}
