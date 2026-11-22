// Ensaio de restauração: prova que a cópia de segurança volta inteira. Roda todo mês pelo GitHub
// (Actions › Ensaio de restauração da cópia), SEMPRE no emulador do Firebase (banco de mentira dentro da CI).
// Nunca toca o banco real: sem o emulador, ou com a chave de serviço presente, recusa e para.
//   ENSAIO_PASTA          pasta com o pacote baixado da cópia (manifesto.json + <coleção>.NNN.json.gz)
//   ENSAIO_IDADE_MAX_DIAS a cópia não pode ser mais velha que isto (padrão 3; 0 = não confere)
// Passos: 1) confere o pacote contra o manifesto (documentos e partes de cada coleção);
//         2) zera o emulador e restaura tudo com a mesma rotina de verdade (restaurar.mjs);
//         3) lê de volta do emulador e compara documento por documento com a cópia.
// Qualquer diferença faz a rotina falhar, e o GitHub manda e-mail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conectar, codificar, lerGz, resumo, arquivoDe } from './comum.mjs';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('::error::O ensaio só roda no emulador do Firebase (sem a chave do banco real).');
  process.exit(1);
}
const pasta = path.resolve(process.env.ENSAIO_PASTA || 'copia');
const idadeMax = Number(process.env.ENSAIO_IDADE_MAX_DIAS ?? 3);
// Coleções que toda cópia precisa ter (sem elas, ninguém entra no sistema).
const ESSENCIAIS = ['usuarios', 'config', 'gestao'];

const problemas = [];
const manArq = path.join(pasta, 'manifesto.json');
if (!fs.existsSync(manArq)) { console.error('::error::Pacote da cópia sem manifesto.json.'); process.exit(1); }
const man = JSON.parse(fs.readFileSync(manArq, 'utf8'));
const colecoes = Object.keys(man.colecoes || {});
const quando = new Date(man.inicio);
const dias = (Date.now() - quando.getTime()) / 864e5;
if (idadeMax > 0 && !(dias <= idadeMax)) problemas.push(`A cópia mais recente é de ${dias.toFixed(1).replace('.', ',')} dias atrás (limite ${idadeMax}): a cópia diária pode ter parado.`);
for (const c of ESSENCIAIS) if (!(man.colecoes?.[c]?.documentos > 0)) problemas.push(`Coleção essencial ${c} vazia ou fora da cópia.`);

// 1) pacote x manifesto
const copia = {};
for (const c of colecoes) {
  const arqs = fs.readdirSync(pasta).filter(f => f.startsWith(arquivoDe(c) + '.') && /^\.\d{3}\.json\.gz$/.test(f.slice(arquivoDe(c).length))).sort();
  copia[c] = {};
  for (const f of arqs) {
    try { Object.assign(copia[c], lerGz(path.join(pasta, f))); } catch (e) { problemas.push(`${c}: arquivo ${f} estragado (${e.message}).`); }
  }
  const esp = man.colecoes[c];
  const n = Object.keys(copia[c]).length;
  if (n !== esp.documentos) problemas.push(`${c}: o manifesto diz ${esp.documentos} documento(s), o pacote tem ${n}.`);
  if (arqs.length !== esp.partes) problemas.push(`${c}: o manifesto diz ${esp.partes} parte(s), o pacote tem ${arqs.length}.`);
}

// 2) zera o emulador e restaura com a rotina de verdade
const { db, F, projeto } = await conectar();
const r0 = await fetch(`http://${host}/emulator/v1/projects/${projeto}/databases/(default)/documents`, { method: 'DELETE' });
if (!r0.ok) { console.error('::error::Não deu para limpar o emulador.'); process.exit(1); }
const restaurar = path.join(path.dirname(fileURLToPath(import.meta.url)), 'restaurar.mjs');
const r = spawnSync(process.execPath, [restaurar], {
  cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'ensaio-')), encoding: 'utf8',
  env: { ...process.env, GITHUB_STEP_SUMMARY: '', RESTAURAR_PASTA: pasta, RESTAURAR_COLECOES: 'todas', RESTAURAR_APLICAR: '1', RESTAURAR_APAGAR: '' }
});
if (r.status !== 0) {
  console.error(r.stdout + '\n' + r.stderr);
  console.error('::error::A restauração falhou no emulador (detalhes acima).');
  process.exit(1);
}

// 3) lê de volta e compara documento por documento
const estavel = v => (v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}') : JSON.stringify(v));
const linhas = [];
let total = 0;
for (const c of colecoes) {
  const lidos = {};
  for (const d of (await db.collection(c).get()).docs) lidos[d.id] = codificar(d.data(), F);
  const ids = Object.keys(copia[c]);
  const faltam = ids.filter(id => !(id in lidos));
  const diferentes = ids.filter(id => id in lidos && estavel(lidos[id]) !== estavel(copia[c][id]));
  const sobram = Object.keys(lidos).filter(id => !(id in copia[c]));
  if (faltam.length) problemas.push(`${c}: ${faltam.length} documento(s) não voltaram (ex.: ${faltam.slice(0, 3).join(', ')}).`);
  if (diferentes.length) problemas.push(`${c}: ${diferentes.length} documento(s) voltaram diferentes (ex.: ${diferentes.slice(0, 3).join(', ')}).`);
  if (sobram.length) problemas.push(`${c}: ${sobram.length} documento(s) a mais depois da restauração.`);
  total += ids.length;
  const ok = !faltam.length && !diferentes.length && !sobram.length && ids.length === man.colecoes[c].documentos;
  linhas.push([c, ids.length, Object.keys(lidos).length, ok]);
}

// No resumo, as subcoleções somam na coleção de cima (painel = tudo do Meu painel).
const porRaiz = {};
for (const [c, nCopia, nVoltou, ok] of linhas) {
  const k = c.split('/')[0];
  const x = (porRaiz[k] ||= { copia: 0, voltou: 0, ok: true });
  x.copia += nCopia; x.voltou += nVoltou; x.ok &&= ok;
}
const deu = !problemas.length;
for (const p of problemas) console.log(`::error title=Ensaio de restauração::${p}`);
resumo([
  deu ? '### Ensaio de restauração: a cópia voltou inteira ✅' : '### Ensaio de restauração: PROBLEMA na cópia ❌',
  `Cópia ${man.tipo} de ${quando.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${total.toLocaleString('pt-BR')} documentos restaurados no emulador (o banco real não foi tocado)`,
  '',
  '| Coleção | Na cópia | Voltaram | Conferido |', '|---|---|---|---|',
  ...Object.entries(porRaiz).map(([c, x]) => `| ${c} | ${x.copia.toLocaleString('pt-BR')} | ${x.voltou.toLocaleString('pt-BR')} | ${x.ok ? 'ok' : 'DIFERENTE'} |`),
  '',
  deu ? 'Todos os documentos voltaram iguais à cópia.' : problemas.map(p => '- ' + p).join('\n')
].join('\n'));
if (!deu) process.exit(1);
