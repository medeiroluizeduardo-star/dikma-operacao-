// Módulo Configurações: Visão geral, Escalas e turnos, Conferência, Uso do plano, Rotas, Plano padrão, Gerador,
// Usuários, Perfis e permissões e o primeiro acesso (importar).
import { SETS, SET_KEYS, setDaArea, areasDoSet, AREA_S, DAYS, DL, pd, add, ddmm, weeksOfMonth, weekLabel, monthLabel, addMonth } from '../contas/cal.js';
import { competenciaDe, diasDaCompetencia } from '../contas/planilhas-adm.js';
import { semAcento, casa, caixaBusca } from '../ui/busca.js';
import { MODULOS_ACESSO, MODULO_ACESSO, ESCOPOS, perfilNome, legadoDoAcesso, acessoDe, selosAcesso, perfilDe, areasDoCadastro } from '../contas/acessos.js';
import { criarEscala, normRegime, letra, PERIODO, periodosDe } from '../contas/escala.js';
import { PERFIS_MOD, GRUPOS_ABAS, configuravel, doPerfil, podeVer, resumoExcecao, ITENS, itemPerfil, itemDoPapel, podeItemU, chavePerm } from '../contas/permissoes.js';
import { DB, TODAY, CUR_WEEK, CUR_MONTH, esc, title, $, framed } from '../nucleo/base.js';
import { ME, PL, COLABS, SK, AREAS, UI, rotas, tipos, meses, isAdmin, admDe, papelNome, modsDe, setsDe, permCfg, rebuild } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { senhaAleatoria } from '../contas/senha.js';
import { cartaoAjustesHE } from './horas-justificativas.js';
import { I, MOD_IC } from '../ui/icones.js';
import { rotasDa } from '../calc/atividades.js';
import { escala, turmaFicha, turmaDe } from '../calc/presenca.js';
import { VIEWS } from '../nucleo/navegacao.js';
import { formSheet, sheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { comModulo } from '../nucleo/modulos.js';
import { abre } from '../ui/dobra.js';
import { listasSeg } from '../contas/segcalc.js';
import { planoNaProgramacao } from './plano-prog.js';
import { agruparLocais, chaveParecida, locaisParecidos } from '../contas/execucao.js';
import { vLimpeza } from './limpeza.js';
import { vLgpd } from './lgpd.js';
import { vHistorico } from './historico.js';
import { vCfFotos } from './fotos.js';
import { saudeDoSistema } from '../contas/saude.js';
import { etiqueta, tabela, recolhido } from '../ui/padrao.js';
import { vArqFotos } from './fotos-arquivo.js';
import * as FE from '../contas/feriados.js';

/* ---------------- MÓDULO CONFIGURAÇÕES ---------------- */
// Um lugar só para os ajustes de todos os módulos. Cada tela grava no mesmo lugar de sempre, então o que muda aqui
// vale na hora para Atividades Pátio e Bateria, Escala e Efetivo, Operação e Efetivo.
function vCfGeral() {
  const E = escala(); const card = (ic, t, sub, corpo, botoes) => `<div class="card cfc"><header><span class="cfi">${ic}</span><div class="minw"><h2>${t}</h2><p>${sub}</p></div></header><div class="body">${corpo}<div class="row-gap cfb">${botoes}</div></div></div>`;
  const ir = (view, txt, set) => `<button class="btn sm" data-cfgo="${view}${set ? '|' + set : ''}">${txt}</button>`;
  const kv = l => `<dl class="cfkv">${l.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  let h = '<div class="cfgrid">';
  // Saúde do sistema (cópia, cota, erros): o pior estado de todos, com atalho para o detalhe.
  if (isAdmin()) { const sd = saudeDoSistema({ saude: DB.cache.saude, uso: DB.cache.uso, erros: DB.cache.erros }); h += card(I.ok, 'Saúde do sistema', 'Cópia de segurança, cota do banco e erros da semana', (l => `<p class="m0">${etiqueta(SIT_SAUDE[sd.geral], sd.geral)}</p>${l.length ? kv(l.map(i => [esc(i.titulo), esc(i.resumo)])) : '<p class="small muted m0">Cópia de segurança em dia e nenhum erro na semana.</p>'}`)(sd.itens.filter(i => i.situacao === 'atencao' || i.situacao === 'critico')), ir('cfsaude', 'Abrir a saúde do sistema')); }
  // Escalas
  const semT = setsDe(ME).reduce((n, k) => n + areasDoSet(k).flatMap(a => (DB.dados(k).colabs || {})[a] || []).filter(c => { const r = E.regimes[normRegime(c.regime, E.regimes)]; return r && r.tipo === 'ciclo' && !turmaDe(c); }).length, 0);
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
  // Segurança: listas dos formulários (áreas, tipos de atividade, regimes e desvios)
  if (VIEWS.find(v => v.id === 'sgconfig').req()) { const sg = DB.cache.seg || {}; const l = listasSeg(sg.cfg); h += card(MOD_IC.seguranca, 'Segurança', 'Formulários de interação e de anomalia', kv([['Áreas', l.areas.map(a => esc(a.nome)).join(', ')], ['Tipos de atividade', l.tipos.length], ['Regimes', l.regimes.length], ['Desvios', l.desvios.length], ['Listas', sg.cfg ? 'personalizadas' : 'padrão dos formulários']]), ir('sgconfig', 'Listas da Segurança')); }
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
  const ferH = `<div class="regc"><div class="regh"><b>Feriados</b><span class="muted small">folga do administrativo (turno segue a escala) · nas atividades do Pátio e da Bateria, o que estava programado não conta como atrasado</span></div>
    ${fer.length ? `<div class="rchips">${fer.map(f => `<span class="rchip">${dBRs(f.data)} · ${esc(f.desc || 'feriado')}${ed ? `<button type="button" class="btn ghost mini-x" data-escferdel="${f.data}" aria-label="Remover">✕</button>` : ''}</span>`).join('')}</div>` : '<p class="muted small m0">Nenhum feriado cadastrado.</p>'}
    ${ed ? `<div class="row-gap"><input class="in" type="date" id="escFerD"><input class="in grow" id="escFerT" placeholder="Descrição"><button type="button" class="btn" data-escfer="1">${I.plus} Feriado</button>${eqF.length ? `<button type="button" class="btn ghost" data-escfereq="1">Copiar ${eqF.length} da Operação</button>` : ''}</div>` : ''}</div>`;
  const barra = ed ? `<div class="body row-gap savebar"><button class="btn pri" data-act="escSalvar" ${salvo ? 'disabled' : ''}>${salvo ? 'Tudo salvo' : 'Salvar escalas'}</button>${salvo ? '' : '<button class="btn ghost" data-act="escDescartar">Descartar mudanças</button><span class="muted small">As mudanças só valem depois de salvar.</span>'}</div>` : '';
  // pessoas de turno e suas turmas
  const q = UI.escQ || '';
  const pessoas = []; for (const k of setsDe(ME)) for (const a of areasDoSet(k)) for (const c of ((DB.dados(k).colabs || {})[a] || [])) { const rg = normRegime(c.regime, escala().regimes); const r = escala().regimes[rg]; if (r && r.tipo === 'ciclo') pessoas.push({ k, c, rg, r, t: letra(c.turma), tf: turmaFicha(c.nome) }); }
  pessoas.sort((x, y) => x.c.nome.localeCompare(y.c.nome));
  const kP = x => semAcento([x.c.nome, x.c.rota, AREA_S[x.c.area], SETS[x.k].curto, x.rg, x.t || x.tf || 'sem turma'].join(' '));
  const sem = pessoas.filter(x => !x.t && !x.tf).length; const daFicha = pessoas.filter(x => !x.t && x.tf).length;
  const tab = `<div class="card"><header><h2>Turma de cada pessoa de turno</h2><p>A letra da turma e a escala se trocam só na ficha (RH › Colaboradores) · ${pessoas.length} pessoa${pessoas.length === 1 ? '' : 's'} em regime de turno · ${sem ? `<span class="semt">${sem} sem turma</span>` : 'todas com turma'}${daFicha ? ` · ${daFicha} usando a turma da ficha do Efetivo` : ''}</p></header>
    <div class="body lbar">${caixaBusca('escQ', q, 'Buscar pessoa, rota ou turma')}${ed && daFicha ? `<button class="btn" data-act="escFicha">Gravar as ${daFicha} turmas das fichas</button>` : ''}</div>
    <div class="tw" id="escLista"><table><thead><tr><th>Colaborador</th><th>Onde</th><th>Regime</th><th>Turma</th><th>Hoje</th></tr></thead><tbody>
    ${pessoas.map(x => { const t = x.t || x.tf; const p = t ? escala().previsto(x.rg, t, TODAY) : null; return `<tr data-k="${esc(kP(x))}" ${casa(kP(x), q) ? '' : 'hidden'}><td><b>${esc(title(x.c.nome))}</b></td><td class="small">${esc(SETS[x.k].curto)} · ${esc(AREA_S[x.c.area])}<div class="muted">${esc(x.c.rota)}</div></td><td class="small">${esc(x.r.nome)}</td>
      <td>${esc(t || '—')}${ed && x.c.mat ? ` <button type="button" class="btn ghost link small" data-act="irCadastro" data-mat="${esc(x.c.mat)}">Trocar na ficha</button>` : ''}</td>
      <td>${p ? (p.trab ? `<span class="pill ok">${p.periodo === 'N' ? 'noite' : 'dia'}</span>` : '<span class="pill neu">folga</span>') : '<span class="pill warn">sem turma</span>'}</td></tr>`; }).join('')}
    </tbody></table><p class="empty" data-vazio ${pessoas.some(x => casa(kP(x), q)) ? 'hidden' : ''}>${pessoas.length ? 'Ninguém encontrado.' : 'Nenhuma pessoa em regime de turno nas Atividades.'}</p></div></div>`;
  return `${cal}<div class="card"><header><h2>Regimes e turmas</h2><p>Vale para Atividades, Pessoas no turno, Equipamentos, RH e avisos no celular</p></header><div class="body cfreg">${reg}${ferH}</div>${barra}</div>${tab}`;
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
  const todos = setsDe(ME).flatMap(k => areasDoSet(k).flatMap(a => ((DB.dados(k).colabs || {})[a] || []).map(c => ({ ...c, set: k }))));
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
  for (const k of SET_KEYS) { const c = (A.comps || {})[k + '|' + comp]; if (c === null) item('warn', `Folha de ${(d => `${d[0].slice(8)}/${d[0].slice(5, 7)} a ${d.at(-1).slice(8)}/${d.at(-1).slice(5, 7)}`)(diasDaCompetencia(comp))} não aberta · ${SETS[k].curto}`, 'A frequência da competência atual ainda não foi aberta em RH › Frequência.', [], null); else if (c) { const sem = c.grupos.flatMap(g => g.pessoas.filter(p => !p.mat).map(p => title(p.nome))); if (sem.length) item('neu', `Na folha sem ficha no RH · ${SETS[k].curto}`, 'Entram na folha, mas sem matrícula as férias e a Escala do dia não se ligam a elas.', sem, null); const sAt = c.grupos.flatMap(g => g.pessoas.filter(p => !p.ativ && !p.desligado && g.turno).map(p => title(p.nome))); if (sAt.length) item('neu', `Turno na folha, fora das Atividades · ${SETS[k].curto}`, 'A presença delas fica só na folha (não aparece na Escala do dia).', sAt, null); } }
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
// Saúde do sistema: cópia de segurança, ensaio de restauração, cópia mensal, cota e erros da semana (contas/saude.js).
// Os dados vêm de sistema/saude (Alarme do backup, 7h30 e 18h), sistema/uso (cópia das 3h) e erros/ (últimos 100).
const SIT_SAUDE = { ok: 'Em dia', atencao: 'Atenção', critico: 'Problema', info: 'Informação' };
const IR_SAUDE = { erros: ['cferros', 'Ver os erros'], cota: ['cfuso', 'Ver o uso do plano'] };
function vCfSaude() {
  const sd = saudeDoSistema({ saude: DB.cache.saude, uso: DB.cache.uso, erros: DB.cache.erros });
  const topo = { ok: 'Tudo em dia. Nada para fazer agora.', atencao: 'Tem item pedindo atenção. Veja os marcados abaixo.', critico: 'Tem problema. Veja os marcados em vermelho abaixo.' }[sd.geral];
  const cards = sd.itens.map(i => `<div class="card cfc"><header><div class="minw"><h2>${esc(i.titulo)}</h2><p>${etiqueta(SIT_SAUDE[i.situacao], i.situacao)}</p></div></header><div class="body"><p class="m0"><b>${esc(i.resumo)}</b></p><p class="small muted">${esc(i.detalhe)}</p>${IR_SAUDE[i.id] ? `<div class="row-gap cfb"><button class="btn sm" data-cfgo="${IR_SAUDE[i.id][0]}">${IR_SAUDE[i.id][1]}</button></div>` : ''}</div></div>`).join('');
  const g = sd.erros.grupos.slice(0, 10);
  const tabErros = g.length ? `<div class="card"><header><h2>Erros da semana</h2><p>Últimos 7 dias, o mais repetido primeiro</p></header><div class="body">${tabela([{ t: 'Erro' }, { t: 'Telas' }, { t: 'Pessoas', n: true }, { t: 'Vezes', n: true }], g.map(x => [esc(x.msg), esc(x.telas.map(t => (VIEWS.find(v => v.id === t) || {}).nome || t).join(', ')), String(x.pessoas), String(x.vezes)]), { rotulo: 'Erros da semana' })}</div></div>` : '';
  const ajuda = recolhido('O que esta tela não consegue mostrar', `<p class="small">O sistema está no plano grátis do Firebase. Nele, o Google não deixa as rotinas lerem quantas leituras e gravações o banco fez no dia (isso só é liberado no plano pago, Blaze). Por isso a cota aparece só como estimativa: o espaço guardado e quanto a cópia diária gasta.</p><p class="small m0">Para ver o uso do dia de verdade: console do Firebase › Firestore › Uso. Se a cota estourar, o banco para de responder até umas 5h (Brasília) e nada é cobrado.</p>`);
  return `<div class="card"><div class="body"><p class="m0">${etiqueta(SIT_SAUDE[sd.geral], sd.geral)} ${esc(topo)}</p>${DB.cache.saude ? '' : '<p class="small muted m0">O alarme ainda não gravou o resumo: os dados aparecem depois da próxima conferência (7h30 ou 18h).</p>'}</div></div><div class="cfgrid">${cards}</div>${tabErros}${ajuda}`;
}
// Erros nos aparelhos (nucleo/erros.js): os 100 mais recentes, agrupados pela mensagem.
function vCfErros() {
  const lista = DB.cache.erros || [];
  const nomeDe = uid => { const u = (DB.cache.usuarios || []).find(x => x.uid === uid); return u ? u.nome : 'Usuário removido'; };
  const quando = e => { const d = e.quando && e.quando.toDate ? e.quando.toDate() : e.quando instanceof Date ? e.quando : null; return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };
  const ajuda = `<div class="card"><header><h2>Para que serve</h2></header><div class="body"><p class="small m0">Quando uma tela falha no celular ou no computador de alguém, o sistema anota aqui o erro, a tela e o tipo de aparelho (no máximo 5 por vez que a pessoa abre o sistema). Não guarda fotos, senhas nem o que a pessoa digitou. Se um erro aparecer muitas vezes, mostre esta lista ao Claude para corrigir. Depois de corrigido, pode apagar.</p></div></div>`;
  if (!lista.length) return `<div class="card"><div class="empty">Nenhum erro registrado. Tudo certo nos aparelhos.</div></div>${ajuda}`;
  const pessoas = new Set(lista.map(e => e.uid)).size;
  return `<div class="mini"><div><b class="num">${lista.length}</b><span>Registros${lista.length >= 100 ? ' (últimos 100)' : ''}</span></div><div><b class="num">${pessoas}</b><span>Pessoas</span></div></div>
  <div class="card"><header><h2>Erros mais recentes</h2><p>Do mais novo para o mais antigo</p><span class="r"><button class="btn sm" data-act="errApagar">${I.lixo} Apagar</button></span></header><div class="body"><div class="tw"><table><thead><tr><th>Quando</th><th>Quem</th><th>Tela</th><th>Erro</th><th>Aparelho</th><th class="r">Vezes</th></tr></thead><tbody>${lista.map(e => `<tr><td class="num">${quando(e)}</td><td>${esc(nomeDe(e.uid))}</td><td>${esc((VIEWS.find(v => v.id === e.tela) || {}).nome || e.tela || '')}</td><td><div>${esc(e.msg)}</div><div class="small mono">${esc(e.onde || '')}${e.versao ? ' · ' + esc(e.versao) : ''}</div></td><td class="small">${esc(e.aparelho || '')}</td><td class="r num">${e.vezes || 1}</td></tr>`).join('')}</tbody></table></div></div></div>${ajuda}`;
}
acoes.errApagar = async () => {
  const ids = (DB.cache.erros || []).map(e => e.id);
  if (!ids.length) return;
  sheet(`Apagar os ${ids.length} registro(s) de erro?`, 'Faça isso depois que o problema foi corrigido.', [{ t: 'Apagar todos', id: 'sim', ic: I.lixo }, { t: 'Cancelar', id: 'nao' }], async o => {
    if (o.id !== 'sim') return;
    try { await DB.apagarErros(ids); toast('Registros de erro apagados.'); } catch (e) { toast('Não foi possível apagar: ' + e.message); }
  });
};
export function vConfigModulo(view) {
  if (view === 'cfsaude') return vCfSaude();
  if (view === 'cfconf') return vCfConf();
  if (view === 'cfuso') return vCfUso();
  if (view === 'cferros') return vCfErros();
  if (view === 'cflimpa') return vLimpeza();
  if (view === 'cflgpd') return vLgpd();
  if (view === 'cfhist') return vHistorico();
  if (view === 'cffotos') return vCfFotos();
  if (view === 'cfarqfotos') return vArqFotos();
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
  const todas = (DB.cache.plano[a] || []).filter(p => p.ativo !== false);
  const rts = rotasDa(a).filter(r => r.rota !== 'GESTÃO').map(r => r.rota);
  // Filtros: rota e busca (atividade, local/equipamento, código ou tipo)
  const fr = UI.pRota && [...new Set(todas.map(p => p.rota))].includes(UI.pRota) ? UI.pRota : '';
  const q = semAcento(UI.pQ || '').toLowerCase().trim();
  const ps = todas.filter(p => (!fr || p.rota === fr) && (!q || semAcento([p.id, p.ativ, p.local, p.tipo, p.rota].join(' ')).toLowerCase().includes(q)));
  const contaRota = new Map(); todas.forEach(p => contaRota.set(p.rota, (contaRota.get(p.rota) || 0) + 1));
  const rotasPlano = [...contaRota.keys()].sort((x, y) => (rts.indexOf(x) + 1 || 999) - (rts.indexOf(y) + 1 || 999) || x.localeCompare(y));
  // Rota → local/equipamento → atividades (a mesma lógica do Apontar: o líder abre o local e marca o checklist dele).
  const ordemRota = r => rotasPlano.indexOf(r);
  const porRota = new Map(); for (const p of ps) { if (!porRota.has(p.rota)) porRota.set(p.rota, []); porRota.get(p.rota).push(p); }
  const blocos = [...porRota.keys()].sort((x, y) => ordemRota(x) - ordemRota(y)).flatMap(r => agruparLocais(porRota.get(r)).map(g => ({ rota: r, ...g })));
  const LIM = UI.more || 60; let usados = 0; const vis = [];
  for (const g of blocos) { if (usados >= LIM) break; vis.push(g); usados += g.itens.length; }
  const resto = ps.length - usados;
  const parec = locaisParecidos(todas);
  const locaisArea = [...new Set(todas.map(p => String(p.local || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  const linha = p => `<tr><td class="mono muted">${p.id}</td><td><select class="in pin" data-prota="${p.id}" data-opts="rota" aria-label="Rota de ${p.id}"><option selected>${esc(p.rota)}</option></select></td><td><input class="in pin" data-pcampo="${p.id}|local" value="${esc(p.local)}" maxlength="120" aria-label="Local de ${p.id}" title="Mudar só nesta atividade (para mudar o local inteiro, use o nome no cabeçalho)"></td><td><input class="in pin" data-pcampo="${p.id}|ativ" value="${esc(p.ativ)}" maxlength="120" aria-label="Atividade ${p.id}"></td><td><select class="in pin" data-pcampo="${p.id}|tipo" data-opts="tipo" aria-label="Tipo de ${p.id}"><option selected>${esc(p.tipo)}</option></select></td>${[...p.dias].map((c, k) => `<td class="c"><button class="tog" data-ptog="${p.id}|${k}" aria-pressed="${c === '1'}" aria-label="${DAYS[k]}">✓</button></td>`).join('')}<td class="r num">${[...p.dias].filter(c => c === '1').length}</td><td>${UI.confirm === 'del:' + p.id ? `<span class="confirm"><button class="btn danger" data-act="del" data-id="${p.id}">Excluir</button><button class="btn" data-act="cancel">Não</button></span>` : `<button class="btn ghost danger" data-act="askDel" data-id="${p.id}" aria-label="Excluir ${p.id}">✕</button>`}</td></tr>`;
  const cabLocal = g => { const n = g.itens.length; const porDia = DAYS.map((_, k) => g.itens.filter(p => p.dias[k] === '1').length); const tot = porDia.reduce((a2, b2) => a2 + b2, 0);
    return `<tr class="plocal-h"><td colspan="14"><div class="pl-cab"><span class="tag">${esc(g.rota)}</span><input class="in" data-plnome="${esc(a + '|' + g.rota + '|' + g.local)}" value="${esc(g.local)}" maxlength="120" aria-label="Nome do local ${esc(g.local)} (muda em todas as atividades dele)" title="Mudar aqui troca o nome em todas as atividades deste local"><span class="pl-n num">${n} ${n === 1 ? 'atividade' : 'atividades'} · ${tot} por semana</span><span class="plano-dias" aria-label="Dias com atividade">${DL.map((d, k) => `<span class="${porDia[k] ? 'on' : ''}" title="${DAYS[k]}: ${porDia[k]} atividade${porDia[k] === 1 ? '' : 's'}">${d}</span>`).join('')}</span><button type="button" class="btn sm" data-act="planoNoLocal" data-k="${esc(g.rota + '|' + g.local)}">${I.plus} Atividade neste local</button></div></td></tr>`; };
  return `<div class="filters"><label class="sel"><span>Área</span><select class="in" id="fPArea">${AREAS.map(x => `<option value="${x}" ${x === a ? 'selected' : ''}>${AREA_S[x]}</option>`).join('')}</select></label>
   <label class="sel"><span>Rota</span><select class="in" id="fPRota"><option value="">Todas as rotas (${todas.length})</option>${rotasPlano.map(r => `<option value="${esc(r)}" ${r === fr ? 'selected' : ''}>${esc(r)} (${contaRota.get(r)})</option>`).join('')}</select></label>
   <div class="sel wide"><span>Buscar</span>${caixaBusca('fPQ', UI.pQ || '', 'Atividade, local, equipamento ou código')}</div>
   ${fr || q ? `<button class="btn sm ghost" data-act="limparPF" style="align-self:flex-end">Limpar filtros</button>` : ''}
   <span class="muted" style="align-self:flex-end">${fr || q ? `${ps.length} de ${todas.length}` : ps.length} atividades em ${blocos.length} ${blocos.length === 1 ? 'local' : 'locais'} · rota, local, atividade e tipo mudam na hora; os dias e as atividades tiradas ou incluídas valem na Programação de hoje em diante, também nos meses já gerados</span></div>
  ${parec.length ? `<div class="card"><header><h2>Locais com nome quase igual</h2><p>O Apontar mostra cada nome como um local separado. Junte para ficar um local só.</p></header><div class="body"><ul class="pparec">${parec.map(g => `<li><span class="tag">${esc(g.rota)}</span>${g.nomes.map(x => `<b>${esc(x.nome)}</b> <span class="muted num">(${x.n})</span>`).join(' · ')}${UI.confirm === 'junta:' + g.rota + '|' + g.chave ? `<span class="confirm"><button class="btn pri sm" data-act="juntarLocais" data-k="${esc(g.rota + '|' + g.chave)}">Juntar como “${esc(g.nomes[0].nome)}”</button><button class="btn sm" data-act="cancel">Não</button></span>` : `<button class="btn sm" data-act="askJuntar" data-k="${esc(g.rota + '|' + g.chave)}">Juntar</button>`}</li>`).join('')}</ul></div></div>` : ''}
  <div class="card"><header><h2>Nova atividade</h2><p>Escolha um local que já existe (ou digite um novo) e escreva uma atividade por linha para incluir várias de uma vez.</p></header><div class="body"><form id="fNova" class="form">
   <label class="sel"><span>Rota</span><select class="in" id="nRota">${rts.map(r => `<option>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel wide"><span>Local / equipamento</span><input class="in" id="nLocal" required list="nLocais" autocomplete="off" placeholder="Ex.: CORREIA C5613A"><datalist id="nLocais">${locaisArea.map(l => `<option value="${esc(l)}"></option>`).join('')}</datalist></label>
   <label class="sel wide"><span>Atividades <small class="muted">(uma por linha)</small></span><textarea class="in" id="nAtiv" required rows="2" placeholder="Ex.: Mesa impacto - Lavagem"></textarea></label>
   <label class="sel"><span>Tipo</span><select class="in" id="nTipo">${tipos().map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
   <div class="sel"><span>Dias</span><div class="row-gap tight diastog">${DL.map((d, k) => `<button type="button" class="tog lbl-on" data-ntog="${k}" aria-pressed="${k < 5}" aria-label="${DAYS[k]}">${d}</button>`).join('')}</div></div>
   <button class="btn pri" type="submit">${I.plus} Adicionar</button>
  </form></div></div>
  <div class="card"><div class="tw"><table><thead><tr><th>ID</th><th>Rota</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th>${DAYS.map(d => `<th class="c">${d}</th>`).join('')}<th class="r">Freq.</th><th></th></tr></thead><tbody>
  ${vis.map(g => cabLocal(g) + g.itens.map(linha).join('')).join('')}
  </tbody></table></div>${resto > 0 ? `<div class="body pt0"><button class="btn center" style="white-space:normal;max-width:100%" data-act="more" data-n="${LIM + 120}">Mostrar mais (faltam ${resto})</button></div>` : ''}</div>`;
}

// Plano padrão por local: "+ Atividade neste local" já preenche a rota e o local da Nova atividade.
acoes.planoNoLocal = (t, d) => { const [r, ...l] = d.k.split('|'); const f = $('fNova'); if (!f) return; if ($('nRota')) $('nRota').value = r; $('nLocal').value = l.join('|'); f.scrollIntoView({ block: 'center' }); $('nAtiv').focus(); };
// Locais com nome quase igual: junta todos no nome mais usado (vale também nos meses já gerados, que apontam para o plano).
acoes.askJuntar = (t, d) => { UI.confirm = 'junta:' + d.k; render(); };
acoes.juntarLocais = (t, d) => {
  if (!admDe('ativ')) return; UI.confirm = null;
  const a = UI.pArea; const [r, ch] = d.k.split('|'); const g = locaisParecidos(DB.cache.plano[a] || []).find(x => x.rota === r && x.chave === ch); if (!g) { render(); return; }
  const alvo = g.nomes[0].nome; let n = 0;
  const itens = DB.cache.plano[a].map(p => (p.rota === r && p.local !== alvo && chaveParecida(p.local) === ch ? (n++, { ...p, local: alvo }) : p));
  DB.cache.plano[a] = itens; DB.savePlano(a, itens); rebuild();
  DB.log(`Plano padrão: locais juntados em "${alvo}" (${r}) · ${g.nomes.slice(1).map(x => x.nome).join(', ')}`, 'operacao');
  toast(`${n} atividade${n === 1 ? '' : 's'} passaram para “${alvo}”`); render();
};

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
  return `<div class="grid2 noprint"><div class="card"><header><h2>Gerar novo mês</h2><p>Cada semana (seg–dom) entra no mês da sua quinta-feira</p></header><div class="body stackcol">
   <label class="sel"><span>Mês</span><select class="in" id="gMes">${opts.map(o => `<option value="${o}" ${o === UI.gMes ? 'selected' : ''}>${monthLabel(o)}</option>`).join('')}</select></label>
   <div class="tw"><table><thead><tr><th>Semana</th>${per.map(x => `<th class="r">${AREA_S[x.a]}</th>`).join('')}</tr></thead><tbody>${ws.map((w, i) => `<tr><td>S${i + 1} · ${ddmm(w)} a ${ddmm(add(w, 6))}</td>${per.map(x => `<td class="r num">${x.n}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="row-gap"><button class="btn pri" data-act="gerar" ${UI.busy ? 'disabled' : ''}>${I.gerador} ${UI.busy ? 'Gerando…' : 'Gerar ' + monthLabel(UI.gMes)}</button><span class="muted num">${ws.length} semanas × ${per.reduce((n, x) => n + x.n, 0)} atividades</span></div>
  </div></div>
  <div class="card"><header><h2>Meses gerados</h2></header><div class="body"><div class="plist">${ms.map(m => `<div class="pitem"><div><div class="t">${monthLabel(m)}</div><div class="l num">${weeksOfMonth(m).length} semanas</div></div>${m === CUR_MONTH ? '<span class="pill ok">atual</span>' : m > CUR_MONTH ? '<span class="pill neu">futuro</span>' : '<span class="pill neu">anterior</span>'}</div>`).join('')}</div></div></div></div>${folhaPlanejamento()}`;
}

// Folha de planejamento (no modelo da Folha do líder): as atividades do plano padrão, por rota, com as caixas dos dias
// em branco para a liderança marcar à mão em que dias vai atender cada uma. Coluna "Hoje" = dias atuais no plano.
function folhaPlanejamento() {
  if (!AREAS.includes(UI.gfArea)) UI.gfArea = AREAS[0];
  const area = UI.gfArea;
  const todas = (DB.cache.plano[area] || []).filter(p => p.ativo !== false);
  const ordem = rotasDa(area).map(r => r.rota);
  const rts = [...new Set(todas.map(p => p.rota))].sort((x, y) => (ordem.indexOf(x) + 1 || 999) - (ordem.indexOf(y) + 1 || 999) || x.localeCompare(y));
  if (UI.gfRota !== 'TODAS' && !rts.includes(UI.gfRota)) UI.gfRota = 'TODAS';
  const lid = COLABS.find(c => c.area === area && /^L[IÍ]DER/.test(c.funcao || ''));
  const lider = UI.lider || (lid ? title(lid.nome) : '');
  const hoje = p => [...(p.dias || '')].map((c, k) => (c === '1' ? DAYS[k].slice(0, 3) : '')).filter(Boolean).join(' ') || '—';
  const usadas = rts.filter(r => UI.gfRota === 'TODAS' || r === UI.gfRota);
  const filtros = `<div class="card noprint"><header><h2>Folha de planejamento para a liderança</h2><p>Sai no modelo da Folha do líder, uma folha por rota, com as caixas dos dias em branco. O líder marca à mão em que dias vai atender cada atividade e devolve assinada para ajustar o Plano padrão.</p></header><div class="body"><div class="filters">
   <label class="sel"><span>Área</span><select class="in" id="gfArea">${AREAS.map(x => `<option value="${x}" ${x === area ? 'selected' : ''}>${AREA_S[x]}</option>`).join('')}</select></label>
   <label class="sel"><span>Rota</span><select class="in" id="gfRota"><option value="TODAS">Todas (${rts.length})</option>${rts.map(r => `<option ${r === UI.gfRota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
   <label class="sel"><span>Líder</span><input class="in" id="fLider" value="${esc(lider)}"></label>
   ${!framed ? `<button class="btn pri" data-act="print" style="align-self:flex-end" ${usadas.length ? '' : 'disabled'}>${I.print} Imprimir / salvar PDF</button>` : ''}
  </div>${usadas.length > 1 ? `<p class="muted small m0">${usadas.length} rotas · cada rota sai numa folha separada.</p>` : ''}</div></div>`;
  if (!usadas.length) return filtros + '<div class="card"><div class="empty">Nenhuma atividade no Plano padrão desta área.</div></div>';
  const folha = rota => { let n = 0; const grupos = agruparLocais(todas.filter(p => p.rota === rota));
    return `<div class="paper folha"><div class="hd"><div><h3>PLANEJAMENTO SEMANAL DE ATIVIDADES</h3><div class="meta"><span><b>Área:</b> ${AREA_S[area]}</span><span><b>Rota:</b> ${esc(rota)}</span><span><b>Vale a partir de:</b> ____/____/________</span></div><div class="meta"><span class="liderTxt"><b>Líder responsável:</b> ${esc(lider || '_______________________')}</span><span>Marque ✓ nos dias em que a atividade será atendida</span></div></div><div class="rt small"><img class="plogo" src="img/dikma-logo.png" alt="Dikma"><br>${esc(SETS[SK].local)}</div></div>
  <table><thead><tr><th>Nº</th><th>Local / equipamento</th><th>Atividade</th><th>Tipo</th><th>Hoje no plano</th>${DAYS.map(d => `<th class="c">${d}</th>`).join('')}<th style="width:120px">Observação</th></tr></thead><tbody>
  ${grupos.map(g => g.itens.map(p => `<tr><td class="c">${++n}</td><td>${esc(p.local)}</td><td>${esc(p.ativ)}</td><td>${esc(p.tipo || '')}</td><td class="small">${hoje(p)}</td>${DAYS.map(() => '<td class="c"><span class="box"></span></td>').join('')}<td class="obs"></td></tr>`).join('')).join('')}
  </tbody></table><div class="sign"><div>Líder</div><div>Supervisor</div></div></div>`; };
  return filtros + `<div class="tw folhas">${usadas.map(folha).join('')}</div>`;
}

/* ---------------- USUÁRIOS ---------------- */
// Acesso por módulo (fase 1 da divisão em 5 módulos): uma linha por módulo com o perfil, os escopos e as áreas.
// Ao salvar grava o modelo novo (acesso, escopos) E os campos antigos tirados dele (papel, modulos, áreas), que são o
// que as telas e as regras ainda usam (gravação dupla; ver legadoDoAcesso em acessos.js).
// Áreas em botões de marcar, um grupo por conjunto (Pátio, Bateria): o líder marca 1, o supervisor quantas precisar.
const areaChips = (px, marcadas) => `<div class="sel uareas" role="group" aria-label="Áreas"><span>Áreas <small class="muted">(líder: 1 · supervisor: quantas precisar)</small></span>${Object.values(SETS).map(st => `<div class="uagrupo"><small class="muted">${st.curto}</small><div class="mchips">${st.areas.map(a => `<label class="mchip"><input type="checkbox" name="${px}Areas" value="${a}" data-acf="${px}" ${marcadas.includes(a) ? 'checked' : ''}><span>${AREA_S[a]}</span></label>`).join('')}</div></div>`).join('')}</div>`;
const MOD_ANTIGO = { operacao: 'Atividades Pátio', bateria: 'Atividades Bateria', equipamentos: 'Equipamentos', gestao: 'Fichas', frequencia: 'Frequência e férias' };
// px = prefixo dos ids (nu = novo usuário, ea = editar acesso), para os dois formulários não repetirem ids.
export function formAcesso(px, st) {
  const a = st.acesso || {}; const esc_ = new Set(st.escopos || []);
  const linhas = MODULOS_ACESSO.map(m => `<div class="acm"><div class="minw"><b>${m.nome}</b><small class="muted">${m.sub}</small></div><select class="in" id="${px}M_${m.k}" data-acf="${px}" aria-label="Perfil em ${m.nome}"><option value="">Sem acesso</option>${m.perfis.map(p => `<option value="${p}" ${a[m.k] === p ? 'selected' : ''}>${perfilNome(m.k, p)}</option>`).join('')}</select>${m.k === 'gestao' ? `<label class="switch acfi"><input type="checkbox" id="${px}Fichas" data-acf="${px}" ${st.fichas !== false ? 'checked' : ''}><span class="small">Com as Fichas de acompanhamento</span></label>` : ''}</div>`).join('');
  return `<div class="acf"><div class="acms">${linhas}</div>
   <div class="ur r2 uesc"><div class="sel"><span>Escopos</span><div class="mchips">${ESCOPOS.map(([k, n]) => `<label class="mchip"><input type="checkbox" id="${px}E_${k}" data-acf="${px}" ${esc_.has(k) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
   ${areaChips(px, areasDoCadastro(st, true))}</div>
   <p class="muted small m0 acres" id="${px}Res" aria-live="polite">${resumoAcesso(st)}</p></div>`;
}
export function lerAcesso(px) {
  const acesso = {};
  for (const m of MODULOS_ACESSO) { const v = $(px + 'M_' + m.k).value; if (v) acesso[m.k] = v; }
  const bl = $(px + 'Bloq');
  return { acesso, escopos: ESCOPOS.map(e => e[0]).filter(k => $(px + 'E_' + k).checked), fichas: $(px + 'Fichas').checked, areas: [...document.querySelectorAll(`input[name="${px}Areas"]:checked`)].map(i => i.value), bloqueado: !!(bl && bl.checked) };
}
// Como o acesso funciona HOJE (campos antigos), em uma linha, para o administrador conferir antes de salvar.
export function resumoAcesso(st) {
  const a = st.acesso || {};
  if (!Object.keys(a).length) return 'Escolha o perfil em pelo menos um módulo.';
  if (a.administracao === 'admin') return 'Administrador: vê e faz tudo em todos os módulos.';
  const v = legadoDoAcesso(a, st.escopos, st);
  const partes = MODULOS_ACESSO.filter(m => a[m.k]).map(m => `${m.nome}: ${perfilNome(m.k, a[m.k])}`);
  const semEsc = (a.operacao || a.gestao || a.indicadores) && !(st.escopos || []).length;
  return `Cada módulo usa o seu perfil: <b>${esc(partes.join(' · '))}</b>.${semEsc ? ' Sem escopo (Pátio, Bateria ou Equipamentos), a Operação, a Gestão e os Indicadores ficam vazios.' : ''}${a.indicadores ? ' Indicadores: vê os números dos escopos marcados' + (a.indicadores === 've' && areasDoCadastro(st, true).length && v.area ? ', só da área dele.' : ', de todas as áreas.') : ''}${areasDoCadastro(st, true).length && !v.area ? ' A área não se aplica a estes perfis (veem todas ou nenhuma).' : ''}`;
}
// Confere o formulário e devolve os campos para gravar (modelo novo + antigos). uid = quem está sendo editado.
export function validarAcesso(st, uid) {
  const a = st.acesso;
  if (!Object.keys(a).length) throw new Error('Escolha o perfil em pelo menos um módulo.');
  if (a.operacao && !st.escopos.length) throw new Error('A Operação precisa de pelo menos um escopo: Pátio, Bateria ou Equipamentos.');
  if (a.indicadores && !st.escopos.length) throw new Error('Os Indicadores precisam de pelo menos um escopo: Pátio, Bateria ou Equipamentos.');
  const v = legadoDoAcesso(a, st.escopos, st);
  const ativ = v.modulos.includes('operacao') || v.modulos.includes('bateria');
  if (ativ && [a.operacao, a.gestao].some(p => ['lider', 'supervisor'].includes(p)) && !v.area) throw new Error('Escolha a área do líder ou supervisor.');
  if (v.area && v.areas.length < areasDoCadastro(st, true).length) throw new Error('O líder fica com uma área só. Para mais de uma área, escolha Supervisor na Operação ou na Gestão.');
  for (const [i, ar] of v.areas.entries()) { const k = setDaArea(ar); if ((ativ || i > 0) && k && !st.escopos.includes(k)) throw new Error(`A área ${AREA_S[ar]} é do escopo ${SETS[k].curto}. Marque esse escopo.`); }
  if (uid && uid === ME.uid) {
    if (st.bloqueado) throw new Error('Você não pode bloquear o seu próprio usuário.');
    const admins = DB.cache.usuarios.filter(u => u.papel === 'admin').length;
    if (ME.papel === 'admin' && v.papel !== 'admin' && admins < 2) throw new Error('Antes, deixe outra pessoa como administrador.');
  }
  return { acesso: a, escopos: st.escopos, papel: v.papel, modulos: v.modulos, acessos: v.acessos, area: v.area, area2: v.area2, areas: v.areas };
}
export const textoAcesso = a => selosAcesso(a).map(([m, p]) => `${m} · ${p}`).join(', ') || 'sem acesso';
function selosDe(u) {
  const r = acessoDe(u);
  // Administrador: um selo só (tem todos os módulos).
  const selos = r.acesso.administracao === 'admin' ? ['<span class="pill neu selo"><b>Administrador</b> · todos os módulos</span>'] : selosAcesso(r.acesso).map(([m, p, k]) => `<span class="pill neu selo" data-mod="${k}"><b>${m}</b> · ${esc(p)}${k === 'gestao' && !r.fichas && u.papel !== 'admin' ? ' <small>(sem fichas)</small>' : ''}</span>`);
  const esc_ = r.escopos.length && r.acesso.administracao !== 'admin' ? `<span class="small muted esc">${r.escopos.map(e => ESCOPOS.find(x => x[0] === e)[1]).join(' · ')}</span>` : '';
  const tags = u.papel === 'bloqueado' ? '<span class="pill bad">Bloqueado</span>' : '';
  return `<div class="selos">${tags}${selos.join('') || '<span class="muted small">Sem acesso</span>'}${esc_}</div>`;
}
const areaTxt = u => { const ps = ['operacao', 'gestao'].map(m => perfilDe(u, m)).filter(Boolean); const l = ps.some(p => ['lider', 'supervisor'].includes(p)) ? areasDoCadastro(u, ps.includes('supervisor')).map(a => AREA_S[a] || a) : []; return l.length ? l.join(' · ') : ps.some(p => ['admin', 'gestor', 'coordenador', 'tecnico', 'leitor', 'administrativo'].includes(p)) ? '<span class="muted small">Todas</span>' : '<span class="muted">—</span>'; };
export function vUsuarios() {
  const us = DB.cache.usuarios.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const ativos = us.filter(u => u.papel !== 'bloqueado').length;
  const limU = matchMedia('(max-width:860px)').matches ? UI.more || 10 : us.length; // celular: 10 por vez
  if (!UI.nuAcesso) UI.nuAcesso = { acesso: { operacao: 'lider' }, escopos: ['patio'], fichas: true };
  return `<div class="mini"><div><b class="num">${ativos}</b><span>Ativos</span></div><div><b class="num">${us.length - ativos}</b><span>Bloqueados</span></div></div>
  <details class="card dobra" data-dobra="u-novo"${abre('u-novo')}><summary><h2>Novo usuário</h2><p>A pessoa entra com o usuário e a senha provisória e cria a própria senha no primeiro acesso. Escolha o perfil em cada módulo que ela usa.</p></summary><div class="body"><form id="fNovoUser" class="uform" novalidate>
   <div class="ur r1"><label class="sel"><span>Nome</span><input class="in" id="nuNome" required placeholder="Ex.: Maria Aparecida Souza"></label>
   <label class="sel"><span>Usuário</span><input class="in" id="nuLogin" required autocapitalize="none" spellcheck="false" placeholder="ex.: maria.souza"></label>
   <label class="sel"><span>Senha provisória</span><input class="in" id="nuSenha" required minlength="8" value="${esc(UI.senhaSug || (UI.senhaSug = senhaAleatoria()))}"></label></div>
   ${formAcesso('nu', UI.nuAcesso)}
   <div class="row-gap"><button class="btn pri" type="submit" ${UI.busy ? 'disabled' : ''}>${I.plus} ${UI.busy ? 'Cadastrando…' : 'Cadastrar usuário'}</button></div>
   <p class="err m0" id="nuErr" role="alert" hidden></p>
  </form></div></details>
  <div class="card"><header><h2>Acessos</h2><p>Um perfil em cada módulo que a pessoa usa</p></header><details class="legdet body pb0 pt0"><summary>Como funcionam os perfis</summary><p class="small m0">Cada pessoa tem um perfil em cada módulo que usa. <b>Operação</b> e <b>Gestão</b>: líder (1 área), supervisor (quantas áreas precisar), técnico de processo (aprova e devolve os apontamentos em todas as áreas do Pátio ou da Bateria; não aponta), coordenador e gestor (todas as áreas), somente leitura; a Gestão tem também o Administrativo. <b>Segurança</b>: registra (vê só o que registrou), trata e gestor (veem e tratam tudo) ou somente leitura; o supervisor da área (Operação) também vê e trata as anomalias da área dele. <b>RH</b>: Administrativo ou somente leitura. <b>Indicadores</b>: Vê (só os números, dos escopos marcados; quem tem área de líder ou supervisor vê só a dele) ou Gestor (todas as áreas; vai editar as metas). <b>Administração</b>: completa (administrador) ou só a dos módulos da pessoa (como o gestor faz hoje). Os escopos (Pátio, Bateria e Equipamentos) dizem quais conjuntos a pessoa vê. O que cada perfil vê dentro dos módulos fica em <b>Perfis e permissões</b>.</p></details><div class="tw"><table class="tcard utab"><thead><tr><th>Pessoa</th><th>Usuário</th><th>Acesso por módulo</th><th>Áreas</th><th>Abas</th><th></th></tr></thead><tbody>
  ${us.slice(0, limU).map(u => `<tr${u.papel === 'bloqueado' ? ' class="ubloq"' : ''}><td class="tc-t"><b>${esc(title(u.nome))}</b>${u.trocarSenha ? '<div class="small" style="color:var(--st-atr)">Ainda não criou a própria senha</div>' : ''}</td><td class="mono tc-s">${u.login ? esc(u.login) : '<span class="muted">conta Google</span>'}</td><td class="tc-full" data-l="Acesso por módulo">${selosDe(u)}</td><td data-l="Áreas">${areaTxt(u)}</td><td class="tc-full" data-l="Abas">${celulaAbas(u)}</td><td class="uacts tc-acao"><button class="btn sm" data-uacesso="${u.uid}" aria-label="Editar o acesso de ${esc(u.login || u.nome)}">${I.users} Acesso</button>${u.uid !== ME.uid ? `${u.login ? `<button class="btn sm" data-reset="${u.uid}" title="Redefinir senha">${I.key} Senha</button>` : ''}<button class="btn sm ghost danger" data-udel="${u.uid}" aria-label="Apagar o usuário ${esc(u.login || u.nome)}">Apagar</button>` : '<span class="pill neu">você</span>'}</td></tr>`).join('')}
  </tbody></table></div>${us.length > limU ? `<div class="body pt0"><button class="btn center" data-act="more" data-n="${limU + 20}">Mostrar mais ${Math.min(20, us.length - limU)} (faltam ${us.length - limU})</button></div>` : ''}</div>`;
}
// Editar o acesso de uma pessoa (mesmo formulário do novo usuário, mais o bloqueio).
export function editarAcessoSheet(uid) {
  const u = DB.cache.usuarios.find(x => x.uid === uid); if (!u) return;
  const r = acessoDe(u);
  const st = { ...r, areas: areasDoCadastro(u, [perfilDe(u, 'operacao'), perfilDe(u, 'gestao')].includes('supervisor')), bloqueado: u.papel === 'bloqueado' };
  const html = `${formAcesso('ea', st)}
   ${uid !== ME.uid ? `<label class="switch"><input type="checkbox" id="eaBloq" data-acf="ea" ${st.bloqueado ? 'checked' : ''}><span class="small">Bloqueado: não entra no sistema (o acesso acima fica guardado para quando desbloquear)</span></label>` : ''}`;
  formSheet('Acesso de ' + title(u.nome), u.login ? `<span class="mono">${esc(u.login)}</span>` : 'conta Google', html, 'Salvar acesso', async () => {
    const patch = validarAcesso(lerAcesso('ea'), uid);
    await DB.setUsuario(uid, patch);
    DB.log(`Acesso de ${u.login || u.nome}: ${patch.papel === 'bloqueado' ? 'bloqueado · ' : ''}${textoAcesso(patch.acesso)}`, 'administracao');
    toast('Acesso atualizado');
  });
}
// Abas que a pessoa pode ter, conforme os módulos dela (com o módulo de cada uma; Avisos no celular fica de fora: todos veem).
const viewsDaPessoa = u => { const ms = modsDe(u); return VIEWS.filter(v => !v.livre && (v.mod === 'all' ? ms.length > 0 : ms.includes(v.mod)) && (() => { const m = v.mod === 'all' ? ms.find(x => x !== 'administracao') || 'operacao' : v.mod; const p = perfilDe(u, m); return p && p !== 'admin' && configuravel(m, p, v); })() && (!v.reqU || v.reqU(u))); };
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
    DB.log(`Ajustou as abas de ${u.nome}${abas ? '' : ' (padrão do perfil)'}`, 'administracao');
    toast(abas ? 'Abas personalizadas salvas' : 'Voltou ao padrão do perfil');
  });
}

/* ---------------- PERFIS E PERMISSÕES ---------------- */
// Uma tabela por módulo (abas × perfis daquele módulo). Rascunho em UI.perm até salvar, com as chaves novas
// 'módulo|perfil'; o que estava gravado no formato antigo (uma chave por perfil) entra no rascunho já convertido.
const abasDoModulo = mod => VIEWS.filter(v => !v.livre && (v.mod === mod || (v.mod === 'all' && mod !== 'administracao')) && !['usuarios', 'perfis', 'gimport'].includes(v.id));
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
const permR = (R, mod, p, id) => { const x = R[chavePerm(mod, p)]; if (x && typeof x[id] === 'boolean') return x[id]; const it = ITENS.find(i => i.id === id); return !(it && (it.off || []).includes(p)); };
export function vPerfis() {
  const R = rascunhoPerm(); const cfg = permCfg();
  const mod = GRUPOS_ABAS.some(g => g.mod === UI.permMod) ? UI.permMod : 'operacao';
  const mudouEm = m => PERFIS_MOD[m].some(([p]) => abasDoModulo(m).some(v => configuravel(m, p, v) && permR(R, m, p, v.id) !== doPerfil(m, p, v, cfg)) || ITENS.some(it => it.mod === m && itemDoPapel(p, it) && permR(R, m, p, it.id) !== itemPerfil(m, p, it, cfg)));
  const mudou = GRUPOS_ABAS.some(g => mudouEm(g.mod));
  const mudouP = (m, p) => abasDoModulo(m).some(v => configuravel(m, p, v) && permR(R, m, p, v.id) !== doPerfil(m, p, v, cfg)) || ITENS.some(it => it.mod === m && itemDoPapel(p, it) && permR(R, m, p, it.id) !== itemPerfil(m, p, it, cfg));
  const us = DB.cache.usuarios.filter(u => perfilDe(u, 'administracao') !== 'admin' && u.papel !== 'bloqueado');
  const comExc = us.filter(u => resumoExcecao(u, viewsDaPessoa(u), cfg).tem);
  const perfis = PERFIS_MOD[mod];
  // No celular aparece um perfil por vez (o escolhido em UI.permPerfil); no computador, todos lado a lado.
  const pSel = perfis.some(([p]) => p === UI.permPerfil) ? UI.permPerfil : perfis[0][0];
  const pc = p => `c pc${p === pSel ? ' on' : ''}`;
  const vs = abasDoModulo(mod); let g0 = '';
  const linhas = vs.map(v => { const cab = v.grp !== g0 ? (g0 = v.grp, `<tr class="grp-row"><th colspan="${perfis.length + 2}">${esc(v.grp)}</th></tr>`) : ''; return cab + `<tr><td><b>${esc(v.nome)}</b></td><td class="c pa muted" aria-label="Administrador sempre vê">✓</td>${perfis.map(([p, n]) => { const ok = configuravel(mod, p, v); return ok ? `<td class="${pc(p)}"><input type="checkbox" class="tgl" data-perm="${mod}|${p}|${v.id}" ${permR(R, mod, p, v.id) ? 'checked' : ''} aria-label="${esc(v.nome)} para ${esc(n)}"></td>` : `<td class="${pc(p)} muted" title="Só o administrador">—</td>`; }).join('')}</tr>`; }).join('')
    + ITENS.filter(it => it.mod === mod).map(it => `<tr class="item-perm"><td><span class="it-ic" aria-hidden="true">↳</span> ${esc(it.nome)}<div class="muted small">${esc(it.d)}</div></td><td class="c pa muted" aria-label="Administrador sempre pode">✓</td>${perfis.map(([p, n]) => (itemDoPapel(p, it) ? `<td class="${pc(p)}"><input type="checkbox" class="tgl" data-perm="${mod}|${p}|${it.id}" ${permR(R, mod, p, it.id) ? 'checked' : ''} aria-label="${esc(it.nome)} para ${esc(n)}"></td>` : `<td class="${pc(p)} muted" title="Este perfil não faz isso">—</td>`)).join('')}</tr>`).join('');
  const nomeSeg = g => (g.mod === 'administracao' ? '<span class="pm-lg">Administração</span><span class="pm-cu">Admin</span>' : esc(g.t));
  const abasMod = `<div class="seg permseg" role="tablist" aria-label="Módulo">${GRUPOS_ABAS.map(g => `<button type="button" role="tab" data-permmod="${g.mod}" aria-selected="${g.mod === mod}">${nomeSeg(g)}${mudouEm(g.mod) ? ' •' : ''}</button>`).join('')}</div>`;
  const selPerfil = `<label class="permpf"><span class="small muted">Perfil</span><select class="in" data-permperfil aria-label="Perfil mostrado">${perfis.map(([p, n]) => `<option value="${p}" ${p === pSel ? 'selected' : ''}>${esc(n)}${mudouP(mod, p) ? ' •' : ''}</option>`).join('')}</select></label>`;
  return `<div class="card"><header><h2>Abas e ações por perfil, em cada módulo</h2><p>Cada pessoa tem um perfil em cada módulo; aqui se escolhe o que cada perfil vê e faz dentro do módulo. O administrador pode tudo sempre · Pátio e Bateria usam a mesma configuração</p></header><div class="body pt0 stackcol">${abasMod}${selPerfil}<details class="calc"><summary>Como ler esta tabela</summary><p>Abas: desligada = some do menu e não abre nem por link.</p><p>Ações (↳): o que o perfil pode fazer dentro das abas; desligada = o botão some. — = o perfil não faz isso.</p><p>Na Administração, só o perfil “Dos módulos” pode ter abas ligadas.</p></details></div>
  <div class="tw"><table class="perm"><thead><tr><th>Aba · ${esc(MODULO_ACESSO[mod].nome)}</th><th class="c pa">Admin<br><small>sempre tudo</small></th>${perfis.map(([p, n]) => `<th class="${pc(p)}">${esc(n)}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody></table></div>
  <div class="body row-gap"><button class="btn pri" data-act="permSalvar" ${mudou ? '' : 'disabled'}>${mudou ? 'Salvar permissões' : 'Tudo salvo'}</button><button class="btn" data-act="permPadrao">Voltar ao padrão</button>${mudou ? '<button class="btn ghost" data-act="permDesfazer">Desfazer</button>' : ''}<span class="muted small">O que cada perfil pode alterar continua valendo pelo perfil (as regras de segurança conferem).</span></div></div>
  <div class="card"><header><h2>Exceção por pessoa</h2><p>Opcional. Abra <b>Usuários e acessos</b> e use <b>Personalizar</b> na coluna Abas para dar ou tirar abas de uma pessoa sem mudar o perfil inteiro.</p></header>
  ${comExc.length ? `<div class="tw"><table><thead><tr><th>Pessoa</th><th>Acesso</th><th>Abas</th></tr></thead><tbody>${comExc.map(u => `<tr><td><b>${esc(title(u.nome))}</b></td><td>${esc(textoAcesso(acessoDe(u).acesso))}</td><td>${celulaAbas(u)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="body"><p class="muted m0">Ninguém com exceção. Todos seguem o padrão do perfil.</p></div>'}</div>`;
}


/* ---------------- CONFIG ---------------- */
export function vConfig() {
  return `<div class="card"><header><h2>Rotas</h2><p>Efetivo padrão (quadro previsto) e carga padrão (pico diário de atividades)</p></header><div class="body pt0"><button class="btn pri" data-act="novaRota">+ Nova rota</button></div><div class="tw"><table><thead><tr><th>Área</th><th>Rota</th><th class="r">Efetivo padrão</th><th class="r">Carga padrão</th><th class="r">Colaboradores</th><th></th></tr></thead><tbody>
  ${rotas().map((r, i) => `<tr><td class="muted">${AREA_S[r.area]}</td><td><input class="in pin" data-rnome="${i}" value="${esc(r.rota)}" maxlength="60" aria-label="Nome da rota ${esc(r.rota)}" title="Mudar o nome troca também no plano padrão e nos colaboradores da rota"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|ef" value="${r.ef}" aria-label="Efetivo padrão ${esc(r.rota)}"></td><td class="r"><input class="in num numin" type="number" min="0" data-rcfg="${i}|carga" value="${r.carga}" aria-label="Carga padrão ${esc(r.rota)}"></td><td class="r num">${COLABS.filter(c => c.area === r.area && c.rota === r.rota).length}</td><td class="r">${UI.confirm === 'rdel:' + i ? `<span class="confirm"><button class="btn danger" data-act="rotaExcluir" data-i="${i}">Excluir</button><button class="btn" data-act="cancel">Não</button></span>` : `<button class="btn ghost danger" data-act="rotaAskDel" data-i="${i}" aria-label="Excluir a rota ${esc(r.rota)}" title="Excluir rota">✕</button>`}</td></tr>`).join('')}
  </tbody></table></div></div>
  ${rotasExcluidas().length ? `<div class="card"><header><h2>Rotas excluídas</h2><p>Ficam guardadas aqui. Restaurar devolve a rota com o mesmo efetivo e carga padrão</p></header><div class="tw"><table><thead><tr><th>Área</th><th>Rota</th><th class="r">Efetivo padrão</th><th class="r">Carga padrão</th><th></th></tr></thead><tbody>
  ${rotasExcluidas().map((r, i) => `<tr><td class="muted">${esc(AREA_S[r.area] || r.area)}</td><td><b>${esc(r.rota)}</b></td><td class="r num">${r.ef}</td><td class="r num">${r.carga}</td><td class="r"><button class="btn" data-act="rotaRestaurar" data-i="${i}">Restaurar</button></td></tr>`).join('')}
  </tbody></table></div></div>` : ''}

  <div class="card"><header><h2>Tipos de atividade</h2></header><div class="body"><div class="rchips">${tipos().map(t => `<span class="rchip">${esc(t)}</span>`).join('')}</div></div></div>
  ${cartaoAjustesHE()}`;
}

// Nova rota: escolhe a área do conjunto, nome, efetivo e carga padrão. Entra logo depois das rotas da mesma área.
acoes.novaRota = () => {
  if (!admDe('ativ')) return;
  const areas = SETS[SK].areas;
  formSheet('Nova rota', esc(SETS[SK].nome), `<label class="sel"><span>Área</span><select class="in" id="nrArea">${areas.map(a => `<option value="${a}">${esc(AREA_S[a])}</option>`).join('')}</select></label>
  <label class="sel"><span>Nome da rota</span><input class="in" id="nrNome" maxlength="60" required autocomplete="off" style="text-transform:uppercase" placeholder="Ex.: ROTA DO SOL"></label>
  <div class="row-gap"><label class="sel"><span>Efetivo padrão</span><input class="in num" id="nrEf" type="number" min="0" value="1"></label><label class="sel"><span>Carga padrão</span><input class="in num" id="nrCarga" type="number" min="0" value="0"></label></div>`, 'Criar rota', async () => {
    const area = $('nrArea').value; const nome = String($('nrNome').value || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!areas.includes(area)) throw new Error('Escolha a área.');
    if (!nome) throw new Error('Digite o nome da rota.');
    if (rotas().some(r => r.area === area && r.rota === nome)) throw new Error('Já existe uma rota com esse nome nesta área.');
    const nova = { area, rota: nome, ef: Math.max(0, +$('nrEf').value || 0), carga: Math.max(0, +$('nrCarga').value || 0) };
    const rs = [...rotas()]; rs.splice(posNaArea(rs, area), 0, nova);
    DB.cache.config.rotas = rs; await DB.saveRotas(rs); rebuild();
    DB.log(`Rota criada: ${nome} (${AREA_S[area]})`, 'operacao'); toast(`Rota ${nome} criada`); render();
  });
};

// Excluir rota: só quando está vazia (sem colaboradores e sem atividades no plano padrão), para não deixar nada sem rota.
// A rota excluída fica guardada em config.rotasExcluidas e pode ser restaurada.
const rotasExcluidas = () => (DB.cache.config && DB.cache.config.rotasExcluidas) || [];
const posNaArea = (rs, area) => { const areas = SETS[SK].areas; for (let j = rs.length - 1; j >= 0; j--) if (rs[j].area === area) return j + 1; const ia = areas.indexOf(area); const k = rs.findIndex(r => areas.indexOf(r.area) > ia); return k >= 0 ? k : rs.length; };
acoes.rotaAskDel = (t, d) => {
  const r = rotas()[+d.i]; if (!r) return;
  const nC = COLABS.filter(c => c.area === r.area && c.rota === r.rota).length;
  const nP = (DB.cache.plano[r.area] || []).filter(x => x.rota === r.rota && x.ativo !== false).length;
  if (nC || nP) { toast(`Não dá para excluir ${r.rota}: ainda tem ${[nC ? `${nC} colaborador${nC === 1 ? '' : 'es'}` : '', nP ? `${nP} atividade${nP === 1 ? '' : 's'} no plano padrão` : ''].filter(Boolean).join(' e ')}. Passe para outra rota antes.`); return; }
  UI.confirm = 'rdel:' + d.i; render();
};
acoes.rotaExcluir = async (t, d) => {
  if (!admDe('ativ')) return;
  const i = +d.i; const r = rotas()[i]; UI.confirm = null; if (!r) return render();
  const rs = rotas().filter((x, j) => j !== i); const ex = [...rotasExcluidas(), r];
  DB.cache.config.rotas = rs; DB.cache.config.rotasExcluidas = ex; await DB.saveConfig({ rotas: rs, rotasExcluidas: ex }); rebuild();
  DB.log(`Rota excluída: ${r.rota} (${AREA_S[r.area]})`, 'operacao'); toast(`Rota ${r.rota} excluída · dá para restaurar mais abaixo`); render();
};
acoes.rotaRestaurar = async (t, d) => {
  if (!admDe('ativ')) return;
  const i = +d.i; const r = rotasExcluidas()[i]; if (!r) return;
  if (rotas().some(x => x.area === r.area && x.rota === r.rota)) { toast('Já existe uma rota com esse nome nesta área. Mude o nome dela antes de restaurar.'); return; }
  const rs = [...rotas()]; rs.splice(posNaArea(rs, r.area), 0, r); const ex = rotasExcluidas().filter((x, j) => j !== i);
  DB.cache.config.rotas = rs; DB.cache.config.rotasExcluidas = ex; await DB.saveConfig({ rotas: rs, rotasExcluidas: ex }); rebuild();
  DB.log(`Rota restaurada: ${r.rota} (${AREA_S[r.area]})`, 'operacao'); toast(`Rota ${r.rota} restaurada`); render();
};

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
    for (const it of ITENS) if (it.mod === g.mod && itemDoPapel(p, it)) { const on = permR(R, g.mod, p, it.id); if (!on) o[it.id] = false; else if ((it.off || []).includes(p)) o[it.id] = true; } // item desligado de fábrica: grava o 'ligado'
    out[k] = o;
  }
  await DB.salvarPermissoes(out); UI.perm = null; DB.log('Alterou as abas por perfil', 'administracao'); toast('Permissões salvas'); render();
};
acoes.permPadrao = (t, d) => { UI.perm = {}; render(); toast('Padrão carregado. Salve para aplicar'); };
acoes.permDesfazer = (t, d) => { UI.perm = null; render(); };
acoes.escSalvar = async (t, d) => {
  const R = rascEsc();
  const mudouFer = JSON.stringify((DB.cache.escalas && DB.cache.escalas.feriados) || []) !== JSON.stringify(R.feriados);
  const salvo = DB.salvarEscalas({ regimes: R.regimes, feriados: R.feriados });
  // mantém a Operação igual: turmas 4x4 também no cadastro dela
  const t4 = (R.regimes['4x4'] || {}).turmas || {};
  if (VIEWS.find(v => v.id === 'econfig').req() && DB.cache.e && DB.cache.e.config) DB.eSalvarConfig({ turmas: Object.fromEntries(Object.entries(t4).filter(([, v]) => v)) });
  UI.escR = null; DB.log('Atualizou as escalas e turnos', 'administracao'); toast('Escalas salvas · valem para todos os módulos'); render();
  if (!mudouFer) return;
  if (!isAdmin()) { toast('Escalas salvas · as atividades dos feriados são ajustadas pela rotina automática em até 1 hora'); return; }
  try { await salvo; await aplicarFeriadosAtividades(); } catch (err) { toast('Não foi possível aplicar os feriados agora: ' + (err.message || err) + ' · a rotina automática tenta de novo em até 1 hora'); }
};
// Feriados nas atividades (feriados.js): o administrador aplica em todos os meses gerados do Pátio e da Bateria.
// Lê as semanas e as aprovações do servidor mês a mês e grava só o que muda, em lotes de até 400.
// A rotina do GitHub (integracao/avisos) faz a mesma conta de hora em hora, para quem não passou por aqui.
let aplicandoFer = false;
export async function aplicarFeriadosAtividades() {
  if (!isAdmin() || aplicandoFer) return null;
  aplicandoFer = true;
  try {
    const { fer, completo } = await DB.feriadosAtuais();
    const ops = []; const n = { feriado: 0, volta: 0 };
    for (const k of SET_KEYS) {
      const C = x => SETS[k].pre + x;
      const cfg = (await DB.limpezaLerIds(C('config'), ['sistema']))[0]; if (!cfg) continue;
      for (const m of cfg.meses || []) {
        const [sem, ap] = await Promise.all([DB.limpezaLer(C('semanas'), [['mes', '==', m]]), DB.limpezaLer(C('aprov'), [['mes', '==', m]])]);
        const plano = FE.planoFeriados(sem, fer, { desfazer: completo, aprov: Object.fromEntries(ap.map(a => [a.id, a.v || {}])) });
        const c = FE.contarPlano(plano); n.feriado += c.feriado; n.volta += c.volta;
        for (const x of plano) ops.push({ tipo: 'alterar', col: C('semanas'), id: x.id, campos: x.campos });
      }
    }
    if (!ops.length) { toast('Feriados: as atividades já estavam certas'); return n; }
    toast(`Aplicando feriados: ${n.feriado + n.volta} atividades`);
    for (let i = 0; i < ops.length; i += 400) await DB.limpezaGravar(ops.slice(i, i + 400));
    const txt = [n.feriado ? `${n.feriado} fora da conta (feriado)` : '', n.volta ? `${n.volta} voltaram a programadas` : ''].filter(Boolean).join(' · ');
    DB.log(`Feriados nas atividades: ${txt}`, 'operacao'); toast(`Feriados aplicados: ${txt}`); render();
    return n;
  } finally { aplicandoFer = false; }
}
acoes.escDescartar = (t, d) => { UI.escR = null; render(); };
acoes.escFicha = (t, d) => {
  let n = 0;
  for (const k of setsDe(ME)) for (const a of areasDoSet(k)) {
    const itens = (DB.dados(k).colabs || {})[a] || []; let mudou = false;
    const novos = itens.map(c => { const rg = escala().regimes[normRegime(c.regime, escala().regimes)]; if (rg && rg.tipo === 'ciclo' && !letra(c.turma)) { const tf = turmaFicha(c.nome); if (tf) { mudou = true; n++; return { ...c, turma: tf }; } } return c; });
    if (mudou) DB.salvarColabsArea(a, novos, k);
  }
  DB.log(`Gravou ${n} turma(s) a partir das fichas do Efetivo`, 'operacao'); toast(`${n} turma(s) gravadas`); render();
};
acoes.askDel = (t, d) => { UI.confirm = 'del:' + d.id; render(); };
acoes.limparPF = (t, d) => { UI.pRota = ''; UI.pQ = ''; UI.more = 0; render(); };
acoes.del = (t, d) => {
  const p = PL.get(d.id); const itens = DB.cache.plano[p.area].map(x => (x.id === d.id ? { ...x, ativo: false } : x));
  DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); DB.log(`Plano padrão: removeu ${p.id} · ${p.ativ}`, 'operacao'); UI.confirm = null; toast(`${p.id} removida do plano`); render(); planoNaProgramacao({ ...p, ativo: false });
};
acoes.gerar = async (t, d) => {
  UI.busy = true; render();
  try { await DB.gerarMes(UI.gMes, DB.cache.plano); DB.log(`Gerou a programação de ${monthLabel(UI.gMes)}`, 'operacao'); toast(`${monthLabel(UI.gMes)} gerado`); UI.mes = UI.gMes; UI.ini = null; UI.gMes = null; }
  catch (err) { toast('Erro ao gerar: ' + err.message); }
  UI.busy = false; render();
};
acoes.importar = async (t, d) => {
  UI.busy = true; render();
  try {
    const seed = await DB.seed(SETS[SK].seed);
    await DB.importar(seed, [CUR_MONTH, addMonth(CUR_MONTH, 1), addMonth(CUR_MONTH, 2)], UI.impIni);
    DB.log('Importou os dados da planilha e gerou a programação', 'operacao'); toast('Dados importados');
  } catch (err) { toast('Erro ao importar: ' + err.message); }
  UI.busy = false; render();
};
