// Testes das regras de segurança do Firestore (firestore.rules), no emulador do Firebase.
// Rodam sozinhos no GitHub antes de cada publicação. Se algum falhar, nada é publicado.
// Cada teste diz, em português, o que é garantido. Para rodar no computador: veja testes/LEIA-ME.md.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let env;

const USUARIOS = {
  admin: { papel: 'admin' },
  gestorP: { papel: 'gestor', modulos: ['operacao'] },
  gestorG: { papel: 'gestor', modulos: ['gestao'] },
  coord: { papel: 'coordenador', modulos: ['operacao', 'bateria'] },
  sup: { papel: 'supervisor', area: 'RECEBIMENTO', area2: 'BATERIA 1', modulos: ['operacao', 'bateria'] },
  liderRec: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'] },
  liderPrep: { papel: 'lider', area: 'PREPARAÇÃO', modulos: ['operacao'] },
  liderG: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['gestao'], nome: 'Líder Gestão' },
  liderGP: { papel: 'lider', area: 'PREPARAÇÃO', modulos: ['gestao'], nome: 'Líder Preparação' },
  supG: { papel: 'supervisor', area: 'RECEBIMENTO', area2: 'BATERIA 1', modulos: ['gestao'], nome: 'Supervisor G' },
  liderGEq: { papel: 'lider', area: null, modulos: ['gestao', 'equipamentos'], nome: 'Líder Operação' },
  coordG: { papel: 'coordenador', modulos: ['gestao'] },
  leitorG: { papel: 'leitor', modulos: ['gestao'] },
  liderEq: { papel: 'lider', modulos: ['equipamentos'] },
  bloq: { papel: 'bloqueado', modulos: ['operacao', 'bateria', 'equipamentos', 'gestao'] }
};
const SEM = 'RECEBIMENTO|2026-10-05', SEM_PREP = 'PREPARAÇÃO|2026-10-05', SEM_CHEIA = 'RECEBIMENTO|2026-10-12', SEM_B1 = 'BATERIA 1|2026-10-05';

// db('liderRec') = banco visto por essa pessoa; db(null) = sem login; db('semPerfil') = conta sem cadastro no sistema
const db = uid => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

before(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [h, p] = host.split(':');
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-dikma',
    firestore: { rules: fs.readFileSync(path.join(raiz, 'firestore.rules'), 'utf8'), host: h, port: Number(p) }
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    for (const [uid, u] of Object.entries(USUARIOS)) await setDoc(doc(d, 'usuarios', uid), { nome: uid, login: uid.toLowerCase(), area: null, ...u });
    for (const a of ['RECEBIMENTO', 'PREPARAÇÃO', 'BATERIA 1', 'OPERAÇÃO DE EQUIPAMENTOS', 'GERAL']) await setDoc(doc(d, 'gcolab', a), { itens: [{ mat: a.slice(0, 3), nome: 'Pessoa ' + a }] });
    const oc = (id, area, extra = {}) => setDoc(doc(d, 'gocorr', id), { area, status: 'pendente', desc: 'Atestado', criadoPor: 'admin', recolhe: '', ...extra });
    await oc('rec1', 'RECEBIMENTO'); await oc('pre1', 'PREPARAÇÃO'); await oc('b1', 'BATERIA 1'); await oc('op1', 'OPERAÇÃO DE EQUIPAMENTOS'); await oc('ger1', 'GERAL');
    await oc('pre2', 'PREPARAÇÃO', { criadoPor: 'liderG' }); await oc('pre3', 'PREPARAÇÃO', { recolhe: 'LÍDER GESTÃO' });
    await setDoc(doc(d, 'gassin', 'arec'), { area: 'RECEBIMENTO', por: 'admin', metodo: 'tela' });
    await setDoc(doc(d, 'gassin', 'apre'), { area: 'PREPARAÇÃO', por: 'admin', metodo: 'tela' });
    await setDoc(doc(d, 'logins', 'admin'), { uid: 'admin', email: 'admin.x@usuarios.dikma.app' });
    for (const s of ['seed', 'seed-bateria', 'seed-equip', 'seed-gestao', 'seed-efetivo']) await setDoc(doc(d, 'seeds', s), { json: '{}' });
    await setDoc(doc(d, 'config', 'sistema'), { rotas: [] });
    await setDoc(doc(d, 'config', 'escalas'), { regimes: [] });
    await setDoc(doc(d, 'config', 'permissoes'), {});
    await setDoc(doc(d, 'colaboradores', 'RECEBIMENTO'), { itens: [] });
    await setDoc(doc(d, 'semanas', SEM), { area: 'RECEBIMENTO', s: {}, ev: {} });
    await setDoc(doc(d, 'semanas', SEM_PREP), { area: 'PREPARAÇÃO', s: {}, ev: {} });
    await setDoc(doc(d, 'semanas', SEM_CHEIA), { area: 'RECEBIMENTO', s: {}, ev: { 'REC-001|2': 6 } });
    await setDoc(doc(d, 'b_semanas', SEM_B1), { area: 'BATERIA 1', s: {}, ev: {} });
    await setDoc(doc(d, 'gestao', 'colaboradores'), { itens: [] });
    for (const id of ['o1', 'o2']) await setDoc(doc(d, 'gocorr', id), { area: 'RECEBIMENTO', status: 'pendente', desc: 'Atestado', criadoPor: 'liderG' });
    for (const id of ['a1', 'a2']) await setDoc(doc(d, 'gassin', id), { area: 'RECEBIMENTO', por: 'liderG', metodo: 'tela' });
    await setDoc(doc(d, 'eq', 'cadastro'), { operadores: [] });
    await setDoc(doc(d, 'eqlanc', 'l1'), { mes: '2026-10' });
    await setDoc(doc(d, 'integracao', 'senior'), { registros: [] });
    await setDoc(doc(d, 'avisos', 'liderRec'), { tokens: [] });
    await setDoc(doc(d, 'historico', 'h1'), { t: 'x' });
  });
});
after(async () => { if (env) await env.cleanup(); });

