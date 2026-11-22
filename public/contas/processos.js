// Administração › Processos e rotina: contas sem tela (o site, os testes e a rotina dos avisos usam as mesmas).
// Os processos do analista (P01 a P09, vindos do Meu painel) com passos, responsáveis Dikma e Arcelor e a frequência.
// A rotina não é "gerada": as tarefas de cada dia saem da frequência de cada processo (diária, semanal, mensal) e só
// o que a pessoa marca (feita, não feita, em andamento, passos e observação) vai para o banco, em rotina/{pid}_{data}.
// Os processos ficam em processos/config (o padrão abaixo vale até o administrador mudar). Só o administrador lê e grava.
// Aqui não há nomes de pessoas: os responsáveis são digitados na tela e ficam só no banco.

export const FREQ = { diaria: 'Todo dia útil', semanal: 'Uma vez por semana', mensal: 'Fechamento do mês (último dia útil)', demanda: 'Sob demanda' };
export const DIAS = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta' };
export const CONJ = { coq: 'Coqueria', patio: 'Pátio', bateria: 'Bateria' };
export const PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const ESTADO = { aberta: 'A fazer', andamento: 'Em andamento', feita: 'Feita', nfeita: 'Não feita' };
export const LIMITES = { nome: 120, passo: 200, passos: 20, por: 400, pessoas: 300, obs: 600, processos: 30 };
// Quantos dias para trás a tela e os avisos olham (atrasadas e rotinas diárias não marcadas).
export const JANELA = 30;

export const PADRAO = [
  { id: 'P01', nome: 'Medição', conj: 'coq', prio: 'alta', freq: 'mensal', aba: 'gmed',
    por: 'Garantir a medição correta do contrato e o faturamento do mês',
    passos: ['Conferir colaboradores presentes e lançar justificativas de faltas', 'Conferir e lançar horas extras realizadas', 'Lançar horas perdidas na operação de equipamentos (alinhado à Gestão Operacional)', 'Conferir e corrigir a medição ICCC e ICCP'] },
  { id: 'P02', nome: 'Relatório fotográfico · Pátio', conj: 'patio', prio: 'media', freq: 'semanal', dia: 5, aba: 'cfarqfotos',
    por: 'Mostrar ao cliente a qualidade e a limpeza do Pátio de Carvão',
    passos: ['Coletar os registros fotográficos', 'Avaliar qualidade da imagem e limpeza', 'Montar a apresentação no PowerPoint', 'Enviar relatório ao cliente'] },
  { id: 'P03', nome: 'Relatório fotográfico · Bateria', conj: 'bateria', prio: 'media', freq: 'semanal', dia: 1, aba: 'cfarqfotos',
    por: 'Mostrar ao cliente a qualidade e a limpeza da Bateria',
    passos: ['Coletar os registros fotográficos', 'Avaliar qualidade da imagem e limpeza', 'Montar a apresentação no PowerPoint', 'Enviar relatório ao cliente'] },
  { id: 'P04', nome: 'Planejamento · Pátio', conj: 'patio', prio: 'media', freq: 'diaria', aba: 'prog',
    por: 'Acompanhar o que foi planejado no Pátio e tratar o que não foi feito',
    passos: ['Conferir com a liderança as atividades realizadas', 'Registrar atividades não realizadas e o motivo'] },
  { id: 'P05', nome: 'Planejamento · Bateria', conj: 'bateria', prio: 'media', freq: 'diaria', aba: 'prog',
    por: 'Acompanhar o que foi planejado na Bateria e tratar o que não foi feito',
    passos: ['Conferir com a liderança as atividades realizadas', 'Registrar atividades não realizadas e o motivo'] },
  { id: 'P06', nome: 'Queda Zero', conj: 'patio', prio: 'media', freq: 'semanal', dia: 2, aba: 'quedazero',
    por: 'Prevenir quedas de material e apoiar o plano de ação do cliente',
    passos: ['Levantar com a liderança os registros de queda de material', 'Coletar registros fotográficos', 'Montar apresentação ao cliente para o plano de ação', 'Lançar os registros na planilha do Power BI'] },
  { id: 'P07', nome: 'Gestão operacional', conj: 'coq', prio: 'alta', freq: 'diaria', aba: 'elanc',
    por: 'Manter os equipamentos operando e as horas paradas registradas',
    passos: ['Lançar equipamentos em operação ou em parada ao longo do dia', 'Inspeção de segurança, 5S e qualidade com os operadores', 'Lançar horas paradas na planilha de medição e no sistema de gestão'] },
  { id: 'P08', nome: 'Gestão administrativa', conj: 'coq', prio: 'alta', freq: 'diaria', aba: 'sganom',
    por: 'Manter segurança, documentação e padrões em dia',
    passos: ['Revisar com o técnico de segurança pendências, padrões operacionais e ordens de serviço', 'Revisar com a liderança a documentação dos colaboradores', 'Inspeção de segurança e processo na área com os colaboradores'] },
  { id: 'P09', nome: 'Ordens de manutenção', conj: 'coq', prio: 'baixa', freq: 'demanda', aba: '',
    por: 'Atender e arquivar as ordens de manutenção',
    passos: ['Conferir as OMs com a liderança conforme as atividades solicitadas', 'Arquivar os documentos'] }
];

