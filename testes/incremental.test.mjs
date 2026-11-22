// Leitura incremental (nucleo/incremental.js) com um Firebase de mentira que imita o de verdade:
// sem includeMetadataChanges, a confirmação do servidor sem nenhuma mudança (só fromCache vira false) não gera aviso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ouvirIncremental } from '../public/nucleo/incremental.js';

const docs = l => l.map(x => ({ id: x.id, data: () => x, get: k => x[k] }));
function fbFalso(copia) {
  const fb = {
    collection: (db, c) => ({ c }), query: (r, w) => ({ ...r, w }), where: (...a) => a,
    onSnapshot(ref, a, b, c) {
      const op = typeof a === 'function' ? {} : a, fn = typeof a === 'function' ? a : b;
      if (op.source === 'cache') { fn({ docs: docs(copia), metadata: { fromCache: true } }); return () => {}; }
      // escuta normal: primeiro a cópia do aparelho; depois o servidor confirma (igual, nada mudou)
      if (copia.length) fn({ docs: docs(copia), metadata: { fromCache: true } });
      setTimeout(() => { if (op.includeMetadataChanges || !copia.length) fn({ docs: docs(copia), metadata: { fromCache: false } }); }, 5);
      return () => {};
    }
  };
  return fb;
}
const espera = ms => new Promise(r => setTimeout(r, ms));
const T = { toMillis: () => 1 };

test('aparelho com cópia mas sem a marca da última leitura completa: a tela sai do carregando', async () => {
  const marcas = new Map(), guarda = { ler: k => marcas.get(k) || 0, gravar: (k, v) => marcas.set(k, v) };
  let pronta = false, lista = [];
  ouvirIncremental(fbFalso([{ id: 'a', nome: 'X', atualizadoEm: T }, { id: 'b', apagado: true, atualizadoEm: T }]), {}, 'treinos', 'k', (l, ok) => { lista = l; pronta = ok; }, e => { throw e; }, guarda);
  await espera(30);
  assert.equal(pronta, true);
  assert.deepEqual(lista.map(x => x.id), ['a']);
  assert.ok(marcas.get('k'), 'grava a marca da leitura completa');
});

test('aparelho sem cópia: espera o servidor', async () => {
  let pronta = null;
  ouvirIncremental(fbFalso([]), {}, 'treinos', 'k', (l, ok) => { pronta = ok; }, e => { throw e; }, { ler: () => 0, gravar: () => {} });
  assert.equal(pronta, false);
  await espera(30);
  assert.equal(pronta, true);
});

test('lançamentos de um mês: lê só o mês e, com cópia recente, pede ao servidor só o que mudou depois do lançamento mais novo', async () => {
  const pedidos = [];
  const fb = fbFalso([{ id: 'a', mes: '2026-11', em: { toMillis: () => 5 } }, { id: 'b', mes: '2026-11', em: { toMillis: () => 9 }, apagado: true, atualizadoEm: { toMillis: () => 7 } }]);
  const on = fb.onSnapshot; fb.onSnapshot = (ref, ...r) => { pedidos.push(ref); return on(ref, ...r); };
  const marcas = new Map([['k', Date.now()]]), guarda = { ler: k => marcas.get(k) || 0, gravar: (k, v) => marcas.set(k, v) };
  let lista = null, pronta = null;
  ouvirIncremental(fb, {}, { col: 'eqlanc', filtro: ['mes', '==', '2026-11'], marcas: ['atualizadoEm', 'em'] }, 'k', (l, ok) => { lista = l; pronta = ok; }, e => { throw e; }, guarda);
  assert.deepEqual(pedidos[0], { c: 'eqlanc', w: ['mes', '==', '2026-11'] }, 'a cópia do aparelho é só do mês');
  assert.equal(pedidos[1].w[0], 'atualizadoEm');
  assert.equal(pedidos[1].w[2].toMillis(), 9, 'desde o mais novo entre atualizadoEm e em');
  assert.equal(pronta, true, 'com cópia, mostra na hora');
  assert.deepEqual(lista.map(x => x.id), ['a'], 'sem os apagados');
  await espera(30);
});

test('lançamentos sem cópia recente: relê o mês inteiro', () => {
  const pedidos = [];
  const fb = fbFalso([{ id: 'a', mes: '2026-11', em: { toMillis: () => 5 } }]);
  const on = fb.onSnapshot; fb.onSnapshot = (ref, ...r) => { pedidos.push(ref); return on(ref, ...r); };
  ouvirIncremental(fb, {}, { col: 'eqlanc', filtro: ['mes', '==', '2026-11'], marcas: ['atualizadoEm', 'em'] }, 'k', () => {}, e => { throw e; }, { ler: () => 0, gravar: () => {} });
  assert.deepEqual(pedidos[1], { c: 'eqlanc', w: ['mes', '==', '2026-11'] });
});
