// Gestão › Tratativas: contas sem tela (public/contas/tratativas.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valor, aberta, atrasada, venceLogo, w5n, conferirAcao, conferirPlano, conferirAta, acoesDaAta, novoComentario, deAcaoAntiga, filtrar, ordenar, resumo, andamentoPlano, textoAta, linhasExcel } from '../public/contas/tratativas.js';

const HOJE = '2026-11-17';
const A = (id, x = {}) => ({ id, tipo: 'acao', titulo: 'Ação ' + id, origem: 'outra', conj: 'coq', status: 'aberta', plano: '', ...x });

test('valor em reais: aceita vírgula e ponto de milhar; vazio é null; texto dá erro', () => {
  assert.equal(valor('1.500,50'), 1500.5);
  assert.equal(valor('R$ 80'), 80);
  assert.equal(valor('2,5'), 2.5);
  assert.equal(valor('1234.5'), 1234.5);
  assert.equal(valor(''), null);
  assert.throws(() => valor('abc'), /Valor inválido/);
  assert.throws(() => valor('-3'), /Valor inválido/);
});

test('situação: aberta, atrasada e vence em 7 dias', () => {
  assert.ok(aberta(A(1, { status: 'andamento' })));
  assert.ok(!aberta(A(1, { status: 'feita' })));
  assert.ok(atrasada(A(1, { prazo: '2026-11-16' }), HOJE));
  assert.ok(!atrasada(A(1, { prazo: '2026-11-16', status: 'feita' }), HOJE));
  assert.ok(!atrasada(A(1, { prazo: HOJE }), HOJE), 'vence hoje ainda não é atrasada');
  assert.ok(venceLogo(A(1, { prazo: '2026-11-24' }), HOJE));
  assert.ok(!venceLogo(A(1, { prazo: '2026-11-25' }), HOJE));
});

test('5W2H: conta só o que foi respondido', () => {
  assert.equal(w5n(A(1, { titulo: '' })), 0);
  assert.equal(w5n(A(1)), 1);
  assert.equal(w5n(A(1, { por: 'Motivo', local: 'Correia', prazo: '2026-11-20', resp: 'Fulano', como: 'Assim', custo: 0 })), 7, 'custo zero conta como respondido');
  assert.equal(w5n(A(1, { causa: 'Chuva' })), 2, 'a causa responde o porquê');
});

test('conferirAcao: limpa, confere datas e origem e devolve só os campos da ação', () => {
  const x = conferirAcao({ titulo: '  Limpar   a correia 3 ', origem: 'queda', conj: 'patio', inicio: '2026-11-17', prazo: '2026-11-20', custo: '1.200,00', custoReal: '', status: 'andamento', extra: 'x' });
  assert.equal(x.titulo, 'Limpar a correia 3');
  assert.equal(x.custo, 1200); assert.equal(x.custoReal, null);
  assert.equal(x.tipo, 'acao'); assert.equal(x.status, 'andamento');
  assert.ok(!('extra' in x)); assert.ok(!('causa' in x));
  assert.equal(conferirAcao({ titulo: 'Fazer algo', origem: 'outra', conj: 'lua' }).conj, 'coq');
  assert.throws(() => conferirAcao({ titulo: 'oi', origem: 'outra' }), /O quê/);
  assert.throws(() => conferirAcao({ titulo: 'Fazer algo', origem: 'marte' }), /origem/);
  assert.throws(() => conferirAcao({ titulo: 'Fazer algo', origem: 'outra', inicio: '2026-11-20', prazo: '2026-11-10' }), /antes do início/);
  assert.equal(conferirAcao({ titulo: 'Fazer algo', origem: 'atividades', causa: 'Chuva', area: 'RECEBIMENTO' }).causa, 'Chuva');
});

test('plano e ata: nome, assunto, data e encaminhamentos', () => {
  assert.equal(conferirPlano({ nome: 'Reduzir paradas', status: 'x' }).status, 'ativo');
  assert.throws(() => conferirPlano({ nome: 'a' }), /nome/);
  const ata = conferirAta({ titulo: 'Reunião semanal', data: HOJE, enc: [{ oque: 'Limpar a correia 3', quem: 'Líder', prazo: '2026-11-20' }, { oque: '', quem: 'Ninguém' }, { oque: 'Já feito antes', trat: 't9' }] });
  assert.equal(ata.enc.length, 2, 'linha sem "o que" sai');
  assert.throws(() => conferirAta({ titulo: 'Reunião', data: '17/11' }), /Data/);
  assert.throws(() => conferirAta({ titulo: 'Reunião', data: HOJE, enc: [{ oque: 'oi' }] }), /encaminhamento/);
  const novas = acoesDaAta({ ...ata, id: 'at1' }, HOJE);
  assert.equal(novas.length, 1, 'o que já virou ação não cria outra');
  assert.equal(novas[0].i, 0);
  assert.equal(novas[0].acao.origem, 'reuniao'); assert.equal(novas[0].acao.ata, 'at1'); assert.equal(novas[0].acao.resp, 'Líder');
  assert.match(novas[0].acao.por, /Reunião semanal/);
  const semPrazo = acoesDaAta({ ...conferirAta({ titulo: 'Reunião', data: HOJE, enc: [{ oque: 'Fazer isto' }] }), id: 'at2' }, HOJE);
  assert.equal(semPrazo[0].acao.prazo, '2026-11-24', 'sem prazo: uma semana');
  assert.match(textoAta({ ...ata, local: 'Sala' }), /\*Encaminhamentos\*\n1\. Limpar a correia 3 · Líder · até 20\/11/);
});