// ---- datas (AAAA-MM-DD, sem fuso) ----
const dt = s => new Date(s + 'T12:00:00Z');
const isoZ = d => d.toISOString().slice(0, 10);
export const maisDias = (s, n) => { const d = dt(s); d.setUTCDate(d.getUTCDate() + n); return isoZ(d); };
export const diaSemana = s => dt(s).getUTCDay(); // 0 domingo … 6 sábado
export const diaUtil = s => diaSemana(s) > 0 && diaSemana(s) < 6;
// Dia da rotina: hoje, ou a segunda seguinte no fim de semana (como no Meu painel).
export const diaDaRotina = hoje => (diaUtil(hoje) ? hoje : maisDias(hoje, diaSemana(hoje) === 6 ? 2 : 1));
export const segundaDe = s => maisDias(s, -((diaSemana(s) + 6) % 7));
export function ultimoUtilDoMes(s) {
  const d = dt(s.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  let x = isoZ(d); while (!diaUtil(x)) x = maisDias(x, -1); return x;
}
const dataOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const idTarefa = (pid, data) => `${pid}_${data}`;

// ---- processos ----
const linha = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
// Lista em uso: o padrão com o que o administrador mudou (cfg.itens) e os processos novos dele, na ordem do código.
export function processosDe(cfg) {
  const it = (cfg && cfg.itens) || {};
  const base = PADRAO.map(p => ({ ...p, dikma: '', arcelor: '', ativo: true, ...(it[p.id] || {}), id: p.id }));
  const novos = Object.keys(it).filter(k => !PADRAO.some(p => p.id === k) && it[k] && it[k].nome).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map(k => ({ conj: 'coq', prio: 'media', freq: 'demanda', passos: [], por: '', dikma: '', arcelor: '', ativo: true, aba: '', ...it[k], id: k, novo: true }));
  return [...base, ...novos];
}
export function proximoId(procs) {
  const n = procs.map(p => +String(p.id).replace(/\D/g, '') || 0).reduce((m, x) => Math.max(m, x), 0) + 1;
  return 'P' + String(n).padStart(2, '0');
}
// Confere o formulário do processo e devolve o que vai para processos/config (itens[id]).
export function conferirProcesso(f) {
  const nome = linha(f.nome, LIMITES.nome);
  if (nome.length < 3) throw new Error('Dê um nome ao processo.');
  if (!FREQ[f.freq]) throw new Error('Escolha a frequência.');
  const dia = f.freq === 'semanal' ? +f.dia : 0;
  if (f.freq === 'semanal' && !DIAS[dia]) throw new Error('Escolha o dia da semana.');
  const passos = (Array.isArray(f.passos) ? f.passos : String(f.passos || '').split('\n')).map(s => linha(s, LIMITES.passo)).filter(Boolean);
  if (passos.length > LIMITES.passos) throw new Error(`No máximo ${LIMITES.passos} passos.`);
  return {
    nome, conj: CONJ[f.conj] ? f.conj : 'coq', prio: PRIO[f.prio] ? f.prio : 'media', freq: f.freq, dia, passos,
    por: linha(f.por, LIMITES.por), dikma: linha(f.dikma, LIMITES.pessoas), arcelor: linha(f.arcelor, LIMITES.pessoas),
    ativo: f.ativo !== false, aba: linha(f.aba, 20)
  };
}

// ---- tarefas da rotina ----
// O processo tem tarefa neste dia (dia útil)?
export function venceEm(p, data) {
  if (!p.ativo || !diaUtil(data)) return false;
  if (p.freq === 'diaria') return true;
  if (p.freq === 'semanal') return diaSemana(data) === +p.dia;
  if (p.freq === 'mensal') return data === ultimoUtilDoMes(data);
  return false;
}
const titulo = (p, data) => (p.freq === 'mensal' ? `${p.nome} · fechamento de ${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][+data.slice(5, 7) - 1]}` : p.nome);
// Tarefa de um processo num dia, com o que foi marcado (doc de rotina/{id}).
export function tarefa(p, data, docs = {}) {
  const id = idTarefa(p.id, data); const d = docs[id] || {};
  const passos = p.passos.map((t, i) => ({ t, ok: !!(d.passos || [])[i] }));
  const status = ESTADO[d.status] ? d.status : 'aberta';
  return { id, pid: p.id, data, titulo: titulo(p, data), diaria: p.freq === 'diaria', status, passos, feitos: passos.filter(x => x.ok).length, obs: d.obs || '', feitaEm: d.feitaEm || '', p };
}
export const fechada = t => t.status === 'feita' || t.status === 'nfeita';
// Tarefas de todos os processos entre duas datas (inclusive), da mais antiga para a mais nova.
export function tarefasEntre(procs, de, ate, docs = {}) {
  const out = [];
  for (let d = de; d <= ate; d = maisDias(d, 1)) for (const p of procs) if (venceEm(p, d)) out.push(tarefa(p, d, docs));
  return out;
}
// O quadro da rotina. desde = quando a rotina passou a contar (antes disso nada fica atrasado).
// doDia: as do dia da rotina · atrasadas: semanais e mensais vencidas sem fechar · naoMarcadas: diárias de dias que
// passaram sem dizer se foram feitas (não contam como atrasadas) · proximas: semanais e mensais dos próximos 7 dias.
export function quadro(procs, docs, hoje, desde) {
  const dia = diaDaRotina(hoje);
  const ini = [maisDias(hoje, -JANELA), dataOk(desde) ? desde : hoje].sort()[1];
  const antes = ini < hoje ? tarefasEntre(procs, ini, maisDias(hoje, -1), docs).filter(t => !fechada(t)) : [];
  const doDia = tarefasEntre(procs, dia, dia, docs);
  const proximas = tarefasEntre(procs, maisDias(dia, 1), maisDias(dia, 7), docs).filter(t => !t.diaria && !fechada(t));
  const ord = (a, b) => a.data.localeCompare(b.data) || a.pid.localeCompare(b.pid, 'pt-BR', { numeric: true });
  return {
    dia, doDia: doDia.sort(ord), atrasadas: antes.filter(t => !t.diaria).sort(ord), naoMarcadas: antes.filter(t => t.diaria).sort(ord), proximas: proximas.sort(ord),
    feitasDia: doDia.filter(t => t.status === 'feita').length
  };
}
// Andamento de cada processo nos últimos dias (para os cartões): feitas, não feitas e em aberto.
export function andamento(procs, docs, hoje, desde, dias = JANELA) {
  const ini = [maisDias(hoje, -dias), dataOk(desde) ? desde : hoje].sort()[1];
  const T = ini <= hoje ? tarefasEntre(procs, ini, hoje, docs) : [];
  const r = {};
  for (const p of procs) { const l = T.filter(t => t.pid === p.id); r[p.id] = { n: l.length, feitas: l.filter(t => t.status === 'feita').length, nfeitas: l.filter(t => t.status === 'nfeita').length }; }
  return r;
}
// O que vai para rotina/{id} quando a pessoa marca (o resto do doc continua). Devolve só os campos da tarefa.
/** @param {any} t
 * @param {{ status?: string, passos?: any, obs?: string }} [opc] */
export function marcar(t, { status, passos, obs } = {}) {
  const st = status && ESTADO[status] ? status : t.status;
  const ps = (passos || t.passos.map(x => x.ok)).slice(0, LIMITES.passos).map(Boolean);
  const out = { pid: t.pid, data: t.data, status: st, passos: ps, obs: String(obs ?? t.obs ?? '').replace(/\r/g, '').trim().slice(0, LIMITES.obs) };
  out.feitaEm = st === 'feita' ? (t.status === 'feita' && t.feitaEm ? t.feitaEm : new Date().toISOString()) : '';
  return out;
}
// Ao marcar um passo: todos os passos feitos → tarefa feita; algum feito → em andamento; nenhum → a fazer.
export function statusPelosPassos(passos, atual) {
  if (!passos.length) return atual;
  const n = passos.filter(Boolean).length;
  return n === passos.length ? 'feita' : n ? 'andamento' : atual === 'nfeita' ? 'nfeita' : 'aberta';
}

// ---- avisos no celular (7h e 16h, integracao/avisos/planejar.mjs) ----
// As tarefas em aberto no formato do aviso: { pid, title, due, status, diaria }.
export function tarefasParaAviso(cfg, docs, hoje) {
  const procs = processosDe(cfg);
  const q = quadro(procs, docs, hoje, (cfg || {}).desde);
  const amanha = tarefasEntre(procs, maisDias(hoje, 1), maisDias(hoje, 1), docs).filter(t => !t.diaria && !fechada(t));
  return [...q.atrasadas, ...q.naoMarcadas, ...(q.dia === hoje ? q.doDia.filter(t => !fechada(t)) : []), ...amanha]
    .map(t => ({ pid: t.pid, title: t.titulo, due: t.data, status: t.status, diaria: t.diaria }));
}
