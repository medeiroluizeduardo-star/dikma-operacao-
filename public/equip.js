// Dikma Operação — módulo OPERAÇÃO: controle de equipamentos e operadores (planilha CONTROLE DE EQUIPAMENTOS - COQUERIA).
// Telas: Painel, Lançamentos, Paradas, Equipe (operadores, frota e escala), Inspeções, Avaliação, Análises e Configurações.
import { add, pad, today, MESES_L, addMonth, DAYS } from './cal.js';
import { criarCalc, fimMes, ITENS_5S, ITENS_SEG, conformidade, STATUS_HE } from './eqcalc.js';

export const VIEWS_E = [
  { id: 'epainel', nome: 'Painel', ic: 'painel', grp: 'Equipamentos', mod: 'eq' },
  { id: 'elanc', nome: 'Lançamentos', ic: 'apontar', grp: 'Equipamentos', mod: 'eq' },
  { id: 'epar', nome: 'Paradas', ic: 'pend', grp: 'Equipamentos', mod: 'eq' },
  { id: 'eequipe', nome: 'Equipe e frota', ic: 'escala', grp: 'Equipamentos', mod: 'eq' },
  { id: 'einsp', nome: 'Inspeções 5S e segurança', ic: 'plano', grp: 'Avaliação', mod: 'eq' },
  { id: 'eaval', nome: 'Avaliação mensal', ic: 'users', grp: 'Avaliação', mod: 'eq' },
  { id: 'eanal', nome: 'Análises', ic: 'prog', grp: 'Avaliação', mod: 'eq' },
  { id: 'econfig', nome: 'Configurações', ic: 'config', grp: 'Administração', mod: 'eq', admin: true }
];
export const SUB_E = {
  epainel: 'Produtividade da operação de equipamentos', elanc: 'Alocações do dia: operador, equipamento e horário', epar: 'Paradas, causas e liberação',
  eequipe: 'Operadores, situação, frota e escala do mês', einsp: 'Checklist de 5S no equipamento e segurança', eaval: 'Notas do mês por operador',
  eanal: 'Evolução mensal e qualidade dos lançamentos', econfig: 'Turnos, metas, pesos, causas e feriados'
};

