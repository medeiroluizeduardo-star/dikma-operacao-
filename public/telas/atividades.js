// Telas de Atividades: Painel, Aprovação, Causas e ações, Etiquetas QR, Programação, Pendências e Folha do líder.
import { SETS, AREA_S, DAYS, DL, MOTIVOS, pd, add, ddmm, weeksOfMonth, weekOf, weekLabel, monthLabel, addMonth } from '../contas/cal.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import * as M from '../ui/movimento.js';
import { DB, TODAY, CUR_WEEK, framed, esc, pct, title, fmtAt, n0, $ } from '../nucleo/base.js';
import { ME, PL, COLABS, SK, AREAS, UI, tipos, isAdmin, podeItem, todasAreas, myAreas, myArea, areaScope, canEdit, selMinhaArea, modsDe } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { docsFor, diasDe, st, stats, rotasDa, atrasadasAll, localChange, aprovador, acompanha, areasAprov, areasVerAprov, aprovDe, listaAprov, gravarApont, aprovar, devolver, CHIP, ST_NOME } from '../calc/atividades.js';
import { curto } from '../calc/presenca.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';
import { cardAusencias, cardBalanco } from './efetivo.js';
import { fotosSemana, indicadorFotos, cfgF } from './fotos.js';
import { fotosDaCel } from '../contas/fotos.js';
import { agruparAprov } from '../contas/aprovacao.js';
import { abre } from '../ui/dobra.js';
import { modsHistorico } from '../contas/acessos.js';
import { conferirAcao } from '../contas/tratativas.js';
import { viewsDoModulo } from '../nucleo/navegacao.js';


