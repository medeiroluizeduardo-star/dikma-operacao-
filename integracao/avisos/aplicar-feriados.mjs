// Aplicar feriados nas atividades (workflow manual "Aplicar feriados"; a rotina de hora em hora faz o mesmo sozinha).
// Em feriado sem operação, a atividade programada e não apontada sai da conta (não fica atrasada nem pendente);
// feriado removido ou "com operação", ela volta a programada. Vale para todos os meses gerados do Pátio e da Bateria.
//   --modo simular (padrão)  só mostra os feriados encontrados e, por feriado/conjunto/área, quantas atividades mudam
//   --modo gravar            grava o que muda (lotes de até 400), só as semanas que precisam
//   --arquivo x.json         lê de um arquivo em vez do banco (para testar): { "config": { "escalas": …, "sistema": … },
//                            "eq": { "config": … }, "semanas": { "ÁREA|AAAA-MM-DD": … }, "b_config": …, "b_semanas": … }
// Também aceita FERIADOS_MODO=simular|gravar.
import fs from 'node:fs';
import path from 'node:path';
import { copiarDoSite } from './lib-site.mjs';

process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
copiarDoSite(['cal', 'feriados']);
const { planejarFeriados, gravarFeriados, fonteBanco, fonteArquivo, relatorio } = await import('./feriados.mjs');

const args = process.argv.slice(2);
const opc = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const modo = opc('--modo') || process.env.FERIADOS_MODO || 'simular';
const arquivo = opc('--arquivo');
if (!['simular', 'gravar'].includes(modo)) { console.error('::error::--modo deve ser simular ou gravar.'); process.exit(1); }
if (modo === 'gravar' && arquivo) { console.error('::error::gravar só funciona com o banco, não com --arquivo.'); process.exit(1); }

let fonte, db = null, F = null;
if (arquivo) fonte = fonteArquivo(JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf8')));
else {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  const { initializeApp, cert } = await import('firebase-admin/app');
  F = await import('firebase-admin/firestore');
  if (!sa && process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-dikma' });
  else if (!sa) { console.error('::error::Falta o segredo FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }
  else initializeApp({ credential: cert(JSON.parse(sa)) });
  db = F.getFirestore(); fonte = fonteBanco(db);
}

const r = await planejarFeriados(fonte);
const linhas = [`Aplicar feriados · modo ${modo}${arquivo ? ` · arquivo ${path.basename(arquivo)}` : ''}`, ...relatorio(r), `Leituras: ${r.leituras}.`];
let fim = '';
if (modo === 'gravar' && r.total.semanas) {
  const n = await gravarFeriados(db, F.FieldPath, F.FieldValue, r.planos);
  fim = `Gravado: ${n} semana(s) · ${r.total.feriado} atividade(s) fora da conta · ${r.total.volta} de volta.`;
} else fim = modo === 'simular' ? 'Simulação: nada foi gravado.' : 'Nada a gravar.';
linhas.push(fim);
console.log(linhas.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Aplicar feriados (${modo})\n\n\`\`\`\n${linhas.join('\n')}\n\`\`\`\n`);
console.log(`::notice::${fim}`);
