// Operação › Solicitações de OM: contas sem tela (public/contas/oms.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veOmsU, trataOmU, areasQueAbre, abreOmU, planejaOmU, areasQuePlaneja, diaDe, atrasada, visaoHoje, visaoSemana, visaoMes, acoesDe, conferirSolicitacao, mudar, tempos, duracao, minutosEntre, filtrar, resumo, linhasExcel, avisosOms, agoraLocal, clienteDe, palpiteCliente, conferirDocs, docsResumo, prazosDe, conferirPrazos, prazoOm, foraDoPrazo, ehClienteDa, PRAZO_PADRAO, observacoes, STATUS, ABERTAS } from '../public/contas/oms.js';

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
  assert.deepEqual(acoesDe(om(), U.lider), ['editar', 'cancelar', 'obs', 'docs']);
  assert.deepEqual(acoesDe(om(), U.tec), ['editar', 'aprovar', 'devolver', 'cancelar', 'obs', 'docs', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'aprovada' }), U.tec), ['enviar', 'cancelar', 'obs', 'docs', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'enviada' }), U.tec), ['liberar', 'recusar', 'cancelar', 'obs', 'docs', 'apagar']);
  assert.deepEqual(acoesDe(om({ status: 'liberada' }), U.lider), ['finalizar', 'obs', 'docs'], 'o líder da área finaliza');
  assert.deepEqual(acoesDe(om({ status: 'aprovada' }), U.lider), ['obs', 'docs'], 'depois de aprovada, o líder só acompanha e marca a documentação');
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

test('OM planejada: técnico e líder planejam, no dia vira solicitação com um toque', () => {
  assert.ok(planejaOmU(U.tec, 'patio') && planejaOmU(U.lider, 'patio', 'RECEBIMENTO') && !planejaOmU(U.leitor, 'patio') && !planejaOmU(U.tecBat, 'patio'));
  assert.equal(areasQuePlaneja(U.tec, 'patio'), null, 'técnico planeja em todas as áreas do conjunto');
  assert.deepEqual(areasQuePlaneja(U.lider, 'patio'), ['RECEBIMENTO']);
  const ok = { area: 'RECEBIMENTO', titulo: 'Lubrificar mancais', local: 'Correia 2', hSol: '2026-11-17T07:40' };
  assert.throws(() => conferirSolicitacao({ ...ok, dPrev: '' }, null, true), e => e.campo === 'omDPrev');
  const y = conferirSolicitacao({ ...ok, dPrev: '2026-11-20' }, null, true); assert.equal(y.hSol, ''); assert.equal(y.dPrev, '2026-11-20');
  assert.equal(conferirSolicitacao(ok).dPrev, '2026-11-17', 'sem data prevista, vale o dia da solicitação');
  const pl = om({ status: 'planejada', solPor: 'tec', hSol: '', dPrev: '2026-11-20' });
  assert.deepEqual(acoesDe(pl, U.lider), ['solicitar', 'obs', 'docs'], 'o líder da área pede no dia');
  assert.deepEqual(acoesDe(pl, U.tec), ['editar', 'solicitar', 'cancelar', 'obs', 'docs', 'apagar']);
  assert.deepEqual(acoesDe(pl, U.leitor), []);
  const m = mudar(pl, 'solicitar', { uid: 'lider', nome: 'Líder' }, { hSol: '2026-11-20T07:10' });
  assert.equal(m.status, 'solicitada'); assert.equal(m.hSol, '2026-11-20T07:10'); assert.match(m.hist[0].txt, /planejada para 20\/11/);
  // Aviso de solicitação nova: quem trata, menos quem acabou de pedir; o técnico que planejou também recebe.
  const av = avisosOms([{ ...pl, ...m }], Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { ...u }])), '2026-11-20');
  assert.deepEqual(av.map(x => x.uid).sort(), ['adm', 'tec']);
  assert.ok(filtrar([pl], { status: 'abertas' }).length === 1, 'planejada conta como em aberto');
});

