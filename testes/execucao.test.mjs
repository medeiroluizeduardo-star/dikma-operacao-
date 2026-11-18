// Apontar por local/equipamento (contas/execucao.js): execução = feitas ÷ previstas, situação do local e ranking por local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoExec, agruparLocais, mesmoLocal, execPorLocal, faixa, fotosDoLocal, chipDoLocal, chaveParecida, locaisParecidos } from '../public/contas/execucao.js';

test('resumo do local: feitas ÷ previstas; feriado, sem programação e extra antiga não entram', () => {
  const r = resumoExec(['R', 'R', 'N', 'P', '_', 'E']);
  assert.equal(r.prev, 4); assert.equal(r.feitas, 2); assert.equal(r.nao, 1); assert.equal(r.pend, 1);
  assert.equal(r.pct, 50); assert.equal(r.apont, 75); assert.equal(r.situ, 'andamento'); assert.equal(r.faixa, 'critico');
});

test('situação do local', () => {
  assert.equal(resumoExec([]).situ, 'vazio'); assert.equal(resumoExec([]).pct, null);
  assert.equal(resumoExec(['P', 'P']).situ, 'afazer');
  assert.equal(resumoExec(['P', 'P'], true).situ, 'atrasado');
  assert.equal(resumoExec(['R', 'R']).situ, 'concluido');
  assert.equal(resumoExec(['R', 'N']).situ, 'fechado');
  assert.equal(resumoExec(['N']).pct, 0);
});

test('faixas de cor', () => {
  assert.equal(faixa(100), 'ok'); assert.equal(faixa(90), 'ok'); assert.equal(faixa(89), 'atencao');
  assert.equal(faixa(70), 'atencao'); assert.equal(faixa(69), 'critico'); assert.equal(faixa(null), '');
});

test('agrupa por local na ordem do plano, sem diferença de maiúsculas', () => {
  const g = agruparLocais([{ local: 'Torre TT1', i: 0 }, { local: 'Correia C5601', i: 1 }, { local: 'TORRE TT1 ', i: 2 }, { local: '', i: 3 }]);
  assert.deepEqual(g.map(x => x.local), ['Torre TT1', 'Correia C5601', 'Sem local']);
  assert.deepEqual(g[0].itens.map(x => x.i), [0, 2]);
  assert.ok(mesmoLocal('torre tt1', 'TORRE TT1 ')); assert.ok(!mesmoLocal('A', 'B'));
});

test('execução por local nos indicadores: só até hoje, pior primeiro', () => {
  const PL = { a: { rota: 'R1', local: 'Torre' }, b: { rota: 'R1', local: 'Torre' }, c: { rota: 'R1', local: 'Correia' } };
  const doc = { ini: '2026-11-16', area: 'PATIO', ids: ['a', 'b', 'c', 'x'], d: ['RRP____', 'RN_____', 'RRRP___', 'RRRRRRR'] };
  const dias = d => Array.from({ length: 7 }, (_, k) => `2026-11-${String(16 + k).padStart(2, '0')}`);
  const l = execPorLocal([doc], pid => PL[pid] || null, dias, '2026-11-18');
  assert.equal(l.length, 2);
  assert.equal(l[0].local, 'Torre'); assert.equal(l[0].prev, 5); assert.equal(l[0].feitas, 3); assert.equal(l[0].pct, 60); assert.equal(l[0].faixa, 'critico');
  assert.equal(l[1].local, 'Correia'); assert.equal(l[1].prev, 3); assert.equal(l[1].pct, 100); // o P de 19/11 é futuro
  assert.equal(execPorLocal([doc], pid => PL[pid] || null, dias, '2026-11-18', { de: '2026-11-17', ate: '2026-11-17' })[0].prev, 2); // Torre: R de a e N de b
});

test('fotos do local = o maior número entre as atividades', () => {
  assert.equal(fotosDoLocal([0, 2, 1]), 2); assert.equal(fotosDoLocal([]), 0);
});

test('dia do local na Programação', () => {
  assert.deepEqual(chipDoLocal(resumoExec([])), { c: 'X', t: '·' });
  assert.deepEqual(chipDoLocal(resumoExec(['R', 'R'])), { c: 'R', t: '✓' });
  assert.deepEqual(chipDoLocal(resumoExec(['R', 'N'])), { c: 'N', t: '✕' });
  assert.deepEqual(chipDoLocal(resumoExec(['P', 'P'], true), true), { c: 'A', t: '!' });
  assert.deepEqual(chipDoLocal(resumoExec(['P', 'P'])), { c: 'P', t: '' });
  assert.deepEqual(chipDoLocal(resumoExec(['R', 'P', 'P'])), { c: 'P', t: '1/3' });
  assert.deepEqual(chipDoLocal(resumoExec(['R', 'P'], true), true), { c: 'A', t: '1/2' });
});

test('locais com nome quase igual na mesma rota', () => {
  const itens = [{ rota: 'R1', local: 'CORREIA C5613A' }, { rota: 'R1', local: 'CORREIA C5613A' }, { rota: 'R1', local: 'Correia C5613 A' }, { rota: 'R2', local: 'Correia c5613-a' }, { rota: 'R1', local: 'Balança' }, { rota: 'R1', local: 'BALANCA' }];
  assert.equal(chaveParecida('Correia C5613 A'), 'CORREIAC5613A');
  const r = locaisParecidos(itens);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { rota: 'R1', chave: 'CORREIAC5613A', nomes: [{ nome: 'CORREIA C5613A', n: 2 }, { nome: 'Correia C5613 A', n: 1 }] });
  assert.equal(r[1].chave, 'BALANCA');
});
