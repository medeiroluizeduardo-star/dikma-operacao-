// Dikma Gestão — baixar listas como planilha do Excel (.xlsx). A biblioteca só é carregada na hora de exportar.
// abas: [{ nome, linhas: [[cabeçalho...], [valores...]] }]
export async function baixarExcel(arquivo, abas) {
  const XLSX = await import('./vendor/xlsx.js');
  const wb = XLSX.utils.book_new();
  for (const a of abas) {
    const ws = XLSX.utils.aoa_to_sheet(a.linhas);
    // largura das colunas pelo maior texto (até 50 caracteres)
    ws['!cols'] = (a.linhas[0] || []).map((_, c) => ({ wch: Math.min(50, Math.max(6, ...a.linhas.slice(0, 400).map(l => String(l[c] == null ? '' : l[c]).length + 1))) }));
    if (a.linhas.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: a.linhas.length - 1, c: (a.linhas[0] || []).length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, String(a.nome || 'Planilha').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  }
  XLSX.writeFile(wb, arquivo.endsWith('.xlsx') ? arquivo : arquivo + '.xlsx');
}
// Data AAAA-MM-DD → DD/MM/AAAA (para a planilha)
export const dataBR = s => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s || '');
