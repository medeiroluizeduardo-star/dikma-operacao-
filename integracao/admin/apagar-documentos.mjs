// Apaga de vez a coleção antiga "documentos" (a tela Administração › Documentos e OMs saiu no PR #156, em 17/11/2026;
// os registros ficaram parados no banco e só ocupavam espaço e leituras do backup). Uso único, só manual.
// Roda pelo GitHub (Actions › Apagar documentos antigos). Antes de apagar:
//   1) confere que a Cópia de segurança (backup.yml) deu certo nas últimas 26 horas (ela tem a coleção inteira);
//   2) guarda uma cópia só desta coleção (arquivo da execução, 90 dias), no mesmo formato da cópia de segurança.
//   DOCS_MODO=simular (padrão) só conta; DOCS_MODO=apagar apaga.
//   GH_TOKEN, GITHUB_REPOSITORY  para olhar a cópia de segurança · BACKUP_PASTA  onde guardar a cópia desta coleção
import fs from 'node:fs';
import path from 'node:path';
import { conectar, resumo, codificar } from './comum.mjs';

const COL = 'documentos';
const modo = process.env.DOCS_MODO === 'apagar' ? 'apagar' : 'simular';
const md = [`## Apagar a coleção antiga "${COL}" (${modo})`];

// 1) cópia de segurança recente (no emulador dos testes não há GitHub: pula)
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  const gh = async c => {
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${c}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${c}`);
    return r.json();
  };
  const { workflow_runs: runs = [] } = await gh('actions/workflows/backup.yml/runs?status=success&per_page=5');
  let boa = null;
  for (const e of runs) {
    if (Date.now() - new Date(e.created_at) > 26 * 3600e3) break;
    const { artifacts = [] } = await gh(`actions/runs/${e.id}/artifacts`);
    if (artifacts.some(a => a.name.startsWith('copia-') && !a.expired)) { boa = e; break; }
  }
  if (!boa) {
    resumo(md.concat('', '**Parado:** não há Cópia de segurança boa nas últimas 26 horas. Rode antes Actions › Cópia de segurança.').join('\n'));
    console.error('::error::Sem cópia de segurança recente.'); process.exit(1);
  }
  md.push(`Cópia de segurança conferida: execução ${boa.id} de ${new Date(boa.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
}

const { db, F } = await conectar();
const ref = db.collection(COL);
const qs = await ref.get();
const subs = (await Promise.all(qs.docs.map(d => d.ref.listCollections()))).flat();
md.push(`**${qs.size} registro(s)** na coleção${subs.length ? ` e ${subs.length} subcoleção(ões)` : ''}.`);

// 2) cópia só desta coleção, antes de apagar
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-documentos'); fs.mkdirSync(pasta, { recursive: true });
fs.writeFileSync(path.join(pasta, `${COL}.json`), JSON.stringify(Object.fromEntries(qs.docs.map(d => [d.id, codificar(d.data(), F)]))));

if (modo === 'apagar' && (qs.size || subs.length)) {
  await db.recursiveDelete(ref);
  const resto = (await ref.limit(1).get()).size;
  if (resto) { resumo(md.concat('**Erro:** sobrou registro na coleção.').join('\n')); process.exit(1); }
  md.push(`**Apagados.** A cópia desta coleção ficou no arquivo desta execução (90 dias) e na Cópia de segurança.`);
} else md.push(modo === 'apagar' ? 'Nada para apagar.' : 'Só simulação: nada foi apagado. Para apagar, rode de novo com o modo "apagar".');
resumo(md.join('\n'));
