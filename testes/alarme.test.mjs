// Alarme do backup e da cota (integracao/admin/alarme-contas.mjs): cópia do dia, tamanho de costume, 70% da cota.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarBackup, avaliarCota, inicioDiaCota, ultimaRotina } from '../integracao/admin/alarme-contas.mjs';

const agora = new Date('2026-11-22T10:30:00Z');
const exec = (h, bytes, extra = {}) => ({ id: h, status: 'completed', conclusion: 'success', created_at: new Date(agora - h * 36e5).toISOString(),
  pacote: bytes == null ? null : { nome: `copia-diaria-x${h}`, bytes, expirado: false }, ...extra });

test('cópia de hoje com tamanho de costume: tudo certo', () => {
  const r = avaliarBackup([exec(4, 1000), exec(28, 1010), exec(52, 990)], agora);
  assert.deepEqual(r.problemas, []);
});

test('cópia faltou (a última boa é de mais de 26 horas)', () => {
  const r = avaliarBackup([exec(30, 1000), exec(54, 1000), exec(78, 1000)], agora);
  assert.match(r.problemas.join(), /faltou/);
});

test('nenhuma cópia boa; tentativa mais recente falhou vira aviso', () => {
  assert.match(avaliarBackup([exec(4, null, { conclusion: 'failure' })], agora).problemas.join(), /Nenhuma/);
  const r = avaliarBackup([exec(2, null, { conclusion: 'failure' }), exec(4, 1000), exec(28, 1000), exec(52, 1000)], agora);
  assert.deepEqual(r.problemas, []); assert.match(r.avisos.join(), /failure/);
});

test('cópia bem menor que o costume ou sem pacote', () => {
  assert.match(avaliarBackup([exec(4, 400), exec(28, 1000), exec(52, 1000)], agora).problemas.join(), /menor/);
  assert.match(avaliarBackup([exec(4, null), exec(28, 1000)], agora).problemas.join(), /sem o pacote/);
  // a semanal (maior) não entra na comparação da diária
  const sem = { ...exec(28, 5000), pacote: { nome: 'copia-semanal-x', bytes: 5000, expirado: false } };
  assert.deepEqual(avaliarBackup([exec(4, 1000), sem, exec(52, 1000), exec(76, 1000)], agora).problemas, []);
});

test('cota: até 70% passa; acima, alarme', () => {
  assert.deepEqual(avaliarCota({ leituras: 35000, gravacoes: 14000, exclusoes: 0 }, 'Hoje').problemas, []);
  const r = avaliarCota({ leituras: 35001, gravacoes: 15000, exclusoes: null }, 'Hoje');
  assert.equal(r.problemas.length, 2); assert.equal(r.linhas.length, 2);
});

test('dia da cota começa à meia-noite do Pacífico (com e sem horário de verão)', () => {
  assert.equal(inicioDiaCota(new Date('2026-11-22T10:30:00Z')).toISOString(), '2026-11-22T08:00:00.000Z');
  assert.equal(inicioDiaCota(new Date('2026-11-22T05:00:00Z')).toISOString(), '2026-11-21T08:00:00.000Z');
  assert.equal(inicioDiaCota(new Date('2026-07-10T12:00:00Z')).toISOString(), '2026-07-10T07:00:00.000Z');
  // dias de troca de horário (8/3 e 1/11 de 2026)
  assert.equal(inicioDiaCota(new Date('2026-03-08T20:00:00Z')).toISOString(), '2026-03-08T08:00:00.000Z');
  assert.equal(inicioDiaCota(new Date('2026-11-01T20:00:00Z')).toISOString(), '2026-11-01T07:00:00.000Z');
});

test('última execução de uma rotina (para a tela Saúde do sistema): pula as canceladas e as em andamento', () => {
  assert.equal(ultimaRotina([]), null);
  const r = ultimaRotina([{ id: 3, status: 'in_progress' }, { id: 2, status: 'completed', conclusion: 'cancelled' }, { id: 1, status: 'completed', conclusion: 'failure', created_at: 'x' }]);
  assert.deepEqual(r, { ultima: 'x', ok: false, id: 1 });
});
