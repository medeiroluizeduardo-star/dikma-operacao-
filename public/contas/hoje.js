// Dikma Gestão — cálculos do dia (atrasadas, déficit, paradas). Funções puras, usadas pelo site (navegador)
// e pela rotina de avisos no celular (GitHub Actions), para os dois mostrarem a mesma coisa.
import { add, weekOf, SETS } from './cal.js';
import { AUSENTE, AUSENCIA } from './situacao.js';

const linha = (doc, i) => (doc.d ? doc.d[i] : ((doc.s && doc.s[doc.ids[i]]) || '_______'));
const diaSemana = data => (new Date(data + 'T12:00:00').getDay() + 6) % 7; // 0 = segunda

// "Atrasadas": atividade programada (P) num dia que já passou, sem apontamento. Janela fixa: os últimos 60 dias,
// a mesma no menu e em Pendências (antes cada tela olhava o que estivesse carregado).
export const JANELA_ATRASADAS = 60;
export const inicioAtrasadas = hoje => add(hoje, -JANELA_ATRASADAS);
// atrasadasRecentes: as dos últimos 7 dias; o total é o dos 60 dias.
export const ATRASADAS_RECENTES = 7;
// semanas {id: doc} · areas (vazio = todas) · devolve [{ doc, i, k, dt }] da mais antiga para a mais nova
export function listaAtrasadas(semanas, { areas, hoje, desde = inicioAtrasadas(hoje) }) {
  const out = [];
  for (const doc of Object.values(semanas || {})) {
    if (areas && !areas.includes(doc.area)) continue;
    if (doc.ini >= hoje || add(doc.ini, 6) < desde) continue;
    for (let k = 0; k < 7; k++) {
      const dt = add(doc.ini, k); if (dt >= hoje || dt < desde) continue;
      for (let i = 0; i < doc.ids.length; i++) if (linha(doc, i)[k] === 'P') out.push({ doc, i, k, dt });
    }
  }
  return out.sort((a, b) => (a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0));
}

// Efetivo de uma rota num dia: disponíveis × necessários, com as coberturas. A mesma conta no Dimensionamento,
// no Balanço e no aviso das 17h.
// r = { area, rota, ef, carga } · o = { cs: pessoas da rota, prog: atividades programadas no dia,
//   sitDe(c) → { v, auto } (auto = folga pela escala), cob: [{ aus, sub }] coberturas do dia,
//   subOk(sub) → o substituto existe (neste conjunto ou noutro), fator: parte do quadro que trabalha por dia }
export function efetivoRota(r, o) {
  const ids = new Map(o.cs.map(c => [c.id, c])); const sit = new Map();
  let aloc = 0, aus = 0, escd = 0;
  for (const c of o.cs) {
    const s = o.sitDe(c); sit.set(c.id, s); if (s.v === 'DS') continue;
    aloc++; if (AUSENTE.has(s.v)) aus++; if (!s.auto) escd++;
  }
  // quem cobre uma ausência desta rota soma aqui; quem sai desta rota para cobrir outra, sai daqui
  let mov = 0;
  for (const x of o.cob || []) {
    if (ids.has(x.aus) && (!o.subOk || o.subOk(x.sub))) mov++;
    const s = sit.get(x.sub); if (s && s.v !== 'DS' && !AUSENTE.has(s.v)) mov--;
  }
  const fator = o.fator == null ? 1 : o.fator;
  const nec = r.carga > 0 ? Math.ceil(r.ef * o.prog / r.carga * fator) : (r.rota === 'GESTÃO' ? Math.min(r.ef, escd) : 0);
  const disp = aloc - aus + mov;
  return { disp, nec, prog: o.prog, aloc, aus, mov, escd, deficit: r.rota !== 'GESTÃO' && o.prog > 0 && disp < nec };
}
// Coberturas de um dia a partir do mapa gravado na presença (cob: { 'id|data': id do substituto })
export function coberturasDoDia(cob, dt) {
  const out = []; for (const [k, sid] of Object.entries(cob || {})) { const i = k.lastIndexOf('|'); if (k.slice(i + 1) === dt && sid) out.push({ aus: k.slice(0, i), sub: sid }); }
  return out;
}
// Substituto guardado como "conjunto:id" quando é de outro conjunto (Pátio ↔ Bateria)
export const subDeOutroConjunto = sub => { const s = String(sub || ''); const i = s.indexOf(':'); return i > 0 && !!SETS[s.slice(0, i)]; };

