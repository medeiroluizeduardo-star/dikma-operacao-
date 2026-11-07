// Dikma Gestão — mudança no Plano padrão vale também na Programação já gerada, de HOJE em diante.
// Sem tela e sem banco: quem chama lê as semanas da área e grava o que estas funções devolvem.
//
// Regras (o passado não muda: o que já aconteceu fica como foi apontado):
//   - dia desmarcado no plano (ou atividade tirada do plano): a célula ainda não apontada ('P') vira '_' (sem programação);
//   - dia marcado no plano: a célula vazia ('_') vira 'P', exceto feriado sem operação, pendência dispensada na Limpeza
//     ou atividade incluída fora da programação (marcas fe, dx, fp) — essas ficam como estão;
//   - células já apontadas (R, N, E) nunca mudam;
//   - atividade nova no plano entra nas semanas já geradas (de hoje em diante) com os dias marcados.
import { add } from './cal.js';

const linhaDe = (doc, pid) => (doc.s && doc.s[pid]) || '_______';
const temNaSemana = (doc, pid) => (doc.ids || []).includes(pid) || !!(doc.s && doc.s[pid] != null);

// docs: semanas da área no formato do banco ({ id, area, ini, ids, s, fe, dx, fp }).
// item: atividade do plano ({ id, dias: '1111100', ativo }). opc: { hoje: 'AAAA-MM-DD', fer: Map data → descrição }.
// Devolve uma alteração por semana que muda: { id, area, ini, pid, linha, novo, n } (novo = a atividade ainda não estava na semana).
export function planoNasSemanas(docs, item, { hoje, fer = new Map() } = {}) {
  const out = [];
  const dias = item.ativo === false ? '0000000' : String(item.dias || '0000000').padEnd(7, '0');
  for (const doc of docs || []) {
    const tem = temNaSemana(doc, item.id);
    if (!tem && !dias.includes('1')) continue;
    const atual = tem ? linhaDe(doc, item.id) : '_______';
    const nova = [...atual]; let n = 0;
    for (let k = 0; k < 7; k++) {
      const dt = add(doc.ini, k); if (dt < hoje) continue; // o passado fica como está
      const key = item.id + '|' + k;
      const marca = (doc.fe && doc.fe[key]) || (doc.dx && doc.dx[key]) || (doc.fp && doc.fp[key]);
      if (dias[k] === '0' && atual[k] === 'P' && !(doc.fp && doc.fp[key])) { nova[k] = '_'; n++; }
      else if (dias[k] === '1' && atual[k] === '_' && !marca && !fer.has(dt)) { nova[k] = 'P'; n++; }
    }
    if (n || (!tem && dias.includes('1') && nova.join('') !== '_______')) out.push({ id: doc.id, area: doc.area, ini: doc.ini, pid: item.id, linha: nova.join(''), novo: !tem, n });
  }
  return out;
}

// Texto curto do que mudou, para o aviso na tela.
export function resumoMudanca(muda) {
  const n = muda.reduce((s, x) => s + x.n, 0); const sem = new Set(muda.map(x => x.id)).size;
  return n ? `Programação ajustada: ${n} dia${n === 1 ? '' : 's'} em ${sem} semana${sem === 1 ? '' : 's'}, de hoje em diante` : '';
}
