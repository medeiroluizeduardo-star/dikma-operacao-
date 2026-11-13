// Dikma Gestão — acesso por módulo (Operação, Gestão, Segurança, RH e Administração) e férias em comum.
// Cada pessoa tem um perfil em cada módulo que usa (campo acesso em usuarios/{uid}) e os escopos (Pátio, Bateria,
// Equipamentos). As telas usam o perfil DO MÓDULO em que estão (perfilDe) e as regras do Firestore fazem a mesma conta.
// Só vale o acesso por módulo: cadastro sem o campo acesso não tem acesso a nenhum módulo.
// Este arquivo não usa o Firestore: as contas são testadas em testes/acessos.test.mjs e usadas também pela rotina
// dos avisos (integracao/avisos/planejar.mjs).
import { normNome } from './planilhas-adm.js';

// ---- Acesso por módulo ----
// Modelo no cadastro usuarios/{uid}:
//   acesso  = { operacao?: perfil, gestao?: perfil, seguranca?: perfil, rh?: perfil, administracao?: 'admin' | 'modulo' }
//   escopos = parte de ['patio', 'bateria', 'equipamentos'] (conjuntos usados dentro da Operação e da Gestão)
// Áreas: líder 1 (area); supervisor quantas precisar (lista areas; area e area2 guardam as duas primeiras, para quem
// ainda lê os campos antigos); gestor e coordenador todas. As exceções ficam em abas.
// Do cadastro antigo ficam só: papel (qualquer perfil = ativo; 'bloqueado' = sem acesso) e 'gestao' em modulos
// (= Gestão com as Fichas de acompanhamento). A tela Usuários ainda grava os campos antigos tirados do acesso
// (legadoDoAcesso); a rotina dos avisos e as telas não usam mais o papel único para dar permissão.
export const MODULOS_ACESSO = [
  { k: 'operacao', nome: 'Operação', sub: 'Apontar, Aprovação, Pendências, Equipamentos e Efetivo', perfis: ['lider', 'supervisor', 'tecnico', 'coordenador', 'gestor', 'leitor'] },
  { k: 'gestao', nome: 'Gestão', sub: 'Programação, Fichas, Dimensionamento, Indicadores e Resumos', perfis: ['lider', 'supervisor', 'coordenador', 'gestor', 'administrativo', 'leitor'] },
  { k: 'seguranca', nome: 'Segurança', sub: 'Registros de interação e de anomalia, fila de anomalias e painel', perfis: ['registra', 'trata', 'gestor', 'leitor'] },
  { k: 'rh', nome: 'RH', sub: 'Frequência, Férias e Importar planilhas', perfis: ['administrativo', 'leitor'] },
  { k: 'administracao', nome: 'Administração', sub: 'Configurações, Usuários e Perfis', perfis: ['admin', 'modulo'] }
];
export const MODULO_ACESSO = Object.fromEntries(MODULOS_ACESSO.map(m => [m.k, m]));
export const ESCOPOS = [['patio', 'Pátio'], ['bateria', 'Bateria'], ['equipamentos', 'Equipamentos']];
export const PERFIL_NOME = { lider: 'Líder', supervisor: 'Supervisor', tecnico: 'Técnico de Processo', coordenador: 'Coordenador', gestor: 'Gestor', administrativo: 'Administrativo', leitor: 'Somente leitura', registra: 'Registra', trata: 'Trata', admin: 'Completa', modulo: 'Dos módulos' };
export const perfilNome = (mod, p) => (mod === 'administracao' ? { admin: 'Completa (administrador)', modulo: 'Só dos módulos (gestor)' }[p] : PERFIL_NOME[p]) || p;
// Ordem usada para escolher o papel antigo (único) a partir dos perfis de cada módulo.
export const ORDEM_PAPEL = ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'];

