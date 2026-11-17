// Administração › Trazer do Meu painel (contas sem tela): converte os dados do Meu painel (painel/{uid}/..., o site
// antigo "Painel Coqueria") para as telas do Dikma Gestão. Não grava nada: devolve o plano do que vai para cada lugar
// (nucleo/data.js › painelTrazer grava só o que ainda não existe, então rodar duas vezes não duplica).
//   tasks (ações)      → Gestão › Tratativas (tipo acao)      · tarefas da rotina → Processos e rotina (rotina/{pid}_{data})
//   planos (5W2H)      → Gestão › Tratativas (tipo plano)     · atas → Gestão › Tratativas (tipo ata)
//   inspecoes          → Segurança › Inspeções (sem gerar anomalias: os Não OK do painel já viraram ações)
//   documentos         → Administração › Documentos e OMs
//   registros          → Gestão › Medição (lançados, ocultos e digitados)
//   config/main        → Indicadores (metas e ICCC/ICCP de cada mês)
// Ficam de fora (decidido no plano): anotações (podem ser baixadas num arquivo), Queda Zero e relatório fotográfico
// (o Dikma já tem os seus), equipe e calculadoras.
import { conferirManual, TIPOS as TIPOS_MED } from './medicao.js';
import { conferir as conferirDoc } from './documentos.js';
import { notaInsp } from './inspecoes.js';

