// Dikma Gestão — atestados lançados pelos líderes (Operação › Escala do dia) e conferidos pelo RH (RH › Atestados).
// Contas sem tela e sem banco: as mesmas no site, nos testes (testes/atestados.test.mjs) e na rotina dos avisos.
//
// Atestado é dado de saúde (LGPD). Quem vê os detalhes e a foto: o RH · Administrativo, o administrador e quem lançou.
// Os outros (supervisor, coordenador, gestor, cliente) veem só o código AT na Escala do dia, como antes. A regra de
// verdade fica no banco (firestore.rules › atestados); aqui ficam só as contas.
//
// Banco: atestados/{id}  { conj, area, cid, mat, nome, ini, fim, dias, tipo, horas, emis, obs, nf, minis[], st, motRec,
//   orig, confPor, confNome, confEm, por, porNome, em, fotosApagadasEm, atualizadoEm, atualizadoPor }
//   atestadosFoto/{id}  { aid, por, conj, area, ordem, dados, em }  uma foto por documento (a completa); a miniatura fica
//   em minis[] do atestado. ini e fim = 'AAAA-MM-DD'; dias = dias corridos (ini a fim); horas só na declaração.
import { add, pd } from './cal.js';
import { addMeses } from './treinos.js';
import { competenciaDe, diasDaCompetencia } from './planilhas-adm.js';

export const TIPOS_AT = ['Atestado médico', 'Atestado odontológico', 'Acompanhamento de familiar', 'Declaração de comparecimento', 'Outro'];
export const DECLARACAO = 'Declaração de comparecimento';
// prazoH = horas para entregar depois da emissão · inssDias/inssJanela = soma de dias que pede encaminhar ao INSS.
export const CFG_PADRAO = { prazoH: 48, inssDias: 15, inssJanela: 60 };
export const LIM = { obs: 300, diasMax: 30, fotos: 2, horasMax: 24, nome: 120 };
export const ST = { conferir: 'A conferir', conferido: 'Conferido', recusado: 'Recusado' };
export const ST_COR = { conferir: 'atencao', conferido: 'ok', recusado: 'critico' };
// Prazo de guarda da foto e da observação (o mesmo da observação do atestado na Presença, contas/lgpd.js): 12 meses
// depois do último dia do atestado. As datas, o tipo e os dias ficam (frequência e indicadores dependem deles).
export const FOTO_MESES = 12;

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const diaOk = s => typeof s === 'string' && DIA_RE.test(s) && !Number.isNaN(pd(s).getTime());
const ent = (v, a, b, pad) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= a && n <= b ? n : pad; };

export function cfgAt(c) {
  const x = c || {};
  return { prazoH: ent(x.prazoH, 12, 720, CFG_PADRAO.prazoH), inssDias: ent(x.inssDias, 1, 60, CFG_PADRAO.inssDias), inssJanela: ent(x.inssJanela, 7, 365, CFG_PADRAO.inssJanela) };
}

// Dias corridos do atestado, a partir do início.
export const fimDe = (ini, dias) => add(ini, Math.max(1, dias) - 1);
export function diasDoAtestado(ini, dias) { const out = []; for (let i = 0; i < Math.max(1, dias || 1); i++) out.push(add(ini, i)); return out; }
const diasEntre = (a, b) => Math.round((pd(b).getTime() - pd(a).getTime()) / 864e5);

// Confere o que foi digitado (formulário do líder e do RH). hoje = 'AAAA-MM-DD'. Devolve { ok, erro, item }.
export function conferirAt(x, hoje) {
  const tipo = TIPOS_AT.includes(x.tipo) ? x.tipo : '';
  if (!tipo) return { ok: false, erro: 'Escolha o tipo do atestado.' };
  if (!diaOk(x.ini)) return { ok: false, erro: 'Informe o primeiro dia do atestado.' };
  const emis = x.emis || x.ini;
  if (!diaOk(emis)) return { ok: false, erro: 'Informe a data de emissão.' };
  if (hoje && emis > hoje) return { ok: false, erro: 'A data de emissão não pode ser depois de hoje.' };
  if (diasEntre(emis, x.ini) > 30 || diasEntre(x.ini, emis) > 30) return { ok: false, erro: 'A emissão e o primeiro dia estão longe demais (mais de 30 dias). Confira as datas.' };
  const decl = tipo === DECLARACAO;
  const dias = decl ? 1 : ent(x.dias, 1, LIM.diasMax, 0);
  if (!dias) return { ok: false, erro: `Informe quantos dias (de 1 a ${LIM.diasMax}). Mais que isso é afastamento (AF).` };
  let horas = null;
  if (decl) {
    const h = Math.round(Number(String(x.horas ?? '').replace(',', '.')) * 2) / 2;
    if (!Number.isFinite(h) || h < 0.5 || h > LIM.horasMax) return { ok: false, erro: 'Na declaração de comparecimento, informe as horas (ex.: 2 ou 3,5).' };
    horas = h;
  }
  const obs = limpa(x.obs).slice(0, LIM.obs);
  if (tipo === 'Outro' && obs.length < 3) return { ok: false, erro: 'Em "Outro", escreva o que é na observação.' };
  return { ok: true, item: { tipo, ini: x.ini, emis, dias, fim: fimDe(x.ini, dias), horas, obs } };
}