// ---------------- administrador e cadastro ----------------
test('sem administrador marcado, ninguém cria o config/bootstrap pelo site (nem sem cadastro, nem o próprio admin)', async () => {
  await assertSucceeds(getDoc(doc(db(null), 'config', 'bootstrap')));
  await assertFails(setDoc(doc(db('semPerfil'), 'config', 'bootstrap'), { uid: 'semPerfil' }));
  await assertFails(setDoc(doc(db('admin'), 'config', 'bootstrap'), { uid: 'admin' }));
});
test('conta sem cadastro não consegue se cadastrar como administrador nem criar login', async () => {
  await assertFails(setDoc(doc(db('semPerfil'), 'usuarios', 'semPerfil'), { papel: 'admin', nome: 'x', login: 'x' }));
  await assertFails(setDoc(doc(db('semPerfil'), 'logins', 'invasor'), { uid: 'semPerfil', email: 'a@b.c' }));
});
test('ninguém muda o próprio perfil, área ou módulos; só o último acesso e a troca de senha', async () => {
  const d = db('liderRec');
  await assertFails(updateDoc(doc(d, 'usuarios', 'liderRec'), { papel: 'admin' }));
  await assertFails(updateDoc(doc(d, 'usuarios', 'liderRec'), { area: 'PREPARAÇÃO' }));
  await assertFails(updateDoc(doc(d, 'usuarios', 'liderRec'), { modulos: ['operacao', 'gestao'] }));
  await assertFails(updateDoc(doc(d, 'usuarios', 'liderRec'), { abas: { gestao: ['x'] } }));
  await assertSucceeds(updateDoc(doc(d, 'usuarios', 'liderRec'), { ultimoAcesso: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(d, 'usuarios', 'liderRec'), { trocarSenha: false }));
});
test('só o administrador cadastra usuários, vê o cadastro dos outros e muda as permissões', async () => {
  await assertFails(getDoc(doc(db('liderRec'), 'usuarios', 'admin')));
  await assertFails(getDoc(doc(db('gestorP'), 'usuarios', 'liderRec')));
  await assertSucceeds(getDoc(doc(db('liderRec'), 'usuarios', 'liderRec')));
  await assertSucceeds(getDoc(doc(db('admin'), 'usuarios', 'liderRec')));
  await assertFails(setDoc(doc(db('gestorP'), 'usuarios', 'novo1'), { papel: 'lider', nome: 'x', login: 'x' }));
  await assertSucceeds(setDoc(doc(db('admin'), 'usuarios', 'novo1'), { papel: 'lider', nome: 'x', login: 'x' }));
  await assertFails(setDoc(doc(db('gestorP'), 'config', 'permissoes'), { x: 1 }));
  await assertSucceeds(setDoc(doc(db('admin'), 'config', 'permissoes'), { x: 1 }));
  await assertFails(getDocs(collection(db('liderRec'), 'logins')));
});

// ---------------- dados de importação (planilhas originais) ----------------
test('dados de importação: ninguém de fora lê; cada administração lê só a do seu módulo; ninguém grava pelo site', async () => {
  for (const s of ['seed', 'seed-bateria', 'seed-equip', 'seed-gestao', 'seed-efetivo']) {
    for (const quem of [null, 'semPerfil', 'bloq', 'liderRec', 'liderG', 'leitorG', 'sup', 'coord', 'liderEq']) await assertFails(getDoc(doc(db(quem), 'seeds', s)));
    await assertSucceeds(getDoc(doc(db('admin'), 'seeds', s)));
  }
  await assertSucceeds(getDoc(doc(db('gestorG'), 'seeds', 'seed-gestao')));
  await assertSucceeds(getDoc(doc(db('gestorG'), 'seeds', 'seed-efetivo')));
  await assertFails(getDoc(doc(db('gestorG'), 'seeds', 'seed-equip')));
  await assertFails(getDoc(doc(db('gestorG'), 'seeds', 'seed')));
  await assertSucceeds(getDoc(doc(db('gestorP'), 'seeds', 'seed')));
  await assertFails(getDoc(doc(db('gestorP'), 'seeds', 'seed-efetivo')));
  await assertFails(setDoc(doc(db('admin'), 'seeds', 'seed'), { json: '{"x":1}' }));
  await assertFails(getDocs(collection(db('admin'), 'seeds')));
});

// ---------------- quem está de fora ----------------
test('sem login, sem cadastro ou bloqueado: não lê nenhum dado do sistema', async () => {
  const alvos = [['config', 'sistema'], ['config', 'escalas'], ['colaboradores', 'RECEBIMENTO'], ['semanas', SEM], ['b_semanas', SEM_B1],
    ['gestao', 'colaboradores'], ['gocorr', 'o1'], ['gassin', 'a1'], ['eq', 'cadastro'], ['eqlanc', 'l1'], ['historico', 'h1'],
    ['usuarios', 'liderRec'], ['integracao', 'senior'], ['avisos', 'liderRec']];
  for (const quem of [null, 'semPerfil', 'bloq']) for (const [c, id] of alvos) await assertFails(getDoc(doc(db(quem), c, id)));
});

// ---------------- separação por módulo ----------------
test('quem não tem o Efetivo não lê fichas, ocorrências nem assinaturas', async () => {
  for (const quem of ['liderRec', 'gestorP', 'coord', 'sup', 'liderEq']) {
    await assertFails(getDoc(doc(db(quem), 'gocorr', 'o1')));
    await assertFails(getDoc(doc(db(quem), 'gassin', 'a1')));
    await assertFails(getDoc(doc(db(quem), 'gestao', 'colaboradores')));
  }
});
test('cada módulo só é lido por quem tem o módulo', async () => {
  await assertFails(getDoc(doc(db('liderEq'), 'colaboradores', 'RECEBIMENTO')));
  await assertFails(getDoc(doc(db('liderG'), 'eq', 'cadastro')));
  await assertFails(getDoc(doc(db('liderRec'), 'b_semanas', SEM_B1)));
  await assertFails(getDoc(doc(db('liderRec'), 'eqlanc', 'l1')));
  await assertSucceeds(getDoc(doc(db('liderEq'), 'eqlanc', 'l1')));
  await assertSucceeds(getDoc(doc(db('sup'), 'b_semanas', SEM_B1)));
});

// ---------------- Efetivo: ocorrências e assinaturas ----------------
test('Efetivo: líder registra ocorrência em nome próprio e só muda a situação da assinatura', async () => {
  const d = db('liderG');
  await assertSucceeds(getDoc(doc(d, 'gocorr', 'o1')));
  await assertSucceeds(setDoc(doc(d, 'gocorr', 'nova1'), { area: 'RECEBIMENTO', criadoPor: 'liderG', status: 'pendente', desc: 'x' }));
  await assertFails(setDoc(doc(d, 'gocorr', 'nova2'), { area: 'RECEBIMENTO', criadoPor: 'outro', status: 'pendente', desc: 'x' }));
  await assertFails(setDoc(doc(d, 'gocorr', 'nova4'), { area: 'PREPARAÇÃO', criadoPor: 'liderG', status: 'pendente', desc: 'x' }));
  await assertFails(setDoc(doc(d, 'gocorr', 'nova5'), { criadoPor: 'liderG', status: 'pendente', desc: 'x' }));
  await assertSucceeds(updateDoc(doc(d, 'gocorr', 'o1'), { status: 'assinada' }));
  await assertFails(updateDoc(doc(d, 'gocorr', 'o1'), { desc: 'texto trocado' }));
  await assertFails(deleteDoc(doc(d, 'gocorr', 'o1')));
  await assertSucceeds(deleteDoc(doc(db('gestorG'), 'gocorr', 'o2')));
});
test('Efetivo: somente leitura consulta e não registra nada', async () => {
  const d = db('leitorG');
  await assertSucceeds(getDoc(doc(d, 'gocorr', 'o1')));
  await assertFails(setDoc(doc(d, 'gocorr', 'nova3'), { area: 'RECEBIMENTO', criadoPor: 'leitorG', status: 'pendente' }));
  await assertFails(setDoc(doc(d, 'gassin', 'nova3'), { area: 'RECEBIMENTO', por: 'leitorG' }));
});
test('Efetivo: assinatura gravada não muda; só o administrador apaga', async () => {
  await assertFails(updateDoc(doc(db('admin'), 'gassin', 'a1'), { metodo: 'papel' }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'gassin', 'a1'), { area: 'RECEBIMENTO' }));
  await assertFails(updateDoc(doc(db('liderG'), 'gassin', 'a1'), { area: 'PREPARAÇÃO' }));
  await assertFails(updateDoc(doc(db('liderG'), 'gassin', 'a1'), { metodo: 'papel' }));
  await assertFails(deleteDoc(doc(db('liderG'), 'gassin', 'a1')));
  await assertFails(deleteDoc(doc(db('gestorG'), 'gassin', 'a1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'gassin', 'a2')));
});

// ---------------- Atividades: áreas ----------------
test('Atividades: líder aponta só na própria área e não muda a área da semana', async () => {
  await assertSucceeds(updateDoc(doc(db('liderRec'), 'semanas', SEM), { s: { 'REC-001': 'R______' } }));
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', SEM_PREP), { s: { 'PRE-001': 'R______' } }));
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', SEM), { area: 'PREPARAÇÃO' }));
  await assertFails(setDoc(doc(db('liderRec'), 'semanas', 'RECEBIMENTO|2026-10-19'), { area: 'RECEBIMENTO', s: {} }));
  await assertSucceeds(updateDoc(doc(db('coord'), 'semanas', SEM_PREP), { s: { 'PRE-001': 'R______' } }));
  await assertSucceeds(updateDoc(doc(db('sup'), 'b_semanas', SEM_B1), { s: { 'B1-001': 'R______' } }));
});
test('Atividades: foto só na própria área, em nome próprio, e no máximo 6 por atividade no dia', async () => {
  const ev = (semana, extra = {}) => ({ semana, area: 'RECEBIMENTO', pid: 'REC-001', k: 2, por: 'liderRec', thumb: 'x', ...extra });
  await assertSucceeds(setDoc(doc(db('liderRec'), 'evidencias', 'e1'), ev(SEM)));
  await assertFails(setDoc(doc(db('liderRec'), 'evidencias', 'e2'), ev(SEM_CHEIA)));
  await assertFails(setDoc(doc(db('liderRec'), 'evidencias', 'e3'), ev(SEM, { por: 'outro' })));
  await assertFails(setDoc(doc(db('liderPrep'), 'evidencias', 'e4'), ev(SEM, { por: 'liderPrep' })));
});

// ---------------- histórico, integração e avisos ----------------
test('histórico: cada um registra só em nome próprio e ninguém altera', async () => {
  await assertSucceeds(setDoc(doc(db('liderRec'), 'historico', 'h2'), { at: serverTimestamp(), uid: 'liderRec', nome: 'x', t: 'y' }));
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), { at: serverTimestamp(), uid: 'admin', nome: 'x', t: 'y' }));
  await assertFails(updateDoc(doc(db('admin'), 'historico', 'h1'), { t: 'z' }));
  await assertFails(deleteDoc(doc(db('admin'), 'historico', 'h1')));
});
test('integração com o Senior: só o administrador lê', async () => {
  await assertFails(getDoc(doc(db('gestorG'), 'integracao', 'senior')));
  await assertSucceeds(getDoc(doc(db('admin'), 'integracao', 'senior')));
});
test('avisos no celular: cada um vê só os próprios aparelhos', async () => {
  await assertSucceeds(getDoc(doc(db('liderRec'), 'avisos', 'liderRec')));
  await assertFails(getDoc(doc(db('liderPrep'), 'avisos', 'liderRec')));
  await assertFails(setDoc(doc(db('liderPrep'), 'avisos', 'liderRec'), { tokens: ['x'] }));
});
test('escalas: todos os ativos leem; só administrador e gestor alteram', async () => {
  await assertSucceeds(getDoc(doc(db('leitorG'), 'config', 'escalas')));
  await assertFails(setDoc(doc(db('liderRec'), 'config', 'escalas'), { x: 1 }));
  await assertFails(setDoc(doc(db('coord'), 'config', 'escalas'), { x: 1 }));
  await assertSucceeds(setDoc(doc(db('gestorP'), 'config', 'escalas'), { x: 1 }));
});

