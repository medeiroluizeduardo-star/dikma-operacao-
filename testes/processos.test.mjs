// Administração › Processos e rotina: contas sem tela (public/contas/processos.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PADRAO, processosDe, proximoId, conferirProcesso, venceEm, diaDaRotina, ultimoUtilDoMes, quadro, andamento, marcar, statusPelosPassos, tarefa, tarefasParaAviso } from '../public/contas/processos.js';

const HOJE = '2026-11-17'; // terça-feira
const P = processosDe(null);
const docOk = (pid, data, st = 'feita') => ({ [`${pid}_${data}`]: { pid, data, status: st, passos: [] } });

test('padrão: os 9 processos do Meu painel, sem nomes de pessoas', () => {
  assert.deepEqual(P.map(p => p.id), ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09']);
  assert.ok(P.every(p => p.ativo && p.dikma === '' && p.arcelor === ''));
  for (const n of ['Henrique', 'Camila', 'Wanderson', 'Jorge', 'WhatsApp']) assert.ok(!JSON.stringify(PADRAO).includes(n), n);
});

test('datas: dia da rotina no fim de semana é a segunda; último dia útil do mês', () => {
  assert.equal(diaDaRotina(HOJE), HOJE);
  assert.equal(diaDaRotina('2026-11-21'), '2026-11-23');
  assert.equal(diaDaRotina('2026-11-22'), '2026-11-23');
  assert.equal(ultimoUtilDoMes(HOJE), '2026-11-30');
  assert.equal(ultimoUtilDoMes('2026-10-05'), '2026-10-30', 'outubro termina num sábado');
});

test('frequência: diária todo dia útil, semanal no dia, mensal no fechamento, sob demanda nunca', () => {
  const p = id => P.find(x => x.id === id);
  assert.ok(venceEm(p('P07'), HOJE));
  assert.ok(!venceEm(p('P07'), '2026-11-21'), 'sábado');
  assert.ok(venceEm(p('P06'), HOJE), 'Queda Zero na terça');
  assert.ok(!venceEm(p('P02'), HOJE) && venceEm(p('P02'), '2026-11-20'), 'Pátio na sexta');
  assert.ok(venceEm(p('P03'), '2026-11-16'), 'Bateria na segunda');
  assert.ok(venceEm(p('P01'), '2026-11-30') && !venceEm(p('P01'), HOJE));
  assert.ok(!venceEm(p('P09'), HOJE));
  assert.ok(!venceEm({ ...p('P07'), ativo: false }, HOJE), 'desligado');
});

test('quadro: do dia, atrasadas (semanal/mensal), diárias não marcadas e próximas; nada antes do "desde"', () => {
  const docs = { ...docOk('P07', HOJE), ...docOk('P04', '2026-11-16'), ...docOk('P05', '2026-11-16', 'nfeita') };
  const q = quadro(P, docs, HOJE, '2026-11-16');
  assert.deepEqual(q.doDia.map(t => t.pid), ['P04', 'P05', 'P06', 'P07', 'P08']);
  assert.equal(q.feitasDia, 1);
  assert.deepEqual(q.atrasadas.map(t => t.id), ['P03_2026-11-16'], 'a Bateria de segunda passou sem fechar');
  assert.deepEqual(q.naoMarcadas.map(t => t.id), ['P07_2026-11-16', 'P08_2026-11-16'], 'feita e não feita já estão resolvidas');
  assert.deepEqual(q.proximas.map(t => t.id), ['P02_2026-11-20', 'P03_2026-11-23', 'P06_2026-11-24']);
  const novo = quadro(P, {}, HOJE, HOJE);
  assert.equal(novo.atrasadas.length + novo.naoMarcadas.length, 0, 'no primeiro dia nada fica para trás');
  const fds = quadro(P, {}, '2026-11-22', '2026-11-22');
  assert.equal(fds.dia, '2026-11-23');
  assert.ok(fds.doDia.some(t => t.pid === 'P03'));
});

test('marcar: passos e situação; feita guarda a hora; desmarcar limpa', () => {
  const t = tarefa(P.find(p => p.id === 'P06'), HOJE, {});
  assert.equal(t.passos.length, 4);
  const m = marcar(t, { status: 'feita', passos: [true, true, true, true], obs: '  conferido  ' });
  assert.equal(m.status, 'feita'); assert.ok(m.feitaEm); assert.equal(m.obs, 'conferido'); assert.equal(m.pid, 'P06'); assert.equal(m.data, HOJE);
  const t2 = tarefa(P.find(p => p.id === 'P06'), HOJE, { [`P06_${HOJE}`]: m });
  assert.equal(t2.feitos, 4);
  assert.equal(marcar(t2, { status: 'feita' }).feitaEm, m.feitaEm, 'mantém a hora da primeira vez');
  assert.equal(marcar(t2, { status: 'aberta' }).feitaEm, '');
  assert.equal(statusPelosPassos([true, false], 'aberta'), 'andamento');
  assert.equal(statusPelosPassos([true, true], 'andamento'), 'feita');
  assert.equal(statusPelosPassos([false, false], 'feita'), 'aberta');
});

test('processos: edição por cima do padrão, processo novo e conferência do formulário', () => {
  const cfg = { itens: { P07: { dikma: 'Coordenação', passos: ['Só um passo'] }, P10: { nome: 'Documentos', freq: 'semanal', dia: 3, passos: [] } } };
  const l = processosDe(cfg);
  assert.equal(l.find(p => p.id === 'P07').dikma, 'Coordenação');
  assert.deepEqual(l.find(p => p.id === 'P07').passos, ['Só um passo']);
  assert.equal(l.at(-1).id, 'P10'); assert.ok(l.at(-1).novo);
  assert.equal(proximoId(l), 'P11');
  const y = conferirProcesso({ nome: ' Inspeção  de área ', freq: 'semanal', dia: '4', passos: 'Passo 1\n\n Passo 2 ', conj: 'patio', prio: 'alta' });
  assert.deepEqual([y.nome, y.dia, y.passos, y.conj], ['Inspeção de área', 4, ['Passo 1', 'Passo 2'], 'patio']);
  assert.equal(conferirProcesso({ nome: 'Diário', freq: 'diaria', dia: '4' }).dia, 0);
  assert.throws(() => conferirProcesso({ nome: 'ab', freq: 'diaria' }), /nome/);
  assert.throws(() => conferirProcesso({ nome: 'Semanal', freq: 'semanal', dia: '6' }), /dia da semana/);
  assert.throws(() => conferirProcesso({ nome: 'Nada', freq: 'anual' }), /frequência/);
});

test('andamento dos últimos dias e tarefas para o aviso do celular', () => {
  const docs = { ...docOk('P07', '2026-11-16'), ...docOk('P07', HOJE, 'nfeita') };
  const a = andamento(P, docs, HOJE, '2026-11-16');
  assert.deepEqual(a.P07, { n: 2, feitas: 1, nfeitas: 1 });
  const av = tarefasParaAviso({ desde: '2026-11-16' }, docs, HOJE);
  assert.ok(av.some(t => t.pid === 'P03' && t.due === '2026-11-16' && !t.diaria), 'atrasada');
  assert.ok(av.some(t => t.pid === 'P06' && t.due === HOJE), 'do dia');
  assert.ok(!av.some(t => t.pid === 'P07' && t.due === HOJE), 'não feita já está resolvida');
  assert.ok(!av.some(t => t.due === '2026-11-18'), 'quarta não tem entrega semanal');
  assert.ok(tarefasParaAviso({ desde: '2026-11-16' }, docs, '2026-11-19').some(t => t.pid === 'P02' && t.due === '2026-11-20'), 'amanhã: Pátio na sexta');
});
