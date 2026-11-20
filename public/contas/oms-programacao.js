// Operação › OMs: programação da semana (segunda a domingo) para mandar ao cliente. Contas sem tela.
// Na sexta, a partir das 14h, a rotina dos avisos manda ao cliente do conjunto e a quem trata as OMs (Técnico de Processo,
// coordenador, gestor, administrador) o aviso de que a programação da próxima semana está pronta; o link abre a semana
// em Operação › OMs, onde o botão "Programação da semana" imprime ou salva o PDF (no padrão dos resumos) e baixa o Excel.
// O documento traz: as OMs da semana dia a dia (com o que falta da documentação), as que ficaram em aberto de antes e como
// foi a semana anterior (aderência, a mesma conta dos Indicadores). Usado pela tela (telas/oms-programacao.js), pelos testes
// (testes/oms.test.mjs) e pela rotina dos avisos no celular (integracao/avisos/planejar.mjs).
import { ABERTAS, PRIORIDADES, diaDe, docsResumo, trataOmU, clienteDe } from './oms.js';
import { numerosOms } from './oms-indicadores.js';
import { add, weekOf } from './cal.js';

// Sexta-feira (getDay() = 5), a partir das 14h: o técnico tem a manhã para fechar a semana seguinte.
export const PROG_DIA = 5;
export const PROG_HORA = 14;
const dow = d => new Date(d + 'T12:00:00').getDay();
// Semana que o botão mostra primeiro: da sexta em diante, a próxima; antes, a semana corrente.
export const semanaDaProgramacao = hoje => (dow(hoje) === 0 || dow(hoje) >= PROG_DIA ? add(weekOf(hoje), 7) : weekOf(hoje));

const PRIO_ORD = { emergencia: 0, alta: 1, media: 2, baixa: 3 };
const ordem = (a, b) => diaDe(a).localeCompare(diaDe(b)) || PRIO_ORD[a.prio || 'media'] - PRIO_ORD[b.prio || 'media'] || String(a.titulo || '').localeCompare(String(b.titulo || ''));
// Documentação em poucas palavras: o que falta, "Pronta", "Não precisa" ou "Sem a lista".
export function docsFalta(o) {
  const r = docsResumo(o);
  if (!r) return 'Sem a lista';
  if (r.completa) return r.total ? 'Pronta' : 'Não precisa';
  return 'Falta: ' + r.itens.filter(i => !i.ok).map(i => i.nome).join(', ');
}
const urgente = o => ['alta', 'emergencia'].includes(o.prio);
const docsPendente = o => { const r = docsResumo(o); return !!r && !r.completa; };

// Programação da semana que começa na segunda ini (AAAA-MM-DD), com as OMs l (de um conjunto ou dos dois).
// - oms: as OMs com dia na semana (data prevista; nas antigas, o dia da solicitação), sem as canceladas, por dia e prioridade.
// - dias: os 7 dias, com as OMs de cada um.
// - pendentes: as que seguem em aberto com dia antes da semana (entram na conta do cliente também).
// - anterior: os números da semana anterior (previstas, finalizadas, aderência...), os mesmos dos Indicadores.
export function programacaoSemana(l, ini, hoje, cfg = null) {
  const fim = add(ini, 6);
  const oms = l.filter(o => o.status !== 'cancelada' && diaDe(o) >= ini && diaDe(o) <= fim).sort(ordem);
  const dias = Array.from({ length: 7 }, (_, i) => { const d = add(ini, i); return { dia: d, oms: oms.filter(o => diaDe(o) === d) }; });
  const pendentes = l.filter(o => ABERTAS.includes(o.status) && !!diaDe(o) && diaDe(o) < ini).sort(ordem);
  const antIni = add(ini, -7); const antFim = add(ini, -1);
  const anterior = antIni <= hoje ? { ini: antIni, fim: antFim, ...numerosOms(l, { ini: antIni, fim: antFim }, hoje, cfg) } : null;
  const porArea = [...new Set(oms.map(o => o.area || ''))].map(a => ({ area: a, n: oms.filter(o => (o.area || '') === a).length, urgentes: oms.filter(o => (o.area || '') === a && urgente(o)).length }))
    .sort((x, y) => y.n - x.n || String(x.area).localeCompare(String(y.area)));
  const porPrio = Object.keys(PRIORIDADES).reverse().map(k => ({ prio: k, n: oms.filter(o => (o.prio || 'media') === k).length })).filter(x => x.n);
  return {
    ini, fim, oms, dias, pendentes, anterior, porArea, porPrio,
    total: oms.length, urgentes: oms.filter(urgente).length, docsPend: oms.filter(docsPendente).length,
    semLista: oms.filter(o => !docsResumo(o)).length, planejadas: oms.filter(o => o.status === 'planejada').length
  };
}

// Aviso da sexta: para cada conjunto com OM na próxima semana, o cliente do conjunto e quem trata as OMs nele.
// Devolve [{ uid, conj, ini, n, urgentes, docsPend, chave }] (uma vez por pessoa, conjunto e semana).
export function avisosProgramacao(oms, usuarios, hoje, hora, cfg = null) {
  if (dow(hoje) !== PROG_DIA || hora < PROG_HORA) return [];
  const ini = add(weekOf(hoje), 7); const out = [];
  for (const conj of [...new Set(oms.map(o => o.conj).filter(Boolean))].sort()) {
    const p = programacaoSemana(oms.filter(o => o.conj === conj), ini, hoje, cfg);
    if (!p.total) continue;
    const cli = clienteDe(cfg, conj);
    const alvo = [...new Set([...(cli && usuarios[cli.uid] ? [cli.uid] : []), ...Object.entries(usuarios).filter(([uid, u]) => trataOmU({ ...u, uid }, conj)).map(([uid]) => uid)])];
    for (const uid of alvo) out.push({ uid, conj, ini, n: p.total, urgentes: p.urgentes, docsPend: p.docsPend, chave: `omprog|${uid}|${conj}|${ini}` });
  }
  return out;
}
