// Dikma Gestão — "Avisos no celular": ligar e desligar os avisos neste aparelho e escolher quais receber.
// Abre pelo "Mais" (celular) e pelo botão do menu lateral (computador), em qualquer módulo.
// O administrador também cola aqui a chave pública Web Push e acompanha a rotina de avisos.
// (Antes ficava no fim do "Meu dia", que foi retirado do sistema.)
import { veTreinos } from '../contas/treinos.js';
import { aprovaPapel } from '../contas/aprovacao.js';
import { temSeg, trataTudoSeg, supConjs } from '../contas/segcalc.js';
import { editaAdm } from '../contas/acessos.js';
import { horasEf, HORAS_AVISO } from '../contas/efetivo-dia.js';
import { temAgenda } from '../ui/lembrar.js';

const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true, atividades: true, semanal: true, aprovacao: true, painel: true, seguranca: true, treinos: true, oms: true, efetivo: true, efetivoRH: true, agenda: true };

export function criarAvisos(X) {
  const { DB, esc, toast, render } = X;
  const ME = () => X.ME;
  const ST = { suportado: null, ocupado: false, erro: '' };
  DB.avisosSuportados().then(v => { ST.suportado = v; render(); }).catch(() => { ST.suportado = false; });

  // O que a pessoa enxerga em cada módulo e o perfil dela em cada um.
  const temMod = m => X.modsDe(ME()).includes(m);
  const P = m => (X.perfil ? X.perfil(m) : ME().papel);
  const pAtiv = () => P('operacao') || P('gestao'); // atividades: o da Operação; sem Operação, o da Gestão
  const ehAdm = () => P('administracao') === 'admin';
  const trataSeg = () => trataTudoSeg(ME()) || supConjs(ME()).length > 0;
  const vazio = t => `<p class="muted small m0">${t}</p>`;

  function cardAvisos() {
    const cfg = DB.cache.avisosCfg || {}; const meus = DB.cache.meusAvisos; const ativo = DB.avisoAtivoAqui();
    const prefs = { ...PREFS_PADRAO, ...((meus && meus.prefs) || {}) };
    const HE = horasEf(cfg);
    const opcoes = [
      temMod('equipamentos') && ['paradas', 'Parada sem liberação há mais de 2 horas'],
      temMod('gestao') && P('gestao') !== 'leitor' && ['assinaturas', 'Assinatura com você ou da sua área há mais de 7 dias (às 8h)'],
      (temMod('operacao') || temMod('bateria')) && ['lider', 'supervisor'].includes(P('operacao')) && ['atividades', 'Atividades do dia ainda sem apontar (às 15h)'],
      (temMod('operacao') || temMod('bateria')) && P('operacao') === 'lider' && ['aprovacao', 'Atividade devolvida pelo supervisor (na hora)'],
      (temMod('operacao') || temMod('bateria')) && aprovaPapel(P('operacao')) && ['aprovacao', 'Apontamentos esperando sua aprovação há mais de 1 dia (às 8h)'],
      (temMod('operacao') || temMod('bateria')) && ['deficit', 'Rota com déficit de efetivo amanhã (às 17h)'],
      (temMod('operacao') || temMod('bateria')) && ['supervisor', 'coordenador', 'gestor'].includes(P('operacao')) && ['justificativas', 'Faltas e atrasos de hoje sem justificativa (às 16h)'],
      (temMod('operacao') || temMod('bateria')) && ['lider', 'supervisor'].includes(P('operacao')) && ['efetivo', `Efetivo do dia ainda não enviado (às ${HE.efLider}h) e devolvido pelo RH`],
      editaAdm(ME()) && ['efetivoRH', `Efetivos enviados aguardando sua validação (às ${HE.efRH}h)`],
      (ehAdm() || ['gestor', 'coordenador'].includes(pAtiv())) && ['semanal', 'Resumo da semana que passou (segunda, às 7h)'],
      temSeg(ME()) && ['seguranca', trataSeg() ? 'Anomalia nova na sua área e prazo do tratamento que está com você' : 'Prazo do tratamento das anomalias que estão com você'],
      veTreinos(ME()) && ['treinos', 'Treinamentos e ASO vencidos ou vencendo em 30 dias (segunda, às 7h)'],
      (temMod('operacao') || temMod('bateria')) && ['lider', 'supervisor', 'tecnico', 'coordenador', 'gestor'].includes(P('operacao')) && ['oms', ['tecnico', 'coordenador', 'gestor'].includes(P('operacao')) ? 'Solicitação de OM para aprovar e OM devolvida ou liberada (na hora)' : 'Sua solicitação de OM devolvida ou liberada (na hora)'],
      ehAdm() && ['painel', 'Processos e rotina: tarefas do dia (7h) e o que ficou em aberto (16h)'],
      temAgenda() && ['agenda', 'Minha agenda: o seu dia às 7h e cada compromisso com hora, cerca de 1 hora antes']
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
    // Horários: o administrador vê sempre (mesmo antes de colar a chave); o estado da rotina, só com a chave.
    if (ehAdm()) corpo += horarios(HE) + (cfg.vapid ? estadoRotina() : '');
    return `<div class="card avisos-card"><header><h2>Neste aparelho</h2></header><div class="body stackcol" style="gap:12px">${corpo}</div></div>`;
  }

  // Administrador: horários dos avisos do Efetivo do dia (valem para todos; a rotina roda de hora em hora, das 6h às 22h).
  function horarios(HE) {
    const sel = (k, rot) => `<label class="sel"><span>${rot}</span><select class="in" data-md-hora="${k}">${HORAS_AVISO.map(h => `<option value="${h}" ${h === HE[k] ? 'selected' : ''}>${h}h</option>`).join('')}</select></label>`;
    return `<div class="stackcol" style="gap:8px"><b class="small">Horários dos avisos do Efetivo do dia (para todos)</b><div class="row-gap">${sel('efLider', 'Líder: efetivo não enviado')}${sel('efRH', 'RH: aguardando validação')}</div><p class="small muted m0">O aviso sai na primeira rodada da rotina a partir do horário escolhido (até alguns minutos depois).</p></div>`;
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

  function view() { return `<div class="avisos-tela">${cardAvisos()}</div>`; }

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
    if (t.dataset.mdHora) {
      if (!ehAdm()) return true;
      const h = { ...horasEf(DB.cache.avisosCfg), [t.dataset.mdHora]: +t.value };
      DB.salvarHorasAvisos(h); DB.log(`Avisos no celular: horário do efetivo (${t.dataset.mdHora === 'efRH' ? 'RH' : 'líder'}) às ${t.value}h`, 'administracao'); toast('Horário salvo'); return true;
    }
    const k = t.dataset.mdPref; if (!k) return false;
    const prefs = { ...PREFS_PADRAO, ...((DB.cache.meusAvisos && DB.cache.meusAvisos.prefs) || {}), [k]: t.checked };
    DB.salvarPrefsAvisos(prefs); toast('Preferência salva'); return true;
  }
  return { view, onClick, onChange };
}
