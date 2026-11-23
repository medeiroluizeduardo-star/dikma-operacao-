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
import { getAuth } from 'firebase-admin/auth';

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
  // dados de exemplo (nomes fictícios), no lugar das planilhas reais que não ficam no repositório
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dikma-dados-'));
  const exemplo = path.join(raiz, 'public', 'demo', 'exemplo-efetivo.json');
  fs.copyFileSync(exemplo, path.join(pasta, 'seed-efetivo.json'));
  const env = { DADOS_IMPORTACAO: pasta };
  const s1 = rodar('enviar-dados.mjs', env);
  assert.match(s1, /seed-efetivo \| [^|]+ \| enviado/);
  const d = await db.doc('seeds/seed-efetivo').get();
  assert.equal(d.get('json'), fs.readFileSync(exemplo, 'utf8'));
  const s2 = rodar('enviar-dados.mjs', env);
  assert.match(s2, /seed-efetivo \| [^|]+ \| sem mudança/);
});

test('administrador: cria o primeiro, recupera a senha e promove um usuário existente', async () => {
  const s1 = rodar('administrador.mjs', { ADM_USUARIO: 'chefe', ADM_NOME: 'Chefe Teste' });
  const senha1 = senhaDe(s1);
  assert.ok(senha1 && senha1.length >= 10, 'mostra a senha provisória');
  const lg = (await db.doc('logins/chefe').get()).data();
  const u = (await db.doc(`usuarios/${lg.uid}`).get()).data();
  assert.equal(u.papel, 'admin');
  assert.equal(u.acesso.administracao, 'admin', 'acesso por módulo: Administração completa');
  assert.deepEqual(u.escopos, ['patio', 'bateria', 'equipamentos']);
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
  assert.equal(u3.papel, 'admin'); assert.equal(u3.acesso.administracao, 'admin');
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
  await db.doc('seeds/seed-teste').set({ json: '{}', hash: 'x' });

  const pasta = path.join(tmp, 'copia');
  const s = rodar('backup.mjs', { BACKUP_TIPO: 'diaria', BACKUP_PASTA: pasta });
  const man = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
  assert.equal(man.colecoes.gocorr.documentos, 2);
  assert.ok(!man.colecoes.historico && !man.colecoes.evidenciasArquivo, 'diária deixa de fora histórico e fotos');
  assert.ok(man.colecoes.seeds, 'diária inclui os dados de importação (não ficam mais no repositório)');
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

test('cópia de segurança: o Meu painel entra com as subcoleções e volta pela restauração', async () => {
  await limpar();
  // painel/u1 sem campos (só subcoleções), painel/u2 com campos e subcoleção dentro de subcoleção
  await db.doc('painel/u1/tasks/t1').set({ titulo: 'Tarefa', feito: false });
  await db.doc('painel/u1/tasks/t2').set({ titulo: 'Outra' });
  await db.doc('painel/u1/config/geral').set({ metas: { abs: 3 } });
  await db.doc('painel/u2').set({ nome: 'x' });
  await db.doc('painel/u2/registros/r1').set({ v: 5 });
  await db.doc('painel/u2/registros/r1/itens/i1').set({ w: 7 });
  await db.doc('gocorr/a').set({ n: 1 });

  const pasta = path.join(tmp, 'copia-painel');
  const s = rodar('backup.mjs', { BACKUP_TIPO: 'diaria', BACKUP_PASTA: pasta });
  const man = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
  assert.equal(man.colecoes['painel/u1/tasks'].documentos, 2);
  assert.equal(man.colecoes['painel/u1/config'].documentos, 1);
  assert.equal(man.colecoes['painel/u2/registros'].documentos, 1);
  assert.equal(man.colecoes['painel/u2/registros/r1/itens'].documentos, 1);
  assert.equal(man.colecoes.painel.documentos, 1);
  assert.ok(fs.existsSync(path.join(pasta, 'painel~u1~tasks.000.json.gz')));
  assert.doesNotMatch(s, /subcoleções, que não entram/);
  assert.match(s, /\| painel \| 6 \|/, 'no resumo, o painel soma tudo');

  // estrago no painel e volta pedindo só "painel"
  await db.doc('painel/u1/tasks/t1').delete();
  await db.doc('painel/u2/registros/r1/itens/i1').update({ w: 0 });
  rodar('restaurar.mjs', { RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'painel', RESTAURAR_APLICAR: '1' });
  assert.equal((await db.doc('painel/u1/tasks/t1').get()).get('titulo'), 'Tarefa');
  assert.equal((await db.doc('painel/u2/registros/r1/itens/i1').get()).get('w'), 7);
  assert.equal((await db.doc('gocorr/a').get()).get('n'), 1);
});

test('ensaio de restauração: cópia inteira passa; cópia incompleta, velha ou sem o emulador falha', async () => {
  await limpar();
  const quando = Timestamp.fromDate(new Date('2026-10-02T10:30:00Z'));
  await db.doc('usuarios/u1').set({ nome: 'Teste', acesso: { operacao: 'lider' } });
  await db.doc('config/geral').set({ x: 1 });
  await db.doc('gestao/colaboradores').set({ lista: [{ em: quando }], bin: Buffer.from([4, 5]) });
  for (let i = 0; i < 305; i++) await db.doc(`gocorr/g${String(i).padStart(3, '0')}`).set({ n: i }); // 2 partes
  await db.doc('painel/u1/tasks/t1').set({ titulo: 'Tarefa' });

  const pasta = path.join(tmp, 'copia-ensaio');
  rodar('backup.mjs', { BACKUP_TIPO: 'diaria', BACKUP_PASTA: pasta });
  await db.doc('gocorr/a-mais').set({ n: -1 }); // o ensaio zera o emulador antes de restaurar
  const s = rodar('ensaio-restauracao.mjs', { ENSAIO_PASTA: pasta });
  assert.match(s, /voltou inteira/);
  assert.match(s, /\| gocorr \| 305 \| 305 \| ok \|/);
  assert.match(s, /\| painel \| 1 \| 1 \| ok \|/);
  assert.ok(!(await db.doc('gocorr/a-mais').get()).exists);
  assert.equal((await db.doc('painel/u1/tasks/t1').get()).get('titulo'), 'Tarefa');

  // falta uma parte do pacote
  const falha = path.join(tmp, 'copia-ensaio-falha');
  fs.cpSync(pasta, falha, { recursive: true });
  fs.rmSync(path.join(falha, 'gocorr.001.json.gz'));
  assert.throws(() => rodar('ensaio-restauracao.mjs', { ENSAIO_PASTA: falha }), /gocorr: o manifesto diz 305 documento\(s\), o pacote tem 300/);

  // cópia velha (a diária parou)
  const velha = path.join(tmp, 'copia-ensaio-velha');
  fs.cpSync(pasta, velha, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(velha, 'manifesto.json'), 'utf8'));
  man.inicio = new Date(Date.now() - 5 * 864e5).toISOString();
  fs.writeFileSync(path.join(velha, 'manifesto.json'), JSON.stringify(man));
  assert.throws(() => rodar('ensaio-restauracao.mjs', { ENSAIO_PASTA: velha }), /diária pode ter parado/);
  assert.match(rodar('ensaio-restauracao.mjs', { ENSAIO_PASTA: velha, ENSAIO_IDADE_MAX_DIAS: '0' }), /voltou inteira/);

  // nunca roda fora do emulador
  assert.throws(() => rodar('ensaio-restauracao.mjs', { ENSAIO_PASTA: pasta, FIREBASE_SERVICE_ACCOUNT: '{}' }), /só roda no emulador/);
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

test('limpar contas: apaga só a conta sem usuário e sem login ligado; sem "apagar", só lista', async () => {
  const auth = getAuth();
  const mk = async uid => { try { await auth.deleteUser(uid); } catch (e) { /* não existia */ } await auth.createUser({ uid, email: uid + '@usuarios.dikma.app', password: 'senha-teste-123' }); };
  for (const uid of ['comPerfil', 'soLogin', 'sobra1', 'sobra2']) await mk(uid);
  await db.doc('usuarios/comPerfil').set({ nome: 'Com perfil', papel: 'lider' });
  await db.doc('logins/so.login').set({ uid: 'soLogin', email: 'soLogin@usuarios.dikma.app' });
  const lista = rodar('limpar-contas.mjs', { LIMPAR_DIAS: '0' });
  assert.match(lista, /\d+ sobra\(s\)/);
  assert.match(lista, /Nada foi apagado/);
  assert.ok(await auth.getUser('sobra1'));
  const s = rodar('limpar-contas.mjs', { LIMPAR_DIAS: '0', LIMPAR_APAGAR: 'sim' });
  assert.ok(+(s.match(/(\d+) apagada\(s\)/) || [])[1] >= 2, 'apagou as sobras');
  await assert.rejects(auth.getUser('sobra1'));
  await assert.rejects(auth.getUser('sobra2'));
  assert.ok(await auth.getUser('comPerfil'));
  assert.ok(await auth.getUser('soLogin'));
  const recente = rodar('limpar-contas.mjs', { LIMPAR_DIAS: '30', LIMPAR_APAGAR: 'sim' });
  assert.match(recente, /0 sobra\(s\)/, 'conta recente nunca é apagada');
});

test('publicação: quem tinha o acesso Administrativo passa a ter o módulo Frequência e férias', async () => {
  await db.doc('usuarios/antigoAdm').set({ nome: 'Antigo Adm', papel: 'supervisor', modulos: [], acessos: ['administrativo'] });
  await db.doc('usuarios/antigoAmbos').set({ nome: 'Antigo Ambos', papel: 'lider', acessos: ['operacao', 'administrativo'] });
  const s = rodar('migrar-areas.mjs');
  assert.match(s, /módulo Frequência e férias em 2 usuário/);
  assert.deepEqual((await db.doc('usuarios/antigoAdm').get()).get('modulos'), ['frequencia']);
  assert.deepEqual((await db.doc('usuarios/antigoAmbos').get()).get('modulos'), ['operacao', 'frequencia']);
  assert.deepEqual((await db.doc('usuarios/antigoAmbos').get()).get('acessos'), ['operacao']);
});

// Nomes inventados. Caso: o líder "Bento Andrade" não existe; as pessoas dele são do líder Kauê.
test('trocar líder: simular lista todos os líderes e não grava; gravar faz a cópia, troca fichas, folha atual e futura e ocorrências abertas', async () => {
  const env = { HOJE: '2026-11-03', BACKUP_PASTA: 'copia-lider' };
  await db.doc('gcolab/RECEBIMENTO').set({ itens: [
    { mat: '901', nome: 'ANA TESTE UM', lider: 'BENTO ANDRADE' }, { mat: '902', nome: 'BIA TESTE DOIS', lider: 'Bento Andrade' },
    { mat: '903', nome: 'CAIO TESTE TRES', lider: 'KAUE' }, { mat: '904', nome: 'DANI TESTE QUATRO', lider: 'BENTO ALVES' }] });
  await db.doc('gcolab/GERAL').set({ itens: [{ mat: '905', nome: 'EVA TESTE CINCO', lider: '' }] });
  const g = (nome, ...ps) => ({ nome, turno: false, pessoas: ps.map(n => ({ k: 'n:' + n, nome: n })) });
  const grupos = [g('GESTÃO', 'ZECA'), g('LIDER BENTO ANDRADE - SUPERVISÃO KARLA', 'ANA TESTE UM', 'BIA TESTE DOIS'), g('LIDER KAUE SOUSA - SUPERVISÃO ANTONIO', 'CAIO TESTE TRES')];
  for (const c of ['2026-10', '2026-11', '2026-12']) await db.doc(`freqcomp/patio|${c}`).set({ conj: 'patio', competencia: c, grupos, d: {} });
  await db.doc('gocorr/ocAberta').set({ data: '2026-11-01', mat: '901', nome: 'ANA TESTE UM', tipo: 'Outro', lider: 'BENTO ANDRADE', recolhe: 'BENTO ANDRADE', status: 'pendente' });
  await db.doc('gocorr/ocAssinada').set({ data: '2026-10-01', mat: '902', nome: 'BIA TESTE DOIS', tipo: 'Outro', lider: 'BENTO ANDRADE', recolhe: 'BENTO ANDRADE', status: 'assinada' });

  const sim = rodar('trocar-lider.mjs', { ...env, LIDER_DE: 'bento andrade', LIDER_PARA: 'kaue' });
  assert.match(sim, /simulação \(nada foi gravado\)/);
  assert.match(sim, /⟵ BENTO ANDRADE \| 2 \| Pátio\/2026-11: 2, Pátio\/2026-12: 2 \| 1 \|/);
  assert.match(sim, /⟶ KAUE \| 1 \|/); assert.match(sim, /BENTO ALVES \| 1 \|/);
  assert.match(sim, /Fichas: 2 pessoa\(s\) passam para KAUE/);
  assert.match(sim, /sem campo de líder/);
  assert.equal((await db.doc('gcolab/RECEBIMENTO').get()).get('itens')[0].lider, 'BENTO ANDRADE', 'simular não grava');
  // nome que casa com dois líderes diferentes: não grava
  assert.throws(() => rodar('trocar-lider.mjs', { ...env, LIDER_DE: 'bento', LIDER_PARA: 'kaue', LIDER_MODO: 'gravar' }), /líderes diferentes/);

  const gr = rodar('trocar-lider.mjs', { ...env, LIDER_DE: 'bento andrade', LIDER_PARA: 'kaue', LIDER_MODO: 'gravar' });
  assert.match(gr, /Gravado: 2 ficha\(s\), 2 grupo\(s\) da folha movido\(s\), 1 ocorrência/);
  assert.deepEqual((await db.doc('gcolab/RECEBIMENTO').get()).get('itens').map(c => c.lider), ['KAUE', 'KAUE', 'KAUE', 'BENTO ALVES']);
  for (const c of ['2026-11', '2026-12']) {
    const gs = (await db.doc(`freqcomp/patio|${c}`).get()).get('grupos');
    assert.deepEqual(gs.map(x => [x.nome, x.pessoas.map(p => p.nome)]), [['GESTÃO', ['ZECA']], ['LIDER KAUE SOUSA - SUPERVISÃO ANTONIO', ['ANA TESTE UM', 'BIA TESTE DOIS', 'CAIO TESTE TRES']]], 'move para o grupo do líder novo e apaga o antigo');
  }
  assert.equal((await db.doc('freqcomp/patio|2026-10').get()).get('grupos').length, 3, 'competência passada fica como está');
  const ab = (await db.doc('gocorr/ocAberta').get()).data(); assert.equal(ab.recolhe, 'KAUE'); assert.equal(ab.lider, 'KAUE');
  assert.equal((await db.doc('gocorr/ocAssinada').get()).get('recolhe'), 'BENTO ANDRADE', 'ocorrência assinada fica como está');
  const bk = (await db.collection('backups').get()).docs.find(d => d.id.startsWith('antes-trocar-lider-'));
  assert.ok(bk && JSON.parse(bk.get('json'))['gcolab/RECEBIMENTO'], 'cópia dos documentos no banco');
  assert.ok(fs.readdirSync(path.join(tmp, 'copia-lider')).some(f => f.endsWith('.json.gz')), 'cópia em arquivo');
  assert.match(rodar('trocar-lider.mjs', { ...env, LIDER_DE: 'bento andrade', LIDER_PARA: 'kaue', LIDER_MODO: 'gravar' }), /Nada a mudar/, 'rodar de novo não muda nada');
});

// Nomes inventados. Ajudante vira Executante (ADM) e Executante turno (turno) nos três lugares.
test('trocar função: simular só conta; gravar faz a cópia e troca fichas, Atividades, Equipamentos e a lista', async () => {
  await limpar();
  await db.doc('gcolab/RECEBIMENTO').set({ itens: [{ mat: '801', nome: 'ANA FUNCAO UM', funcao: 'AJUDANTE' }, { mat: '802', nome: 'BIA FUNCAO DOIS', funcao: 'AJUDANTE' }, { mat: '803', nome: 'CAIO FUNCAO TRES', funcao: 'LÍDER' }] });
  await db.doc('gcolab/OPERAÇÃO DE EQUIPAMENTOS').set({ itens: [{ mat: '804', nome: 'DANI FUNCAO QUATRO', funcao: 'AJUDANTE' }] });
  await db.doc('colaboradores/RECEBIMENTO').set({ itens: [{ id: 'C801', mat: '801', nome: 'ANA FUNCAO UM', funcao: 'AJUDANTE', regime: 'ADMINISTRATIVO' }, { id: 'C802', mat: '802', nome: 'BIA FUNCAO DOIS', funcao: 'AJUDANTE', regime: 'TURNO 4X4', turma: 'A' }] });
  await db.doc('b_colaboradores/BATERIA 1').set({ itens: [{ id: 'B001', nome: 'OUTRO NOME', funcao: 'MOTORISTA', regime: 'ADMINISTRATIVO' }] });
  await db.doc('eq/cadastro').set({ operadores: [{ mat: '804', nome: 'DANI FUNCAO QUATRO', funcao: 'AJUDANTE', escala: '4x4', turma: 'B' }] });
  await db.doc('eq/config').set({ funcoes: ['AJUDANTE', 'OPERADOR'] });
  const env = { FUNCAO_DE: 'ajudante', FUNCAO_ADM: 'executante', FUNCAO_TURNO: 'executante turno', BACKUP_PASTA: 'copia-funcao' };

  const sim = rodar('trocar-funcao.mjs', env);
  assert.match(sim, /só conferência/); assert.match(sim, /3 pessoa\(s\) mudariam: 1 ADM e 2 turno/);
  assert.doesNotMatch(sim, /ANA FUNCAO/, 'sem nomes no resumo');
  assert.match(sim, /\| AJUDANTE \| 3 \| 1 \| 2 \| 3 \| 2 \| 1 \|/, 'lista todas as funções com os números');
  assert.match(sim, /\| MOTORISTA \| 1 \|/);
  assert.equal((await db.doc('gcolab/RECEBIMENTO').get()).get('itens')[0].funcao, 'AJUDANTE', 'simular não grava');

  const gr = rodar('trocar-funcao.mjs', { ...env, FUNCAO_MODO: 'gravar' });
  assert.match(gr, /3 pessoa\(s\) mudaram/);
  assert.deepEqual((await db.doc('gcolab/RECEBIMENTO').get()).get('itens').map(c => c.funcao), ['EXECUTANTE', 'EXECUTANTE TURNO', 'LÍDER']);
  assert.equal((await db.doc('gcolab/OPERAÇÃO DE EQUIPAMENTOS').get()).get('itens')[0].funcao, 'EXECUTANTE TURNO');
  assert.deepEqual((await db.doc('colaboradores/RECEBIMENTO').get()).get('itens').map(c => c.funcao), ['EXECUTANTE', 'EXECUTANTE TURNO']);
  assert.equal((await db.doc('b_colaboradores/BATERIA 1').get()).get('atualizadoPor'), undefined, 'documento sem mudança não é regravado');
  assert.equal((await db.doc('eq/cadastro').get()).get('operadores')[0].funcao, 'EXECUTANTE TURNO');
  assert.deepEqual((await db.doc('eq/config').get()).get('funcoes'), ['EXECUTANTE TURNO', 'OPERADOR']);
  assert.deepEqual((await db.doc('config/funcoes').get()).get('lista'), ['EXECUTANTE', 'EXECUTANTE TURNO']);
  const bk = (await db.collection('backups').get()).docs.find(d => d.id.startsWith('antes-trocar-funcao-'));
  assert.equal(JSON.parse(bk.get('json'))['gcolab/RECEBIMENTO'].itens[0].funcao, 'AJUDANTE', 'cópia de antes no banco');
  assert.ok(fs.readdirSync(path.join(tmp, 'copia-funcao')).some(f => f.endsWith('.json.gz')), 'cópia em arquivo');
  assert.match(rodar('trocar-funcao.mjs', env), /0 pessoa\(s\) mudariam/, 'rodar de novo não muda ninguém');
});

// Nomes inventados. Tira um repetido sem matrícula, não tira quem só tem um cadastro e inclui quem tem ficha.
test('ajustar Atividades: tira repetido, protege cadastro único e inclui na área geral', async () => {
  await limpar();
  await db.doc('gcolab/GERAL').set({ itens: [{ mat: '901', nome: 'ZE AJUSTE UM', funcao: 'COORDENADOR' }, { mat: '902', nome: 'LIA AJUSTE DOIS', funcao: 'TST', dem: '2026-01-01' }, { mat: '903', nome: 'RUI AJUSTE TRES', funcao: 'EXECUTANTE' }] });
  await db.doc('colaboradores/RECEBIMENTO').set({ itens: [{ id: 'C017', mat: '903', nome: 'RUI AJUSTE TRES', regime: 'TURNO 4X4' }, { id: 'C040', mat: '904', nome: 'EVA AJUSTE QUATRO', regime: 'ADMINISTRATIVO' }], maiorId: 140 });
  await db.doc('colaboradores/PREPARAÇÃO').set({ itens: [{ id: 'C051', nome: 'RUI AJUSTE TRES', regime: 'ADMINISTRATIVO' }] });
  await db.doc('colaboradores/COQUERIA GERAL').set({ itens: [] });
  const env = { AJ_REMOVER: 'c051, C040, C999', AJ_INCLUIR: '901,902,903', AJ_AREA: 'coqueria geral', BACKUP_PASTA: 'copia-ajuste' };
  const sim = rodar('ajustar-atividades.mjs', env);
  assert.match(sim, /só conferência/); assert.doesNotMatch(sim, /AJUSTE/, 'sem nomes no resumo');
  assert.match(sim, /C040: tem matrícula e é o único/); assert.match(sim, /C999: não encontrado/);
  assert.match(sim, /902: ficha com demissão/); assert.match(sim, /903: já está numa lista/);
  assert.equal((await db.doc('colaboradores/PREPARAÇÃO').get()).get('itens').length, 1, 'simular não grava');
  rodar('ajustar-atividades.mjs', { ...env, AJ_MODO: 'gravar' });
  assert.deepEqual((await db.doc('colaboradores/PREPARAÇÃO').get()).get('itens'), []);
  assert.equal((await db.doc('colaboradores/RECEBIMENTO').get()).get('itens').length, 2, 'cadastro único fica');
  const g = await db.doc('colaboradores/COQUERIA GERAL').get();
  assert.deepEqual(g.get('itens').map(x => [x.id, x.mat, x.area, x.rota, x.regime]), [['C141', '901', 'COQUERIA GERAL', 'COQUERIA GERAL', 'ADMINISTRATIVO']], 'número novo depois do maior já usado');
  assert.equal(g.get('maiorId'), 141);
  assert.ok((await db.collection('backups').get()).docs.some(d => d.id.startsWith('antes-ajustar-atividades-')), 'cópia no banco');
  assert.match(rodar('ajustar-atividades.mjs', { ...env, AJ_MODO: 'gravar' }), /Nada a gravar/, 'rodar de novo não muda nada');
});
