// Relatório em Excel com formatação e gráficos (ui/excel-relatorio.js): Indicadores › OMs e Queda zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arquivosXlsx, montarXlsx, fmtTexto, letra } from '../public/ui/excel-relatorio.js';

const rel = {
  titulo: 'Queda zero · Novembro 2026', meta: ['Área: Todas', 'Gerado em: 19/11/2026'],
  kpis: [{ rot: 'Recolhido', v: 12.5, fmt: 't', det: 'no mês' }, { rot: 'Aderência', v: null, fmt: 'pct' }],
  tabelas: [
    { id: 'local', titulo: 'Por local', cols: [{ t: 'Local' }, { t: 'Lançamentos', fmt: 'int' }, { t: 'Toneladas', fmt: 't' }, { t: '% do total', fmt: 'pct' }], linhas: [['A & B', 2, 10, 80], ['<C>', 1, 2.5, 20]], total: ['Total', 3, 12.5, 100] },
    { id: 'vazia', titulo: 'Vazia', cols: [{ t: 'X' }, { t: 'Y', fmt: 'int' }], linhas: [] },
    { id: 'lista', titulo: 'Lista', aba: 'Lançamentos', lista: true, cols: [{ t: 'Dia' }, { t: 'Toneladas', fmt: 't' }], linhas: [['01/11', 1]] },
    { id: 'papel', titulo: 'Só no papel', excel: false, cols: [{ t: 'A' }], linhas: [['x']] }
  ],
  graficos: [{ tipo: 'barra', titulo: 'Por local', tabela: 'local', series: [2] }, { tipo: 'rosca', titulo: 'Rosca', tabela: 'local', series: [2] }, { tipo: 'coluna', titulo: 'Sem dados', tabela: 'vazia', series: [1] }]
};

test('abas, gráficos e referências', () => {
  const f = arquivosXlsx(rel);
  assert.match(f['xl/workbook.xml'], /name="Painel"[\s\S]*name="Quadros"[\s\S]*name="Lançamentos"/);
  assert.ok(!f['xl/workbook.xml'].includes('Só no papel'));
  // tabela vazia não vira gráfico; os outros dois apontam para a aba Quadros (sem a linha de total)
  assert.ok(f['xl/charts/chart1.xml'] && f['xl/charts/chart2.xml'] && !f['xl/charts/chart3.xml']);
  assert.match(f['xl/charts/chart1.xml'], /<c:f>'Quadros'!\$A\$\d+:\$A\$\d+<\/c:f>/);
  assert.match(f['xl/charts/chart1.xml'], /<c:barDir val="bar"\/>/);
  assert.match(f['xl/charts/chart2.xml'], /<c:doughnutChart>/);
  assert.match(f['xl/charts/chart1.xml'], /A &amp; B/);
  assert.match(f['[Content_Types].xml'], /chart2\.xml/);
  // lista com filtro e cabeçalho congelado; porcentagem guardada como fração
  assert.match(f['xl/worksheets/sheet3.xml'], /<autoFilter ref="A\d+:B\d+"\/>/);
  assert.match(f['xl/worksheets/sheet3.xml'], /state="frozen"/);
  assert.match(f['xl/worksheets/sheet2.xml'], /<v>0\.8<\/v>/);
  assert.match(f['xl/worksheets/sheet1.xml'], /<drawing r:id="rId1"\/>/);
});

test('lista com filtro embaixo de outras tabelas na mesma aba (OMs do mês: por mês, semana e dia)', () => {
  const r2 = { titulo: 'OMs', meta: [], kpis: [], tabelas: [
    { id: 'xmes', titulo: 'Por mês', aba: 'OMs do mês', cols: [{ t: 'Mês' }, { t: 'Previstas', fmt: 'int' }], linhas: [['Novembro/2026', 3]] },
    { id: 'lista', titulo: 'OMs do mês', aba: 'OMs do mês', lista: true, filtro: true, cols: [{ t: 'Dia' }, { t: 'Semana' }, { t: 'Mês' }], linhas: [['seg 10/11/2026', '09/11 a 15/11/2026', 'Novembro/2026']] }
  ] };
  const f = arquivosXlsx(r2);
  assert.match(f['xl/worksheets/sheet2.xml'], /<autoFilter ref="A\d+:C\d+"\/>/);
  assert.ok(!f['xl/worksheets/sheet2.xml'].includes('state="frozen"'));
  assert.match(f['xl/workbook.xml'], /_FilterDatabase/);
});

test('zip válido (assinaturas e quantidade de arquivos)', () => {
  const z = montarXlsx(rel); const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const fim = z.length - 22; assert.equal(dv.getUint32(fim, true), 0x06054b50);
  assert.equal(dv.getUint16(fim + 10, true), Object.keys(arquivosXlsx(rel)).length);
});

test('textos do papel e letras das colunas', () => {
  assert.equal(fmtTexto(12.5, 't'), '12,50');
  assert.equal(fmtTexto(0.4, 'pct'), '< 1%');
  assert.equal(fmtTexto(66.6, 'pct'), '67%');
  assert.equal(fmtTexto(null, 'int'), '');
  assert.equal(fmtTexto(880 / 60, 'h'), '14h 40');
  assert.equal(fmtTexto(28 / 60, 'h'), '28 min');
  assert.equal(fmtTexto(2220 / 60, 'h'), '1d 13h');
  assert.equal(fmtTexto(3, 'h'), '3h');
  assert.equal(fmtTexto(1234, 'int'), '1.234');
  assert.equal(letra(0), 'A'); assert.equal(letra(25), 'Z'); assert.equal(letra(26), 'AA');
});

// Listas dos botões "Exportar": mesmo modelo, sem a aba Painel, números como número.
import { relDeListas } from '../public/ui/excel-relatorio.js';
test('listas do Exportar no modelo dos relatórios', () => {
  const rel = relDeListas('ocorrencias', [{ nome: 'Ocorrências', linhas: [['Data', 'Pessoa', 'Horas', 'Qtd', 'Ok'], ['01/11/2026', 'A', 1.5, 2, true], ['02/11/2026', 'B', 3, null, false]] }], new Date(2026, 10, 20, 14, 30));
  assert.equal(rel.titulo, 'Ocorrências');
  assert.deepEqual(rel.meta, ['ArcelorMittal · Coqueria', 'Gerado em 20/11/2026, 14:30']);
  assert.deepEqual(rel.tabelas[0].cols.map(c => c.fmt), ['txt', 'txt', 'num', 'int', 'txt']);
  assert.deepEqual(rel.tabelas[0].linhas[1], ['02/11/2026', 'B', 3, null, 'Não']);
  const f = arquivosXlsx(rel);
  assert.doesNotMatch(f['xl/workbook.xml'], /name="Painel"/);
  assert.match(f['xl/workbook.xml'], /name="Ocorrências"/);
  assert.match(f['xl/worksheets/sheet1.xml'], /tabSelected="1"/);
  assert.match(f['xl/worksheets/sheet1.xml'], /<autoFilter ref="A5:E7"\/>/);
  assert.match(f['xl/worksheets/sheet1.xml'], /<v>1.5<\/v>/);
  const dois = relDeListas('horas-extras-patio', [{ nome: 'Registros', linhas: [['X']] }, { nome: 'Por pessoa', linhas: [['Y']] }]);
  assert.equal(dois.titulo, 'Horas extras patio');
  assert.equal(Object.keys(arquivosXlsx(dois)).filter(k => k.startsWith('xl/worksheets/sheet')).length, 2);
});
