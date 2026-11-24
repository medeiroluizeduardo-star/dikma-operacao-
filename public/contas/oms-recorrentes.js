// Operação › OMs › Preventivas que se repetem (2026-11-24). Contas sem tela.
// Quem trata as OMs no conjunto (Técnico de Processo, coordenador, gestor, administrador) cadastra uma vez a preventiva
// (serviço, área, local, prioridade) e quando ela se repete: toda semana (em um ou mais dias da semana), a cada 2 semanas
// ou todo mês (num dia do mês). O sistema cria sozinho a OM "Planejada" de cada data, até 3 semanas para a frente, quando
// alguém que trata abre a tela das OMs. No dia, o líder solicita como qualquer planejada.
// Banco: omsrec/{id} { conj, area, local, equip, titulo, desc, prio, freq 'semana'|'quinzena'|'mes', dias [0..6]
// (0 = segunda), dia (1 a 28, no mês), inicio 'AAAA-MM-DD', ativa (bool), ate 'AAAA-MM-DD' (até onde já criou),
// criadoPor, criadoNome, atualizadoEm, atualizadoPor }.
// A OM criada tem o id fixo R<id da preventiva>_<AAAAMMDD>: duas pessoas abrindo a tela ao mesmo tempo não criam duas.
// Apagar a OM criada não a faz voltar (o "ate" já passou daquela data).
import { add, weekOf } from './cal.js';
import { PRIORIDADES, LIMITES, passo, agoraLocal, dataBR } from './oms.js';

export const FREQ = { semana: 'Toda semana', quinzena: 'A cada 2 semanas', mes: 'Todo mês' };
export const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
// Até quantos dias para a frente as OMs planejadas são criadas (cobre a programação da próxima semana, que sai na sexta).
export const HORIZONTE = 21;
const ehData = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s);
const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const erro = (m, campo) => { const e = /** @type {Error & { campo?: string }} */ (new Error(m)); e.campo = campo; throw e; };
// 0 = segunda … 6 = domingo.
const dow = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;

export function conferirRecorrente(x, areasOk = null) {
  const y = {
    area: t(x.area, 40), local: t(x.local, LIMITES.local), equip: t(x.equip, LIMITES.equip), titulo: t(x.titulo, LIMITES.titulo), desc: t(x.desc, LIMITES.desc),
    prio: PRIORIDADES[x.prio] ? x.prio : 'media', freq: FREQ[x.freq] ? x.freq : 'semana',
    dias: [...new Set((x.dias || []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort(),
    dia: Number(x.dia), inicio: ehData(x.inicio) ? x.inicio : '', ativa: x.ativa !== false
  };
  if (!y.area) erro('Escolha a área.', 'orArea');
  if (areasOk && !areasOk.includes(y.area)) erro('Você não planeja nesta área.', 'orArea');
  if (!y.titulo || y.titulo.length < 5) erro('Diga em poucas palavras o serviço (mínimo 5 letras).', 'orTit');
  if (!y.local) erro('Informe o equipamento ou o local.', 'orLocal');
  if (!y.inicio) erro('Informe a partir de quando vale.', 'orIni');
  if (y.freq === 'mes') { if (!Number.isInteger(y.dia) || y.dia < 1 || y.dia > 28) erro('Escolha o dia do mês (de 1 a 28).', 'orDia'); y.dias = []; }
  else { if (!y.dias.length) erro('Marque pelo menos um dia da semana.', 'orD0'); y.dia = 0; }
  return y;
}

// Datas da preventiva entre de e ate (inclusive), nunca antes do início.
export function datasDa(r, de, ate) {
  const l = []; if (!r || !ehData(r.inicio)) return l;
  const ini = de < r.inicio ? r.inicio : de;
  for (let d = ini; d <= ate; d = add(d, 1)) {
    if (r.freq === 'mes') { if (+d.slice(8, 10) === r.dia) l.push(d); continue; }
    if (!(r.dias || []).includes(dow(d))) continue;
    // A cada 2 semanas: conta as semanas a partir da semana do início.
    if (r.freq === 'quinzena') { const sem = Math.round((Date.parse(weekOf(d)) - Date.parse(weekOf(r.inicio))) / (7 * 864e5)); if (sem % 2) continue; }
    l.push(d);
  }
  return l;
}
export const idDaOm = (rid, dia) => `R${rid}_${dia.replace(/-/g, '')}`;
// "Toda semana: Seg, Qui" / "Todo mês: dia 5".
export const freqTxt = r => (r.freq === 'mes' ? `${FREQ.mes}: dia ${r.dia}` : `${FREQ[r.freq] || FREQ.semana}: ${(r.dias || []).map(i => DIAS_SEM[i]).join(', ')}`);
// Próxima data (a partir de hoje), para a lista.
export const proximaData = (r, hoje) => (r && r.ativa !== false ? datasDa(r, hoje, add(hoje, 62))[0] || '' : '');

// O que criar agora: para cada preventiva ativa, as datas depois do "ate" (ou desde hoje) até hoje + HORIZONTE que ainda
// não têm OM. Devolve { oms: [{ id, dados }], ate: { rid: nova data } }. quem = { uid, nome } de quem abriu a tela.
export function aCriar(recs, existentes, hoje, quem) {
  const oms = [], ate = {}; const fim = add(hoje, HORIZONTE);
  for (const r of recs) {
    if (!r || r.ativa === false || !r.id) continue;
    const de = ehData(r.ate) && r.ate >= hoje ? add(r.ate, 1) : hoje;
    if (de > fim) continue;
    for (const dia of datasDa(r, de, fim)) {
      const id = idDaOm(r.id, dia); if (existentes[id]) continue;
      oms.push({ id, dados: {
        area: r.area, local: r.local || '', equip: r.equip || '', titulo: r.titulo, desc: r.desc || '', tipo: 'preventiva', prio: r.prio || 'media',
        status: 'planejada', dPrev: dia, hSol: '', docs: {},
        hist: [passo('planejada', quem, `preventiva que se repete (${freqTxt(r).toLowerCase()}) · prevista para ${dataBR(dia)}`, agoraLocal())]
      } });
    }
    ate[r.id] = fim;
  }
  return { oms, ate };
}
