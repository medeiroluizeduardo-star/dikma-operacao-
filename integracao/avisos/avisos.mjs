// Dikma Gestão — avisos no celular. Roda no GitHub Actions (workflow "Avisos no celular"), de hora em hora.
// Lê o Firestore com a chave de serviço, decide os avisos (planejar.mjs) e envia pelo Firebase Cloud Messaging.
// Cada aviso vai uma vez só: o que já foi enviado fica marcado em avisos_enviados/estado.
// Antes, aplica os feriados nas atividades (feriados.mjs): atividade programada em feriado sem operação não fica atrasada.
// Também refaz, uma vez por dia, os resumos que todos leem: adm/feriasAtivas (férias de 2 meses antes a 6 meses depois)
// e adm/desligados (demissão das fichas), para não ficarem velhos quando ninguém edita férias ou fichas.
// AVISOS_SO_TESTAR=1 mostra o que seria enviado, sem enviar nem marcar (os resumos também não são gravados).
import { copiarDoSite } from './lib-site.mjs';

process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

// As contas do "Meu dia" ficam em public/ (são as mesmas do site). Copia como .mjs para o Node, seguindo os imports
// (um arquivo novo importado por estes vem junto sozinho).
copiarDoSite(['cal', 'hoje', 'escala', 'pessoas', 'aprovacao', 'situacao', 'acessos', 'planilhas-adm', 'segcalc', 'feriados']);
const { SETS, SET_KEYS, weekOf, add, today, addMonth } = await import('./lib/cal.mjs');
const { planejar } = await import('./planejar.mjs');
const { criarEscala, fatorRota } = await import('./lib/escala.mjs');
const { situacaoDoDia, criarTurmaFicha, feriadosOperacao } = await import('./lib/situacao.mjs');
const { indiceFerias, indiceDesligados, resumoFerias, resumoDesligados } = await import('./lib/acessos.mjs');

