// Testes das contas das fotos das atividades (public/contas/fotos.js): configuração e validação, situação que exige foto,
// contador do passo de fotos, refs compartilhadas (uma foto para várias atividades), contagem por célula (ft),
// indicador "com foto" e estimativa de armazenamento. Não precisa do emulador: node --test testes/fotos.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../public/contas/fotos.js';
import { add } from '../public/contas/cal.js';

const HOJE = '2026-11-12'; // quinta-feira
const AREA = 'RECEBIMENTO';
const SEM = `${AREA}|2026-11-09`;

test('configuração: sem documento vale o padrão (obrigatória, 1 a 10 nas atividades, até 2 na queda zero e nas OMs, Realizada e Extra)', () => {
  const c = F.cfgFotos(null);
  assert.deepEqual({ obrig: c.obrig, min: c.min, max: c.max, maxQZ: c.maxQZ, maxOM: c.maxOM, situacoes: c.situacoes }, { obrig: true, min: 1, max: 10, maxQZ: 2, maxOM: 2, situacoes: ['R', 'E'] });
  assert.deepEqual([F.cfgFotos({ maxQZ: 0, maxOM: 50 }).maxQZ, F.cfgFotos({ maxQZ: 0, maxOM: 50 }).maxOM], [1, 10], 'máximo por tela fica entre 1 e 10');
  assert.equal(F.cfgFotos({ max: 3 }).maxQZ, 2, 'configuração antiga (sem maxQZ) usa o padrão da queda zero');
  assert.equal(c.desde, F.FOTOS_DESDE_PADRAO);
  // valores estranhos gravados viram algo válido
  const x = F.cfgFotos({ obrig: true, min: 0, max: 50, situacoes: ['N', 'X', 'R'] });
  assert.equal(x.min, 1); assert.equal(x.max, 10); assert.deepEqual(x.situacoes, ['R', 'N']);
  assert.equal(F.cfgFotos({ obrig: false, min: 0, max: 2 }).min, 0);
  assert.equal(F.cfgFotos({ min: 4, max: 2 }).max, 4, 'máximo nunca fica abaixo do mínimo');
});

test('validação do administrador: mínimo ≥ 1 quando obrigatória, máximo ≥ mínimo, máximo ≤ 10', () => {
  const ok = { obrig: true, min: 1, max: 3, situacoes: ['R', 'E'], desde: '2026-11-09' };
  assert.equal(F.validarCfgFotos(ok), '');
  assert.match(F.validarCfgFotos({ ...ok, min: 0 }), /pelo menos 1/);
  assert.equal(F.validarCfgFotos({ ...ok, obrig: false, min: 0 }), '');
  assert.match(F.validarCfgFotos({ ...ok, min: 4, max: 3 }), /menor que o mínimo/);
  assert.match(F.validarCfgFotos({ ...ok, max: 11 }), /máximo é de 10/);
  assert.match(F.validarCfgFotos({ ...ok, maxQZ: 0 }), /Queda zero/);
  assert.match(F.validarCfgFotos({ ...ok, maxOM: 11 }), /OMs/);
  assert.equal(F.validarCfgFotos({ ...ok, maxQZ: 2, maxOM: 2 }), '');
  assert.match(F.validarCfgFotos({ ...ok, min: 1.5 }), /inteiros/);
  assert.match(F.validarCfgFotos({ ...ok, min: NaN }), /inteiros/);
  assert.match(F.validarCfgFotos({ ...ok, situacoes: [] }), /pelo menos uma situação/);
  assert.equal(F.validarCfgFotos({ ...ok, obrig: false, situacoes: [] }), '');
  assert.match(F.validarCfgFotos({ ...ok, situacoes: ['Z'] }), /inválida/);
  assert.match(F.validarCfgFotos({ ...ok, desde: '09/11/2026' }), /Data/);
});

test('situação que exige foto: padrão R e E; fora da programação conta como extra; N só se marcada; desligada não exige', () => {
  const c = F.cfgFotos(null);
  assert.equal(F.exigeFoto(c, 'R'), true);
  assert.equal(F.exigeFoto(c, 'E'), true);
  assert.equal(F.exigeFoto(c, 'N'), false);
  assert.equal(F.exigeFoto(c, 'P'), false);
  const soExtra = { ...c, situacoes: ['E'] };
  assert.equal(F.exigeFoto(soExtra, 'R'), false);
  assert.equal(F.exigeFoto(soExtra, 'R', true), true, 'realizada fora da programação = extra');
  assert.equal(F.exigeFoto({ ...c, situacoes: ['R', 'E', 'N'] }, 'N'), true);
  assert.equal(F.exigeFoto({ ...c, obrig: false }, 'R'), false);
  assert.equal(F.exigeFoto(null, 'R'), false);
  // as fotos que a célula já tem contam (desmarcar e marcar de novo não pede outra)
  assert.equal(F.faltamFotos(c, 0), 1); assert.equal(F.faltamFotos(c, 1), 0); assert.equal(F.faltamFotos({ ...c, min: 2 }, 1), 1);
});

