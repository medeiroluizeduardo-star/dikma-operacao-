// Indicadores › Segurança: resumo por dia, semana ou mês (contas/seg-resumo.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relatorioSeg, periodoSeg, mesesDoPeriodo } from '../public/contas/seg-resumo.js';

const inter = [
  { area: 'BATERIA', data: '2026-11-03', desvios: ['EPI', 'CELULAR'], resp: 'Ana' },
  { area: 'BATERIA', data: '2026-11-05', desvios: ['EPI'], resp: 'ANA ' },
  { area: 'PÁTIO DE CARVÃO', data: '2026-11-20', desvios: [], resp: 'Beto' },
  { area: 'BATERIA', data: '2026-10-31', desvios: ['EPI'], resp: 'Ana' }
];
const anom = [
  { area: 'BATERIA', data: '2026-11-04', status: 'aberta', trat: { prazo: '2026-11-10', resp: 'Caio' } },
  { area: 'PÁTIO DE CARVÃO', data: '2026-11-03', status: 'concluida', trat: { prazo: '2026-11-06' }, conclEm: '2026-11-05T15:00:00' },
  { area: 'BATERIA', data: '2026-10-20', status: 'tratamento' }
];
const cartao = [{ area: 'BATERIA', data: '2026-11-04', faltou: ['O AMBIENTE ESTÁ SEGURO?'], status: 'validado', valid: { tipo: 'seg' } }];
const base = { inter, anom, cartao, mesTela: '2026-11', hoje: '2026-11-25', areas: ['PÁTIO DE CARVÃO', 'BATERIA'], agora: '25/11/2026 08:00' };
const kpi = (r, rot) => r.kpis.find(k => k.rot === rot).v;
const tab = (r, id) => r.tabelas.find(t => t.id === id);

test('período: dia, semana (segunda a domingo) e mês, e os meses que ele toca', () => {
  assert.deepEqual([periodoSeg(null, '2026-11').ini, periodoSeg(null, '2026-11').fim], ['2026-11-01', '2026-11-30']);
  const s = periodoSeg({ tipo: 'semana', data: '2026-12-02' });
  assert.deepEqual([s.ini, s.fim], ['2026-11-30', '2026-12-06']);
  assert.deepEqual(mesesDoPeriodo(s), ['2026-11', '2026-12']);
  assert.equal(periodoSeg({ tipo: 'dia', data: '2026-11-04' }).papel, 'RESUMO DO DIA · SEGURANÇA');
});

test('mês: números do topo, por área e situação das anomalias', () => {
  const r = relatorioSeg({ ...base, per: { tipo: 'mes', data: '2026-11-10' } });
  assert.equal(r.papel, 'RESUMO DO MÊS · SEGURANÇA');
  assert.equal(kpi(r, 'Interações'), 3);
  assert.equal(kpi(r, 'Anomalias registradas'), 2);
  assert.equal(kpi(r, 'Tratadas no prazo'), 100);
  assert.equal(kpi(r, 'Cartões Amarelos'), 1);
  assert.equal(kpi(r, 'Anomalias em aberto hoje'), 2); // a de outubro ainda está aberta
  const a = tab(r, 'area');
  assert.deepEqual(a.linhas.find(l => l[0] === 'Bateria').slice(1), [2, 100, 1, 1, 1, 1]);
  assert.deepEqual(tab(r, 'desvio').linhas[0].slice(0, 2), ['EPI', 2]);
  assert.equal(tab(r, 'pessoa').linhas[0][1], 2); // Ana e "ANA " contam juntas
  assert.equal(tab(r, 'dia').linhas.length, 30);
  assert.ok(r.meta.includes('Mês: Novembro/2026'));
});

test('dia e área escolhida: sem o quadro por área e sem dia a dia', () => {
  const r = relatorioSeg({ ...base, area: 'BATERIA', per: { tipo: 'dia', data: '2026-11-04' } });
  assert.equal(kpi(r, 'Interações'), 0);
  assert.equal(kpi(r, 'Anomalias registradas'), 1);
  assert.equal(tab(r, 'area'), undefined);
  assert.equal(tab(r, 'dia'), undefined);
  assert.equal(tab(r, 'anomp').linhas[0][4], 'Prazo vencido');
  assert.ok(r.meta.includes('Área: Bateria'));
});

test('Excel: monta o arquivo com o painel, os quadros e as três listas', async () => {
  const { arquivosXlsx } = await import('../public/ui/excel-relatorio.js');
  const r = relatorioSeg({ ...base, per: { tipo: 'semana', data: '2026-11-04' } });
  const arq = arquivosXlsx(r);
  const wb = arq['xl/workbook.xml'];
  for (const n of ['Painel', 'Quadros', 'Interações', 'Anomalias', 'Cartão Amarelo']) assert.ok(wb.includes(`name="${n}"`), n);
  assert.ok(Object.keys(arq).some(k => k.startsWith('xl/charts/')));
});
