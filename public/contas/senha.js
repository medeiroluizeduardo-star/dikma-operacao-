// Senha das contas: regra da senha nova e senha provisória sorteada. Sem tela e sem banco (fica fora das telas da
// Administração para que a troca de senha de qualquer pessoa não precise baixar aquelas telas).
import { semAcento } from './planilhas-adm.js';

// Senha: no mínimo 8 caracteres, sem sequência óbvia e sem o próprio usuário ou nome. Devolve o problema ou ''.
const SENHAS_OBVIAS = ['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'senha123', 'senha1234', 'password', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234', 'dikma123', 'dikma1234', 'coqueria', 'arcelor1', 'mudar123', 'trocar123'];
export function problemaSenha(n, u) {
  const s = String(n || '');
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  const b = semAcento(s).toLowerCase();
  if (/^(.)\1+$/.test(b) || SENHAS_OBVIAS.includes(b) || '0123456789012345678901234567890'.includes(b) || 'abcdefghijklmnopqrstuvwxyz'.includes(b)) return 'Essa senha é fácil de adivinhar. Misture letras e números.';
  const pessoais = [u && u.login, ...String((u && u.nome) || '').split(/\s+/)].map(x => semAcento(String(x || '')).toLowerCase()).filter(x => x.length >= 4);
  if (pessoais.some(x => b.includes(x))) return 'A senha não pode conter o seu usuário ou o seu nome.';
  return '';
}
export function senhaAleatoria() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(10)); for (const n of r) s += c[n % c.length]; return s; }
