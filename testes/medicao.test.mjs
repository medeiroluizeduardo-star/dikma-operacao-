// Medição do contrato (real × contratado por função): contas/medicao.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDe, chaveFuncao, diasUteis, minutosNoturnos, valorDia, medir, cfgMedicao } from '../public/contas/medicao.js';

test('reconhece a função do cadastro, sem a turma no fim e sem acento', () => {
  assert.equal(chaveFuncao('Executante Turno (B)'), 'EXECUTANTE TURNO');
  assert.equal(baseDe('EXECUTANTE ADM'), 'exec');
  assert.equal(baseDe('AJUDANTE'), 'exec');
  assert.equal(baseDe('OPERADOR DE MINI PÁ (D)'), 'minipa');
  assert.equal(baseDe('Operador de Processo'), 'opproc');
  assert.equal(baseDe('OPERADOR ADM'), 'opproc');
  assert.equal(baseDe('LÍDER'), 'lider');
  assert.equal(baseDe('MOTORISTA'), 'mpres');
  assert.equal(baseDe('Técnico de Segurança do Trabalho'), 'tst');
  assert.equal(baseDe('ALMOXARIFE'), null);
  assert.equal(baseDe('ALMOXARIFE', { ALMOXARIFE: 'artifice' }), 'artifice', 'o administrador liga a função');
  assert.equal(baseDe('MOTORISTA', { MOTORISTA: '' }), null, 'fora da medição');
});

test('dias úteis tiram fim de semana e feriado (novembro de 2026: 19)', () => {
  assert.equal(diasUteis('2026-11', new Set(['2026-11-02', '2026-11-20'])), 19);
  assert.equal(diasUteis('2026-11', null), 21);
});

test('hora extra noturna: só a parte entre 22h e 5h', () => {
  assert.equal(minutosNoturnos('18:00', '23:00'), 60);
  assert.equal(minutosNoturnos('19:00', '07:00'), 7 * 60);
  assert.equal(minutosNoturnos('08:00', '17:00'), 0);
  assert.equal(minutosNoturnos('03:00', '06:00'), 120);
});

test('valor do dia: ADM zera no fim de semana, limita nos postos, coordenador fixo', () => {
  const adm = { reg: 'ADM', postos: 5 }, tur = { reg: 'TURNO', postos: 2 }, coord = { reg: 'ADM', postos: 0.5, fixo: true };
  assert.equal(valorDia(adm, 7, '2026-11-03', '2026-11-16'), 5);
  assert.equal(valorDia(adm, 3, '2026-11-03', '2026-11-16'), 3);
  assert.equal(valorDia(adm, 3, '2026-11-07', '2026-11-16'), 0, 'sábado');
  assert.equal(valorDia(tur, 3, '2026-11-07', '2026-11-16'), 2, 'turno conta no sábado');
  assert.equal(valorDia(coord, 0, '2026-11-03', '2026-11-16'), 0.5);
  assert.equal(valorDia(adm, 3, '2026-11-17', '2026-11-16'), null, 'dia que não chegou');
  assert.equal(valorDia({ reg: 'ADM', postos: 0 }, 4, '2026-11-03', '2026-11-16'), 4, 'sem postos conta todos');
});

test('medição do mês: real, diferença, acima do contratado, horas extras e faltas', () => {
  const pessoas = [
    { id: 'a', nome: 'A', funcao: 'EXECUTANTE ADM' }, { id: 'b', nome: 'B', funcao: 'EXECUTANTE ADM' }, { id: 'c', nome: 'C', funcao: 'EXECUTANTE ADM' },
    { id: 't', nome: 'T', funcao: 'EXECUTANTE TURNO (A)' }, { id: 'x', nome: 'X', funcao: 'ALMOXARIFE' }
  ];
  const sit = { 'b|2026-11-03': 'FT' };
  const r = medir({
    m: '2026-11', pessoas, hoje: '2026-11-04', feriados: new Set(['2026-11-02', '2026-11-20']),
    sitDe: (c, d) => sit[c.id + '|' + d] || 'P', regDe: c => (c.id === 't' ? 'TURNO' : 'ADM'),
    he: [{ c: pessoas[3], d: '2026-11-03', conta: 3, det: { ini: '20:00', fim: '23:00' } }],
    cfg: { refTurno: 16, n: { 'exec|ADM': { postos: 2, cont: 2 }, 'exec|TURNO': { postos: 1, cont: 2 } } }
  });
  const adm = r.linhas.find(l => l.id === 'exec|ADM'), tur = r.linhas.find(l => l.id === 'exec|TURNO');
  // dias 1 (dom) = 0; 2 (seg) 3 presentes → 2; 3 (ter) 2 presentes → 2; 4 (qua) 3 → 2 → soma 6 / 19 dias úteis
  assert.equal(adm.soma, 6); assert.equal(adm.real, Math.round(6 / 19 * 100) / 100); assert.equal(adm.acima, 2);
  assert.equal(adm.faltas, 1); assert.equal(adm.pessoas, 3);
  // turno: 4 dias com 1 presente (postos 1) = 4 / 16
  assert.equal(tur.soma, 4); assert.equal(tur.real, 0.25); assert.equal(tur.dif, -1.75);
  assert.equal(tur.he, 3); assert.equal(tur.hen, 1);
  assert.deepEqual(r.semLinha, [{ funcao: 'ALMOXARIFE', nome: 'ALMOXARIFE', n: 1 }]);
  assert.ok(r.linhas.some(l => l.id === 'coord|ADM') === false, 'coordenador sem número não aparece');
  assert.equal(r.refAdm, 19);
});

test('configuração inválida vira zero e o turno usa 16 dias', () => {
  const c = cfgMedicao({ refTurno: 'x', n: { 'exec|ADM': { postos: '-3', cont: '2,5' } } });
  assert.equal(c.refTurno, 16); assert.deepEqual(c.n['exec|ADM'], { postos: 0, cont: 2.5 });
});
