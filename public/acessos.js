// Dikma Gestão — acessos (portas de entrada do sistema) e férias em comum entre eles.
// Operação: Atividades Pátio e Bateria, Operação de equipamentos e Efetivo (o que já existia).
// Administrativo: Frequência (folha de 16 a 15) e Férias.
// Administração do sistema: ajustes de todo o sistema, só o administrador.
// Cada acesso pede usuário e senha. Quem pode entrar em cada um fica em usuarios/{uid}.acessos.
import { normNome } from './planilhas-adm.js';

export const ACESSOS = [
  { k: 'operacao', nome: 'Operação', sub: 'Atividades, equipamentos e efetivo', inicio: 'meudia' },
  { k: 'administrativo', nome: 'Administrativo', sub: 'Frequência e férias', inicio: 'apainel' },
  { k: 'sistema', nome: 'Administração do sistema', sub: 'Ajustes de todo o sistema · só o administrador', inicio: 'cfgeral' }
];
export const ACESSO = Object.fromEntries(ACESSOS.map(a => [a.k, a]));
// Sem o campo acessos (usuários antigos), a pessoa entra só na Operação. O administrador entra em todos.
export const acessosDe = u => (!u ? [] : u.papel === 'admin' ? ACESSOS.map(a => a.k) : (Array.isArray(u.acessos) ? u.acessos : ['operacao']).filter(k => k === 'operacao' || k === 'administrativo'));
export const podeAcesso = (u, k) => acessosDe(u).includes(k);
// Quem edita no Administrativo (somente leitura só consulta).
export const editaAdm = u => podeAcesso(u, 'administrativo') && u.papel !== 'leitor';

// ---- Férias: uma conta só para Operação, Administrativo, Meu dia e avisos ----
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
