// Testes das regras de segurança do Firestore (firestore.rules), no emulador do Firebase.
// Rodam sozinhos no GitHub antes de cada publicação. Se algum falhar, nada é publicado.
// Cada teste diz, em português, o que é garantido. Para rodar no computador: veja testes/LEIA-ME.md.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { acessoDoLegado } from './legado.mjs';
import { doc, getDoc, getDocs, setDoc as setDoc0, updateDoc as updateDoc0, deleteDoc, collection, query, where, orderBy, limit, serverTimestamp, writeBatch as writeBatch0, Timestamp, deleteField, increment, arrayUnion, FieldPath } from 'firebase/firestore';

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
  bloq: { papel: 'bloqueado', modulos: ['operacao', 'bateria', 'equipamentos', 'gestao'] },
  admAn: { papel: 'supervisor', modulos: [], acessos: ['administrativo'] },
  admLeitor: { papel: 'leitor', acessos: ['administrativo'] },
  gestorSoAdm: { papel: 'gestor', modulos: ['operacao', 'gestao'], acessos: ['administrativo'] },
  liderAmbos: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'], acessos: ['operacao', 'administrativo'] },
  freqSo: { papel: 'supervisor', modulos: ['frequencia'] },
  freqLeitor: { papel: 'leitor', modulos: ['operacao', 'frequencia'] },
  admv: { papel: 'administrativo', modulos: ['operacao', 'gestao'], nome: 'Assistente Adm' },
  admvSo: { papel: 'administrativo', modulos: [] },
  // Já com o acesso por módulo (fase 1): os campos antigos gravados junto (legadoDoAcesso) continuam valendo.
  liderNovo: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], acesso: { operacao: 'lider', gestao: 'lider' }, escopos: ['patio'], nome: 'Líder Novo' },
  segReg: { papel: 'leitor', modulos: ['seguranca'], acesso: { seguranca: 'registra' }, escopos: [] },
  // Fase 2: o perfil de cada módulo vale nas regras. Os campos antigos (papel, modulos) vão como a tela grava
  // (legadoDoAcesso: papel = o mais alto), para provar que as regras olham o acesso, não o papel único.
  opLiderGeLeitor: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'], acesso: { operacao: 'lider', gestao: 'leitor' }, escopos: ['patio'], nome: 'Misto' },
  opLiderGeSup: { papel: 'supervisor', area: 'RECEBIMENTO', area2: 'PREPARAÇÃO', modulos: ['operacao', 'gestao'], acesso: { operacao: 'lider', gestao: 'supervisor' }, escopos: ['patio'], nome: 'Misto Sup' },
  rhSo: { papel: 'administrativo', modulos: ['frequencia'], acesso: { rh: 'administrativo' }, escopos: [] },
  rhLeitorNovo: { papel: 'leitor', modulos: ['frequencia'], acesso: { rh: 'leitor' }, escopos: [] },
  admModulo: { papel: 'gestor', modulos: ['operacao', 'gestao'], acesso: { gestao: 'gestor', administracao: 'modulo' }, escopos: ['patio'] },
  admModSemGestor: { papel: 'gestor', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], acesso: { gestao: 'supervisor', administracao: 'modulo' }, escopos: ['patio'] },
  eqGeLeitor: { papel: 'leitor', modulos: ['equipamentos'], acesso: { gestao: 'leitor' }, escopos: ['equipamentos'] },
  eqGeSup: { papel: 'supervisor', modulos: ['equipamentos'], acesso: { gestao: 'supervisor' }, escopos: ['equipamentos'] },
  eqOpLider: { papel: 'lider', modulos: ['equipamentos'], acesso: { operacao: 'lider' }, escopos: ['equipamentos'] },
  eqOpLider2: { papel: 'lider', modulos: ['equipamentos'], acesso: { operacao: 'lider' }, escopos: ['equipamentos'] },
  eqOpSup: { papel: 'supervisor', modulos: ['equipamentos'], acesso: { operacao: 'supervisor' }, escopos: ['equipamentos'] },
  // Fase 3 (Segurança): perfis da Segurança e supervisores de área (Operação · Supervisor) sem perfil na Segurança.
  segReg2: { papel: 'leitor', modulos: ['seguranca'], acesso: { seguranca: 'registra' }, escopos: [] },
  segTrata: { papel: 'leitor', modulos: ['seguranca'], acesso: { seguranca: 'trata' }, escopos: [] },
  segGestor: { papel: 'leitor', modulos: ['seguranca'], acesso: { seguranca: 'gestor' }, escopos: [] },
  // Histórico de alterações: Gestor de um módulo só.
  opGestorSo: { papel: 'gestor', modulos: ['operacao'], acesso: { operacao: 'gestor' }, escopos: ['patio'] },
  geGestorSo: { papel: 'gestor', modulos: ['gestao'], acesso: { gestao: 'gestor' }, escopos: [] },
  segLeitor: { papel: 'leitor', modulos: ['seguranca'], acesso: { seguranca: 'leitor' }, escopos: [] },
  supPatio: { papel: 'supervisor', area: 'PREPARAÇÃO', area2: null, modulos: ['operacao', 'gestao'], acesso: { operacao: 'supervisor', gestao: 'supervisor' }, escopos: ['patio'] },
  supBat: { papel: 'supervisor', area: 'BATERIA 1', modulos: ['bateria'], acesso: { operacao: 'supervisor' }, escopos: ['bateria'] },
  tecPatio: { papel: 'leitor', modulos: ['operacao'], acesso: { operacao: 'tecnico' }, escopos: ['patio'] },
  tecBat: { papel: 'leitor', modulos: ['bateria'], acesso: { operacao: 'tecnico' }, escopos: ['bateria'] },
  // Supervisor com várias áreas (lista areas; area e area2 guardam as duas primeiras, como a tela grava).
  supVarias: { papel: 'supervisor', area: 'RECEBIMENTO', area2: 'PREPARAÇÃO', areas: ['RECEBIMENTO', 'PREPARAÇÃO', 'BATERIA 1'], modulos: ['operacao', 'bateria', 'gestao'], acesso: { operacao: 'supervisor', gestao: 'supervisor' }, escopos: ['patio', 'bateria'] },
  liderComLista: { papel: 'lider', area: 'RECEBIMENTO', areas: ['RECEBIMENTO', 'PREPARAÇÃO'], modulos: ['operacao', 'gestao'], acesso: { operacao: 'lider', gestao: 'lider' }, escopos: ['patio'] },
  supSemArea: { papel: 'supervisor', area: 'BATERIA 1', modulos: ['operacao'], acesso: { operacao: 'supervisor' }, escopos: ['patio'] },
  admModSeg: { papel: 'gestor', modulos: ['seguranca'], acesso: { seguranca: 'gestor', administracao: 'modulo' }, escopos: [] },
  bloqNovo: { papel: 'bloqueado', modulos: ['operacao', 'gestao'], acesso: { operacao: 'gestor', gestao: 'gestor', rh: 'administrativo', administracao: 'admin' }, escopos: ['patio', 'bateria', 'equipamentos'] },
  // Cadastro só no modelo antigo (sem o campo acesso): não vale mais nada. Os demais usuários escritos acima no
  // modelo antigo ganham o acesso por módulo como a conversão gravou nos cadastros reais (testes/legado.mjs).
  soAntigo: { papel: 'gestor', area: 'RECEBIMENTO', modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'], semConverter: true },
  soAntigoAdmin: { papel: 'admin', semConverter: true }
};
for (const [k, u] of Object.entries(USUARIOS)) {
  if (u.semConverter) { const { semConverter, ...x } = u; USUARIOS[k] = x; continue; }
  if (!u.acesso) { const r = acessoDoLegado(u); USUARIOS[k] = { ...u, acesso: r.acesso, escopos: r.escopos }; }
}
// Lançamento, parada e inspeção de equipamento válidos, em nome de quem grava (por) com a hora do servidor (em).
const LANC = por => ({ data: '2026-10-20', mes: '2026-10', eq: 'CB-01', tipo: 'CARREGADEIRA', op: 'OPERADOR TESTE', area: 'PÁTIO', setor: null, status: 'EM OPERAÇÃO', ini: '07:00', fim: null, he: 0, heOrigem: '', sub: '', obs: '', por, em: serverTimestamp() });
const PAR = por => ({ data: '2026-10-20', mes: '2026-10', eq: 'CB-01', op: 'OPERADOR TESTE', ini: '09:00', fim: null, causa: 'MECÂNICA', desc: 'VAZAMENTO', os: '123', por, em: serverTimestamp() });
const INSP = por => ({ data: '2026-10-20', mes: '2026-10', eq: 'CB-01', op: 'OPERADOR TESTE', itens: { a1: 'C', s1: 'NC' }, p5s: 1, pseg: 0, inspetor: 'INSPETOR', obs: '', por, em: serverTimestamp() });
const SEM = 'RECEBIMENTO|2026-10-05', SEM_PREP = 'PREPARAÇÃO|2026-10-05', SEM_CHEIA = 'RECEBIMENTO|2026-10-12', SEM_B1 = 'BATERIA 1|2026-10-05';

// db('liderRec') = banco visto por essa pessoa; db(null) = sem login; db('semPerfil') = conta sem cadastro no sistema
const UID = new WeakMap();   // banco de cada usuário → uid (para a marca de quem gravou)
const db = uid => { if (!uid) return env.unauthenticatedContext().firestore(); const f = env.authenticatedContext(uid).firestore(); UID.set(f, uid); if (f._delegate) UID.set(f._delegate, uid); return f; };
// Quem gravou e quando: o site (nucleo/data.js › marca) manda atualizadoPor e atualizadoEm em toda gravação das coleções
// principais. Estas versões de setDoc, updateDoc e writeBatch fazem o mesmo, como o site; o teste "quem gravou e
// quando" usa as originais (setDoc0, updateDoc0) para provar que sem a marca, ou com outra pessoa, o banco recusa.
const COM_MARCA = /^((b_)?(semanas|situacao|colaboradores)|gcolab|gocorr)$/;
const marcaDe = ref => { const uid = UID.get(ref.firestore); return uid && COM_MARCA.test(ref.parent.id) ? { atualizadoPor: uid, atualizadoEm: serverTimestamp() } : null; };
const comMarca = (ref, data, criar) => { const m = marcaDe(ref); if (!m) return data; return { ...data, ...m, ...(criar && ref.parent.id === 'gocorr' && !('criadoEm' in data) ? { criadoEm: serverTimestamp() } : {}) }; };
const argsUpd = (ref, args) => { const m = marcaDe(ref); if (!m) return args; return typeof args[0] === 'string' || args[0] instanceof FieldPath ? [...args, 'atualizadoPor', m.atualizadoPor, 'atualizadoEm', m.atualizadoEm] : [{ ...args[0], ...m }]; };
const setDoc = (ref, data, opt) => (opt ? setDoc0(ref, comMarca(ref, data, true), opt) : setDoc0(ref, comMarca(ref, data, true)));
const updateDoc = (ref, ...args) => updateDoc0(ref, ...argsUpd(ref, args));
const writeBatch = f => { const b = writeBatch0(f); const set = b.set.bind(b), upd = b.update.bind(b);
  b.set = (ref, data, opt) => (opt ? set(ref, comMarca(ref, data, true), opt) : set(ref, comMarca(ref, data, true)));
  b.update = (ref, ...args) => upd(ref, ...argsUpd(ref, args)); return b; };

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
    for (const [uid, u] of Object.entries(USUARIOS)) { const x = { nome: uid, login: uid.toLowerCase(), area: null, ...u }; await setDoc(doc(d, 'usuarios', uid), { ...x, nomeUp: x.nome.toUpperCase() }); }
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
    await semearSeguranca(d);
  });
});
after(async () => { if (env) await env.cleanup(); });

