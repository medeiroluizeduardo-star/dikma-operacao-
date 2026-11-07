// Plano padrão → Programação: depois de mudar os dias, tirar ou incluir uma atividade no plano, ajusta as semanas
// já geradas da área, de hoje em diante (as contas ficam em planoaplica.js).
import { planoNasSemanas, resumoMudanca } from '../contas/planoaplica.js';
import { DB, TODAY } from '../nucleo/base.js';
import { escala } from '../calc/presenca.js';
import { toast } from '../ui/janelas.js';

export async function planoNaProgramacao(item) {
  if (!item || !DB.semanasDaArea) return;
  try {
    const docs = await DB.semanasDaArea(item.area);
    const muda = planoNasSemanas(docs, item, { hoje: TODAY, fer: escala().feriados || new Map() });
    if (!muda.length) return;
    await DB.gravarPlanoNasSemanas(muda);
    toast(resumoMudanca(muda));
  } catch (e) { toast('O plano foi salvo, mas não deu para ajustar a Programação agora: ' + (e.message || e)); }
}
