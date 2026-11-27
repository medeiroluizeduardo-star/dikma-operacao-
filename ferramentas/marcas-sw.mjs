// Gera public/sw-marcas.json: uma marca (resumo do conteúdo) de cada arquivo guardado pelo service worker (SHELL do sw.js).
// Roda na publicação e na prévia, logo antes de enviar o site. O celular compara com as marcas da versão que já tem e
// baixa só os arquivos que mudaram (ver instalar() em public/sw.js). O arquivo gerado não vai para o Git.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const sw = readFileSync(join(PUB, 'sw.js'), 'utf8');
const m = sw.match(/const SHELL = (\[[^\]]*\]);/);
if (!m) { console.error('Não achei a lista SHELL em public/sw.js'); process.exit(1); }
const shell = JSON.parse(m[1].replace(/'/g, '"'));
const marcas = {};
for (const f of shell) marcas[f] = createHash('sha256').update(readFileSync(join(PUB, f))).digest('hex').slice(0, 16);
writeFileSync(join(PUB, 'sw-marcas.json'), JSON.stringify(marcas));
console.log(`sw-marcas.json: ${shell.length} arquivos`);