// ---------------- administrador e cadastro ----------------
test('cadastro só no modelo antigo (sem o campo acesso) não abre nenhum módulo, nem com papel admin', async () => {
  for (const uid of ['soAntigo', 'soAntigoAdmin']) {
    const d = db(uid);
    await assertSucceeds(getDoc(doc(d, 'usuarios', uid)), 'lê o próprio cadastro');
    await assertFails(getDoc(doc(d, 'semanas', SEM)));
    await assertFails(getDoc(doc(d, 'b_semanas', SEM_B1)));
    await assertFails(getDoc(doc(d, 'gestao', 'colaboradores')));
    await assertFails(getDoc(doc(d, 'eq', 'cadastro')));
    await assertFails(getDoc(doc(d, 'config', 'sistema')));
    await assertFails(updateDoc(doc(d, 'semanas', SEM), { s: { x: 1 } }));
    await assertFails(getDoc(doc(d, 'usuarios', 'liderRec')));
    await assertFails(getDoc(doc(d, 'seeds', 'seed')));
  }
});
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
  await assertSucceeds(getDoc(doc(db('freqLeitor'), 'eqlanc', 'l1')), 'a Frequência lê os lançamentos (hora extra da Operação entra na folha)');
  await assertFails(setDoc(doc(db('freqLeitor'), 'eqlanc', 'l2'), { mes: '2026-10' }), 'a Frequência só lê');
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
test('Queda zero: quem aponta na área grava e apaga; outra área e quem só lê não', async () => {
  const v = { i: [{ e: 'pa', p: 'coque', q: 3 }], t: 0.024 };
  await assertSucceeds(updateDoc(doc(db('liderRec'), 'semanas', SEM), { 'qz.REC-001|2': v }));
  await assertSucceeds(updateDoc(doc(db('liderRec'), 'semanas', SEM), { 'qz.REC-001|2': deleteField() }));
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', SEM_PREP), { 'qz.PRE-001|2': v }));
  await assertFails(updateDoc(doc(db('leitorG'), 'semanas', SEM), { 'qz.REC-001|2': v }));
  await assertSucceeds(updateDoc(doc(db('sup'), 'b_semanas', SEM_B1), { 'qz.B1-001|2': v }));
});
test('Atividades: fora da programação só pelo coordenador e pelo supervisor da área', async () => {
  const fp = (pid, k) => ({ [`fp.${pid}|${k}`]: { por: 'x', nome: 'X', em: '2026-10-21' } });
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', SEM), { 's.REC-001': 'P______', ...fp('REC-001', 0) }));
  await assertSucceeds(updateDoc(doc(db('coord'), 'semanas', SEM_PREP), { 's.PRE-001': 'P______', ...fp('PRE-001', 0) }));
  await assertSucceeds(updateDoc(doc(db('sup'), 'semanas', SEM), { 's.REC-002': 'P______', ...fp('REC-002', 0) }));
  await assertFails(updateDoc(doc(db('sup'), 'semanas', SEM_PREP), { 's.PRE-002': 'P______', ...fp('PRE-002', 0) }));
  await assertSucceeds(updateDoc(doc(db('sup'), 'b_semanas', SEM_B1), { 's.B1-002': 'P______', ...fp('B1-002', 0) }));
  await assertFails(updateDoc(doc(db('leitorG'), 'semanas', SEM), { 's.REC-003': 'P______', ...fp('REC-003', 0) }));
});
// ---------------- Fotos das atividades (evidencias + evidenciasArquivo, no mesmo lote do apontamento) ----------------
const SHA = 'ab'.repeat(32);
const fotoMeta = (extra = {}) => ({
  refs: [`${SEM}|REC-001|2`, `${SEM}|REC-002|2`], semana: SEM, area: 'RECEBIMENTO', conj: 'patio', pid: 'REC-001', k: 2, dia: '2026-10-07', mes: '2026-10',
  rota: 'ROTA 1', sit: 'R', local: 'Pátio', ativ: '2 atividades: a; b', nome: 'foto.jpg', tipo: 'image/jpeg', tamanho: 120000, bytes: 120000, w: 1280, h: 960,
  sha: SHA, thumb: 'data:image/jpeg;base64,' + 'A'.repeat(2000), por: 'liderRec', porNome: 'Líder', at: serverTimestamp(),
  exportadoEm: null, exportLote: null, lixeiraEm: null, removidaEm: null, ...extra
});
const fotoArq = (extra = {}) => ({ area: 'RECEBIMENTO', semana: SEM, dia: '2026-10-07', sha: SHA, por: 'liderRec', dados: 'data:image/jpeg;base64,' + 'A'.repeat(5000), ...extra });
// Grava como o aparelho grava: semana (s e ft) + leve + arquivo num lote só.
function gravarFoto(uid, id, { meta = fotoMeta(), arq = fotoArq(), pre = '', sem = SEM, pid = 'REC-001' } = {}) {
  const d = db(uid); const b = writeBatch(d);
  b.update(doc(d, pre + 'semanas', sem), { [`s.${pid}`]: '__R____', [`ft.${pid}|2`]: increment(1), atualizadoPor: uid });
  if (meta) b.set(doc(d, pre + 'evidencias', id), meta);
  if (arq) b.set(doc(d, pre + 'evidenciasArquivo', id), arq);
  return b.commit();
}
test('Fotos: o líder grava o apontamento com a foto na área dele (um lote só) e todos que leem as semanas veem', async () => {
  await assertSucceeds(gravarFoto('liderRec', 'f1'));
  await assertSucceeds(getDoc(doc(db('liderRec'), 'evidencias', 'f1')));
  await assertSucceeds(getDoc(doc(db('freqLeitor'), 'evidenciasArquivo', 'f1')));
  await assertSucceeds(getDocs(query(collection(db('liderPrep'), 'evidencias'), where('refs', 'array-contains', `${SEM}|REC-001|2`))));
  await assertFails(getDoc(doc(db('segReg'), 'evidencias', 'f1')));
  // juntar foto depois (só a contagem ft e as fotos, sem mudar a situação)
  const d = db('liderRec'); const b = writeBatch(d);
  b.update(doc(d, 'semanas', SEM), { 'ft.REC-001|2': increment(1) });
  b.set(doc(d, 'evidencias', 'f1b'), fotoMeta({ refs: [`${SEM}|REC-001|2`] })); b.set(doc(d, 'evidenciasArquivo', 'f1b'), fotoArq());
  await assertSucceeds(b.commit());
});
test('Queda zero com fotos: o líder grava o lançamento e as fotos num lote só (sem ft) e apaga foto e lançamento', async () => {
  const key = 'Z|2|0000abcde00'; const pid = 'QZ-0000abcde00';
  const v = { i: [{ e: 'pa', p: 'coque', q: 3 }], t: 0.024, f: 1 };
  const d = db('liderRec'); const b = writeBatch(d);
  b.update(doc(d, 'semanas', SEM), { [`qz.${key}`]: v, atualizadoPor: 'liderRec' });
  b.set(doc(d, 'evidencias', 'qzf1'), fotoMeta({ refs: [`${SEM}|${pid}|2`], pid, sit: '', ativ: 'Queda zero: 0,024 t' }));
  b.set(doc(d, 'evidenciasArquivo', 'qzf1'), fotoArq());
  await assertSucceeds(b.commit());
  await assertSucceeds(getDocs(query(collection(db('sup'), 'evidencias'), where('refs', 'array-contains', `${SEM}|${pid}|2`))));
  // o supervisor não apaga foto; o líder apaga a foto e o lançamento juntos
  const apagar = uid => { const x = db(uid); const c = writeBatch(x); c.delete(doc(x, 'evidencias', 'qzf1')); c.delete(doc(x, 'evidenciasArquivo', 'qzf1')); c.update(doc(x, 'semanas', SEM), { [`qz.${key}`]: deleteField(), atualizadoPor: uid }); return c.commit(); };
  await assertFails(apagar('sup'));
  await assertSucceeds(apagar('liderRec'));
});
test('Fotos: ninguém grava foto em outra área, em nome de outro, nem com a área diferente da semana', async () => {
  await assertFails(gravarFoto('liderPrep', 'f2', { meta: fotoMeta({ por: 'liderPrep' }), arq: fotoArq({ por: 'liderPrep' }) }));
  await assertFails(gravarFoto('liderRec', 'f3', { meta: fotoMeta({ por: 'outro' }), arq: fotoArq({ por: 'outro' }) }));
  await assertFails(gravarFoto('liderRec', 'f4', { meta: fotoMeta({ area: 'PREPARAÇÃO', semana: SEM_PREP }), arq: fotoArq({ area: 'PREPARAÇÃO', semana: SEM_PREP }), sem: SEM_PREP, pid: 'PRE-001' }));
  // área RECEBIMENTO declarada, mas a semana é da Preparação
  await assertFails(setDoc(doc(db('liderRec'), 'evidencias', 'f5'), fotoMeta({ semana: SEM_PREP })));
  await assertFails(gravarFoto('liderRec', 'f6', { pre: 'b_', sem: SEM_B1, pid: 'B1-001' }));
});
test('Fotos: quem só lê (leitor) e quem não aponta não gravam foto', async () => {
  for (const u of ['freqLeitor', 'leitorG', 'segReg', 'admLeitor']) await assertFails(gravarFoto(u, 'fl-' + u, { meta: fotoMeta({ por: u }), arq: fotoArq({ por: u }) }), u);
  for (const u of ['freqLeitor', 'leitorG']) await assertFails(setDoc(doc(db(u), 'evidencias', 'fl2-' + u), fotoMeta({ por: u })), u);
});
test('Fotos: campos obrigatórios, tamanhos e campos de exportação vazios na criação', async () => {
  const sem = ({ sha, ...m }) => m;
  await assertFails(gravarFoto('liderRec', 'g1', { meta: sem(fotoMeta()) }));
  await assertFails(gravarFoto('liderRec', 'g2', { meta: fotoMeta({ thumb: 'x'.repeat(40001) }) }));
  await assertSucceeds(gravarFoto('liderRec', 'g3', { meta: fotoMeta({ thumb: 'x'.repeat(39000) }) }));
  await assertFails(gravarFoto('liderRec', 'g4', { arq: fotoArq({ dados: 'x'.repeat(900001) }) }));
  await assertFails(gravarFoto('liderRec', 'g5', { meta: fotoMeta({ exportadoEm: '2026-10-08' }) }));
  await assertFails(gravarFoto('liderRec', 'g6', { meta: fotoMeta({ lixeiraEm: '2026-10-08' }) }));
  await assertFails(gravarFoto('liderRec', 'g7', { meta: fotoMeta({ refs: [] }) }));
  await assertFails(gravarFoto('liderRec', 'g8', { meta: fotoMeta({ mes: '2026-11' }) }));
  await assertFails(gravarFoto('liderRec', 'g9', { meta: fotoMeta({ outroCampo: 1 }) }));
  await assertFails(gravarFoto('liderRec', 'g10', { meta: fotoMeta({ sha: 'nao-e-hash' }) }));
  // arquivo sem o documento leve (foto solta) e leve sem o arquivo
  await assertFails(gravarFoto('liderRec', 'g11', { meta: null }));
  await assertSucceeds(gravarFoto('liderRec', 'g12', { arq: null })); // leve sozinho passa; o aparelho sempre grava os dois juntos
});
test('Fotos: o autor só ajusta refs (24 h); exportação, lixeira e remoção só o administrador; apagar só o administrador', async () => {
  await assertSucceeds(gravarFoto('liderRec', 'h1'));
  await assertSucceeds(updateDoc(doc(db('liderRec'), 'evidencias', 'h1'), { refs: [`${SEM}|REC-001|2`], atualizadoEm: serverTimestamp(), atualizadoPor: 'liderRec' }));
  await assertFails(updateDoc(doc(db('liderRec'), 'evidencias', 'h1'), { refs: [] }));
  for (const campo of ['exportadoEm', 'exportLote', 'lixeiraEm', 'removidaEm']) {
    for (const u of ['liderRec', 'sup', 'coord', 'gestorP', 'admModulo']) await assertFails(updateDoc(doc(db(u), 'evidencias', 'h1'), { [campo]: 'x' }), `${u} ${campo}`);
    await assertSucceeds(updateDoc(doc(db('admin'), 'evidencias', 'h1'), { [campo]: campo === 'exportLote' ? 'lote-1' : serverTimestamp() }));
  }
  await assertFails(updateDoc(doc(db('liderRec'), 'evidencias', 'h1'), { thumb: 'y' }));
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'h1'), { thumb: 'y' }));
  await assertFails(updateDoc(doc(db('liderRec'), 'evidenciasArquivo', 'h1'), { dados: 'y' }));
  // depois de 24 h o autor não ajusta mais
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'evidencias', 'h2'), { ...fotoMeta(), at: Timestamp.fromMillis(Date.now() - 3 * 864e5) }); });
  await assertFails(updateDoc(doc(db('liderRec'), 'evidencias', 'h2'), { refs: [`${SEM}|REC-001|2`] }));
  // h1 já foi exportada (laço acima): o líder não apaga mais; os outros perfis nunca apagam
  for (const u of ['liderRec', 'sup', 'gestorP', 'admModulo']) { await assertFails(deleteDoc(doc(db(u), 'evidencias', 'h1')), u); await assertFails(deleteDoc(doc(db(u), 'evidenciasArquivo', 'h1')), u); }
  await assertSucceeds(deleteDoc(doc(db('admin'), 'evidenciasArquivo', 'h1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'evidencias', 'h1')));
});
test('Fotos: o líder da área apaga a foto ainda não exportada (leve + completa + ft num lote só); outros perfis não', async () => {
  await assertSucceeds(gravarFoto('liderRec', 'ap1'));
  const apagar = (uid, id, { arq = true, leve = true } = {}) => { const d = db(uid); const b = writeBatch(d); if (leve) b.delete(doc(d, 'evidencias', id)); if (arq) b.delete(doc(d, 'evidenciasArquivo', id)); b.update(doc(d, 'semanas', SEM), { 'ft.REC-001|2': increment(-1), 'ft.REC-002|2': increment(-1), atualizadoPor: uid }); return b.commit(); };
  for (const u of ['liderPrep', 'sup', 'coord', 'gestorP', 'admModulo', 'freqLeitor']) await assertFails(apagar(u, 'ap1'), u);
  // a foto completa sozinha (sem o leve) o líder não apaga
  await assertFails(apagar('liderRec', 'ap1', { leve: false }));
  await assertSucceeds(apagar('liderRec', 'ap1'));
  // o administrador apaga qualquer uma, também a já exportada
  await assertSucceeds(gravarFoto('liderRec', 'ap2'));
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'evidencias', 'ap2'), { exportadoEm: Timestamp.now(), exportLote: 'L' }); });
  await assertFails(apagar('liderRec', 'ap2'));
  await assertSucceeds(apagar('admin', 'ap2'));
});
test('Fotos na Bateria (b_): o supervisor grava na área dele; o líder do Pátio não', async () => {
  const meta = fotoMeta({ refs: [`${SEM_B1}|B1-001|2`], semana: SEM_B1, area: 'BATERIA 1', conj: 'bateria', pid: 'B1-001', por: 'sup' });
  const arq = fotoArq({ area: 'BATERIA 1', semana: SEM_B1, por: 'sup' });
  await assertSucceeds(gravarFoto('sup', 'b1', { pre: 'b_', sem: SEM_B1, pid: 'B1-001', meta, arq }));
  await assertFails(gravarFoto('liderRec', 'b2', { pre: 'b_', sem: SEM_B1, pid: 'B1-001', meta: { ...meta, por: 'liderRec' }, arq: { ...arq, por: 'liderRec' } }));
  await assertFails(updateDoc(doc(db('sup'), 'b_evidencias', 'b1'), { exportadoEm: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'b_evidencias', 'b1'), { exportadoEm: serverTimestamp(), exportLote: 'lote-1' }));
});
// ---- Parte 2: Relatórios e arquivo de fotos (exportar, lixeira, apagar de vez; só o administrador) ----
const marcarExp = (uid, id, extra = {}, pre = '') => updateDoc(doc(db(uid), pre + 'evidencias', id), { exportadoEm: serverTimestamp(), exportLote: 'EXP-20261110-1015-ab12', exportConf: 'ok', atualizadoEm: serverTimestamp(), atualizadoPor: uid, ...extra });
// Apagar de vez como a tela faz: apaga a foto completa e marca removidaEm no documento leve, no mesmo lote.
function apagarDeVez(uid, ids, pre = '') {
  const d = db(uid); const b = writeBatch(d);
  for (const id of ids) { b.delete(doc(d, pre + 'evidenciasArquivo', id)); b.update(doc(d, pre + 'evidencias', id), { removidaEm: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: uid }); }
  return b.commit();
}
test('Fotos (Parte 2): só o administrador marca a exportação, com lote e conferência do SHA-256 válidos', async () => {
  await assertSucceeds(gravarFoto('liderRec', 'p1'));
  for (const u of ['liderRec', 'sup', 'coord', 'gestorP', 'admModulo']) await assertFails(marcarExp(u, 'p1'), u);
  await assertFails(marcarExp('admin', 'p1', { exportLote: 'x'.repeat(61) }));
  await assertFails(marcarExp('admin', 'p1', { exportConf: 'talvez' }));
  await assertFails(marcarExp('admin', 'p1', { exportadoEm: '2026-11-10' }));
  await assertFails(marcarExp('admin', 'p1', { thumb: 'outra' }));
  await assertSucceeds(marcarExp('admin', 'p1', { exportConf: 'divergente' }));
  await assertSucceeds(marcarExp('admin', 'p1'));
  // ninguém cria foto já marcada como exportada (nem com a conferência preenchida)
  await assertFails(gravarFoto('liderRec', 'p1x', { meta: fotoMeta({ exportConf: 'ok' }) }));
});
test('Fotos (Parte 2): lixeira só da foto já exportada; restaurar volta; só o administrador', async () => {
  await assertSucceeds(gravarFoto('liderRec', 'p2'));
  const lix = (uid, v) => updateDoc(doc(db(uid), 'evidencias', 'p2'), { lixeiraEm: v, atualizadoEm: serverTimestamp(), atualizadoPor: uid });
  await assertFails(lix('admin', serverTimestamp()), 'antes de exportar');
  await assertSucceeds(marcarExp('admin', 'p2'));
  for (const u of ['liderRec', 'gestorP', 'admModulo']) await assertFails(lix(u, serverTimestamp()), u);
  await assertFails(lix('admin', 'ontem'), 'lixeiraEm precisa ser hora');
  await assertSucceeds(lix('admin', serverTimestamp()));
  await assertSucceeds(lix('admin', null)); // restaurar
  await assertSucceeds(lix('admin', serverTimestamp()));
  // tirar a marca de exportada com a foto na lixeira não pode
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'p2'), { exportadoEm: null }));
});
test('Fotos (Parte 2): apagar de vez só da lixeira, no mesmo lote que marca removidaEm; o documento leve fica e não volta', async () => {
  for (const id of ['p3', 'p4', 'p5']) await assertSucceeds(gravarFoto('liderRec', id));
  // a foto completa não sai sozinha, nem de foto que não foi exportada ou não está na lixeira
  await assertFails(deleteDoc(doc(db('admin'), 'evidenciasArquivo', 'p3')), 'sozinha');
  await assertFails(apagarDeVez('admin', ['p3']), 'não exportada');
  await assertSucceeds(marcarExp('admin', 'p3'));
  await assertFails(apagarDeVez('admin', ['p3']), 'exportada mas fora da lixeira');
  await assertFails(deleteDoc(doc(db('admin'), 'evidenciasArquivo', 'p3')), 'exportada, sozinha');
  for (const id of ['p3', 'p4']) { if (id !== 'p3') await assertSucceeds(marcarExp('admin', id)); await assertSucceeds(updateDoc(doc(db('admin'), 'evidencias', id), { lixeiraEm: serverTimestamp() })); }
  for (const u of ['liderRec', 'gestorP', 'coord', 'admModulo']) await assertFails(apagarDeVez(u, ['p3']), u);
  await assertSucceeds(apagarDeVez('admin', ['p3', 'p4']));
  const leve = await getDoc(doc(db('liderRec'), 'evidencias', 'p3'));
  assert.ok(leve.exists() && leve.data().thumb && leve.data().removidaEm, 'o documento leve fica com a miniatura e removidaEm');
  assert.equal((await getDoc(doc(db('liderRec'), 'evidenciasArquivo', 'p3'))).exists(), false, 'a foto completa saiu');
  // depois de removida, não volta: nem restaurar, nem tirar removidaEm, nem mudar a exportação
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'p3'), { lixeiraEm: null }));
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'p3'), { removidaEm: null }));
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'p3'), { exportadoEm: null, exportLote: null }));
  // removidaEm sem a foto estar na lixeira não pode (p5 só exportada)
  await assertSucceeds(marcarExp('admin', 'p5'));
  await assertFails(updateDoc(doc(db('admin'), 'evidencias', 'p5'), { removidaEm: serverTimestamp() }));
  // o apontamento (semana) não muda: a contagem ft continua
  const sem = await getDoc(doc(db('liderRec'), 'semanas', SEM));
  assert.ok(sem.data().ft['REC-001|2'] >= 1, 'ft da célula continua');
  // apagar o documento leve junto com a foto completa (limpeza total): só o administrador
  await assertFails(deleteDoc(doc(db('gestorP'), 'evidencias', 'p5')));
  const d = db('admin'); const b = writeBatch(d); b.delete(doc(d, 'evidencias', 'p5')); b.delete(doc(d, 'evidenciasArquivo', 'p5'));
  await assertSucceeds(b.commit());
});
test('Fotos (Parte 2) na Bateria (b_) e fotos antigas (só ref): o administrador exporta e arquiva', async () => {
  const meta = fotoMeta({ refs: [`${SEM_B1}|B1-001|2`], semana: SEM_B1, area: 'BATERIA 1', conj: 'bateria', pid: 'B1-001', por: 'sup' });
  const arq = fotoArq({ area: 'BATERIA 1', semana: SEM_B1, por: 'sup' });
  await assertSucceeds(gravarFoto('sup', 'pb1', { pre: 'b_', sem: SEM_B1, pid: 'B1-001', meta, arq }));
  await assertFails(apagarDeVez('admin', ['pb1'], 'b_'));
  await assertSucceeds(marcarExp('admin', 'pb1', {}, 'b_'));
  await assertFails(updateDoc(doc(db('sup'), 'b_evidencias', 'pb1'), { lixeiraEm: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'b_evidencias', 'pb1'), { lixeiraEm: serverTimestamp() }));
  await assertFails(apagarDeVez('sup', ['pb1'], 'b_'));
  await assertSucceeds(apagarDeVez('admin', ['pb1'], 'b_'));
  // foto do código antigo: só o campo ref (sem refs)
  await env.withSecurityRulesDisabled(async ctx => {
    const f = ctx.firestore(); const { refs, ...velha } = fotoMeta();
    await setDoc(doc(f, 'evidencias', 'pv1'), { ...velha, ref: `${SEM}#REC-001|2` });
    await setDoc(doc(f, 'evidenciasArquivo', 'pv1'), fotoArq());
  });
  await assertSucceeds(marcarExp('admin', 'pv1'));
  await assertSucceeds(updateDoc(doc(db('admin'), 'evidencias', 'pv1'), { lixeiraEm: serverTimestamp() }));
  await assertSucceeds(apagarDeVez('admin', ['pv1']));
});
test('Queda zero: locais e motivos novos, quem aponta cadastra e todos leem', async () => {
  const add = (u, x) => setDoc(doc(db(u), 'config', 'quedazero'), { locais: arrayUnion('C9999'), atualizadoEm: serverTimestamp(), por: 'x', ...x }, { merge: true });
  await assertSucceeds(add('liderRec'));
  await assertSucceeds(add('sup', { motivos: arrayUnion('Vazamento') }));
  await assertSucceeds(getDoc(doc(db('leitorG'), 'config', 'quedazero')));
  await assertFails(add('leitorG'));
  await assertFails(add(null));
  await assertFails(add('liderRec', { outro: 1 }));
});
test('Fotos: config/fotos todos leem; só o administrador grava, dentro dos limites', async () => {
  const cfg = (x = {}) => ({ obrig: true, min: 1, max: 3, situacoes: ['R', 'E'], desde: '2026-11-09', atualizadoEm: serverTimestamp(), por: 'Admin', ...x });
  await assertSucceeds(setDoc(doc(db('admin'), 'config', 'fotos'), cfg()));
  await assertSucceeds(getDoc(doc(db('liderRec'), 'config', 'fotos')));
  for (const u of ['gestorP', 'coord', 'sup', 'liderRec', 'admModulo']) await assertFails(setDoc(doc(db(u), 'config', 'fotos'), cfg()), u);
  await assertFails(setDoc(doc(db('admin'), 'config', 'fotos'), cfg({ max: 11 })));
  await assertFails(setDoc(doc(db('admin'), 'config', 'fotos'), cfg({ min: 0 })));
  await assertFails(setDoc(doc(db('admin'), 'config', 'fotos'), cfg({ min: 4, max: 3 })));
  await assertFails(setDoc(doc(db('admin'), 'config', 'fotos'), cfg({ situacoes: ['X'] })));
  await assertSucceeds(setDoc(doc(db('admin'), 'config', 'fotos'), cfg({ obrig: false, min: 0, situacoes: [] })));
});

