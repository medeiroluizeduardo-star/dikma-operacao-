// Gera os dados de importação do Administrativo a partir das planilhas originais (que NÃO entram no repositório):
//   node ferramentas/gerar-adm.mjs <FREQUENCIA_PATIO.xlsx> <FREQUENCIA_BATERIA.xlsx> <FERIAS_GERAL.xlsx>
// Grava dados-importacao/seed-freq-patio.json, seed-freq-bateria.json e seed-ferias.json (só no seu computador:
// a pasta não vai para o repositório; envie ao banco com integracao/admin/enviar-dados.mjs)
// e mostra um resumo (pessoas, competências, códigos desconhecidos).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from '../public/vendor/xlsx.js';
import { lerFrequencia, lerFerias, abasDoXLSX } from '../public/contas/planilhas-adm.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [fp, fb, ff] = process.argv.slice(2);
if (!ff) { console.error('Uso: node ferramentas/gerar-adm.mjs <frequencia-patio.xlsx> <frequencia-bateria.xlsx> <ferias.xlsx>'); process.exit(1); }
const ler = f => abasDoXLSX(XLSX, XLSX.read(fs.readFileSync(f), { type: 'buffer', cellDates: true }));

// Formato compacto: os códigos de cada pessoa viram um texto separado por vírgula, na ordem dos dias da competência.
export function compactar(freq) {
  return {
    conjunto: freq.conjunto, avisos: freq.avisos,
    competencias: freq.competencias.map(c => {
      const datas = []; for (let d = c.ini; d <= c.fim; d = new Date(new Date(d + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10)) datas.push(d);
      return { ...c, grupos: c.grupos.map(g => ({ ...g, pessoas: g.pessoas.map(p => { const { dias, ...x } = p; return { ...x, d: datas.map(dt => dias[dt] || '').join(',') }; }) })) };
    })
  };
}

const saida = path.join(raiz, 'dados-importacao');
for (const [arq, conj] of [[fp, 'patio'], [fb, 'bateria']]) {
  const f = lerFrequencia(ler(arq), conj);
  const c = compactar(f);
  const json = JSON.stringify(c);
  fs.writeFileSync(path.join(saida, `seed-freq-${conj}.json`), json);
  const pessoas = new Set(); const notas = new Set(); let dias = 0;
  for (const cp of f.competencias) for (const g of cp.grupos) for (const p of g.pessoas) { pessoas.add(p.chave); dias += Object.keys(p.dias).length; p.notas.filter(n => /^código/.test(n)).forEach(n => notas.add(n)); }
  console.log(`Frequência ${conj}: ${f.competencias.map(x => x.competencia).join(', ')} · ${pessoas.size} pessoas · ${dias} dias lançados · ${(json.length / 1024).toFixed(0)} KB${notas.size ? ' · códigos desconhecidos: ' + [...notas].join(', ') : ''}`);
  f.avisos.forEach(a => console.log('  aviso: ' + a));
  const ult = f.competencias[f.competencias.length - 1];
  console.log('  grupos da última competência: ' + ult.grupos.map(g => `${g.nome} (${g.pessoas.length})`).join(' · '));
}
const fe = lerFerias(ler(ff));
const json = JSON.stringify(fe);
fs.writeFileSync(path.join(saida, 'seed-ferias.json'), json);
const setores = {}; fe.ferias.forEach(r => { setores[r.setor] = (setores[r.setor] || 0) + 1; });
console.log(`Férias: ${fe.ferias.length} registros (${fe.ferias.filter(r => r.inicio).length} com data marcada) · ${(json.length / 1024).toFixed(0)} KB · por setor: ${Object.entries(setores).map(([k, v]) => `${k} ${v}`).join(', ')}`);