test('agenda: Hoje, Semana e Mês', () => {
  const hj = '2026-11-18';
  const l = [
    om({ id: 'p1', status: 'planejada', hSol: '', dPrev: '2026-11-18', prio: 'baixa' }),
    om({ id: 'p0', status: 'planejada', hSol: '', dPrev: '2026-11-17', prio: 'alta' }),
    om({ id: 'p9', status: 'planejada', hSol: '', dPrev: '2026-11-21' }),
    om({ id: 'e', status: 'enviada', hSol: '2026-11-18T07:00', dPrev: '2026-11-18' }),
    om({ id: 'li', status: 'liberada', hSol: '2026-11-16T07:00' }),
    om({ id: 'f', status: 'finalizada', hSol: '2026-11-18T06:00', hFim: '2026-11-18T09:00', dPrev: '2026-11-18' }),
    om({ id: 'fv', status: 'finalizada', hSol: '2026-11-03T06:00', hFim: '2026-11-03T09:00', dPrev: '2026-11-03' }),
    om({ id: 'c', status: 'cancelada', dPrev: '2026-11-18' })
  ];
  assert.equal(diaDe(l[4]), '2026-11-16', 'antiga sem data prevista: dia da solicitação');
  assert.ok(atrasada(l[1], hj) && atrasada(l[4], hj) && !atrasada(l[0], hj) && !atrasada(l[6], hj));
  const h = visaoHoje(l, hj);
  assert.deepEqual([h.pedir, h.comCliente, h.liberadas, h.atrasadas], [2, 1, 1, 2]);
  assert.deepEqual(h.lista.map(o => o.id), ['p0', 'li', 'e', 'p1', 'f'], 'atrasadas primeiro, finalizadas de hoje no fim, planejadas futuras fora');
  const s = visaoSemana(l, '2026-11-20');
  assert.equal(s[0].dia, '2026-11-16'); assert.equal(s.length, 7);
  assert.deepEqual(s[2].oms.map(o => o.id), ['e', 'f', 'p1'], 'quarta: sem a cancelada, por prioridade e situação');
  assert.deepEqual(s[5].oms.map(o => o.id), ['p9'], 'sábado');
  const m = visaoMes(l, '2026-11', hj);
  assert.equal(m.previstas, 7); assert.equal(m.finalizadas, 2); assert.equal(m.planejadas, 3); assert.equal(m.atrasadas, 2); assert.equal(m.aderencia, 29);
  assert.equal(m.dias['2026-11-18'].previstas, 3); assert.equal(m.semanas.reduce((a, x) => a + x.previstas, 0), 7);
  assert.equal(m.semanas[0].ini, '2026-10-26');
});

test('documentação: não obrigatória, pronto, pendente ou não precisa', () => {
  const d = conferirDocs({ pt: 'ok', apr: 'xx', bloq: 'na', outro: 'ok' });
  assert.deepEqual(d, { pt: 'ok', apr: 'pend', bloq: 'na', isol: 'pend', acomp: 'pend' });
  const r = docsResumo({ docs: d }); assert.equal(r.total, 4); assert.equal(r.prontos, 1); assert.equal(r.completa, false);
  assert.equal(docsResumo(om()), null, 'OM antiga sem a lista');
  // A documentação não trava o caminho: aprova e envia com tudo pendente.
  const q = { uid: 'tec', nome: 'Técnico' };
  assert.equal(mudar(om({ docs: conferirDocs({}) }), 'aprovar', q).status, 'aprovada');
});

test('cliente: Ciente e Liberar (prioridade do cliente), técnico registra se ele liberou por fora', () => {
  const cli = { uid: 'cliP', nome: 'Usuário Pátio', papel: 'leitor', acesso: { operacao: 'leitor' }, escopos: ['patio'] };
  const env = om({ status: 'enviada', clienteUid: 'cliP', cliente: 'Usuário Pátio', hEnvio: '2026-11-17T08:30' });
  assert.ok(ehClienteDa(env, cli) && !ehClienteDa(env, U.tec) && !ehClienteDa(env, { ...cli, papel: 'bloqueado' }));
  assert.deepEqual(acoesDe(env, cli), ['ciente', 'liberar', 'recusar', 'cancelar', 'obs']);
  assert.deepEqual(acoesDe({ ...env, hCiente: '2026-11-17T08:40' }, cli), ['liberar', 'recusar', 'cancelar', 'obs'], 'ciente uma vez só');
  assert.deepEqual(acoesDe({ ...env, status: 'aprovada' }, cli), [], 'só depois de enviada');
  assert.deepEqual(acoesDe(env, U.leitor), [], 'outro leitor só acompanha');
  const c = mudar(env, 'ciente', cli); assert.equal(c.cienteNome, 'Usuário Pátio'); assert.ok(c.hCiente); assert.equal(c.hist[0].s, 'ciente'); assert.equal(c.status, undefined, 'continua com o cliente');
  const l = mudar(env, 'liberar', cli, { peloCliente: true, hLib: '2000-01-01T00:00' });
  assert.equal(l.status, 'liberada'); assert.equal(l.libCli, true); assert.equal(l.libNome, 'Usuário Pátio'); assert.notEqual(l.hLib, '2000-01-01T00:00', 'vale a hora do toque');
  assert.equal(l.hCiente, l.hLib, 'liberar já conta como ciente'); assert.match(l.hist[0].txt, /pelo cliente/);
  const t = mudar(env, 'liberar', { uid: 'tec', nome: 'Técnico' }, { hLib: '2026-11-17T10:00' });
  assert.equal(t.libCli, false); assert.equal(t.hLib, '2026-11-17T10:00'); assert.equal(t.hCiente, undefined);
  // Avisos: liberada pelo cliente avisa quem abriu e quem trata.
  const us = Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { ...u }]));
  const av = avisosOms([{ ...env, ...l, hist: [{ s: 'liberada', em: '2026-11-17T09:00' }] }], us, '2026-11-17', null, '2026-11-17T09:05');
  assert.deepEqual(av.map(x => x.uid).sort(), ['adm', 'lider', 'tec']);
});

