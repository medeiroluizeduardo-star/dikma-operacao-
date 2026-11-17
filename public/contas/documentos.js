// Administração › Documentos e OMs (era Campo › Documentos e OMs do Meu painel): contas sem tela.
// POP, PT, OS, ASO, treinamentos e OMs com validade, situação e responsável. Avisa o que está vencido ou vence em 30 dias.
// Usado pela tela (telas/documentos.js), pelos testes (testes/documentos.test.mjs) e pela rotina dos avisos no celular.
import { ehAdminU, perfilDe } from './acessos.js';

export const TIPOS = ['POP', 'PT', 'OS', 'ASO', 'Treinamento', 'OM', 'Outro'];
export const SITUACOES = ['Vigente', 'Em andamento', 'Pendente', 'Concluído', 'Cancelado', 'Arquivado'];
// Concluído, cancelado e arquivado não geram alerta.
export const ENCERRADAS = ['Concluído', 'Cancelado', 'Arquivado'];
// Onde vale o documento (os mesmos de Processos e rotina).
export const ONDE = { coq: 'Coqueria geral', patio: 'Pátio', bateria: 'Bateria' };
export const ALERTAS = { vencido: 'Vencidos', vence: 'Vencem em 30 dias', ok: 'Em dia', sem: 'Sem validade', fim: 'Encerrados' };
export const ANTECEDENCIA = 30;
export const LIMITES = { numero: 40, titulo: 140, resp: 120, link: 500, obs: 500, docs: 2000 };
const ORDEM = { vencido: 0, vence: 1, ok: 2, sem: 3, fim: 4 };

// Quem vê e cuida: o administrador e o Gestor e o Coordenador da Gestão (as regras do banco conferem o mesmo).
export const veDocsU = u => !!u && u.papel !== 'bloqueado' && (ehAdminU(u) || ['gestor', 'coordenador'].includes(perfilDe(u, 'gestao')));

const dia = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const ehData = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s);
// Dias da data de hoje até a validade (negativo = já venceu).
export const diasAte = (validade, hoje) => Math.round((dia(validade) - dia(hoje)) / 864e5);
// vencido · vence (até 30 dias, inclusive hoje) · ok · sem (sem validade) · fim (encerrado: sem alerta)
export function alerta(d, hoje) {
  if (ENCERRADAS.includes(d.situacao)) return 'fim';
  if (!ehData(d.validade)) return 'sem';
  const n = diasAte(d.validade, hoje);
  return n < 0 ? 'vencido' : n <= ANTECEDENCIA ? 'vence' : 'ok';
}
export function textoAlerta(d, hoje) {
  const a = alerta(d, hoje); const n = ehData(d.validade) ? diasAte(d.validade, hoje) : 0; const s = k => (k !== 1 ? 's' : '');
  if (a === 'vencido') return `Vencido há ${-n} dia${s(-n)}`;
  if (a === 'vence') return n === 0 ? 'Vence hoje' : `Vence em ${n} dia${s(n)}`;
  return a === 'ok' ? 'Em dia' : a === 'fim' ? d.situacao : 'Sem validade';
}
export const nomeDoc = d => [d.numero, d.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' · ') || 'Sem número';
export const linkOk = s => /^https:\/\/\S+$/i.test(String(s || '').trim());

// Vencidos primeiro, depois os que vencem, em dia, sem validade e encerrados; dentro de cada um, pela validade.
export const ordenar = (lista, hoje) => [...lista].sort((a, b) => ORDEM[alerta(a, hoje)] - ORDEM[alerta(b, hoje)] || (a.validade || '9').localeCompare(b.validade || '9') || nomeDoc(a).localeCompare(nomeDoc(b), 'pt-BR'));

// Filtro da tela: f = { tipo, onde, alerta, q } ('' = todos).
export function filtrar(lista, f, hoje) {
  const q = String(f.q || '').toLowerCase().trim();
  return ordenar(lista.filter(d => (!f.tipo || d.tipo === f.tipo) && (!f.onde || d.conj === f.onde) && (!f.alerta || alerta(d, hoje) === f.alerta)
    && (!q || [d.tipo, d.numero, d.titulo, ONDE[d.conj], d.resp, d.situacao, d.obs].join(' ').toLowerCase().includes(q))), hoje);
}
// Contagens para os cartões, o selo do menu e o aviso no celular.
export function resumo(lista, hoje) {
  const r = { total: lista.length, vencido: 0, vence: 0, ok: 0, sem: 0, fim: 0 };
  for (const d of lista) r[alerta(d, hoje)]++;
  r.alerta = r.vencido + r.vence;
  return r;
}

// Confere e limpa o que foi digitado. Devolve o documento pronto para gravar ou lança um erro com a mensagem para a tela.
export function conferir(x) {
  const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const y = {
    tipo: TIPOS.includes(x.tipo) ? x.tipo : 'Outro', numero: t(x.numero, LIMITES.numero), titulo: t(x.titulo, LIMITES.titulo),
    conj: ONDE[x.conj] ? x.conj : 'coq', resp: t(x.resp, LIMITES.resp), emissao: ehData(x.emissao) ? x.emissao : '', validade: ehData(x.validade) ? x.validade : '',
    situacao: SITUACOES.includes(x.situacao) ? x.situacao : 'Vigente', link: t(x.link, LIMITES.link), obs: t(x.obs, LIMITES.obs)
  };
  if (!y.numero && !y.titulo) throw new Error('Informe o número ou a descrição.');
  if (y.emissao && y.validade && y.validade < y.emissao) throw new Error('A validade não pode ser antes da emissão.');
  if (y.link && !linkOk(y.link)) throw new Error('Link inválido: comece com https://');
  return y;
}

// Linhas da planilha do Excel (cabeçalho + uma linha por documento).
export function linhasExcel(lista, hoje, dataBR = s => s) {
  return [['Tipo', 'Número', 'Descrição', 'Onde', 'Responsável', 'Emissão', 'Validade', 'Situação', 'Alerta', 'Link', 'Observação'],
    ...ordenar(lista, hoje).map(d => [d.tipo || '', d.numero || '', d.titulo || '', ONDE[d.conj] || '', d.resp || '', dataBR(d.emissao || ''), dataBR(d.validade || ''), d.situacao || '', alerta(d, hoje) === 'fim' ? '' : textoAlerta(d, hoje), d.link || '', d.obs || ''])];
}
