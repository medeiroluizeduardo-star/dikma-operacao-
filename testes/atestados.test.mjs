// Contas dos atestados (public/contas/atestados.js): conferência do formulário, dias, prazo de entrega, alerta do
// INSS, lista da folha (16 a 15), indicador por área, ficha, descarte LGPD e avisos (só números).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as AT from '../public/contas/atestados.js';

const at = (x = {}) => ({ id: 'a1', conj: 'patio', area: 'RECEBIMENTO', cid: 'C1', mat: '1001', nome: 'PESSOA UM', tipo: 'Atestado médico', ini: '2026-11-10', dias: 3, fim: '2026-11-12', emis: '2026-11-10', diaLanc: '2026-11-10', st: 'conferir', nf: 1, minis: ['m'], por: 'u1', ...x });

test('conferirAt: tipo, datas, dias e horas da declaração', () => {
  const ok = AT.conferirAt({ tipo: 'Atestado médico', ini: '2026-11-10', emis: '2026-11-10', dias: '3', obs: '  entregou   a cópia ' }, '2026-11-26');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.item, { tipo: 'Atestado médico', ini: '2026-11-10', emis: '2026-11-10', dias: 3, fim: '2026-11-12', horas: null, obs: 'entregou a cópia' });
  assert.equal(AT.conferirAt({ tipo: 'Gripe', ini: '2026-11-10', dias: 1 }).ok, false, 'tipo fora da lista');
  assert.equal(AT.conferirAt({ tipo: 'Atestado médico', ini: '', dias: 1 }).ok, false, 'sem o primeiro dia');
  assert.equal(AT.conferirAt({ tipo: 'Atestado médico', ini: '2026-11-10', dias: 31 }).ok, false, 'mais de 30 dias é afastamento');
  assert.equal(AT.conferirAt({ tipo: 'Atestado médico', ini: '2026-11-10', dias: 0 }).ok, false);
  assert.equal(AT.conferirAt({ tipo: 'Atestado médico', ini: '2026-11-27', emis: '2026-11-27', dias: 1 }, '2026-11-26').ok, false, 'emissão no futuro');
  assert.equal(AT.conferirAt({ tipo: 'Outro', ini: '2026-11-10', dias: 1, obs: '' }).ok, false, 'Outro pede a observação');
  const d = AT.conferirAt({ tipo: AT.DECLARACAO, ini: '2026-11-10', dias: 5, horas: '2,5' });
  assert.equal(d.ok, true); assert.equal(d.item.dias, 1, 'declaração vale um dia'); assert.equal(d.item.horas, 2.5);
  assert.equal(AT.conferirAt({ tipo: AT.DECLARACAO, ini: '2026-11-10', horas: '' }).ok, false, 'declaração sem horas');
  assert.equal(AT.conferirAt({ tipo: 'Atestado médico', ini: '2026-11-10', dias: 1, obs: 'x'.repeat(400) }).item.obs.length, AT.LIM.obs);
});