export const COLECOES = ['tasks', 'planos', 'atas', 'inspecoes', 'documentos', 'registros', 'config', 'notas', 'quedas', 'relatorios'];
export const PREFIXO = 'mp_'; // id no Dikma = mp_ + id no Meu painel
const CONJ = { bat: 'bateria', pat: 'patio', ger: 'coq' };
const AREA_SEG = { bat: ['BATERIA', 'bateria'], pat: ['PÁTIO DE CARVÃO', 'patio'], ger: ['COQUERIA GERAL', ''] };
const STATUS = { todo: 'aberta', doing: 'andamento', review: 'andamento', done: 'feita', nfeita: 'cancelada' };
const ROT = { todo: 'aberta', doing: 'andamento', review: 'andamento', done: 'feita', nfeita: 'nfeita' };
const PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const dataOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const txt = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);
const linha = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v) * 100) / 100);
const isoDe = v => { if (!v) return ''; const d = new Date(typeof v === 'number' ? v : String(v)); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const lista = o => Object.entries(o || {}).filter(([, v]) => v && typeof v === 'object').map(([id, v]) => ({ ...v, id: v.id || id }));
export const idNovo = id => PREFIXO + String(id).replace(/[^\w-]/g, '_').slice(0, 120);

// Nomes da equipe do painel (config/equipe.people), para trocar o código da pessoa pelo nome.
function nomesDe(P) {
  const eq = ((P.config || {}).equipe || {}).people || {};
  return k => (eq[k] && eq[k].n ? String(eq[k].n) : '');
}

// Ações (não da rotina) → tratativas tipo acao.
function acao(t, P, nome, quando) {
  const planos = P.planos || {}, atas = P.atas || {}, insp = P.inspecoes || {};
  let origem = 'outra', ref = '';
  if (t.ata) { origem = 'reuniao'; ref = (atas[t.ata] || {}).titulo || 'Reunião'; }
  else if (t.queda) { origem = 'queda'; ref = 'Queda Zero'; }
  else if (t.insp) { const i = insp[t.insp] || {}; origem = i.tipo === 'seg' ? 'seguranca' : 'outra'; ref = 'Inspeção ' + ({ s5: '5S', seg: 'de segurança', area: 'da área' }[i.tipo] || ''); }
  else if (t.pid) { origem = 'processos'; ref = String(t.pid); }
  let titulo = linha(t.title, 300);
  if (titulo.length < 5) titulo = linha(`Ação: ${titulo || 'sem título'}`, 300);
  const resp = (Array.isArray(t.resp) ? t.resp : []).map(nome).filter(Boolean).join(', ');
  const ck = (Array.isArray(t.checklist) ? t.checklist : []).filter(c => c && c.t);
  const nota = [
    `Trazida do Meu painel${t.prio && PRIO[t.prio] ? ` · prioridade ${PRIO[t.prio].toLowerCase()}` : ''}.`,
    t.notes ? 'Anotações: ' + t.notes : '',
    ck.length ? 'Checklist: ' + ck.map(c => `${c.ok ? '✔' : '○'} ${c.t}`).join('; ') : ''
  ].filter(Boolean).join('\n');
  const status = STATUS[t.status] || 'aberta';
  const d = {
    tipo: 'acao', titulo, por: txt(t.why, 2000), origem, ref: linha(ref, 120), conj: CONJ[t.area] || 'coq', local: linha(t.onde, 120),
    inicio: dataOk(t.inicio) ? t.inicio : '', prazo: dataOk(t.due) ? t.due : '', resp: linha(resp, 120), como: txt(t.como, 2000),
    custo: num(t.custo), custoReal: num(t.custoReal), status, plano: t.plano && planos[t.plano] ? idNovo(t.plano) : '',
    evol: [{ t: txt(nota, 600), em: quando.em, nome: linha(quando.nome, 80), uid: quando.uid }]
  };
  if (d.inicio && d.prazo && d.prazo < d.inicio) d.inicio = d.prazo;
  if (t.ata && atas[t.ata]) d.ata = idNovo(t.ata);
  if (status === 'feita') d.feitaEm = isoDe(t.completedAt) || quando.em;
  d.criadoEm = isoDe(t.createdAt) || quando.em;
  return d;
}

function plano(p) {
  let nome = linha(p.nome, 120); if (nome.length < 3) nome = linha(`Plano ${nome || 'sem nome'}`, 120);
  return { tipo: 'plano', nome, objetivo: txt(p.objetivo, 2000), conj: CONJ[p.area] || 'coq', status: p.status === 'concluido' ? 'concluido' : 'ativo', criadoEm: isoDe(p.criadoEm) };
}

function ata(a, P, nome) {
  let titulo = linha(a.titulo, 300); if (titulo.length < 3) titulo = linha(`Reunião ${titulo}`, 300);
  const tasks = P.tasks || {};
  const enc = (Array.isArray(a.acoes) ? a.acoes : []).map(e => ({
    oque: linha(e && e.oque, 300), quem: linha(nome(e && e.quem) || (e && e.quem) || '', 120), prazo: dataOk(e && e.prazo) ? e.prazo : '',
    trat: e && e.task && tasks[e.task] && !tasks[e.task].deleted ? idNovo(e.task) : ''
  })).filter(e => e.trat || e.oque.length >= 5).slice(0, 60);
  return {
    tipo: 'ata', titulo, data: dataOk(a.data) ? a.data : '', local: linha(a.local, 120), participantes: txt(a.participantes, 600),
    pauta: txt(a.pauta, 5000), decisoes: txt(a.decisoes, 5000), enc, plano: a.plano && (P.planos || {})[a.plano] ? idNovo(a.plano) : ''
  };
}

function inspecao(x) {
  const [area, conj] = AREA_SEG[x.area] || AREA_SEG.ger;
  const itens = (Array.isArray(x.itens) ? x.itens : []).filter(i => i && i.t).slice(0, 20)
    .map(i => ({ t: linha(i.t, 200), r: ['ok', 'no', 'na'].includes(i.r) ? i.r : 'na', obs: linha(i.obs, 300) }));
  const data = dataOk(x.data) ? x.data : '';
  return { tipo: ['s5', 'seg', 'area'].includes(x.tipo) ? x.tipo : 'area', data, mes: data.slice(0, 7), area, conj, local: linha(x.local, 120).toUpperCase() || area, itens, nota: notaInsp(itens), obs: 'Trazida do Meu painel.' };
}

// Medição: registros do Dikma marcados no painel (lançado/oculto) e os digitados à mão.
function medicao(regs, nome, quando, erros) {
  const med = {};
  const mes = ym => (med[ym] ||= { l: {}, oc: {}, man: {} });
  const marca = r => ({ por: quando.uid, nome: quando.nome, em: (isoDe(r.ts) || quando.em).slice(0, 16) });
  for (const r of regs) {
    if (!dataOk(r.data)) continue;
    const ym = r.data.slice(0, 7), id = String(r.id);
    if (id.startsWith('dk_')) {
      if (r.lancado) mes(ym).l[id] = marca(r);
      if (r.oculto) mes(ym).oc[id] = marca(r);
      continue;
    }
    if (!TIPOS_MED[r.tipo]) continue;
    const novo = idNovo(id);
    try {
      const T = TIPOS_MED[r.tipo];
      const conj = CONJ[r.area] === 'coq' ? 'patio' : CONJ[r.area] || 'patio';
      const cat = T.cat ? (T.cats.includes(r.cat) ? r.cat : r.tipo === 'ind' ? 'ICCC' : T.cats[T.cats.length - 1]) : '';
      const desc = [r.desc, r.area === 'ger' && r.tipo !== 'ind' ? '(Gestão geral no Meu painel)' : '', T.cat && cat !== r.cat && r.cat ? `(era ${r.cat})` : ''].filter(Boolean).join(' ');
      const reg = conferirManual(r.tipo, { data: r.data, quem: r.quem, conj, cat, horas: String(r.horas ?? '').replace('.', ','), desc: desc || (r.tipo === 'ind' ? 'Correção trazida do Meu painel' : '') });
      if (r.tipo === 'ind') reg.st = r.status === 'corrigido' ? 'corrigido' : 'pendente';
      mes(ym).man[novo] = { ...reg, ...marca(r) };
      if (r.lancado) mes(ym).l[novo] = marca(r);
    } catch (e) { erros.push(`Medição ${r.data.split('-').reverse().join('/')} (${TIPOS_MED[r.tipo].one}${r.quem ? ' · ' + r.quem : ''}): ${e.message}`); }
  }
  for (const k of Object.keys(med)) if (!Object.keys(med[k].l).length && !Object.keys(med[k].oc).length && !Object.keys(med[k].man).length) delete med[k];
  return med;
}

// O plano completo. P = { tasks: {id: doc}, planos, atas, ... } lido de painel/{uid}; quem = { uid, nome }.
export function planoDoPainel(P, quem, agora = new Date()) {
  P = P || {};
  const nome = nomesDe(P), erros = [];
  const quando = { uid: quem.uid, nome: quem.nome || '', em: agora.toISOString() };
  const trat = [], rotina = [];
  for (const t of lista(P.tasks)) {
    if (t.deleted) continue;
    if (t.routine) {
      const st = ROT[t.status] || 'aberta';
      if (st === 'aberta' || !/^P\d{2}$/.test(String(t.pid)) || !dataOk(t.due)) continue;
      const passos = (Array.isArray(t.checklist) ? t.checklist : []).slice(0, 20).map(c => !!(c && c.ok));
      rotina.push({ id: `${t.pid}_${t.due}`, dados: { pid: t.pid, data: t.due, status: st, passos, obs: txt(t.notes, 600), feitaEm: st === 'feita' ? isoDe(t.completedAt).slice(0, 40) : '' } });
      continue;
    }
    trat.push({ id: idNovo(t.id), dados: acao(t, P, nome, quando) });
  }
  for (const p of lista(P.planos)) trat.push({ id: idNovo(p.id), dados: plano(p) });
  for (const a of lista(P.atas)) {
    const d = ata(a, P, nome);
    if (!d.data) { erros.push(`Ata “${d.titulo}”: sem data da reunião.`); continue; }
    trat.push({ id: idNovo(a.id), dados: d });
  }
  const insp = [];
  for (const x of lista(P.inspecoes)) {
    const d = inspecao(x);
    if (!d.data || !d.itens.length) { erros.push(`Inspeção de ${x.data || 'data desconhecida'}: sem data ou sem itens.`); continue; }
    insp.push({ id: idNovo(x.id), dados: d });
  }
  const docs = [];
  for (const x of lista(P.documentos)) {
    try { docs.push({ id: idNovo(x.id), dados: { ...conferirDoc({ ...x, conj: CONJ[x.area] || 'coq', resp: nome(x.resp) || '' }), criadoEm: isoDe(x.criadoEm) } }); }
    catch (e) { erros.push(`Documento ${x.numero || x.titulo || ''}: ${e.message}`); }
  }
  const med = medicao(lista(P.registros), nome, quando, erros);
  const main = (P.config || {}).main || {};
  const metas = {};
  for (const [k, v] of Object.entries(main.metas || {})) if (['abs', 'he', 'hp', 'iccc', 'iccp', 'efic', 'queda', 's5'].includes(k) && num(v) != null) metas[k] = num(v);
  const valores = {};
  for (const [ym, v] of Object.entries(main.indVal || {})) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(ym) || !v) continue;
    const x = { iccc: num(v.iccc), iccp: num(v.iccp) };
    if (x.iccc != null || x.iccp != null) valores[ym] = x;
  }
  const fora = { notas: lista(P.notas).length, quedas: lista(P.quedas).length, relatorios: lista(P.relatorios).length };
  return { trat, rotina, insp, docs, med, ind: { metas, valores }, fora, erros };
}

