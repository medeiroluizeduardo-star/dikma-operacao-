// Módulo Configurações: Visão geral, Escalas e turnos, Conferência, Uso do plano, Rotas, Plano padrão, Gerador,
// Usuários, Perfis e permissões e o primeiro acesso (importar).
import { SETS, SET_KEYS, setDaArea, AREA_S, DAYS, DL, pd, add, ddmm, weeksOfMonth, weekLabel, monthLabel, addMonth } from '../cal.js';
import { competenciaDe, diasDaCompetencia } from '../planilhas-adm.js';
import { semAcento, casa, caixaBusca } from '../busca.js';
import { MODULOS_ACESSO, MODULO_ACESSO, ESCOPOS, perfilNome, legadoDoAcesso, acessoDe, selosAcesso, perfilDe } from '../acessos.js';
import { criarEscala, normRegime, letra, PERIODO, periodosDe } from '../escala.js';
import { PERFIS_MOD, GRUPOS_ABAS, configuravel, doPerfil, podeVer, resumoExcecao, ITENS, itemPerfil, itemDoPapel, podeItemU, chavePerm } from '../permissoes.js';
import { DB, TODAY, CUR_WEEK, CUR_MONTH, esc, title, $ } from '../nucleo/base.js';
import { ME, PL, COLABS, SK, AREAS, UI, rotas, tipos, meses, isAdmin, admDe, papelNome, modsDe, setsDe, permCfg } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I, MOD_IC } from '../ui/icones.js';
import { rotasDa } from '../calc/atividades.js';
import { escala, turmaFicha, turmaDe } from '../calc/presenca.js';
import { VIEWS } from '../navegacao.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { comModulo } from '../nucleo/modulos.js';

