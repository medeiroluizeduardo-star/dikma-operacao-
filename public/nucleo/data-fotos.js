// Fotos das atividades, da Queda zero e das OMs: gravar, listar, abrir, lixeira e arquivo (Parte 2).
// Separado de data.js, que reexporta tudo daqui: as telas continuam usando DB.apontarComFotos etc.
// A estrutura das coleções evidencias e evidenciasArquivo está explicada no topo de data.js e em docs/fotos-atividades.md.
// O estado da conexão (banco, quem entrou, conjunto aberto) vem de data.js › interno, lido na hora de cada chamada.
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, FieldPath, deleteField, arrayUnion, increment } from '../vendor/firebase.js';
import { setDaArea, addMonth } from '../contas/cal.js';
import { incrementosFt } from '../contas/fotos.js';
import { interno as I } from './data.js';

// ---------- fotos das atividades (evidencias + evidenciasArquivo) ----------
// Guardadas no próprio Firestore (plano grátis): a foto já chega reduzida pelo aparelho (ui/fotos.js).
// Grava o apontamento (changes, pode ser vazio para só juntar fotos) e as fotos num lote só. Não espera o servidor:
// sem sinal, fica tudo na fila do aparelho e sobe junto quando a conexão voltar.
// fotos: [{ meta (fotos.js › metaFoto, sem por/at), dados }] · devolve os ids das fotos
export function apontarComFotos(docId, changes, fotos) {
  const k = setDaArea((fotos[0] && fotos[0].meta.area) || '') || I.cur;
  const args = []; const finalStr = {};
  for (const c of changes) finalStr[c.pid] = c.str;
  for (const [pid, str] of Object.entries(finalStr)) args.push(new FieldPath('s', pid), str);
  for (const c of changes) args.push(new FieldPath('m', c.pid + '|' + c.k), c.motivo ? c.motivo : deleteField());
  const inc = {};
  for (const f of fotos) for (const [key, n] of Object.entries(incrementosFt(f.meta.refs, 1))) inc[key] = (inc[key] || 0) + n;
  for (const [key, n] of Object.entries(inc)) args.push(new FieldPath('ft', key), increment(n));
  args.push('atualizadoEm', serverTimestamp(), 'atualizadoPor', I.me.uid);
  const b = writeBatch(I.db);
  b.update(doc(I.db, I.C('semanas', k), docId), ...args);
  const ids = fotos.map(f => fotoNoLote(b, k, f));
  I.track(b.commit());
  return ids;
}
// Põe uma foto (documento leve + foto completa, mesmo id) no lote b; devolve o id.
function fotoNoLote(b, k, f) {
  const r = doc(collection(I.db, I.C('evidencias', k)));
  b.set(r, { ...f.meta, por: I.me.uid, porNome: I.me.nome || I.me.login || '', at: serverTimestamp() });
  b.set(doc(I.db, I.C('evidenciasArquivo', k), r.id), { area: f.meta.area, semana: f.meta.semana, dia: f.meta.dia, sha: f.meta.sha || '', por: I.me.uid, dados: f.dados });
  return r.id;
}
// Queda zero (opcional): grava o lançamento qz[key] da semana (v = null apaga) e as fotos novas (opcionais,
// [{ meta, dados }], contas/queda-zero.js › pidFotoQZ) no MESMO lote, como no apontamento: sem sinal sobe tudo junto.
export function salvarQuedaZero(docId, area, key, v, fotos = []) {
  const k = setDaArea(area || '') || I.cur;
  const b = writeBatch(I.db);
  b.update(doc(I.db, I.C('semanas', k), docId), new FieldPath('qz', key), v || deleteField(), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', I.me.uid);
  for (const f of fotos) fotoNoLote(b, k, f);
  return I.track(b.commit());
}
// Apaga fotos de um lançamento da Queda zero (líder da área ou administrador; as regras conferem) e, com
// apagarLanc, o próprio lançamento; senão só diminui a contagem f. Espera o servidor (sem sinal, dá erro).
export async function apagarFotosQZ(docId, area, key, fotos, apagarLanc = false) {
  const k = setDaArea(area || '') || I.cur;
  const b = writeBatch(I.db);
  for (const f of fotos) { b.delete(doc(I.db, I.C('evidencias', k), f.id)); if (!f.removidaEm) b.delete(doc(I.db, I.C('evidenciasArquivo', k), f.id)); }
  b.update(doc(I.db, I.C('semanas', k), docId), apagarLanc ? new FieldPath('qz', key) : new FieldPath('qz', key, 'f'), apagarLanc ? deleteField() : increment(-fotos.length), 'atualizadoEm', serverTimestamp(), 'atualizadoPor', I.me.uid);
  await I.gravarLote(b);
}
// Cadastra um local ou motivo novo da Queda zero (tipo = 'locais' ou 'motivos'), para todos verem.
export const salvarItemQZ = (tipo, nome) => I.track(setDoc(doc(I.db, 'config', 'quedazero'), { [tipo]: arrayUnion(nome), atualizadoEm: serverTimestamp(), por: I.me.nome || I.me.login || '' }, { merge: true }));
const dataDe = v => (v && v.toDate ? v.toDate() : v || null);
const comoFoto = d => { const x = d.data({ serverTimestamps: 'estimate' }); return { id: d.id, ...x, at: x.at && x.at.toDate ? x.at.toDate() : new Date(), exportadoEm: dataDe(x.exportadoEm), lixeiraEm: dataDe(x.lixeiraEm), removidaEm: dataDe(x.removidaEm) }; };
// Fotos (leves, com miniatura) de uma atividade num dia. Também as do código antigo (campo ref).
// As da lixeira ficam de fora; as arquivadas fora do banco (removidaEm) vêm, para a tela mostrar a miniatura e o selo.
export async function listarFotosCel(semana, pid, k, conj = setDaArea(semana.split('|')[0]) || I.cur) {
  const col = collection(I.db, I.C('evidencias', conj));
  const [a, b] = await Promise.all([
    getDocs(query(col, where('refs', 'array-contains', `${semana}|${pid}|${k}`))),
    getDocs(query(col, where('ref', '==', `${semana}#${pid}|${k}`))).catch(() => ({ docs: [] }))
  ]);
  const vistos = new Set(); const out = [];
  for (const d of [...a.docs, ...b.docs]) if (!vistos.has(d.id)) { vistos.add(d.id); out.push(comoFoto(d)); }
  return out.filter(f => !f.lixeiraEm || f.removidaEm).sort((x, y) => x.at - y.at);
}
// Relatório fotográfico (Parte 2): lista leve (miniaturas) de várias semanas de uma vez.
export async function listarEvidenciasSemanas(ids, conj = I.cur) {
  const out = [];
  for (let i = 0; i < ids.length; i += 30) {
    const qs = await getDocs(query(collection(I.db, I.C('evidencias', conj)), where('semana', 'in', ids.slice(i, i + 30))));
    qs.docs.forEach(d => out.push(comoFoto(d)));
  }
  return out;
}
// Foto completa (só ao abrir grande ou exportar).
export async function abrirEvidencia(id, conj = I.cur) { const s = await getDoc(doc(I.db, I.C('evidenciasArquivo', conj), id)); return s.exists() ? s.data().dados : null; }
// O autor ajusta a quais atividades a foto vale (até 24 h depois; as regras conferem).
export const ajustarRefsFoto = (id, refs, conj = I.cur) => I.track(updateDoc(doc(I.db, I.C('evidencias', conj), id), { refs, atualizadoEm: serverTimestamp(), atualizadoPor: I.me.uid }));
// Apagar uma foto (Apontar › fotos da atividade; líder da área ou administrador, as regras conferem): apaga o documento
// leve e a foto completa e diminui a contagem ft da semana, num lote só. Espera o servidor (sem sinal, dá erro).
// A foto já arquivada fora do banco (removidaEm) não tem mais a foto completa: só o leve sai.
export async function apagarFotoAtividade(f, conj = setDaArea(f.area || '') || I.cur) {
  const b = writeBatch(I.db);
  b.delete(doc(I.db, I.C('evidencias', conj), f.id));
  if (!f.removidaEm) b.delete(doc(I.db, I.C('evidenciasArquivo', conj), f.id));
  const args = [];
  if (f.semana && (f.refs || []).length) for (const [key, n] of Object.entries(incrementosFt(f.refs, 1))) args.push(new FieldPath('ft', key), increment(-n));
  if (args.length) b.update(doc(I.db, I.C('semanas', conj), f.semana), ...args, 'atualizadoEm', serverTimestamp(), 'atualizadoPor', I.me.uid);
  await I.gravarLote(b);
}
// Fotos das OMs: gravadas como as das atividades (contas/oms.js › pidFotoOM), na semana atual da área da OM.
export async function listarFotosOM(conj, omId) {
  const qs = await getDocs(query(collection(I.db, I.C('evidencias', conj)), where('pid', '==', 'OM-' + omId)));
  return qs.docs.map(comoFoto).filter(f => !f.lixeiraEm || f.removidaEm).sort((x, y) => x.at - y.at);
}
export function salvarFotosOM(conj, fotos) { const b = writeBatch(I.db); for (const f of fotos) fotoNoLote(b, conj, f); return I.gravarLote(b); }
export async function apagarFotoOM(conj, f) {
  const b = writeBatch(I.db); b.delete(doc(I.db, I.C('evidencias', conj), f.id)); if (!f.removidaEm) b.delete(doc(I.db, I.C('evidenciasArquivo', conj), f.id)); await I.gravarLote(b);
}
// ---------- Relatórios e arquivo de fotos (Parte 2; só o administrador; contas em fotos-arquivo.js) ----------
// Fotos (leves) de um período: lidas por mês e filtradas pelo dia. Todas as situações (a tela separa).
export async function listarEvidenciasPeriodo(conj, de, ate) {
  const meses = []; for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = addMonth(m, 1)) meses.push(m);
  const out = [];
  for (let i = 0; i < meses.length; i += 10) {
    const qs = await getDocs(query(collection(I.db, I.C('evidencias', conj)), where('mes', 'in', meses.slice(i, i + 10))));
    qs.docs.forEach(d => { const f = comoFoto(d); if (f.dia >= de && f.dia <= ate) out.push(f); });
  }
  return out;
}
// Lixeira: fotos com lixeiraEm (de qualquer período), sem as já apagadas de vez.
export async function listarEvidenciasLixeira(conj) {
  const qs = await getDocs(query(collection(I.db, I.C('evidencias', conj)), where('lixeiraEm', '!=', null)));
  return qs.docs.map(comoFoto).filter(f => !f.removidaEm);
}
// Semanas do período (para os indicadores do relatório), lidas por mês (campo mes da semana).
export async function semanasPeriodo(conj, meses) {
  const out = {};
  for (let i = 0; i < meses.length; i += 10) {
    const qs = await getDocs(query(collection(I.db, I.C('semanas', conj)), where('mes', 'in', meses.slice(i, i + 10))));
    qs.docs.forEach(d => { out[d.id] = I.toLocal(d.id, d.data()); });
  }
  return out;
}
// Exportada: itens [{ id, conf: 'ok' | 'divergente' | 'sem-sha' }] num lote só (até 400).
export async function marcarExportadas(conj, itens, lote) {
  const b = writeBatch(I.db);
  for (const x of itens) b.update(doc(I.db, I.C('evidencias', conj), x.id), { exportadoEm: serverTimestamp(), exportLote: lote, exportConf: x.conf, ...I.marca() });
  await I.gravarLote(b);
}
export async function moverLixeira(conj, ids) { const b = writeBatch(I.db); for (const id of ids) b.update(doc(I.db, I.C('evidencias', conj), id), { lixeiraEm: serverTimestamp(), ...I.marca() }); await I.gravarLote(b); }
export async function restaurarLixeira(conj, ids) { const b = writeBatch(I.db); for (const id of ids) b.update(doc(I.db, I.C('evidencias', conj), id), { lixeiraEm: null, ...I.marca() }); await I.gravarLote(b); }
// Apagar de vez: apaga a foto completa (evidenciasArquivo) e marca removidaEm no documento leve, no mesmo lote
// (até 200 fotos). O documento leve fica, com a miniatura, os dados da atividade, o sha e o lote da exportação.
export async function apagarDefinitivo(conj, ids) {
  const b = writeBatch(I.db);
  for (const id of ids) { b.delete(doc(I.db, I.C('evidenciasArquivo', conj), id)); b.update(doc(I.db, I.C('evidencias', conj), id), { removidaEm: serverTimestamp(), ...I.marca() }); }
  await I.gravarLote(b);
}
// Configuração das fotos (só o administrador).
export const salvarCfgFotos = c => I.track(setDoc(doc(I.db, 'config', 'fotos'), { obrig: c.obrig, min: c.min, max: c.max, maxQZ: c.maxQZ, maxOM: c.maxOM, situacoes: c.situacoes, desde: c.desde, atualizadoEm: serverTimestamp(), por: I.me.nome || I.me.login || '' }));
