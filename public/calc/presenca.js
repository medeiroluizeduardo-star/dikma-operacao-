// Contas da presença (sem tela): escala, situação de cada pessoa no dia, coberturas (substitutos) e hora extra.
// A regra do dia fica em situacao.js (a mesma de todos os módulos); aqui ficam as ligações com os dados e a memória.
import { SETS, SITS, AUSENTE, add, today } from '../contas/cal.js';
import { situacaoDoDia, contagemDia, criarTurmaFicha, feriadosOperacao, AUS_COBRIVEL } from '../contas/situacao.js';
import { efetivoRota, coberturasDoDia, subDeOutroConjunto } from '../contas/hoje.js';
import { indiceFerias, indiceDesligados } from '../contas/acessos.js';
import { criarEscala, normRegime, letra, fatorRota, comoEra, anotarTroca } from '../contas/escala.js';
import { DB, title } from '../nucleo/base.js';
import { ME, PL, COLABS, SK, DATAV, isAdmin, podeItem, setsDe, perfil } from '../nucleo/estado.js';


/* ---------------- ESCALA DE TURNO ---------------- */
// Fonte única (config/escalas, com as turmas da Operação como reserva). Sem lançamento no dia, a situação vem da escala:
// administrativo folga no fim de semana e feriado (de Escalas e turnos e os "sem operação" da Operação);
// turno folga nos dias de folga da letra da turma. A conta do dia fica em situacao.js (a mesma de todos os módulos).
let ESC = null, ESCc = undefined, ESCe = undefined;
export function escala() { const c = DB.cache.escalas || null; const e = (DB.cache.e && DB.cache.e.config) || null; if (!ESC || ESCc !== c || ESCe !== e) { ESC = criarEscala(c || {}, e && e.turmas, feriadosOperacao(e)); ESCc = c; ESCe = e; } return ESC; }
let TURk = '', TUR = () => '';
// Turma pela ficha do Efetivo ou pelo cadastro da Operação (mesmo nome), quando a pessoa não tem letra nas Atividades.
export function turmaFicha(nome) {
  const g = (DB.cache.g && DB.cache.g.colabs) || []; const ops = (DB.cache.e && DB.cache.e.cad && DB.cache.e.cad.operadores) || [];
  const k = `${g.length}|${ops.length}|${DB.cache.gVersao || 0}|${DB.cache.eVersao || 0}`;
  if (TURk !== k) { TUR = criarTurmaFicha(g, ops); TURk = k; }
  return TUR(nome);
}
// Data de demissão da ficha (Efetivo): vale como DS automático a partir dela. Vem das fichas quando a pessoa as lê
// (Efetivo ou Frequência) e, para os demais, do resumo adm/desligados que a rotina diária grava.
let DEMi = null, DEMk = null;
export function desligadoDe(p) {
  const g = (DB.cache.g && DB.cache.g.colabs) || [], rh = (DB.cache.adm && DB.cache.adm.rh) || [], res = DB.cache.desligados || [];
  if (!DEMi || DEMk[0] !== g || DEMk[1] !== rh || DEMk[2] !== res) { DEMi = indiceDesligados([...res, ...rh, ...g]); DEMk = [g, rh, res]; }
  return DEMi(p);
}
// Com a data, valem o regime e a turma daquele dia (a troca de escala só vale a partir da data dela).
export const turmaDe = (c, dt) => { const x = dt ? comoEra(c, dt) : c; return letra(x.turma) || turmaFicha(x.nome); };
export const regimeDe = (c, dt) => normRegime((dt ? comoEra(c, dt) : c).regime, escala().regimes);
// Pessoa (Atividades) com a turma nova a partir de hoje: os dias anteriores guardam a turma antiga (escHist).
export function comTurma(c, turma, desde = today()) {
  const h = anotarTroca({ ...c, turma: turmaDe(c) }, { ...c, turma: letra(turma) || turmaFicha(c.nome) }, ['regime', 'turma'], desde);
  const n = { ...c, turma }; if (h.length) n.escHist = h; else delete n.escHist; return n;
}
export const regimeNome = (c, dt) => { const r = escala().regimes[regimeDe(c, dt)]; return r ? r.nome : title((dt ? comoEra(c, dt) : c).regime || ''); };
// { v: código, auto: veio da escala, motivo, semTurma }
// Férias marcadas em Frequência e férias entram sozinhas como FE (o lançamento do dia ainda vale mais).
let FERI = null, FERIv = null;
// A lista completa (Frequência e férias) vale mais quando está carregada; senão, o resumo adm/feriasAtivas.
const feriasDe = (c, dt) => { const l = (DB.cache.adm && DB.cache.adm.fLoaded && DB.cache.adm.ferias) || DB.cache.feriasAtivas || []; if (FERIv !== l) { FERI = indiceFerias(l); FERIv = l; } return FERI({ mat: c.mat, nome: c.nome }, dt); };
// Escala prevista da pessoa no dia (letra da turma × regime), guardada até os dados mudarem.
let PVM = new Map(), PVv = -1, PVe = null;
function previstoDe(c, dt) {
  const e = escala(); if (PVv !== DATAV || PVe !== e) { PVM = new Map(); PVv = DATAV; PVe = e; }
  const rg = regimeDe(c, dt), t = turmaDe(c, dt); const ch = rg + '|' + t + '|' + dt;
  if (PVM.has(ch)) return PVM.get(ch);
  const p = e.previsto(rg, t, dt); PVM.set(ch, p); return p;
}
// sitDia é chamado milhares de vezes por desenho (Painel, balanço, escala): guarda o resultado até os dados mudarem.
let SDM = new Map(), SDv = -1;
export function sitDia(c, dt) {
  if (SDv !== DATAV) { SDM = new Map(); SDv = DATAV; }
  const ch = c.id + '|' + dt + '|' + (c.regime || '') + '|' + (c.turma || '') + '|' + (c.nome || '') + '|' + ((c.escHist || []).length);
  let r = SDM.get(ch); if (r) return r;
  r = Object.freeze(sitDiaCalc(c, dt)); SDM.set(ch, r); return r;
}
// Fontes da conta do dia (situacao.js): o lançado (get), demissão da ficha, férias, escala e turma pela ficha.
export const fontesSit = get => ({ lancado: (c, dt) => get(c.id + '|' + dt), desligadoEm: desligadoDe, ferias: feriasDe, escala: escala(), turmaFicha });
// Formato usado pelas telas: auto = folga pela escala (vira hora extra se trabalhar); férias e desligamento da ficha
// não são "auto" (são ausências), mas vêm marcados (ferias, desligado) para a tela dizer de onde vieram.
export const sitTela = s => (s.por === 'escala' ? { v: 'F', auto: true, motivo: s.motivo, por: s.por, periodo: '' }
  : s.por === 'ferias' ? { v: 'FE', auto: false, ferias: true, por: s.por, periodo: '' }
    : s.por === 'desligado' ? { v: 'DS', auto: false, desligado: true, por: s.por, periodo: '' }
      : s.por === 'padrao' ? { v: 'P', auto: false, semTurma: s.semTurma, por: s.por, periodo: s.periodo }
        : { v: s.v, auto: false, por: s.por, periodo: s.periodo });
