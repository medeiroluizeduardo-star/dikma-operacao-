// Cria o primeiro administrador ou recupera o acesso de um administrador (senha esquecida, conta apagada,
// perfil trocado por engano). Roda pelo GitHub: Actions › Administrador do sistema › Run workflow.
// Pelo site isso não é possível: as regras do Firestore bloqueiam, para ninguém virar administrador sozinho.
//   ADM_USUARIO  usuário de login (ex.: luiz.eduardo)  — obrigatório
//   ADM_NOME     nome da pessoa (obrigatório só quando o usuário ainda não existe)
// Gera uma senha provisória, mostrada no resumo da execução. No primeiro acesso o sistema pede uma senha nova.
import crypto from 'node:crypto';
import { conectar, resumo } from './comum.mjs';

const login = String(process.env.ADM_USUARIO || '').trim().toLowerCase();
const nome = String(process.env.ADM_NOME || '').trim();
if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(login)) {
  console.error('::error::Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
  process.exit(1);
}

const { db, auth, F } = await conectar();
const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
const senha = Array.from(crypto.randomBytes(10), b => letras[b % letras.length]).join('');
const emailInterno = () => `${login}.${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}@usuarios.dikma.app`;

const refLogin = db.collection('logins').doc(login);
const lg = await refLogin.get();
let uid = lg.exists ? lg.get('uid') : null;
let perfil = null, contaOk = false, acao;

if (uid) {
  perfil = (await db.collection('usuarios').doc(uid).get()).data() || null;
  try { await auth.getUser(uid); contaOk = true; } catch (e) { contaOk = false; }
}
if (!perfil && !nome) {
  console.error(`::error::O usuário "${login}" não existe no sistema. Informe também o nome para criar.`);
  process.exit(1);
}

const dados = {
  nome: nome || perfil.nome, nomeUp: String(nome || perfil.nome || '').toUpperCase(), login, papel: 'admin', area: null, area2: null,
  modulos: ['operacao', 'bateria', 'sinter', 'equipamentos', 'gestao', 'frequencia'], acessos: ['operacao'],
  // Acesso por módulo (é o que vale nas regras e nas telas): Administração completa e todos os escopos.
  acesso: { operacao: 'gestor', gestao: 'gestor', seguranca: 'gestor', rh: 'administrativo', administracao: 'admin' },
  escopos: ['patio', 'bateria', 'sinter', 'equipamentos'], trocarSenha: true,
  senhaRedefinidaEm: F.FieldValue.serverTimestamp()
};

if (uid && contaOk) {
  await auth.updateUser(uid, { password: senha, disabled: false });
  await db.collection('usuarios').doc(uid).set({ ...(perfil || { criadoEm: F.FieldValue.serverTimestamp() }), ...dados });
  acao = perfil && perfil.papel === 'admin' ? 'Senha do administrador redefinida' : 'Usuário promovido a administrador';
} else {
  const email = emailInterno();
  const u = await auth.createUser({ email, password: senha, displayName: dados.nome });
  const b = db.batch();
  b.set(db.collection('usuarios').doc(u.uid), { ...(perfil || {}), ...dados, criadoEm: (perfil && perfil.criadoEm) || F.FieldValue.serverTimestamp() });
  if (uid && perfil) b.delete(db.collection('usuarios').doc(uid)); // perfil antigo sem conta de login
  b.set(refLogin, { email, uid: u.uid });
  await b.commit();
  acao = perfil ? 'Conta de login recriada para o administrador' : 'Administrador criado';
  uid = u.uid;
}

// Marca que o sistema tem administrador (a tela "Sistema sem administrador" deixa de aparecer).
const boot = db.collection('config').doc('bootstrap');
if (!(await boot.get()).exists) await boot.set({ uid, login, em: F.FieldValue.serverTimestamp(), origem: 'github' });

resumo([
  `### ${acao}`,
  `- **Usuário:** \`${login}\``,
  `- **Senha provisória:** \`${senha}\``,
  '',
  'Entre no sistema com esse usuário e essa senha. Na entrada, o sistema pede uma senha nova.',
  'A senha provisória deixa de valer quando a pessoa cria a dela.'
].join('\n'));
