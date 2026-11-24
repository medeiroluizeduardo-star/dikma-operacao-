// Dados pessoais (CPF, endereço, telefone, rota de ônibus): limpeza, leitura da planilha, comparação e prazo LGPD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpfLimpo, cpfValido, cpfMostrar, limparDP, problemaDP, lerPlanilhaDP, compararDP, dpParaDescartar } from '../public/contas/dados-pessoais.js';

test('CPF: número sem o zero do começo, texto com pontos e dígitos verificadores', () => {
  assert.equal(cpfLimpo(4854931523), '04854931523');
  assert.equal(cpfLimpo('529.982.247-25'), '52998224725');
  assert.equal(cpfLimpo(''), '');
  assert.ok(cpfValido('529.982.247-25'));
  assert.ok(!cpfValido('529.982.247-26'));
  assert.ok(!cpfValido('111.111.111-11'));
  assert.ok(!cpfValido('123'));
  assert.equal(cpfMostrar('52998224725'), '529.982.247-25');
  assert.equal(problemaDP({ cpf: '52998224726' }), 'CPF inválido: confira os 11 números.');
  assert.equal(problemaDP(limparDP({ cpf: '529.982.247-25', tel: ' 27  90000-0000 ', rotaOn: 'rota 04' })), '');
  assert.deepEqual(limparDP({ cpf: '', tel: ' 27  90000-0000 ', end: '', rotaOn: 'rota 04' }), { tel: '27 90000-0000', rotaOn: 'ROTA 04' });
});

// Planilha no formato do RH: título NOME numa coluna e o nome na seguinte (a primeira tem a numeração).
const CAB = ['NOME', null, 'MATRICULA AMT', 'CPF', 'MATRICULA DIK', 'ADMISSÃO', 'DT NASCI', 'FUNCAO', 'SUPERVISOR', 'LIDER', 'ENDEREÇO', 'TELEFONE', 'ROTA'];
const lin = (n, nome, amt, cpf, dik, end, tel, rota) => [n, nome, amt, cpf, dik, null, null, 'AJUDANTE', 'X', 'Y', end, tel, rota];
const abas = [
  { nome: 'BATERIA ', rows: [CAB, lin(1, 'PESSOA UM', 70000001, 52998224725, 101, 'RUA A 1', null, 'ROTA 04'), lin(2, 'PESSOA DOIS - SINDICATO', 70000002, '111.444.777-35', null, 'RUA B', '27 99999-0000', 'ARCELOR')] },
  { nome: 'PATIO', rows: [CAB, lin(1, 'PESSOA TRES', 70000003, 12345678900, 103, 'RUA C', null, 'ROTA 01'), lin(2, 'NINGUEM AQUI', 70000009, 52998224725, 999, 'RUA Z', null, 'ROTA 02')] },
  { nome: 'DETECTOR GAS', rows: [['COLABORADORES', null, 'ENTREGUE'], [1, 'PESSOA UM', 'OK']] },
  { nome: 'DESLIGADOS', rows: [CAB, lin(1, 'PESSOA UM', 70000001, 52998224725, 101, 'RUA VELHA', null, 'ROTA 09')] }
];

test('lê todas as abas com a tabela (ignora a do detector de gás) e acha o nome na coluna ao lado', () => {
  const l = lerPlanilhaDP(abas);
  assert.equal(l.length, 5);
  assert.deepEqual(l[0], { aba: 'BATERIA', linha: 2, nome: 'PESSOA UM', mat: '101', matArc: '70000001', cpf: '52998224725', cpfBruto: '52998224725', end: 'RUA A 1', tel: '', rotaOn: 'ROTA 04', desligado: false });
  assert.equal(l[4].desligado, true);
});

test('compara com o cadastro: matrícula, nome, CPF inválido, repetida, Arcelor e não apaga o que já tem', () => {
  const fichas = [{ mat: '101', nome: 'PESSOA UM' }, { mat: '102', nome: 'PESSOA DOIS' }, { mat: '103', nome: 'PESSOA TRES', matArc: '70000099' }, { mat: '104', nome: 'OUTRA', matArc: '70000002' }];
  const atuais = new Map([['103', { tel: '27 98888-0000', cpf: '52998224725' }]]);
  const r = compararDP(lerPlanilhaDP(abas), fichas, atuais);
  assert.deepEqual(r.semFicha.map(x => x.nome), ['NINGUEM AQUI']);
  assert.deepEqual(r.pelonome.map(x => x.mat), ['102']);
  assert.deepEqual(r.cpfInvalido.map(x => x.mat), ['103']);
  assert.equal(r.repetidos.length, 1); // PESSOA UM também em Desligados: vale a aba de ativos
  const g = Object.fromEntries(r.gravar.map(x => [x.mat, x]));
  assert.equal(g['101'].dados.end, 'RUA A 1');
  assert.deepEqual(g['103'].dados, { cpf: '52998224725', tel: '27 98888-0000', end: 'RUA C', rotaOn: 'ROTA 01' }); // CPF ruim não troca o bom; telefone vazio não apaga
  assert.deepEqual(g['103'].campos, ['end', 'rotaOn']);
  assert.deepEqual(r.arc.map(a => [a.mat, a.de, a.para]), [['101', '', '70000001'], ['103', '70000099', '70000003']]);
  assert.deepEqual(r.arcConflito.map(a => [a.mat, a.matArc]), [['102', '70000002']]);
  // Rodar de novo com o que acabou de gravar: nada muda
  const r2 = compararDP(lerPlanilhaDP(abas), fichas, new Map(r.gravar.map(x => [x.mat, x.dados])));
  assert.equal(r2.gravar.length, 0);
});

test('LGPD: dados pessoais de quem saiu há mais de 2 anos', () => {
  const fichas = [{ mat: '1', nome: 'A', dem: '2024-01-10' }, { mat: '2', nome: 'B', dem: '2025-06-01' }, { mat: '3', nome: 'C' }];
  assert.deepEqual(dpParaDescartar([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }], fichas, '2026-11-24'), [{ id: '1', nome: 'A', dem: '2024-01-10' }]);
});

test('Perfis: "Ver dados pessoais" vem ligado para o RH · Administrativo e desligado para o Somente leitura', async () => {
  const { podeItemU } = await import('../public/contas/permissoes.js');
  const adm = { uid: 'a', papel: 'administrativo', acesso: { rh: 'administrativo' }, escopos: [] };
  const lei = { uid: 'l', papel: 'leitor', acesso: { rh: 'leitor' }, escopos: [] };
  assert.equal(podeItemU(adm, 'i_dpessoais', {}, 'rh'), true);
  assert.equal(podeItemU(lei, 'i_dpessoais', {}, 'rh'), false);
  assert.equal(podeItemU(lei, 'i_dpessoais', { 'rh|leitor': { i_dpessoais: true } }, 'rh'), true);
  assert.equal(podeItemU(adm, 'i_dpessoais', { 'rh|administrativo': { i_dpessoais: false } }, 'rh'), false);
});
