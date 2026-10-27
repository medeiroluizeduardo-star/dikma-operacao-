// Testes da conta única de presença (public/situacao.js) e das contas que dependem dela (hoje.js, aprovacao.js,
// acessos.js). Não precisa do emulador: node --test testes/situacao.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODIGOS, SITS, NOMES_CODIGO, AUSENTE, AUSENCIA, PARCIAL, AUS_COBRIVEL, CODIGOS_LANC, JUS_CODS, CONTA, SIT_OPERACAO,
  textoOperacao, presente, situacaoDoDia, contagemDia, criarTurmaFicha, feriadosOperacao
} from '../public/situacao.js';
import * as cal from '../public/cal.js';
import * as presenca from '../public/presenca.js';
import { NOMES_CODIGO as NOMES_PLANILHA } from '../public/planilhas-adm.js';
import { criarEscala } from '../public/escala.js';
import { listaAtrasadas, efetivoRota, coberturasDoDia, resumoAtividades, resumoSemana, JANELA_ATRASADAS } from '../public/hoje.js';
import { listarAprov, contarPendentes } from '../public/aprovacao.js';
import { resumoFerias, indiceDesligados, resumoDesligados, indiceFerias } from '../public/acessos.js';

// ---------- tabela única de códigos ----------
test('tabela de códigos: as listas antigas saem dela, com o mesmo conteúdo e a mesma ordem', () => {
  assert.deepEqual(SITS, [['P', 'Presente'], ['F', 'Folga'], ['FE', 'Férias'], ['AT', 'Atestado'], ['AF', 'Afastado'], ['TR', 'Treinamento'], ['FT', 'Falta'], ['DS', 'Desligado'], ['HE', 'Hora extra'], ['ATR', 'Atrasado'], ['SA', 'Saída antecipada'], ['AB', 'Abono'], ['SP', 'Suspensão']]);
  assert.deepEqual([...AUSENTE].sort(), ['AB', 'AF', 'AT', 'DS', 'F', 'FE', 'FT', 'SP', 'TR']);
  assert.deepEqual([...AUSENCIA].sort(), ['AB', 'AF', 'AT', 'FT', 'SP', 'TR']);
  assert.deepEqual([...PARCIAL].sort(), ['ATR', 'SA']);
  assert.deepEqual([...AUS_COBRIVEL].sort(), ['AF', 'AT', 'F', 'FE', 'FT', 'TR']);
  assert.deepEqual(CODIGOS_LANC, ['P', 'F', 'FT', 'ATR', 'SA', 'AT', 'AB', 'HE', 'FE', 'AF', 'TR', 'SP', 'DS']);
  assert.deepEqual(JUS_CODS, ['FT', 'ATR', 'SA', 'AT', 'AF', 'AB', 'SP', 'TR']);
  assert.deepEqual(CONTA, ['FT', 'ATR', 'SA', 'AT', 'AB', 'SP', 'HE']);
  assert.deepEqual(SIT_OPERACAO, { F: 'FOLGA', FE: 'FÉRIAS', AT: 'ATESTADO MÉDICO', AF: 'AFASTAMENTO (INSS)', TR: 'TREINAMENTO', FT: 'FALTA', DS: 'DESLIGADO', AB: 'ABONO', SP: 'SUSPENSÃO' });
  for (const c of ['P', 'HE', 'ATR', 'SA']) assert.equal(textoOperacao(c), null, c + ' = trabalhando');
  assert.equal(textoOperacao('XX'), 'OUTRO');
  // ausência de verdade é sempre ausente; parcial nunca é ausente
  for (const c of AUSENCIA) assert.ok(AUSENTE.has(c));
  for (const c of PARCIAL) assert.ok(!AUSENTE.has(c) && presente(c));
  assert.ok(!presente('') && !presente('DS') && presente('P') && presente('HE'));
  // cada código tem nome; quem pede justificativa tem nome no plural quando entra no resumo semanal
  for (const [c, x] of Object.entries(CODIGOS)) assert.ok(x.nome, c);
  for (const c of AUSENCIA) assert.ok(CODIGOS[c].plural, c);
});

