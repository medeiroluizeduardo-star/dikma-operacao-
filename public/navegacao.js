// Navegação: abas (VIEWS), módulos (MODS), barra de baixo do celular e troca de módulo.
// Para mudar o menu, comece por aqui: VIEWS diz em que módulo e grupo cada aba aparece e quem a vê.
import { podeVer } from './permissoes.js';
import { ME, SK, UI, salvarUI, isAdmin, admMod, modsReais, temFichas, modsDe, setsDe, permCfg, aplicarSet } from './nucleo/estado.js';
import { aprovador, acompanha } from './calc/atividades.js';
import { trocarTela } from './ui/shell.js';

// Todas as abas do sistema, declaradas uma vez só, já no módulo (mod) e no grupo do menu (grp) em que aparecem.
// mod: all (todos) · pn (Painel) · op (Atividades Pátio/Bateria) · ge (Efetivo) · eq (Operação) · ad (Frequência e férias) · cf (Configurações)
// admin: só quem administra o módulo · req(): condição pelo usuário logado · reqU(u): condição pelo usuário · ord: ordem no módulo Configurações.
// As telas de Operação, Efetivo (fichas) e Frequência ficam em equip.js, gestao.js e administrativo.js, carregados quando precisa.
const gestorDe = m => () => isAdmin() || (!!ME && ME.papel === 'gestor' && modsReais(ME).includes(m));
const gestorAtiv = () => isAdmin() || (!!ME && ME.papel === 'gestor' && setsDe(ME).length > 0);
export const VIEWS = [
  { id: 'meudia', nome: 'Meu dia', ic: 'sol', grp: 'Hoje', mod: 'all' },
  // Painel: os painéis de todos os módulos e o Resumo da semana num lugar só
  { id: 'painel', nome: 'Atividades', ic: 'painel', grp: 'Painéis', mod: 'pn', reqU: u => setsDe(u).length > 0 },
  { id: 'resumo', nome: 'Resumos', ic: 'print', grp: 'Painéis', mod: 'pn', reqU: u => setsDe(u).length > 0 || modsReais(u).includes('equipamentos') || modsReais(u).includes('frequencia') },
  { id: 'epainel', nome: 'Equipamentos', ic: 'painel', grp: 'Painéis', mod: 'pn', reqU: u => modsReais(u).includes('equipamentos') },
  { id: 'fpainel', nome: 'Frequência', ic: 'prog', grp: 'Painéis', mod: 'pn', reqU: u => modsReais(u).includes('frequencia') },
  { id: 'gpainel', nome: 'Fichas do efetivo', ic: 'users', grp: 'Painéis', mod: 'pn', reqU: u => modsReais(u).includes('gestao') },
  // Atividades Pátio e Atividades Bateria
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Acompanhar', mod: 'op' },
  { id: 'prog', nome: 'Programação', ic: 'prog', grp: 'Acompanhar', mod: 'op' },
  { id: 'aprovar', nome: 'Aprovação', ic: 'aprov', grp: 'Acompanhar', mod: 'op', req: () => acompanha() },
  { id: 'causas', nome: 'Causas e ações', ic: 'causas', grp: 'Acompanhar', mod: 'op' },
  { id: 'etiquetas', nome: 'Etiquetas QR das rotas', ic: 'qr', grp: 'Acompanhar', mod: 'op', req: () => acompanha() || admMod() },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Acompanhar', mod: 'op' },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Acompanhar', mod: 'op' },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Atividades', admin: true, mod: 'cf', ord: 4, req: gestorAtiv },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Atividades', admin: true, mod: 'cf', ord: 5, req: gestorAtiv },
  { id: 'config', nome: 'Rotas e configurações', ic: 'config', grp: 'Atividades', admin: true, mod: 'cf', ord: 3, req: gestorAtiv },
  // Efetivo: escala e presença (com Atividades) e fichas de acompanhamento (só quem tem o Efetivo marcado no usuário)
  { id: 'esdia', nome: 'Efetivo diário', ic: 'escala', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esdim', nome: 'Dimensionamento', ic: 'painel', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esbal', nome: 'Balanço e ausências', ic: 'prog', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'eshe', nome: 'Banco de horas extras', ic: 'relogio', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  { id: 'esjus', nome: 'Justificativas', ic: 'pend', grp: 'Escala e presença', mod: 'ge', reqU: u => setsDe(u).length > 0 },
  // Operação (equipamentos): telas em equip.js
  { id: 'elanc', nome: 'Lançamentos e paradas', ic: 'apontar', grp: 'Equipamentos', mod: 'eq' },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'eq' },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'plano', grp: 'Avaliação', mod: 'eq' },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'users', grp: 'Avaliação', mod: 'eq' },
  { id: 'eanal', nome: 'Análises', ic: 'prog', grp: 'Avaliação', mod: 'eq' },
  { id: 'econfig', nome: 'Operação (equipamentos)', ic: 'config', grp: 'Operação', mod: 'cf', admin: true, ord: 6, req: gestorDe('equipamentos') },
  // Efetivo › fichas de acompanhamento: telas em gestao.js (os dados das fichas só chegam para quem tem o Efetivo marcado)
  { id: 'gcolab', nome: 'Colaboradores', ic: 'users', grp: 'Fichas de acompanhamento', mod: 'ge', reqU: u => temFichas(u) },
  { id: 'gimpr', nome: 'Impressão', ic: 'print', grp: 'Fichas de acompanhamento', mod: 'ge', reqU: u => temFichas(u) },
  { id: 'gimport', nome: 'Importar dados', ic: 'dl', grp: 'Efetivo', mod: 'cf', admin: true, ord: 8, req: () => isAdmin() },
  { id: 'gtipos', nome: 'Tipos de ocorrência', ic: 'config', grp: 'Efetivo', mod: 'cf', admin: true, ord: 7, req: gestorDe('gestao') },
  // Frequência e férias: telas em administrativo.js
  { id: 'afreq', nome: 'Frequência', ic: 'prog', grp: 'Frequência e férias', mod: 'ad' },
  { id: 'aferias', nome: 'Férias', ic: 'sol', grp: 'Frequência e férias', mod: 'ad' },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'dl', grp: 'Administração', mod: 'ad', admin: true },
  // Configurações (administrador; o gestor vê as dos módulos dele)
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Acesso', admin: true, mod: 'cf', ord: 9, req: () => isAdmin() },
  { id: 'perfis', nome: 'Perfis e permissões', ic: 'key', grp: 'Acesso', admin: true, mod: 'cf', ord: 10, req: () => isAdmin() },
  { id: 'cfgeral', nome: 'Visão geral', ic: 'painel', grp: 'Geral', admin: true, mod: 'cf', ord: 1, req: () => isAdmin() },
  { id: 'cfconf', nome: 'Conferência do cadastro', ic: 'pend', grp: 'Geral', admin: true, mod: 'cf', ord: 1.2, req: () => isAdmin() },
  { id: 'cfuso', nome: 'Uso do plano grátis', ic: 'prog', grp: 'Geral', admin: true, mod: 'cf', ord: 1.4, req: () => isAdmin() },
  { id: 'cfescala', nome: 'Escalas e turnos', ic: 'escala', grp: 'Geral', admin: true, mod: 'cf', ord: 2 }
];
// Abas do módulo Painel (links antigos que abriam um painel dentro de outro módulo vão para o Painel).
const PN_VIEWS = ['painel', 'resumo', 'epainel', 'gpainel', 'fpainel'];
// Subtítulo (topo) das abas de Operação, fichas do Efetivo e Frequência.
export const SUB_E = {
  epainel: 'Produtividade da operação de equipamentos', elanc: 'Alocações do dia e paradas dos equipamentos',
  eequipe: 'Operadores, situação, frota e escala do mês', einsp: 'Checklist de 5S no equipamento e segurança', eaval: 'Notas do mês por operador',
  eanal: 'Evolução mensal e qualidade dos lançamentos', econfig: 'Turnos, metas, pesos, causas e feriados'
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
const CURTO = { esbal: 'Balanço', eshe: 'Horas extras', causas: 'Causas', etiquetas: 'Etiquetas', elanc: 'Lançamentos', eequipe: 'Equipe', einsp: 'Inspeções', eaval: 'Avaliação', gpainel: 'Fichas', cfconf: 'Conferência', cfescala: 'Escalas', cfuso: 'Uso do plano', usuarios: 'Usuários', perfis: 'Perfis', aimport: 'Importar', gimport: 'Importar dados', econfig: 'Operação', config: 'Rotas', plano: 'Plano padrão', gerador: 'Gerador de meses' };
export const nomeCurto = v => (v && (CURTO[v.id] || v.nome)) || '';
export const MODS = { paineis: { nome: 'Painel', curto: 'Painel', sub: 'Indicadores de todos os módulos', key: 'pn', inicio: 'painel' }, operacao: { nome: 'Atividades Pátio', curto: 'Pátio', sub: 'Pátio de Carvão', key: 'op', inicio: 'apontar' }, bateria: { nome: 'Atividades Bateria', curto: 'Bateria', sub: 'Bateria, Trilho e CDQ', key: 'op', inicio: 'apontar' }, equipamentos: { nome: 'Operação', curto: 'Operação', sub: 'Equipamentos e operadores', key: 'eq', inicio: 'elanc' }, gestao: { nome: 'Efetivo', curto: 'Efetivo', sub: 'Escala, presença e fichas', key: 'ge', inicio: 'esdia' } , config: { nome: 'Configurações', curto: 'Configurações', sub: 'Ajustes do sistema', key: 'cf', inicio: 'cfgeral' }, frequencia: { nome: 'Frequência e férias', curto: 'Frequência', sub: 'Folha de 16 a 15 e férias', key: 'ad', inicio: 'afreq' } };
export const viewsDoModulo = () => { const l = VIEWS.filter(v => (v.mod === MODS[UI.modulo].key || (v.mod === 'all' && (UI.acesso === 'operacao' || v.id !== 'meudia'))) && (!v.admin || (v.mod === 'all' ? isAdmin() : admMod())) && (!v.req || v.req()) && (!v.reqU || v.reqU(ME)) && podeVer(ME, v, permCfg())); return UI.modulo === 'config' ? l.sort((a, b) => (a.ord || 0) - (b.ord || 0)) : l; };
// Abas que foram juntadas ou tiradas: links antigos, avisos do celular e o que ficou salvo no aparelho caem na aba nova.
const VIEW_NOVA = { gocorr: 'gcolab', gcontrole: 'gcolab', epar: 'elanc', apainel: 'afreq', relfoto: 'painel' };
function normalizarView() {
  const v0 = UI.view; if (!VIEW_NOVA[v0]) return;
  UI.view = VIEW_NOVA[v0];
  if (v0 === 'gocorr' && UI.g) { UI.g.mat = null; UI.g.filtro = 'pend'; }
  if (v0 === 'epar' && UI.e) { UI.e.aba = 'par'; UI.e.pf = 'aberta'; }
}
export function ensureModulo() {
  normalizarView();
  // Links antigos e avisos que abriam um painel dentro de outro módulo: vão para o módulo Painel.
  if (PN_VIEWS.includes(UI.view) && UI.modulo !== 'paineis' && ME && modsDe(ME).includes('paineis')) { if (UI.modulo === 'operacao' || UI.modulo === 'bateria') UI.esSet = UI.modulo === 'bateria' ? 'bateria' : 'patio'; UI.modulo = 'paineis'; }
  const ms = modsDe(ME); if (!ms.length) return;
  if (UI.modulo === 'escala') UI.modulo = 'gestao'; // módulo antigo, agora dentro do Efetivo
  if (!ms.includes(UI.modulo)) { UI.modulo = ms[0]; }
  // Aba desligada para o perfil some do menu e não abre nem por link: cai na primeira aba liberada do módulo.
  const vs = viewsDoModulo();
  if (!vs.some(v => v.id === UI.view)) UI.view = vs.some(v => v.id === MODS[UI.modulo].inicio) ? MODS[UI.modulo].inicio : (vs.find(v => v.id !== 'meudia') || vs[0] || { id: MODS[UI.modulo].inicio }).id;
}
export const ES_VIEWS = ['esdia', 'esdim', 'esbal', 'eshe', 'esjus'];
// Barra de baixo (celular): até 4 atalhos do módulo + Mais.
export function barraDe() {
  const ge = UI.modulo === 'gestao', eqm = UI.modulo === 'equipamentos';
  const tb = ge ? [['meudia', 'Hoje', 'sol'], ['esdia', 'Escala', 'escala'], ['gcolab', 'Pessoas', 'users'], ['esbal', 'Balanço', 'prog'], ['__more', 'Mais', 'more']]
    : eqm ? [['meudia', 'Hoje', 'sol'], ['elanc', 'Lançar', 'apontar'], ['eequipe', 'Equipe', 'users'], ['einsp', 'Inspeções', 'plano'], ['__more', 'Mais', 'more']]
    : UI.modulo === 'config' ? [['cfgeral', 'Geral', 'config'], ['cfconf', 'Conferência', 'pend'], ['cfescala', 'Escalas', 'escala'], ['usuarios', 'Usuários', 'users'], ['__more', 'Mais', 'more']]
    : UI.modulo === 'frequencia' ? [['meudia', 'Hoje', 'sol'], ['afreq', 'Frequência', 'prog'], ['aferias', 'Férias', 'escala'], ['aimport', 'Importar', 'dl'], ['__more', 'Mais', 'more']]
    : UI.modulo === 'paineis' ? [['meudia', 'Hoje', 'sol'], ['painel', 'Atividades', 'painel'], ['resumo', 'Resumo', 'print'], ['epainel', 'Equip.', 'painel'], ['fpainel', 'Frequência', 'prog'], ['gpainel', 'Fichas', 'users'], ['__more', 'Mais', 'more']]
    : aprovador() && ME.papel !== 'admin' ? [['meudia', 'Hoje', 'sol'], ['apontar', 'Apontar', 'apontar'], ['aprovar', 'Aprovar', 'aprov'], ['pend', 'Pendências', 'pend'], ['__more', 'Mais', 'more']]
    : [['meudia', 'Hoje', 'sol'], ['apontar', 'Apontar', 'apontar'], ['pend', 'Pendências', 'pend'], ['causas', 'Causas', 'causas'], ['__more', 'Mais', 'more']];
  { const ok = new Set(viewsDoModulo().map(v => v.id)); for (let i = tb.length - 1; i >= 0; i--) if (tb[i][0] !== '__more' && !ok.has(tb[i][0])) tb.splice(i, 1); }
  return [...tb.filter(x => x[0] !== '__more').slice(0, 4), ['__more', 'Mais', 'more']];
}
// Atalho para uma tela de outro módulo (ex.: do Painel para o Apontar): troca de módulo mantendo o conjunto (Pátio/Bateria).
export function irParaModuloDa(id) {
  const tv = VIEWS.find(v => v.id === id); if (!tv || tv.mod === 'all' || viewsDoModulo().some(v => v.id === id)) return;
  const ms = modsDe(ME), set = SK;
  const alvo = tv.mod === 'pn' ? 'paineis' : tv.mod === 'eq' ? 'equipamentos' : tv.mod === 'ge' ? 'gestao' : tv.mod === 'ad' ? 'frequencia' : tv.mod === 'op' ? (set === 'bateria' && ms.includes('bateria') ? 'bateria' : ms.includes('operacao') ? 'operacao' : 'bateria') : null;
  if (!alvo || !ms.includes(alvo)) return;
  if (alvo === 'gestao' || alvo === 'paineis') UI.esSet = set;
  UI.modulo = alvo; UI.modOpen = false; aplicarSet();
}
export function trocarModulo(m) { if (!modsDe(ME).includes(m)) return; if ((m === 'gestao' || m === 'paineis') && (UI.modulo === 'operacao' || UI.modulo === 'bateria')) { UI.esSet = SK; if (m === 'gestao') UI.eRota = '*'; } if ((m === 'operacao' || m === 'bateria') && UI.modulo === 'paineis') { /* volta para o conjunto que estava no painel só se for o mesmo módulo */ } UI.modulo = m; UI.view = MODS[m].inicio; UI.confirm = null; salvarUI(); trocarTela(UI.view); }