const soTestar = process.env.AVISOS_SO_TESTAR === '1' || process.argv.includes('--testar');
const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) { console.error('::error::Falta o segredo FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = await import('firebase-admin/firestore');
const { getMessaging } = await import('firebase-admin/messaging');
initializeApp({ credential: cert(JSON.parse(sa)) });
const db = getFirestore();

const porId = qs => Object.fromEntries(qs.docs.map(x => [x.id, x.data()]));
const hoje = today(), amanha = add(hoje, 1), mes = hoje.slice(0, 7);

// Resumos do dia (uma vez por dia; antes de olhar se alguém ligou os avisos, para valer mesmo sem avisos)
let fichas = null;
{
  const fa = (await db.doc('adm/feriasAtivas').get()).data() || {};
  if (fa.dia !== hoje) {
    const lista = (await db.collection('ferias').get()).docs.map(x => x.data());
    fichas = (await db.collection('gcolab').get()).docs.flatMap(x => x.data().itens || []);
    const fer = resumoFerias(lista, hoje), des = resumoDesligados(fichas);
    console.log(`Resumos do dia: ${fer.length} período(s) de férias, ${des.length} desligamento(s).`);
    if (!soTestar) {
      await db.doc('adm/feriasAtivas').set({ itens: fer, dia: hoje, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
      await db.doc('adm/desligados').set({ itens: des, dia: hoje, atualizadoEm: FieldValue.serverTimestamp() });
    }
  }
}

// Feriados nas atividades (Pátio e Bateria): em feriado sem operação, o que estava programado e não foi apontado sai
// da conta; feriado removido, volta (public/feriados.js). Antes dos avisos, para não avisar de atividade em feriado.
// Lê todos os meses gerados só quando os feriados ou os meses mudaram, e uma vez por dia por garantia; só grava o que muda.
{
  const { planejarFeriados, gravarFeriados, fonteBanco, relatorio } = await import('./feriados.mjs');
  const ref = db.doc('avisos_enviados/feriados');
  const ant = (await ref.get()).data() || {};
  const { mapaFeriados, assinaturaFeriados } = await import('./lib/feriados.mjs');
  const fer0 = mapaFeriados((await db.doc('config/escalas').get()).data() || {}, (await db.doc('eq/config').get()).data() || null);
  const meses0 = [];
  for (const k of SET_KEYS) { const c = await db.doc(`${SETS[k].pre}config/sistema`).get(); meses0.push(((c.exists && c.data().meses) || []).slice().sort().join(',')); }
  const assin = assinaturaFeriados(fer0) + '#' + meses0.join('/');
  if (ant.dia !== hoje || ant.assinatura !== assin) {
    const r = await planejarFeriados(fonteBanco(db));
    relatorio(r).forEach(l => console.log(l));
    let gravadas = 0;
    if (!soTestar && r.total.semanas) gravadas = await gravarFeriados(db, FieldPath, FieldValue, r.planos);
    console.log(`Aplicar feriados: ${r.total.feriado} atividade(s) fora da conta · ${r.total.volta} de volta · ${soTestar ? 'só teste, nada gravado' : `${gravadas} semana(s) gravada(s)`} · ${r.leituras} leituras.`);
    if (!soTestar) await ref.set({ dia: hoje, assinatura: r.assinatura, ultimo: { feriado: r.total.feriado, volta: r.total.volta, semanas: gravadas }, em: FieldValue.serverTimestamp() });
  } else console.log('Aplicar feriados: nada mudou desde a última vez hoje.');
}

const avisos = porId(await db.collection('avisos').get());
const comToken = Object.keys(avisos).filter(uid => (avisos[uid].tokens || []).length);
if (!comToken.length) { await db.doc('avisos_enviados/estado').set({ ultimaExecucao: FieldValue.serverTimestamp(), ultimoResultado: { avisos: 0, entregues: 0, falhas: 0 }, aparelhos: 0, pessoas: 0 }, { merge: true }); console.log('::notice::Ninguém ligou os avisos ainda. Nada a enviar.'); process.exit(0); }

const usuarios = porId(await db.collection('usuarios').get());

// Paradas sem liberação (mês atual e anterior) e ocorrências pendentes
const paradas = [];
for (const m of [addMonth(mes, -1), mes]) (await db.collection('eqpar').where('mes', '==', m).get()).forEach(x => { const p = x.data(); if (!p.fim) paradas.push({ id: x.id, ...p }); });
const ocorr = (await db.collection('gocorr').where('status', '==', 'pendente').get()).docs.map(x => ({ id: x.id, ...x.data() }));

// Atividades (Pátio e Bateria): só o necessário para hoje e amanhã
const sets = {};
for (const k of SET_KEYS) {
  const C = n => SETS[k].pre + n;
  const cfg = await db.doc(`${C('config')}/sistema`).get(); if (!cfg.exists) continue;
  const plano = [], colabs = [], semanas = {}, sit = {}, jus = {}, cob = {};
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
  for (const m of new Set([mes, amanha.slice(0, 7), ...(segunda ? [add(hoje, -7).slice(0, 7)] : [])])) { const s = await db.doc(`${C('situacao')}/${m}`).get(); if (s.exists) { Object.assign(sit, s.data().v || {}); Object.assign(jus, s.data().jus || {}); Object.assign(cob, s.data().cob || {}); } }
  sets[k] = { plano, colabs, semanas, sit, jus, cob, aprov, rotas: cfg.data().rotas || [] };
}

// A situação do dia é a mesma conta do site (public/situacao.js): lançado, demissão na ficha, férias, folga da escala
// (com os feriados "sem operação" da Operação e a turma pela ficha quando falta a letra).
const cfgEsc = (await db.doc('config/escalas').get()).data() || {};
const eqCfg = (await db.doc('eq/config').get()).data() || {};
const ESC = criarEscala(cfgEsc, eqCfg.turmas, feriadosOperacao(eqCfg));
if (!fichas) fichas = (await db.collection('gcolab').get()).docs.flatMap(x => x.data().itens || []);
const operadores = ((await db.doc('eq/cadastro').get()).data() || {}).operadores || [];
const turmaFicha = criarTurmaFicha(fichas, operadores);
const ferias = indiceFerias(((await db.doc('adm/feriasAtivas').get()).data() || {}).itens || []);
const desligadoEm = indiceDesligados(fichas);
const sitEscala = get => (c, dt) => { const s = situacaoDoDia(c, dt, { lancado: (x, d) => get(x.id + '|' + d), desligadoEm, ferias, escala: ESC, turmaFicha }); return s.por === 'padrao' ? undefined : s.v; };
for (const k of Object.keys(sets)) { const S = sets[k]; S.sitDe = sitEscala(key => S.sit[key]); S.fator = cs => fatorRota(cs, ESC.regimes); }
const estadoRef = db.doc('avisos_enviados/estado');
const enviados = ((await estadoRef.get()).data() || {}).enviados || {};
// Painel Coqueria: só nas horas dos avisos dele (7h e 16h) e só as tarefas em aberto e os lançamentos do mês.
const painel = {};
{
  const h = new Date().getHours(), dow = new Date().getDay();
  if (dow > 0 && dow < 6 && h >= 7) for (const uid of comToken) {
    const precisaM = !enviados[`pnl-m|${uid}|${hoje}`], precisaT = h >= 16 && !enviados[`pnl-t|${uid}|${hoje}`];
    if (!precisaM && !precisaT) continue;
    const tasks = (await db.collection(`painel/${uid}/tasks`).where('status', 'in', ['todo', 'doing', 'review']).get()).docs.map(x => x.data());
    const regs = precisaT ? (await db.collection(`painel/${uid}/registros`).where('data', '>=', mes + '-01').get()).docs.map(x => x.data()) : [];
    if (tasks.length || regs.length) painel[uid] = { tasks, regs };
  }
}
// Segurança: anomalias em aberto (aberta ou em tratamento), para a anomalia nova e os prazos do tratamento.
const segAnom = [];
for (const st of ['aberta', 'tratamento']) (await db.collection('seganom').where('status', '==', st).get()).forEach(x => { const a = x.data(); segAnom.push({ ...a, id: x.id, em: a.em && a.em.toMillis ? a.em.toMillis() : +a.em || 0 }); });
const { msgs, marcar } = planejar({ usuarios, avisos, paradas, ocorr, sets, enviados, painel, seg: { anom: segAnom }, agora: new Date() });
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
