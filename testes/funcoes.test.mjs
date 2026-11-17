// Administração › Funções (contas/funcoes.js): lista de funções e troca de função de muitas pessoas de uma vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoFuncoes, planoTroca, regimeDe, pessoasDe, regraValida, juntarListas, semFuncao, normFuncao } from '../public/contas/funcoes.js';

// Base: Ana (ADM nas Atividades), Beto (turno nas Atividades), Caio (só ficha, turma C), Davi (operador 4x4),
// Eva (só ficha, sem turma), Fábio (Executante ADM, não muda).
function base() {
  const fichas = [
    { mat: '1', nome: 'ANA', funcao: 'AJUDANTE' }, { mat: '2', nome: 'BETO', funcao: 'AJUDANTE' },
    { mat: '3', nome: 'CAIO', funcao: 'Ajudante', turma: 'C' }, { mat: '4', nome: 'DAVI', funcao: 'AJUDANTE' },
    { mat: '5', nome: 'EVA', funcao: 'AJUDANTE', dem: '2026-10-01' }, { mat: '6', nome: 'FABIO', funcao: 'EXECUTANTE' }
  ];
  const rec = [{ id: 'C001', mat: '1', nome: 'ANA', funcao: 'AJUDANTE', regime: 'ADMINISTRATIVO' }, { id: 'C002', nome: 'BETO', funcao: 'AJUDANTE', regime: 'TURNO 4X4', escHist: [{ ate: '2026-11-01', regime: 'ADMINISTRATIVO' }] }];
  const fab = [{ id: 'C003', mat: '6', nome: 'FABIO', funcao: 'EXECUTANTE', regime: 'ADMINISTRATIVO' }];
  const ativPorArea = new Map([['patio|RECEBIMENTO', rec], ['patio|PREPARAÇÃO', fab]]);
  const ativ = [...ativPorArea].flatMap(([k, l]) => l.map(x => ({ set: k.split('|')[0], area: k.split('|')[1], x })));
  const ops = [{ mat: '4', nome: 'DAVI', funcao: 'AJUDANTE', escala: '4x4', turma: 'A' }];
  return { fichas, ativ, ativPorArea, ops };
}

test('junta a mesma pessoa das três fontes (matrícula e, sem ela, nome)', () => {
  const P = pessoasDe(base());
  assert.equal(P.length, 6);
  const beto = P.find(p => p.nome === 'BETO'); assert.equal(beto.ativ.length, 1); assert.ok(beto.ficha);
});

test('regime de hoje: Atividades, depois Equipamentos, depois turma da ficha; sem nada vale ADM', () => {
  const P = Object.fromEntries(pessoasDe(base()).map(p => [p.nome, regimeDe(p)]));
  assert.equal(P.ANA.regime, 'ADM'); assert.equal(P.BETO.regime, 'TURNO'); // o escHist (antes era ADM) não importa
  assert.equal(P.CAIO.regime, 'TURNO'); assert.equal(P.DAVI.regime, 'TURNO');
  assert.equal(P.EVA.regime, 'ADM'); assert.match(P.EVA.origem, /sem regime/);
});

test('resumo conta pessoas por função (sem diferença de maiúsculas) e mostra as da lista sem ninguém', () => {
  const R = resumoFuncoes(base(), { lista: ['MOTORISTA'] });
  const aj = R.find(f => f.nome === 'AJUDANTE');
  assert.equal(aj.pessoas, 5); assert.equal(aj.adm, 2); assert.equal(aj.turno, 3);
  assert.equal(aj.fichas, 5); assert.equal(aj.ativ, 2); assert.equal(aj.ops, 1);
  const mo = R.find(f => f.nome === 'MOTORISTA'); assert.equal(mo.pessoas, 0); assert.ok(mo.naLista);
});

test('Ajudante → Executante (ADM) e Executante turno (turno) em todos os lugares', () => {
  const f = base();
  const P = planoTroca(f, 'AJUDANTE', { adm: 'Executante', turno: 'executante  turno' }, { lista: ['AJUDANTE', 'EXECUTANTE'], eqFuncoes: ['AJUDANTE', 'OPERADOR'] });
  assert.equal(P.mudancas.length, 5); assert.equal(P.adm, 2); assert.equal(P.turno, 3);
  const para = Object.fromEntries(P.mudancas.map(m => [m.nome, m.para]));
  assert.deepEqual(para, { ANA: 'EXECUTANTE', BETO: 'EXECUTANTE TURNO', CAIO: 'EXECUTANTE TURNO', DAVI: 'EXECUTANTE TURNO', EVA: 'EXECUTANTE' });
  assert.ok(P.mudancas.find(m => m.nome === 'EVA').desligado);
  assert.equal(P.fichas.find(c => c.mat === '3').funcao, 'EXECUTANTE TURNO');
  assert.equal(P.fichas.find(c => c.mat === '6').funcao, 'EXECUTANTE');
  assert.equal(P.ativ.get('patio|RECEBIMENTO')[1].funcao, 'EXECUTANTE TURNO');
  assert.deepEqual(P.ativ.get('patio|RECEBIMENTO')[1].escHist, [{ ate: '2026-11-01', regime: 'ADMINISTRATIVO' }]); // o resto fica igual
  assert.ok(!P.ativ.has('patio|PREPARAÇÃO')); // área sem ninguém mudando não é regravada
  assert.equal(P.ops[0].funcao, 'EXECUTANTE TURNO');
  assert.deepEqual(P.lista, ['EXECUTANTE', 'EXECUTANTE TURNO']); // AJUDANTE sai da lista
  assert.deepEqual(P.eqFuncoes, ['EXECUTANTE TURNO', 'OPERADOR']);
  assert.equal(f.fichas[0].funcao, 'AJUDANTE'); // não altera os dados originais
});

test('renomear: todos para um nome só; nada muda quando ninguém tem a função', () => {
  const P = planoTroca(base(), 'executante', { todos: 'Executante ADM' });
  assert.equal(P.mudancas.length, 1); assert.equal(P.fichas.find(c => c.mat === '6').funcao, 'EXECUTANTE ADM');
  const N = planoTroca(base(), 'PINTOR', { todos: 'X' }, { lista: ['PINTOR'] });
  assert.equal(N.mudancas.length, 0); assert.equal(N.fichas, null); assert.equal(N.ops, null); assert.deepEqual(N.lista, ['X']);
});

test('validação da troca e listas', () => {
  assert.match(regraValida('', { todos: 'X' }), /Escolha/);
  assert.match(regraValida('A', { adm: 'B', turno: '' }), /ADM e a do turno/);
  assert.match(regraValida('A', { todos: 'a' }), /igual/);
  assert.equal(regraValida('AJUDANTE', { adm: 'EXECUTANTE', turno: 'EXECUTANTE TURNO' }), '');
  assert.deepEqual(juntarListas(['Líder', 'b'], ['LIDER', 'A']), ['A', 'B', 'LÍDER']);
  assert.deepEqual(semFuncao(['A', 'Líder'], 'lider'), ['A']);
  assert.equal(normFuncao('  executante   turno '), 'EXECUTANTE TURNO');
});