// Entregue fora do prazo: lançado depois do dia da emissão + o prazo (48 h = até 2 dias depois da emissão).
// diaLanc = dia em que o líder lançou ('AAAA-MM-DD').
export const limiteEntrega = (emis, cfg = CFG_PADRAO) => add(emis, Math.ceil(cfgAt(cfg).prazoH / 24));
export function foraDoPrazo(a, cfg = CFG_PADRAO) {
  const lanc = a && (a.diaLanc || '');
  return !!(a && diaOk(a.emis) && diaOk(lanc) && lanc > limiteEntrega(a.emis, cfg));
}

const chave = a => (a.mat ? 'm:' + String(a.mat).trim() : `c:${a.conj || ''}:${a.cid || ''}`);
export const chavePessoaAt = chave;
const valendo = a => a && !a.apagado && a.st !== 'recusado';

// Encaminhar ao INSS: os atestados da mesma pessoa somam mais de inssDias dias dentro dos últimos inssJanela dias.
// Conta cada dia uma vez só (atestados que se sobrepõem não somam em dobro). Recusados não contam.
export function alertasINSS(lista, hoje, cfg = CFG_PADRAO) {
  const c = cfgAt(cfg); const de = add(hoje, -(c.inssJanela - 1));
  const por = new Map();
  for (const a of (lista || []).filter(valendo)) {
    if (!diaOk(a.ini) || a.tipo === DECLARACAO) continue;
    const k = chave(a); if (!por.has(k)) por.set(k, { chave: k, nome: a.nome || '', mat: a.mat || '', conj: a.conj || '', area: a.area || '', dias: new Set(), ids: [] });
    const p = por.get(k); let usou = false;
    for (const d of diasDoAtestado(a.ini, a.dias)) if (d >= de && d <= hoje) { p.dias.add(d); usou = true; }
    if (usou) p.ids.push(a.id);
  }
  const out = [];
  for (const p of por.values()) if (p.dias.size > c.inssDias) { const l = [...p.dias].sort(); out.push({ ...p, dias: p.dias.size, de: l[0], ate: l[l.length - 1] }); }
  return out.sort((a, b) => b.dias - a.dias || String(a.nome).localeCompare(String(b.nome)));
}

// Situação para a tela: a conferir, conferido, recusado e as marcas (sem foto, fora do prazo, original).
export function etiquetasAt(a, cfg = CFG_PADRAO) {
  const l = [[ST[a.st] || ST.conferir, ST_COR[a.st] || 'atencao']];
  if (!a.nf && !a.fotosApagadasEm) l.push(['Sem foto', 'atencao']);
  if (foraDoPrazo(a, cfg)) l.push(['Fora do prazo', 'critico']);
  if (a.st === 'conferido') l.push(a.orig ? ['Original entregue', 'ok'] : ['Falta o original', 'info']);
  return l;
}

// Filtra para a lista do RH. f = { st: '' | 'conferir' | 'conferido' | 'recusado' | 'semfoto' | 'prazo', conj, q, comp }
export function filtrarAt(lista, f = {}, cfg = CFG_PADRAO) {
  const q = limpa(f.q).toUpperCase();
  const dc = f.comp ? diasDaCompetencia(f.comp) : null; const dIni = dc && dc[0], dFim = dc && dc[dc.length - 1];
  return (lista || []).filter(a => !a.apagado
    && (!f.conj || a.conj === f.conj)
    && (!f.st || (f.st === 'semfoto' ? !a.nf && !a.fotosApagadasEm : f.st === 'prazo' ? foraDoPrazo(a, cfg) : (a.st || 'conferir') === f.st))
    && (!dc || (a.ini <= dFim && (a.fim || a.ini) >= dIni))
    && (!q || String(a.nome || '').toUpperCase().includes(q) || String(a.mat || '').includes(q)))
    .sort((a, b) => String(b.ini).localeCompare(String(a.ini)) || String(a.nome).localeCompare(String(b.nome)));
}

// Contagens para o topo da lista do RH.
export function contagensAt(lista, cfg = CFG_PADRAO) {
  const v = (lista || []).filter(a => !a.apagado);
  return { conferir: v.filter(a => (a.st || 'conferir') === 'conferir').length, recusado: v.filter(a => a.st === 'recusado').length,
    semfoto: v.filter(a => !a.nf && !a.fotosApagadasEm && a.st !== 'recusado').length, prazo: v.filter(a => foraDoPrazo(a, cfg)).length };
}