test('dias corridos do atestado, também na virada do mês', () => {
  assert.deepEqual(AT.diasDoAtestado('2026-11-29', 4), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  assert.equal(AT.fimDe('2026-11-29', 4), '2026-12-02');
  assert.equal(AT.fimDe('2026-11-29', 1), '2026-11-29');
});

test('prazo de entrega: 48 h = até 2 dias depois da emissão (ajustável)', () => {
  assert.equal(AT.limiteEntrega('2026-11-10'), '2026-11-12');
  assert.equal(AT.foraDoPrazo(at({ diaLanc: '2026-11-12' })), false);
  assert.equal(AT.foraDoPrazo(at({ diaLanc: '2026-11-13' })), true);
  assert.equal(AT.foraDoPrazo(at({ diaLanc: '2026-11-13' }), { prazoH: 72 }), false);
  assert.equal(AT.foraDoPrazo(at({ diaLanc: '' })), false, 'sem o dia do lançamento não marca');
  assert.deepEqual(AT.cfgAt({ prazoH: 'x', inssDias: 0, inssJanela: 9999 }), AT.CFG_PADRAO, 'valor inválido volta ao padrão');
});

test('alerta do INSS: mais de 15 dias em 60, cada dia uma vez, sem recusados e sem declarações', () => {
  const hoje = '2026-11-26';
  const l = [at({ id: 'x1', ini: '2026-11-01', dias: 10 }), at({ id: 'x2', ini: '2026-11-15', dias: 6 })];
  const r = AT.alertasINSS(l, hoje);
  assert.equal(r.length, 1); assert.equal(r[0].dias, 16); assert.equal(r[0].de, '2026-11-01'); assert.equal(r[0].ate, '2026-11-20'); assert.deepEqual(r[0].ids, ['x1', 'x2']);
  assert.equal(AT.alertasINSS([at({ id: 'x1', ini: '2026-11-01', dias: 10 }), at({ id: 'x2', ini: '2026-11-05', dias: 10 })], hoje).length, 0, 'dias sobrepostos não somam em dobro (14 dias)');
  assert.equal(AT.alertasINSS([...l.slice(0, 1), at({ id: 'x2', ini: '2026-11-15', dias: 6, st: 'recusado' })], hoje).length, 0, 'recusado não conta');
  assert.equal(AT.alertasINSS(l, hoje, { inssDias: 20 }).length, 0, 'limite configurável');
  assert.equal(AT.alertasINSS([at({ id: 'v', ini: '2026-08-01', dias: 20 })], hoje).length, 0, 'fora da janela de 60 dias');
  assert.equal(AT.alertasINSS([at({ id: 'o1', mat: '', cid: 'C9', ini: '2026-11-01', dias: 10 }), at({ id: 'o2', mat: '', cid: 'C9', ini: '2026-11-12', dias: 7 })], hoje).length, 1, 'sem matrícula junta pelo id das Atividades');
});

test('etiquetas, contagens e filtro da lista do RH', () => {
  assert.deepEqual(AT.etiquetasAt(at({ nf: 0, diaLanc: '2026-11-20' })).map(x => x[0]), ['A conferir', 'Sem foto', 'Fora do prazo']);
  assert.deepEqual(AT.etiquetasAt(at({ st: 'conferido', orig: true })).map(x => x[0]), ['Conferido', 'Original entregue']);
  assert.deepEqual(AT.etiquetasAt(at({ nf: 0, fotosApagadasEm: 1 })).map(x => x[0]), ['A conferir'], 'foto apagada pelo prazo não conta como sem foto');
  const l = [at({ id: '1' }), at({ id: '2', st: 'recusado', nf: 0 }), at({ id: '3', nf: 0, diaLanc: '2026-11-20' }), at({ id: '4', st: 'conferido', conj: 'bateria', nome: 'OUTRA PESSOA', ini: '2026-10-20', fim: '2026-10-20', dias: 1 })];
  assert.deepEqual(AT.contagensAt(l), { conferir: 2, recusado: 1, semfoto: 1, prazo: 1 });
  assert.deepEqual(AT.filtrarAt(l, { st: 'conferir' }).map(a => a.id).sort(), ['1', '3']);
  assert.deepEqual(AT.filtrarAt(l, { st: 'semfoto' }).map(a => a.id).sort(), ['2', '3']);
  assert.deepEqual(AT.filtrarAt(l, { conj: 'bateria' }).map(a => a.id), ['4']);
  assert.deepEqual(AT.filtrarAt(l, { q: 'outra' }).map(a => a.id), ['4']);
  assert.deepEqual(AT.filtrarAt(l, { q: '1001' }).length, 4);
  assert.equal(AT.filtrarAt(l, { comp: '2026-11' }).length, 4, 'competência 11 = 16/10 a 15/11');
  assert.equal(AT.filtrarAt(l, { comp: '2026-12' }).length, 0);
});

test('lista da folha: só os dias que caem de 16 a 15', () => {
  const l = [at({ id: 'f1', ini: '2026-11-14', dias: 4 }), at({ id: 'f2', tipo: AT.DECLARACAO, ini: '2026-11-20', dias: 1, horas: 3 }), at({ id: 'f3', ini: '2026-12-20', dias: 1 })];
  const c11 = AT.folhaDaCompetencia(l, '2026-11');
  assert.deepEqual(c11.map(r => [r.id, r.diasComp, r.de, r.ate]), [['f1', 2, '2026-11-14', '2026-11-15']]);
  const c12 = AT.folhaDaCompetencia(l, '2026-12');
  assert.deepEqual(c12.map(r => [r.id, r.diasComp]), [['f1', 2], ['f2', 0]], 'a declaração entra com as horas, sem dias');
  assert.equal(AT.folhaDaCompetencia(l, '2026-12', 'bateria').length, 0);
  assert.equal(AT.competenciaDe('2026-11-16'), '2026-12');
});

test('indicador por área (sem nomes) e dias por mês', () => {
  const l = [at({ id: 'i1', ini: '2026-10-30', dias: 4 }), at({ id: 'i2', mat: '1002', ini: '2026-11-05', dias: 2 }), at({ id: 'i3', area: 'PREPARAÇÃO', tipo: AT.DECLARACAO, ini: '2026-11-07', dias: 1, horas: 2 }), at({ id: 'i4', st: 'recusado', ini: '2026-11-08', dias: 5 })];
  const r = AT.resumoPorArea(l, '2026-11');
  assert.deepEqual(r, [{ area: 'RECEBIMENTO', atestados: 2, dias: 4, pessoas: 2, declaracoes: 0 }, { area: 'PREPARAÇÃO', atestados: 1, dias: 0, pessoas: 1, declaracoes: 1 }]);
  assert.ok(r.every(x => !('nome' in x) && !('mat' in x)), 'sem nomes nem matrículas');
  assert.deepEqual(AT.diasPorMes(l, ['2026-10', '2026-11']), [2, 4]);
});

test('ficha do colaborador, quem pode mexer e descarte LGPD da foto', () => {
  const l = [at({ id: 'p1', ini: '2026-10-01' }), at({ id: 'p2', ini: '2026-11-01' }), at({ id: 'p3', mat: '', nome: 'Pessoa  Um' }), at({ id: 'p4', mat: '9' })];
  assert.deepEqual(AT.atestadosDaPessoa(l, '1001', 'PESSOA UM').map(a => a.id), ['p3', 'p2', 'p1'], 'pela matrícula e, sem matrícula, pelo nome');
  assert.deepEqual(AT.atestadosDaPessoa(l, '1001', '').map(a => a.id), ['p2', 'p1']);
  assert.equal(AT.autorMexe(at({ st: 'conferir' })), true); assert.equal(AT.autorMexe(at({ st: 'recusado' })), true); assert.equal(AT.autorMexe(at({ st: 'conferido' })), false);
  const hoje = '2027-12-01';
  const v = AT.fotosParaDescartar([at({ id: 'd1', fim: '2026-11-12' }), at({ id: 'd2', fim: '2026-12-02' }), at({ id: 'd3', fim: '2026-10-01', nf: 0, minis: [], obs: '' })], hoje);
  assert.deepEqual(v.map(a => a.id), ['d1'], 'só o que passou de 12 meses e ainda tem foto ou observação');
});

test('avisos: só números, a partir das 8h; RH a conferir e INSS; quem lançou: sem foto ou recusado', () => {
  const hoje = '2026-11-26';
  const l = [at({ id: 'v1', nf: 0, diaLanc: '2026-11-25', ini: '2026-11-25', fim: '2026-11-25', dias: 1 }), at({ id: 'v2', st: 'recusado', por: 'u2' }), at({ id: 'v3', nf: 0, diaLanc: hoje, por: 'u3' }), at({ id: 'v4', st: 'conferido', por: 'u4', nf: 0 })];
  assert.deepEqual(AT.avisosAtestados({ lista: l, hoje, hora: 7 }), { rh: null, autores: [] });
  const r = AT.avisosAtestados({ lista: l, hoje, hora: 9 });
  assert.equal(r.rh.n, 2); assert.equal(r.rh.chave, 'atrh|' + hoje);
  assert.deepEqual(r.autores.map(a => [a.uid, a.semFoto, a.recusados]).sort(), [['u1', 1, 0], ['u2', 0, 1]], 'o de hoje ainda não cobra; conferido não cobra');
  assert.ok(!JSON.stringify(r).includes('PESSOA'), 'sem nomes');
});
