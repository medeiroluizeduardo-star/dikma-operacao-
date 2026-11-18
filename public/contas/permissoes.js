// Dikma Gestão — quais abas cada perfil vê (config/permissoes) e exceção por pessoa (campo abas em usuarios/{uid}).
// As abas e os itens são configurados POR MÓDULO: a chave é 'módulo|perfil' (ex.: 'operacao|lider', 'gestao|leitor').
// Formato antigo (uma chave por perfil, ex.: 'lider') continua valendo: na leitura, o perfil antigo vale para o
// mesmo perfil em cada módulo que o tem (o Gestor antigo vale também para a Administração 'Dos módulos').
// Regra: administrador vê tudo. Abas da Administração só podem ser ligadas para o perfil 'Dos módulos'.
// Sem nada configurado, todo perfil vê todas as abas comuns dos módulos dele (o comportamento de antes).
import { MODULOS_ACESSO, perfilDe, perfilNome } from './acessos.js';

// Perfis de cada módulo que dá para configurar (o administrador sempre vê tudo).
export const PERFIS_MOD = Object.fromEntries(MODULOS_ACESSO.map(m => [m.k, m.perfis.filter(p => p !== 'admin').map(p => [p, perfilNome(m.k, p)])]));
// Grupos da tela Perfis e permissões: um por módulo. 'all' = Avisos no celular (vale em todos os módulos).
export const GRUPOS_ABAS = [
  { t: 'Operação', mod: 'operacao' },
  { t: 'Gestão', mod: 'gestao' },
  { t: 'Segurança', mod: 'seguranca' },
  { t: 'RH', mod: 'rh' },
  { t: 'Indicadores', mod: 'indicadores' },
  { t: 'Administração', mod: 'administracao' }
];
// Perfil antigo (chave do formato antigo) que vale para cada perfil de cada módulo.
const ANTIGO = { modulo: 'gestor', registra: null, trata: null };
const antigoDe = p => (p in ANTIGO ? ANTIGO[p] : p);
export const chavePerm = (mod, papel) => `${mod}|${papel}`;
// Valor configurado (true/false) para o perfil no módulo, ou undefined.
export function valorCfg(cfg, mod, papel, id) {
  if (!cfg) return undefined;
  const n = cfg[chavePerm(mod, papel)];
  if (n && typeof n[id] === 'boolean') return n[id];
  const a = antigoDe(papel); const o = a && cfg[a];
  return o && typeof o[id] === 'boolean' ? o[id] : undefined;
}
const SO_ADMIN = ['usuarios', 'perfis', 'gimport', 'cflimpa', 'cfhist', 'cffotos', 'cfarqfotos'];
// Aba que o perfil do módulo pode ter ligada (as da Administração, só o perfil 'Dos módulos').
export const configuravel = (mod, papel, v) => !SO_ADMIN.includes(v.id) && (mod !== 'administracao' || papel === 'modulo');
// Módulo de uma aba para a configuração: Avisos no celular (all) fica com o módulo pedido.
const modDaAba = (v, mod) => (v.mod === 'all' ? mod : v.mod);

// O que o perfil (do módulo) vê, sem olhar exceções da pessoa.
export function doPerfil(mod, papel, v, cfg) {
  if (papel === 'admin') return true;
  if (v.livre) return !!papel;
  if (!papel || !configuravel(mod, papel, v)) return false;
  const c = valorCfg(cfg, mod, papel, v.id);
  return typeof c === 'boolean' ? c : true;
}
// O que esta pessoa vê na aba v (Avisos no celular: no módulo mod): exceção dela, senão o perfil dela naquele módulo.
export function podeVer(u, v, cfg, mod) {
  if (!u) return false;
  const m = modDaAba(v, mod); const papel = perfilDe(u, m);
  if (papel === 'admin') return true;
  if (v.livre) return !!papel;
  if (!papel || !configuravel(m, papel, v)) return false;
  const ex = u.abas && u.abas[v.id];
  return typeof ex === 'boolean' ? ex : doPerfil(m, papel, v, cfg);
}
// Resumo da exceção: quantas abas e itens a mais e a menos que o perfil.
export function resumoExcecao(u, views, cfg) {
  let menos = 0, mais = 0;
  for (const v of views) {
    const ex = u.abas && u.abas[v.id]; if (typeof ex !== 'boolean') continue;
    const m = modDaAba(v, 'operacao'); const papel = perfilDe(u, m); if (!papel || papel === 'admin' || !configuravel(m, papel, v)) continue;
    const base = doPerfil(m, papel, v, cfg); if (ex === base) continue;
    if (ex) mais++; else menos++;
  }
  for (const it of ITENS) { // itens que a pessoa perdeu ou ganhou de volta em relação ao perfil
    const ex = u.abas && u.abas[it.id]; if (typeof ex !== 'boolean') continue;
    const m = it.mod; const papel = perfilDe(u, m); if (!itemDoPapel(papel, it)) continue;
    const base = itemPerfil(m, papel, it, cfg); if (ex === base) continue;
    if (ex) mais++; else menos++;
  }
  return { menos, mais, tem: menos + mais > 0 };
}