/* ---------------- MÓDULO CONFIGURAÇÕES ---------------- */
// Um lugar só para os ajustes de todos os módulos. Cada tela grava no mesmo lugar de sempre, então o que muda aqui
// vale na hora para Atividades Pátio e Bateria, Escala e Efetivo, Operação, Efetivo e Meu dia.
function vCfGeral() {
  const E = escala(); const card = (ic, t, sub, corpo, botoes) => `<div class="card cfc"><header><span class="cfi">${ic}</span><div class="minw"><h2>${t}</h2><p>${sub}</p></div></header><div class="body">${corpo}<div class="row-gap cfb">${botoes}</div></div></div>`;
  const ir = (view, txt, set) => `<button class="btn sm" data-cfgo="${view}${set ? '|' + set : ''}">${txt}</button>`;
  const kv = l => `<dl class="cfkv">${l.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  let h = '<div class="cfgrid">';
  // Escalas
  const semT = setsDe(ME).reduce((n, k) => n + SETS[k].areas.flatMap(a => (DB.dados(k).colabs || {})[a] || []).filter(c => { const r = E.regimes[normRegime(c.regime, E.regimes)]; return r && r.tipo === 'ciclo' && !turmaDe(c); }).length, 0);
  const hoje = Object.entries(E.regimes).filter(([, r]) => r.tipo === 'ciclo').map(([k]) => { const l = E.turmasDoDia(k, TODAY); return `<span class="tchip">${esc(k)} · ${l.length ? l.join(' ') : '—'}</span>`; }).join('');
  h += card(I.escala, 'Escalas e turnos', 'Regimes, turmas e feriados de todos os módulos', `<div class="hojeturma"><span class="muted small">Trabalham hoje:</span>${hoje}</div>${kv([['Regimes', Object.values(E.regimes).map(r => esc(r.nome)).join(', ')], ['Feriados cadastrados', E.feriados.size], ['Turno sem turma', semT ? `<span class="semt">${semT} pessoa${semT > 1 ? 's' : ''}</span>` : 'nenhum']])}`, ir('cfescala', 'Abrir escalas'));
  // Atividades
  for (const k of setsDe(ME)) {
    const st = DB.dados(k); const c = st.config;
    const nPlano = SETS[k].areas.reduce((n, a) => n + ((st.plano || {})[a] || []).length, 0);
    const ms = ((c && c.meses) || []).slice().sort();
    h += card(MOD_IC[SETS[k].mod], SETS[k].nome, SETS[k].areas.map(a => AREA_S[a]).join(' · '), c ? kv([['Rotas', (c.rotas || []).length], ['Atividades no plano', nPlano], ['Meses gerados', ms.length ? ms.slice(-3).map(monthLabel).join(', ') : '—']]) : '<p class="muted m0">Planilha ainda não importada.</p>', `${ir('config', 'Rotas e configurações', k)}${ir('plano', 'Plano padrão', k)}${ir('gerador', 'Gerador de meses', k)}`);
  }
  // Operação
  if (VIEWS.find(v => v.id === 'econfig').req()) { const e = DB.cache.e; const c = e && e.config; h += card(MOD_IC.equipamentos, 'Equipamentos', 'Lançamentos, frota e operadores', c ? kv([['Operadores', (e.cad.operadores || []).length], ['Frota', (e.cad.frota || []).length], ['Causas de parada', (c.causas || []).length], ['Turno ADM · 4x4', `${c.turno.admIni}–${c.turno.admFim} · ${c.turno.x4Ini}–${c.turno.x4Fim}`]]) : '<p class="muted m0">Planilha ainda não importada.</p>', ir('econfig', 'Configurações dos equipamentos')); }
  // Efetivo
  if (VIEWS.find(v => v.id === 'gtipos').req()) { const g = DB.cache.g; h += card(MOD_IC.gestao, 'Fichas', 'Fichas de acompanhamento (Gestão)', kv([['Fichas', (g.colabs || []).length], ['Tipos de ocorrência', ((g.config && g.config.tipos) || []).length], ['Na Folha 1', ((g.config && g.config.tipos) || []).filter(t => t.f1).length]]), `${ir('gtipos', 'Tipos de ocorrência')}${isAdmin() ? ir('gimport', 'Importar dados') : ''}`); }
  // Acesso
  if (isAdmin()) { const us = DB.cache.usuarios; const exc = us.filter(u => u.abas && Object.keys(u.abas).length).length; const av = DB.cache.avisosCfg && DB.cache.avisosCfg.vapid; h += card(I.users, 'Acesso', 'Usuários, perfis e avisos', kv([['Usuários ativos', us.filter(u => u.papel !== 'bloqueado').length], ['Bloqueados', us.filter(u => u.papel === 'bloqueado').length], ['Com abas personalizadas', exc], ['Avisos no celular', av ? 'chave configurada' : '<span class="semt">sem chave</span>']]), `${ir('usuarios', 'Usuários e acessos')}${ir('perfis', 'Perfis e permissões')}`); }
  return h + '</div>';
}

// Rascunho da escala até salvar (para mexer em várias coisas e gravar de uma vez).
export function rascEsc() {
  if (!UI.escR) { const E = escala(); UI.escR = { regimes: JSON.parse(JSON.stringify(E.regimes)), feriados: JSON.parse(JSON.stringify((DB.cache.escalas && DB.cache.escalas.feriados) || [])) }; }
  return UI.escR;
}
function vCfEscala() {
  const R = rascEsc(); const E = criarEscala(R, {}, []); const ed = admDe('escala');
  const salvo = JSON.stringify({ r: escala().regimes, f: (DB.cache.escalas && DB.cache.escalas.feriados) || [] }) === JSON.stringify({ r: R.regimes, f: R.feriados });
  // calendário dos próximos 14 dias
  const dias = []; for (let i = 0; i < 14; i++) dias.push(add(TODAY, i));
  const linhasCal = [];
  for (const [k, r] of Object.entries(R.regimes)) {
    if (r.tipo === 'semana') linhasCal.push({ rot: esc(r.nome), cel: dias.map(d => E.previsto(k, '', d)) });
    else for (const l of Object.keys(r.turmas || {})) linhasCal.push({ rot: `${esc(r.nome)} · <b>${esc(l)}</b>`, cel: dias.map(d => E.previsto(k, l, d)) });
  }
  const cal = `<div class="card"><header><h2>Próximos 14 dias</h2><p>D turno diurno · N turno noturno (a noite conta no dia em que começa) · ● trabalha (administrativo) · ○ folga · ? turma sem data · é assim que o sistema marca a folga e o turno sozinho no Efetivo diário e na Frequência</p></header><div class="tw"><table class="calesc"><thead><tr><th></th>${dias.map(d => { const w = pd(d).getDay(); return `<th class="c ${d === TODAY ? 'today' : ''} ${w === 0 || w === 6 ? 'fds' : ''}">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][w]}<br><span class="thd">${d.slice(8)}</span></th>`; }).join('')}</tr></thead><tbody>
    ${linhasCal.map(x => `<tr><th scope="row">${x.rot}</th>${x.cel.map((p, i) => `<td class="c ${dias[i] === TODAY ? 'today' : ''}">${p && p.trab && p.periodo ? `<i class="peri ${p.periodo}" title="${PERIODO[p.periodo]}">${p.periodo}</i>` : `<span class="cdot ${p ? (p.trab ? 'on' : 'off') : 'nd'}" title="${p ? (p.trab ? 'trabalha' : esc(p.motivo)) : 'sem data da turma'}">${p ? (p.trab ? '●' : '○') : '?'}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  // regimes
  const dis = ed ? '' : 'disabled';
  const reg = Object.entries(R.regimes).map(([k, r]) => r.tipo === 'semana'
    ? `<div class="regc"><div class="regh"><b>${esc(r.nome)}</b><span class="muted small">trabalha nos dias marcados</span></div><div class="mchips">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="mchip"><input type="checkbox" data-escdia="${k}|${d}" ${(r.dias || []).includes(d) ? 'checked' : ''} ${dis}><span>${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]}</span></label>`).join('')}</div><p class="muted small m0">Feriados da lista abaixo também são folga.</p></div>`
    : `<div class="regc"><div class="regh"><b>${esc(r.nome)}</b><span class="row-gap nowrap small"><label class="mini-in">trabalha <input class="in numin" type="number" min="1" max="15" data-escn="${k}|trab" value="${r.trab}" ${dis}></label><label class="mini-in">folga <input class="in numin" type="number" min="1" max="15" data-escn="${k}|folga" value="${r.folga}" ${dis}></label></span></div>
      <div class="perseq"><span class="muted small">Dia e noite nos ${r.trab} dias de trabalho (toque para trocar):</span><div class="row-gap tight">${[...periodosDe(r)].map((pp, i) => `<button type="button" class="btn sm perb ${pp}" data-escper="${k}|${i}" ${dis} aria-label="${i + 1}º dia: ${PERIODO[pp]}">${i + 1}º <i class="peri ${pp}">${pp}</i> ${pp === 'N' ? 'noite' : 'dia'}</button>`).join('')}</div></div>
      <p class="muted small m0">Para cada turma, informe qualquer dia em que ela <b>começou</b> um bloco de ${r.trab} dias de trabalho.</p>${(() => { // turmas no mesmo ponto do ciclo trabalham juntas no mesmo período: quase sempre é data errada
        const n = (+r.trab || 0) + (+r.folga || 0); if (!n) return ''; const fase = {}; for (const [l, d] of Object.entries(r.turmas || {})) if (d) { const f = ((Math.round((pd(d) - pd('2000-01-01')) / 864e5) % n) + n) % n; (fase[f] = fase[f] || []).push(l); }
        const rep = Object.values(fase).filter(x => x.length > 1); return rep.length ? `<p class="aviso">${rep.map(x => `As turmas <b>${x.join(' e ')}</b> estão no mesmo dia do ciclo: trabalham juntas, no mesmo período. Confira as datas.`).join('<br>')}</p>` : ''; })()}
      <div class="turl">${Object.entries(r.turmas || {}).map(([l, d]) => `<label class="turi"><span class="tl">${esc(l)}</span><input class="in" type="date" data-esct="${k}|${l}" value="${d || ''}" ${dis}>${ed ? `<button type="button" class="btn ghost sm" data-escdel="${k}|${l}" aria-label="Remover turma ${esc(l)}">✕</button>` : ''}</label>`).join('')}
      ${ed ? `<span class="turi add"><input class="in" maxlength="2" placeholder="Letra" data-escnova="${k}" aria-label="Nova turma"><button type="button" class="btn sm" data-escadd="${k}">${I.plus} Turma</button></span>` : ''}</div></div>`).join('');
  const fer = R.feriados.slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  const eqF = ((DB.cache.e && DB.cache.e.config && DB.cache.e.config.feriados) || []).filter(f => f.semOp && !R.feriados.some(x => x.data === f.data));
  const ferH = `<div class="regc"><div class="regh"><b>Feriados</b><span class="muted small">folga do administrativo (turno segue a escala)</span></div>
    ${fer.length ? `<div class="rchips">${fer.map(f => `<span class="rchip">${dBRs(f.data)} · ${esc(f.desc || 'feriado')}${ed ? `<button type="button" class="btn ghost mini-x" data-escferdel="${f.data}" aria-label="Remover">✕</button>` : ''}</span>`).join('')}</div>` : '<p class="muted small m0">Nenhum feriado cadastrado.</p>'}
    ${ed ? `<div class="row-gap"><input class="in" type="date" id="escFerD"><input class="in grow" id="escFerT" placeholder="Descrição"><button type="button" class="btn" data-escfer="1">${I.plus} Feriado</button>${eqF.length ? `<button type="button" class="btn ghost" data-escfereq="1">Copiar ${eqF.length} da Operação</button>` : ''}</div>` : ''}</div>`;
  const barra = ed ? `<div class="body row-gap savebar"><button class="btn pri" data-act="escSalvar" ${salvo ? 'disabled' : ''}>${salvo ? 'Tudo salvo' : 'Salvar escalas'}</button>${salvo ? '' : '<button class="btn ghost" data-act="escDescartar">Descartar mudanças</button><span class="muted small">As mudanças só valem depois de salvar.</span>'}</div>` : '';
  // pessoas de turno e suas turmas
  const q = UI.escQ || '';
  const pessoas = []; for (const k of setsDe(ME)) for (const a of SETS[k].areas) for (const c of ((DB.dados(k).colabs || {})[a] || [])) { const rg = normRegime(c.regime, escala().regimes); const r = escala().regimes[rg]; if (r && r.tipo === 'ciclo') pessoas.push({ k, c, rg, r, t: letra(c.turma), tf: turmaFicha(c.nome) }); }
  pessoas.sort((x, y) => x.c.nome.localeCompare(y.c.nome));
  const kP = x => semAcento([x.c.nome, x.c.rota, AREA_S[x.c.area], SETS[x.k].curto, x.rg, x.t || x.tf || 'sem turma'].join(' '));
  const sem = pessoas.filter(x => !x.t && !x.tf).length; const daFicha = pessoas.filter(x => !x.t && x.tf).length;
  const tab = `<div class="card"><header><h2>Turma de cada pessoa de turno</h2><p>${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'} em regime de turno · ${sem ? `<span class="semt">${sem} sem turma</span>` : 'todas com turma'}${daFicha ? ` · ${daFicha} usando a turma da ficha do Efetivo` : ''}</p></header>
    <div class="body lbar">${caixaBusca('escQ', q, 'Buscar pessoa, rota ou turma')}${ed && daFicha ? `<button class="btn" data-act="escFicha">Gravar as ${daFicha} turmas das fichas</button>` : ''}</div>
    <div class="tw" id="escLista"><table><thead><tr><th>Colaborador</th><th>Onde</th><th>Regime</th><th>Turma</th><th>Hoje</th></tr></thead><tbody>
    ${pessoas.map(x => { const t = x.t || x.tf; const p = t ? escala().previsto(x.rg, t, TODAY) : null; return `<tr data-k="${esc(kP(x))}" ${casa(kP(x), q) ? '' : 'hidden'}><td><b>${esc(title(x.c.nome))}</b></td><td class="small">${esc(SETS[x.k].curto)} · ${esc(AREA_S[x.c.area])}<div class="muted">${esc(x.c.rota)}</div></td><td class="small">${esc(x.r.nome)}</td>
      <td>${ed ? `<select class="in" data-escpes="${x.k}|${esc(x.c.area)}|${esc(x.c.id)}" aria-label="Turma de ${esc(title(x.c.nome))}"><option value="">${x.tf && !x.t ? `Da ficha (${esc(x.tf)})` : 'Sem turma'}</option>${Object.keys(x.r.turmas || {}).map(l => `<option ${l === x.t ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : esc(t || '—')}</td>
      <td>${p ? (p.trab ? `<span class="pill ok">${p.periodo === 'N' ? 'noite' : 'dia'}</span>` : '<span class="pill neu">folga</span>') : '<span class="pill warn">sem turma</span>'}</td></tr>`; }).join('')}
    </tbody></table><p class="empty" data-vazio ${pessoas.some(x => casa(kP(x), q)) ? 'hidden' : ''}>${pessoas.length ? 'Ninguém encontrado.' : 'Nenhuma pessoa em regime de turno nas Atividades.'}</p></div></div>`;
  return `${cal}<div class="card"><header><h2>Regimes e turmas</h2><p>Vale para Atividades, Pessoas no turno, Equipamentos, RH, Meu dia e avisos no celular</p></header><div class="body cfreg">${reg}${ferH}</div>${barra}</div>${tab}`;
}
const dBRs = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
// Conferência do cadastro: o que falta ou não bate entre os módulos, com o atalho para corrigir.
function vCfConf() {
  const E = escala(); const nk = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const itens = [];
  const item = (grav, t, d, nomes, ir, irTxt) => itens.push({ grav, t, d, nomes, ir, irTxt });
  // 1) turmas sem data de início (a folga automática não funciona para elas)
  const semData = Object.entries(E.regimes).filter(([, r]) => r.tipo === 'ciclo').flatMap(([k, r]) => Object.entries(r.turmas || {}).filter(([, d]) => !d).map(([l]) => `${r.nome || k} · turma ${l}`));
  if (semData.length) item('bad', 'Turmas sem data de início', 'Sem a data, a folga pela escala não é marcada sozinha para quem é dessas turmas.', semData, 'cfescala', 'Escalas e turnos');
  // 2) pessoas de turno sem turma
  const todos = setsDe(ME).flatMap(k => SETS[k].areas.flatMap(a => ((DB.dados(k).colabs || {})[a] || []).map(c => ({ ...c, set: k }))));
  const semTurma = todos.filter(c => { const r = E.regimes[normRegime(c.regime, E.regimes)]; return r && r.tipo === 'ciclo' && !turmaDe(c); });
  if (semTurma.length) item('bad', 'Pessoas de turno sem turma', 'Sem a letra da turma, o sistema não sabe as folgas delas.', semTurma.map(c => `${title(c.nome)} (${SETS[c.set].curto})`), 'cfescala', 'Escalas e turnos');
  // 3) Atividades × fichas do Efetivo (pelo nome)
  const fichas = (DB.cache.g && DB.cache.g.colabs) || [];
  if (fichas.length) {
    const fn = new Set(fichas.map(f => nk(f.nome)));
    const semFicha = todos.filter(c => !fn.has(nk(c.nome)));
    if (semFicha.length) item('warn', 'Nas Atividades sem ficha no RH', 'O nome não bate com nenhuma ficha (apelido, abreviação ou ainda não cadastrado). Corrija em RH › Colaboradores.', semFicha.map(c => title(c.nome)), null);
    if (DB.areaDaFicha) { const ger = fichas.filter(f => DB.areaDaFicha(f.mat) === 'GERAL'); if (ger.length) item('warn', 'Fichas na área GERAL', 'Não foi possível saber a área de atuação. Só quem vê todas as áreas enxerga essas fichas. Corrija em RH › Colaboradores.', ger.map(f => title(f.nome)), null); }
  }
  // 4) usuários
  const us = DB.cache.usuarios || [];
  const semArea = us.filter(u => ['lider', 'supervisor'].includes(u.papel) && !u.area && (u.modulos || ['operacao']).some(m => m === 'operacao' || m === 'bateria'));
  if (semArea.length) item('bad', 'Líderes e supervisores sem área', 'Eles não veem nenhuma rota até a área ser escolhida.', semArea.map(u => title(u.nome)), 'usuarios', 'Usuários e acessos');
  const nunca = us.filter(u => u.trocarSenha && u.papel !== 'bloqueado');
  if (nunca.length) item('neu', 'Ainda não criaram a própria senha', 'Receberam a senha provisória e não entraram.', nunca.map(u => `${title(u.nome)} (${u.login || ''})`), 'usuarios', 'Usuários e acessos');
  // 5) Frequência e férias: folha atual e férias
  const A = DB.cache.adm || {}; const comp = competenciaDe(TODAY);
  for (const k of SET_KEYS) { const c = (A.comps || {})[k + '|' + comp]; if (c === null) item('warn', `Folha de ${(d => `${d[0].slice(8)}/${d[0].slice(5, 7)} a ${d.at(-1).slice(8)}/${d.at(-1).slice(5, 7)}`)(diasDaCompetencia(comp))} não aberta · ${SETS[k].curto}`, 'A frequência da competência atual ainda não foi aberta em RH › Frequência.', [], null); else if (c) { const sem = c.grupos.flatMap(g => g.pessoas.filter(p => !p.mat).map(p => title(p.nome))); if (sem.length) item('neu', `Na folha sem ficha no RH · ${SETS[k].curto}`, 'Entram na folha, mas sem matrícula as férias e a Presença do dia não se ligam a elas.', sem, null); const sAt = c.grupos.flatMap(g => g.pessoas.filter(p => !p.ativ && !p.desligado && g.turno).map(p => title(p.nome))); if (sAt.length) item('neu', `Turno na folha, fora das Atividades · ${SETS[k].curto}`, 'A presença delas fica só na folha (não aparece na Presença do dia).', sAt, null); } }
  if (A.fLoaded) {
    const marcadas = new Set((A.ferias || []).filter(f => f.inicio && f.inicio >= TODAY.slice(0, 7) + '-01').map(f => f.mat || nk(f.nome)));
    const venc = (A.ferias || []).filter(f => f.limite && f.limite < TODAY && !marcadas.has(f.mat || nk(f.nome)));
    if (venc.length) item('bad', 'Férias com data limite vencida', 'Data limite passou e não há férias marcadas daqui para frente.', venc.map(f => `${title(f.nome)} (limite ${dBRs(f.limite)})`), null);
  }
  const ord = { bad: 0, warn: 1, neu: 2 };
  itens.sort((a, b) => ord[a.grav] - ord[b.grav]);
  const ic = { bad: 'Corrigir', warn: 'Conferir', neu: 'Para saber' };
  return `<div class="mini"><div><b class="num" style="color:var(--st-nreal)">${itens.filter(i => i.grav === 'bad').length}</b><span>Corrigir</span></div><div><b class="num" style="color:var(--st-atr)">${itens.filter(i => i.grav === 'warn').length}</b><span>Conferir</span></div><div><b class="num">${itens.filter(i => i.grav === 'neu').length}</b><span>Para saber</span></div></div>
  ${itens.length ? itens.map(i => `<div class="card"><header><h2>${esc(i.t)}${i.nomes.length ? ` <span class="muted">(${i.nomes.length})</span>` : ''}</h2><p>${esc(i.d)}</p><span class="r"><span class="pill ${i.grav === 'neu' ? 'neu' : i.grav}">${ic[i.grav]}</span>${i.ir ? ` <button class="btn sm" data-cfgo="${i.ir}">${esc(i.irTxt)}</button>` : ''}</span></header>${i.nomes.length ? `<div class="body pt0"><details class="legdet"${i.nomes.length <= 8 ? ' open' : ''}><summary>Ver ${i.nomes.length > 8 ? 'os ' + i.nomes.length : 'quem'}</summary><p class="small m0">${i.nomes.map(esc).join(' · ')}</p></details></div>` : ''}</div>`).join('') : '<div class="card"><div class="empty">Tudo certo: nada para conferir no cadastro.</div></div>'}`;
}
// Uso do plano grátis do Firebase (Spark). O número vem da cópia de segurança diária.
function vCfUso() {
  const u = DB.cache.uso;
  const LIM = [['Banco (Firestore)', '1 GiB guardado · 50 mil leituras, 20 mil gravações e 20 mil exclusões por dia'], ['Site (Hosting)', '10 GB guardados · 360 MB de transferência por dia'], ['Contas (Authentication)', 'Sem limite de contas com usuário e senha']];
  const lim = `<div class="card"><header><h2>Limites do plano grátis</h2><p>Se passar do limite do dia, o banco para de responder até a meia-noite do horário do Pacífico (4h ou 5h em Brasília). Nada é cobrado.</p></header><div class="body"><dl class="cfkv">${LIM.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div></div>`;
  if (!u) return `<div class="card"><div class="empty">Ainda sem medição. Ela é feita pela cópia de segurança diária (GitHub › Actions › Cópia de segurança), às 3h.</div></div>${lim}`;
  const em = u.em && u.em.toDate ? u.em.toDate() : null;
  const cols = Object.entries(u.colecoes || {}).sort((a, b) => b[1] - a[1]);
  const totalDocs = cols.reduce((n, [, v]) => n + v, 0);
  const tam = b => (b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB');
  const pctBanco = Math.min(100, ((u.pacoteBytes || 0) * 4) / (1024 ** 3) * 100);
  return `<div class="mini"><div><b class="num">${totalDocs.toLocaleString('pt-BR')}</b><span>Documentos</span></div><div><b class="num">${tam((u.pacoteBytes || 0) * 4)}</b><span>Banco (estimado)</span></div><div><b class="num">${u.fotos ? u.fotos.n.toLocaleString('pt-BR') : '—'}</b><span>Fotos · ${u.fotos ? tam(u.fotos.bytes) : '—'}</span></div><div><b class="num">${u.contas ? u.contas.total : '—'}</b><span>Contas</span></div><div><b class="num">${(u.leiturasCopia || 0).toLocaleString('pt-BR')}</b><span>Leituras da cópia</span></div></div>
  <div class="card"><header><h2>Banco de dados</h2><p>Medido ${em ? 'em ' + em.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'} · cópia ${esc(u.tipo || '')}</p></header><div class="body stackcol">
    <div><div class="small">Espaço usado (estimado pelo tamanho da cópia): <b>${pctBanco < 1 ? 'menos de 1' : pctBanco.toFixed(0)}%</b> de 1 GiB</div><div class="barra"><i style="width:${Math.max(1, pctBanco)}%"></i></div></div>
    ${u.contas && u.contas.semPerfil ? `<p class="small m0"><b>${u.contas.semPerfil} conta(s) sem usuário</b> (sobram quando a senha de alguém é redefinida). Não atrapalham nem gastam cota; podem ser apagadas no console do Firebase › Authentication.</p>` : ''}
    <div class="tw"><table><thead><tr><th>Coleção</th><th class="r">Documentos</th></tr></thead><tbody>${cols.map(([c, n]) => `<tr><td class="mono">${esc(c)}</td><td class="r num">${n.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>
  </div></div>${lim}`;
}
export function vConfigModulo(view) {
  if (view === 'cfconf') return vCfConf();
  if (view === 'cfuso') return vCfUso();
  if (view === 'cfescala') return vCfEscala();
  if (view === 'usuarios') return vUsuarios();
  if (view === 'perfis') return vPerfis();
  if (view === 'econfig') return comModulo('EQ', m => m.render('econfig'));
  if (view === 'gtipos' || view === 'gimport') return comModulo('GE', m => m.render(view));
  return vCfGeral();
}

/* ---------------- PLANO PADRÃO ---------------- */
export function vPlano() {
  const a = UI.pArea;
  const ps = (DB.cache.plano[a] || []).filter(p => p.ativo !== false);
  const rts = rotasDa(a).filter(r => r.rota !== 'GESTÃO').map(r => r.rota);
  return `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fPArea">${AREAS.map(x => `<option value="${x}" ${x === a ? 'selected' : ''}>${AREA_S[x]}</option>`).join('')}</select></label><span class="muted" style="align-self:flex-end">${ps.length} atividades · rota, local, atividade e tipo mudam na hora (inclusive nos meses já gerados); os dias valem para os meses gerados depois</span></div>
  <div class="card"><header><h2>Nova atividade</h2></header><div class="body"><form id="fNova" class="form">
   <label class="sel"><span>Rota</span><select class="in" id="nRota">${rts.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel wide"><span>Local / equipamento</span><input class="in" id="nLocal" required placeholder="Ex.: CORREIA C5613A"></label>
   <label class="sel wide"><span>Atividade</span><input class="in" id="nAtiv" required placeholder="Ex.: Mesa impacto - Lavagem"></label>
   <label class="sel"><span>Tipo</span><select class="in" id="nTipo">${tipos().map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
   <div class="sel"><span>Dias</span><div class="row-gap tight diastog">${DL.map((d, k) => `<button type="button" class="tog lbl-on" data-ntog="${k}" aria-pressed="${k < 5}" aria-label="${DAYS[k]}">${d}</button>`).join('')}</div></div>
   <button class="btn pri" type="submit">${I.plus} Adicionar</button>
  </form></div></div>
  <div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Rota</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map(d => `<th class="c">${d}</th>`).join('')}<th class="r">Freq.</th><th></th></tr></thead><tbody>
  ${ps.slice(0, UI.more || 60).map(p => `<tr><td class="mono muted">${p.id}</td><td><select class="in pin" data-prota="${p.id}" data-opts="rota" aria-label="Rota de ${p.id}"><option selected>${esc(p.rota)}</option></select></td><td><input class="in pin" data-pcampo="${p.id}|local" value="${esc(p.local)}" maxlength="120" aria-label="Local de ${p.id}" title="${esc(p.local)}"></td><td><input class="in pin" data-pcampo="${p.id}|ativ" value="${esc(p.ativ)}" maxlength="120" aria-label="Atividade ${p.id}"></td><td><select class="in pin" data-pcampo="${p.id}|tipo" data-opts="tipo" aria-label="Tipo de ${p.id}"><option selected>${esc(p.tipo)}</option></select></td>${[...p.dias].map((c, k) => `<td class="c"><button class="tog" data-ptog="${p.id}|${k}" aria-pressed="${c === '1'}" aria-label="${DAYS[k]}">✓</button></td>`).join('')}<td class="r num">${[...p.dias].filter(c => c === '1').length}</td><td>${UI.confirm === 'del:' + p.id ? `<span class="confirm"><button class="btn danger" data-act="del" data-id="${p.id}">Excluir</button><button class="btn" data-act="cancel">Não</button></span>` : `<button class="btn ghost danger" data-act="askDel" data-id="${p.id}" aria-label="Excluir ${p.id}">✕</button>`}</td></tr>`).join('')}
  </tbody></table></div>${ps.length > (UI.more || 60) ? `<div class="body pt0"><button class="btn center" style="white-space:normal;max-width:100%" data-act="more" data-n="${(UI.more || 60) + 120}">Mostrar mais ${Math.min(120, ps.length - (UI.more || 60))} (faltam ${ps.length - (UI.more || 60)})</button></div>` : ''}</div>`;
}

// Plano padrão: cada lista (rota, tipo) nasce só com o valor atual; as opções entram quando a pessoa toca nela.
// Com 120 linhas, montar todas as opções de todas as listas deixava a tela com ~5 mil elementos (cerca de 1 s no celular).
function encherOpcoes(sel) {
  if (!sel || sel.dataset.cheio) return; sel.dataset.cheio = '1';
  const atual = sel.value; const id = sel.dataset.prota || (sel.dataset.pcampo || '').split('|')[0]; const p = PL.get(id);
  const lista = sel.dataset.opts === 'rota' ? rotasDa(p ? p.area : UI.pArea).filter(r => r.rota !== 'GESTÃO').map(r => r.rota) : tipos();
  sel.innerHTML = [...new Set([atual, ...lista])].map(v => `<option ${v === atual ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
for (const ev of ['pointerdown', 'focusin', 'keydown']) document.addEventListener(ev, e => { const t = e.target; if (t && t.matches && t.matches('select[data-opts]')) encherOpcoes(t); }, true);

/* ---------------- GERADOR ---------------- */
export function vGerador() {
  const ms = meses(); const last = ms[ms.length - 1] || CUR_MONTH;
  const opts = []; for (let i = 1; i <= 14; i++) opts.push(addMonth(last, i));
  if (!UI.gMes || ms.includes(UI.gMes)) UI.gMes = opts[0];
  const ws = weeksOfMonth(UI.gMes);
  const per = AREAS.map(a => ({ a, n: (DB.cache.plano[a] || []).filter(p => p.ativo !== false).length }));
  return `<div class="grid2"><div class="card"><header><h2>Gerar novo mês</h2><p>Cada semana (seg–dom) entra no mês da sua quinta-feira</p></header><div class="body stackcol">
   <label class="sel"><span>Mês</span><select class="in" id="gMes">${opts.map(o => `<option value="${o}" ${o === UI.gMes ? 'selected' : ''}>${monthLabel(o)}</option>`).join('')}</select></label>
   <div class="tw"><table><thead><tr><th>Semana</th>${per.map(x => `<th class="r">${AREA_S[x.a]}</th>`).join('')}</tr></thead><tbody>${ws.map((w, i) => `<tr><td>S${i + 1} · ${ddmm(w)} a ${ddmm(add(w, 6))}</td>${per.map(x => `<td class="r num">${x.n}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="row-gap"><button class="btn pri" data-act="gerar" ${UI.busy ? 'disabled' : ''}>${I.gerador} ${UI.busy ? 'Gerando…' : 'Gerar ' + monthLabel(UI.gMes)}</button><span class="muted num">${ws.length} semanas × ${per.reduce((n, x) => n + x.n, 0)} atividades</span></div>
  </div></div>
  <div class="card"><header><h2>Meses gerados</h2></header><div class="body"><div class="plist">${ms.map(m => `<div class="pitem"><div><div class="t">${monthLabel(m)}</div><div class="l num">${weeksOfMonth(m).length} semanas</div></div>${m === CUR_MONTH ? '<span class="pill ok">atual</span>' : m > CUR_MONTH ? '<span class="pill neu">futuro</span>' : '<span class="pill neu">anterior</span>'}</div>`).join('')}</div></div></div></div>`;
}

/* ---------------- USUÁRIOS ---------------- */
// Acesso por módulo (fase 1 da divisão em 5 módulos): uma linha por módulo com o perfil, os escopos e as áreas.
// Ao salvar grava o modelo novo (acesso, escopos) E os campos antigos tirados dele (papel, modulos, áreas), que são o
// que as telas e as regras ainda usam (gravação dupla; ver legadoDoAcesso em acessos.js).
const areaSel = (attrs, v, vazio = '—') => `<select class="in" ${attrs}><option value="">${vazio}</option>${Object.values(SETS).map(st => `<optgroup label="${st.nome}">${st.areas.map(a => `<option value="${a}" ${v === a ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</optgroup>`).join('')}</select>`;
const MOD_ANTIGO = { operacao: 'Atividades Pátio', bateria: 'Atividades Bateria', equipamentos: 'Equipamentos', gestao: 'Fichas', frequencia: 'Frequência e férias' };
// px = prefixo dos ids (nu = novo usuário, ea = editar acesso), para os dois formulários não repetirem ids.
export function formAcesso(px, st) {
  const a = st.acesso || {}; const esc_ = new Set(st.escopos || []);
  const linhas = MODULOS_ACESSO.map(m => `<div class="acm"><div class="minw"><b>${m.nome}</b><small class="muted">${m.sub}</small></div><select class="in" id="${px}M_${m.k}" data-acf="${px}" aria-label="Perfil em ${m.nome}"><option value="">Sem acesso</option>${m.perfis.map(p => `<option value="${p}" ${a[m.k] === p ? 'selected' : ''}>${perfilNome(m.k, p)}</option>`).join('')}</select>${m.k === 'gestao' ? `<label class="switch acfi"><input type="checkbox" id="${px}Fichas" data-acf="${px}" ${st.fichas !== false ? 'checked' : ''}><span class="small">Com as Fichas de acompanhamento</span></label>` : ''}</div>`).join('');
  return `<div class="acf"><div class="acms">${linhas}</div>
   <div class="ur r2"><div class="sel"><span>Escopos</span><div class="mchips">${ESCOPOS.map(([k, n]) => `<label class="mchip"><input type="checkbox" id="${px}E_${k}" data-acf="${px}" ${esc_.has(k) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
   <label class="sel"><span>Área (líder e supervisor)</span>${areaSel(`id="${px}Area" data-acf="${px}"`, st.area)}</label>
   <label class="sel"><span>2ª área (só supervisor)</span>${areaSel(`id="${px}Area2" data-acf="${px}"`, st.area2)}</label></div>
   <p class="muted small m0 acres" id="${px}Res" aria-live="polite">${resumoAcesso(st)}</p></div>`;
}
export function lerAcesso(px) {
  const acesso = {};
  for (const m of MODULOS_ACESSO) { const v = $(px + 'M_' + m.k).value; if (v) acesso[m.k] = v; }
  const bl = $(px + 'Bloq');
  return { acesso, escopos: ESCOPOS.map(e => e[0]).filter(k => $(px + 'E_' + k).checked), fichas: $(px + 'Fichas').checked, area: $(px + 'Area').value || null, area2: $(px + 'Area2').value || null, bloqueado: !!(bl && bl.checked) };
}
// Como o acesso funciona HOJE (campos antigos), em uma linha, para o administrador conferir antes de salvar.
export function resumoAcesso(st) {
  const a = st.acesso || {};
  if (!Object.keys(a).length) return 'Escolha o perfil em pelo menos um módulo.';
  if (a.administracao === 'admin') return 'Administrador: vê e faz tudo em todos os módulos.';
  const v = legadoDoAcesso(a, st.escopos, st);
  const partes = MODULOS_ACESSO.filter(m => a[m.k]).map(m => `${m.nome}: ${perfilNome(m.k, a[m.k])}`);
  const semEsc = (a.operacao || a.gestao) && !(st.escopos || []).length;
  return `Cada módulo usa o seu perfil: <b>${esc(partes.join(' · '))}</b>.${semEsc ? ' Sem escopo (Pátio, Bateria ou Equipamentos), a Operação e a Gestão ficam vazias.' : ''}${(st.area || st.area2) && !v.area ? ' A área não se aplica a estes perfis (veem todas ou nenhuma).' : ''}`;
}
// Confere o formulário e devolve os campos para gravar (modelo novo + antigos). uid = quem está sendo editado.
export function validarAcesso(st, uid) {
  const a = st.acesso;
  if (!Object.keys(a).length) throw new Error('Escolha o perfil em pelo menos um módulo.');
  if (a.operacao && !st.escopos.length) throw new Error('A Operação precisa de pelo menos um escopo: Pátio, Bateria ou Equipamentos.');
  const v = legadoDoAcesso(a, st.escopos, st);
  const ativ = v.modulos.includes('operacao') || v.modulos.includes('bateria');
  if (ativ && [a.operacao, a.gestao].some(p => ['lider', 'supervisor'].includes(p)) && !v.area) throw new Error('Escolha a área do líder ou supervisor.');
  if (v.area && ativ) { const k = setDaArea(v.area); if (k && !st.escopos.includes(k)) throw new Error(`A área ${AREA_S[v.area]} é do escopo ${SETS[k].curto}. Marque esse escopo.`); }
  if (v.area2 && v.area2 === v.area) throw new Error('A 2ª área precisa ser diferente da primeira.');
  if (v.area2 && !v.area) throw new Error('Escolha a primeira área antes da segunda.');
  if (v.area2) { const k = setDaArea(v.area2); if (k && !st.escopos.includes(k)) throw new Error(`A área ${AREA_S[v.area2]} é do escopo ${SETS[k].curto}. Marque esse escopo.`); }
  if (uid && uid === ME.uid) {
    if (st.bloqueado) throw new Error('Você não pode bloquear o seu próprio usuário.');
    const admins = DB.cache.usuarios.filter(u => u.papel === 'admin').length;
    if (ME.papel === 'admin' && v.papel !== 'admin' && admins < 2) throw new Error('Antes, deixe outra pessoa como administrador.');
  }
  return { acesso: a, escopos: st.escopos, papel: v.papel, modulos: v.modulos, acessos: v.acessos, area: v.area, area2: v.area2 };
}
export const textoAcesso = a => selosAcesso(a).map(([m, p]) => `${m} · ${p}`).join(', ') || 'sem acesso';
function selosDe(u) {
  const r = acessoDe(u);
  // Administrador: um selo só (tem todos os módulos).
  const selos = r.acesso.administracao === 'admin' ? ['<span class="pill neu selo"><b>Administrador</b> · todos os módulos</span>'] : selosAcesso(r.acesso).map(([m, p, k]) => `<span class="pill neu selo" data-mod="${k}"><b>${m}</b> · ${esc(p)}${k === 'gestao' && !r.fichas && u.papel !== 'admin' ? ' <small>(sem fichas)</small>' : ''}</span>`);
  const esc_ = r.escopos.length && r.acesso.administracao !== 'admin' ? `<span class="small muted esc">${r.escopos.map(e => ESCOPOS.find(x => x[0] === e)[1]).join(' · ')}</span>` : '';
  const tags = [u.papel === 'bloqueado' ? '<span class="pill bad">Bloqueado</span>' : '', r.convertido ? '' : '<span class="pill warn" title="Cadastro ainda no modelo antigo: estes são os módulos que a conversão vai gravar">a converter</span>'].join('');
  return `<div class="selos">${tags}${selos.join('') || '<span class="muted small">Sem acesso</span>'}${esc_}</div>`;
}
const areaTxt = u => { const ps = ['operacao', 'gestao'].map(m => perfilDe(u, m)).filter(Boolean); const l = ps.some(p => ['lider', 'supervisor'].includes(p)) ? [u.area, ps.includes('supervisor') ? u.area2 : null].filter(Boolean).map(a => AREA_S[a] || a) : []; return l.length ? l.join(' · ') : ps.some(p => ['admin', 'gestor', 'coordenador', 'leitor', 'administrativo'].includes(p)) ? '<span class="muted small">Todas</span>' : '<span class="muted">—</span>'; };
export function vUsuarios() {
  const us = DB.cache.usuarios.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const ativos = us.filter(u => u.papel !== 'bloqueado').length;
  const aConverter = us.filter(u => !acessoDe(u).convertido).length;
  if (!UI.nuAcesso) UI.nuAcesso = { acesso: { operacao: 'lider' }, escopos: ['patio'], fichas: true };
  return `<div class="mini"><div><b class="num">${ativos}</b><span>Ativos</span></div><div><b class="num">${us.length - ativos}</b><span>Bloqueados</span></div><div><b class="num">${aConverter}</b><span>A converter</span></div></div>
  <div class="card"><header><h2>Novo usuário</h2><p>A pessoa entra com o usuário e a senha provisória e cria a própria senha no primeiro acesso. Escolha o perfil em cada módulo que ela usa.</p></header><div class="body"><form id="fNovoUser" class="uform" novalidate>
   <div class="ur r1"><label class="sel"><span>Nome</span><input class="in" id="nuNome" required placeholder="Ex.: Maria Aparecida Souza"></label>
   <label class="sel"><span>Usuário</span><input class="in" id="nuLogin" required autocapitalize="none" spellcheck="false" placeholder="ex.: maria.souza"></label>
   <label class="sel"><span>Senha provisória</span><input class="in" id="nuSenha" required minlength="8" value="${esc(UI.senhaSug || (UI.senhaSug = senhaAleatoria()))}"></label></div>
   ${formAcesso('nu', UI.nuAcesso)}
   <div class="row-gap"><button class="btn pri" type="submit" ${UI.busy ? 'disabled' : ''}>${I.plus} ${UI.busy ? 'Cadastrando…' : 'Cadastrar usuário'}</button></div>
   <p class="err m0" id="nuErr" role="alert" hidden></p>
  </form></div></div>
  <div class="card"><header><h2>Acessos</h2><p>Cada pessoa tem um perfil em cada módulo que usa. <b>Operação</b> e <b>Gestão</b>: líder (1 área), supervisor (até 2 áreas), coordenador e gestor (todas as áreas), somente leitura; a Gestão tem também o Administrativo. <b>Segurança</b>: registra, trata, gestor ou somente leitura (as telas chegam na fase 3). <b>RH</b>: Administrativo ou somente leitura. <b>Administração</b>: completa (administrador) ou só a dos módulos da pessoa (como o gestor faz hoje). Os escopos (Pátio, Bateria e Equipamentos) dizem quais conjuntos a pessoa vê. <b>a converter</b> = cadastro ainda no modelo antigo; o selo mostra o que a conversão vai gravar. O que cada perfil vê dentro dos módulos fica em <b>Perfis e permissões</b>.</p></header><div class="tw"><table class="tcard utab"><thead><tr><th>Pessoa</th><th>Usuário</th><th>Acesso por módulo</th><th>Área</th><th>Abas</th><th></th></tr></thead><tbody>
  ${us.map(u => `<tr${u.papel === 'bloqueado' ? ' class="ubloq"' : ''}><td class="tc-t"><b>${esc(title(u.nome))}</b>${u.trocarSenha ? '<div class="small" style="color:var(--st-atr)">Ainda não criou a própria senha</div>' : ''}</td><td class="mono tc-s">${u.login ? esc(u.login) : '<span class="muted">conta Google</span>'}</td><td class="tc-full" data-l="Acesso por módulo">${selosDe(u)}</td><td data-l="Área">${areaTxt(u)}</td><td class="tc-full" data-l="Abas">${celulaAbas(u)}</td><td class="uacts tc-acao"><button class="btn sm" data-uacesso="${u.uid}" aria-label="Editar o acesso de ${esc(u.login || u.nome)}">${I.users} Acesso</button>${u.uid !== ME.uid ? `${u.login ? `<button class="btn sm" data-reset="${u.uid}" title="Redefinir senha">${I.key} Senha</button>` : ''}<button class="btn sm ghost danger" data-udel="${u.uid}" aria-label="Apagar o usuário ${esc(u.login || u.nome)}">Apagar</button>` : '<span class="pill neu">você</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
}
// Editar o acesso de uma pessoa (mesmo formulário do novo usuário, mais o bloqueio).
export function editarAcessoSheet(uid) {
  const u = DB.cache.usuarios.find(x => x.uid === uid); if (!u) return;
  const r = acessoDe(u);
  const st = { ...r, area: u.area || null, area2: u.area2 || null, bloqueado: u.papel === 'bloqueado' };
  const html = `${r.convertido ? '' : '<p class="small m0 acaviso">Cadastro ainda no modelo antigo. Abaixo está o que a conversão faria; ao salvar, ele já fica convertido.</p>'}${formAcesso('ea', st)}
   ${uid !== ME.uid ? `<label class="switch"><input type="checkbox" id="eaBloq" data-acf="ea" ${st.bloqueado ? 'checked' : ''}><span class="small">Bloqueado: não entra no sistema (o acesso acima fica guardado para quando desbloquear)</span></label>` : ''}`;
  formSheet('Acesso de ' + title(u.nome), u.login ? `<span class="mono">${esc(u.login)}</span>` : 'conta Google', html, 'Salvar acesso', async () => {
    const patch = validarAcesso(lerAcesso('ea'), uid);
    await DB.setUsuario(uid, patch);
    DB.log(`Acesso de ${u.login || u.nome}: ${patch.papel === 'bloqueado' ? 'bloqueado · ' : ''}${textoAcesso(patch.acesso)}`);
    toast('Acesso atualizado');
  });
}
// Abas que a pessoa pode ter, conforme os módulos dela (com o módulo de cada uma; Meu dia conta uma vez só).
const viewsDaPessoa = u => { const ms = modsDe(u); return VIEWS.filter(v => (v.mod === 'all' ? ms.length > 0 : ms.includes(v.mod)) && (() => { const m = v.mod === 'all' ? ms.find(x => x !== 'administracao') || 'operacao' : v.mod; const p = perfilDe(u, m); return p && p !== 'admin' && configuravel(m, p, v); })() && (!v.reqU || v.reqU(u))); };
const modDaAba = (u, v) => (v.mod === 'all' ? modsDe(u).find(x => x !== 'administracao') || 'operacao' : v.mod);
function celulaAbas(u) {
  if (perfilDe(u, 'administracao') === 'admin') return '<span class="muted small">Todas</span>';
  if (u.papel === 'bloqueado') return '<span class="muted small">—</span>';
  const r = resumoExcecao(u, viewsDaPessoa(u), permCfg());
  const txt = [r.menos ? `${r.menos} a menos` : '', r.mais ? `${r.mais} a mais` : ''].filter(Boolean).join(' · ');
  return `<div class="row-gap nowrap">${r.tem ? `<span class="pill exc" title="Esta pessoa tem abas diferentes do perfil">Personalizado · ${txt}</span>` : '<span class="pill neu">Padrão do perfil</span>'}<button class="btn sm" data-uabas="${u.uid}">${r.tem ? 'Editar' : 'Personalizar'}</button></div>`;
}
export function abasPessoaSheet(uid) {
  const u = DB.cache.usuarios.find(x => x.uid === uid); if (!u) return;
  const cfg = permCfg(); const vs = viewsDaPessoa(u); const ms = modsDe(u);
  const grupos = GRUPOS_ABAS.filter(g => ms.includes(g.mod)).map(g => [g, vs.filter(v => modDaAba(u, v) === g.mod)]);
  const itensDe = mod => ITENS.filter(it => it.mod === mod && itemDoPapel(perfilDe(u, mod), it) && perfilDe(u, mod) !== 'admin');
  const linhaItem = it => { const p = perfilDe(u, it.mod); const base = itemPerfil(it.mod, p, it, cfg); const on = podeItemU(u, it.id, cfg, it.mod); return `<label class="tgl-row item"><span>↳ ${esc(it.nome)}${on !== base ? ' <small class="exc-t">exceção</small>' : ''}<br><small class="muted">${esc(it.d)}</small></span><input type="checkbox" class="tgl" data-pitem="${it.id}" ${on ? 'checked' : ''} aria-label="${esc(it.nome)}"></label>`; };
  const html = `<div class="abas-p">${grupos.filter(([g, l]) => l.length || itensDe(g.mod).length).map(([g, l]) => `<div class="abas-g"><b>${esc(g.t)} · ${esc(perfilNome(g.mod, perfilDe(u, g.mod)))}</b>${l.map(v => { const m = modDaAba(u, v); const base = doPerfil(m, perfilDe(u, m), v, cfg); const on = podeVer(u, v, cfg, m); return `<label class="tgl-row"><span>${esc(v.nome)}${on !== base ? ' <small class="exc-t">exceção</small>' : ''}</span><input type="checkbox" class="tgl" data-pabas="${v.id}" ${on ? 'checked' : ''} aria-label="${esc(v.nome)}"></label>`; }).join('')}${itensDe(g.mod).map(linhaItem).join('')}</div>`).join('')}</div>
    <label class="switch"><input type="checkbox" id="paReset"><span>Voltar ao padrão dos perfis</span></label>`;
  formSheet('Abas e ações de ' + title(u.nome), 'O que for diferente do perfil do módulo fica como exceção só desta pessoa', html, 'Salvar', async () => {
    let abas = null;
    if (!$('paReset').checked) {
      abas = {};
      document.querySelectorAll('[data-pabas]').forEach(i => { const v = VIEWS.find(x => x.id === i.dataset.pabas); const m = modDaAba(u, v); if (i.checked !== doPerfil(m, perfilDe(u, m), v, cfg)) abas[v.id] = i.checked; });
      document.querySelectorAll('[data-pitem]').forEach(i => { const it = ITENS.find(x => x.id === i.dataset.pitem); if (it && i.checked !== itemPerfil(it.mod, perfilDe(u, it.mod), it, cfg)) abas[it.id] = i.checked; });
      if (!Object.keys(abas).length) abas = null;
    }
    await DB.setUsuario(uid, { abas });
    DB.log(`Ajustou as abas de ${u.nome}${abas ? '' : ' (padrão do perfil)'}`);
    toast(abas ? 'Abas personalizadas salvas' : 'Voltou ao padrão do perfil');
  });
}

/* ---------------- PERFIS E PERMISSÕES ---------------- */
// Uma tabela por módulo (abas × perfis daquele módulo). Rascunho em UI.perm até salvar, com as chaves novas
// 'módulo|perfil'; o que estava gravado no formato antigo (uma chave por perfil) entra no rascunho já convertido.
const abasDoModulo = mod => VIEWS.filter(v => (v.mod === mod || (v.mod === 'all' && mod !== 'administracao')) && !['usuarios', 'perfis', 'gimport'].includes(v.id));
export function rascunhoPerm() {
  if (!UI.perm) {
    const c = permCfg(); UI.perm = {};
    for (const g of GRUPOS_ABAS) for (const [p] of PERFIS_MOD[g.mod]) {
      const r = {};
      for (const v of abasDoModulo(g.mod)) if (configuravel(g.mod, p, v)) r[v.id] = doPerfil(g.mod, p, v, c);
      for (const it of ITENS) if (it.mod === g.mod && itemDoPapel(p, it)) r[it.id] = itemPerfil(g.mod, p, it, c);
      UI.perm[chavePerm(g.mod, p)] = r;
    }
  }
  return UI.perm;
}
const permR = (R, mod, p, id) => { const x = R[chavePerm(mod, p)]; return x && typeof x[id] === 'boolean' ? x[id] : true; };
export function vPerfis() {
  const R = rascunhoPerm(); const cfg = permCfg();
  const mod = GRUPOS_ABAS.some(g => g.mod === UI.permMod) ? UI.permMod : 'operacao';
  const mudouEm = m => PERFIS_MOD[m].some(([p]) => abasDoModulo(m).some(v => configuravel(m, p, v) && permR(R, m, p, v.id) !== doPerfil(m, p, v, cfg)) || ITENS.some(it => it.mod === m && itemDoPapel(p, it) && permR(R, m, p, it.id) !== itemPerfil(m, p, it, cfg)));
  const mudou = GRUPOS_ABAS.some(g => mudouEm(g.mod));
  const us = DB.cache.usuarios.filter(u => perfilDe(u, 'administracao') !== 'admin' && u.papel !== 'bloqueado');
  const comExc = us.filter(u => resumoExcecao(u, viewsDaPessoa(u), cfg).tem);
  const perfis = PERFIS_MOD[mod];
  const vs = abasDoModulo(mod); let g0 = '';
  const linhas = vs.map(v => { const cab = v.grp !== g0 ? (g0 = v.grp, `<tr class="grp-row"><th colspan="${perfis.length + 2}">${esc(v.grp)}</th></tr>`) : ''; return cab + `<tr><td><b>${esc(v.nome)}</b></td><td class="c muted" aria-label="Administrador sempre vê">✓</td>${perfis.map(([p, n]) => { const ok = configuravel(mod, p, v); return ok ? `<td class="c"><input type="checkbox" class="tgl" data-perm="${mod}|${p}|${v.id}" ${permR(R, mod, p, v.id) ? 'checked' : ''} aria-label="${esc(v.nome)} para ${esc(n)}"></td>` : '<td class="c muted" title="Só o administrador">—</td>'; }).join('')}</tr>`; }).join('')
    + ITENS.filter(it => it.mod === mod).map(it => `<tr class="item-perm"><td><span class="it-ic" aria-hidden="true">↳</span> ${esc(it.nome)}<div class="muted small">${esc(it.d)}</div></td><td class="c muted" aria-label="Administrador sempre pode">✓</td>${perfis.map(([p, n]) => (itemDoPapel(p, it) ? `<td class="c"><input type="checkbox" class="tgl" data-perm="${mod}|${p}|${it.id}" ${permR(R, mod, p, it.id) ? 'checked' : ''} aria-label="${esc(it.nome)} para ${esc(n)}"></td>` : '<td class="c muted" title="Este perfil não faz isso">—</td>')).join('')}</tr>`).join('');
  const abasMod = `<div class="seg" role="tablist" aria-label="Módulo">${GRUPOS_ABAS.map(g => `<button type="button" role="tab" data-permmod="${g.mod}" aria-selected="${g.mod === mod}">${esc(g.t)}${mudouEm(g.mod) ? ' •' : ''}</button>`).join('')}</div>`;
  return `<div class="card"><header><h2>Abas e ações por perfil, em cada módulo</h2><p>Cada pessoa tem um perfil em cada módulo; aqui se escolhe o que cada perfil vê e faz dentro do módulo. O administrador pode tudo sempre · Pátio e Bateria usam a mesma configuração</p></header><div class="body pt0 stackcol">${abasMod}<details class="calc"><summary>Como ler esta tabela</summary><p>Abas: desligada = some do menu e não abre nem por link.</p><p>Ações (↳): o que o perfil pode fazer dentro das abas; desligada = o botão some. — = o perfil não faz isso.</p><p>Na Administração, só o perfil “Dos módulos” pode ter abas ligadas.</p></details></div>
  <div class="tw"><table class="perm"><thead><tr><th>Aba · ${esc(MODULO_ACESSO[mod].nome)}</th><th class="c">Admin<br><small>sempre tudo</small></th>${perfis.map(([, n]) => `<th class="c">${esc(n)}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>
  <div class="body row-gap"><button class="btn pri" data-act="permSalvar" ${mudou ? '' : 'disabled'}>${mudou ? 'Salvar permissões' : 'Tudo salvo'}</button><button class="btn" data-act="permPadrao">Voltar ao padrão</button>${mudou ? '<button class="btn ghost" data-act="permDesfazer">Desfazer</button>' : ''}<span class="muted small">O que cada perfil pode alterar continua valendo pelo perfil (as regras de segurança conferem).</span></div></div>
  <div class="card"><header><h2>Exceção por pessoa</h2><p>Opcional. Abra <b>Usuários e acessos</b> e use <b>Personalizar</b> na coluna Abas para dar ou tirar abas de uma pessoa sem mudar o perfil inteiro.</p></header>
  ${comExc.length ? `<div class="tw"><table><thead><tr><th>Pessoa</th><th>Acesso</th><th>Abas</th></tr></thead><tbody>${comExc.map(u => `<tr><td><b>${esc(title(u.nome))}</b></td><td>${esc(textoAcesso(acessoDe(u).acesso))}</td><td>${celulaAbas(u)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="body"><p class="muted m0">Ninguém com exceção. Todos seguem o padrão do perfil.</p></div>'}</div>`;
}

// Senha: no mínimo 8 caracteres, sem sequência óbvia e sem o próprio usuário ou nome. Devolve o problema ou ''.
const SENHAS_OBVIAS = ['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', 'senha123', 'senha1234', 'password', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234', 'dikma123', 'dikma1234', 'coqueria', 'arcelor1', 'mudar123', 'trocar123'];
export function problemaSenha(n, u = ME) {
  const s = String(n || '');
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  const b = semAcento(s).toLowerCase();
  if (/^(.)\1+$/.test(b) || SENHAS_OBVIAS.includes(b) || '0123456789012345678901234567890'.includes(b) || 'abcdefghijklmnopqrstuvwxyz'.includes(b)) return 'Essa senha é fácil de adivinhar. Misture letras e números.';
  const pessoais = [u && u.login, ...String((u && u.nome) || '').split(/\s+/)].map(x => semAcento(String(x || '')).toLowerCase()).filter(x => x.length >= 4);
  if (pessoais.some(x => b.includes(x))) return 'A senha não pode conter o seu usuário ou o seu nome.';
  return '';
}
export function senhaAleatoria() { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(10)); for (const n of r) s += c[n % c.length]; return s; }

/* ---------------- CONFIG ---------------- */
export function vConfig() {
  return `<div class="card"><header><h2>Rotas</h2><p>Efetivo padrão (quadro previsto) e carga padrão (pico diário de atividades)</p></header><div class="tw"><table><thead><tr><th>Área</th><th>Rota</th><th class="r">Efetivo padrão</th><th class="r">Carga padrão</th><th class="r">Colaboradores</th></tr></thead><tbody>
  ${rotas().map((r, i) => `<tr><td class="muted">${AREA_S[r.area]}</td><td><input class="in pin" data-rnome="${i}" value="${esc(r.rota)}" maxlength="60" aria-label="Nome da rota ${esc(r.rota)}" title="Mudar o nome troca também no plano padrão e nos colaboradores da rota"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|ef" value="${r.ef}" aria-label="Efetivo padrão ${esc(r.rota)}"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|carga" value="${r.carga}" aria-label="Carga padrão ${esc(r.rota)}"></td><td class="r num">${COLABS.filter(c => c.area === r.area && c.rota === r.rota).length}</td></tr>`).join('')}
  </tbody></table></div></div>

  <div class="card"><header><h2>Tipos de atividade</h2></header><div class="body"><div class="rchips">${tipos().map(t => `<span class="rchip">${esc(t)}</span>`).join('')}</div></div></div>`;
}

/* ---------------- IMPORTAR (primeiro acesso) ---------------- */
export function vImportar() {
  if (!admDe('ativ')) return '<div class="card"><div class="empty">O administrador ainda não importou os dados da planilha.</div></div>';
  const ws = []; for (const m of [CUR_MONTH]) for (const w of weeksOfMonth(m)) ws.push(w);
  return `<div class="card"><header><h2>Importar dados da planilha · ${esc(SETS[SK].nome)}</h2><p>Plano padrão, rotas, colaboradores e as situações já lançadas no efetivo diário da planilha ${SK === 'bateria' ? 'PLANEJAMENTO DE ATIVIDADES BATERIA (Bateria 1, Bateria 2, Trilho e CDQ)' : 'do Pátio de Carvão'}</p></header><div class="body stackcol">
   <label class="sel"><span>Começar a programação na semana</span><select class="in" id="impIni">${ws.map(w => `<option value="${w}" ${w === UI.impIni ? 'selected' : ''}>${weekLabel(w)}${w === CUR_WEEK ? ' · atual' : ''}</option>`).join('')}</select></label>
   <p class="muted m0">Gera ${monthLabel(CUR_MONTH)} a partir dessa semana e os dois meses seguintes. Semanas anteriores não são criadas, para não aparecerem como atrasadas.</p>
   <button class="btn pri" data-act="importar" ${UI.busy ? 'disabled' : ''} style="align-self:flex-start">${UI.busy ? 'Importando…' : 'Importar e gerar a programação'}</button>
  </div></div>`;
}
// Grava só no formato novo ('módulo|perfil'); as chaves antigas (uma por perfil) saem.
acoes.permSalvar = async (t, d) => {
  const R = rascunhoPerm(); const out = {};
  for (const g of GRUPOS_ABAS) for (const [p] of PERFIS_MOD[g.mod]) {
    const k = chavePerm(g.mod, p); const o = {};
    for (const v of abasDoModulo(g.mod)) if (configuravel(g.mod, p, v)) { const on = permR(R, g.mod, p, v.id); if (!on) o[v.id] = false; else if (g.mod === 'administracao') o[v.id] = true; }
    for (const it of ITENS) if (it.mod === g.mod && itemDoPapel(p, it) && !permR(R, g.mod, p, it.id)) o[it.id] = false;
    out[k] = o;
  }
  await DB.salvarPermissoes(out); UI.perm = null; DB.log('Alterou as abas por perfil'); toast('Permissões salvas'); render();
};
acoes.permPadrao = (t, d) => { UI.perm = {}; render(); toast('Padrão carregado. Salve para aplicar'); };
acoes.permDesfazer = (t, d) => { UI.perm = null; render(); };
acoes.escSalvar = (t, d) => {
  const R = rascEsc(); DB.salvarEscalas({ regimes: R.regimes, feriados: R.feriados });
  // mantém a Operação igual: turmas 4x4 também no cadastro dela
  const t4 = (R.regimes['4x4'] || {}).turmas || {};
  if (VIEWS.find(v => v.id === 'econfig').req() && DB.cache.e && DB.cache.e.config) DB.eSalvarConfig({ turmas: Object.fromEntries(Object.entries(t4).filter(([, v]) => v)) });
  UI.escR = null; DB.log('Atualizou as escalas e turnos'); toast('Escalas salvas · valem para todos os módulos'); render();
};
acoes.escDescartar = (t, d) => { UI.escR = null; render(); };
acoes.escFicha = (t, d) => {
  let n = 0;
  for (const k of setsDe(ME)) for (const a of SETS[k].areas) {
    const itens = (DB.dados(k).colabs || {})[a] || []; let mudou = false;
    const novos = itens.map(c => { const rg = escala().regimes[normRegime(c.regime, escala().regimes)]; if (rg && rg.tipo === 'ciclo' && !letra(c.turma)) { const tf = turmaFicha(c.nome); if (tf) { mudou = true; n++; return { ...c, turma: tf }; } } return c; });
    if (mudou) DB.salvarColabsArea(a, novos, k);
  }
  DB.log(`Gravou ${n} turma(s) a partir das fichas do Efetivo`); toast(`${n} turma(s) gravadas`); render();
};
acoes.askDel = (t, d) => { UI.confirm = 'del:' + d.id; render(); };
acoes.del = (t, d) => {
  const p = PL.get(d.id); const itens = DB.cache.plano[p.area].map(x => (x.id === d.id ? { ...x, ativo: false } : x));
  DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); DB.log(`Plano padrão: removeu ${p.id} · ${p.ativ}`); UI.confirm = null; toast(`${p.id} removida do plano`); render();
};
acoes.gerar = async (t, d) => {
  UI.busy = true; render();
  try { await DB.gerarMes(UI.gMes, DB.cache.plano); DB.log(`Gerou a programação de ${monthLabel(UI.gMes)}`); toast(`${monthLabel(UI.gMes)} gerado`); UI.mes = UI.gMes; UI.ini = null; UI.gMes = null; }
  catch (err) { toast('Erro ao gerar: ' + err.message); }
  UI.busy = false; render();
};
acoes.importar = async (t, d) => {
  UI.busy = true; render();
  try {
    const seed = await DB.seed(SETS[SK].seed);
    await DB.importar(seed, [CUR_MONTH, addMonth(CUR_MONTH, 1), addMonth(CUR_MONTH, 2)], UI.impIni);
    DB.log('Importou os dados da planilha e gerou a programação'); toast('Dados importados');
  } catch (err) { toast('Erro ao importar: ' + err.message); }
  UI.busy = false; render();
};
