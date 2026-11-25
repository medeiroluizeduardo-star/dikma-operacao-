// Dikma Gestão — Indicadores › Segurança: "Imprimir resumo" e "Exportar para o Excel" por dia, semana ou mês,
// no mesmo modelo de papel das OMs e da Queda zero (ui/indicadores-acoes.js › papelRelatorio; Excel em ui/excel-relatorio.js).
// Sem tela e sem banco: recebe os registros já carregados e devolve o relatório (rel). Testado em testes/seg-resumo.test.mjs.
import { DAYS, MESES_L, add, ddmm, pd, weekOf } from './cal.js';
import { abertaSeg, vencidaSeg, noPrazoSeg, STATUS_SEG, PERG_CARTAO, VALIDA_CARTAO, normNomeSeg } from './segcalc.js';

const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());
const tArea = a => (/^[A-Z]{2,4}$/.test(a) ? a : titulo(a)); // CDQ fica em maiúsculas
const diaTxt = d => `${DAYS[(pd(d).getDay() + 6) % 7]} ${ddmm(d)}`;
const dBR = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
// Dia (AAAA-MM-DD, hora local) de uma data ISO ou de um carimbo em milissegundos.
const diaLocal = v => { const d = new Date(typeof v === 'number' ? v : Date.parse(v)); return isNaN(+d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const diaDe = r => (/^\d{4}-\d{2}-\d{2}$/.test(r.data || '') ? r.data : '');

// Período escolhido na janela: { tipo: 'dia'|'semana'|'mes', data }. Sem escolha = o mês (AAAA-MM) da tela.
export function periodoSeg(per, mesTela) {
  if (!per || per.tipo === 'mes') {
    const ym = per ? per.data.slice(0, 7) : mesTela; const n = `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
    const ini = ym + '-01'; let fim = ini; while (add(fim, 1).slice(0, 7) === ym) fim = add(fim, 1);
    return { tipo: 'mes', ini, fim, nome: n, papel: 'RESUMO DO MÊS · SEGURANÇA', rot: `Mês: ${n}`, curto: n.replace('/', ' '), no: 'no mês' };
  }
  if (per.tipo === 'semana') {
    const ini = weekOf(per.data), fim = add(ini, 6); const n = `${ddmm(ini)} a ${ddmm(fim)}/${fim.slice(0, 4)}`;
    return { tipo: 'semana', ini, fim, nome: `semana de ${n}`, papel: 'RESUMO DA SEMANA · SEGURANÇA', rot: `Semana: ${n}`, curto: `Semana ${ddmm(ini).replace('/', '-')} a ${ddmm(fim).replace('/', '-')}`, no: 'na semana' };
  }
  const d = per.data;
  return { tipo: 'dia', ini: d, fim: d, nome: `${diaTxt(d)}/${d.slice(0, 4)}`, papel: 'RESUMO DO DIA · SEGURANÇA', rot: `Dia: ${diaTxt(d)}/${d.slice(0, 4)}`, curto: `Dia ${ddmm(d).replace('/', '-')}`, no: 'no dia' };
}
// Meses (AAAA-MM) que o período toca: a tela precisa deles carregados antes de montar o relatório.
export const mesesDoPeriodo = P => [...new Set([P.ini.slice(0, 7), P.fim.slice(0, 7)])];

const conta = l => { const m = new Map(); for (const k of l) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
const plural = (n, p) => `${n} ${p}${n === 1 ? '' : 's'}`;
const pct = (a, b) => (b ? a / b * 100 : null);

// o = { inter, anom, cartao (registros carregados), per, mesTela, hoje, area ('' = todas), areas (nomes da lista),
//       onde (quem a conta cobre, ex.: 'todas as áreas'), agora (texto do "Gerado em"), treinos (painelTreinos ou null) }
export function relatorioSeg(o) {
  const { per, mesTela, hoje, area = '', areas = [], onde = '', agora = '', treinos = null } = o;
  const P = periodoSeg(per, mesTela);
  const daArea = l => (l || []).filter(x => !area || x.area === area);
  const noPer = d => d && d >= P.ini && d <= P.fim;
  const inter = daArea(o.inter).filter(r => noPer(diaDe(r))).sort((a, b) => diaDe(a).localeCompare(diaDe(b)));
  const anomTodas = daArea(o.anom);
  const anom = anomTodas.filter(a => noPer(diaDe(a))).sort((a, b) => (diaDe(a) + (a.hora || '')).localeCompare(diaDe(b) + (b.hora || '')));
  const cartao = daArea(o.cartao).filter(c => noPer(diaDe(c))).sort((a, b) => diaDe(a).localeCompare(diaDe(b)));
  const vazio = `Nada registrado ${P.no}.`;
  const ehDia = P.tipo === 'dia';

  const comDesvio = inter.filter(r => (r.desvios || []).length).length;
  const abertasPer = anom.filter(abertaSeg), vencPer = abertasPer.filter(a => vencidaSeg(a, hoje));
  const concl = anomTodas.filter(a => a.status === 'concluida' && noPer(diaLocal(a.conclEm)));
  const comPrazo = concl.filter(a => noPrazoSeg(a) != null), noPrazo = comPrazo.filter(noPrazoSeg).length;
  const abertasHoje = anomTodas.filter(abertaSeg);
  const validados = cartao.filter(c => c.status === 'validado').length;
  const prazoPct = comPrazo.length ? Math.round(noPrazo / comPrazo.length * 100) : null;

  const kpis = [
    { rot: 'Interações', v: inter.length, det: inter.length ? `${comDesvio} com desvio (${Math.round(comDesvio / inter.length * 100)}%)` : vazio },
    { rot: 'Anomalias registradas', v: anom.length, det: anom.length ? `${abertasPer.length} ainda em aberto${vencPer.length ? ` · ${vencPer.length} com prazo vencido` : ''}` : P.no },
    { rot: 'Tratadas no prazo', v: prazoPct, fmt: 'pct', det: comPrazo.length ? `${noPrazo} de ${comPrazo.length} concluídas ${P.no}` : `nenhuma concluída com prazo ${P.no}` },
    { rot: 'Cartões Amarelos', v: cartao.length, det: cartao.length ? `${validados} validado${validados === 1 ? '' : 's'} · ${cartao.length - validados} falta${cartao.length - validados === 1 ? '' : 'm'} validar` : P.no },
    { rot: 'Anomalias em aberto hoje', v: abertasHoje.length, det: `${plural(abertasHoje.filter(a => vencidaSeg(a, hoje)).length, 'vencida')} · ${abertasHoje.filter(a => !(a.trat && a.trat.resp)).length} sem responsável` }
  ];

  const tabs = [];
  if (!area) {
    const nomes = [...new Set([...areas, ...inter.map(r => r.area), ...anom.map(a => a.area), ...cartao.map(c => c.area)])].filter(Boolean);
    const linhas = nomes.map(a => {
      const iA = inter.filter(r => r.area === a), aA = anom.filter(x => x.area === a), ab = aA.filter(abertaSeg);
      return [tArea(a), iA.length, iA.length ? pct(iA.filter(r => (r.desvios || []).length).length, iA.length) : null, aA.length, ab.length, ab.filter(x => vencidaSeg(x, hoje)).length, cartao.filter(c => c.area === a).length];
    }).filter(l => l[1] || l[3] || l[6]);
    tabs.push({ id: 'area', titulo: 'Por área', sub: `Registros ${P.no} · "ainda em aberto" e "vencidas" contam a situação de hoje`,
      cols: [{ t: 'Área' }, { t: 'Interações', fmt: 'int' }, { t: 'Com desvio', fmt: 'pct' }, { t: 'Anomalias', fmt: 'int' }, { t: 'Ainda em aberto', fmt: 'int' }, { t: 'Vencidas', fmt: 'int' }, { t: 'Cartões Amarelos', fmt: 'int' }],
      linhas, total: linhas.length ? ['Total', inter.length, inter.length ? pct(comDesvio, inter.length) : null, anom.length, abertasPer.length, vencPer.length, cartao.length] : null, vazio });
  }
  const desv = conta(inter.flatMap(r => r.desvios || []));
  tabs.push({ id: 'desvio', titulo: 'Desvios mais frequentes', sub: 'Nas interações', meia: true, cols: [{ t: 'Desvio' }, { t: 'Vezes', fmt: 'int' }, { t: '% das interações', fmt: 'pct' }],
    linhas: desv.map(([d, n]) => [d, n, pct(n, inter.length)]), vazio: inter.length ? 'Nenhum desvio marcado.' : vazio });
  const sit = [['Aberta', anom.filter(a => a.status === 'aberta').length], ['Em tratamento', anom.filter(a => a.status === 'tratamento').length], ['Concluída', anom.filter(a => a.status === 'concluida').length]];
  tabs.push({ id: 'sit', titulo: 'Situação das anomalias', sub: `As registradas ${P.no}, como estão hoje`, meia: true, cols: [{ t: 'Situação' }, { t: 'Anomalias', fmt: 'int' }, { t: '% do total', fmt: 'pct' }],
    linhas: anom.length ? [...sit.map(([s, n]) => [s, n, pct(n, anom.length)]), ['Com prazo vencido (das em aberto)', vencPer.length, pct(vencPer.length, anom.length)]] : [], total: anom.length ? ['Total', anom.length, 100] : null, vazio });
  tabs.push({ id: 'faltou', titulo: 'Cartão Amarelo · o que faltou', sub: 'Pergunta com resposta NÃO no cartão', meia: true, cols: [{ t: 'Pergunta' }, { t: 'Cartões', fmt: 'int' }, { t: '% dos cartões', fmt: 'pct' }],
    linhas: cartao.length ? PERG_CARTAO.map(q => { const n = cartao.filter(c => (c.faltou || []).includes(q)).length; return [q, n, pct(n, cartao.length)]; }) : [], vazio });
  // Interações por pessoa (o RESPONSÁVEL do formulário): junta grafias diferentes do mesmo nome.
  const pes = new Map(); for (const r of inter) { const n = String(r.resp || r.porNome || '').replace(/\s+/g, ' ').trim(); const k = normNomeSeg(n); if (!k) continue; const x = pes.get(k) || [n, 0]; x[1]++; pes.set(k, x); }
  const porPessoa = [...pes.values()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  tabs.push({ id: 'pessoa', titulo: 'Interações por pessoa', sub: porPessoa.length > 10 ? 'As 10 com mais interações (todas no Excel)' : 'Quem fez as interações', meia: true, excel: false, cols: [{ t: 'Pessoa' }, { t: 'Interações', fmt: 'int' }],
    linhas: porPessoa.slice(0, 10), vazio });
  tabs.push({ id: 'pessoax', titulo: 'Interações por pessoa', sub: 'Quem fez as interações', papel: false, cols: [{ t: 'Pessoa' }, { t: 'Interações', fmt: 'int' }], linhas: porPessoa, vazio });
  if (treinos && treinos.areas && treinos.areas.length) {
    const t = treinos.total;
    tabs.push({ id: 'trein', titulo: 'Treinamentos e ASO', sub: `Situação hoje · ${treinos.pessoas} colaborador${treinos.pessoas === 1 ? '' : 'es'}`, meia: true,
      cols: [{ t: 'Área' }, { t: 'Em dia', fmt: 'pct' }, { t: 'Vencidos', fmt: 'int' }, { t: 'A vencer', fmt: 'int' }],
      linhas: treinos.areas.map(a => [tArea(a.area), a.conformidade, a.vencido, a.vence]), total: ['Total', t.conformidade, t.vencido, t.vence] });
  }
  if (!ehDia) {
    const dias = []; for (let d = P.ini; d <= P.fim; d = add(d, 1)) dias.push(d);
    const n = (l, d) => l.filter(r => diaDe(r) === d).length || null;
    tabs.push({ id: 'dia', titulo: 'Dia a dia', sub: `Registros por dia · ${P.nome}`, papel: false, cols: [{ t: 'Dia' }, { t: 'Interações', fmt: 'int' }, { t: 'Anomalias', fmt: 'int' }, { t: 'Cartões Amarelos', fmt: 'int' }],
      linhas: inter.length + anom.length + cartao.length ? dias.map(d => [P.tipo === 'semana' ? diaTxt(d) : ddmm(d), n(inter, d), n(anom, d), n(cartao, d)]) : [], total: ['Total', inter.length, anom.length, cartao.length], vazio });
  }
  const sitTxt = a => (vencidaSeg(a, hoje) ? 'Prazo vencido' : STATUS_SEG[a.status] || a.status || '');
  tabs.push({ id: 'anomp', titulo: `Anomalias registradas ${P.no}`, excel: false, cols: [{ t: 'Dia' }, { t: 'Área' }, { t: 'Local' }, { t: 'Descrição' }, { t: 'Situação' }, { t: 'Responsável' }, { t: 'Prazo' }],
    linhas: anom.map(a => [ddmm(diaDe(a)), tArea(a.area), a.local || '', a.desc || '', sitTxt(a), (a.trat && a.trat.resp) || '', a.trat && a.trat.prazo ? ddmm(a.trat.prazo) : '']), vazio: `Nenhuma anomalia registrada ${P.no}.` });
  // Listas completas, uma aba cada no Excel (as mesmas colunas da tela, como no "Exportar o mês").
  tabs.push({ id: 'linter', titulo: `Interações ${P.no}`, aba: 'Interações', lista: true, papel: false,
    cols: [{ t: 'Data' }, { t: 'Área' }, { t: 'Local' }, { t: 'Tipo de atividade' }, { t: 'Risco SO-PSIF' }, { t: 'Desvios' }, { t: 'Descrição' }, { t: 'Ação imediata' }, { t: 'Responsável' }, { t: 'Matrícula' }],
    linhas: inter.map(r => [dBR(diaDe(r)), tArea(r.area), r.local || '', r.tipoAtiv || '', r.risco || '', (r.desvios || []).map(d => (d === 'OUTROS' && r.desvioOutro ? `OUTROS: ${r.desvioOutro}` : d)).join(', '), r.desc || '', r.acao || '', r.resp || '', r.mat || '']), vazio });
  tabs.push({ id: 'lanom', titulo: `Anomalias ${P.no}`, aba: 'Anomalias', lista: true, papel: false,
    cols: [{ t: 'Data' }, { t: 'Hora' }, { t: 'Área' }, { t: 'Local' }, { t: 'Regime' }, { t: 'Descrição' }, { t: 'Consequência' }, { t: 'Ação imediata' }, { t: 'Situação' }, { t: 'Responsável pelo tratamento' }, { t: 'Prazo' }, { t: 'Concluída em' }],
    linhas: anom.map(a => [dBR(diaDe(a)), a.hora || '', tArea(a.area), a.local || '', a.regime || '', a.desc || '', a.conseq || '', a.acao || '', sitTxt(a), (a.trat && a.trat.resp) || '', dBR(a.trat && a.trat.prazo), a.conclEm ? dBR(diaLocal(a.conclEm)) : '']), vazio });
  tabs.push({ id: 'lcartao', titulo: `Cartões Amarelos ${P.no}`, aba: 'Cartão Amarelo', lista: true, papel: false,
    cols: [{ t: 'Data' }, { t: 'Área' }, { t: 'Comunicado por' }, { t: 'Matrícula' }, { t: 'O que faltou' }, { t: 'Motivo' }, { t: 'Como poderia fazer com segurança' }, { t: 'Situação' }, { t: 'Validação' }],
    linhas: cartao.map(c => [dBR(diaDe(c)), tArea(c.area), c.comunic || '', c.mat || '', (c.faltou || []).join(' · '), c.motivo || '', c.comoSeguro || '', c.status === 'validado' ? 'Validado' : 'Falta validar', c.status === 'validado' ? VALIDA_CARTAO[(c.valid || {}).tipo] || '' : '']), vazio });

  const ondeTxt = area ? tArea(area) : onde ? onde.charAt(0).toUpperCase() + onde.slice(1) : 'Todas as áreas';
  return {
    titulo: `Segurança · ${P.nome}`, papel: P.papel,
    arquivo: [area ? tArea(area) : 'Todas', P.curto],
    meta: [`Área: ${ondeTxt}`, P.rot, `Gerado em: ${agora}`],
    kpis, tabelas: tabs,
    graficos: [
      ...(ehDia ? [] : [{ tipo: 'coluna', titulo: `Registros por dia · ${P.nome}`, tabela: 'dia', series: [1, 2, 3], largo: true }]),
      { tipo: 'barra', titulo: 'Desvios mais frequentes', tabela: 'desvio', series: [1], max: 10, cores: ['3A3F47'] },
      { tipo: 'rosca', titulo: 'Situação das anomalias', tabela: 'sit', series: [1], max: 3 },
      ...(!area ? [{ tipo: 'barra', titulo: 'Interações por área', tabela: 'area', series: [1], max: 10 }] : []),
      { tipo: 'barra', titulo: 'Cartão Amarelo · o que faltou', tabela: 'faltou', series: [1], cores: ['F2A65A'] }
    ]
  };
}