function sitDiaCalc(c, dt) { return sitTela(situacaoDoDia(c, dt, fontesSit(DB.sit))); }
export const desligadoNoDia = (c, dt) => sitDia(c, dt).v === 'DS';
// Contagem do dia (quadro, folga, férias, escalados, ausentes, presentes): a mesma no topo, no rodapé e nos grupos.
export const contarDia = (cs, dt) => contagemDia(cs, dt, { sitDe: sitDia });
// Turno do dia pela letra: 'D' diurno, 'N' noturno, '' administrativo / folga / sem turma (a noite conta no dia em que começa)
export const periodoDe = (c, dt) => { const p = previstoDe(c, dt); return p && p.trab && p.periodo ? p.periodo : ''; };
export const marcaPer = per => (per ? `<i class="peri ${per}" aria-hidden="true">${per}</i>` : '');
export const folgaEscala = (c, dt) => { const p = previstoDe(c, dt); return !!(p && !p.trab); };
// mesma regra para outros conjuntos (Meu dia): get(chave) devolve o lançado; presente sem nada lançado = undefined
export const sitDiaDe = get => (c, dt) => { const s = situacaoDoDia(c, dt, fontesSit(get)); return s.por === 'padrao' ? undefined : s.v; };
const indisponivel = (c, dt) => { const v = sitDia(c, dt).v; return v !== 'DS' && AUSENTE.has(v); };
let ERM = new Map(), ERv = -1;
export function escalaRota(r, ini) {
  if (ERv !== DATAV) { ERM = new Map(); ERv = DATAV; }
  const ch = r.area + '|' + r.rota + '|' + ini + '|' + r.carga + '|' + r.ef + '|' + COLABS.length;
  if (!ERM.has(ch)) ERM.set(ch, escalaRotaCalc(r, ini));
  return ERM.get(ch);
}
function escalaRotaCalc(r, ini) {
  const cs = COLABS.filter(c => c.area === r.area && c.rota === r.rota);
  const doc = DB.cache.semanas[r.area + '|' + ini];
  const fator = fatorRota(cs, escala().regimes); // rota de turno: só parte do quadro trabalha por dia
  const todos = idsColabs();
  // atividades programadas da rota em cada dia da semana (uma passada só)
  const progK = [0, 0, 0, 0, 0, 0, 0];
  if (doc) doc.ids.forEach((id, i) => { const p = PL.get(id); if (!p || p.rota !== r.rota) return; const d = doc.d[i]; for (let k = 0; k < 7; k++) if (d[k] !== '_') progK[k]++; });
  const out = [];
  for (let k = 0; k < 7; k++) {
    const dt = add(ini, k);
    // disponíveis × necessários com as coberturas: a mesma conta do Meu dia e do aviso das 17h (hoje.js)
    const e = efetivoRota(r, { cs, prog: progK[k], sitDe: c => sitDia(c, dt), cob: cobDoDia(dt), subOk: x => todos.has(x) || subDeOutroConjunto(x), fator });
    const per = { D: 0, N: 0 };
    for (const c of cs) { if (!indisponivel(c, dt) && !desligadoNoDia(c, dt)) { const p = periodoDe(c, dt); if (p) per[p]++; } } // quem está disponível de dia e de noite (turno pela letra)
    out.push({ disp: e.disp, nec: e.nec, prog: e.prog, aloc: e.aloc, mov: e.mov, dispD: per.D, dispN: per.N });
  }
  return { cs, days: out };
}
let IDC = null, IDCv = null;
const idsColabs = () => { if (IDCv !== COLABS) { IDC = new Set(COLABS.map(c => c.id)); IDCv = COLABS; } return IDC; };
/* ---------------- NOMES DAS SITUAÇÕES ---------------- */
export const SIT_NOME = Object.fromEntries(SITS);
// PARCIAL (situacao.js): presente, mas chegou depois ou saiu antes; conta como presente e pede justificativa.
export const SIT_TOM = { F: 'neu', FE: 'ext', AT: 'warn', AF: 'warn', TR: 'neu', FT: 'bad', ATR: 'warn', SA: 'warn' };
export const colabsDa = area => COLABS.filter(c => area === 'TODAS' || c.area === area);
// Seletor rápido da situação: abre colado no dia tocado, um toque aplica. "Repetir" leva até o fim da semana.
// ---- Substituição (quem cobre uma ausência) e origem da hora extra ----
export const HE_ORIG = { DIKMA: 'Dikma', ARCELOR: 'ArcelorMittal' };
export const HE_SIG = { DIKMA: 'D', ARCELOR: 'A' };
// AUS_COBRIVEL (situacao.js): ausências que pedem substituto
// coberturas de um dia: [{ aus: id de quem faltou, sub: id de quem cobre }]
let CDM = new Map(), CDv = -1;
export function cobDoDia(dt) { if (CDv !== DATAV) { CDM = new Map(); CDv = DATAV; } let r = CDM.get(dt); if (!r) { r = cobDoDiaCalc(dt); CDM.set(dt, r); } return r; }
function cobDoDiaCalc(dt) { return coberturasDoDia(DB.sitExtraMes(dt.slice(0, 7)).cob, dt); }
export const cobertoPor = (id, dt) => DB.sitInfo(id + '|' + dt).cob;
export const cobrindo = (id, dt) => { const x = cobDoDia(dt).find(y => y.sub === id); return x ? x.aus : ''; };
// Substituto pode ser de outro conjunto (ex.: falta na Bateria coberta por alguém do Pátio): guardado como "conjunto:id".
export const refSub = v => { const s = String(v || ''); const i = s.indexOf(':'); const k = i > 0 && SETS[s.slice(0, i)] ? s.slice(0, i) : SK; const id = i > 0 && SETS[s.slice(0, i)] ? s.slice(i + 1) : s;
  const c = k === SK ? COLABS.find(x => x.id === id) : Object.values((DB.dados(k) || {}).colabs || {}).flat().find(x => x.id === id); return { k, id, c: c || null, outro: k !== SK }; };
