// Dikma Gestão — atividades em FERIADO SEM OPERAÇÃO (Pátio e Bateria, todas as áreas e rotas).
// Sem tela e sem banco: quem chama lê as semanas e grava o que estas funções devolvem.
//   - tela: Administração › Escalas e turnos, ao salvar (telas/config.js), e o Gerador de meses (data.js);
//   - rotina do GitHub: integracao/avisos (de hora em hora) e o workflow manual "Aplicar feriados".
//
// COMO FUNCIONA (a mesma ideia da dispensa da Limpeza de dados, com uma marca própria)
// Em todo dia que é feriado sem operação, a atividade programada e ainda não apontada (célula 'P') volta a '_'
// (sem programação) e a semana guarda a marca fe['atividade|dia'] = descrição do feriado. Assim ela deixa de contar
// como programada, atrasada, pendente e não realizada em TODAS as contas que já existem (Programação, Painel,
// Pendências, Meu dia, Aprovação, avisos no celular, resumos e o Painel Coqueria). Só a Programação e o Apontar olham
// a marca, para mostrar "Feriado · descrição" em cinza.
//   - Células já apontadas (R, N, E) no feriado não mudam.
//   - Atividade incluída fora da programação no feriado (marca fp) ou devolvida pelo supervisor continua como está.
//   - Feriado removido (ou que passou a "com operação"): a célula marcada volta a 'P' e a marca sai.
// Os feriados valem de Administração › Escalas e turnos (config/escalas) e os "sem operação" da Operação (eq/config):
// a mesma lista da escala de turno (escala.js).
import { add } from './cal.js';
import { criarEscala } from './escala.js';
import { feriadosOperacao } from './situacao.js';

// Feriados sem operação: Map data → descrição. cfgEsc = config/escalas · eqCfg = eq/config (pode faltar).
export const mapaFeriados = (cfgEsc, eqCfg) => criarEscala(cfgEsc || {}, {}, feriadosOperacao(eqCfg)).feriados;
// Marca de um Map (para saber se mudou desde a última vez): "data=descrição;…" em ordem.
export const assinaturaFeriados = fer => [...fer.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, t]) => `${d}=${t}`).join(';');

// Linha de uma atividade na semana: no banco fica em s[atividade]; na tela também em d[i].
const linhaDe = (doc, pid) => (doc.s && doc.s[pid]) || (doc.d && doc.ids ? doc.d[doc.ids.indexOf(pid)] : '') || '_______';
// A célula está fora da conta por ser feriado: devolve a descrição (ou '').
export const feriadoDaCelula = (doc, pid, k) => (doc && doc.fe && doc.fe[pid + '|' + k] && linhaDe(doc, pid)[k] === '_' ? doc.fe[pid + '|' + k] : '');