// ---------------- histórico, integração e avisos ----------------
test('histórico: cada um registra só em nome próprio (nome do cadastro, hora do servidor, com o módulo), ninguém altera e só o administrador apaga', async () => {
  const h = (uid, x = {}) => ({ at: serverTimestamp(), uid, nome: uid, t: 'y', mod: 'operacao', ...x });
  await assertSucceeds(setDoc(doc(db('liderRec'), 'historico', 'h2'), h('liderRec')));
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), h('liderRec', { uid: 'admin' })), 'em nome de outra pessoa');
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), h('liderRec', { nome: 'Outro Nome' })), 'com outro nome');
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), h('liderRec', { at: Timestamp.fromMillis(Date.now() - 864e5) })), 'com a hora do aparelho');
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), { at: serverTimestamp(), uid: 'liderRec', nome: 'liderRec', t: 'y' }), 'sem o módulo');
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), h('liderRec', { mod: 'outro' })), 'módulo que não existe');
  await assertFails(setDoc(doc(db('liderRec'), 'historico', 'h3'), h('liderRec', { t: 'x'.repeat(1001) })), 'texto longo demais');
  await assertFails(setDoc(doc(db('bloq'), 'historico', 'h3'), h('bloq')), 'bloqueado');
  await assertFails(updateDoc(doc(db('admin'), 'historico', 'h1'), { t: 'z' }));
  for (const u of ['liderRec', 'gestorP', 'gestorG', 'coord', 'sup', 'admModulo', 'segGestor']) await assertFails(deleteDoc(doc(db(u), 'historico', 'h1')), u);
  await assertSucceeds(deleteDoc(doc(db('admin'), 'historico', 'h1')));
});
test('histórico: só o administrador (tudo, também os antigos sem módulo) e o gestor de cada módulo (só o do módulo dele) leem', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore(); const at = Timestamp.now();
    for (const m of ['operacao', 'gestao', 'seguranca', 'rh', 'administracao']) await setDoc0(doc(d, 'historico', 'hm_' + m), { at, uid: 'admin', nome: 'admin', t: 'x', mod: m });
    await setDoc0(doc(d, 'historico', 'hm_antigo'), { at, uid: 'admin', nome: 'admin', t: 'ocorrência para Fulano' });
  });
  const le = (uid, id) => getDoc(doc(db(uid), 'historico', id));
  const lista = (uid, m) => getDocs(m ? query(collection(db(uid), 'historico'), where('mod', '==', m), orderBy('at', 'desc'), limit(40)) : query(collection(db(uid), 'historico'), orderBy('at', 'desc'), limit(40)));
  for (const id of ['hm_operacao', 'hm_gestao', 'hm_seguranca', 'hm_rh', 'hm_administracao', 'hm_antigo']) await assertSucceeds(le('admin', id), id);
  await assertSucceeds(lista('admin'));
  // gestor de cada módulo: só o do módulo (no RH, o Administrativo); a Administração e os antigos, não
  const casos = [['opGestorSo', 'operacao'], ['geGestorSo', 'gestao'], ['segGestor', 'seguranca'], ['rhSo', 'rh']];
  for (const [uid, m] of casos) {
    await assertSucceeds(le(uid, 'hm_' + m), uid + ' lê ' + m);
    await assertSucceeds(lista(uid, m), uid + ' lista ' + m);
    for (const o of ['operacao', 'gestao', 'seguranca', 'rh', 'administracao', 'antigo'].filter(x => x !== m)) await assertFails(le(uid, 'hm_' + o), uid + ' não lê ' + o);
    await assertFails(lista(uid), uid + ' não lista tudo');
  }
  // quem não é gestor do módulo não lê nada (antes, todo usuário ativo lia o histórico)
  for (const uid of ['liderRec', 'sup', 'coord', 'segLeitor', 'segReg', 'rhLeitorNovo', 'leitorG', 'admModulo', 'bloq']) {
    for (const m of ['operacao', 'seguranca', 'rh', 'administracao', 'antigo']) await assertFails(le(uid, 'hm_' + m), uid + ' ' + m);
    await assertFails(lista(uid, 'operacao'), uid + ' lista operacao');
  }
  await assertFails(lista('admModulo', 'administracao'), 'Administração Dos módulos não lê a Administração');
});
test('quem gravou e quando: semanas, presença, cadastro, fichas e ocorrências só aceitam a gravação com a marca de quem está logado e a hora do servidor', async () => {
  const M = (uid, x = {}) => ({ atualizadoPor: uid, atualizadoEm: serverTimestamp(), ...x });
  const ontem = Timestamp.fromMillis(Date.now() - 864e5);
  const d = db('liderRec');
  // semanas: com a marca passa; sem, com outra pessoa ou com a hora do aparelho, não
  await assertSucceeds(updateDoc0(doc(d, 'semanas', SEM), M('liderRec', { 's.REC-009': 'R______' })));
  await assertFails(updateDoc0(doc(d, 'semanas', SEM), { 's.REC-009': 'N______' }), 'semana sem a marca');
  await assertFails(updateDoc0(doc(d, 'semanas', SEM), M('sup', { 's.REC-009': 'N______' })), 'semana em nome de outra pessoa');
  await assertFails(updateDoc0(doc(d, 'semanas', SEM), M('liderRec', { 's.REC-009': 'N______', atualizadoEm: ontem })), 'semana com a hora do aparelho');
  // presença do dia
  await assertSucceeds(setDoc0(doc(d, 'situacao', '2026-10'), M('liderRec', { v: { 'C001|2026-10-10': 'FT' } }), { merge: true }));
  await assertFails(setDoc0(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-11': 'FT' } }, { merge: true }), 'presença sem a marca');
  await assertFails(setDoc0(doc(d, 'situacao', '2026-10'), M('admin', { v: { 'C001|2026-10-11': 'FT' } }), { merge: true }), 'presença em nome de outra pessoa');
  // cadastro das Atividades e fichas (administração)
  await assertSucceeds(setDoc0(doc(db('admin'), 'colaboradores', 'RECEBIMENTO'), M('admin', { itens: [] })));
  await assertFails(setDoc0(doc(db('admin'), 'colaboradores', 'RECEBIMENTO'), { itens: [] }), 'cadastro sem a marca');
  await assertSucceeds(setDoc0(doc(db('gestorG'), 'gcolab', 'GERAL'), M('gestorG', { itens: [] })));
  await assertFails(setDoc0(doc(db('gestorG'), 'gcolab', 'GERAL'), M('admin', { itens: [] })), 'fichas em nome de outra pessoa');
  // ocorrências: cria com criadoPor e criadoEm do servidor; altera com a marca
  const g = db('liderG');
  const oc = x => ({ area: 'RECEBIMENTO', status: 'pendente', desc: 'x', criadoPor: 'liderG', criadoEm: serverTimestamp(), ...x });
  await assertSucceeds(setDoc0(doc(g, 'gocorr', 'qm1'), oc()));
  await assertFails(setDoc0(doc(g, 'gocorr', 'qm2'), oc({ criadoEm: ontem })), 'ocorrência com a hora do aparelho');
  await assertSucceeds(updateDoc0(doc(g, 'gocorr', 'qm1'), M('liderG', { recolhe: 'LÍDER GESTÃO' })));
  await assertFails(updateDoc0(doc(g, 'gocorr', 'qm1'), { recolhe: '' }), 'ocorrência alterada sem a marca');
  // Bateria (b_) igual
  await assertFails(updateDoc0(doc(db('sup'), 'b_semanas', SEM_B1), { 's.B1-009': 'R______' }), 'Bateria sem a marca');
  await assertSucceeds(updateDoc0(doc(db('sup'), 'b_semanas', SEM_B1), M('sup', { 's.B1-009': 'R______' })));  await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore(), 'gocorr', 'qm1')); });
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