test('tabela de códigos: os nomes antigos continuam exportados (cal, presenca, planilhas-adm)', () => {
  assert.equal(cal.SITS, SITS); assert.equal(cal.AUSENTE, AUSENTE); assert.equal(cal.AUSENCIA, AUSENCIA);
  assert.equal(presenca.CODIGOS_LANC, CODIGOS_LANC); assert.equal(presenca.JUS_CODS, JUS_CODS);
  assert.equal(NOMES_PLANILHA, NOMES_CODIGO);
  assert.equal(NOMES_CODIGO.SA, 'Saída antecipada');
});

// ---------- situação do dia ----------
// 4x4 (DDNN) turma A a partir de 01/10/2026 e 3x3 (DDN) turma I a partir de 01/10/2026
const E = criarEscala({ regimes: { '4x4': { turmas: { A: '2026-10-01', B: '2026-10-05' } }, '3x3': { turmas: { I: '2026-10-01', J: '2026-10-04' } } }, feriados: [{ data: '2026-11-20', desc: 'Consciência Negra' }] }, {},
  feriadosOperacao({ feriados: [{ data: '2026-11-02', desc: 'Finados', semOp: true }, { data: '2026-11-15', desc: 'República', semOp: false }, { data: '2026-10-12', desc: 'Padroeira' }] }));
const base = { escala: E };

test('situacaoDoDia: 4x4 pela letra (2 dias, 2 noites, 4 de folga)', () => {
  const p = { id: 'C1', nome: 'Ana', regime: 'TURNO 4X4', turma: 'A' };
  const dia = d => situacaoDoDia(p, d, base);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => dia(`2026-10-0${n}`).v), ['P', 'P', 'P', 'P', 'F', 'F', 'F', 'F', 'P']);
  assert.equal(dia('2026-10-01').periodo, 'D'); assert.equal(dia('2026-10-03').periodo, 'N');
  assert.equal(dia('2026-10-05').por, 'escala'); assert.equal(dia('2026-10-05').auto, true);
  assert.match(dia('2026-10-05').motivo, /turma A/);
});

test('situacaoDoDia: 3x3 pela letra (2 dias, 1 noite, 3 de folga)', () => {
  const p = { id: 'B1', nome: 'Bia', regime: '3X3', turma: 'I' };
  const r = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map(d => situacaoDoDia(p, d, base));
  assert.deepEqual(r.map(x => x.v), ['P', 'P', 'P', 'F', 'F', 'F', 'P']);
  assert.deepEqual(r.slice(0, 3).map(x => x.periodo), ['D', 'D', 'N']);
});

test('situacaoDoDia: administrativo folga no fim de semana e nos feriados (os da Operação só com "sem operação")', () => {
  const p = { id: 'C2', nome: 'Caio', regime: 'ADMINISTRATIVO' };
  const v = d => situacaoDoDia(p, d, base).v;
  assert.equal(v('2026-10-28'), 'P'); // quarta
  assert.equal(v('2026-10-31'), 'F'); // sábado
  assert.equal(v('2026-11-02'), 'F'); // feriado da Operação sem operação
  assert.equal(v('2026-11-20'), 'F'); // feriado de Escalas e turnos
  assert.equal(v('2026-10-12'), 'P'); // feriado da Operação sem "sem operação": trabalha (mesma regra do eqcalc)
  assert.equal(situacaoDoDia(p, '2026-11-02', base).motivo, 'Finados');
  assert.equal(situacaoDoDia(p, '2026-10-28', base).periodo, '');
});

