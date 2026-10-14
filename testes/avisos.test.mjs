// Testes de quem recebe qual aviso no celular (integracao/avisos/planejar.mjs). Não precisa do emulador.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let planejar, weekOf;
before(async () => {
  // a rotina copia as contas do site para lib/ antes de rodar; aqui faz o mesmo
  const lib = path.join(raiz, 'integracao', 'avisos', 'lib');
  fs.mkdirSync(lib, { recursive: true });
  for (const f of ['cal', 'hoje', 'escala', 'pessoas']) fs.writeFileSync(path.join(lib, f + '.mjs'), fs.readFileSync(path.join(raiz, 'public', f + '.js'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.mjs'"));
  ({ planejar } = await import(path.join(raiz, 'integracao', 'avisos', 'planejar.mjs')));
  ({ weekOf } = await import(path.join(lib, 'cal.mjs')));
});

const HOJE = '2026-10-14'; // quarta-feira
const tok = { tokens: ['t'] };
const usuarios = {
  admin: { papel: 'admin', nome: 'Administrador' },
  liderRec: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], nome: 'Ana Líder' },
  liderPrep: { papel: 'lider', area: 'PREPARAÇÃO', modulos: ['operacao', 'gestao'], nome: 'Beto Líder' },
  leitor: { papel: 'leitor', modulos: ['gestao'], nome: 'Leitor' },
  semAviso: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], nome: 'Sem Aviso' }
};
const avisos = { admin: tok, liderRec: tok, liderPrep: tok, leitor: tok, semAviso: { tokens: [] } };
const ocorr = [
  { id: 'o1', status: 'pendente', data: '2026-10-01', area: 'RECEBIMENTO', recolhe: 'ANA LÍDER', nome: 'FULANO DA SILVA' },
  { id: 'o2', status: 'pendente', data: '2026-10-02', area: 'RECEBIMENTO', recolhe: '', nome: 'CICLANO SOUZA' },
  { id: 'o3', status: 'pendente', data: '2026-10-02', area: 'PREPARAÇÃO', recolhe: 'BETO LÍDER', nome: 'BELTRANO LIMA' },
  { id: 'o4', status: 'pendente', data: '2026-10-13', area: 'RECEBIMENTO', recolhe: 'ANA LÍDER', nome: 'RECENTE' }
];
function setPatio() {
  const ini = weekOf(HOJE);
  const plano = [{ id: 'R1', rota: 'RECEBIMENTO' }, { id: 'R2', rota: 'MELHORIAS' }, { id: 'P1', rota: 'TOPO DO SILO' }];
  return {
    plano, colabs: [], sit: {}, rotas: [],
    semanas: {
      [`RECEBIMENTO|${ini}`]: { area: 'RECEBIMENTO', ini, ids: ['R1', 'R2'], s: { R1: 'PPPPP__', R2: 'RRPPP__' } },
      [`PREPARAÇÃO|${ini}`]: { area: 'PREPARAÇÃO', ini, ids: ['P1'], s: { P1: 'RRRRR__' } }
    }
  };
}
const rodar = (hora, extra = {}) => planejar({ usuarios, avisos, paradas: [], ocorr, sets: { patio: setPatio() }, enviados: {}, agora: new Date(`${HOJE}T${String(hora).padStart(2, '0')}:30:00`), hoje: HOJE, ...extra });
const de = (r, uid, tag) => r.msgs.filter(m => m.uid === uid && m.tag === tag);

test('assinaturas: cada um recebe só as dele; quem vê tudo recebe o total; sem nomes de colaboradores', () => {
  const r = rodar(8);
  const ana = de(r, 'liderRec', 'assinaturas');
  assert.equal(ana.length, 1);
  assert.equal(ana[0].titulo, '2 assinaturas pendentes há mais de 7 dias'); // o1 (com ela) + o2 (área dela, sem responsável)
  assert.match(ana[0].corpo, /1 com você/);
  const beto = de(r, 'liderPrep', 'assinaturas');
  assert.equal(beto[0].titulo, '1 assinatura com você há mais de 7 dias');
  assert.equal(de(r, 'admin', 'assinaturas')[0].titulo, '3 assinaturas pendentes há mais de 7 dias');
  assert.equal(de(r, 'leitor', 'assinaturas').length, 0, 'somente leitura não recolhe assinatura');
  assert.equal(de(r, 'semAviso', 'assinaturas').length, 0, 'sem aparelho, sem aviso');
  for (const m of r.msgs) for (const n of ['FULANO', 'CICLANO', 'BELTRANO', 'Fulano', 'Ciclano', 'Beltrano']) assert.ok(!(m.titulo + m.corpo).includes(n), 'nome de colaborador no aviso');
  assert.ok(r.marcar.includes('ass|' + HOJE));
  assert.equal(rodar(7).msgs.filter(m => m.tag === 'assinaturas').length, 0, 'antes das 8h não avisa');
  assert.equal(rodar(9, { enviados: { ['ass|' + HOJE]: HOJE } }).msgs.filter(m => m.tag === 'assinaturas').length, 0, 'uma vez por dia');
});

test('atividades sem apontar: às 15h, só líder e supervisor, só a área deles, uma vez por dia', () => {
  const r = rodar(15);
  const ana = de(r, 'liderRec', 'atividades');
  assert.equal(ana.length, 1);
  assert.equal(ana[0].titulo, 'Recebimento: 2 atividades sem apontar hoje');
  assert.match(ana[0].url, /m=operacao&v=apontar/);
  assert.equal(de(r, 'liderPrep', 'atividades').length, 0, 'Preparação já apontou tudo');
  assert.equal(de(r, 'admin', 'atividades').length, 0, 'administrador não recebe');
  assert.equal(rodar(14).msgs.filter(m => m.tag === 'atividades').length, 0, 'antes das 15h não avisa');
  assert.equal(rodar(16, { enviados: { [`apo|liderRec|${HOJE}`]: HOJE } }).msgs.filter(m => m.uid === 'liderRec' && m.tag === 'atividades').length, 0);
  const desligado = planejar({ usuarios, avisos: { ...avisos, liderRec: { tokens: ['t'], prefs: { atividades: false } } }, paradas: [], ocorr: [], sets: { patio: setPatio() }, enviados: {}, agora: new Date(`${HOJE}T15:30:00`), hoje: HOJE });
  assert.equal(de(desligado, 'liderRec', 'atividades').length, 0, 'respeita a preferência');
});