// Lançamento feito fora do Efetivo diário (Frequência, check-in): a mesma limpeza do Efetivo.
// Sai da ausência → tira o substituto (e a HE dele, se só existia pela cobertura); deixa de ser HE → tira a origem e o horário.
export function limparPresenca(conj, id, dt, cod) {
  const key = id + '|' + dt; const inf = DB.sitInfo(key, conj);
  if (cod !== 'HE' && (inf.he || inf.hed)) { DB.setSitExtra('he', key, null, conj); DB.setSitExtra('hed', key, null, conj); }
  if (AUS_COBRIVEL.has(cod) || !inf.cob) return;
  DB.setSitExtra('cob', key, null, conj);
  const v = String(inf.cob); const i = v.indexOf(':'); const sk = i > 0 && SETS[v.slice(0, i)] ? v.slice(0, i) : conj; const sid = i > 0 && SETS[v.slice(0, i)] ? v.slice(i + 1) : v;
  const sc = Object.values((DB.dados(sk) || {}).colabs || {}).flat().find(x => x.id === sid); if (!sc) return;
  const skey = sid + '|' + dt; const scod = (((DB.dados(sk) || {}).sitByMonth || {})[dt.slice(0, 7)] || {})[skey];
  const prev = escala().previsto(regimeDe(sc, dt), turmaDe(sc, dt), dt);
  if (scod === 'HE' && prev && !prev.trab) { DB.setSit(skey, null, sk); DB.setSitExtra('he', skey, null, sk); DB.setSitExtra('hed', skey, null, sk); }
}
// Situação de quem está em outro conjunto: o lançado lá, as férias e a folga pela escala.
function sitOutro(k, c, dt) {
  const st = DB.dados(k) || {}; const m = ((st.sitByMonth || {})[dt.slice(0, 7)] || {})[c.id + '|' + dt]; if (m) return { v: m, auto: false };
  if (feriasDe(c, dt)) return { v: 'FE', auto: false, ferias: true };
  const p = escala().previsto(regimeDe(c, dt), turmaDe(c, dt), dt); if (p && !p.trab) return { v: 'F', auto: true, motivo: p.motivo };
  return { v: 'P', auto: false };
}
export const sitDoSub = (r, dt) => (r.outro ? sitOutro(r.k, r.c, dt) : sitDia(r.c, dt));
// De folga no dia (pela escala ou lançada): cobrir vira hora extra.
export const folgaNoDia = x => x.auto || x.v === 'F';
export const nomeDe = id => { const r = refSub(id); return r.c ? title(r.c.nome) + (r.outro ? ` (${SETS[r.k].curto})` : '') : '—'; };
export const curto = n => { const p = String(n || '').split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0]; };
// Tira a cobertura e desfaz a hora extra que ela tinha criado (quando o substituto estava de folga pela escala).
export function removerCobertura(ausId, dt) {
  const sid = cobertoPor(ausId, dt); if (!sid) return;
  DB.setSitExtra('cob', ausId + '|' + dt, null);
  const r = refSub(sid); if (!r.c) return; const key = r.id + '|' + dt;
  const cod = r.outro ? (((DB.dados(r.k) || {}).sitByMonth || {})[dt.slice(0, 7)] || {})[key] : DB.sit(key);
  const prev = escala().previsto(regimeDe(r.c, dt), turmaDe(r.c, dt), dt);
  if (cod === 'HE' && prev && !prev.trab) { DB.setSit(key, null, r.k); DB.setSitExtra('he', key, null, r.k); DB.setSitExtra('hed', key, null, r.k); }
}
// Áreas de um conjunto (Pátio ou Bateria) em que a pessoa lança a presença — sem depender do módulo aberto.
export const areasSitDe = k => { const p = perfil('operacao'); if (!ME || !setsDe(ME, 'operacao').includes(k) || !podeItem('i_efetivo', 'operacao') || !['admin', 'gestor', 'coordenador', 'supervisor', 'lider'].includes(p)) return []; if (p === 'admin' || ['gestor', 'coordenador'].includes(p)) return SETS[k].areas; return [ME.area, p === 'supervisor' ? ME.area2 : null].filter(a => a && SETS[k].areas.includes(a)); };
export const colabsDoSet = k => Object.values((DB.dados(k) || {}).colabs || {}).flat();
export const sitDoSet = (k, key) => { const m = key.split('|')[1].slice(0, 7); return (((DB.dados(k) || {}).sitByMonth || {})[m] || {})[key]; };