// O que muda nas semanas. docs: semanas no formato do banco ({ id, area, ini, mes, ids, s, fe, fp }).
// fer: Map data → descrição (mapaFeriados). Opções:
//   desfazer (padrão true): também devolve a 'P' o que foi marcado num dia que não é mais feriado. Quem não conseguiu
//     ler todos os feriados (ex.: sem acesso à Operação) passa false, para não desfazer o que a rotina marcou.
//   aprov: { idDaSemana: { 'atividade|dia': { s } } } — o que o supervisor devolveu ao líder (s 'D') fica como está.
// Devolve uma alteração por semana que muda: { id, area, ini, mes, cel: [{ pid, k, dt, acao, desc }], campos }
//   acao: 'feriado' (P → _ com a marca) · 'volta' (_ → P, a marca sai) · 'desc' (só a descrição mudou) · 'marca' (marca solta sai)
//   campos: [[caminho[], valor]] (valor null apaga o campo) — o mesmo formato da Limpeza de dados.
export function planoFeriados(docs, fer, { desfazer = true, aprov = {} } = {}) {
  const out = [];
  for (const doc of docs) {
    if (!doc || !doc.ini) continue;
    const fe = doc.fe || {}, fp = doc.fp || {}, ap = aprov[doc.id] || {};
    const ids = doc.ids || [];
    const cel = [], novas = {}, marcas = [];
    const dias = Array.from({ length: 7 }, (_, k) => add(doc.ini, k));
    if (!ids.some((pid, i) => linhaDe(doc, pid).includes('P') && dias.some(dt => fer.has(dt))) && !Object.keys(fe).length) continue;
    for (const pid of ids) {
      const str = linhaDe(doc, pid); let a = null;
      for (let k = 0; k < 7; k++) {
        const key = pid + '|' + k, dt = dias[k], desc = fer.get(dt), marca = fe[key], c = str[k];
        if (desc) {
          if (c === 'P' && !marca && !fp[key] && !(ap[key] && ap[key].s === 'D')) { (a ||= [...str])[k] = '_'; marcas.push([key, desc]); cel.push({ pid, k, dt, acao: 'feriado', desc }); }
          else if (marca && c === '_' && marca !== desc) { marcas.push([key, desc]); cel.push({ pid, k, dt, acao: 'desc', desc }); }
        } else if (marca && desfazer) {
          if (c === '_') { (a ||= [...str])[k] = 'P'; cel.push({ pid, k, dt, acao: 'volta', desc: marca }); }
          else cel.push({ pid, k, dt, acao: 'marca', desc: marca });
          marcas.push([key, null]);
        }
      }
      if (a) novas[pid] = a.join('');
    }
    // marcas de atividades que saíram da semana: só tiram a marca quando o dia não é mais feriado
    if (desfazer) for (const key of Object.keys(fe)) {
      const [pid, k] = key.split('|'); if (ids.includes(pid)) continue;
      const dt = dias[+k]; if (dt && fer.has(dt)) continue;
      marcas.push([key, null]); cel.push({ pid, k: +k, dt: dt || '', acao: 'marca', desc: fe[key] });
    }
    if (!cel.length) continue;
    const campos = [...Object.entries(novas).map(([pid, s]) => [['s', pid], s]), ...marcas.map(([key, v]) => [['fe', key], v])];
    out.push({ id: doc.id, area: doc.area, ini: doc.ini, mes: doc.mes, cel, campos });
  }
  return out;
}

// Quantas atividades saíram da conta (feriado) e quantas voltaram (feriado removido).
export function contarPlano(plano) {
  let feriado = 0, volta = 0, outras = 0;
  for (const x of plano) for (const c of x.cel) { if (c.acao === 'feriado') feriado++; else if (c.acao === 'volta') volta++; else outras++; }
  return { feriado, volta, outras, semanas: plano.length };
}

// Resumo para a rotina e o workflow: por feriado (data), conjunto e área, quantas atividades mudam.
// planos: [{ conj, plano }] → [{ dt, desc, conj, area, feriado, volta }] em ordem de data, conjunto e área.
export function resumoPorFeriado(planos) {
  const m = new Map();
  for (const { conj, plano } of planos) for (const x of plano) for (const c of x.cel) {
    if (c.acao === 'marca') continue;
    const key = `${c.dt}|${conj}|${x.area}`;
    if (!m.has(key)) m.set(key, { dt: c.dt, desc: c.desc, conj, area: x.area, feriado: 0, volta: 0 });
    const r = m.get(key); if (c.acao === 'feriado') r.feriado++; else if (c.acao === 'volta') r.volta++;
    if (c.acao === 'feriado' || c.acao === 'desc') r.desc = c.desc;
  }
  return [...m.values()].filter(r => r.feriado || r.volta).sort((a, b) => (a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : a.conj.localeCompare(b.conj) || a.area.localeCompare(b.area)));
}

// Aplica as alterações (caminho → valor; null apaga o campo) num documento em memória.
export function aplicarCamposFer(doc, campos) {
  for (const [p, v] of campos) {
    let o = doc; for (const x of p.slice(0, -1)) o = (o[x] && typeof o[x] === 'object' ? o[x] : (o[x] = {}));
    const f = p[p.length - 1]; if (v === null) delete o[f]; else o[f] = v;
  }
  return doc;
}
// Semana nova (Gerador de meses) ou em memória (demonstração): já sai com os feriados aplicados.
// Devolve quantas atividades ficaram fora da conta.
export function aplicarNaSemana(doc, fer, opc) {
  const [x] = planoFeriados([doc], fer, opc); if (!x) return 0;
  aplicarCamposFer(doc, x.campos);
  if (doc.d && doc.ids) doc.d = doc.ids.map(p => (doc.s && doc.s[p]) || '_______');
  return x.cel.filter(c => c.acao === 'feriado').length;
}
