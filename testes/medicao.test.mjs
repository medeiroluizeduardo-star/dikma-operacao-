// Gestão › Medição: contas sem tela (public/contas/medicao.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrosPresenca, registrosParadas, juntarMes, ocultosDoMes, resumoMes, conferirManual, lerHoras, idPres, idPar, catParada, linhasExcel, horasDe } from '../public/contas/medicao.js';

const colabs = [{ id: 12, nome: 'FULANO DE TAL', area: 'RECEBIMENTO' }, { id: 13, nome: 'BELTRANO', area: 'PREPARAÇÃO' }];
const sit = { '12|2026-11-03': 'FT', '12|2026-11-04': 'AT', '13|2026-11-03': 'HE', '13|2026-11-05': 'HE', '13|2026-11-06': 'P', '12|2026-11-20': 'FT', '12|2026-10-31': 'FT' };
const info = key => ({ '12|2026-11-03': { jus: { mot: 'Problema familiar', obs: 'avisou' } }, '13|2026-11-03': { hed: { ini: '18:00', fim: '22:00', int: 30, mot: 'Cobertura' }, he: 'ARCELOR' } }[key] || {});
const pres = () => registrosPresenca({ k: 'patio', colabs, sit, info, ym: '2026-11', hoje: '2026-11-10', estimativa: () => 8 });

test('faltas e horas extras da Escala do dia, só do mês e até hoje, com os ids do Meu painel', () => {
  const r = pres();
  assert.equal(r.length, 4);
  const ft = r.find(x => x.id === idPres('patio', '12|2026-11-03'));
  assert.equal(ft.id, 'dk_patio_12_2026-11-03');
  assert.deepEqual([ft.tipo, ft.cat, ft.quem, ft.conj], ['falta', 'Justificada', 'Fulano de Tal', 'patio']);
  assert.match(ft.desc, /Problema familiar · avisou/);
  assert.equal(r.find(x => x.data === '2026-11-04').cat, 'Atestado médico');
  const he = r.find(x => x.id === 'dk_patio_13_2026-11-03');
  assert.equal(he.horas, 3.5); assert.equal(he.semHora, false); assert.match(he.desc, /a pedido da ArcelorMittal/);
  const est = r.find(x => x.id === 'dk_patio_13_2026-11-05');
  assert.equal(est.horas, 8); assert.equal(est.semHora, true);
  assert.equal(horasDe({ ini: '22:00', fim: '06:00' }), 8, 'atravessa a meia-noite');
});

test('horas perdidas: paradas fechadas do mês, sem as com substituição', () => {
  const ps = [
    { id: 'p1', eq: 'PC-03', data: '2026-11-02', ini: '08:00', fim: '10:30', causa: 'MECÂNICA', desc: 'vazamento', os: '55', conj: 'patio' },
    { id: 'p2', eq: 'PC-03', data: '2026-11-02', ini: '11:00', fim: null, causa: 'MECÂNICA' },
    { id: 'p3', eq: 'PC-04', data: '2026-11-03', ini: '08:00', fim: '09:00', subst: 'PC-05', causa: 'X' },
    { id: 'p4', eq: 'PC-04', data: '2026-11-03', ini: '08:00', fim: '09:00', causa: 'CHUVA', conj: 'bateria' }
  ];
  const r = registrosParadas(ps, '2026-11', '2026-11-10', c => (c === 'MECÂNICA' ? 'EQUIPAMENTO' : ''));
  assert.deepEqual(r.map(x => x.id), [idPar('p1'), 'dk_par_p4']);
  assert.equal(r[0].horas, 2.5); assert.equal(r[0].cat, 'Manutenção corretiva'); assert.match(r[0].desc, /OS 55/);
  assert.equal(r[1].cat, 'Condição climática');
  assert.equal(catParada('SEM OPERADOR', 'OPERADOR'), 'Falta de operador');
});

test('juntar o mês: lançado de todos, ocultos fora, digitado repetido aparece uma vez', () => {
  const auto = pres();
  const d = {
    l: { 'dk_patio_12_2026-11-03': { por: 'u1', nome: 'Ana Souza', em: '2026-11-04T10:00' } },
    oc: { 'dk_patio_13_2026-11-05': { por: 'u1' } },
    man: {
      m1: { tipo: 'he', data: '2026-11-03', quem: 'beltrano', conj: 'patio', horas: 4, desc: 'digitado' },
      m2: { tipo: 'ind', data: '2026-11-05', cat: 'ICCC', desc: 'faltou 1 dia', st: 'pendente' }
    }
  };
  const r = juntarMes(auto, d);
  assert.equal(r.length, 4, '4 automáticos − 1 oculto − 1 repetido + 2 digitados');
  assert.ok(r.find(x => x.id === 'dk_patio_12_2026-11-03').lanc);
  const m1 = r.find(x => x.id === 'm1'); assert.equal(m1.tambem, 'dk_patio_13_2026-11-03'); assert.equal(m1.origem, 'man');
  assert.ok(!r.some(x => x.id === 'dk_patio_13_2026-11-03'));
  assert.deepEqual(ocultosDoMes(auto, d).map(x => x.id), ['dk_patio_13_2026-11-05']);
  const s = resumoMes(r);
  assert.deepEqual([s.falta.n, s.falta.pend, s.he.n, s.he.horas, s.ind.pend], [2, 1, 1, 4, 1]);
  const x = linhasExcel(r);
  assert.deepEqual(x.map(a => a.nome), ['Faltas', 'Horas extras', 'Horas perdidas', 'ICCC-ICCP']);
  assert.equal(x[0].linhas[1][6], 'Ana Souza');
});

test('registro digitado: confere e explica o erro', () => {
  assert.equal(lerHoras('2,5'), 2.5); assert.ok(Number.isNaN(lerHoras('25'))); assert.ok(Number.isNaN(lerHoras('abc')));
  const ok = conferirManual('hp', { data: '2026-11-03', quem: 'PC-03', conj: 'bateria', cat: 'Outro', horas: '1,5', desc: '  x  ' }, '2026-11');
  assert.deepEqual(ok, { tipo: 'hp', data: '2026-11-03', quem: 'PC-03', conj: 'bateria', cat: 'Outro', horas: 1.5, desc: 'x' });
  assert.equal(conferirManual('ind', { data: '2026-11-03', cat: 'ICCP', desc: 'errado' }, '2026-11').st, 'pendente');
  assert.throws(() => conferirManual('ind', { data: '2026-11-03', cat: 'ICCP', desc: '' }, '2026-11'), /divergência/);
  assert.throws(() => conferirManual('falta', { data: '2026-10-03', quem: 'Fulano', conj: 'patio', cat: 'Justificada' }, '2026-11'), /mês aberto/);
  assert.throws(() => conferirManual('he', { data: '2026-11-03', quem: 'Fulano', conj: 'patio', horas: '0' }, '2026-11'), /Horas inválidas/);
  assert.throws(() => conferirManual('falta', { data: '2026-11-03', quem: 'Fulano', conj: 'x', cat: 'Justificada' }, '2026-11'), /conjunto/);
});
