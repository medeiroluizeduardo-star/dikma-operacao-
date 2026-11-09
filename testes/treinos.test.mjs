// Testes da conta de treinamentos, NRs e ASO (public/contas/treinos.js). Não precisa do emulador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMeses, vigentes, situacaoTreino, resumoTreinos, chavePessoa, mesesSugeridos, diasAte } from '../public/contas/treinos.js';

test('addMeses respeita o fim do mês', () => {
  assert.equal(addMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(addMeses('2027-11-09', 24), '2029-11-09');
  assert.equal(addMeses('2026-12-15', 1), '2027-01-15');
  assert.equal(addMeses(null, 12), null);
});

test('mesma pessoa pela matrícula ou pelo nome', () => {
  assert.equal(chavePessoa({ mat: '123', nome: 'X' }), 'm123');
  assert.equal(chavePessoa({ nome: 'José da Silva' }), chavePessoa({ nome: 'JOSE DA SILVA' }));
  assert.equal(mesesSugeridos('NR-35'), 24);
  assert.equal(mesesSugeridos('Outro'), 0);
});

test('vale o registro de validade mais longa; o antigo fica renovado', () => {
  const l = [
    { id: 'a', mat: '1', tipo: 'NR-35', validade: '2026-01-10' },
    { id: 'b', mat: '1', tipo: 'NR-35', validade: '2028-01-10' },
    { id: 'c', mat: '1', tipo: 'ASO', validade: '2026-11-20' },
    { id: 'd', mat: '2', tipo: 'ASO', validade: '2026-10-01' },
    { id: 'e', mat: '3', tipo: 'NR-10', validade: null }
  ];
  const hoje = '2026-11-09', v = vigentes(l);
  assert.deepEqual([...v].sort(), ['b', 'c', 'd', 'e']);
  assert.equal(situacaoTreino(l[0], hoje, v), 'renovado');
  assert.equal(situacaoTreino(l[1], hoje, v), 'ok');
  assert.equal(situacaoTreino(l[2], hoje, v), 'vence');
  assert.equal(situacaoTreino(l[3], hoje, v), 'vencido');
  assert.equal(situacaoTreino(l[4], hoje, v), 'sem');
  assert.deepEqual(resumoTreinos(l, hoje), { vencido: 1, vence: 1, ok: 1, sem: 1 });
  assert.equal(diasAte(hoje, '2026-12-09'), 30);
  assert.equal(situacaoTreino({ id: 'x', validade: '2026-12-09' }, hoje), 'vence');
  assert.equal(situacaoTreino({ id: 'x', validade: '2026-12-10' }, hoje), 'ok');
});

test('importar planilha: acha os títulos, lê datas em vários formatos e sugere a validade', async () => {
  const { lerPlanilhaTreinos, dataCelula, chaveTreino } = await import('../public/contas/treinos.js');
  assert.equal(dataCelula('05/03/2026'), '2026-03-05');
  assert.equal(dataCelula('2026-03-05'), '2026-03-05');
  assert.equal(dataCelula(46086), '2026-03-05');
  assert.equal(dataCelula('abc'), null);
  const abas = [{ nome: 'Lista', linhas: [['CONTROLE DE TREINAMENTOS'], [], ['Matrícula', 'Nome do colaborador', 'Treinamento', 'Data', 'Vencimento'], ['', 'Nome', 'Tipo'],
    [123, 'josé da silva', 'NR-35', '10/01/2026', '10/01/2028'], ['', 'MARIA SOUZA', 'ASO', '01/02/2026', ''], ['', 'SEM TIPO', '', '', ''], ['', 'PEDRO', 'NR-10', '', 'amanhã'], []] }];
  // a 1ª linha com Nome e Tipo é a de títulos
  const r = lerPlanilhaTreinos([{ nome: 'L', linhas: [['Matrícula', 'Nome', 'Treinamento', 'Data', 'Vencimento'], ...abas[0].linhas.slice(4)] }]);
  assert.equal(r.itens.length, 2);
  assert.deepEqual(r.itens[0], { mat: '123', nome: 'JOSÉ DA SILVA', setor: '', tipo: 'NR-35', realizado: '2026-01-10', validade: '2028-01-10', obs: '' });
  assert.equal(r.itens[1].validade, '2027-02-01', 'ASO sem validade: sugere 12 meses');
  assert.equal(r.erros.length, 2);
  assert.equal(lerPlanilhaTreinos([{ nome: 'x', linhas: [['a', 'b']] }]).itens.length, 0);
  assert.equal(chaveTreino({ mat: '1', tipo: 'nr-35', validade: '2028-01-10' }), chaveTreino({ mat: '1', tipo: 'NR-35', validade: '2028-01-10' }));
});
