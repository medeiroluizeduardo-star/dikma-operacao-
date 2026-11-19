// Testes das contas da Parte 2 das fotos (public/contas/fotos-arquivo.js): situação de cada foto, o que pode ir para a
// lixeira e ser apagado de vez, lotes, confirmação digitada, nomes de pastas do .zip, índice CSV, conferência do
// SHA-256, espaço e o conteúdo do relatório em PowerPoint. Não precisa do emulador:
// node --test testes/fotos-arquivo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as FA from '../public/contas/fotos-arquivo.js';
import { refCel } from '../public/contas/fotos.js';

const HOJE = '2026-11-12'; // quinta-feira
const SEM = 'RECEBIMENTO|2026-11-09';
const D = 864e5;
const AGORA = Date.parse('2026-11-12T10:00:00');
const foto = (x = {}) => ({ id: 'f1', semana: SEM, area: 'RECEBIMENTO', conj: 'patio', dia: '2026-11-10', k: 1, rota: 'ROTA 1', local: 'Moega 2', ativ: 'Limpeza da moega', sit: 'R',
  refs: [refCel(SEM, 'REC-001', 1)], porNome: 'LÍDER EXEMPLO', bytes: 120000, w: 1280, h: 960, sha: 'ab'.repeat(32), thumb: 'data:image/jpeg;base64,' + 'A'.repeat(4000),
  at: new Date('2026-11-10T08:15:00'), exportadoEm: null, exportLote: null, lixeiraEm: null, removidaEm: null, ...x });

test('situação da foto: no banco, exportada, na lixeira e arquivada fora do banco', () => {
  assert.equal(FA.statusFoto(foto()), 'banco');
  assert.equal(FA.statusFoto(foto({ exportadoEm: new Date() })), 'exportada');
  assert.equal(FA.statusFoto(foto({ exportadoEm: new Date(), lixeiraEm: new Date() })), 'lixeira');
  assert.equal(FA.statusFoto(foto({ exportadoEm: new Date(), lixeiraEm: new Date(), removidaEm: new Date() })), 'arquivada');
  assert.deepEqual(Object.values(FA.STATUS).map(s => s.t), ['No banco', 'Exportada', 'Na lixeira', 'Arquivada fora do banco']);
  // datas em qualquer formato (Date, texto, número, Timestamp)
  assert.equal(FA.ms('2026-11-10T00:00:00.000Z'), Date.parse('2026-11-10T00:00:00.000Z'));
  assert.equal(FA.ms({ toMillis: () => 5 }), 5);
  assert.equal(FA.diasNaLixeira(foto({ lixeiraEm: new Date(AGORA - 7.5 * D) }), AGORA), 7);
});

test('foto antiga (campo ref) vira refs; partes de uma ref', () => {
  assert.deepEqual(FA.refsDe({ ref: `${SEM}#REC-002|3` }), [`${SEM}|REC-002|3`]);
  assert.deepEqual(FA.refsDe(foto()), [`${SEM}|REC-001|1`]);
  assert.deepEqual(FA.refsDe({}), []);
  assert.deepEqual(FA.partesRef(`${SEM}|REC-001|1`), { semana: SEM, pid: 'REC-001', k: 1 });
});

