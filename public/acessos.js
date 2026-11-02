// Dikma Gestão — acesso por módulo (Operação, Gestão, Segurança, RH e Administração) e férias em comum.
// Cada pessoa tem um perfil em cada módulo que usa (campo acesso em usuarios/{uid}) e os escopos (Pátio, Bateria,
// Equipamentos). As telas usam o perfil DO MÓDULO em que estão (perfilDe) e as regras do Firestore fazem a mesma conta.
// Cadastro antigo (papel único + modulos) ainda é lido: acessoDe converte na hora (acessoDoLegado).
// Este arquivo não usa o Firestore: as contas são testadas em testes/acessos.test.mjs e usadas pela rotina
// integracao/admin/converter-acessos.mjs.
import { normNome } from './planilhas-adm.js';

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

// ---- Acesso por módulo ----
// Modelo no cadastro usuarios/{uid}:
//   acesso  = { operacao?: perfil, gestao?: perfil, seguranca?: perfil, rh?: perfil, administracao?: 'admin' | 'modulo' }
//   escopos = parte de ['patio', 'bateria', 'equipamentos'] (conjuntos usados dentro da Operação e da Gestão)
// As áreas continuam em area/area2 (líder 1, supervisor até 2; gestor e coordenador todas) e as exceções em abas.
// As Fichas de acompanhamento (Gestão) continuam marcadas como 'gestao' no campo antigo modulos.
// A tela Usuários ainda grava também os campos antigos (papel, modulos), tirados do acesso (legadoDoAcesso): as regras
// os usam como alternativa para cadastros que ainda não têm o acesso por módulo.
export const MODULOS_ACESSO = [
  { k: 'operacao', nome: 'Operação', sub: 'Apontar, Aprovação, Pendências, Equipamentos e Efetivo', perfis: ['lider', 'supervisor', 'coordenador', 'gestor', 'leitor'] },
  { k: 'gestao', nome: 'Gestão', sub: 'Programação, Fichas, Dimensionamento, Indicadores e Resumos', perfis: ['lider', 'supervisor', 'coordenador', 'gestor', 'administrativo', 'leitor'] },
  { k: 'seguranca', nome: 'Segurança', sub: 'Registros de interação e de anomalia (em construção)', perfis: ['registra', 'trata', 'gestor', 'leitor'] },
  { k: 'rh', nome: 'RH', sub: 'Frequência, Férias e Importar planilhas', perfis: ['administrativo', 'leitor'] },
  { k: 'administracao', nome: 'Administração', sub: 'Configurações, Usuários e Perfis', perfis: ['admin', 'modulo'] }
];
export const MODULO_ACESSO = Object.fromEntries(MODULOS_ACESSO.map(m => [m.k, m]));
export const ESCOPOS = [['patio', 'Pátio'], ['bateria', 'Bateria'], ['equipamentos', 'Equipamentos']];
export const PERFIL_NOME = { lider: 'Líder', supervisor: 'Supervisor', coordenador: 'Coordenador', gestor: 'Gestor', administrativo: 'Administrativo', leitor: 'Somente leitura', registra: 'Registra', trata: 'Trata', admin: 'Completa', modulo: 'Dos módulos' };
export const perfilNome = (mod, p) => (mod === 'administracao' ? { admin: 'Completa (administrador)', modulo: 'Só dos módulos (gestor)' }[p] : PERFIL_NOME[p]) || p;
// Ordem usada para escolher o papel antigo (único) a partir dos perfis de cada módulo.
export const ORDEM_PAPEL = ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'];
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


// Caminho inverso (gravação dupla da transição): { acesso, escopos } → campos antigos que as telas e as regras de
// hoje leem. extras = { fichas (padrão: sim, se tem Gestão), area, area2, bloqueado }.
// Devolve { papel, modulos, acessos, area, area2 }.
export function legadoDoAcesso(acesso, escopos, extras = {}) {
  const a = acesso || {}; const esc = new Set(escopos || []);
  const area = extras.area || null, area2 = extras.area2 || null;
  if (a.administracao === 'admin') return { papel: extras.bloqueado ? 'bloqueado' : 'admin', modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'], acessos: ['operacao'], area: null, area2: null };
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
  // A área vale para quem é líder ou supervisor em algum módulo (Operação ou Gestão); a 2ª, para quem é supervisor.
  const pm = [a.operacao, a.gestao];
  const comArea = pm.some(p => ['lider', 'supervisor'].includes(p)) || ['lider', 'supervisor'].includes(papel);
  const comArea2 = pm.includes('supervisor') || papel === 'supervisor';
  return { papel, modulos, acessos: ['operacao'], area: comArea ? area : null, area2: comArea2 ? area2 : null };
}
// O acesso do usuário: o modelo novo, se já foi gravado; senão, o que a conversão faria (convertido: false).
export function acessoDe(u) {
  if (u && u.acesso && typeof u.acesso === 'object') return { acesso: { ...u.acesso }, escopos: Array.isArray(u.escopos) ? [...u.escopos] : [], fichas: modulosDe(u).includes('gestao') || u.papel === 'admin', convertido: true };
  return { ...acessoDoLegado(u), convertido: false };
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
export const ehAdminU = u => !!u && u.papel !== 'bloqueado' && (u.papel === 'admin' || acessoMemo(u).acesso.administracao === 'admin');
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
// RH: Frequência e férias (ler) e quem edita (Administrativo; somente leitura só consulta).
export const temFreq = u => !!perfilDe(u, 'rh');
export const editaAdm = u => ['admin', 'administrativo'].includes(perfilDe(u, 'rh'));
// A pessoa "vista" dentro de um módulo: o mesmo cadastro com o papel trocado pelo perfil daquele módulo. Serve para as
// contas que recebem o usuário (fichas por área, Meu dia, telas carregadas sob demanda) usarem o perfil certo.
const VISTA = new WeakMap();
export function usuarioEm(u, mod) {
  if (!u) return u;
  const p = perfilDe(u, mod) || 'sem';
  const k = [u.papel, u.area, u.area2, u.nome, u.trocarSenha].join('|');
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
