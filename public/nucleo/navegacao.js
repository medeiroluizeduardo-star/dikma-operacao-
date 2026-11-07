// Navegação: abas (VIEWS), os 5 módulos (MODS), barra de baixo do celular e troca de módulo.
// Para mudar o menu, comece por aqui: VIEWS diz em que módulo e grupo cada aba aparece e quem a vê.
import { podeVer } from '../contas/permissoes.js';
import { editaAdm } from '../contas/acessos.js';
import { ME, UI, salvarUI, isAdmin, perfil, admDe, temFichas, modsDe, setsDe, temEquipEm, permCfg, aplicarSet, MODULOS, moduloNovo } from './estado.js';
import { aprovador, acompanha } from '../calc/atividades.js';
import { trocarTela } from '../ui/shell.js';
import { supConjs } from '../contas/segcalc.js';

// Todas as abas do sistema, declaradas uma vez só, já no módulo (mod) e no grupo do menu (grp) em que aparecem.
// mod: all (Meu dia, em todos menos a Administração) · operacao · gestao · seguranca · rh · administracao
// req(): condição pelo usuário logado · reqU(u): condição pelo usuário · ord: ordem na Administração.
// fora: a aba não aparece no menu (abre por um botão da aba pai e por link) · pai: aba que fica marcada no menu.
// sup: aba da Segurança que o supervisor da área vê mesmo sem perfil na Segurança (ele trata as anomalias da área).
// As telas de Equipamentos, fichas e Frequência ficam em equip.js, gestao.js e administrativo.js, carregados quando precisa.
// Pátio e Bateria: o seletor no topo da Operação e da Gestão troca o conjunto (UI.esSet) e mantém a aba.
const opSets = () => setsDe(ME, 'operacao').length > 0;
const geSets = () => setsDe(ME, 'gestao').length > 0;
const opEq = () => temEquipEm(ME, 'operacao');
const geEq = () => temEquipEm(ME, 'gestao');
const temRH = () => !!perfil('rh');
export const VIEWS = [
  { id: 'meudia', nome: 'Meu dia', ic: 'sol', grp: 'Hoje', mod: 'all', sup: true },
  // ---- Operação: o dia a dia no campo ----
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Atividades', mod: 'operacao', req: opSets },
  { id: 'aprovar', nome: 'Aprovação', ic: 'aprov', grp: 'Atividades', mod: 'operacao', req: () => opSets() && acompanha('operacao') },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Atividades', mod: 'operacao', req: opSets },
  { id: 'elanc', nome: 'Lançamentos e paradas', ic: 'apontar', grp: 'Equipamentos', mod: 'operacao', req: opEq },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'operacao', req: opEq },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'plano', grp: 'Equipamentos', mod: 'operacao', req: opEq },
  { id: 'esdia', nome: 'Presença do dia', ic: 'escala', grp: 'Efetivo', mod: 'operacao', req: opSets },
  { id: 'eshe', nome: 'Banco de horas extras', ic: 'relogio', grp: 'Efetivo', mod: 'operacao', req: opSets },
  { id: 'esjus', nome: 'Justificativas', ic: 'pend', grp: 'Efetivo', mod: 'operacao', req: opSets },
  // ---- Gestão: planejar, acompanhar e analisar ----
  { id: 'prog', nome: 'Programação', ic: 'prog', grp: 'Atividades', mod: 'gestao', req: geSets },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Atividades', mod: 'gestao', req: geSets, fora: true, pai: 'prog' },
  { id: 'etiquetas', nome: 'Etiquetas QR das rotas', ic: 'qr', grp: 'Atividades', mod: 'gestao', req: () => geSets() && (acompanha('gestao') || admDe('ativ')), fora: true, pai: 'prog' },
  { id: 'causas', nome: 'Causas e ações', ic: 'causas', grp: 'Atividades', mod: 'gestao', req: geSets },
  { id: 'esdim', nome: 'Dimensionamento', ic: 'painel', grp: 'Efetivo', mod: 'gestao', req: geSets },
  { id: 'esbal', nome: 'Balanço e ausências', ic: 'prog', grp: 'Efetivo', mod: 'gestao', req: geSets },
  { id: 'gcolab', nome: 'Colaboradores', ic: 'users', grp: 'Fichas de acompanhamento', mod: 'gestao', req: () => temFichas(ME) },
  { id: 'gimpr', nome: 'Impressão das fichas', ic: 'print', grp: 'Fichas de acompanhamento', mod: 'gestao', req: () => temFichas(ME) },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'users', grp: 'Equipamentos', mod: 'gestao', req: geEq },
  { id: 'eanal', nome: 'Análises de equipamentos', ic: 'prog', grp: 'Equipamentos', mod: 'gestao', req: geEq },
  { id: 'painel', nome: 'Atividades', ic: 'painel', grp: 'Indicadores', mod: 'gestao', req: geSets },
  { id: 'epainel', nome: 'Equipamentos', ic: 'painel', grp: 'Indicadores', mod: 'gestao', req: geEq },
  { id: 'gpainel', nome: 'Fichas', ic: 'users', grp: 'Indicadores', mod: 'gestao', req: () => temFichas(ME) },
  { id: 'resumo', nome: 'Resumos para imprimir', ic: 'print', grp: 'Para imprimir', mod: 'gestao', req: () => geSets() || geEq() },
  { id: 'tvmodo', nome: 'Modo TV', ic: 'tv', grp: 'Para imprimir', mod: 'gestao', req: geSets },
  // ---- Segurança: registros de interação e de anomalia (telas/seguranca.js) ----
  { id: 'sginter', nome: 'Interações', ic: 'plano', grp: 'Registros', mod: 'seguranca', sup: true },
  { id: 'sganom', nome: 'Anomalias', ic: 'pend', grp: 'Registros', mod: 'seguranca', sup: true },
  { id: 'sgpainel', nome: 'Painel da Segurança', ic: 'painel', grp: 'Indicadores', mod: 'seguranca', sup: true },
  // ---- RH: frequência e férias (administrativo.js) ----
  { id: 'afreq', nome: 'Frequência', ic: 'prog', grp: 'Frequência e férias', mod: 'rh', req: temRH },
  { id: 'aferias', nome: 'Férias', ic: 'sol', grp: 'Frequência e férias', mod: 'rh', req: temRH },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'dl', grp: 'Frequência e férias', mod: 'rh', req: () => editaAdm(ME) },
  { id: 'fpainel', nome: 'Frequência', ic: 'prog', grp: 'Indicadores', mod: 'rh', req: temRH },
  { id: 'fresumo', nome: 'Resumo da frequência', ic: 'print', grp: 'Indicadores', mod: 'rh', req: temRH },
  // ---- Administração: ajustes de todos os módulos. 'Completa' vê tudo; 'Dos módulos', só os dos módulos em que é Gestor ----
  { id: 'cfgeral', nome: 'Visão geral', ic: 'painel', grp: 'Geral', mod: 'administracao', ord: 1, req: () => isAdmin() },
  { id: 'cfconf', nome: 'Conferência do cadastro', ic: 'pend', grp: 'Geral', mod: 'administracao', ord: 1.2, req: () => isAdmin() },
  { id: 'cfuso', nome: 'Uso do plano grátis', ic: 'prog', grp: 'Geral', mod: 'administracao', ord: 1.4, req: () => isAdmin() },
  { id: 'cflimpa', nome: 'Limpeza de dados', ic: 'lixo', grp: 'Geral', mod: 'administracao', ord: 1.6, req: () => isAdmin() },
  { id: 'cfescala', nome: 'Escalas e turnos', ic: 'escala', grp: 'Geral', mod: 'administracao', ord: 2, req: () => admDe('escala') },
  { id: 'config', nome: 'Rotas e configurações', ic: 'config', grp: 'Atividades', mod: 'administracao', ord: 3, req: () => admDe('ativ') },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Atividades', mod: 'administracao', ord: 4, req: () => admDe('ativ') },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Atividades', mod: 'administracao', ord: 5, req: () => admDe('ativ') },
  { id: 'cffotos', nome: 'Fotos das atividades', ic: 'cam', grp: 'Atividades', mod: 'administracao', ord: 5.5, req: () => isAdmin() },
  { id: 'cfarqfotos', nome: 'Relatórios e arquivo de fotos', ic: 'file', grp: 'Atividades', mod: 'administracao', ord: 5.6, req: () => isAdmin() },
  { id: 'econfig', nome: 'Equipamentos', ic: 'config', grp: 'Equipamentos', mod: 'administracao', ord: 6, req: () => admDe('equip') },
  { id: 'gtipos', nome: 'Tipos de ocorrência', ic: 'config', grp: 'Fichas', mod: 'administracao', ord: 7, req: () => admDe('fichas') },
  { id: 'sgconfig', nome: 'Segurança', ic: 'escudo', grp: 'Segurança', mod: 'administracao', ord: 8.5, req: () => admDe('seg') },
  { id: 'gimport', nome: 'Importar dados das fichas', ic: 'dl', grp: 'Fichas', mod: 'administracao', ord: 8, req: () => isAdmin() },
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Acesso', mod: 'administracao', ord: 9, req: () => isAdmin() },
  { id: 'perfis', nome: 'Perfis e permissões', ic: 'key', grp: 'Acesso', mod: 'administracao', ord: 10, req: () => isAdmin() }
];
// Subtítulo (topo) das abas de Equipamentos, fichas e Frequência.
export const SUB_E = {
  epainel: 'Produtividade da operação de equipamentos', elanc: 'Alocações do dia e paradas dos equipamentos',
  eequipe: 'Operadores, situação, frota e escala do mês', einsp: 'Checklist de 5S no equipamento e segurança', eaval: 'Notas do mês por operador',
  eanal: 'Evolução mensal e qualidade dos lançamentos', econfig: 'Turnos, metas, pesos, causas e feriados dos equipamentos'
};
export const SUB_G = {
  gpainel: 'Indicadores das fichas de acompanhamento',
  gcolab: 'Cadastro, controle da ficha e assinaturas de cada colaborador',
  gimpr: 'Ficha (Folhas 1 e 2) e via de assinatura',
  gimport: 'Colaboradores e ocorrências a partir de uma planilha',
  gtipos: 'Tipos, texto padrão e o que vai para a Folha 1'
};
export const SUB_A = {
  afreq: 'Folha de frequência de 16 a 15, por grupo',
  aferias: 'Planejamento, quem está de férias e data limite',
  aimport: 'Planilhas de frequência e de férias'
};
export const SUB_S = {
  sginter: 'Registros de interação: riscos e desvios vistos em campo',
  sganom: 'Fila das anomalias: situação, responsável e prazo',
  sgpainel: 'Interações, desvios e anomalias do mês',
  sgconfig: 'Áreas, tipos de atividade, regimes e desvios dos formulários'
};
// Nome curto oficial de cada aba: o mesmo no menu lateral, na barra de baixo do celular e no "Mais". O título da tela usa o nome completo.
const CURTO = { esdia: 'Presença', esbal: 'Balanço', eshe: 'Horas extras', causas: 'Causas', etiquetas: 'Etiquetas', elanc: 'Lançamentos', eequipe: 'Equipe', einsp: 'Inspeções', eaval: 'Avaliação', eanal: 'Análises', resumo: 'Resumos', gimpr: 'Impressão', cfconf: 'Conferência', cfescala: 'Escalas', cfuso: 'Uso do plano', cflimpa: 'Limpeza', usuarios: 'Usuários', perfis: 'Perfis', aimport: 'Importar', gimport: 'Importar fichas', config: 'Rotas', plano: 'Plano padrão', gerador: 'Gerador de meses', cffotos: 'Fotos', cfarqfotos: 'Arquivo de fotos', sgpainel: 'Painel', sgconfig: 'Segurança', fresumo: 'Resumo', fpainel: 'Indicadores' };
export const nomeCurto = v => (v && (CURTO[v.id] || v.nome)) || '';
// Os 5 módulos (seletor de módulo). key = mod das abas; inicio = aba que abre ao entrar no módulo.
export const MODS = {
  operacao: { nome: 'Operação', curto: 'Operação', sub: 'Apontar, Aprovação, Equipamentos e Efetivo', key: 'operacao', inicio: 'apontar' },
  gestao: { nome: 'Gestão', curto: 'Gestão', sub: 'Programação, Fichas, Indicadores e Resumos', key: 'gestao', inicio: 'prog' },
  seguranca: { nome: 'Segurança', curto: 'Segurança', sub: 'Interações, anomalias e indicadores', key: 'seguranca', inicio: 'sganom' },
  rh: { nome: 'RH', curto: 'RH', sub: 'Frequência, férias e planilhas', key: 'rh', inicio: 'afreq' },
  administracao: { nome: 'Administração', curto: 'Administração', sub: 'Configurações, usuários e perfis', key: 'administracao', inicio: 'cfgeral' }
};
// Itens do seletor de módulos: os módulos que a pessoa tem.
export const modsMenu = () => modsDe(ME);
export const mesmoItem = (a, b) => a === b;
export const subMod = m => MODS[m].sub;
// Abas do módulo aberto que esta pessoa vê (Meu dia vale em todos, menos na Administração).
export const viewsDoModulo = () => {
  const m = UI.modulo;
  // Supervisor da área sem perfil na Segurança: vê as abas marcadas com sup (as anomalias e interações da área dele).
  const supSeg = m === 'seguranca' && !perfil('seguranca') && supConjs(ME).length > 0;
  const l = VIEWS.filter(v => (v.mod === m || (v.mod === 'all' && m !== 'administracao')) && (!v.req || v.req()) && (!v.reqU || v.reqU(ME)) && (supSeg ? !!v.sup : podeVer(ME, v, permCfg(), m)));
  return m === 'administracao' ? l.sort((a, b) => (a.ord || 0) - (b.ord || 0)) : l;
};
// Abas que aparecem no menu (sem as que abrem por botão de outra aba).
export const abasDoMenu = () => viewsDoModulo().filter(v => !v.fora);
// Abas que foram juntadas ou tiradas: links antigos, avisos do celular e o que ficou salvo no aparelho caem na aba nova.
const VIEW_NOVA = { sgobra: 'sganom', gocorr: 'gcolab', gcontrole: 'gcolab', epar: 'elanc', apainel: 'afreq', relfoto: 'painel', escala: 'esdia', gcomigo: 'gcolab', gnovaoc: 'gcolab' };
function normalizarView() {
  const v0 = UI.view; if (!VIEW_NOVA[v0]) return;
  UI.view = VIEW_NOVA[v0];
  if (v0 === 'gocorr' && UI.g) { UI.g.mat = null; UI.g.filtro = 'pend'; }
  if (v0 === 'gcomigo' && UI.g) { UI.g.mat = null; UI.g.filtro = 'comigo'; }
  if (v0 === 'epar' && UI.e) { UI.e.aba = 'par'; UI.e.pf = 'aberta'; }
}
// Em que módulo fica a aba (null = Meu dia, que existe em todos).
export function moduloDaView(id) {
  const tv = VIEWS.find(v => v.id === id); return !tv || tv.mod === 'all' ? null : tv.mod;
}
// Leva a tela para um lugar válido: módulo antigo → novo; aba de outro módulo → o módulo dela (se a pessoa tem);
// aba que a pessoa não vê → o início do módulo.
export function ensureModulo() {
  normalizarView();
  if (!MODULOS.includes(UI.modulo)) UI.modulo = moduloNovo(UI.modulo, true);
  const ms = modsDe(ME); if (!ms.length) return;
  const alvo = moduloDaView(UI.view);
  if (alvo && alvo !== UI.modulo && ms.includes(alvo)) UI.modulo = alvo;
  if (!ms.includes(UI.modulo)) UI.modulo = ms[0];
  // Aba desligada para o perfil some do menu e não abre nem por link: cai na primeira aba liberada do módulo.
  const vs = viewsDoModulo();
  if (!vs.some(v => v.id === UI.view)) UI.view = vs.some(v => v.id === MODS[UI.modulo].inicio) ? MODS[UI.modulo].inicio : (vs.find(v => v.id !== 'meudia' && !v.fora) || vs[0] || { id: MODS[UI.modulo].inicio }).id;
}
export const ES_VIEWS = ['esdia', 'esdim', 'esbal', 'eshe', 'esjus'];
// Abas que dependem do conjunto (Pátio ou Bateria): mostram o seletor no topo para quem tem os dois.
export const SET_VIEWS = ['apontar', 'aprovar', 'pend', 'esdia', 'eshe', 'esjus', 'prog', 'imprimir', 'etiquetas', 'causas', 'esdim', 'esbal', 'painel', 'tvmodo'];
// Barra de baixo (celular): até 4 atalhos do módulo + Mais. Os nomes vêm de nomeCurto (iguais aos do menu lateral).
export function barraDe() {
  const m = UI.modulo;
  const tb = m === 'operacao' ? (aprovador() && !isAdmin() ? [['meudia', 'sol'], ['apontar', 'apontar'], ['aprovar', 'aprov'], ['pend', 'pend'], ['esdia', 'escala'], ['elanc', 'apontar']] : [['meudia', 'sol'], ['apontar', 'apontar'], ['pend', 'pend'], ['esdia', 'escala'], ['elanc', 'apontar'], ['eequipe', 'users'], ['einsp', 'plano']])
    : m === 'gestao' ? [['meudia', 'sol'], ['prog', 'prog'], ['painel', 'painel'], ['causas', 'causas'], ['gcolab', 'users'], ['eaval', 'users'], ['gpainel', 'users'], ['epainel', 'painel']]
    : m === 'seguranca' ? [['meudia', 'sol'], ['sganom', 'pend'], ['sginter', 'plano'], ['sgpainel', 'painel']]
    : m === 'rh' ? [['meudia', 'sol'], ['afreq', 'prog'], ['aferias', 'sol'], ['fpainel', 'painel'], ['aimport', 'dl']]
    : [['cfgeral', 'painel'], ['cfconf', 'pend'], ['cfescala', 'escala'], ['usuarios', 'users'], ['config', 'config'], ['plano', 'plano'], ['econfig', 'config'], ['gtipos', 'config']];
  const ok = new Set(abasDoMenu().map(v => v.id));
  return [...tb.filter(x => ok.has(x[0])).slice(0, 4).map(([id, ic]) => [id, '', ic]), ['__more', 'Mais', 'more']];
}
// Atalho para uma tela de outro módulo (ex.: da Programação para o Apontar): troca de módulo mantendo o conjunto.
export function irParaModuloDa(id) {
  if (viewsDoModulo().some(v => v.id === id)) return;
  const alvo = moduloDaView(id);
  if (!alvo || !modsDe(ME).includes(alvo)) return;
  UI.modulo = alvo; UI.modOpen = false; aplicarSet();
}
// Troca de módulo sem recarregar a página (a Administração também: os dados dela chegam ao abrir).
export function trocarModulo(m) {
  const ms = modsDe(ME); if (!ms.includes(m)) return;
  UI.modulo = m; UI.view = MODS[m].inicio; UI.confirm = null; UI.modOpen = false;
  aplicarSet(); ensureModulo(); salvarUI(); trocarTela(UI.view);
}
// Seletor Pátio | Bateria no topo da Operação e da Gestão: troca o conjunto e fica na mesma aba.
export function trocarConjunto(k) {
  if (k === UI.esSet || !setsDe(ME, UI.modulo).includes(k)) return;
  UI.esSet = k; UI.eRota = '*'; UI.confirm = null;
  aplicarSet(); ensureModulo(); salvarUI(); trocarTela(UI.view);
}
