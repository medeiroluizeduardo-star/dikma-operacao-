// Administração › Trazer do Meu painel: conversão dos dados do painel antigo (public/contas/trazer-painel.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDoPainel, contarPlano, faltaMed, faltaInd, textoNotas, idNovo } from '../public/contas/trazer-painel.js';
import { PAINEL } from './painel-exemplo.mjs';

const QUEM = { uid: 'admin', nome: 'Admin Teste' };
const AGORA = new Date('2026-11-17T12:00:00.000Z');
const pl = planoDoPainel(PAINEL, QUEM, AGORA);
const T = id => (pl.trat.find(x => x.id === idNovo(id)) || {}).dados;

test('ações: origem, conjunto, nomes, situação, plano e ata com o id novo; apagadas e da rotina ficam fora', () => {
  const a = T('t1');
  assert.equal(a.tipo, 'acao'); assert.equal(a.conj, 'patio'); assert.equal(a.status, 'andamento'); assert.equal(a.resp, 'Pessoa Dois');
  assert.equal(a.plano, 'mp_pl1'); assert.equal(a.origem, 'outra'); assert.equal(a.custo, 80); assert.equal(a.criadoEm, '2026-11-10T10:00:00.000Z');
  assert.match(a.evol[0].t, /prioridade alta/); assert.match(a.evol[0].t, /ver turno C/); assert.match(a.evol[0].t, /✔ A; ○ B/);
  const b = T('t2');
  assert.equal(b.titulo, 'Ação: Ok'); assert.equal(b.origem, 'reuniao'); assert.equal(b.ref, 'Reunião semanal'); assert.equal(b.ata, 'mp_ata1');
  assert.equal(b.plano, ''); assert.equal(b.status, 'feita'); assert.equal(b.feitaEm, '2026-11-12T15:00:00.000Z'); assert.equal(b.conj, 'coq');
  const c = T('t3'); assert.equal(c.origem, 'seguranca'); assert.equal(c.inicio, '2026-11-01', 'início não fica depois do prazo'); assert.equal(c.conj, 'bateria');
  assert.equal(T('t4').origem, 'queda');
  assert.equal(T('t5'), undefined); assert.equal(T('P01_2026-11-12'), undefined);
});
test('planos e atas: encaminhamentos curtos sem ação saem; ata sem data vira aviso', () => {
  assert.deepEqual(T('pl1'), { tipo: 'plano', nome: 'Limpeza', objetivo: 'Zerar acúmulo', conj: 'patio', status: 'concluido', criadoEm: '' });
  assert.equal(T('pl2').nome, 'Plano X'); assert.equal(T('pl2').conj, 'coq');
  const at = T('ata1');
  assert.deepEqual(at.enc, [{ oque: 'Conferir faltas', quem: 'Pessoa Um', prazo: '2026-11-12', trat: 'mp_t2' }, { oque: 'Ajustar a escala', quem: 'Outro', prazo: '', trat: '' }]);
  assert.equal(T('ata2'), undefined); assert.ok(pl.erros.some(e => /Sem data/.test(e)));
});
test('rotina: só as tarefas marcadas (feita, não feita, andamento) vão para rotina/{pid}_{data}', () => {
  assert.deepEqual(pl.rotina.map(r => r.id).sort(), ['P01_2026-11-12', 'P03_2026-11-10']);
  const r = pl.rotina.find(x => x.id === 'P01_2026-11-12').dados;
  assert.deepEqual(r, { pid: 'P01', data: '2026-11-12', status: 'feita', passos: [true, false], obs: 'feito', feitaEm: '2026-11-12T17:00:00.000Z' });
  assert.equal(pl.rotina.find(x => x.id === 'P03_2026-11-10').dados.status, 'nfeita');
});
test('inspeções: área da Segurança, local em maiúsculas, item sem resposta = N/A, nota; sem data fica fora', () => {
  assert.equal(pl.insp.length, 1);
  const i = pl.insp[0];
  assert.equal(i.id, 'mp_in1');
  assert.deepEqual(i.dados, { tipo: 'seg', data: '2026-11-03', mes: '2026-11', area: 'BATERIA', conj: 'bateria', local: 'CDQ', itens: [{ t: 'EPI', r: 'ok', obs: '' }, { t: 'Área', r: 'no', obs: 'sem fita' }, { t: 'Piso', r: 'na', obs: '' }], nota: 50, obs: 'Trazida do Meu painel.' });
});
test('documentos: onde, responsável pelo nome; sem número e descrição vira aviso', () => {
  assert.equal(pl.docs.length, 1);
  assert.deepEqual(pl.docs[0], { id: 'mp_dc1', dados: { tipo: 'OM', numero: 'OM 1', titulo: 'Rolete', conj: 'bateria', resp: 'Pessoa Dois', emissao: '2026-11-01', validade: '2026-12-01', situacao: 'Em andamento', link: '', obs: '', criadoEm: '2026-11-01T08:00:00.000Z' } });
  assert.ok(pl.erros.some(e => /Documento/.test(e)));
});
test('medição: lançados e ocultos do Dikma pelo mesmo id; digitados com id novo; tipo/horas inválidos viram aviso', () => {
  const n = pl.med['2026-11'], o = pl.med['2026-10'];
  assert.deepEqual(Object.keys(n.l).sort(), ['dk_patio_10_2026-11-03', 'mp_r1']);
  assert.deepEqual(n.l['dk_patio_10_2026-11-03'], { por: 'admin', nome: 'Admin Teste', em: '2026-11-04T12:00' });
  assert.deepEqual(Object.keys(n.oc), ['dk_par_abc']);
  assert.equal(n.l['dk_bateria_1_2026-11-05'], undefined, 'não lançado não entra');
  assert.deepEqual({ ...n.man.mp_r1, em: '' }, { tipo: 'he', data: '2026-11-06', quem: 'Operador', conj: 'patio', horas: 2.5, desc: 'Cobertura', por: 'admin', nome: 'Admin Teste', em: '' });
  assert.equal(n.man.mp_r3.cat, 'Afastamento'); assert.match(n.man.mp_r3.desc, /Gestão geral.*era Inexistente/);
  assert.equal(n.man.mp_r4, undefined); assert.ok(pl.erros.some(e => /Medição 08\/11\/2026/.test(e)));
  assert.equal(o.man.mp_r2.st, 'corrigido'); assert.equal(o.man.mp_r2.cat, 'ICCP');
});
test('indicadores: só metas conhecidas e meses válidos; contar e o que falta no destino', () => {
  assert.deepEqual(pl.ind, { metas: { abs: 3, he: 180 }, valores: { '2026-10': { iccc: 96, iccp: null } } });
  assert.deepEqual(faltaInd(pl.ind, { metas: { abs: 2 }, valores: {} }), { metas: { he: 180 }, valores: { '2026-10': { iccc: 96, iccp: null } } });
  assert.deepEqual(faltaInd(pl.ind, { metas: { abs: 2, he: 1 }, valores: { '2026-10': { iccc: 90 } } }), { metas: {}, valores: {} });
  assert.deepEqual(faltaMed({ l: { a: 1, b: 2 }, oc: {}, man: { c: 3 } }, { l: { a: 9 } }), { l: { b: 2 }, man: { c: 3 } });
  assert.deepEqual(contarPlano(pl), { acoes: 4, planos: 2, atas: 1, rotina: 2, insp: 1, docs: 1, lanc: 2, ocul: 1, man: 3, metas: 2, valores: 1 });
  assert.deepEqual(pl.fora, { notas: 2, quedas: 1, relatorios: 0 });
});
test('anotações num texto, da mais nova para a mais antiga; painel vazio não quebra', () => {
  assert.match(textoNotas(PAINEL.notas), /Segunda[\s\S]*Primeira/);
  const v = planoDoPainel({}, QUEM, AGORA);
  assert.deepEqual(contarPlano(v), { acoes: 0, planos: 0, atas: 0, rotina: 0, insp: 0, docs: 0, lanc: 0, ocul: 0, man: 0, metas: 0, valores: 0 });
});
