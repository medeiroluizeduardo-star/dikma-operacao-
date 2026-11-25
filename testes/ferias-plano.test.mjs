// Planejamento das férias (RH › Férias): contas/ferias-plano.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiceFeriasPessoa } from '../public/contas/ferias.js';
import { etapaFerias, prazoAviso, turmaCurta, noMes, picoNoMes, quadroDoMes, conflitosDoMes, pendenciasFerias, planoDoAno, pessoaDoPeriodo, mesSugerido, somarMeses, fimDoMes } from '../public/contas/ferias-plano.js';

const HOJE = '2026-11-25';
const cadastro = [
  { mat: '1', nome: 'PESSOA UM', turma: 'TURMA C', area: 'RECEBIMENTO' },
  { mat: '2', nome: 'PESSOA DOIS', turma: '4X4 C', area: 'RECEBIMENTO' },
  { mat: '3', nome: 'PESSOA TRES', turma: 'C', area: 'RECEBIMENTO' },
  { mat: '4', nome: 'PESSOA QUATRO', turma: 'ADM', area: 'BATERIA 1' },
  { mat: '5', nome: 'PESSOA CINCO', turma: 'A', area: 'BATERIA 1' },
  { mat: '6', nome: 'PESSOA SEIS', turma: 'A', area: 'BATERIA 1', dem: '2026-10-01' }
];
const ferias = [
  { id: 'a', mat: '1', nome: 'PESSOA UM', inicio: '2026-12-10', dias: 30, termino: '2027-01-08', limite: '2027-03-01', substituto: 'X' },
  { id: 'b', mat: '2', nome: 'PESSOA DOIS', inicio: '2026-12-20', dias: 20, termino: '2027-01-08', limite: '2027-03-01', avisoEm: '2026-11-15' },
  { id: 'c', mat: '3', nome: 'PESSOA TRES', inicio: '2026-12-28', dias: 10, termino: '2027-01-06', limite: '2027-01-02' },
  { id: 'd', mat: '4', nome: 'PESSOA QUATRO', inicio: null, mesPlanejado: '2027-01', limite: '2027-02-10' },
  { id: 'e', mat: '5', nome: 'PESSOA CINCO', inicio: '2025-11-01', dias: 30, termino: '2025-11-30', limite: '2026-11-01' },
  { id: 'f', mat: '6', nome: 'PESSOA SEIS', inicio: null, limite: '2026-10-01' }
];
const idx = indiceFeriasPessoa(ferias, cadastro);
const achar = pessoaDoPeriodo(cadastro);
const grupoDe = p => (p ? { area: p.area, areaNome: p.area, turma: turmaCurta(p.turma) } : { area: '', areaNome: 'Sem cadastro', turma: '' });
const base = { cadastro, ferias, hoje: HOJE, feriasDe: idx, grupoDe, achar };

test('datas: meses e fim do mês', () => {
  assert.equal(somarMeses('2026-11', 2), '2027-01');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.equal(fimDoMes('2027-02'), '2027-02-28');
});

test('etapas: planejada, marcada, aviso entregue, em gozo e gozada', () => {
  assert.equal(etapaFerias(ferias[3], HOJE).k, 'planejada');
  assert.match(etapaFerias(ferias[3], HOJE).t, /Jan\/27/);
  assert.equal(etapaFerias(ferias[0], HOJE).k, 'marcada');
  assert.equal(etapaFerias(ferias[1], HOJE).k, 'avisada');
  assert.equal(etapaFerias(ferias[0], '2026-12-15').k, 'gozo');
  assert.equal(etapaFerias(ferias[4], HOJE).k, 'gozada');
  assert.equal(prazoAviso(ferias[0]), '2026-11-10');
});

test('turma curta da ficha', () => {
  assert.equal(turmaCurta('TURMA C'), 'C');
  assert.equal(turmaCurta('4X4 C'), 'C');
  assert.equal(turmaCurta('adm'), 'ADM');
  assert.equal(turmaCurta(''), '');
});

test('mês: período que atravessa o mês e planejada sem data', () => {
  assert.ok(noMes(ferias[0], '2027-01'));
  assert.ok(!noMes(ferias[0], '2027-02'));
  assert.ok(noMes(ferias[3], '2027-01'));
  assert.equal(picoNoMes(ferias.slice(0, 3), '2026-12'), 3);
  assert.equal(picoNoMes(ferias.slice(0, 3), '2026-11'), 0);
});

test('quadro do mês e turma acima do máximo', () => {
  const ls = quadroDoMes({ ferias, mes: '2026-12', achar, grupoDe, hoje: HOJE });
  assert.deepEqual(ls.map(l => l.f.id), ['a', 'b', 'c']);
  const c = conflitosDoMes(ls, '2026-12', 2);
  assert.equal(c.length, 1);
  assert.equal(c[0].pico, 3);
  assert.equal(c[0].g.turma, 'C');
  assert.equal(conflitosDoMes(ls, '2026-12', 3).length, 0);
});

test('pendências: limite vencido, aviso, sem substituto, depois do limite e conflito; desligado fora', () => {
  const P = pendenciasFerias({ ...base, max: 2 });
  const tipos = P.map(x => `${x.tipo}:${(x.p && x.p.mat) || (x.g && x.g.turma) || ''}`);
  assert.ok(tipos.includes('vencido:5'), tipos.join());
  assert.ok(!tipos.some(t => t.endsWith(':6')), 'desligado não entra');
  assert.ok(tipos.includes('aviso:1'), 'aviso atrasado da pessoa 1');
  assert.ok(!tipos.includes('aviso:2'), 'aviso já entregue');
  assert.ok(tipos.includes('semSub:2'));
  assert.ok(!tipos.includes('semSub:1'));
  assert.ok(tipos.includes('depoisLimite:3'));
  assert.ok(tipos.includes('conflito:C'));
  assert.equal(P[0].tipo, 'vencido');
  const av = P.find(x => x.tipo === 'aviso' && x.p.mat === '1');
  assert.equal(av.s, 'critico');
});

test('pendências: limite chegando com férias só planejadas mostra o mês planejado', () => {
  const P = pendenciasFerias({ ...base, hoje: '2026-12-20' });
  const x = P.find(y => y.p && y.p.mat === '4');
  assert.ok(x && x.tipo === 'lim60', JSON.stringify(x && x.tipo));
  assert.equal(x.plan.id, 'd');
});

test('plano do ano: 12 meses com saídas, pico, planejadas e por área', () => {
  const pl = planoDoAno({ ...base, max: 2 });
  assert.equal(pl.meses.length, 12);
  const dez = pl.meses.find(m => m.mes === '2026-12'), jan = pl.meses.find(m => m.mes === '2027-01');
  assert.equal(dez.saem, 3); assert.equal(dez.pico, 3); assert.equal(dez.conflitos, 1);
  assert.equal(jan.planejadas, 1); assert.equal(jan.saem, 0); assert.equal(jan.ferias, 3);
  assert.equal(dez.porArea.RECEBIMENTO, 3);
  assert.deepEqual(pl.areas.map(a => a.k), ['BATERIA 1', 'RECEBIMENTO']);
});

test('mês sugerido: o anterior ao da data limite, nunca antes de hoje', () => {
  assert.equal(mesSugerido('2027-03-01', HOJE), '2027-02');
  assert.equal(mesSugerido('2026-11-30', HOJE), '2026-11');
  assert.equal(mesSugerido(null, HOJE), '2026-11');
});