test('o que pode apagar: só exportada vai para a lixeira; só a da lixeira há 7 dias sai de vez (ou marcando as recentes)', () => {
  const banco = foto({ id: 'a' });
  const exp = foto({ id: 'b', exportadoEm: new Date(AGORA - 3 * D), exportConf: 'ok' });
  const div = foto({ id: 'c', exportadoEm: new Date(AGORA - 3 * D), exportConf: 'divergente' });
  const lixNova = foto({ id: 'd', exportadoEm: new Date(AGORA - 9 * D), lixeiraEm: new Date(AGORA - 2 * D) });
  const lixVelha = foto({ id: 'e', exportadoEm: new Date(AGORA - 9 * D), lixeiraEm: new Date(AGORA - 8 * D) });
  const arq = foto({ id: 'f', exportadoEm: new Date(AGORA - 20 * D), lixeiraEm: new Date(AGORA - 15 * D), removidaEm: new Date(AGORA - 5 * D) });
  const todas = [banco, exp, div, lixNova, lixVelha, arq];
  assert.deepEqual(FA.separar(todas, 'exportar').sim.map(f => f.id), ['a', 'b', 'c']);
  const l = FA.separar(todas, 'lixeira');
  assert.deepEqual(l.sim.map(f => f.id), ['b'], 'só a exportada conferida vai em lote');
  assert.equal(l.nao.find(x => x.f.id === 'a').motivo, 'ainda não foi exportada');
  assert.equal(l.nao.find(x => x.f.id === 'c').motivo, 'SHA-256 divergente na exportação');
  assert.ok(FA.podeLixeira(div, { comDivergente: true }), 'sozinha, com confirmação, a divergente pode');
  assert.deepEqual(FA.separar(todas, 'apagar', { agora: AGORA }).sim.map(f => f.id), ['e']);
  assert.deepEqual(FA.separar(todas, 'apagar', { agora: AGORA, incluirRecentes: true }).sim.map(f => f.id), ['d', 'e']);
  assert.match(FA.separar([lixNova], 'apagar', { agora: AGORA }).nao[0].motivo, /menos de 7 dias/);
  assert.deepEqual(FA.separar(todas, 'restaurar').sim.map(f => f.id), ['d', 'e']);
  assert.equal(FA.podeExportar(arq), false, 'a arquivada já não tem a foto completa no banco');
});

test('lotes: 400 por lote para marcar e lixeira; 15 para apagar de vez (limite de leituras das regras)', () => {
  const ids = Array.from({ length: 1000 }, (_, i) => 'f' + i);
  assert.deepEqual(FA.emLotes(ids, 'lixeira').map(l => l.length), [400, 400, 200]);
  assert.deepEqual(FA.emLotes(ids, 'exportar').map(l => l.length), [400, 400, 200]);
  const ap = FA.emLotes(ids.slice(0, 40), 'apagar');
  assert.deepEqual(ap.map(l => l.length), [15, 15, 10]);
  assert.deepEqual(ap.flat(), ids.slice(0, 40), 'nenhuma foto some nem repete');
  assert.deepEqual(FA.emLotes([], 'apagar'), []);
  // lote da exportação: identificador legível, com data e hora
  assert.equal(FA.idLote(new Date(2026, 10, 10, 9, 5), 'Ab12'), 'EXP-20261110-0905-ab12');
});

test('confirmação digitada: a quantidade para a lixeira, "APAGAR n" para apagar de vez', () => {
  assert.equal(FA.textoConfirmacao('lixeira', 37), '37');
  assert.equal(FA.textoConfirmacao('apagar', 12), 'APAGAR 12');
  assert.ok(FA.confirmacaoOk(' 37 ', 'lixeira', 37));
  assert.ok(!FA.confirmacaoOk('36', 'lixeira', 37));
  assert.ok(FA.confirmacaoOk('apagar  12', 'apagar', 12));
  assert.ok(!FA.confirmacaoOk('APAGAR', 'apagar', 12));
  assert.ok(!FA.confirmacaoOk('0', 'lixeira', 0), 'nada para confirmar');
});

