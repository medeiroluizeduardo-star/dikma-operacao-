// Gestão › Minha agenda: contas sem tela (public/contas/agenda.js) e a aba que começa desligada para todos os perfis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferir, grupo, agrupar, notas, concluidos, resumo, buscar, seguinte, proxima, ocorrencias, marcarFeita, adiar, lixeira, vencidosLixeira, andamento, etiquetas, corEtq, calendario, mesMais, semanaPdf, avisosAgenda, limparLink } from '../public/contas/agenda.js';
import { doPerfil, podeVer } from '../public/contas/permissoes.js';

const H = '2026-11-26';

test('conferir: exige título, compromisso precisa de dia e a anotação não guarda dia, hora nem "feita"', () => {
  assert.equal(conferir({ tipo: 'tarefa', titulo: '  ' }).ok, false);
  assert.equal(conferir({ tipo: 'compromisso', titulo: 'Reunião' }).ok, false);
  const c = conferir({ tipo: 'compromisso', titulo: ' Reunião ', data: H, hora: '14:00' });
  assert.deepEqual(c.item, { tipo: 'compromisso', titulo: 'Reunião', texto: '', data: H, hora: '14:00', rep: '', prio: 'normal', etq: '', passos: [], feito: false, fixa: false, compL: [] });
  const n = conferir({ tipo: 'nota', titulo: 'Ideia', data: H, hora: '10:00', feito: true, fixa: true });
  assert.equal(n.item.data, ''); assert.equal(n.item.hora, ''); assert.equal(n.item.feito, false); assert.equal(n.item.fixa, true);
  assert.equal(conferir({ tipo: 'tarefa', titulo: 'X', hora: '10:00' }).item.hora, '', 'hora sem dia não fica');
  assert.equal(conferir({ tipo: 'tarefa', titulo: 'X', data: H, hora: '25:00' }).item.hora, '', 'hora inválida não fica');
  assert.equal(conferir({ tipo: 'outro', titulo: 'X' }).item.tipo, 'tarefa');
  assert.equal(conferir({ tipo: 'tarefa', titulo: 'x'.repeat(300) }).item.titulo.length, 200);
});

test('grupos: atrasada, hoje, amanhã, próximos 7 dias, depois, sem data, feita e compromisso que passou', () => {
  const t = (data, x = {}) => ({ tipo: 'tarefa', titulo: 't', data, ...x });
  assert.equal(grupo(t('2026-11-25'), H), 'atrasada');
  assert.equal(grupo(t('2026-11-25', { tipo: 'compromisso' }), H), 'passou');
  assert.equal(grupo(t(H), H), 'hoje');
  assert.equal(grupo(t('2026-11-27'), H), 'amanha');
  assert.equal(grupo(t('2026-12-03'), H), 'semana');
  assert.equal(grupo(t('2026-12-04'), H), 'depois');
  assert.equal(grupo(t(''), H), 'semdata');
  assert.equal(grupo(t('2026-11-01', { feito: true }), H), 'feito');
  assert.equal(grupo({ tipo: 'nota', titulo: 'n' }, H), 'nota');
});

test('agrupar, notas, concluídos, resumo e busca', () => {
  const l = [
    { id: 'a', tipo: 'compromisso', titulo: 'Reunião', data: H, hora: '14:00' },
    { id: 'b', tipo: 'tarefa', titulo: 'Ligar', data: H, hora: '08:00' },
    { id: 'c', tipo: 'tarefa', titulo: 'Atrasada', data: '2026-11-20' },
    { id: 'd', tipo: 'tarefa', titulo: 'Feita', data: '2026-11-20', feito: true },
    { id: 'e', tipo: 'nota', titulo: 'Velha', texto: 'Correia três', atualizadoEm: '2026-11-01' },
    { id: 'f', tipo: 'nota', titulo: 'Fixada', fixa: true, atualizadoEm: '2026-10-01' },
    { id: 'g', tipo: 'nota', titulo: 'Nova', atualizadoEm: '2026-11-20' }
  ];
  const g = agrupar(l, H);
  assert.deepEqual(g.hoje.map(x => x.id), ['b', 'a'], 'hoje na ordem da hora');
  assert.deepEqual(g.atrasada.map(x => x.id), ['c']);
  assert.deepEqual(notas(l).map(x => x.id), ['f', 'g', 'e'], 'fixada primeiro, depois a mais recente');
  assert.deepEqual(concluidos(l, H).map(x => x.id), ['d']);
  assert.deepEqual(resumo(l, H), { hoje: 2, atrasadas: 1, semana: 2, notas: 3 });
  assert.deepEqual(buscar(l, 'correia TRES').map(x => x.id), ['e'], 'sem diferença de acento e maiúscula');
  assert.equal(buscar(l, '').length, l.length);
});

