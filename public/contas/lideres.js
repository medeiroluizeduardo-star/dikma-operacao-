// Dikma Gestão — trocar e renomear líder (sem dependência de tela nem de banco).
// Usado em Gestão › Fichas › Líderes e na rotina do GitHub integracao/admin/trocar-lider.mjs (mesma conta nos dois).
// Onde o líder fica guardado:
//   fichas      gcolab/{ÁREA}.itens[].lider            (é daqui que a Escala do dia tira o "Agrupar por: Líder")
//   folha       freqcomp/{conjunto|competência}.grupos[].nome  "[PREFIXO -] LIDER <nome> - SUPERVISÃO <nome>"
//   ocorrências gocorr.lider (responsável Dikma) e gocorr.recolhe (quem recolhe a assinatura)
import { normNome, partesGrupo } from './planilhas-adm.js';

// Nome do líder como é gravado: maiúsculas, um espaço entre as palavras (acentos ficam).
export const nomeLider = s => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ' ').trim();
export const chaveLider = s => normNome(s);

// "Parte do nome": cada palavra digitada é o começo de uma palavra do nome, na mesma ordem, sem acento e sem
// diferença de maiúsculas. "fulano si" casa com "FULANO SILVA"; "silva" também; "fulano s" casa com FULANO SILVA e FULANO SOUSA.
export function casaParte(q, nome) {
  const t = chaveLider(q).split(' ').filter(Boolean), w = chaveLider(nome).split(' ').filter(Boolean);
  if (!t.length || !w.length) return false;
  let i = 0;
  for (const p of t) { while (i < w.length && !w[i].startsWith(p)) i++; if (i >= w.length) return false; i++; }
  return true;
}
// Dois jeitos de escrever que podem ser a mesma pessoa: um é o começo do outro, palavra por palavra (FULANO / FULANO SILVA).
export function mesmoComeco(a, b) {
  const x = chaveLider(a).split(' '), y = chaveLider(b).split(' ');
  const [c, l] = x.length <= y.length ? [x, y] : [y, x];
  return !!c[0] && c.every((p, i) => p === l[i]);
}

// Líderes das fichas: um por grafia (sem acento e maiúsculas), com quantas pessoas ativas e desligadas.
// hoje = AAAA-MM-DD (quem tem demissão até hoje conta como desligado).
export function lideresDasFichas(fichas, hoje) {
  const m = new Map();
  for (const c of fichas || []) {
    const k = chaveLider(c.lider); if (!k) continue;
    const x = m.get(k) || { chave: k, grafias: new Map(), pessoas: [], ativos: 0, desligados: 0 };
    const g = nomeLider(c.lider); x.grafias.set(g, (x.grafias.get(g) || 0) + 1);
    x.pessoas.push(c);
    if (!c.dem || !hoje || c.dem > hoje) x.ativos++; else x.desligados++;
    m.set(k, x);
  }
  return [...m.values()].map(x => ({ chave: x.chave, nome: [...x.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0], ativos: x.ativos, desligados: x.desligados, total: x.pessoas.length, pessoas: x.pessoas.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome))) }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// Troca o líder nas fichas. casa(nomeDoLider) diz quem sai; para = nome novo. Devolve a lista nova e quem mudou.
export function trocarNasFichas(fichas, casa, para) {
  const novo = nomeLider(para); const mudou = [];
  const itens = (fichas || []).map(c => {
    if (!c.lider || !casa(c.lider) || nomeLider(c.lider) === novo) return c;
    mudou.push({ mat: c.mat, nome: c.nome, antes: c.lider });
    return { ...c, lider: novo };
  });
  return { itens, mudou };
}

// Folha de frequência: move as pessoas dos grupos do líder antigo para o grupo do líder novo e apaga o grupo antigo
// (fica vazio). Grupo de destino: o do líder novo com o mesmo prefixo (nenhum, GÁS, PREPARACAO…), o maior se houver
// mais de um; a SUPERVISÃO dele continua a mesma. Sem grupo do líder novo com esse prefixo, cria
// "[PREFIXO -] LIDER <novo> - SUPERVISÃO …" com a supervisão do grupo antigo, no lugar dele. Devolve os grupos novos e o que foi feito.
export function moverNaFolha(grupos, casa, para) {
  const novo = nomeLider(para);
  const L = (grupos || []).map(g => ({ g, pt: partesGrupo(g.nome) }));
  const ehOrigem = x => x.pt && casa(x.pt.lider) && chaveLider(x.pt.lider) !== chaveLider(novo);
  const origem = L.filter(ehOrigem);
  if (!origem.length) return { grupos, mudou: false, acoes: [] };
  const destinos = L.filter(x => x.pt && !ehOrigem(x) && (chaveLider(x.pt.lider) === chaveLider(novo) || mesmoComeco(x.pt.lider, novo)));
  const copia = new Map(L.filter(x => !ehOrigem(x)).map(x => [x, { ...x.g, pessoas: [...(x.g.pessoas || [])] }]));
  const acoes = []; const criados = new Map(); const criadoEm = new Map();
  const chaveP = p => p.k || p.chave || normNome(p.nome);
  for (const o of origem) {
    const pref = normNome(o.pt.prefixo);
    const cand = destinos.filter(d => normNome(d.pt.prefixo) === pref);
    const lista = cand.slice().sort((a, b) => (b.g.pessoas || []).length - (a.g.pessoas || []).length);
    let alvo = lista.length ? copia.get(lista[0]) : criados.get(pref);
    let criado = false;
    if (!alvo) { // entra no lugar do grupo antigo
      alvo = { ...o.g, nome: `${o.pt.prefixo ? o.pt.prefixo + ' - ' : ''}LIDER ${novo}${o.pt.resto ? ' - ' + o.pt.resto.toUpperCase() : ''}`, pessoas: [] };
      criados.set(pref, alvo); criadoEm.set(o, alvo); criado = true;
    }
    const ja = new Set(alvo.pessoas.map(chaveP)); let n = 0;
    for (const p of o.g.pessoas || []) if (!ja.has(chaveP(p))) { alvo.pessoas.push(p); ja.add(chaveP(p)); n++; }
    alvo.pessoas.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    acoes.push({ de: o.g.nome, para: alvo.nome, pessoas: (o.g.pessoas || []).map(p => p.nome), movidas: n, criado });
  }
  const out = []; for (const x of L) { if (copia.has(x)) out.push(copia.get(x)); else if (criadoEm.has(x)) out.push(criadoEm.get(x)); }
  return { grupos: out, mudou: true, acoes };
}
