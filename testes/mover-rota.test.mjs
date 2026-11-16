// Mover de rota no dia (Operação › Escala do dia): quem pede, quem aprova e onde a pessoa fica no dia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedirMov, decidirMov, podePedir, podeAprovar, movsDoDia, aprovadasDoDia, rotaNoDia, pessoasDaRota, pessoasDaArea, partesRota } from '../public/contas/mover-rota.js';

const D = '2026-11-21', EM = '2026-11-21T08:00:00.000Z';
const lider = { uid: 'L1', nome: 'Líder', perfil: 'lider', areas: ['RECEBIMENTO'], admin: false };
const sup = { uid: 'S1', nome: 'Supervisor', perfil: 'supervisor', areas: ['RECEBIMENTO', 'PREPARAÇÃO'], admin: false };
const supOutro = { uid: 'S2', nome: 'Outro', perfil: 'supervisor', areas: ['PREPARAÇÃO'], admin: false };
const adm = { uid: 'A1', nome: 'Admin', perfil: 'admin', areas: [], admin: true };
const c1 = { id: 'C1', area: 'RECEBIMENTO', rota: 'R1' }, c2 = { id: 'C2', area: 'RECEBIMENTO', rota: 'R2' }, c3 = { id: 'C3', area: 'PREPARAÇÃO', rota: 'P1' };

test('quem pede e quem aprova', () => {
  assert.equal(podePedir(lider, 'RECEBIMENTO', 'RECEBIMENTO'), true);
  assert.equal(podePedir(lider, 'RECEBIMENTO', 'PREPARAÇÃO'), false, 'líder não pede para outra área');
  assert.equal(podePedir(lider, 'PREPARAÇÃO', 'PREPARAÇÃO'), false, 'líder de outra área');
  assert.equal(podePedir(sup, 'RECEBIMENTO', 'PREPARAÇÃO'), true, 'supervisor pede para outra área');
  assert.equal(podeAprovar(lider, 'RECEBIMENTO', 'RECEBIMENTO'), false);
  assert.equal(podeAprovar(sup, 'RECEBIMENTO', 'RECEBIMENTO'), true);
  assert.equal(podeAprovar(supOutro, 'RECEBIMENTO', 'RECEBIMENTO'), false);
  assert.equal(podeAprovar(sup, 'RECEBIMENTO', 'PREPARAÇÃO'), false, 'outra área: só o administrador');
  assert.equal(podeAprovar(adm, 'RECEBIMENTO', 'PREPARAÇÃO'), true);
});

test('líder pede (pendente), supervisor aprova; quem aprova já move direto', () => {
  const p = pedirMov(null, { c: c1, dt: D, para: 'RECEBIMENTO|R2', quem: lider, em: EM });
  assert.equal(p.st, 'pendente'); assert.equal(p.de, 'RECEBIMENTO|R1'); assert.equal(p.ao, 'RECEBIMENTO'); assert.equal(p.ap, 'RECEBIMENTO'); assert.equal(p.por, 'L1');
  assert.throws(() => decidirMov(p, 'aprovado', { quem: lider, em: EM }), /supervisor/);
  assert.throws(() => decidirMov(p, 'aprovado', { quem: supOutro, em: EM }));
  const a = decidirMov(p, 'aprovado', { quem: sup, em: EM });
  assert.equal(a.st, 'aprovado'); assert.equal(a.ok, 'S1'); assert.equal(a.por, 'L1');
  assert.throws(() => decidirMov(a, 'aprovado', { quem: sup, em: EM }), /já foi decidida/);
  assert.throws(() => pedirMov(a, { c: c1, dt: D, para: 'RECEBIMENTO|R3', quem: lider, em: EM }), /já foi aprovada/);
  const direto = pedirMov(null, { c: c1, dt: D, para: 'RECEBIMENTO|R2', quem: sup, em: EM });
  assert.equal(direto.st, 'aprovado');
  assert.throws(() => pedirMov(null, { c: c1, dt: D, para: 'RECEBIMENTO|R1', quem: lider, em: EM }), /já está/);
  assert.throws(() => pedirMov(null, { c: c1, dt: D, para: 'PREPARAÇÃO|P1', quem: lider, em: EM }), /supervisor/);
});