// ---------------- acessos: Operação, Administrativo e Administração do sistema ----------------
const prepAdm = () => env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'freqcomp', 'patio|2026-10'), { conj: 'patio', competencia: '2026-10', grupos: [], d: {} });
  await setDoc(doc(d, 'ferias', 'f1'), { nome: 'PESSOA TESTE', inicio: '2026-10-01', termino: '2026-10-30' });
  await setDoc(doc(d, 'adm', 'feriasAtivas'), { itens: [] });
  await setDoc(doc(d, 'sistema', 'uso'), { colecoes: {} });
  await setDoc(doc(d, 'situacao', '2026-10'), { v: {} });
  await setDoc(doc(d, 'b_situacao', '2026-10'), { v: {} });
  for (const n of ['seed-freq-patio', 'seed-ferias']) await setDoc(doc(d, 'seeds', n), { json: '{}' });
});
test('acesso: quem não tem o campo acessos continua só na Operação (usuários antigos não mudam)', async () => {
  await prepAdm();
  await assertSucceeds(getDoc(doc(db('liderRec'), 'semanas', SEM)));
  await assertFails(getDoc(doc(db('liderRec'), 'freqcomp', 'patio|2026-10')));
  await assertFails(getDocs(collection(db('liderRec'), 'ferias')));
  await assertSucceeds(getDoc(doc(db('liderRec'), 'adm', 'feriasAtivas')));
});
test('módulo Frequência e férias sozinho (ou o antigo acesso Administrativo sem módulos) não lê nem grava as Atividades', async () => {
  for (const quem of ['admAn', 'freqSo']) {
    await assertFails(getDoc(doc(db(quem), 'semanas', SEM)));
    await assertFails(getDoc(doc(db(quem), 'config', 'sistema')));
    await assertFails(getDocs(collection(db(quem), 'gocorr')));
    await assertFails(getDoc(doc(db(quem), 'eq', 'cadastro')));
    await assertFails(setDoc(doc(db(quem), 'plano', 'RECEBIMENTO'), { itens: [] }));
  }
});
test('acesso Administrativo: lê e grava folha e férias; lê pessoas e presença; grava presença do dia', async () => {
  const d = db('admAn');
  await assertSucceeds(getDoc(doc(d, 'freqcomp', 'patio|2026-10')));
  await assertSucceeds(updateDoc(doc(d, 'freqcomp', 'patio|2026-10'), { grupos: [{ nome: 'G', pessoas: [] }] }));
  await assertSucceeds(getDocs(collection(d, 'ferias')));
  await assertSucceeds(setDoc(doc(d, 'ferias', 'f2'), { nome: 'OUTRA', inicio: null }));
  await assertSucceeds(setDoc(doc(d, 'adm', 'feriasAtivas'), { itens: [] }));
  await assertSucceeds(getDoc(doc(d, 'colaboradores', 'RECEBIMENTO')));
  await assertSucceeds(getDoc(doc(d, 'gcolab', 'RECEBIMENTO')));
  await assertSucceeds(getDoc(doc(d, 'situacao', '2026-10')));
  await assertSucceeds(setDoc(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-02': 'AT' } }, { merge: true }));
  await assertSucceeds(setDoc(doc(d, 'b_situacao', '2026-10'), { v: { 'B001|2026-10-02': 'FT' } }, { merge: true }));
  await assertFails(setDoc(doc(d, 'colaboradores', 'RECEBIMENTO'), { itens: [] }));
  // RH › Colaboradores: o Administrativo grava o cadastro (com a marca de quem gravou), mas não apaga a ficha
  await assertSucceeds(setDoc(doc(d, 'gcolab', 'RECEBIMENTO'), { itens: [{ mat: 'REC', nome: 'Pessoa RECEBIMENTO', matArc: 'A123' }] }));
  await assertSucceeds(setDoc(doc(d, 'gcolab', 'GERAL'), { itens: [{ mat: 'GER', nome: 'Pessoa GERAL' }, { mat: '999', nome: 'NOVA' }] }));
  await assertFails(setDoc0(doc(d, 'gcolab', 'GERAL'), { itens: [] }), 'cadastro sem a marca de quem gravou');
  await assertFails(setDoc(doc(d, 'gcolab', 'GERAL'), { itens: [], outro: 1 }), 'campo fora do formato');
  await assertFails(deleteDoc(doc(d, 'gcolab', 'GERAL')));
});
test('acesso Administrativo somente leitura: consulta e não altera', async () => {
  const d = db('admLeitor');
  await assertSucceeds(getDoc(doc(d, 'freqcomp', 'patio|2026-10')));
  await assertSucceeds(getDocs(collection(d, 'ferias')));
  await assertFails(setDoc(doc(d, 'ferias', 'f3'), { nome: 'X' }));
  await assertFails(updateDoc(doc(d, 'freqcomp', 'patio|2026-10'), { grupos: [] }));
  await assertFails(setDoc(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-03': 'FT' } }, { merge: true }));
  await assertFails(setDoc(doc(d, 'adm', 'feriasAtivas'), { itens: [] }));
  await assertFails(setDoc(doc(d, 'gcolab', 'GERAL'), { itens: [] }), 'somente leitura não grava o cadastro');
});
test('treinamentos, NRs e ASO: saíram do RH; o RH não lê nem grava; o administrador grava; quem não tem a Segurança não vê', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'treinos', 't1'), { nome: 'PESSOA TESTE', tipo: 'ASO', validade: '2026-12-01' }); });
  const a = db('admAn');
  await assertFails(getDocs(collection(a, 'treinos')), 'RH Administrativo não lê mais');
  await assertFails(setDoc(doc(a, 'treinos', 't2'), { nome: 'OUTRA', tipo: 'NR-35', validade: '2027-01-01' }), 'RH Administrativo não grava mais');
  await assertFails(getDocs(collection(db('admLeitor'), 'treinos')));
  await assertSucceeds(setDoc(doc(db('admin'), 'treinos', 't2'), { nome: 'OUTRA', tipo: 'NR-35', validade: '2027-01-01' }));
  await assertFails(setDoc(doc(db('admin'), 'treinos', 't3'), { nome: 'SEM TIPO' }));
  await assertSucceeds(setDoc(doc(db('admin'), 'treinos', 't4'), { nome: 'OUTRA', tipo: 'NÃO SE APLICA', naTipos: ['CAL', 'ARL'], conj: 'patio', area: 'RECEBIMENTO' }), 'os "não se aplica" da pessoa num registro só');
  await assertSucceeds(deleteDoc(doc(db('admin'), 'treinos', 't2')));
  await assertFails(getDocs(collection(db('liderRec'), 'treinos')));
});
test('treinamentos: o técnico de segurança (registra) lê, grava e importa; o leitor da Segurança só lê', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'treinos', 's1'), { nome: 'PESSOA TESTE', tipo: 'NR-33', validade: '2026-12-01' }); });
  const t = db('segReg');
  await assertSucceeds(getDocs(collection(t, 'treinos')));
  const b = writeBatch(t);
  b.set(doc(t, 'treinos', 's2'), { nome: 'UM', tipo: 'NR-35', validade: '2027-01-01' });
  b.set(doc(t, 'treinos', 's3'), { nome: 'DOIS', tipo: 'ASO', validade: '2027-02-01' });
  await assertSucceeds(b.commit());
  await assertFails(setDoc(doc(t, 'treinos', 's4'), { tipo: 'ASO' }));
  await assertSucceeds(deleteDoc(doc(t, 'treinos', 's3')));
  await assertSucceeds(setDoc(doc(db('segGestor'), 'treinos', 's5'), { nome: 'TRES', tipo: 'NR-10' }));
  await assertSucceeds(getDocs(collection(db('segLeitor'), 'treinos')));
  await assertFails(setDoc(doc(db('segLeitor'), 'treinos', 's6'), { nome: 'X', tipo: 'ASO' }));
  await assertFails(deleteDoc(doc(db('segLeitor'), 'treinos', 's1')));
});
test('acesso: líder com Operação e Administrativo entra nos dois', async () => {
  await assertSucceeds(getDoc(doc(db('liderAmbos'), 'semanas', SEM)));
  await assertSucceeds(getDocs(collection(db('liderAmbos'), 'ferias')));
});
test('acesso por módulo: ninguém muda o próprio acesso nem os escopos; só o administrador grava', async () => {
  await assertFails(updateDoc(doc(db('liderNovo'), 'usuarios', 'liderNovo'), { acesso: { operacao: 'gestor', gestao: 'gestor', administracao: 'admin' } }));
  await assertFails(updateDoc(doc(db('liderNovo'), 'usuarios', 'liderNovo'), { escopos: ['patio', 'bateria', 'equipamentos'] }));
  await assertFails(updateDoc(doc(db('liderRec'), 'usuarios', 'liderRec'), { acesso: { operacao: 'gestor' }, escopos: ['patio', 'bateria'] }));
  await assertFails(updateDoc(doc(db('segReg'), 'usuarios', 'segReg'), { acesso: { seguranca: 'gestor' } }));
  await assertFails(updateDoc(doc(db('liderNovo'), 'usuarios', 'liderNovo'), { acesso: { operacao: 'lider' }, ultimoAcesso: serverTimestamp() }), 'nem junto com o último acesso');
  await assertSucceeds(updateDoc(doc(db('liderNovo'), 'usuarios', 'liderNovo'), { ultimoAcesso: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('gestorP'), 'usuarios', 'liderRec'), { acesso: { operacao: 'lider' } }), 'gestor não grava usuários');
  await assertSucceeds(updateDoc(doc(db('admin'), 'usuarios', 'segReg'), { acesso: { seguranca: 'registra', operacao: 'leitor' }, escopos: ['patio'] }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'usuarios', 'segReg'), { acesso: { seguranca: 'registra' }, escopos: [] }));
  await assertSucceeds(setDoc(doc(db('admin'), 'usuarios', 'novo2'), { papel: 'lider', nome: 'x', login: 'x', modulos: ['operacao'], acesso: { operacao: 'lider' }, escopos: ['patio'] }));
});
test('acesso por módulo: quem já foi convertido (mesmo perfil nos módulos) continua com as mesmas permissões de antes', async () => {
  await assertSucceeds(getDoc(doc(db('liderNovo'), 'semanas', SEM)));
  await assertSucceeds(updateDoc(doc(db('liderNovo'), 'semanas', SEM), { s: { 'REC-001': 'R______' } }));
  await assertFails(updateDoc(doc(db('liderNovo'), 'semanas', SEM_PREP), { s: { 'PRE-001': 'R______' } }), 'fora da área dele');
  await assertSucceeds(getDoc(doc(db('liderNovo'), 'gcolab', 'RECEBIMENTO')));
  await assertFails(getDoc(doc(db('liderNovo'), 'b_semanas', SEM_B1)), 'sem o escopo Bateria');
  // Só Segurança (fase 3): não abre nada do que existe hoje.
  for (const [c, id] of [['semanas', SEM], ['b_semanas', SEM_B1], ['gcolab', 'RECEBIMENTO'], ['config', 'sistema'], ['eq', 'cadastro'], ['gestao', 'colaboradores']]) await assertFails(getDoc(doc(db('segReg'), c, id)), `Segurança não lê ${c}`);
  await assertFails(getDocs(collection(db('segReg'), 'ferias')));
  await assertSucceeds(getDoc(doc(db('segReg'), 'usuarios', 'segReg')));
});
test('acesso: ninguém muda os próprios acessos; só o administrador', async () => {
  await assertFails(updateDoc(doc(db('liderRec'), 'usuarios', 'liderRec'), { acessos: ['operacao', 'administrativo'] }));
  await assertFails(updateDoc(doc(db('admAn'), 'usuarios', 'admAn'), { acessos: ['operacao', 'administrativo'], papel: 'admin' }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'usuarios', 'liderRec'), { acessos: ['operacao'] }));
});
test('Administração do sistema: uso do plano e planilhas de importação só para o administrador; ninguém grava o uso pelo site', async () => {
  await assertSucceeds(getDoc(doc(db('admin'), 'sistema', 'uso')));
  await assertFails(getDoc(doc(db('gestorP'), 'sistema', 'uso')));
  await assertFails(getDoc(doc(db('admAn'), 'sistema', 'uso')));
  await assertFails(setDoc(doc(db('admin'), 'sistema', 'uso'), { colecoes: {} }));
  await assertSucceeds(getDoc(doc(db('admin'), 'seeds', 'seed-ferias')));
  await assertFails(getDoc(doc(db('admAn'), 'seeds', 'seed-ferias')));
  await assertFails(getDoc(doc(db('gestorG'), 'seeds', 'seed-freq-patio')));
});
test('bloqueado não entra no Administrativo', async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'usuarios', 'bloqAdm'), { nome: 'b', nomeUp: 'B', papel: 'bloqueado', acessos: ['administrativo'] }); });
  await assertFails(getDocs(collection(db('bloqAdm'), 'ferias')));
  await assertFails(getDoc(doc(db('bloqAdm'), 'freqcomp', 'patio|2026-10')));
});

test('Operação de equipamentos lê a folha e a presença do dia (Equipe e frota sincronizada), mas não grava', async () => {
  await prepAdm();
  await assertSucceeds(getDoc(doc(db('liderEq'), 'freqcomp', 'patio|2026-10')));
  await assertSucceeds(getDoc(doc(db('liderEq'), 'situacao', '2026-10')));
  await assertSucceeds(getDoc(doc(db('liderEq'), 'b_situacao', '2026-10')));
  await assertFails(updateDoc(doc(db('liderEq'), 'freqcomp', 'patio|2026-10'), { grupos: [] }));
  await assertFails(setDoc(doc(db('liderEq'), 'situacao', '2026-10'), { v: { 'C001|2026-10-02': 'FT' } }, { merge: true }));
  await assertFails(getDocs(collection(db('liderEq'), 'ferias')));
  await assertFails(getDoc(doc(db('liderG'), 'freqcomp', 'patio|2026-10')), 'quem só tem o Efetivo não lê a folha');
});

test('módulo Frequência e férias (dentro da Operação): lê e grava folha e férias; somente leitura só consulta', async () => {
  await prepAdm();
  await assertSucceeds(getDoc(doc(db('freqSo'), 'freqcomp', 'patio|2026-10')));
  await assertSucceeds(setDoc(doc(db('freqSo'), 'ferias', 'f9'), { nome: 'X Y', inicio: null }));
  await assertSucceeds(setDoc(doc(db('freqSo'), 'situacao', '2026-10'), { v: { 'C001|2026-10-05': 'AT' } }, { merge: true }));
  await assertSucceeds(getDocs(collection(db('freqLeitor'), 'ferias')));
  await assertFails(setDoc(doc(db('freqLeitor'), 'ferias', 'f10'), { nome: 'X Y' }));
  await assertSucceeds(getDoc(doc(db('gestorSoAdm'), 'semanas', SEM)), 'quem tinha o acesso Administrativo e módulos da Operação entra na Operação');
});

