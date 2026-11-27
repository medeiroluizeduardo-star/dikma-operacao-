// Conta da mudança da Sinter (sem banco, para testar): as pessoas da área SINTER que estavam no Pátio passam para o
// conjunto Sinter (coleções s_). Quem grava é mover-sinter.mjs.
//   colaboradores/SINTER            -> s_colaboradores/SINTER (junta com o que já houver lá, sem repetir o id)
//   situacao/{mês}  chaves "ID|data" das pessoas da Sinter, em todos os campos (v, jus, cob, he, hed, mov, trv, ck...)
//                                   -> s_situacao/{mês} (mesmas chaves)
//   efetivoDia/{data}_SINTER        -> s_efetivoDia/{data}_SINTER
//   freqcomp/patio|{mês}            pessoas da Sinter (un 'Sinter', id da Sinter nas Atividades ou grupo SINTER)
//                                   -> freqcomp/sinter|{mês} (com d e jus delas)
//   config/sistema.rotas da área SINTER -> s_config/sistema (criado se não existir, com os tipos do Pátio)
//   acoes da área SINTER            -> s_acoes
//   registros com área SINTER e conj 'patio' (Segurança, atestados, OMs) -> conj 'sinter'
//   usuários com a área SINTER      -> ganham o escopo Sinter (e a marca 'sinter' se têm a Operação)
export const AREA = 'SINTER';
const objeto = v => v && typeof v === 'object' && !Array.isArray(v) && !(typeof v.toDate === 'function');

// Pessoa da Sinter na folha de frequência
export const daSinterNaFolha = (p, g, ids) => p.un === 'Sinter' || (p.ativ && ids.has(String(p.ativ))) || /SINTER/i.test(String((g && g.nome) || ''));

// Separa as chaves "ID|..." das pessoas da Sinter de um documento de situação. Devolve { [campo]: { chave: valor } }.
export function separarSituacao(doc, ids) {
  const mover = {};
  for (const [campo, mapa] of Object.entries(doc || {})) {
    if (!objeto(mapa)) continue;
    for (const [k, v] of Object.entries(mapa)) if (ids.has(k.split('|')[0])) (mover[campo] ||= {})[k] = v;
  }
  return mover;
}

// Separa a folha do Pátio: { patio: folha sem a Sinter, sinter: folha só da Sinter (juntada à que já existir), n }.
export function separarFolha(folha, ids, atualSinter) {
  const fica = [], vai = [], ks = new Set();
  for (const g of folha.grupos || []) {
    const pf = [], pv = [];
    for (const p of g.pessoas || []) (daSinterNaFolha(p, g, ids) ? pv : pf).push(p);
    if (pf.length) fica.push({ ...g, pessoas: pf });
    if (pv.length) vai.push({ ...g, pessoas: pv });
    for (const p of pv) ks.add(p.k);
  }
  if (!ks.size) return { n: 0 };
  const partir = mapa => { const a = {}, b = {}; for (const [k, v] of Object.entries(mapa || {})) (ks.has(k) ? b : a)[k] = v; return [a, b]; };
  const [dFica, dVai] = partir(folha.d), [jFica, jVai] = partir(folha.jus);
  const base = atualSinter || {};
  const jaTem = new Set((base.grupos || []).flatMap(g => (g.pessoas || []).map(p => p.k)));
  const gruposS = (base.grupos || []).map(g => ({ ...g, pessoas: [...(g.pessoas || [])] }));
  for (const g of vai) {
    const novas = g.pessoas.filter(p => !jaTem.has(p.k)); if (!novas.length) continue;
    const igual = gruposS.find(x => x.nome === g.nome && (x.turno || '') === (g.turno || ''));
    if (igual) igual.pessoas.push(...novas); else gruposS.push({ ...g, pessoas: novas });
  }
  const { grupos: _g, d: _d, jus: _j, ...meta } = folha;
  const sinter = { ...meta, ...base, conj: 'sinter', grupos: gruposS, d: { ...dVai, ...(base.d || {}) }, jus: { ...jVai, ...(base.jus || {}) } };
  return { n: ks.size, patio: { ...folha, grupos: fica, d: dFica, jus: jFica }, sinter };
}

// Junta as fichas da Sinter: as que já estão em s_colaboradores valem; as do Pátio entram se o id ainda não existe.
export function juntarColabs(doPatio, jaNaSinter) {
  const tem = new Set((jaNaSinter || []).map(c => String(c.id)));
  return [...(jaNaSinter || []), ...(doPatio || []).filter(c => !tem.has(String(c.id))).map(c => ({ ...c, area: AREA }))];
}

const areasDoUsuario = u => [u.area, u.area2, ...(Array.isArray(u.areas) ? u.areas : [])].filter(Boolean);
// Usuário com a área SINTER que ainda não tem o escopo Sinter: o que muda nele (ou null).
export function acertoUsuario(u) {
  if (!areasDoUsuario(u).includes(AREA)) return null;
  const esc = Array.isArray(u.escopos) ? u.escopos : [];
  const mods = Array.isArray(u.modulos) ? u.modulos : [];
  const p = {};
  if (!esc.includes('sinter')) p.escopos = [...esc, 'sinter'];
  if (mods.includes('operacao') && !mods.includes('sinter')) p.modulos = [...mods, 'sinter'];
  return Object.keys(p).length ? p : null;
}
