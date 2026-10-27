// Entrada: cria as partes, abre o link recebido (avisos, QR), liga o banco de dados e o service worker.
import { weekOf, monthOfWeek } from './cal.js';
import * as M from './movimento.js';
import { ACESSO } from './acessos.js';
import { DEMO, DB, CUR_WEEK, CUR_MONTH, $ } from './nucleo/base.js';
import { AUTH, ME, mudouDados, definirAuth, UI, salvarAcesso, salvarUI, myArea, MODS_MARCAVEIS, aplicarSet } from './nucleo/estado.js';
import { MODS, ensureModulo } from './navegacao.js';
import { toast } from './ui/janelas.js';
import { render, schedule, syncPill } from './ui/shell.js';
import { iniciarTV } from './tv.js';
import { criarModulos, precarregarModulos } from './nucleo/modulos.js';

criarModulos();

// Aberto por um aviso do celular: vai direto para o Meu dia.
// Links dos avisos no celular: ?m=<módulo>&v=<tela> (ex.: ?m=operacao&v=apontar). Tela que a pessoa não pode ver cai no início do módulo.
// Os avisos levam ao dia a dia: se o sistema estava aberto na Administração do sistema, sai dela (devolve true quando trocou).
let trocouAcessoPorLink = false;
function abrirLink(busca) {
  const p = new URLSearchParams(busca); const m = p.get('m'), v = p.get('v');
  // m pode ser um módulo antigo (escala, adm): ensureModulo leva para a área onde a tela está agora.
  const daOperacao = (m && (MODS_MARCAVEIS.includes(m) || ['paineis', 'escala', 'adm'].includes(m))) || (!m && v === 'meudia');
  if (daOperacao && UI.acesso !== 'operacao') { UI.acesso = 'operacao'; salvarAcesso(); trocouAcessoPorLink = true; }
  if (m && (MODS[m] || m === 'escala' || m === 'adm')) UI.modulo = m;
  if (v) UI.view = v;
  // QR Code da rota: ?r=ÁREA|ROTA abre o Apontar de hoje já nessa rota
  const sem = p.get('s'); if (sem && /^\d{4}-\d{2}-\d{2}$/.test(sem)) { UI.ini = weekOf(sem); UI.mes = monthOfWeek(UI.ini); }
  const r = p.get('r'); if (r && r.includes('|')) { const [a, rota] = r.split('|'); UI.apArea = a; UI.aRotaPor = { ...(UI.aRotaPor || {}), [a]: rota }; UI.aRota = rota; UI.dia = null; UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; if (UI.area !== 'TODAS' && UI.area !== a) UI.area = 'TODAS'; }
  if (m || v) { UI.confirm = null; salvarUI(); }
  return !!(m || v);
}
if (abrirLink(location.search)) history.replaceState(null, '', location.pathname + (DEMO ? '?demo' : ''));
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (!e.data || e.data.tipo !== 'abrir' || AUTH.status !== 'ready') return;
  let busca = ''; try { busca = new URL(e.data.url).search; } catch (err) { /* link inválido: abre o Meu dia */ }
  trocouAcessoPorLink = false;
  if (!abrirLink(busca)) { UI.view = 'meudia'; if (UI.acesso !== 'operacao') { UI.acesso = 'operacao'; salvarAcesso(); trocouAcessoPorLink = true; } }
  // outro acesso aberto: recarrega já na Operação (os dados de cada acesso são carregados na entrada)
  if (trocouAcessoPorLink) { salvarUI(); location.reload(); return; }
  if (typeof ensureModulo === 'function') ensureModulo();
  aplicarSet(); render(); scrollTo(0, 0);
});
M.iniciarJanelas(); M.iniciarTopo();
if (DB.definirAcesso) DB.definirAcesso(UI.acesso);
DB.start({
  onAuth: a => { definirAuth(a); if (ME && a.status === 'ready') precarregarModulos(ME); if (a.acesso && ACESSO[a.acesso] && a.acesso !== UI.acesso) { UI.acesso = a.acesso; salvarAcesso(); if (UI.acesso === 'operacao' && UI.modulo === 'config') { UI.modulo = 'operacao'; UI.view = 'meudia'; } } if (ME && myArea()) UI.area = myArea(); render(); },
  onData: () => { mudouDados(); if (AUTH.status === 'ready') schedule(); },
  onSync: () => { const e = $('sync'); if (e && AUTH.status === 'ready') e.innerHTML = syncPill(); },
  onError: err => { console.error(err); toast(err.code === 'permission-denied' ? 'Sem permissão para essa alteração' : 'Erro: ' + (err.message || err)); }
});

// Versão nova publicada: o navegador baixa em segundo plano e o sistema troca sozinho.
// Logo ao abrir (até 15 s) recarrega direto; depois disso mostra a barra "Atualizar" para não interromper ninguém.
if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') {
  const tinhaControle = !!navigator.serviceWorker.controller, t0 = Date.now(); let trocou = false;
  const ocupado = () => DB.pendingWrites() > 0 || !!$('layer').children.length || !!(document.activeElement && document.activeElement.matches('input:not([type=checkbox]):not([type=radio]),textarea'));
  const barra = () => {
    if (document.querySelector('.updbar')) return;
    const el = document.createElement('div'); el.className = 'updbar noprint'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>Nova versão do sistema disponível</span><button class="btn pri sm" type="button">Atualizar agora</button>';
    el.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(el);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || trocou) return; trocou = true;
    if (Date.now() - t0 < 15000 && !ocupado()) location.reload(); else barra();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const ver = () => reg.update().catch(() => {});
    setInterval(ver, 20 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ver(); });
  }).catch(() => {});
}

iniciarTV();
