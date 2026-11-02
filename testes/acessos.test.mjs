// Testes da conversão do acesso por módulo (public/acessos.js): cadastro antigo → modelo novo → campos antigos.
// Não precisa do emulador: node --test testes/acessos.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acessoDoLegado, legadoDoAcesso, acessoDe, modulosDe, selosAcesso, MODULOS_ACESSO } from '../public/acessos.js';

const ord = l => [...l].sort();
// Ida e volta: o que as telas e as regras de hoje enxergam (papel e módulos efetivos) não muda.
function idaEVolta(u) {
  const n = acessoDoLegado(u);
  const v = legadoDoAcesso(n.acesso, n.escopos, { fichas: n.fichas, area: u.area, area2: u.area2 });
  return { n, v, efetivo: ord(modulosDe({ ...u, ...v })) };
}

test('líder do Pátio: Operação · Líder com escopo Pátio, sem Gestão', () => {
  const r = acessoDoLegado({ papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'] });
  assert.deepEqual(r.acesso, { operacao: 'lider' });
  assert.deepEqual(r.escopos, ['patio']);
});
test('líder com Fichas ganha Gestão · Líder', () => {
  const r = acessoDoLegado({ papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'] });
  assert.deepEqual(r.acesso, { operacao: 'lider', gestao: 'lider' });
  assert.equal(r.fichas, true);
});
test('supervisor, coordenador e gestor com Pátio/Bateria ganham Gestão com o mesmo perfil', () => {
  for (const papel of ['supervisor', 'coordenador', 'gestor']) {
    const r = acessoDoLegado({ papel, modulos: ['operacao', 'bateria'] });
    assert.equal(r.acesso.operacao, papel); assert.equal(r.acesso.gestao, papel);
    assert.deepEqual(r.escopos, ['patio', 'bateria']); assert.equal(r.fichas, false);
  }
});
test('gestor ganha Administração dos módulos; o administrador ganha tudo', () => {
  assert.equal(acessoDoLegado({ papel: 'gestor', modulos: ['operacao'] }).acesso.administracao, 'modulo');
  const a = acessoDoLegado({ papel: 'admin' });
  assert.deepEqual(Object.keys(a.acesso).sort(), MODULOS_ACESSO.map(m => m.k).sort());
  assert.equal(a.acesso.administracao, 'admin');
  assert.deepEqual(a.escopos, ['patio', 'bateria', 'equipamentos']);
});
test('só Equipamentos: Operação com escopo Equipamentos, sem Gestão automática', () => {
  const r = acessoDoLegado({ papel: 'supervisor', modulos: ['equipamentos'] });
  assert.deepEqual(r.acesso, { operacao: 'supervisor' });
  assert.deepEqual(r.escopos, ['equipamentos']);
});
test('só Fichas: Gestão com o perfil de hoje', () => {
  assert.deepEqual(acessoDoLegado({ papel: 'supervisor', modulos: ['gestao'] }).acesso, { gestao: 'supervisor' });
  assert.deepEqual(acessoDoLegado({ papel: 'coordenador', modulos: ['gestao'] }).acesso, { gestao: 'coordenador' });
});
test('Frequência ou papel Administrativo → RH', () => {
  assert.deepEqual(acessoDoLegado({ papel: 'supervisor', modulos: ['frequencia'] }).acesso, { rh: 'administrativo' });
  assert.deepEqual(acessoDoLegado({ papel: 'administrativo', modulos: ['operacao', 'gestao', 'frequencia'] }).acesso, { operacao: 'leitor', gestao: 'administrativo', rh: 'administrativo' });
  assert.deepEqual(acessoDoLegado({ papel: 'supervisor', modulos: [], acessos: ['administrativo'] }).acesso, { rh: 'administrativo' }, 'antigo acesso Administrativo');
});
test('somente leitura fica leitor nos módulos que tinha', () => {
  const r = acessoDoLegado({ papel: 'leitor', modulos: ['operacao', 'frequencia'] });
  assert.deepEqual(r.acesso, { operacao: 'leitor', gestao: 'leitor', rh: 'leitor' });
  assert.deepEqual(acessoDoLegado({ papel: 'leitor', modulos: ['gestao'] }).acesso, { gestao: 'leitor' });
});
test('Segurança: ninguém ganha na conversão', () => {
  for (const papel of ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor']) {
    const r = acessoDoLegado({ papel, modulos: ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'] });
    if (papel !== 'admin') assert.equal(r.acesso.seguranca, undefined, papel);
  }
});
test('bloqueado fica sem acesso', () => {
  assert.deepEqual(acessoDoLegado({ papel: 'bloqueado', modulos: ['operacao'] }), { acesso: {}, escopos: [], fichas: false });
});
test('usuário antigo sem o campo modulos = Atividades Pátio', () => {
  assert.deepEqual(acessoDoLegado({ papel: 'lider', area: 'RECEBIMENTO' }), { acesso: { operacao: 'lider' }, escopos: ['patio'], fichas: false });
});

test('legadoDoAcesso: papel = perfil mais alto e módulos tirados dos escopos', () => {
  const v = legadoDoAcesso({ operacao: 'lider', gestao: 'supervisor' }, ['patio'], { area: 'RECEBIMENTO', area2: 'PREPARAÇÃO' });
  assert.equal(v.papel, 'supervisor');
  assert.deepEqual(v.modulos, ['operacao', 'gestao']);
  assert.equal(v.area, 'RECEBIMENTO'); assert.equal(v.area2, 'PREPARAÇÃO');
  const l = legadoDoAcesso({ operacao: 'lider', gestao: 'lider' }, ['patio'], { area: 'RECEBIMENTO', area2: 'PREPARAÇÃO' });
  assert.equal(l.papel, 'lider'); assert.equal(l.area2, null, 'líder tem uma área só');
  assert.deepEqual(l.modulos, ['operacao', 'gestao']);
  assert.deepEqual(legadoDoAcesso({ operacao: 'gestor' }, ['patio'], { area: 'RECEBIMENTO' }).area, null, 'gestor vê todas as áreas');
});
test('legadoDoAcesso: Gestão sem Fichas não marca o módulo das fichas', () => {
  assert.deepEqual(legadoDoAcesso({ operacao: 'supervisor', gestao: 'supervisor' }, ['bateria'], { fichas: false }).modulos, ['bateria']);
});
test('legadoDoAcesso: Administração e RH', () => {
  assert.equal(legadoDoAcesso({ administracao: 'admin' }, []).papel, 'admin');
  assert.equal(legadoDoAcesso({ operacao: 'lider', administracao: 'modulo' }, ['patio']).papel, 'gestor');
  assert.deepEqual(legadoDoAcesso({ rh: 'leitor' }, []), { papel: 'leitor', modulos: ['frequencia'], acessos: ['operacao'], area: null, area2: null });
  assert.equal(legadoDoAcesso({ operacao: 'lider', rh: 'administrativo' }, ['patio']).papel, 'lider');
});
test('legadoDoAcesso: só Segurança não abre nenhum módulo de hoje', () => {
  const v = legadoDoAcesso({ seguranca: 'registra' }, []);
  assert.equal(v.papel, 'leitor');
  assert.deepEqual(modulosDe({ ...v }).filter(m => m !== 'seguranca'), []);
  assert.equal(legadoDoAcesso({ seguranca: 'gestor', operacao: 'lider' }, ['patio']).papel, 'lider', 'gestor da Segurança não vira gestor do resto');
});
test('legadoDoAcesso: bloqueado guarda o acesso e bloqueia pelo papel', () => {
  assert.equal(legadoDoAcesso({ operacao: 'lider' }, ['patio'], { bloqueado: true }).papel, 'bloqueado');
  assert.equal(legadoDoAcesso({ administracao: 'admin' }, [], { bloqueado: true }).papel, 'bloqueado');
});

// Ida e volta com todos os perfis e combinações de módulos de hoje.
const PAPEIS = ['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'];
const COMBOS = [['operacao'], ['bateria'], ['operacao', 'bateria'], ['equipamentos'], ['gestao'], ['frequencia'], ['operacao', 'gestao'], ['operacao', 'frequencia'],
  ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'], ['gestao', 'equipamentos'], ['bateria', 'gestao', 'frequencia'], ['equipamentos', 'frequencia']];
test('ida e volta (legado → novo → legado) mantém papel e módulos', () => {
  let n = 0;
  for (const papel of PAPEIS) for (const modulos of COMBOS) {
    const u = { papel, modulos, area: ['lider', 'supervisor'].includes(papel) ? 'RECEBIMENTO' : null, area2: papel === 'supervisor' ? 'BATERIA 1' : null };
    const { v, efetivo } = idaEVolta(u);
    const antes = ord(modulosDe(u));
    assert.deepEqual(efetivo, antes, `${papel} ${modulos}`);
    // Única troca de papel aceita: quem só tem RH (sem Operação nem Gestão) volta como Administrativo (mesmas permissões).
    const soRh = modulos.every(m => m === 'frequencia'); n++;
    if (soRh && !['leitor', 'administrativo', 'gestor'].includes(papel)) { assert.equal(v.papel, 'administrativo', `${papel} ${modulos}`); assert.equal(v.area, null); continue; }
    assert.equal(v.papel, papel, `${papel} ${modulos}`);
    assert.equal(v.area, u.area); assert.equal(v.area2, u.area2);
  }
  assert.equal(n, PAPEIS.length * COMBOS.length);
});
test('ida e volta: administrador, bloqueado, sem modulos e antigo acesso Administrativo', () => {
  const adm = idaEVolta({ papel: 'admin', modulos: ['operacao'] });
  assert.equal(adm.v.papel, 'admin');
  assert.deepEqual(adm.efetivo, ord(['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia']));
  const semMod = idaEVolta({ papel: 'lider', area: 'RECEBIMENTO' });
  assert.deepEqual(semMod.v.modulos, ['operacao']); assert.equal(semMod.v.papel, 'lider');
  const antigo = idaEVolta({ papel: 'leitor', acessos: ['administrativo'] });
  assert.equal(antigo.v.papel, 'leitor'); assert.deepEqual(antigo.efetivo, ['frequencia']);
  const gestorG = idaEVolta({ papel: 'gestor', modulos: ['gestao'] });
  assert.equal(gestorG.v.papel, 'gestor'); assert.deepEqual(gestorG.v.modulos, ['gestao']);
});
test('acessoDe: usa o modelo novo quando existe, senão mostra a conversão', () => {
  const novo = acessoDe({ papel: 'lider', modulos: ['operacao'], acesso: { operacao: 'lider', seguranca: 'registra' }, escopos: ['patio'] });
  assert.equal(novo.convertido, true); assert.equal(novo.acesso.seguranca, 'registra');
  const velho = acessoDe({ papel: 'lider', modulos: ['operacao'] });
  assert.equal(velho.convertido, false); assert.deepEqual(velho.acesso, { operacao: 'lider' });
  assert.deepEqual(selosAcesso({ operacao: 'lider', gestao: 'supervisor', administracao: 'modulo' }), [['Operação', 'Líder', 'operacao'], ['Gestão', 'Supervisor', 'gestao'], ['Administração', 'Dos módulos', 'administracao']]);
});

// ---- Fase 2: o perfil de cada módulo vale nas telas ----
import { perfilDe, escoposDe, temFichasU, marcasDe, usuarioEm, ehAdminU } from '../public/acessos.js';
import { podeVer, doPerfil, podeItemU, valorCfg, configuravel } from '../public/permissoes.js';
test('perfilDe: cada módulo tem o seu perfil; administrador é admin em tudo; bloqueado não tem nada', () => {
  const misto = { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'], acesso: { operacao: 'lider', gestao: 'leitor' }, escopos: ['patio'] };
  assert.equal(perfilDe(misto, 'operacao'), 'lider');
  assert.equal(perfilDe(misto, 'gestao'), 'leitor');
  assert.equal(perfilDe(misto, 'rh'), null);
  assert.equal(temFichasU(misto), false, 'Gestão sem as Fichas');
  assert.deepEqual(marcasDe(misto), ['operacao']);
  assert.equal(perfilDe({ papel: 'admin' }, 'seguranca'), 'admin');
  assert.equal(ehAdminU({ papel: 'gestor', acesso: { administracao: 'admin' } }), true);
  assert.equal(perfilDe({ papel: 'bloqueado', acesso: { operacao: 'gestor' }, escopos: ['patio'] }, 'operacao'), null);
  assert.deepEqual(escoposDe({ papel: 'bloqueado', acesso: { operacao: 'gestor' }, escopos: ['patio'] }), []);
  // cadastro antigo (sem acesso): converte na hora
  assert.equal(perfilDe({ papel: 'supervisor', modulos: ['frequencia'] }, 'rh'), 'administrativo');
  assert.equal(perfilDe({ papel: 'gestor', modulos: ['operacao'] }, 'administracao'), 'modulo');
});
test('usuarioEm: a pessoa vista no módulo tem o papel do módulo (usado pelas telas de Equipamentos, Fichas e Frequência)', () => {
  const u = { papel: 'supervisor', area: 'RECEBIMENTO', area2: 'PREPARAÇÃO', modulos: ['operacao', 'gestao'], acesso: { operacao: 'lider', gestao: 'supervisor', rh: 'leitor' }, escopos: ['patio'] };
  assert.equal(usuarioEm(u, 'operacao').papel, 'lider');
  assert.equal(usuarioEm(u, 'gestao').papel, 'supervisor');
  assert.equal(usuarioEm(u, 'rh').papel, 'leitor');
  assert.equal(usuarioEm(u, 'gestao'), usuarioEm(u, 'gestao'), 'guardado enquanto o cadastro não muda');
});
test('permissões por módulo: a configuração antiga (por perfil) vale para o mesmo perfil em cada módulo; a nova (módulo|perfil) manda', () => {
  const v = { id: 'causas', mod: 'gestao' }, ap = { id: 'apontar', mod: 'operacao' }, adm = { id: 'plano', mod: 'administracao' };
  const antigo = { lider: { causas: false, apontar: true }, gestor: { plano: false } };
  assert.equal(doPerfil('gestao', 'lider', v, antigo), false, 'formato antigo lido');
  assert.equal(doPerfil('operacao', 'lider', ap, antigo), true);
  assert.equal(doPerfil('administracao', 'modulo', adm, antigo), false, 'o Gestor antigo vale para a Administração Dos módulos');
  const novo = { ...antigo, 'gestao|lider': { causas: true } };
  assert.equal(valorCfg(novo, 'gestao', 'lider', 'causas'), true, 'a chave nova vence a antiga');
  assert.equal(configuravel('administracao', 'lider', adm), false);
  const misto = { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'], acesso: { operacao: 'lider', gestao: 'leitor' }, escopos: ['patio'] };
  assert.equal(podeVer(misto, v, { 'gestao|leitor': { causas: false } }), false, 'vale o perfil da Gestão (leitor), não o da Operação');
  assert.equal(podeVer(misto, v, { 'gestao|lider': { causas: false } }), true);
  assert.equal(podeVer(misto, { id: 'meudia', mod: 'all' }, {}, 'gestao'), true);
  // itens: apontar é da Operação; exportar existe em cada módulo
  assert.equal(podeItemU(misto, 'i_apontar', {}), true);
  assert.equal(podeItemU(misto, 'i_apontar', { 'operacao|lider': { i_apontar: false } }), false);
  assert.equal(podeItemU(misto, 'i_exportar', { 'gestao|leitor': { i_exportar_gestao: false } }, 'gestao'), false);
  assert.equal(podeItemU(misto, 'i_exportar', { 'gestao|leitor': { i_exportar_gestao: false } }, 'operacao'), true);
  assert.equal(podeItemU(misto, 'i_exportar', { leitor: { i_exportar: false } }, 'gestao'), false, 'item antigo lido no módulo');
});
