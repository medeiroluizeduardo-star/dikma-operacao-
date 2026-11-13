// Férias de cada colaborador na ficha de RH › Colaboradores: contas/ferias.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiceFeriasPessoa, situacaoPeriodo, resumoFeriasPessoa, deFeriasHoje, feriasEmBreve, limiteProximo, feriasSemCadastro } from '../public/contas/ferias.js';

const HOJE = '2026-11-13';
const cadastro = [{ mat: '1', nome: 'FULANO DE TAL' }, { mat: '2', nome: 'JOSÉ SOUZA' }, { mat: '3', nome: 'CICLANO LIMA' }];
const ferias = [
  { id: 'a', mat: '1', nome: 'FULANO DE TAL', inicio: '2026-11-01', termino: '2026-11-30', retorno: '2026-12-01', limite: '2027-01-10' },
  { id: 'b', mat: '1', nome: 'FULANO DE TAL', inicio: '2025-10-01', termino: '2025-10-30' },
  { id: 'c', mat: '', nome: 'Jose Souza', inicio: null, limite: '2026-12-20', mesPlanejado: '2026-12' },
  { id: 'd', mat: '3', nome: 'CICLANO LIMA', inicio: '2026-12-20', termino: '2027-01-18', limite: '2027-02-01' },
  { id: 'e', mat: '77', nome: 'NINGUEM AQUI', inicio: '2026-12-01', termino: '2026-12-30' }
];
const de = indiceFeriasPessoa(ferias, cadastro);

test('liga os períodos pela matrícula e, sem ela, pelo nome sem acento', () => {
  assert.deepEqual(de(cadastro[0]).map(f => f.id), ['a', 'b']);
  assert.deepEqual(de(cadastro[1]).map(f => f.id), ['c']);
  assert.deepEqual(de({ mat: '9', nome: 'OUTRO' }), []);
});

test('situação e resumo de cada pessoa', () => {
  assert.equal(situacaoPeriodo(ferias[0], HOJE).t, 'Em férias');
  assert.equal(situacaoPeriodo(ferias[1], HOJE).t, 'Gozada');
  assert.equal(situacaoPeriodo(ferias[2], HOJE).t, 'Sem data');
  assert.equal(situacaoPeriodo(ferias[3], HOJE).t, 'Começa em 37 dias');
  const r = resumoFeriasPessoa(de(cadastro[0]), HOJE);
  assert.equal(r.atual.id, 'a'); assert.equal(r.limite, null); assert.equal(r.marcada, true);
  const j = resumoFeriasPessoa(de(cadastro[1]), HOJE);
  assert.equal(j.atual, null); assert.equal(j.limite, '2026-12-20');
});

test('filtros da lista: de férias agora, nos próximos 60 dias e data limite', () => {
  assert.equal(deFeriasHoje(de(cadastro[0]), HOJE), true);
  assert.equal(deFeriasHoje(de(cadastro[2]), HOJE), false);
  assert.equal(feriasEmBreve(de(cadastro[2]), HOJE), true);
  assert.equal(feriasEmBreve(de(cadastro[2]), HOJE, 30), false);
  assert.equal(limiteProximo(de(cadastro[1]), HOJE), true);
  assert.equal(limiteProximo(de(cadastro[2]), HOJE), false); // já tem férias marcadas
});

test('períodos sem ninguém no cadastro aparecem à parte', () => {
  assert.deepEqual(feriasSemCadastro(ferias, cadastro).map(f => f.id), ['e']);
});
