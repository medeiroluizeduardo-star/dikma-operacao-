// Eventos da página: cliques (data-*), envio de formulários, mudança de campos, teclado, Voltar e avisos de saída.
// Botões com data-act chamam a ação registrada em acoes (nucleo/acoes.js); cada tela registra as suas.
import { planoNaProgramacao } from '../telas/plano-prog.js';
import { SETS, AREA_S, AUSENCIA, add, ddmm, today } from '../contas/cal.js';
import { pedirJus } from '../ui/presenca.js';
import { letra, periodosDe } from '../contas/escala.js';
import { DEMO, DB, PAINEL_URL, TODAY, CUR_WEEK, CUR_MONTH, esc, title, $ } from './base.js';
import { AUTH, ME, PL, COLABS, SK, UI, salvarUI, rotas, isAdmin, podeItem, admDe, myAreas, myArea, canEdit, canEditSit, papelNome, rebuild, modsDe, setsDe, aplicarSet, moduloNovo } from './estado.js';
import { acoes } from './acoes.js';
import { I, MOD_IC } from '../ui/icones.js';
import { setSt, tirarFora } from '../calc/atividades.js';
import { sitDia, curto, removerCobertura, comTurma } from '../calc/presenca.js';
import { VIEWS, nomeCurto, MODS, abasDoMenu, modsMenu, mesmoItem, subMod, moduloDaView, ensureModulo, barraDe, irParaModuloDa, trocarModulo, trocarConjunto } from './navegacao.js';
import { sheet, formSheet, showErr, toggleEye, toast } from '../ui/janelas.js';
import { menuModulos, TEMAS, temaAtual, IC_TEMA, temaSheet, render, syncPill, filtroSheet, abrirBusca, modSheet, alterarSenhaSheet, medirTopo, trocarTela, SELOS, numSelo } from '../ui/shell.js';
import { apArea, cellMenu, pedirJustificativa, apply } from '../telas/apontar.js';
import { lancarEfetivo, turmaSheet, irEscala, PER_NOME, equipeCheckin } from '../telas/efetivo.js';
import { ocorrOpc, salvarJus, horarioHE, heCfg } from '../telas/horas-justificativas.js';
import { problemaSenha, senhaAleatoria } from '../contas/senha.js';
import { AV, modulo } from './modulos.js';
import { competenciaDe } from '../contas/planilhas-adm.js';
// Telas de configuração (config.js): chegam quando a tela é aberta; os botões abaixo só existem nessas telas.
const CF = () => modulo('CF');

// Botão Voltar (celular e navegador): fecha a janela aberta ou volta para a tela anterior, em vez de sair do sistema.
let HIST_IGNORA = false;
document.addEventListener('keydown', e => {
  if (AUTH.status !== 'ready' || $('layer').innerHTML) return;
  const digitando = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
  if (e.key === 'k' && (e.ctrlKey || e.metaKey) && !digitando) { e.preventDefault(); abrirBusca(); }
  else if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); abrirBusca(); }
});