/* ---------------- PAINEL ---------------- */
export function vPainel() {
  const area = areaScope();
  const scope = UI.escopo === 'semana' ? { ini: UI.ini, area } : { mes: UI.mes, area };
  const docs = docsFor(scope); const s = stats(docs);
  const ef = pct(s.Rhoje, s.progHoje), ap = pct(s.R + s.N, s.progHoje);
  // Comparação com o período anterior (semana ou mês), para ver se está melhorando.
  const sAnt = stats(docsFor(UI.escopo === 'semana' ? { ini: add(UI.ini, -7), area } : { mes: addMonth(UI.mes, -1), area })); const efAnt = sAnt.progHoje ? pct(sAnt.Rhoje, sAnt.progHoje) : null;
  const difEf = efAnt == null || !s.progHoje ? '' : `<small class="dif ${ef >= efAnt ? 'up' : 'down'}" title="${UI.escopo === 'semana' ? 'Semana' : 'Mês'} anterior: ${efAnt}%">${ef === efAnt ? '=' : ef > efAnt ? '▲ ' + (ef - efAnt) : '▼ ' + (efAnt - ef)} pts</small>`;
  const seg = `<div class="filters" role="group" aria-label="Período"><button class="btn ${UI.escopo === 'semana' ? 'dark' : ''}" data-esc="semana">Semana</button><button class="btn ${UI.escopo === 'mes' ? 'dark' : ''}" data-esc="mes">Mês inteiro</button></div>`;
  let h = `<div class="row-between">${seg}<span class="muted">${UI.escopo === 'semana' ? weekLabel(UI.ini) : monthLabel(UI.mes)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span></div>`;
  if (!docs.length) return h + '<div class="card"><div class="empty">Nenhuma programação gerada para este período.</div></div>';
  {
    const as = area === 'TODAS' ? AREAS : [area]; const ids = new Set(docs.map(d => d.id)); // só o período que o Painel mostra
    const pa = listaAprov(as).filter(x => ids.has(x.doc.id)).length, dv = listaAprov(as, 'dev').filter(x => ids.has(x.doc.id)).length;
    if (pa || dv) h += `<div class="aprovbar"><span>${I.aprov}<span>${pa ? `<b class="num">${pa}</b> apontamento${pa > 1 ? 's' : ''} aguardando aprovação` : ''}${pa && dv ? ' · ' : ''}${dv ? `<b class="num">${dv}</b> devolvido${dv > 1 ? 's' : ''} ao líder para corrigir` : ''}<small>${UI.escopo === 'semana' ? 'Nesta semana' : 'Neste mês'} · já contam nos números abaixo.</small></span></span>${pa && aprovador() ? '<button class="btn pri sm" data-go="aprovar">Aprovar</button>' : dv && canEdit(as[0]) ? '<button class="btn sm" data-go="apontar">Abrir o Apontar</button>' : ''}</div>`;
  }
  h += `<div class="kpis">
   <div class="kpi hero"><span class="lbl">Eficiência até hoje</span><span class="v num">${ef}%${difEf}</span><span class="s num">${n0(s.Rhoje)} realizadas de ${n0(s.progHoje)} programadas até ${ddmm(TODAY)}</span><div class="meter"><i style="width:${ef}%"></i></div></div>
   <div class="kpi"><span class="lbl">Programadas</span><span class="v num">${n0(s.prog)}</span><span class="s">no período</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-real)"></i>Realizadas</span><span class="v num">${n0(s.R)}</span><span class="s">${pct(s.R, s.prog)}% do período</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Não realizadas</span><span class="v num">${n0(s.N)}</span><span class="s">${pct(s.N, s.progHoje)}% até hoje</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Atrasadas</span><span class="v num">${n0(s.A)}</span><span class="s">dia passou, sem apontamento</span></div>
   <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-extra)"></i>Fora da programação</span><span class="v num">${s.FP + s.E}</span><span class="s">incluídas pela supervisão · apontamento ${ap}%</span></div>
  </div>`;
  // Fotos das atividades: % das realizadas/extras do período (desde a regra) que têm foto.
  { const f = indicadorFotos(docs, area === 'TODAS' ? null : [area]); const pf = f.total ? pct(f.comFoto, f.total) : null;
    h += `<div class="fotoind" role="group" aria-label="Atividades com foto"><span class="fi-ic">${I.cam}</span><span class="fi-t"><b>Atividades com foto</b><small>${f.total ? `${n0(f.comFoto)} de ${n0(f.total)} realizadas/extras desde ${ddmm(f.desde)}${f.semFoto ? ` · <b class="semt">${n0(f.semFoto)} sem foto</b>` : ''}` : `foto ${cfgF().obrig ? 'obrigatória' : 'opcional'} desde ${ddmm(f.desde)} · nada no período`}</small></span><span class="fi-v num">${pf == null ? '—' : pf + '%'}</span>${pf == null ? '' : `<span class="meter fi-m"><i style="width:${pf}%;background:${pf >= 95 ? 'var(--st-real)' : pf >= 80 ? 'var(--st-atr)' : 'var(--st-nreal)'}"></i></span>`}</div>`; }
  const legend = `<div class="legend"><span><i style="background:var(--st-real)"></i>Realizada</span><span><i style="background:var(--st-nreal)"></i>Não realizada</span><span><i style="background:var(--st-atr)"></i>Atrasada</span><span><i style="background:var(--st-prog);opacity:.45"></i>A fazer</span></div>`;
  const bar = x => { const t = x.prog || 1; return `<div class="stack">${[['R', 'st-real', 1], ['N', 'st-nreal', 1], ['A', 'st-atr', 1], ['Pf', 'st-prog', 0.45]].map(([k, c, o]) => { const v = k === 'Pf' ? x.P - x.A : x[k]; return v ? `<i style="width:${v / t * 100}%;background:var(--${c});opacity:${o}" title="${ST_NOME[k === 'Pf' ? 'P' : k]}: ${v}"></i>` : ''; }).join('')}</div>`; };
  let left;
  if (area === 'TODAS') {
    left = `<div class="card"><header><h2>Resultado por área</h2><p>Toque para filtrar</p></header><div class="body">${legend}<div class="bars">${AREAS.map(a => { const x = stats(docsFor({ ...scope, area: a })); return `<button class="barrow" data-area="${a}"><span class="n">${AREA_S[a]}<small class="num">${x.R} de ${x.prog}</small></span>${bar(x)}<span class="p num">${pct(x.Rhoje, x.progHoje)}%</span></button>`; }).join('')}</div></div></div>`;
  } else {
    left = `<div class="card"><header><h2>Resultado por rota</h2><p>${AREA_S[area]}</p></header><div class="body">${legend}<div class="bars">${rotasDa(area).filter(r => r.carga > 0).map(r => { const x = stats(docs, { rota: r.rota }); return `<div class="barrow"><span class="n">${esc(r.rota)}<small class="num">${x.R} de ${x.prog}</small></span>${bar(x)}<span class="p num">${pct(x.Rhoje, x.progHoje)}%</span></div>`; }).join('')}</div></div></div>`;
  }
  let right;
  if (UI.escopo === 'semana') {
    const mx = Math.max(1, ...s.day.map(d => d.R + d.N + d.P + d.A + d.E));
    right = `<div class="card"><header><h2>Dia a dia</h2><p>${weekLabel(UI.ini)}</p></header><div class="body">${legend.replace('</div>', '<span><i style="background:var(--st-extra)"></i>Extra</span></div>')}
    <div class="cols" role="img" aria-label="Atividades por dia da semana">${s.day.map((d, k) => { const t = d.R + d.N + d.P + d.A + d.E; return `<div class="col" title="${DAYS[k]}: ${d.R} realizadas, ${d.N} não realizadas, ${d.A} atrasadas, ${d.P} a fazer, ${d.E} extras"><span class="tot num">${t || ''}</span>${[['P', 'st-prog', 0.45], ['A', 'st-atr', 1], ['N', 'st-nreal', 1], ['E', 'st-extra', 1], ['R', 'st-real', 1]].map(([kk, c, o]) => (d[kk] ? `<i style="height:${d[kk] / mx * 100}%;background:var(--${c});opacity:${o}"></i>` : '')).join('')}</div>`; }).join('')}</div>
    <div class="colx">${DAYS.map((d, k) => `<div class="${add(UI.ini, k) === TODAY ? 'today' : ''}">${(() => { const x = s.day[k]; const b = x.R + x.N + x.A; return b ? `<em class="num" style="color:${pct(x.R, b) >= 90 ? 'var(--st-real)' : pct(x.R, b) >= 70 ? 'var(--st-atr)' : 'var(--st-nreal)'}" title="Realizadas ÷ (realizadas + não realizadas + atrasadas)">${pct(x.R, b)}%</em>` : '<em class="muted">—</em>'; })()}<b>${d}</b>${ddmm(add(UI.ini, k))}</div>`).join('')}</div></div></div>`;
  } else {
    right = `<div class="card"><header><h2>Semana a semana</h2><p>${monthLabel(UI.mes)}</p></header><div class="body">${legend}<div class="bars">${weeksOfMonth(UI.mes).map(w => { const x = stats(docsFor({ ini: w, area })); return `<div class="barrow"><span class="n">${weekLabel(w).split(' · ')[0]}<small>${weekLabel(w).split(' · ')[1]}</small></span>${bar(x)}<span class="p num">${x.progHoje ? pct(x.Rhoje, x.progHoje) + '%' : '—'}</span></div>`; }).join('')}</div></div></div>`;
  }
  h += `<div class="grid2">${left}${right}</div>`;
  h += `<div class="grid2 g-ef">${cardAusencias(area)}${cardBalanco(area, UI.ini)}</div>`;
  const rs = rotasDa(area).filter(r => r.carga > 0).map(r => ({ r, x: stats(docsFor({ ...scope, area: r.area }), { rota: r.rota }) })).sort((a, b) => b.x.A - a.x.A || pct(a.x.Rhoje, a.x.progHoje) - pct(b.x.Rhoje, b.x.progHoje));
  const todasRotas = !!UI.rotasTodas || rs.length <= 8;
  h += `<div class="card"><header><h2>Rotas que pedem atenção</h2><p>Ordenadas por atrasadas${todasRotas ? '' : ` · as 8 primeiras de ${rs.length}`}</p>${rs.length > 8 ? `<span class="r"><button class="btn sm" data-act="rotasTodas">${UI.rotasTodas ? 'Só as 8 primeiras' : `Ver todas (${rs.length})`}</button></span>` : ''}</header><div class="tw"><table><thead><tr><th>Rota</th><th>Área</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realiz.</th><th class="r">Atrasadas</th><th>Eficiência até hoje</th></tr></thead><tbody>
  ${(todasRotas ? rs : rs.slice(0, 8)).map(({ r, x }) => { const e = pct(x.Rhoje, x.progHoje); return `<tr class="clicavel" data-progrota="${esc(r.area + '|' + r.rota)}" title="Abrir a Programação desta rota"><td><b>${esc(r.rota)}</b></td><td class="muted">${AREA_S[r.area]}</td><td class="r num">${x.prog}</td><td class="r num">${x.R}</td><td class="r num">${x.N}</td><td class="r num">${x.A ? `<span class="pill warn">${x.A}</span>` : '0'}</td><td><span class="ef"><i style="width:${e}%"></i></span><span class="num">${e}%</span></td></tr>`; }).join('')}
  </tbody></table></div></div>`;
  { const { por, total } = contarCausas(docs); const cs = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 5); const mx = cs.length ? cs[0][1] : 1;
    h += `<div class="grid2"><div class="card"><header><h2>Por que não foi feito</h2><p>Principais causas no período</p>${modsDe(ME).includes('gestao') ? '<span class="r"><button class="btn sm" data-go="causas">Causas e ações</button></span>' : ''}</header><div class="body">${cs.length ? `<div class="bars">${cs.map(([c, n]) => `<div class="barrow"><span class="n">${esc(c)}<small>${pct(n, total)}% das não realizadas</small></span><div class="stack"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Nenhuma não realizada no período.</div>'}</div></div>
    ${veLog() ? `<div class="card"><header><h2>Últimos registros</h2><p>Quem apontou o quê, em tempo real</p></header><div class="body">${logHtml(8)}</div></div>` : ''}</div>`; }
  return h;
}
// Últimos registros: só o histórico da Operação, e só para quem lê esse histórico (administrador e Gestor da Operação).
const veLog = () => modsHistorico(ME).includes('operacao');
function logHtml(n) {
  const L = (DB.cache.log || []).filter(l => l.mod === 'operacao');
  if (!L.length) return '<div class="empty"><b>Nenhum registro ainda</b><span>Os apontamentos feitos no Apontar aparecem aqui.</span></div>';
  return `<div class="log">${L.slice(0, n).map(l => `<div><time>${fmtAt(l.at)}</time><span><b>${esc(title(l.nome))}</b> · ${esc(l.t)}</span></div>`).join('')}</div>`;
}

/* ---------------- APROVAÇÃO ---------------- */
const NOME_AP = { R: 'Realizada', N: 'Não realizada', E: 'Extra' };
const TOM_AP = { R: 'ok', N: 'bad', E: 'ext' };
export function vAprovar() {
  const minhas = areasVerAprov(); const podeA = a => areasAprov().includes(a);
  if (!minhas.length) return '<div class="card"><div class="empty">Seu perfil não acompanha a aprovação.</div></div>';
  const area = minhas.includes(UI.aprArea) ? UI.aprArea : 'TODAS';
  const todas = listaAprov(minhas);
  const xs = area === 'TODAS' ? todas : todas.filter(x => x.doc.area === area);
  const dev = listaAprov(area === 'TODAS' ? minhas : [area], 'dev');
  // Um número só: quem aprova vê o que é dele aprovar (o mesmo do selo no menu e do botão); quem só acompanha vê o que espera o supervisor.
  const meus = xs.filter(x => podeA(x.doc.area)); const pode = meus.length > 0 || (area === 'TODAS' ? minhas.some(podeA) : podeA(area));
  const fila = pode ? meus : xs; const outros = xs.length - meus.length;
  // prazo de aprovação: o que o líder apontou num dia deve ser aprovado até o fim do dia seguinte
  const PRAZO_APROV = 1; const limite = add(TODAY, -PRAZO_APROV); const foraPrazo = fila.filter(x => x.dt < limite).length;
  let h = minhas.length > 1 ? `<div class="rchips linha" role="group" aria-label="Área"><button class="rchip" data-aprarea="TODAS" aria-pressed="${area === 'TODAS'}">Todas as áreas</button>${minhas.map(a => { const n = todas.filter(x => x.doc.area === a).length; return `<button class="rchip" data-aprarea="${a}" aria-pressed="${a === area}">${AREA_S[a]}<span class="c num">${n || '✓'}</span></button>`; }).join('')}</div>` : '';
  h += `<div class="mini"><div><b class="num" style="color:${fila.length ? 'var(--st-atr)' : 'inherit'}">${fila.length}</b><span>${pode ? 'Para você aprovar' : 'Aguardando aprovação'}</span></div><div><b class="num" style="color:${foraPrazo ? 'var(--st-nreal)' : 'inherit'}">${foraPrazo}</b><span>Fora do prazo (mais de 1 dia)</span></div><div><b class="num">${dev.length}</b><span>Devolvidas ao líder</span></div></div>
  <div class="row-between"><p class="muted small m0">${pode ? 'O que o líder aponta já conta nos números, com o selo “aguardando”. Aprove o dia inteiro, uma rota, ou abra a rota para conferir e devolver um item.' : 'Quem aprova ou devolve é o supervisor da área, o técnico de processo ou o administrador. Aqui você acompanha o que está esperando.'}${pode && outros ? ` Mais <b class="num">${outros}</b> aguardam o supervisor de ${area === 'TODAS' ? 'outras áreas' : 'a área'} (você só acompanha).` : ''}</p>${pode && meus.length > 1 ? (UI.confirm === 'aprvTudo' ? `<span class="confirm">Aprovar os ${meus.length}? <button class="btn pri sm" data-act="aprvTudo">Confirmar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>` : `<button class="btn pri sm" data-act="askAprvTudo">${I.ok} Aprovar tudo</button>`) : ''}</div>`;
  if (!xs.length) return h + '<div class="card"><div class="empty">Nada aguardando aprovação. Tudo o que os líderes apontaram já foi conferido.</div></div>' + devolvidas(dev);
  // Lista por dia (mais antigo primeiro, o fora do prazo fica no topo) e, dentro do dia, uma linha por rota, fechada.
  const dias = agruparAprov(xs.map(x => ({ dt: x.dt, area: x.doc.area, rota: x.p.rota, c: x.doc.d[x.i][x.k], x })));
  const nDias = UI.aprDias || 14; const abertas = UI.aprTodas || [];
  // só o dia mais antigo vem aberto; os outros mostram o resumo e abrem com um toque
  const diasAbertos = UI.aprDiasAbertos || (dias[0] ? [dias[0].dt] : []);
  for (const d of dias.slice(0, nDias)) {
    const meusDia = d.rotas.filter(r => podeA(r.area)).reduce((s, r) => s + r.n, 0);
    const aberto = diasAbertos.includes(d.dt);
    const atraso = d.dt < limite ? Math.round((pd(TODAY) - pd(d.dt)) / 864e5) : 0;
    h += `<div class="card aprov"><header><h2>${DAYS[(new Date(d.dt + 'T12:00:00').getDay() + 6) % 7]} ${ddmm(d.dt)}</h2><p>${d.n} aguardando · ${d.rotas.length} rota${d.rotas.length > 1 ? 's' : ''}${atraso ? ` · <span class="pill bad">fora do prazo · há ${atraso} dia${atraso > 1 ? 's' : ''}</span>` : ''}</p><span class="r"><button class="btn sm" data-act="aprDia" data-k="${d.dt}" aria-expanded="${aberto}">${aberto ? 'Fechar' : 'Ver rotas'}</button>${meusDia ? `<button class="btn sm" data-act="aprvDia" data-k="${d.dt}">${I.ok} Aprovar o dia${meusDia < d.n ? ` (${meusDia})` : ''}</button>` : ''}</span></header>`;
    if (!aberto) { h += '</div>'; continue; }
    h += '<div class="body"><div class="plist">';
    for (const r of d.rotas) {
      const aberta = abertas.includes(r.key);
      const det = [r.R && `${r.R} realizada${r.R > 1 ? 's' : ''}`, r.N && `<span class="nreal">${r.N} não realizada${r.N > 1 ? 's' : ''}</span>`, r.E && `${r.E} extra${r.E > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
      h += `<div class="pitem arota"><div class="minw"><div class="t">${esc(r.rota)}</div><div class="l">${minhas.length > 1 ? AREA_S[r.area] + ' · ' : ''}${det}</div></div><div class="bt"><button class="btn sm" data-act="aprTodas" data-k="${esc(r.key)}" aria-expanded="${aberta}">${aberta ? 'Fechar' : 'Ver'}</button>${podeA(r.area) ? `<button class="btn sm" data-act="aprvGrupo" data-k="${esc(r.key)}">${I.ok} Aprovar</button>` : ''}</div></div>`;
      if (aberta) h += r.itens.map(({ x }) => { const c = x.doc.d[x.i][x.k]; const m = x.doc.m[x.p.id + '|' + x.k]; const ref = `${esc(x.doc.id)}|${x.i}|${x.k}`; return `<div class="pitem aitem"><div class="minw"><div class="t">${esc(x.p.ativ)}</div><div class="l">${esc(x.p.local)} · <span class="mono">${x.p.id}</span> · <span class="pill ${TOM_AP[c]}">${NOME_AP[c]}</span></div>${m ? `<div class="l just">Justificativa: ${esc(m)}</div>` : ''}</div>${podeA(x.doc.area) ? `<div class="bt"><button class="ok-btn sm" data-act="aprv" data-k="${ref}" aria-label="Aprovar" title="Aprovar">✓</button><button class="no-btn sm dev-btn" data-act="devl" data-k="${ref}" aria-label="Devolver ao líder" title="Devolver ao líder">↩</button></div>` : ''}</div>`; }).join('');
    }
    h += '</div></div></div>';
  }
  if (dias.length > nDias) h += `<div class="row-between"><p class="muted small m0">Mostrando os ${nDias} dias mais antigos de ${dias.length}.</p><button class="btn sm" data-act="aprMaisDias">Mostrar mais dias</button></div>`;
  return h + devolvidas(dev);
}
function devolvidas(dev) {
  if (!dev.length) return '';
  return `<div class="card"><header><h2>Devolvidas ao líder</h2><p>Esperando a correção · ${dev.length}</p></header><div class="body"><div class="plist">${dev.slice(0, 12).map(x => { const a = aprovDe(x.doc, x.p.id, x.k) || {}; return `<div class="pitem"><div class="minw"><div class="t">${esc(x.p.ativ)}</div><div class="l">${esc(x.p.rota)} · ${ddmm(x.dt)} · por ${esc(title(curto(a.nome || '')))}: ${esc(a.mot || '')}</div></div></div>`; }).join('')}${dev.length > 12 ? `<p class="muted small m0">+ ${dev.length - 12}</p>` : ''}</div></div></div>`;
}
function achaAprov(ref) {
  const [id, i, k] = [ref.slice(0, ref.lastIndexOf('|', ref.lastIndexOf('|') - 1)), ...ref.split('|').slice(-2).map(Number)];
  const doc = DB.cache.semanas[id]; if (!doc) return null; const p = PL.get(doc.ids[i]); if (!p) return null;
  return { doc, i, k, dt: diasDe(doc)[k], p };
}
const MOTIVOS_DEV = ['Não foi feita', 'Foi feita em outro dia', 'Justificativa não confere', 'Atividade errada'];
function pedirDevolucao(x) {
  const c = x.doc.d[x.i][x.k];
  sheet('Devolver ao líder', `${esc(x.p.ativ)} · ${esc(x.p.rota)} · ${ddmm(x.dt)} · apontada como <b>${NOME_AP[c] || c}</b>`, [...MOTIVOS_DEV.map(t => ({ t })), { t: 'Outro motivo…', d: 'Escrever o motivo', outro: true, larga: true }], o => {
    if (!o.outro) { devolver(x, o.t); toast('Devolvida ao líder'); render(); return; }
    formSheet('Motivo da devolução', esc(x.p.ativ), '<label class="sel"><span>Motivo</span><input class="in" id="devMot" maxlength="120" autocomplete="off"></label>', 'Devolver', async () => {
      const m = ($('devMot').value || '').trim(); if (!m) throw new Error('Escreva o motivo.');
      devolver(x, m); toast('Devolvida ao líder'); render();
    });
  });
}

/* ---------------- CAUSAS E AÇÕES ---------------- */
// Pareto das justificativas das não realizadas (mês e área do topo), semana a semana, por rota, e o plano de ação de cada causa.
const OUTRAS = 'Outras justificativas (escritas)';
const causaDe = m => (MOTIVOS.includes(m) ? m : OUTRAS);
const podeAcao = area => acompanha() && podeItem('i_acoes') && (area === 'TODAS' ? todasAreas() : (todasAreas() || myAreas().includes(area)));
// Ações das causas: as antigas (acoes/ do conjunto aberto) e as das Tratativas com origem Atividades neste conjunto.
function acoesDasCausas() {
  if (DB.tratWatch) DB.tratWatch();
  const novas = Object.values((DB.cache.trat || {}).d || {}).filter(x => x.tipo === 'acao' && x.origem === 'atividades' && x.conj === SK && x.causa)
    .map(x => ({ id: 't:' + x.id, _t: x.id, acao: x.titulo, causa: x.causa, area: x.area || 'TODAS', resp: x.resp, prazo: x.prazo, status: x.status === 'andamento' ? 'aberta' : x.status, em: x.criadoEm }));
  return [...Object.values(DB.cache.acoes || {}), ...novas];
}
export function contarCausas(docs, rota) {
  const por = {}, escritas = {}; let total = 0;
  for (const d of docs) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p || (rota && p.rota !== rota)) return; for (let k = 0; k < 7; k++) if (d.d[i][k] === 'N') { const m = d.m[id + '|' + k] || 'Sem justificativa'; const c = m === 'Sem justificativa' ? m : causaDe(m); por[c] = (por[c] || 0) + 1; total++; if (c === OUTRAS) escritas[m] = (escritas[m] || 0) + 1; } });
  return { por, escritas, total };
}
// Reincidência: a mesma causa (das listadas, não as escritas) na mesma rota 3 vezes ou mais no período.
export const REINCIDE = 3;
export function reincidencias(docs) {
  const n = new Map();
  for (const d of docs) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p) return; for (let k = 0; k < 7; k++) if (d.d[i][k] === 'N') { const m = d.m[id + '|' + k]; if (!m || !MOTIVOS.includes(m)) continue; const key = p.area + '|' + p.rota + '|' + m; n.set(key, (n.get(key) || 0) + 1); } });
  return [...n].filter(([, v]) => v >= REINCIDE).map(([k, v]) => { const [area, rota, causa] = k.split('|'); return { area, rota, causa, n: v }; }).sort((a, b) => b.n - a.n);
}
// Quantas vezes a causa apareceu por semana nas 4 semanas antes e depois de uma data (só os meses carregados)
function efeitoAcao(causa, area, desde) {
  const ini = weekOf(desde.slice(0, 10)); let antes = 0, depois = 0, sa = 0, sd = 0;
  for (let w = -4; w <= 4; w++) {
    if (w === 0) continue; const wk = add(ini, 7 * w); if (wk > CUR_WEEK) continue;
    const ds = docsFor({ ini: wk, area: area === 'TODAS' ? 'TODAS' : area }); if (!ds.length) continue;
    const n = contarCausas(ds).por[causa] || 0; if (w < 0) { antes += n; sa++; } else { depois += n; sd++; }
  }
  return { antes: sa ? antes / sa : null, depois: sd ? depois / sd : null };
}
export function vCausas() {
  const area = areaScope(); const docs = docsFor({ mes: UI.mes, area });
  const { por, escritas, total } = contarCausas(docs);
  const lista = Object.entries(por).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...lista.map(x => x[1]));
  let acum = 0; const nf = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const atrasadas = atrasadasAll(area).filter(x => x.doc.mes === UI.mes).length;
  const acoes = acoesDasCausas().filter(a => a.status !== 'cancelada' && (area === 'TODAS' || a.area === area || a.area === 'TODAS'));
  const abertas = acoes.filter(a => a.status !== 'feita');
  const vencidas = abertas.filter(a => a.prazo && a.prazo < TODAY);
  let h = `<div class="mini compacta"><div><b class="num" style="color:${total ? 'var(--st-nreal)' : 'inherit'}">${total}</b><span>Não realizadas no mês</span></div><div><b class="num">${atrasadas}</b><span>Atrasadas sem apontar</span></div><div><b class="num">${abertas.length}</b><span>Ações abertas</span></div><div><b class="num" style="color:${vencidas.length ? 'var(--st-nreal)' : 'inherit'}">${vencidas.length}</b><span>Ações com prazo vencido</span></div><div><b class="num">${lista.length}</b><span>Causas diferentes</span></div></div>`;
  // Repetiu na mesma rota: pede uma ação (some quando já há ação aberta para a causa na área).
  { const rep = reincidencias(docs).filter(r => !abertas.some(a => a.causa === r.causa && (a.area === r.area || a.area === 'TODAS')));
    if (rep.length) h += `<div class="card"><header><h2>Repetiu ${REINCIDE} vezes ou mais</h2><p>Mesma causa na mesma rota em ${monthLabel(UI.mes)}, ainda sem ação aberta</p></header><div class="tw"><table><thead><tr><th>Causa</th><th>Rota</th><th class="r">Vezes</th><th></th></tr></thead><tbody>${rep.slice(0, 8).map(r => `<tr><td><b>${esc(r.causa)}</b></td><td>${esc(r.rota)} <span class="muted">· ${AREA_S[r.area] || esc(r.area)}</span></td><td class="r num">${r.n}</td><td class="r">${acompanha() ? `<button class="btn ghost link" data-act="novaAcao" data-k="${esc(r.causa)}">${I.plus} Ação</button>` : ''}</td></tr>`).join('')}</tbody></table></div>${rep.length > 8 ? `<p class="muted small body m0">E mais ${rep.length - 8}.</p>` : ''}</div>`; }
  if (!total) h += `<div class="card"><div class="empty">Nenhuma atividade não realizada em ${monthLabel(UI.mes)}${area === 'TODAS' ? '' : ' · ' + AREA_S[area]}.</div></div>`;
  else {
    const top = lista.slice(0, 3).reduce((n, x) => n + x[1], 0);
    h += `<div class="card"><header><h2>Pareto das causas</h2><p>${monthLabel(UI.mes)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · as ${Math.min(3, lista.length)} primeiras somam ${pct(top, total)}%</p></header><div class="body"><div class="bars pareto">${lista.map(([c, n]) => { acum += n; const ac = acoes.filter(a => a.causa === c && a.status !== 'feita'); return `<div class="barrow mot"><span class="n">${esc(c)}${ac.length ? ` <span class="pill neu">${ac.length} ação${ac.length > 1 ? 'ões' : ''}</span>` : ''}</span><div class="stack clear"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}<small class="muted"> · ${pct(acum, total)}%</small></span>${podeAcao(area === 'TODAS' ? (todasAreas() ? 'TODAS' : myArea()) : area) && c !== 'Sem justificativa' ? `<button class="btn sm ghost" data-act="novaAcao" data-k="${esc(c)}" title="Criar ação para esta causa">${I.plus} Ação</button>` : ''}</div>`; }).join('')}</div>
    <p class="muted small m0">O número à direita é o total da causa · o percentual é o acumulado (as causas de cima explicam a maior parte).</p>
    ${Object.keys(escritas).length ? `<details class="m0"><summary class="small">Ver as ${Object.keys(escritas).length} justificativas escritas</summary><div class="plist">${Object.entries(escritas).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => `<div class="pitem"><div class="minw"><div class="l">${esc(t)}</div></div><span class="num">${n}</span></div>`).join('')}</div></details>` : ''}</div></div>`;
    // semana a semana
    const ws = weeksOfMonth(UI.mes); const porSem = ws.map(w => contarCausas(docs.filter(d => d.ini === w)).por);
    h += `<div class="card"><header><h2>Semana a semana</h2><p>Quantas não realizadas por causa em cada semana do mês</p></header><div class="tw"><table><thead><tr><th>Causa</th>${ws.map(w => `<th class="r">${weekLabel(w).split(' · ')[0]}</th>`).join('')}<th class="r">Mês</th></tr></thead><tbody>${lista.slice(0, 8).map(([c, n]) => `<tr><td>${esc(c)}</td>${porSem.map(p => `<td class="r num">${p[c] || '·'}</td>`).join('')}<td class="r num"><b>${n}</b></td></tr>`).join('')}</tbody></table></div></div>`;
    // por rota
    const rs = rotasDa(area).map(r => ({ r, x: contarCausas(docsFor({ mes: UI.mes, area: r.area }), r.rota) })).filter(y => y.x.total).sort((a, b) => b.x.total - a.x.total).slice(0, 10);
    h += `<div class="card"><header><h2>Rotas com mais não realizadas</h2><p>E a causa principal de cada uma</p></header><div class="tw"><table><thead><tr><th>Rota</th>${area === 'TODAS' ? '<th>Área</th>' : ''}<th class="r">Não realizadas</th><th>Causa principal</th></tr></thead><tbody>${rs.map(({ r, x }) => { const [c, n] = Object.entries(x.por).sort((a, b) => b[1] - a[1])[0]; return `<tr><td><b>${esc(r.rota)}</b></td>${area === 'TODAS' ? `<td class="muted">${AREA_S[r.area]}</td>` : ''}<td class="r num">${x.total}</td><td>${esc(c)} <span class="muted small">(${n})</span></td></tr>`; }).join('')}</tbody></table></div></div>`;
  }
  // plano de ação
  const ord = { aberta: 0, feita: 1 };
  h += `<div class="card"><header><h2>Plano de ação</h2><p>O que está sendo feito para cada causa · o efeito compara a média por semana nas 4 semanas antes e depois da ação</p>${viewsDoModulo().some(v => v.id === 'gtrat') ? '<span class="r"><button class="btn sm" data-go="gtrat">Ver em Tratativas</button></span>' : ''}</header><div class="body">${acoes.length ? `<div class="plist">${acoes.slice().sort((a, b) => (ord[a.status] || 0) - (ord[b.status] || 0) || String(a.prazo || '9').localeCompare(String(b.prazo || '9'))).map(a => {
    const ef = efeitoAcao(a.causa, a.area, a.em || TODAY); const venc = a.status !== 'feita' && a.prazo && a.prazo < TODAY; const ed = podeAcao(a.area);
    return `<div class="pitem acao"><div class="minw"><div class="t">${esc(a.acao)}</div><div class="l">${esc(a.causa)} · ${a.area === 'TODAS' ? 'todas as áreas' : AREA_S[a.area] || esc(a.area)}${a.resp ? ` · resp. ${esc(a.resp)}` : ''}${a.prazo ? ` · prazo ${ddmm(a.prazo)}` : ''}</div><div class="l">${ef.antes != null ? `Antes: ${nf(ef.antes)}/semana` : 'Antes: sem dados'} · ${ef.depois != null ? `depois: <b>${nf(ef.depois)}/semana</b>${ef.antes != null ? (ef.depois < ef.antes ? ' <span class="pill ok">caiu</span>' : ef.depois > ef.antes ? ' <span class="pill bad">subiu</span>' : ' <span class="pill neu">igual</span>') : ''}` : 'depois: aguardando a próxima semana'}</div></div><div class="row-gap">${a.status === 'feita' ? '<span class="pill ok">feita</span>' : venc ? '<span class="pill bad">prazo vencido</span>' : '<span class="pill warn">aberta</span>'}${ed ? (a.status === 'feita' ? `<button class="btn sm" data-act="acaoSt" data-k="${esc(a.id)}|aberta">Reabrir</button>` : `<button class="btn sm pri" data-act="acaoSt" data-k="${esc(a.id)}|feita">Concluir</button>`) + `<button class="btn sm ghost" data-act="acaoSt" data-k="${esc(a.id)}|cancelada" title="Tirar do plano">✕</button>` : ''}</div></div>`;
  }).join('')}</div>` : `<div class="empty"><b>Nenhuma ação ainda</b><span>${acompanha() ? 'Toque em “+ Ação” ao lado de uma causa no Pareto para registrar o que será feito.' : 'As ações registradas pela supervisão aparecem aqui.'}</span></div>`}</div></div>`;
  return h;
}
function novaAcaoSheet(causa) {
  const area = areaScope(); const opts = area !== 'TODAS' ? [area] : todasAreas() ? ['TODAS', ...AREAS] : areasAprov();
  formSheet('Nova ação', esc(causa), `<label class="sel"><span>O que vai ser feito</span><textarea class="in" id="acTxt" rows="3" maxlength="300" placeholder="Ex.: combinar com a operação a liberação da área às 8h"></textarea></label>
    <div class="row2"><label class="sel"><span>Responsável</span><input class="in" id="acResp" maxlength="60" autocomplete="off"></label><label class="sel"><span>Prazo</span><input class="in" type="date" id="acPrazo" value="${add(TODAY, 7)}"></label></div>
    <label class="sel"><span>Área</span><select class="in" id="acArea">${opts.map(a => `<option value="${a}">${a === 'TODAS' ? 'Todas as áreas' : AREA_S[a]}</option>`).join('')}</select></label>`, 'Criar ação', async () => {
    const acao = ($('acTxt').value || '').replace(/\s+/g, ' ').trim(); if (acao.length < 5) throw new Error('Descreva a ação.');
    const ar = $('acArea').value; if (!podeAcao(ar)) throw new Error('Seu perfil não cria ação nesta área.');
    // Vai para Gestão › Tratativas (origem Atividades); as ações antigas continuam em acoes/ e aparecem junto.
    DB.tratSalvar(DB.tratNovoId(), conferirAcao({ titulo: acao, por: `Causa de não realização: ${causa}`, origem: 'atividades', ref: causa, causa, conj: SK, area: ar === 'TODAS' ? '' : ar, resp: $('acResp').value, prazo: $('acPrazo').value, inicio: TODAY, status: 'aberta' }), true);
    DB.log(`Plano de ação: ${causa} → ${acao}`, 'gestao'); toast('Ação criada'); render();
  });
}

/* ---------------- ETIQUETAS QR ---------------- */
// Uma etiqueta por rota: o link abre o Apontar de hoje já na rota (?r=ÁREA|ROTA). Imprimir e colar no local.
let QR = null;
 const QR_SVG = new Map();
 // o desenho de cada código fica guardado: atualizar a tela não refaz os QR
const linkRota = r => `${location.origin}${location.pathname}?m=operacao&v=apontar&r=${encodeURIComponent(r.area + '|' + r.rota)}`;
export function vEtiquetas() {
  if (!QR) { import('../vendor/qrcode.js').then(m => { QR = m.default || m.qrcode; render(); }).catch(() => toast('Não foi possível carregar o gerador de QR Code')); return M.ESQUELETO; }
  const area = areaScope(); const rs = rotasDa(area).filter(r => r.carga > 0 || r.rota !== 'GESTÃO');
  const svg = url => { let t = QR_SVG.get(url); if (!t) { const q = QR(0, 'M'); q.addData(url); q.make(); t = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); QR_SVG.set(url, t); } return t; };
  return `<div class="row-between noprint"><p class="muted m0">${rs.length} etiqueta${rs.length === 1 ? '' : 's'} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}. Ao ler o código com a câmera do celular, abre o Apontar de hoje nesta rota (é preciso estar com o login feito).</p>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir etiquetas</button>` : ''}</div>
  <div class="qrgrid">${rs.map(r => `<div class="qret"><div class="qrsvg">${svg(linkRota(r))}</div><div class="qrtxt"><b>${esc(r.rota)}</b><span>${AREA_S[r.area]} · ${SETS[SK].nome}</span><small>Aponte a câmera para abrir esta rota no Dikma Gestão</small></div></div>`).join('')}</div>`;
}

/* ---------------- PROGRAMAÇÃO (programado × realizado da semana, por rota) ---------------- */
export function vProg() {
  const area = areaScope();
  const docs = docsFor({ ini: UI.ini, area }).sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area));
  const rts = [...new Set(docs.flatMap(d => d.ids.map(id => PL.get(id) && PL.get(id).rota)))].filter(Boolean);
  if (UI.rota !== 'TODAS' && !rts.includes(UI.rota)) UI.rota = 'TODAS';
  const s = stats(docs, { rota: UI.rota, tipo: UI.tipo });
  const cel = isMobile();
  // Feriado sem operação de cada dia da semana (pela marca nas semanas; feriados.js)
  const ferSem = DAYS.map((_, k) => { for (const d of docs) if (d.fe) for (const [key, v] of Object.entries(d.fe)) if (key.endsWith('|' + k) && v) return v; return ''; });
  const selRota = `<label class="sel"><span>Rota</span><select class="in" id="fRota"><option value="TODAS">Todas as rotas</option>${rts.map(r => `<option ${r === UI.rota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Tipo</span><select class="in" id="fTipo"><option value="TODOS">Todos</option>${tipos().map(t => `<option ${t === UI.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  let h = `<div class="filters">
   ${cel ? '' : selRota}
   <label class="sel grow"><span>Buscar</span><input class="in" id="fQ" type="search" placeholder="Local, atividade ou ID" value="${esc(UI.q)}"></label>
   <label class="btn" style="align-self:flex-end"><input type="checkbox" id="fPend" ${UI.soPend ? 'checked' : ''}> Só com pendência</label>
   ${!framed && !cel ? `<button class="btn" data-act="csv" style="align-self:flex-end">${I.dl} Exportar Excel</button>` : ''}
  </div>${cel ? `<details class="legdet"${UI.rota !== 'TODAS' || UI.tipo !== 'TODOS' ? ' open' : ''}><summary>Filtrar por rota ou tipo</summary><div class="filters">${selRota}</div></details>` : ''}
  <div class="mini compacta"><div><b class="num">${s.prog}</b><span>Programadas</span></div><div><b class="num" style="color:var(--st-real)">${s.R}</b><span>Realizadas</span></div><div><b class="num" style="color:var(--st-nreal)">${s.N}</b><span>Não realizadas</span></div><div><b class="num" style="color:var(--st-atr)">${s.A}</b><span>Atrasadas</span></div><div><b class="num">${s.P - s.A}</b><span>A fazer</span></div><div><b class="num" style="color:var(--st-extra)">${s.E}</b><span>Extras</span></div></div>
  <details class="legdet"${cel ? '' : ' open'}><summary>Legenda</summary><div class="legend">${['P', 'R', 'N', 'A'].map(c => `<span><span class="chip sm ${c}">${CHIP[c]}</span>${ST_NOME[c]}</span>`).join('')}<span><span class="chip sm P fp">${CHIP.P}</span>Fora da programação</span><span><span class="chip sm R ft">${CHIP.R}</span>Com foto · <span class="fotob">${I.cam}<span class="num">n</span></span> abre as fotos</span>${docs.some(d => d.dx && Object.keys(d.dx).length) ? `<span><span class="chip sm D">${CHIP.D}</span>${ST_NOME.D}</span>` : ''}${ferSem.some(Boolean) ? `<span><span class="chip sm F">${CHIP.F}</span>Feriado sem operação (não conta)</span>` : ''}<span class="muted">${canEdit(area === 'TODAS' ? null : area) || isAdmin() ? 'Clique em um dia para apontar' : 'Somente leitura · toque num ✕ para ver a justificativa'}</span></div></details>`;
  if (ferSem.some(Boolean)) h += `<p class="ferav">${DAYS.map((d, k) => (ferSem[k] ? `<b>${d} ${ddmm(add(UI.ini, k))} · Feriado · ${esc(ferSem[k])}</b>` : '')).filter(Boolean).join(' · ')} — dia sem operação: as atividades programadas não contam como programadas nem como atrasadas.</p>`;
  const q = UI.q.trim().toLowerCase();
  const rows = [];
  for (const doc of docs) doc.ids.forEach((id, i) => {
    const p = PL.get(id); if (!p) return;
    if (UI.rota !== 'TODAS' && p.rota !== UI.rota) return; if (UI.tipo !== 'TODOS' && p.tipo !== UI.tipo) return;
    if (q && !(p.id + ' ' + p.local + ' ' + p.ativ).toLowerCase().includes(q)) return;
    if (UI.soPend && ![...doc.d[i]].some((c, k) => c === 'P' && add(doc.ini, k) <= TODAY)) return;
    rows.push({ doc, i, p });
  });
  if (!rows.length) return h + `<div class="card"><div class="empty">Nenhuma atividade com esses filtros nesta semana.${UI.q || UI.soPend || UI.rota !== 'TODAS' || UI.tipo !== 'TODOS' ? ' <button class="btn sm" data-act="limparProg">Limpar filtros</button>' : ''}</div></div>`;
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  // Rotas recolhidas: cada rota mostra o resumo; o detalhe abre ao tocar. Com busca ou uma rota escolhida, abre tudo.
  const grupos = new Map();
  for (const r of rows) { const key = r.doc.area + '|' + r.p.rota; if (!grupos.has(key)) grupos.set(key, { area: r.doc.area, rota: r.p.rota, rows: [], R: 0, A: 0, tot: 0 }); const g0 = grupos.get(key); g0.rows.push(r); for (let k = 0; k < 7; k++) { const c = st(r.doc, r.i, k); if (c === 'X' || c === 'D' || c === 'F') continue; g0.tot++; if (c === 'R' || c === 'E') g0.R++; if (c === 'A') g0.A++; } }
  const tudoAberto = !!q || UI.rota !== 'TODAS' || grupos.size === 1;
  const abertas = new Set(UI.progAbertas || []);
  const aberto = key => tudoAberto || abertas.has(key);
  const cabGrupo = (key, x) => { const tag = tudoAberto ? 'div' : 'button'; return `<${tag} class="pgrp${aberto(key) ? ' on' : ''}" ${tudoAberto ? '' : `type="button" data-pgrp="${esc(key)}" aria-expanded="${aberto(key)}"`}>${tudoAberto ? '' : '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'}<span class="pg-t"><b>${esc(x.rota)}</b><small>${area === 'TODAS' ? AREA_S[x.area] + ' · ' : ''}${x.rows.length} ${x.rows.length === 1 ? 'atividade' : 'atividades'}</small></span><span class="pres num">${x.R} de ${x.tot} feitas${x.A ? ` · <span class="atr">${x.A} atrasada${x.A > 1 ? 's' : ''}</span>` : ''}</span></${tag}>`; };
  if (!tudoAberto) h += `<div class="row-gap pgtool"><button class="btn sm" data-act="progTodas">${abertas.size ? 'Recolher todas' : 'Abrir todas'}</button><span class="muted small">${grupos.size} rotas · toque numa rota para ver as atividades</span></div>`;
  rows.length = 0; for (const [key, x] of grupos) { if (aberto(key)) rows.push(...x.rows); else rows.push({ fechado: key }); }
  const chip = (doc, i, k) => { const c = st(doc, i, k); const m = doc.m[doc.ids[i] + '|' + k]; const fp = doc.fp && doc.fp[doc.ids[i] + '|' + k]; const nf = fotosDaCel(doc, doc.ids[i], k); return `<button class="chip ${c}${fp ? ' fp' : ''}${nf ? ' ft' : ''}" data-cell="${esc(doc.id)}|${i}|${k}" aria-label="${DAYS[k]}: ${c === 'F' ? 'Feriado · ' + esc(doc.fe[doc.ids[i] + '|' + k]) : ST_NOME[c]}${nf ? ` · ${nf} foto${nf > 1 ? 's' : ''}` : ''}" title="${DAYS[k]} ${ddmm(diasDe(doc)[k])} · ${c === 'F' ? 'Feriado · ' + esc(doc.fe[doc.ids[i] + '|' + k]) + ' (sem operação, não conta)' : ST_NOME[c]}${m ? ' · ' + esc(m) : ''}${fp ? ' · fora da programação' : ''}${nf ? ` · ${nf} foto${nf > 1 ? 's' : ''}` : ''}">${CHIP[c]}</button>`; };
  // Fotos da atividade na semana: 📷n (abre as fotos do dia; com vários dias, escolhe o dia).
  const fotoBtn = (doc, i) => { const n = fotosSemana(doc, i); return n ? ` <button type="button" class="fotob" data-act="verFotosSem" data-k="${esc(doc.id)}|${i}" aria-label="Ver ${n} foto${n > 1 ? 's' : ''} da semana" title="Fotos da semana">${I.cam}<span class="num">${n}</span></button>` : ''; };
  const LIM = UI.more || (isMobile() ? 80 : 250); // o resto aparece em "Mostrar mais" (abre mais rápido)
  const shown = rows.slice(0, LIM);
  let g = '';
  if (isMobile()) {
    h += '<div class="mlist">';
    for (const r of shown) {
      if (r.fechado) { h += cabGrupo(r.fechado, grupos.get(r.fechado)); g = r.fechado; continue; }
      const { doc, i, p } = r;
      const key = doc.area + '|' + p.rota;
      if (key !== g) { g = key; h += cabGrupo(key, grupos.get(key)); }
      h += `<div class="mcard"><div><div class="t">${esc(p.ativ)}</div><div class="loc wrapit">${esc(p.local)}</div></div><div class="row-gap"><span class="tag">${esc(p.tipo)}</span><span class="mono muted">${p.id}</span>${fotoBtn(doc, i)}</div><div class="days">${DAYS.map((d, k) => `<div>${DL[k]}${chip(doc, i, k)}</div>`).join('')}</div></div>`;
    }
    h += '</div>';
  } else {
    h += `<div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}${ferSem[k] ? ' fer' : ''}"${ferSem[k] ? ` title="Feriado · ${esc(ferSem[k])} · sem operação"` : ''}>${d}<br><span class="thd">${ddmm(add(UI.ini, k))}</span>${ferSem[k] ? '<br><span class="thf">feriado</span>' : ''}</th>`).join('')}</tr></thead><tbody>`;
    for (const r of shown) {
      if (r.fechado) { h += `<tr class="grp"><td colspan="11">${cabGrupo(r.fechado, grupos.get(r.fechado))}</td></tr>`; g = r.fechado; continue; }
      const { doc, i, p } = r;
      const key = doc.area + '|' + p.rota;
      if (key !== g) { g = key; h += `<tr class="grp"><td colspan="11">${cabGrupo(key, grupos.get(key))}</td></tr>`; }
      h += `<tr><td class="mono muted">${p.id}</td><td><div class="loc" title="${esc(p.local)}">${esc(p.local)}</div></td><td>${esc(p.ativ)}${fotoBtn(doc, i)}</td><td><span class="tag">${esc(p.tipo)}</span></td>${DAYS.map((_, k) => `<td class="c ${tk[k] ? 'today' : ''}">${chip(doc, i, k)}</td>`).join('')}</tr>`;
    }
    h += '</tbody></table></div></div>';
  }
  if (rows.length > shown.length) h += `<button class="btn center" data-act="more" data-n="${LIM + 400}">Mostrar mais ${Math.min(400, rows.length - shown.length)} de ${rows.length - shown.length}</button>`;
  return h;
}

/* ---------------- PENDÊNCIAS ---------------- */
export function vPend() {
  const area = myArea() || UI.area;
  const at = atrasadasAll(area);
  const byR = new Map();
  for (const x of at) { const p = PL.get(x.doc.ids[x.i]); if (!p) continue; const key = x.doc.area + '|' + p.rota; if (!byR.has(key)) byR.set(key, []); byR.get(key).push(x); }
  const lista = [...byR.entries()].sort((a, b) => b[1].length - a[1].length);
  let h = '';
  if (myAreas().length > 1) h += `<div class="filters">${selMinhaArea('fArea')}</div>`;
  if (!myArea()) h += `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fArea"><option value="TODAS">Todas as áreas</option>${AREAS.map(a => `<option value="${a}" ${a === UI.area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label></div>`;
  h += `<div class="mini"><div><b class="num" style="color:var(--st-atr)">${at.length}</b><span>Atrasadas</span></div><div><b class="num">${lista.length}</b><span>Rotas com atraso</span></div><div><b class="num">${at.filter(x => x.dt >= add(TODAY, -7)).length}</b><span>Últimos 7 dias</span></div><div><b class="num">${at.length ? ddmm(at[0].dt) : '—'}</b><span>Mais antiga</span></div></div><p class="muted small m0">Considera os últimos 60 dias (a mesma conta do menu). Sem apontamento, a atividade conta como atrasada; marque o que foi feito ou justifique o que não foi.</p>`;
  if (!at.length) h += '<div class="card"><div class="empty">Tudo apontado. Nenhuma atividade atrasada.</div></div>';
  h += '<div class="grid2"><div class="stackcol">';
  for (const [key, xs] of lista.slice(0, 12)) {
    const [a, r] = key.split('|'); const ed = canEdit(a);
    // Uma rota por seção: no celular começa fechada (só o nome e quantas atrasadas), no computador aberta (ui/dobra.js).
    h += `<details class="card dobra" data-dobra="pend:${esc(key)}"${abre('pend:' + key)}><summary><h2>${esc(r)}</h2><p>${AREA_S[a]} · ${xs.length} atrasada${xs.length > 1 ? 's' : ''}</p></summary><div class="body">${ed ? `<div class="row-gap pendrota">${UI.confirm === 'rota:' + key ? `<span class="confirm">Marcar todas como feitas? <button class="btn pri" data-act="rotaok" data-k="${esc(key)}">Confirmar</button><button class="btn" data-act="cancel">Cancelar</button></span>` : `<button class="btn" data-act="askRota" data-k="${esc(key)}">✓ Todas feitas</button>`}</div>` : ''}<div class="plist">
    ${xs.slice(0, (UI.pendTodas || []).includes(key) ? xs.length : 6).map(x => { const p = PL.get(x.doc.ids[x.i]); return `<div class="pitem"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${DAYS[x.k]} ${ddmm(x.dt)} · ${esc(p.local)}</div></div>${ed ? `<div class="bt"><button class="ok-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|R" aria-label="Realizada">✓</button><button class="no-btn sm" data-pend="${esc(x.doc.id)}|${x.i}|${x.k}|N" aria-label="Não realizada">✕</button></div>` : ''}</div>`; }).join('')}
    ${xs.length > 6 ? `<div class="pitem"><span class="muted">${(UI.pendTodas || []).includes(key) ? `${xs.length} nesta rota` : `+ ${xs.length - 6} nesta rota`}</span><button class="btn" data-act="pendTodas" data-k="${esc(key)}">${(UI.pendTodas || []).includes(key) ? 'Mostrar menos' : 'Ver todas'}</button></div>` : ''}
    </div></div></details>`;
  }
  h += '</div>';
  const mot = {}; for (const d of docsFor({ area })) for (const v of Object.values(d.m)) { const key = MOTIVOS.includes(v) ? v : 'Outras justificativas (escritas)'; mot[key] = (mot[key] || 0) + 1; }
  const mt = Object.entries(mot).sort((a, b) => b[1] - a[1]); const mx = Math.max(1, ...mt.map(x => x[1]));
  h += `<div class="stackcol"><div class="card"><header><h2>Por que não foi feito</h2><p>Justificativas das não realizadas</p></header><div class="body">${mt.length ? `<div class="bars">${mt.map(([m, n]) => `<div class="barrow mot"><span class="n">${esc(m)}</span><div class="stack clear"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="p num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Sem registros.</div>'}</div></div>
</div></div>`;
  return h;
}

/* ---------------- FOLHA DO LÍDER ---------------- */
export function vImprimir() {
  const area = myArea() || (UI.area === 'TODAS' ? AREAS[0] : UI.area);
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  if (UI.iRota !== 'TODAS' && !rts.includes(UI.iRota)) UI.iRota = 'TODAS';
  const lid = COLABS.find(c => c.area === area && /^L[IÍ]DER/.test(c.funcao || ''));
  const lider = UI.lider || (lid ? title(lid.nome) : '');
  let h = `<div class="filters noprint">
   ${myAreas().length > 1 ? selMinhaArea('fArea', 'Área da folha') : ''}${!myArea() ? `<label class="sel"><span>Área da folha</span><select class="in" id="fArea">${AREAS.map(a => `<option value="${a}" ${a === area ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>` : ''}
   <label class="sel"><span>Rota</span><select class="in" id="fIRota"><option value="TODAS">Todas</option>${rts.map(r => `<option ${r === UI.iRota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Líder</span><input class="in" id="fLider" value="${esc(lider)}"></label>
   ${!framed ? `<button class="btn pri" data-act="print" style="align-self:flex-end">${I.print} Imprimir / salvar PDF</button>` : ''}
   ${!framed && !isMobile() ? `<button class="btn" data-act="csv" style="align-self:flex-end" title="A programação da semana, com o que foi feito">${I.dl} Exportar Excel</button>` : ''}
  </div>`;
  if (!doc) return h + '<div class="card"><div class="empty">Semana não gerada.</div></div>';
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && (UI.iRota === 'TODAS' || x.p.rota === UI.iRota) && doc.d[x.i] !== '_______');
  // Uma folha por rota (página própria): o líder preenche a da rota dele, com o próprio cabeçalho e assinaturas.
  const porRota = new Map(); items.forEach(x => { if (!porRota.has(x.p.rota)) porRota.set(x.p.rota, []); porRota.get(x.p.rota).push(x); });
  if (porRota.size > 1) h += `<p class="muted small noprint">${porRota.size} rotas · cada rota sai numa folha separada.</p>`;
  h += '<div class="tw folhas">' + [...porRota.entries()].map(([rota, its]) => `<div class="paper folha"><div class="hd"><div><h3>PROGRAMAÇÃO SEMANAL DE ATIVIDADES</h3><div class="meta"><span><b>Área:</b> ${AREA_S[area]}</span><span><b>Mês:</b> ${monthLabel(doc.mes)}</span><span><b>Semana:</b> ${weekLabel(doc.ini)}</span><span><b>Rota:</b> ${esc(rota)}</span></div><div class="meta"><span class="liderTxt"><b>Líder responsável:</b> ${esc(lider || '_______________________')}</span><span>☐ programado — marque ✓ feito ou ✕ não feito · — sem programação</span></div></div><div class="rt small"><img class="plogo" src="img/dikma-logo.png" alt="Dikma"><br>${esc(SETS[SK].local)}</div></div>
  <table><thead><tr><th>Nº</th><th>Local / equipamento</th><th>Atividade</th>${DAYS.map((d, k) => `<th class="c">${d}<br>${ddmm(add(doc.ini, k))}</th>`).join('')}<th style="width:120px">Observação</th></tr></thead><tbody>
  ${its.map(({ i, p }, j) => `<tr><td class="c">${j + 1}</td><td>${esc(p.local)}</td><td>${esc(p.ativ)}</td>${DAYS.map((_, k) => `<td class="c">${doc.d[i][k] === '_' ? '—' : '<span class="box"></span>'}</td>`).join('')}<td class="obs">${DAYS.map((d, k) => (doc.d[i][k] === 'N' && doc.m[p.id + '|' + k] ? `${d}: ${esc(doc.m[p.id + '|' + k])}` : '')).filter(Boolean).join('; ')}</td></tr>`).join('')}
  </tbody></table><div class="sign"><div>Líder</div><div>Supervisor</div></div></div>`).join('') + '</div>';
  return h;
}
function exportCSV() {
  const area = areaScope(); const rows = [['ÁREA', 'SEMANA', 'ID', 'ROTA', 'LOCAL', 'ATIVIDADE', 'TIPO', ...DAYS, 'JUSTIFICATIVAS']];
  for (const d of docsFor({ ini: UI.ini, area })) d.ids.forEach((id, i) => { const p = PL.get(id); if (!p) return; rows.push([d.area, weekLabel(d.ini), id, p.rota, p.local, p.ativ, p.tipo, ...[...d.d[i]].map(c => ({ P: 'PROGRAMADO', R: 'REALIZADO', N: 'NÃO REALIZADO', E: 'EXTRA', _: '' }[c])), Object.entries(d.m).filter(([k]) => k.startsWith(id + '|')).map(([k, v]) => DAYS[k.split('|')[1]] + ': ' + v).join('; ')]); });
  baixarExcel(`programacao-${SETS[SK].curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}-${UI.ini}`, [{ nome: 'Programação ' + dataBR(UI.ini).slice(0, 5).replace('/', '-'), linhas: rows }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
acoes.limparProg = (t, d) => { UI.q = ''; UI.soPend = false; UI.rota = 'TODAS'; UI.tipo = 'TODOS'; render(); };
acoes.progTodas = (t, d) => { const area = areaScope(); const ks = new Set(); for (const doc of docsFor({ ini: UI.ini, area })) doc.ids.forEach(id => { const p = PL.get(id); if (p) ks.add(doc.area + '|' + p.rota); }); UI.progAbertas = (UI.progAbertas || []).length ? [] : [...ks]; render(); };
acoes.novaAcao = (t, d) => { novaAcaoSheet(d.k); };
acoes.acaoSt = (t, d) => { const [id, stt] = d.k.split('|'); const a = acoesDasCausas().find(x => x.id === id); if (!a || !podeAcao(a.area)) return;
  if (a._t) DB.tratSalvar(a._t, { status: stt, feitaEm: stt === 'feita' ? new Date().toISOString() : '' }); else DB.salvarAcao(id, { status: stt }); DB.log(`Plano de ação: "${a.acao}" ${stt === 'feita' ? 'concluída' : stt === 'cancelada' ? 'retirada' : 'reaberta'}`, 'gestao'); toast(stt === 'feita' ? 'Ação concluída' : stt === 'cancelada' ? 'Ação retirada do plano' : 'Ação reaberta'); render(); };
acoes.aprv = (t, d) => { const x = achaAprov(d.k); if (x && areasAprov().includes(x.doc.area)) { aprovar([x]); toast('Aprovada'); render(); } };
acoes.devl = (t, d) => { const x = achaAprov(d.k); if (x && areasAprov().includes(x.doc.area)) pedirDevolucao(x); };
acoes.aprvGrupo = (t, d) => { const [dt, a, r] = d.k.split('|'); const xs = listaAprov(areasAprov().filter(z => z === a)).filter(x => x.dt === dt && x.p.rota === r); aprovar(xs); toast(`${xs.length} aprovada${xs.length > 1 ? 's' : ''}`); render(); };
// Aprovar o dia: tudo o que espera aprovação naquele dia, nas áreas que a pessoa aprova (respeita o filtro de área).
const areasDoFiltro = () => { const m = areasAprov(); return m.includes(UI.aprArea) ? [UI.aprArea] : m; };
acoes.aprvDia = (t, d) => { const xs = listaAprov(areasDoFiltro()).filter(x => x.dt === d.k); aprovar(xs); toast(`${xs.length} aprovada${xs.length > 1 ? 's' : ''} em ${ddmm(d.k)}`); render(); };
acoes.aprDia = (t, d) => { const l = UI.aprDiasAbertos || [...document.querySelectorAll('[data-act="aprDia"][aria-expanded="true"]')].map(b => b.dataset.k); UI.aprDiasAbertos = l.includes(d.k) ? l.filter(x => x !== d.k) : [...l, d.k]; render(); };
acoes.aprMaisDias = (t, d) => { UI.aprDias = (UI.aprDias || 14) + 14; render(); };
acoes.askAprvTudo = (t, d) => { UI.confirm = 'aprvTudo'; render(); };
acoes.aprvTudo = (t, d) => { const xs = listaAprov(areasDoFiltro()); aprovar(xs); UI.confirm = null; toast(`${xs.length} apontamentos aprovados`); render(); };
acoes.aprTodas = (t, d) => { const l = UI.aprTodas || []; UI.aprTodas = l.includes(d.k) ? l.filter(x => x !== d.k) : [...l, d.k]; render(); };
acoes.askRota = (t, d) => { UI.confirm = 'rota:' + d.k; render(); };
acoes.rotaok = (t, d) => {
  const [a, r] = d.k.split('|'); const byDoc = new Map();
  for (const x of atrasadasAll(a)) { const p = PL.get(x.doc.ids[x.i]); if (!p || p.rota !== r) continue; if (!byDoc.has(x.doc)) byDoc.set(x.doc, []); byDoc.get(x.doc).push(localChange(x.doc, x.i, x.k, 'R')); }
  let n = 0; for (const [doc, ch] of byDoc) { n += ch.length; gravarApont(doc, ch); }
  DB.log(`${r}: ${n} atrasadas marcadas como realizadas`, 'operacao'); UI.confirm = null; toast(`${n} marcadas como realizadas`); render();
};
acoes.csv = (t, d) => { exportCSV(); };
acoes.rotasTodas = (t, d) => { UI.rotasTodas = !UI.rotasTodas; render(); };
acoes.pendTodas = (t, d) => { const k = t.dataset.k; const l = UI.pendTodas || []; UI.pendTodas = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; render(); };
