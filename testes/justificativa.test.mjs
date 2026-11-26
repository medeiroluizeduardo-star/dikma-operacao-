// Justificativa com detalhe (Equipamento indisponível / Prioridade operacional): montar, ler de volta e agrupar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motivoBase, montarMotivo, lerMotivo, faltaDetalhe } from '../public/contas/justificativa.js';

test('equipamento indisponível guarda qual equipamento', () => {
  const m = montarMotivo('Equipamento indisponível', { eq: '  caminhão   de vácuo 02 ' });
  assert.equal(m, 'Equipamento indisponível: caminhão de vácuo 02');
  assert.equal(motivoBase(m), 'Equipamento indisponível');
  assert.deepEqual(lerMotivo(m), { base: 'Equipamento indisponível', eq: 'caminhão de vácuo 02' });
});
test('prioridade operacional guarda quem solicitou e a demanda', () => {
  const m = montarMotivo('Prioridade operacional', { quem: 'Supervisor Carlos', dem: 'limpeza da TC-12' });
  assert.equal(m, 'Prioridade operacional: solicitado por Supervisor Carlos · demanda: limpeza da TC-12');
  assert.equal(motivoBase(m), 'Prioridade operacional');
  assert.deepEqual(lerMotivo(m), { base: 'Prioridade operacional', quem: 'Supervisor Carlos', dem: 'limpeza da TC-12' });
});
test('motivos antigos e escritos continuam iguais', () => {
  assert.equal(motivoBase('Equipamento indisponível'), 'Equipamento indisponível');
  assert.deepEqual(lerMotivo('Prioridade operacional'), { base: 'Prioridade operacional' });
  assert.equal(motivoBase('Chuva / condição climática'), 'Chuva / condição climática');
  assert.equal(motivoBase('caminhão quebrado'), '');
  assert.equal(montarMotivo('Outro'), 'Outro');
});
test('campos obrigatórios', () => {
  assert.match(faltaDetalhe('Equipamento indisponível', { eq: '' }), /equipamento/);
  assert.match(faltaDetalhe('Prioridade operacional', { quem: 'Ana', dem: ' ' }), /demanda/);
  assert.equal(faltaDetalhe('Prioridade operacional', { quem: 'Ana', dem: 'TC-12' }), '');
  assert.equal(faltaDetalhe('Outro', {}), '');
});
