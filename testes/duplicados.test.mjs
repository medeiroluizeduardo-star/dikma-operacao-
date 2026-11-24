// Testes do aviso de cadastro repetido (public/contas/duplicados.js). node --test testes/duplicados.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadastrosDuplicados, repetidosNaFolha } from '../public/contas/duplicados.js';

test('fichas com o mesmo nome ou a mesma matrícula aparecem como cadastro repetido', () => {
  const fichas = [
    { mat: '100', nome: 'JOSÉ DA SILVA' }, { mat: '200', nome: 'Jose da Silva' },
    { mat: '300', nome: 'MARIA SOUZA' }, { mat: '300', nome: 'MARIA DE SOUZA' },
    { mat: '400', nome: 'ANA LIMA' }, { mat: '401', nome: 'ANA LIMA', dem: '2025-01-10' }
  ];
  const d = cadastrosDuplicados({ fichas, hoje: '2026-11-23' });
  assert.equal(d.length, 2);
  assert.deepEqual(d.find(x => /mesmo nome/.test(x.motivo)).mats, ['100', '200']);
  assert.deepEqual(d.find(x => /mesma matrícula/.test(x.motivo)).mats, ['300', '300']);
});

test('matrícula da Escala do dia diferente da ficha', () => {
  const d = cadastrosDuplicados({ fichas: [{ mat: '500', nome: 'PEDRO ALVES' }], escala: [{ nome: 'Pedro Alves', mat: '599' }, { nome: 'PEDRO ALVES', mat: '500' }, { nome: 'SEM FICHA NENHUMA', mat: '9' }] });
  assert.equal(d.length, 1);
  assert.match(d[0].motivo, /599.*500/);
});

test('Frequência: linhas da mesma pessoa (nome ou matrícula)', () => {
  const r = repetidosNaFolha([{ k: 'a', nome: 'RODRIGO X', mat: '1' }, { k: 'b', nome: 'Rodrigo X', mat: '2' }, { k: 'c', nome: 'OUTRO', mat: '3' }, { k: 'd', nome: 'OUTRO NOME', mat: '3' }, { k: 'e', nome: 'SOZINHO', mat: '' }]);
  assert.deepEqual([...r].sort(), ['a', 'b', 'c', 'd']);
});

test('a mesma pessoa duas vezes na Escala do dia', () => {
  const d = cadastrosDuplicados({ fichas: [{ mat: '7', nome: 'ANA' }], escala: [{ nome: 'ANA', mat: '7', area: 'X' }, { nome: 'ANA', mat: '7', area: 'Y' }] });
  assert.equal(d.length, 1);
  assert.match(d[0].motivo, /2 vezes na Escala do dia \(X, Y\)/);
});