test('situacaoDoDia: férias, lançamento e a ordem entre eles', () => {
  const p = { id: 'C3', nome: 'Dora', mat: '77', regime: 'ADMINISTRATIVO' };
  const ferias = indiceFerias([{ mat: '77', nome: 'DORA', inicio: '2026-10-26', termino: '2026-11-04' }]);
  const lanc = { 'C3|2026-10-27': 'HE' };
  const f = { ...base, ferias, lancado: (x, d) => lanc[x.id + '|' + d] };
  assert.deepEqual(situacaoDoDia(p, '2026-10-26', f), { v: 'FE', auto: true, por: 'ferias', periodo: '' });
  assert.equal(situacaoDoDia(p, '2026-10-27', f).v, 'HE'); // o lançado vale mais
  assert.equal(situacaoDoDia(p, '2026-10-27', f).por, 'lancado');
  assert.equal(situacaoDoDia(p, '2026-10-31', f).v, 'FE'); // férias vale mais que o fim de semana
  assert.equal(situacaoDoDia(p, '2026-11-05', f).v, 'P');
});

test('situacaoDoDia: demissão na ficha vira DS automático a partir da data', () => {
  const fichas = [{ mat: '501', nome: 'Érico Lima', dem: '2026-10-20' }, { mat: '', nome: 'Sem Matrícula', dem: '2026-10-10' }];
  const dem = indiceDesligados(fichas);
  const f = { ...base, desligadoEm: dem };
  const p = { id: 'C4', nome: 'ERICO LIMA', mat: '501', regime: 'ADM' };
  assert.equal(situacaoDoDia(p, '2026-10-19', f).v, 'P');
  assert.deepEqual(situacaoDoDia(p, '2026-10-20', f), { v: 'DS', auto: true, por: 'desligado', periodo: '' });
  assert.equal(situacaoDoDia(p, '2026-10-24', f).v, 'DS'); // sábado: desligado, não folga
  assert.equal(situacaoDoDia({ nome: 'sem matricula' }, '2026-10-12', f).v, 'DS'); // sem matrícula: pelo nome
  assert.equal(situacaoDoDia({ ...p, id: 'X' }, '2026-10-21', { ...f, lancado: () => 'HE' }).v, 'HE'); // o lançado ainda vale mais
  assert.deepEqual(resumoDesligados([...fichas, { nome: 'Ativo', dem: null }]).map(x => x.nome), ['Sem Matrícula', 'Érico Lima']);
});

test('situacaoDoDia: turma pela ficha quando a pessoa não tem letra (uma regra só)', () => {
  const p = { id: 'C5', nome: 'José  da Silva', regime: '4x4', turma: '' };
  assert.equal(situacaoDoDia(p, '2026-10-05', base).v, 'P');
  assert.equal(situacaoDoDia(p, '2026-10-05', base).semTurma, true);
  const turmaFicha = criarTurmaFicha([{ nome: 'JOSE DA SILVA', turma: 'A' }], [{ nome: 'José da Silva', turma: 'B', escala: '4x4' }]);
  assert.equal(turmaFicha('José da Silva'), 'A'); // a ficha vale mais que o cadastro da Operação
  const f = { ...base, turmaFicha };
  assert.equal(situacaoDoDia(p, '2026-10-05', f).v, 'F');
  assert.equal(situacaoDoDia({ ...p, turma: 'B' }, '2026-10-05', f).v, 'P'); // com letra própria, vale a dela
  assert.equal(criarTurmaFicha([], [{ nome: 'Op', turma: 'C', escala: 'ADM' }])('Op'), ''); // operador fora do 4x4 não dá turma
});

test('situacaoDoDia: dia futuro sem lançamento fica vazio quando pedido (folha de frequência)', () => {
  const p = { id: 'C6', nome: 'Edu', regime: 'ADM' };
  assert.equal(situacaoDoDia(p, '2026-10-28', { ...base, hoje: '2026-10-27' }).v, '');
  assert.equal(situacaoDoDia(p, '2026-10-27', { ...base, hoje: '2026-10-27' }).v, 'P');
  assert.equal(situacaoDoDia(p, '2026-10-31', { ...base, hoje: '2026-10-27' }).v, 'F');
});

