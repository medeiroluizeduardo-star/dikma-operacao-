// Dikma Gestão — módulo OPERAÇÃO: controle de equipamentos e operadores (planilha CONTROLE DE EQUIPAMENTOS - COQUERIA).
// Telas: Painel, Lançamentos e paradas (uma aba só), Equipe (operadores, frota e escala), Inspeções, Avaliação, Análises e Configurações.
import { add, pad, today, MESES_L, addMonth, DAYS } from './cal.js';
import { campoBusca, definirValor, semAcento, casa, filtrarLista, caixaBusca } from './busca.js';
import { baixarExcel, dataBR } from './exportar.js';
import { criarBusca, competenciaDe } from './planilhas-adm.js';
import { indiceFerias } from './acessos.js';
import { criarCalc, fimMes, ITENS_5S, ITENS_SEG, conformidade, STATUS_HE } from './eqcalc.js';

export const VIEWS_E = [
  { id: 'epainel', nome: 'Painel', ic: 'painel', grp: 'Equipamentos', mod: 'eq' },
  { id: 'elanc', nome: 'Lançamentos e paradas', ic: 'apontar', grp: 'Equipamentos', mod: 'eq' },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'eq' },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'plano', grp: 'Avaliação', mod: 'eq' },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'users', grp: 'Avaliação', mod: 'eq' },
  { id: 'eanal', nome: 'Análises', ic: 'prog', grp: 'Avaliação', mod: 'eq' },
  { id: 'econfig', nome: 'Configurações', ic: 'config', grp: 'Administração', mod: 'eq', admin: true }
];
export const SUB_E = {
  epainel: 'Produtividade da operação de equipamentos', elanc: 'Alocações do dia e paradas dos equipamentos',
  eequipe: 'Operadores, situação, frota e escala do mês', einsp: 'Checklist de 5S no equipamento e segurança', eaval: 'Notas do mês por operador',
  eanal: 'Evolução mensal e qualidade dos lançamentos', econfig: 'Turnos, metas, pesos, causas e feriados'
};

