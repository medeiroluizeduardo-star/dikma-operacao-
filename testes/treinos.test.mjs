// Testes da conta de treinamentos, NRs e ASO (public/contas/treinos.js). Não precisa do emulador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMeses, vigentes, situacaoTreino, resumoTreinos, chavePessoa, mesesSugeridos, diasAte, tipoOficial, lerPlanilhaTreinos, chaveTreino } from '../public/contas/treinos.js';

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
  assert.deepEqual(r.itens[0], { mat: '123', nome: 'JOSÉ DA SILVA', setor: '', tipo: 'NR 35 TRABALHO EM ALTURA', realizado: '2026-01-10', validade: '2028-01-10', obs: '' });
  assert.equal(r.itens[1].validade, '2027-02-01', 'ASO sem validade: sugere 12 meses');
  assert.equal(r.erros.length, 2);
  assert.equal(lerPlanilhaTreinos([{ nome: 'x', linhas: [['a', 'b']] }]).itens.length, 0);
  assert.equal(chaveTreino({ mat: '1', tipo: 'nr-35', validade: '2028-01-10' }), chaveTreino({ mat: '1', tipo: 'NR-35', validade: '2028-01-10' }));
});

test('tipos da planilha da empresa: nomes com espaço, sem acento ou como NR-35 viram o nome oficial', () => {
  assert.equal(tipoOficial('NR-35'), 'NR 35 TRABALHO EM ALTURA');
  assert.equal(tipoOficial('NR 06 EPI '), 'NR 06 EPI');
  assert.equal(tipoOficial('NR 11 OPERADOR DE EQUIP. MOVEIS '), 'NR 11 OPERADOR DE EQUIP. MÓVEIS');
  assert.equal(tipoOficial('pine área'), 'PINE ÁREA');
  assert.equal(tipoOficial('Outro curso'), 'Outro curso');
  assert.equal(mesesSugeridos('NR 33 ESPAÇO CONFINADO '), 12);
  // NR-35 e NR-33 da mesma pessoa não se confundem
  const v = vigentes([{ id: 'a', mat: '1', tipo: 'NR-35', validade: '2027-01-01' }, { id: 'b', mat: '1', tipo: 'NR-33', validade: '2027-01-01' }]);
  assert.equal(v.size, 2);
});

test('importar o controle da empresa: uma linha por colaborador, 3 colunas por treinamento e a aba Configurações', () => {
  const d = (a, m, dia) => new Date(a, m - 1, dia);
  const principal = { nome: 'Controle de Treinamentos', linhas: [
    ['CONTROLE DE VALIDADE DOS TREINAMENTOS DE SEGURANÇA - BATERIA'],
    ['Total de funcionários cadastrados', 2],
    ['Nº', 'Nome do colaborador', 'CPF', 'Matrícula', 'Data de admissão', 'Turno', 'Função', 'NR 35 TRABALHO EM ALTURA', null, null, 'NR 33 ESPAÇO CONFINADO ', null, null, 'GASES SIDERÚRGICOS', null, null, 'CAL ', null, null],
    [null, null, null, null, null, null, null, 'Data de realização', 'Vencimento', 'Status', 'Data de realização', 'Vencimento', 'Status', 'Data de realização', 'Vencimento', 'Status', 'Data de realização', 'Vencimento', 'Status'],
    [1, 'pessoa teste um ', '000.000.000-00', 70000001, d(2025, 1, 6), 'Adm', 'AJUDANTE ', d(2024, 12, 13), d(2026, 12, 13), 'Em dia', 'NÃO SE APLICA ', '#VALUE!', '#VALUE!', d(2026, 5, 8), null, 'Cadastre a validade', 'INAPTO', null, null],
    [2, 'PESSOA TESTE DOIS', '000.000.000-01', 70000002, d(2022, 10, 21), 'Turno', 'OPERADOR', null, null, null, d(2026, 1, 16), 15, '#VALUE!', null, null, null, d(2026, 4, 1), null, null],
    [3, 'PESSOA TESTE TRES', '000.000.000-02', 70000002, null, 'Turno', 'OPERADOR', d(2025, 3, 1), null, null],
    [null, null, null, null, null, null, null]
  ] };
  const config = { nome: 'Configurações', linhas: [['CONFIGURAÇÃO'], [], ['Nº', 'Nomenclatura do treinamento', 'Validade (meses)'], [1, 'NR 35 TRABALHO EM ALTURA', 24], [2, 'NR 33 ESPAÇO CONFINADO ', 12], [9, 'GASES SIDERÚRGICOS', 36], [12, 'CAL ', null]] };
  const r = lerPlanilhaTreinos([principal, config]);
  assert.equal(r.formato, 'matriz'); assert.equal(r.pessoas, 3); assert.equal(r.erros.length, 0); assert.equal(r.avisos.length, 1, 'matrícula repetida em outra pessoa');
  assert.equal(r.itens.find(t => t.nome === 'PESSOA TESTE TRES').mat, '', 'entra sem matrícula');
  const de = (mat, tipo) => r.itens.find(t => t.mat === mat && t.tipo === tipo);
  const a = de('70000001', 'NR 35 TRABALHO EM ALTURA');
  assert.deepEqual(a, { mat: '70000001', nome: 'PESSOA TESTE UM', setor: 'BATERIA', turno: 'Adm', funcao: 'AJUDANTE', admissao: '2025-01-06', tipo: 'NR 35 TRABALHO EM ALTURA', realizado: '2024-12-13', validade: '2026-12-13', obs: '' });
  assert.equal(de('70000001', 'NR 33 ESPAÇO CONFINADO').na, true, 'NÃO SE APLICA');
  assert.equal(de('70000001', 'GASES SIDERÚRGICOS').validade, '2029-05-08', 'sem vencimento: validade da aba Configurações');
  assert.equal(de('70000001', 'CAL').obs, 'INAPTO', 'texto fica como observação');
  assert.equal(de('70000002', 'NR 33 ESPAÇO CONFINADO').validade, '2027-01-16', 'vencimento com erro: calcula pelos meses');
  assert.equal(de('70000002', 'CAL').validade, null, 'sem validade conhecida');
  assert.equal(de('70000002', 'NR 35 TRABALHO EM ALTURA'), undefined, 'célula vazia: não feito');
  assert.ok(!JSON.stringify(r.itens).includes('000.000'), 'o CPF não é lido');
  assert.equal(r.itens.length, 7);
  r.itens.pop();
  // situação: não se aplica fica fora da contagem; o registro com data vale mais que o sem data
  const hoje = '2026-11-10', l = r.itens.map((t, i) => ({ ...t, id: 'x' + i })), v = vigentes(l);
  assert.equal(situacaoTreino(l.find(t => t.na), hoje, v), 'na');
  assert.deepEqual(resumoTreinos(l, hoje), { vencido: 0, vence: 0, ok: 3, sem: 2 });
  const sub = vigentes([{ id: 'n', mat: '9', tipo: 'CAL', na: true }, { id: 'd', mat: '9', tipo: 'CAL', realizado: '2026-01-01', validade: null }]);
  assert.deepEqual([...sub], ['d']);
  assert.notEqual(chaveTreino(l.find(t => t.na)), chaveTreino({ ...l.find(t => t.na), na: false }));
});
