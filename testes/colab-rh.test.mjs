// Contas do cadastro do RH (RH › Colaboradores): contas/colab-rh.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unidadeDe, cadastroFalta, cadastroPct, experiencia, experienciaVence, desligadoNoMes, admitidoNoMes, linhaDoTempo } from '../public/contas/colab-rh.js';

const HOJE = '2026-11-25';

test('unidade: Sinter e Alto Forno pela área ou pelo setor do RH; o resto é Coqueria', () => {
  assert.equal(unidadeDe({ setor: 'Coqueria - Pátio' }, 'RECEBIMENTO'), 'Coqueria');
  assert.equal(unidadeDe({}, 'SINTER'), 'Sinter');
  assert.equal(unidadeDe({ setor: 'Sinterização' }), 'Sinter');
  assert.equal(unidadeDe({ subsetor: 'ALTO-FORNO 2' }), 'Coqueria');
  assert.equal(unidadeDe({ subsetor: 'Alto Forno 2' }), 'Alto Forno');
  assert.equal(unidadeDe(null), 'Coqueria');
});

test('cadastro completo: o que falta e a porcentagem', () => {
  const c = { matArc: '1', adm: '2026-01-01', funcao: 'X', setor: 'S', turma: 'A', lider: 'L' };
  assert.deepEqual(cadastroFalta(c), []); assert.equal(cadastroPct(c), 100);
  assert.deepEqual(cadastroFalta({ ...c, matArc: '', lider: ' ' }), ['Matrícula Arcelor', 'Líder imediato']);
  assert.equal(cadastroPct({ ...c, matArc: '', lider: '' }), 67);
});

test('experiência 45 + 45 dias', () => {
  const e = experiencia({ adm: '2026-11-01' }, HOJE);
  assert.equal(e.fim1, '2026-12-15'); assert.equal(e.fim2, '2027-01-29'); assert.equal(e.periodo, 1); assert.equal(e.faltam, 20);
  assert.ok(!experienciaVence({ adm: '2026-11-01' }, HOJE));
  assert.ok(experienciaVence({ adm: '2026-10-20' }, HOJE)); // 1º período até 03/12
  assert.equal(experiencia({ adm: '2026-10-01' }, HOJE).periodo, 2);
  assert.equal(experiencia({ adm: '2026-01-01' }, HOJE), null);
  assert.equal(experiencia({ adm: '2026-11-01', dem: '2026-11-20' }, HOJE), null);
});

test('mês de admissão e desligamento', () => {
  assert.ok(desligadoNoMes({ dem: '2026-11-03' }, '2026-11'));
  assert.ok(!desligadoNoMes({}, '2026-11'));
  assert.ok(admitidoNoMes({ adm: '2026-11-03' }, '2026-11'));
});

test('linha do tempo: admissão, experiência, troca de turma, férias e desligamento, do mais novo ao mais antigo', () => {
  const c = { adm: '2025-01-10', funcao: 'OPERADOR', turma: 'B', escHist: [{ ate: '2026-03-31', turma: 'A' }], dem: '2026-11-20', demMot: 'Pedido de demissão' };
  const ev = linhaDoTempo(c, [{ inicio: '2026-07-01', dias: 30, retorno: '2026-07-31' }, { inicio: '2027-01-01', dias: 30 }], HOJE);
  assert.deepEqual(ev.map(x => x.t), ['Desligamento', 'Férias', 'Troca de turma', 'Fim da experiência', 'Admissão']);
  assert.equal(ev[0].d, 'Pedido de demissão');
  assert.equal(ev[2].d, 'A → B'); assert.equal(ev[2].data, '2026-04-01');
});

test('unidade escolhida na ficha vale mais que a área e o setor', () => {
  assert.equal(unidadeDe({ un: 'Sinter', setor: 'Coqueria - Pátio' }, 'RECEBIMENTO'), 'Sinter');
  assert.equal(unidadeDe({ un: 'Coqueria' }, 'SINTER'), 'Coqueria');
  assert.equal(unidadeDe({ un: 'qualquer' }, 'SINTER'), 'Sinter', 'valor desconhecido: volta para a automática');
});