test('nomes de pastas do .zip: sem acento, sem caracteres proibidos, período/colaborador/atividade/data_id.jpg', () => {
  assert.equal(FA.limparNome('Preparação: "carvão" / moega*2?'), 'PREPARACAO CARVAO MOEGA 2');
  assert.equal(FA.limparNome(''), 'SEM NOME');
  assert.equal(FA.limparNome('a'.repeat(80), 10), 'AAAAAAAAAA');
  assert.equal(FA.limparNome('fim com ponto...'), 'FIM COM PONTO');
  assert.equal(FA.pastaPeriodo('2026-11-09', '2026-11-15'), '2026-11-09_a_2026-11-15');
  const f = foto({ id: 'Xy9', porNome: 'José da Silva' });
  const itens = [{ rota: 'ROTA 1', local: 'Moega 2', ativ: 'Limpeza da moega' }];
  assert.equal(FA.caminhoZip(f, itens, '2026-11-09', '2026-11-15'), '2026-11-09_a_2026-11-15/JOSE DA SILVA/ROTA 1 - MOEGA 2 - LIMPEZA DA MOEGA/2026-11-10_Xy9.jpg');
  // foto de várias atividades (Marcar restantes) fica uma vez só
  assert.equal(FA.pastaAtividade(f, [itens[0], { ...itens[0], ativ: 'Outra' }, { ...itens[0], ativ: 'Mais uma' }]), 'ROTA 1 - VARIAS ATIVIDADES (3)');
  assert.equal(FA.nomeArquivo({ dia: '2026-11-10', id: 'a/b..c' }), '2026-11-10_abc.jpg');
  const sem = FA.caminhoZip(foto({ porNome: '' }), [], '2026-11-09', '2026-11-15');
  assert.match(sem, /\/SEM COLABORADOR\/ROTA 1 - MOEGA 2 - LIMPEZA DA MOEGA\//);
});

test('índice CSV: cabeçalho, uma linha por foto e atividade, ponto e vírgula, aspas e proteção contra fórmula', () => {
  const f1 = foto({ id: 'f1' });
  const f2 = foto({ id: 'f2', porNome: 'Ana; "Bia"', sha: '' });
  const itens = f => (f.id === 'f2' ? [{ rota: 'ROTA 1', local: 'L1', ativ: '=SOMA(A1)', sit: 'R' }, { rota: 'ROTA 1', local: 'L2', ativ: 'Varrer', sit: 'E' }] : [{ rota: 'ROTA 1', local: 'Moega 2', ativ: 'Limpeza da moega', sit: 'R' }]);
  const linhas = FA.linhasIndice([f1, f2], { itensDe: itens, caminhoDe: f => `p/${f.id}.jpg`, confDe: f => (f.id === 'f1' ? 'ok' : FA.conferirSha(f.sha, 'cd'.repeat(32))), lote: 'EXP-1' });
  assert.equal(linhas.length, 3, 'f2 vale para 2 atividades: 2 linhas, mesmo arquivo');
  const csv = FA.gerarCsv(linhas);
  assert.ok(csv.startsWith('﻿id;data;area;rota;local;atividade;situacao;colaborador;sha256;arquivo;conferencia;lote;antes_depois\r\n'));
  const lido = FA.lerCsv(csv);
  assert.deepEqual(lido[0], FA.CSV_CAB);
  assert.deepEqual(lido[1], ['f1', '2026-11-10', 'RECEBIMENTO', 'ROTA 1', 'Moega 2', 'Limpeza da moega', 'Realizada', 'LÍDER EXEMPLO', 'ab'.repeat(32), 'p/f1.jpg', 'conferida', 'EXP-1', '']);
  assert.equal(lido[2][5], "'=SOMA(A1)", 'fórmula vira texto');
  assert.equal(lido[2][7], 'Ana; "Bia"');
  assert.equal(lido[2][10], 'sem SHA gravado (não conferida)');
  assert.equal(lido[3][6], 'Extra');
  assert.equal(lido[3][9], 'p/f2.jpg');
  assert.equal(lido.length, 4);
});

test('conferência do SHA-256: ok, divergente, sem sha gravado e sem arquivo', () => {
  assert.equal(FA.conferirSha('AB'.repeat(32), 'ab'.repeat(32)), 'ok');
  assert.equal(FA.conferirSha('ab'.repeat(32), 'cd'.repeat(32)), 'divergente');
  assert.equal(FA.conferirSha('', 'cd'.repeat(32)), 'sem-sha');
  assert.equal(FA.conferirSha('ab'.repeat(32), null), 'sem-arquivo');
  assert.match(FA.CONF_TXT.divergente, /DIVERGENTE/);
});

test('espaço no banco: foto completa em texto (4/3) + miniatura; arquivada ocupa só o leve', () => {
  const b = foto({ bytes: 150000 });
  const a = foto({ bytes: 150000, exportadoEm: 1, lixeiraEm: 1, removidaEm: 1 });
  const l = foto({ bytes: 90000, exportadoEm: 1, lixeiraEm: AGORA - 8 * D });
  assert.equal(FA.bytesArquivo(b), 200000);
  const r = FA.resumoEspaco([b, a, l], AGORA);
  assert.equal(r.n, 3);
  assert.equal(r.por.banco.n, 1); assert.equal(r.por.arquivada.n, 1); assert.equal(r.por.lixeira.n, 1);
  assert.equal(r.por.arquivada.bytes, FA.bytesLeve(a), 'arquivada: só miniatura e campos');
  assert.equal(r.liberavel, 120000); assert.equal(r.prontas, 1);
  assert.equal(FA.fmtBytes(512), '512 B'); assert.equal(FA.fmtBytes(2048), '2 KB'); assert.equal(FA.fmtBytes(1.5 * 1024 * 1024), '1,5 MB');
});

test('período: semana padrão (segunda a domingo), meses, semanas e validação', () => {
  assert.deepEqual(FA.periodoSemana(HOJE), { de: '2026-11-09', ate: '2026-11-15' });
  assert.deepEqual(FA.periodoSemana(HOJE, -1), { de: '2026-11-02', ate: '2026-11-08' });
  assert.deepEqual(FA.mesesDoPeriodo('2026-11-28', '2027-01-03'), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(FA.semanasDoPeriodo('2026-11-28', '2026-12-08'), ['2026-11-23', '2026-11-30', '2026-12-07']);
  assert.deepEqual(FA.mesesDasSemanas('2026-11-28', '2026-12-08'), ['2026-11', '2026-12']);
  assert.equal(FA.validarPeriodo('2026-11-09', '2026-11-15'), '');
  assert.match(FA.validarPeriodo('2026-11-15', '2026-11-09'), /antes da inicial/);
  assert.match(FA.validarPeriodo('2026-01-01', '2026-11-09'), /até 3 meses/);
  assert.match(FA.validarPeriodo('', '2026-11-09'), /datas/);
});

// Semana de exemplo: 4 atividades (2 da ROTA 1, 2 da ROTA 2); seg a qui apontados.
const PLANO = new Map([
  ['REC-001', { id: 'REC-001', rota: 'ROTA 1', local: 'Moega 2', ativ: 'Limpeza da moega', tipo: 'L' }],
  ['REC-002', { id: 'REC-002', rota: 'ROTA 1', local: 'Correia 3', ativ: 'Varrição da correia', tipo: 'L' }],
  ['REC-003', { id: 'REC-003', rota: 'ROTA 2', local: 'Pátio', ativ: 'Recolher resíduos', tipo: 'L' }],
  ['REC-004', { id: 'REC-004', rota: 'ROTA 2', local: 'Galpão', ativ: 'Lavar piso', tipo: 'L' }]
]);
const semana = () => ({ [SEM]: { id: SEM, area: 'RECEBIMENTO', ini: '2026-11-09', ids: ['REC-001', 'REC-002', 'REC-003', 'REC-004', 'FORA-PLANO'],
  d: ['RRRP___', 'RNP____', '_E_R___', 'PPPPP__', 'RRRR___'], m: { 'REC-002|1': 'Equipamento parado' },
  ft: { 'REC-001|0': 1, 'REC-001|1': 2, 'REC-003|1': 1 }, ev: { 'REC-002|0': 1 } } });

test('relatório: indicadores do período (programadas, realizadas, não realizadas, extras, % cumprimento, % com foto) e por rota', () => {
  const rel = FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos: [], de: '2026-11-09', ate: '2026-11-15', hoje: HOJE });
  // até quinta (hoje): REC-001 R R R P · REC-002 R N P · REC-003 E R · REC-004 P P P P (FORA-PLANO não conta)
  assert.equal(rel.fim, HOJE);
  assert.deepEqual({ prog: rel.ind.prog, R: rel.ind.R, N: rel.ind.N, P: rel.ind.P, E: rel.ind.E }, { prog: 12, R: 5, N: 1, P: 6, E: 1 });
  assert.equal(rel.ind.cumpr, 42); // 5 de 12
  // exigem foto: R e E = 6; com foto (ft/ev): REC-001 seg e ter, REC-002 seg (ev antigo), REC-003 ter (extra) = 4
  assert.equal(rel.ind.exigem, 6); assert.equal(rel.ind.comFoto, 4); assert.equal(rel.ind.pctFoto, 67);
  const r1 = rel.porRota.find(r => r.rota === 'ROTA 1'), r2 = rel.porRota.find(r => r.rota === 'ROTA 2');
  assert.deepEqual([r1.prog, r1.R, r1.N, r1.cumpr, r1.pctFoto], [7, 4, 1, 57, 75]);
  assert.deepEqual([r2.prog, r2.R, r2.E, r2.cumpr, r2.pctFoto], [5, 1, 1, 20, 50]);
  assert.deepEqual(rel.naoReal, [{ dia: '2026-11-10', area: 'RECEBIMENTO', rota: 'ROTA 1', local: 'Correia 3', ativ: 'Varrição da correia', motivo: 'Equipamento parado' }]);
  assert.deepEqual(rel.semFoto.map(x => x.dia + ' ' + x.ativ), ['2026-11-11 Limpeza da moega', '2026-11-12 Recolher resíduos']);
  // filtro por rota
  const so2 = FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos: [], de: '2026-11-09', ate: '2026-11-15', hoje: HOJE, rota: 'ROTA 2' });
  assert.equal(so2.ind.prog, 5); assert.equal(so2.porRota.length, 1);
  // período passado inteiro (hoje depois do fim)
  assert.equal(FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos: [], de: '2026-11-09', ate: '2026-11-15', hoje: '2026-12-01' }).ind.prog, 13);
});

