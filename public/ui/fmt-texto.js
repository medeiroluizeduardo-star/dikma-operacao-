// Número no formato do relatório (papel e Excel): %, toneladas, horas (28 min, 14h 40, 1d 13h) e números com vírgula.
// Fica separado de excel-relatorio.js para a tela não baixar o gerador de Excel só por causa disto.
export function fmtTexto(v, fmt) {
  if (v == null || v === '') return '';
  if (typeof v !== 'number') return String(v);
  if (fmt === 'pct') return v > 0 && v < 1 ? '< 1%' : Math.round(v) + '%';
  if (fmt === 't') return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fmt === 'h') { // no papel, igual à tela (contas/oms.js › duracao): 28 min, 14h 40, 1d 13h
    const m = Math.round(v * 60); if (m < 0) return '';
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d}d ${h}h` : h ? `${h}h${mm ? ' ' + String(mm).padStart(2, '0') : ''}` : `${mm} min`;
  }
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
