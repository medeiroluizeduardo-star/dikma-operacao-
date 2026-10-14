// Apaga as contas de login que sobraram sem usuário no sistema (Firebase Authentication).
// Elas aparecem quando a senha de alguém é redefinida pelo site (o site cria uma conta nova e só desativa a antiga)
// ou quando um usuário é apagado. Não dão acesso a nada (as regras exigem o cadastro em usuarios/), mas acumulam.
// Só apaga a conta que: não tem usuarios/{uid}, não está ligada a nenhum login (logins/), foi criada há mais de
// LIMPAR_DIAS dias e não entrou nesse período. LIMPAR_APAGAR=sim apaga; sem isso, só lista.
import { conectar, resumo } from './comum.mjs';

const dias = Number(process.env.LIMPAR_DIAS ?? 30);
const apagar = process.env.LIMPAR_APAGAR === 'sim';
const { db, auth } = await conectar();

const perfis = new Set((await db.collection('usuarios').select().get()).docs.map(d => d.id));
const ligadas = new Set((await db.collection('logins').get()).docs.map(d => d.get('uid')).filter(Boolean));
const limite = Date.now() - dias * 864e5;
const velha = t => !t || new Date(t).getTime() <= limite;

let total = 0; const sobras = []; let token;
do {
  const r = await auth.listUsers(1000, token);
  for (const u of r.users) {
    total++;
    if (perfis.has(u.uid) || ligadas.has(u.uid)) continue;
    if (!velha(u.metadata.creationTime) || !velha(u.metadata.lastSignInTime)) continue;
    sobras.push(u);
  }
  token = r.pageToken;
} while (token);

let apagadas = 0;
if (apagar) for (let i = 0; i < sobras.length; i += 1000) { const r = await auth.deleteUsers(sobras.slice(i, i + 1000).map(u => u.uid)); apagadas += r.successCount; r.errors.forEach(e => console.log(`::warning::Não apagou ${e.index}: ${e.error.message}`)); }

resumo([
  `### Contas sem usuário (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
  `${total} conta(s) de login · ${perfis.size} usuário(s) no sistema · **${sobras.length} sobra(s)** com mais de ${dias} dias sem uso.`,
  apagar ? `**${apagadas} apagada(s).**` : 'Nada foi apagado (só listagem). Para apagar, rode de novo com "apagar" marcado.',
  ...(sobras.length ? ['', '| Conta interna | Criada em | Último acesso |', '|---|---|---|', ...sobras.slice(0, 100).map(u => `| ${(u.email || u.uid).replace(/@.*/, '@…')} | ${u.metadata.creationTime || '—'} | ${u.metadata.lastSignInTime || '—'} |`)] : [])
].join('\n'));
