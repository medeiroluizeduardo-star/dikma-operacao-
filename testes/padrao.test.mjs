// Guia visual: os componentes padrão (public/ui/padrao.js) montam o HTML esperado e escapam o texto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cabecalho, indicador, indicadores, etiqueta, tabela, vazio, carregando, variacao, tendencia, recolhido } from '../public/ui/padrao.js';

test('texto é escapado (nada de HTML vindo de dados)', () => {
  assert.ok(etiqueta('<b>x</b>', 'ok').includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(cabecalho({ titulo: 'A & B' }).includes('A &amp; B'));
  assert.ok(vazio('"oi"').includes('&quot;oi&quot;'));
});

test('etiqueta só aceita as situações do guia', () => {
  assert.match(etiqueta('Ok', 'ok'), /p-etq ok/);
  assert.match(etiqueta('?', 'roxo'), /p-etq neutro/);
});

test('variação: subir é bom ou ruim conforme o indicador', () => {
  assert.match(variacao(94, 91), /bom">▲ \+3</);
  assert.match(variacao(6, 3, { maiorMelhor: false }), /ruim">▲ \+3</);
  assert.match(variacao(2, 3, { maiorMelhor: false }), /bom">▼ -1</);
  assert.match(variacao(5, 5), /neutro">igual</);
  assert.match(variacao(9.5, 9.25, { unidade: ' p.p.' }), /\+0,3 p\.p\./);
  assert.equal(variacao(NaN, 1), '');
});

test('mini-tendência precisa de 2 valores', () => {
  assert.equal(tendencia([5]), '');
  assert.match(tendencia([1, 2, 3]), /points="0,26 50,14 100,2"/);
  assert.match(tendencia([4, 4]), /polyline/);
});

test('painel mostra no máximo 4 números', () => {
  const h = indicadores(Array.from({ length: 6 }, (_, i) => ({ rotulo: 'I' + i, valor: i })));
  assert.equal((h.match(/class="p-ind[ "]/g) || []).length, 4);
  assert.match(indicador({ rotulo: 'x', valor: 1, situacao: 'critico' }), /p-ind critico/);
  assert.doesNotMatch(indicador({ rotulo: 'x', valor: 1, situacao: 'info' }), /p-ind info/);
  assert.match(indicador({ rotulo: 'x', valor: 9, unidade: '%', meta: 95 }), /Meta 95%/);
});

test('tabela: números à direita e coluna de ações', () => {
  const h = tabela([{ t: 'Área' }, { t: 'Qtd', n: true }], [['Pátio', '3']], { acoes: () => '<button>v</button>' });
  assert.match(h, /<th scope="col" class="n">Qtd<\/th>/);
  assert.match(h, /<td class="n">3<\/td><td class="acoes"><button>v<\/button><\/td>/);
});

test('carregando e recolhido', () => {
  assert.match(carregando(), /aria-busy="true"/);
  assert.match(recolhido('T', 'x', true), /<details class="p-recolhe" open>/);
});

test('abas e lista de dados da ficha', async () => {
  const { abas, dados } = await import('../public/ui/padrao.js');
  const h = abas([['dados', 'Dados'], ['lot', 'Lotação']], 'lot', 'co-aba', 'Ficha');
  assert.match(h, /role="tablist" aria-label="Ficha"/);
  assert.match(h, /data-co-aba="lot" aria-selected="true"/);
  assert.match(h, /data-co-aba="dados" aria-selected="false"/);
  const d = dados([['Nome', 'Ana'], ['Demissão', '']]);
  assert.match(d, /<dt>Nome<\/dt><dd>Ana<\/dd>/);
  assert.match(d, /<dt>Demissão<\/dt><dd><span class="p-falta">—<\/span>/);
});
