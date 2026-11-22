// Saúde do sistema (public/contas/saude.js): cópia, ensaio, cópia mensal, cota, erros da semana e o alarme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saudeDoSistema, errosDaSemana, quando } from '../public/contas/saude.js';

const agora = new Date('2026-11-22T20:00:00Z');
const h = n => new Date(agora - n * 36e5).toISOString();
const bom = {
  em: h(2), problemas: [],
  backup: { ultima: h(14), nome: 'copia-diaria-x', bytes: 3 * 1048576, problemas: [] },
  ensaio: { ultima: h(24 * 21), ok: true }, mensal: { ultima: h(24 * 21), ok: true, pendentes: 0 }, cota: { lida: false, dias: [] }
};
const uso = { em: new Date(h(14)), pacoteBytes: 3 * 1048576, leiturasCopia: 3700 };
const item = (r, id) => r.itens.find(i => i.id === id);

test('tudo em dia: geral ok, cota fica como informação (plano grátis)', () => {
  const r = saudeDoSistema({ saude: bom, uso, erros: [], agora });
  assert.equal(r.geral, 'ok');
  assert.equal(item(r, 'copia').situacao, 'ok');
  assert.equal(item(r, 'cota').situacao, 'info');
  assert.match(item(r, 'cota').resumo, /Espaço usado: 1%.*7% das leituras/);
  assert.match(item(r, 'cota').detalhe, /Blaze/);
});

test('cópia faltou, ensaio falhou e cópia mensal pendente', () => {
  const s = { ...bom, backup: { ...bom.backup, ultima: h(30) }, ensaio: { ultima: h(48), ok: false }, mensal: { ultima: h(48), ok: true, pendentes: 2 } };
  const r = saudeDoSistema({ saude: s, uso, agora });
  assert.equal(item(r, 'copia').situacao, 'critico');
  assert.equal(item(r, 'ensaio').situacao, 'critico');
  assert.equal(item(r, 'mensal').situacao, 'atencao');
  assert.match(item(r, 'mensal').resumo, /2 cópias/);
  assert.equal(r.geral, 'critico');
});

test('sem o resumo do alarme: usa a medição da cópia e avisa que o alarme não conferiu', () => {
  const r = saudeDoSistema({ saude: null, uso, agora });
  assert.equal(item(r, 'copia').situacao, 'ok');
  assert.equal(item(r, 'alarme').situacao, 'atencao');
  assert.equal(item(r, 'ensaio').situacao, 'atencao');
  assert.equal(r.geral, 'atencao');
});

test('cota lida (plano Blaze): acima de 70% vira crítico', () => {
  const s = { ...bom, cota: { lida: true, dias: [{ rotulo: 'Hoje', leituras: 40000, gravacoes: 100, exclusoes: 0 }] } };
  assert.equal(item(saudeDoSistema({ saude: s, uso, agora }), 'cota').situacao, 'critico');
});

test('erros da semana: só os últimos 7 dias, agrupados pela mensagem', () => {
  const erros = [
    { quando: new Date(h(1)), uid: 'a', msg: 'TypeError: x', tela: 'apontar', vezes: 3 },
    { quando: new Date(h(5)), uid: 'b', msg: 'TypeError: x', tela: 'apontar' },
    { quando: { toDate: () => new Date(h(30)) }, uid: 'a', msg: 'RangeError: y' },
    { quando: new Date(h(24 * 8)), uid: 'c', msg: 'velho' }
  ];
  const e = errosDaSemana(erros, agora);
  assert.equal(e.registros, 3); assert.equal(e.vezes, 5); assert.equal(e.pessoas, 2);
  assert.equal(e.grupos[0].msg, 'TypeError: x'); assert.equal(e.grupos[0].vezes, 4);
  assert.equal(item(saudeDoSistema({ saude: bom, uso, erros, agora }), 'erros').situacao, 'atencao');
  assert.equal(item(saudeDoSistema({ saude: bom, uso, erros: [], agora }), 'erros').situacao, 'ok');
});

test('"há quanto tempo" em português', () => {
  assert.equal(quando(h(0.5), agora), 'há menos de 1 hora');
  assert.equal(quando(h(1), agora), 'há 1 hora');
  assert.equal(quando(h(50), agora), 'há 2 dias');
  assert.equal(quando(null, agora), '—');
});
