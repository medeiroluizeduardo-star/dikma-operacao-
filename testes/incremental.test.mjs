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
