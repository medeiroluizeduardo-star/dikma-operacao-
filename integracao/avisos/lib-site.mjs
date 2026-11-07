// Copia as contas do site (public/*.js) para lib/ como .mjs, para o Node usar as mesmas contas das telas.
// Segue os imports sozinha: se um arquivo copiado passar a importar outro, ele vem junto (não precisa lembrar de
// acrescentar numa lista fixa).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(aqui, '..', '..', 'public', 'contas');

export function copiarDoSite(nomes, destino = path.join(aqui, 'lib')) {
  fs.mkdirSync(destino, { recursive: true });
  const feitos = new Set(); const fila = [...nomes];
  while (fila.length) {
    const f = fila.shift(); if (feitos.has(f)) continue; feitos.add(f);
    const bruto = fs.readFileSync(path.join(site, f + '.js'), 'utf8');
    for (const m of bruto.matchAll(/from '\.\/([\w-]+)\.js'/g)) if (!feitos.has(m[1])) fila.push(m[1]);
    fs.writeFileSync(path.join(destino, f + '.mjs'), bruto.replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'"));
  }
  return [...feitos];
}
