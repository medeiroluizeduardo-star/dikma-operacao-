// Contas do alarme (sem rede, para os testes): a cópia de segurança do dia existe e tem o tamanho de sempre?
// O uso da cota grátis do Firestore passou do limite? Quem chama é alarme.mjs.

// Cota grátis por dia do Firestore no plano Spark (zera à meia-noite do Pacífico, ~5h de Brasília).
export const COTA = { leituras: 50000, gravacoes: 20000, exclusoes: 20000 };
export const LIMITE = 0.7;          // passou de 70% → alarme
export const IDADE_MAX_H = 26;      // a cópia diária roda às 3h; com folga para atraso do GitHub
export const TAMANHO_MIN = 0.6;     // cópia com menos de 60% do tamanho de costume (mesmo tipo) → alarme

const tipoDe = nome => (/^copia-(diaria|semanal|completa)-/.exec(nome || '') || [])[1] || '';
const mediana = v => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(b / 1024) + ' KB';

// execucoes: lista do GitHub (mais nova primeiro) de backup.yml, cada uma com { id, status, conclusion, created_at, pacote }
//   pacote = { nome, bytes, expirado } do artefato da execução (ou null se não tiver)
// Devolve { problemas: [...], avisos: [...], ultima } (problemas fazem a rotina falhar).
export function avaliarBackup(execucoes, agora = new Date()) {
  const problemas = [], avisos = [];
  // Canceladas = horário agendado que viu que já tinha a cópia do dia (backup.yml): não contam.
  const feitas = execucoes.filter(e => e.status === 'completed' && e.conclusion !== 'cancelled');
  const boas = feitas.filter(e => e.conclusion === 'success');
  const ultima = boas[0];
  if (!ultima) return { problemas: ['Nenhuma cópia de segurança que deu certo foi encontrada.'], avisos, ultima: null };
  const horas = (agora - new Date(ultima.created_at)) / 36e5;
  if (!(horas <= IDADE_MAX_H)) problemas.push(`A última cópia que deu certo é de ${Math.round(horas)} horas atrás: a cópia de hoje faltou.`);
  if (feitas[0] && feitas[0] !== ultima) avisos.push(`A tentativa de cópia mais recente terminou com "${feitas[0].conclusion}".`);
  const p = ultima.pacote;
  if (!p || p.expirado || !(p.bytes > 0)) { problemas.push('A última cópia que deu certo está sem o pacote guardado.'); return { problemas, avisos, ultima }; }
  const tipo = tipoDe(p.nome);
  const antes = boas.slice(1).map(e => e.pacote).filter(x => x && !x.expirado && x.bytes > 0 && tipoDe(x.nome) === tipo).map(x => x.bytes);
  if (antes.length >= 2) {
    const m = mediana(antes);
    if (p.bytes < m * TAMANHO_MIN) problemas.push(`A última cópia (${kb(p.bytes)}) ficou bem menor que o costume (${kb(m)}): pode ter saído incompleta.`);
  } else avisos.push('Ainda há poucas cópias do mesmo tipo para comparar o tamanho.');
  return { problemas, avisos, ultima };
}

// usos: { leituras, gravacoes, exclusoes } de um dia (números ou null quando não deu para ler).
export function avaliarCota(usos, rotulo) {
  const problemas = [], linhas = [];
  for (const [k, total] of Object.entries(COTA)) {
    const n = usos[k];
    if (n == null) continue;
    const pct = n / total;
    linhas.push({ k, n, total, pct });
    if (pct > LIMITE) problemas.push(`${rotulo}: ${k} em ${Math.round(pct * 100)}% da cota grátis (${n.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}).`);
  }
  return { problemas, linhas };
}

// Começo do dia da cota (meia-noite no horário do Pacífico, com horário de verão) do instante dado.
export function inicioDiaCota(agora = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(agora).map(x => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const desvio = comoUtc - Math.floor(agora.getTime() / 1000) * 1000; // fuso do Pacífico neste instante
  const meiaNoite = Date.UTC(+p.year, +p.month - 1, +p.day) - desvio;
  // na troca do horário de verão o desvio da meia-noite pode ser outro: confere e corrige
  const q = Object.fromEntries(fmt.formatToParts(new Date(meiaNoite)).map(x => [x.type, x.value]));
  return new Date(meiaNoite - (+q.hour ? (+q.hour > 12 ? (+q.hour - 24) : +q.hour) * 36e5 : 0));
}

// Última execução terminada de uma rotina do GitHub (lista mais nova primeiro): { ultima: ISO, ok, id } ou null.
// Execuções puladas ou canceladas não contam (não dizem se a rotina funciona).
export function ultimaRotina(execucoes = []) {
  const e = execucoes.find(x => x.status === 'completed' && !['skipped', 'cancelled'].includes(x.conclusion));
  return e ? { ultima: e.created_at, ok: e.conclusion === 'success', id: e.id } : null;
}