test('contador do passo de fotos: texto e cor (falta, parcial, ok, acima)', () => {
  const c = F.cfgFotos({ max: 3 });
  assert.deepEqual(F.contador(c, 0), { min: 1, max: 3, tom: 'falta', ok: false, txt: 'Fotos: 0 de 1 obrigatória · máximo 3', cabe: 3 });
  assert.equal(F.contador(c, 1).txt, 'Fotos: 1 de 1 obrigatória · máximo 3');
  assert.equal(F.contador(c, 1).tom, 'ok'); assert.equal(F.contador(c, 1).ok, true);
  assert.equal(F.contador(c, 3).cabe, 0);
  assert.equal(F.contador(c, 3).txt, 'Fotos: 3 (1 obrigatória) · máximo 3');
  assert.equal(F.contador(c, 4).tom, 'acima'); assert.equal(F.contador(c, 4).ok, false);
  const c2 = { ...c, min: 2, max: 3 };
  assert.equal(F.contador(c2, 1).tom, 'parcial'); assert.equal(F.contador(c2, 1).txt, 'Fotos: 1 de 2 obrigatórias · máximo 3');
  // célula que já tem 1 foto: falta só a diferença e o máximo desconta
  assert.equal(F.contador(c2, 0, 1).txt, 'Fotos: 0 de 1 obrigatória · máximo 2 · já tem 1');
  assert.equal(F.contador({ ...c, obrig: false, min: 0 }, 0).ok, true);
});

test('refs compartilhadas: uma foto do "Marcar restantes" vale para todas e conta 1 em cada célula', () => {
  const r = F.refCel(SEM, 'REC-001', 2);
  assert.equal(r, 'RECEBIMENTO|2026-11-09|REC-001|2');
  assert.deepEqual(F.lerRef(r), { semana: SEM, pid: 'REC-001', k: 2 });
  assert.equal(F.lerRef('x|y'), null);
  const itens = ['REC-001', 'REC-002', 'REC-003'].map(pid => ({ pid, ativ: 'Limpeza ' + pid, local: 'Correia 1' }));
  const meta = F.metaFoto({ semana: SEM, area: AREA, conj: 'patio', rota: 'ROTA 1', dia: '2026-11-11', k: 2, sit: 'R', itens, img: { thumb: 'data:x', bytes: 120000, w: 1280, h: 960, sha: 'a'.repeat(64) }, por: 'u1', porNome: 'Líder' });
  assert.deepEqual(meta.refs, itens.map(x => F.refCel(SEM, x.pid, 2)));
  assert.equal(meta.mes, '2026-11'); assert.equal(meta.pid, 'REC-001'); assert.equal(meta.local, 'Correia 1');
  assert.match(meta.ativ, /^3 atividades: /);
  for (const c of ['exportadoEm', 'exportLote', 'lixeiraEm', 'removidaEm']) assert.equal(meta[c], null);
  assert.equal('fase' in meta, false, 'sem escolha, sem o campo fase');
  const ant = F.metaFoto({ semana: SEM, area: AREA, dia: '2026-11-11', k: 2, itens, img: { thumb: '', bytes: 1, w: 1, h: 1, fase: 'antes' } });
  assert.equal(ant.fase, 'antes');
  assert.equal('fase' in F.metaFoto({ semana: SEM, area: AREA, dia: '2026-11-11', k: 2, itens, img: { thumb: '', bytes: 1, w: 1, h: 1, fase: 'outra' } }), false);
  // contagem por célula: 2 fotos para as 3 atividades = 2 em cada uma
  assert.deepEqual(F.incrementosFt(meta.refs, 2), { 'REC-001|2': 2, 'REC-002|2': 2, 'REC-003|2': 2 });
  // até 100 atividades por foto
  const muitas = Array.from({ length: 130 }, (_, i) => ({ pid: 'P' + i, ativ: 'a', local: 'l' }));
  assert.equal(F.metaFoto({ semana: SEM, area: AREA, dia: '2026-11-11', k: 2, itens: muitas, img: { thumb: '', bytes: 1, w: 1, h: 1 } }).refs.length, F.MAX_REFS);
  assert.ok(F.metaFoto({ semana: SEM, area: AREA, dia: '2026-11-11', k: 2, itens: [{ pid: 'X', ativ: 'z'.repeat(900), local: '' }], img: { thumb: '', bytes: 1, w: 1, h: 1 } }).ativ.length <= 500);
});

