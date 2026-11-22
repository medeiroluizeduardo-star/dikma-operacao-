// Mostra cada aviso do ESLint como anotação amarela no GitHub (::warning) e um resumo no fim.
import path from 'node:path';

const limpa = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

export default function (resultados) {
  const linhas = [];
  const porRegra = {};
  let total = 0;
  for (const r of resultados) {
    const arq = path.relative(process.cwd(), r.filePath);
    for (const m of r.messages) {
      total++;
      const regra = m.ruleId || 'geral';
      porRegra[regra] = (porRegra[regra] || 0) + 1;
      linhas.push(`::warning file=${arq},line=${m.line || 1},col=${m.column || 1},title=ESLint (${regra})::${limpa(m.message)}`);
    }
  }
  const resumo = Object.entries(porRegra).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(', ');
  const arquivos = resultados.filter(r => r.messages.length).length;
  linhas.push(total ? `ESLint: ${total} aviso(s) em ${arquivos} arquivo(s). ${resumo}` : 'ESLint: nenhum aviso.');
  return linhas.join('\n');
}
