// Grupos da Frequência pelas fichas (Gestão › Colaboradores): contas/folha-ficha.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruposPelaFicha, criarGrupoDaFicha, folhaPelaFicha, SEM_FICHA, SEM_LIDER } from '../public/contas/folha-ficha.js';

const fichas = [
  { mat: '1', nome: 'FULANO DE TAL', lider: 'BELTRANO' },
  { mat: '2', nome: 'BELTRANO SOUZA', lider: 'CICLANO' },
  { mat: '3', nome: 'CICLANO LIMA', lider: '' },
  { mat: '4', nome: 'APOIO ADM', lider: 'BELTRANO' },
  { mat: '5', nome: 'SEM CHEFE', lider: '' },
  { mat: '9', nome: 'DESLIGADO', lider: 'BELTRANO', dem: '2026-10-01' }
];

test('só a partir da folha de 16/10 a 15/11/2026', () => {
  assert.equal(folhaPelaFicha('2026-10'), false);
  assert.equal(folhaPelaFicha('2026-11'), true);
  assert.equal(folhaPelaFicha('2027-01'), true);
});

test('grupo = líder da ficha e supervisão = líder da ficha do líder', () => {
  const g = criarGrupoDaFicha(fichas);
  assert.equal(g(fichas[0]), 'LIDER BELTRANO - SUPERVISAO CICLANO'.replace('SUPERVISAO', 'SUPERVISÃO'));
  assert.equal(g(fichas[4]), SEM_LIDER);
  assert.equal(g(null), SEM_FICHA);
});

test('Presença do dia + só na folha, ligação pela matrícula, histórico pela chave antiga', () => {
  const colabs = [{ id: 'c1', nome: 'FULANO DE TAL', mat: '1', turma: 'A' }, { id: 'c7', nome: 'NOVATO', mat: '7' }];
  const outros = [{ id: 'b1', nome: 'FOI PRA BATERIA', mat: '8' }];
  const folha = [
    { nome: 'LIDER YURI - SUPERVISÃO ANEILTON', turno: true, pessoas: [{ k: '1', nome: 'FULANO TAL', mat: '1' }, { k: '8', nome: 'FOI PRA BATERIA', mat: '8' }] },
    { nome: 'ADM', turno: false, pessoas: [{ k: '4', nome: 'APOIO ADM', mat: '4' }, { k: '9', nome: 'DESLIGADO', mat: '9' }, { k: 'n:X', nome: 'SO NA PLANILHA', mat: '' }] }
  ];
  const dem = p => (fichas.find(f => f.mat === p.mat) || {}).dem || '';
  const gr = gruposPelaFicha({ fichas, colabs, outros, folha, ini: '2026-10-16', desligadoEm: dem });
  const nomes = gr.map(g => g.nome);
  assert.deepEqual(nomes, ['LIDER BELTRANO - SUPERVISÃO CICLANO', SEM_FICHA]);
  const b = gr[0].pessoas;
  assert.deepEqual(b.map(p => p.nome), ['APOIO ADM', 'FULANO DE TAL']);
  const fulano = b.find(p => p.mat === '1');
  assert.equal(fulano.k, '1'); // lançamentos antigos da folha continuam valendo
  assert.equal(fulano.ativ, 'c1');
  assert.equal(fulano.turno, true);
  assert.equal(b.find(p => p.mat === '4').ativ, null); // só na folha
  const sem = gr[1].pessoas.map(p => p.nome).sort();
  assert.deepEqual(sem, ['NOVATO', 'SO NA PLANILHA']);
  assert.ok(!gr.flatMap(g => g.pessoas).some(p => p.mat === '8' || p.mat === '9')); // outro conjunto e desligado ficam de fora
});

test('nome parecido não liga; nome idêntico só quando falta matrícula', () => {
  const colabs = [{ id: 'c1', nome: 'JOAO SILVA', mat: '10' }];
  const fs = [{ mat: '11', nome: 'JOAO SILVA', lider: 'X' }];
  const gr = gruposPelaFicha({ fichas: fs, colabs, ini: '2026-10-16' });
  assert.equal(gr[0].nome, SEM_FICHA); // matrículas diferentes: não é a mesma pessoa
  const gr2 = gruposPelaFicha({ fichas: fs, colabs: [{ id: 'c1', nome: 'João  Silva' }], ini: '2026-10-16' });
  assert.equal(gr2[0].nome, 'LIDER X');
});
