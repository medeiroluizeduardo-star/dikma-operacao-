// Dikma Gestão — filtros da Frequência (RH › Frequência), sem tela: área, rota e turno de cada pessoa.
// A área e a rota vêm da Escala do dia (quem só está na folha não tem área nem rota e sai quando filtra por elas).
// Turno: 'ADM' (administrativo), 'TURNO' (qualquer turma de turno) ou a letra da turma ('A', 'B', 'C', 'D').
// f = { area, rota, turno } (vazio = todos) · info = { area, rota, regime, turma }

export const ehAdmRegime = regime => !regime || /ADM/i.test(String(regime));

export function passaFiltroFreq(info, f = {}) {
  if (f.area && info.area !== f.area) return false;
  if (f.rota && info.rota !== f.rota) return false;
  if (f.turno) {
    const adm = ehAdmRegime(info.regime);
    if (f.turno === 'ADM') return adm;
    if (adm) return false;
    if (f.turno !== 'TURNO' && String(info.turma || '').toUpperCase() !== f.turno) return false;
  }
  return true;
}

// Quantos filtros estão ligados (o dia conta como um).
export const filtrosFreqAtivos = f => ['area', 'rota', 'turno', 'dia'].filter(k => f && f[k]).length;

// Opções de rota de uma área (ou de todas), sem repetir, em ordem.
export const rotasFreq = (colabs, area) => [...new Set((colabs || []).filter(c => !area || c.area === area).map(c => c.rota).filter(Boolean))].sort((a, b) => a.localeCompare(b));
