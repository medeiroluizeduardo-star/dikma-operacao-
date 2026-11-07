// Monta public/vendor/firebase.js a partir do pacote oficial do Firebase (um arquivo só, sem build no site).
// Uso (num computador com Node 22):
//   node ferramentas/firebase/gerar.mjs            -> usa a versão anotada em VERSAO abaixo
//   node ferramentas/firebase/gerar.mjs 13.3.0     -> outra versão (lembre de atualizar VERSAO e o README)
// Baixa o Firebase e o esbuild numa pasta temporária (nada entra no repositório além do arquivo final).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSAO = '13.2.0';
const ESBUILD = '0.28.2';
const versao = process.argv[2] || VERSAO;
const aqui = dirname(fileURLToPath(import.meta.url));
const saida = join(aqui, '..', '..', 'public', 'vendor', 'firebase.js');
const tmp = mkdtempSync(join(tmpdir(), 'dikma-firebase-'));
try {
  writeFileSync(join(tmp, 'package.json'), '{"private":true,"type":"module"}');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['install', '--no-audit', '--no-fund', `firebase@${versao}`, `esbuild@${ESBUILD}`], { cwd: tmp, stdio: 'inherit', shell: process.platform === 'win32' });
  copyFileSync(join(aqui, 'entrada.js'), join(tmp, 'entrada.js'));
  const { build } = await import(join(tmp, 'node_modules', 'esbuild', 'lib', 'main.js'));
  await build({
    entryPoints: [join(tmp, 'entrada.js')], outfile: saida, bundle: true, format: 'esm', platform: 'browser',
    target: 'es2020', minify: true, legalComments: 'eof', logLevel: 'info'
  });
  console.log(`Firebase ${versao} -> public/vendor/firebase.js (${Math.round(statSync(saida).size / 1024)} KB)`);
  console.log('Agora: subir a versão V em public/sw.js e testar no ?demo e na prévia.');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