export function criarEquip(X) {
  const { DB, esc, title, I, sheet, formSheet, toast, showErr, render, isAdmin, UI, PES } = X;
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
  const calc = () => { if (!CALC || CALCv !== DB.cache.eVersao) { CALC = criarCalc(E().config, E().cad); CALCv = DB.cache.eVersao; } return CALC; };
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

  /* ---------- lançamentos ---------- */
  const STATUS_CLS = { 'OPERAÇÃO FINALIZADA': 'ok', 'EM OPERAÇÃO': 'neu', 'HORA EXTRA': 'ext', 'HE NOTURNA': 'ext', 'FORA DE OPERAÇÃO': 'bad', 'EM MANUTENÇÃO': 'warn' };
  function vLanc() {
    const C = calc(); const d = U.dia;
    const all = E().lanc; const al = C.alertas(all.filter(l => l.data === d), E().par.filter(p => p.data === d), TODAY);
    const alMap = new Map(); al.filter(a => a.aba === 'Lançamentos').forEach(a => alMap.set(a.ref.id, a.tipo));
    const linhas = all.filter(l => l.data === d).map(l => { const jan = C.janela(l); const hp = Math.min(jan, E().par.filter(p => p.data === d && p.eq === l.eq && p.op === l.op).reduce((s, p) => s + C.duracao(p), 0)); return { ...l, jan, hpar: hp, hoper: Math.max(0, jan - hp) }; }).sort((a, b) => a.eq.localeCompare(b.eq));
    const pd = E().par.filter(p => p.data === d).length;
    const dw = DAYS[(new Date(d + 'T12:00').getDay() + 6) % 7];
    let h = `<div class="filters"><div class="daynav"><button class="btn" data-e="diaAnt" aria-label="Dia anterior">◀</button><label class="sel"><span>${dw}</span><input class="in" type="date" id="eDia" value="${d}"></label><button class="btn" data-e="diaProx" aria-label="Próximo dia">▶</button>${d !== TODAY ? '<button class="btn" data-e="hoje">Hoje</button>' : ''}</div>
      ${podeEditar() ? `<button class="btn pri" data-e="novoLanc" style="align-self:flex-end">${I.plus} Lançamento</button>${!linhas.length ? '<button class="btn" data-e="copiar" style="align-self:flex-end">Copiar do dia anterior</button>' : ''}` : ''}</div>
      <div class="mini"><div><b class="num">${linhas.length}</b><span>Alocações</span></div><div><b class="num">${h1(linhas.reduce((s, l) => s + l.hoper, 0))}</b><span>Horas operadas</span></div><div><b class="num">${h1(linhas.reduce((s, l) => s + l.hpar, 0))}</b><span>Horas paradas</span></div><div><b class="num">${pd}</b><span>Paradas no dia</span></div></div>`;
    if (!mesesCarregados().has(d.slice(0, 7))) return h + '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
    if (!linhas.length) return h + `<div class="card"><div class="empty">Nenhum lançamento em ${dBR(d)}.${podeEditar() ? ' Use "Copiar do dia anterior" para repetir as alocações do último dia lançado.' : ''}</div></div>`;
    if (matchMedia('(max-width:860px)').matches) {
      return h + `<div class="mlist">${linhas.map(l => `<div class="mcard"><div class="row-between"><div><b class="mono">${esc(l.eq)}</b> <span class="muted small">${esc(l.tipo)}</span></div>${podeEditar() ? `<button class="btn ghost" data-e="editLanc" data-id="${l.id}" aria-label="Editar">✎</button>` : ''}</div>
        <div><b>${esc(short(l.op))}</b>${C.escalaDe(l.op) === '4x4' ? ' <span class="tag">4x4</span>' : ''} · <span class="small">${esc(title(l.area))}</span>${l.sub ? `<div class="muted small">substituiu ${esc(short(l.sub))}</div>` : ''}</div>
        ${podeEditar() ? `<select class="in sts ${STATUS_CLS[l.status] || ''}" data-est="${l.id}" aria-label="Status">${E().config.status.map(x => `<option ${x === l.status ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<span class="pill ${STATUS_CLS[l.status] || 'neu'}">${esc(l.status)}</span>`}
        <div class="row-between small"><span class="num">${l.ini || 'turno'} – ${l.fim || 'turno'} · janela ${h2(l.jan)} h${l.hpar ? ' · paradas ' + h2(l.hpar) + ' h' : ''}</span><b class="num">${h2(l.hoper)} h</b></div>
        ${l.obs ? `<div class="muted small">${esc(l.obs)}</div>` : ''}${alMap.has(l.id) ? `<div class="pill warn">${esc(alMap.get(l.id))}</div>` : ''}
        ${podeEditar() ? `<button class="btn" data-e="parDe" data-id="${l.id}">${I.pend} Registrar parada</button>` : ''}</div>`).join('')}</div>`;
    }
    h += `<div class="card"><div class="tw"><table class="lanc"><thead><tr><th>Identificação</th><th>Operador</th><th>Área</th><th>Status</th><th class="c">Horário</th><th class="r">Janela</th><th class="r">Paradas</th><th class="r">Operadas</th><th>Observação</th><th></th></tr></thead><tbody>
      ${linhas.map(l => `<tr><td><b class="mono">${esc(l.eq)}</b><div class="muted small">${esc(l.tipo)}</div></td><td>${esc(short(l.op))}${C.escalaDe(l.op) === '4x4' ? ' <span class="tag">4x4</span>' : ''}${l.sub ? `<div class="muted small">substituiu ${esc(short(l.sub))}</div>` : ''}</td><td class="small">${esc(title(l.area))}</td>
        <td>${podeEditar() ? `<select class="in sts ${STATUS_CLS[l.status] || ''}" data-est="${l.id}" aria-label="Status">${E().config.status.map(s => `<option ${s === l.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : `<span class="pill ${STATUS_CLS[l.status] || 'neu'}">${esc(l.status)}</span>`}</td>
        <td class="c num small">${l.ini || '—'} – ${l.fim || '—'}${l.he ? `<div class="pill ext">HE ${hhmm(l.he)}</div>` : ''}</td><td class="r num">${h2(l.jan)}</td><td class="r num">${l.hpar ? h2(l.hpar) : ''}</td><td class="r num"><b>${h2(l.hoper)}</b></td>
        <td class="small obs">${esc(l.obs || '')}${alMap.has(l.id) ? `<div class="pill warn">${esc(alMap.get(l.id))}</div>` : ''}</td>
        <td class="nowrap">${podeEditar() ? `<button class="btn ghost" data-e="parDe" data-id="${l.id}" title="Registrar parada">${I.pend}</button><button class="btn ghost" data-e="editLanc" data-id="${l.id}" aria-label="Editar">✎</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    return h;
  }
  const dl = (id, arr) => `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  const selOp = (id, v, vazio) => `<select class="in" id="${id}">${vazio ? '<option value="">—</option>' : ''}${E().cad.operadores.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(o => `<option value="${esc(o.nome)}" ${o.nome === v ? 'selected' : ''}>${esc(title(o.nome))}${o.escala === '4x4' ? ' · 4x4 ' + o.turma : ''}</option>`).join('')}</select>`;
  function lancForm(l) {
    const novo = !l; l = l || { data: U.dia, eq: '', op: '', area: E().config.areas[0] || '', status: 'EM OPERAÇÃO', ini: '', fim: '', he: 0, sub: '', obs: '' };
    formSheet(novo ? 'Novo lançamento' : 'Editar lançamento', novo ? dBR(l.data) : `${dBR(l.data)} · ${esc(l.eq)}`, `
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="flData" value="${l.data}"></label><label class="sel"><span>Identificação (frota)</span><input class="in" id="flEq" list="dlFrota" value="${esc(l.eq)}" autocomplete="off" placeholder="DKMP25001">${dl('dlFrota', E().cad.frota.map(f => f.id))}</label></div>
      <label class="sel"><span>Operador</span>${selOp('flOp', l.op)}</label>
      <div class="row2"><label class="sel"><span>Área</span><select class="in" id="flArea">${E().config.areas.map(a => `<option ${a === l.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label><label class="sel"><span>Status</span><select class="in" id="flSt">${E().config.status.map(s => `<option ${s === l.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
      <div class="row2"><label class="sel"><span>Início (vazio = turno)</span><input class="in" type="time" id="flIni" value="${l.ini || ''}"></label><label class="sel"><span>Fim (vazio = turno)</span><input class="in" type="time" id="flFim" value="${l.fim || ''}"></label></div>
      <div class="row2"><label class="sel"><span>Horas extras (h)</span><input class="in" type="number" min="0" step="0.25" id="flHe" value="${l.he || ''}"></label><label class="sel"><span>Substituiu (opcional)</span>${selOp('flSub', l.sub, true)}</label></div>
      <label class="sel"><span>Observação</span><textarea class="in ta" id="flObs" rows="2">${esc(l.obs || '')}</textarea></label>
      ${novo ? '' : `<button type="button" class="btn danger" data-del="${l.id}">Excluir lançamento</button>`}`, 'Salvar', async () => {
      const eq = $('flEq').value.trim().toUpperCase(); const data = $('flData').value;
      if (!data || !eq) throw new Error('Informe a data e a identificação.');
      const n = { data, mes: data.slice(0, 7), eq, tipo: (calc().frotaMap.get(eq) || {}).tipo || '', op: $('flOp').value, area: $('flArea').value, status: $('flSt').value, ini: $('flIni').value || null, fim: $('flFim').value || null, he: +$('flHe').value || 0, sub: $('flSub').value || '', obs: $('flObs').value.trim() };
      if (novo) { DB.eAdd('lanc', n); DB.log(`Operação: lançou ${eq} · ${short(n.op)} em ${dBR(data)}`); } else { DB.eUpd('lanc', l.id, n); }
      toast(novo ? 'Lançamento salvo' : 'Lançamento atualizado');
    });
    const del = document.querySelector('#fSheet [data-del]');
    if (del) del.onclick = () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Confirmar exclusão'; return; } DB.eDel('lanc', l.id); $('layer').innerHTML = ''; toast('Lançamento excluído'); render(); };
    const eqi = $('flEq'), opi = $('flOp');
    if (novo && eqi) eqi.onchange = () => { const ult = E().lanc.filter(x => x.eq === eqi.value.trim().toUpperCase()).sort((a, b) => (a.data < b.data ? 1 : -1))[0]; if (ult) { opi.value = ult.op; $('flArea').value = ult.area; } };
  }
  function copiarDiaAnterior() {
    const d = U.dia; const ant = E().lanc.filter(l => l.data < d).map(l => l.data).sort().pop();
    if (!ant) { toast('Não há dia anterior com lançamentos'); return; }
    const base = E().lanc.filter(l => l.data === ant);
    const C = calc();
    const lista = base.filter(l => { const o = C.opMap.get(l.op); return !o || (!C.ausenteEm(o, d) && C.escalado(o, d)); });
    sheet('Copiar lançamentos', `${lista.length} alocações de ${dBR(ant)} para ${dBR(d)} (status "Em operação", horário do turno). Operadores ausentes ou de folga na escala ficam de fora.`, [{ t: `Copiar ${lista.length} alocações`, v: 'ok' }], () => {
      for (const l of lista) DB.eAdd('lanc', { data: d, mes: d.slice(0, 7), eq: l.eq, tipo: l.tipo, op: l.op, area: l.area, status: 'EM OPERAÇÃO', ini: null, fim: null, he: 0, sub: '', obs: '' });
      DB.log(`Operação: copiou ${lista.length} alocações de ${dBR(ant)} para ${dBR(d)}`); toast(`${lista.length} alocações criadas`);
    });
  }

  /* ---------- paradas ---------- */
  function vPar() {
    const C = calc();
    const ps = E().par.filter(p => p.data.slice(0, 7) === U.mes || (U.pf === 'aberta' && !p.fim)).map(p => ({ ...p, dur: C.duracao(p), resp: C.resp(p), sit: C.situacao(p) }));
    const al = new Map(C.alertas(E().lanc, E().par, TODAY).filter(a => a.aba === 'Paradas').map(a => [a.ref.id, a.tipo]));
    const F = { aberta: p => !p.fim, todas: () => true, EQUIPAMENTO: p => p.resp === 'EQUIPAMENTO', OPERADOR: p => p.resp === 'OPERADOR', OPERACIONAL: p => p.resp === 'OPERACIONAL' };
    const base = ps.filter(F[U.pf] || F.todas);
    if (U.pdia && U.pdia.slice(0, 7) !== U.mes) U.pdia = '';
    const l = base.filter(p => !U.pdia || p.data === U.pdia).sort((a, b) => (a.data + (a.ini || '') > b.data + (b.ini || '') ? -1 : 1));
    const n = k => ps.filter(F[k]).length;
    // Faixa de dias do mês: quantas paradas (no filtro escolhido) e horas paradas em cada dia.
    const porDia = new Map(); for (const p of base) if (p.data.slice(0, 7) === U.mes) { const x = porDia.get(p.data) || { n: 0, h: 0 }; x.n++; x.h += p.dur || 0; porDia.set(p.data, x); }
    const fim = fimMes(U.mes), dias = []; for (let d = U.mes + '-01'; d <= fim; d = add(d, 1)) dias.push(d);
    const semana = d => DAYS[(new Date(d + 'T12:00').getDay() + 6) % 7];
    const faixa = `<div class="dstrip" role="toolbar" aria-label="Filtrar por dia"><button class="dchip todos" data-epdia="" aria-pressed="${!U.pdia}"><small>Mês</small><b>Todos</b><i>${base.length}</i></button>${dias.map(d => { const x = porDia.get(d); return `<button class="dchip${d === TODAY ? ' hoje' : ''}${x ? '' : ' vazio'}${d > TODAY ? ' futuro' : ''}" data-epdia="${d}" aria-pressed="${U.pdia === d}" title="${dBR(d)}${x ? ` · ${x.n} parada(s) · ${h2(x.h)} h` : ' · sem paradas'}"><small>${semana(d)}</small><b>${d.slice(8)}</b><i>${x ? x.n : ''}</i></button>`; }).join('')}</div>`;
    setTimeout(() => { const st = document.querySelector('.dstrip'); if (!st) return; const alvo = st.querySelector('[aria-pressed="true"]:not(.todos)') || st.querySelector('.hoje'); if (alvo) st.scrollLeft = Math.max(0, alvo.offsetLeft - st.clientWidth / 2 + alvo.offsetWidth / 2); }, 0);
    let h = `<div class="filters">${selMes('eMes', U.mes)}${podeEditar() ? `<button class="btn pri" data-e="novaPar" style="align-self:flex-end">${I.plus} Parada</button>` : ''}</div>
      <div class="rchips">${[['aberta', 'Sem liberação'], ['todas', 'Todas do mês'], ['EQUIPAMENTO', 'Equipamento'], ['OPERADOR', 'Operador'], ['OPERACIONAL', 'Operacional']].map(([k, t]) => `<button class="rchip" data-epf="${k}" aria-pressed="${U.pf === k}">${t}<span class="c num">${n(k)}</span></button>`).join('')}</div>${faixa}`;
    if (!l.length) return h + `<div class="card"><div class="empty">${U.pdia ? `Nenhuma parada em ${dBR(U.pdia)} com esse filtro.` : 'Nenhuma parada com esse filtro.'}</div></div>`;
    // Agrupa por dia: cabeçalho com o total do dia.
    let diaAnt = '';
    const cab = p => { if (p.data === diaAnt) return ''; diaAnt = p.data; const doDia = l.filter(x => x.data === p.data); return `<div class="pgrp"><b>${semana(p.data)} ${dBR(p.data).slice(0, 5)}</b><span>${doDia.length} parada${doDia.length > 1 ? 's' : ''} · ${h2(doDia.reduce((t, x) => t + (x.dur || 0), 0))} h${doDia.some(x => !x.fim) ? ` · <em>${doDia.filter(x => !x.fim).length} sem liberação</em>` : ''}</span></div>`; };
    h += `<div class="card"><div class="body"><div class="plist">${l.map(p => `${cab(p)}<div class="pitem"><div class="minw"><div class="t"><span class="mono">${esc(p.eq)}</span> · ${esc(p.causa || 'sem causa')} <span class="pill ${p.resp === 'EQUIPAMENTO' ? 'bad' : p.resp === 'OPERADOR' ? 'warn' : 'neu'}">${esc((p.resp || '—').toLowerCase())}</span></div>
      <div class="l">${dBR(p.data)} · ${p.ini || '—'} às ${p.fim || '…'} · <b>${h2(p.dur)} h</b> · ${esc(short(p.op))}${p.desc ? ' · ' + esc(p.desc) : ''}${p.os ? ' · OS ' + esc(p.os) : ''}</div>
      ${al.has(p.id) ? `<div class="pill warn" style="margin-top:4px">${esc(al.get(p.id))}</div>` : ''}</div>
      <div class="row-gap">${!p.fim ? (podeEditar() ? `<button class="btn pri" data-e="liberar" data-id="${p.id}">Liberar</button>` : '<span class="pill warn">Sem liberação</span>') : '<span class="pill ok">Liberado</span>'}${podeEditar() ? `<button class="btn ghost" data-e="editPar" data-id="${p.id}" aria-label="Editar">✎</button>` : ''}</div></div>`).join('')}</div></div></div>`;
    return h;
  }
  function parForm(p, deLanc) {
    const novo = !p;
    p = p || { data: deLanc ? deLanc.data : U.dia, eq: deLanc ? deLanc.eq : '', op: deLanc ? deLanc.op : '', ini: agoraHM(), fim: '', causa: '', desc: '', os: '' };
    formSheet(novo ? 'Nova parada' : 'Editar parada', '', `
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="fpData" value="${p.data}"></label><label class="sel"><span>Identificação (frota)</span><input class="in" id="fpEq" list="dlFrota2" value="${esc(p.eq)}" autocomplete="off">${dl('dlFrota2', E().cad.frota.map(f => f.id))}</label></div>
      <label class="sel"><span>Operador</span>${selOp('fpOp', p.op)}</label>
      <div class="row2"><label class="sel"><span>Início</span><input class="in" type="time" id="fpIni" value="${p.ini || ''}"></label><label class="sel"><span>Fim (vazio = sem liberação)</span><input class="in" type="time" id="fpFim" value="${p.fim || ''}"></label></div>
      <label class="sel"><span>Causa</span><select class="in" id="fpCausa"><option value="">—</option>${E().config.causas.map(c => `<option value="${esc(c.causa)}" ${c.causa === p.causa ? 'selected' : ''}>${esc(c.causa)} · ${esc(c.resp.toLowerCase())}</option>`).join('')}</select></label>
      <div class="row2"><label class="sel"><span>Descrição</span><input class="in" id="fpDesc" value="${esc(p.desc || '')}"></label><label class="sel"><span>Nº da OS</span><input class="in" id="fpOs" value="${esc(p.os || '')}"></label></div>
      ${novo ? '' : `<button type="button" class="btn danger" data-del="${p.id}">Excluir parada</button>`}`, 'Salvar', async () => {
      const eq = $('fpEq').value.trim().toUpperCase(); const data = $('fpData').value; const ini = $('fpIni').value;
      if (!data || !eq || !ini) throw new Error('Informe data, identificação e início.');
      if (!$('fpCausa').value) throw new Error('Escolha a causa.');
      const n = { data, mes: data.slice(0, 7), eq, op: $('fpOp').value, ini, fim: $('fpFim').value || null, causa: $('fpCausa').value, desc: $('fpDesc').value.trim().toUpperCase(), os: $('fpOs').value.trim() };
      if (novo) { DB.eAdd('par', n); DB.log(`Operação: parada ${eq} · ${n.causa.toLowerCase()}`); } else DB.eUpd('par', p.id, n);
      toast(n.fim ? 'Parada salva' : 'Parada registrada como sem liberação');
    });
    const del = document.querySelector('#fSheet [data-del]');
    if (del) del.onclick = () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Confirmar exclusão'; return; } DB.eDel('par', p.id); $('layer').innerHTML = ''; toast('Parada excluída'); render(); };
  }

  /* ---------- equipe ---------- */
  function vEquipe() {
    const C = calc(); const ops = E().cad.operadores;
    const { ops: st } = C.mes(U.mes, E().lanc, E().par, E().insp, E().aval[U.mes] || {}, TODAY);
    const stMap = new Map(st.map(x => [x.o.nome, x]));
    const fora = ops.filter(o => C.ausenteEm(o, TODAY));
    const ult = n => E().lanc.filter(l => l.op === n).map(l => l.data).sort().pop();
    const sitTxt = o => { if (!o.situacao || o.situacao === 'TRABALHANDO') return '<span class="pill ok">Trabalhando</span>'; const at = C.ausenteEm(o, TODAY); return `<span class="pill ${at ? 'warn' : 'neu'}">${esc(title(o.situacao))}</span><div class="muted small">${o.de ? dBR(o.de) : 'hoje'} a ${o.ate ? dBR(o.ate) : 'sem data'}${!at && o.de && o.de > TODAY ? ' · programado' : !at && o.ate && o.ate < TODAY ? ' · encerrado' : ''}</div>`; };
    let h = `<div class="filters">${selMes('eMes', U.mes)}${isAdmin() || podeEditar() ? `<button class="btn pri" data-e="novoOp" style="align-self:flex-end">${I.plus} Operador</button>` : ''}</div>
      <div class="mini"><div><b class="num">${ops.length - fora.length}</b><span>Trabalhando hoje</span></div><div><b class="num" style="color:${fora.length ? 'var(--st-atr)' : 'inherit'}">${fora.length}</b><span>Fora da coqueria</span></div><div><b class="num">${ops.filter(o => o.escala === '4x4').length}</b><span>Escala 4x4</span></div><div><b class="num">${E().cad.frota.length}</b><span>Equipamentos</span></div></div>
      <div class="card"><header><h2>Operadores</h2><p>${mesNome(U.mes)}: dias previstos, ausências e alocações</p></header><div class="tw"><table class="hoverable"><thead><tr><th>Operador</th><th>Função</th><th>Escala</th><th>Situação</th><th class="r">Dias prev.</th><th class="r">Ausente</th><th class="r">Alocações</th><th>Último lançamento</th></tr></thead><tbody>
      ${ops.map(o => { const x = stMap.get(o.nome) || {}; return `<tr ${podeEditar() ? `data-e="editOp" data-nome="${esc(o.nome)}" tabindex="0"` : ''}><td><b>${esc(title(o.nome))}</b>${o.fixo === false ? ' <span class="pill neu">não fixo</span>' : ''}</td><td class="small muted">${esc(title(o.funcao))}</td><td>${o.escala === '4x4' ? `<span class="tag">4x4 · ${esc(o.turma || '?')}</span>` : '<span class="tag">ADM</span>'}</td><td>${sitTxt(o)}</td><td class="r num">${x.diasOp ?? ''}</td><td class="r num">${x.diasOp != null ? x.diasOp - x.dprev || '' : ''}</td><td class="r num">${x.aloc || ''}</td><td class="num small">${dBR(ult(o.nome))}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
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
    h += `<div class="card"><header><h2>Escala do mês</h2><p>● lançado · ! escalado sem lançamento · · escalado · vazio = folga · siglas = situação</p></header><div class="tw"><table class="escala"><thead><tr><th>Operador</th>${dias.map(d => `<th class="c ${d === TODAY ? 'today' : ''}">${d.slice(8)}</th>`).join('')}</tr></thead><tbody>
      ${ops.map(o => `<tr><td class="nowrap"><b>${esc(short(o.nome))}</b> <span class="muted small">${o.escala === '4x4' ? '4x4·' + esc(o.turma || '?') : 'ADM'}</span></td>${dias.map(d => cel(o, d)).join('')}</tr>`).join('')}
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
      <label class="sel"><span>Operador</span>${selOp('fiOp', '')}</label>
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
    const num = (op, k) => `<input class="in numin sm" type="number" min="0" data-av="${esc(op)}|${k}" value="${(av[op] || {})[k] ?? ''}" ${ed ? '' : 'disabled'} aria-label="${k}">`;
    let h = `<div class="filters">${selMes('eAvMes', m)}<span class="muted small" style="align-self:flex-end">Notas de 1 a 5. 5S e Segurança só contam se o operador não tiver inspeção no mês. Vazio = nota padrão ${E().config.pesos.notaPadrao}.</span></div>`;
    if (!mesesCarregados().has(m)) return h + '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
    h += `<div class="card"><div class="tw"><table><thead><tr><th>Operador</th><th class="c">Proatividade</th><th class="c">5S</th><th class="c">Segurança</th><th class="c">Faltas</th><th class="c">Atrasos</th><th class="c">Atestados</th><th>Observações</th><th class="r">Nota</th></tr></thead><tbody>
      ${l.map(x => `<tr><td><b>${esc(short(x.o.nome))}</b><div class="muted small">${x.aloc} alocações${x.ninsp ? ' · ' + x.ninsp + ' inspeções' : ''}</div></td><td class="c">${nota(x.o.nome, 'proat', 5)}</td><td class="c">${nota(x.o.nome, 's5', 5)}</td><td class="c">${nota(x.o.nome, 'seg', 5)}</td><td class="c">${num(x.o.nome, 'faltas')}</td><td class="c">${num(x.o.nome, 'atrasos')}</td><td class="c">${num(x.o.nome, 'atest')}</td><td><input class="in" data-av="${esc(x.o.nome)}|obs" value="${esc((av[x.o.nome] || {}).obs || '')}" ${ed ? '' : 'disabled'} aria-label="Observações"></td><td class="r num"><b>${x.ranked ? h1(x.nota) : '–'}</b>${x.classe ? `<div class="small muted">${x.classe.toLowerCase()}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhum operador com alocação no mês.</td></tr>'}
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
        <p class="lbl m0">Turmas 4x4 · 1º dia de trabalho de um ciclo</p>${Object.keys(c.turmas || {}).map(k => row('Turma ' + k, inp('turmas', k, c.turmas[k], 'date'))).join('')}</div></div>
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
    const t = e.target.closest('[data-e],[data-epf],[data-epdia]'); if (!t || t.closest('#layer')) return;
    if (t.dataset.epdia !== undefined) { U.pdia = t.dataset.epdia; return render(); }
    const d = t.dataset;
    if (d.epf) { U.pf = d.epf; return render(); }
    switch (d.e) {
      case 'diaAnt': U.dia = add(U.dia, -1); render(); break;
      case 'diaProx': U.dia = add(U.dia, 1); render(); break;
      case 'hoje': U.dia = TODAY; render(); break;
      case 'irDia': UI.view = 'elanc'; U.dia = d.dia; render(); scrollTo(0, 0); break;
      case 'novoLanc': lancForm(null); break;
      case 'editLanc': lancForm(acharL(d.id)); break;
      case 'copiar': copiarDiaAnterior(); break;
      case 'parDe': parForm(null, acharL(d.id)); break;
      case 'novaPar': parForm(null); break;
      case 'editPar': { const p = acharP(d.id); if (p) parForm(p); break; }
      case 'liberar': {
        const p = acharP(d.id);
        formSheet('Liberar equipamento', `<span class="mono">${esc(p.eq)}</span> · parado desde ${p.ini} de ${dBR(p.data)}`, `<label class="sel"><span>Hora da liberação</span><input class="in" type="time" id="lbFim" value="${p.data === TODAY ? agoraHM() : ''}"></label>${p.data !== TODAY ? '<p class="small muted m0">A parada é de outro dia: informe a hora em que o equipamento voltou naquele dia (até o fim do turno).</p>' : ''}`, 'Liberar', async () => {
          const f = $('lbFim').value; if (!f) throw new Error('Informe a hora.');
          DB.eUpd('par', p.id, { fim: f }); DB.log(`Operação: liberou ${p.eq} às ${f}`); toast(`${p.eq} liberado`);
        }); break;
      }
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
        try { const s = await (await fetch('seed-equip.json')).json(); await DB.eImportar(s); DB.log('Operação: importou a planilha de controle de equipamentos'); toast('Planilha importada'); }
        catch (err) { toast('Erro ao importar: ' + (err.message || err)); }
        UI.busy = false; render(); break;
      }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-e="editOp"]')) e.target.click(); });
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
      return ({ epainel: vPainel, elanc: vLanc, epar: vPar, eequipe: vEquipe, einsp: vInsp, eaval: vAval, eanal: vAnal, econfig: vConfig }[view] || vPainel)();
    },
    badge: () => (E().loaded && E().config ? E().par.filter(p => !p.fim).length : 0)
  };
}
