// Módulo Segurança no banco: interações, anomalias, inspeções e Cartão Amarelo (ouvir, gravar, fotos e apagar).
// Separado de data.js, que reexporta as funções públicas daqui: as telas continuam usando DB.segNovo etc.
// startSeg (abrir as escutas), pararSeg (fechar ao sair) e novoSeg (cache vazio) são só para data.js.
// O estado da conexão (banco, quem entrou, cache, avisos à tela) vem de data.js › interno, lido na hora de cada chamada.
import { doc, getDoc, setDoc, updateDoc, collection, query, where, writeBatch, serverTimestamp } from '../vendor/firebase.js';
import { today, addMonth } from '../contas/cal.js';
import { conjsInd } from '../contas/acessos.js';
import { veTudoSeg, registraSeg, supConjs, fotosDoReg } from '../contas/segcalc.js';
import { interno as I } from './data.js';

// ---------- módulo Segurança (interações e anomalias) ----------
// Lido por mês (o atual e o anterior; a tela pede outros) e, à parte, todas as anomalias ainda em aberto.
// As regras só deixam ler o que é da pessoa: quem só registra pede os próprios (por == uid); o supervisor, os da área
// dele (conj); quem vê tudo, sem filtro. Cada consulta fica numa lista própria e o cache junta tudo.
export function novoSeg() { return { on: false, loaded: false, cfg: null, cfgLoaded: false, inter: [], anom: [], cartao: [], insp: [], meses: new Set(), v: 0 }; }
let segOn = false; const segSubs = new Map(), segRes = new Map(); let segIniciais = [];
const segDoc = d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, em: x.em && x.em.toMillis ? x.em.toMillis() : (+x.em || Date.now()) }; };
function segJuntar() {
  const inter = {}, anom = {}, cartao = {}, insp = {};
  for (const [k, l] of segRes) { const alvo = k.startsWith('seginter') ? inter : k.startsWith('segcartao') ? cartao : k.startsWith('seginsp') ? insp : anom; for (const x of l) alvo[x.id] = x; }
  I.cache.seg.inter = Object.values(inter); I.cache.seg.anom = Object.values(anom); I.cache.seg.cartao = Object.values(cartao); I.cache.seg.insp = Object.values(insp);
  I.cache.seg.loaded = segIniciais.every(k => segRes.has(k)); I.cache.seg.v++; I.changed();
}
function segOuvir(key, q) {
  if (segSubs.has(key)) return;
  segSubs.set(key, I.onSnapshot(q, qs => { segRes.set(key, qs.docs.map(segDoc)); segJuntar(); }, e => { segRes.set(key, []); segJuntar(); if (e.code !== 'permission-denied') I.cb.onError && I.cb.onError(e); }));
}
// Filtros que as regras pedem para esta pessoa: [] = sem filtro (vê tudo).
// Indicadores: os registros dos conjuntos do escopo (Pátio, Bateria), como o supervisor da área.
function filtrosSeg() {
  if (veTudoSeg(I.me)) return [[]];
  const l = [];
  if (registraSeg(I.me)) l.push([where('por', '==', I.me.uid)]);
  for (const k of new Set([...supConjs(I.me), ...conjsInd(I.me)])) l.push([where('conj', '==', k)]);
  return l;
}
export function startSeg() {
  segOn = true; I.cache.seg.on = true;
  I.dataSubs.push(I.onSnapshot(doc(I.db, 'config', 'seguranca'), s => { I.cache.seg.cfg = s.exists() ? s.data() : null; I.cache.seg.cfgLoaded = true; I.cache.seg.v++; I.changed(); }, e => { I.cache.seg.cfgLoaded = true; I.cb.onError && I.cb.onError(e); }));
  const m = today().slice(0, 7);
  // em aberto: uma consulta por situação (só igualdades: não precisa de índice composto no banco)
  for (const st of ['aberta', 'tratamento']) filtrosSeg().forEach((f, i) => { const k = `seganom|${st}|${i}`; segIniciais.push(k); segOuvir(k, query(collection(I.db, 'seganom'), where('status', '==', st), ...f)); });
  // Cartões Amarelos ainda sem validação (de qualquer mês)
  filtrosSeg().forEach((f, i) => { const k = `segcartao|pendente|${i}`; segIniciais.push(k); segOuvir(k, query(collection(I.db, 'segcartao'), where('status', '==', 'pendente'), ...f)); });
  segWatch([addMonth(m, -1), m], true);
}
export function segWatch(meses, inicial) {
  if (!I.db || !I.me || !segOn) return;
  for (const m of new Set(meses.filter(Boolean))) {
    if (I.cache.seg.meses.has(m)) continue; I.cache.seg.meses.add(m);
    for (const col of ['seginter', 'seganom', 'segcartao', 'seginsp']) filtrosSeg().forEach((f, i) => { const k = `${col}|${m}|${i}`; if (inicial) segIniciais.push(k); segOuvir(k, query(collection(I.db, col), where('mes', '==', m), ...f)); });
  }
}
// Novo registro com as fotos: tudo num lote só. Sem sinal, fica na fila do aparelho (inclusive as fotos) e sobe
// quando a conexão voltar. fotos: [{ dados, mini }] já reduzidas pela tela.
export function segNovo(col, dados, fotos) {
  const r = doc(collection(I.db, col)); const ids = fotos.map(() => doc(collection(I.db, 'segfotos')).id);
  const b = writeBatch(I.db);
  b.set(r, { ...dados, fotos: ids, minis: fotos.map(f => f.mini), por: I.me.uid, porNome: I.me.nome || I.me.login || '', em: serverTimestamp() });
  fotos.forEach((f, i) => b.set(doc(I.db, 'segfotos', ids[i]), { reg: r.id, col, tipo: 'antes', mini: f.mini, dados: f.dados, ordem: i, autor: I.me.uid, por: I.me.uid, conj: dados.conj || '', area: dados.area, mes: dados.mes, em: serverTimestamp() }));
  I.track(b.commit());
  return r.id;
}
// O autor corrige o próprio registro (até 24 h; a anomalia, enquanto aberta).
export const segEditar = (col, id, patch) => I.track(updateDoc(doc(I.db, col, id), { ...patch, atualizadoEm: serverTimestamp() }));
// Acompanhamento da anomalia (só os campos do tratamento). foto = { dados, mini } do depois, quando houver.
export function segTratar(a, patch, foto) {
  const b = writeBatch(I.db); const p = { ...patch };
  if (foto) {
    const fid = doc(collection(I.db, 'segfotos')).id;
    b.set(doc(I.db, 'segfotos', fid), { reg: a.id, col: 'seganom', tipo: 'depois', mini: foto.mini, dados: foto.dados, ordem: 0, autor: a.por, por: I.me.uid, conj: a.conj || '', area: a.area, mes: a.mes, em: serverTimestamp() });
    p.trat = { ...p.trat, fotoDepois: fid, miniDepois: foto.mini };
  }
  b.update(doc(I.db, 'seganom', a.id), { ...p, atualizadoEm: serverTimestamp(), atualizadoPor: I.me.uid });
  I.track(b.commit());
}
// Segurança › Inspeções (contas/inspecoes.js): grava a inspeção e, no mesmo lote, uma anomalia (seganom, aberta) para
// cada item "Não OK" novo; o item guarda o id da anomalia (anom) e a anomalia, o da inspeção (insp).
// id vazio = inspeção nova. anoms: [{ i: posição do item, dados: anomDaInsp(...) }].
export function segInspSalvar(id, dados, anoms = []) {
  const r = id ? doc(I.db, 'seginsp', id) : doc(collection(I.db, 'seginsp'));
  const itens = dados.itens.map(i => ({ ...i })); const quem = { por: I.me.uid, porNome: I.me.nome || I.me.login || '' };
  const b = writeBatch(I.db);
  for (const a of anoms) { const ar = doc(collection(I.db, 'seganom')); itens[a.i].anom = ar.id; b.set(ar, { ...a.dados, insp: r.id, fotos: [], minis: [], ...quem, em: serverTimestamp() }); }
  if (id) b.update(r, { ...dados, itens, atualizadoEm: serverTimestamp() });
  else b.set(r, { ...dados, itens, ...quem, em: serverTimestamp() });
  I.track(b.commit());
  return r.id;
}
// Validação do Cartão Amarelo (só status, valid e o carimbo de quem gravou).
export const segValidar = (c, patch) => I.track(updateDoc(doc(I.db, 'segcartao', c.id), { ...patch, atualizadoEm: serverTimestamp(), atualizadoPor: I.me.uid }));
// Foto grande (só ao tocar na miniatura).
export async function segFoto(id) { const s = await getDoc(doc(I.db, 'segfotos', id)); return s.exists() ? s.data().dados : null; }
// Apagar um registro (só o administrador; as regras conferem): o registro e as fotos dele, num lote só.
export function segExcluir(col, r) {
  const b = writeBatch(I.db); b.delete(doc(I.db, col, r.id));
  for (const f of fotosDoReg(r)) b.delete(doc(I.db, 'segfotos', f));
  return I.track(b.commit());
}
export const segSalvarCfg = cfg => I.track(setDoc(doc(I.db, 'config', 'seguranca'), { ...cfg, atualizadoEm: serverTimestamp(), por: I.me.nome || I.me.login || '' }));

// Ao sair: fecha as escutas e esvazia o cache da Segurança.
export function pararSeg() {
  for (const f of segSubs.values()) { try { f(); } catch (e) { /* já fechado */ } } segSubs.clear(); segRes.clear(); segOn = false; segIniciais = []; I.cache.seg = novoSeg();
}
