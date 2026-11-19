// Cadastro único (contas/pessoas.js): a mesma pessoa repetida em duas listas das Atividades (ex.: Coqueria Geral no
// Pátio e uma rota na Bateria) aparece na ficha e some da lista errada quando a ficha é salva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPessoas } from '../public/contas/pessoas.js';

function base() {
  const sets = {
    patio: { config: { rotas: [] }, colabs: { 'COQUERIA GERAL': [{ id: 'C010', mat: '900', nome: 'JOAO TESTE', funcao: 'AJUDANTE', area: 'COQUERIA GERAL', rota: 'COQUERIA GERAL', regime: 'ADMINISTRATIVO' }] } },
    bateria: { config: { rotas: [{ area: 'TRILHO', rota: 'ROTA 1' }] }, colabs: { TRILHO: [
      { id: 'B020', nome: 'JOAO TESTE', funcao: 'OPERADOR', area: 'TRILHO', rota: 'ROTA 1', regime: 'TURNO 4X4' },
      { id: 'B021', mat: '901', nome: 'JOAO TESTE', funcao: 'OPERADOR', area: 'TRILHO', rota: 'ROTA 1', regime: 'TURNO 4X4' }, // homônimo, outra matrícula
      { id: 'B022', mat: '777', nome: 'OUTRO', funcao: 'OPERADOR', area: 'TRILHO', rota: 'ROTA 1', regime: 'TURNO 4X4' }] } }
  };
  const salvos = [];
  const DB = { cache: { g: { colabs: [] } }, dados: k => sets[k], maiorIdUsado: () => 0, salvarColabsArea: (a, l, k) => { salvos.push(k + '|' + a); return Promise.resolve(); }, eSalvarCad: () => Promise.resolve() };
  return { sets, salvos, P: criarPessoas(DB) };
}

test('ficha mostra a repetição em outra lista das Atividades', () => {
  const { P } = base();
  const L = P.lotacao({ mat: '900', nome: 'JOAO TESTE' });
  assert.equal(L.area, 'COQUERIA GERAL');
  assert.deepEqual(L.outros.map(y => y.x.id), ['B020']); // o homônimo com outra matrícula não conta
  assert.match(L.txt, /Coqueria Geral \+ Bateria · Trilho · ROTA 1/);
});

test('salvar a ficha deixa a pessoa só na área escolhida', async () => {
  const { P, sets, salvos } = base();
  const c = { mat: '900', nome: 'JOAO TESTE', funcao: 'AJUDANTE' };
  await P.sincronizar(c, c, { area: 'COQUERIA GERAL', rota: 'COQUERIA GERAL', regime: 'ADMINISTRATIVO', desde: '2026-11-19' });
  assert.deepEqual(sets.patio.colabs['COQUERIA GERAL'].map(x => x.id), ['C010']);
  assert.deepEqual(sets.bateria.colabs.TRILHO.map(x => x.id), ['B021', 'B022']);
  assert.ok(salvos.includes('bateria|TRILHO'));
});

test('sem repetição, nada muda nas outras listas', async () => {
  const { P, sets, salvos } = base();
  const c = { mat: '777', nome: 'OUTRO', funcao: 'OPERADOR' };
  assert.deepEqual(P.lotacao(c).outros, []);
  await P.sincronizar(c, c, { area: 'TRILHO', rota: 'ROTA 1', regime: 'TURNO 4X4', desde: '2026-11-19' });
  assert.equal(sets.bateria.colabs.TRILHO.length, 3); // a pessoa é regravada no mesmo lugar
  assert.deepEqual(salvos, ['bateria|TRILHO']);
});
