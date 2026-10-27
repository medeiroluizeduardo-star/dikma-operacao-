// Partes criadas na entrada: pessoas (PES), Meu dia (MD) e as telas de Operação (EQ), Frequência (AD) e fichas do Efetivo (GE).
import { SET_KEYS } from '../cal.js';
import { criarGestao } from '../gestao.js';
import { criarEquip } from '../equip.js';
import { criarPessoas, chaveFicha } from '../pessoas.js';
import * as M from '../movimento.js';
import { criarMeuDia } from '../meudia.js';
import { criarAdministrativo } from '../administrativo.js';
import { fatorRota } from '../escala.js';
import { DB, framed, esc, title } from './base.js';
import { ME, UI, podeItem, admMod, modsReais } from './estado.js';
import { I } from '../ui/icones.js';
import { escala, turmaFicha, desligadoDe, sitDiaDe, limparPresenca } from '../calc/presenca.js';
import { sheet, formSheet, showErr, prepararFoto, toast } from '../ui/janelas.js';
import { render, schedule, isMobile } from '../ui/shell.js';
import { checkinPendentes } from '../telas/efetivo.js';
import { jusPendentes } from '../telas/horas-justificativas.js';


// Criadas por inicio.js, depois que todas as partes da interface estão prontas (os outros arquivos leem estas variáveis).
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

// Telas de Operação (equipamentos), Frequência e férias e fichas do Efetivo.
export function criarTelasDosModulos() {
  EQ = criarEquip({ podeItem, escala: () => escala(), desligadoDe, PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, framed, UI });
  AD = criarAdministrativo({ podeItem, limparPresenca, turmaFicha, desligadoDe, pulsar: el => M.pulsar(el), get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), agendar: () => { clearTimeout(window._aqt); window._aqt = setTimeout(schedule, 200); }, UI, isMobile, escala: () => escala(), framed });
  GE = criarGestao({ podeItem, PES, get ME() { return ME; }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: admMod, prepararFoto, framed, UI });
}