// Cabeçalho mais baixo ao rolar (celular) e altura do cabeçalho para o que fica preso logo abaixo dele.
addEventListener('scroll', () => { const r = scrollY > 40; if (document.body.classList.contains('rolou') !== r) { document.body.classList.toggle('rolou', r); medirTopo(); } }, { passive: true });
// Menu de módulos: fecha ao clicar fora ou com Esc; setas sobem e descem.
document.addEventListener('pointerdown', e => { if (UI.modOpen && !e.target.closest('.modpick')) menuModulos(false); });
document.addEventListener('keydown', e => {
  if (!UI.modOpen) return;
  const itens = [...document.querySelectorAll('.modmenu button')]; const i = itens.indexOf(document.activeElement);
  if (e.key === 'Escape') { menuModulos(false); const b = document.querySelector('[data-modmenu]'); if (b) b.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]; if (n) n.focus(); }
});
acoes.trocarAcesso = async (t, d) => { UI.escolha = null; UI.modOpen = false; await DB.signOut(); };
acoes.tema = (t, d) => { temaSheet(); };
acoes.senha = (t, d) => { alterarSenhaSheet(); };
acoes.logout = (t, d) => { DB.signOut(); };
acoes.mockReset = async (t, d) => { await DB.mockReset(); toast('Demonstração restaurada'); };
acoes.hoje = (t, d) => { UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; UI.dia = null; render(); };
acoes.filtros = (t, d) => { filtroSheet(); };
acoes.modsheet = (t, d) => { modSheet(); };
acoes.busca = (t, d) => { abrirBusca(); };
acoes.more = (t, d) => { UI.more = +d.n; render(); };
acoes.cancel = (t, d) => { UI.confirm = null; render(); };
acoes.print = (t, d) => { window.print(); };
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-area]'); if (!t || t.closest('#layer')) return;
  const d = t.dataset;
  if ('escolha' in d) { UI.escolha = d.escolha || null; AUTH.msg = ''; render(); const u = $('lgUser'); if (u) (u.value ? $('lgPass') : u).focus(); return; }
  if (d.go) {
    if (d.go === '__more') {
      const naBarra = barraDe().map(x => x[0]);
      const vs = abasDoMenu().filter(v => !naBarra.includes(v.id));
      // "Mais" em seções: as abas desta área primeiro, depois as outras áreas e, por fim, conta e tela.
      const outros = modsMenu().filter(m => !mesmoItem(m, UI.modulo)).map((m, i) => ({ t: MODS[m].nome, d: subMod(m), id: '__mod_' + m, ic: `<span class="opt-ic">${MOD_IC[m] || I.swap}</span>`, sec: i ? '' : 'Outros módulos' }));
      const extra = [...(isAdmin() ? [{ t: 'Meu painel', id: '__painel', d: 'Gestão de processos e Medição · abre o Painel Coqueria', ic: `<span class="opt-ic">${I.painel}</span>` }] : []), { t: 'Avisos no celular', id: 'avisos', d: 'Ligar, desligar e escolher os avisos', ic: `<span class="opt-ic">${I.celular}</span>` }, { t: 'Tema da tela', id: '__tema', d: TEMAS[temaAtual()], ic: `<span class="opt-ic">${IC_TEMA[temaAtual()]}</span>` }, { t: 'Alterar minha senha', id: '__senha', ic: `<span class="opt-ic">${I.key}</span>` }, ...(DEMO ? [{ t: 'Trocar usuário (demonstração)', id: '__user', d: title(ME.nome) + ' · ' + papelNome(ME.papel) }] : []), { t: 'Sair', id: '__out', d: title(ME.nome || '') + ' · ' + papelNome(ME.papel), ic: `<span class="opt-ic">${I.out}</span>` }];
      if (extra.length) extra[0].sec = 'Conta e tela';
      return sheet('Mais', '', [...vs.map((v, i) => ({ t: nomeCurto(v), id: v.id, ic: `<span class="opt-ic">${I[v.ic]}</span>`, ...(SELOS[v.id] ? { d: SELOS[v.id].n + ' ' + SELOS[v.id].txt, fim: `<span class="badge">${numSelo(SELOS[v.id].n)}</span>` } : {}), sec: i ? '' : 'Neste módulo · ' + MODS[UI.modulo].curto })), ...outros, ...extra], o => { if (o.id.startsWith('__mod_')) return trocarModulo(o.id.slice(6)); if (o.id === '__out') return DB.signOut(); if (o.id === '__painel') { window.open(PAINEL_URL, '_blank', 'noopener'); return; } if (o.id === '__senha') return alterarSenhaSheet(); if (o.id === '__tema') return temaSheet(); if (o.id === '__user') return sheet('Entrar como', 'Simula o login de cada perfil', DB.cache.usuarios.map(u => ({ t: title(u.nome), d: papelNome(u.papel) + (u.area ? ' · ' + AREA_S[u.area] : ''), uid: u.uid, cur: u.uid === ME.uid })), x => { DB.mockSwitch(x.uid); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(x.t)); }); UI.view = o.id; UI.confirm = null; trocarTela(o.id); });
    }
    // Atalho para uma configuração (ex.: Gerador de meses no Apontar): abre na Administração no mesmo conjunto.
    { const tv = VIEWS.find(v => v.id === d.go); if (tv && tv.mod === 'administracao' && UI.modulo !== 'administracao' && modsDe(ME).includes('administracao')) { if (UI.modulo === 'operacao' || UI.modulo === 'gestao') UI.cfSet = SK; UI.modulo = 'administracao'; UI.modOpen = false; aplicarSet(); } }
    irParaModuloDa(d.go);
    UI.view = d.go; UI.confirm = null; UI.more = 0; UI.perm = null; if (UI.g) UI.g.mat = null; salvarUI(); trocarTela(d.go); return;
  }
  if (d.cfgo) { const [view, set] = d.cfgo.split('|'); if (set) UI.cfSet = set; UI.modulo = 'administracao'; aplicarSet(); UI.view = view; UI.confirm = null; salvarUI(); trocarTela(view); return; }
  if (d.cfset) { UI.cfSet = d.cfset; salvarUI(); render(); return; }
  if (d.permmod) { UI.permMod = d.permmod; render(); return; }
  // Escalas e turnos (rascunho até salvar)
  if (d.escdel) { const [k, l] = d.escdel.split('|'); delete CF().rascEsc().regimes[k].turmas[l]; render(); return; }
  if (d.escper) { const [k, i] = d.escper.split('|'); const r = CF().rascEsc().regimes[k]; const a = [...periodosDe(r)]; a[+i] = a[+i] === 'N' ? 'D' : 'N'; r.periodos = a.join(''); render(); return; }
  if (d.escadd) { const inp = document.querySelector(`[data-escnova="${d.escadd}"]`); const l = letra(inp && inp.value); if (!l) { toast('Informe a letra da turma (A a Z)'); return; } const tt = CF().rascEsc().regimes[d.escadd].turmas || (CF().rascEsc().regimes[d.escadd].turmas = {}); if (tt[l] !== undefined) { toast('Essa turma já existe'); return; } tt[l] = ''; render(); return; }
  if (d.escfer) { const dt = $('escFerD').value, ds = $('escFerT').value.trim(); if (!dt) { toast('Informe a data do feriado'); return; } const R = CF().rascEsc(); R.feriados = R.feriados.filter(f => f.data !== dt).concat([{ data: dt, desc: ds || 'Feriado', semOp: true }]); render(); return; }
  if (d.escferdel) { const R = CF().rascEsc(); R.feriados = R.feriados.filter(f => f.data !== d.escferdel); render(); return; }
  if (d.escfereq) { const R = CF().rascEsc(); const eqF = ((DB.cache.e && DB.cache.e.config && DB.cache.e.config.feriados) || []).filter(f => f.semOp && !R.feriados.some(x => x.data === f.data)); R.feriados = R.feriados.concat(eqF.map(f => ({ data: f.data, desc: f.desc, semOp: true }))); render(); toast(`${eqF.length} feriado(s) copiados · salve para valer`); return; }
  if (d.mdAv) { AV.onClick(t); return; } // Avisos no celular (telas/avisos.js)
  if (d.modmenu) { menuModulos(!UI.modOpen); if (!UI.modOpen) t.focus(); return; }
  if (d.mod) { UI.modOpen = false; trocarModulo(d.mod); return;
  }
  if (d.atset) { trocarConjunto(d.atset); return; }
  if (d.esc) { UI.escopo = d.esc; render(); return; }
  if (d.area) { UI.area = d.area; render(); return; }
  if (d.cell) { const [id, i, k] = d.cell.split('|').length === 4 ? [d.cell.split('|').slice(0, 2).join('|'), ...d.cell.split('|').slice(2)] : d.cell.split('|'); cellMenu(DB.cache.semanas[id], +i, +k); return; }
  if (d.dia != null) { UI.dia = +d.dia; UI.confirm = null; render(); return; }
  if (d.arota) { UI.aRota = d.arota; UI.confirm = null; render(); salvarUI(); { const a = document.querySelector('.rchips.linha [aria-pressed="true"]'); if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' }); } if (t.closest('.fimrota')) scrollTo(0, 0); return; }
  if (d.efg) { const l = new Set(UI.efAbertas || []); if (l.has(d.efg)) l.delete(d.efg); else l.add(d.efg); UI.efAbertas = [...l]; render(); return; }
  if (d.pgrp) { const l = new Set(UI.progAbertas || []); if (l.has(d.pgrp)) l.delete(d.pgrp); else l.add(d.pgrp); UI.progAbertas = [...l]; render(); return; }
  if (d.aprarea) { UI.aprArea = d.aprarea; UI.confirm = null; render(); return; }
  if (d.aparea) { UI.apArea = d.aparea; if (myAreas().length > 1) UI.area = d.aparea; UI.confirm = null; render(); salvarUI(); return; }
  if (d.ap) {
    const [i, k, v] = d.ap.split('|'); const doc = DB.cache.semanas[apArea() + '|' + UI.ini];
    if (v === 'rmE') return apply(doc, +i, +k, '_');
    // resposta na hora: o botão já aparece marcado; a tela é refeita no quadro seguinte
    if (v === 'R' && doc) { const novo = doc.d[+i][+k] === 'R' ? 'P' : 'R'; const bt = t.closest('.bt'); if (bt) bt.querySelectorAll('[data-ap]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ap.endsWith('|' + novo)))); }
    return apply(doc, +i, +k, doc.d[+i][+k] === v ? 'P' : v);
  }
  if (d.pend) { const parts = d.pend.split('|'); const id = parts[0] + '|' + parts[1]; return apply(DB.cache.semanas[id], +parts[2], +parts[3], parts[4]); }
  if (d.goescala !== undefined) { irEscala(d.goescala); return; }
  if (d.heh) { const [id, dt] = d.heh.split('|'); const c = COLABS.find(x => x.id === id); if (c && canEditSit(c.area)) horarioHE(c, [dt]); return; }
  if (d.tirafp) { const [i, k] = d.tirafp.split('|').map(Number); const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; if (doc) tirarFora(doc, i, k); return; }
  if (d.rtipo) { UI.resTipo = d.rtipo; render(); return; }
  if (d.jusf) { UI.jusF = d.jusf; UI.more = 0; render(); return; }
  if (d.jusk) { const [id, ds] = d.jusk.split('|'); const dias = ds.split(','); const dt = dias[0]; const c = COLABS.find(x => x.id === id); if (!c || !canEditSit(c.area)) return; const x = sitDia(c, dt); const inf = DB.sitInfo(id + '|' + dt); pedirJus({ formSheet, nome: title(c.nome) + (dias.length > 1 ? ` · ${dias.length} dias (${ddmm(dias[0])} a ${ddmm(dias[dias.length - 1])})` : ''), dt, cod: x.v, atual: inf.jus, ocorr: inf.jus && inf.jus.ocorr ? null : ocorrOpc(c, x.v), salvar: j => salvarJus(c, dias, j), depois: () => render() }); return; }
  if (d.rper) { UI.rPer = d.rper; try { localStorage.setItem('dikma-rper', d.rper); } catch (x) { /* ignora */ } render(); return; }
  if (d.rdia) { UI.rDia = d.rdia; render(); return; }
  if (d.rdiao) { const n = add(UI.rDiaO || TODAY, +d.rdiao); UI.rDiaO = n > TODAY ? TODAY : n; render(); return; }
  if (d.rsem) { UI.rIni = add(UI.rIni || UI.ini || CUR_WEEK, 7 * +d.rsem); if (UI.rIni > CUR_WEEK) UI.rIni = CUR_WEEK; render(); return; }
  if (d.rcomp) { const [y, m] = (UI.rComp || competenciaDe(TODAY)).split('-').map(Number); const t = y * 12 + m - 1 + +d.rcomp; const c = `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; const max = competenciaDe(TODAY); UI.rComp = c > max ? max : c; render(); return; }
  if (d.rconj) { UI.rConj = d.rconj; render(); return; }
  if (d.esset) { UI.esSet = d.esset; UI.eRota = '*'; UI.area = 'TODAS'; salvarUI(); render(); return; }
  if (d.erota) { UI.eRota = d.erota; render(); const s = $('fERota'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (d.sit) { lancarEfetivo(d.sit); return; }
  if (d.turma) { turmaSheet(d.turma); return; }

  if (d.ptog) {
    const [id, k] = d.ptog.split('|'); const p = PL.get(id); const itens = DB.cache.plano[p.area].map(x => (x.id === id ? { ...x, dias: [...x.dias].map((c, j) => (j === +k ? (c === '1' ? '0' : '1') : c)).join('') } : x));
    DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); render(); planoNaProgramacao(itens.find(x => x.id === id)); return;
  }
  if (d.eye) { toggleEye(t); return; }
  if (d.ck) { const [id, v] = d.ck.split('|'); const c = COLABS.find(x => x.id === id); if (!c || !canEditSit(c.area)) return; const key = id + '|' + TODAY; const atual = DB.sit(key); const novo = v === 'P' ? (atual === 'HE' ? 'HE' : null) : v; DB.setSit(key, novo); if (v === 'P' || v === 'ATR') removerCobertura(id, TODAY); if (novo !== 'HE') { DB.setSitExtra('he', key, null); DB.setSitExtra('hed', key, null); } DB.log(`${title(c.nome)} · check-in ${v === 'P' ? 'presente' : v === 'FT' ? 'falta' : 'atraso'} em ${ddmm(TODAY)}`); render(); return; }
  if (d.ckok) { const [a, per] = d.ckok.split('|'); const g = equipeCheckin().find(x => x.a === a && x.per === per); if (!g) return; const pres = g.ps.filter(x => !AUSENCIA.has(x.v) && x.v !== 'ATR').length; DB.setSitExtra('ck', `ck|${TODAY}|${a}|${per}`, `${ME.uid}|${curto(title(ME.nome || ME.login || ''))}|${new Date().toTimeString().slice(0, 5)}|${pres}/${g.ps.length}`); DB.log(`Check-in ${PER_NOME[per].toLowerCase()} · ${AREA_S[a]}: ${pres} de ${g.ps.length} presentes`); toast('Check-in confirmado'); render(); return; }
  if (d.ckre) { const [a, per] = d.ckre.split('|'); if (!myAreas().includes(a)) return; DB.setSitExtra('ck', `ck|${TODAY}|${a}|${per}`, null); render(); return; }
  if (d.just) { const [i, k] = d.just.split('|').map(Number); const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; if (doc && canEdit(doc.area)) pedirJustificativa(doc, i, k, m => { setSt(doc, i, k, 'N', m); toast('Justificativa atualizada'); render(); }); return; }
  if (d.reset) {
    const u = DB.cache.usuarios.find(x => x.uid === d.reset); const nova = senhaAleatoria();
    return formSheet('Redefinir senha', `${esc(title(u.nome))} · <span class="mono">${esc(u.login)}</span>`, `<label class="sel"><span>Nova senha provisória</span><input class="in" id="rsSenha" minlength="8" value="${nova}"></label><p class="muted small m0">Passe essa senha para a pessoa. No próximo acesso ela cria a própria senha.</p>`, 'Redefinir', async () => {
      const v = $('rsSenha').value.trim(); if (v.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      await DB.redefinirSenha(u.uid, v); DB.log(`Redefiniu a senha de ${u.login}`); toast(`Senha de ${u.login} redefinida`);
    });
  }
  if (d.uabas) { CF().abasPessoaSheet(d.uabas); return; }
  if (d.uacesso) { CF().editarAcessoSheet(d.uacesso); return; }
  if (d.udel) {
    const u = DB.cache.usuarios.find(x => x.uid === d.udel); if (!u) return;
    if (u.papel === 'admin' && DB.cache.usuarios.filter(x => x.papel === 'admin').length < 2) { toast('Não dá para apagar o único administrador'); return; }
    return formSheet('Apagar usuário', `${esc(title(u.nome))}${u.login ? ` · <span class="mono">${esc(u.login)}</span>` : ''}`, `<p class="m0">A pessoa perde o acesso ao sistema na hora. O que ela já registrou (apontamentos, fotos, ocorrências, histórico) continua no sistema.</p><p class="muted small m0">Para só suspender o acesso sem apagar, mude o perfil para <b>Bloqueado</b>. O nome de usuário fica livre para ser cadastrado de novo.</p><label class="switch"><input type="checkbox" id="udOk"><span>Confirmo que quero apagar este usuário</span></label>`, 'Apagar usuário', async () => {
      if (!$('udOk').checked) throw new Error('Marque a confirmação.');
      await DB.excluirUsuario(u.uid); DB.log(`Apagou o usuário ${u.login || u.nome}`); toast(`Usuário ${u.login || title(u.nome)} apagado`);
    });
  }
  if (d.ntog != null) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); return; }
  // Botões com data-act: cada ação está registrada em acoes (por nome).
  if (d.act && Object.hasOwn(acoes, d.act)) await acoes[d.act](t, d);
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!['fLogin', 'fMust', 'fNovoUser'].includes(f.id)) return;
  e.preventDefault();
  const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  try {
    if (f.id === 'fLogin') {
      // Entra na primeira aba do módulo em que estava (ensureModulo leva para um que a pessoa tem e abre o início dele).
      UI.view = ''; salvarUI();
      try { localStorage.setItem('dikma-ultimo-login', DB.normLogin($('lgUser').value)); } catch (e) { /* ignora */ }
      await DB.signIn($('lgUser').value, $('lgPass').value); return;
    }
    if (f.id === 'fMust') {
      const n = $('mcPass').value, n2 = $('mcPass2').value;
      { const p = problemaSenha(n, AUTH.user); if (p) throw new Error(p); } if (n !== n2) throw new Error('As duas senhas não são iguais.');
      await DB.definirNovaSenha(n); toast('Senha criada'); return;
    }
    if (f.id === 'fNovoUser') {
      const nome = $('nuNome').value.trim(), login = DB.normLogin($('nuLogin').value), senha = $('nuSenha').value.trim();
      if (!nome) throw new Error('Informe o nome.');
      if (!DB.loginValido(login)) throw new Error('Usuário inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado (sem espaço e sem acento).');
      if (senha.length < 8) throw new Error('A senha provisória precisa ter pelo menos 8 caracteres.');
      // Acesso por módulo: grava o modelo novo e os campos antigos tirados dele (gravação dupla da transição).
      const ac = CF().validarAcesso(CF().lerAcesso('nu'), null);
      UI.busy = true;
      await DB.criarUsuario({ nome: nome.toUpperCase(), login, senha, ...ac });
      DB.log(`Cadastrou o usuário ${login} (${CF().textoAcesso(ac.acesso)})`);
      UI.busy = false; UI.senhaSug = null; UI.nuAcesso = null; render();
      formSheet('Usuário cadastrado', '', `<p class="m0">Passe estes dados para <b>${esc(title(nome))}</b>:</p><div class="credbox"><div><span>Endereço</span><b>${esc(location.origin)}</b></div><div><span>Usuário</span><b>${esc(login)}</b></div><div><span>Senha provisória</span><b>${esc(senha)}</b></div></div><p class="muted small m0">No primeiro acesso a pessoa cria a própria senha.</p>`, 'Copiar dados', async () => {
        // copia endereço, usuário e senha prontos para colar no WhatsApp ou no e-mail
        const txt = `Acesso ao Dikma Gestão\nEndereço: ${location.origin}\nUsuário: ${login}\nSenha provisória: ${senha}\nNo primeiro acesso você cria a sua própria senha.`;
        try { await navigator.clipboard.writeText(txt); toast('Dados copiados'); } catch (e) { toast('Não foi possível copiar: selecione e copie os dados na tela'); }
      }, { cancelarTxt: 'Fechar' });
      return;
    }
  } catch (err) {
    UI.busy = false;
    const id = { fLogin: 'lgErr', fMust: 'mcErr', fNovoUser: 'nuErr' }[f.id];
    showErr(id, err);
  } finally { const b = f.querySelector('[type=submit]'); if (b && f.isConnected) b.disabled = false; }
});
document.addEventListener('change', e => {
  { const t = e.target; const dd = t.dataset || {};
    if (dd.escdia) { const [k, d] = dd.escdia.split('|'); const r = CF().rascEsc().regimes[k]; const l = new Set(r.dias || []); if (t.checked) l.add(+d); else l.delete(+d); r.dias = [...l].sort(); render(); return; }
    if (dd.escn) { const [k, f] = dd.escn.split('|'); CF().rascEsc().regimes[k][f] = Math.max(1, +t.value || 1); render(); return; }
    if (dd.esct) { const [k, l] = dd.esct.split('|'); CF().rascEsc().regimes[k].turmas[l] = t.value || ''; render(); return; }
    if (dd.escpes) { const [k, a, id] = dd.escpes.split('|'); const itens = ((DB.dados(k).colabs || {})[a] || []).map(c => (c.id === id ? comTurma(c, t.value) : c)); DB.salvarColabsArea(a, itens, k); const c = itens.find(x => x.id === id); DB.log(`${title(c.nome)} · turma ${t.value || 'removida'}`); toast(t.value ? `Turma ${t.value} gravada` : 'Turma removida'); return; } }
  const t = e.target;
  if (t.dataset.mdPref) { AV.onChange(t); return; }
  if (t.dataset.resarea) { UI.resArea = t.value; render(); return; }
  if (t.dataset.rfarea) { UI.rfArea = t.value; render(); return; }
  if (t.dataset.permperfil !== undefined) { UI.permPerfil = t.value; render(); return; }
  if (t.dataset.perm) { const [m, p, id] = t.dataset.perm.split('|'); const R = CF().rascunhoPerm(); (R[m + '|' + p] ||= {})[id] = t.checked; render(); return; }
  if (t.id === 'mockUser') { DB.mockSwitch(t.value); UI.area = 'TODAS'; UI.aRota = null; UI.eRota = null; toast('Entrou como ' + title(ME ? ME.nome : '')); return; }
  if (t.dataset.rcfg) { const [i, f] = t.dataset.rcfg.split('|'); const rs = rotas().map((r, j) => (j === +i ? { ...r, [f]: Math.max(0, +t.value || 0) } : r)); DB.cache.config.rotas = rs; DB.saveRotas(rs); toast('Rota atualizada'); }
  // Formulário de acesso por módulo (novo usuário e editar acesso): atualiza o resumo de como fica hoje.
  if (t.dataset.acf) { const px = t.dataset.acf; const st = CF().lerAcesso(px); if (px === 'nu') UI.nuAcesso = st; const r = $(px + 'Res'); if (r) r.innerHTML = CF().resumoAcesso(st); return; }
  // Plano padrão: rota, local, atividade e tipo editáveis na própria linha
  if (t.dataset.prota || t.dataset.pcampo) {
    if (!admDe('ativ')) return;
    const [id, campo] = t.dataset.prota ? [t.dataset.prota, 'rota'] : t.dataset.pcampo.split('|'); const p = PL.get(id); if (!p) return;
    const v = String(t.value || '').replace(/\s+/g, ' ').trim(); if (!v) { toast('O campo não pode ficar vazio'); t.value = p[campo]; return; }
    if (v === p[campo]) return;
    const itens = DB.cache.plano[p.area].map(x => (x.id === id ? { ...x, [campo]: v } : x));
    DB.cache.plano[p.area] = itens; DB.savePlano(p.area, itens); rebuild();
    DB.log(`Plano padrão: ${id} · ${{ rota: 'rota', local: 'local', ativ: 'atividade', tipo: 'tipo' }[campo]} "${p[campo]}" → "${v}"`); toast('Plano atualizado · vale para os meses gerados e já gerados'); render(); return;
  }
  // Renomear rota: troca na lista de rotas, no plano padrão e nos colaboradores da rota (mesma área)
  if (t.dataset.rnome) {
    if (!admDe('ativ')) return;
    const i = +t.dataset.rnome; const r = rotas()[i]; const novo = String(t.value || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!r || !novo || novo === r.rota) { t.value = r ? r.rota : ''; return; }
    if (rotas().some((x, j) => j !== i && x.area === r.area && x.rota === novo)) { toast('Já existe uma rota com esse nome nesta área'); t.value = r.rota; return; }
    const velho = r.rota;
    const rs = rotas().map((x, j) => (j === i ? { ...x, rota: novo } : x)); DB.cache.config.rotas = rs; DB.saveRotas(rs);
    const pl = (DB.cache.plano[r.area] || []); if (pl.some(x => x.rota === velho)) { const itens = pl.map(x => (x.rota === velho ? { ...x, rota: novo } : x)); DB.cache.plano[r.area] = itens; DB.savePlano(r.area, itens); }
    const cs = (DB.cache.colabs[r.area] || []); if (cs.some(x => x.rota === velho)) { const itens = cs.map(x => (x.rota === velho ? { ...x, rota: novo } : x)); DB.cache.colabs[r.area] = itens; DB.salvarColabsArea(r.area, itens); }
    if (UI.aRotaPor && UI.aRotaPor[r.area] === velho) UI.aRotaPor[r.area] = novo; if (UI.aRota === velho) UI.aRota = novo;
    rebuild(); DB.log(`Rota renomeada: ${velho} → ${novo} (${AREA_S[r.area]})`); toast(`Rota renomeada para ${novo}`); render(); return;
  }
  if (t.dataset.hecfg) { if (!admDe('ativ')) return; const he = { ...heCfg(), [t.dataset.hecfg]: Math.max(0, Math.min(t.dataset.hecfg === 'limite' ? 31 : 24, +t.value || 0)) }; DB.saveConfig({ he }); toast('Ajuste salvo'); render(); return; }
});
// Atalho: "/" leva para a busca da tela (quando não está digitando em outro campo).
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement; if (a && a.matches('input,textarea,select,[contenteditable]')) return;
  const b = document.querySelector('#layer input[type=search], #view input[type=search], #view #fQ, #top #fQ'); if (!b) return;
  e.preventDefault(); b.focus(); b.select();
});
matchMedia('(max-width:860px)').addEventListener('change', () => { if (UI.view === 'elanc') render(); });
window.addEventListener('online', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('offline', () => { const s = $('sync'); if (s) s.innerHTML = syncPill(); });
window.addEventListener('pagehide', salvarUI);
// Marca o uso deste aparelho (a sessão expira depois de 7 dias sem uso).
if (DB.marcarUso) ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (AUTH.status === 'ready') DB.marcarUso(); }, { passive: true }));

// Virada do dia: TODAY é fixado ao abrir. Quem deixa o sistema aberto de um dia para o outro
// (computador da sala de controle, celular do líder) passaria a ver a data de ontem; recarrega sozinho quando a data muda,
// desde que ninguém esteja editando nem haja gravação pendente.
{
  const livre = () => !DB.pendingWrites() && !$('layer').children.length && !(document.activeElement && document.activeElement.matches('input:not([type=checkbox]):not([type=radio]),textarea,select'));
  const virou = () => { if (today() !== TODAY && livre()) location.reload(); };
  setInterval(virou, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') virou(); });
}

// Voltar: janelas (folhas) entram no histórico ao abrir; fechar pela tela tira a entrada, e o Voltar fecha a janela.
{
  const L = $('layer');
  new MutationObserver(() => {
    const aberta = !!L.children.length, st = history.state || {};
    if (aberta && !st.s) history.pushState({ ...st, s: 1 }, '');
    else if (!aberta && st.s) { HIST_IGNORA = true; history.back(); }
  }).observe(L, { childList: true });
  addEventListener('popstate', e => {
    if (HIST_IGNORA) { HIST_IGNORA = false; return; }
    if (L.children.length) { L.innerHTML = ''; return; }
    const st = e.state || {};
    if (!st.v || !ME) return;
    if (st.m && st.m !== UI.modulo && modsDe(ME).includes(st.m)) UI.modulo = st.m;
    UI.view = st.v; UI.confirm = null; ensureModulo(); aplicarSet();
    try { localStorage.setItem('coqueria-ui', JSON.stringify({ v5: 1, view: UI.view, modulo: UI.modulo, esSet: UI.esSet, cfSet: UI.cfSet, apArea: UI.apArea, aRotaPor: UI.aRotaPor })); } catch (x) { /* ignora */ }
    render(); scrollTo(0, 0);
  });
}

// Itens Exportar e Imprimir desligados para a pessoa: os botões somem e o toque não faz nada.
const SEL_EXP = '[data-act="csv"],[data-act^="exp"],[data-e^="exp"],[data-g^="exp"],[data-a^="exportar"]', SEL_IMP = '[data-act="print"],[data-g="imprimir"]';
document.addEventListener('click', e => {
  if (!ME) return;
  const b = e.target.closest && e.target.closest(SEL_EXP + ',' + SEL_IMP); if (!b) return;
  const imp = b.matches(SEL_IMP); if (podeItem(imp ? 'i_imprimir' : 'i_exportar')) return;
  e.preventDefault(); e.stopImmediatePropagation(); toast(imp ? 'Seu perfil não imprime' : 'Seu perfil não exporta');
}, true);
setInterval(() => { if (!ME) return; document.body.classList.toggle('sem-exportar', !podeItem('i_exportar')); document.body.classList.toggle('sem-imprimir', !podeItem('i_imprimir')); }, 1000);
// Painel › Rotas que pedem atenção: tocar na linha abre a Programação daquela rota.
document.addEventListener('click', e => {
  const tr = e.target.closest && e.target.closest('[data-progrota]'); if (!tr || !ME) return;
  const [area, rota] = tr.dataset.progrota.split('|');
  irParaModuloDa('prog'); UI.area = area; UI.rota = rota; UI.q = ''; UI.soPend = false; UI.tipo = 'TODOS'; UI.view = 'prog'; UI.confirm = null;
  ensureModulo(); aplicarSet(); UI.area = myArea() || area; UI.rota = rota; salvarUI(); trocarTela(UI.view);
});
// Fechar a aba com apontamento ainda não enviado (sem sinal): o navegador pergunta antes de sair.
addEventListener('beforeunload', e => { if (!DEMO && DB.pendingWrites() > 0) { e.preventDefault(); e.returnValue = ''; } });