// ---------------- Efetivo por área ----------------
const ids = async (q) => (await getDocs(q)).docs.map(d => d.id).sort();
test('fichas por área: líder lê só a lista da área dele; supervisor as duas; quem tem a Operação lê os operadores', async () => {
  await assertSucceeds(getDoc(doc(db('liderG'), 'gcolab', 'RECEBIMENTO')));
  for (const a of ['PREPARAÇÃO', 'BATERIA 1', 'OPERAÇÃO DE EQUIPAMENTOS', 'GERAL']) await assertFails(getDoc(doc(db('liderG'), 'gcolab', a)));
  await assertSucceeds(getDoc(doc(db('supG'), 'gcolab', 'BATERIA 1')));
  await assertFails(getDoc(doc(db('supG'), 'gcolab', 'PREPARAÇÃO')));
  await assertSucceeds(getDoc(doc(db('liderGEq'), 'gcolab', 'OPERAÇÃO DE EQUIPAMENTOS')));
  await assertFails(getDoc(doc(db('liderGEq'), 'gcolab', 'RECEBIMENTO')));
  await assertFails(getDocs(collection(db('liderG'), 'gcolab')));
  await assertFails(getDoc(doc(db('liderRec'), 'gcolab', 'RECEBIMENTO')));
});
test('fichas por área: administrador, gestor, coordenador e somente leitura (com o Efetivo) leem todas; só a administração grava', async () => {
  for (const quem of ['admin', 'gestorG', 'coordG', 'leitorG']) await assertSucceeds(getDocs(collection(db(quem), 'gcolab')));
  await assertFails(getDocs(collection(db('gestorP'), 'gcolab')));
  await assertFails(setDoc(doc(db('liderG'), 'gcolab', 'RECEBIMENTO'), { itens: [] }));
  await assertFails(setDoc(doc(db('coordG'), 'gcolab', 'RECEBIMENTO'), { itens: [] }));
  await assertSucceeds(setDoc(doc(db('gestorG'), 'gcolab', 'RECEBIMENTO'), { itens: [{ mat: 'REC', nome: 'Pessoa RECEBIMENTO' }] }));
  await assertFails(getDoc(doc(db('liderG'), 'gestao', 'colaboradores')));
  await assertSucceeds(getDoc(doc(db('liderG'), 'gestao', 'config')));
});
test('ocorrências por área: líder lê a área dele, as que registrou e as que vai recolher; nada além', async () => {
  const d = db('liderG');
  await assertSucceeds(getDoc(doc(d, 'gocorr', 'rec1')));
  await assertSucceeds(getDoc(doc(d, 'gocorr', 'pre2')));
  await assertSucceeds(getDoc(doc(d, 'gocorr', 'pre3')));
  for (const id of ['pre1', 'b1', 'op1', 'ger1']) await assertFails(getDoc(doc(d, 'gocorr', id)));
  await assertFails(getDocs(collection(d, 'gocorr')));
  assert.deepEqual(await ids(query(collection(d, 'gocorr'), where('area', '==', 'RECEBIMENTO'))), ['nova1', 'o1', 'rec1']); // nova1: criada no teste do Efetivo acima
  await assertFails(getDocs(query(collection(d, 'gocorr'), where('area', '==', 'PREPARAÇÃO'))));
  assert.deepEqual(await ids(query(collection(d, 'gocorr'), where('criadoPor', '==', 'liderG'))), ['nova1', 'o1', 'pre2']); // o2 foi apagada no teste do Efetivo acima
  assert.deepEqual(await ids(query(collection(d, 'gocorr'), where('recolhe', '==', 'LÍDER GESTÃO'))), ['pre3']);
  await assertFails(getDocs(query(collection(d, 'gocorr'), where('recolhe', '==', 'OUTRA PESSOA'))));
});
test('ocorrências por área: supervisor lê as duas áreas; operação de equipamentos lê os operadores; quem vê tudo lê tudo', async () => {
  await assertSucceeds(getDocs(query(collection(db('supG'), 'gocorr'), where('area', '==', 'BATERIA 1'))));
  await assertFails(getDoc(doc(db('supG'), 'gocorr', 'pre1')));
  await assertSucceeds(getDoc(doc(db('liderGEq'), 'gocorr', 'op1')));
  await assertFails(getDoc(doc(db('liderGEq'), 'gocorr', 'rec1')));
  for (const quem of ['admin', 'gestorG', 'coordG', 'leitorG']) await assertSucceeds(getDocs(collection(db(quem), 'gocorr')));
});
test('ocorrências por área: líder não assina nem muda ocorrência de outra área', async () => {
  await assertFails(updateDoc(doc(db('liderG'), 'gocorr', 'pre1'), { status: 'assinada' }));
  await assertSucceeds(updateDoc(doc(db('liderG'), 'gocorr', 'pre3'), { status: 'assinada' }));
  await assertFails(updateDoc(doc(db('liderG'), 'gocorr', 'rec1'), { area: 'PREPARAÇÃO' }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'gocorr', 'rec1'), { area: 'RECEBIMENTO' }));
});
test('assinaturas por área: líder lê as da área dele e as que ele colheu', async () => {
  await assertSucceeds(getDoc(doc(db('liderG'), 'gassin', 'arec')));
  await assertSucceeds(getDoc(doc(db('liderG'), 'gassin', 'a1')));
  await assertFails(getDoc(doc(db('liderG'), 'gassin', 'apre')));
  await assertSucceeds(getDoc(doc(db('leitorG'), 'gassin', 'apre')));
  await assertSucceeds(setDoc(doc(db('liderG'), 'gassin', 'nova9'), { area: 'RECEBIMENTO', por: 'liderG', metodo: 'tela' }));
  await assertFails(setDoc(doc(db('liderG'), 'gassin', 'nova10'), { por: 'liderG', metodo: 'tela' }));
});
test('avisos: só o administrador acompanha o resultado da rotina', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'avisos_enviados', 'estado'), { enviados: {} }); });
  await assertSucceeds(getDoc(doc(db('admin'), 'avisos_enviados', 'estado')));
  await assertFails(getDoc(doc(db('gestorG'), 'avisos_enviados', 'estado')));
  await assertFails(setDoc(doc(db('admin'), 'avisos_enviados', 'estado'), { enviados: {} }));
});