// ---------------- aprovação dos apontamentos ----------------
test('aprovação: o supervisor aprova ou devolve nas áreas dele e o administrador é a reserva; líder, coordenador e gestor não aprovam', async () => {
  const ap = (area, v = { 'REC-001|1': { s: 'A', c: 'R' } }) => ({ area, mes: '2026-10', v });
  await assertSucceeds(setDoc(doc(db('sup'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }));
  await assertSucceeds(setDoc(doc(db('sup'), 'aprov', SEM), ap('RECEBIMENTO', { 'REC-002|1': { s: 'D', c: 'P', mot: 'Não foi feita' } }), { merge: true }));
  await assertFails(setDoc(doc(db('sup'), 'aprov', SEM_PREP), ap('PREPARAÇÃO')));
  await assertFails(setDoc(doc(db('sup'), 'aprov', SEM), ap('PREPARAÇÃO'), { merge: true }), 'não troca a área de um registro');
  await assertFails(setDoc(doc(db('coord'), 'aprov', SEM_PREP), ap('PREPARAÇÃO')), 'coordenador não aprova');
  await assertFails(setDoc(doc(db('gestorP'), 'aprov', SEM_PREP), ap('PREPARAÇÃO'), { merge: true }), 'gestor não aprova');
  await assertSucceeds(setDoc(doc(db('admin'), 'aprov', SEM_PREP), ap('PREPARAÇÃO'), { merge: true }), 'administrador aprova em qualquer área');
  await assertSucceeds(setDoc(doc(db('admin'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }), 'administrador aprova também em área que tem supervisor');
  await assertFails(setDoc(doc(db('liderRec'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }), 'o líder não aprova o próprio apontamento');
  await assertFails(setDoc(doc(db('freqLeitor'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }));
  await assertFails(setDoc(doc(db('admv'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }), 'o Administrativo não aprova apontamento');
  await assertSucceeds(getDoc(doc(db('liderRec'), 'aprov', SEM)), 'o líder vê o que foi aprovado ou devolvido');
  await assertFails(getDoc(doc(db('liderEq'), 'aprov', SEM)), 'quem não tem as Atividades não lê');
  await assertSucceeds(setDoc(doc(db('sup'), 'b_aprov', SEM_B1), { area: 'BATERIA 1', mes: '2026-10', v: { 'B1-001|1': { s: 'A', c: 'R' } } }));
  await assertFails(setDoc(doc(db('liderRec'), 'b_aprov', SEM_B1), { area: 'BATERIA 1', mes: '2026-10', v: {} }, { merge: true }));
  await assertFails(deleteDoc(doc(db('sup'), 'aprov', SEM)));
});

test('aprovação: o Técnico de Processo aprova e devolve em todas as áreas do escopo dele, sem apontar', async () => {
  const ap = (area, v = { 'REC-001|2': { s: 'A', c: 'R' } }) => ({ area, mes: '2026-10', v });
  const t = db('tecPatio');
  await assertSucceeds(getDoc(doc(t, 'semanas', SEM)), 'lê as Atividades do Pátio');
  await assertSucceeds(setDoc(doc(t, 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }));
  await assertSucceeds(setDoc(doc(t, 'aprov', SEM_PREP), ap('PREPARAÇÃO'), { merge: true }), 'qualquer área do Pátio');
  await assertSucceeds(setDoc(doc(t, 'aprov', SEM), ap('RECEBIMENTO', { 'REC-002|2': { s: 'D', c: 'P', mot: 'Não foi feita' } }), { merge: true }), 'devolve');
  await assertSucceeds(updateDoc(doc(t, 'semanas', SEM), { 's.REC-002': 'PPP____', 'm.REC-002|2': deleteField(), atualizadoPor: 'tecPatio' }), 'ao devolver, a célula volta a pendente');
  await assertFails(updateDoc(doc(t, 'semanas', SEM), { ev: { 'REC-002|2': 1 } }), 'não mexe em outros campos da semana');
  await assertFails(updateDoc(doc(t, 'semanas', SEM), { fp: {} }), 'não inclui fora da programação');
  await assertFails(setDoc(doc(t, 'aprov', SEM), ap('PREPARAÇÃO'), { merge: true }), 'não troca a área de um registro');
  await assertFails(setDoc(doc(t, 'b_aprov', SEM_B1), { area: 'BATERIA 1', mes: '2026-10', v: {} }, { merge: true }), 'sem o escopo Bateria não aprova a Bateria');
  await assertFails(deleteDoc(doc(t, 'aprov', SEM)), 'não apaga aprovação');
  await assertSucceeds(setDoc(doc(db('tecBat'), 'b_aprov', SEM_B1), { area: 'BATERIA 1', mes: '2026-10', v: { 'B1-001|2': { s: 'A', c: 'R' } } }, { merge: true }));
  await assertFails(setDoc(doc(db('tecBat'), 'aprov', SEM), ap('RECEBIMENTO'), { merge: true }), 'sem o escopo Pátio não aprova o Pátio');
});

// ---------------- perfil Administrativo ----------------
test('perfil Administrativo: vê as Atividades sem apontar; edita Frequência e férias; não entra na Administração do sistema', async () => {
  await prepAdm();
  const d = db('admv');
  await assertSucceeds(getDoc(doc(d, 'semanas', SEM)));
  await assertFails(updateDoc(doc(d, 'semanas', SEM), { s: { 'REC-001': 'R______' } }));
  await assertSucceeds(updateDoc(doc(d, 'freqcomp', 'patio|2026-10'), { grupos: [{ nome: 'G', pessoas: [] }] }));
  await assertSucceeds(setDoc(doc(d, 'ferias', 'fa1'), { nome: 'PESSOA X', inicio: null }));
  await assertSucceeds(setDoc(doc(db('admvSo'), 'ferias', 'fa2'), { nome: 'PESSOA Y', inicio: null }), 'o perfil já traz Frequência e férias, mesmo sem marcar');
  await assertFails(getDoc(doc(d, 'sistema', 'uso')));
  await assertFails(getDoc(doc(d, 'seeds', 'seed-ferias')));
  await assertFails(setDoc(doc(d, 'config', 'sistema'), { rotas: [] }));
  await assertFails(updateDoc(doc(d, 'usuarios', 'admv'), { papel: 'admin' }));
});
test('perfil Administrativo: fichas de todas as áreas, registra ocorrência e colhe assinatura; grava o cadastro pelo RH, sem apagar', async () => {
  const d = db('admv');
  await assertSucceeds(getDocs(collection(d, 'gcolab')));
  await assertSucceeds(getDocs(collection(d, 'gocorr')));
  await assertSucceeds(setDoc(doc(d, 'gocorr', 'adm-oc1'), { area: 'PREPARAÇÃO', status: 'pendente', desc: 'Atestado', criadoPor: 'admv', recolhe: '' }));
  await assertFails(setDoc(doc(d, 'gocorr', 'adm-oc2'), { area: 'PREPARAÇÃO', status: 'pendente', desc: 'Atestado', criadoPor: 'outro' }));
  await assertSucceeds(updateDoc(doc(d, 'gocorr', 'pre1'), { recolhe: 'ASSISTENTE ADM' }));
  await assertSucceeds(setDoc(doc(d, 'gassin', 'adm-as1'), { area: 'BATERIA 1', por: 'admv', metodo: 'tela' }));
  // tem o RH · Administrativo: grava o cadastro (RH › Colaboradores), mas não apaga a ficha
  await assertSucceeds(setDoc(doc(d, 'gcolab', 'RECEBIMENTO'), { itens: [{ mat: 'REC', nome: 'Pessoa RECEBIMENTO' }] }));
  await assertFails(deleteDoc(doc(d, 'gcolab', 'RECEBIMENTO')));
  await assertFails(deleteDoc(doc(d, 'gocorr', 'rec1')));
  await assertFails(setDoc(doc(db('admvSo'), 'gocorr', 'adm-oc3'), { area: 'PREPARAÇÃO', status: 'pendente', desc: 'Atestado', criadoPor: 'admvSo' }), 'sem o Efetivo marcado não registra ocorrência');
});

test('Painel Coqueria: cada pessoa ativa lê e grava só o próprio painel; ninguém mais, nem o administrador', async () => {
  await assertSucceeds(setDoc(doc(db('liderRec'), 'painel', 'liderRec', 'tasks', 't1'), { title: 'Medição', status: 'todo' }));
  await assertSucceeds(getDoc(doc(db('liderRec'), 'painel', 'liderRec', 'tasks', 't1')));
  await assertSucceeds(getDocs(collection(db('liderRec'), 'painel', 'liderRec', 'registros')));
  await assertSucceeds(deleteDoc(doc(db('liderRec'), 'painel', 'liderRec', 'tasks', 't1')));
  await assertFails(getDoc(doc(db('admin'), 'painel', 'liderRec', 'tasks', 't1')));
  await assertFails(setDoc(doc(db('admin'), 'painel', 'liderRec', 'tasks', 't2'), { title: 'x' }));
  await assertFails(getDocs(collection(db('liderPrep'), 'painel', 'liderRec', 'tasks')));
  await assertFails(setDoc(doc(db('bloq'), 'painel', 'bloq', 'tasks', 't1'), { title: 'x' }));
  await assertFails(setDoc(doc(db('semPerfil'), 'painel', 'semPerfil', 'tasks', 't1'), { title: 'x' }));
  await assertFails(getDoc(doc(db(null), 'painel', 'liderRec', 'tasks', 't1')));
});

// ---------- plano de ação das causas ----------
test('plano de ação: supervisor cria e conclui na área dele; coordenador também em todas; líder e leitura só leem', async () => {
  const a = { causa: 'Efetivo insuficiente', area: 'RECEBIMENTO', acao: 'Remanejar duas pessoas da Melhorias', resp: 'X', prazo: '2026-10-30', status: 'aberta' };
  const P = uid => ({ por: uid, porNome: uid });
  await assertSucceeds(setDoc(doc(db('sup'), 'acoes', 'ac1'), { ...a, ...P('sup') }));
  await assertSucceeds(setDoc(doc(db('sup'), 'acoes', 'ac1'), { status: 'feita', atualizadoPor: 'sup', atualizadoEm: new Date().toISOString() }, { merge: true }));
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac1'), { status: 'aberta' }, { merge: true }), 'sem dizer quem alterou');
  await assertFails(setDoc(doc(db('coord'), 'acoes', 'ac1'), { status: 'aberta', atualizadoPor: 'sup', atualizadoEm: new Date().toISOString() }, { merge: true }), 'em nome de outra pessoa');
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac1b'), { ...a, ...P('coord') }), 'cria em nome de outra pessoa');
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac1'), { area: 'PREPARAÇÃO' }, { merge: true }), 'não troca a área');
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac2'), { ...a, ...P('sup'), area: 'PREPARAÇÃO' }), 'fora da área dele');
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac3'), { ...a, ...P('sup'), area: 'TODAS' }), 'supervisor não cria para todas as áreas');
  await assertSucceeds(setDoc(doc(db('coord'), 'acoes', 'ac4'), { ...a, ...P('coord'), area: 'TODAS' }));
  await assertFails(setDoc(doc(db('liderRec'), 'acoes', 'ac5'), { ...a, ...P('liderRec') }), 'líder não cria ação');
  await assertSucceeds(getDoc(doc(db('liderRec'), 'acoes', 'ac1')));
  await assertFails(setDoc(doc(db('freqLeitor'), 'acoes', 'ac6'), { ...a, ...P('freqLeitor') }));
  await assertFails(setDoc(doc(db('sup'), 'acoes', 'ac7'), { ...a, ...P('sup'), acao: 'x'.repeat(401) }), 'texto muito longo');
  await assertSucceeds(setDoc(doc(db('sup'), 'b_acoes', 'b1'), { ...a, ...P('sup'), area: 'BATERIA 1' }));
  await assertFails(deleteDoc(doc(db('sup'), 'acoes', 'ac1')));
});

// ---------------- fase 2: o perfil de cada módulo vale nas regras ----------------
test('perfil por módulo: líder na Operação aponta e lança a presença; como leitor na Gestão não grava o plano nem cria ações', async () => {
  const d = db('opLiderGeLeitor');
  await assertSucceeds(getDoc(doc(d, 'semanas', SEM)));
  await assertSucceeds(updateDoc(doc(d, 'semanas', SEM), { s: { 'REC-001': 'R______' } }));
  await assertFails(updateDoc(doc(d, 'semanas', SEM_PREP), { s: { 'PRE-001': 'R______' } }), 'fora da área');
  await assertSucceeds(setDoc(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-09': 'FT' } }, { merge: true }));
  await assertFails(setDoc(doc(d, 'plano', 'RECEBIMENTO'), { itens: [] }), 'leitor na Gestão não grava o plano');
  await assertFails(setDoc(doc(d, 'acoes', 'mx1'), { causa: 'Chuva', area: 'RECEBIMENTO', acao: 'Cobrir o pátio', por: 'opLiderGeLeitor' }), 'leitor na Gestão não cria ação');
  await assertFails(setDoc(doc(d, 'aprov', SEM), { area: 'RECEBIMENTO', mes: '2026-10', v: {} }, { merge: true }), 'líder não aprova');
  await assertFails(getDoc(doc(d, 'gcolab', 'RECEBIMENTO')), 'Gestão sem as Fichas');
  await assertFails(getDoc(doc(d, 'b_semanas', SEM_B1)), 'sem o escopo Bateria');
});
test('perfil por módulo: o papel antigo (o mais alto) não vale mais quando há acesso por módulo', async () => {
  const d = db('opLiderGeSup'); // papel antigo supervisor, mas Operação · Líder
  await assertFails(setDoc(doc(d, 'aprov', SEM), { area: 'RECEBIMENTO', mes: '2026-10', v: {} }, { merge: true }), 'aprovar é da Operação · Supervisor');
  await assertSucceeds(updateDoc(doc(d, 'semanas', SEM), { s: { 'REC-002': 'R______' } }));
  await assertFails(updateDoc(doc(d, 'semanas', SEM_PREP), { s: { 'PRE-002': 'R______' } }), 'a 2ª área é só do supervisor; na Operação é líder');
  await assertSucceeds(setDoc(doc(d, 'acoes', 'mx2'), { causa: 'Chuva', area: 'PREPARAÇÃO', acao: 'Cobrir o pátio', por: 'opLiderGeSup' }), 'ações pela Gestão · Supervisor, na 2ª área');
  await assertFails(setDoc(doc(db('admModSemGestor'), 'plano', 'RECEBIMENTO'), { itens: [] }), 'Dos módulos sem ser Gestor da Gestão');
  await assertFails(getDoc(doc(db('admModSemGestor'), 'seeds', 'seed')));
});
test('só RH: lê e grava a frequência e as férias; não lê as semanas nem o plano', async () => {
  const d = db('rhSo');
  await assertSucceeds(getDoc(doc(d, 'freqcomp', 'patio|2026-10')));
  await assertSucceeds(updateDoc(doc(d, 'freqcomp', 'patio|2026-10'), { grupos: [] }));
  await assertSucceeds(setDoc(doc(d, 'ferias', 'rh1'), { nome: 'X', inicio: '2026-11-01', termino: '2026-11-30' }));
  await assertSucceeds(setDoc(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-10': 'AT' } }, { merge: true }), 'a Frequência grava a presença de quem está nas Atividades');
  await assertSucceeds(getDoc(doc(d, 'eqlanc', 'l1')), 'hora extra da Operação na folha');
  for (const [c, id] of [['semanas', SEM], ['plano', 'RECEBIMENTO'], ['config', 'sistema'], ['eq', 'cadastro'], ['gestao', 'colaboradores']]) await assertFails(getDoc(doc(d, c, id)), `RH não lê ${c}`);
  await assertSucceeds(getDocs(collection(db('rhLeitorNovo'), 'ferias')));
  await assertFails(setDoc(doc(db('rhLeitorNovo'), 'ferias', 'rh2'), { nome: 'Y' }), 'RH somente leitura não grava');
  await assertFails(setDoc(doc(db('rhLeitorNovo'), 'situacao', '2026-10'), { v: { 'C001|2026-10-11': 'AT' } }, { merge: true }));
});
test('Administração Dos módulos: Gestor da Gestão cuida do plano, das rotas e das escalas do escopo; usuários e perfis não', async () => {
  const d = db('admModulo');
  await assertSucceeds(setDoc(doc(d, 'plano', 'RECEBIMENTO'), { itens: [] }));
  await assertSucceeds(updateDoc(doc(d, 'config', 'sistema'), { rotas: [] }));
  await assertSucceeds(updateDoc(doc(d, 'config', 'escalas'), { regimes: [] }));
  await assertSucceeds(getDoc(doc(d, 'seeds', 'seed')));
  await assertFails(setDoc(doc(d, 'b_plano', 'BATERIA 1'), { itens: [] }), 'sem o escopo Bateria');
  await assertFails(setDoc(doc(d, 'situacao', '2026-10'), { v: { 'C001|2026-10-12': 'FT' } }, { merge: true }), 'sem a Operação não lança a presença');
  await assertFails(setDoc(doc(d, 'aprov', SEM), { area: 'RECEBIMENTO', mes: '2026-10', v: {} }, { merge: true }), 'nem aprova');
  await assertFails(setDoc(doc(d, 'usuarios', 'novo3'), { papel: 'lider', nome: 'x', login: 'x' }));
  await assertFails(setDoc(doc(d, 'config', 'permissoes'), { x: 2 }));
});
test('Equipamentos por módulo: a Operação lança; a Gestão lê e só lança a Avaliação mensal', async () => {
  await assertSucceeds(setDoc(doc(db('eqOpLider'), 'eqlanc', 'mx1'), LANC('eqOpLider')));
  await assertSucceeds(getDoc(doc(db('eqGeLeitor'), 'eqlanc', 'l1')));
  await assertSucceeds(getDoc(doc(db('eqGeLeitor'), 'eq', 'cadastro')));
  await assertFails(setDoc(doc(db('eqGeLeitor'), 'eqlanc', 'mx2'), LANC('eqGeLeitor')));
  await assertFails(setDoc(doc(db('eqGeLeitor'), 'eqaval', '2026-10'), { itens: { OP: { s5: 1 } } }));
  await assertSucceeds(setDoc(doc(db('eqGeSup'), 'eqaval', '2026-10'), { itens: { OP: { s5: 1 } } }, { merge: true }));
  await assertFails(setDoc(doc(db('eqGeSup'), 'eqaval', '2026-11'), { x: 1 }), 'avaliação só com itens');
  await assertFails(setDoc(doc(db('eqGeSup'), 'eqlanc', 'mx3'), LANC('eqGeSup')), 'a Gestão não lança na Operação');
  await assertFails(getDoc(doc(db('eqGeSup'), 'semanas', SEM)), 'escopo só Equipamentos');
});
// Equipamentos (S5): quem lançou, o supervisor para cima e o administrador alteram e apagam; os outros líderes só mudam
// o status e fecham horário/troca no lançamento e liberam/substituem a parada. por e em não mudam depois.
test('Equipamentos: lançamento, parada e inspeção de outra pessoa: o líder só faz o que a operação do dia pede', async () => {
  const L1 = db('eqOpLider'), L2 = db('eqOpLider2'), S = db('eqOpSup');
  await assertSucceeds(setDoc(doc(L1, 'eqlanc', 'aut1'), LANC('eqOpLider')));
  await assertSucceeds(setDoc(doc(L1, 'eqpar', 'aut1'), PAR('eqOpLider')));
  await assertSucceeds(setDoc(doc(L1, 'eqinsp', 'aut1'), INSP('eqOpLider')));
  // o autor altera e apaga o que é dele
  await assertSucceeds(updateDoc(doc(L1, 'eqlanc', 'aut1'), { op: 'OUTRO OPERADOR', he: 2, heOrigem: 'DIKMA' }));
  // outro líder: status, fim e troca no lançamento; fim, substituição na parada
  await assertSucceeds(updateDoc(doc(L2, 'eqlanc', 'aut1'), { status: 'FALTA' }), 'outro líder muda o status');
  await assertSucceeds(updateDoc(doc(L2, 'eqlanc', 'aut1'), { fim: '14:00', trocaPara: 'CB-02' }), 'outro líder fecha a troca');
  await assertSucceeds(updateDoc(doc(L2, 'eqpar', 'aut1'), { fim: '11:30' }), 'outro líder libera a parada');
  await assertSucceeds(updateDoc(doc(L2, 'eqpar', 'aut1'), { subst: 'CB-02', lancSub: 'x1' }), 'outro líder substitui');
  await assertFails(updateDoc(doc(L2, 'eqlanc', 'aut1'), { op: 'TERCEIRO' }), 'outro líder não troca o operador');
  await assertFails(updateDoc(doc(L2, 'eqlanc', 'aut1'), { he: 5 }), 'outro líder não lança hora extra no registro dos outros');
  await assertFails(updateDoc(doc(L2, 'eqlanc', 'aut1'), { data: '2026-10-21', mes: '2026-10' }), 'nem a data');
  await assertFails(updateDoc(doc(L2, 'eqpar', 'aut1'), { causa: 'OUTRA' }), 'nem a causa da parada');
  await assertFails(updateDoc(doc(L2, 'eqinsp', 'aut1'), { obs: 'mudou' }), 'nem a inspeção');
  for (const c of ['eqlanc', 'eqpar', 'eqinsp']) await assertFails(deleteDoc(doc(L2, c, 'aut1')), `outro líder não apaga ${c}`);
  // ninguém muda o autor nem a hora do lançamento
  await assertFails(updateDoc(doc(L1, 'eqlanc', 'aut1'), { por: 'eqOpLider2' }), 'o autor não passa o registro para outro');
  await assertFails(updateDoc(doc(S, 'eqlanc', 'aut1'), { em: serverTimestamp() }), 'nem o supervisor muda a hora do lançamento');
  // supervisor e administrador alteram e apagam de qualquer pessoa
  await assertSucceeds(updateDoc(doc(S, 'eqlanc', 'aut1'), { op: 'CORRIGIDO', obs: 'acerto' }));
  await assertSucceeds(updateDoc(doc(S, 'eqinsp', 'aut1'), { obs: 'acerto' }));
  await assertSucceeds(deleteDoc(doc(S, 'eqinsp', 'aut1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'eqpar', 'aut1')));
  await assertSucceeds(deleteDoc(doc(L1, 'eqlanc', 'aut1')), 'o autor apaga o dele');
  // criar só em nome próprio e com a hora do servidor
  await assertFails(setDoc(doc(L1, 'eqlanc', 'aut2'), LANC('eqOpLider2')), 'em nome de outra pessoa');
  await assertFails(setDoc(doc(L1, 'eqlanc', 'aut3'), { ...LANC('eqOpLider'), em: Timestamp.now() }), 'com hora do aparelho');
  const { por: _p, ...semAutor } = LANC('eqOpLider');
  await assertFails(setDoc(doc(L1, 'eqlanc', 'aut4'), semAutor), 'sem autor');
});
test('Equipamentos: formato e tamanho dos lançamentos, paradas e inspeções', async () => {
  const L1 = db('eqOpLider');
  const ruins = [
    ['eqlanc', { data: undefined }, 'sem data'], ['eqlanc', { data: '20/10/2026', mes: '2026-10' }, 'data fora do formato'],
    ['eqlanc', { mes: '2026-11' }, 'mês diferente da data'], ['eqlanc', { eq: '' }, 'sem equipamento'], ['eqlanc', { eq: 'X'.repeat(31) }, 'equipamento grande demais'],
    ['eqlanc', { obs: 'x'.repeat(501) }, 'observação grande demais'], ['eqlanc', { he: 30 }, 'hora extra acima de 24 h'], ['eqlanc', { he: '2' }, 'hora extra em texto'],
    ['eqlanc', { ini: '7h' }, 'hora fora do formato'], ['eqlanc', { op: ['A'] }, 'operador que não é texto'],
    ['eqpar', { desc: 'x'.repeat(501) }, 'descrição da parada grande demais'], ['eqpar', { fim: 'amanhã' }, 'liberação fora do formato'],
    ['eqinsp', { itens: 'tudo ok' }, 'itens que não são lista de itens'], ['eqinsp', { p5s: 200 }, 'nota fora da faixa']
  ];
  const base = { eqlanc: LANC, eqpar: PAR, eqinsp: INSP };
  let i = 0;
  const sem = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  for (const [c, extra, msg] of ruins) await assertFails(setDoc(doc(L1, c, 'ruim' + i++), sem({ ...base[c]('eqOpLider'), ...extra })), msg);
  const lixo = { ...LANC('eqOpLider') }; for (let k = 0; k < 40; k++) lixo['c' + k] = k;
  await assertFails(setDoc(doc(L1, 'eqlanc', 'ruimMuitos'), lixo), 'campos demais');
  await assertSucceeds(setDoc(doc(L1, 'eqlanc', 'bom1'), LANC('eqOpLider')));
  await assertFails(updateDoc(doc(L1, 'eqlanc', 'bom1'), { obs: 'x'.repeat(600) }), 'alteração também confere o tamanho');
  await assertSucceeds(updateDoc(doc(L1, 'eqlanc', 'bom1'), { fim: null, ini: '7:05' }));
  // registro antigo (de antes dos limites) continua podendo ser alterado nos outros campos
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'eqlanc', 'antigo1'), { ...LANC('eqOpLider'), em: Timestamp.now(), obs: 'x'.repeat(900) }); });
  await assertSucceeds(updateDoc(doc(L1, 'eqlanc', 'antigo1'), { status: 'FALTA' }));
});
test('Presença, cadastro, folha, férias e treinamentos: só os campos e tamanhos esperados', async () => {
  const lider = db('liderRec'), adm = db('admAn'), sg = db('segReg');
  // presença do mês: v, cob, he, hed, jus, ck (mapas)
  await assertSucceeds(setDoc(doc(lider, 'situacao', '2026-10'), { jus: { 'C001|2026-10-02': 'Atestado' } }, { merge: true }));
  await assertFails(setDoc(doc(lider, 'situacao', '2026-10'), { lixo: 'x' }, { merge: true }), 'campo que não existe na presença');
  await assertFails(setDoc(doc(lider, 'situacao', '2026-10'), { v: 'FT' }, { merge: true }), 'presença que não é mapa');
  // cadastro das Atividades e fichas
  await assertSucceeds(setDoc(doc(db('admin'), 'colaboradores', 'PREPARAÇÃO'), { itens: [{ id: 'C900', nome: 'X' }], maiorId: 900 }));
  await assertFails(setDoc(doc(db('admin'), 'colaboradores', 'PREPARAÇÃO'), { itens: 'X', maiorId: 900 }), 'lista que não é lista');
  await assertFails(setDoc(doc(db('admin'), 'colaboradores', 'PREPARAÇÃO'), { itens: [], extra: 1 }), 'campo a mais no cadastro');
  await assertFails(setDoc(doc(db('admin'), 'gcolab', 'GERAL'), { itens: [], extra: 1 }), 'campo a mais nas fichas');
  await assertSucceeds(setDoc(doc(db('admin'), 'gcolab', 'GERAL'), { itens: [{ mat: 'GER', nome: 'Pessoa GERAL' }] }));
  // folha de frequência: id = conj|competência
  await assertSucceeds(setDoc(doc(adm, 'freqcomp', 'bateria|2026-11'), { conj: 'bateria', competencia: '2026-11', ini: '2026-10-16', fim: '2026-11-15', grupos: [], d: {} }));
  await assertFails(setDoc(doc(adm, 'freqcomp', 'bateria|2026-12'), { conj: 'patio', competencia: '2026-12', grupos: [], d: {} }), 'id diferente do conjunto');
  await assertFails(setDoc(doc(adm, 'freqcomp', 'patio|2026-13x'), { conj: 'patio', competencia: '2026-13x', grupos: [] }), 'competência fora do formato');
  await assertFails(updateDoc(doc(adm, 'freqcomp', 'bateria|2026-11'), { conj: 'patio' }), 'não muda o conjunto');
  await assertFails(updateDoc(doc(adm, 'freqcomp', 'bateria|2026-11'), { grupos: 'G' }), 'grupos que não é lista');
  await assertSucceeds(updateDoc(doc(adm, 'freqcomp', 'bateria|2026-11'), new FieldPath('d', 'B001', '2026-10-20'), 'FT', 'atualizadoEm', serverTimestamp()));
  // férias
  await assertSucceeds(setDoc(doc(adm, 'ferias', 'fv1'), { nome: 'PESSOA', mat: 1234, inicio: '2026-12-01', dias: 30, termino: '2026-12-30' }));
  await assertFails(setDoc(doc(adm, 'ferias', 'fv2'), { nome: '', inicio: '2026-12-01' }), 'férias sem nome');
  await assertFails(setDoc(doc(adm, 'ferias', 'fv3'), { nome: 'PESSOA', inicio: '01/12/2026' }), 'data fora do formato');
  await assertFails(updateDoc(doc(adm, 'ferias', 'fv1'), { dias: 500 }), 'dias demais');
  // treinamentos
  await assertSucceeds(setDoc(doc(sg, 'treinos', 'tv1'), { nome: 'PESSOA', tipo: 'NR-35', realizado: '2026-01-10', validade: '2028-01-10', na: false }));
  await assertFails(setDoc(doc(sg, 'treinos', 'tv2'), { nome: 'PESSOA', tipo: 'NR-35', validade: 'nunca' }), 'validade fora do formato');
  await assertFails(setDoc(doc(sg, 'treinos', 'tv3'), { nome: 'PESSOA', tipo: '' }), 'sem tipo');
  await assertFails(updateDoc(doc(sg, 'treinos', 'tv1'), { obs: 'x'.repeat(501) }), 'observação grande demais');
});
test('bloqueado com acesso por módulo guardado: não lê nem grava nada', async () => {
  for (const [c, id] of [['semanas', SEM], ['config', 'sistema'], ['eq', 'cadastro'], ['gcolab', 'RECEBIMENTO'], ['freqcomp', 'patio|2026-10'], ['usuarios', 'liderRec']]) await assertFails(getDoc(doc(db('bloqNovo'), c, id)));
  await assertFails(setDoc(doc(db('bloqNovo'), 'plano', 'RECEBIMENTO'), { itens: [] }));
  await assertFails(setDoc(doc(db('bloqNovo'), 'usuarios', 'novo4'), { papel: 'admin', nome: 'x', login: 'x' }));
});

// ---------------- Segurança (fase 3): interações, anomalias e fotos ----------------
// Registros de exemplo (gravados sem regras): i = interação, a = anomalia. segReg é o autor do Pátio; segReg2, da Bateria.
const SEG_BASE = { data: '2026-11-02', mes: '2026-11', local: 'CORREIA C1', mat: '123', fotos: [], minis: [], porNome: 'X' };
const INTER_X = { tipoAtiv: 'ROTINA', risco: '', desvios: ['EPI'], desvioOutro: '', desc: 'd', acao: 'a', resp: 'Fulano' };
const ANOM_X = { hora: '08:30', regime: 'ADM', desc: 'd', conseq: 'c', acao: 'a', causas: 'c', sugest: 's', comunic: 'Fulano', status: 'aberta' };
const PAT = { area: 'PÁTIO DE CARVÃO', conj: 'patio' }, BAT = { area: 'BATERIA', conj: 'bateria' };
async function semearSeguranca(d) {
  const agora = Timestamp.now(), velho = Timestamp.fromMillis(Date.now() - 2 * 864e5);
  await setDoc(doc(d, 'seginter', 'i1'), { ...SEG_BASE, ...INTER_X, ...PAT, por: 'segReg', em: agora });
  await setDoc(doc(d, 'seginter', 'i2'), { ...SEG_BASE, ...INTER_X, ...BAT, por: 'segReg2', em: agora });
  await setDoc(doc(d, 'seginter', 'i3'), { ...SEG_BASE, ...INTER_X, ...PAT, por: 'segReg', em: velho });
  await setDoc(doc(d, 'seganom', 'a1'), { ...SEG_BASE, ...ANOM_X, ...PAT, por: 'segReg', em: agora });
  await setDoc(doc(d, 'seganom', 'a2'), { ...SEG_BASE, ...ANOM_X, ...BAT, por: 'segReg2', em: agora });
  await setDoc(doc(d, 'seganom', 'a3'), { ...SEG_BASE, ...ANOM_X, ...PAT, por: 'segReg', em: velho });
  await setDoc(doc(d, 'seganom', 'a4'), { ...SEG_BASE, ...ANOM_X, ...PAT, por: 'segReg', em: agora, status: 'tratamento', trat: { resp: 'Fulano', respUid: '', prazo: '2026-11-10', coment: '', fotoDepois: '', miniDepois: '', hist: [] }, conclEm: '' });
  await setDoc(doc(d, 'segfotos', 'f1'), { reg: 'a1', col: 'seganom', tipo: 'antes', autor: 'segReg', por: 'segReg', conj: 'patio', area: 'PÁTIO DE CARVÃO', mes: '2026-11', mini: 'm', dados: 'd', ordem: 0 });
  await setDoc(doc(d, 'segfotos', 'f2'), { reg: 'a2', col: 'seganom', tipo: 'antes', autor: 'segReg2', por: 'segReg2', conj: 'bateria', area: 'BATERIA', mes: '2026-11', mini: 'm', dados: 'd', ordem: 0 });
}
const novaInter = (por, extra = {}) => ({ ...SEG_BASE, ...INTER_X, ...PAT, por, em: serverTimestamp(), ...extra });
const novaAnom = (por, extra = {}) => ({ ...SEG_BASE, ...ANOM_X, ...PAT, por, em: serverTimestamp(), ...extra });
const acomp = (uid, status, t = {}) => ({ status, trat: { resp: 'Fulano', respUid: uid, prazo: '2026-11-10', coment: 'em andamento', fotoDepois: '', miniDepois: '', hist: [{ em: '2026-11-03T10:00:00.000Z', por: uid, nome: 'X', t: 'Situação' }], ...t }, conclEm: status === 'concluida' ? '2026-11-03T10:00:00.000Z' : '', atualizadoEm: serverTimestamp(), atualizadoPor: uid });
const qSeg = (uid, col, ...f) => getDocs(query(collection(db(uid), col), where('mes', '==', '2026-11'), ...f));

test('Segurança: só registra quem tem registra, trata ou gestor, em nome próprio e com as perguntas obrigatórias', async () => {
  await assertSucceeds(setDoc(doc(db('segReg'), 'seginter', 'n1'), novaInter('segReg')));
  await assertSucceeds(setDoc(doc(db('segTrata'), 'seganom', 'n2'), novaAnom('segTrata')));
  await assertSucceeds(setDoc(doc(db('segGestor'), 'seginter', 'n3'), novaInter('segGestor', BAT)));
  await assertSucceeds(setDoc(doc(db('admin'), 'seganom', 'n4'), novaAnom('admin')));
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n5'), novaInter('segReg2')), 'não registra em nome de outra pessoa');
  await assertFails(setDoc(doc(db('segLeitor'), 'seginter', 'n6'), novaInter('segLeitor')), 'somente leitura não registra');
  await assertFails(setDoc(doc(db('supPatio'), 'seganom', 'n7'), novaAnom('supPatio')), 'supervisor da área sem perfil na Segurança não registra');
  await assertFails(setDoc(doc(db('liderRec'), 'seginter', 'n8'), novaInter('liderRec')), 'sem a Segurança');
  await assertFails(setDoc(doc(db('bloqNovo'), 'seginter', 'n9'), novaInter('bloqNovo')));
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n10'), novaInter('segReg', { resp: '' })), 'RESPONSÁVEL é obrigatório');
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n11'), novaInter('segReg', { mat: '' })), 'MATRÍCULA é obrigatória');
  await assertFails(setDoc(doc(db('segReg'), 'seganom', 'n12'), novaAnom('segReg', { causas: '' })), 'POSSÍVEIS CAUSAS é obrigatória');
  await assertFails(setDoc(doc(db('segReg'), 'seganom', 'n13'), novaAnom('segReg', { hora: '' })), 'HORA é obrigatória');
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n14'), novaInter('segReg', { desc: 'x'.repeat(3001) })), 'texto longo demais');
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n15'), novaInter('segReg', { mes: '2026-10' })), 'mês diferente da data');
  await assertFails(setDoc(doc(db('segReg'), 'seganom', 'n16'), novaAnom('segReg', { status: 'concluida' })), 'anomalia nasce aberta');
  await assertFails(setDoc(doc(db('segReg'), 'seganom', 'n17'), novaAnom('segReg', { trat: { resp: 'eu' } })), 'quem registra não define o tratamento');
  await assertFails(setDoc(doc(db('segReg'), 'seginter', 'n18'), novaInter('segReg', { extra: 1 })), 'só os campos do formulário');
});
test('Segurança · DDS antigos: ficam guardados; lê quem lê a Segurança, ninguém grava mais e só o administrador apaga', async () => {
  const velho = (por, extra = {}) => ({ data: '2026-11-02', mes: '2026-11', ...PAT, tema: 'Trabalho em altura', pessoas: ['ANA', 'BRUNO'], obs: '', por, porNome: 'X', em: Timestamp.fromMillis(Date.now()), ...extra });
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'segdds', 'd1'), velho('segReg')); await setDoc(doc(ctx.firestore(), 'segdds', 'd2'), velho('segTrata', BAT)); });
  await assertFails(setDoc(doc(db('segReg'), 'segdds', 'd3'), { ...velho('segReg'), em: serverTimestamp() }), 'não registra DDS novo');
  await assertFails(setDoc(doc(db('liderRec'), 'segdds', 'd4'), { ...velho('liderRec'), em: serverTimestamp() }), 'o líder também não');
  await assertFails(updateDoc(doc(db('segReg'), 'segdds', 'd1'), { tema: 'outro' }), 'nem corrige os antigos');
  await assertSucceeds(getDoc(doc(db('segLeitor'), 'segdds', 'd2')));
  await assertSucceeds(getDoc(doc(db('segReg'), 'segdds', 'd1')), 'o autor lê o que registrou');
  await assertFails(getDoc(doc(db('liderRec'), 'segdds', 'd1')), 'quem não vê a Segurança não lê');
  await assertFails(deleteDoc(doc(db('segReg'), 'segdds', 'd1')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'segdds', 'd1')));
});
test('Segurança: registro com fotos num lote só; a foto segue o registro e tem limite de tamanho', async () => {
  const d = db('segReg'); const b = writeBatch(d);
  b.set(doc(d, 'seganom', 'nf1'), novaAnom('segReg', { fotos: ['ff1'], minis: ['m'] }));
  b.set(doc(d, 'segfotos', 'ff1'), { reg: 'nf1', col: 'seganom', tipo: 'antes', autor: 'segReg', por: 'segReg', conj: 'patio', area: 'PÁTIO DE CARVÃO', mes: '2026-11', mini: 'm', dados: 'd', ordem: 0, em: serverTimestamp() });
  await assertSucceeds(b.commit());
  const foto = (reg, extra = {}) => ({ reg, col: 'seganom', tipo: 'antes', autor: 'segReg', por: 'segReg', conj: 'patio', area: 'PÁTIO DE CARVÃO', mes: '2026-11', mini: 'm', dados: 'd', ordem: 1, ...extra });
  await assertSucceeds(setDoc(doc(d, 'segfotos', 'ff2'), foto('a1')));
  await assertFails(setDoc(doc(d, 'segfotos', 'ff3'), foto('a2', { conj: 'bateria' })), 'não põe foto no registro de outra pessoa');
  await assertFails(setDoc(doc(d, 'segfotos', 'ff4'), foto('a1', { dados: 'x'.repeat(700001) })), 'foto grande demais');
  await assertFails(setDoc(doc(d, 'segfotos', 'ff5'), foto('a1', { conj: 'bateria' })), 'conjunto diferente do registro');
  await assertFails(setDoc(doc(db('segLeitor'), 'segfotos', 'ff6'), foto('a1', { autor: 'segLeitor', por: 'segLeitor' })));
  await assertFails(updateDoc(doc(d, 'segfotos', 'ff2'), { dados: 'y' }), 'foto não muda');
  await assertFails(deleteDoc(doc(d, 'segfotos', 'ff2')), 'só o administrador apaga');
});
test('Segurança: quem só registra lê só os próprios registros e fotos; trata, gestor e leitura leem tudo', async () => {
  await assertSucceeds(getDoc(doc(db('segReg'), 'seginter', 'i1')));
  await assertFails(getDoc(doc(db('segReg'), 'seginter', 'i2')), 'registro de outra pessoa');
  await assertSucceeds(getDoc(doc(db('segReg'), 'seganom', 'a1')));
  await assertFails(getDoc(doc(db('segReg'), 'seganom', 'a2')));
  await assertSucceeds(qSeg('segReg', 'seganom', where('por', '==', 'segReg')));
  await assertSucceeds(getDocs(query(collection(db('segReg'), 'seganom'), where('status', '==', 'aberta'), where('por', '==', 'segReg'))));
  await assertFails(qSeg('segReg', 'seganom'), 'sem o filtro dos próprios, a lista é negada');
  await assertSucceeds(getDoc(doc(db('segReg'), 'segfotos', 'f1')));
  await assertFails(getDoc(doc(db('segReg'), 'segfotos', 'f2')));
  for (const u of ['segTrata', 'segGestor', 'segLeitor', 'admin']) {
    await assertSucceeds(qSeg(u, 'seginter'), u); await assertSucceeds(qSeg(u, 'seganom'), u);
    await assertSucceeds(getDoc(doc(db(u), 'segfotos', 'f2')), u);
  }
  for (const u of ['liderRec', 'coord', 'gestorP', 'admv', 'bloqNovo', 'rhSo']) await assertFails(getDoc(doc(db(u), 'seganom', 'a1')), u);
});
test('Segurança: o supervisor da área lê e trata as anomalias da área dele; as de outra área, não', async () => {
  await assertSucceeds(getDoc(doc(db('supPatio'), 'seganom', 'a1')));
  await assertSucceeds(getDoc(doc(db('supPatio'), 'seginter', 'i1')));
  await assertSucceeds(getDoc(doc(db('supPatio'), 'segfotos', 'f1')));
  await assertFails(getDoc(doc(db('supPatio'), 'seganom', 'a2')), 'Bateria não é a área dele');
  await assertSucceeds(qSeg('supPatio', 'seganom', where('conj', '==', 'patio')));
  await assertFails(qSeg('supPatio', 'seganom', where('conj', '==', 'bateria')));
  await assertSucceeds(getDoc(doc(db('supBat'), 'seganom', 'a2')));
  await assertFails(getDoc(doc(db('supBat'), 'seganom', 'a1')));
  await assertFails(getDoc(doc(db('supSemArea'), 'seganom', 'a1')), 'escopo Pátio, mas a área dele é da Bateria');
  await assertSucceeds(getDoc(doc(db('sup'), 'seganom', 'a2')), 'cadastro antigo: supervisor da Bateria 1 também');
  await assertSucceeds(updateDoc(doc(db('supPatio'), 'seganom', 'a1'), acomp('supPatio', 'aberta')), 'assume (define o responsável) sem mudar a situação');
  await assertFails(updateDoc(doc(db('supPatio'), 'seganom', 'a2'), acomp('supPatio', 'tratamento')), 'não trata a de outra área');
  await assertFails(updateDoc(doc(db('supPatio'), 'seganom', 'a1'), { desc: 'mudou' }), 'não muda o que foi registrado');
  const dbB = db('supBat'); // a mesma instância para o lote e as referências
  const b = writeBatch(dbB);
  b.set(doc(dbB, 'segfotos', 'fd1'), { reg: 'a2', col: 'seganom', tipo: 'depois', autor: 'segReg2', por: 'supBat', conj: 'bateria', area: 'BATERIA', mes: '2026-11', mini: 'm', dados: 'd', ordem: 0 });
  b.update(doc(dbB, 'seganom', 'a2'), acomp('supBat', 'concluida', { fotoDepois: 'fd1', miniDepois: 'm' }));
  await assertSucceeds(b.commit());
});
test('Várias áreas: o supervisor vale em todas as da lista (3ª área inclusive); o líder só na area', async () => {
  const fp = (pid, k) => ({ [`fp.${pid}|${k}`]: { por: 'x', nome: 'X', em: '2026-10-21' } });
  await assertSucceeds(updateDoc(doc(db('supVarias'), 'b_semanas', SEM_B1), { 's.B1-003': 'P______', ...fp('B1-003', 0) }), '3ª área (Bateria 1)');
  await assertSucceeds(updateDoc(doc(db('supVarias'), 'semanas', SEM_PREP), { 's.PRE-003': 'P______', ...fp('PRE-003', 0) }));
  await assertSucceeds(getDoc(doc(db('supVarias'), 'gcolab', 'BATERIA 1')), 'fichas da 3ª área');
  await assertFails(getDoc(doc(db('supVarias'), 'gcolab', 'OPERAÇÃO DE EQUIPAMENTOS')));
  await assertSucceeds(getDoc(doc(db('supVarias'), 'seganom', 'a2')), 'anomalia da Bateria pela 3ª área');
  await assertFails(getDoc(doc(db('liderComLista'), 'gcolab', 'PREPARAÇÃO')), 'líder: a lista não vale');
});
test('Segurança: acompanhamento só por quem trata, só nos campos do tratamento e concluir pede a foto do depois', async () => {
  await assertSucceeds(updateDoc(doc(db('segTrata'), 'seganom', 'a4'), acomp('segTrata', 'tratamento')));
  await assertFails(updateDoc(doc(db('segTrata'), 'seganom', 'a4'), acomp('segTrata', 'concluida')), 'sem a foto do depois');
  await assertSucceeds(updateDoc(doc(db('segGestor'), 'seganom', 'a4'), acomp('segGestor', 'concluida', { fotoDepois: 'fx', miniDepois: 'm' })));
  await assertFails(updateDoc(doc(db('segTrata'), 'seganom', 'a4'), { ...acomp('segTrata', 'tratamento'), local: 'OUTRO' }), 'não muda o registro');
  await assertFails(updateDoc(doc(db('segTrata'), 'seganom', 'a4'), acomp('segTrata', 'perdida')), 'situação inválida');
  for (const u of ['segReg', 'segLeitor', 'liderRec']) await assertFails(updateDoc(doc(db(u), 'seganom', 'a1'), acomp(u, 'tratamento')), u);
  await assertFails(deleteDoc(doc(db('segTrata'), 'seganom', 'a1')), 'só o administrador apaga');
  await assertSucceeds(deleteDoc(doc(db('admin'), 'seginter', 'i3')));
});
test('Segurança: o autor corrige o próprio registro por 24 h e a anomalia só enquanto está aberta', async () => {
  await assertSucceeds(updateDoc(doc(db('segReg'), 'seganom', 'a1'), { desc: 'corrigida', atualizadoEm: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db('segReg'), 'seginter', 'i1'), { resp: 'Outro Nome', atualizadoEm: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('segReg'), 'seganom', 'a3'), { desc: 'tarde demais' }), 'passou de 24 horas');
  await assertFails(updateDoc(doc(db('segReg'), 'seganom', 'a4'), { desc: 'já está em tratamento' }));
  await assertFails(updateDoc(doc(db('segReg2'), 'seganom', 'a1'), { desc: 'não é meu' }));
  await assertFails(updateDoc(doc(db('segReg'), 'seganom', 'a1'), { por: 'segReg2' }), 'autor não muda');
  await assertFails(updateDoc(doc(db('segReg'), 'seganom', 'a1'), { status: 'concluida' }), 'quem registra não trata');
});
test('Segurança: listas dos formulários — todos os ativos leem; administrador e o gestor da Segurança (Dos módulos) alteram', async () => {
  for (const u of ['segReg', 'supPatio', 'liderRec']) await assertSucceeds(getDoc(doc(db(u), 'config', 'seguranca')), u);
  await assertSucceeds(setDoc(doc(db('admin'), 'config', 'seguranca'), { tipos: ['ROTINA'] }));
  await assertSucceeds(setDoc(doc(db('admModSeg'), 'config', 'seguranca'), { tipos: ['ROTINA', 'PARADA'] }));
  for (const u of ['segGestor', 'segTrata', 'admModulo']) await assertFails(setDoc(doc(db(u), 'config', 'seguranca'), { tipos: [] }), u);
});

// ---------------- Limpeza de dados (Administração, só o administrador) ----------------
test('Limpeza de dados: o administrador apaga semanas, aprovações, Segurança, equipamentos e histórico e tira o mês da lista', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    for (const a of ['RECEBIMENTO', 'PREPARAÇÃO']) { await setDoc(doc(d, 'semanas', a + '|2026-01-05'), { area: a, mes: '2026-01', ini: '2026-01-05', ids: ['X1'], s: { X1: 'PPRN___' }, ev: {} }); await setDoc(doc(d, 'aprov', a + '|2026-01-05'), { area: a, mes: '2026-01', v: {} }); }
    await setDoc(doc(d, 'b_semanas', 'BATERIA 1|2026-01-05'), { area: 'BATERIA 1', mes: '2026-01', s: {}, ev: {} });
    await setDoc(doc(d, 'b_aprov', 'BATERIA 1|2026-01-05'), { area: 'BATERIA 1', mes: '2026-01', v: {} });
    await setDoc(doc(d, 'b_config', 'sistema'), { rotas: [], meses: ['2026-01', '2026-11'] });
    await setDoc(doc(d, 'config', 'sistema'), { rotas: [], meses: ['2026-01', '2026-11'] }, { merge: true });
    for (const c of ['eqlanc', 'eqpar', 'eqinsp']) for (const id of ['lp1', 'lp2']) await setDoc(doc(d, c, id), { mes: '2026-01', data: '2026-01-10', por: 'eqOpLider' });
    for (const id of ['lh1', 'lh2']) await setDoc(doc(d, 'historico', id), { t: 'antigo' });
    await setDoc(doc(d, 'seginter', 'lpi'), { ...SEG_BASE, ...INTER_X, ...PAT, mes: '2026-01', data: '2026-01-10', por: 'segReg', em: Timestamp.now() });
    await setDoc(doc(d, 'seganom', 'lpa'), { ...SEG_BASE, ...ANOM_X, ...PAT, mes: '2026-01', data: '2026-01-10', por: 'segReg', em: Timestamp.now(), fotos: ['lpf'] });
    await setDoc(doc(d, 'segfotos', 'lpf'), { reg: 'lpa', col: 'seganom', tipo: 'antes', autor: 'segReg', por: 'segReg', conj: 'patio', area: 'PÁTIO DE CARVÃO', mes: '2026-01', mini: 'm', dados: 'd', ordem: 0 });
  });
  // ninguém além do administrador apaga semanas, aprovações, registros da Segurança e fotos
  const quem = ['gestorP', 'admModulo', 'coord', 'sup', 'liderRec', 'gestorG', 'segGestor', 'segTrata', 'supPatio', 'admv'];
  for (const u of quem) {
    await assertFails(deleteDoc(doc(db(u), 'semanas', 'RECEBIMENTO|2026-01-05')), `${u} não apaga semana`);
    await assertFails(deleteDoc(doc(db(u), 'aprov', 'RECEBIMENTO|2026-01-05')), `${u} não apaga aprovação`);
    await assertFails(deleteDoc(doc(db(u), 'b_semanas', 'BATERIA 1|2026-01-05')), `${u} não apaga semana da Bateria`);
    await assertFails(deleteDoc(doc(db(u), 'b_aprov', 'BATERIA 1|2026-01-05')), `${u} não apaga aprovação da Bateria`);
    await assertFails(deleteDoc(doc(db(u), 'seganom', 'lpa')), `${u} não apaga anomalia`);
    await assertFails(deleteDoc(doc(db(u), 'seginter', 'lpi')), `${u} não apaga interação`);
    await assertFails(deleteDoc(doc(db(u), 'segfotos', 'lpf')), `${u} não apaga foto`);
  }
  // equipamentos: sem o escopo Equipamentos ninguém apaga; quem lança na Operação continua apagando o lançamento (como antes)
  for (const u of ['gestorP', 'coord', 'sup', 'liderRec', 'admModulo', 'eqGeLeitor', 'eqGeSup']) for (const c of ['eqlanc', 'eqpar', 'eqinsp']) await assertFails(deleteDoc(doc(db(u), c, 'lp1')), `${u} ${c}`);
  await assertSucceeds(deleteDoc(doc(db('eqOpLider'), 'eqlanc', 'lp2')), 'quem lançou apaga o próprio lançamento');
  await assertFails(deleteDoc(doc(db('eqOpLider2'), 'eqpar', 'lp2')), 'outro líder não apaga');
  // líder não marca a dispensa (dx) nem mexe na lista de meses
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', 'RECEBIMENTO|2026-01-05'), { 's.X1': '__RN___', 'dx.X1|0': '2026-11-03' }), 'líder não dispensa');
  await assertFails(updateDoc(doc(db('sup'), 'semanas', 'RECEBIMENTO|2026-01-05'), { 'dx.X1|0': '2026-11-03' }), 'supervisor não dispensa');
  await assertFails(updateDoc(doc(db('liderRec'), 'config', 'sistema'), { meses: ['2026-11'] }));
  // administrador: dispensa (alteração da semana), apaga tudo num lote só e tira o mês da lista
  const a = db('admin');
  await assertSucceeds(updateDoc(doc(a, 'semanas', 'PREPARAÇÃO|2026-01-05'), { 's.X1': '__RN___', 'dx.X1|0': '2026-11-03', 'dx.X1|1': '2026-11-03' }));
  const b = writeBatch(a);
  b.delete(doc(a, 'semanas', 'RECEBIMENTO|2026-01-05')); b.delete(doc(a, 'aprov', 'RECEBIMENTO|2026-01-05'));
  b.delete(doc(a, 'b_semanas', 'BATERIA 1|2026-01-05')); b.delete(doc(a, 'b_aprov', 'BATERIA 1|2026-01-05'));
  for (const c of ['eqlanc', 'eqpar', 'eqinsp']) b.delete(doc(a, c, 'lp1'));
  b.delete(doc(a, 'segfotos', 'lpf')); b.delete(doc(a, 'seganom', 'lpa')); b.delete(doc(a, 'seginter', 'lpi'));
  b.delete(doc(a, 'historico', 'lh1'));
  b.update(doc(a, 'config', 'sistema'), { meses: ['2026-11'] }); b.update(doc(a, 'b_config', 'sistema'), { meses: ['2026-11'] });
  await assertSucceeds(b.commit());
  await assertSucceeds(getDocs(query(collection(a, 'historico'), where('at', '<', new Date('2026-06-01T00:00:00')))), 'lê o histórico antigo para a prévia');
});
test('Limpeza de dados: a Administração Dos módulos continua gerando meses, mas não apaga semanas', async () => {
  const d = db('admModulo');
  await assertSucceeds(setDoc(doc(d, 'semanas', 'RECEBIMENTO|2027-03-01'), { area: 'RECEBIMENTO', mes: '2027-03', ini: '2027-03-01', ids: [], s: {}, m: {} }));
  await assertFails(deleteDoc(doc(d, 'semanas', 'RECEBIMENTO|2027-03-01')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'semanas', 'RECEBIMENTO|2027-03-01')));
});

