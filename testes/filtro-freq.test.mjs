// Testes dos filtros da Frequência (public/contas/filtro-freq.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passaFiltroFreq, filtrosFreqAtivos, rotasFreq, ehAdmRegime } from '../public/contas/filtro-freq.js';

const adm = { area: 'RECEBIMENTO', rota: 'BALANÇA', regime: 'ADMINISTRATIVO', turma: '' };
const turnoA = { area: 'PREPARAÇÃO', rota: 'TOPO DO SILO', regime: '4X4', turma: 'A' };
const soFolha = { area: '', rota: '', regime: 'ADMINISTRATIVO', turma: '' };

test('área e rota: só quem está nelas; quem só está na folha sai', () => {
  assert.ok(passaFiltroFreq(adm, {}));
  assert.ok(passaFiltroFreq(adm, { area: 'RECEBIMENTO' }));
  assert.ok(!passaFiltroFreq(turnoA, { area: 'RECEBIMENTO' }));
  assert.ok(!passaFiltroFreq(soFolha, { area: 'RECEBIMENTO' }));
  assert.ok(passaFiltroFreq(turnoA, { area: 'PREPARAÇÃO', rota: 'TOPO DO SILO' }));
  assert.ok(!passaFiltroFreq(turnoA, { rota: 'BALANÇA' }));
});

test('turno: administrativo, qualquer turma ou uma turma', () => {
  assert.ok(passaFiltroFreq(adm, { turno: 'ADM' }));
  assert.ok(!passaFiltroFreq(turnoA, { turno: 'ADM' }));
  assert.ok(passaFiltroFreq(turnoA, { turno: 'TURNO' }));
  assert.ok(!passaFiltroFreq(adm, { turno: 'TURNO' }));
  assert.ok(passaFiltroFreq(turnoA, { turno: 'A' }));
  assert.ok(!passaFiltroFreq(turnoA, { turno: 'B' }));
  assert.ok(!passaFiltroFreq(adm, { turno: 'A' }));
  assert.ok(ehAdmRegime('') && ehAdmRegime('ADM') && !ehAdmRegime('3X3'));
});

test('contagem de filtros e rotas da área', () => {
  assert.equal(filtrosFreqAtivos({}), 0);
  assert.equal(filtrosFreqAtivos({ area: 'X', dia: '2026-11-13', rota: '' }), 2);
  const cs = [{ area: 'A', rota: 'R2' }, { area: 'A', rota: 'R1' }, { area: 'B', rota: 'R3' }, { area: 'A', rota: 'R1' }];
  assert.deepEqual(rotasFreq(cs, 'A'), ['R1', 'R2']);
  assert.deepEqual(rotasFreq(cs, ''), ['R1', 'R2', 'R3']);
});
