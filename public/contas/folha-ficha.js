// Dikma Gestão — grupos da Frequência tirados das fichas (Gestão › Colaboradores), sem tela e sem banco.
// A ficha é a base única: o grupo de cada pessoa é "LIDER <líder imediato da ficha> - SUPERVISÃO <líder imediato
// da ficha desse líder>". Trocou o líder na ficha, a pessoa muda de grupo na Frequência na hora.
// Quem entra na folha do conjunto (Pátio ou Bateria):
//   1) todos da Presença do dia do conjunto (Atividades), com a mesma presença de lá;
//   2) quem está na folha (vindo da planilha) e não está na Presença de nenhum conjunto (gestão, apoio…).
// A ligação entre folha, ficha e Presença é pela matrícula; só quando um dos lados não tem matrícula vale o nome
// idêntico (sem acento e maiúsculas). Nada de nome "parecido".
import { normNome, canonLideres } from './planilhas-adm.js';
import { nomeLider, chaveLider, mesmoComeco } from './lideres.js';

export const SEM_FICHA = 'SEM FICHA EM COLABORADORES';
export const SEM_LIDER = 'SEM LÍDER NA FICHA';
// A partir desta folha (16/10 a 15/11/2026) os grupos vêm das fichas; as folhas anteriores ficam como foram fechadas.
export const COMP_FICHA = '2026-11';
export const folhaPelaFicha = comp => String(comp || '') >= COMP_FICHA;

const mat = x => (x && x.mat != null && String(x.mat).trim() !== '' ? String(x.mat).replace(/\.0$/, '').trim() : '');

// Índice "mesma pessoa": matrícula; sem matrícula em um dos lados, nome idêntico.
function indice(lista) {
  const m = new Map(), n = new Map();
  for (const x of lista || []) { const k = mat(x); if (k && !m.has(k)) m.set(k, x); const nn = normNome(x.nome); if (nn && !n.has(nn)) n.set(nn, x); }
  return x => { const k = mat(x); if (k && m.has(k)) return m.get(k); const y = n.get(normNome(x.nome)); return y && (!k || !mat(y)) ? y : null; };
}

// Nome do grupo de cada ficha: líder (grafias parecidas viram uma só) e a supervisão (líder da ficha do líder).
// Líder imediato e supervisor imediato (= líder da ficha do líder) de cada ficha: { lider, sup } ('' quando não há).
export function criarLiderancaDaFicha(fichas) {
  const F = (fichas || []).filter(f => f && f.nome);
  const canon = canonLideres(F.map(f => f.lider).filter(Boolean), F);
  const memo = new Map();
  const fichaDoLider = lid => { // ficha do próprio líder: nome igual ou começando igual (YURI SILVA → YURI SILVA SANTOS); só se for uma
    const k = chaveLider(lid); const ig = F.filter(f => chaveLider(f.nome) === k); if (ig.length === 1) return ig[0];
    const c = F.filter(f => mesmoComeco(f.nome, lid) && chaveLider(f.nome).startsWith(k + ' ')); return c.length === 1 ? c[0] : null;
  };
  return f => {
    const l = nomeLider(f && f.lider); if (!l) return { lider: '', sup: '' };
    const lid = canon.grafia(l); if (memo.has(lid)) return memo.get(lid);
    const fl = fichaDoLider(lid); const s = fl && nomeLider(fl.lider) ? canon.grafia(nomeLider(fl.lider)) : '';
    const r = { lider: lid, sup: s && chaveLider(s) !== chaveLider(lid) ? s : '' };
    memo.set(lid, r); return r;
  };
}
export function criarGrupoDaFicha(fichas) {
  const ld = criarLiderancaDaFicha(fichas);
  return f => {
    if (!f) return SEM_FICHA;
    const { lider, sup } = ld(f); if (!lider) return SEM_LIDER;
    return `LIDER ${lider}${sup ? ' - SUPERVISÃO ' + sup : ''}`;
  };
}

// fichas: gcolab (Gestão › Colaboradores) · colabs: Presença do dia deste conjunto · outros: dos demais conjuntos
// folha: grupos gravados da folha (planilha) · ini: 1º dia da folha · desligadoEm(p): data de desligamento ('' se ativo)
// Volta [{ nome, turno, auto: true, pessoas: [...] }] na ordem do nome, com "sem líder" e "sem ficha" no fim.
// Cada pessoa: { k, nome, mat, turma, obs, notas, ativ, desligado, turno, semFicha }. k é a chave dos lançamentos
// antigos da folha (quando a pessoa estava nela), para nada do histórico se perder.
export function gruposPelaFicha({ fichas = [], colabs = [], outros = [], folha = [], ini = '', desligadoEm = () => '', letra = s => s || '' }) {
  const fichaDe = indice(fichas), grupoDe = criarGrupoDaFicha(fichas);
  const daFolha = []; for (const g of folha || []) for (const p of g.pessoas || []) daFolha.push({ p, turno: !!g.turno });
  const ids = new Map((colabs || []).map(c => [c.id, c]));
  const naFolha = indice(daFolha.map(x => ({ nome: x.p.nome, mat: x.p.mat, x })));
  const usadas = new Set(); const out = [];
  const fora = p => { const d = desligadoEm(p); return !!d && !!ini && d <= ini; };
  for (const c of colabs || []) {
    const f = fichaDe(c); const pessoa = { nome: (f && f.nome) || c.nome, mat: mat(c) || mat(f) };
    // a mesma pessoa na folha: pela ligação já gravada (p.ativ) ou pela matrícula
    const ff = daFolha.find(x => x.p.ativ === c.id && !usadas.has(x)) || (naFolha(pessoa) || {}).x;
    const fp = ff && !usadas.has(ff) ? ff : null; if (fp) usadas.add(fp);
    const p = { k: fp ? fp.p.k : 'at:' + c.id, nome: pessoa.nome, mat: pessoa.mat, turma: letra(c.turma) || (fp && letra(fp.p.turma)) || '', obs: (fp && fp.p.obs) || '', notas: (fp && fp.p.notas) || [], ativ: c.id, desligado: (fp && fp.p.desligado) || null, turno: fp ? fp.turno : null, semFicha: !f };
    if (fora(p)) continue;
    out.push({ g: grupoDe(f), p });
  }
  const outrosDe = indice(outros || []);
  for (const x of daFolha) {
    if (usadas.has(x)) continue;
    if (x.p.ativ && ids.has(x.p.ativ)) continue; // já entrou acima
    if (outrosDe(x.p)) continue; // está na Presença do outro conjunto: a frequência dele é lá
    const f = fichaDe(x.p);
    const p = { k: x.p.k, nome: (f && f.nome) || x.p.nome, mat: mat(x.p) || mat(f), turma: letra(x.p.turma) || '', obs: x.p.obs || '', notas: x.p.notas || [], ativ: null, desligado: x.p.desligado || null, turno: x.turno, semFicha: !f };
    if (fora(p)) continue;
    usadas.add(x); out.push({ g: grupoDe(f), p });
  }
  const por = new Map();
  for (const { g, p } of out) { if (!por.has(g)) por.set(g, []); por.get(g).push(p); }
  const ordem = n => (n === SEM_FICHA ? 2 : n === SEM_LIDER ? 1 : 0);
  return [...por.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]) || a[0].localeCompare(b[0]))
    .map(([nome, ps]) => ({ nome, turno: ps.some(p => p.turno), auto: true, pessoas: ps.sort((a, b) => a.nome.localeCompare(b.nome)) }));
}
