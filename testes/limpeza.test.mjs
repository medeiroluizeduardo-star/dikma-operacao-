// Testes das contas da Limpeza de dados (public/contas/limpeza.js): a dispensa das pendências antigas não pode virar
// "não realizada", nem entrar no programado, e as atrasadas caem exatamente o previsto. Não precisa do emulador:
// node --test testes/limpeza.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as LP from '../public/contas/limpeza.js';
import { add } from '../public/contas/cal.js';
import { listaAtrasadas, resumoSemana, resumoAtividades, inicioAtrasadas } from '../public/contas/hoje.js';
import { listarAprov, estadoAprov } from '../public/contas/aprovacao.js';
import { fotosDoReg } from '../public/contas/segcalc.js';

const HOJE = '2026-11-03'; // terça-feira
const AREA = 'RECEBIMENTO';
const SEMANAS_INI = ['2026-08-24', '2026-08-31', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'];
// Cada semana: A sempre programada de segunda a sexta (alguns dias apontados), B programada só na quarta e C nunca.
function semana(ini, i) {
  const s = { A: ['RNPPP__', 'RRRRR__', 'PPPPP__', 'RNPRE__', 'PRPRP__', 'PPRRN__', 'RRPPP__', 'RPPPP__'][i], B: '__P____', C: '____E__' };
  return { id: `${AREA}|${ini}`, area: AREA, ini, mes: LP.mesDaData(add(ini, 3)), ids: ['A', 'B', 'C'], s, m: {} };
}
const base = () => Object.fromEntries(SEMANAS_INI.map((ini, i) => { const d = semana(ini, i); return [d.id, d]; }));
// aplica o plano como o banco faria (s e dx)
function aplicar(semanas, plano) { const out = structuredClone(semanas); for (const x of plano) LP.aplicarCampos(out[x.id], x.campos); return out; }
const contaAtr = sem => listaAtrasadas(sem, { areas: [AREA], hoje: HOJE }).length;

test('dispensa: só as atividades P até a data (inclusive) e antes de hoje; R, N, E e sem programação não mudam', () => {
  const sem = base(); const ate = '2026-10-14';
  const plano = LP.planoDispensa(Object.values(sem), { ate, hoje: HOJE, em: HOJE });
  for (const x of plano) for (const c of x.cel) { assert.ok(c.dt <= ate, c.dt); assert.equal(sem[x.id].s[c.pid][c.k], 'P'); }
  const depois = aplicar(sem, plano);
  for (const id of Object.keys(sem)) for (const pid of ['A', 'B', 'C']) for (let k = 0; k < 7; k++) {
    const a = sem[id].s[pid][k], b = depois[id].s[pid][k]; const dt = add(sem[id].ini, k);
    if (a === 'P' && dt <= ate) { assert.equal(b, '_'); assert.equal(depois[id].dx[pid + '|' + k], HOJE); assert.ok(LP.dispensada(depois[id], pid, k)); }
    else { assert.equal(b, a, `${id} ${pid} ${k}`); assert.ok(!LP.dispensada(depois[id], pid, k)); }
  }
  // as semanas depois da data nem aparecem no plano
  assert.ok(plano.every(x => x.ini <= ate));
});

test('dispensa: data no futuro ou hoje vale só até ontem', () => {
  const sem = base();
  const plano = LP.planoDispensa(Object.values(sem), { ate: '2026-12-31', hoje: HOJE });
  const cels = plano.flatMap(x => x.cel);
  assert.ok(cels.length > 0);
  assert.ok(cels.every(c => c.dt < HOJE), 'nunca hoje nem futuro');
  const todas = Object.values(sem).reduce((n, d) => n + d.ids.reduce((m, pid) => m + [...d.s[pid]].filter((c, k) => c === 'P' && add(d.ini, k) < HOJE).length, 0), 0);
  assert.equal(cels.length, todas, 'todas as P de dias que já passaram, até ontem');
});

test('atrasadas caem exatamente o previsto (menu, Pendências e Meu dia usam a mesma conta)', () => {
  const sem = base();
  for (const ate of ['2026-08-30', '2026-09-03', '2026-10-01', '2026-10-14', '2026-10-30', add(HOJE, -1)]) {
    const plano = LP.planoDispensa(Object.values(sem), { ate, hoje: HOJE });
    const previsto = LP.atrasadasNoPlano(plano, HOJE);
    const depois = aplicar(sem, plano);
    assert.equal(contaAtr(sem) - contaAtr(depois), previsto, `até ${ate}`);
    // as atrasadas que ficam são todas depois da data
    assert.ok(listaAtrasadas(depois, { areas: [AREA], hoje: HOJE }).every(x => x.dt > ate));
  }
  // antes da janela de 60 dias: muda o programado das semanas antigas, mas não as atrasadas de hoje
  const velho = LP.planoDispensa(Object.values(sem), { ate: add(inicioAtrasadas(HOJE), -1), hoje: HOJE });
  assert.ok(velho.flatMap(x => x.cel).length > 0);
  assert.equal(LP.atrasadasNoPlano(velho, HOJE), 0);
  assert.equal(contaAtr(aplicar(sem, velho)), contaAtr(sem));
  // até ontem: nenhuma atrasada sobra
  assert.equal(contaAtr(aplicar(sem, LP.planoDispensa(Object.values(sem), { ate: add(HOJE, -1), hoje: HOJE }))), 0);
});

test('dispensada não vira não realizada nem entra no programado; semanas recentes não mudam', () => {
  const sem = base(); const ate = '2026-10-14';
  const depois = aplicar(sem, LP.planoDispensa(Object.values(sem), { ate, hoje: HOJE }));
  const d = { areas: [AREA], semanas: sem, colabs: [], sit: {} };
  const d2 = { ...d, semanas: depois };
  for (const ini of SEMANAS_INI) {
    const a = resumoSemana(d, ini), b = resumoSemana(d2, ini);
    assert.equal(b.R, a.R, 'realizadas iguais'); assert.equal(b.N, a.N, 'não realizadas iguais'); assert.equal(b.E, a.E, 'extras iguais');
    if (add(ini, 6) <= ate) { assert.equal(b.P, 0, 'sem pendência na semana toda dispensada'); assert.equal(b.prog, a.R + a.N, 'programado = realizadas + não realizadas'); }
    if (ini > ate) assert.deepEqual(b, a, `semana ${ini} (depois da data) não muda`);
  }
  // o "hoje" do Meu dia (semana atual) não muda
  const plano = [{ id: 'A', area: AREA, rota: 'R1' }, { id: 'B', area: AREA, rota: 'R1' }, { id: 'C', area: AREA, rota: 'R2' }];
  const r1 = resumoAtividades({ ...d, plano, rotas: [], hoje: HOJE }), r2 = resumoAtividades({ ...d2, plano, rotas: [], hoje: HOJE });
  assert.deepEqual(r2.hoje, r1.hoje); assert.deepEqual(r2.rotas, r1.rotas);
  assert.equal(r2.atrasadas, listaAtrasadas(depois, { areas: [AREA], hoje: HOJE }).length);
});

test('aprovação: a dispensa não cria nada para aprovar e tira da lista a devolvida que ficou parada', () => {
  // a semana de 26/10 tem uma atividade devolvida pelo supervisor (voltou a P) e uma realizada esperando aprovação
  const sem = base(); const id = `${AREA}|2026-10-26`;
  sem[id].s.A = 'RRPPP__';
  const aprov = { [id]: { 'A|2': { s: 'D', c: 'P', ant: 'R', mot: 'sem foto' } } };
  // a tela guarda a linha também em d (como o data.js monta)
  const comD = x => Object.fromEntries(Object.entries(x).map(([k, d]) => [k, { ...d, d: d.ids.map(p => d.s[p]) }]));
  const antes = listarAprov(comD(sem), aprov, [AREA], HOJE);
  const depois = aplicar(sem, LP.planoDispensa(Object.values(sem), { ate: '2026-10-28', hoje: HOJE }));
  const l = listarAprov(comD(depois), aprov, [AREA], HOJE);
  assert.equal(l.pend.length, antes.pend.length, 'nada novo esperando aprovação');
  assert.ok(antes.dev.some(x => x.pid === 'A' && x.k === 2));
  assert.ok(!l.dev.some(x => x.pid === 'A' && x.k === 2), 'a devolvida dispensada sai da lista');
  assert.equal(estadoAprov('_', '2026-10-28', aprov[id]['A|2'], HOJE), null);
});

test('marca da dispensa: some se a atividade for programada de novo (fora da programação) ou apontada', () => {
  const doc = { id: 'x', ini: '2026-10-05', ids: ['A'], s: { A: '_RRRR__' }, dx: { 'A|0': HOJE } };
  assert.ok(LP.dispensada(doc, 'A', 0));
  assert.ok(!LP.dispensada({ ...doc, s: { A: 'PRRRR__' } }, 'A', 0));
  assert.ok(!LP.dispensada({ ...doc, s: { A: 'ERRRR__' } }, 'A', 0));
  // também com a linha da tela (d) em vez de s
  assert.ok(LP.dispensada({ ids: ['A'], d: ['_RRRR__'], dx: { 'A|0': HOJE } }, 'A', 0));
  // planoDispensa não mexe em quem já está dispensado
  assert.equal(LP.planoDispensa([doc], { ate: '2026-10-31', hoje: HOJE }).length, 0);
});

test('mês atual e o próximo ficam protegidos; os outros podem ser apagados', () => {
  assert.equal(LP.mesDaData(HOJE), '2026-11');
  assert.ok(LP.mesProtegido('2026-11', HOJE)); assert.ok(LP.mesProtegido('2026-12', HOJE));
  assert.ok(!LP.mesProtegido('2026-10', HOJE)); assert.ok(!LP.mesProtegido('2027-01', HOJE));
  // a semana de 28/12/2026 a 03/01/2027 é de dezembro (quinta 31/12); 01/01/2027 ainda conta como dezembro
  assert.ok(LP.mesProtegido('2027-01', '2026-12-31')); assert.ok(LP.mesProtegido('2026-12', '2027-01-01'));
});

test('contar semanas de um mês: semanas e apontamentos', () => {
  const sem = Object.values(base());
  const c = LP.contarSemanas(sem.slice(0, 2));
  assert.equal(c.semanas, 2);
  // RNPPP + B(P) + C(E) e RRRRR + B(P) + C(E): apontamentos = R, N e E
  assert.equal(c.apont, 2 + 1 + 5 + 1);
});

test('Segurança: anomalias em aberto ficam fora sem a marca; fotos do registro e do depois vão junto', () => {
  const regs = [
    { id: 'a1', status: 'concluida', fotos: ['f1', 'f2'], trat: { fotoDepois: 'f3' } },
    { id: 'a2', status: 'aberta', fotos: ['f4'] },
    { id: 'a3', status: 'tratamento', fotos: [] }
  ];
  const p = LP.planoSeg(regs, { anom: true });
  assert.deepEqual(p.regs.map(r => r.id), ['a1']); assert.deepEqual(p.fotos, ['f1', 'f2', 'f3']);
  const t = LP.planoSeg(regs, { anom: true, incluirAbertas: true });
  assert.equal(t.regs.length, 3); assert.deepEqual(t.fotos, ['f1', 'f2', 'f3', 'f4']);
  assert.equal(LP.planoSeg([{ id: 'i1', fotos: ['x'] }]).regs.length, 1, 'interações entram todas');
  assert.deepEqual(fotosDoReg({ fotos: ['a', 'a'], trat: { fotoDepois: '' } }), ['a']);
});

test('lotes de até 400 e o que faltou depois de um erro', () => {
  const ops = Array.from({ length: 950 }, (_, i) => ({ tipo: 'apagar', col: 'x', id: 'd' + i, grupo: i < 500 ? 'G1' : 'G2' }));
  const l = LP.emLotes(ops);
  assert.deepEqual(l.map(x => x.length), [400, 400, 150]);
  assert.deepEqual(LP.faltou(ops, 400), [['G1', 100], ['G2', 450]]);
  assert.deepEqual(LP.mesesEntre('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(LP.mesesEntre('', '2026-05'), ['2026-05']);
  assert.equal(LP.linhaHistorico(['a', '', 'b']), 'Limpeza de dados: a; b');
});

test('aplicarCampos: caminho com mapa e null apaga o campo', () => {
  const d = { s: { A: 'P' }, meses: ['1', '2'], dx: { 'A|0': 'x' } };
  LP.aplicarCampos(d, [[['s', 'A'], '_'], [['dx', 'A|1'], 'y'], [['dx', 'A|0'], null], [['meses'], ['2']]]);
  assert.deepEqual(d, { s: { A: '_' }, meses: ['2'], dx: { 'A|1': 'y' } });
});
