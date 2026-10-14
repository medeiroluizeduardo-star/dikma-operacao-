// Testes das rotinas do GitHub (pasta integracao/admin) no emulador do Firebase:
// envio dos dados de importação, criação/recuperação do administrador, cópia de segurança e restauração.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const projeto = process.env.GCLOUD_PROJECT || 'demo-dikma';
initializeApp({ projectId: projeto });
const db = getFirestore();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dikma-'));

function rodar(script, env = {}) {
  const r = spawnSync(process.execPath, [path.join(raiz, 'integracao', 'admin', script)], {
    cwd: tmp, encoding: 'utf8',
    env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: '', GITHUB_STEP_SUMMARY: '', GCLOUD_PROJECT: projeto, ...env }
  });
  if (r.status !== 0) throw new Error(`${script} falhou (${r.status}):\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
async function limpar() {
  const h = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${h}/emulator/v1/projects/${projeto}/databases/(default)/documents`, { method: 'DELETE' });
}
async function entrar(email, senha) {
  const h = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const r = await fetch(`http://${h}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=teste`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: senha, returnSecureToken: true })
  });
  return r.ok;
}
const senhaDe = saida => (saida.match(/Senha provisória: (\S+)/) || [])[1];

before(limpar);

test('publicação: envia os dados de importação ao banco e não regrava o que não mudou', async () => {
  const s1 = rodar('enviar-dados.mjs');
  assert.match(s1, /seed-efetivo \| [^|]+ \| enviado/);
  const d = await db.doc('seeds/seed-efetivo').get();
  assert.equal(d.get('json'), fs.readFileSync(path.join(raiz, 'dados-importacao', 'seed-efetivo.json'), 'utf8'));
  const s2 = rodar('enviar-dados.mjs');
  assert.match(s2, /seed-efetivo \| [^|]+ \| sem mudança/);
});

test('administrador: cria o primeiro, recupera a senha e promove um usuário existente', async () => {
  const s1 = rodar('administrador.mjs', { ADM_USUARIO: 'chefe', ADM_NOME: 'Chefe Teste' });
  const senha1 = senhaDe(s1);
  assert.ok(senha1 && senha1.length >= 10, 'mostra a senha provisória');
  const lg = (await db.doc('logins/chefe').get()).data();
  const u = (await db.doc(`usuarios/${lg.uid}`).get()).data();
  assert.equal(u.papel, 'admin');
  assert.equal(u.trocarSenha, true);
  assert.equal((await db.doc('config/bootstrap').get()).get('uid'), lg.uid);
  assert.ok(await entrar(lg.email, senha1), 'entra com a senha provisória');

  // recuperação: a senha antiga deixa de valer, a nova vale, o cadastro continua o mesmo
  const senha2 = senhaDe(rodar('administrador.mjs', { ADM_USUARIO: 'chefe' }));
  assert.notEqual(senha2, senha1);
  assert.ok(!(await entrar(lg.email, senha1)), 'senha antiga não vale mais');
  assert.ok(await entrar(lg.email, senha2), 'senha nova vale');
  assert.equal((await db.doc('logins/chefe').get()).get('uid'), lg.uid);

  // usuário sem cadastro e sem nome: recusa
  assert.throws(() => rodar('administrador.mjs', { ADM_USUARIO: 'ninguem' }), /não existe no sistema/);
  // usuário inválido: recusa
  assert.throws(() => rodar('administrador.mjs', { ADM_USUARIO: 'A B' }), /Usuário inválido/);

  // login que existe mas a conta de login sumiu: recria a conta e mantém o nome
  await db.doc('logins/lider1').set({ uid: 'uidSumido', email: 'lider1.x@usuarios.dikma.app' });
  await db.doc('usuarios/uidSumido').set({ nome: 'Líder Um', login: 'lider1', papel: 'lider', area: 'RECEBIMENTO' });
  const s3 = rodar('administrador.mjs', { ADM_USUARIO: 'lider1' });
  const lg3 = (await db.doc('logins/lider1').get()).data();
  assert.notEqual(lg3.uid, 'uidSumido');
  const u3 = (await db.doc(`usuarios/${lg3.uid}`).get()).data();
  assert.equal(u3.papel, 'admin');
  assert.equal(u3.nome, 'Líder Um');
  assert.ok(!(await db.doc('usuarios/uidSumido').get()).exists, 'perfil antigo sem conta é removido');
  assert.ok(await entrar(lg3.email, senhaDe(s3)));
});