// Lista do mês para a folha (competência 16 a 15): uma linha por atestado, com os dias que caem na competência.
export function folhaDaCompetencia(lista, comp, conj = '') {
  const dc = diasDaCompetencia(comp); const set = new Set(dc);
  const out = [];
  for (const a of (lista || []).filter(x => !x.apagado && (!conj || x.conj === conj))) {
    const ds = diasDoAtestado(a.ini, a.dias).filter(d => set.has(d)); if (!ds.length) continue;
    out.push({ id: a.id, nome: a.nome || '', mat: a.mat || '', conj: a.conj || '', area: a.area || '', tipo: a.tipo || '', ini: a.ini, fim: a.fim || a.ini, dias: a.dias || 1,
      diasComp: a.tipo === DECLARACAO ? 0 : ds.length, horas: a.horas || null, emis: a.emis || '', st: a.st || 'conferir', orig: !!a.orig, de: ds[0], ate: ds[ds.length - 1] });
  }
  return out.sort((a, b) => String(a.nome).localeCompare(String(b.nome)) || a.ini.localeCompare(b.ini));
}
export { competenciaDe };

// Indicador: atestados e dias por área num mês civil (AAAA-MM). Sem nomes: só números.
export function resumoPorArea(lista, mes) {
  const out = new Map();
  for (const a of (lista || []).filter(valendo)) {
    const ds = diasDoAtestado(a.ini, a.dias).filter(d => d.slice(0, 7) === mes); if (!ds.length) continue;
    const k = a.area || '—'; if (!out.has(k)) out.set(k, { area: k, atestados: 0, dias: 0, pessoas: new Set(), declaracoes: 0 });
    const r = out.get(k); r.atestados++; r.pessoas.add(chave(a));
    if (a.tipo === DECLARACAO) r.declaracoes++; else r.dias += ds.length;
  }
  return [...out.values()].map(r => ({ ...r, pessoas: r.pessoas.size })).sort((a, b) => b.dias - a.dias || a.area.localeCompare(b.area));
}
// Dias de atestado por mês (para a tendência dos últimos meses). meses = ['AAAA-MM', ...]
export const diasPorMes = (lista, meses) => meses.map(m => resumoPorArea(lista, m).reduce((n, r) => n + r.dias, 0));

// Atestados de uma pessoa (ficha do colaborador), do mais novo para o mais antigo.
export function atestadosDaPessoa(lista, mat, nome = '') {
  const m = String(mat || '').trim(); const n = limpa(nome).toUpperCase();
  return (lista || []).filter(a => !a.apagado && ((m && String(a.mat || '').trim() === m) || (!a.mat && n && limpa(a.nome).toUpperCase() === n)))
    .sort((a, b) => String(b.ini).localeCompare(String(a.ini)));
}

// Quem lançou pode mudar ou apagar enquanto o RH não conferiu (a conferir ou recusado). Depois, só o RH e o administrador.
export const autorMexe = a => !!a && a.st !== 'conferido';

// LGPD: foto e observação saem FOTO_MESES depois do último dia. Devolve os atestados que ainda têm foto ou observação.
export const limiteFotoAt = hoje => addMeses(hoje, -FOTO_MESES);
export function fotosParaDescartar(lista, hoje) {
  const lim = limiteFotoAt(hoje);
  return (lista || []).filter(a => a && !a.apagado && (a.fim || a.ini) && (a.fim || a.ini) < lim && ((a.nf || 0) > 0 || (a.minis || []).length || a.obs));
}

// Avisos no celular (rotina do GitHub, integracao/avisos/planejar.mjs). Só números, nunca nomes nem o tipo.
// d = { lista: atestados, hoje, hora, cfg } · devolve { rh: { n, prazo, inss, chave } | null, autores: [{ uid, semFoto, recusados, chave }] }
//   rh: a conferir (uma vez por dia, a partir das 8h) e os casos novos de INSS;
//   autores: quem lançou e ainda não juntou a foto há mais de 1 dia, ou teve atestado recusado (uma vez por dia, a partir das 8h).
export function avisosAtestados({ lista, hoje, hora, cfg }) {
  const c = cfgAt(cfg); const v = (lista || []).filter(a => !a.apagado);
  if (hora < 8) return { rh: null, autores: [] };
  const conf = v.filter(a => (a.st || 'conferir') === 'conferir');
  const inss = alertasINSS(v, hoje, c);
  const rh = conf.length || inss.length ? { n: conf.length, prazo: conf.filter(a => foraDoPrazo(a, c)).length, inss: inss.length, chave: `atrh|${hoje}` } : null;
  const por = new Map();
  for (const a of v) {
    if (!a.por) continue;
    const semFoto = !a.nf && !a.fotosApagadasEm && (a.st || 'conferir') === 'conferir' && a.diaLanc && a.diaLanc < hoje;
    const rec = a.st === 'recusado';
    if (!semFoto && !rec) continue;
    if (!por.has(a.por)) por.set(a.por, { uid: a.por, semFoto: 0, recusados: 0, chave: `atau|${a.por}|${hoje}` });
    const p = por.get(a.por); if (semFoto) p.semFoto++; if (rec) p.recusados++;
  }
  return { rh, autores: [...por.values()] };
}