// Quantos itens de cada destino (para a tela mostrar antes de gravar).
export function contarPlano(pl) {
  const c = { acoes: 0, planos: 0, atas: 0 };
  for (const t of pl.trat) c[t.dados.tipo === 'acao' ? 'acoes' : t.dados.tipo === 'plano' ? 'planos' : 'atas']++;
  let lanc = 0, ocul = 0, man = 0;
  for (const m of Object.values(pl.med)) { lanc += Object.keys(m.l).length; ocul += Object.keys(m.oc).length; man += Object.keys(m.man).length; }
  return { ...c, rotina: pl.rotina.length, insp: pl.insp.length, docs: pl.docs.length, lanc, ocul, man, metas: Object.keys(pl.ind.metas).length, valores: Object.keys(pl.ind.valores).length };
}

// Só o que ainda falta no destino: metas e meses de ICCC/ICCP que o Dikma ainda não tem; na Medição, as chaves que
// ainda não existem no mês. atual = documento atual (config/indicadores ou medicao/{mês}).
export function faltaInd(ind, atual) {
  const a = atual || {}, metas = {}, valores = {};
  for (const [k, v] of Object.entries(ind.metas || {})) if ((a.metas || {})[k] == null) metas[k] = v;
  for (const [k, v] of Object.entries(ind.valores || {})) if (!(a.valores || {})[k]) valores[k] = v;
  return { metas, valores };
}
export function faltaMed(m, atual) {
  const a = atual || {}, out = {};
  for (const campo of ['l', 'oc', 'man']) { const x = {}; for (const [k, v] of Object.entries(m[campo] || {})) if (!(a[campo] || {})[k]) x[k] = v; if (Object.keys(x).length) out[campo] = x; }
  return out;
}

// Anotações do painel num texto simples (para baixar antes de desligar o site).
export function textoNotas(notas) {
  return lista(notas).sort((a, b) => String(b.ts || b.criadoEm || '').localeCompare(String(a.ts || a.criadoEm || ''))).map(n => {
    const dt = isoDe(n.ts || n.criadoEm || n.data).slice(0, 10).split('-').reverse().join('/');
    return [`== ${linha(n.titulo || n.title || 'Anotação', 200)}${dt ? ' · ' + dt : ''}`, txt(n.texto || n.text || n.corpo || n.body || '', 20000)].join('\n');
  }).join('\n\n');
}