test('outra área: supervisor pede e só o administrador aprova; recusar pede motivo; cancelar', () => {
  const p = pedirMov(null, { c: c1, dt: D, para: 'PREPARAÇÃO|P1', quem: sup, em: EM });
  assert.equal(p.st, 'pendente');
  assert.throws(() => decidirMov(p, 'aprovado', { quem: sup, em: EM }), /administrador/);
  assert.equal(decidirMov(p, 'aprovado', { quem: adm, em: EM }).st, 'aprovado');
  const q = pedirMov(null, { c: c1, dt: D, para: 'RECEBIMENTO|R2', quem: lider, em: EM });
  assert.throws(() => decidirMov(q, 'recusado', { quem: sup, em: EM }), /motivo/);
  const r = decidirMov(q, 'recusado', { quem: sup, em: EM, mot: '  Falta gente na R1 ' });
  assert.equal(r.st, 'recusado'); assert.equal(r.mot, 'Falta gente na R1');
  assert.equal(decidirMov(q, 'cancelado', { quem: lider, em: EM }).st, 'cancelado', 'quem pediu cancela');
  const a = decidirMov(q, 'aprovado', { quem: sup, em: EM });
  assert.throws(() => decidirMov(a, 'cancelado', { quem: lider, em: EM }), /supervisor/);
  assert.equal(decidirMov(a, 'cancelado', { quem: sup, em: EM }).st, 'cancelado');
});

test('onde a pessoa fica no dia: só a aprovada muda a rota; vale só naquele dia', () => {
  const mapa = {
    ['C1|' + D]: { ...pedirMov(null, { c: c1, dt: D, para: 'RECEBIMENTO|R2', quem: sup, em: EM }) },
    ['C2|' + D]: { ...pedirMov(null, { c: c2, dt: D, para: 'RECEBIMENTO|R1', quem: lider, em: EM }) },
    ['C3|' + D]: { ...decidirMov(pedirMov(null, { c: c3, dt: D, para: 'RECEBIMENTO|R1', quem: { ...sup }, em: EM }), 'aprovado', { quem: adm, em: EM }) },
    ['C1|2026-11-22']: { ...pedirMov(null, { c: c1, dt: '2026-11-22', para: 'RECEBIMENTO|R2', quem: sup, em: EM }), st: 'cancelado' }
  };
  assert.equal(movsDoDia(mapa, D).length, 3);
  assert.equal(movsDoDia(mapa, '2026-11-22').length, 0, 'cancelada não conta');
  const ap = aprovadasDoDia(mapa, D);
  assert.deepEqual([...ap.keys()].sort(), ['C1', 'C3']);
  assert.equal(rotaNoDia(c1, ap), 'RECEBIMENTO|R2');
  assert.equal(rotaNoDia(c2, ap), 'RECEBIMENTO|R2', 'pendente: segue na origem');
  assert.equal(rotaNoDia(c1, aprovadasDoDia(mapa, '2026-11-22')), 'RECEBIMENTO|R1', 'outro dia: a do cadastro');
  const cs = [c1, c2, c3];
  assert.deepEqual(pessoasDaRota(cs, 'RECEBIMENTO', 'R1', ap).map(c => c.id), ['C3']);
  assert.deepEqual(pessoasDaRota(cs, 'RECEBIMENTO', 'R2', ap).map(c => c.id), ['C1', 'C2']);
  assert.deepEqual(pessoasDaArea(cs, 'PREPARAÇÃO', ap).map(c => c.id), [], 'foi para outra área');
  assert.deepEqual(pessoasDaArea(cs, 'RECEBIMENTO', ap).map(c => c.id), ['C1', 'C2', 'C3']);
  // cadastro mudou depois (outra rota): a movimentação antiga não vale mais
  assert.equal(rotaNoDia({ ...c1, rota: 'R5' }, ap), 'RECEBIMENTO|R5');
  assert.deepEqual(partesRota('ÁREA X|ROTA 1'), { area: 'ÁREA X', rota: 'ROTA 1' });
});
