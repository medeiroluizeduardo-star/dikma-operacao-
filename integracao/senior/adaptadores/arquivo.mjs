// Modo de teste e alternativa simples: lê uma planilha exportada do Senior que foi colocada
// no repositório (pasta integracao/senior/entrada). Serve para testar a ponte inteira hoje,
// antes de a TI liberar a API.
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

export async function buscar({ env, aqui }) {
  let alvo = env('SENIOR_ARQUIVO') || path.join(aqui, 'entrada');
  if (!path.isAbsolute(alvo)) alvo = path.resolve(aqui, '..', '..', alvo.replace(/^\.?\//, ''));
  if (!fs.existsSync(alvo)) alvo = path.join(aqui, 'entrada');
  if (fs.statSync(alvo).isDirectory()) {
    const arqs = fs.readdirSync(alvo).filter(f => /\.(xlsx|xlsm|xls|csv)$/i.test(f)).map(f => path.join(alvo, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!arqs.length) throw new Error(`Nenhuma planilha (.xlsx ou .csv) em ${path.relative(process.cwd(), alvo) || alvo}.`);
    alvo = arqs[0];
  }
  console.log('Lendo ' + path.basename(alvo));
  const wb = XLSX.read(fs.readFileSync(alvo), { cellDates: true });
  // Usa a aba que tiver uma linha de cabeçalho com NOME e MATRÍCULA (ou CHAPA/NUMCAD).
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(30, rows.length); i++) {
      const cab = (rows[i] || []).map(norm);
      if (cab.some(c => ['NOME', 'COLABORADOR', 'NOMFUN'].includes(c)) && cab.some(c => ['MATRICULA', 'CHAPA', 'NUMCAD', 'CADASTRO'].includes(c))) {
        const nomes = rows[i].map(c => (c == null ? '' : String(c).trim()));
        return rows.slice(i + 1).filter(r => r && r.some(v => v != null && v !== '')).map(r => Object.fromEntries(nomes.map((h, j) => [h, r[j]]).filter(([h]) => h)));
      }
    }
  }
  throw new Error('Não achei a tabela de colaboradores (cabeçalho com NOME e MATRÍCULA) na planilha.');
}