test('cópia de segurança e restauração: voltam os dados com os tipos certos, e dá para desfazer', async () => {
  const quando = Timestamp.fromDate(new Date('2026-10-02T10:30:00Z'));
  await db.doc('gocorr/x').set({ n: 1, criadoEm: quando, lista: [1, { em: quando }], ref: db.doc('gestao/colaboradores'), bin: Buffer.from([1, 2, 3]), vazio: null });
  await db.doc('gocorr/y').set({ n: 10 });
  await db.doc('historico/h1').set({ at: quando, t: 'x' });
  await db.doc('evidenciasArquivo/f1').set({ dados: 'foto' });

  const pasta = path.join(tmp, 'copia');
  const s = rodar('backup.mjs', { BACKUP_TIPO: 'diaria', BACKUP_PASTA: pasta });
  const man = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
  assert.equal(man.colecoes.gocorr.documentos, 2);
  assert.ok(!man.colecoes.historico && !man.colecoes.evidenciasArquivo && !man.colecoes.seeds, 'diária deixa de fora histórico, fotos e dados de importação');
  assert.match(s, /documentos lidos/);
  rodar('backup.mjs', { BACKUP_TIPO: 'semanal', BACKUP_PASTA: path.join(tmp, 'sem') });
  const sem = JSON.parse(fs.readFileSync(path.join(tmp, 'sem', 'manifesto.json'), 'utf8'));
  assert.ok(sem.colecoes.historico && !sem.colecoes.evidenciasArquivo, 'semanal inclui o histórico e não as fotos');

  // estrago: muda x, apaga y, cria z
  await db.doc('gocorr/x').update({ n: 2 });
  await db.doc('gocorr/y').delete();
  await db.doc('gocorr/z').set({ n: 99 });

  // só conferir: nada muda
  const conf = rodar('restaurar.mjs', { RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'gocorr', RESTAURAR_APAGAR: '1' });
  assert.match(conf, /só conferência/);
  assert.match(conf, /\| gocorr \| 1 \| 1 \| 0 \| 1 \|/);
  assert.equal((await db.doc('gocorr/x').get()).get('n'), 2);

  // um documento só
  rodar('restaurar.mjs', { RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'gocorr', RESTAURAR_DOCUMENTOS: 'y', RESTAURAR_APLICAR: '1' });
  assert.equal((await db.doc('gocorr/y').get()).get('n'), 10);
  assert.equal((await db.doc('gocorr/x').get()).get('n'), 2, 'os outros não mudam');

  // tudo, apagando o que foi criado depois
  const antesPasta = path.join(tmp, 'antes');
  fs.rmSync(antesPasta, { recursive: true, force: true });
  rodar('restaurar.mjs', { RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'gocorr', RESTAURAR_APAGAR: '1', RESTAURAR_APLICAR: '1' });
  const x = (await db.doc('gocorr/x').get()).data();
  assert.equal(x.n, 1);
  assert.ok(x.criadoEm instanceof Timestamp && x.criadoEm.isEqual(quando), 'data volta como data');
  assert.ok(x.lista[1].em instanceof Timestamp, 'data dentro de lista também');
  assert.equal(x.ref.path, 'gestao/colaboradores');
  assert.deepEqual([...x.bin], [1, 2, 3]);
  assert.equal(x.vazio, null);
  assert.ok(!(await db.doc('gocorr/z').get()).exists, 'o criado depois foi apagado');

  // desfazer com o pacote "estado antes"
  rodar('restaurar.mjs', { RESTAURAR_PASTA: antesPasta, RESTAURAR_COLECOES: 'gocorr', RESTAURAR_APLICAR: '1' });
  assert.equal((await db.doc('gocorr/x').get()).get('n'), 2);
  assert.equal((await db.doc('gocorr/z').get()).get('n'), 99);

  // coleção que não está na cópia: recusa
  assert.throws(() => rodar('restaurar.mjs', { RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'historico' }), /Não estão nesta cópia/);
});

test('divisão do Efetivo por área: cada ficha vai para a área onde a pessoa está, e ocorrências e assinaturas acompanham', async () => {
  await limpar();
  await db.doc('config/sistema').set({ rotas: [] });
  await db.doc('colaboradores/RECEBIMENTO').set({ itens: [{ id: 'C001', mat: '111', nome: 'ANA PATIO', area: 'RECEBIMENTO', rota: 'RECEBIMENTO' }] });
  await db.doc('eq/config').set({ turno: {} });
  await db.doc('eq/cadastro').set({ operadores: [{ nome: 'BRUNO OPERADOR', funcao: 'OPERADOR' }], frota: [] });
  await db.doc('gestao/colaboradores').set({ itens: [{ mat: '111', nome: 'ANA PATIO', area: 'COQUERIA' }, { mat: '222', nome: 'BRUNO OPERADOR', area: 'COQUERIA' }, { mat: '333', nome: 'CARLA SEDE', area: 'Sede' }] });
  await db.doc('gocorr/oa').set({ mat: '111', status: 'pendente' });
  await db.doc('gocorr/ob').set({ mat: '222', status: 'assinada' });
  await db.doc('gocorr/oc').set({ mat: '333', status: 'pendente' });
  await db.doc('gassin/sb').set({ mat: '222', ocorrIds: ['ob'], metodo: 'tela' });

  const s = rodar('migrar-areas.mjs');
  assert.match(s, /3 fichas organizadas/);
  assert.deepEqual((await db.doc('gcolab/RECEBIMENTO').get()).get('itens').map(c => c.mat), ['111']);
  assert.deepEqual((await db.doc('gcolab/OPERAÇÃO DE EQUIPAMENTOS').get()).get('itens').map(c => c.mat), ['222']);
  assert.deepEqual((await db.doc('gcolab/GERAL').get()).get('itens').map(c => c.mat), ['333']);
  assert.equal((await db.doc('gocorr/oa').get()).get('area'), 'RECEBIMENTO');
  assert.equal((await db.doc('gocorr/ob').get()).get('area'), 'OPERAÇÃO DE EQUIPAMENTOS');
  assert.equal((await db.doc('gocorr/oc').get()).get('area'), 'GERAL');
  assert.equal((await db.doc('gassin/sb').get()).get('area'), 'OPERAÇÃO DE EQUIPAMENTOS');
  assert.ok(!(await db.doc('gestao/colaboradores').get()).exists, 'lista antiga apagada');
  assert.match(rodar('migrar-areas.mjs'), /Nada a fazer/);
});