// { acesso, escopos } → campos antigos que ainda são gravados junto (papel = ativo/bloqueado, modulos = Fichas).
// extras = { fichas (padrão: sim, se tem Gestão), areas (lista) ou area/area2 (cadastro antigo), bloqueado }.
// Devolve { papel, modulos, acessos, area, area2, areas }.
export function legadoDoAcesso(acesso, escopos, extras = {}) {
  const a = acesso || {}; const esc = new Set(escopos || []);
  const lista = areasDoCadastro(extras, true);
  if (a.administracao === 'admin') return { papel: extras.bloqueado ? 'bloqueado' : 'admin', modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'], acessos: ['operacao'], area: null, area2: null, areas: [] };
  // Papel antigo = o perfil mais alto entre os módulos (Segurança fica de fora: não existe no modelo antigo).
  const cands = [a.operacao, a.gestao, a.rh, a.administracao === 'modulo' ? 'gestor' : null].filter(Boolean);
  let papel = ORDEM_PAPEL.find(p => cands.includes(p)) || 'leitor';
  const modulos = [];
  // Pátio e Bateria valem para a Operação e para a Gestão (hoje as duas vêm juntas no módulo de Atividades).
  const opOuGe = !!(a.operacao || a.gestao);
  if (opOuGe && esc.has('patio')) modulos.push('operacao');
  if (opOuGe && esc.has('bateria')) modulos.push('bateria');
  if (opOuGe && esc.has('equipamentos')) modulos.push('equipamentos');
  if (a.gestao && extras.fichas !== false) modulos.push('gestao');
  if (a.rh) modulos.push('frequencia');
  // Sem nenhum módulo de hoje (ex.: só Segurança): marca que nenhuma tela reconhece, para não cair no padrão
  // antigo (sem modulos = Atividades Pátio).
  if (!modulos.length) modulos.push('seguranca');
  if (extras.bloqueado) papel = 'bloqueado';
  // A área vale para quem é líder ou supervisor em algum módulo (Operação ou Gestão); as outras, para quem é supervisor.
  const pm = [a.operacao, a.gestao];
  const comArea = pm.some(p => ['lider', 'supervisor'].includes(p)) || ['lider', 'supervisor'].includes(papel);
  const comVarias = pm.includes('supervisor') || papel === 'supervisor';
  const areas = comVarias ? lista : comArea ? lista.slice(0, 1) : [];
  return { papel, modulos, acessos: ['operacao'], area: areas[0] || null, area2: comVarias ? areas[1] || null : null, areas };
}
// Áreas de um cadastro: a area e, para o supervisor (sup), também area2 e a lista areas (sem repetir). As telas, a
// rotina dos avisos e as regras do banco fazem a mesma conta.
export const areasDoCadastro = (u, sup) => (!u ? [] : [...new Set([u.area, ...(sup ? [u.area2, ...(Array.isArray(u.areas) ? u.areas : [])] : [])].filter(Boolean))]);
// O acesso do usuário (campos acesso e escopos). Sem o campo acesso: nenhum módulo (convertido: false).
// fichas = 'gestao' em modulos (o administrador tem sempre).
export function acessoDe(u) {
  if (u && u.acesso && typeof u.acesso === 'object') return { acesso: { ...u.acesso }, escopos: Array.isArray(u.escopos) ? [...u.escopos] : [], fichas: (Array.isArray(u.modulos) && u.modulos.includes('gestao')) || u.acesso.administracao === 'admin', convertido: true };
  return { acesso: {}, escopos: [], fichas: false, convertido: false };
}
// ---- Perfil por módulo (o que as telas usam) ----
// Guardado por cadastro (o objeto do usuário) enquanto acesso, escopos, papel e modulos não mudam: as telas
// perguntam o perfil muitas vezes a cada desenho.
const MEMO = new WeakMap();
function acessoMemo(u) {
  const m = MEMO.get(u);
  if (m && m.a === u.acesso && m.e === u.escopos && m.p === u.papel && m.m === u.modulos) return m.r;
  const r = acessoDe(u); MEMO.set(u, { a: u.acesso, e: u.escopos, p: u.papel, m: u.modulos, r }); return r;
}
// Administrador (Administração completa): pode tudo em todos os módulos.
export const ehAdminU = u => !!u && u.papel !== 'bloqueado' && acessoMemo(u).acesso.administracao === 'admin';
// Perfil da pessoa no módulo (operacao, gestao, seguranca, rh, administracao). 'admin' = administrador (tudo);
// null = sem acesso ao módulo. Bloqueado não tem perfil em nada.
export function perfilDe(u, mod) {
  if (!u || u.papel === 'bloqueado') return null;
  if (ehAdminU(u)) return 'admin';
  return acessoMemo(u).acesso[mod] || null;
}
// Escopos (Pátio, Bateria, Equipamentos); o administrador tem todos.
export const escoposDe = u => (!u || u.papel === 'bloqueado' ? [] : ehAdminU(u) ? ['patio', 'bateria', 'equipamentos'] : acessoMemo(u).escopos);
// Gestão com as Fichas de acompanhamento.
export const temFichasU = u => !!u && (ehAdminU(u) || (!!perfilDe(u, 'gestao') && acessoMemo(u).fichas));
// Marcas no formato antigo, tiradas do acesso (operacao = Pátio, bateria, equipamentos, gestao = fichas,
// frequencia = RH). Usadas para saber que dados carregar e nas contas que não dependem do perfil.
export function marcasDe(u) {
  if (!u || u.papel === 'bloqueado') return [];
  if (ehAdminU(u)) return ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'];
  const e = escoposDe(u); const opGe = !!(perfilDe(u, 'operacao') || perfilDe(u, 'gestao')); const l = [];
  if (opGe && e.includes('patio')) l.push('operacao');
  if (opGe && e.includes('bateria')) l.push('bateria');
  if (opGe && e.includes('equipamentos')) l.push('equipamentos');
  if (temFichasU(u)) l.push('gestao');
  if (perfilDe(u, 'rh')) l.push('frequencia');
  return l;
}
// Histórico de alterações: cada registro guarda o módulo (mod). O administrador vê tudo, também os registros antigos,
// sem módulo; o gestor de cada módulo vê só o do módulo dele (no RH, que não tem Gestor, o Administrativo). As
// alterações da Administração (usuários, perfis, escalas, limpeza) ficam só com o administrador. firestore.rules faz a
// mesma conta (veHist).
export const MODS_HIST = ['operacao', 'gestao', 'seguranca', 'rh', 'administracao'];
export const GESTOR_HIST = { operacao: 'gestor', gestao: 'gestor', seguranca: 'gestor', rh: 'administrativo' };
export const NOME_MOD_HIST = { operacao: 'Operação', gestao: 'Gestão', seguranca: 'Segurança', rh: 'RH', administracao: 'Administração' };
// Módulos cujo histórico a pessoa vê (o administrador: todos).
export const modsHistorico = u => (ehAdminU(u) ? [...MODS_HIST] : Object.keys(GESTOR_HIST).filter(m => perfilDe(u, m) === GESTOR_HIST[m]));
export const veHistorico = u => modsHistorico(u).length > 0;
// RH: Frequência e férias (ler) e quem edita (Administrativo; somente leitura só consulta).
export const temFreq = u => !!perfilDe(u, 'rh');
export const editaAdm = u => ['admin', 'administrativo'].includes(perfilDe(u, 'rh'));
// A pessoa "vista" dentro de um módulo: o mesmo cadastro com o papel trocado pelo perfil daquele módulo. Serve para as
// contas que recebem o usuário (fichas por área, Meu dia, telas carregadas sob demanda) usarem o perfil certo.
const VISTA = new WeakMap();
export function usuarioEm(u, mod) {
  if (!u) return u;
  const p = perfilDe(u, mod) || 'sem';
  const k = [u.papel, u.area, u.area2, (u.areas || []).join(','), u.nome, u.trocarSenha].join('|');
  let c = VISTA.get(u); if (!c || c.a !== u.acesso || c.e !== u.escopos || c.m !== u.modulos || c.abas !== u.abas || c.k !== k) { c = { a: u.acesso, e: u.escopos, m: u.modulos, abas: u.abas, k, v: {} }; VISTA.set(u, c); }
  const x = c.v[mod]; if (x && x.papel === p) return x;
  return (c.v[mod] = { ...u, papel: p, modulos: marcasDe(u), area2: u.area2 });
}

// Selos curtos da lista de usuários: [['Operação', 'Líder'], ['Gestão', 'Supervisor'], ...]
export const selosAcesso = acesso => MODULOS_ACESSO.filter(m => acesso && acesso[m.k]).map(m => [m.nome, PERFIL_NOME[acesso[m.k]] || acesso[m.k], m.k]);

// ---- Férias: uma conta só para Operação, Frequência, Meu dia e avisos ----
// itens: [{ mat, nome, inicio, termino }] · devolve (pessoa {mat?, nome}, data AAAA-MM-DD) → férias que cobrem o dia, ou null
export function indiceFerias(itens) {
  const porMat = new Map(), porNome = new Map();
  for (const f of itens || []) {
    if (!f.inicio || !f.termino) continue;
    if (f.mat) { const l = porMat.get(String(f.mat)) || []; l.push(f); porMat.set(String(f.mat), l); }
    const k = normNome(f.nome); const l = porNome.get(k) || []; l.push(f); porNome.set(k, l);
  }
  return (p, dt) => {
    if (!p) return null;
    const l = (p.mat && porMat.get(String(p.mat))) || porNome.get(normNome(p.nome)) || [];
    return l.find(f => f.inicio <= dt && dt <= f.termino) || null;
  };
}

// Resumo das férias lido por todos (adm/feriasAtivas): de 2 meses antes a 6 meses depois de hoje.
// Refeito ao salvar férias e, todo dia, pela rotina do GitHub (integracao/avisos), para não ficar velho.
export function resumoFerias(lista, hoje) {
  const [y, m] = hoje.slice(0, 7).split('-').map(Number);
  const mes = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const ini = mes(-2) + '-01', fim = mes(6) + '-31';
  return (lista || []).filter(f => f.inicio && f.termino && f.termino >= ini && f.inicio <= fim).map(f => ({ mat: f.mat || '', nome: f.nome, inicio: f.inicio, termino: f.termino }));
}

// ---- Desligamento: a data de demissão da ficha (Efetivo) vale como DS automático em todos os módulos ----
// fichas: [{ mat, nome, dem }] · devolve (pessoa {mat?, nome}) → data de demissão ('' quando não tem)
export function indiceDesligados(fichas) {
  const porMat = new Map(), porNome = new Map();
  for (const f of fichas || []) {
    if (!f || !f.dem) continue;
    if (f.mat) porMat.set(String(f.mat), f.dem);
    const k = normNome(f.nome); if (k && !porNome.has(k)) porNome.set(k, f.dem);
  }
  return p => {
    if (!p) return '';
    if (p.mat && porMat.has(String(p.mat))) return porMat.get(String(p.mat));
    return porNome.get(normNome(p.nome)) || '';
  };
}
// Resumo dos desligamentos lido por todos (adm/desligados), gravado pela rotina do GitHub a partir das fichas
export const resumoDesligados = fichas => (fichas || []).filter(f => f && f.dem && f.nome).map(f => ({ mat: f.mat || '', nome: f.nome, dem: f.dem }))
  .sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
