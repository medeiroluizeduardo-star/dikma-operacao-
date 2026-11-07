// Registro dos erros que acontecem no aparelho de quem usa (celular ou computador).
// Pega erros de JavaScript e promessas sem tratamento, guarda numa fila e grava no banco (coleção erros) quando a
// pessoa está com login. Para não gastar a cota do plano grátis: no máximo 5 registros por abertura do sistema,
// o mesmo erro só uma vez (as repetições viram "vezes") e nada de erros de extensões do navegador ou de sinal.
import { DB } from './base.js';
import { UI } from './estado.js';

const MAX = 5;
const vistos = new Map();   // chave → { dados, gravado }
let gravados = 0, versao = '';
try { navigator.serviceWorker && caches.keys().then(k => { versao = (k.find(n => n.startsWith('dikma-operacao-')) || '').slice(0, 40); }).catch(() => {}); } catch (e) { /* sem cache */ }

const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
// Erros que não são do sistema ou que só dizem que a internet caiu.
const IGNORA = /ResizeObserver loop|Script error\.?$|Failed to fetch|NetworkError|Load failed|network-request-failed|unavailable|offline|AbortError|The operation was aborted/i;

function aparelho() {
  const ua = navigator.userAgent || '';
  const so = /Android [\d.]+/.exec(ua)?.[0] || /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, '.') || (/Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '');
  const nav = /(Edg|SamsungBrowser|Chrome|Firefox|Version)\/[\d]+/.exec(ua)?.[0]?.replace('Version', 'Safari') || '';
  return corta(`${so} · ${nav} · ${window.innerWidth}x${window.innerHeight}`, 200);
}

function anotar(msg, onde) {
  msg = corta(msg, 300); onde = corta(onde, 200);
  if (!msg || IGNORA.test(msg)) return;
  // Só arquivos deste site (erros de extensões do navegador ficam de fora).
  if (onde && /^(chrome|moz|safari)-extension:|^https?:/.test(onde) && !onde.includes(location.host)) return;
  const chave = msg + '|' + onde;
  const v = vistos.get(chave);
  if (v) { v.dados.vezes = Math.min(1000, v.dados.vezes + 1); return; }
  if (vistos.size >= 50) return;
  vistos.set(chave, { dados: { msg, onde: onde.replace(location.origin + '/', ''), tela: corta(UI.view, 40), aparelho: aparelho(), vezes: 1 }, gravado: false });
  enviar();
}

let agendado = null;
export function enviar() {
  if (agendado || !DB.registrarErro) return;
  // Espera um pouco para juntar repetições do mesmo erro num registro só.
  agendado = setTimeout(async () => {
    agendado = null;
    for (const v of vistos.values()) {
      if (v.gravado || gravados >= MAX) continue;
      try { if (await DB.registrarErro({ ...v.dados, versao })) { v.gravado = true; gravados++; } } catch (e) { /* sem login ou sem sinal: tenta de novo depois */ }
    }
  }, 3000);
}

window.addEventListener('error', ev => {
  if (!ev.error && !ev.message) return;   // imagem ou script que não carregou: não é erro de código
  const er = ev.error;
  const onde = ev.filename ? `${ev.filename}:${ev.lineno || 0}` : er && er.stack ? (String(er.stack).split('\n')[1] || '').trim() : '';
  anotar(er instanceof Error ? `${er.name}: ${er.message}` : String(ev.message || er), onde);
});
window.addEventListener('unhandledrejection', ev => {
  const r = ev.reason;
  if (!r || (r.code && !(r instanceof Error))) return;   // { code: ... } das telas de login já é tratado
  anotar(r instanceof Error ? `${r.name}: ${r.message}` : String(r), r && r.stack ? (String(r.stack).split('\n')[1] || '').trim() : '');
});
