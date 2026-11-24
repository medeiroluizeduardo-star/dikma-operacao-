// Dikma Gestão — cadastro repetido (sem tela e sem banco): a mesma pessoa duas vezes nas fichas (RH › Colaboradores) ou
// com matrícula diferente entre a ficha e a Escala do dia. Na Frequência isso aparece como duas linhas da mesma pessoa.
// Nada é corrigido sozinho: a tela avisa e a correção é feita na ficha (RH › Colaboradores).
import { normNome } from './planilhas-adm.js';

const mat = x => (x && x.mat != null && String(x.mat).trim() !== '' ? String(x.mat).replace(/\.0$/, '').trim() : '');
const ativa = (f, hoje) => !f.dem || !hoje || f.dem > hoje;

// fichas: gcolab · escala: pessoas da Escala do dia (Atividades, todos os conjuntos) [{ nome, mat }] · hoje: AAAA-MM-DD
// Volta [{ nome, mats: [matrículas das fichas envolvidas], motivo }] (ordem do nome). Fichas de desligados não contam
// (quem saiu e voltou tem a ficha antiga com demissão).
export function cadastrosDuplicados({ fichas = [], escala = [], hoje = '' } = {}) {
  const F = (fichas || []).filter(f => f && f.nome && ativa(f, hoje));
  const out = []; const visto = new Set();
  const add = (nome, mats, motivo) => { const k = [...mats].sort().join('|') + '|' + motivo; if (visto.has(k)) return; visto.add(k); out.push({ nome, mats, motivo }); };
  const porNome = new Map(), porMat = new Map();
  for (const f of F) {
    const n = normNome(f.nome); if (n) { if (!porNome.has(n)) porNome.set(n, []); porNome.get(n).push(f); }
    const m = mat(f); if (m) { if (!porMat.has(m)) porMat.set(m, []); porMat.get(m).push(f); }
  }
  for (const l of porNome.values()) if (l.length > 1) add(l[0].nome, l.map(mat), `${l.length} fichas com o mesmo nome (matrículas ${l.map(f => mat(f) || 'em branco').join(' e ')})`);
  for (const [m, l] of porMat) if (l.length > 1) add(l[0].nome, l.map(mat), `${l.length} fichas com a mesma matrícula ${m}`);
  // a mesma pessoa duas vezes na Escala do dia (duas áreas ou dois conjuntos): salvar a ficha deixa só na área escolhida
  const naEscala = new Map();
  for (const e of escala || []) { const k = mat(e) || 'n:' + normNome(e.nome); if (!naEscala.has(k)) naEscala.set(k, []); naEscala.get(k).push(e); }
  for (const l of naEscala.values()) if (l.length > 1) {
    const f = (mat(l[0]) && (porMat.get(mat(l[0])) || [])[0]) || (porNome.get(normNome(l[0].nome)) || [])[0];
    add(f ? f.nome : l[0].nome, f ? [mat(f)] : [mat(l[0])], `está ${l.length} vezes na Escala do dia${l.some(e => e.area) ? ' (' + l.map(e => e.area).filter(Boolean).join(', ') + ')' : ''}: abra a ficha, confira a área e salve`);
  }
  const matsFicha = new Set(porMat.keys());
  for (const e of escala || []) {
    const me = mat(e); if (!me || matsFicha.has(me)) continue;
    const l = porNome.get(normNome(e.nome)) || []; if (l.length !== 1 || !mat(l[0])) continue;
    add(l[0].nome, [mat(l[0])], `matrícula na Escala do dia (${me}) diferente da ficha (${mat(l[0])})`);
  }
  return out.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

// Linhas da Frequência da mesma pessoa: mesmo nome (sem acento) ou mesma matrícula. pessoas: [{ k, nome, mat }]
// Volta o conjunto das chaves k repetidas.
export function repetidosNaFolha(pessoas = []) {
  const porNome = new Map(), porMat = new Map(); const rep = new Set();
  for (const p of pessoas || []) {
    const n = normNome(p.nome); if (n) { if (porNome.has(n)) { rep.add(porNome.get(n)); rep.add(p.k); } else porNome.set(n, p.k); }
    const m = mat(p); if (m) { if (porMat.has(m)) { rep.add(porMat.get(m)); rep.add(p.k); } else porMat.set(m, p.k); }
  }
  return rep;
}
