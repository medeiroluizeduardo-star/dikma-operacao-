// Partes criadas na entrada: pessoas (PES) e Meu dia (MD). As telas de Operação (EQ), Frequência e férias (AD) e
// fichas do Efetivo (GE) ficam em arquivos grandes que só são baixados quando precisa: ao abrir a tela, ou logo
// depois do login para quem tem o módulo (em segundo plano). Sem sinal, vêm do service worker (estão no SHELL).
import { SET_KEYS } from '../cal.js';
import { criarPessoas, chaveFicha } from '../pessoas.js';
import * as M from '../movimento.js';
import { criarMeuDia } from '../meudia.js';
import { fatorRota } from '../escala.js';
import { DB, framed, esc, title } from './base.js';
import { ME, UI, podeItem, admMod, modsReais } from './estado.js';
import { I } from '../ui/icones.js';
import { escala, turmaFicha, desligadoDe, sitDiaDe, limparPresenca } from '../calc/presenca.js';
import { sheet, formSheet, showErr, prepararFoto, toast } from '../ui/janelas.js';
import { render, schedule, isMobile } from '../ui/shell.js';
import { checkinPendentes } from '../telas/efetivo.js';
import { jusPendentes } from '../telas/horas-justificativas.js';

// Criadas por inicio.js (PES, MD) ou quando o arquivo da tela chega (EQ, AD, GE). Os outros arquivos leem estas variáveis.
export let PES = null, MD = null, EQ = null, AD = null, GE = null;

// Pessoas e Meu dia (antes de abrir o link recebido).
export function criarModulos() {
  PES = criarPessoas(DB);
  // Área de atuação de cada ficha do Efetivo (organiza as fichas por área no banco). Só o administrador calcula,
  // e só depois que os dados de todos os módulos chegaram; antes disso devolve null e nada muda de lugar.
  if (DB.definirChaveArea) DB.definirChaveArea(c => {
    if (!ME || ME.papel !== 'admin') return null;
    const ok = SET_KEYS.every(k => { const d = DB.dados(k); return d.configLoaded && (!d.config || d.colabsLoaded); }) && (!DB.cache.e || DB.cache.e.loaded);
    return ok ? chaveFicha(PES.lotacao(c).area) : null;
  });
  MD = criarMeuDia({ checkinPend: k => checkinPendentes(k), jusPend: k => jusPendentes(k), get ME() { return ME; }, DB, esc, title, I, toast, render: () => render(), modsDe: modsReais, sitEscala: sitDiaDe, fatorRota: cs => fatorRota(cs, escala().regimes) });
}

// ---- telas carregadas sob demanda ----
// EQ: Operação (equip.js, que traz eqcalc.js) · AD: Frequência e férias (administrativo.js) · GE: fichas do Efetivo (gestao.js, que traz importar.js)
const CARGA = {
  EQ: () => import('../equip.js').then(m => { EQ = m.criarEquip({ podeItem, escala: () => escala(), desligadoDe, PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, framed, UI }); }),
  AD: () => import('../administrativo.js').then(m => { AD = m.criarAdministrativo({ podeItem, limparPresenca, turmaFicha, desligadoDe, pulsar: el => M.pulsar(el), get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), agendar: () => { clearTimeout(window._aqt); window._aqt = setTimeout(schedule, 200); }, UI, isMobile, escala: () => escala(), framed }); }),
  GE: () => import('../gestao.js').then(m => { GE = m.criarGestao({ podeItem, PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, prepararFoto, framed, UI }); })
};
const pronto = { EQ: () => EQ, AD: () => AD, GE: () => GE };
const pedidos = {};
// Baixa (uma vez só) o arquivo da tela; quando chega, a tela é redesenhada. Devolve uma promessa.
export function carregarModulo(k) {
  if (pronto[k]()) return Promise.resolve(pronto[k]());
  if (!pedidos[k]) {
    pedidos[k] = CARGA[k]().then(() => { schedule(); return pronto[k](); }, err => {
      pedidos[k] = null; console.error(err);
      toast('Não foi possível abrir esta tela agora. Confira o sinal e tente de novo.');
      return null;
    });
  }
  return pedidos[k];
}
// O módulo, se já chegou; senão pede o arquivo e devolve null (quem desenha mostra o esqueleto enquanto isso).
export function modulo(k) {
  const m = pronto[k](); if (m) return m;
  carregarModulo(k); return null;
}
// Desenha com o módulo, ou o esqueleto enquanto o arquivo chega.
export const comModulo = (k, fn) => { const m = modulo(k); return m ? fn(m) : M.ESQUELETO; };
// Logo depois do login: baixa em segundo plano as telas dos módulos da pessoa (abrem na hora quando ela tocar).
export function precarregarModulos(u) {
  const ms = modsReais(u); const ks = [];
  if (ms.includes('equipamentos')) ks.push('EQ');
  if (ms.includes('gestao')) ks.push('GE');
  if (ms.includes('frequencia')) ks.push('AD');
  if (!ks.length) return;
  const ir = () => ks.forEach(k => carregarModulo(k));
  if ('requestIdleCallback' in window) requestIdleCallback(ir, { timeout: 1500 }); else setTimeout(ir, 300);
}
