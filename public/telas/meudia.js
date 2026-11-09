// Dikma Gestão — "Meu dia": tudo o que é da pessoa hoje, de todos os módulos dela, numa tela só.
import { abre } from '../ui/dobra.js';
import { resumoTreinos } from '../contas/treinos.js';
import { SETS, SET_KEYS, AREA_S, SITS, MESES_L, add, today, ddmm } from '../contas/cal.js';
import { resumoAtividades, paradasAbertas, assinaturasPendentes, operadoresFora } from '../contas/hoje.js';
import { aprovaPapel, contarPendentes } from '../contas/aprovacao.js';

const DIAS_L = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true, atividades: true, semanal: true, aprovacao: true, painel: true, seguranca: true, treinos: true };

export function criarMeuDia(X) {
  const { DB, esc, title, I, toast, render } = X;
  const ME = () => X.ME;
  const sitNome = c => (SITS.find(s => s[0] === c) || [c, c])[1];
  const h1 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ST = { suportado: null, ocupado: false, erro: '' };
  DB.avisosSuportados().then(v => { ST.suportado = v; }).catch(() => { ST.suportado = false; });

  // O que a pessoa enxerga em cada módulo
  const temMod = m => X.modsDe(ME()).includes(m);
  // Perfil em cada módulo (Operação, Gestão, RH): cada bloco usa o perfil do módulo de onde vem.
  const P = m => (X.perfil ? X.perfil(m) : ME().papel);
  const pAtiv = () => P('operacao') || P('gestao'); // atividades: o da Operação; sem Operação, o da Gestão
  const ehAdm = () => P('administracao') === 'admin';
  const todas = m => pAtiv() === 'admin' || (['gestor', 'coordenador', 'administrativo', 'leitor'].includes(pAtiv()) && temMod(m));
  function areasDe(k) {
    if (!temMod(SETS[k].mod)) return [];
    if (todas(SETS[k].mod)) return SETS[k].areas;
    const u = ME(); return [...new Set([u.area, pAtiv() === 'supervisor' ? u.area2 : null].filter(a => a && SETS[k].areas.includes(a)))];
  }

  // Os meses e as paradas já são carregados no login (data.js); aqui só esperamos chegar tudo,
  // para desenhar a tela uma vez só, sem números pulando.
  let esperaDesde = 0;
  function pronto() {
    const m = today().slice(0, 7);
    for (const k of SET_KEYS) if (temMod(SETS[k].mod)) { const st = DB.dados(k); if (!st || !st.configLoaded) return false; if (st.config && !st.monthsLoaded.has(m)) return false; }
    if (temMod('equipamentos') && !(DB.cache.e && DB.cache.e.loaded)) return false;
    if (temMod('gestao') && !(DB.cache.g && DB.cache.g.loaded)) return false;
    return true;
  }
  const ESQ = '<div class="md-hero skel-hero"><div class="skel"><i></i><i></i></div></div><div class="md-tiles">' + '<div class="md-tile skel"><i></i><i></i></div>'.repeat(4) + '</div><div class="md-grid"><div class="card skel"><i></i><i></i><i></i><i></i></div><div class="card skel"><i></i><i></i><i></i><i></i></div></div>';

  function dadosDoSet(k) {
    const st = DB.dados(k); if (!st || !st.config) return null;
    const sit = {}; for (const v of Object.values(st.sitByMonth || {})) Object.assign(sit, v);
    const cob = {}; for (const v of Object.values(st.sitExtra || {})) Object.assign(cob, (v && v.cob) || {});
    return resumoAtividades({ cob,
      areas: areasDe(k), plano: SETS[k].areas.flatMap(a => st.plano[a] || []), semanas: st.semanas,
      colabs: SETS[k].areas.flatMap(a => st.colabs[a] || []), sit, rotas: st.config.rotas || [], hoje: today(),
      sitDe: X.sitEscala ? X.sitEscala(key => sit[key]) : undefined, fator: X.fatorRota
    });
  }

  // Quem só consulta (visitante) não vê botão de ação: só "Ver". O laranja fica para a ação principal da faixa de abertura.
  const soLer = () => ['operacao', 'gestao', 'seguranca', 'rh'].map(P).filter(Boolean).every(p => p === 'leitor') && !(X.seg && X.seg() && X.seg().trata);
  const ir = (mod, view, area, txt) => (soLer() ? (view === 'gnovaoc' ? '' : `<button class="btn sm" data-md="${mod}|${view}|${area || ''}">Ver</button>`) : `<button class="btn sm" data-md="${mod}|${view}|${area || ''}">${txt}</button>`);
  const vazio = t => `<p class="muted small m0">${t}</p>`;

  function cardAvisos() {
    const cfg = DB.cache.avisosCfg || {}; const meus = DB.cache.meusAvisos; const ativo = DB.avisoAtivoAqui();
    const prefs = { ...PREFS_PADRAO, ...((meus && meus.prefs) || {}) };
    const opcoes = [
      temMod('equipamentos') && ['paradas', 'Parada sem liberação há mais de 2 horas'],
      temMod('gestao') && P('gestao') !== 'leitor' && ['assinaturas', 'Assinatura com você ou da sua área há mais de 7 dias (às 8h)'],
      (temMod('operacao') || temMod('bateria')) && ['lider', 'supervisor'].includes(P('operacao')) && ['atividades', 'Atividades do dia ainda sem apontar (às 15h)'],
      (temMod('operacao') || temMod('bateria')) && P('operacao') === 'lider' && ['aprovacao', 'Atividade devolvida pelo supervisor (na hora)'],
      (temMod('operacao') || temMod('bateria')) && aprovaPapel(P('operacao')) && ['aprovacao', 'Apontamentos esperando sua aprovação há mais de 1 dia (às 8h)'],
      (temMod('operacao') || temMod('bateria')) && ['deficit', 'Rota com déficit de efetivo amanhã (às 17h)'],
      (temMod('operacao') || temMod('bateria')) && ['supervisor', 'coordenador', 'gestor'].includes(P('operacao')) && ['justificativas', 'Faltas e atrasos de hoje sem justificativa (às 16h)'],
      (ehAdm() || ['gestor', 'coordenador'].includes(pAtiv())) && ['semanal', 'Resumo da semana que passou (segunda, às 7h)'],
      X.seg && X.seg() && ['seguranca', X.seg().trata ? 'Anomalia nova na sua área e prazo do tratamento que está com você' : 'Prazo do tratamento das anomalias que estão com você'],
      P('rh') && ['treinos', 'Treinamentos e ASO vencidos ou vencendo em 30 dias (segunda, às 7h)'],
      ehAdm() && ['painel', 'Meu painel: tarefas do dia (7h), pendências e lançamentos da Medição (16h)']
    ].filter(Boolean);
    let corpo;
    if (!cfg.vapid) corpo = ehAdm()
      ? `<p class="small m0">Para ligar os avisos, cole a <b>chave pública Web Push</b> do Firebase (Configurações do projeto › Cloud Messaging › Certificados push da Web › Gerar par de chaves). Passo a passo no README.</p>
         <div class="row-gap"><input class="in grow" id="mdVapid" placeholder="Chave pública (começa com B…)" autocomplete="off"><button class="btn pri" data-md-av="vapid">Salvar chave</button></div>`
      : vazio('O administrador ainda não ligou os avisos no celular.');
    else if (!opcoes.length) corpo = vazio('Seus módulos não têm avisos.');
    else corpo = `<div class="avst ${ativo ? 'on' : ''}"><span class="dot"></span><div class="minw"><b>${ativo ? 'Avisos ligados neste aparelho' : 'Avisos desligados neste aparelho'}</b><small>${ativo ? 'Você recebe os avisos marcados abaixo, mesmo com o sistema fechado.' : ST.suportado ? 'Ligue para receber no celular, mesmo com o sistema fechado.' : 'Este navegador não recebe avisos. No iPhone, adicione o sistema à Tela de Início e abra por lá.'}</small></div>
        ${ativo ? `<button class="btn ghost sm" data-md-av="testar">Testar neste aparelho</button><button class="btn sm" data-md-av="desligar" ${ST.ocupado ? 'disabled' : ''}>Desligar</button>` : `<button class="btn pri sm" data-md-av="ligar" ${ST.ocupado || !ST.suportado ? 'disabled' : ''}>${ST.ocupado ? 'Ligando…' : 'Ligar avisos'}</button>`}</div>
      <div class="mchips">${opcoes.map(([k, t]) => `<label class="mchip"><input type="checkbox" data-md-pref="${k}" ${prefs[k] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      ${ST.erro ? `<p class="err m0">${esc(ST.erro)}</p>` : ''}`;
    if (cfg.vapid && ehAdm()) corpo += estadoRotina();
    return `<div class="card"><header><h2>Avisos no celular</h2></header><div class="body stackcol" style="gap:12px">${corpo}</div></div>`;
  }

  // Administrador: como a rotina do GitHub está indo (gravado por ela a cada execução).
  function estadoRotina() {
    const e = DB.cache.avisosEstado;
    if (!e || !e.ultimaExecucao) return '<p class="small muted m0">A rotina ainda não rodou. Ela roda de hora em hora, das 6h às 22h (GitHub › Actions › Avisos no celular).</p>';
    const d = e.ultimaExecucao, r = e.ultimoResultado || {};
    const quando = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const atrasada = Date.now() - d.getTime() > 3 * 36e5 && new Date().getHours() >= 7 && new Date().getHours() <= 22;
    return `<p class="small m0 ${atrasada ? 'err' : 'muted'}">Rotina: última execução em ${quando}${atrasada ? ' (atrasada: confira em GitHub › Actions › Avisos no celular)' : ''} · ${e.pessoas || 0} pessoa(s) com aviso ligado em ${e.aparelhos || 0} aparelho(s) · ${r.entregues || 0} aviso(s) entregue(s)${r.falhas ? `, ${r.falhas} falha(s)` : ''}.</p>`;
  }

  function view() {
    if (!pronto()) {
      if (!esperaDesde) esperaDesde = Date.now();
      if (Date.now() - esperaDesde < 5000) { setTimeout(() => render(), 400); return ESQ; } // sem sinal: depois de 5 s mostra o que tiver
    }
    esperaDesde = 0;
    const u = ME(); const hoje = today(); const agora = new Date();
    const blocos = []; const tiles = []; const progresso = [];
    // atividades (Pátio e Bateria)
    for (const k of SET_KEYS) {
      const mod = SETS[k].mod; if (!temMod(mod)) continue;
      const areas = areasDe(k);
      const r = dadosDoSet(k);
      if (!r) { blocos.push(`<div class="card"><header><h2>${SETS[k].nome}</h2></header><div class="body">${vazio('Programação ainda não importada.')}</div></div>`); continue; }
      if (!areas.length) continue;
      const nomeAreas = areas.length === SETS[k].areas.length ? 'todas as áreas' : areas.map(a => AREA_S[a]).join(' e ');
      if (r.hoje.total) progresso.push({ nome: `${SETS[k].curto} · hoje`, sub: nomeAreas, feitas: r.hoje.R + r.hoje.E + r.hoje.N, total: r.hoje.total, go: [mod, 'apontar', areas.length === 1 ? areas[0] : ''] });
      if (r.atrasadas) { // número principal: últimos 7 dias, com as rotas onde estão; o total de 60 dias vai no detalhe
        const rec = r.atrasadasRecentes; const rts = r.atrasadasRotas.slice(0, 3).map(x => `${x.rota} (${x.n})`).join(', ');
        tiles.push(rec
          ? { n: rec, t: `${rec === 1 ? 'atrasada' : 'atrasadas'} nos últimos 7 dias · ${SETS[k].curto}`, s: `${rts ? 'mais em ' + rts + ' · ' : ''}${r.atrasadas.toLocaleString('pt-BR')} nos últimos 60 dias`, tom: 'bad', go: [mod, 'pend', areas.length === 1 ? areas[0] : ''] }
          : { n: r.atrasadas, t: `${r.atrasadas === 1 ? 'atrasada antiga' : 'atrasadas antigas'} · ${SETS[k].curto}`, s: `nenhuma nos últimos 7 dias · ${rts ? 'mais em ' + rts + ' · ' : ''}últimos 60 dias`, tom: 'warn', go: [mod, 'pend', areas.length === 1 ? areas[0] : ''] }); }
      { const st = DB.dados(k); // aprovação dos apontamentos: o supervisor vê o que falta aprovar; o líder, o que voltou para corrigir
        const noPlano = (ids => pid => ids.has(pid))(new Set(SETS[k].areas.flatMap(a => (st.plano[a] || []).map(p => p.id)))); // o mesmo filtro da Aprovação
        if (aprovaPapel(P('operacao'))) { const n = contarPendentes(st.semanas, st.aprov, areas, hoje, 'pend', noPlano); if (n) tiles.push({ n, t: `apontamentos para aprovar · ${SETS[k].curto}`, s: 'o líder apontou; confira e aprove', tom: 'warn', go: [mod, 'aprovar', ''], acao: 'Aprovar' }); }
        else if (P('operacao') === 'lider') { const n = contarPendentes(st.semanas, st.aprov, areas, hoje, 'dev', noPlano); if (n) tiles.push({ n, t: `devolvidas pelo supervisor · ${SETS[k].curto}`, s: 'confira o motivo e aponte de novo', tom: 'bad', go: [mod, 'apontar', areas.length === 1 ? areas[0] : ''], acao: 'Corrigir' }); } }
      // Fotos das atividades: realizadas sem foto desde que a foto ficou obrigatória (supervisor para cima).
      if (X.semFoto && ['admin', 'gestor', 'coordenador', 'supervisor'].includes(pAtiv())) { const n = X.semFoto(k, areas); if (n) tiles.push({ n, t: `${n > 1 ? 'realizadas sem foto' : 'realizada sem foto'} · ${SETS[k].curto}`, s: 'desde que a foto ficou obrigatória (últimos 60 dias) · no Apontar, toque em “sem foto” para anexar', tom: 'warn', go: [mod, 'apontar', areas.length === 1 ? areas[0] : ''], acao: 'Ver' }); }
      if (r.deficit.length) tiles.push({ n: r.deficit.length, t: `${r.deficit.length === 1 ? 'rota' : 'rotas'} com déficit amanhã · ${SETS[k].curto}`, s: `${ddmm(r.amanha)}`, tom: 'bad', go: [mod, 'escala', r.deficit[0].area] });
      const pend = r.rotas.filter(x => x.total);
      blocos.push(`<div class="card md-card"><header><h2>${SETS[k].nome}</h2><p>Hoje · ${esc(nomeAreas)}</p><span class="r">${ir(mod, 'apontar', areas.length === 1 ? areas[0] : '', `${I.apontar} Apontar`, true)}</span></header><div class="body stackcol" style="gap:14px">
        ${pend.length ? `<div class="md-rotas">${pend.slice(0, 8).map(x => { const feitas = x.R + x.E + x.N; const pc = Math.round(feitas / x.total * 100); return `<button class="md-rota" data-md="${mod}|apontar|${x.area}"><div class="minw"><b>${esc(x.rota)}</b><small>${AREA_S[x.area]}</small></div><div class="md-bar"><i style="width:${pc}%"></i></div><span class="num">${x.P ? `<b>${x.P}</b> a fazer` : '<span class="ok">✓ tudo apontado</span>'}</span></button>`; }).join('')}${pend.length > 8 ? `<p class="muted small m0">+ ${pend.length - 8} rotas</p>` : ''}</div>` : vazio('Nenhuma atividade programada para hoje.')}
        ${r.faltas.length ? `<div><div class="md-sub">Quem falta hoje (${r.faltas.length})</div><div class="md-pessoas">${r.faltas.map(f => `<span class="md-pessoa"><b>${esc(title(f.nome))}</b><small>${esc(f.rota)} · <span class="sit ${f.cod}">${f.cod}</span> ${esc(sitNome(f.cod))}</small></span>`).join('')}</div></div>` : ''}
        ${r.deficit.length ? `<div><div class="md-sub bad">Déficit de efetivo amanhã (${ddmm(r.amanha)})</div><div class="plist">${r.deficit.map(x => `<div class="pitem"><div class="minw"><div class="t">${esc(x.rota)}</div><div class="l">${AREA_S[x.area]} · ${x.prog} atividades programadas</div></div><span class="cell num bad">${x.disp}/${x.nec}</span></div>`).join('')}</div></div>` : ''}
      </div></div>`);
      if (r.faltas.length) tiles.push({ n: r.faltas.length, t: `faltando hoje · ${SETS[k].curto}`, s: [...new Set(r.faltas.map(f => sitNome(f.cod).toLowerCase()))].slice(0, 3).join(', '), tom: 'neu', go: [mod, 'escala', areas.length === 1 ? areas[0] : ''] });
    }
    // Operação (equipamentos)
    if (temMod('equipamentos')) {
      const E = DB.cache.e;
      if (E && E.loaded && E.config) {
        const ab = paradasAbertas(E.par || [], agora); const longas = ab.filter(p => p.horas >= 2);
        const fora = operadoresFora((E.cad && E.cad.operadores) || [], hoje);
        if (ab.length) tiles.push({ n: ab.length, t: 'paradas sem liberação', s: longas.length ? `${longas.length} há mais de 2 h` : 'todas com menos de 2 h', tom: longas.length ? 'bad' : 'warn', go: ['equipamentos', 'epar', ''] });
        blocos.push(`<div class="card md-card"><header><h2>Equipamentos</h2><p>Lançamentos, frota e operadores</p><span class="r">${ir('equipamentos', 'elanc', '', `${I.apontar} Lançar`, true)}</span></header><div class="body stackcol" style="gap:14px">
          ${ab.length ? `<div><div class="md-sub ${longas.length ? 'bad' : ''}">Paradas sem liberação (${ab.length})</div><div class="plist">${ab.slice(0, 3).map(p => `<div class="pitem"><div class="minw"><div class="t"><span class="mono">${esc(p.eq)}</span> · ${esc(p.causa || 'sem causa')}</div><div class="l">desde ${ddmm(p.data)} às ${p.ini}${p.op ? ' · ' + esc(title(p.op)) : ''}</div></div><span class="pill ${p.horas >= 2 ? 'bad' : 'warn'}">há ${p.horas >= 24 ? Math.floor(p.horas / 24) + ' d' : h1(p.horas) + ' h'}</span></div>`).join('')}</div>${ab.length > 3 ? `<p class="muted small m0">+ ${ab.length - 3}</p>` : ''}<div class="row-gap" style="margin-top:8px">${ir('equipamentos', 'epar', '', 'Abrir paradas')}</div></div>` : vazio('Nenhuma parada sem liberação.')}
          ${fora.length ? `<div><div class="md-sub">Operadores fora hoje (${fora.length})</div><div class="md-pessoas">${fora.map(f => `<span class="md-pessoa"><b>${esc(title(f.nome))}</b><small>${esc(title(f.cod))}</small></span>`).join('')}</div></div>` : ''}
        </div></div>`);
      }
    }
    // Efetivo (fichas)
    if (temMod('gestao')) {
      const G = DB.cache.g;
      if (G && G.loaded && G.config) {
        const a = assinaturasPendentes(G.ocorr || [], hoje);
        const exp = (G.colabs || []).filter(c => (!c.dem || c.dem > hoje) && c.adm).map(c => ({ c, d: Math.round((new Date(hoje) - new Date(c.adm)) / 864e5) })).filter(x => (x.d >= 38 && x.d <= 45) || (x.d >= 83 && x.d <= 90));
        const nk = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
        const comigo = (G.ocorr || []).filter(o => o.status === 'pendente' && o.recolhe && nk(o.recolhe) === nk(ME().nome));
        if (comigo.length) tiles.push({ n: comigo.length, t: 'assinaturas para você recolher', s: [...new Set(comigo.map(o => title(o.nome).split(' ')[0]))].slice(0, 3).join(', '), tom: comigo.some(o => o.data <= add(hoje, -7)) ? 'bad' : 'warn', go: ['frequencia', 'gcomigo', ''], acao: 'Recolher' });
        if (a.total) tiles.push({ n: a.total, t: 'assinaturas pendentes', s: a.velhas.length ? `${a.velhas.length} há mais de 7 dias` : 'todas recentes', tom: a.velhas.length ? 'bad' : 'warn', go: ['frequencia', 'gocorr', ''] });
        if (exp.length) tiles.push({ n: exp.length, t: 'experiências vencendo', s: '45 ou 90 dias nesta semana', tom: 'warn', go: ['paineis', 'gpainel', ''] });
        blocos.push(`<div class="card md-card"><header><h2>Fichas</h2><p>Fichas de acompanhamento</p><span class="r">${ir('frequencia', 'gnovaoc', '', `${I.plus} Ocorrência`, true)}</span></header><div class="body stackcol" style="gap:14px">
          ${a.total ? `<div><div class="md-sub ${a.velhas.length ? 'bad' : ''}">Aguardando assinatura (${a.total})</div><div class="plist">${(a.velhas.length ? a.velhas : (G.ocorr || []).filter(o => o.status === 'pendente')).slice(0, 3).map(o => `<div class="pitem"><div class="minw"><div class="t">${esc(title(o.nome))}</div><div class="l">${ddmm(o.data)} · ${esc(o.tipo)}</div></div><span class="pill ${o.data <= add(hoje, -7) ? 'bad' : 'warn'}">${Math.round((new Date(hoje) - new Date(o.data)) / 864e5)} dias</span></div>`).join('')}</div></div>` : vazio('Nenhuma assinatura pendente.')}
          ${exp.length ? `<div><div class="md-sub">Experiência vencendo</div><div class="md-pessoas">${exp.slice(0, 12).map(x => `<span class="md-pessoa"><b>${esc(title(x.c.nome))}</b><small>${x.d} dias de casa · fecha ${x.d <= 45 ? '45' : '90'} em ${(x.d <= 45 ? 45 : 90) - x.d} dia(s)</small></span>`).join('')}</div></div>` : ''}
        </div></div>`);
      }
    }
    // Segurança: anomalias vencidas, com a pessoa e abertas na área dela (telas/seguranca.js)
    if (X.seg) { const sg = X.seg(); if (sg) { tiles.push(...sg.tiles); if (sg.bloco) blocos.push(sg.bloco); } }
    // RH: treinamentos, NRs e ASO vencidos e vencendo nos próximos 30 dias (contas/treinos.js)
    { const ad = DB.cache.adm; if (P('rh') && ad && ad.tLoaded) { const r = resumoTreinos(ad.treinos, hoje);
      if (r.vencido) tiles.push({ n: r.vencido, t: r.vencido > 1 ? 'treinamentos ou ASO vencidos' : 'treinamento ou ASO vencido', s: 'NRs, ASO e outros: renovar ou afastar da atividade', tom: 'bad', go: ['rh', 'atrein'], acao: 'Ver' });
      if (r.vence) tiles.push({ n: r.vence, t: r.vence > 1 ? 'treinamentos ou ASO vencem em 30 dias' : 'treinamento ou ASO vence em 30 dias', s: 'programe a renovação', tom: 'warn', go: ['rh', 'atrein'], acao: 'Ver' }); } }
    // Justificativas e check-in: contados por conjunto (Pátio e Bateria), não pelo módulo aberto antes
    for (const k of SET_KEYS) {
      if (X.jusPend) { const n = X.jusPend(k); if (n) tiles.push({ n, t: `${n > 1 ? 'faltas e atrasos sem justificativa' : 'falta ou atraso sem justificativa'} · ${SETS[k].curto}`, s: 'últimos 7 dias · abra Justificativas para resolver', tom: 'warn', go: ['gestao', 'esjus', '', k], acao: 'Justificar' }); }
      if (X.checkinPend) { const n = X.checkinPend(k); if (n) tiles.push({ n, t: `${n > 1 ? 'check-ins do turno por confirmar' : 'check-in do turno por confirmar'} · ${SETS[k].curto}`, s: 'confirme a equipe: presente, falta ou atraso', tom: 'warn', go: ['gestao', 'esdia', '', k], acao: 'Fazer' }); }
    }
    const d = new Date(); const nome = title((u.nome || '').split(' ')[0]);
    const saud = d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
    const ordem = { bad: 0, warn: 1, neu: 2, ok: 3 };
    tiles.sort((a, b) => ordem[a.tom] - ordem[b.tom] || b.n - a.n);
    const ACAO = { apontar: 'Apontar', pend: 'Apontar', escala: 'Ver presença', epar: 'Abrir', gocorr: 'Ver', gcomigo: 'Recolher', gpainel: 'Ver fichas' };
    const linha = t => `<div class="md-task ${t.tom}"><span class="s" aria-hidden="true"></span><div class="minw"><b><span class="num">${t.n}</span> ${esc(t.t)}</b><small>${esc(t.s)}</small></div><button class="btn sm" data-md="${t.go.join('|')}">${soLer() ? 'Ver' : t.acao || ACAO[t.go[1]] || 'Abrir'}</button></div>`;
    const urgentes = tiles.filter(t => t.tom === 'bad' || t.tom === 'warn');
    const chips = tiles.filter(t => t.tom === 'neu');
    // Faixa de abertura: só saudação, data e uma frase. Os números e os botões ficam no "Agora", sem repetir.
    const nU = urgentes.length;
    const dataTx = `${DIAS_L[d.getDay()]}, ${d.getDate()} de ${MESES_L[d.getMonth()].toLowerCase()}`;
    const manchete = !nU ? 'Tudo em dia' : soLer() ? `<span class="num">${nU}</span> ${nU === 1 ? 'ponto de atenção' : 'pontos de atenção'} hoje` : `<span class="num">${nU}</span> ${nU === 1 ? 'coisa pede' : 'coisas pedem'} ação hoje`;
    let h = `<div class="md-hero"><div class="md-ht"><p class="md-sd">${saud}, ${esc(nome)} · ${dataTx}</p><h2${nU ? '' : ' class="ok"'}>${manchete}</h2></div></div>`;
    h += `<div class="md-top"><div class="card md-agora"><header><h2>Agora</h2><p>${urgentes.length ? 'Do mais urgente para o menos' : 'Nada pedindo ação'}</p></header><div class="body">${urgentes.length
      ? urgentes.slice(0, 3).map(linha).join('') + (urgentes.length > 3 ? `<details class="md-mais"><summary>Mais ${urgentes.length - 3}</summary>${urgentes.slice(3).map(linha).join('')}</details>` : '')
      : '<p class="md-ok m0"><b>Tudo em dia.</b> Nada pendente nos seus módulos agora.</p>'}</div></div>`;
    if (progresso.length || chips.length) {
      h += `<div class="card md-hoje"><header><h2>Hoje</h2></header><div class="body stackcol" style="gap:12px">${progresso.map(p => { const pc = Math.round(p.feitas / p.total * 100); return `<button class="md-prog" data-md="${p.go.join('|')}"><div class="row-between"><b>${esc(p.nome)}</b><span class="num">${p.feitas} de ${p.total}</span></div><div class="md-bar"><i style="width:${pc}%"></i></div><small class="muted">${esc(p.sub)}${p.feitas < p.total ? ` · faltam ${p.total - p.feitas}` : ' · tudo apontado'}</small></button>`; }).join('')}
        ${chips.length ? `<div class="md-chips">${chips.map(t => `<button class="md-chip" data-md="${t.go.join('|')}"><b class="num">${t.n}</b> ${esc(t.t)}</button>`).join('')}</div>` : ''}</div></div>`;
    }
    h += '</div>';
    // Detalhes por área e avisos: no computador, sempre à vista; no celular, ficam num "Ver detalhes" (tela mais curta),
    // e o que importa agora (Agora e Hoje) aparece primeiro, sem rolar.
    const grade = `<div class="md-grid">${blocos.join('')}${cardAvisos()}</div>`;
    h += matchMedia('(max-width:860px)').matches
      ? `<details class="md-det" data-dobra="mddet"${abre('mddet')}><summary>Detalhes por área e avisos</summary>${grade}</details>`
      : grade;
    return h;
  }

  async function onClick(t) {
    const a = t.dataset.mdAv; if (!a) return false;
    ST.erro = '';
    if (a === 'vapid') { const v = (document.getElementById('mdVapid') || {}).value || ''; if (v.trim().length < 40) { toast('Cole a chave pública completa'); return true; } await DB.salvarChaveAvisos(v); toast('Chave dos avisos salva'); return true; }
    if (a === 'ligar') {
      ST.ocupado = true; render();
      const prefs = { ...PREFS_PADRAO, ...((DB.cache.meusAvisos && DB.cache.meusAvisos.prefs) || {}) };
      try { await DB.ativarAvisos(prefs); toast('Avisos ligados neste aparelho'); testeLocal(); } catch (err) { ST.erro = (err && err.message) || String(err); }
      ST.ocupado = false; render(); return true;
    }
    if (a === 'testar') { await testeLocal(true); return true; }
    if (a === 'desligar') { try { await DB.desativarAvisos(); toast('Avisos desligados neste aparelho'); } catch (err) { ST.erro = (err && err.message) || String(err); } render(); return true; }
    return false;
  }
  // Mostra um aviso de exemplo para a pessoa ver como chega.
  async function testeLocal(avisar) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') { if (avisar) toast('Este aparelho não permite notificações. Libere nas configurações do navegador.'); return; }
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      const op = { body: 'Pronto. É assim que os avisos vão chegar.', icon: 'icons/icon-192.png', tag: 'teste' };
      if (reg) reg.showNotification('Dikma Gestão', op); else new Notification('Dikma Gestão', op);
      if (avisar) toast('Aviso de teste enviado para este aparelho');
    } catch (e) { if (avisar) toast('Não foi possível mostrar o aviso neste aparelho'); }
  }
  function onChange(t) {
    const k = t.dataset.mdPref; if (!k) return false;
    const prefs = { ...PREFS_PADRAO, ...((DB.cache.meusAvisos && DB.cache.meusAvisos.prefs) || {}), [k]: t.checked };
    DB.salvarPrefsAvisos(prefs); toast('Preferência salva'); return true;
  }
  return { view, onClick, onChange };
}
