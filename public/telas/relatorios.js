// Painel › Resumos: Atividades, Horas extras, Operação e Frequência, do dia ou da semana, prontos para imprimir.
import { SETS, AREA_S, DAYS, AUSENCIA, pd, add, ddmm, weekLabel } from '../cal.js';
import { JUS_CODS, textoJus } from '../presenca.js';
import { PARCIAL } from '../situacao.js';
import * as M from '../movimento.js';
import { DB, TODAY, CUR_WEEK, framed, esc, pct, title, n0 } from '../nucleo/base.js';
import { ME, PL, COLABS, SK, AREAS, UI, areaScope, modsReais, setsDe, temEquipEm } from '../nucleo/estado.js';
import { I } from '../ui/icones.js';
import { docsFor, stats, listaAprov } from '../calc/atividades.js';
import { sitDia, desligadoNoDia, SIT_NOME, colabsDa, HE_ORIG, cobDoDia, cobertoPor, nomeDe } from '../calc/presenca.js';
import { contarCausas } from './atividades.js';
import { MOTIVOS_HE, fmtH, textoHE, heCfg, registrosHE } from './horas-justificativas.js';
import { modulo } from '../nucleo/modulos.js';


/* ---------------- RESUMO DA SEMANA ---------------- */
// Três resumos separados: Atividades, Operação (equipamentos) e Frequência — cada pessoa vê os dos módulos dela.
// Resumos ficam na Gestão: atividades e horas extras com Pátio/Bateria, Equipamentos com o escopo; a Frequência só
// para quem também tem o RH (os dados da folha vêm de lá).
const TIPOS_RES = [['ativ', 'Atividades', u => setsDe(u, 'gestao').length > 0], ['he', 'Horas extras', u => setsDe(u, 'gestao').length > 0], ['oper', 'Equipamentos', u => temEquipEm(u, 'gestao')], ['freq', 'Frequência', u => modsReais(u).includes('frequencia')]];
const tiposRes = () => TIPOS_RES.filter(t => ME && t[2](ME) && (UI.modulo === 'rh' ? t[0] === 'freq' : true));
export const resTipo = () => { const l = tiposRes(); return l.some(t => t[0] === UI.resTipo) ? UI.resTipo : (l[0] || ['ativ'])[0]; };
export const rConj = () => { const ss = setsDe(ME); return ss.length === 1 ? ss[0] : UI.rConj || SK || 'patio'; };
const abasResumo = () => { const l = tiposRes(); return l.length > 1 ? `<div class="seg resabas noprint" role="tablist" aria-label="Tipo de resumo">${l.map(([k, n]) => `<button type="button" role="tab" data-rtipo="${k}" aria-selected="${resTipo() === k}">${n}</button>`).join('')}</div>` : ''; };
// Resumo do dia ou da semana (vale para os três tipos).
if (UI.rPer == null) { try { UI.rPer = localStorage.getItem('dikma-rper') || 'sem'; } catch (e) { UI.rPer = 'sem'; } }
const rDia = () => UI.rPer === 'dia';
const perResumo = () => `<div class="seg resabas noprint" role="tablist" aria-label="Período do resumo"><button type="button" role="tab" data-rper="dia" aria-selected="${rDia()}">Do dia</button><button type="button" role="tab" data-rper="sem" aria-selected="${!rDia()}">Da semana</button></div>`;
const dataLonga = d => { const x = pd(d); return `${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][x.getDay()]}, ${ddmm(d)}/${d.slice(0, 4)}`; };
export function vResumoOutro() {
  const tipo = resTipo();
  const conj = rConj();
  if (rDia()) {
    const d = UI.rDiaO && UI.rDiaO <= TODAY ? UI.rDiaO : TODAY; UI.rDiaO = d;
    const md = modulo(tipo === 'oper' ? 'EQ' : 'AD'); // sem o arquivo ainda: esqueleto até chegar
    const r = !md ? null : tipo === 'oper' ? md.resumoDia(d) : md.resumoDia(d, conj);
    const nav = `<div class="row-between noprint"><div class="row-gap">${abasResumo()}${perResumo()}</div><div class="compnav"><button class="btn ghost sm" data-rdiao="-1" aria-label="Dia anterior">‹</button><b>${dataLonga(d)}</b><button class="btn ghost sm" data-rdiao="1" aria-label="Próximo dia" ${d >= TODAY ? 'disabled' : ''}>›</button></div>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>`;
    if (!r) return nav + M.ESQUELETO;
    const meta = tipo === 'oper' ? '<span><b>Equipamentos</b></span>' : `<span><b>Frequência · ${SETS[conj].nome}</b> · só as áreas ${conj === 'bateria' ? 'da Bateria' : 'do Pátio de Carvão'}</span>`;
    return `${nav}<div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO DO DIA · ${tipo === 'oper' ? 'OPERAÇÃO' : 'FREQUÊNCIA'}</h3><div class="meta">${meta}<span><b>Dia:</b> ${dataLonga(d)}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis">${r.kpis.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>${r.corpo}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
  }
  const ini = UI.rIni || UI.ini || CUR_WEEK; UI.rIni = ini; const fim = add(ini, 6);
  const md = modulo(tipo === 'oper' ? 'EQ' : 'AD');
  const r = !md ? null : tipo === 'oper' ? md.resumoSemana(ini) : md.resumoSemana(ini, conj);
  const nav = `<div class="row-between noprint"><div class="row-gap">${abasResumo()}${perResumo()}</div><div class="compnav"><button class="btn ghost sm" data-rsem="-1" aria-label="Semana anterior">‹</button><b>${ddmm(ini)} a ${ddmm(fim)}</b><button class="btn ghost sm" data-rsem="1" aria-label="Próxima semana" ${ini >= CUR_WEEK ? 'disabled' : ''}>›</button></div>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>`;
  if (!r) return nav + M.ESQUELETO;
  const meta = tipo === 'oper' ? '<span><b>Equipamentos</b></span>' : `<span><b>Frequência · ${SETS[conj].nome}</b> · só as áreas ${conj === 'bateria' ? 'da Bateria' : 'do Pátio de Carvão'}</span>`;
  return `${nav}<div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO DA SEMANA · ${tipo === 'oper' ? 'OPERAÇÃO' : 'FREQUÊNCIA'}</h3><div class="meta">${meta}<span><b>Semana:</b> ${ddmm(ini)} a ${ddmm(fim)}/${fim.slice(0, 4)}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis">${r.kpis.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>${r.corpo}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
}
function vResumoDia() {
  const area = areaScope(); const dias = DAYS.map((_, k) => add(UI.ini, k));
  if (!UI.rDia || !dias.includes(UI.rDia)) UI.rDia = dias.includes(TODAY) ? TODAY : dias[0];
  const d = UI.rDia, k = dias.indexOf(d); const passou = d < TODAY;
  const docs = docsFor({ ini: UI.ini, area });
  const rot = new Map(); const nao = []; const tot = { prog: 0, R: 0, N: 0, P: 0, A: 0, E: 0 };
  for (const doc of docs) for (let i = 0; i < doc.ids.length; i++) {
    const p = PL.get(doc.ids[i]); if (!p) continue; const c = doc.d[i][k]; if (c === '_') continue;
    const key = doc.area + '|' + p.rota; const g = rot.get(key) || { area: doc.area, rota: p.rota, prog: 0, R: 0, N: 0, P: 0, E: 0 }; rot.set(key, g);
    if (c === 'E') { tot.E++; g.E++; continue; }
    tot.prog++; g.prog++;
    if (c === 'R') { tot.R++; g.R++; } else if (c === 'N') { tot.N++; g.N++; nao.push({ p, area: doc.area, m: doc.m[doc.ids[i] + '|' + k] || 'Sem justificativa' }); } else { g.P++; if (passou) tot.A++; else tot.P++; }
  }
  const as = area === 'TODAS' ? AREAS : [area]; const ids = new Set(docs.map(x => x.id));
  const pa = listaAprov(as).filter(x => ids.has(x.doc.id) && x.k === k).length;
  const cs = colabsDa(area).filter(c => !desligadoNoDia(c, d));
  const aus = cs.map(c => ({ c, x: sitDia(c, d) })).filter(o => !o.x.auto && (AUSENCIA.has(o.x.v) || PARCIAL.has(o.x.v))).sort((a, b) => a.x.v.localeCompare(b.x.v) || a.c.nome.localeCompare(b.c.nome));
  const folga = cs.filter(c => { const x = sitDia(c, d); return x.auto || x.v === 'F' || x.v === 'FE'; }).length;
  const pres = cs.length - aus.filter(o => !PARCIAL.has(o.x.v)).length - folga;
  const he = cs.filter(c => DB.sit(c.id + '|' + d) === 'HE').map(c => ({ c, inf: DB.sitInfo(c.id + '|' + d) }));
  const cob = cobDoDia(d).filter(x => COLABS.some(c => c.id === x.aus && (area === 'TODAS' || c.area === area)));
  const linhas = [...rot.values()].filter(g => g.prog || g.E).sort((a, b) => (b.N + b.P) - (a.N + a.P) || a.rota.localeCompare(b.rota));
  const ef = pct(tot.R, tot.prog);
  const chipsDia = `<div class="dayscroll noprint" role="group" aria-label="Dia">${dias.map((x, j) => `<button class="dbtn ${x === TODAY ? 'hoje' : ''}" data-rdia="${x}" aria-pressed="${x === d}"><small>${DAYS[j]}</small><b>${x.slice(8)}</b></button>`).join('')}</div>`;
  return `<div class="row-between noprint"><div class="row-gap">${abasResumo()}${perResumo()}</div>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>
  ${chipsDia}<p class="muted m0 noprint">${area === 'TODAS' ? 'Todas as áreas' : AREA_S[area]} · troque a semana e a área no topo.</p>
  <div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO DO DIA</h3><div class="meta"><span><b>${SETS[SK].nome}</b></span><span><b>Área:</b> ${area === 'TODAS' ? 'Todas' : AREA_S[area]}</span><span><b>Dia:</b> ${dataLonga(d)}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis"><div><b>${ef}%</b><span>Eficiência do dia</span></div><div><b>${n0(tot.prog)}</b><span>Programadas</span></div><div><b>${n0(tot.R)}</b><span>Realizadas</span></div><div><b>${n0(tot.N)}</b><span>Não realizadas</span></div><div><b>${n0(passou ? tot.A : tot.P)}</b><span>${passou ? 'Sem apontamento' : 'A fazer'}</span></div><div><b>${n0(tot.E)}</b><span>Extras</span></div></div>
  <h4>Por rota</h4>${linhas.length ? `<table><thead><tr><th>Rota</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realizadas</th><th class="r">${passou ? 'Sem apont.' : 'A fazer'}</th><th class="r">Extras</th><th class="r">Eficiência</th></tr></thead><tbody>${linhas.map(g => `<tr><td>${esc(g.rota)}${area === 'TODAS' ? `<div class="muted small">${AREA_S[g.area]}</div>` : ''}</td><td class="r">${g.prog}</td><td class="r">${g.R}</td><td class="r">${g.N || ''}</td><td class="r">${g.P || ''}</td><td class="r">${g.E || ''}</td><td class="r"><b>${pct(g.R, g.prog)}%</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nada programado neste dia.</p>'}
  <h4>Não realizadas e o motivo</h4>${nao.length ? `<table><tbody>${nao.slice(0, 30).map(x => `<tr><td>${esc(x.p.ativ)}<div class="muted small">${esc(x.p.local)} · ${esc(x.p.rota)}</div></td><td>${esc(x.m)}</td></tr>`).join('')}</tbody></table>${nao.length > 30 ? `<p class="muted small">e mais ${nao.length - 30}.</p>` : ''}` : '<p class="muted">Nenhuma não realizada.</p>'}
  <div class="rcols"><div><h4>Efetivo do dia</h4><table><tbody><tr><td>Presentes</td><td class="r"><b>${pres}</b></td></tr><tr><td>Folga ou férias</td><td class="r">${folga}</td></tr><tr><td>Ausentes</td><td class="r">${aus.filter(o => o.x.v !== 'ATR').length}</td></tr><tr><td>Atrasos</td><td class="r">${aus.filter(o => o.x.v === 'ATR').length}</td></tr><tr><td>Saídas antecipadas</td><td class="r">${aus.filter(o => o.x.v === 'SA').length}</td></tr><tr><td>Coberturas</td><td class="r">${cob.length}</td></tr><tr><td>Aguardando aprovação</td><td class="r">${pa}</td></tr></tbody></table></div>
  <div><h4>Ausências, atrasos e saídas</h4>${aus.length ? `<table><tbody>${aus.slice(0, 20).map(o => { const j = DB.sitInfo(o.c.id + '|' + d).jus; return `<tr><td>${esc(title(o.c.nome))}<div class="muted small">${esc(o.c.rota)}</div></td><td>${SIT_NOME[o.x.v] || o.x.v}<div class="muted small">${j && j.cod === o.x.v ? esc(textoJus(j)) : 'sem justificativa'}</div></td><td class="small">${cobertoPor(o.c.id, d) ? 'coberto' : ''}</td></tr>`; }).join('')}</tbody></table>${aus.length > 20 ? `<p class="muted small">e mais ${aus.length - 20}.</p>` : ''}` : '<p class="muted">Ninguém ausente.</p>'}</div></div>
  <h4>Hora extra</h4>${he.length ? `<table><tbody>${he.map(({ c, inf }) => `<tr><td>${esc(title(c.nome))}<div class="muted small">${esc(c.rota)}</div></td><td>${inf.he === 'DIKMA' ? 'A pedido da Dikma' : inf.he === 'ARCELOR' ? 'A pedido da ArcelorMittal' : 'Origem não informada'}</td><td class="small">${esc(textoHE(inf.hed) || 'sem horário')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Ninguém em hora extra.</p>'}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
}
// Resumo das horas extras (dia ou semana): horas com horário informado e estimadas, por pessoa, por motivo e a pedido de quem.
function vResumoHE() {
  const area = areaScope(); const semana = DAYS.map((_, k) => add(UI.ini, k));
  if (!UI.rDia || !semana.includes(UI.rDia)) UI.rDia = semana.includes(TODAY) ? TODAY : semana[0];
  const dias = rDia() ? [UI.rDia] : semana; const cfg = heCfg();
  // os mesmos registros do Banco de horas extras (registrosHE), só que do dia ou da semana
  const regs = registrosHE(area, null, dias).map(x => { const cob = cobDoDia(x.d).find(y => y.sub === x.c.id); return { ...x, cobre: cob ? nomeDe(cob.aus) : '' }; });
  regs.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.c.nome.localeCompare(b.c.nome)));
  const soma = l => l.reduce((n, x) => n + x.conta, 0);
  const tot = soma(regs), inf = regs.filter(x => x.horas != null), sem = regs.filter(x => x.horas == null);
  const porO = o => soma(regs.filter(x => x.orig === o));
  const pess = new Map(); regs.forEach(x => { const p = pess.get(x.c.id) || { c: x.c, dias: 0, h: 0, D: 0, A: 0 }; p.dias++; p.h += x.conta; if (x.orig === 'DIKMA') p.D += x.conta; if (x.orig === 'ARCELOR') p.A += x.conta; pess.set(x.c.id, p); });
  const mot = {}; regs.forEach(x => { const k = x.det && x.det.mot ? (MOTIVOS_HE.includes(x.det.mot) ? x.det.mot : 'Outro') : 'Sem horário informado'; mot[k] = (mot[k] || 0) + x.conta; });
  const chipsDia = rDia() ? `<div class="dayscroll noprint" role="group" aria-label="Dia">${semana.map((x, j) => `<button class="dbtn ${x === TODAY ? 'hoje' : ''}" data-rdia="${x}" aria-pressed="${x === UI.rDia}"><small>${DAYS[j]}</small><b>${x.slice(8)}</b></button>`).join('')}</div>` : '';
  const periodo = rDia() ? dataLonga(UI.rDia) : weekLabel(UI.ini);
  return `<div class="row-between noprint"><div class="row-gap">${abasResumo()}${perResumo()}</div>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>
  ${chipsDia}<p class="muted m0 noprint">${area === 'TODAS' ? 'Todas as áreas' : AREA_S[area]} · troque a semana e a área no topo. Sem horário informado, conta a estimativa de ${cfg.ciclo} h (turno) ou ${cfg.adm} h (administrativo).</p>
  <div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO ${rDia() ? 'DO DIA' : 'DA SEMANA'} · HORAS EXTRAS</h3><div class="meta"><span><b>${SETS[SK].nome}</b></span><span><b>Área:</b> ${area === 'TODAS' ? 'Todas' : AREA_S[area]}</span><span><b>${rDia() ? 'Dia' : 'Semana'}:</b> ${periodo}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis"><div><b>${fmtH(tot)}</b><span>Horas extras</span></div><div><b>${pess.size}</b><span>Pessoas</span></div><div><b>${regs.length}</b><span>Lançamentos</span></div><div><b>${fmtH(soma(inf))}</b><span>Com horário informado</span></div><div><b>${fmtH(porO('DIKMA'))}</b><span>A pedido da Dikma</span></div><div><b>${fmtH(porO('ARCELOR'))}</b><span>A pedido da ArcelorMittal</span></div></div>
  ${!rDia() ? `<h4>Por dia</h4><table><thead><tr><th></th>${semana.map((d, k) => `<th class="r">${DAYS[k]} ${ddmm(d)}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody><tr><td>Horas</td>${semana.map(d => { const v = soma(regs.filter(x => x.d === d)); return `<td class="r">${v ? fmtH(v) : ''}</td>`; }).join('')}<td class="r"><b>${fmtH(tot)}</b></td></tr><tr><td>Pessoas</td>${semana.map(d => { const v = regs.filter(x => x.d === d).length; return `<td class="r">${v || ''}</td>`; }).join('')}<td class="r"></td></tr></tbody></table>` : ''}
  <div class="rcols"><div><h4>Por pessoa</h4>${pess.size ? `<table><thead><tr><th>Colaborador</th><th class="r">Dias</th><th class="r">Horas</th><th class="r">Dikma</th><th class="r">Arcelor</th></tr></thead><tbody>${[...pess.values()].sort((a, b) => b.h - a.h).map(p => `<tr><td>${esc(title(p.c.nome))}<div class="muted small">${esc(p.c.rota)}</div></td><td class="r">${p.dias}</td><td class="r"><b>${fmtH(p.h)}</b></td><td class="r">${p.D ? fmtH(p.D) : ''}</td><td class="r">${p.A ? fmtH(p.A) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma hora extra no período.</p>'}</div>
  <div><h4>Por motivo</h4>${Object.keys(mot).length ? `<table><tbody>${Object.entries(mot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${fmtH(v)}</td><td class="r">${pct(v, tot)}%</td></tr>`).join('')}</tbody></table>` : '<p class="muted">—</p>'}
  <h4>Atenção</h4><table><tbody><tr><td>Sem horário informado</td><td class="r">${sem.length}</td></tr><tr><td>Sem “a pedido de”</td><td class="r">${regs.filter(x => !x.orig).length}</td></tr><tr><td>Cobrindo ausência</td><td class="r">${regs.filter(x => x.cobre).length}</td></tr></tbody></table></div></div>
  ${regs.length ? `<h4>Lançamentos</h4><table><thead><tr><th>Dia</th><th>Colaborador</th><th>Horário</th><th class="r">Horas</th><th>Motivo</th><th>A pedido de</th></tr></thead><tbody>${regs.slice(0, 80).map(x => `<tr><td class="nowrap">${ddmm(x.d)}</td><td>${esc(title(x.c.nome))}<div class="muted small">${esc(x.c.rota)}${x.cobre ? ' · cobrindo ' + esc(x.cobre) : ''}</div></td><td class="nowrap">${x.det && x.det.ini ? `${esc(x.det.ini)} às ${esc(x.det.fim)}` : '<span class="muted">sem horário</span>'}</td><td class="r">${fmtH(x.conta)}${x.horas == null ? '*' : ''}</td><td>${esc((x.det && (x.det.mot || '')) || '')}${x.det && x.det.obs ? `<div class="muted small">${esc(x.det.obs)}</div>` : ''}</td><td>${x.orig ? HE_ORIG[x.orig] : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table>${regs.length > 80 ? `<p class="muted small">e mais ${regs.length - 80} lançamentos (veja o Banco de horas extras).</p>` : ''}${sem.length ? '<p class="muted small">* estimativa: sem horário informado.</p>' : ''}` : ''}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
}
export function vResumo() {
  if (resTipo() === 'he') return vResumoHE();
  if (rDia()) return vResumoDia();
  const area = areaScope(); const docs = docsFor({ ini: UI.ini, area }); const s = stats(docs);
  const ef = pct(s.Rhoje, s.progHoje);
  const porArea = (area === 'TODAS' ? AREAS : [area]).map(a => ({ a, x: stats(docsFor({ ini: UI.ini, area: a })) }));
  const { por, total } = contarCausas(docs); const causas = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const as = area === 'TODAS' ? AREAS : [area]; const ids = new Set(docs.map(d => d.id));
  const pa = listaAprov(as).filter(x => ids.has(x.doc.id)).length, dv = listaAprov(as, 'dev').filter(x => ids.has(x.doc.id)).length;
  const acoes = Object.values(DB.cache.acoes || {}).filter(a => a.status === 'aberta' && (area === 'TODAS' || a.area === area || a.area === 'TODAS'));
  const cs = colabsDa(area); const dias = DAYS.map((_, k) => add(UI.ini, k)); const he = { DIKMA: 0, ARCELOR: 0, '': 0 };
  cs.forEach(c => dias.forEach(d => { if (DB.sit(c.id + '|' + d) === 'HE') he[DB.sitInfo(c.id + '|' + d).he || '']++; }));
  const aus = {}; cs.forEach(c => dias.forEach(d => { const x = sitDia(c, d); if (!x.auto && (AUSENCIA.has(x.v) || PARCIAL.has(x.v))) aus[x.v] = (aus[x.v] || 0) + 1; }));
  const semJ = cs.reduce((n, c) => n + dias.filter(d => d <= TODAY && (() => { const x = sitDia(c, d); if (x.auto || !JUS_CODS.includes(x.v)) return false; const j = DB.sitInfo(c.id + '|' + d).jus; return !(j && j.cod === x.v); })()).length, 0);
  return `<div class="row-between noprint"><div class="row-gap">${abasResumo()}${perResumo()}</div></div><div class="row-between noprint"><p class="muted m0">${weekLabel(UI.ini)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · troque a semana e a área no topo.</p>${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / salvar PDF</button>` : ''}</div>
  <div class="tw"><div class="paper resumo"><div class="hd"><div><h3>RESUMO DA SEMANA</h3><div class="meta"><span><b>${SETS[SK].nome}</b></span><span><b>Área:</b> ${area === 'TODAS' ? 'Todas' : AREA_S[area]}</span><span><b>Semana:</b> ${weekLabel(UI.ini)}</span><span><b>Gerado em:</b> ${ddmm(TODAY)}</span></div></div><div class="brandp">DIKMA</div></div>
  <div class="rkpis"><div><b>${ef}%</b><span>Eficiência até ${ddmm(TODAY < add(UI.ini, 6) ? TODAY : add(UI.ini, 6))}</span></div><div><b>${n0(s.prog)}</b><span>Programadas</span></div><div><b>${n0(s.R)}</b><span>Realizadas</span></div><div><b>${n0(s.N)}</b><span>Não realizadas</span></div><div><b>${n0(s.A)}</b><span>Atrasadas</span></div><div><b>${n0(s.E)}</b><span>Extras</span></div></div>
  <h4>Por área</h4><table><thead><tr><th>Área</th><th class="r">Programadas</th><th class="r">Realizadas</th><th class="r">Não realizadas</th><th class="r">Atrasadas</th><th class="r">Eficiência</th></tr></thead><tbody>${porArea.map(({ a, x }) => `<tr><td>${AREA_S[a]}</td><td class="r">${x.prog}</td><td class="r">${x.R}</td><td class="r">${x.N}</td><td class="r">${x.A}</td><td class="r"><b>${pct(x.Rhoje, x.progHoje)}%</b></td></tr>`).join('')}</tbody></table>
  <div class="rcols"><div><h4>Principais causas das não realizadas</h4>${causas.length ? `<table><tbody>${causas.map(([c, n]) => `<tr><td>${esc(c)}</td><td class="r">${n}</td><td class="r">${pct(n, total)}%</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma não realizada.</p>'}</div>
  <div><h4>Aprovação e plano de ação</h4><table><tbody><tr><td>Aguardando aprovação</td><td class="r">${pa}</td></tr><tr><td>Devolvidas ao líder</td><td class="r">${dv}</td></tr><tr><td>Ações abertas</td><td class="r">${acoes.length}</td></tr><tr><td>Ações com prazo vencido</td><td class="r">${acoes.filter(a => a.prazo && a.prazo < TODAY).length}</td></tr></tbody></table></div></div>
  <div class="rcols"><div><h4>Ausências e atrasos (pessoas × dias)</h4>${Object.keys(aus).length ? `<table><tbody>${Object.entries(aus).map(([k, n]) => `<tr><td>${SIT_NOME[k]}</td><td class="r">${n}</td></tr>`).join('')}${semJ ? `<tr><td><b>Ainda sem justificativa</b></td><td class="r"><b>${semJ}</b></td></tr>` : ''}</tbody></table>` : '<p class="muted">Nenhuma ausência.</p>'}</div>
  <div><h4>Horas extras (dias)</h4><table><tbody><tr><td>A pedido da Dikma</td><td class="r">${he.DIKMA}</td></tr><tr><td>A pedido da ArcelorMittal</td><td class="r">${he.ARCELOR}</td></tr>${he[''] ? `<tr><td>Sem origem informada</td><td class="r">${he['']}</td></tr>` : ''}</tbody></table></div></div>
  ${acoes.length ? `<h4>Ações em andamento</h4><table><thead><tr><th>Causa</th><th>Ação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>${acoes.slice(0, 10).map(a => `<tr><td>${esc(a.causa)}</td><td>${esc(a.acao)}</td><td>${esc(a.resp || '')}</td><td>${a.prazo ? ddmm(a.prazo) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
  <div class="sign"><div>Supervisor</div><div>Gestor</div></div></div></div>`;
}
