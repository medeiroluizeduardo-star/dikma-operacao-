// Efetivo do dia (status do envio da presença por área e dia): contas/efetivo-dia.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoEf, podeEf, travadoEf, novoEf, ultimaEf, quadroEf, aguardandoEf, idEf, EF_DESDE, EF_HIST_MAX } from '../public/contas/efetivo-dia.js';

const HOJE = '2026-11-20';
const lider = { lanca: true }, rh = { valida: true }, adm = { lanca: true, valida: true, admin: true };

test('sem documento: não enviado; antes de a função entrar no ar, sem registro; dia futuro não tem status', () => {
  assert.equal(estadoEf(null, HOJE, HOJE).st, 'pendente');
  assert.equal(estadoEf(null, '2026-11-01', HOJE).st, 'antigo');
  assert.equal(estadoEf(null, '2026-11-12', HOJE).st, 'antigo');
  assert.equal(estadoEf(null, EF_DESDE, HOJE).st, 'pendente');
  assert.equal(estadoEf(null, '2026-11-21', HOJE), null);
  assert.equal(estadoEf({ st: 'validado' }, '2026-11-01', HOJE).st, 'validado');
});

test('quem faz cada passo: líder envia, RH valida ou devolve o enviado, administrador reabre o validado', () => {
  assert.ok(podeEf('enviado', null, lider));
  assert.ok(podeEf('enviado', { st: 'enviado' }, lider), 'reenviar');
  assert.ok(podeEf('enviado', { st: 'devolvido' }, lider));
  assert.ok(podeEf('enviado', { st: 'aberto' }, lider));
  assert.ok(!podeEf('enviado', { st: 'validado' }, lider), 'validado não muda');
  assert.ok(!podeEf('enviado', null, rh), 'o RH não envia');
  assert.ok(podeEf('validado', { st: 'enviado' }, rh));
  assert.ok(podeEf('devolvido', { st: 'enviado' }, rh));
  assert.ok(!podeEf('validado', null, rh), 'só o que foi enviado');
  assert.ok(!podeEf('validado', { st: 'devolvido' }, rh));
  assert.ok(!podeEf('validado', { st: 'enviado' }, lider), 'o líder não valida');
  assert.ok(podeEf('aberto', { st: 'validado' }, adm));
  assert.ok(!podeEf('aberto', { st: 'validado' }, rh), 'só o administrador reabre');
  assert.ok(!podeEf('aberto', { st: 'enviado' }, adm));
});

test('o dia validado fica travado para quem preenche', () => {
  assert.ok(travadoEf({ st: 'validado' }));
  assert.ok(!travadoEf({ st: 'enviado' }));
  assert.ok(!travadoEf({ st: 'aberto' }));
  assert.ok(!travadoEf(null));
});

test('documento novo: campos, histórico na ordem e motivo obrigatório na devolução', () => {
  const quem = { uid: 'u1', nome: 'Fulano' };
  const a = novoEf(null, '2026-11-20', 'RECEBIMENTO', 'enviado', quem, '2026-11-20T11:00:00.000Z');
  assert.deepEqual(a, { area: 'RECEBIMENTO', data: '2026-11-20', mes: '2026-11', st: 'enviado', por: 'u1', nome: 'Fulano', mot: '', hist: [{ st: 'enviado', nome: 'Fulano', em: '2026-11-20T11:00:00.000Z' }] });
  assert.throws(() => novoEf(a, '2026-11-20', 'RECEBIMENTO', 'devolvido', quem, 'x', '  '), /motivo/);
  const b = novoEf(a, '2026-11-20', 'RECEBIMENTO', 'devolvido', { uid: 'u2', nome: 'RH' }, '2026-11-20T12:00:00.000Z', ' falta sem justificativa ');
  assert.equal(b.mot, 'falta sem justificativa');
  assert.deepEqual(b.hist.map(x => x.st), ['enviado', 'devolvido']);
  const c = novoEf(b, '2026-11-20', 'RECEBIMENTO', 'enviado', quem, '2026-11-20T13:00:00.000Z');
  assert.equal(c.mot, '', 'reenviar limpa o motivo');
  assert.equal(ultimaEf(c, 'enviado').em, '2026-11-20T13:00:00.000Z');
  assert.equal(ultimaEf(c, 'validado'), null);
  let d = null; for (let i = 0; i < EF_HIST_MAX + 5; i++) d = novoEf(d, '2026-11-20', 'RECEBIMENTO', 'enviado', quem, String(i));
  assert.equal(d.hist.length, EF_HIST_MAX); assert.equal(d.hist[d.hist.length - 1].em, String(EF_HIST_MAX + 4));
});

test('quadro do RH por área e lista do que aguarda validação', () => {
  const docs = { [idEf('2026-11-20', 'RECEBIMENTO')]: { area: 'RECEBIMENTO', data: '2026-11-20', st: 'enviado' }, [idEf('2026-11-18', 'PREPARAÇÃO')]: { area: 'PREPARAÇÃO', data: '2026-11-18', st: 'enviado' }, [idEf('2026-11-19', 'RECEBIMENTO')]: { area: 'RECEBIMENTO', data: '2026-11-19', st: 'validado' } };
  assert.deepEqual(quadroEf(['RECEBIMENTO', 'PREPARAÇÃO'], docs, '2026-11-20', HOJE).map(x => [x.area, x.st]), [['RECEBIMENTO', 'enviado'], ['PREPARAÇÃO', 'pendente']]);
  assert.deepEqual(quadroEf(['RECEBIMENTO'], docs, '2026-11-21', HOJE), []);
  assert.deepEqual(aguardandoEf(docs).map(x => x.data), ['2026-11-18', '2026-11-20']);
});
