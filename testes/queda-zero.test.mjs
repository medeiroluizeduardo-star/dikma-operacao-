// Testes das contas da Queda zero (public/contas/queda-zero.js): tabela de fatores, resultado (fator × quantidade),
// leitura do formulário e textos. Não precisa do emulador: node --test testes/queda-zero.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Q from '../public/contas/queda-zero.js';

test('Queda zero: fatores da tabela da operação', () => {
  const t = { retro: [0.5, 0.6], bobcat: [0.2, 0.4], cacamba: [9, 12], carrinho: [0.05, 0.07], balde: [0.003, 0.003], pa: [0.008, 0.009] };
  for (const [e, [c, v]] of Object.entries(t)) { assert.equal(Q.fatorQZ(e, 'coque'), c, e); assert.equal(Q.fatorQZ(e, 'carvao'), v, e); }
  assert.equal(Q.fatorQZ('x', 'coque'), null);
  assert.equal(Q.fatorQZ('pa', 'minerio'), null);
});
test('Queda zero: resultado = fator × quantidade, sem erro de arredondamento', () => {
  assert.equal(Q.resultadoQZ('carrinho', 'coque', 3), 0.15);
  assert.equal(Q.resultadoQZ('cacamba', 'carvao', 2), 24);
  assert.equal(Q.resultadoQZ('pa', 'carvao', 0), 0);
});
test('Queda zero: lê o formulário (vírgula, linhas vazias, erros) e soma', () => {
  const r = Q.calcQZ([{ e: 'cacamba', p: 'coque', q: '2' }, { e: 'pa', p: 'carvao', q: '2,5' }, { e: '', p: 'coque', q: '' }]);
  assert.equal(r.erro, '');
  assert.deepEqual(r.itens, [{ e: 'cacamba', p: 'coque', q: 2 }, { e: 'pa', p: 'carvao', q: 2.5 }]);
  assert.equal(r.t, 18.0225);
  assert.deepEqual(Q.valorQZ(r), { i: r.itens, t: 18.0225 });
  assert.equal(Q.valorQZ(Q.calcQZ([{ e: 'pa', p: 'coque', q: '' }])), null, 'nada preenchido = sem registro');
  assert.match(Q.calcQZ([{ e: '', p: 'coque', q: '1' }]).erro, /equipamento/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: '-1' }]).erro, /maior que zero/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: 'abc' }]).erro, /maior que zero/);
  assert.match(Q.calcQZ([{ e: 'pa', p: 'coque', q: '100000' }]).erro, /até/);
});
test('Queda zero: textos e registro da célula', () => {
  assert.equal(Q.fmtT(18.0225), '18,023 t');
  assert.equal(Q.fmtT(0.15), '0,15 t (150 kg)');
  assert.equal(Q.textoQZ({ i: [{ e: 'cacamba', p: 'coque', q: 2 }, { e: 'pa', p: 'carvao', q: 2.5 }], t: 18.0225 }), '2 × Caçamba de caminhão (coque) + 2,5 × Pá (carvão)');
  const doc = { qz: { 'REC-001|2': { i: [], t: 1 } } };
  assert.deepEqual(Q.qzDaCel(doc, 'REC-001', 2), { i: [], t: 1 });
  assert.equal(Q.qzDaCel(doc, 'REC-001', 3), null);
  assert.equal(Q.qzDaCel({}, 'REC-001', 2), null);
});
test('Queda zero: lançamentos do dia (novos e antigos, da atividade) e total', () => {
  const k1 = Q.chaveNovaQZ(2, 1000, 0.5), k2 = Q.chaveNovaQZ(2, 2000, 0.1);
  assert.match(k1, /^Z\|2\|[0-9a-z]+$/);
  const doc = { qz: { [k2]: { i: [], t: 2 }, [k1]: { i: [], t: 1.5 }, 'REC-001|2': { i: [], t: 0.25 }, 'REC-001|3': { i: [], t: 9 }, [Q.chaveNovaQZ(3, 5)]: { i: [], t: 7 } } };
  const l = Q.qzDoDia(doc, 2);
  assert.deepEqual(l.map(x => x.key), ['REC-001|2', k1, k2], 'antigos primeiro, depois na ordem em que foram lançados');
  assert.equal(l[0].pid, 'REC-001');
  assert.equal(l[1].pid, undefined);
  assert.equal(Q.totalDiaQZ(doc, 2), 3.75);
  assert.equal(Q.totalDiaQZ(doc, 3), 16);
  assert.deepEqual(Q.qzDoDia({}, 2), []);
});
test('Queda zero: fotos do lançamento (atividade QZ-… e contagem f)', () => {
  assert.equal(Q.pidFotoQZ('Z|2|0000abcde00'), 'QZ-0000abcde00');
  assert.equal(Q.pidFotoQZ('REC-001|2'), 'QZ-REC-001');
  assert.ok(!Q.pidFotoQZ('Z|2|abc').includes('|'), 'sem | (a ref da foto é semana|pid|k)');
  assert.ok(Q.ehFotoQZ('QZ-abc') && !Q.ehFotoQZ('REC-001'));
  assert.equal(Q.fotosQZ({ f: 2 }), 2);
  assert.equal(Q.fotosQZ({}), 0);
  assert.equal(Q.fotosQZ(null), 0);
  assert.equal(Q.fotosQZ({ f: -1 }), 0);
});
test('Queda zero: listas de locais e motivos, sem repetir, e nomes novos', () => {
  const chaves = l => new Set(l.map(Q.chaveNomeQZ)).size;
  assert.equal(chaves(Q.QZ_LOCAIS), Q.QZ_LOCAIS.length, 'locais sem repetição');
  assert.equal(chaves(Q.QZ_MOTIVOS), Q.QZ_MOTIVOS.length, 'motivos sem repetição');
  assert.ok(Q.QZ_LOCAIS.includes('SR205') && Q.QZ_LOCAIS.includes('TECO TECO'));
  assert.equal(Q.chaveNomeQZ('SR 205'), Q.chaveNomeQZ('sr205'));
  assert.deepEqual(Q.listaQZ(['C1', 'C2'], ['Zeta', 'c 1', 'Alfa', 'Alfa ']), ['C1', 'C2', 'Alfa', 'Zeta']);
  assert.deepEqual(Q.novoNomeQZ('  sr 205 ', Q.QZ_LOCAIS), { nome: 'SR205', existe: true, erro: '' });
  assert.deepEqual(Q.novoNomeQZ('Vazamento  de  óleo', Q.QZ_MOTIVOS), { nome: 'Vazamento de óleo', existe: false, erro: '' });
  assert.match(Q.novoNomeQZ('x', []).erro, /pelo menos/);
  assert.match(Q.novoNomeQZ('x'.repeat(41), []).erro, /muito grande/);
});