// Atividades de um conjunto (Pátio ou Bateria) nas áreas da pessoa.
// d = { areas[], plano[] (itens do plano), semanas {id: doc}, colabs[], sit (chave "id|data" → código), rotas[] (config), hoje }
// d.sitDe(c, data) opcional: situação considerando a escala de turno (folga automática da turma). Sem ela, só o que foi lançado.
// d.cob opcional: coberturas gravadas ({ 'id|data': substituto }), para o déficit bater com o Dimensionamento.
export function resumoAtividades(d) {
  const sd = d.sitDe || ((c, dt) => d.sit[c.id + '|' + dt]);
  const PL = new Map(d.plano.map(p => [p.id, p]));
  const hoje = d.hoje, k = diaSemana(hoje), ini = weekOf(hoje);
  const amanha = add(hoje, 1), kA = diaSemana(amanha), iniA = weekOf(amanha);
  const porRota = new Map(); let P = 0, R = 0, N = 0, E = 0, atrasadas = 0;
  for (const area of d.areas) {
    const doc = d.semanas[area + '|' + ini];
    if (doc) doc.ids.forEach((pid, i) => {
      const c = linha(doc, i)[k]; if (!c || c === '_') return;
      const p = PL.get(pid); const rota = p ? p.rota : '—';
      const chave = area + '|' + rota; if (!porRota.has(chave)) porRota.set(chave, { area, rota, P: 0, R: 0, N: 0, E: 0, total: 0 });
      const x = porRota.get(chave); x.total++;
      if (c === 'P') { x.P++; P++; } else if (c === 'R') { x.R++; R++; } else if (c === 'N') { x.N++; N++; } else if (c === 'E') { x.E++; E++; }
    });
  }
  const lista = listaAtrasadas(d.semanas, { areas: d.areas, hoje });
  atrasadas = lista.length;
  // As dos últimos 7 dias (o que dá para resolver agora) e em que rotas elas estão; as 60 dias ficam como detalhe.
  const desde7 = add(hoje, -ATRASADAS_RECENTES);
  const recentes = lista.filter(x => x.dt >= desde7);
  const porRotaAtr = new Map();
  for (const x of (recentes.length ? recentes : lista)) {
    const p = PL.get(x.doc.ids[x.i]); const rota = p ? p.rota : '—'; const ch = x.doc.area + '|' + rota;
    if (!porRotaAtr.has(ch)) porRotaAtr.set(ch, { area: x.doc.area, rota, n: 0 });
    porRotaAtr.get(ch).n++;
  }
  const atrasadasRotas = [...porRotaAtr.values()].sort((a, b) => b.n - a.n || a.rota.localeCompare(b.rota));
  // quem falta hoje
  const faltas = [];
  for (const c of d.colabs) { if (!d.areas.includes(c.area)) continue; const cod = d.sit[c.id + '|' + hoje]; if (cod && AUSENCIA.has(cod)) faltas.push({ nome: c.nome, funcao: c.funcao, area: c.area, rota: c.rota, cod }); }
  // déficit de efetivo amanhã (a mesma conta do Dimensionamento, com as coberturas já definidas)
  const deficit = [];
  const docA = a => d.semanas[a + '|' + iniA];
  const cobA = coberturasDoDia(d.cob, amanha); const idsConj = new Set(d.colabs.map(c => c.id));
  const sitA = c => { const v = sd(c, amanha) || 'P'; return { v, auto: v === 'F' && !d.sit[c.id + '|' + amanha] }; };
  for (const r of d.rotas) {
    if (!d.areas.includes(r.area)) continue;
    const cs = d.colabs.filter(c => c.area === r.area && c.rota === r.rota);
    const doc = docA(r.area); let prog = 0;
    if (doc) doc.ids.forEach((pid, i) => { const p = PL.get(pid); if (p && p.rota === r.rota && linha(doc, i)[kA] !== '_') prog++; });
    const e = efetivoRota(r, { cs, prog, sitDe: sitA, cob: cobA, subOk: s => idsConj.has(s) || subDeOutroConjunto(s), fator: d.fator ? d.fator(cs) : 1 });
    if (e.deficit) deficit.push({ area: r.area, rota: r.rota, disp: e.disp, nec: e.nec, prog });
  }
  const rotas = [...porRota.values()].sort((a, b) => b.P - a.P || a.rota.localeCompare(b.rota));
  return { hoje: { P, R, N, E, total: P + R + N + E }, rotas, atrasadas, atrasadasRecentes: recentes.length, atrasadasRotas, faltas, deficit, amanha };
}

// Paradas de equipamento ainda sem liberação, com quantas horas estão abertas.
export function paradasAbertas(par, agora = new Date()) {
  return par.filter(p => !p.fim && p.data && p.ini).map(p => {
    const inicio = new Date(`${p.data}T${p.ini}:00`);
    return { ...p, horas: Math.max(0, (+agora - +inicio) / 36e5) };
  }).sort((a, b) => b.horas - a.horas);
}

// Ocorrências do Efetivo aguardando assinatura.
export function assinaturasPendentes(ocorr, hoje, dias = 7) {
  const pend = ocorr.filter(o => o.status === 'pendente');
  const limite = add(hoje, -dias);
  const velhas = pend.filter(o => o.data <= limite).sort((a, b) => (a.data < b.data ? -1 : 1));
  return { total: pend.length, velhas };
}

// Operadores fora hoje (férias, atestado etc.), pela situação do cadastro da Operação.
export function operadoresFora(operadores, hoje) {
  return operadores.filter(o => o.situacao && o.situacao !== 'TRABALHANDO' && !/DESLIG/i.test(o.situacao) && (!o.de || o.de <= hoje) && (!o.ate || o.ate >= hoje)).map(o => ({ nome: o.nome, cod: o.situacao }));
}

// Resumo de uma semana (segunda a domingo) nas áreas da pessoa: atividades e ausências lançadas
// (as mesmas ausências do Balanço: atestado, afastamento, treinamento, falta, abono e suspensão).
// d = { areas[], semanas {id: doc}, colabs[], sit } · ini = segunda-feira da semana
export function resumoSemana(d, ini) {
  let R = 0, N = 0, P = 0, E = 0; const aus = {};
  for (const area of d.areas) {
    const doc = d.semanas[area + '|' + ini]; if (!doc) continue;
    doc.ids.forEach((_, i) => { for (const c of linha(doc, i)) { if (c === 'R') R++; else if (c === 'N') N++; else if (c === 'P') P++; else if (c === 'E') E++; } });
  }
  for (const c of d.colabs) {
    if (!d.areas.includes(c.area)) continue;
    for (let j = 0; j < 7; j++) { const v = d.sit[c.id + '|' + add(ini, j)]; if (v && AUSENCIA.has(v)) aus[v] = (aus[v] || 0) + 1; }
  }
  const prog = R + N + P;
  return { ini, fim: add(ini, 6), R, N, P, E, prog, pct: prog ? Math.round((R / prog) * 100) : null, aus };
}
