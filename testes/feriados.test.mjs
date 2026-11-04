// Testes das atividades em feriado sem operação (public/feriados.js): aplicar e desfazer, sem gravar duas vezes,
// sem mexer no que já foi apontado, feriado com operação não conta e vale para todas as áreas e conjuntos.
// Não precisa do emulador: node --test testes/feriados.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as FE from '../public/feriados.js';
import { add, SETS } from '../public/cal.js';
import { listaAtrasadas } from '../public/hoje.js';

const HOJE = '2026-11-04'; // quarta-feira
const SEG = '2026-11-02'; // Finados (segunda-feira)
const ESC = { feriados: [{ data: SEG, desc: 'Finados' }, { data: '2026-11-20', desc: 'Consciência Negra' }, { data: '2026-11-03', desc: 'Ponto facultativo', semOp: false }] };
const FER = FE.mapaFeriados(ESC, null);
// Semana de 02/11 de uma área: A programada seg a sex (seg realizada), B seg a sex sem apontar, C só no sábado,
// D extra na segunda, E incluída fora da programação na segunda.
function semana(area, ini = SEG) {
  return { id: `${area}|${ini}`, area, ini, mes: '2026-11', ids: ['A', 'B', 'C', 'D', 'E'],
    s: { A: 'RPPPP__', B: 'PPPPP__', C: '_____P_', D: 'E______', E: 'P______' }, m: {}, fp: { 'E|0': { por: 'x' } } };
}
const todas = () => Object.fromEntries(Object.values(SETS).flatMap(c => c.areas).map(a => { const d = semana(a); return [d.id, d]; }));
const aplicar = (sem, plano) => { const out = structuredClone(sem); for (const x of plano) FE.aplicarCamposFer(out[x.id], x.campos); return out; };

test('mapa: feriado sem operação entra; "com operação" (semOp false) não', () => {
  assert.equal(FER.get(SEG), 'Finados');
  assert.ok(!FER.has('2026-11-03'));
  // os "sem operação" da Operação (eq/config) também valem; os com operação não
  const m = FE.mapaFeriados({}, { feriados: [{ data: '2026-12-25', desc: 'Natal', semOp: true }, { data: '2026-12-24', desc: 'Véspera', semOp: false }] });
  assert.deepEqual([...m.keys()], ['2026-12-25']);
});

test('aplicar: só as P do feriado viram "_" com a marca; R, N, E, fora da programação e outros dias não mudam', () => {
  const sem = todas();
  const plano = FE.planoFeriados(Object.values(sem), FER);
  assert.equal(plano.length, 8, 'as 4 áreas do Pátio e as 4 da Bateria');
  const depois = aplicar(sem, plano);
  for (const d of Object.values(depois)) {
    assert.equal(d.s.A, 'RPPPP__', 'realizada no feriado continua realizada');
    assert.equal(d.s.B, '_PPPP__');
    assert.equal(d.s.C, '_____P_');
    assert.equal(d.s.D, 'E______');
    assert.equal(d.s.E, 'P______', 'incluída fora da programação continua');
    assert.deepEqual(d.fe, { 'B|0': 'Finados' });
    assert.equal(FE.feriadoDaCelula(d, 'B', 0), 'Finados');
    assert.equal(FE.feriadoDaCelula(d, 'A', 0), '');
  }
  assert.deepEqual(FE.contarPlano(plano), { feriado: 8, volta: 0, outras: 0, semanas: 8 });
});

test('idempotente: aplicar de novo não grava nada', () => {
  const sem = todas();
  const depois = aplicar(sem, FE.planoFeriados(Object.values(sem), FER));
  assert.deepEqual(FE.planoFeriados(Object.values(depois), FER), []);
});

test('desfazer: feriado removido ou "com operação" devolve a P e tira a marca', () => {
  const sem = todas();
  const com = aplicar(sem, FE.planoFeriados(Object.values(sem), FER));
  for (const esc of [{ feriados: [] }, { feriados: [{ data: SEG, desc: 'Finados', semOp: false }] }]) {
    const fer = FE.mapaFeriados(esc, null);
    const plano = FE.planoFeriados(Object.values(com), fer);
    assert.equal(FE.contarPlano(plano).volta, 8);
    const volta = aplicar(com, plano);
    for (const id of Object.keys(sem)) { assert.deepEqual(volta[id].s, sem[id].s); assert.deepEqual(volta[id].fe, {}); }
    assert.deepEqual(FE.planoFeriados(Object.values(volta), fer), [], 'e desfazer de novo não grava nada');
  }
  // sem poder ler todos os feriados (desfazer: false), nada volta
  assert.deepEqual(FE.planoFeriados(Object.values(com), new Map(), { desfazer: false }), []);
});