test('painel do mês: lançamentos só dos dias do mês e somas por local, motivo, área e equipamento', async () => {
  const { lancamentosMesQZ, resumoQZ } = await import('../public/contas/queda-zero.js');
  // semana de 27/10 a 02/11 marcada como de novembro: só 01 e 02 contam em novembro
  const w1 = { area: 'RECEBIMENTO', ini: '2026-10-27', mes: '2026-11', qz: {
    'Z|0|a': { i: [{ e: 'pa', p: 'coque', q: 10 }], t: 0.08, l: 'C5601', m: 'Chuva' }, // 27/10: fora
    'Z|5|b': { i: [{ e: 'cacamba', p: 'carvao', q: 1 }], t: 12, l: 'C5601', m: 'Transbordo' }, // 01/11
    'Z|6|c': { i: [{ e: 'bobcat', p: 'coque', q: 2 }, { e: 'balde', p: 'carvao', q: 10 }], t: 0.43 } // 02/11, sem local/motivo
  } };
  const w2 = { area: 'PREPARAÇÃO', ini: '2026-11-03', mes: '2026-11', qz: { 'Z|0|d': { i: [{ e: 'retro', p: 'coque', q: 4 }], t: 2, l: 'BC211', m: 'Chuva' }, 'Z|1|e': null } };
  const outro = { area: 'RECEBIMENTO', ini: '2026-12-01', mes: '2026-12', qz: { 'Z|0|f': { i: [], t: 99 } } };
  const l = lancamentosMesQZ([w1, w2, outro, null], '2026-11');
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(x => x.dt), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.equal(lancamentosMesQZ([w1, w2], '2026-11', 'PREPARAÇÃO').length, 1);
  const r = resumoQZ(l);
  assert.equal(r.total, 14.43); assert.equal(r.n, 3); assert.equal(r.dias, 3); assert.equal(r.media, 4.81);
  assert.equal(r.coque, 2.4); assert.equal(r.carvao, 12.03);
  assert.deepEqual(r.porLocal, [['C5601', 12, 1], ['BC211', 2, 1], ['Não informado', 0.43, 1]]);
  assert.deepEqual(r.porMotivo[0], ['Transbordo', 12, 1]);
  assert.deepEqual(r.porArea, [['RECEBIMENTO', 12.43, 2], ['PREPARAÇÃO', 2, 1]]);
  assert.equal(r.porEquip[0][0], 'Caçamba de caminhão');
  assert.deepEqual(resumoQZ([]), { ...resumoQZ([]), total: 0, n: 0, dias: 0, media: 0 });
});

test('resumo por dia ou semana: lançamentos só da faixa de datas, de qualquer semana carregada', async () => {
  const { lancamentosFaixaQZ } = await import('../public/contas/queda-zero.js');
  const w1 = { area: 'RECEBIMENTO', ini: '2026-10-26', mes: '2026-10', qz: {
    'Z|0|a': { i: [], t: 1 }, // 26/10
    'Z|6|b': { i: [], t: 2 } // 01/11
  } };
  const w2 = { area: 'PREPARAÇÃO', ini: '2026-11-02', mes: '2026-11', qz: { 'Z|0|c': { i: [], t: 3 }, 'Z|2|d': { i: [], t: 4 }, 'Z|3|e': null } };
  // semana de segunda 26/10 a domingo 01/11
  assert.deepEqual(lancamentosFaixaQZ([w1, w2, null], '2026-10-26', '2026-11-01').map(x => x.v.t), [1, 2]);
  // um dia só
  assert.deepEqual(lancamentosFaixaQZ([w1, w2], '2026-11-04', '2026-11-04').map(x => x.dt), ['2026-11-04']);
  // filtro de área
  assert.equal(lancamentosFaixaQZ([w1, w2], '2026-11-01', '2026-11-08', 'PREPARAÇÃO').length, 2);
  assert.equal(lancamentosFaixaQZ([w1, w2], '2026-11-01', '2026-11-08', 'RECEBIMENTO').length, 1);
});