test('contagem por célula: ft (novo) mais ev (código antigo)', () => {
  const doc = { ft: { 'A|1': 2 }, ev: { 'A|1': 1, 'B|0': 1 } };
  assert.equal(F.fotosDaCel(doc, 'A', 1), 3); assert.equal(F.fotosDaCel(doc, 'B', 0), 1); assert.equal(F.fotosDaCel(doc, 'C', 0), 0);
  assert.equal(F.fotosDaCel(null, 'A', 1), 0);
});

// Semana 09/11 a 15/11: A realizada seg-qua, B realizada seg e não realizada ter, C extra na terça, D fora da programação.
function semanas() {
  const doc = { id: SEM, area: AREA, ini: '2026-11-09', ids: ['A', 'B', 'C', 'D'], s: { A: 'RRRPP__', B: 'RN_____', C: '_E_____', D: '__R____' }, fp: { 'D|2': { por: 'x' } }, ft: { 'A|0': 1, 'A|1': 1, 'C|1': 1 } };
  const antiga = { id: `${AREA}|2026-11-02`, area: AREA, ini: '2026-11-02', ids: ['A'], s: { A: 'RRRRR__' }, ft: {} };
  const outra = { id: 'PREPARAÇÃO|2026-11-09', area: 'PREPARAÇÃO', ini: '2026-11-09', ids: ['P'], s: { P: 'RRR____' }, ft: {} };
  return { [doc.id]: doc, [antiga.id]: antiga, [outra.id]: outra };
}
test('indicador "com foto": só realizadas/extras desde a regra, até hoje; sem foto listadas', () => {
  const cfg = { ...F.cfgFotos(null), desde: '2026-11-09' };
  const r = F.resumoFotos(semanas(), { areas: [AREA], hoje: HOJE, cfg, lista: true });
  // A: 3 R (2 com foto) · B: 1 R · C: 1 E (com foto) · D: R fora da programação → 6 no total, 3 com foto
  assert.equal(r.total, 6); assert.equal(r.comFoto, 3); assert.equal(r.semFoto, 3);
  assert.deepEqual(r.itens.map(x => x.pid + '|' + x.k).sort(), ['A|2', 'B|0', 'D|2']);
  // semana anterior à regra não conta
  assert.ok(r.itens.every(x => x.dt >= '2026-11-09'));
  // todas as áreas
  assert.equal(F.resumoFotos(semanas(), { hoje: HOJE, cfg }).total, 9);
  // só Extra: R comum não conta; fora da programação conta
  assert.equal(F.resumoFotos(semanas(), { areas: [AREA], hoje: HOJE, cfg: { ...cfg, situacoes: ['E'] } }).total, 2);
  // Não realizada marcada passa a contar
  assert.equal(F.resumoFotos(semanas(), { areas: [AREA], hoje: HOJE, cfg: { ...cfg, situacoes: ['R', 'E', 'N'] } }).total, 7);
  // período antes da regra: nada
  assert.equal(F.resumoFotos(semanas(), { areas: [AREA], hoje: HOJE, cfg: { ...cfg, desde: '2026-12-01' } }).total, 0);
  // atividade fora do plano não conta
  assert.equal(F.resumoFotos(semanas(), { areas: [AREA], hoje: HOJE, cfg, noPlano: pid => pid !== 'D' }).total, 5);
});

test('estimativa de armazenamento: média dos últimos 14 dias × mínimo × tamanho guardado', () => {
  // 10 dias com 30 realizadas e 4 dias com 0 → 300 / 14 ≈ 21,4 por dia
  const docs = {}; const ini = '2026-10-26';
  for (let w = 0; w < 3; w++) {
    const s = add(ini, 7 * w); const ids = Array.from({ length: 30 }, (_, i) => 'X' + i);
    docs[s] = { id: AREA + '|' + s, area: AREA, ini: s, ids, s: Object.fromEntries(ids.map(id => [id, 'RRRRR__'])) };
  }
  const e = F.estimativaFotos([docs], { hoje: HOJE, dias: 14, cfg: F.cfgFotos(null) });
  // de 29/10 a 11/11: dias úteis = 30, 31/10, 03 a 07/11 (5), 10 e 11/11 → 10 dias × 30
  assert.equal(e.apontDia, Math.round(300 / 14));
  assert.equal(e.fotosDia, Math.round(300 / 14));
  assert.equal(e.kbFoto, F.kbGuardado());
  assert.ok(e.kbFoto > F.KB_FOTO, 'texto base64 ocupa mais que o arquivo');
  assert.equal(Math.round(e.mbDia * 1024), e.fotosDia * e.kbFoto);
  assert.equal(e.diasAte1GB, Math.floor(1024 / e.mbDia));
  const e2 = F.estimativaFotos([docs], { hoje: HOJE, dias: 14, cfg: { ...F.cfgFotos(null), min: 2 } });
  assert.equal(e2.fotosDia, Math.round(2 * 300 / 14));
  assert.equal(F.estimativaFotos([{}], { hoje: HOJE, cfg: F.cfgFotos(null) }).diasAte1GB, null);
});