// ---------- contagem do dia ----------
test('contagemDia: quadro, folga, férias, escalados, ausentes e presentes', () => {
  const ps = ['P', 'F', 'Fl', 'FE', 'FT', 'AT', 'ATR', 'HE', 'DS', 'SA', ''].map((v, i) => ({ id: 'X' + i, v }));
  const sitDe = p => (p.v === 'Fl' ? { v: 'F', por: 'lancado' } : p.v === 'P' || p.v === 'HE' ? { v: p.v, periodo: p.v === 'P' ? 'D' : 'N' } : { v: p.v });
  const r = contagemDia(ps, '2026-10-27', { sitDe });
  assert.equal(r.desligados, 1);
  assert.equal(r.quadro, 10);
  assert.equal(r.folga, 2); // da escala e lançada
  assert.equal(r.ferias, 1);
  assert.equal(r.escalados, 7);
  assert.equal(r.ausentes, 2);
  assert.equal(r.presentes, 4); // P, ATR, HE, SA (o vazio é dia futuro: escalado, ainda sem presença)
  assert.equal(r.parciais, 2);
  assert.deepEqual(r.porCodigo, { FT: 1, AT: 1, ATR: 1, SA: 1 });
  assert.deepEqual(r.periodo, { D: 1, N: 1 });
});

test('contagemDia: sem sitDe usa a situacaoDoDia (mesmo número em qualquer tela)', () => {
  const ps = [{ id: 'A', nome: 'A', regime: '4x4', turma: 'A' }, { id: 'B', nome: 'B', regime: '4x4', turma: 'B' }, { id: 'C', nome: 'C', regime: 'ADM' }];
  const lanc = { 'C|2026-10-02': 'FT' };
  const r = contagemDia(ps, '2026-10-02', { ...base, lancado: (p, d) => lanc[p.id + '|' + d] });
  assert.deepEqual([r.quadro, r.folga, r.escalados, r.ausentes, r.presentes], [3, 1, 2, 1, 1]);
});

// ---------- contas que usam a situação ----------
test('efetivoRota: disponíveis com as coberturas e déficit (Dimensionamento = Meu dia = aviso)', () => {
  const r = { area: 'RECEBIMENTO', rota: 'RECEBIMENTO', ef: 3, carga: 30 };
  const cs = [{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }];
  const sit = { C1: { v: 'P' }, C2: { v: 'FT' }, C3: { v: 'P' } };
  const sem = efetivoRota(r, { cs, prog: 30, sitDe: c => sit[c.id] });
  assert.deepEqual([sem.disp, sem.nec, sem.deficit], [2, 3, true]);
  const cob = coberturasDoDia({ 'C2|2026-10-28': 'C9', 'C2|2026-10-29': 'C8' }, '2026-10-28');
  assert.deepEqual(cob, [{ aus: 'C2', sub: 'C9' }]);
  const com = efetivoRota(r, { cs, prog: 30, sitDe: c => sit[c.id], cob, subOk: s => s === 'C9' });
  assert.deepEqual([com.disp, com.deficit], [3, false]);
  // quem sai desta rota para cobrir outra, sai daqui
  const sai = efetivoRota(r, { cs, prog: 30, sitDe: c => sit[c.id], cob: [{ aus: 'Z1', sub: 'C1' }] });
  assert.equal(sai.disp, 1);
  // GESTÃO nunca entra como déficit
  assert.equal(efetivoRota({ ...r, rota: 'GESTÃO', carga: 0 }, { cs, prog: 1, sitDe: c => sit[c.id] }).deficit, false);
});