test('a aba Minha agenda começa desligada: só aparece para o perfil ou a pessoa em que o administrador ligar', () => {
  const v = { id: 'gagenda', mod: 'gestao', desligada: true };
  const u = { acesso: { gestao: 'supervisor' } };
  assert.equal(doPerfil('gestao', 'supervisor', v, {}), false, 'sem nada configurado, desligada');
  assert.equal(podeVer(u, v, {}, 'gestao'), false);
  assert.equal(podeVer(u, v, { 'gestao|supervisor': { gagenda: true } }, 'gestao'), true, 'ligada no perfil');
  assert.equal(podeVer({ ...u, abas: { gagenda: true } }, v, {}, 'gestao'), true, 'ligada só para a pessoa');
  assert.equal(podeVer({ acesso: { rh: 'administrativo' }, abas: { gagenda: true } }, v, {}, 'gestao'), false, 'sem a Gestão não vê');
  assert.equal(podeVer({ acesso: { administracao: 'admin' } }, v, {}, 'gestao'), true, 'o administrador vê');
});

test('repetir: dia, dia útil, semana e mês (31 vira o último dia); próxima data a partir de hoje', () => {
  assert.equal(seguinte('2026-11-27', 'dia'), '2026-11-28');
  assert.equal(seguinte('2026-11-27', 'util'), '2026-11-30', 'sexta → segunda');
  assert.equal(seguinte('2026-11-27', 'semana'), '2026-12-04');
  assert.equal(seguinte('2026-01-31', 'mes'), '2026-02-28');
  assert.equal(seguinte('2026-02-28', 'mes', '2026-01-31'), '2026-03-31', 'volta ao dia 31 da data de início');
  assert.equal(proxima({ data: '2026-11-05', rep: 'semana' }, H), '2026-11-26');
  assert.equal(proxima({ data: '2026-11-06', rep: 'semana' }, H), '2026-11-27');
  assert.equal(proxima({ data: '2026-11-01' }, H), '2026-11-01', 'sem repetição fica a data');
  assert.deepEqual(ocorrencias({ tipo: 'compromisso', data: '2026-11-02', rep: 'semana' }, '2026-11-01', '2026-11-30'), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.deepEqual(ocorrencias({ tipo: 'tarefa', data: '2026-11-02', rep: 'semana' }, '2026-11-01', '2026-11-30'), ['2026-11-02'], 'tarefa repetida só na data atual');
  const c = conferir({ tipo: 'compromisso', titulo: 'DDS', data: '2026-11-02', rep: 'semana' });
  assert.equal(grupo(c.item, H), 'semana', 'compromisso repetido nunca fica "passou"');
  assert.equal(conferir({ tipo: 'tarefa', titulo: 'X', rep: 'dia' }).ok, false, 'repetir pede a data');
  assert.equal(conferir({ tipo: 'nota', titulo: 'X', rep: 'dia', data: H }).item.rep, '');
});

test('feita, adiar, passos, etiquetas, lixeira e ligação com outra tela', () => {
  const t = { tipo: 'tarefa', titulo: 'Fechar', data: '2026-11-20', rep: 'semana', passos: [{ t: 'a', ok: true }] };
  const f = marcarFeita(t, H);
  assert.equal(f.data, '2026-11-27'); assert.equal(f.feito, false); assert.equal(f.passos[0].ok, false, 'passos voltam desmarcados');
  assert.equal(marcarFeita({ tipo: 'tarefa', titulo: 'X', data: H }, H).feito, true);
  assert.equal(adiar(t, H, 1).data, '2026-11-27'); assert.equal(adiar(t, H, 7).data, '2026-12-03');
  assert.deepEqual(andamento({ passos: [{ t: 'a', ok: true }, { t: 'b', ok: false }] }), { feitos: 1, total: 2 });
  assert.equal(andamento({}), null);
  const p = conferir({ tipo: 'tarefa', titulo: 'X', passos: [{ t: ' a ', ok: 1 }, { t: '' }], etq: '  Pátio   Norte ' }).item;
  assert.deepEqual(p.passos, [{ t: 'a', ok: true }]); assert.equal(p.etq, 'Pátio Norte');
  assert.deepEqual(conferir({ tipo: 'compromisso', titulo: 'X', data: H, passos: [{ t: 'a' }] }).item.passos, [], 'passos só na tarefa');
  const l = [{ etq: 'B' }, { etq: 'A' }, { etq: 'B' }, { etq: 'C', apagadoEm: '2026-11-01' }];
  assert.deepEqual(etiquetas(l), ['A', 'B']);
  assert.equal(corEtq('Pátio'), corEtq('Pátio')); assert.ok(corEtq('x') >= 0 && corEtq('x') < 6);
  const lx = [{ id: '1', tipo: 'tarefa', titulo: 'a', apagadoEm: '2026-10-20T10:00:00Z' }, { id: '2', tipo: 'tarefa', titulo: 'b', apagadoEm: '2026-11-25T10:00:00Z' }, { id: '3', tipo: 'nota', titulo: 'c' }];
  assert.deepEqual(lixeira(lx).map(x => x.id), ['2', '1']);
  assert.deepEqual(vencidosLixeira(lx, H).map(x => x.id), ['1'], '30 dias na lixeira');
  assert.equal(grupo(lx[1], H), 'lixeira'); assert.deepEqual(notas(lx).map(x => x.id), ['3']);
  assert.deepEqual(limparLink({ v: 'oms', act: 'omAbrir', id: 'o1', outro: 'x', r: 'OM' }), { v: 'oms', act: 'omAbrir', id: 'o1', r: 'OM' });
  assert.equal(limparLink({ id: 'x' }), null, 'sem aba não liga');
  assert.deepEqual(conferir({ tipo: 'nota', titulo: 'N', compL: [' Ana ', 'ana', 'BETO'] }).item.compL, ['ana', 'beto'], 'compartilhar: usuários sem repetir');
  assert.deepEqual(conferir({ tipo: 'tarefa', titulo: 'T', compL: ['ana'] }).item.compL, [], 'só anotação compartilha');
});

test('calendário do mês, PDF da semana e avisos', () => {
  const l = [{ id: 'c', tipo: 'compromisso', titulo: 'DDS', data: '2026-11-02', rep: 'semana', hora: '07:30' }, { id: 't', tipo: 'tarefa', titulo: 'T', data: H }];
  const cal = calendario(l, '2026-11');
  assert.equal(cal[0][0].d, '2026-11-01', 'novembro de 2026 começa num domingo');
  assert.equal(cal.flat().filter(c => !c.fora).length, 30);
  assert.deepEqual(cal.flat().filter(c => c.itens.some(i => i.id === 'c')).map(c => c.d), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  assert.equal(mesMais('2026-12', 1), '2027-01'); assert.equal(mesMais('2026-01', -1), '2025-12');
  const s = semanaPdf([...l, { id: 'a', tipo: 'tarefa', titulo: 'Atrasada', data: '2026-11-20' }, { id: 'n', tipo: 'nota', titulo: 'N', fixa: true }], H);
  assert.equal(s.dias.length, 7); assert.deepEqual(s.dias[0].itens.map(i => i.id), ['t']);
  assert.deepEqual(s.dias[4].itens.map(i => i.id), ['c'], 'segunda 30/11');
  assert.deepEqual(s.atrasadas.map(i => i.id), ['a']); assert.deepEqual(s.fixadas.map(i => i.id), ['n']);
  const av = avisosAgenda([{ id: 'x', uid: 'u', tipo: 'compromisso', titulo: 'R', data: H, hora: '09:00' }, { id: 'y', uid: 'u', tipo: 'tarefa', titulo: 'F', data: H, feito: true }], H, 7 * 60 + 35);
  assert.deepEqual(av.map(a => a.tipo), ['dia', 'hora']); assert.equal(av[1].falta, 85);
  assert.equal(avisosAgenda([{ id: 'x', uid: 'u', tipo: 'compromisso', titulo: 'R', data: H, hora: '09:00' }], H, 7 * 60).filter(a => a.tipo === 'hora').length, 0, 'faltando 2 h ainda não avisa');
});