// ---- Itens (o que a pessoa pode FAZER dentro das abas) ----
// Cada item é de um módulo e vale só para os perfis daquele módulo que já podem fazer aquilo (quem). Aqui dá para
// TIRAR o item de um perfil ou de uma pessoa; nada passa do que o perfil permite. Guardados junto das abas.
// Exportar e Imprimir existem em cada módulo (ids com o módulo no fim, ex.: i_exportar_rh); o id antigo
// (i_exportar, i_imprimir) continua valendo como exceção da pessoa em todos os módulos.
const EXP = ['i_exportar', 'Exportar para o Excel', 'Botões de exportar das abas'], IMP = ['i_imprimir', 'Imprimir e salvar em PDF', 'Folha do líder, resumos, etiquetas e fichas'];
const comunsDe = (mod, quem) => [EXP, IMP].map(([id, nome, d]) => ({ id: `${id}_${mod}`, base: id, mod, nome, d, quem }));
export const ITENS = [
  { id: 'i_apontar', mod: 'operacao', nome: 'Apontar atividades', d: 'Marcar realizada ou não realizada, com justificativa', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  { id: 'i_foraprog', mod: 'operacao', nome: 'Incluir atividade fora da programação', d: 'Programar no dia uma atividade que não estava prevista', quem: ['coordenador', 'supervisor'] },
  { id: 'i_aprovar', mod: 'operacao', nome: 'Aprovar e devolver apontamentos', d: 'Na aba Aprovação e no Apontar', quem: ['supervisor', 'tecnico'] },
  { id: 'i_operacao', mod: 'operacao', nome: 'Lançar e editar em Equipamentos', d: 'Alocações, paradas, equipe e inspeções', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  { id: 'i_efetivo', mod: 'operacao', nome: 'Lançar na Escala do dia', d: 'Faltas, atestados, coberturas, horas extras e check-in do turno', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  ...comunsDe('operacao', ['gestor', 'coordenador', 'supervisor', 'tecnico', 'lider', 'leitor']),
  { id: 'i_acoes', mod: 'gestao', nome: 'Criar e acompanhar tratativas', d: 'Ações, planos 5W2H e atas em Tratativas, e o plano de ação em Causas e ações', quem: ['gestor', 'coordenador', 'supervisor'] },
  { id: 'i_fichas', mod: 'gestao', nome: 'Registrar ocorrências nas fichas', d: 'Fichas de acompanhamento dos colaboradores', quem: ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo'] },
  { id: 'i_medicao', mod: 'gestao', nome: 'Lançar na Medição', d: 'Marcar lançado, ocultar e digitar registros em Gestão › Medição', quem: ['gestor', 'coordenador'] },
  { id: 'i_aval', mod: 'gestao', nome: 'Lançar a Avaliação mensal dos operadores', d: 'Notas do mês em Equipamentos', quem: ['gestor', 'coordenador', 'supervisor', 'lider'] },
  ...comunsDe('gestao', ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor']),
  { id: 'i_freq', mod: 'rh', nome: 'Editar frequência e férias', d: 'Lançar na folha de 16 a 15 e cadastrar férias', quem: ['administrativo'] },
  ...comunsDe('rh', ['administrativo', 'leitor']),
  { id: 'i_metas', mod: 'indicadores', nome: 'Editar metas e valores do contrato', d: 'Metas dos 8 indicadores e os valores de ICCC e ICCP do mês (Visão geral)', quem: ['gestor'] },
  ...comunsDe('indicadores', ['ve', 'gestor'])
];
export const itemDoPapel = (papel, it) => !!papel && (papel === 'admin' || it.quem.includes(papel));
// O item no perfil do módulo (sem exceção da pessoa). Lê também a chave antiga do item (formato de antes).
export function itemPerfil(mod, papel, it, cfg) {
  if (papel === 'admin') return true;
  if (!itemDoPapel(papel, it)) return false;
  let c = valorCfg(cfg, mod, papel, it.id);
  if (typeof c !== 'boolean' && it.base) c = valorCfg(cfg, mod, papel, it.base);
  return typeof c === 'boolean' ? c : true;
}
// O item para esta pessoa: exceção dela (só para tirar ou devolver o que o perfil tem), senão o perfil do módulo.
// id pode ser o comum (i_exportar, i_imprimir): vale o do módulo pedido (mod).
export function podeItemU(u, id, cfg, mod) {
  if (!u) return false;
  const it = ITENS.find(x => x.id === id) || (mod && ITENS.find(x => x.base === id && x.mod === mod)) || ITENS.find(x => x.base === id);
  if (!it) return true;
  const papel = perfilDe(u, it.mod);
  if (papel === 'admin') return true;
  if (!itemDoPapel(papel, it)) return true; // quem não tem pelo perfil continua barrado pelas regras de sempre
  let ex = u.abas && u.abas[it.id];
  if (typeof ex !== 'boolean' && it.base) ex = u.abas && u.abas[it.base];
  return typeof ex === 'boolean' ? ex : itemPerfil(it.mod, papel, it, cfg);
}