// ---------------- Feriados nas atividades (marca fe; public/contas/feriados.js) ----------------
test('Feriados: o administrador marca e desfaz a atividade em feriado (Pátio e Bateria); líder e supervisor não', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'semanas', 'RECEBIMENTO|2026-11-02'), { area: 'RECEBIMENTO', mes: '2026-11', ini: '2026-11-02', ids: ['X1'], s: { X1: 'PPPPP__' }, m: {}, ev: {} });
    await setDoc(doc(d, 'b_semanas', 'BATERIA 1|2026-11-02'), { area: 'BATERIA 1', mes: '2026-11', ini: '2026-11-02', ids: ['Y1'], s: { Y1: 'PPPPP__' }, m: {}, ev: {} });
  });
  await assertFails(updateDoc(doc(db('liderRec'), 'semanas', 'RECEBIMENTO|2026-11-02'), { 's.X1': '_PPPP__', 'fe.X1|0': 'Finados' }), 'líder não marca feriado');
  await assertFails(updateDoc(doc(db('sup'), 'semanas', 'RECEBIMENTO|2026-11-02'), { 'fe.X1|0': 'Finados' }), 'supervisor não marca feriado');
  const a = db('admin');
  for (const [c, id, pid] of [['semanas', 'RECEBIMENTO|2026-11-02', 'X1'], ['b_semanas', 'BATERIA 1|2026-11-02', 'Y1']]) {
    const b = writeBatch(a);
    b.update(doc(a, c, id), { [`s.${pid}`]: '_PPPP__', [`fe.${pid}|0`]: 'Finados' });
    await assertSucceeds(b.commit(), `${c}: marca`);
    await assertSucceeds(updateDoc(doc(a, c, id), { [`s.${pid}`]: 'PPPPP__', [`fe.${pid}|0`]: deleteField() }), `${c}: desfaz`);
  }
  // a Administração Dos módulos (gera os meses) cria a semana já marcada
  await assertSucceeds(setDoc(doc(db('admModulo'), 'semanas', 'RECEBIMENTO|2026-11-16'), { area: 'RECEBIMENTO', mes: '2026-11', ini: '2026-11-16', ids: ['X1'], s: { X1: 'PPPP___' }, fe: { 'X1|4': 'Consciência Negra' }, m: {} }));
});