test('prazos do cliente: configuráveis, OM vermelha e aviso quando passa', () => {
  assert.deepEqual(prazosDe(null), PRAZO_PADRAO);
  assert.deepEqual(prazosDe({ prazos: { alta: 12, media: -1, baixa: 0 } }), { ...PRAZO_PADRAO, alta: 12, baixa: 0 });
  assert.deepEqual(conferirPrazos({ emergencia: '4', alta: '12', media: 48, baixa: '0' }), { emergencia: 4, alta: 12, media: 48, baixa: 0 });
  assert.throws(() => conferirPrazos({ emergencia: '1,5', alta: 1, media: 1, baixa: 1 }), e => e.campo === 'omPz_emergencia');
  assert.throws(() => conferirPrazos({ emergencia: 1, alta: 1, media: 1, baixa: 721 }), e => e.campo === 'omPz_baixa');
  const env = om({ status: 'enviada', prio: 'alta', clienteUid: 'cliP', hEnvio: '2026-11-17T08:00' });
  const p = prazoOm(env, null, '2026-11-17T20:00'); assert.equal(p.horas, 24); assert.equal(p.resta, 12 * 60); assert.equal(p.fora, false);
  assert.ok(foraDoPrazo(env, null, '2026-11-18T08:01'));
  assert.ok(!foraDoPrazo(env, { prazos: { alta: 0 } }, '2026-11-30T08:00'), '0 = sem prazo');
  assert.equal(prazoOm({ ...env, status: 'aprovada' }, null, '2026-11-20T08:00'), null, 'só conta depois de enviada');
  const lib = prazoOm({ ...env, status: 'liberada', hLib: '2026-11-18T10:00' }, null, '2026-11-30T00:00'); assert.ok(lib.fora && !lib.aberta, 'liberou fora do prazo');
  assert.equal(visaoHoje([env], '2026-11-18', null, '2026-11-18T09:00').foraPrazo, 1);
  // Aviso: o cliente e quem trata, mesmo que a última mudança seja antiga; uma vez por envio.
  const us = { ...Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { ...u }])), cliP: { papel: 'leitor', acesso: { operacao: 'leitor' }, escopos: ['patio'] } };
  const av = avisosOms([{ ...env, hEnvio: '2026-11-10T08:00', hist: [{ s: 'enviada', em: '2026-11-10T08:00' }] }], us, '2026-11-18', null, '2026-11-18T09:00');
  assert.deepEqual(av.filter(x => x.tipo === 'prazo').map(x => x.uid).sort(), ['adm', 'cliP', 'tec']);
  assert.ok(av.every(x => x.chave.endsWith('|prazo|2026-11-10T08:00')));
  assert.equal(linhasExcel([env], a => a, null)[0].length, linhasExcel([env], a => a, null)[1].length);
});

