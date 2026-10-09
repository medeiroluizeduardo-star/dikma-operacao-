// Dikma Operação — "Meu dia": tudo o que é da pessoa hoje, de todos os módulos dela, numa tela só.
import { SETS, SET_KEYS, AREA_S, SITS, MESES_L, add, today, addMonth, ddmm } from './cal.js';
import { resumoAtividades, paradasAbertas, assinaturasPendentes, operadoresFora } from './hoje.js';

const DIAS_L = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true };

export function criarMeuDia(X) {
  const { DB, esc, title, I, toast, render } = X;
  const ME = () => X.ME;
  const sitNome = c => (SITS.find(s => s[0] === c) || [c, c])[1];
  const h1 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ST = { suportado: null, ocupado: false, erro: '' };

  // O que a pessoa enxerga em cada módulo
  const temMod = m => X.modsDe(ME()).includes(m);
  const todas = m => ME().papel === 'admin' || (['gestor', 'coordenador', 'leitor'].includes(ME().papel) && temMod(m));
  function areasDe(k) {
    if (!temMod(SETS[k].mod)) return [];
    if (todas(SETS[k].mod)) return SETS[k].areas;
    const u = ME(); return [...new Set([u.area, u.papel === 'supervisor' ? u.area2 : null].filter(a => a && SETS[k].areas.includes(a)))];
  }

  // Garante em tempo real os meses de que a tela precisa, em cada conjunto (sem mexer no módulo aberto).
  function vigiar() {
    const cur = DB.setAtual ? DB.setAtual() : 'patio', m = today().slice(0, 7);
    for (const k of SET_KEYS) if (temMod(SETS[k].mod)) { DB.useSet(k); DB.watchMonths([addMonth(m, -1), m, addMonth(m, 1)]); }
    DB.useSet(cur);
    if (temMod('equipamentos') && DB.eWatch) DB.eWatch([addMonth(m, -1), m]);
  }

  function dadosDoSet(k) {
    const st = DB.dados(k); if (!st || !st.config) return null;
    const sit = {}; for (const v of Object.values(st.sitByMonth || {})) Object.assign(sit, v);
    return resumoAtividades({
      areas: areasDe(k), plano: SETS[k].areas.flatMap(a => st.plano[a] || []), semanas: st.semanas,
      colabs: SETS[k].areas.flatMap(a => st.colabs[a] || []), sit, rotas: st.config.rotas || [], hoje: today()
    });
  }

  const ir = (mod, view, area, txt, pri) => `<button class="btn ${pri ? 'pri' : ''} sm" data-md="${mod}|${view}|${area || ''}">${txt}</button>`;
  const vazio = t => `<p class="muted small m0">${t}</p>`;

  function cardAvisos() {
    if (ST.suportado === null) { ST.suportado = false; DB.avisosSuportados().then(v => { ST.suportado = v; render(); }); }
    const cfg = DB.cache.avisosCfg || {}; const meus = DB.cache.meusAvisos; const ativo = DB.avisoAtivoAqui();
    const prefs = { ...PREFS_PADRAO, ...((meus && meus.prefs) || {}) };
    const opcoes = [
      temMod('equipamentos') && ['paradas', 'Parada sem liberação há mais de 2 horas'],
      temMod('gestao') && ['assinaturas', 'Assinatura pendente há mais de 7 dias (resumo às 8h)'],
      (temMod('operacao') || temMod('bateria')) && ['deficit', 'Rota com déficit de efetivo amanhã (às 17h)']
    ].filter(Boolean);
    let corpo;
    if (!cfg.vapid) corpo = ME().papel === 'admin'
      ? `<p class="small m0">Para ligar os avisos, cole a <b>chave pública Web Push</b> do Firebase (Configurações do projeto › Cloud Messaging › Certificados push da Web › Gerar par de chaves). Passo a passo no README.</p>
         <div class="row-gap"><input class="in grow" id="mdVapid" placeholder="Chave pública (começa com B…)" autocomplete="off"><button class="btn pri" data-md-av="vapid">Salvar chave</button></div>`
      : vazio('O administrador ainda não ligou os avisos no celular.');
    else if (!opcoes.length) corpo = vazio('Seus módulos não têm avisos.');
    else corpo = `<div class="avst ${ativo ? 'on' : ''}"><span class="dot"></span><div class="minw"><b>${ativo ? 'Avisos ligados neste aparelho' : 'Avisos desligados neste aparelho'}</b><small>${ativo ? 'Você recebe os avisos marcados abaixo, mesmo com o sistema fechado.' : ST.suportado ? 'Ligue para receber no celular, mesmo com o sistema fechado.' : 'Este navegador não recebe avisos. No iPhone, adicione o sistema à Tela de Início e abra por lá.'}</small></div>
        ${ativo ? `<button class="btn sm" data-md-av="desligar" ${ST.ocupado ? 'disabled' : ''}>Desligar</button>` : `<button class="btn pri sm" data-md-av="ligar" ${ST.ocupado || !ST.suportado ? 'disabled' : ''}>${ST.ocupado ? 'Ligando…' : 'Ligar avisos'}</button>`}</div>
      <div class="mchips">${opcoes.map(([k, t]) => `<label class="mchip"><input type="checkbox" data-md-pref="${k}" ${prefs[k] ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
      ${ST.erro ? `<p class="err m0">${esc(ST.erro)}</p>` : ''}`;
    return `<div class="card"><header><h2>Avisos no celular</h2></header><div class="body stackcol" style="gap:12px">${corpo}</div></div>`;
  }

  function view() {
    vigiar();
    const u = ME(); const hoje = today(); const agora = new Date();
    const blocos = []; const tiles = [];
    // atividades (Pátio e Bateria)
    for (const k of SET_KEYS) {
      const mod = SETS[k].mod; if (!temMod(mod)) continue;
      const areas = areasDe(k);
      const r = dadosDoSet(k);
      if (!r) { blocos.push(`<div class="card"><header><h2>${SETS[k].nome}</h2></header><div class="body">${vazio('Programação ainda não importada.')}</div></div>`); continue; }
      if (!areas.length) continue;
      const nomeAreas = areas.length === SETS[k].areas.length ? 'todas as áreas' : areas.map(a => AREA_S[a]).join(' e ');
      if (r.hoje.total) tiles.push({ n: r.hoje.P, t: `para apontar hoje · ${SETS[k].curto}`, s: `${r.hoje.R + r.hoje.E} feitas de ${r.hoje.total}`, tom: r.hoje.P ? 'warn' : 'ok', go: [mod, 'apontar', areas.length === 1 ? areas[0] : ''] });
      if (r.atrasadas) tiles.push({ n: r.atrasadas, t: `atrasadas · ${SETS[k].curto}`, s: 'dias que já passaram sem apontar', tom: 'bad', go: [mod, 'pend', areas.length === 1 ? areas[0] : ''] });
      if (r.deficit.length) tiles.push({ n: r.deficit.length, t: `rota(s) com déficit amanhã · ${SETS[k].curto}`, s: `${ddmm(r.amanha)}`, tom: 'bad', go: [mod, 'escala', r.deficit[0].area] });
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
        blocos.push(`<div class="card md-card"><header><h2>Operação</h2><p>Equipamentos e operadores</p><span class="r">${ir('equipamentos', 'elanc', '', `${I.apontar} Lançar`, true)}</span></header><div class="body stackcol" style="gap:14px">
          ${ab.length ? `<div><div class="md-sub ${longas.length ? 'bad' : ''}">Paradas sem liberação (${ab.length})</div><div class="plist">${ab.slice(0, 6).map(p => `<div class="pitem"><div class="minw"><div class="t"><span class="mono">${esc(p.eq)}</span> · ${esc(p.causa || 'sem causa')}</div><div class="l">desde ${ddmm(p.data)} às ${p.ini}${p.op ? ' · ' + esc(title(p.op)) : ''}</div></div><span class="pill ${p.horas >= 2 ? 'bad' : 'warn'}">há ${p.horas >= 24 ? Math.floor(p.horas / 24) + ' d' : h1(p.horas) + ' h'}</span></div>`).join('')}</div>${ab.length > 6 ? `<p class="muted small m0">+ ${ab.length - 6}</p>` : ''}<div class="row-gap" style="margin-top:8px">${ir('equipamentos', 'epar', '', 'Abrir paradas')}</div></div>` : vazio('Nenhuma parada sem liberação.')}
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
        if (a.total) tiles.push({ n: a.total, t: 'assinaturas pendentes', s: a.velhas.length ? `${a.velhas.length} há mais de 7 dias` : 'todas recentes', tom: a.velhas.length ? 'bad' : 'warn', go: ['gestao', 'gocorr', ''] });
        if (exp.length) tiles.push({ n: exp.length, t: 'experiências vencendo', s: '45 ou 90 dias nesta semana', tom: 'warn', go: ['gestao', 'gpainel', ''] });
        blocos.push(`<div class="card md-card"><header><h2>Efetivo</h2><p>Fichas de acompanhamento</p><span class="r">${ir('gestao', 'gocorr', '', `${I.plus} Ocorrência`, true)}</span></header><div class="body stackcol" style="gap:14px">
          ${a.total ? `<div><div class="md-sub ${a.velhas.length ? 'bad' : ''}">Aguardando assinatura (${a.total})</div><div class="plist">${(a.velhas.length ? a.velhas : (G.ocorr || []).filter(o => o.status === 'pendente')).slice(0, 5).map(o => `<div class="pitem"><div class="minw"><div class="t">${esc(title(o.nome))}</div><div class="l">${ddmm(o.data)} · ${esc(o.tipo)}</div></div><span class="pill ${o.data <= add(hoje, -7) ? 'bad' : 'warn'}">${Math.round((new Date(hoje) - new Date(o.data)) / 864e5)} dias</span></div>`).join('')}</div></div>` : vazio('Nenhuma assinatura pendente.')}
          ${exp.length ? `<div><div class="md-sub">Experiência vencendo</div><div class="md-pessoas">${exp.slice(0, 12).map(x => `<span class="md-pessoa"><b>${esc(title(x.c.nome))}</b><small>${x.d} dias de casa · fecha ${x.d <= 45 ? '45' : '90'} em ${(x.d <= 45 ? 45 : 90) - x.d} dia(s)</small></span>`).join('')}</div></div>` : ''}
        </div></div>`);
      }
    }
    const d = new Date(); const nome = title((u.nome || '').split(' ')[0]);
    const saud = d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
    const ordem = { bad: 0, warn: 1, neu: 2, ok: 3 };
    tiles.sort((a, b) => ordem[a.tom] - ordem[b.tom]);
    let h = `<div class="md-hero"><div><h2>${saud}, ${esc(nome)}.</h2><p>${(DIAS_L[d.getDay()][0].toUpperCase() + DIAS_L[d.getDay()].slice(1))}, ${d.getDate()} de ${MESES_L[d.getMonth()].toLowerCase()}</p></div></div>`;
    h += tiles.length ? `<div class="md-tiles">${tiles.map(t => `<button class="md-tile ${t.tom}" data-md="${t.go.join('|')}"><b class="num">${t.n}</b><span>${esc(t.t)}</span><small>${esc(t.s)}</small></button>`).join('')}</div>` : '<div class="card"><div class="empty"><b>Tudo em dia.</b><br>Nada pendente nos seus módulos hoje.</div></div>';
    h += `<div class="md-grid">${blocos.join('')}${cardAvisos()}</div>`;
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
    if (a === 'desligar') { try { await DB.desativarAvisos(); toast('Avisos desligados neste aparelho'); } catch (err) { ST.erro = (err && err.message) || String(err); } render(); return true; }
    return false;
  }
  // Mostra um aviso de exemplo para a pessoa ver como chega.
  async function testeLocal() {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      const op = { body: 'Pronto. É assim que os avisos vão chegar.', icon: 'icons/icon-192.png', tag: 'teste' };
      if (reg) reg.showNotification('Dikma Operação', op); else new Notification('Dikma Operação', op);
    } catch (e) { /* sem notificação local */ }
  }
  function onChange(t) {
    const k = t.dataset.mdPref; if (!k) return false;
    const prefs = { ...PREFS_PADRAO, ...((DB.cache.meusAvisos && DB.cache.meusAvisos.prefs) || {}), [k]: t.checked };
    DB.salvarPrefsAvisos(prefs); toast('Preferência salva'); return true;
  }
  return { view, onClick, onChange };
}
