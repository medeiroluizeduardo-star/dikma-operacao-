// Navegação: abas (VIEWS), módulos (MODS), barra de baixo do celular e troca de módulo.
// Para mudar o menu, comece por aqui: VIEWS diz em que módulo e grupo cada aba aparece e quem a vê.
import { podeVer } from './permissoes.js';
import { ME, SK, UI, salvarUI, isAdmin, admMod, modsReais, temFichas, modsDe, setsDe, permCfg, aplicarSet } from './nucleo/estado.js';
import { aprovador, acompanha } from './calc/atividades.js';
import { trocarTela } from './ui/shell.js';

// Todas as abas do sistema, declaradas uma vez só, já no módulo (mod) e no grupo do menu (grp) em que aparecem.
// mod: all (todos) · pn (Indicadores) · op (Atividades, Pátio ou Bateria) · ge (Pessoas no turno) · eq (Equipamentos) · ad (RH) · cf (Configurações)
// admin: só quem administra o módulo · req(): condição pelo usuário logado · reqU(u): condição pelo usuário · ord: ordem no módulo Configurações.
// fora: a aba não aparece no menu (abre por um botão da aba pai e por link) · pai: aba que fica marcada no menu.
// As telas de Equipamentos, fichas (RH) e Frequência ficam em equip.js, gestao.js e administrativo.js, carregados quando precisa.
// Os nomes internos dos módulos ficaram os de antes (paineis, operacao, bateria, gestao, equipamentos, frequencia, config),
// para não perder o que está salvo no aparelho, os links e os avisos; só o nome na tela mudou.
const gestorDe = m => () => isAdmin() || (!!ME && ME.papel === 'gestor' && modsReais(ME).includes(m));
const gestorAtiv = () => isAdmin() || (!!ME && ME.papel === 'gestor' && setsDe(ME).length > 0);
export const VIEWS = [
  { id: 'meudia', nome: 'Meu dia', ic: 'sol', grp: 'Hoje', mod: 'all' },
  // Indicadores: os painéis de todas as áreas e os resumos para imprimir num lugar só
  { id: 'painel', nome: 'Atividades', ic: 'painel', grp: 'Indicadores', mod: 'pn', reqU: u => setsDe(u).length > 0 },
  { id: 'epainel', nome: 'Equipamentos', ic: 'painel', grp: 'Indicadores', mod: 'pn', reqU: u => modsReais(u).includes('equipamentos') },
  { id: 'fpainel', nome: 'Frequência', ic: 'prog', grp: 'Indicadores', mod: 'pn', reqU: u => modsReais(u).includes('frequencia') },
  { id: 'gpainel', nome: 'Fichas', ic: 'users', grp: 'Indicadores', mod: 'pn', reqU: u => modsReais(u).includes('gestao') },
  { id: 'resumo', nome: 'Resumos para imprimir', ic: 'print', grp: 'Para imprimir', mod: 'pn', reqU: u => setsDe(u).length > 0 || modsReais(u).includes('equipamentos') || modsReais(u).includes('frequencia') },
  // Atividades (Pátio e Bateria: o seletor no topo troca o conjunto e mantém a aba)
  // fora: não aparece no menu; abre por botão (no topo da Programação, pai) e por link antigo.
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Acompanhar', mod: 'op' },
  { id: 'prog', nome: 'Programação', ic: 'prog', grp: 'Acompanhar', mod: 'op' },
  { id: 'aprovar', nome: 'Aprovação', ic: 'aprov', grp: 'Acompanhar', mod: 'op', req: () => acompanha() },
  { id: 'causas', nome: 'Causas e ações', ic: 'causas', grp: 'Acompanhar', mod: 'op' },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Acompanhar', mod: 'op' },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Acompanhar', mod: 'op', fora: true, pai: 'prog' },
  { id: 'etiquetas', nome: 'Etiquetas QR das rotas', ic: 'qr', grp: 'Acompanhar', mod: 'op', req: () => acompanha() || admMod(), fora: true, pai: 'prog' },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Atividades', admin: true, mod: 'cf', ord: 4, req: gestorAtiv },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Atividades', admin: true, mod: 'cf', ord: 5, req: gestorAtiv },
  { id: 'config', nome: 'Rotas e configurações', ic: 'config', grp: 'Atividades', admin: true, mod: 'cf', ord: 3, req: gestorAtiv },
  // Pessoas no turno: escala e presença (vem junto com Atividades Pátio ou Bateria)
  { id: 'esdia', nome: 'Presença do dia', ic: 'escala', grp: 'No turno', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esdim', nome: 'Dimensionamento', ic: 'painel', grp: 'No turno', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esbal', nome: 'Balanço e ausências', ic: 'prog', grp: 'No turno', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'eshe', nome: 'Banco de horas extras', ic: 'relogio', grp: 'No turno', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esjus', nome: 'Justificativas', ic: 'pend', grp: 'No turno', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  // Equipamentos: telas em equip.js
  { id: 'elanc', nome: 'Lançamentos e paradas', ic: 'apontar', grp: 'Equipamentos', mod: 'eq' },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'eq' },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'plano', grp: 'Avaliação', mod: 'eq' },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'users', grp: 'Avaliação', mod: 'eq' },
  { id: 'eanal', nome: 'Análises', ic: 'prog', grp: 'Avaliação', mod: 'eq' },
  { id: 'econfig', nome: 'Equipamentos', ic: 'config', grp: 'Equipamentos', mod: 'cf', admin: true, ord: 6, req: gestorDe('equipamentos') },
  // RH: frequência e férias (administrativo.js, só quem tem o módulo Frequência) e fichas de acompanhamento
  // (gestao.js, só quem tem as fichas marcadas no usuário)
  { id: 'afreq', nome: 'Frequência', ic: 'prog', grp: 'Frequência e férias', mod: 'ad', reqU: u => modsReais(u).includes('frequencia') },
  { id: 'aferias', nome: 'Férias', ic: 'sol', grp: 'Frequência e férias', mod: 'ad', reqU: u => modsReais(u).includes('frequencia') },
  { id: 'gcolab', nome: 'Colaboradores', ic: 'users', grp: 'Fichas de acompanhamento', mod: 'ad', reqU: u => temFichas(u) },
  { id: 'gimpr', nome: 'Impressão das fichas', ic: 'print', grp: 'Fichas de acompanhamento', mod: 'ad', reqU: u => temFichas(u) },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'dl', grp: 'Administração', mod: 'ad', admin: true, reqU: u => modsReais(u).includes('frequencia') },
  { id: 'gimport', nome: 'Importar dados das fichas', ic: 'dl', grp: 'Fichas (RH)', mod: 'cf', admin: true, ord: 8, req: () => isAdmin() },
  { id: 'gtipos', nome: 'Tipos de ocorrência', ic: 'config', grp: 'Fichas (RH)', mod: 'cf', admin: true, ord: 7, req: gestorDe('gestao') },
  // Configurações (administrador; o gestor vê as dos módulos dele)
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Acesso', admin: true, mod: 'cf', ord: 9, req: () => isAdmin() },
  { id: 'perfis', nome: 'Perfis e permissões', ic: 'key', grp: 'Acesso', admin: true, mod: 'cf', ord: 10, req: () => isAdmin() },
  { id: 'cfgeral', nome: 'Visão geral', ic: 'painel', grp: 'Geral', admin: true, mod: 'cf', ord: 1, req: () => isAdmin() },
  { id: 'cfconf', nome: 'Conferência do cadastro', ic: 'pend', grp: 'Geral', admin: true, mod: 'cf', ord: 1.2, req: () => isAdmin() },
  { id: 'cfuso', nome: 'Uso do plano grátis', ic: 'prog', grp: 'Geral', admin: true, mod: 'cf', ord: 1.4, req: () => isAdmin() },
  { id: 'cfescala', nome: 'Escalas e turnos', ic: 'escala', grp: 'Geral', admin: true, mod: 'cf', ord: 2 }
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
// Nome curto oficial de cada aba: o mesmo no menu lateral, na barra de baixo do celular e no "Mais". O título da tela usa o nome completo.
const CURTO = { esdia: 'Presença', esbal: 'Balanço', eshe: 'Horas extras', causas: 'Causas', etiquetas: 'Etiquetas', elanc: 'Lançamentos', eequipe: 'Equipe', einsp: 'Inspeções', eaval: 'Avaliação', resumo: 'Resumos', gimpr: 'Impressão', cfconf: 'Conferência', cfescala: 'Escalas', cfuso: 'Uso do plano', usuarios: 'Usuários', perfis: 'Perfis', aimport: 'Importar', gimport: 'Importar fichas', config: 'Rotas', plano: 'Plano padrão', gerador: 'Gerador de meses' };
export const nomeCurto = v => (v && (CURTO[v.id] || v.nome)) || '';
// Módulos (áreas do menu). Atividades Pátio e Bateria são um item só no menu ("Atividades"); o seletor no topo troca entre eles.
export const MODS = {
  paineis: { nome: 'Indicadores', curto: 'Indicadores', sub: 'Números de todas as áreas', key: 'pn', inicio: 'painel' },
  operacao: { nome: 'Atividades', curto: 'Atividades', sub: 'Pátio de Carvão', key: 'op', inicio: 'apontar' },
  bateria: { nome: 'Atividades', curto: 'Atividades', sub: 'Bateria, Trilho e CDQ', key: 'op', inicio: 'apontar' },
  gestao: { nome: 'Pessoas no turno', curto: 'Pessoas no turno', sub: 'Presença, escala e horas extras', key: 'ge', inicio: 'esdia' },
  equipamentos: { nome: 'Equipamentos', curto: 'Equipamentos', sub: 'Lançamentos, frota e operadores', key: 'eq', inicio: 'elanc' },
  frequencia: { nome: 'RH', curto: 'RH', sub: 'Frequência, férias e fichas', key: 'ad', inicio: 'afreq' },
  config: { nome: 'Configurações', curto: 'Configurações', sub: 'Ajustes do sistema', key: 'cf', inicio: 'cfgeral' }
};
// Módulos que se marcam no usuário (tela Usuários e acessos): o nome diz o que a marca libera.
export const MOD_MARCA = { operacao: { nome: 'Atividades Pátio', curto: 'Pátio' }, bateria: { nome: 'Atividades Bateria', curto: 'Bateria' }, equipamentos: { nome: 'Equipamentos', curto: 'Equipamentos' }, gestao: { nome: 'Fichas (RH)', curto: 'Fichas' }, frequencia: { nome: 'Frequência e férias (RH)', curto: 'Frequência' } };
const ehAtiv = m => m === 'operacao' || m === 'bateria';
// Itens do menu de módulos: Pátio e Bateria viram um item só (o do conjunto aberto, ou o último usado).
export function modsMenu() {
  const ms = modsDe(ME); const ativ = ms.filter(ehAtiv);
  if (ativ.length < 2) return ms;
  const fica = ehAtiv(UI.modulo) ? UI.modulo : (UI.esSet === 'bateria' ? 'bateria' : 'operacao');
  return ms.filter(m => !ehAtiv(m) || m === fica);
}
// Item do menu marcado para o módulo aberto (Pátio e Bateria marcam o mesmo item "Atividades").
export const mesmoItem = (a, b) => a === b || (ehAtiv(a) && ehAtiv(b));
// Subtítulo do item Atividades: os dois conjuntos quando a pessoa tem os dois.
export const subMod = m => (ehAtiv(m) && modsDe(ME).filter(ehAtiv).length > 1 ? 'Pátio de Carvão e Bateria' : MODS[m].sub);
export const viewsDoModulo = () => { const l = VIEWS.filter(v => (v.mod === MODS[UI.modulo].key || (v.mod === 'all' && (UI.acesso === 'operacao' || v.id !== 'meudia'))) && (!v.admin || (v.mod === 'all' ? isAdmin() : admMod())) && (!v.req || v.req()) && (!v.reqU || v.reqU(ME)) && podeVer(ME, v, permCfg())); return UI.modulo === 'config' ? l.sort((a, b) => (a.ord || 0) - (b.ord || 0)) : l; };
// Abas que aparecem no menu (sem as que abrem por botão de outra aba).
export const abasDoMenu = () => viewsDoModulo().filter(v => !v.fora);
// Abas que foram juntadas ou tiradas: links antigos, avisos do celular e o que ficou salvo no aparelho caem na aba nova.
const VIEW_NOVA = { gocorr: 'gcolab', gcontrole: 'gcolab', epar: 'elanc', apainel: 'afreq', relfoto: 'painel', escala: 'esdia', gcomigo: 'gcolab', gnovaoc: 'gcolab' };
// Módulos antigos (guardados no aparelho ou em links velhos) e o módulo de agora.
const MOD_NOVO = { escala: 'gestao', adm: 'frequencia', administrativo: 'frequencia', paineis: 'paineis' };
function normalizarView() {
  const v0 = UI.view; if (!VIEW_NOVA[v0]) return;
  UI.view = VIEW_NOVA[v0];
  if (v0 === 'gocorr' && UI.g) { UI.g.mat = null; UI.g.filtro = 'pend'; }
  if (v0 === 'gcomigo' && UI.g) { UI.g.mat = null; UI.g.filtro = 'comigo'; }
  if (v0 === 'epar' && UI.e) { UI.e.aba = 'par'; UI.e.pf = 'aberta'; }
}
// Em que módulo fica a aba (para quem tem os dois conjuntos de atividades, o conjunto aberto ou o último usado).
export function moduloDaView(id) {
  const tv = VIEWS.find(v => v.id === id); if (!tv || tv.mod === 'all') return null;
  const ms = modsDe(ME);
  if (tv.mod === 'op') {
    if (ehAtiv(UI.modulo) && ms.includes(UI.modulo)) return UI.modulo;
    const set = (UI.modulo === 'gestao' || UI.modulo === 'paineis') ? SK : UI.esSet;
    return set === 'bateria' && ms.includes('bateria') ? 'bateria' : ms.includes('operacao') ? 'operacao' : 'bateria';
  }
  return Object.keys(MODS).find(m => MODS[m].key === tv.mod && !ehAtiv(m)) || null;
}
// Muda de módulo levando o conjunto (Pátio ou Bateria) junto.
function irModulo(alvo) {
  if (alvo === UI.modulo) return;
  if ((alvo === 'gestao' || alvo === 'paineis') && ehAtiv(UI.modulo)) UI.esSet = UI.modulo === 'bateria' ? 'bateria' : 'patio';
  if (ehAtiv(alvo) && (UI.modulo === 'gestao' || UI.modulo === 'paineis')) UI.esSet = SK;
  UI.modulo = alvo;
}
export function ensureModulo() {
  normalizarView();
  if (MOD_NOVO[UI.modulo]) UI.modulo = MOD_NOVO[UI.modulo];
  const ms = modsDe(ME); if (!ms.length) return;
  // Link antigo, aviso ou memória do aparelho com a aba noutro módulo (ex.: Colaboradores no antigo Efetivo, que agora
  // fica no RH; um painel dentro de Atividades): vai para o módulo onde a aba está agora, se a pessoa tem esse módulo.
  const alvo = moduloDaView(UI.view);
  if (alvo && alvo !== UI.modulo && !(ehAtiv(alvo) && ehAtiv(UI.modulo)) && ms.includes(alvo)) irModulo(alvo);
  if (!ms.includes(UI.modulo)) { UI.modulo = ehAtiv(UI.modulo) && ms.some(ehAtiv) ? ms.find(ehAtiv) : ms[0]; }
  // Aba desligada para o perfil some do menu e não abre nem por link: cai na primeira aba liberada do módulo.
  const vs = viewsDoModulo();
  if (!vs.some(v => v.id === UI.view)) UI.view = vs.some(v => v.id === MODS[UI.modulo].inicio) ? MODS[UI.modulo].inicio : (vs.find(v => v.id !== 'meudia' && !v.fora) || vs[0] || { id: MODS[UI.modulo].inicio }).id;
}
export const ES_VIEWS = ['esdia', 'esdim', 'esbal', 'eshe', 'esjus'];
// Barra de baixo (celular): até 4 atalhos do módulo + Mais. Os nomes vêm de nomeCurto (iguais aos do menu lateral).
export function barraDe() {
  const m = UI.modulo;
  const tb = m === 'gestao' ? [['meudia', 'sol'], ['esdia', 'escala'], ['esbal', 'prog'], ['eshe', 'relogio'], ['esjus', 'pend']]
    : m === 'equipamentos' ? [['meudia', 'sol'], ['elanc', 'apontar'], ['eequipe', 'users'], ['einsp', 'plano'], ['eaval', 'users']]
    : m === 'config' ? [['cfgeral', 'config'], ['cfconf', 'pend'], ['cfescala', 'escala'], ['usuarios', 'users'], ['perfis', 'key']]
    : m === 'frequencia' ? [['meudia', 'sol'], ['afreq', 'prog'], ['aferias', 'escala'], ['gcolab', 'users'], ['gimpr', 'print'], ['aimport', 'dl']]
    : m === 'paineis' ? [['meudia', 'sol'], ['painel', 'painel'], ['epainel', 'painel'], ['fpainel', 'prog'], ['gpainel', 'users'], ['resumo', 'print']]
    : aprovador() && ME.papel !== 'admin' ? [['meudia', 'sol'], ['apontar', 'apontar'], ['aprovar', 'aprov'], ['pend', 'pend'], ['prog', 'prog'], ['causas', 'causas']]
    : [['meudia', 'sol'], ['apontar', 'apontar'], ['prog', 'prog'], ['pend', 'pend'], ['causas', 'causas']];
  const ok = new Set(abasDoMenu().map(v => v.id));
  return [...tb.filter(x => ok.has(x[0])).slice(0, 4).map(([id, ic]) => [id, '', ic]), ['__more', 'Mais', 'more']];
}
// Atalho para uma tela de outro módulo (ex.: dos Indicadores para o Apontar): troca de módulo mantendo o conjunto (Pátio/Bateria).
export function irParaModuloDa(id) {
  if (viewsDoModulo().some(v => v.id === id)) return;
  const alvo = moduloDaView(id);
  if (!alvo || !modsDe(ME).includes(alvo)) return;
  irModulo(alvo); UI.modOpen = false; aplicarSet();
}
export function trocarModulo(m) {
  const ms = modsDe(ME); if (!ms.includes(m)) return;
  // Item Atividades: abre no conjunto em que a pessoa estava (Pátio ou Bateria).
  if (ehAtiv(m) && !ehAtiv(UI.modulo)) { const set = (UI.modulo === 'gestao' || UI.modulo === 'paineis') ? SK : UI.esSet; const b = set === 'bateria' && ms.includes('bateria'); m = b ? 'bateria' : ms.includes('operacao') ? 'operacao' : m; }
  if (m === 'gestao' && ehAtiv(UI.modulo)) UI.eRota = '*';
  irModulo(m); UI.view = MODS[m].inicio; UI.confirm = null; salvarUI(); trocarTela(UI.view);
}
// Seletor Pátio | Bateria no topo das Atividades: troca o conjunto e fica na mesma aba.
export function trocarConjunto(m) {
  if (!ehAtiv(m) || m === UI.modulo || !modsDe(ME).includes(m)) return;
  UI.modulo = m; UI.esSet = m === 'bateria' ? 'bateria' : 'patio'; UI.confirm = null;
  aplicarSet(); ensureModulo(); salvarUI(); trocarTela(UI.view);
}
