// Gestão › Minha agenda: contas sem tela (o site e os testes usam as mesmas).
// Cada pessoa tem os próprios itens em agenda/{id} (campo uid = dono). Só o dono lê e grava (firestore.rules › agenda):
// nem o administrador vê a agenda dos outros. Três tipos: compromisso (dia e hora), tarefa (prazo opcional, marca
// feita) e anotação (texto livre, pode ficar fixada no alto).

export const TIPOS = { compromisso: 'Compromisso', tarefa: 'Tarefa', nota: 'Anotação' };
export const LIMITES = { titulo: 200, texto: 5000 };
const DIA = /^20\d{2}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const add = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

// Confere e limpa o que veio do formulário. Devolve { ok, erro, item }.
export function conferir(x = {}) {
  const tipo = TIPOS[x.tipo] ? x.tipo : 'tarefa';
  const titulo = String(x.titulo || '').trim().slice(0, LIMITES.titulo);
  const texto = String(x.texto || '').trim().slice(0, LIMITES.texto);
  const data = DIA.test(x.data || '') ? x.data : '';
  const hora = tipo !== 'nota' && data && HORA.test(x.hora || '') ? x.hora : '';
  if (!titulo) return { ok: false, erro: 'Escreva o título.' };
  if (tipo === 'compromisso' && !data) return { ok: false, erro: 'Escolha o dia do compromisso.' };
  const item = { tipo, titulo, texto, data: tipo === 'nota' ? '' : data, hora, feito: tipo === 'nota' ? false : !!x.feito, fixa: tipo === 'nota' ? !!x.fixa : false };
  return { ok: true, item };
}

// Em que grupo da agenda o item cai, olhando o dia de hoje.
export function grupo(it, hoje) {
  if (it.tipo === 'nota') return 'nota';
  if (it.feito) return 'feito';
  if (!it.data) return 'semdata';
  if (it.data < hoje) return it.tipo === 'compromisso' ? 'passou' : 'atrasada';
  if (it.data === hoje) return 'hoje';
  if (it.data === add(hoje, 1)) return 'amanha';
  if (it.data <= add(hoje, 7)) return 'semana';
  return 'depois';
}
export const GRUPOS = [['atrasada', 'Atrasadas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Próximos 7 dias'], ['depois', 'Mais para frente'], ['semdata', 'Sem data']];

const chave = it => `${it.data || '9999'}${it.hora || '99:99'}${String(it.titulo || '').toLowerCase()}`;
// Itens da agenda (compromissos e tarefas abertos) separados nos grupos, na ordem de dia e hora.
export function agrupar(itens, hoje) {
  const out = Object.fromEntries(GRUPOS.map(([k]) => [k, []]));
  for (const it of itens) { const g = grupo(it, hoje); if (out[g]) out[g].push(it); }
  for (const k of Object.keys(out)) out[k].sort((a, b) => chave(a).localeCompare(chave(b)));
  return out;
}
// Anotações: fixadas primeiro, depois a mais recente.
export const notas = itens => itens.filter(it => it.tipo === 'nota').sort((a, b) => (b.fixa ? 1 : 0) - (a.fixa ? 1 : 0) || String(b.atualizadoEm || b.criadoEm || '').localeCompare(String(a.atualizadoEm || a.criadoEm || '')));
// Feitos e compromissos que já passaram, do mais recente para o mais antigo.
export const concluidos = (itens, hoje) => itens.filter(it => ['feito', 'passou'].includes(grupo(it, hoje))).sort((a, b) => chave(b).localeCompare(chave(a)));

// Números do topo.
export function resumo(itens, hoje) {
  const r = { hoje: 0, atrasadas: 0, semana: 0, notas: 0 };
  for (const it of itens) {
    const g = grupo(it, hoje);
    if (g === 'hoje') r.hoje++;
    else if (g === 'atrasada') r.atrasadas++;
    if (['hoje', 'amanha', 'semana'].includes(g)) r.semana++;
    if (g === 'nota') r.notas++;
  }
  return r;
}

// Busca no título e no texto, sem diferença de acento e maiúscula.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const buscar = (itens, q) => { const t = norm(q).trim(); return t ? itens.filter(it => norm(it.titulo + ' ' + (it.texto || '')).includes(t)) : itens; };