test('Erros nos aparelhos: quem tem cadastro grava o próprio erro (campos curtos); só o administrador lê e apaga', async () => {
  const e = (uid, extra = {}) => ({ quando: serverTimestamp(), uid, msg: 'TypeError: x is undefined', onde: 'telas/apontar.js:10', tela: 'apontar', versao: 'dikma-operacao-v96', aparelho: 'Android', vezes: 1, ...extra });
  await assertSucceeds(setDoc(doc(db('liderRec'), 'erros', 'e1'), e('liderRec')));
  await assertFails(setDoc(doc(db('liderRec'), 'erros', 'e2'), e('admin')), 'não grava em nome de outro');
  await assertFails(setDoc(doc(db('liderRec'), 'erros', 'e3'), e('liderRec', { msg: 'x'.repeat(301) })), 'mensagem longa demais');
  await assertFails(setDoc(doc(db('liderRec'), 'erros', 'e4'), e('liderRec', { senha: '123' })), 'campo a mais');
  await assertFails(setDoc(doc(db('liderRec'), 'erros', 'e5'), e('liderRec', { quando: Timestamp.fromMillis(0) })), 'data falsa');
  await assertFails(setDoc(doc(db(null), 'erros', 'e6'), { ...e('x') }), 'sem login');
  await assertFails(setDoc(doc(db('semPerfil'), 'erros', 'e7'), e('semPerfil')), 'conta sem cadastro');
  await assertFails(getDoc(doc(db('liderRec'), 'erros', 'e1')), 'líder não lê');
  await assertFails(updateDoc(doc(db('admin'), 'erros', 'e1'), { msg: 'outro' }), 'ninguém altera');
  await assertSucceeds(getDocs(collection(db('admin'), 'erros')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'erros', 'e1')));
});

