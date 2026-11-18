// Plano padrão → Programação: depois de mudar os dias, tirar ou incluir uma atividade no plano, ajusta as semanas
// já geradas da área, de hoje em diante (as contas ficam em planoaplica.js).
import { planoNasSemanas, resumoMudanca } from '../contas/planoaplica.js';
import { DB, TODAY } from '../nucleo/base.js';
import { escala } from '../calc/presenca.js';
import { toast } from '../ui/janelas.js';

// item: uma atividade ou várias da mesma área (várias atividades novas do mesmo local, de uma vez).
export async function planoNaProgramacao(item) {
  const itens = (Array.isArray(item) ? item : [item]).filter(Boolean);
  if (!itens.length || !DB.semanasDaArea) return;
  try {
    const docs = await DB.semanasDaArea(itens[0].area);
    const opc = { hoje: TODAY, fer: escala().feriados || new Map() };
    const muda = itens.flatMap(x => planoNasSemanas(docs, x, opc));
    if (!muda.length) return;
    await DB.gravarPlanoNasSemanas(muda);
    toast(resumoMudanca(muda));
  } catch (e) { toast('O plano foi salvo, mas não deu para ajustar a Programação agora: ' + (e.message || e)); }
}