export function criarEquip(X) {
  const { DB, esc, title, I, sheet, formSheet, toast, showErr, render, isAdmin, UI, PES } = X;
  const podeExportar = () => !X.framed && !matchMedia('(max-width:860px)').matches;
  const $ = id => document.getElementById(id);
  const TODAY = today();
  const E = () => DB.cache.e;
  const ME = () => X.ME;
  const podeEditar = () => isAdmin() || ['gestor', 'coordenador', 'supervisor', 'lider'].includes(ME().papel);
  const U = UI.e || (UI.e = { mes: TODAY.slice(0, 7), dia: TODAY, pf: 'aberta', avMes: TODAY.slice(0, 7), inMes: TODAY.slice(0, 7), hist: null });
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const mesNome = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
  const h1 = v => (Math.round((v || 0) * 10) / 10).toLocaleString('pt-BR');
  const h2 = v => (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pc = v => `${Math.round((v || 0) * 1000) / 10}`.replace('.', ',') + '%';
  const hhmm = h => { const m = Math.round((h || 0) * 60); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  const agoraHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const short = n => { const p = String(n || '').trim().split(/\s+/); return title(p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''); };
  const opcoesMes = () => { const l = []; for (let i = -12; i <= 1; i++) l.push(addMonth(TODAY.slice(0, 7), i)); return l.reverse(); };
  const selMes = (id, v) => `<label class="sel"><span>Mês</span><select class="in" id="${id}">${opcoesMes().map(m => `<option value="${m}" ${m === v ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select></label>`;
  let CALC = null, CALCv = -1;
  // Turmas 4x4 e feriados vêm da escala central (Configurações › Escalas e turnos) quando preenchidos — mesma conta em todos os módulos.
  let CALCesc;
  const cfgOp = () => { const c = E().config; const esc = DB.cache.escalas; const t4 = esc && esc.regimes && esc.regimes['4x4'] && esc.regimes['4x4'].turmas; const tem = t4 && Object.values(t4).some(Boolean);
    return { ...c, turmas: tem ? { ...Object.fromEntries(Object.entries(c.turmas || {}).filter(([k]) => /^[A-Z]{1,2}$/.test(k))), ...Object.fromEntries(Object.entries(t4).filter(([, v]) => v)) } : c.turmas, feriados: [...(c.feriados || []), ...((esc && esc.feriados) || [])] }; };
  // Situação dos operadores em sincronia com a Frequência (Administrativo), o Efetivo diário e as Férias:
  // o que está lançado lá vale aqui. Sem lançamento, vale a situação do cadastro da Equipe.
  const SIT_EXT = { FE: 'FÉRIAS', AT: 'ATESTADO MÉDICO', AF: 'AFASTAMENTO (INSS)', FT: 'FALTA', DS: 'DESLIGADO', TR: 'TREINAMENTO', F: 'FOLGA', SP: 'SUSPENSÃO', AB: 'ABONO' };
  let EXT = null, EXTv = -1, EXTf = null;
  function extFreq() {
    const F = DB.cache.eqFreq; const fer = DB.cache.feriasAtivas || [];
    if (EXT && EXTv === (F ? F.v : -2) && EXTf === fer) return EXT;
    EXTv = F ? F.v : -2; EXTf = fer;
    const pessoas = [];
    if (F) for (const [id, d] of Object.entries(F.comps || {})) if (d) for (const g of d.grupos || []) for (const p of g.pessoas || []) pessoas.push({ conj: id.split('|')[0], p, nome: p.nome, mat: p.mat });
    const busca = pessoas.length ? criarBusca(pessoas) : () => null;
    const ferias = indiceFerias(fer); const porOp = new Map();
    EXT = (o, data) => {
      let m = porOp.get(o.nome); if (m === undefined) { const r = busca(o.nome); m = r ? r.item : null; porOp.set(o.nome, m); }
      if (ferias({ nome: o.nome, mat: m && m.mat }, data)) return 'FÉRIAS';
      if (!m) return undefined;
      const { p, conj } = m;
      if (p.desligado && data >= p.desligado) return 'DESLIGADO';
      let cod;
      if (p.ativ) cod = ((F.sit[conj] || {})[data.slice(0, 7)] || {})[p.ativ + '|' + data];
      else { const d = F.comps[conj + '|' + competenciaDe(data)]; cod = d && d.d && d.d[p.k] && d.d[p.k][data]; }
      if (!cod) return undefined;
      if (cod === 'P' || cod === 'HE' || cod === 'ATR') return null;
      return SIT_EXT[cod] || 'OUTRO';
    };
    EXT.achou = o => { let m = porOp.get(o.nome); if (m === undefined) { const r = busca(o.nome); m = r ? r.item : null; porOp.set(o.nome, m); } return m; };
    return EXT;
  }
  const calc = () => {
    if (DB.eqFreqWatch) { DB.eqFreqWatch(U.mes); DB.eqFreqWatch(TODAY.slice(0, 7)); }
    const ext = extFreq();
    if (!CALC || CALCv !== DB.cache.eVersao || CALCesc !== DB.cache.escalas || CALC._ext !== ext) { CALC = criarCalc(cfgOp(), E().cad, ext); CALC._ext = ext; CALCv = DB.cache.eVersao; CALCesc = DB.cache.escalas; }
    return CALC;
  };
  const mesesCarregados = () => E().meses || new Set();
  const lancMes = ym => E().lanc.filter(l => l.data.slice(0, 7) === ym);

  /* ---------- painel ---------- */
  const SEM = { 1: ['ok', 'Na meta'], 2: ['warn', 'Perto da meta'], 3: ['bad', 'Fora da meta'], 0: ['neu', 'Sem dados'] };
  const kpi = (lbl, v, s, sem) => `<div class="kpi"><span class="lbl">${sem != null ? `<i class="dot st-${SEM[sem][0]}" title="${SEM[sem][1]}"></i>` : ''}${lbl}</span><span class="v num">${v}</span><span class="s">${s}</span></div>`;
  function vPainel() {
    const C = calc(); const M = E().config.metas;
    const { k, ops, rk } = C.mes(U.mes, E().lanc, E().par, E().insp, (E().aval[U.mes] || {}), TODAY);
    const sm = C.semaforo(k);
    const ant = C.mes(addMonth(U.mes, -1), E().lanc, E().par, E().insp, (E().aval[addMonth(U.mes, -1)] || {}), TODAY);
    const posAnt = new Map(ant.rk.map(x => [x.o.nome, x.pos]));
    const foraHoje = E().cad.operadores.filter(o => C.ausenteEm(o, TODAY));
    const q4 = ops.filter(x => x.aloc > 0 && x.o.escala === '4x4').length;
    let h = `<div class="filters">${selMes('eMes', U.mes)}<span class="muted" style="align-self:flex-end">Período ${dBR(k.janela[0])} a ${dBR(k.janela[1])} · ${k.diasOperados} de ${k.diasUteis} dias úteis com lançamento · ${k.nPar} paradas</span></div>`;
    if (!k.aloc) h += '<div class="card"><div class="empty">Nenhum lançamento neste mês.</div></div>';
    h += `<div class="kpis k8">
      ${kpi('Dias operados', k.diasOperados, `de ${k.diasUteis} dias úteis · ${k.aloc} alocações`)}
      ${kpi('Horas operadas', h1(k.hoper), `${pc(k.aprov)} da janela · meta ≥ ${pc(M.aprov)}`, sm.aprov)}
      ${kpi('Disponibilidade física', pc(k.disp), `meta ≥ ${pc(M.disp)}`, sm.disp)}
      ${kpi('Efetividade', pc(k.efet), `alocações sem fora/manutenção · meta ≥ ${pc(M.efet)}`, sm.efet)}
      ${kpi('Paradas', k.nPar, `${k.parEq} por falha de equipamento`)}
      ${kpi('Horas paradas', h1(k.hParEq), 'falha de equipamento')}
      ${kpi('MTTR', h2(k.mttr) + ' h', `tempo médio de reparo · meta ≤ ${h1(M.mttr)} h`, sm.mttr)}
      ${kpi('MTBF', h1(k.mtbf) + ' h', `horas entre falhas · meta ≥ ${h1(M.mtbf)} h`, sm.mtbf)}
    </div>
    <div class="kpis k8">
      ${kpi('Operadores ativos', k.opsAtivos, `${k.opsAtivos - q4} ADM · ${q4} 4x4`)}
      ${kpi('Horas extras', hhmm(k.heH), `${k.alocHE} alocações HE · ${k.cobert} coberturas`)}
      ${kpi('Sem liberação', k.semLib, `meta ≤ ${M.semlib}`, sm.semlib)}
      <div class="kpi"><span class="lbl">🏆 Destaque do mês</span><span class="v vsm">${k.destaque ? esc(short(k.destaque.o.nome)) : '–'}</span><span class="s">${k.destaque ? h1(k.destaque.nota) + ' pts · ' + k.destaque.classe : ''}</span></div>
      ${kpi('Fora da coqueria hoje', foraHoje.length, foraHoje.slice(0, 2).map(o => short(o.nome) + ' (' + o.situacao.toLowerCase() + ')').join(', ') || 'todos trabalhando')}
      ${kpi('Nota média da equipe', h1(k.notaMedia), `meta ≥ ${M.nota}`, sm.nota)}
      ${kpi('Avaliações pendentes', k.pendentes, `sem nota · ${k.inspecoes} inspeções`)}
      ${kpi('Paradas do operador', k.parOp, `${h1(k.hParOp)} h · meta ≤ ${M.parop}`, sm.parop)}
    </div>`;
    // por operador + horas por dia
    const porAloc = ops.filter(x => x.aloc > 0).sort((a, b) => b.aloc - a.aloc || b.hoper - a.hoper);
    const mx = Math.max(1, ...k.porDia.map(d => d.hoper + d.hpar));
    h += `<div class="grid2"><div class="card"><header><h2>Produtividade por operador</h2><p>Por alocações · cinza = não fixo</p></header><div class="tw"><table><thead><tr><th>Operador</th><th class="r">Aloc.</th><th class="r">H. operadas</th><th class="r">H. paradas</th><th class="r">Por causa dele</th><th class="r">Cobertura</th><th class="r">Nota prod.</th></tr></thead><tbody>
      ${porAloc.map(x => `<tr class="${x.o.fixo === false ? 'muted' : ''}"><td><b>${esc(short(x.o.nome))}</b></td><td class="r num">${x.aloc}</td><td class="r num">${h1(x.hoper)}</td><td class="r num">${h1(x.hpar)}</td><td class="r num">${h1(x.hparOp)}</td><td class="r num">${pc(x.cobEsc)}</td><td class="r num">${Math.round(x.scProd)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sem alocações.</td></tr>'}
      </tbody></table></div></div>
      <div class="card"><header><h2>Horas por dia</h2><p>Operadas × paradas</p></header><div class="body"><div class="legend"><span><i style="background:var(--st-real)"></i>Operadas</span><span><i style="background:var(--st-nreal)"></i>Paradas</span></div>
      <div class="cols cmes" role="img" aria-label="Horas por dia do mês">${k.porDia.map(d => `<div class="col" title="${dBR(d.data)}: ${h1(d.hoper)} h operadas, ${h1(d.hpar)} h paradas, ${d.aloc} alocações">${d.hpar ? `<i style="height:${d.hpar / mx * 100}%;background:var(--st-nreal)"></i>` : ''}${d.hoper ? `<i style="height:${d.hoper / mx * 100}%;background:var(--st-real)"></i>` : ''}</div>`).join('')}</div>
      <div class="colx cmes">${k.porDia.map((d, i) => `<div class="${d.data === TODAY ? 'today' : ''}">${i % 5 === 0 || d.data === TODAY ? `<b>${d.data.slice(8)}</b>` : ''}</div>`).join('')}</div></div></div></div>`;
    // pareto e equipamentos
    const top = k.equip.filter(e => e.npar > 0).sort((a, b) => b.hpar - a.hpar).slice(0, 5);
    const rein = k.equip.filter(e => e.reincidente).sort((a, b) => b.npar - a.npar);
    h += `<div class="grid2"><div class="card"><header><h2>Pareto das causas</h2><p>Horas paradas por causa</p></header><div class="body">${k.pareto.length ? `<div class="bars">${k.pareto.map(c => `<div class="barrow par"><span class="n">${esc(c.causa)}<small>${esc(c.resp.toLowerCase())} · ${c.qtd}×</small></span><div class="stack clear"><i style="width:${c.pc * 100}%;background:${c.resp === 'EQUIPAMENTO' ? 'var(--st-nreal)' : c.resp === 'OPERADOR' ? 'var(--st-atr)' : 'var(--st-prog)'}"></i></div><span class="p num">${h1(c.horas)} h<small>${pc(c.ac)}</small></span></div>`).join('')}</div>` : '<div class="empty">Sem paradas.</div>'}</div></div>
      <div class="card"><header><h2>Equipamentos</h2><p>Mais horas paradas por falha</p></header><div class="body">${top.length ? `<div class="plist">${top.map((e, i) => `<div class="pitem"><div class="minw"><div class="t">${i + 1}. <span class="mono">${esc(e.id)}</span> · ${esc(e.tipo)}</div><div class="l">${e.npar} paradas · ${h1(e.hpar)} h · disponibilidade ${pc(e.disp)}</div></div>${e.reincidente ? '<span class="pill bad">Reincidente</span>' : ''}</div>`).join('')}</div>` : '<div class="empty">Nenhuma falha de equipamento.</div>'}
      ${rein.length ? `<p class="small m0" style="margin-top:10px"><b>Reincidentes:</b> ${rein.map(e => `${esc(e.id)} (${e.npar} falhas${e.causaRep ? ', ' + esc(e.causaRep.toLowerCase()) + ' ' + e.maxRep + '×' : ''})`).join(' · ')}</p>` : ''}</div></div></div>`;
    // classificação
    const classe = c => `<span class="pill ${c === 'EXCELENTE' || c === 'BOM' ? 'ok' : c === 'REGULAR' ? 'warn' : 'bad'}">${c}</span>`;
    const varr = x => { const a = posAnt.get(x.o.nome); if (!a) return '<span class="muted small">novo</span>'; const d = a - x.pos; return d > 0 ? `<span class="up">▲ ${d}</span>` : d < 0 ? `<span class="down">▼ ${-d}</span>` : '='; };
    const n1 = v => (v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString('pt-BR'));
    h += `<div class="card"><header><h2>Classificação dos operadores</h2><p>Produtividade automática + avaliação + inspeções · ${E().config.pesos.quem === 'SOMENTE FIXOS' ? 'somente fixos' : 'todos'}</p></header><div class="tw"><table><thead><tr><th class="c">Pos.</th><th>Operador</th><th class="r">Nota</th><th>Classe</th><th class="r">Produtiv.</th><th class="c">Proativ.</th><th class="c">Segurança</th><th class="c">5S</th><th class="c">Faltas</th><th class="c">Atrasos</th><th class="c">Atestados</th><th class="c">vs mês ant.</th></tr></thead><tbody>
      ${rk.map(x => `<tr><td class="c num"><b>${x.pos}º</b></td><td><b>${esc(short(x.o.nome))}</b>${x.pend ? ' <span class="pill neu">avaliação pendente</span>' : ''}</td><td class="r num"><b>${h1(x.nota)}</b></td><td>${classe(x.classe)}</td><td class="r num">${Math.round(x.scProd)}</td><td class="c num">${n1(x.proatD)}</td><td class="c num">${n1(x.segD)}</td><td class="c num">${n1(x.s5D)}</td><td class="c num">${x.faltas || ''}</td><td class="c num">${x.atrasos || ''}</td><td class="c num">${x.atest || ''}</td><td class="c">${varr(x)}</td></tr>`).join('') || '<tr><td colspan="12" class="empty">Ninguém classificado no mês.</td></tr>'}
      </tbody></table></div></div>`;
    return h;
  }


  /* ---------- resumo da semana (módulo Painel) ---------- */
  function resumoSemana(ini) {
    if (!E().loaded || !E().config) return null;
    const fim = add(ini, 6); DB.eWatch([ini.slice(0, 7), fim.slice(0, 7)]);
    const C = calc(); const DL7 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const datas = Array.from({ length: 7 }, (_, i) => add(ini, i));
    const L = E().lanc.filter(l => l.data >= ini && l.data <= fim), P = E().par.filter(p => p.data >= ini && p.data <= fim);
    const linhas = L.map(l => { const jan = C.janela(l); const ps = P.filter(p => p.data === l.data && p.eq === l.eq && p.op === l.op && !p.subst); const hp = Math.min(jan, ps.reduce((s, p) => s + C.duracao(p), 0)); return { ...l, jan, hpar: hp, hoper: Math.max(0, jan - hp) }; });
    const pars = P.map(p => ({ ...p, dur: C.duracao(p), resp: C.resp(p) }));
    const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
    const hprev = sum(linhas, l => l.jan), hoper = sum(linhas, l => l.hoper), parEq = pars.filter(p => p.resp === 'EQUIPAMENTO'), hParEq = sum(parEq, p => p.dur);
    const he = linhas.filter(l => STATUS_HE.includes(l.status)), fora = linhas.filter(l => l.status === 'FORA DE OPERAÇÃO' || l.status === 'EM MANUTENÇÃO');
    const causas = {}; for (const p of pars) { if (!p.causa) continue; const c = causas[p.causa] || (causas[p.causa] = { causa: p.causa, resp: p.resp, n: 0, h: 0 }); c.n++; c.h += p.dur; }
    const eqs = {}; for (const p of parEq) { const e = eqs[p.eq] || (eqs[p.eq] = { id: p.eq, n: 0, h: 0 }); e.n++; e.h += p.dur; }
    const ops = {}; for (const l of linhas) { const o = ops[l.op] || (ops[l.op] = { nome: l.op, aloc: 0, h: 0, he: 0 }); o.aloc++; o.h += l.hoper; if (STATUS_HE.includes(l.status)) o.he++; }
    const abertas = E().par.filter(p => !p.fim && p.data <= fim);
    return {
      kpis: [[L.length, 'Alocações'], [h1(hoper) + ' h', 'Horas operadas'], [pc(hprev ? hoper / hprev : 0), 'Aproveitamento'], [pc(hprev ? Math.max(0, 1 - hParEq / hprev) : 0), 'Disponibilidade física'], [P.length, 'Paradas'], [he.length, 'Alocações em HE']],
      corpo: `<h4>Por dia</h4><table><thead><tr><th></th>${datas.map((dt, i) => `<th class="r">${DL7[i]} ${dt.slice(8)}/${dt.slice(5, 7)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>Alocações</td>${datas.map(dt => `<td class="r">${linhas.filter(l => l.data === dt).length || ''}</td>`).join('')}</tr>
        <tr><td>Horas operadas</td>${datas.map(dt => { const v = sum(linhas.filter(l => l.data === dt), l => l.hoper); return `<td class="r">${v ? h1(v) : ''}</td>`; }).join('')}</tr>
        <tr><td>Horas paradas</td>${datas.map(dt => { const v = sum(linhas.filter(l => l.data === dt), l => l.hpar); return `<td class="r">${v ? h1(v) : ''}</td>`; }).join('')}</tr>
        <tr><td>Paradas</td>${datas.map(dt => `<td class="r">${P.filter(p => p.data === dt).length || ''}</td>`).join('')}</tr></tbody></table>
        <div class="rcols"><div><h4>Principais causas de parada</h4>${Object.keys(causas).length ? `<table><tbody>${Object.values(causas).sort((a, b) => b.h - a.h).slice(0, 6).map(c => `<tr><td>${esc(c.causa)}<div class="muted small">${esc((c.resp || '').toLowerCase())}</div></td><td class="r">${c.n}×</td><td class="r">${h1(c.h)} h</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma parada na semana.</p>'}</div>
        <div><h4>Equipamentos mais parados</h4>${Object.keys(eqs).length ? `<table><tbody>${Object.values(eqs).sort((a, b) => b.h - a.h).slice(0, 6).map(e => `<tr><td>${esc(e.id)}</td><td class="r">${e.n} falha${e.n > 1 ? 's' : ''}</td><td class="r">${h1(e.h)} h</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma falha de equipamento.</p>'}</div></div>
        <div class="rcols"><div><h4>Operadores</h4>${Object.keys(ops).length ? `<table><thead><tr><th>Operador</th><th class="r">Aloc.</th><th class="r">Horas</th><th class="r">HE</th></tr></thead><tbody>${Object.values(ops).sort((a, b) => b.aloc - a.aloc).map(o => `<tr><td>${esc(short(o.nome))}</td><td class="r">${o.aloc}</td><td class="r">${h1(o.h)}</td><td class="r">${o.he || ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sem lançamentos.</p>'}</div>
        <div><h4>Pontos de atenção</h4><table><tbody><tr><td>Alocações fora de operação ou em manutenção</td><td class="r">${fora.length}</td></tr><tr><td>Paradas por falha de equipamento</td><td class="r">${parEq.length} · ${h1(hParEq)} h</td></tr><tr><td>Paradas por causa do operador</td><td class="r">${pars.filter(p => p.resp === 'OPERADOR').length}</td></tr><tr><td>Paradas ainda sem liberação</td><td class="r">${abertas.length}</td></tr><tr><td>Horas extras</td><td class="r">${hhmm(sum(linhas, l => l.he))}</td></tr></tbody></table></div></div>`
    };
  }

  /* ---------- lançamentos ---------- */
  const STATUS_CLS = { 'OPERAÇÃO FINALIZADA': 'ok', 'EM OPERAÇÃO': 'neu', 'HORA EXTRA': 'ext', 'HE NOTURNA': 'ext', 'FORA DE OPERAÇÃO': 'bad', 'EM MANUTENÇÃO': 'warn' };
  // Texto de busca de um lançamento: equipamento, tipo, operador, área, status e observação.
  const kLanc = l => semAcento([l.eq, l.tipo, l.op, l.sub, l.area, l.status, l.obs, l.trocaPara, l.eqOrig, l.trocaPara || l.eqOrig ? 'substituicao troca reserva' : ''].filter(Boolean).join(' '));
  const trocaTxt = l => `${l.trocaPara ? `<div><span class="pill neu" title="Equipamento substituído">${I.swap} trocado por ${esc(l.trocaPara)} às ${esc(l.fim || '')}</span></div>` : ''}${l.eqOrig ? `<div><span class="pill ext" title="Equipamento reserva">${I.swap} reserva de ${esc(l.eqOrig)}</span></div>` : ''}${l.voltaDe ? `<div><span class="pill ok">${I.swap} voltou do ${esc(l.voltaDe)}</span></div>` : ''}`;
  const desdeH = p => { if (!p.ini) return 0; const t = new Date(`${p.data}T${p.ini}:00`).getTime(); return Math.max(0, (Date.now() - t) / 36e5); };
  const tempoTxt = h => (h >= 24 ? `${Math.floor(h / 24)} d ${Math.floor(h % 24)} h` : `${Math.floor(h)} h ${pad(Math.round((h % 1) * 60) % 60)} min`);
  // Lançamentos e paradas numa aba só: a troca fica no topo; o número de equipamentos parados aparece sempre.
  function vLancPar() {
    const abertas = E().par.filter(p => !p.fim).length;
    const aba = U.aba === 'par' ? 'par' : 'lanc';
    const seg = `<div class="seg lpseg" role="tablist" aria-label="Mostrar"><button type="button" role="tab" data-e="aba" data-v="lanc" aria-selected="${aba === 'lanc'}">${I.apontar} Lançamentos do dia</button><button type="button" role="tab" data-e="aba" data-v="par" aria-selected="${aba === 'par'}">${I.pend} Paradas${abertas ? ` <span class="badge num">${abertas}</span>` : ''}</button></div>`;
    return seg + (aba === 'par' ? vPar() : vLanc());
  }
  function vLanc() {
    const C = calc(); const d = U.dia;
    const all = E().lanc; const al = C.alertas(all.filter(l => l.data === d), E().par.filter(p => p.data === d), TODAY);
    const alMap = new Map(); al.filter(a => a.aba === 'Lançamentos').forEach(a => alMap.set(a.ref.id, a.tipo));
    const parDia = E().par.filter(p => p.data === d);
    const linhas = all.filter(l => l.data === d).map(l => { const jan = C.janela(l); const ps = parDia.filter(p => p.eq === l.eq && p.op === l.op && !p.subst); const hp = Math.min(jan, ps.reduce((s, p) => s + C.duracao(p), 0)); return { ...l, jan, hpar: hp, hoper: Math.max(0, jan - hp), nPar: ps.length, aberta: l.trocaPara ? null : ps.find(p => !p.fim) }; }).sort((a, b) => a.eq.localeCompare(b.eq));
    const dw = DAYS[(new Date(d + 'T12:00').getDay() + 6) % 7];
    const ed = podeEditar();
    // Quem estava previsto e não foi lançado · quem está fora
    const alocados = new Set(linhas.map(l => l.op));
    const ops = E().cad.operadores;
    const semLanc = ops.filter(o => !C.ausenteEm(o, d) && C.escalado(o, d) && !alocados.has(o.nome)).sort((a, b) => a.nome.localeCompare(b.nome));
    const fora = ops.filter(o => C.ausenteEm(o, d));
    const q = U.lq || '';
    let h = `<div class="filters"><div class="daynav"><button class="btn" data-e="diaAnt" aria-label="Dia anterior">◀</button><label class="sel"><span>${dw}</span><input class="in" type="date" id="eDia" value="${d}"></label><button class="btn" data-e="diaProx" aria-label="Próximo dia">▶</button>${d !== TODAY ? '<button class="btn" data-e="hoje">Hoje</button>' : ''}</div>
      ${podeExportar() ? `<button class="btn" data-e="expLanc" style="align-self:flex-end" title="Todos os lançamentos do mês">${I.dl} Exportar mês</button>` : ''}
      ${ed ? `<button class="btn pri" data-e="novoLanc" style="align-self:flex-end">${I.plus} Lançamento</button>${!linhas.length ? '<button class="btn" data-e="copiar" style="align-self:flex-end">Copiar do dia anterior</button>' : ''}` : ''}</div>
      <div class="mini"><div><b class="num">${linhas.length}</b><span>Alocações</span></div><div><b class="num">${h1(linhas.reduce((s, l) => s + l.hoper, 0))}</b><span>Horas operadas</span></div><div><b class="num">${h1(linhas.reduce((s, l) => s + l.hpar, 0))}</b><span>Horas paradas</span></div><div><b class="num" style="color:${parDia.some(p => !p.fim) ? 'var(--st-nreal)' : 'inherit'}">${parDia.length}</b><span>Paradas no dia${parDia.some(p => !p.fim) ? ` · ${parDia.filter(p => !p.fim).length} sem liberação` : ''}</span></div></div>`;
    if (!mesesCarregados().has(d.slice(0, 7))) return h + '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
    // Conferência do dia: escalados sem lançamento (toque para lançar) e operadores fora
    if (semLanc.length || fora.length) {
      h += `<div class="card conf"><div class="body"><div class="conf-l"><b>${semLanc.length ? `${semLanc.length} operador${semLanc.length > 1 ? 'es' : ''} escalado${semLanc.length > 1 ? 's' : ''} sem lançamento` : 'Todos os escalados foram lançados'}</b>${semLanc.length && ed ? '<small>Toque no nome para lançar</small>' : ''}</div>
        ${semLanc.length ? `<div class="rchips">${semLanc.map(o => ed ? `<button class="rchip add" data-e="lancOp" data-op="${esc(o.nome)}">${I.plus}${esc(short(o.nome))}<span class="c">${o.escala === '4x4' ? '4x4·' + esc(o.turma || '?') : 'ADM'}</span></button>` : `<span class="rchip">${esc(short(o.nome))}</span>`).join('')}</div>` : ''}
        ${fora.length ? `<div class="conf-f"><span class="muted small">${d === TODAY ? 'Fora hoje' : 'Fora neste dia'}:</span> ${fora.map(o => `<span class="rchip mut">${esc(short(o.nome))}<span class="c">${esc(title(C.ausenteEm(o, d)))}</span></span>`).join('')}</div>` : ''}</div></div>`;
    }
    if (!linhas.length) return h + `<div class="card"><div class="empty">Nenhum lançamento em ${dBR(d)}.${ed ? ' Use "Copiar do dia anterior" para repetir as alocações do último dia lançado, ou toque num operador acima.' : ''}</div></div>`;
    const busca = `<div class="lbar">${caixaBusca('eLQ', q, 'Buscar equipamento, operador ou área')}<span class="muted small"><b id="eLN">${linhas.filter(l => casa(kLanc(l), q)).length}</b> de ${linhas.length}</span></div>`;
    const parTxt = l => (l.aberta ? `<span class="pill bad">parado desde ${l.aberta.ini}</span>` : l.nPar ? `<span class="pill neu">${l.nPar} parada${l.nPar > 1 ? 's' : ''} · ${h2(l.hpar)} h</span>` : '');
    const ajuda = '<p class="muted small m0 ajuda">Cada linha é um operador num equipamento no dia. <b>Janela</b> = horário do lançamento (vazio = turno da escala). <b>Operadas</b> = janela − paradas desse operador nesse equipamento. Ações: ${I.pend} registra uma parada · ${I.swap} troca o equipamento danificado por um reserva (o operador segue sem perder horas) · ✎ edita.</p>';
    if (matchMedia('(max-width:860px)').matches) {
      return h + busca + `<div class="mlist" id="eLList">${linhas.map(l => `<div class="mcard" data-k="${esc(kLanc(l))}" ${casa(kLanc(l), q) ? '' : 'hidden'}><div class="row-between"><div><b class="mono">${esc(l.eq)}</b> <span class="muted small">${esc(l.tipo)}</span>${trocaTxt(l)}</div>${ed ? `<button class="btn ghost" data-e="editLanc" data-id="${l.id}" aria-label="Editar">✎</button>` : ''}</div>
        <div><b>${esc(short(l.op))}</b>${C.escalaDe(l.op) === '4x4' ? ' <span class="tag">4x4</span>' : ''} · <span class="small">${esc(title(l.area))}</span>${l.sub ? `<div class="muted small">substituiu ${esc(short(l.sub))}</div>` : ''}</div>
        ${ed ? `<select class="in sts ${STATUS_CLS[l.status] || ''}" data-est="${l.id}" aria-label="Status">${E().config.status.map(x => `<option ${x === l.status ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<span class="pill ${STATUS_CLS[l.status] || 'neu'}">${esc(l.status)}</span>`}
        <div class="row-between small"><span class="num">${l.ini || 'turno'} – ${l.fim || 'turno'} · janela ${h2(l.jan)} h</span><b class="num">${h2(l.hoper)} h operadas</b></div>
        ${parTxt(l)}${l.obs ? `<div class="muted small">${esc(l.obs)}</div>` : ''}${alMap.has(l.id) ? `<div class="pill warn">${esc(alMap.get(l.id))}</div>` : ''}
        ${ed && !l.trocaPara ? `<div class="row-gap">${l.aberta ? `<button class="btn pri grow" data-e="liberar" data-id="${l.aberta.id}">Liberar ${esc(l.eq)}</button>` : `<button class="btn grow" data-e="parDe" data-id="${l.id}">${I.pend} Parada</button>`}<button class="btn grow" data-e="trocar" data-id="${l.id}">${I.swap} Trocar equipamento</button></div>` : ''}</div>`).join('')}<p class="empty" data-vazio ${linhas.some(l => casa(kLanc(l), q)) ? 'hidden' : ''}>Nada encontrado nesta busca.</p></div>${ajuda}`;
    }
    h += `<div class="card">${busca.replace('class="lbar"', 'class="lbar body"')}<div class="tw" id="eLList"><table class="lanc"><thead><tr><th>Equipamento</th><th>Operador</th><th>Área</th><th>Status</th><th class="c">Horário</th><th class="r">Janela</th><th class="r">Paradas</th><th class="r">Operadas</th><th class="r">Ações</th></tr></thead><tbody>
      ${linhas.map(l => `<tr data-k="${esc(kLanc(l))}" ${casa(kLanc(l), q) ? '' : 'hidden'} ${l.aberta ? 'class="parado"' : ''}><td><b class="mono">${esc(l.eq)}</b><div class="muted small">${esc(l.tipo)}</div>${trocaTxt(l)}</td><td>${esc(short(l.op))}${C.escalaDe(l.op) === '4x4' ? ' <span class="tag">4x4</span>' : ''}${l.sub ? `<div class="muted small">substituiu ${esc(short(l.sub))}</div>` : ''}${l.obs ? `<div class="muted small obs">${esc(l.obs)}</div>` : ''}${alMap.has(l.id) ? `<div class="pill warn">${esc(alMap.get(l.id))}</div>` : ''}</td><td class="small">${esc(title(l.area))}</td>
        <td>${ed ? `<select class="in sts ${STATUS_CLS[l.status] || ''}" data-est="${l.id}" aria-label="Status">${E().config.status.map(s => `<option ${s === l.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : `<span class="pill ${STATUS_CLS[l.status] || 'neu'}">${esc(l.status)}</span>`}</td>
        <td class="c num small">${l.ini || '—'} – ${l.fim || '—'}${l.he ? `<div class="pill ext" title="Hora extra${l.heOrigem ? ' a pedido da ' + (l.heOrigem === 'ARCELOR' ? 'ArcelorMittal' : 'Dikma') : ''}">HE ${hhmm(l.he)}${l.heOrigem ? ' · ' + (l.heOrigem === 'ARCELOR' ? 'Arcelor' : 'Dikma') : ''}</div>` : ''}</td><td class="r num">${h2(l.jan)}</td><td class="r num">${l.hpar ? h2(l.hpar) : ''}${l.aberta ? '<div><span class="pill bad">aberta</span></div>' : ''}</td><td class="r num"><b>${h2(l.hoper)}</b></td>
        <td class="nowrap r acts">${ed ? `${l.trocaPara ? '' : l.aberta ? `<button class="btn sm pri" data-e="liberar" data-id="${l.aberta.id}">Liberar</button>` : `<button class="btn sm ic" data-e="parDe" data-id="${l.id}" title="Registrar parada" aria-label="Registrar parada de ${esc(l.eq)}">${I.pend}</button>`}${l.trocaPara ? '' : `<button class="btn sm ic" data-e="trocar" data-id="${l.id}" title="Trocar equipamento (danificado → reserva)" aria-label="Trocar ${esc(l.eq)} por um reserva">${I.swap}</button>`}<button class="btn sm ic ghost" data-e="editLanc" data-id="${l.id}" title="Editar" aria-label="Editar">✎</button>` : ''}</td></tr>`).join('')}
      </tbody></table><p class="empty" data-vazio ${linhas.some(l => casa(kLanc(l), q)) ? 'hidden' : ''}>Nada encontrado nesta busca.</p></div><div class="body pt0">${ajuda}</div></div>`;
    return h;
  }
  const dl = (id, arr) => `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  // Operadores para escolher, já dizendo a situação no dia: disponível, em outro equipamento, folga na escala ou ausente.
  function opcoesOp(dataFn, excetoId) {
    return () => {
      const dia = dataFn() || U.dia; const C = calc(); const lan = E().lanc.filter(l => l.data === dia && l.id !== excetoId);
      return E().cad.operadores.map(o => {
        const aus = C.ausenteEm(o, dia); const em = lan.filter(l => l.op === o.nome).map(l => l.eq); const escd = C.escalado(o, dia);
        const tag = aus ? `<span class="pill warn">${esc(title(aus))}</span>` : em.length ? `<span class="pill neu">em ${esc(em.join(', '))}</span>` : !escd ? '<span class="pill neu">folga na escala</span>' : '<span class="pill ok">disponível</span>';
        return { v: o.nome, t: title(o.nome), d: `${title(o.funcao || '')}${o.funcao ? ' · ' : ''}${o.escala === '4x4' ? '4x4 · turma ' + (o.turma || '?') : 'ADM'}`, tag, ord: aus ? 3 : em.length ? 2 : !escd ? 1 : 0 };
      }).sort((a, b) => a.ord - b.ord || a.t.localeCompare(b.t));
    };
  }
  // Equipamentos: tipo, quem está com ele no dia e se está parado.
  function opcoesEq(dataFn, excetoId) {
    return () => {
      const dia = dataFn() || U.dia; const lan = E().lanc.filter(l => l.data === dia && l.id !== excetoId); const abertas = new Set(E().par.filter(p => !p.fim).map(p => p.eq));
      return E().cad.frota.map(f => { const com = lan.filter(l => l.eq === f.id).map(l => short(l.op)); return { v: f.id, t: f.id, d: title(f.tipo || ''), tag: abertas.has(f.id) ? '<span class="pill bad">parado</span>' : com.length ? `<span class="pill neu">com ${esc(com.join(', '))}</span>` : '<span class="pill ok">livre</span>', ord: abertas.has(f.id) ? 2 : com.length ? 1 : 0 }; })
        .sort((a, b) => a.ord - b.ord || a.t.localeCompare(b.t));
    };
  }
  function lancForm(l, pre) {
    const novo = !l; l = l || { data: U.dia, eq: '', op: (pre && pre.op) || '', area: E().config.areas[0] || '', status: 'EM OPERAÇÃO', ini: '', fim: '', he: 0, sub: '', obs: '' };
    const dia = () => ($('flData') && $('flData').value) || l.data;
    formSheet(novo ? 'Novo lançamento' : 'Editar lançamento', novo ? 'Um operador num equipamento no dia' : `${dBR(l.data)} · ${esc(l.eq)}`, `
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="flData" value="${l.data}"></label><label class="sel"><span>Status</span><select class="in" id="flSt">${E().config.status.map(s => `<option ${s === l.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
      <div class="sel"><span>Equipamento (frota)</span>${campoBusca('flEq', l.eq, opcoesEq(dia, l.id), { livre: true, maiusculas: true, placeholder: 'Digite a identificação ou o tipo' })}</div>
      <div class="sel"><span>Operador</span>${campoBusca('flOp', l.op, opcoesOp(dia, l.id), { placeholder: 'Digite nome, função ou turma' })}</div>
      <label class="sel"><span>Área</span><select class="in" id="flArea">${E().config.areas.map(a => `<option ${a === l.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <div class="row2"><label class="sel"><span>Início (vazio = turno)</span><input class="in" type="time" id="flIni" value="${l.ini || ''}"></label><label class="sel"><span>Fim (vazio = turno)</span><input class="in" type="time" id="flFim" value="${l.fim || ''}"></label></div>
      <div class="row2"><label class="sel"><span>Horas extras (h)</span><input class="in" type="number" min="0" step="0.25" id="flHe" value="${l.he || ''}"></label><label class="sel"><span>Hora extra a pedido de</span><select class="in" id="flHeO"><option value="">—</option><option value="DIKMA" ${l.heOrigem === 'DIKMA' ? 'selected' : ''}>Dikma</option><option value="ARCELOR" ${l.heOrigem === 'ARCELOR' ? 'selected' : ''}>ArcelorMittal</option></select></label></div>
      <div class="sel"><span>Substituiu (opcional)</span>${campoBusca('flSub', l.sub, opcoesOp(dia, l.id), { vazio: '—', placeholder: 'Ninguém' })}</div>
      <label class="sel"><span>Observação</span><textarea class="in ta" id="flObs" rows="2">${esc(l.obs || '')}</textarea></label>
      <div id="flAviso" class="avisos" aria-live="polite"></div>
      ${novo ? '' : `<button type="button" class="btn danger" data-del="${l.id}">Excluir lançamento</button>`}`, 'Salvar', async () => {
      const eq = $('flEq').value.trim().toUpperCase(); const data = $('flData').value; const op = $('flOp').value;
      if (!data || !eq) throw new Error('Informe a data e o equipamento.');
      if (!op) throw new Error('Escolha o operador da lista.');
      const n = { data, mes: data.slice(0, 7), eq, tipo: (calc().frotaMap.get(eq) || {}).tipo || '', op, area: $('flArea').value, status: $('flSt').value, ini: $('flIni').value || null, fim: $('flFim').value || null, he: +$('flHe').value || 0, heOrigem: (+$('flHe').value || 0) ? $('flHeO').value : '', sub: $('flSub').value || '', obs: $('flObs').value.trim() };
      if (n.he && !n.heOrigem) throw new Error('Informe se a hora extra foi a pedido da Dikma ou da ArcelorMittal.');
      if (novo) { DB.eAdd('lanc', n); DB.log(`Operação: lançou ${eq} · ${short(n.op)} em ${dBR(data)}`); } else { DB.eUpd('lanc', l.id, n); }
      toast(novo ? 'Lançamento salvo' : 'Lançamento atualizado');
    });
    const del = document.querySelector('#fSheet [data-del]');
    if (del) del.onclick = () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Confirmar exclusão'; return; } DB.eDel('lanc', l.id); $('layer').innerHTML = ''; const { id: _i, ...dados } = l; toast('Lançamento excluído', { desfazer: () => { DB.eAdd('lanc', dados); toast('Lançamento restaurado'); } }); render(); };
    // Avisos ao vivo (não impedem salvar): operador fora/de folga/em outro equipamento, equipamento já alocado ou parado.
    const avisar = () => {
      const box = $('flAviso'); if (!box) return; const C = calc(); const d = dia(); const eq = ($('flEq').value || '').toUpperCase(); const op = $('flOp').value;
      const lan = E().lanc.filter(x => x.data === d && x.id !== l.id); const av = [];
      const o = C.opMap.get(op);
      if (o) { const aus = C.ausenteEm(o, d); if (aus) av.push(`${short(op)} está em ${title(aus).toLowerCase()} nesta data.`); else if (!C.escalado(o, d)) av.push(`${short(op)} está de folga na escala nesta data.`); }
      const opEm = lan.filter(x => x.op === op).map(x => x.eq); if (op && opEm.length) av.push(`${short(op)} já está lançado em ${opEm.join(', ')} neste dia.`);
      const eqCom = lan.filter(x => x.eq === eq).map(x => short(x.op)); if (eq && eqCom.length) av.push(`${eq} já tem lançamento com ${eqCom.join(', ')} neste dia.`);
      const ab = E().par.find(p => p.eq === eq && !p.fim); if (ab) av.push(`${eq} está parado desde ${ab.ini} de ${dBR(ab.data)} (sem liberação).`);
      if (eq && !calc().frotaMap.has(eq)) av.push(`${eq} não está cadastrado na frota.`);
      box.innerHTML = av.map(t => `<p class="aviso">${esc(t)}</p>`).join('');
    };
    ['flData', 'flEq', 'flOp', 'flSub'].forEach(id => { const el = $(id); if (el) el.addEventListener('change', avisar); });
    // Ao escolher o equipamento num lançamento novo, sugere o último operador e a área dele.
    const eqi = $('flEq');
    if (novo && eqi) eqi.addEventListener('change', () => { if ($('flOp').value) return; const ult = E().lanc.filter(x => x.eq === eqi.value).sort((a, b) => (a.data < b.data ? 1 : -1))[0]; if (ult) { definirValor('flOp', ult.op); $('flArea').value = ult.area; avisar(); } });
    avisar();
  }
  // Equipamento danificado: o operador passa para um reserva a partir da hora da troca.
  // Grava: parada do equipamento (sem liberação, marcada com o reserva), fim do lançamento original na hora da troca
  // e um lançamento novo do mesmo operador no reserva. A parada não tira horas do operador (ele seguiu trabalhando).
  function substForm({ lanc, par }) {
    const base = lanc || par; const A = base.eq, op = base.op, data = base.data;
    const L1 = lanc || E().lanc.find(x => x.data === data && x.eq === A && x.op === op && !x.trocaPara);
    const causas = E().config.causas; const ord = ['EQUIPAMENTO', 'OPERADOR', 'OPERACIONAL'];
    formSheet('Substituir equipamento', `<span class="mono">${esc(A)}</span>${op ? ' · ' + esc(short(op)) : ''} · ${dBR(data)}`, `
      <p class="muted small m0">${esc(A)} fica parado (sem liberação) e ${op ? esc(short(op)) : 'o operador'} segue no reserva a partir da hora da troca, sem perder horas. Quando ${esc(A)} for liberado, dá para devolver o operador a ele.</p>
      <div class="row2"><label class="sel"><span>${par ? 'Parou às' : 'Hora da troca'}</span><input class="in" type="time" id="fsHora" value="${par ? par.ini : data === TODAY ? agoraHM() : ''}" ${par ? 'disabled' : ''}></label><div class="sel"><span>Equipamento reserva</span>${campoBusca('fsEq', '', () => opcoesEq(() => data)().filter(o => o.v !== A), { livre: true, maiusculas: true, placeholder: 'Digite a identificação' })}</div></div>
      ${par ? `<p class="small m0">Parada já registrada: <b>${esc(par.causa || 'sem causa')}</b> desde ${esc(par.ini)}.</p>` : `<label class="sel"><span>Causa da parada de ${esc(A)}</span><select class="in" id="fsCausa"><option value="">Escolha a causa</option>${ord.filter(rp => causas.some(c => c.resp === rp)).map(rp => `<optgroup label="${title(rp)}">${causas.filter(c => c.resp === rp).map(c => `<option value="${esc(c.causa)}">${esc(title(c.causa))}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="row2"><label class="sel"><span>O que aconteceu</span><input class="in" id="fsDesc" placeholder="Ex.: pneu furado"></label><label class="sel"><span>Nº da OS</span><input class="in" id="fsOs"></label></div>`}
      <div id="fsAviso" class="avisos" aria-live="polite"></div>`, 'Substituir', async () => {
      const B = $('fsEq').value.trim().toUpperCase(); const hora = par ? par.ini : $('fsHora').value;
      if (!B) throw new Error('Escolha o equipamento reserva.');
      if (B === A) throw new Error('O reserva precisa ser outro equipamento.');
      if (!hora) throw new Error('Informe a hora da troca.');
      const causa = par ? par.causa : $('fsCausa').value; if (!causa) throw new Error('Escolha a causa da parada.');
      const fimOrig = L1 ? L1.fim : null;
      let id2 = null;
      if (op) id2 = DB.eAdd('lanc', { data, mes: data.slice(0, 7), eq: B, tipo: (calc().frotaMap.get(B) || {}).tipo || '', op, area: L1 ? L1.area : (E().config.areas[0] || ''), status: 'EM OPERAÇÃO', ini: hora, fim: fimOrig || null, he: 0, sub: '', obs: `Reserva de ${A} (${String(causa).toLowerCase()})`, eqOrig: A });
      if (L1) DB.eUpd('lanc', L1.id, { fim: hora, trocaPara: B });
      let pid = par ? par.id : null;
      if (par) DB.eUpd('par', par.id, { subst: B, lancSub: id2 });
      else pid = DB.eAdd('par', { data, mes: data.slice(0, 7), eq: A, op, ini: hora, fim: null, causa, desc: $('fsDesc').value.trim().toUpperCase(), os: $('fsOs').value.trim(), subst: B, lancSub: id2 });
      DB.log(`Operação: ${A} danificado, ${op ? short(op) + ' seguiu' : 'substituído'} no ${B} às ${hora}`);
      // Desfazer: volta tudo como estava (lançamento original, parada e reserva).
      const desfazer = () => {
        if (id2) DB.eDel('lanc', id2);
        if (L1) DB.eUpd('lanc', L1.id, { fim: fimOrig || null, trocaPara: null });
        if (par) DB.eUpd('par', par.id, { subst: null, lancSub: null }); else if (pid) DB.eDel('par', pid);
        DB.log(`Operação: desfez a troca de ${A} por ${B}`); toast('Troca desfeita');
      };
      toast(`${A} parado · ${op ? short(op).split(' ')[0] + ' segue' : 'segue'} no ${B}`, { desfazer });
    });
    const avisar = () => {
      const box = $('fsAviso'); if (!box) return; const B = ($('fsEq').value || '').toUpperCase(); const av = [];
      if (B) {
        const com = E().lanc.filter(x => x.data === data && x.eq === B && !x.trocaPara).map(x => short(x.op)); if (com.length) av.push(`${B} já está com ${com.join(', ')} neste dia.`);
        const ab = E().par.find(p => p.eq === B && !p.fim); if (ab) av.push(`${B} também está parado (desde ${ab.ini} de ${dBR(ab.data)}).`);
        if (!calc().frotaMap.has(B)) av.push(`${B} não está cadastrado na frota.`);
      }
      if (!L1 && op) av.push(`Não há lançamento de ${A} com ${short(op)} neste dia: será criado só o lançamento no reserva.`);
      box.innerHTML = av.map(t => `<p class="aviso">${esc(t)}</p>`).join('');
    };
    $('fsEq').addEventListener('change', avisar); avisar();
  }
  function copiarDiaAnterior() {
    const d = U.dia; const ant = E().lanc.filter(l => l.data < d).map(l => l.data).sort().pop();
    if (!ant) { toast('Não há dia anterior com lançamentos'); return; }
    const base = E().lanc.filter(l => l.data === ant && !l.trocaPara); // de cada troca, copia só o equipamento em que o operador terminou o dia
    const C = calc();
    const lista = base.filter(l => { const o = C.opMap.get(l.op); return !o || (!C.ausenteEm(o, d) && C.escalado(o, d)); });
    sheet('Copiar lançamentos', `${lista.length} alocações de ${dBR(ant)} para ${dBR(d)} (status "Em operação", horário do turno). Operadores ausentes ou de folga na escala ficam de fora.`, [{ t: `Copiar ${lista.length} alocações`, v: 'ok' }], () => {
      for (const l of lista) DB.eAdd('lanc', { data: d, mes: d.slice(0, 7), eq: l.eq, tipo: l.tipo, op: l.op, area: l.area, status: 'EM OPERAÇÃO', ini: null, fim: null, he: 0, sub: '', obs: '' });
      DB.log(`Operação: copiou ${lista.length} alocações de ${dBR(ant)} para ${dBR(d)}`); toast(`${lista.length} alocações criadas`);
    });
  }

  /* ---------- paradas ---------- */
  const RESP_TXT = { EQUIPAMENTO: 'falha do equipamento · reduz a disponibilidade física', OPERADOR: 'causada pelo operador · conta na nota dele', OPERACIONAL: 'da operação (sem carga, frente parada…) · não conta contra ninguém' };
  const kPar = p => semAcento([p.eq, p.op, p.causa, p.resp, p.desc, p.os, p.subst, p.subst ? 'substituicao troca reserva' : '', (calc().frotaMap.get(p.eq) || {}).tipo].filter(Boolean).join(' '));
  // Exportar para o Excel: lançamentos do mês (com horas) e paradas do mês (no filtro escolhido).
  function exportarLanc(ym) {
    const C = calc();
    const linhas = [['Data', 'Equipamento', 'Tipo', 'Operador', 'Substituiu', 'Área', 'Início', 'Fim', 'Status', 'Janela (h)', 'Paradas (h)', 'Operadas (h)', 'Observação']];
    for (const l of lancMes(ym).slice().sort((a, b) => (a.data + a.eq).localeCompare(b.data + b.eq))) {
      const jan = C.janela(l); const ps = E().par.filter(p => p.data === l.data && p.eq === l.eq && p.op === l.op && !p.subst);
      const hp = Math.min(jan, ps.reduce((t, p) => t + C.duracao(p), 0));
      linhas.push([dataBR(l.data), l.eq, l.tipo || '', l.op || '', l.sub || '', l.area || '', l.ini || 'turno', l.fim || 'turno', l.status || '', +jan.toFixed(2), +hp.toFixed(2), +Math.max(0, jan - hp).toFixed(2), l.obs || '']);
    }
    if (linhas.length === 1) return toast('Nenhum lançamento neste mês');
    baixarExcel(`lancamentos-${ym}`, [{ nome: 'Lançamentos ' + ym, linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  }
  function exportarPar() {
    const C = calc(); const F = { aberta: p => !p.fim, todas: () => true };
    const l = E().par.filter(p => p.data.slice(0, 7) === U.mes || (U.pf === 'aberta' && !p.fim)).filter(p => (F[U.pf] ? F[U.pf](p) : C.resp(p) === U.pf)).sort((a, b) => (a.data + (a.ini || '')).localeCompare(b.data + (b.ini || '')));
    if (!l.length) return toast('Nenhuma parada com esse filtro');
    const linhas = [['Data', 'Equipamento', 'Operador', 'Início', 'Fim', 'Duração (h)', 'Causa', 'Responsabilidade', 'Situação', 'Descrição', 'OS']];
    for (const p of l) linhas.push([dataBR(p.data), p.eq, p.op || '', p.ini || '', p.fim || 'sem liberação', +(C.duracao(p) || 0).toFixed(2), p.causa || '', title(C.resp(p) || ''), C.situacao(p) || '', p.desc || '', p.os || '']);
    baixarExcel(`paradas-${U.mes}`, [{ nome: 'Paradas ' + U.mes, linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  }
  function vPar() {
    const C = calc();
    const ps = E().par.filter(p => p.data.slice(0, 7) === U.mes || (U.pf === 'aberta' && !p.fim)).map(p => ({ ...p, dur: C.duracao(p), resp: C.resp(p), sit: C.situacao(p) }));
    const al = new Map(C.alertas(E().lanc, E().par, TODAY).filter(a => a.aba === 'Paradas').map(a => [a.ref.id, a.tipo]));
    const F = { aberta: p => !p.fim, todas: () => true, EQUIPAMENTO: p => p.resp === 'EQUIPAMENTO', OPERADOR: p => p.resp === 'OPERADOR', OPERACIONAL: p => p.resp === 'OPERACIONAL' };
    const base = ps.filter(F[U.pf] || F.todas);
    if (U.pdia && U.pdia.slice(0, 7) !== U.mes) U.pdia = '';
    const l = base.filter(p => !U.pdia || p.data === U.pdia).sort((a, b) => (a.data + (a.ini || '') > b.data + (b.ini || '') ? -1 : 1));
    const n = k => ps.filter(F[k]).length;
    const abertas = E().par.filter(p => !p.fim);
    const maisLonga = abertas.reduce((m, p) => Math.max(m, desdeH(p)), 0);
    const doMes = ps.filter(p => p.data.slice(0, 7) === U.mes);
    // Faixa de dias do mês: quantas paradas (no filtro escolhido) e horas paradas em cada dia.
    const porDia = new Map(); for (const p of base) if (p.data.slice(0, 7) === U.mes) { const x = porDia.get(p.data) || { n: 0, h: 0 }; x.n++; x.h += p.dur || 0; porDia.set(p.data, x); }
    const fim = fimMes(U.mes), dias = []; for (let d = U.mes + '-01'; d <= fim; d = add(d, 1)) dias.push(d);
    const semana = d => DAYS[(new Date(d + 'T12:00').getDay() + 6) % 7];
    const faixa = `<div class="dstrip" role="toolbar" aria-label="Filtrar por dia"><button class="dchip todos" data-epdia="" aria-pressed="${!U.pdia}"><small>Mês</small><b>Todos</b><i>${base.length}</i></button>${dias.map(d => { const x = porDia.get(d); return `<button class="dchip${d === TODAY ? ' hoje' : ''}${x ? '' : ' vazio'}${d > TODAY ? ' futuro' : ''}" data-epdia="${d}" aria-pressed="${U.pdia === d}" title="${dBR(d)}${x ? ` · ${x.n} parada(s) · ${h2(x.h)} h` : ' · sem paradas'}"><small>${semana(d)}</small><b>${d.slice(8)}</b><i>${x ? x.n : ''}</i></button>`; }).join('')}</div>`;
    setTimeout(() => { const st = document.querySelector('.dstrip'); if (!st) return; const alvo = st.querySelector('[aria-pressed="true"]:not(.todos)') || st.querySelector('.hoje'); if (alvo) st.scrollLeft = Math.max(0, alvo.offsetLeft - st.clientWidth / 2 + alvo.offsetWidth / 2); }, 0);
    const q = U.pq || '';
    let h = `<div class="filters">${selMes('eMes', U.mes)}${podeExportar() ? `<button class="btn" data-e="expPar" style="align-self:flex-end">${I.dl} Exportar</button>` : ''}${podeEditar() ? `<button class="btn pri" data-e="novaPar" style="align-self:flex-end">${I.plus} Registrar parada</button>` : ''}</div>
      <div class="mini"><div><b class="num" style="color:${abertas.length ? 'var(--st-nreal)' : 'inherit'}">${abertas.length}</b><span>Parados agora</span></div><div><b class="num">${abertas.length ? tempoTxt(maisLonga) : '—'}</b><span>Mais tempo parado</span></div><div><b class="num">${doMes.length}</b><span>Paradas no mês</span></div><div><b class="num">${h1(doMes.reduce((t, p) => t + (p.dur || 0), 0))}</b><span>Horas paradas no mês</span></div><div><b class="num">${doMes.filter(p => p.subst).length}</b><span>Trocas por reserva</span></div></div>
      <div class="rchips">${[['aberta', 'Sem liberação'], ['todas', 'Todas do mês'], ['EQUIPAMENTO', 'Equipamento'], ['OPERADOR', 'Operador'], ['OPERACIONAL', 'Operacional']].map(([k, t]) => `<button class="rchip" data-epf="${k}" aria-pressed="${U.pf === k}">${t}<span class="c num">${k === 'aberta' ? abertas.length : n(k)}</span></button>`).join('')}</div>
      ${RESP_TXT[U.pf] ? `<p class="muted small m0 ajuda"><b>${title(U.pf)}:</b> ${RESP_TXT[U.pf]}.</p>` : U.pf === 'aberta' ? '<p class="muted small m0 ajuda"><b>Sem liberação</b> = o equipamento continua parado. Quando voltar a operar, toque em <b>Liberar</b> e informe a hora.</p>' : ''}
      ${faixa}`;
    if (!l.length) return h + `<div class="card"><div class="empty">${U.pdia ? `Nenhuma parada em ${dBR(U.pdia)} com esse filtro.` : U.pf === 'aberta' ? 'Nenhum equipamento parado agora.' : 'Nenhuma parada com esse filtro.'}</div></div>`;
    const grupos = []; for (const p of l) { const g = grupos[grupos.length - 1]; if (g && g.d === p.data) g.l.push(p); else grupos.push({ d: p.data, l: [p] }); }
    const vis = l.filter(p => casa(kPar(p), q)).length;
    const item = p => { const k = kPar(p); const desde = !p.fim ? desdeH(p) : 0; const tipo = (C.frotaMap.get(p.eq) || {}).tipo;
      return `<div class="pitem ${!p.fim ? 'aberta' : ''}" data-k="${esc(k)}" ${casa(k, q) ? '' : 'hidden'}><div class="minw"><div class="t"><span class="mono">${esc(p.eq)}</span>${tipo ? ` <span class="muted small">${esc(title(tipo))}</span>` : ''} · ${esc(p.causa || 'sem causa')} <span class="pill ${p.resp === 'EQUIPAMENTO' ? 'bad' : p.resp === 'OPERADOR' ? 'warn' : 'neu'}">${esc((p.resp || '—').toLowerCase())}</span></div>
      <div class="l">${p.ini || '—'} às ${p.fim || '…'} · <b>${p.fim ? h2(p.dur) + ' h' : p.ini ? 'parado há ' + tempoTxt(desde) : 'sem hora de início'}</b> · ${esc(short(p.op))}${p.desc ? ' · ' + esc(p.desc) : ''}${p.os ? ' · OS ' + esc(p.os) : ''}</div>
      ${p.subst ? `<div style="margin-top:4px"><span class="pill ext">${I.swap} ${esc(short(p.op) || 'operador')} seguiu no ${esc(p.subst)}</span></div>` : ''}${al.has(p.id) ? `<div class="pill warn" style="margin-top:4px">${esc(al.get(p.id))}</div>` : ''}</div>
      <div class="row-gap">${!p.fim ? (podeEditar() ? `${!p.subst ? `<button class="btn" data-e="substPar" data-id="${p.id}" title="Passar o operador para um equipamento reserva">${I.swap} Substituir</button>` : ''}<button class="btn pri" data-e="liberar" data-id="${p.id}">Liberar</button>` : '<span class="pill bad">Sem liberação</span>') : '<span class="pill ok">Liberado</span>'}${podeEditar() ? `<button class="btn ghost" data-e="editPar" data-id="${p.id}" aria-label="Editar">✎</button>` : ''}</div></div>`; };
    h += `<div class="card"><div class="lbar body">${caixaBusca('ePQ', q, 'Buscar equipamento, operador, causa ou OS')}<span class="muted small"><b id="ePN">${vis}</b> de ${l.length}</span></div><div class="body pt0" id="ePList"><div class="plist">${grupos.map(g => { const ab = g.l.filter(x => !x.fim).length; return `<div class="pday" data-grupo ${g.l.some(p => casa(kPar(p), q)) ? '' : 'hidden'}><div class="pgrp"><b>${semana(g.d)} ${dBR(g.d).slice(0, 5)}</b><span>${g.l.length} parada${g.l.length > 1 ? 's' : ''} · ${h2(g.l.reduce((t, x) => t + (x.dur || 0), 0))} h${ab ? ` · <em>${ab} sem liberação</em>` : ''}</span></div>${g.l.map(item).join('')}</div>`; }).join('')}<p class="empty" data-vazio ${vis ? 'hidden' : ''}>Nada encontrado nesta busca.</p></div></div></div>`;
    return h;
  }
  function parForm(p, deLanc) {
    const novo = !p;
    p = p || { data: deLanc ? deLanc.data : U.dia, eq: deLanc ? deLanc.eq : '', op: deLanc ? deLanc.op : '', ini: agoraHM(), fim: '', causa: '', desc: '', os: '' };
    const dia = () => ($('fpData') && $('fpData').value) || p.data;
    const causas = E().config.causas; const grupos = ['EQUIPAMENTO', 'OPERADOR', 'OPERACIONAL'].filter(r => causas.some(c => c.resp === r));
    const outras = causas.filter(c => !grupos.includes(c.resp));
    formSheet(novo ? 'Registrar parada' : 'Editar parada', novo ? 'Equipamento que parou de operar' : `${esc(p.eq)} · ${dBR(p.data)}`, `
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="fpData" value="${p.data}"></label><label class="sel"><span>Parou às</span><input class="in" type="time" id="fpIni" value="${p.ini || ''}"></label></div>
      <div class="sel"><span>Equipamento (frota)</span>${campoBusca('fpEq', p.eq, opcoesEq(dia), { livre: true, maiusculas: true, placeholder: 'Digite a identificação ou o tipo' })}</div>
      <div class="sel"><span>Operador</span>${campoBusca('fpOp', p.op, opcoesOp(dia), { placeholder: 'Digite nome, função ou turma' })}</div>
      <label class="sel"><span>Causa</span><select class="in" id="fpCausa"><option value="">Escolha a causa</option>${grupos.map(r => `<optgroup label="${title(r)}">${causas.filter(c => c.resp === r).map(c => `<option value="${esc(c.causa)}" ${c.causa === p.causa ? 'selected' : ''}>${esc(title(c.causa))}</option>`).join('')}</optgroup>`).join('')}${outras.map(c => `<option value="${esc(c.causa)}" ${c.causa === p.causa ? 'selected' : ''}>${esc(title(c.causa))}</option>`).join('')}</select></label>
      <p class="muted small m0" id="fpResp"></p>
      <div class="sel"><span>Liberado às</span><div class="row-gap nowrap"><input class="in grow" type="time" id="fpFim" value="${p.fim || ''}"><button type="button" class="btn" id="fpAgora">Agora</button></div><small class="muted">Vazio = ainda parado (sem liberação)</small></div>
      <div class="row2"><label class="sel"><span>Descrição</span><input class="in" id="fpDesc" value="${esc(p.desc || '')}" placeholder="O que aconteceu"></label><label class="sel"><span>Nº da OS</span><input class="in" id="fpOs" value="${esc(p.os || '')}"></label></div>
      ${novo ? '' : `<button type="button" class="btn danger" data-del="${p.id}">Excluir parada</button>`}`, 'Salvar', async () => {
      const eq = $('fpEq').value.trim().toUpperCase(); const data = $('fpData').value; const ini = $('fpIni').value;
      if (!data || !eq || !ini) throw new Error('Informe data, equipamento e a hora em que parou.');
      if (!$('fpCausa').value) throw new Error('Escolha a causa.');
      const n = { data, mes: data.slice(0, 7), eq, op: $('fpOp').value, ini, fim: $('fpFim').value || null, causa: $('fpCausa').value, desc: $('fpDesc').value.trim().toUpperCase(), os: $('fpOs').value.trim() };
      if (novo) { DB.eAdd('par', n); DB.log(`Operação: parada ${eq} · ${n.causa.toLowerCase()}`); } else DB.eUpd('par', p.id, n);
      toast(n.fim ? 'Parada salva' : `${eq} registrado como parado (sem liberação)`);
    });
    const del = document.querySelector('#fSheet [data-del]');
    if (del) del.onclick = () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Confirmar exclusão'; return; } DB.eDel('par', p.id); $('layer').innerHTML = ''; const { id: _i, dur: _d, resp: _r, sit: _s, ...dados } = p; toast('Parada excluída', { desfazer: () => { DB.eAdd('par', dados); toast('Parada restaurada'); } }); render(); };
    const resp = () => { const c = causas.find(x => x.causa === $('fpCausa').value); $('fpResp').textContent = c ? `${title(c.resp)}: ${RESP_TXT[c.resp] || ''}` : ''; };
    $('fpCausa').addEventListener('change', resp); resp();
    $('fpAgora').onclick = () => { $('fpFim').value = agoraHM(); };
    // Escolheu o equipamento: traz quem estava operando ele no dia.
    $('fpEq').addEventListener('change', () => { const l = E().lanc.find(x => x.data === dia() && x.eq === $('fpEq').value); if (l && !$('fpOp').value) definirValor('fpOp', l.op); });
  }

  /* ---------- equipe ---------- */
  function vEquipe() {
    const C = calc(); const ops = E().cad.operadores;
    const { ops: st } = C.mes(U.mes, E().lanc, E().par, E().insp, E().aval[U.mes] || {}, TODAY);
    const stMap = new Map(st.map(x => [x.o.nome, x]));
    const fora = ops.filter(o => C.ausenteEm(o, TODAY));
    const ult = n => E().lanc.filter(l => l.op === n).map(l => l.data).sort().pop();
    const ext = extFreq();
    // turno do dia pela letra (escala central): dia ou noite
    const perHoje = o => { if (o.escala !== '4x4' || !X.escala) return ''; const p = X.escala().previsto('4x4', o.turma, TODAY); return p && p.trab && p.periodo ? (p.periodo === 'N' ? ' · noite' : ' · dia') : ''; };
    const sitTxt = o => {
      const daFreq = ext(o, TODAY);
      if (daFreq !== undefined) return daFreq ? `<span class="pill warn">${esc(title(daFreq))}</span><div class="muted small">pela Frequência / Efetivo diário</div>` : `<span class="pill ok">Trabalhando${perHoje(o)}</span><div class="muted small">pela Frequência / Efetivo diário</div>`;
      if (!o.situacao || o.situacao === 'TRABALHANDO') return `<span class="pill ok">Trabalhando${perHoje(o)}</span>${ext.achou(o) ? '' : '<div class="muted small">fora da Frequência</div>'}`; const at = C.ausenteEm(o, TODAY); return `<span class="pill ${at ? 'warn' : 'neu'}">${esc(title(o.situacao))}</span><div class="muted small">${o.de ? dBR(o.de) : 'hoje'} a ${o.ate ? dBR(o.ate) : 'sem data'}${!at && o.de && o.de > TODAY ? ' · programado' : !at && o.ate && o.ate < TODAY ? ' · encerrado' : ''}</div>`; };
    // Busca e filtro de operadores: valem para a lista e para a escala do mês.
    const kOp = o => semAcento([o.nome, o.funcao, o.escala, o.turma ? 'turma ' + o.turma : '', o.situacao].filter(Boolean).join(' '));
    const FO = { todos: () => true, trab: o => !C.ausenteEm(o, TODAY), fora: o => !!C.ausenteEm(o, TODAY), x4: o => o.escala === '4x4', adm: o => o.escala !== '4x4' };
    U.of = U.of || 'todos'; const q = U.oq || '';
    const opsF = ops.filter(FO[U.of] || FO.todos).slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const visOp = opsF.filter(o => casa(kOp(o), q)).length;
    let h = `<div class="filters">${selMes('eMes', U.mes)}${isAdmin() || podeEditar() ? `<button class="btn pri" data-e="novoOp" style="align-self:flex-end">${I.plus} Operador</button>` : ''}</div>
      <div class="mini"><div><b class="num">${ops.length - fora.length}</b><span>Trabalhando hoje</span></div><div><b class="num" style="color:${fora.length ? 'var(--st-atr)' : 'inherit'}">${fora.length}</b><span>Fora da coqueria</span></div><div><b class="num">${ops.filter(o => o.escala === '4x4').length}</b><span>Escala 4x4</span></div><div><b class="num">${E().cad.frota.length}</b><span>Equipamentos</span></div></div>
      <div class="card"><header><h2>Operadores</h2><p>${mesNome(U.mes)}: dias previstos, ausências e alocações${podeEditar() ? ' · toque para editar' : ''}</p></header>
      <div class="body lbar opbar">${caixaBusca('eOQ', q, 'Buscar operador, função ou turma')}<div class="rchips">${[['todos', 'Todos', ops.length], ['trab', 'Trabalhando', ops.filter(FO.trab).length], ['fora', 'Fora hoje', ops.filter(FO.fora).length], ['x4', '4x4', ops.filter(FO.x4).length], ['adm', 'ADM', ops.filter(FO.adm).length]].map(([k, t, nn]) => `<button class="rchip" data-eof="${k}" aria-pressed="${U.of === k}">${t}<span class="c num">${nn}</span></button>`).join('')}</div><span class="muted small"><b id="eON">${visOp}</b> operador${visOp === 1 ? '' : 'es'}</span></div>
      ${matchMedia('(max-width:860px)').matches ? `<div class="mlist body pt0" id="eOList">${opsF.map(o => { const x = stMap.get(o.nome) || {}; return `<div class="mcard" data-k="${esc(kOp(o))}" ${casa(kOp(o), q) ? '' : 'hidden'} ${podeEditar() ? `data-e="editOp" data-nome="${esc(o.nome)}" tabindex="0" role="button"` : ''}><div class="row-between"><b class="t">${esc(title(o.nome))}</b>${o.escala === '4x4' ? `<span class="tag">4x4 · ${esc(o.turma || '?')}</span>` : '<span class="tag">ADM</span>'}</div><div class="muted small">${esc(title(o.funcao))}${o.fixo === false ? ' · não fixo' : ''}</div><div>${sitTxt(o)}</div><div class="cmet"><span>Previstos <b>${x.diasOp ?? '—'}</b></span><span>Ausente <b>${x.diasOp != null ? x.diasOp - x.dprev || 0 : '—'}</b></span><span>Alocações <b>${x.aloc || 0}</b></span><span>Último <b>${dBR(ult(o.nome)) || '—'}</b></span></div></div>`; }).join('')}<p class="empty" data-vazio ${visOp ? 'hidden' : ''}>Nenhum operador encontrado.</p></div>` : `<div class="tw" id="eOList"><table class="hoverable"><thead><tr><th>Operador</th><th>Função</th><th>Escala</th><th>Situação</th><th class="r">Dias prev.</th><th class="r">Ausente</th><th class="r">Alocações</th><th>Último lançamento</th></tr></thead><tbody>
      ${opsF.map(o => { const x = stMap.get(o.nome) || {}; return `<tr data-k="${esc(kOp(o))}" ${casa(kOp(o), q) ? '' : 'hidden'} ${podeEditar() ? `data-e="editOp" data-nome="${esc(o.nome)}" tabindex="0"` : ''}><td><b>${esc(title(o.nome))}</b>${o.fixo === false ? ' <span class="pill neu">não fixo</span>' : ''}</td><td class="small muted">${esc(title(o.funcao))}</td><td>${o.escala === '4x4' ? `<span class="tag">4x4 · ${esc(o.turma || '?')}</span>` : '<span class="tag">ADM</span>'}</td><td>${sitTxt(o)}</td><td class="r num">${x.diasOp ?? ''}</td><td class="r num">${x.diasOp != null ? x.diasOp - x.dprev || '' : ''}</td><td class="r num">${x.aloc || ''}</td><td class="num small">${dBR(ult(o.nome))}</td></tr>`; }).join('')}
      </tbody></table><p class="empty" data-vazio ${visOp ? 'hidden' : ''}>Nenhum operador encontrado.</p></div>`}</div>`;
    // escala do mês
    const dias = []; for (let d = U.mes + '-01'; d <= fimMes(U.mes); d = add(d, 1)) dias.push(d);
    const lk = new Set(E().lanc.filter(l => l.mes === U.mes || l.data.slice(0, 7) === U.mes).map(l => l.op + '|' + l.data));
    const cel = (o, d) => {
      const aus = C.ausenteEm(o, d); if (aus) return `<td class="ec aus" title="${esc(aus)}">${esc(aus.slice(0, 2))}</td>`;
      const lan = lk.has(o.nome + '|' + d); const escd = C.escalado(o, d);
      if (lan) return `<td class="ec lan" title="Lançado">●</td>`;
      if (!escd) return '<td class="ec fol"></td>';
      return `<td class="ec ${d < TODAY ? 'falt' : 'prev'}" title="${d < TODAY ? 'Escalado sem lançamento' : 'Escalado'}">${d < TODAY ? '!' : '·'}</td>`;
    };
    h += `<div class="card"><header><h2>Escala do mês</h2><p>● lançado · ! escalado sem lançamento · · escalado · vazio = folga · siglas = situação</p></header><div class="tw" id="eOEsc"><table class="escala"><thead><tr><th>Operador</th>${dias.map(d => `<th class="c ${d === TODAY ? 'today' : ''}">${d.slice(8)}</th>`).join('')}</tr></thead><tbody>
      ${opsF.map(o => `<tr data-k="${esc(kOp(o))}" ${casa(kOp(o), q) ? '' : 'hidden'}><td class="nowrap"><b>${esc(short(o.nome))}</b> <span class="muted small">${o.escala === '4x4' ? '4x4·' + esc(o.turma || '?') : 'ADM'}</span></td>${dias.map(d => cel(o, d)).join('')}</tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><header><h2>Frota</h2><p>${E().cad.frota.length} equipamentos</p>${isAdmin() || podeEditar() ? `<span class="r"><button class="btn" data-e="novoEq">${I.plus} Equipamento</button></span>` : ''}</header><div class="body"><div class="rchips">${E().cad.frota.map(f => `<span class="rchip"><b class="mono">${esc(f.id)}</b><span class="c">${esc(title(f.tipo))}</span>${isAdmin() ? `<button class="btn ghost danger mini-x" data-e="delEq" data-id="${esc(f.id)}" aria-label="Remover ${esc(f.id)}">✕</button>` : ''}</span>`).join('')}</div></div></div>`;
    return h;
  }
  function opForm(nome) {
    const o = nome ? E().cad.operadores.find(x => x.nome === nome) : { nome: '', funcao: E().config.funcoes[0] || '', escala: 'ADM', turma: '', fixo: true, situacao: 'TRABALHANDO', de: null, ate: null };
    formSheet(nome ? 'Operador' : 'Novo operador', nome ? esc(title(nome)) : '', `
      ${nome ? '' : '<label class="sel"><span>Nome completo</span><input class="in" id="foNome"></label>'}
      <div class="row2"><label class="sel"><span>Função</span><select class="in" id="foFun">${[...new Set([...E().config.funcoes, ...(o.funcao ? [o.funcao] : [])])].map(f => `<option ${f === o.funcao ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label><label class="sel"><span>Fixo?</span><select class="in" id="foFixo"><option value="1" ${o.fixo !== false ? 'selected' : ''}>Sim</option><option value="0" ${o.fixo === false ? 'selected' : ''}>Não</option></select></label></div>
      <div class="row2"><label class="sel"><span>Escala</span><select class="in" id="foEsc"><option ${o.escala !== '4x4' ? 'selected' : ''}>ADM</option><option ${o.escala === '4x4' ? 'selected' : ''}>4x4</option></select></label><label class="sel"><span>Turma (4x4)</span><select class="in" id="foTur"><option value="">—</option>${Object.keys(E().config.turmas || {}).map(t => `<option ${t === o.turma ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="sel"><span>Situação</span><select class="in" id="foSit">${E().config.situacoes.map(s => `<option ${s.sit === (o.situacao || 'TRABALHANDO') ? 'selected' : ''}>${esc(s.sit)}</option>`).join('')}</select></label>
      <div class="row2"><label class="sel"><span>De (vazio = hoje)</span><input class="in" type="date" id="foDe" value="${o.de || ''}"></label><label class="sel"><span>Até (vazio = sem data)</span><input class="in" type="date" id="foAte" value="${o.ate || ''}"></label></div>
      ${nome && isAdmin() ? `<button type="button" class="btn danger" data-del="1">Remover operador</button>` : ''}`, 'Salvar', async () => {
      const n = { ...o, funcao: $('foFun').value, fixo: $('foFixo').value === '1', escala: $('foEsc').value, turma: $('foTur').value, situacao: $('foSit').value, de: $('foDe').value || null, ate: $('foAte').value || null };
      if (n.situacao === 'TRABALHANDO') { n.de = null; n.ate = null; } else if (!n.de) n.de = TODAY;
      if (n.ate && n.de && n.ate < n.de) throw new Error('"Até" está antes de "De".');
      let lista = E().cad.operadores.slice();
      if (!nome) { n.nome = $('foNome').value.trim().toUpperCase(); if (!n.nome) throw new Error('Informe o nome.'); if (lista.some(x => x.nome === n.nome)) throw new Error('Já existe esse operador.'); lista.push(n); }
      else lista = lista.map(x => (x.nome === nome ? n : x));
      DB.eSalvarCad({ operadores: lista }); if (nome && n.funcao !== o.funcao && PES && isAdmin()) PES.syncFuncao(n, n.funcao); DB.log(`Operação: ${nome ? 'atualizou' : 'cadastrou'} ${short(n.nome)}${n.situacao !== 'TRABALHANDO' ? ' (' + n.situacao.toLowerCase() + ')' : ''}`); toast('Operador salvo');
    });
    const del = document.querySelector('#fSheet [data-del]');
    if (del) del.onclick = () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Confirmar remoção'; return; } DB.eSalvarCad({ operadores: E().cad.operadores.filter(x => x.nome !== nome) }); $('layer').innerHTML = ''; toast('Operador removido'); render(); };
  }

  /* ---------- inspeções ---------- */
  function vInsp() {
    const l = E().insp.filter(x => x.data.slice(0, 7) === U.inMes).sort((a, b) => (a.data < b.data ? 1 : -1));
    const pcx = v => (v == null ? '–' : pc(v));
    let h = `<div class="filters">${selMes('eInMes', U.inMes)}${podeEditar() ? `<button class="btn pri" data-e="novaInsp" style="align-self:flex-end">${I.plus} Inspeção</button>` : ''}</div>`;
    if (!l.length) return h + '<div class="card"><div class="empty">Nenhuma inspeção neste mês. As inspeções entram na nota de 5S e de segurança da classificação.</div></div>';
    h += `<div class="card"><div class="tw"><table><thead><tr><th>Data</th><th>Operador</th><th>Identificação</th><th class="r">5S</th><th class="r">Segurança</th><th>Não conformes</th><th>Inspetor</th><th></th></tr></thead><tbody>
      ${l.map(x => { const nc = [...ITENS_5S, ...ITENS_SEG].filter(([k]) => (x.itens || {})[k] === 'NC').map(([, n]) => n); return `<tr><td class="num">${dBR(x.data)}</td><td><b>${esc(short(x.op))}</b></td><td class="mono">${esc(x.eq || '')}</td><td class="r num">${pcx(x.p5s)}</td><td class="r num">${pcx(x.pseg)}</td><td class="small">${nc.length ? `<span class="pill bad">${nc.length}</span> ${esc(nc.join(', '))}` : '<span class="pill ok">Tudo conforme</span>'}</td><td class="small">${esc(title(x.inspetor || ''))}</td><td>${podeEditar() ? `<button class="btn ghost danger" data-e="delInsp" data-id="${x.id}" aria-label="Excluir inspeção">✕</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    return h;
  }
  function inspForm() {
    const itens = {}; [...ITENS_5S, ...ITENS_SEG].forEach(([k]) => { itens[k] = 'C'; });
    const linha = ([k, n]) => `<div class="chkrow"><span>${n}</span><div class="tri" data-k="${k}">${['C', 'NC', 'NA'].map(v => `<button type="button" data-v="${v}" aria-pressed="${v === 'C'}">${v === 'C' ? 'Conforme' : v === 'NC' ? 'Não conforme' : 'N/A'}</button>`).join('')}</div></div>`;
    formSheet('Nova inspeção', '', `
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="fiData" value="${TODAY}"></label><label class="sel"><span>Identificação</span><input class="in" id="fiEq" list="dlFrota3" autocomplete="off">${dl('dlFrota3', E().cad.frota.map(f => f.id))}</label></div>
      <div class="sel"><span>Operador</span>${campoBusca('fiOp', '', opcoesOp(() => $('fiData') && $('fiData').value), { placeholder: 'Digite o nome' })}</div>
      <p class="lbl m0">5S no equipamento</p>${ITENS_5S.map(linha).join('')}
      <p class="lbl m0">Segurança</p>${ITENS_SEG.map(linha).join('')}
      <div class="row2"><label class="sel"><span>Inspetor</span><input class="in" id="fiInsp" value="${esc((ME().nome || '').toUpperCase())}"></label><label class="sel"><span>Observações</span><input class="in" id="fiObs"></label></div>`, 'Salvar inspeção', async () => {
      const n = { data: $('fiData').value, mes: $('fiData').value.slice(0, 7), eq: $('fiEq').value.trim().toUpperCase(), op: $('fiOp').value, itens, inspetor: $('fiInsp').value.trim(), obs: $('fiObs').value.trim() };
      if (!n.data || !n.op) throw new Error('Informe data e operador.');
      n.p5s = conformidade(itens, ITENS_5S); n.pseg = conformidade(itens, ITENS_SEG);
      DB.eAdd('insp', n); DB.log(`Operação: inspeção de ${short(n.op)} (5S ${pc(n.p5s || 0)}, segurança ${pc(n.pseg || 0)})`); toast('Inspeção salva');
    });
    document.querySelectorAll('#fSheet .tri').forEach(tr => { tr.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; itens[tr.dataset.k] = b.dataset.v; tr.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }; });
  }

  /* ---------- avaliação ---------- */
  function vAval() {
    const C = calc(); const m = U.avMes; const av = E().aval[m] || {};
    const { ops } = C.mes(m, E().lanc, E().par, E().insp, av, TODAY);
    const l = ops.filter(x => x.ranked || x.aloc > 0 || av[x.o.nome]).sort((a, b) => a.o.nome.localeCompare(b.o.nome));
    const ed = podeEditar();
    const nota = (op, k, max) => `<select class="in nsel" data-av="${esc(op)}|${k}" ${ed ? '' : 'disabled'}><option value="">–</option>${Array.from({ length: max }, (_, i) => i + 1).map(v => `<option ${+((av[op] || {})[k]) === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    // faltas e atestados vazios usam o que está lançado na Frequência / Efetivo diário (aparece como sugestão no campo)
    const auto = (x, k) => (k === 'faltas' ? x.faltas : k === 'atest' ? x.atest : '');
    const num = (op, k, x) => `<input class="in numin sm" type="number" min="0" inputmode="numeric" data-av="${esc(op)}|${k}" value="${(av[op] || {})[k] ?? ''}" ${x && auto(x, k) ? `placeholder="${auto(x, k)}" title="Da Frequência: ${auto(x, k)}"` : ''} ${ed ? '' : 'disabled'} aria-label="${k}">`;
    let h = `<div class="filters">${selMes('eAvMes', m)}<span class="muted small" style="align-self:flex-end">Notas de 1 a 5. 5S e Segurança só contam se o operador não tiver inspeção no mês. Vazio = nota padrão ${E().config.pesos.notaPadrao}.</span></div>`;
    if (!mesesCarregados().has(m)) return h + '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
    // Celular: um cartão por operador, com os campos grandes
    if (matchMedia('(max-width:860px)').matches) {
      return h + `<div class="mlist">${l.map(x => `<div class="mcard avm"><div class="row-between"><div><b class="t">${esc(short(x.o.nome))}</b><div class="muted small">${x.aloc} alocações${x.ninsp ? ' · ' + x.ninsp + ' inspeções' : ''}</div></div><div class="avnota"><b>${x.ranked ? h1(x.nota) : '–'}</b>${x.classe ? `<small>${x.classe.toLowerCase()}</small>` : ''}</div></div>
        <div class="avg"><label>Proatividade${nota(x.o.nome, 'proat', 5)}</label><label>5S${nota(x.o.nome, 's5', 5)}</label><label>Segurança${nota(x.o.nome, 'seg', 5)}</label><label>Faltas${num(x.o.nome, 'faltas', x)}</label><label>Atrasos${num(x.o.nome, 'atrasos', x)}</label><label>Atestados${num(x.o.nome, 'atest', x)}</label></div>
        <input class="in" data-av="${esc(x.o.nome)}|obs" value="${esc((av[x.o.nome] || {}).obs || '')}" placeholder="Observações" ${ed ? '' : 'disabled'} aria-label="Observações"></div>`).join('') || '<div class="card"><div class="empty">Nenhum operador com alocação no mês.</div></div>'}</div>`;
    }
    h += `<div class="card"><div class="tw"><table><thead><tr><th>Operador</th><th class="c">Proatividade</th><th class="c">5S</th><th class="c">Segurança</th><th class="c">Faltas</th><th class="c">Atrasos</th><th class="c">Atestados</th><th>Observações</th><th class="r">Nota</th></tr></thead><tbody>
      ${l.map(x => `<tr><td><b>${esc(short(x.o.nome))}</b><div class="muted small">${x.aloc} alocações${x.ninsp ? ' · ' + x.ninsp + ' inspeções' : ''}</div></td><td class="c">${nota(x.o.nome, 'proat', 5)}</td><td class="c">${nota(x.o.nome, 's5', 5)}</td><td class="c">${nota(x.o.nome, 'seg', 5)}</td><td class="c">${num(x.o.nome, 'faltas', x)}</td><td class="c">${num(x.o.nome, 'atrasos', x)}</td><td class="c">${num(x.o.nome, 'atest', x)}</td><td><input class="in" data-av="${esc(x.o.nome)}|obs" value="${esc((av[x.o.nome] || {}).obs || '')}" ${ed ? '' : 'disabled'} aria-label="Observações"></td><td class="r num"><b>${x.ranked ? h1(x.nota) : '–'}</b>${x.classe ? `<div class="small muted">${x.classe.toLowerCase()}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum operador com alocação no mês.</td></tr>'}
      </tbody></table></div></div>`;
    return h;
  }

  /* ---------- análises ---------- */
  function vAnal() {
    if (!U.hist) { if (!U.histLoading) { U.histLoading = true; DB.eCarregarTudo().then(r => { U.hist = r; U.histLoading = false; render(); }).catch(err => { U.histLoading = false; toast('Erro: ' + (err.message || err)); }); } return '<div class="card"><div class="empty">Carregando o histórico…</div></div>'; }
    const C = calc(); const { lanc, par, insp } = U.hist;
    const meses = [...new Set(lanc.map(l => l.data.slice(0, 7)))].sort();
    const rows = meses.map(m => ({ m, k: C.mes(m, lanc, par, insp, E().aval[m] || {}, TODAY).k }));
    const al = C.alertas(lanc, par, TODAY);
    const porTipo = {}; al.forEach(a => { const kk = a.aba + '|' + a.tipo; porTipo[kk] = (porTipo[kk] || 0) + 1; });
    let h = `<div class="card"><header><h2>Evolução mensal</h2><p>Só aparecem os meses com lançamentos</p><span class="r"><button class="btn" data-e="recarregar">Atualizar</button></span></header><div class="tw"><table><thead><tr><th>Mês</th><th class="r">Alocações</th><th class="r">H. operadas</th><th class="r">Falhas equip.</th><th class="r">H. paradas</th><th class="r">Disponib.</th><th class="r">MTTR</th><th class="r">MTBF</th><th class="r">Efetividade</th><th class="r">H. extras</th><th class="r">Paradas</th></tr></thead><tbody>
      ${rows.map(({ m, k }) => `<tr><td><b>${mesNome(m)}</b></td><td class="r num">${k.aloc}</td><td class="r num">${h1(k.hoper)}</td><td class="r num">${k.parEq}</td><td class="r num">${h1(k.hParEq)}</td><td class="r num">${pc(k.disp)}</td><td class="r num">${h2(k.mttr)}</td><td class="r num">${h1(k.mtbf)}</td><td class="r num">${pc(k.efet)}</td><td class="r num">${hhmm(k.heH)}</td><td class="r num">${k.nPar}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="grid2"><div class="card"><header><h2>Consistência dos lançamentos</h2><p>${al.length} alerta(s)</p></header><div class="body">${Object.keys(porTipo).length ? `<div class="plist">${Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([kk, n]) => `<div class="pitem"><div class="minw"><div class="t">${esc(kk.split('|')[1])}</div><div class="l">${esc(kk.split('|')[0])}</div></div><span class="pill warn num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Nenhum alerta. Lançamentos consistentes.</div>'}</div></div>
      <div class="card"><header><h2>Alertas para corrigir</h2><p>Os 25 mais recentes</p></header><div class="body">${al.length ? `<div class="plist">${al.sort((a, b) => (a.ref.data < b.ref.data ? 1 : -1)).slice(0, 25).map(a => `<div class="pitem"><div class="minw"><div class="t">${esc(a.tipo)}</div><div class="l">${a.aba} · ${dBR(a.ref.data)} · <span class="mono">${esc(a.ref.eq || '')}</span> · ${esc(short(a.ref.op))}</div></div><button class="btn" data-e="${a.aba === 'Paradas' ? 'editPar' : 'irDia'}" data-id="${a.ref.id}" data-dia="${a.ref.data}">Abrir</button></div>`).join('')}</div>` : '<div class="empty">Nada para corrigir.</div>'}</div></div></div>`;
    return h;
  }

  /* ---------- configurações ---------- */
  function vConfig() {
    const c = E().config; const t = c.turno, m = c.metas, p = c.pesos, f = c.faixas;
    const inp = (grp, k, v, type = 'number', step = 'any') => `<input class="in cfgin" type="${type}" step="${step}" data-cfg="${grp}|${k}" value="${v ?? ''}">`;
    const row = (lbl, html) => `<label class="cfgrow"><span>${lbl}</span>${html}</label>`;
    return `<div class="grid2"><div class="card"><header><h2>Turnos</h2></header><div class="body cfg">
        ${row('ADM · início', inp('turno', 'admIni', t.admIni, 'time'))}${row('ADM · fim (seg a qui)', inp('turno', 'admFim', t.admFim, 'time'))}${row('ADM · fim na sexta', inp('turno', 'admFimSex', t.admFimSex, 'time'))}
        ${row('Almoço · início', inp('turno', 'almIni', t.almIni, 'time'))}${row('Almoço · fim', inp('turno', 'almFim', t.almFim, 'time'))}
        ${row('4x4 · início', inp('turno', 'x4Ini', t.x4Ini, 'time'))}${row('4x4 · fim', inp('turno', 'x4Fim', t.x4Fim, 'time'))}${row('4x4 · intervalo (h, turno > 6 h)', inp('turno', 'x4Int', t.x4Int))}
        <p class="lbl m0">Turmas 4x4</p><p class="muted small m0">As turmas agora ficam em <b>Configurações › Escalas e turnos</b>, valendo para todos os módulos. <button class="btn ghost link" data-go="cfescala">Abrir</button></p></div></div>
      <div class="card"><header><h2>Metas do painel</h2></header><div class="body cfg">
        ${row('Disponibilidade física ≥', inp('metas', 'disp', m.disp, 'number', '0.01'))}${row('Efetividade ≥', inp('metas', 'efet', m.efet, 'number', '0.01'))}${row('Aproveitamento de horas ≥', inp('metas', 'aprov', m.aprov, 'number', '0.01'))}
        ${row('MTTR ≤ (h)', inp('metas', 'mttr', m.mttr))}${row('MTBF ≥ (h)', inp('metas', 'mtbf', m.mtbf))}${row('Paradas sem liberação ≤', inp('metas', 'semlib', m.semlib))}${row('Paradas por causa do operador ≤', inp('metas', 'parop', m.parop))}
        ${row('Nota média da equipe ≥', inp('metas', 'nota', m.nota))}${row('Tolerância da faixa amarela', inp('metas', 'tol', m.tol, 'number', '0.01'))}${row('Falhas no mês para reincidente', inp('metas', 'reinFalhas', m.reinFalhas))}${row('Repetições da mesma causa', inp('metas', 'reinRep', m.reinRep))}</div></div></div>
      <div class="grid2"><div class="card"><header><h2>Pesos da classificação</h2><p>Os 7 critérios devem somar 1</p></header><div class="body cfg">
        ${[['prod', 'Produtividade (automática)'], ['proat', 'Proatividade'], ['seg', 'Segurança'], ['s5', '5S no equipamento'], ['faltas', 'Faltas'], ['atrasos', 'Atrasos'], ['atest', 'Atestados']].map(([k, n]) => row(n, inp('pesos', k, p[k], 'number', '0.01'))).join('')}
        <p class="small m0">Soma atual: <b>${(['prod', 'proat', 'seg', 's5', 'faltas', 'atrasos', 'atest'].reduce((s, k) => s + (+p[k] || 0), 0)).toFixed(2)}</b></p>
        ${row('Pontos perdidos por falta', inp('pesos', 'ptsFalta', p.ptsFalta))}${row('Pontos perdidos por atraso', inp('pesos', 'ptsAtraso', p.ptsAtraso))}${row('Pontos perdidos por atestado', inp('pesos', 'ptsAtest', p.ptsAtest))}${row('Nota quando não avaliado (1–5)', inp('pesos', 'notaPadrao', p.notaPadrao))}
        ${row('Peso da disponibilidade do operador', inp('pesos', 'pDisp', p.pDisp, 'number', '0.01'))}${row('Peso da cobertura de escala', inp('pesos', 'pCob', p.pCob, 'number', '0.01'))}
        ${row('Quem entra na classificação', `<select class="in cfgin" data-cfg="pesos|quem"><option ${p.quem === 'SOMENTE FIXOS' ? 'selected' : ''}>SOMENTE FIXOS</option><option ${p.quem === 'TODOS' ? 'selected' : ''}>TODOS</option></select>`)}
        ${row('Excelente a partir de', inp('faixas', 'exc', f.exc))}${row('Bom a partir de', inp('faixas', 'bom', f.bom))}${row('Regular a partir de', inp('faixas', 'reg', f.reg))}</div></div>
      <div class="card"><header><h2>Causas de parada</h2><p>Equipamento reduz a disponibilidade física; Operador reduz a nota do operador</p></header><div class="body"><div class="plist">${c.causas.map((x, i) => `<div class="pitem"><span>${esc(x.causa)}</span><div class="row-gap"><select class="in" data-causa="${i}">${['EQUIPAMENTO', 'OPERADOR', 'OPERACIONAL'].map(r => `<option ${r === x.resp ? 'selected' : ''}>${r}</option>`).join('')}</select><button class="btn ghost danger" data-e="delCausa" data-i="${i}" aria-label="Remover causa">✕</button></div></div>`).join('')}</div>
        <form id="fCausa" class="row-gap" style="margin-top:10px"><input class="in" id="ncCausa" placeholder="Nova causa" style="flex:1"><select class="in" id="ncResp"><option>EQUIPAMENTO</option><option>OPERADOR</option><option>OPERACIONAL</option></select><button class="btn" type="submit">${I.plus}</button></form></div></div></div>
      <div class="card"><header><h2>Feriados e dias sem operação</h2></header><div class="body"><div class="plist">${c.feriados.slice().sort((a, b) => (a.data < b.data ? -1 : 1)).map(x => `<div class="pitem"><span><b class="num">${dBR(x.data)}</b> · ${esc(x.desc)} ${x.semOp ? '' : '<span class="pill neu">ponto facultativo</span>'}</span><button class="btn ghost danger" data-e="delFer" data-data="${x.data}" data-desc="${esc(x.desc)}" aria-label="Remover feriado">✕</button></div>`).join('')}</div>
        <form id="fFer" class="row-gap" style="margin-top:10px"><input class="in" type="date" id="nfData"><input class="in" id="nfDesc" placeholder="Descrição" style="flex:1"><label class="chkl"><input type="checkbox" id="nfSem" checked> Sem operação</label><button class="btn" type="submit">${I.plus}</button></form></div></div>`;
  }

  function vImportar() {
    if (!isAdmin()) return '<div class="card"><div class="empty">O administrador ainda não importou a planilha de controle de equipamentos.</div></div>';
    return `<div class="card"><header><h2>Importar a planilha de equipamentos</h2><p>Operadores, frota, turnos, causas, metas, pesos, feriados e os lançamentos e paradas já registrados</p></header><div class="body stackcol"><button class="btn pri" data-e="importar" style="align-self:flex-start" ${UI.busy ? 'disabled' : ''}>${UI.busy ? 'Importando…' : 'Importar dados da planilha'}</button></div></div>`;
  }

  /* ---------- eventos ---------- */
  const acharL = id => E().lanc.find(x => x.id === id) || (U.hist && U.hist.lanc.find(x => x.id === id));
  const acharP = id => E().par.find(x => x.id === id) || (U.hist && U.hist.par.find(x => x.id === id));
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-e],[data-epf],[data-epdia],[data-eof]'); if (!t || t.closest('#layer')) return;
    if (t.dataset.eof) { U.of = t.dataset.eof; return render(); }
    if (t.dataset.epdia !== undefined) { U.pdia = t.dataset.epdia; return render(); }
    const d = t.dataset;
    if (d.epf) { U.pf = d.epf; return render(); }
    switch (d.e) {
      case 'diaAnt': U.dia = add(U.dia, -1); render(); break;
      case 'diaProx': U.dia = add(U.dia, 1); render(); break;
      case 'hoje': U.dia = TODAY; render(); break;
      case 'irDia': UI.view = 'elanc'; U.aba = 'lanc'; U.dia = d.dia; render(); scrollTo(0, 0); break;
      case 'aba': U.aba = d.v; render(); break;
      case 'novoLanc': lancForm(null); break;
      case 'expLanc': exportarLanc(U.dia.slice(0, 7)); break;
      case 'expPar': exportarPar(); break;
      case 'editLanc': lancForm(acharL(d.id)); break;
      case 'copiar': copiarDiaAnterior(); break;
      case 'lancOp': lancForm(null, { op: d.op }); break;
      case 'parDe': parForm(null, acharL(d.id)); break;
      case 'novaPar': parForm(null); break;
      case 'editPar': { const p = acharP(d.id); if (p) parForm(p); break; }
      case 'liberar': {
        const p = acharP(d.id); if (!p) break;
        const L2 = p.lancSub ? E().lanc.find(x => x.id === p.lancSub) : null; const volta = !!(L2 && !L2.trocaPara && p.op);
        formSheet('Liberar equipamento', `<span class="mono">${esc(p.eq)}</span> · parado desde ${p.ini} de ${dBR(p.data)}`, `<label class="sel"><span>Hora da liberação</span><div class="row-gap nowrap"><input class="in grow" type="time" id="lbFim" value="${p.data === TODAY ? agoraHM() : ''}"><button type="button" class="btn" id="lbAgora">Agora</button></div></label>${p.data !== TODAY ? '<p class="small muted m0">A parada é de outro dia: informe a hora em que o equipamento voltou a operar naquele dia.</p>' : ''}
          ${volta ? `<label class="switch"><input type="checkbox" id="lbVolta" checked><span><b>Devolver ${esc(short(p.op))} ao ${esc(p.eq)}</b><br><small class="muted">Encerra o reserva ${esc(L2.eq)} na hora da liberação e lança ${esc(short(p.op))} de volta no ${esc(p.eq)}.</small></span></label>` : ''}`, 'Liberar', async () => {
          const f = $('lbFim').value; if (!f) throw new Error('Informe a hora.');
          DB.eUpd('par', p.id, { fim: f });
          if (volta && $('lbVolta').checked) {
            DB.eUpd('lanc', L2.id, { fim: f, trocaPara: p.eq });
            DB.eAdd('lanc', { data: L2.data, mes: L2.data.slice(0, 7), eq: p.eq, tipo: (calc().frotaMap.get(p.eq) || {}).tipo || '', op: p.op, area: L2.area, status: 'EM OPERAÇÃO', ini: f, fim: L2.fim || null, he: 0, sub: '', obs: `Voltou do reserva ${L2.eq}`, voltaDe: L2.eq });
          }
          DB.log(`Operação: liberou ${p.eq} às ${f}`); toast(`${p.eq} liberado`);
        });
        const ag = $('lbAgora'); if (ag) ag.onclick = () => { $('lbFim').value = agoraHM(); };
        break;
      }
      case 'trocar': { const l = acharL(d.id); if (l) substForm({ lanc: l }); break; }
      case 'substPar': { const p = acharP(d.id); if (p) substForm({ par: p }); break; }
      case 'novoOp': opForm(null); break;
      case 'editOp': opForm(d.nome); break;
      case 'novoEq': formSheet('Novo equipamento', '', `<div class="row2"><label class="sel"><span>Identificação</span><input class="in" id="neId" placeholder="DKMP25013"></label><label class="sel"><span>Tipo</span><select class="in" id="neTipo">${E().config.tiposEquip.map(x => `<option>${esc(x)}</option>`).join('')}</select></label></div>`, 'Adicionar', async () => {
        const id = $('neId').value.trim().toUpperCase(); if (!id) throw new Error('Informe a identificação.'); if (E().cad.frota.some(f => f.id === id)) throw new Error('Já cadastrado.');
        DB.eSalvarCad({ frota: [...E().cad.frota, { id, tipo: $('neTipo').value }] }); toast(id + ' adicionado');
      }); break;
      case 'delEq': DB.eSalvarCad({ frota: E().cad.frota.filter(f => f.id !== d.id) }); toast(d.id + ' removido'); break;
      case 'novaInsp': inspForm(); break;
      case 'delInsp': if (t.dataset.ok !== '1') { t.dataset.ok = '1'; t.textContent = 'Excluir?'; return; } DB.eDel('insp', d.id); toast('Inspeção excluída'); break;
      case 'recarregar': U.hist = null; render(); break;
      case 'delCausa': DB.eSalvarConfig({ causas: E().config.causas.filter((_, i) => i !== +d.i) }); break;
      case 'delFer': DB.eSalvarConfig({ feriados: E().config.feriados.filter(f => !(f.data === d.data && f.desc === d.desc)) }); break;
      case 'importar': {
        UI.busy = true; render();
        try { const s = await DB.seed('seed-equip.json'); await DB.eImportar(s); DB.log('Operação: importou a planilha de controle de equipamentos'); toast('Planilha importada'); }
        catch (err) { toast('Erro ao importar: ' + (err.message || err)); }
        UI.busy = false; render(); break;
      }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-e="editOp"]')) e.target.click(); });
  // Buscas das telas: filtram na hora, sem redesenhar (o cursor não sai do campo).
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'eLQ') { U.lq = t.value; filtrarLista($('eLList'), t.value, $('eLN')); }
    else if (t.id === 'ePQ') { U.pq = t.value; filtrarLista($('ePList'), t.value, $('ePN')); }
    else if (t.id === 'eOQ') { U.oq = t.value; filtrarLista($('eOList'), t.value, $('eON')); filtrarLista($('eOEsc'), t.value); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'eMes') { U.mes = t.value; U.pdia = ''; render(); }
    else if (t.id === 'eDia') { if (t.value) { U.dia = t.value; render(); } }
    else if (t.id === 'eAvMes') { U.avMes = t.value; render(); }
    else if (t.id === 'eInMes') { U.inMes = t.value; render(); }
    else if (t.dataset.est) { DB.eUpd('lanc', t.dataset.est, { status: t.value }); toast('Status atualizado'); }
    else if (t.dataset.av) {
      const [op, k] = t.dataset.av.split('|'); let v = t.value;
      if (k !== 'obs') v = v === '' ? null : +v;
      DB.eSalvarAval(U.avMes, op, { [k]: v }); toast('Avaliação salva');
    } else if (t.dataset.cfg) {
      const [g, k] = t.dataset.cfg.split('|'); const c = E().config; let v = t.value;
      if (t.type === 'number') v = v === '' ? null : +v;
      DB.eSalvarConfig({ [g]: { ...c[g], [k]: v } }); toast('Configuração salva');
    } else if (t.dataset.causa) {
      const l = E().config.causas.map((x, i) => (i === +t.dataset.causa ? { ...x, resp: t.value } : x)); DB.eSalvarConfig({ causas: l }); toast('Causa atualizada');
    }
  });
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f.id === 'fCausa') { e.preventDefault(); const c = $('ncCausa').value.trim().toUpperCase(); if (!c) return; DB.eSalvarConfig({ causas: [...E().config.causas, { causa: c, resp: $('ncResp').value }] }); toast('Causa adicionada'); }
    if (f.id === 'fFer') { e.preventDefault(); const dt = $('nfData').value, ds = $('nfDesc').value.trim(); if (!dt || !ds) { toast('Informe data e descrição'); return; } DB.eSalvarConfig({ feriados: [...E().config.feriados, { data: dt, desc: ds, semOp: $('nfSem').checked }] }); toast('Feriado adicionado'); }
  });

  return {
    render(view) {
      if (!E().loaded) return '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
      if (!E().config) return vImportar();
      DB.eWatch([U.mes, addMonth(U.mes, -1), U.dia.slice(0, 7), addMonth(U.dia.slice(0, 7), -1), U.avMes, U.inMes, TODAY.slice(0, 7)]);
      return ({ epainel: vPainel, elanc: vLancPar, eequipe: vEquipe, einsp: vInsp, eaval: vAval, eanal: vAnal, econfig: vConfig }[view] || vPainel)();
    },
    resumoSemana,
    badge: () => (E().loaded && E().config ? E().par.filter(p => !p.fim).length : 0)
  };
}