test('desfazer: célula apontada depois (incluída fora da programação) só perde a marca', () => {
  const sem = { x: { ...semana('RECEBIMENTO'), id: 'x' } };
  const com = aplicar(sem, FE.planoFeriados(Object.values(sem), FER));
  com.x.s.B = 'RPPPP__'; // o coordenador incluiu e o líder apontou
  assert.deepEqual(FE.planoFeriados(Object.values(com), FER), [], 'enquanto é feriado, nada muda');
  const plano = FE.planoFeriados(Object.values(com), new Map());
  assert.deepEqual(plano[0].cel.map(c => c.acao), ['marca']);
  const volta = aplicar(com, plano);
  assert.equal(volta.x.s.B, 'RPPPP__'); assert.deepEqual(volta.x.fe, {});
});

test('descrição do feriado mudou: só a marca é atualizada', () => {
  const sem = { x: { ...semana('CDQ'), id: 'x' } };
  const com = aplicar(sem, FE.planoFeriados(Object.values(sem), FER));
  const fer2 = new Map([[SEG, 'Dia de Finados']]);
  const plano = FE.planoFeriados(Object.values(com), fer2);
  assert.deepEqual(plano[0].campos, [[['fe', 'B|0'], 'Dia de Finados']]);
});

test('devolvida ao líder no feriado fica como está', () => {
  const sem = { x: { ...semana('TRILHO'), id: 'x' } };
  const plano = FE.planoFeriados(Object.values(sem), FER, { aprov: { x: { 'B|0': { s: 'D', c: 'P', ant: 'R' } } } });
  assert.deepEqual(plano, []);
});

test('atrasadas, pendências e Meu dia caem exatamente as P do feriado antes de hoje', () => {
  const sem = todas();
  const areas = Object.values(SETS).flatMap(c => c.areas);
  const antes = listaAtrasadas(sem, { areas, hoje: HOJE }).length;
  const depois = aplicar(sem, FE.planoFeriados(Object.values(sem), FER));
  assert.equal(antes - listaAtrasadas(depois, { areas, hoje: HOJE }).length, 8);
  assert.ok(listaAtrasadas(depois, { areas, hoje: HOJE }).every(x => x.dt !== SEG || x.doc.ids[x.i] === 'E'), 'no feriado, só a incluída fora da programação');
});

test('feriado no futuro e semanas sem feriado', () => {
  const ini = '2026-11-16';
  const sem = { a: { ...semana('BATERIA 1', ini), id: 'a', fp: {} }, b: { ...semana('BATERIA 2', '2026-11-09'), id: 'b' } };
  const plano = FE.planoFeriados(Object.values(sem), FER);
  assert.equal(plano.length, 1, 'só a semana do dia 20');
  assert.deepEqual(plano[0].cel.map(c => `${c.pid}|${c.k}|${c.dt}`), ['A|4|2026-11-20', 'B|4|2026-11-20']);
});

test('gerador de meses: semana nova já sai marcada', () => {
  const w = { area: 'PREPARAÇÃO', ini: SEG, mes: '2026-11', ids: ['A', 'B'], s: { A: 'PPPPP__', B: '__P____' }, m: {} };
  assert.equal(FE.aplicarNaSemana(w, FER), 1);
  assert.deepEqual(w.s, { A: '_PPPP__', B: '__P____' }); assert.deepEqual(w.fe, { 'A|0': 'Finados' });
  assert.equal(FE.aplicarNaSemana(w, FER), 0);
});

test('resumo por feriado, conjunto e área', () => {
  const sem = todas();
  const r = FE.resumoPorFeriado([{ conj: 'patio', plano: FE.planoFeriados(Object.values(sem).filter(d => SETS.patio.areas.includes(d.area)), FER) },
    { conj: 'bateria', plano: FE.planoFeriados(Object.values(sem).filter(d => SETS.bateria.areas.includes(d.area)), FER) }]);
  assert.equal(r.length, 8);
  assert.ok(r.every(x => x.dt === SEG && x.desc === 'Finados' && x.feriado === 1));
  assert.equal(FE.assinaturaFeriados(FER), '2026-11-02=Finados;2026-11-20=Consciência Negra');
});