test('Efetivo do dia: o líder envia a área dele; o RH valida ou devolve; validado, só o administrador reabre', async () => {
  const D = '2026-11-20';
  const ef = (uid, area, st, extra = {}) => ({ area, data: D, mes: '2026-11', st, por: uid, nome: uid, em: serverTimestamp(), mot: '', hist: [{ st, nome: uid, em: '2026-11-20T11:00:00.000Z' }], ...extra });
  const ref = (u, area, col = 'efetivoDia') => doc(db(u), col, `${D}_${area}`);
  await assertFails(setDoc(ref('liderRec', 'PREPARAÇÃO'), ef('liderRec', 'PREPARAÇÃO', 'enviado')), 'líder em outra área');
  await assertFails(setDoc(ref('liderRec', 'RECEBIMENTO'), ef('liderPrep', 'RECEBIMENTO', 'enviado')), 'em nome de outra pessoa');
  await assertFails(setDoc(ref('liderRec', 'RECEBIMENTO'), { ...ef('liderRec', 'RECEBIMENTO', 'enviado'), em: Timestamp.fromDate(new Date('2026-01-01')) }), 'hora do aparelho');
  await assertFails(setDoc(doc(db('liderRec'), 'efetivoDia', `${D}_PREPARAÇÃO`), ef('liderRec', 'RECEBIMENTO', 'enviado')), 'id de outra área');
  await assertFails(setDoc(ref('liderRec', 'RECEBIMENTO'), ef('liderRec', 'RECEBIMENTO', 'validado')), 'o líder não valida');
  await assertFails(setDoc(ref('rhSo', 'RECEBIMENTO'), ef('rhSo', 'RECEBIMENTO', 'validado')), 'o RH não valida o que não foi enviado');
  await assertSucceeds(setDoc(ref('liderRec', 'RECEBIMENTO'), ef('liderRec', 'RECEBIMENTO', 'enviado')));
  await assertSucceeds(setDoc(ref('supVarias', 'PREPARAÇÃO'), ef('supVarias', 'PREPARAÇÃO', 'enviado')), 'supervisor numa das áreas dele');
  await assertSucceeds(getDoc(ref('rhSo', 'RECEBIMENTO')), 'o RH lê');
  await assertSucceeds(getDoc(ref('rhLeitorNovo', 'RECEBIMENTO')), 'RH somente leitura lê');
  await assertFails(getDoc(ref('segReg', 'RECEBIMENTO')), 'quem não lê a presença não lê');
  await assertFails(setDoc(ref('rhLeitorNovo', 'RECEBIMENTO'), ef('rhLeitorNovo', 'RECEBIMENTO', 'validado')), 'RH somente leitura não valida');
  await assertFails(setDoc(ref('rhSo', 'RECEBIMENTO'), ef('rhSo', 'RECEBIMENTO', 'devolvido')), 'devolver pede o motivo');
  await assertSucceeds(setDoc(ref('rhSo', 'PREPARAÇÃO'), ef('rhSo', 'PREPARAÇÃO', 'devolvido', { mot: 'Falta sem justificativa' })));
  await assertSucceeds(setDoc(ref('liderPrep', 'PREPARAÇÃO'), ef('liderPrep', 'PREPARAÇÃO', 'enviado')), 'reenviar depois de devolvido');
  await assertSucceeds(setDoc(ref('rhSo', 'RECEBIMENTO'), ef('rhSo', 'RECEBIMENTO', 'validado')));
  await assertFails(setDoc(ref('liderRec', 'RECEBIMENTO'), ef('liderRec', 'RECEBIMENTO', 'enviado')), 'validado não volta pelo líder');
  await assertFails(setDoc(ref('rhSo', 'RECEBIMENTO'), ef('rhSo', 'RECEBIMENTO', 'aberto')), 'o RH não reabre');
  await assertSucceeds(setDoc(ref('admin', 'RECEBIMENTO'), ef('admin', 'RECEBIMENTO', 'aberto')), 'o administrador reabre');
  await assertSucceeds(setDoc(ref('liderRec', 'RECEBIMENTO'), ef('liderRec', 'RECEBIMENTO', 'enviado')), 'reaberto: o líder envia de novo');
  await assertFails(deleteDoc(ref('liderRec', 'RECEBIMENTO')));
  await assertFails(setDoc(ref('liderRec', 'BATERIA 1', 'b_efetivoDia'), ef('liderRec', 'BATERIA 1', 'enviado')), 'sem a Bateria');
  await assertSucceeds(setDoc(ref('supBat', 'BATERIA 1', 'b_efetivoDia'), ef('supBat', 'BATERIA 1', 'enviado')), 'Bateria');
});
