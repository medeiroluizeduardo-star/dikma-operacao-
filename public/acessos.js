// Dikma Gestão — acessos (portas de entrada do sistema) e férias em comum.
// Operação: Atividades Pátio e Bateria, Operação de equipamentos, Efetivo e Frequência e férias (módulos marcados no usuário).
// Administração do sistema: ajustes de todo o sistema, só o administrador.
// O antigo acesso "Administrativo" virou o módulo Frequência e férias dentro da Operação: quem tinha o acesso
// marcado (campo acessos com 'administrativo') continua entrando e passa a ter o módulo.
import { normNome } from './planilhas-adm.js';

export const ACESSOS = [
  { k: 'operacao', nome: 'Operação', sub: 'Atividades, equipamentos, efetivo, frequência e férias', inicio: 'meudia' },
  { k: 'sistema', nome: 'Administração do sistema', sub: 'Ajustes de todo o sistema · só o administrador', inicio: 'cfgeral' }
];
export const ACESSO = Object.fromEntries(ACESSOS.map(a => [a.k, a]));
const antigoAdm = u => Array.isArray(u.acessos) && u.acessos.includes('administrativo');
export const acessosDe = u => (!u ? [] : u.papel === 'admin' ? ACESSOS.map(a => a.k) : ['operacao']);
export const podeAcesso = (u, k) => acessosDe(u).includes(k === 'administrativo' ? 'operacao' : k);
// Módulo Frequência e férias: marcado no usuário (modulos) ou o antigo acesso Administrativo.
// O perfil Administrativo já tem o módulo, mesmo sem marcar.
export const temFreq = u => !!u && (u.papel === 'admin' || u.papel === 'administrativo' || (Array.isArray(u.modulos) && u.modulos.includes('frequencia')) || antigoAdm(u));
// Módulos do usuário (os marcados); usuário antigo só do Administrativo não ganha a Operação sem querer.
export const modulosDe = u => {
  if (!u) return [];
  const m = Array.isArray(u.modulos) && u.modulos.length ? [...u.modulos] : antigoAdm(u) && !u.acessos.includes('operacao') ? [] : ['operacao'];
  if (temFreq(u) && !m.includes('frequencia')) m.push('frequencia');
  return m;
};
// Quem edita a Frequência e as Férias (somente leitura só consulta).
export const editaAdm = u => temFreq(u) && u.papel !== 'leitor';

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
