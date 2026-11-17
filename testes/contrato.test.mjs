// Indicadores do contrato (public/contas/contrato.js): metas, contas de cada indicador e soma de Pátio e Bateria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IND_CONTRATO, metaDe, naMeta, textoMeta, mesesAte, diasDoMes, contarProgramacao, contarQuedas, contarAusencias, somarNumeros, calcularIndicadores, placar, conferirMetas, lerNumero, mudouNumeros } from '../public/contas/contrato.js';

test('os 8 indicadores com as metas aprovadas (as do Meu painel)', () => {
  assert.deepEqual(IND_CONTRATO.map(i => [i.k, i.meta]), [['abs', 3], ['he', 200], ['hp', 50], ['iccc', 95], ['iccp', 95], ['efic', 90], ['queda', 0], ['s5', 90]]);
  assert.equal(metaDe({}, 'abs'), 3);
  assert.equal(metaDe({ metas: { abs: 2.5 } }, 'abs'), 2.5, 'meta gravada vale');
  assert.equal(metaDe({ metas: { abs: '' } }, 'abs'), 3, 'vazio volta para a padrão');
  assert.equal(textoMeta({}, 'abs'), '≤ 3%');
  assert.equal(textoMeta({}, 'iccc'), '≥ 95%');
  assert.equal(textoMeta({}, 'he'), '≤ 200 h');
});
test('dentro da meta: menor é melhor (máximo) ou maior é melhor (mínimo)', () => {
  assert.equal(naMeta({}, 'abs', 3), true); assert.equal(naMeta({}, 'abs', 3.1), false);
  assert.equal(naMeta({}, 'iccc', 95), true); assert.equal(naMeta({}, 'iccc', 94.9), false);
  assert.equal(naMeta({}, 'queda', 0), true); assert.equal(naMeta({}, 'queda', 1), false);
  assert.equal(naMeta({}, 'he', null), null, 'sem número');
});
test('meses e dias do mês até hoje', () => {
  assert.deepEqual(mesesAte('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
  assert.equal(diasDoMes('2026-11', '2026-11-17').length, 17);
  assert.equal(diasDoMes('2026-10', '2026-11-17').length, 31);
  assert.equal(diasDoMes('2026-12', '2026-11-17').length, 0);
});
test('programação: realizadas ÷ programadas nos dias que já passaram, sem extras e sem dias vazios', () => {
  const w = { mes: '2026-11', ini: '2026-11-09', d: ['RRN_P__', 'EP_____'] }; // seg a dom; hoje = quarta 11
  assert.deepEqual(contarProgramacao([w, { mes: '2026-10', ini: '2026-10-26', d: ['RRRRRRR'] }], '2026-11', '2026-11-11'), { R: 2, prog: 4 });
});
test('queda zero conta os lançamentos do mês', () => {
  const w = { mes: '2026-11', ini: '2026-11-09', area: 'PÁTIO', qz: { 'Z|0|abc': { i: [], t: 2 }, 'Z|1|abd': { i: [], t: 1 } } };
  assert.equal(contarQuedas([w], '2026-11'), 2);
  assert.equal(contarQuedas([], '2026-11'), 0);
});
test('absenteísmo: faltas e atestados ÷ dias escalados', () => {
  const r = contarAusencias([{ escalados: 50, porCodigo: { FT: 1, AT: 1, AB: 3 } }, { escalados: 50, porCodigo: { FT: 1 } }]);
  assert.deepEqual(r, { esc: 100, aus: 3 });
  assert.equal(calcularIndicadores(r).abs, 3);
});
test('Coqueria = soma dos números de Pátio e Bateria (não a média das porcentagens)', () => {
  const p = { esc: 100, aus: 1, he: 50, R: 90, prog: 100, qz: 0, hp: 10, s5s: 1.8, s5n: 2 };
  const b = { esc: 300, aus: 15, he: 120.5, R: 10, prog: 100, qz: 1, hp: 30, s5s: 0.9, s5n: 1 };
  const v = calcularIndicadores(somarNumeros([p, b]), { iccc: 96, iccp: 94 });
  assert.equal(v.abs, 4); assert.equal(v.he, 170.5); assert.equal(v.hp, 40); assert.equal(v.efic, 50); assert.equal(v.queda, 1);
  assert.equal(v.s5, 90); assert.equal(v.iccc, 96); assert.equal(v.iccp, 94);
  assert.deepEqual(placar({}, v), { dentro: 4, comValor: 8 });
  assert.equal(calcularIndicadores({}).abs, null, 'sem escalados, sem número');
  assert.equal(calcularIndicadores({ hp: 0 }).hp, 0, 'zero hora parada é número');
});
test('metas e valores digitados: vírgula, vazio e erros em português', () => {
  assert.equal(lerNumero('96,5'), 96.5); assert.equal(lerNumero(''), null); assert.ok(Number.isNaN(lerNumero('abc')));
  const r = conferirMetas({ abs: '2,5', he: '', iccc: '95' }, { iccc: '97,2', iccp: '' });
  assert.deepEqual(r, { metas: { abs: 2.5, iccc: 95 }, valores: { iccc: 97.2, iccp: null } });
  assert.throws(() => conferirMetas({}, { iccc: '120' }), /ICCC inválido/);
  assert.throws(() => conferirMetas({ abs: '150' }, {}), /Absenteísmo inválida/);
  assert.equal(mudouNumeros({ esc: 1 }, { esc: 1 }), false); assert.equal(mudouNumeros({ esc: 1 }, { esc: 2 }), true);
});
