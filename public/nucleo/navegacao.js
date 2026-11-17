// Navegação: abas (VIEWS), os 6 módulos (MODS), barra de baixo do celular e troca de módulo.
// Para mudar o menu, comece por aqui: VIEWS diz em que módulo e grupo cada aba aparece e quem a vê.
import { podeVer } from '../contas/permissoes.js';
import { editaAdm, veHistorico, conjsInd, eqInd } from '../contas/acessos.js';
import { ME, UI, salvarUI, isAdmin, perfil, admDe, temFichas, modsDe, setsDe, temEquipEm, permCfg, aplicarSet, MODULOS, moduloNovo, SK } from './estado.js';
import { aprovador, acompanha } from '../calc/atividades.js';
import { trocarTela } from '../ui/shell.js';
import { supConjs } from '../contas/segcalc.js';
import { veTreinos } from '../contas/treinos.js';
import { veDocsU } from '../contas/documentos.js';
import { veOmsU } from '../contas/oms.js';
import { acoes } from './acoes.js';

// Todas as abas do sistema, declaradas uma vez só, já no módulo (mod) e no grupo do menu (grp) em que aparecem.
// mod: all (Avisos no celular, em todos os módulos; abre pelo Mais e pelo menu lateral) · operacao · gestao · seguranca · rh · indicadores · administracao
// req(): condição pelo usuário logado · reqU(u): condição pelo usuário · ord: ordem na Administração.
// fora: a aba não aparece no menu (abre por um botão da aba pai e por link) · pai: aba que fica marcada no menu.
// livre: todo mundo que tem o módulo vê (não entra em Perfis e permissões).
// junto: abas que ocupam um lugar só no menu (o da primeira que a pessoa vê), com um seletor no topo para trocar entre elas.
// sup: aba da Segurança que o supervisor da área vê mesmo sem perfil na Segurança (ele trata as anomalias da área).
// filtros: o que aparece no topo para escolher: m = mês, s = semana, a = área (ex.: 'msa'; sem filtros = nada).
// conj: a aba depende do conjunto (Pátio ou Bateria) e mostra o seletor no topo para quem tem os dois.
// mesDados: a aba precisa das semanas do mês carregadas mesmo sem filtro de mês (Aprovação).
// tela: arquivo que desenha a aba (SG = Segurança, EQ = Equipamentos, GE = fichas, CF = configurações gerais);
//   sem tela, a aba é das Atividades (ou do RH, que tem o próprio arquivo).
// As telas de Equipamentos, fichas e Frequência ficam em equip.js, gestao.js e administrativo.js, carregados quando precisa.
// Pátio e Bateria: o seletor no topo da Operação e da Gestão troca o conjunto (UI.esSet) e mantém a aba.
const opSets = () => setsDe(ME, 'operacao').length > 0;
const geSets = () => setsDe(ME, 'gestao').length > 0;
const opEq = () => temEquipEm(ME, 'operacao');
const geEq = () => temEquipEm(ME, 'gestao');
const temRH = () => !!perfil('rh');
// Indicadores: conjuntos (Pátio, Bateria) e Equipamentos do escopo de quem tem o módulo.
const indSets = () => setsDe(ME, 'indicadores').length > 0;
const indEq = () => temEquipEm(ME, 'indicadores');
const indConj = () => conjsInd(ME).length > 0;
export const VIEWS = [
  { id: 'avisos', nome: 'Avisos no celular', ic: 'celular', grp: 'Conta', mod: 'all', fora: true, livre: true, sup: true },
  // Histórico de alterações do gestor de cada módulo (só o do módulo dele); o administrador usa o da Administração (cfhist).
  { id: 'historico', nome: 'Histórico de alterações', ic: 'relogio', grp: 'Conta', mod: 'all', fora: true, livre: true, req: () => veHistorico(ME) && !isAdmin() },
  // ---- Operação: o dia a dia no campo ----
  { id: 'apontar', nome: 'Apontar', ic: 'apontar', grp: 'Atividades', mod: 'operacao', req: opSets, filtros: 'ms', conj: true },
  { id: 'aprovar', nome: 'Aprovação', ic: 'carimbo', grp: 'Atividades', mod: 'operacao', req: () => opSets() && acompanha('operacao'), mesDados: true, conj: true },
  { id: 'pend', nome: 'Pendências', ic: 'pend', grp: 'Atividades', mod: 'operacao', req: opSets, conj: true },
  // OMs (telas/oms.js): o líder abre a solicitação, o Técnico de Processo aprova e envia ao cliente; horas de solicitação, liberação e finalização.
  { id: 'oms', nome: 'Solicitações de OM', ic: 'ficha', grp: 'Atividades', mod: 'operacao', req: () => opSets() && veOmsU(ME, SK), tela: 'OM', conj: true },
  { id: 'quedazero', nome: 'Queda zero', ic: 'queda', grp: 'Atividades', mod: 'operacao', req: opSets, filtros: 'ms', conj: true },
  { id: 'elanc', nome: 'Lançamentos e paradas', ic: 'lanc', grp: 'Equipamentos', mod: 'operacao', req: opEq, tela: 'EQ', junto: 'opeq' },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'operacao', req: opEq, tela: 'EQ', junto: 'opeq' },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'capacete', grp: 'Equipamentos', mod: 'operacao', req: opEq, tela: 'EQ', junto: 'opeq' },
  { id: 'esdia', nome: 'Escala do dia', ic: 'presenca', grp: 'Efetivo', mod: 'operacao', req: opSets, filtros: 'msa', conj: true },
  { id: 'eshe', nome: 'Banco de horas extras', ic: 'relogio', grp: 'Efetivo', mod: 'operacao', req: opSets, filtros: 'ma', conj: true, junto: 'horas' },
  { id: 'esjus', nome: 'Justificativas', ic: 'nota', grp: 'Efetivo', mod: 'operacao', req: opSets, filtros: 'ma', conj: true, junto: 'horas' },
  // ---- Gestão: planejar, acompanhar e analisar ----
  { id: 'prog', nome: 'Programação', ic: 'prog', grp: 'Atividades', mod: 'gestao', req: geSets, filtros: 'msa', conj: true },
  { id: 'imprimir', nome: 'Folha do líder', ic: 'print', grp: 'Atividades', mod: 'gestao', req: geSets, fora: true, pai: 'prog', filtros: 'ms', conj: true },
  { id: 'etiquetas', nome: 'Etiquetas QR das rotas', ic: 'qr', grp: 'Atividades', mod: 'gestao', req: () => geSets() && (acompanha('gestao') || admDe('ativ')), fora: true, pai: 'prog', filtros: 'a', conj: true },
  { id: 'causas', nome: 'Causas e ações', ic: 'causas', grp: 'Atividades', mod: 'gestao', req: geSets, filtros: 'ma', conj: true },
  { id: 'esdim', nome: 'Dimensionamento', ic: 'organograma', grp: 'Efetivo', mod: 'gestao', req: geSets, filtros: 'msa', conj: true, junto: 'efetivo' },
  { id: 'esbal', nome: 'Balanço e ausências', ic: 'balanca', grp: 'Efetivo', mod: 'gestao', req: geSets, filtros: 'msa', conj: true, junto: 'efetivo' },
  { id: 'gcolab', nome: 'Fichas de acompanhamento', ic: 'ficha', grp: 'Fichas', mod: 'gestao', req: () => temFichas(ME), tela: 'GE' },
  { id: 'gimpr', nome: 'Impressão das fichas', ic: 'print', grp: 'Fichas', mod: 'gestao', req: () => temFichas(ME), fora: true, pai: 'gcolab', tela: 'GE' },
  // Tratativas: os planos de ação de todas as origens (Ações com 5W2H, Planos 5W2H e Atas de reunião; telas/tratativas.js).
  // Vê quem tem a Gestão; cria e edita: Gestor, Coordenador e Supervisor (item "Criar e acompanhar tratativas").
  { id: 'gtrat', nome: 'Tratativas', ic: 'alvo', grp: 'Acompanhamento', mod: 'gestao', req: () => isAdmin() || !!perfil('gestao'), tela: 'TR' },
  // Medição do contrato (era do Meu painel): faltas, horas extras, horas perdidas e ICCC/ICCP do mês, com o "lançado"
  // de todos (telas/medicao.js). Vê: Gestor, Coordenador e Administrativo; marca e digita: Gestor e Coordenador.
  { id: 'gmed', nome: 'Medição', ic: 'planilha', grp: 'Contrato', mod: 'gestao', req: () => geSets() && (isAdmin() || ['gestor', 'coordenador', 'administrativo'].includes(perfil('gestao'))), tela: 'MD' },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'estrela', grp: 'Equipamentos', mod: 'gestao', req: geEq, tela: 'EQ', junto: 'geeq' },
  // ---- Segurança: registros de interação e de anomalia (telas/seguranca.js) ----
  { id: 'sginter', nome: 'Interações', ic: 'conversa', grp: 'Registros', mod: 'seguranca', sup: true, tela: 'SG' },
  { id: 'sganom', nome: 'Anomalias', ic: 'anomalia', grp: 'Registros', mod: 'seguranca', sup: true, tela: 'SG' },
  { id: 'sgcartao', nome: 'Cartão Amarelo', ic: 'cartao', grp: 'Registros', mod: 'seguranca', sup: true, tela: 'SG' },
  // Inspeções de 5S, segurança e da área (telas/inspecoes.js; vieram do Campo do Meu painel). Não OK vira anomalia.
  { id: 'sginsp', nome: 'Inspeções', ic: 'lupa', grp: 'Registros', mod: 'seguranca', sup: true, tela: 'SG' },
  { id: 'sgtrein', nome: 'Treinamentos e ASO', ic: 'capacete', grp: 'Registros', mod: 'seguranca', sup: true, req: () => veTreinos(ME), tela: 'SG' },
  // ---- RH: cadastro dos colaboradores com as férias na ficha (colaboradores.js) e frequência (administrativo.js). Importar abre pela Folha de frequência ----
  { id: 'rcolab', nome: 'Colaboradores', ic: 'users', grp: 'Cadastro', mod: 'rh', req: temRH, tela: 'CO' },
  { id: 'afreq', nome: 'Folha de frequência', ic: 'freq', grp: 'Frequência', mod: 'rh', req: temRH },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'planilha', grp: 'Frequência', mod: 'rh', req: () => editaAdm(ME), fora: true, pai: 'afreq' },
  // ---- Indicadores: os painéis de todos os módulos, só para ver (acesso.indicadores, escolhido por pessoa em Usuários) ----
  // Cada aba usa os dados do escopo da pessoa (Pátio, Bateria, Equipamentos); o "Vê" com área no cadastro vê só a dele.
  // As telas são as mesmas de antes (vinham da Operação, Gestão, Segurança e RH): os ids não mudaram, então links
  // antigos e o que ficou salvo no aparelho caem aqui (ensureModulo leva para o módulo da aba).
  // Visão geral: os 8 indicadores do contrato com meta (telas/contrato.js); Histórico: 12 meses, com Excel.
  { id: 'ivisao', nome: 'Visão geral', ic: 'medidor', grp: 'Indicadores', mod: 'indicadores', req: indSets, tela: 'IC' },
  { id: 'painel', nome: 'Indicadores de atividades', ic: 'painel', grp: 'Indicadores', mod: 'indicadores', req: indSets, filtros: 'msa', conj: true },
  { id: 'resumo', nome: 'Resumos para imprimir', ic: 'print', grp: 'Indicadores', mod: 'indicadores', req: () => indSets() || indEq(), filtros: 'msa', fora: true, pai: 'painel' },
  { id: 'epainel', nome: 'Indicadores de equipamentos', ic: 'equip', grp: 'Indicadores', mod: 'indicadores', req: indEq, junto: 'ieq', tela: 'EQ' },
  { id: 'eanal', nome: 'Análises de equipamentos', ic: 'tendencia', grp: 'Indicadores', mod: 'indicadores', req: indEq, tela: 'EQ', junto: 'ieq' },
  { id: 'qpainel', nome: 'Indicadores da queda zero', ic: 'queda', grp: 'Indicadores', mod: 'indicadores', req: indSets, filtros: 'ma', conj: true },
  { id: 'sgpainel', nome: 'Indicadores da Segurança', ic: 'escudo', grp: 'Indicadores', mod: 'indicadores', req: indConj, tela: 'SG' },
  // Pessoas: frequência (dados do RH) e, para quem já tem as Fichas de acompanhamento na Gestão, os indicadores das fichas.
  { id: 'fpainel', nome: 'Indicadores da frequência', ic: 'percent', grp: 'Indicadores', mod: 'indicadores', req: indConj, junto: 'ipes' },
  { id: 'gpainel', nome: 'Indicadores das fichas', ic: 'ficha', grp: 'Indicadores', mod: 'indicadores', req: () => temFichas(ME), tela: 'GE', junto: 'ipes' },
  { id: 'fresumo', nome: 'Resumo da frequência', ic: 'texto', grp: 'Indicadores', mod: 'indicadores', req: indConj, fora: true, pai: 'fpainel' },
  { id: 'ihist', nome: 'Histórico dos indicadores', ic: 'tendencia', grp: 'Indicadores', mod: 'indicadores', req: indSets, tela: 'IC' },
  // ---- Administração: ajustes de todos os módulos. 'Completa' vê tudo; 'Dos módulos', só os dos módulos em que é Gestor ----
  // Conferência, Uso do plano, Erros e Limpeza abrem por botões no topo da Visão geral; Gerador de meses, no topo do Plano padrão.
  // Fotos (regras e arquivo), Fichas (tipos e importar) e Acessos (usuários e perfis) ocupam um lugar só no menu, com seletor no topo.
  { id: 'cfgeral', nome: 'Visão geral', ic: 'grade', grp: 'Geral', mod: 'administracao', ord: 1, req: () => isAdmin(), tela: 'CF' },
  { id: 'cfconf', nome: 'Conferência do cadastro', ic: 'lupa', grp: 'Geral', mod: 'administracao', ord: 1.2, req: () => isAdmin(), tela: 'CF', fora: true, pai: 'cfgeral' },
  { id: 'cfuso', nome: 'Uso do plano grátis', ic: 'medidor', grp: 'Geral', mod: 'administracao', ord: 1.4, req: () => isAdmin(), tela: 'CF', fora: true, pai: 'cfgeral' },
  { id: 'cferros', nome: 'Erros nos aparelhos', ic: 'celular', grp: 'Geral', mod: 'administracao', ord: 1.5, req: () => isAdmin(), tela: 'CF', fora: true, pai: 'cfgeral' },
  { id: 'cfhist', nome: 'Histórico de alterações', ic: 'relogio', grp: 'Geral', mod: 'administracao', ord: 1.55, req: () => isAdmin(), tela: 'CF', fora: true, pai: 'cfgeral' },
  { id: 'cflimpa', nome: 'Limpeza de dados', ic: 'lixo', grp: 'Geral', mod: 'administracao', ord: 1.6, req: () => isAdmin(), tela: 'CF', fora: true, pai: 'cfgeral' },
  // Processos e rotina (telas/processos.js): os processos do analista e a rotina do dia (era Processos do Meu painel).
  { id: 'cfproc', nome: 'Processos e rotina', ic: 'prog', grp: 'Geral', mod: 'administracao', ord: 1.8, req: () => isAdmin(), tela: 'PR' },
  // Documentos e OMs (telas/documentos.js): validade dos POP, PT, OS, ASO e OMs (era Campo do Meu painel). O Gestor e o
  // Coordenador da Gestão também veem (soReq: só o req decide, fora de Perfis e permissões).
  { id: 'cfdocs', nome: 'Documentos e OMs', ic: 'arquivo', grp: 'Geral', mod: 'administracao', ord: 1.85, req: () => veDocsU(ME), soReq: true, tela: 'DC' },
  { id: 'cffun', nome: 'Funções', ic: 'etiqueta', grp: 'Geral', mod: 'administracao', ord: 1.9, req: () => isAdmin(), tela: 'FN' },
  { id: 'cfescala', nome: 'Escalas e turnos', ic: 'turno', grp: 'Geral', mod: 'administracao', ord: 2, req: () => admDe('escala'), tela: 'CF' },
  { id: 'config', nome: 'Rotas e configurações', ic: 'rota', grp: 'Atividades', mod: 'administracao', ord: 3, req: () => admDe('ativ') },
  { id: 'plano', nome: 'Plano padrão', ic: 'plano', grp: 'Atividades', mod: 'administracao', ord: 4, req: () => admDe('ativ') },
  { id: 'gerador', nome: 'Gerador de meses', ic: 'gerador', grp: 'Atividades', mod: 'administracao', ord: 5, req: () => admDe('ativ'), fora: true, pai: 'plano' },
  { id: 'cffotos', nome: 'Fotos das atividades', ic: 'cam', grp: 'Atividades', mod: 'administracao', ord: 5.5, req: () => isAdmin(), tela: 'CF', junto: 'fotos' },
  { id: 'cfarqfotos', nome: 'Relatórios e arquivo de fotos', ic: 'arquivo', grp: 'Atividades', mod: 'administracao', ord: 5.6, req: () => isAdmin(), tela: 'CF', junto: 'fotos' },
  { id: 'econfig', nome: 'Equipamentos', ic: 'equip', grp: 'Equipamentos', mod: 'administracao', ord: 6, req: () => admDe('equip'), tela: 'EQ' },
  { id: 'gtipos', nome: 'Tipos de ocorrência', ic: 'etiqueta', grp: 'Fichas', mod: 'administracao', ord: 7, req: () => admDe('fichas'), tela: 'GE', junto: 'fichas' },
  { id: 'sgconfig', nome: 'Segurança', ic: 'escudo', grp: 'Segurança', mod: 'administracao', ord: 8.5, req: () => admDe('seg'), tela: 'SG' },
  { id: 'gimport', nome: 'Importar dados das fichas', ic: 'dl', grp: 'Fichas', mod: 'administracao', ord: 8, req: () => isAdmin(), tela: 'GE', junto: 'fichas' },
  { id: 'usuarios', nome: 'Usuários e acessos', ic: 'users', grp: 'Acesso', mod: 'administracao', ord: 9, req: () => isAdmin(), tela: 'CF', junto: 'acessos' },
  { id: 'perfis', nome: 'Perfis e permissões', ic: 'key', grp: 'Acesso', mod: 'administracao', ord: 10, req: () => isAdmin(), tela: 'CF', junto: 'acessos' }
];
// Subtítulo (topo) das abas de Equipamentos, fichas e Frequência.
export const SUB_E = {
  epainel: 'Produtividade da operação de equipamentos', elanc: 'Alocações do dia e paradas dos equipamentos',
  eequipe: 'Operadores, situação, frota e escala do mês', einsp: 'Checklist de 5S no equipamento e segurança', eaval: 'Notas do mês por operador',
  eanal: 'Evolução mensal e qualidade dos lançamentos', econfig: 'Turnos, metas, pesos, causas e feriados dos equipamentos'
};
export const SUB_G = {
  gpainel: 'Indicadores das fichas de acompanhamento',
  gcolab: 'Integração, ocorrências e assinaturas de cada colaborador',
  gimpr: 'Ficha (Folhas 1 e 2) e via de assinatura',
  gimport: 'Colaboradores e ocorrências a partir de uma planilha',
  gtipos: 'Tipos, texto padrão e o que vai para a Folha 1'
};
export const SUB_A = {
  rcolab: 'Cadastro único: dados, matrículas Dikma e Arcelor, área, rota, liderança e férias',
  afreq: 'Faltas, atestados e horas extras de 16 a 15, por grupo, e o efetivo enviado pelos líderes',
  aimport: 'Planilhas de frequência e de férias'
};
export const SUB_S = {
  sgtrein: 'NRs, ASO e outros treinamentos: quem está vencido, quem vence em 30 dias e importação por planilha',
  sginter: 'Registros de interação: riscos e desvios vistos em campo',
  sganom: 'O que pede atenção agora e a fila das anomalias: situação, responsável e prazo',
  sginsp: '5S, segurança e limpeza da área, com nota: o que estiver Não OK vira anomalia na fila',
  sgcartao: 'Direito ao Trabalho Seguro: cartões dados em campo e a validação do líder ou da segurança',
  sgpainel: 'Os números do mês, a evolução, as áreas e os treinamentos',
  sgconfig: 'Áreas, tipos de atividade, regimes e desvios dos formulários'
};
// Nome curto oficial de cada aba: o mesmo no menu lateral, na barra de baixo do celular e no "Mais". O título da tela usa o nome completo.
const CURTO = { gcolab: 'Fichas', sgtrein: 'Treinamentos', afreq: 'Frequência', esdia: 'Escala', esbal: 'Balanço', esdim: 'Efetivo', eshe: 'Horas extras', causas: 'Causas', etiquetas: 'Etiquetas', elanc: 'Lançamentos', eequipe: 'Equipe', einsp: 'Inspeções', eaval: 'Avaliação', eanal: 'Análises', resumo: 'Resumos', gimpr: 'Impressão', cfconf: 'Conferência', cfescala: 'Escalas', cfuso: 'Uso do plano', cferros: 'Erros', cflimpa: 'Limpeza', cfhist: 'Histórico', usuarios: 'Usuários', perfis: 'Perfis', aimport: 'Importar', gimport: 'Importar fichas', gtipos: 'Fichas', config: 'Rotas', plano: 'Plano padrão', gerador: 'Gerador de meses', cffotos: 'Fotos', cfarqfotos: 'Arquivo de fotos', sgpainel: 'Segurança', sgconfig: 'Segurança', fresumo: 'Resumo', fpainel: 'Pessoas', painel: 'Atividades', epainel: 'Equipamentos', eanal: 'Análises', qpainel: 'Queda zero', gpainel: 'Fichas', ivisao: 'Visão geral', ihist: 'Histórico', gmed: 'Medição', gtrat: 'Tratativas', cfproc: 'Processos', cfdocs: 'Documentos', oms: 'OMs' };
// Nome no seletor do topo das abas juntas (junto).
export const NOME_JUNTO = { esdia: 'Escala do dia', eshe: 'Horas extras', esjus: 'Justificativas', elanc: 'Lançamentos', eequipe: 'Equipe e frota', einsp: 'Inspeções', eaval: 'Avaliação mensal', eanal: 'Análises', usuarios: 'Usuários', perfis: 'Perfis', epainel: 'Indicadores', fpainel: 'Frequência', gpainel: 'Fichas', cffotos: 'Regras das fotos', cfarqfotos: 'Arquivo e relatórios', gtipos: 'Tipos de ocorrência', gimport: 'Importar planilha', esdim: 'Por rota', esbal: 'Balanço da semana' };
// Nome do seletor (leitor de tela) de cada grupo de abas juntas.
export const ROTULO_JUNTO = { ieq: 'Equipamentos', ipes: 'Pessoas', efetivo: 'Efetivo', fotos: 'Fotos', fichas: 'Fichas', horas: 'Horas e justificativas', opeq: 'Equipamentos', geeq: 'Equipamentos', acessos: 'Acessos' };
// Nome no menu das abas juntas: o mesmo, qualquer que seja a primeira que a pessoa vê.
const MENU_JUNTO = { ieq: 'Equipamentos', ipes: 'Pessoas', efetivo: 'Efetivo', fotos: 'Fotos', fichas: 'Fichas', horas: 'Horas e justificativas', opeq: 'Equipamentos', geeq: 'Equipamentos', acessos: 'Acessos' };
export const nomeCurto = v => (v && (MENU_JUNTO[v.junto] || CURTO[v.id] || v.nome)) || '';
// Os 6 módulos (seletor de módulo). key = mod das abas; inicio = aba que abre ao entrar no módulo.
export const MODS = {
  operacao: { nome: 'Operação', curto: 'Operação', sub: 'Apontar, Aprovação, Equipamentos e Efetivo', key: 'operacao', inicio: 'apontar' },
  gestao: { nome: 'Gestão', curto: 'Gestão', sub: 'Programação, Efetivo e Fichas de acompanhamento', key: 'gestao', inicio: 'prog' },
  // A Segurança abre em Anomalias (com o que pede atenção no topo); o painel foi para Indicadores.
  seguranca: { nome: 'Segurança', curto: 'Segurança', sub: 'Interações, anomalias, inspeções, Cartão Amarelo e treinamentos', key: 'seguranca', inicio: 'sganom' },
  rh: { nome: 'RH', curto: 'RH', sub: 'Colaboradores, frequência e férias', key: 'rh', inicio: 'afreq' },
  indicadores: { nome: 'Indicadores', curto: 'Indicadores', sub: 'Visão geral do contrato, atividades, equipamentos, queda zero, segurança, pessoas e histórico', key: 'indicadores', inicio: 'ivisao' },
  administracao: { nome: 'Administração', curto: 'Administração', sub: 'Configurações, usuários e perfis', key: 'administracao', inicio: 'cfgeral' }
};
// Itens do seletor de módulos: os módulos que a pessoa tem.
export const modsMenu = () => modsDe(ME);
export const mesmoItem = (a, b) => a === b;
export const subMod = m => MODS[m].sub;
// Abas do módulo aberto que esta pessoa vê (Avisos no celular vale em todos).
export const viewsDoModulo = () => {
  const m = UI.modulo;
  // Supervisor da área sem perfil na Segurança: vê as abas marcadas com sup (as anomalias e interações da área dele).
  const supSeg = m === 'seguranca' && !perfil('seguranca') && supConjs(ME).length > 0;
  const l = VIEWS.filter(v => (v.mod === m || v.mod === 'all') && (!v.req || v.req()) && (!v.reqU || v.reqU(ME)) && (supSeg ? !!v.sup : v.soReq || podeVer(ME, v, permCfg(), m)));
  return m === 'administracao' ? l.sort((a, b) => (a.ord || 0) - (b.ord || 0)) : l;
};
// Abas que aparecem no menu: sem as que abrem por botão de outra aba e, das juntas, só a primeira que a pessoa vê.
export const abasDoMenu = () => { const vs = new Set(); return viewsDoModulo().filter(v => !v.fora && (!v.junto || (!vs.has(v.junto) && vs.add(v.junto)))); };
// Abas juntas com esta (para o seletor do topo); vazio se não for junta ou se a pessoa só vê uma.
export const juntasDe = v => { if (!v || !v.junto) return []; const l = viewsDoModulo().filter(x => x.junto === v.junto); return l.length > 1 ? l : []; };
// Item do menu que fica marcado com esta aba aberta: a aba pai (Folha do líder → Programação) ou a junta que está no menu.
export function abaMarcada(id) {
  const v = VIEWS.find(x => x.id === id) || {};
  if (v.pai) return abaMarcada(v.pai);
  if (v.junto) { const m = abasDoMenu().find(x => x.junto === v.junto); if (m) return m.id; }
  return id;
}
// Abas que foram juntadas ou tiradas: links antigos, avisos do celular e o que ficou salvo no aparelho caem na aba nova.
const VIEW_NOVA = { cfpainel: 'cfproc', sgobra: 'sganom', gocorr: 'gcolab', gcontrole: 'gcolab', epar: 'elanc', apainel: 'afreq', relfoto: 'painel', escala: 'esdia', gcomigo: 'gcolab', gnovaoc: 'gcolab', aferias: 'rcolab' };
function normalizarView() {
  const v0 = UI.view; if (!VIEW_NOVA[v0]) return;
  UI.view = VIEW_NOVA[v0];
  if (v0 === 'gocorr' && UI.g) { UI.g.mat = null; UI.g.filtro = 'pend'; }
  if (v0 === 'gcomigo' && UI.g) { UI.g.mat = null; UI.g.filtro = 'comigo'; }
  if (v0 === 'epar' && UI.e) { UI.e.aba = 'par'; UI.e.pf = 'aberta'; }
  if (v0 === 'aferias' && UI.co) { UI.co.mat = null; UI.co.f = 'ferAgora'; }
}
// Em que módulo fica a aba (null = Avisos no celular, que existe em todos).
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
  if (!vs.some(v => v.id === UI.view)) UI.view = vs.some(v => v.id === MODS[UI.modulo].inicio) ? MODS[UI.modulo].inicio : (vs.find(v => !v.fora) || vs[0] || { id: MODS[UI.modulo].inicio }).id;
}
// Declaração da aba pelo id (vazio se não existir).
export const aba = id => VIEWS.find(v => v.id === id) || {};
// Filtros da aba: { mes, semana, area } (true = aparece no topo).
export const filtrosDe = id => { const f = aba(id).filtros || ''; return { mes: f.includes('m'), semana: f.includes('s'), area: f.includes('a') }; };
// Barra de baixo (celular): até 4 atalhos do módulo + Mais, na ordem de uso. Nome e ícone são os do menu lateral.
const BARRA = {
  operacao: () => (aprovador() && !isAdmin() ? ['apontar', 'aprovar', 'pend', 'esdia', 'elanc'] : ['apontar', 'pend', 'esdia', 'elanc', 'eequipe', 'einsp']),
  gestao: () => ['prog', 'gtrat', 'gcolab', 'causas', 'esdim', 'eaval'],
  seguranca: () => ['sganom', 'sginter', 'sginsp', 'sgcartao', 'sgtrein'],
  rh: () => ['rcolab', 'afreq'],
  indicadores: () => ['ivisao', 'painel', 'epainel', 'qpainel', 'sgpainel', 'fpainel', 'gpainel'],
  administracao: () => ['cfgeral', 'cfescala', 'usuarios', 'config', 'plano', 'econfig', 'gtipos', 'cffotos']
};
export function barraDe() {
  const menu = abasDoMenu();
  const lista = (BARRA[UI.modulo] || BARRA.administracao)().map(id => menu.find(v => v.id === id)).filter(Boolean).slice(0, 4);
  return [...lista.map(v => [v.id, '', v.ic]), ['__more', 'Mais', 'more']];
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

// Da ficha de acompanhamento (Gestão) para o cadastro da mesma pessoa (RH › Colaboradores), e de volta.
function abrirEm(mod, view, ajustar) {
  if (!modsDe(ME).includes(mod)) return;
  UI.modulo = mod; UI.modOpen = false; UI.confirm = null; UI.more = 0; aplicarSet(); UI.view = view; ajustar();
  salvarUI(); trocarTela(view);
}
acoes.irCadastro = (t, d) => abrirEm('rh', 'rcolab', () => { UI.co.mat = d.mat || null; UI.co.aba = 'dados'; });
acoes.irFicha = (t, d) => abrirEm('gestao', 'gcolab', () => { UI.g.mat = d.mat || null; });
