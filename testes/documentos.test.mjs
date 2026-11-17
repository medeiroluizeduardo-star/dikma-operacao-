// Administração › Documentos e OMs: contas sem tela (public/contas/documentos.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alerta, textoAlerta, diasAte, ordenar, filtrar, resumo, conferir, linhasExcel, veDocsU, nomeDoc, linkOk, somaMeses, regraDoTipo } from '../public/contas/documentos.js';

const HOJE = '2026-11-17';
const D = [
  { id: 'a', tipo: 'POP', numero: 'POP-012', rev: '03', titulo: 'Correias', conj: 'patio', resp: 'Supervisão', validade: '2026-11-10', situacao: 'Vigente' },
  { id: 'b', tipo: 'OM', numero: 'OM 4500123', titulo: 'Raspador', conj: 'bateria', local: 'Correia TC-03', resp: 'Manutenção', prio: 'alta', validade: '2026-12-17', situacao: 'Em andamento' },
  { id: 'c', tipo: 'PT', numero: 'PT-1', titulo: 'Altura', conj: 'bateria', validade: '2027-03-01', situacao: 'Vigente' },
  { id: 'd', tipo: 'ASO', numero: '', titulo: 'Periódico', colab: 'FULANO', mat: '123', conj: 'coq', validade: '2026-01-01', situacao: 'Concluído' },
  { id: 'e', tipo: 'Outro', numero: 'X', titulo: '', conj: 'coq', validade: '', situacao: 'Pendente' }
];
const novo = (x = {}) => ({ tipo: 'POP', numero: 'POP-1', titulo: 'Limpeza', conj: 'patio', resp: 'Supervisão', emissao: '2026-11-01', validade: '2027-11-01', situacao: 'Vigente', ...x });

test('alerta: vencido, vence dentro do aviso (padrão 30 dias, ou o escolhido), em dia, sem validade e encerrado', () => {
  assert.deepEqual(D.map(d => alerta(d, HOJE)), ['vencido', 'vence', 'ok', 'fim', 'sem']);
  assert.equal(diasAte('2026-12-17', HOJE), 30);
  assert.equal(alerta({ validade: '2026-12-18', situacao: 'Vigente' }, HOJE), 'ok');
  assert.equal(alerta({ validade: '2026-12-18', situacao: 'Vigente', aviso: 60 }, HOJE), 'vence', 'aviso de 60 dias');
  assert.equal(alerta({ validade: '2026-11-27', situacao: 'Vigente', aviso: 7 }, HOJE), 'ok', 'aviso de 7 dias');
  assert.equal(textoAlerta({ validade: HOJE, situacao: 'Vigente' }, HOJE), 'Vence hoje');
  assert.equal(textoAlerta(D[0], HOJE), 'Vencido há 7 dias');
  assert.equal(textoAlerta(D[3], HOJE), 'Concluído');
});

test('ordem, filtros, contagens e nome com a revisão', () => {
  assert.deepEqual(ordenar(D, HOJE).map(d => d.id), ['a', 'b', 'c', 'e', 'd']);
  assert.deepEqual(filtrar(D, { onde: 'bateria' }, HOJE).map(d => d.id), ['b', 'c']);
  assert.deepEqual(filtrar(D, { alerta: 'vencido' }, HOJE).map(d => d.id), ['a']);
  assert.deepEqual(filtrar(D, { q: 'tc-03' }, HOJE).map(d => d.id), ['b'], 'busca pelo equipamento');
  assert.deepEqual(filtrar(D, { q: 'fulano' }, HOJE).map(d => d.id), ['d'], 'busca pelo colaborador');
  assert.deepEqual(resumo(D, HOJE), { total: 5, vencido: 1, vence: 1, ok: 1, sem: 1, fim: 1, alerta: 2 });
  assert.equal(nomeDoc(D[0]), 'POP-012 rev. 03 · Correias');
  assert.equal(nomeDoc({}), 'Sem número');
});