test('relatório: fotos agrupadas por atividade e dia (foto de várias atividades fica num grupo só); lixeira fora; arquivada entra', () => {
  const fotos = [
    foto({ id: 'a', at: new Date('2026-11-10T09:00:00') }),
    foto({ id: 'b', at: new Date('2026-11-10T08:00:00') }),
    foto({ id: 'c', dia: '2026-11-09', k: 0, refs: [refCel(SEM, 'REC-001', 0), refCel(SEM, 'REC-002', 0)], ativ: '2 atividades: x; y', porNome: 'OUTRO LÍDER' }),
    foto({ id: 'd', exportadoEm: 1, lixeiraEm: 1 }),
    foto({ id: 'e', dia: '2026-11-10', k: 1, refs: [refCel(SEM, 'REC-003', 1)], rota: 'ROTA 2', exportadoEm: 1, lixeiraEm: 1, removidaEm: 1 }),
    foto({ id: 'g', dia: '2026-11-20' }) // fora do período
  ];
  const rel = FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos, de: '2026-11-09', ate: '2026-11-15', hoje: HOJE });
  assert.equal(rel.nFotos, 4);
  assert.deepEqual(rel.grupos.map(g => [g.dia, g.rota, g.titulo, g.fotos.map(f => f.id).join(',')]), [
    ['2026-11-09', 'ROTA 1', '2 atividades', 'c'],
    ['2026-11-10', 'ROTA 1', 'Limpeza da moega', 'b,a'],
    ['2026-11-10', 'ROTA 2', 'Recolher resíduos', 'e']
  ]);
  const g0 = rel.grupos[0];
  assert.deepEqual(g0.itens.map(x => [x.ativ, x.sit]), [['Limpeza da moega', 'R'], ['Varrição da correia', 'R']]);
  assert.equal(g0.local, 'Moega 2; Correia 3'); assert.deepEqual(g0.colabs, ['OUTRO LÍDER']);
  assert.equal(rel.grupos[2].sit, 'E', 'situação vem da semana (extra)');
  // itens da foto pelo plano
  assert.deepEqual(FA.itensDaFoto(fotos[0], { plano: PLANO, semanas: semana() }).map(x => x.local), ['Moega 2']);
  // rota filtra os grupos
  assert.deepEqual(FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos, de: '2026-11-09', ate: '2026-11-15', hoje: HOJE, rota: 'ROTA 2' }).grupos.length, 1);
  // área filtra os grupos e os indicadores
  const outra = FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos, de: '2026-11-09', ate: '2026-11-15', hoje: HOJE, areas: ['PREPARAÇÃO'] });
  assert.equal(outra.grupos.length, 0); assert.equal(outra.ind.prog, 0);
  assert.equal(FA.montarRelatorio({ semanas: semana(), plano: PLANO, fotos, de: '2026-11-09', ate: '2026-11-15', hoje: HOJE, areas: ['RECEBIMENTO'] }).grupos.length, 3);
});

