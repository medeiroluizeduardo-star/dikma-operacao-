// Dikma Operação — quais abas cada perfil vê (config/permissoes) e exceção por pessoa (campo abas em usuarios/{uid}).
// Regra: administrador vê tudo. Abas de administração só podem ser ligadas para o Gestor.
// Sem nada configurado, todo perfil vê todas as abas comuns dos módulos dele (o comportamento de antes).
export const PERFIS_ABAS = [['gestor', 'Gestor'], ['coordenador', 'Coordenador'], ['supervisor', 'Supervisor'], ['lider', 'Líder'], ['leitor', 'Somente leitura']];
// Grupos da tela: Pátio e Bateria usam as mesmas telas, então dividem a mesma configuração.
export const GRUPOS_ABAS = [
  { t: 'Todos os módulos', mod: 'all' },
  { t: 'Atividades Pátio · Atividades Bateria', mod: 'op' },
  { t: 'Operação (equipamentos)', mod: 'eq' },
  { t: 'Efetivo', mod: 'ge' }
];
const SO_ADMIN = ['usuarios', 'perfis'];
export const configuravel = (papel, v) => !SO_ADMIN.includes(v.id) && (!v.admin || papel === 'gestor');
const padrao = () => true;

// O que o perfil vê, sem olhar exceções da pessoa.
export function doPerfil(papel, v, cfg) {
  if (papel === 'admin') return true;
  if (!configuravel(papel, v)) return false;
  const c = cfg && cfg[papel] && cfg[papel][v.id];
  return typeof c === 'boolean' ? c : padrao(papel, v);
}
// O que esta pessoa vê: exceção dela, senão o perfil.
export function podeVer(u, v, cfg) {
  if (!u) return false;
  if (u.papel === 'admin') return true;
  if (!configuravel(u.papel, v)) return false;
  const ex = u.abas && u.abas[v.id];
  return typeof ex === 'boolean' ? ex : doPerfil(u.papel, v, cfg);
}
// Resumo da exceção: quantas abas a mais e a menos que o perfil.
export function resumoExcecao(u, views, cfg) {
  let menos = 0, mais = 0;
  for (const v of views) {
    const ex = u.abas && u.abas[v.id]; if (typeof ex !== 'boolean' || !configuravel(u.papel, v)) continue;
    const base = doPerfil(u.papel, v, cfg); if (ex === base) continue;
    if (ex) mais++; else menos++;
  }
  return { menos, mais, tem: menos + mais > 0 };
}
