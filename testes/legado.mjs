// Cadastro antigo (papel único + modulos + acessos) → acesso por módulo. Foi a conversão usada pela rotina
// "Converter acessos" (todos os usuários reais foram convertidos em 2026-11). O site e as regras não leem mais o
// cadastro antigo; esta cópia serve só aos testes: monta os usuários de exemplo do jeito que a conversão gravou.
import { ESCOPOS, MODULO_ACESSO } from '../public/contas/acessos.js';

const antigoAdm = u => Array.isArray(u.acessos) && u.acessos.includes('administrativo');
// Módulo Frequência e férias do cadastro antigo: marcado no usuário (modulos) ou o antigo acesso Administrativo.
// O perfil Administrativo já tem o módulo, mesmo sem marcar.
const temFreqLegado = u => !!u && (u.papel === 'admin' || u.papel === 'administrativo' || (Array.isArray(u.modulos) && u.modulos.includes('frequencia')) || antigoAdm(u));
// Módulos do cadastro antigo (os marcados); usuário antigo só do Administrativo não ganha a Operação sem querer.
export const modulosDe = u => {
  if (!u) return [];
  const m = Array.isArray(u.modulos) && u.modulos.length ? [...u.modulos] : antigoAdm(u) && !u.acessos.includes('operacao') ? [] : ['operacao'];
  if (temFreqLegado(u) && !m.includes('frequencia')) m.push('frequencia');
  return m;
};


const ESC_MOD = { patio: 'operacao', bateria: 'bateria', equipamentos: 'equipamentos' };

// Cadastro antigo (papel, modulos, acessos) → { acesso, escopos, fichas }.
export function acessoDoLegado(u) {
  const vazio = { acesso: {}, escopos: [], fichas: false };
  if (!u || !u.papel || u.papel === 'bloqueado') return vazio;
  const papel = u.papel;
  if (papel === 'admin') return { acesso: { operacao: 'gestor', gestao: 'gestor', seguranca: 'gestor', rh: 'administrativo', administracao: 'admin' }, escopos: ESCOPOS.map(e => e[0]), fichas: true };
  const m = modulosDe(u);
  const escopos = ESCOPOS.map(e => e[0]).filter(k => m.includes(ESC_MOD[k]));
  const ativ = escopos.includes('patio') || escopos.includes('bateria');
  const fichas = m.includes('gestao');
  const leitor = papel === 'leitor';
  const acesso = {};
  // Operação: Pátio, Bateria ou Equipamentos marcados, com o papel de hoje (Administrativo só consulta).
  if (escopos.length) acesso.operacao = MODULO_ACESSO.operacao.perfis.includes(papel) ? papel : 'leitor';
  // Gestão: supervisor, coordenador e gestor com Pátio/Bateria; e quem tem as Fichas marcadas.
  if ((ativ && ['supervisor', 'coordenador', 'gestor'].includes(papel)) || (ativ && leitor) || fichas) acesso.gestao = MODULO_ACESSO.gestao.perfis.includes(papel) ? papel : 'administrativo';
  // RH: Frequência marcada (ou o antigo acesso Administrativo) ou o papel Administrativo.
  if (m.includes('frequencia') || papel === 'administrativo') acesso.rh = leitor ? 'leitor' : 'administrativo';
  if (papel === 'gestor') acesso.administracao = 'modulo';
  return { acesso, escopos, fichas };
}