test('comentários de evolução: ignora vazio e guarda quem e quando', () => {
  const q = { em: '2026-11-17T10:00:00Z', nome: 'Fulano', uid: 'u1' };
  assert.deepEqual(novoComentario([], '   ', q), []);
  const l = novoComentario([], 'Começou a limpeza', q);
  assert.deepEqual(l, [{ t: 'Começou a limpeza', em: q.em, nome: 'Fulano', uid: 'u1' }]);
  assert.equal(novoComentario(Array.from({ length: 200 }, (_, i) => ({ t: String(i) })), 'novo', q).length, 200, 'no máximo 200');
});

test('ação antiga de Causas e ações entra como origem Atividades', () => {
  const t = deAcaoAntiga({ id: 'x1', acao: 'Combinar liberação às 8h', causa: 'Área não liberada', area: 'TODAS', resp: 'Sup', prazo: '2026-11-20', status: 'aberta', em: '2026-11-01T10:00:00Z' }, 'bateria');
  assert.equal(t.id, 'L:bateria:x1'); assert.deepEqual(t.legado, { k: 'bateria', id: 'x1' });
  assert.equal(t.origem, 'atividades'); assert.equal(t.conj, 'bateria'); assert.equal(t.area, '');
  assert.equal(t.titulo, 'Combinar liberação às 8h');
});

test('filtros, ordem, números do topo e andamento do plano', () => {
  const l = [
    A(1, { prazo: '2026-11-10', resp: 'Fulano de Tal', origem: 'equipamentos', plano: 'p1', custo: 100 }),
    A(2, { prazo: '2026-11-20', status: 'andamento', criadoPor: 'eu', plano: 'p1' }),
    A(3, { status: 'feita', feitaEm: '2026-11-05T10:00:00Z', plano: 'p1', custoReal: 80 }),
    A(4, { status: 'cancelada', plano: 'p1' }),
    A(5, { titulo: 'Sinalizar a transferência', conj: 'patio' })
  ];
  assert.deepEqual(filtrar(l, { sit: 'abertas' }, HOJE).map(t => t.id), [1, 2, 5]);
  assert.deepEqual(filtrar(l, { sit: 'atrasadas' }, HOJE).map(t => t.id), [1]);
  assert.deepEqual(filtrar(l, { sit: 'todas' }, HOJE).length, 5);
  assert.deepEqual(filtrar(l, { sit: 'canceladas' }, HOJE).map(t => t.id), [4]);
  assert.deepEqual(filtrar(l, { sit: 'abertas', origem: 'equipamentos' }, HOJE).map(t => t.id), [1]);
  assert.deepEqual(filtrar(l, { sit: 'abertas', conj: 'patio' }, HOJE).map(t => t.id), [5]);
  assert.deepEqual(filtrar(l, { sit: 'abertas', plano: 'sem' }, HOJE).map(t => t.id), [5]);
  assert.deepEqual(filtrar(l, { sit: 'abertas', q: 'transferencia' }, HOJE).map(t => t.id), [5], 'busca sem acento');
  assert.deepEqual(filtrar(l, { sit: 'abertas', minhas: true }, HOJE, { uid: 'eu', nome: 'fulano de tal' }).map(t => t.id), [1, 2]);
  assert.deepEqual(ordenar(l, HOJE).map(t => t.id), [1, 2, 5, 3, 4], 'atrasada primeiro, sem prazo depois, fechadas no fim');
  assert.deepEqual(resumo(l, HOJE), { abertas: 3, atrasadas: 1, semana: 1, feitasMes: 1 });
  const p = andamentoPlano(l, 'p1', HOJE);
  assert.deepEqual([p.n, p.feitas, p.atrasadas, p.pct, p.previsto, p.realizado, p.fim], [3, 1, 1, 33, 100, 80, '2026-11-20'], 'cancelada não conta');
  const x = linhasExcel([l[0]], { p1: { nome: 'Plano 1' } }, HOJE)[0].linhas;
  assert.equal(x[1][0], 'Atrasada'); assert.equal(x[1][13], 'Plano 1'); assert.equal(x[1][8], '10/11/2026');
});
