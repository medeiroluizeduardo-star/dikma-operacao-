// Segurança › Inspeções: contas sem tela (public/contas/inspecoes.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_INSP, itensNovos, notaInsp, faixaNota, naoOk, semAnomalia, faltaInsp, anomDaInsp, resumoInsp } from '../public/contas/inspecoes.js';

const it = (...rs) => rs.map((r, k) => ({ t: 'Item ' + k + ': detalhe', r, obs: r === 'no' ? 'fora' : '' }));

test('tipos: 5S, segurança e área com 5 itens cada; itens novos em branco', () => {
  assert.deepEqual(Object.keys(TIPOS_INSP), ['s5', 'seg', 'area']);
  for (const k of Object.keys(TIPOS_INSP)) assert.equal(TIPOS_INSP[k].itens.length, 5);
  assert.deepEqual(itensNovos('seg')[0], { t: TIPOS_INSP.seg.itens[0], r: '', obs: '' });
  assert.deepEqual(itensNovos('xx'), []);
});

test('nota: OK ÷ (OK + Não OK); N/A não conta; sem avaliação = null', () => {
  assert.equal(notaInsp(it('ok', 'ok', 'ok', 'no', 'na')), 75);
  assert.equal(notaInsp(it('ok', 'ok', 'ok')), 100);
  assert.equal(notaInsp(it('na', 'na')), null);
  assert.equal(notaInsp(null), null);
  assert.equal(notaInsp(it('ok', 'no', 'no')), 33);
  assert.equal(faixaNota(90), 'ok'); assert.equal(faixaNota(89), 'warn'); assert.equal(faixaNota(69), 'bad'); assert.equal(faixaNota(null), 'neu');
});

test('Não OK e os que ainda não viraram anomalia', () => {
  const l = it('no', 'ok', 'no'); l[0].anom = 'a1';
  assert.equal(naoOk(l).length, 2);
  assert.deepEqual(semAnomalia(l).map(i => i.t), ['Item 2: detalhe']);
});

test('o que falta para salvar', () => {
  const base = { tipo: 's5', data: '2026-11-17', area: 'PÁTIO DE CARVÃO', local: 'CORREIA C1', itens: it('ok', 'ok') };
  assert.deepEqual(faltaInsp(base, '2026-11-17'), []);
  assert.match(faltaInsp({ ...base, data: '2026-11-18' }, '2026-11-17').join(), /futuro/);
  assert.match(faltaInsp({ ...base, local: ' ' }).join(), /local/);
  assert.match(faltaInsp({ ...base, area: '' }).join(), /área/);
  assert.match(faltaInsp({ ...base, tipo: 'x' }).join(), /tipo/);
  assert.match(faltaInsp({ ...base, itens: [...it('ok'), { t: 'a', r: '' }, { t: 'b', r: '' }] }).join(), /Faltam responder 2 itens/);
  assert.match(faltaInsp({ ...base, itens: [{ t: 'a', r: 'no', obs: '' }] }).join(), /fora do padrão/);
});

test('anomalia do item Não OK: formato da fila (aberta, campos obrigatórios preenchidos, id da inspeção)', () => {
  const insp = { id: 'p1', tipo: 'seg', data: '2026-11-17', area: 'BATERIA', conj: 'bateria', local: 'topo da bateria 1' };
  const a = anomDaInsp(insp, { t: 'EPIs corretos e em bom estado', r: 'no', obs: 'Luva rasgada' }, { hora: '09:15', regime: 'TURNO', comunic: 'TÉCNICO', mat: '123' });
  assert.equal(a.status, 'aberta'); assert.equal(a.insp, 'p1'); assert.equal(a.mes, '2026-11'); assert.equal(a.local, 'TOPO DA BATERIA 1');
  assert.equal(a.conj, 'bateria'); assert.equal(a.hora, '09:15'); assert.equal(a.regime, 'TURNO'); assert.equal(a.mat, '123');
  assert.match(a.desc, /Luva rasgada.*Segurança: EPIs/);
  for (const k of ['desc', 'conseq', 'acao', 'causas', 'sugest', 'comunic']) assert.ok(a[k].length >= 1 && a[k].length <= 3000, k);
  assert.ok(!('trat' in a), 'o tratamento é definido depois, na fila');
});

test('resumo do mês: quantas, nota média por tipo, Não OK e anomalias', () => {
  const l = [
    { mes: '2026-11', tipo: 's5', itens: it('ok', 'no') },
    { mes: '2026-11', tipo: 's5', itens: it('ok', 'ok') },
    { mes: '2026-11', tipo: 'seg', itens: [{ t: 'x', r: 'no', anom: 'a1' }] },
    { mes: '2026-10', tipo: 's5', itens: it('no') }
  ];
  const r = resumoInsp(l, '2026-11');
  assert.equal(r.n, 3); assert.equal(r.porTipo.s5.n, 2); assert.equal(r.porTipo.s5.media, 75); assert.equal(r.porTipo.seg.media, 0);
  assert.equal(r.porTipo.area.media, null); assert.equal(r.naoOk, 2); assert.equal(r.anomalias, 1); assert.equal(r.media, 50);
});
