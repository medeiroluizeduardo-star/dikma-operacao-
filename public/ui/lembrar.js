// Botão "Lembrar disto" (Minha agenda): nas OMs, nas anomalias e nas fichas, cria um item na agenda da pessoa já ligado
// ao registro; na agenda, o botão Abrir volta para ele (telas/agenda.js › irPara). Só aparece para quem tem a aba
// Minha agenda liberada (ela começa desligada para todos; navegacao.js › gagenda).
import { esc } from '../nucleo/base.js';
import { ME, modsDe, permCfg } from '../nucleo/estado.js';
import { podeVer } from '../contas/permissoes.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from './icones.js';

// A mesma declaração da aba em navegacao.js (VIEWS › gagenda); repetida aqui para não ligar este arquivo ao menu.
const ABA = { id: 'gagenda', mod: 'gestao', desligada: true };
export function temAgenda() { return !!(ME && modsDe(ME).includes('gestao') && podeVer(ME, ABA, permCfg(), 'gestao')); }
// link = { m: módulo, v: aba, act: ação que abre o registro, id, col, mat, r: nome mostrado na agenda }; titulo = sugestão.
export function botaoLembrar(link, titulo = '', cls = 'btn sm') {
  if (!temAgenda()) return '';
  const at = Object.entries(link).filter(([, x]) => x != null && x !== '').map(([k, x]) => ` data-l${k}="${esc(String(x))}"`).join('');
  return `<button type="button" class="${cls}" data-act="agLembrar"${at} data-lt="${esc(titulo)}">${I.agenda} Lembrar disto</button>`;
}
acoes.agLembrar = async (t, d) => {
  const link = { m: d.lm, v: d.lv, act: d.lact, id: d.lid, col: d.lcol, mat: d.lmat, r: d.lr };
  // Fecha a janela de onde veio (OM, registro da Segurança) antes de abrir o formulário da agenda.
  document.querySelectorAll('[data-sgclose]').forEach(b => /** @type {HTMLElement} */ (b).click());
  const AG = await import('../telas/agenda.js');
  AG.novoComLink(link, d.lt || '');
};
