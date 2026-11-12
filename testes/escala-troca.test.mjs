// Troca de escala (ADM ↔ turno, troca de turma): vale só a partir da data da mudança.
// Os dias anteriores continuam com a escala antiga. Não precisa do emulador: node --test testes/escala-troca.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarEscala, comoEra, anotarTroca } from '../public/contas/escala.js';
import { situacaoDoDia } from '../public/contas/situacao.js';
import { criarCalc } from '../public/contas/eqcalc.js';

// 4x4 turma A: começa um bloco de trabalho em 2026-11-01 (dom). Trabalha 01–04, folga 05–08, trabalha 09–12…
const E = criarEscala({ regimes: { '4x4': { turmas: { A: '2026-11-01', B: '2026-11-05' } } } });
const sit = (p, d) => situacaoDoDia(p, d, { escala: E }).v;

test('anotarTroca guarda o que valia antes e comoEra devolve a escala do dia', () => {
  const adm = { id: 'P001', nome: 'X', regime: 'ADMINISTRATIVO', turma: '' };
  const h = anotarTroca(adm, { ...adm, regime: 'TURNO 4X4', turma: 'A' }, ['regime', 'turma'], '2026-11-11');
  assert.deepEqual(h, [{ ate: '2026-11-10', regime: 'ADMINISTRATIVO', turma: '' }]);
  const p = { ...adm, regime: 'TURNO 4X4', turma: 'A', escHist: h };
  assert.equal(comoEra(p, '2026-11-10').regime, 'ADMINISTRATIVO');
  assert.equal(comoEra(p, '2026-11-11').regime, 'TURNO 4X4');
  assert.equal(comoEra(p, '2026-12-01'), p);
  // sem mudança: o histórico fica igual
  assert.deepEqual(anotarTroca(p, { ...p }, ['regime', 'turma'], '2026-11-20'), h);
});

test('ADM → turno: dias anteriores seguem do administrativo, a partir da data vale a turma', () => {
  const antes = { id: 'P001', nome: 'X', regime: 'ADMINISTRATIVO', turma: '' };
  const depois = { ...antes, regime: 'TURNO 4X4', turma: 'A' };
  depois.escHist = anotarTroca(antes, depois, ['regime', 'turma'], '2026-11-11');
  // sáb 07/11: era ADM (fim de semana = folga); sex 06/11: ADM trabalha (seria folga na turma A)
  assert.equal(sit(depois, '2026-11-07'), 'F');
  assert.equal(sit(depois, '2026-11-06'), 'P');
  // qua 11/11 em diante: turma A (09–12 trabalha, 13–16 folga), mesmo em dia de semana
  assert.equal(sit(depois, '2026-11-11'), 'P');
  assert.equal(sit(depois, '2026-11-13'), 'F');
  // sem o histórico (como era antes da correção) o passado mudava: sex 06/11 virava folga
  assert.equal(sit({ ...depois, escHist: undefined }, '2026-11-06'), 'F');
});

test('turno → ADM: o passado continua pela turma', () => {
  const antes = { id: 'P002', nome: 'Y', regime: 'TURNO 4X4', turma: 'A' };
  const depois = { ...antes, regime: 'ADMINISTRATIVO', turma: '' };
  depois.escHist = anotarTroca(antes, depois, ['regime', 'turma'], '2026-11-16');
  assert.equal(sit(depois, '2026-11-14'), 'F'); // sáb, turma A folga (13–16)
  assert.equal(sit(depois, '2026-11-10'), 'P'); // ter, turma A trabalha
  assert.equal(sit(depois, '2026-11-05'), 'F'); // qui: turma A de folga, mesmo sendo dia útil
  assert.equal(sit(depois, '2026-11-16'), 'P'); // seg: já administrativo
  assert.equal(sit(depois, '2026-11-21'), 'F'); // sáb no administrativo
});

test('lançado no dia continua valendo, e trocar duas vezes no mesmo dia não cria escala do meio', () => {
  const a = { id: 'P003', nome: 'Z', regime: 'TURNO 4X4', turma: 'A' };
  const b = { ...a, turma: 'B' }; b.escHist = anotarTroca(a, b, ['regime', 'turma'], '2026-11-11');
  const c = { ...b, regime: 'ADMINISTRATIVO', turma: '' }; c.escHist = anotarTroca(b, c, ['regime', 'turma'], '2026-11-11');
  assert.deepEqual(c.escHist, [{ ate: '2026-11-10', regime: 'TURNO 4X4', turma: 'A' }]);
  const lanc = { escala: E, lancado: (p, d) => (d === '2026-11-05' ? 'HE' : '') };
  assert.equal(situacaoDoDia(c, '2026-11-05', lanc).v, 'HE');
  // troca com data futura: até a véspera vale a escala atual
  const d = { ...c, regime: 'TURNO 4X4', turma: 'B' }; d.escHist = anotarTroca(c, d, ['regime', 'turma'], '2026-12-01');
  assert.equal(comoEra(d, '2026-11-20').regime, 'ADMINISTRATIVO');
  assert.equal(comoEra(d, '2026-11-05').turma, 'A');
  assert.equal(comoEra(d, '2026-12-01').turma, 'B');
});

test('Operação: escala do operador por dia (escalado e janela do lançamento)', () => {
  const cfg = { turno: { x4Ini: '07:00', x4Fim: '19:00', x4Int: 1, admIni: '07:00', admFim: '17:00', admFimSex: '16:00', almIni: '11:00', almFim: '12:00' }, turmas: { A: '2026-11-01' }, feriados: [], causas: [], situacoes: [] };
  const antes = { nome: 'OP', escala: 'ADM', turma: '' };
  const o = { ...antes, escala: '4x4', turma: 'A' }; o.escHist = anotarTroca(antes, o, ['escala', 'turma'], '2026-11-11');
  const C = criarCalc(cfg, { operadores: [o], frota: [] });
  assert.equal(C.escalado(o, '2026-11-06'), true);  // sex: ADM trabalha
  assert.equal(C.escalado(o, '2026-11-07'), false); // sáb: ADM folga
  assert.equal(C.escalado(o, '2026-11-14'), false); // sáb: turma A folga
  assert.equal(C.escalado(o, '2026-11-11'), true);
  assert.equal(C.escalaDe('OP', '2026-11-06'), 'ADM');
  assert.equal(C.escalaDe('OP', '2026-11-11'), '4x4');
  assert.equal(C.janela({ op: 'OP', data: '2026-11-05' }), 9);  // ADM 07–17 menos almoço
  assert.equal(C.janela({ op: 'OP', data: '2026-11-11' }), 11); // 4x4 07–19 menos intervalo
});
