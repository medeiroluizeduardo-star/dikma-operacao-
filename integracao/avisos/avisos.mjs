// Dikma Gestão — avisos no celular. Roda no GitHub Actions (workflow "Avisos no celular"), de hora em hora.
// Lê o Firestore com a chave de serviço, decide os avisos (planejar.mjs) e envia pelo Firebase Cloud Messaging.
// Cada aviso vai uma vez só: o que já foi enviado fica marcado em avisos_enviados/estado.
// AVISOS_SO_TESTAR=1 mostra o que seria enviado, sem enviar nem marcar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
const aqui = path.dirname(fileURLToPath(import.meta.url));

// As contas do "Meu dia" ficam em public/ (são as mesmas do site). Copia como .mjs para o Node.
fs.mkdirSync(path.join(aqui, 'lib'), { recursive: true });
for (const f of ['cal', 'hoje', 'escala', 'pessoas', 'aprovacao']) {
  const src = fs.readFileSync(path.join(aqui, '..', '..', 'public', f + '.js'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'");
  fs.writeFileSync(path.join(aqui, 'lib', f + '.mjs'), src);
}
const { SETS, SET_KEYS, weekOf, add, today, addMonth } = await import('./lib/cal.mjs');
const { planejar } = await import('./planejar.mjs');
const { criarEscala, normRegime, letra, fatorRota } = await import('./lib/escala.mjs');

const soTestar = process.env.AVISOS_SO_TESTAR === '1' || process.argv.includes('--testar');
const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.error('::error::Falta o segredo FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
const { getMessaging } = await import('firebase-admin/messaging');
initializeApp({ credential: cert(JSON.parse(sa)) });
const db = getFirestore();

const porId = qs => Object.fromEntries(qs.docs.map(x => [x.id, x.data()]));
const avisos = porId(await db.collection('avisos').get());
const comToken = Object.keys(avisos).filter(uid => (avisos[uid].tokens || []).length);
if (!comToken.length) { await db.doc('avisos_enviados/estado').set({ ultimaExecucao: FieldValue.serverTimestamp(), ultimoResultado: { avisos: 0, entregues: 0, falhas: 0 }, aparelhos: 0, pessoas: 0 }, { merge: true }); console.log('::notice::Ninguém ligou os avisos ainda. Nada a enviar.'); process.exit(0); }

const usuarios = porId(await db.collection('usuarios').get());
const hoje = today(), amanha = add(hoje, 1), mes = hoje.slice(0, 7);

// Paradas sem liberação (mês atual e anterior) e ocorrências pendentes
const paradas = [];
for (const m of [addMonth(mes, -1), mes]) (await db.collection('eqpar').where('mes', '==', m).get()).forEach(x => { const p = x.data(); if (!p.fim) paradas.push({ id: x.id, ...p }); });
const ocorr = (await db.collection('gocorr').where('status', '==', 'pendente').get()).docs.map(x => ({ id: x.id, ...x.data() }));

// Atividades (Pátio e Bateria): só o necessário para hoje e amanhã
const sets = {};
for (const k of SET_KEYS) {
  const C = n => SETS[k].pre + n;
  const cfg = await db.doc(`${C('config')}/sistema`).get(); if (!cfg.exists) continue;
  const plano = [], colabs = [], semanas = {}, sit = {};
  (await db.collection(C('plano')).get()).forEach(x => plano.push(...(x.data().itens || [])));
  (await db.collection(C('colaboradores')).get()).forEach(x => colabs.push(...(x.data().itens || [])));
  // segunda-feira: também a semana que passou (resumo semanal)
  const segunda = new Date(hoje + 'T12:00:00').getDay() === 1;
  // aprovação: também a semana anterior (apontamentos esperando aprovação e devolvidos ao líder)
  const aprov = {};
  for (const ini of new Set([weekOf(hoje), weekOf(amanha), add(weekOf(hoje), -7), ...(segunda ? [add(hoje, -7)] : [])])) for (const a of SETS[k].areas) {
    const s = await db.doc(`${C('semanas')}/${a}|${ini}`).get(); if (s.exists) semanas[s.id] = s.data();
    const ap = await db.doc(`${C('aprov')}/${a}|${ini}`).get(); if (ap.exists) aprov[ap.id] = ap.data().v || {};
  }
  for (const m of new Set([mes, amanha.slice(0, 7), ...(segunda ? [add(hoje, -7).slice(0, 7)] : [])])) { const s = await db.doc(`${C('situacao')}/${m}`).get(); if (s.exists) Object.assign(sit, s.data().v || {}); }
  sets[k] = { plano, colabs, semanas, sit, aprov, rotas: cfg.data().rotas || [] };
}

// Escala de turno: quem está de folga pela letra da turma não conta como disponível amanhã.
const cfgEsc = (await db.doc('config/escalas').get()).data() || {};
const eqCfg = (await db.doc('eq/config').get()).data() || {};
const ESC = criarEscala(cfgEsc, eqCfg.turmas, []);
// Férias marcadas no Administrativo (resumo adm/feriasAtivas): quem está de férias não conta como disponível.
const semAc = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const ferias = ((await db.doc('adm/feriasAtivas').get()).data() || {}).itens || [];
const emFerias = (c, dt) => ferias.some(f => f.inicio <= dt && dt <= f.termino && ((f.mat && c.mat && String(f.mat) === String(c.mat)) || semAc(f.nome) === semAc(c.nome)));
const sitEscala = get => (c, dt) => { const m = get(c.id + '|' + dt); if (m) return m; if (emFerias(c, dt)) return 'FE'; const p = ESC.previsto(normRegime(c.regime, ESC.regimes), letra(c.turma), dt); return p && !p.trab ? 'F' : undefined; };
for (const k of Object.keys(sets)) { const S = sets[k]; S.sitDe = sitEscala(key => S.sit[key]); S.fator = cs => fatorRota(cs, ESC.regimes); }
const estadoRef = db.doc('avisos_enviados/estado');
const enviados = ((await estadoRef.get()).data() || {}).enviados || {};
const { msgs, marcar } = planejar({ usuarios, avisos, paradas, ocorr, sets, enviados, agora: new Date() });
console.log(`${msgs.length} aviso(s) para enviar · ${marcar.length} marca(s) nova(s).`);
msgs.forEach(m => console.log(`→ ${usuarios[m.uid].nome || m.uid}: ${m.titulo} | ${m.corpo.replace(/\n/g, ' / ')}`));
if (soTestar) { console.log('::notice::Só teste: nada foi enviado.'); process.exit(0); }

// Envia e limpa aparelhos que não existem mais
const fcm = getMessaging(); let ok = 0, falhas = 0;
for (const m of msgs) {
  const tokens = avisos[m.uid].tokens || [];
  const r = await fcm.sendEachForMulticast({ tokens, data: { titulo: m.titulo, corpo: m.corpo, tag: m.tag, url: m.url }, webpush: { headers: { Urgency: 'high', TTL: '21600' } } });
  const mortos = [];
  r.responses.forEach((x, i) => { if (x.success) ok++; else { falhas++; const c = x.error && x.error.code; if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'].includes(c)) mortos.push(tokens[i]); } });
  if (mortos.length) await db.doc(`avisos/${m.uid}`).update({ tokens: FieldValue.arrayRemove(...mortos) });
}
// Marca o que foi enviado e esquece marcas com mais de 15 dias
const limite = add(hoje, -15); const novo = {};
for (const [k, v] of Object.entries(enviados)) if (typeof v === 'string' && v >= limite) novo[k] = v;
marcar.forEach(k => { novo[k] = hoje; });
await estadoRef.set({ enviados: novo, ultimaExecucao: FieldValue.serverTimestamp(), ultimoResultado: { avisos: msgs.length, entregues: ok, falhas }, aparelhos: comToken.reduce((n, uid) => n + avisos[uid].tokens.length, 0), pessoas: comToken.length });
console.log(`::notice::Avisos entregues: ${ok}${falhas ? ` · falhas: ${falhas}` : ''}.`);
