// Dikma Gestão — ponte com o Senior.
// Roda no GitHub Actions (workflow "Integração Senior"). Busca os colaboradores no Senior,
// padroniza os campos e grava em integracao/senior no Firestore. Nada é aplicado sozinho:
// o administrador confere e aplica em Efetivo › Importar dados › Integração Senior.
//
// Configuração (GitHub › Settings › Secrets and variables › Actions):
//   SENIOR_MODO        seniorx | g5 | arquivo      (vazio = integração desligada; o workflow só avisa e termina)
//   SENIOR_USUARIO / SENIOR_SENHA                  usuário de integração (só leitura)
//   SENIOR_CHAVE / SENIOR_SEGREDO                  (Senior X, opcional) chave de aplicação no lugar de usuário e senha
//   SENIOR_TENANT                                  (Senior X) nome do tenant da Dikma
//   SENIOR_URL                                     (Senior X) base da API; padrão abaixo
//   SENIOR_G5_URL / SENIOR_G5_PORTA / SENIOR_G5_PARAMETROS   (G5) endereço do web service, porta e parâmetros (JSON)
//   SENIOR_ARQUIVO                                 (arquivo) pasta ou arquivo .xlsx/.csv dentro do repositório
//   SENIOR_MAPA                                    (opcional) JSON para trocar o mapa de campos (veja mapa-padrao.json)
//   SENIOR_SO_TESTAR=1                             só mostra o que leu, sem gravar no Firestore
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar } from './normalizar.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const env = k => (process.env[k] || '').trim();
const modo = env('SENIOR_MODO').toLowerCase();
const soTestar = env('SENIOR_SO_TESTAR') === '1' || process.argv.includes('--testar');

if (!modo) {
  console.log('::notice::Integração Senior ainda não configurada (falta o segredo SENIOR_MODO). Nada a fazer.');
  process.exit(0);
}
const ADAPT = { seniorx: './adaptadores/seniorx.mjs', g5: './adaptadores/g5.mjs', arquivo: './adaptadores/arquivo.mjs' };
if (!ADAPT[modo]) { console.error(`::error::SENIOR_MODO "${modo}" inválido. Use seniorx, g5 ou arquivo.`); process.exit(1); }

const padrao = JSON.parse(fs.readFileSync(path.join(aqui, 'mapa-padrao.json'), 'utf8'));
let mapa = padrao[modo];
if (env('SENIOR_MAPA')) {
  try { mapa = { ...mapa, ...JSON.parse(env('SENIOR_MAPA')) }; } catch (e) { console.error('::error::SENIOR_MAPA não é um JSON válido.'); process.exit(1); }
}

const execucao = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';

async function firestore() {
  const sa = env('FIREBASE_SERVICE_ACCOUNT');
  if (!sa) throw new Error('Falta o segredo FIREBASE_SERVICE_ACCOUNT.');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(sa)) });
  return { db: getFirestore(), FieldValue };
}

const inicio = Date.now();
let fb = null;
try {
  if (!soTestar) fb = await firestore();
  const { buscar } = await import(ADAPT[modo]);
  console.log(`Buscando colaboradores no Senior (modo ${modo})…`);
  const brutos = await buscar({ env, aqui });
  console.log(`Recebidos ${brutos.length} registro(s) do Senior.`);
  const { registros, avisos } = normalizar(brutos, mapa);
  if (!registros.length) throw new Error(`O Senior respondeu, mas nenhum registro tinha matrícula e nome. Confira o mapa de campos (SENIOR_MAPA). Campos recebidos no primeiro registro: ${Object.keys(brutos[0] || {}).slice(0, 40).join(', ') || '(nenhum)'}`);
  avisos.slice(0, 20).forEach(a => console.log('::warning::' + a));
  console.log(`Prontos ${registros.length} colaborador(es). Exemplo:`, JSON.stringify(registros.slice(0, 2)));
  if (soTestar) { console.log('::notice::Só teste: nada foi gravado.'); process.exit(0); }
  const { db, FieldValue } = fb;
  await db.doc('integracao/senior').set({
    estado: 'ok', modo, erro: null, total: registros.length, avisos: avisos.slice(0, 50),
    registros, recebidoEm: FieldValue.serverTimestamp(), duracaoSeg: Math.round((Date.now() - inicio) / 1000),
    execucao, aplicadoEm: null, aplicadoPor: null
  }, { merge: true });
  console.log(`::notice::${registros.length} colaborador(es) do Senior prontos para conferir em Efetivo › Importar dados.`);
} catch (err) {
  const msg = String((err && err.message) || err).slice(0, 600);
  console.error('::error::' + msg);
  if (fb) await fb.db.doc('integracao/senior').set({ estado: 'erro', modo, erro: msg, tentativaEm: fb.FieldValue.serverTimestamp(), execucao }, { merge: true }).catch(() => {});
  process.exit(1);
}