test('periodicidade: soma meses (fim de mês ajustado) e a validade sai sozinha', () => {
  assert.equal(somaMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(somaMeses('2026-11-17', 12), '2027-11-17');
  assert.equal(conferir(novo({ period: '12', validade: '' })).validade, '2027-11-01');
  const sem = conferir(novo({ period: '0', validade: '2030-01-01' }));
  assert.equal(sem.validade, ''); assert.equal(sem.period, 0);
  assert.equal(conferir(novo()).period, null, 'data informada à mão');
});

test('campos por tipo: OM tem prioridade e prazo; ASO pede o colaborador; revisão só onde existe', () => {
  assert.equal(regraDoTipo('OM').validade, 'Prazo de execução');
  assert.equal(regraDoTipo('ASO').validade, 'Próximo exame');
  const om = conferir(novo({ tipo: 'OM', numero: 'OM 9', prio: 'xx', rev: '02', local: 'Correia 3' }));
  assert.equal(om.prio, 'media'); assert.equal(om.rev, '', 'OM não tem revisão'); assert.equal(om.local, 'Correia 3');
  assert.throws(() => conferir(novo({ tipo: 'ASO', numero: '' })), /colaborador do ASO/);
  const aso = conferir(novo({ tipo: 'ASO', numero: '', colab: 'FULANO', mat: '1', local: 'x' }));
  assert.equal(aso.colab, 'FULANO'); assert.equal(aso.local, '', 'ASO não tem equipamento'); assert.equal(aso.prio, '');
  assert.equal(conferir(novo({ tipo: 'POP', colab: 'X' })).colab, '', 'POP não tem colaborador');
});

test('conferir: obrigatórios, datas, link e repetido', () => {
  const y = conferir(novo({ tipo: 'XYZ', numero: '  1 ', titulo: 'a'.repeat(300), conj: 'lua', situacao: 'Talvez', link: ' https://exemplo.com/x ', aviso: '45' }));
  assert.equal(y.tipo, 'Outro'); assert.equal(y.numero, '1'); assert.equal(y.titulo.length, 140); assert.equal(y.conj, 'coq'); assert.equal(y.situacao, 'Vigente'); assert.equal(y.link, 'https://exemplo.com/x'); assert.equal(y.aviso, 30);
  assert.throws(() => conferir(novo({ numero: '' })), e => e.campo === 'dcNum');
  assert.throws(() => conferir(novo({ titulo: ' ' })), e => e.campo === 'dcTit');
  assert.throws(() => conferir(novo({ resp: '' })), /responsável/);
  assert.throws(() => conferir(novo({ emissao: '' })), e => e.campo === 'dcEmi');
  assert.throws(() => conferir(novo({ validade: '' })), /Sem validade/);
  assert.throws(() => conferir(novo({ validade: '2026-10-01' })), /antes da emissão/);
  assert.throws(() => conferir(novo({ link: 'javascript:alert(1)' })), /Link inválido/);
  assert.ok(!linkOk('http://inseguro.com') && linkOk('https://seguro.com'));
  const outros = [{ id: 'z', tipo: 'POP', numero: 'POP 1', rev: '', colab: '' }];
  assert.throws(() => conferir(novo({ numero: 'pop1' }), outros), /Já existe/);
  assert.equal(conferir(novo({ numero: 'pop1' }), outros, 'z').numero, 'pop1', 'o próprio documento não conta');
  assert.equal(conferir(novo({ numero: 'POP 1', rev: '02' }), outros).rev, '02', 'revisão nova pode');
});

test('Excel: cabeçalho e uma linha por documento, na ordem da tela', () => {
  const l = linhasExcel(D, HOJE, s => (s ? s.split('-').reverse().join('/') : ''));
  assert.equal(l.length, 6); assert.equal(l[0][0], 'Tipo'); assert.equal(l[0].length, l[1].length);
  const c = n => l[0].indexOf(n);
  assert.equal(l[1][c('Número')], 'POP-012'); assert.equal(l[1][c('Revisão')], '03'); assert.equal(l[1][c('Alerta')], 'Vencido há 7 dias');
  assert.equal(l[2][c('Prioridade')], 'Alta'); assert.equal(l[2][c('Equipamento ou local')], 'Correia TC-03');
  assert.equal(l[5][c('Alerta')], '', 'encerrado sem alerta');
});

test('quem vê: administrador, Gestor e Coordenador da Gestão; supervisor, RH e bloqueado não', () => {
  assert.ok(veDocsU({ papel: 'admin', acesso: { administracao: 'admin' } }));
  assert.ok(veDocsU({ papel: 'gestor', acesso: { gestao: 'gestor' } }));
  assert.ok(veDocsU({ papel: 'coordenador', acesso: { gestao: 'coordenador' } }));
  assert.ok(!veDocsU({ papel: 'supervisor', acesso: { gestao: 'supervisor' } }));
  assert.ok(!veDocsU({ papel: 'gestor', acesso: { rh: 'gestor' } }));
  assert.ok(!veDocsU({ papel: 'bloqueado', acesso: { gestao: 'gestor' } }));
  assert.ok(!veDocsU(null));
});