test('relatório no modelo da Dikma: semana do ano, período por extenso e Antes/Depois pela hora', () => {
  assert.equal(FA.semanaISO('2026-11-16'), 47); assert.equal(FA.semanaISO('2026-11-22'), 47);
  assert.equal(FA.semanaISO('2026-01-01'), 1); assert.equal(FA.semanaISO('2027-01-03'), 53);
  assert.equal(FA.textoSemanas('2026-11-16', '2026-11-22'), 'Semana: 47');
  assert.equal(FA.textoSemanas('2026-11-09', '2026-11-22'), 'Semanas: 46 a 47');
  assert.equal(FA.periodoExtenso('2026-11-16', '2026-11-22'), '16 a 22 de novembro de 2026');
  assert.equal(FA.periodoExtenso('2026-10-26', '2026-11-01'), '26 de outubro a 1 de novembro de 2026');
  assert.equal(FA.periodoExtenso('2026-12-28', '2027-01-03'), '28 de dezembro de 2026 a 3 de janeiro de 2027');
  assert.equal(FA.periodoExtenso('2026-11-16', '2026-11-16'), '16 de novembro de 2026');
  assert.equal(FA.ehSemanaCheia('2026-11-16', '2026-11-22'), true);
  assert.equal(FA.ehSemanaCheia('2026-11-17', '2026-11-23'), false);
  assert.equal(FA.ehSemanaCheia('2026-11-16', '2026-11-20'), false);
  assert.deepEqual([0].map(i => FA.marcaFoto(i, 1)), ['']);
  assert.deepEqual([0, 1].map(i => FA.marcaFoto(i, 2)), ['Antes', 'Depois']);
  assert.deepEqual([0, 1, 2, 3].map(i => FA.marcaFoto(i, 4)), ['Antes', 'Durante', 'Durante', 'Depois']);
  // marcação escolhida no Apontar (fase) vale sobre a hora; grupo sem marcação continua pela hora
  const at = h => new Date(`2026-11-19T${h}:00`);
  const velhas = [{ at: at('08:00') }, { at: at('09:00') }, { at: at('10:00') }];
  assert.deepEqual(velhas.map(f => FA.marcaDaFoto(f, velhas)), ['Antes', 'Durante', 'Depois']);
  const novas = [{ at: at('08:00'), fase: 'depois' }, { at: at('09:00'), fase: 'antes' }, { at: at('10:00') }];
  novas.sort(FA.ordemFotos);
  assert.deepEqual(novas.map(f => f.fase || ''), ['antes', '', 'depois'], 'antes primeiro, depois no fim');
  assert.deepEqual(novas.map(f => FA.marcaDaFoto(f, novas)), ['Antes', '', 'Depois']);
  const so1 = [{ at: at('08:00'), fase: 'depois' }];
  assert.equal(FA.marcaDaFoto(so1[0], so1), 'Depois', 'uma foto só, marcada, sai com a marca');
});

