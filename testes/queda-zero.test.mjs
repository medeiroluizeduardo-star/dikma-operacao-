// Testes das contas da Queda zero (public/contas/queda-zero.js): tabela de fatores, resultado (fator × quantidade),
// leitura do formulário e textos. Não precisa do emulador: node --test testes/queda-zero.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../public/contas/queda-zero.js';

test('Queda zero: fatores da tabela da operação', () => {
  const t = { retro: [0.5, 0.6], bobcat: [0.2, 0.4], cacamba: [9, 12], carrinho: [0.05, 0.07], balde: [0.003, 0.003], pa: [0.008, 0.009] };
  for (const [e, [c, v]] of Object.entries(t)) { assert.equal(Q.fatorQZ(e, 'coque'), c, e); assert.equal(Q.fatorQZ(e, 'carvao'), v, e); }
  assert.equal(Q.fatorQZ('x', 'coque'), null);
  assert.equal(Q.fatorQZ('pa', 'minerio'), null);
});
test('Queda zero: resultado = fator × quantidade, sem erro de arredondamento', () => {
  assert.equal(Q.resultadoQZ('carrinho', 'coque', 3), 0.15);
  assert.equal(Q.resultadoQZ('cacamba', 'carvao', 2), 24);
  assert.equal(Q.resultadoQZ('pa', 'carvao', 0), 0);
});
test('Queda zero: lê o formulário (vírgula, linhas vazias, erros) e soma', () => {
  const r = Q.calcQZ([{ e: 'cacamba', p: 'coque', q: '2' }, { e: 'pa', p: 'carvao', q: '2,5' }, { e: '', p: 'coque', q: '' }]);
  assert.equal(r.erro, '');
  assert.deepEqual(r.itens, [{ e: 'cacamba', p: 'coque', q: 2 }, { e: 'pa', p: 'carvao', q: 2.5 }]);
  assert.equal(r.t, 18.0225);
  assert.deepEqual(Q.valorQZ(r), { i: r.itens, t: 18.0225 });
  assert.equal(Q.valorQZ(Q.calcQZ([{ e: 'pa', p: 'coque', q: '' }])), null, 'nada preenchido = sem registro');
  assert.match(Q.calcQZ([{ e: '', p: 'coque', q: '1' }]).erro, /equipamento/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: '-1' }]).erro, /maior que zero/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: 'abc' }]).erro, /maior que zero/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: '100000' }]).erro, /até/);
});
test('Queda zero: textos e registro da célula', () => {
  assert.equal(Q.fmtT(18.0225), '18,023 t');
  assert.equal(Q.fmtT(0.15), '0,15 t (150 kg)');
  assert.equal(Q.textoQZ({ i: [{ e: 'cacamba', p: 'coque', q: 2 }, { e: 'pa', p: 'carvao', q: 2.5 }], t: 18.0225 }), '2 × Caçamba de caminhão (coque) + 2,5 × Pá (carvão)');
  const doc = { qz: { 'REC-001|2': { i: [], t: 1 } } };
  assert.deepEqual(Q.qzDaCel(doc, 'REC-001', 2), { i: [], t: 1 });
  assert.equal(Q.qzDaCel(doc, 'REC-001', 3), null);
  assert.equal(Q.qzDaCel({}, 'REC-001', 2), null);
});
