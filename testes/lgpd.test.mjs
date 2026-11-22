// Testes das contas do descarte LGPD (public/contas/lgpd.js): o ASO mais recente sempre fica (salvo 2 anos depois da
// demissão), só a observação de atestado e afastamento sai e só depois de 12 meses, e o registro de acesso vale 1 ano.
// node --test testes/lgpd.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as LG from '../public/contas/lgpd.js';

const HOJE = '2026-11-22';
const aso = (id, mat, realizado, validade, x = {}) => ({ id, mat, nome: 'PESSOA ' + mat, tipo: 'ASO', realizado, validade, ...x });

test('ASO: fica o mais recente; os antigos saem 2 anos depois de vencer', () => {
  const t = [aso('a1', '10', '2025-10-01', '2026-10-01'), aso('a2', '10', '2023-10-01', '2024-10-01'), aso('a3', '10', '2024-11-25', '2024-11-25'),
    aso('a4', '20', '2020-01-01', '2021-01-01'), { id: 'n1', mat: '10', tipo: 'NR 35 TRABALHO EM ALTURA', realizado: '2020-01-01', validade: '2021-01-01' }];
  const s = LG.asoParaDescartar(t, [], HOJE).map(x => x.id);
  assert.deepEqual(s, ['a2'], 'a3 venceu há menos de 2 anos; a4 é o único (mais recente) da pessoa 20; NR não entra');
});
test('ASO: sem validade conta 12 meses do exame; apagado e "não se aplica" ficam de fora', () => {
  const t = [aso('b1', '30', '2026-01-01', null), aso('b2', '30', '2023-11-01', null), aso('b3', '30', '2020-01-01', null, { apagado: true }), { id: 'na', mat: '30', tipo: 'ASO', naTipos: ['ASO'] }];
  assert.deepEqual(LG.asoParaDescartar(t, [], HOJE).map(x => x.id), ['b2']);
});
test('ASO: de quem saiu, todos saem 2 anos depois da demissão (pela matrícula ou pelo nome)', () => {
  const t = [aso('c1', '40', '2024-01-01', '2025-01-01'), aso('c2', '40', '2023-01-01', '2024-01-01'), aso('c3', '50', '2024-01-01', '2025-01-01'),
    { ...aso('c4', '', '2024-01-01', '2025-01-01'), nome: 'José da Silva' }];
  const fichas = [{ mat: '40', dem: '2024-06-01' }, { mat: '50', dem: '2025-06-01' }, { mat: '60', nome: 'JOSE DA SILVA', dem: '2024-02-01' }];
  const s = LG.asoParaDescartar(t, fichas, HOJE);
  assert.deepEqual(s.map(x => x.id).sort(), ['c1', 'c2', 'c4']);
  assert.ok(s.every(x => x.motivo === 'demissao'));
});
test('Atestado e afastamento: só a observação, só AT/AF e só depois de 12 meses', () => {
  const sit = { v: { 'P1|2025-10-10': 'AT', 'P1|2025-11-30': 'AT', 'P2|2025-01-05': 'FT', 'P3|2025-02-01': 'AF' },
    jus: { 'P1|2025-10-10': { cod: 'AT', mot: 'Atestado médico', obs: '3 dias' }, 'P1|2025-11-30': { cod: 'AT', obs: '2 dias' },
      'P2|2025-01-05': { cod: 'FT', obs: 'ônibus' }, 'P3|2025-02-01': { mot: 'INSS', obs: 'perícia' }, 'P4|2025-03-01': { cod: 'AT', mot: 'x' } } };
  assert.deepEqual(LG.obsDaSituacao(sit, HOJE).map(x => x.caminho), [['jus', 'P1|2025-10-10', 'obs'], ['jus', 'P3|2025-02-01', 'obs']]);
  const comp = { d: { k1: { '2025-05-02': 'AF' } }, jus: { k1: { '2025-05-02': { obs: 'afastado' }, '2026-05-02': { cod: 'AT', obs: 'recente' } }, k2: { '2025-04-01': { cod: 'ATR', obs: 'atraso' } } } };
  assert.deepEqual(LG.obsDaFolha(comp, HOJE).map(x => x.caminho), [['jus', 'k1', '2025-05-02', 'obs']]);
});
test('Registro de acesso: sai depois de 1 ano; lotes de 400', () => {
  const a = [{ id: 'x', dia: '2025-11-21' }, { id: 'y', dia: '2025-11-22' }, { id: 'z', dia: '2026-01-01' }];
  assert.deepEqual(LG.acessosParaDescartar(a, HOJE).map(x => x.id), ['x']);
  assert.deepEqual(LG.emLotes(Array.from({ length: 801 }, (_, i) => i)).map(l => l.length), [400, 400, 1]);
});
