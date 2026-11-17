// Administração › Documentos e OMs: contas sem tela (public/contas/documentos.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alerta, textoAlerta, diasAte, ordenar, filtrar, resumo, conferir, linhasExcel, veDocsU, nomeDoc, linkOk } from '../public/contas/documentos.js';

const HOJE = '2026-11-17';
const D = [
  { id: 'a', tipo: 'POP', numero: 'POP-012', titulo: 'Correias', conj: 'patio', resp: 'Supervisão', validade: '2026-11-10', situacao: 'Vigente' },
  { id: 'b', tipo: 'OM', numero: 'OM 4500123', titulo: 'Raspador', conj: 'bateria', resp: 'Manutenção', validade: '2026-12-17', situacao: 'Em andamento' },
  { id: 'c', tipo: 'PT', numero: 'PT-1', titulo: 'Altura', conj: 'bateria', validade: '2027-03-01', situacao: 'Vigente' },
  { id: 'd', tipo: 'ASO', numero: '', titulo: 'Periódico', conj: 'coq', validade: '2026-01-01', situacao: 'Concluído' },
  { id: 'e', tipo: 'Outro', numero: 'X', titulo: '', conj: 'coq', validade: '', situacao: 'Pendente' }
];

test('alerta: vencido, vence em até 30 dias (com o 30º), em dia, sem validade e encerrado', () => {
  assert.deepEqual(D.map(d => alerta(d, HOJE)), ['vencido', 'vence', 'ok', 'fim', 'sem']);
  assert.equal(diasAte('2026-12-17', HOJE), 30);
  assert.equal(alerta({ validade: '2026-12-18', situacao: 'Vigente' }, HOJE), 'ok');
  assert.equal(alerta({ validade: HOJE, situacao: 'Vigente' }, HOJE), 'vence');
  assert.equal(textoAlerta({ validade: HOJE, situacao: 'Vigente' }, HOJE), 'Vence hoje');
  assert.equal(textoAlerta(D[0], HOJE), 'Vencido há 7 dias');
  assert.equal(textoAlerta({ validade: '2026-11-18', situacao: 'Vigente' }, HOJE), 'Vence em 1 dia');
  assert.equal(textoAlerta(D[3], HOJE), 'Concluído');
});

test('ordem, filtros e contagens', () => {
  assert.deepEqual(ordenar(D, HOJE).map(d => d.id), ['a', 'b', 'c', 'e', 'd']);
  assert.deepEqual(filtrar(D, { onde: 'bateria' }, HOJE).map(d => d.id), ['b', 'c']);
  assert.deepEqual(filtrar(D, { alerta: 'vencido' }, HOJE).map(d => d.id), ['a']);
  assert.deepEqual(filtrar(D, { tipo: 'OM' }, HOJE).map(d => d.id), ['b']);
  assert.deepEqual(filtrar(D, { q: 'manutenção' }, HOJE).map(d => d.id), ['b']);
  assert.deepEqual(resumo(D, HOJE), { total: 5, vencido: 1, vence: 1, ok: 1, sem: 1, fim: 1, alerta: 2 });
  assert.equal(nomeDoc(D[1]), 'OM 4500123 · Raspador');
  assert.equal(nomeDoc({}), 'Sem número');
});

test('conferir: limpa, completa e recusa o que não serve', () => {
  const y = conferir({ tipo: 'XYZ', numero: '  POP-1 ', titulo: 'a'.repeat(300), conj: 'lua', situacao: 'Talvez', emissao: '2026-01-01', validade: '2027-01-01', link: ' https://exemplo.com/x ' });
  assert.equal(y.tipo, 'Outro'); assert.equal(y.numero, 'POP-1'); assert.equal(y.titulo.length, 140); assert.equal(y.conj, 'coq'); assert.equal(y.situacao, 'Vigente'); assert.equal(y.link, 'https://exemplo.com/x');
  assert.throws(() => conferir({ numero: ' ', titulo: '' }), /número ou a descrição/);
  assert.throws(() => conferir({ numero: '1', emissao: '2026-05-01', validade: '2026-04-01' }), /antes da emissão/);
  assert.throws(() => conferir({ numero: '1', link: 'javascript:alert(1)' }), /Link inválido/);
  assert.ok(!linkOk('http://inseguro.com') && linkOk('https://seguro.com'));
  assert.equal(conferir({ numero: '1', validade: '17/11/2026' }).validade, '', 'data fora do formato fica vazia');
});

test('Excel: cabeçalho e uma linha por documento, na ordem da tela', () => {
  const l = linhasExcel(D, HOJE, s => (s ? s.split('-').reverse().join('/') : ''));
  assert.equal(l.length, 6); assert.equal(l[0][0], 'Tipo');
  assert.deepEqual(l[1].slice(0, 9), ['POP', 'POP-012', 'Correias', 'Pátio', 'Supervisão', '', '10/11/2026', 'Vigente', 'Vencido há 7 dias']);
  assert.equal(l[5][8], '', 'encerrado sem alerta');
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
