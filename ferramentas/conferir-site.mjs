// Confere, antes de publicar, que a pasta do site (public/) não tem dados pessoais:
// nenhum arquivo de planilha e nenhum nome real de colaborador (tirado de dados-importacao/).
// Sai com erro se achar alguma coisa. Roda nos testes automáticos do GitHub.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(raiz, 'public');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// nomes reais completos (pelo menos 3 palavras, para não confundir com palavras comuns)
const nomes = new Set();
const dir = path.join(raiz, 'dados-importacao');
const add = n => { const k = norm(n); if (k.split(' ').length >= 3) nomes.add(k); };
if (fs.existsSync(dir)) {
  const ler = f => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
  for (const f of ['seed.json', 'seed-bateria.json']) { const s = ler(f); if (s) s.colabs.forEach(c => add(c.nome)); }
  const e = ler('seed-equip.json'); if (e) e.operadores.forEach(o => add(o.nome));
  const g = ler('seed-gestao.json'); if (g) g.colabs.forEach(c => add(c.nome));
  const r = ler('seed-efetivo.json'); if (r) r.linhas.forEach(l => add(l[1]));
  for (const f of ['seed-freq-patio.json', 'seed-freq-bateria.json']) { const x = ler(f); if (x) x.competencias.forEach(c => c.grupos.forEach(g => g.pessoas.forEach(p => add(p.nome)))); }
  const fe = ler('seed-ferias.json'); if (fe) fe.ferias.forEach(x => add(x.nome));
}

const problemas = [];
const arquivos = [];
(function andar(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) andar(p); else arquivos.push(p); } })(pub);
for (const p of arquivos) {
  const rel = path.relative(pub, p);
  if (/(^|\/)seed[^/]*\.json$|\.(xlsx|xlsm|xls|csv)$/i.test(rel)) { problemas.push(`${rel}: arquivo de dados não pode ficar no site (mova para dados-importacao/)`); continue; }
  if (!/\.(js|json|html|css|webmanifest|txt|md)$/i.test(rel) || rel.startsWith('vendor/')) continue;
  const txt = norm(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const k of nomes) if (txt.includes(k)) n++;
  if (n) problemas.push(`${rel}: tem ${n} nome(s) real(is) de colaborador`);
}
if (problemas.length) {
  for (const x of problemas) console.error('::error::' + x);
  console.error('O site não pode ser publicado com dados pessoais na pasta public/.');
  process.exit(1);
}
console.log(`OK: ${arquivos.length} arquivos do site conferidos contra ${nomes.size} nomes; nenhum dado pessoal.`);
