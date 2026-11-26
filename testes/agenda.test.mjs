// Gestão › Minha agenda: contas sem tela (public/contas/agenda.js) e a aba que começa desligada para todos os perfis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferir, grupo, agrupar, notas, concluidos, resumo, buscar } from '../public/contas/agenda.js';
import { doPerfil, podeVer } from '../public/contas/permissoes.js';

const H = '2026-11-26';

test('conferir: exige título, compromisso precisa de dia e a anotação não guarda dia, hora nem "feita"', () => {
  assert.equal(conferir({ tipo: 'tarefa', titulo: '  ' }).ok, false);
  assert.equal(conferir({ tipo: 'compromisso', titulo: 'Reunião' }).ok, false);
  const c = conferir({ tipo: 'compromisso', titulo: ' Reunião ', data: H, hora: '14:00' });
  assert.deepEqual(c.item, { tipo: 'compromisso', titulo: 'Reunião', texto: '', data: H, hora: '14:00', feito: false, fixa: false });
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
