// Ambiente (demonstração, prévia, Modo TV), banco de dados (DB), data de hoje e utilidades de texto.
// Não depende de nenhuma outra parte da interface: é carregado primeiro.
import { pad, today, weekOf, monthOfWeek } from '../contas/cal.js';


// Demonstração: ?demo, ou sempre que o site é uma prévia de proposta (endereço com "--", ex.: projeto--pr3-abc.web.app).
// Assim a prévia nunca mexe nos dados reais.
const PREVIA = location.hostname.includes('--');
export const DEMO = PREVIA || new URLSearchParams(location.search).has('demo');
// Modo TV (?tv): tela cheia para a sala de controle, com cenas que se revezam sozinhas (veja tv.js).
export const TV = new URLSearchParams(location.search).has('tv');
// Fontes carregam sem travar a página (sem script dentro do HTML, por causa da política de segurança do site).
{ const f = document.getElementById('fontes'); if (f) { if (f.sheet) f.media = 'all'; else f.addEventListener('load', () => { f.media = 'all'; }); } }
export const DB = await import(DEMO ? './data-mock.js' : './data.js');
export const PAINEL_URL = 'https://gestao-eduardo.web.app/';

export const TODAY = today();
export const CUR_WEEK = weekOf(TODAY);
export const CUR_MONTH = monthOfWeek(CUR_WEEK);
export const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
export const title = s => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, w => w.toLowerCase());
export const fmtAt = d => { if (!(d instanceof Date) || isNaN(d)) return ''; return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const n0 = v => Number(v).toLocaleString('pt-BR');
// Atalho para document.getElementById.
export const $ = id => document.getElementById(id);
