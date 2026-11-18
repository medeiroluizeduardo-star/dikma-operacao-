// Operação › Solicitações de OM: contas sem tela (public/contas/oms.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veOmsU, trataOmU, areasQueAbre, abreOmU, acoesDe, conferirSolicitacao, mudar, tempos, duracao, minutosEntre, filtrar, resumo, linhasExcel, avisosOms, agoraLocal, clienteDe, palpiteCliente } from '../public/contas/oms.js';

const U = {
  lider: { uid: 'lider', papel: 'lider', area: 'RECEBIMENTO', acesso: { operacao: 'lider' }, escopos: ['patio'] },
  sup: { uid: 'sup', papel: 'supervisor', area: 'PREPARAÇÃO', area2: 'RECEBIMENTO', acesso: { operacao: 'supervisor' }, escopos: ['patio'] },
  tec: { uid: 'tec', papel: 'leitor', acesso: { operacao: 'tecnico' }, escopos: ['patio'] },
  tecBat: { uid: 'tecBat', papel: 'leitor', acesso: { operacao: 'tecnico' }, escopos: ['bateria'] },
  leitor: { uid: 'leitor', papel: 'leitor', acesso: { operacao: 'leitor' }, escopos: ['patio'] },
  rh: { uid: 'rh', papel: 'administrativo', acesso: { rh: 'administrativo' }, escopos: [] },
  adm: { uid: 'adm', papel: 'admin', acesso: { administracao: 'admin' } }
};
const om = (x = {}) => ({ id: 'o1', conj: 'patio', area: 'RECEBIMENTO', titulo: 'Troca de rolete', local: 'Correia 3', status: 'solicitada', solPor: 'lider', hSol: '2026-11-17T07:40', hist: [], ...x });

test('quem vê, abre e trata', () => {
  assert.ok(veOmsU(U.leitor, 'patio') && !veOmsU(U.rh, 'patio') && !veOmsU(U.tecBat, 'patio'));
  assert.ok(trataOmU(U.tec, 'patio') && trataOmU(U.adm, 'patio') && !trataOmU(U.lider, 'patio') && !trataOmU(U.tecBat, 'patio'));
  assert.deepEqual(areasQueAbre(U.lider, 'patio'), ['RECEBIMENTO']);
  assert.deepEqual(areasQueAbre(U.sup, 'patio').sort(), ['PREPARAÇÃO', 'RECEBIMENTO']);
  assert.equal(areasQueAbre(U.adm, 'patio'), null);
  assert.ok(!abreOmU(U.tec, 'patio') && !abreOmU(U.leitor, 'patio') && abreOmU(U.lider, 'patio', 'RECEBIMENTO') && !abreOmU(U.lider, 'patio', 'PREPARAÇÃO'));
});

test('botões conforme a situação e a pessoa', () => {
  assert.deepEqual(acoesDe(om(), U.lider), ['editar', 'cancelar']);
  assert.deepEqual(acoesDe(om(), U.tec), ['editar', 'aprovar', 'devolver', 'cancelar', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'aprovada' }), U.tec), ['enviar', 'cancelar', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'enviada' }), U.tec), ['liberar', 'cancelar', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'liberada' }), U.lider), ['finalizar'], 'o líder da área finaliza');
  assert.deepEqual(acoesDe(om({ status: 'aprovada' }), U.lider), [], 'depois de aprovada, o líder só acompanha');
  assert.deepEqual(acoesDe(om({ status: 'finalizada' }), U.tec), ['apagar'], 'quem trata apaga mesmo finalizada');
  assert.deepEqual(acoesDe(om(), U.leitor), []);
});

test('solicitação: obrigatórios, área permitida e hora', () => {
  const ok = { area: 'RECEBIMENTO', titulo: 'Troca de rolete', local: 'Correia 3', hSol: '2026-11-17T07:40', prio: 'xx', tipo: 'yy' };
  const y = conferirSolicitacao(ok, ['RECEBIMENTO']); assert.equal(y.prio, 'media'); assert.equal(y.tipo, 'corretiva');
  assert.throws(() => conferirSolicitacao({ ...ok, area: 'PREPARAÇÃO' }, ['RECEBIMENTO']), /só abre OM/);
  assert.throws(() => conferirSolicitacao({ ...ok, titulo: 'oi' }), e => e.campo === 'omTit');
  assert.throws(() => conferirSolicitacao({ ...ok, local: '' }), e => e.campo === 'omLocal');
  assert.throws(() => conferirSolicitacao({ ...ok, hSol: '17/11 07:40' }), e => e.campo === 'omHSol');
  assert.match(agoraLocal(new Date(2026, 10, 17, 7, 5)), /^2026-11-17T07:05$/);
});