test('relatório: limite de fotos (rodízio entre as atividades, espalhado pelo período) e posição das fotos no slide', () => {
  const g = (n, id) => ({ chave: id, fotos: Array.from({ length: n }, (_, i) => ({ id: id + i })) });
  const grupos = [g(10, 'a'), g(2, 'b'), g(6, 'c')];
  assert.equal(FA.limitarFotos(grupos, 50).fora, 0);
  const l = FA.limitarFotos(grupos, 12);
  assert.equal(l.fora, 6); assert.equal(l.total, 18);
  assert.deepEqual(l.grupos.map(x => x.fotos.length), [5, 2, 5]);
  const l2 = FA.limitarFotos(grupos, 5);
  assert.deepEqual(l2.grupos.map(x => x.fotos.length), [2, 2, 1]);
  assert.equal(l2.fora, 13);
  // mais atividades que o limite: uma foto de atividades espalhadas (a primeira e as do fim do período entram)
  const muitos = Array.from({ length: 10 }, (_, i) => g(2, 'g' + i));
  const l3 = FA.limitarFotos(muitos, 4);
  assert.deepEqual(l3.grupos.map(x => x.chave), ['g0', 'g2', 'g5', 'g7']);
  assert.equal(l3.fora, 16);
  assert.deepEqual(FA.paginar([1, 2, 3, 4, 5, 6, 7, 8, 9], 4), [[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
  // 1 foto ocupa a caixa toda; 2 lado a lado; 3 e 4 em grade 2 × 2
  const cx = { x: 0, y: 0, w: 10, h: 5 };
  assert.equal(FA.gradeFotos(1, cx, 0.3, 0.2)[0].w, 10);
  assert.deepEqual(FA.gradeFotos(2, cx, 0.3, 0.2).map(p => [Math.round(p.x * 100) / 100, p.y]), [[0, 0], [5.1, 0]]);
  const g4 = FA.gradeFotos(4, cx, 0.3, 0.2); assert.equal(g4.length, 4); assert.equal(Math.round(g4[3].y * 100) / 100, 2.6);
  // encaixar sem deformar: foto em pé numa caixa deitada fica centralizada
  const e = FA.encaixar(960, 1280, { x: 0, y: 0, w: 8, h: 4 });
  assert.equal(e.h, 4); assert.equal(e.w, 3); assert.equal(e.x, 2.5);
});

test('slides de fotos: atividade com 4 ou mais fotos em slides próprios; as com poucas fotos do mesmo dia e rota dividem o slide', () => {
  const g = (id, n, dia = '2026-11-10', rota = 'ROTA 1') => ({ chave: id, dia, rota, fotos: Array.from({ length: n }, (_, i) => ({ id: id + i })) });
  const p = FA.paginasFotos([g('a', 1), g('b', 2), g('c', 2), g('d', 6), g('e', 1, '2026-11-10', 'ROTA 2'), g('f', 1, '2026-11-11', 'ROTA 2')]);
  assert.deepEqual(p.map(x => x.fotos.map(y => y.f.id).join(',')), ['a0,b0,b1', 'c0,c1', 'd0,d1,d2,d3', 'd4,d5', 'e0', 'f0']);
  assert.deepEqual(p.map(x => x.grupos.length), [2, 1, 1, 1, 1, 1]);
  assert.deepEqual(p[3].parte, [2, 2]);
  assert.equal(p[0].parte, null);
  assert.equal(p.reduce((s, x) => s + x.fotos.length, 0), 13, 'nenhuma foto some');
  assert.ok(p.every(x => x.fotos.length <= 4));
});

test('relatórios separados: fotos da queda zero (atividade QZ-…) e das atividades', () => {
  const ativ = { id: 'a', refs: ['RECEBIMENTO|2026-11-09|P12|2'] };
  const qz = { id: 'q', refs: ['RECEBIMENTO|2026-11-09|QZ-P12-2|2'] };
  const antiga = { id: 'v', ref: 'RECEBIMENTO|2026-11-09#P12|2' };
  assert.equal(FA.ehQZ(qz), true); assert.equal(FA.ehQZ(ativ), false); assert.equal(FA.ehQZ(antiga), false);
  assert.deepEqual(FA.doTipo([ativ, qz, antiga], 'ativ').map(f => f.id), ['a', 'v']);
  assert.deepEqual(FA.doTipo([ativ, qz, antiga], 'qz').map(f => f.id), ['q']);
  assert.deepEqual(FA.doTipo(null, 'qz'), []);
});

test('relatórios separados: fotos das OMs (atividade OM-…)', () => {
  const om = { id: 'o', refs: ['RECEBIMENTO|2026-11-16|OM-abc|3'] };
  const ativ = { id: 'a', refs: ['RECEBIMENTO|2026-11-16|P12|3'] };
  assert.equal(FA.ehOM(om), true); assert.equal(FA.tipoFoto(om), 'om'); assert.equal(FA.tipoFoto(ativ), 'ativ');
  assert.deepEqual(FA.doTipo([om, ativ], 'om').map(f => f.id), ['o']);
  assert.deepEqual(FA.doTipo([om, ativ], 'ativ').map(f => f.id), ['a'], 'as fotos das OMs não entram no relatório das atividades');
});
