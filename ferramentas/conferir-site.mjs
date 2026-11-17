// Confere, antes de publicar, que a pasta do site (public/) não tem dados pessoais:
// nenhum arquivo de planilha e nenhum nome real de colaborador.
// Os nomes não ficam no repositório: ferramentas/nomes-protegidos.json guarda só um resumo (SHA-256) de cada
// nome completo. Se a pasta dados-importacao/ existir no seu computador, os nomes dela também entram.
// Para atualizar a lista de resumos (com as planilhas na pasta dados-importacao/, só no seu computador):
//   node ferramentas/conferir-site.mjs --atualizar-nomes
// Sai com erro se achar alguma coisa. Roda nos testes automáticos do GitHub.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(raiz, 'public');
const lista = path.join(raiz, 'ferramentas', 'nomes-protegidos.json');
const palavras = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
const resumir = k => crypto.createHash('sha256').update(k).digest('hex').slice(0, 20);

// nomes reais completos (pelo menos 3 palavras, para não confundir com palavras comuns)
const daPasta = new Set();
const dir = path.join(raiz, 'dados-importacao');
const add = n => { const w = palavras(n); if (w.length >= 3) daPasta.add(w.join(' ')); };
if (fs.existsSync(dir)) {
  const ler = f => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
  for (const f of ['seed.json', 'seed-bateria.json']) { const s = ler(f); if (s) s.colabs.forEach(c => add(c.nome)); }
  const e = ler('seed-equip.json'); if (e) e.operadores.forEach(o => add(o.nome));
  const g = ler('seed-gestao.json'); if (g) g.colabs.forEach(c => add(c.nome));
  const r = ler('seed-efetivo.json'); if (r) r.linhas.forEach(l => add(l[1]));
  for (const f of ['seed-freq-patio.json', 'seed-freq-bateria.json']) { const x = ler(f); if (x) x.competencias.forEach(c => c.grupos.forEach(g => g.pessoas.forEach(p => add(p.nome)))); }
  const fe = ler('seed-ferias.json'); if (fe) fe.ferias.forEach(x => add(x.nome));
}

let salvo = { max: 0, resumos: [] };
if (fs.existsSync(lista)) salvo = JSON.parse(fs.readFileSync(lista, 'utf8'));
const resumos = new Set(salvo.resumos);
let max = salvo.max || 0;
for (const k of daPasta) { resumos.add(resumir(k)); max = Math.max(max, k.split(' ').length); }

if (process.argv.includes('--atualizar-nomes')) {
  if (!daPasta.size) { console.error('::error::Coloque as planilhas (seed*.json) na pasta dados-importacao/ antes de atualizar.'); process.exit(1); }
  const novo = {
    sobre: 'Resumo (SHA-256, 20 primeiros caracteres) de cada nome real completo das planilhas, em maiúsculas e sem acentos. Usado por conferir-site.mjs para impedir nomes reais no site sem guardar os nomes no repositório.',
    max, resumos: [...resumos].sort()
  };
  fs.writeFileSync(lista, JSON.stringify(novo, null, 1) + '\n');
  console.log(`Lista atualizada: ${novo.resumos.length} nomes.`);
  process.exit(0);
}
if (!resumos.size) { console.error('::error::Lista de nomes protegidos vazia (ferramentas/nomes-protegidos.json).'); process.exit(1); }

// procura, em cada arquivo, toda sequência de 3 a "max" palavras seguidas cujo resumo esteja na lista
function nomesNoTexto(txt) {
  const w = palavras(txt), achados = new Set();
  for (let i = 0; i < w.length; i++) {
    let k = w[i];
    for (let n = 2; n <= max && i + n - 1 < w.length; n++) {
      k += ' ' + w[i + n - 1];
      if (n >= 3 && resumos.has(resumir(k))) achados.add(k);
    }
  }
  return achados.size;
}

const problemas = [];
const arquivos = [];
(function andar(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) andar(p); else arquivos.push(p); } })(pub);
for (const p of arquivos) {
  const rel = path.relative(pub, p);
  if (/(^|\/)seed[^/]*\.json$|\.(xlsx|xlsm|xls|csv)$/i.test(rel)) { problemas.push(`${rel}: arquivo de dados não pode ficar no site (as planilhas não vão para o repositório nem para o site)`); continue; }
  if (!/\.(js|json|html|css|webmanifest|txt|md)$/i.test(rel) || rel.startsWith('vendor/')) continue;
  const n = nomesNoTexto(fs.readFileSync(p, 'utf8'));
  if (n) problemas.push(`${rel}: tem ${n} nome(s) real(is) de colaborador`);
}
// A lista de arquivos guardados pelo service worker (SHELL em public/sw.js): um arquivo que não existe faz a instalação
// da versão nova falhar inteira, e os aparelhos ficam presos na versão antiga (aconteceu de 10/11 a 17/11/2026).
{
  const m = fs.readFileSync(path.join(pub, 'sw.js'), 'utf8').match(/const SHELL = (\[[^\]]*\])/);
  const shell = m ? JSON.parse(m[1].replace(/'/g, '"')) : null;
  if (!shell) problemas.push('sw.js: não achei a lista SHELL');
  else for (const f of shell) if (!fs.existsSync(path.join(pub, f))) problemas.push(`sw.js: "${f}" está no SHELL mas não existe (a versão nova não instalaria nos aparelhos)`);
}
if (problemas.length) {
  for (const x of problemas) console.error('::error::' + x);
  console.error('O site não pode ser publicado assim (dados pessoais na pasta public/ ou arquivo faltando no SHELL).');
  process.exit(1);
}
console.log(`OK: ${arquivos.length} arquivos do site conferidos contra ${resumos.size} nomes; nenhum dado pessoal.`);