test('caminho completo: aprovar, enviar, liberar, finalizar, com horas e histórico', () => {
  const q = { uid: 'tec', nome: 'Técnico' };
  let o = om();
  o = { ...o, ...mudar(o, 'aprovar', q) }; assert.equal(o.status, 'aprovada'); assert.equal(o.aprovNome, 'Técnico');
  o = { ...o, ...mudar(o, 'enviar', q, { numero: ' 4500123 ', cliente: { uid: 'cliP', nome: 'Usuário Pátio' }, contato: 'Ramal 1234', hEnvio: '2026-11-17T08:30' }) }; assert.equal(o.numero, '4500123'); assert.equal(o.cliente, 'Usuário Pátio'); assert.equal(o.clienteUid, 'cliP'); assert.equal(o.contato, 'Ramal 1234'); assert.equal(o.hEnvio, '2026-11-17T08:30');
  assert.throws(() => mudar(o, 'liberar', q, { hLib: '2026-11-17T06:00' }), /antes da solicitação/);
  o = { ...o, ...mudar(o, 'liberar', q, { hLib: '2026-11-17T13:10' }) }; assert.equal(o.status, 'liberada');
  assert.throws(() => mudar(o, 'finalizar', q, { hFim: '2026-11-17T12:00' }), /antes da liberação/);
  o = { ...o, ...mudar(o, 'finalizar', { uid: 'lider', nome: 'Líder' }, { hFim: '2026-11-17T16:40', obs: 'Testado' }) };
  assert.equal(o.status, 'finalizada'); assert.equal(o.obsFim, 'Testado');
  assert.deepEqual(o.hist.map(h => h.s), ['aprovada', 'enviada', 'liberada', 'finalizada']);
  const x = tempos(o); assert.equal(x.espera, 330); assert.equal(x.execucao, 210); assert.equal(duracao(x.espera), '5h 30'); assert.equal(duracao(x.total), '9h');
  assert.equal(duracao(minutosEntre('2026-11-15T07:00', '2026-11-17T09:00')), '2d 2h');
});

test('devolver e cancelar pedem o motivo; reenviar limpa o motivo', () => {
  const q = { uid: 'tec', nome: 'Técnico' };
  assert.throws(() => mudar(om(), 'devolver', q, { motivo: '' }), e => e.campo === 'omMotivo');
  const dv = { ...om(), ...mudar(om(), 'devolver', q, { motivo: 'Falta o ponto exato' }) };
  assert.equal(dv.status, 'devolvida'); assert.equal(dv.motivo, 'Falta o ponto exato');
  const rv = mudar(dv, 'reenviar', { uid: 'lider' }); assert.equal(rv.status, 'solicitada'); assert.equal(rv.motivo, '');
  assert.throws(() => mudar(om(), 'cancelar', q, { motivo: 'x' }), /motivo/);
});

test('lista, cartões e Excel', () => {
  const l = [om({ id: 'a' }), om({ id: 'b', status: 'devolvida' }), om({ id: 'c', status: 'enviada', numero: '9' }), om({ id: 'd', status: 'finalizada', hLib: '2026-11-10T10:00', hFim: '2026-11-10T12:00', hSol: '2026-11-10T08:00' }), om({ id: 'e', status: 'cancelada' })];
  assert.deepEqual(filtrar(l, { status: 'abertas' }).map(o => o.id), ['b', 'a', 'c']);
  assert.deepEqual(filtrar(l, { q: '9' }).map(o => o.id), ['c']);
  const r = resumo(l, '2026-11'); assert.equal(r.solicitada, 1); assert.equal(r.comCliente, 1); assert.equal(r.finalizadasMes, 1); assert.equal(r.esperaMedia, 120); assert.equal(r.execMedia, 120);
  const x = linhasExcel(l); assert.equal(x.length, 6); assert.equal(x[0].length, x[1].length);
});

test('avisos: nova para quem trata no conjunto; devolvida e liberada para quem abriu; só mudanças recentes', () => {
  const us = Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { ...u }]));
  const l = avisosOms([om({ id: 'n', hist: [{ s: 'solicitada', em: '2026-11-17T07:40' }] }), om({ id: 'd', status: 'devolvida', hist: [{ s: 'devolvida', em: '2026-11-17T08:00' }] }), om({ id: 'velha', hSol: '2026-10-01T07:00' })], us, '2026-11-17');
  assert.deepEqual(l.filter(x => x.tipo === 'nova').map(x => x.uid).sort(), ['adm', 'tec']);
  assert.deepEqual(l.filter(x => x.tipo === 'devolvida').map(x => x.uid), ['lider']);
  assert.ok(!l.some(x => x.om.id === 'velha'));
});

test('cliente: usuário do conjunto, obrigatório no envio, sugestão pelo nome e aviso ao cliente', () => {
  assert.throws(() => mudar(om({ status: 'aprovada' }), 'enviar', { uid: 'tec' }, { numero: '1' }), e => e.campo === 'omCli');
  const cfg = { clientes: { patio: { uid: 'cliP', nome: 'Usuário Pátio' } } };
  assert.deepEqual(clienteDe(cfg, 'patio'), { uid: 'cliP', nome: 'Usuário Pátio' }); assert.equal(clienteDe(cfg, 'bateria'), null); assert.equal(clienteDe(null, 'patio'), null);
  const us = [{ uid: 'a', nome: 'Líder do Pátio' }, { uid: 'b', nome: 'Usuário Pátio' }, { uid: 'c', nome: 'Usuário Bateria' }, { uid: 'd', nome: 'Bateria velho', papel: 'bloqueado' }];
  assert.equal(palpiteCliente(us, 'patio').uid, 'b'); assert.equal(palpiteCliente(us, 'bateria').uid, 'c'); assert.equal(palpiteCliente([], 'patio'), null);
  const hoje = '2026-11-17';
  const env = om({ id: 'e', status: 'enviada', clienteUid: 'cliP', cliente: 'Usuário Pátio', hist: [{ s: 'enviada', em: '2026-11-17T08:30' }] });
  const av = avisosOms([env], { cliP: { papel: 'leitor', acesso: { operacao: 'leitor' }, escopos: ['patio'] } }, hoje);
  assert.deepEqual(av.map(x => [x.uid, x.tipo]), [['cliP', 'enviada']]);
  assert.equal(filtrar([env], { q: 'usuário pátio' }).length, 1);
});