test('resumoAtividades: déficit de amanhã considera a cobertura gravada', () => {
  const hoje = '2026-10-27', amanha = '2026-10-28', ini = '2026-10-26';
  const doc = { area: 'RECEBIMENTO', ini, ids: ['R1'], s: { R1: 'PPPPPPP' } };
  const d = {
    areas: ['RECEBIMENTO'], plano: [{ id: 'R1', rota: 'REC' }], semanas: { ['RECEBIMENTO|' + ini]: doc }, hoje,
    colabs: [{ id: 'C1', area: 'RECEBIMENTO', rota: 'REC' }, { id: 'C2', area: 'RECEBIMENTO', rota: 'REC' }, { id: 'C9', area: 'PREPARAÇÃO', rota: 'X' }],
    sit: { ['C2|' + amanha]: 'FT' }, rotas: [{ area: 'RECEBIMENTO', rota: 'REC', ef: 2, carga: 1 }]
  };
  assert.equal(resumoAtividades(d).deficit.length, 1);
  assert.equal(resumoAtividades({ ...d, cob: { ['C2|' + amanha]: 'C9' } }).deficit.length, 0);
  assert.equal(resumoAtividades({ ...d, cob: { ['C2|' + amanha]: 'bateria:B3' } }).deficit.length, 0); // substituto de outro conjunto
});

test('atrasadas: janela fixa de 60 dias, a mesma no menu, em Pendências e no Meu dia', () => {
  assert.equal(JANELA_ATRASADAS, 60);
  const hoje = '2026-10-27';
  const sem = (ini, s) => ({ id: 'A|' + ini, area: 'A', ini, ids: ['X'], s: { X: s } });
  const semanas = { a: sem('2026-08-24', 'PPPPPPP'), b: sem('2026-10-26', 'PPPPPPP'), c: sem('2026-06-01', 'PPPPPPP'), d: { ...sem('2026-10-19', 'RRRRRRR'), area: 'B' } };
  const l = listaAtrasadas(semanas, { hoje });
  // 24/08 a 27/08 ficam fora (antes de 28/08); 28 a 30/08 entram; 26/10 entra; hoje e junho não
  assert.deepEqual(l.map(x => x.dt), ['2026-08-28', '2026-08-29', '2026-08-30', '2026-10-26']);
  assert.equal(listaAtrasadas(semanas, { hoje, areas: ['B'] }).length, 0);
  assert.equal(resumoAtividades({ areas: ['A'], plano: [], semanas, colabs: [], sit: {}, rotas: [], hoje }).atrasadas, 4);
});

test('aprovação: a mesma lista no app e no Meu dia, ignorando atividade fora do plano', () => {
  const doc = { id: 'A|2026-10-19', area: 'A', ini: '2026-10-19', ids: ['X', 'Y'], d: ['RRR____', 'R______'], m: {} };
  const aprov = { 'A|2026-10-19': { 'X|0': { s: 'A', c: 'R' } } };
  const l = listarAprov({ [doc.id]: doc }, aprov, ['A'], '2026-10-27');
  assert.deepEqual(l.pend.map(x => x.pid + '|' + x.k), ['X|1', 'X|2', 'Y|0']);
  assert.equal(contarPendentes({ [doc.id]: doc }, aprov, ['A'], '2026-10-27', 'pend', pid => pid === 'X'), 2);
});

test('resumo semanal conta as mesmas ausências do Balanço (inclui treinamento e abono)', () => {
  const ini = '2026-10-19';
  const r = resumoSemana({ areas: ['A'], semanas: {}, colabs: [{ id: 'C1', area: 'A' }], sit: { 'C1|2026-10-19': 'FT', 'C1|2026-10-20': 'TR', 'C1|2026-10-21': 'AB', 'C1|2026-10-22': 'ATR' } }, ini);
  assert.deepEqual(r.aus, { FT: 1, TR: 1, AB: 1 });
});

test('resumo de férias: de 2 meses antes a 6 meses depois de hoje', () => {
  const l = [{ nome: 'A', inicio: '2026-07-01', termino: '2026-07-30' }, { nome: 'B', inicio: '2026-08-10', termino: '2026-08-20' }, { nome: 'C', inicio: '2027-04-25', termino: '2027-05-10' }, { nome: 'D', inicio: '2027-05-01', termino: '2027-05-10' }, { nome: 'E', inicio: '', termino: '2026-10-01' }];
  assert.deepEqual(resumoFerias(l, '2026-10-27').map(x => x.nome), ['B', 'C']);
});