test('cliente recusa ou cancela, com motivo e hora; o técnico reenvia a recusada', () => {
  const cli = { uid: 'cliP', papel: 'leitor', acesso: { operacao: 'leitor' }, escopos: ['patio'] };
  const env = om({ status: 'enviada', prio: 'alta', clienteUid: 'cliP', cliente: 'Usuário Pátio', hEnvio: '2026-11-17T08:00', hCiente: '2026-11-17T08:10', cienteNome: 'Usuário Pátio' });
  assert.ok(ABERTAS.includes('recusada') && STATUS.recusada);
  assert.throws(() => mudar(env, 'recusar', { uid: 'cliP', nome: 'Usuário Pátio' }, { motivo: 'não', peloCliente: true }), e => e.campo === 'omMotivo');
  const r = mudar(env, 'recusar', { uid: 'cliP', nome: 'Usuário Pátio' }, { motivo: 'Falta a APR assinada', obs: 'Liberamos amanhã', peloCliente: true });
  assert.equal(r.status, 'recusada'); assert.equal(r.cancCli, true); assert.equal(r.cancNome, 'Usuário Pátio'); assert.ok(r.hCanc);
  assert.equal(r.hist[0].txt, 'Falta a APR assinada'); assert.equal(r.hist[0].obs, 'Liberamos amanhã');
  const rec = { ...env, ...r };
  assert.deepEqual(acoesDe(rec, cli), [], 'depois de recusar, o cliente só acompanha');
  assert.deepEqual(acoesDe(rec, U.tec), ['enviar', 'cancelar', 'obs', 'docs', 'apagar'], 'o técnico ajusta e reenvia ou cancela');
  const re = mudar(rec, 'enviar', { uid: 'tec', nome: 'Técnico' }, { cliente: { uid: 'cliP', nome: 'Usuário Pátio' }, obs: 'APR anexada' });
  assert.equal(re.status, 'enviada'); assert.equal(re.motivo, ''); assert.equal(re.cancCli, false); assert.equal(re.hCiente, '', 'o cliente confirma de novo');
  assert.match(re.hist.at(-1).txt, /^reenviada/); assert.equal(re.hist.at(-1).obs, 'APR anexada');
  // Técnico registra a recusa que veio por fora.
  const rt = mudar(env, 'recusar', { uid: 'tec', nome: 'Técnico' }, { motivo: 'Cliente pediu outra data' });
  assert.equal(rt.cancCli, false); assert.match(rt.hist[0].txt, /registrada pelo técnico/);
  // Cancelar pelo cliente, também com a OM já liberada.
  const lib = { ...env, status: 'liberada', hLib: '2026-11-17T09:00' };
  assert.ok(acoesDe(lib, cli).includes('cancelar'));
  const c = mudar(lib, 'cancelar', { uid: 'cliP', nome: 'Usuário Pátio' }, { motivo: 'Equipamento entrou em produção', peloCliente: true });
  assert.equal(c.status, 'cancelada'); assert.equal(c.cancCli, true); assert.match(c.hist[0].txt, /^pelo cliente/);
  // Avisos: recusa e cancelamento pelo cliente vão para quem abriu e quem trata (não para o próprio cliente).
  const us = { ...Object.fromEntries(Object.entries(U).map(([k, u]) => [k, { ...u }])), cliP: cli };
  const av = avisosOms([{ ...rec, id: 'r1' }, { ...lib, ...c, id: 'c1' }], us, '2026-11-17', null, agoraLocal());
  const hoje = agoraLocal().slice(0, 10);
  const av2 = avisosOms([{ ...rec, id: 'r1' }, { ...lib, ...c, id: 'c1' }], us, hoje, null, agoraLocal());
  assert.deepEqual(av2.filter(x => x.tipo === 'recusada').map(x => x.uid).sort(), ['adm', 'lider', 'tec']);
  assert.deepEqual(av2.filter(x => x.tipo === 'cancelada').map(x => x.uid).sort(), ['adm', 'lider', 'tec']);
  assert.ok(Array.isArray(av));
  // Cancelada pelo Dikma não avisa.
  assert.equal(avisosOms([{ ...env, ...mudar(env, 'cancelar', { uid: 'tec', nome: 'T' }, { motivo: 'Duplicada' }) }], us, hoje, null, agoraLocal()).length, 0);
});

test('observações em todos os passos ficam no histórico', () => {
  const q = { uid: 'tec', nome: 'Técnico' };
  assert.equal(mudar(om(), 'aprovar', q, { obs: 'Ver com a elétrica' }).hist[0].obs, 'Ver com a elétrica');
  assert.equal(mudar(om({ status: 'planejada', dPrev: '2026-11-20' }), 'solicitar', q, { obs: 'Urgente' }).hist[0].obs, 'Urgente');
  assert.equal(mudar(om({ status: 'devolvida' }), 'reenviar', q, { obs: 'Foto incluída' }).hist[0].obs, 'Foto incluída');
  assert.equal(mudar(om(), 'aprovar', q, {}).hist[0].obs, undefined, 'sem observação, a linha fica limpa');
  assert.throws(() => mudar(om(), 'obs', q, { obs: ' ' }), e => e.campo === 'omObs');
  const o = mudar(om({ status: 'enviada' }), 'obs', q, { obs: 'Equipamento só para às 14h' });
  assert.deepEqual(Object.keys(o), ['hist'], 'observação avulsa não muda a situação');
  const x = { ...om(), hist: [...o.hist, { s: 'aprovada', em: '2026-11-17T08:00' }] };
  assert.deepEqual(observacoes(x).map(y => y.obs), ['Equipamento só para às 14h']);
  const ex = linhasExcel([x]); assert.equal(ex[0].length, ex[1].length); assert.match(ex[1].at(-1), /14h/);
});
