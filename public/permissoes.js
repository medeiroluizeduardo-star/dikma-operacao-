// Dikma Gestão — quais abas cada perfil vê (config/permissoes) e exceção por pessoa (campo abas em usuarios/{uid}).
// Regra: administrador vê tudo. Abas de administração só podem ser ligadas para o Gestor.
// Sem nada configurado, todo perfil vê todas as abas comuns dos módulos dele (o comportamento de antes).
export const PERFIS_ABAS = [['gestor', 'Gestor'], ['coordenador', 'Coordenador'], ['supervisor', 'Supervisor'], ['lider', 'Líder'], ['administrativo', 'Administrativo'], ['leitor', 'Somente leitura']];
// Grupos da tela: Pátio e Bateria usam as mesmas telas, então dividem a mesma configuração.
export const GRUPOS_ABAS = [
  { t: 'Todos os módulos', mod: 'all' },
  { t: 'Indicadores (painéis e resumos)', mod: 'pn' },
  { t: 'Atividades (Pátio e Bateria)', mod: 'op' },
  { t: 'Pessoas no turno (escala e presença)', mod: 'ge' },
  { t: 'Equipamentos', mod: 'eq' },
  { t: 'RH (frequência, férias e fichas)', mod: 'ad' },
  { t: 'Configurações', mod: 'cf' }
];
const SO_ADMIN = ['usuarios', 'perfis', 'gimport'];
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
  for (const it of ITENS) { // itens que a pessoa perdeu ou ganhou de volta em relação ao perfil
    const ex = u.abas && u.abas[it.id]; if (typeof ex !== 'boolean' || !itemDoPapel(u.papel, it)) continue;
    const base = itemPerfil(u.papel, it, cfg); if (ex === base) continue;
    if (ex) mais++; else menos++;
  }
  return { menos, mais, tem: menos + mais > 0 };
}

// ---- Itens (o que a pessoa pode FAZER dentro das abas) ----
// Cada item vale só para os perfis que já podem fazer aquilo (quem: perfis). Aqui dá para TIRAR o item de um
// perfil ou de uma pessoa; nada passa do que o perfil permite. Guardados no mesmo lugar das abas, com a chave do item.
export const ITENS = [
  { id: 'i_apontar', mod: 'op', nome: 'Apontar atividades', d: 'Marcar realizada ou não realizada, com justificativa', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  { id: 'i_foraprog', mod: 'op', nome: 'Incluir atividade fora da programação', d: 'Programar no dia uma atividade que não estava prevista', quem: ['coordenador', 'supervisor'] },
  { id: 'i_aprovar', mod: 'op', nome: 'Aprovar e devolver apontamentos', d: 'Na aba Aprovação e no Apontar', quem: ['supervisor'] },
  { id: 'i_acoes', mod: 'op', nome: 'Criar e acompanhar ações das causas', d: 'Plano de ação em Causas e ações', quem: ['gestor', 'coordenador', 'supervisor'] },
  { id: 'i_operacao', mod: 'eq', nome: 'Lançar e editar em Equipamentos', d: 'Alocações, paradas, equipe, inspeções e avaliação', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  { id: 'i_efetivo', mod: 'ge', nome: 'Lançar na Presença do dia', d: 'Faltas, atestados, coberturas, horas extras e check-in do turno', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  { id: 'i_fichas', mod: 'ad', nome: 'Registrar ocorrências nas fichas', d: 'Fichas de acompanhamento dos colaboradores', quem: ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo'] },
  { id: 'i_freq', mod: 'ad', nome: 'Editar frequência e férias', d: 'Lançar na folha de 16 a 15 e cadastrar férias', quem: ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo'] },
  { id: 'i_exportar', mod: 'all', nome: 'Exportar para o Excel', d: 'Botões de exportar de todas as abas', quem: ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'] },
  { id: 'i_imprimir', mod: 'all', nome: 'Imprimir e salvar em PDF', d: 'Folha do líder, resumos, etiquetas e fichas', quem: ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'] }
];
export const itemDoPapel = (papel, it) => it.quem.includes(papel);
// O item no perfil (sem exceção da pessoa).
export function itemPerfil(papel, it, cfg) {
  if (papel === 'admin') return true;
  if (!itemDoPapel(papel, it)) return false;
  const c = cfg && cfg[papel] && cfg[papel][it.id];
  return typeof c === 'boolean' ? c : true;
}
// O item para esta pessoa: exceção dela (só para tirar ou devolver o que o perfil tem), senão o perfil.
export function podeItemU(u, id, cfg) {
  if (!u) return false;
  if (u.papel === 'admin') return true;
  const it = ITENS.find(x => x.id === id); if (!it) return true;
  if (!itemDoPapel(u.papel, it)) return true; // quem não tem pelo perfil continua barrado pelas regras de sempre
  const ex = u.abas && u.abas[id];
  return typeof ex === 'boolean' ? ex : itemPerfil(u.papel, it, cfg);
}
