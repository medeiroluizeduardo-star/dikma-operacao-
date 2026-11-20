// Operação › OMs › Semana: "Programação da semana" para mandar ao cliente (imprimir ou salvar em PDF, e Excel).
// Mesmo padrão dos resumos dos Indicadores (logo, "ArcelorMittal · Coqueria", página X de Y): as OMs da semana dia a dia, com
// o que falta da documentação, as que ficaram em aberto de antes, a semana anterior e as assinaturas.
// As contas ficam em contas/oms-programacao.js; na sexta, a rotina dos avisos manda o link desta semana ao cliente.
import { programacaoSemana, docsFalta } from '../contas/oms-programacao.js';
import { PRIORIDADES, STATUS, TIPOS, diaDe, dataBR } from '../contas/oms.js';
import { DAYS, pd } from '../contas/cal.js';
import { imprimirRelatorio, agoraTxt } from '../ui/indicadores-acoes.js';
import { toast } from '../ui/janelas.js';

const ddmmaa = d => `${dataBR(d)}/${d.slice(0, 4)}`;
const diaNome = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${dataBR(d)}`;
const servico = o => [o.titulo, [o.equip, o.local].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');

// l = OMs do conjunto (já filtradas pela área escolhida na tela), ini = segunda da semana, onde = 'Pátio de Carvão' etc.
export function relatorioProgramacao(l, ini, { hoje, cfg = null, onde = '', area = '', areaNome = a => a } = {}) {
  const p = programacaoSemana(l, ini, hoje, cfg);
  const semana = `${dataBR(p.ini)} a ${ddmmaa(p.fim)}`;
  const linha = o => [diaNome(diaDe(o)), o.numero || '', servico(o), areaNome(o.area), TIPOS[o.tipo] || '', PRIORIDADES[o.prio || 'media'] || '', STATUS[o.status] || o.status, docsFalta(o)];
  const COLS = ['Dia', 'Nº OM', 'Serviço', 'Área', 'Tipo', 'Prioridade', 'Situação', 'Documentação'].map(t => ({ t }));
  const a = p.anterior;
  const tabelas = [
    { id: 'dias', titulo: 'Dia a dia', sub: `Semana de ${semana}`, meia: true, cols: [{ t: 'Dia' }, { t: 'OMs', fmt: 'int' }, { t: 'Alta ou emergência', fmt: 'int' }],
      linhas: p.dias.map(d => [diaNome(d.dia), d.oms.length, d.oms.filter(o => ['alta', 'emergencia'].includes(o.prio)).length]),
      total: ['Semana', p.total, p.urgentes] },
    { id: 'area', titulo: 'Por área', sub: 'OMs programadas na semana', meia: true, cols: [{ t: 'Área' }, { t: 'OMs', fmt: 'int' }, { t: 'Alta ou emergência', fmt: 'int' }],
      linhas: p.porArea.map(x => [areaNome(x.area) || 'Sem área', x.n, x.urgentes]), vazio: 'Nenhuma OM programada.' },
    { id: 'oms', titulo: 'OMs programadas', sub: 'Por dia e prioridade · documentação: PT, APR, bloqueio, isolamento e acompanhamento do cliente', aba: 'Programação', lista: true, filtro: true,
      cols: COLS, linhas: p.oms.map(linha), vazio: 'Nenhuma OM programada para esta semana.' }
  ];
  if (p.pendentes.length) tabelas.push({ id: 'pend', titulo: 'Ainda em aberto', sub: 'Previstas para antes desta semana e ainda não finalizadas', aba: 'Ainda em aberto', lista: true,
    cols: COLS, linhas: p.pendentes.map(linha) });
  if (a) tabelas.push({ id: 'ant', titulo: 'Semana anterior', sub: `${dataBR(a.ini)} a ${ddmmaa(a.fim)} · mesma conta dos Indicadores`,
    cols: [{ t: 'Semana' }, { t: a.fim >= hoje ? 'Previstas até hoje' : 'Previstas', fmt: 'int' }, { t: 'Finalizadas', fmt: 'int' }, { t: 'Aderência', fmt: 'pct' }, { t: 'Atrasadas', fmt: 'int' }, { t: 'Liberadas', fmt: 'int' }, { t: 'No prazo do cliente', fmt: 'pct' }],
    linhas: [[`${dataBR(a.ini)} a ${dataBR(a.fim)}`, a.previstas, a.finalizadas, a.aderencia, a.atrasadas, a.liberadas, a.pctPrazo]] });
  return {
    titulo: `Programação das OMs · Semana ${dataBR(p.ini)} a ${dataBR(p.fim)}`, papel: 'PROGRAMAÇÃO DA SEMANA · OMS',
    arquivo: [onde, `Semana ${dataBR(p.ini)} a ${dataBR(p.fim)}`],
    meta: [onde + (area ? ` · ${areaNome(area)}` : ''), `Semana: ${semana}`, `Gerado em: ${agoraTxt()}`],
    kpis: [
      { rot: 'OMs programadas', v: p.total, fmt: 'int', det: p.planejadas ? `${p.planejadas} ainda planejada${p.planejadas > 1 ? 's' : ''} (pedida no dia)` : '' },
      { rot: 'Alta ou emergência', v: p.urgentes, fmt: 'int', det: p.porPrio.map(x => `${PRIORIDADES[x.prio].toLowerCase()} ${x.n}`).join(' · ') },
      { rot: 'Documentação pendente', v: p.docsPend, fmt: 'int', det: p.semLista ? `${p.semLista} sem a lista de documentos` : 'das programadas' },
      { rot: 'Ainda em aberto', v: p.pendentes.length, fmt: 'int', det: 'previstas antes desta semana' },
      { rot: 'Aderência da semana anterior', v: a ? a.aderencia : null, fmt: 'pct', det: a && a.previstas ? `${a.finalizadas} de ${a.previstas} finalizadas${a.fim >= hoje ? ' até hoje' : ''}` : 'nenhuma OM prevista' }
    ],
    tabelas,
    graficos: [{ tipo: 'coluna', titulo: 'OMs por dia', tabela: 'dias', series: [1, 2] }],
    assinaturas: ['Técnico de Processo (Dikma)', 'Cliente (ArcelorMittal)']
  };
}

export function imprimirProgramacao(l, ini, o) {
  const view = document.getElementById('view'); if (!view) return;
  imprimirRelatorio(view, relatorioProgramacao(l, ini, o));
}
export async function excelProgramacao(l, ini, o) {
  try {
    const rel = relatorioProgramacao(l, ini, o);
    const { baixarRelatorioExcel } = await import('../ui/excel-relatorio.js');
    baixarRelatorioExcel(['Programacao das OMs', ...rel.arquivo].join(' - ').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120), rel);
    toast('Planilha baixada');
  } catch (e) { toast('Não foi possível exportar: ' + (e.message || e)); }
}
