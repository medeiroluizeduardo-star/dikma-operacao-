// Modo TV (?tv): tela cheia para a sala de controle, com cenas que se revezam sozinhas.
import { SETS, AREAS_ATIV, setDaArea, AREA_S, DAYS, AUSENCIA, add, ddmm, addMonth } from './contas/cal.js';
import * as M from './movimento.js';
import { DEMO, TV, DB, TODAY, CUR_WEEK, CUR_MONTH, esc, pct, title, n0, $ } from './nucleo/base.js';
import { AUTH, ME, PL, SK, AREAS, UI, myAreas, setsDe, aplicarSet, perfil } from './nucleo/estado.js';
import { docsFor, stats, rotasDa, atrasadasAll, listaAprov } from './calc/atividades.js';
import { sitDia, desligadoNoDia, periodoDe, SIT_NOME, colabsDa } from './calc/presenca.js';
import { formSheet, toast } from './ui/janelas.js';
import { pintar, render, syncPill } from './ui/shell.js';
import { contarCausas } from './telas/atividades.js';
import { EQ, carregarModulo } from './nucleo/modulos.js';


/* ---------------- MODO TV ---------------- */
// Tela cheia para a sala de controle: cenas que se revezam sozinhas (hoje, rotas, semana, efetivo, equipamentos,
// atenção e causas), relógio, faixa de avisos, comemoração quando uma rota fecha e controle pelo teclado ou controle remoto.
// Configuração por endereço (para deixar fixo na TV): ?tv&cenas=hoje,rotas&t=20&conj=alt&claro
const TV_CENAS = [
  ['hoje', 'Hoje', 'O dia em andamento'], ['rotas', 'Rotas de hoje', 'Situação de cada rota'], ['semana', 'Semana', 'Resultado da semana'],
  ['efetivo', 'Efetivo de hoje', 'Quem está trabalhando'], ['equip', 'Equipamentos', 'Paradas e disponibilidade'], ['atencao', 'Atenção', 'O que precisa de ação'], ['causas', 'Causas', 'Por que não foi feito']
];
const TVC = (() => {
  const q = new URLSearchParams(location.search); let s = {}; try { s = JSON.parse(localStorage.getItem('dikma-tv') || '{}'); } catch (e) { /* sem armazenamento */ }
  const cenas = (q.get('cenas') || (s.cenas || []).join(',') || 'hoje,rotas,semana,efetivo,equip,atencao,causas').split(',').filter(k => TV_CENAS.some(c => c[0] === k));
  return { cenas: cenas.length ? cenas : TV_CENAS.map(c => c[0]), t: Math.min(120, Math.max(8, +(q.get('t') || s.t || 20))), conj: q.get('conj') || s.conj || 'alt', claro: q.has('claro') || !!s.claro, area: q.get('area') || (q.has('cenas') ? '' : s.area || '') };
})();
if (TV && !TVC.claro) document.documentElement.setAttribute('data-theme', 'dark');
let TVS = { i: 0, volta: 0, pausa: false, t0: Date.now() }, TV_TIMER = 0, TV_PREV = null;
// Áreas desta TV: a escolhida na configuração; senão, as áreas de quem entrou (líder, supervisor); senão, todas do conjunto.
const tvAreas = () => { if (TVC.area && AREAS.includes(TVC.area)) return [TVC.area]; const m = myAreas().filter(a => AREAS.includes(a)); return m.length ? m : AREAS; };
const tvP = () => perfil('gestao') || perfil('operacao'); // o Modo TV abre pela Gestão
const tvMinhas = () => (ME && ['lider', 'supervisor'].includes(tvP()) ? [ME.area, tvP() === 'supervisor' ? ME.area2 : null].filter(a => a && AREAS_ATIV.includes(a)) : []);
const tvUma = () => (tvAreas().length === 1 ? tvAreas()[0] : null);
const tvCenasAtivas = () => TVC.cenas.filter(k => k !== 'equip' || (DB.cache.e && DB.cache.e.loaded && DB.cache.e.config));
// Equipamentos desta TV: com área escolhida (ou líder/supervisor), só os lançados naquela área ("Local da atividade" do lançamento).
// A parada vale para a área do lançamento do mesmo dia, equipamento e operador; sem ele, a do último lançamento do equipamento.
function tvEquipEscopo() {
  // Equipamentos destinados a esta TV pela área da frota (Equipe e frota): o conjunto aberto (Pátio ou Bateria);
  // com área escolhida, os do local daquela área. Lançamentos e paradas contam só desses equipamentos.
  if (!EQ) { carregarModulo('EQ'); return { lanc: [], par: [], frota: 0, filtra: true, eqs: new Set() }; } // equip.js ainda chegando
  const E = DB.cache.e; const uma = tvUma() || (tvMinhas().length ? tvAreas() : null); const as = new Set(tvAreas());
  const eqs = new Set(E.cad.frota.filter(f => { const x = EQ.frotaArea(f); return uma ? as.has(x.setor) : x.area && EQ.setDoEq(x.area) === SK; }).map(f => f.id));
  return { lanc: E.lanc.filter(l => eqs.has(l.eq)), par: E.par.filter(p => eqs.has(p.eq)), frota: eqs.size, filtra: true, eqs };
}
function tvAgendar() {
  clearTimeout(TV_TIMER); if (TVS.pausa) return;
  TV_TIMER = setTimeout(() => tvIr(1), TVC.t * 1000);
}
function tvIr(passo) {
  const l = tvCenasAtivas(); if (!l.length) return;
  let i = TVS.i + passo;
  if (i >= l.length) { i = 0; TVS.volta++; const mi = tvMinhas(); const ss = mi.length ? [...new Set(mi.map(a => setDaArea(a)))] : setsDe(ME); if (TVC.conj === 'alt' && !TVC.area && ss.length > 1) { UI.esSet = ss[TVS.volta % ss.length]; aplicarSet(); } }
  if (i < 0) i = l.length - 1;
  TVS.i = i; TVS.t0 = Date.now(); if (DB.marcarUso) DB.marcarUso();
  render(); tvAgendar();
}
const tvHojeK = () => DAYS.findIndex((_, k) => add(CUR_WEEK, k) === TODAY);
// Situação de hoje: totais e por rota (docs da semana atual)
function tvHoje() {
  const k = tvHojeK(); const t = { prog: 0, R: 0, N: 0, P: 0, E: 0, FP: 0 }; const porArea = {}; const rotas = [];
  for (const a of tvAreas()) {
    const doc = DB.cache.semanas[a + '|' + CUR_WEEK]; const x = porArea[a] = { prog: 0, R: 0, N: 0, P: 0 };
    if (!doc || k < 0) continue;
    const pr = new Map();
    doc.ids.forEach((id, i) => {
      const p = PL.get(id); const c = doc.d[i][k]; if (!p || c === '_') return;
      const r = pr.get(p.rota) || { area: a, rota: p.rota, prog: 0, R: 0, N: 0, E: 0, FP: 0 }; pr.set(p.rota, r);
      if (c === 'E') { t.E++; r.E++; return; }
      t.prog++; x.prog++; r.prog++; if (doc.fp && doc.fp[id + '|' + k]) { t.FP++; r.FP++; }
      if (c === 'R') { t.R++; x.R++; r.R++; } else if (c === 'N') { t.N++; x.N++; r.N++; } else { t.P++; x.P++; }
    });
    rotas.push(...pr.values());
  }
  return { t, porArea, rotas };
}
function tvEfetivo() {
  const out = tvAreas().map(a => {
    const cs = colabsDa(a).filter(c => !desligadoNoDia(c, TODAY)); const x = { a, quadro: cs.length, pres: 0, folga: 0, ferias: 0, aus: {}, D: 0, N: 0, atr: 0 };
    for (const c of cs) { const s = sitDia(c, TODAY); if (s.auto || s.v === 'F') x.folga++; else if (s.v === 'FE') x.ferias++; else if (AUSENCIA.has(s.v)) x.aus[s.v] = (x.aus[s.v] || 0) + 1; else { x.pres++; if (s.v === 'ATR') x.atr++; const p = periodoDe(c, TODAY); if (p) x[p]++; } }
    return x;
  });
  return out;
}
function tvEfetivoRotas(area) {
  const por = new Map();
  for (const c of colabsDa(area)) {
    if (desligadoNoDia(c, TODAY)) continue; const x = por.get(c.rota) || { nome: c.rota, a: area, pres: 0, aus: {}, D: 0, N: 0 }; por.set(c.rota, x);
    const s = sitDia(c, TODAY); if (s.auto || s.v === 'F' || s.v === 'FE') continue; if (AUSENCIA.has(s.v)) x.aus[s.v] = (x.aus[s.v] || 0) + 1; else { x.pres++; const p = periodoDe(c, TODAY); if (p) x[p]++; }
  }
  return [...por.values()].filter(x => x.pres || Object.keys(x.aus).length).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 8);
}
function tvAlertas(h) {
  const out = [];
  const atr = tvAreas().flatMap(a => atrasadasAll(a)).filter(x => x.dt >= add(TODAY, -7)).length; if (atr) out.push(['bad', `${n0(atr)} atividade${atr > 1 ? 's' : ''} atrasada${atr > 1 ? 's' : ''} nos últimos 7 dias`]);
  const hora = new Date().getHours();
  const semAp = h.rotas.filter(r => r.prog && !r.R && !r.N);
  if (hora >= 10 && semAp.length) out.push(['warn', `${semAp.length} rota${semAp.length > 1 ? 's' : ''} sem nenhum apontamento hoje: ${semAp.slice(0, 4).map(r => r.rota).join(', ')}${semAp.length > 4 ? '…' : ''}`]);
  const pa = listaAprov(tvAreas()).length; if (pa) out.push(['neu', `${n0(pa)} apontamento${pa > 1 ? 's' : ''} aguardando aprovação do supervisor`]);
  const dv = listaAprov(tvAreas(), 'dev').length; if (dv) out.push(['warn', `${dv} apontamento${dv > 1 ? 's' : ''} devolvido${dv > 1 ? 's' : ''} ao líder para corrigir`]);
  const ac = Object.values(DB.cache.acoes || {}).filter(a => a.status === 'aberta' && (a.area === 'TODAS' || tvAreas().includes(a.area))); const venc = ac.filter(a => a.prazo && a.prazo < TODAY).length;
  if (venc) out.push(['bad', `${venc} ação${venc > 1 ? 'ões' : ''} de causas com prazo vencido`]);
  const E = DB.cache.e; const ab = E && E.loaded && E.config ? tvEquipEscopo().par.filter(p => !p.fim) : [];
  if (ab.length) out.push(['bad', `${ab.length} parada${ab.length > 1 ? 's' : ''} de equipamento sem liberação`]);
  const ft = tvEfetivo().reduce((n, x) => n + (x.aus.FT || 0), 0); if (ft) out.push(['warn', `${ft} falta${ft > 1 ? 's' : ''} no efetivo de hoje`]);
  const feitas = h.rotas.filter(r => r.prog && r.R + r.N === r.prog);
  if (feitas.length) out.push(['ok', `${feitas.length} rota${feitas.length > 1 ? 's' : ''} com tudo apontado hoje`]);
  return out;
}
const tvAnel = (p, cor, txt, sub) => `<div class="tvanel" style="--p:${p};--c:${cor}"><div><b class="num">${txt}</b><small>${sub}</small></div></div>`;
const corEf = p => (p >= 90 ? 'var(--st-real)' : p >= 70 ? 'var(--st-atr)' : 'var(--st-nreal)');
function tvCena(k, h) {
  const sNome = SETS[SK].nome;
  if (k === 'hoje') {
    const t = h.t; const ap = t.R + t.N; const ef = pct(t.R, t.prog), apo = pct(ap, t.prog);
    return `<div class="tvgrid tvhoje"><div class="tvcard tvhero">${tvAnel(apo, 'var(--accent)', apo + '%', 'apontado hoje')}<div class="tvnums"><div><b class="num">${n0(t.prog)}</b><span>programadas hoje</span></div><div class="ok"><b class="num">${n0(t.R)}</b><span>realizadas</span></div><div class="bad"><b class="num">${n0(t.N)}</b><span>não realizadas</span></div><div><b class="num">${n0(t.P)}</b><span>a fazer</span></div>${t.FP ? `<div class="ext"><b class="num">${t.FP}</b><span>fora da programação</span></div>` : ''}<div class="ok"><b class="num">${ef}%</b><span>realizadas do programado</span></div></div></div>
      ${tvUma() ? `<div class="tvareas rotas">${h.rotas.filter(r => r.prog).sort((a, b) => a.rota.localeCompare(b.rota)).slice(0, 8).map(r => { const p = pct(r.R + r.N, r.prog); return `<div class="tvcard tvarea"><b>${esc(r.rota)}</b>${tvAnel(p, corEf(pct(r.R, r.R + r.N || 1)), p + '%', `${r.R + r.N} de ${r.prog}`)}<span class="muted">${r.N ? `<i class="dotn"></i>${r.N} não realizada${r.N > 1 ? 's' : ''}` : r.R + r.N === r.prog ? 'tudo apontado' : `${r.prog - r.R - r.N} a fazer`}</span></div>`; }).join('')}</div>` : `<div class="tvareas">${tvAreas().map(a => { const x = h.porArea[a]; const p = pct(x.R + x.N, x.prog); return `<div class="tvcard tvarea"><b>${AREA_S[a]}</b>${tvAnel(p, x.prog ? corEf(pct(x.R, x.R + x.N || 1)) : 'var(--line)', x.prog ? p + '%' : '—', x.prog ? `${x.R + x.N} de ${x.prog}` : 'nada hoje')}<span class="muted">${x.N ? `<i class="dotn"></i>${x.N} não realizada${x.N > 1 ? 's' : ''}` : x.prog && x.P === 0 ? 'tudo apontado' : `${x.P} a fazer`}</span></div>`; }).join('')}</div>`}</div></div>`;
  }
  if (k === 'rotas') {
    const est = r => (!r.prog ? 'vazia' : r.R + r.N === r.prog ? (r.N ? 'fechn' : 'fech') : r.R + r.N ? 'anda' : 'zero');
    const ord = { zero: 0, anda: 1, fechn: 2, fech: 3, vazia: 4 };
    const rs = h.rotas.filter(r => r.prog).sort((a, b) => ord[est(a)] - ord[est(b)] || tvAreas().indexOf(a.area) - tvAreas().indexOf(b.area) || a.rota.localeCompare(b.rota));
    const n = { zero: 0, anda: 0, fech: 0, fechn: 0 }; rs.forEach(r => n[est(r)]++);
    return `<div class="tvleg"><span class="zero"><i></i>Sem apontamento · <b>${n.zero}</b></span><span class="anda"><i></i>Em andamento · <b>${n.anda}</b></span><span class="fech"><i></i>Tudo feito · <b>${n.fech}</b></span><span class="fechn"><i></i>Apontada com não realizadas · <b>${n.fechn}</b></span></div>
      <div class="tvrotas${rs.length > 24 ? ' mini' : ''}${rs.length > 48 ? ' micro' : ''}">${rs.map(r => { const p = pct(r.R + r.N, r.prog); return `<div class="tvrota ${est(r)}"><b>${esc(r.rota)}</b><small>${AREA_S[r.area]}${r.FP ? ` · ${r.FP} fora da prog.` : ''}</small><div class="tvbar"><i style="width:${p}%"></i></div><span class="num">${r.R + r.N}/${r.prog}${r.N ? ` · <em>${r.N} ✕</em>` : ''}</span></div>`; }).join('') || '<div class="tvcard tvvazio">Nenhuma rota com atividade programada hoje.</div>'}</div>`;
  }
  if (k === 'semana') {
    const docsTV = tvAreas().flatMap(a => docsFor({ ini: CUR_WEEK, area: a })); const s = stats(docsTV); const ef = pct(s.Rhoje, s.progHoje); const mx = Math.max(1, ...s.day.map(d => d.R + d.N + d.P + d.A + d.E));
    const ap = pct(s.R + s.N, s.progHoje);
    const leg = `<div class="tvlegenda"><span><i style="background:var(--st-real)"></i>Realizada</span><span><i style="background:var(--st-nreal)"></i>Não realizada</span><span><i style="background:var(--st-atr)"></i>Atrasada</span><span><i style="background:var(--st-prog);opacity:.45"></i>A fazer</span>${s.E ? '<span><i style="background:var(--st-extra)"></i>Extra</span>' : ''}</div>`;
    const linhas = tvUma() ? rotasDa(tvUma()).filter(r => r.carga > 0).map(r => [r.rota, stats(docsTV, { rota: r.rota })]).filter(([, x]) => x.prog).sort((a, b) => pct(a[1].Rhoje, a[1].progHoje) - pct(b[1].Rhoje, b[1].progHoje)).slice(0, 7) : tvAreas().map(a => [AREA_S[a], stats(docsFor({ ini: CUR_WEEK, area: a }))]);
    return `<div class="tvgrid tvsem"><div class="tvcard tvefsem"><h3>Eficiência da semana</h3><div class="tvefl">${tvAnel(ef, corEf(ef), ef + '%', `${n0(s.Rhoje)} de ${n0(s.progHoje)} até hoje`)}<div class="tvnums col2"><div class="ok"><b class="num">${n0(s.R)}</b><span>realizadas</span></div><div class="bad"><b class="num">${n0(s.N)}</b><span>não realizadas</span></div><div class="warn"><b class="num">${n0(s.A)}</b><span>atrasadas</span></div><div><b class="num">${ap}%</b><span>apontado até hoje</span></div></div></div></div>
      <div class="tvcard tvdia"><h3>Dia a dia</h3>${leg}<div class="tvcols">${s.day.map((d, j) => { const dt = add(CUR_WEEK, j); const t = d.R + d.N + d.P + d.A + d.E; const pe = d.R + d.N + d.A ? pct(d.R, d.R + d.N + d.A) : null; return `<div class="tvcol${dt === TODAY ? ' hoje' : ''}"><span class="num">${t || ''}</span><div class="pilha" style="height:calc((100% - 112px) * ${(t / mx).toFixed(3)})">${[['R', 'st-real'], ['N', 'st-nreal'], ['A', 'st-atr'], ['E', 'st-extra'], ['P', 'st-prog']].map(([c, v]) => d[c] ? `<i style="flex:${d[c]};background:var(--${v})${c === 'P' ? ';opacity:.4' : ''}"></i>` : '').join('')}</div><b>${DAYS[j]}</b><small>${ddmm(dt)}</small><em class="num" style="color:${pe == null ? 'var(--ink-3)' : corEf(pe)}">${pe == null ? '—' : pe + '%'}</em></div>`; }).join('')}</div></div>
      <div class="tvcard tvlarga"><div class="tvcab"><h3>${tvUma() ? 'Por rota · as que mais precisam de atenção' : 'Por área'}</h3>${leg}</div>${linhas.map(([nome, x]) => { const p = pct(x.Rhoje, x.progHoje); const tt = x.prog || 1; return `<div class="tvlinha"><b>${esc(nome)}<small>${n0(x.R)} de ${n0(x.prog)} · ${n0(x.A)} atrasada${x.A === 1 ? '' : 's'}</small></b><div class="tvbar multi"><i style="width:${x.R / tt * 100}%;background:var(--st-real)"></i><i style="width:${x.N / tt * 100}%;background:var(--st-nreal)"></i><i style="width:${x.A / tt * 100}%;background:var(--st-atr)"></i><i style="width:${(x.P - x.A) / tt * 100}%;background:var(--st-prog);opacity:.45"></i></div><span class="num" style="color:${corEf(p)}">${p}%</span></div>`; }).join('')}</div></div>`;
  }
  if (k === 'efetivo') {
    const ef = tvEfetivo(); const T = ef.reduce((o, x) => { o.quadro += x.quadro; o.pres += x.pres; o.folga += x.folga; o.ferias += x.ferias; o.D += x.D; o.N += x.N; o.atr += x.atr; for (const [c, n] of Object.entries(x.aus)) o.aus[c] = (o.aus[c] || 0) + n; return o; }, { quadro: 0, pres: 0, folga: 0, ferias: 0, D: 0, N: 0, atr: 0, aus: {} });
    const nAus = Object.values(T.aus).reduce((a, b) => a + b, 0); const esc0 = T.pres + nAus;
    return `<div class="tvgrid tvefet"><div class="tvcard tvhero">${tvAnel(pct(T.pres, esc0), corEf(pct(T.pres, esc0)), n0(T.pres), `presentes de ${esc0} escalados`)}<div class="tvnums"><div><b class="num">${T.D}</b><span>turno dia</span></div><div><b class="num">${T.N}</b><span>turno noite</span></div><div><b class="num">${T.folga}</b><span>de folga</span></div><div class="ext"><b class="num">${T.ferias}</b><span>de férias</span></div><div class="bad"><b class="num">${nAus}</b><span>ausências</span></div>${T.atr ? `<div class="warn"><b class="num">${T.atr}</b><span>atrasados</span></div>` : ''}</div>
      ${nAus ? `<div class="tvchips">${Object.entries(T.aus).map(([c, n]) => `<span>${SIT_NOME[c] || c} · <b>${n}</b></span>`).join('')}</div>` : ''}</div>
      <div class="tvareas${tvUma() ? ' rotas' : ''}">${(tvUma() ? tvEfetivoRotas(tvUma()) : ef).map(x => { const na = Object.values(x.aus).reduce((a, b) => a + b, 0); const e = x.pres + na; return `<div class="tvcard tvarea"><b>${esc(x.nome || AREA_S[x.a])}</b>${tvAnel(pct(x.pres, e), corEf(pct(x.pres, e || 1)), x.pres, `de ${e} escalados`)}<span class="muted">${x.D || x.N ? `☀ ${x.D} · ☾ ${x.N}` : ''}${na ? ` · <i class="dotn"></i>${na} ausente${na > 1 ? 's' : ''}` : ''}</span></div>`; }).join('')}</div></div>`;
  }
  if (k === 'equip') {
    const E = DB.cache.e; if (DB.eWatch) DB.eWatch([TODAY.slice(0, 7)]); const Q = tvEquipEscopo();
    const ab = Q.par.filter(p => !p.fim).sort((a, b) => ((a.data + (a.ini || '')) < (b.data + (b.ini || '')) ? -1 : 1));
    const hoje = Q.lanc.filter(l => l.data === TODAY); const parH = Q.par.filter(p => p.data === TODAY);
    const opHoje = new Set(hoje.map(l => l.op)).size, eqHoje = new Set(hoje.map(l => l.eq)).size;
    const frota = Q.frota; const parados = new Set(ab.map(p => p.eq)).size;
    return `<div class="tvgrid tvequip"><div class="tvcard tvhero">${tvAnel(pct(Math.max(0, frota - parados), frota || 1), parados ? 'var(--st-atr)' : 'var(--st-real)', frota - parados, `liberados de ${frota} equipamento${frota === 1 ? '' : 's'} ${tvUma() ? 'da área' : SK === 'bateria' ? 'da Bateria' : 'do Pátio'}`)}<div class="tvnums"><div><b class="num">${eqHoje}</b><span>em uso hoje</span></div><div><b class="num">${opHoje}</b><span>operadores hoje</span></div><div class="bad"><b class="num">${ab.length}</b><span>paradas sem liberação</span></div><div><b class="num">${parH.length}</b><span>paradas hoje</span></div></div></div>
      <div class="tvcard tvlarga"><h3>Equipamentos ${tvUma() ? 'da área' : SK === 'bateria' ? 'da Bateria' : 'do Pátio'} agora</h3>${Q.eqs.size ? `<div class="tveqs">${[...Q.eqs].map(id => { const f = E.cad.frota.find(x => x.id === id) || { id, tipo: '' }; const p = ab.find(x => x.eq === id); const l = hoje.filter(x => x.eq === id).sort((a, b) => ((a.ini || '') < (b.ini || '') ? 1 : -1))[0]; const st = p ? 'parado' : l ? (/FORA|MANUT/i.test(l.status) ? 'fora' : 'uso') : 'livre'; return { f, p, l, st }; }).sort((a, b) => ['parado', 'fora', 'uso', 'livre'].indexOf(a.st) - ['parado', 'fora', 'uso', 'livre'].indexOf(b.st) || a.f.id.localeCompare(b.f.id)).slice(0, 12).map(({ f, p, l, st }) => `<div class="tveq ${st}"><div><b class="mono">${esc(f.id)}</b><small>${esc(title(f.tipo || ''))}</small></div><span>${st === 'parado' ? `Parado · ${esc(p.causa || 'sem causa')}` : st === 'fora' ? esc(title(l.status)) : st === 'uso' ? `Em uso · ${esc(title((l.op || '').split(' ')[0]))}` : 'Sem lançamento hoje'}</span>${st === 'parado' ? `<em class="num" data-desde="${esc(p.data + 'T' + (p.ini || '00:00'))}">${tvDecorrido(p.data + 'T' + (p.ini || '00:00'))}</em>` : ''}</div>`).join('')}</div>${Q.eqs.size > 12 ? `<p class="muted">e mais ${Q.eqs.size - 12}</p>` : ''}` : `<div class="tvvazio">Nenhum equipamento destinado ${tvUma() ? 'a esta área' : 'a este conjunto'}. Defina a área de cada equipamento em Operação › Equipe e frota.</div>`}</div></div>`;
  }
  if (k === 'atencao') {
    const al = tvAlertas(h);
    return `<div class="tvalertas">${al.length ? al.map(([tom, t]) => `<div class="tvalerta ${tom}"><i></i><span>${esc(t)}</span></div>`).join('') : '<div class="tvcard tvvazio ok">Nada pendente agora. Bom trabalho!</div>'}</div>`;
  }
  if (k === 'causas') {
    const { por, total } = contarCausas(tvAreas().flatMap(a => docsFor({ ini: CUR_WEEK, area: a }))); const cs = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 6); const mx = cs.length ? cs[0][1] : 1;
    return `<div class="tvcard tvlarga tvcausas"><h3>Principais causas das não realizadas · semana</h3>${cs.length ? cs.map(([c, n]) => `<div class="tvlinha"><b>${esc(c)}</b><div class="tvbar"><i style="width:${n / mx * 100}%;background:var(--st-nreal)"></i></div><span class="num">${n} · ${pct(n, total)}%</span></div>`).join('') : '<div class="tvvazio ok">Nenhuma atividade não realizada nesta semana.</div>'}</div>`;
  }
  return '';
}
function tvDecorrido(desde) { const ms = Date.now() - new Date(desde).getTime(); if (!(ms > 0)) return ''; const m = Math.floor(ms / 60000); return m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor(m % 1440 / 60)} h` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; }
function vTV() {
  const l = tvCenasAtivas(); if (TVS.i >= l.length) TVS.i = 0; const k = l[TVS.i] || 'hoje'; const c = TV_CENAS.find(x => x[0] === k);
  const h = tvHoje();
  // Comemoração: rota que acabou de ter tudo apontado
  const fechadas = new Set(h.rotas.filter(r => r.prog && r.R + r.N === r.prog).map(r => SK + '|' + r.area + '|' + r.rota));
  if (TV_PREV) for (const key of fechadas) if (!TV_PREV.has(key)) { const [, a, r] = key.split('|'); tvFesta(r, AREA_S[a]); break; }
  TV_PREV = fechadas;
  const al = tvAlertas(h); const agora = new Date();
  const ticker = al.length ? al.map(([tom, t]) => `<span class="${tom}">${esc(t)}</span>`).join('') : '<span class="ok">Tudo em dia</span>';
  return `<div class="tvx">
    <header class="tvtopo"><img class="logo" src="img/dikma-logo-branco.png" alt="Dikma"><div class="tvtit"><b>${c[1]}</b><span>${SETS[SK].nome}${tvUma() ? ' · ' + AREA_S[tvUma()] : tvAreas().length < AREAS.length ? ' · ' + tvAreas().map(a => AREA_S[a]).join(', ') : ''} · ${c[2]}</span></div>
      <div class="tvrel"><b id="tvRelogio" class="num">${agora.toTimeString().slice(0, 8)}</b><span>${agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div><div id="sync" class="syncwrap">${syncPill()}</div></header>
    <main class="tvcena" data-cena="${k}">${tvCena(k, h)}</main>
    <footer class="tvrodape"><div class="tvpontos">${l.map((x, j) => `<button data-tvgo="${j}" class="${j === TVS.i ? 'on' : ''}" aria-label="${TV_CENAS.find(y => y[0] === x)[1]}">${TV_CENAS.find(y => y[0] === x)[1]}</button>`).join('')}</div>
      <div class="tvprog${TVS.pausa ? ' pausa' : ''}"><i style="animation-duration:${TVC.t}s" data-volta="${TVS.volta}-${TVS.i}"></i></div>
      <div class="tvticker"><div class="tvtk" style="animation-duration:${Math.max(25, al.length * 9)}s">${ticker}${ticker}</div></div></footer>
    <div class="tvctl" role="toolbar" aria-label="Controles do Modo TV"><button data-tv="prev" title="Cena anterior (←)">‹</button><button data-tv="pausa" title="Pausar (espaço)">${TVS.pausa ? '▶' : '❚❚'}</button><button data-tv="next" title="Próxima cena (→)">›</button><button data-tv="cheia" title="Tela cheia (F)">⛶</button><button data-tv="config" title="Configurar">⚙</button><a href="${location.pathname}${DEMO ? '?demo' : ''}" title="Sair do Modo TV">Sair</a></div>
  </div>`;
}
function tvFesta(rota, area) {
  const el = document.createElement('div'); el.className = 'tvfesta'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="tvconf" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.15}s;--h:${(i * 47) % 360}"></i>`).join('')}</div><div class="tvfesta-c"><span>Rota concluída</span><b>${esc(rota)}</b><small>${esc(area)} · tudo apontado hoje</small></div>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 7000);
}
function tvConfig() {
  const ss = setsDe(ME);
  formSheet('Configurar o Modo TV', 'Fica salvo nesta TV. O link copiado já leva esta configuração.', `<div class="tvcfg"><b>Cenas</b>${TV_CENAS.map(([k, n, d]) => `<label class="tgl-row"><span>${n}<br><small class="muted">${d}</small></span><input type="checkbox" class="tgl" data-tvc="${k}" ${TVC.cenas.includes(k) ? 'checked' : ''}></label>`).join('')}</div>
    <label class="sel"><span>Tempo de cada cena</span><select class="in" id="tvT">${[10, 15, 20, 30, 45, 60].map(s => `<option value="${s}" ${TVC.t === s ? 'selected' : ''}>${s} segundos</option>`).join('')}</select></label>
    <label class="sel"><span>Área desta TV</span><select class="in" id="tvArea"><option value="">${tvMinhas().length ? 'As minhas áreas' : 'Todas as áreas'}</option>${ss.map(k => `<optgroup label="${SETS[k].nome}">${SETS[k].areas.filter(a => !tvMinhas().length || tvMinhas().includes(a)).map(a => `<option value="${a}" ${TVC.area === a ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</optgroup>`).join('')}</select></label>
    ${ss.length > 1 ? `<label class="sel"><span>Conjunto (quando a TV mostra mais de uma área)</span><select class="in" id="tvConj"><option value="alt" ${TVC.conj === 'alt' ? 'selected' : ''}>Alternar Pátio e Bateria a cada volta</option>${ss.map(k => `<option value="${k}" ${TVC.conj === k ? 'selected' : ''}>Só ${SETS[k].nome}</option>`).join('')}</select></label>` : ''}
    <label class="switch"><input type="checkbox" id="tvClaro" ${TVC.claro ? 'checked' : ''}><span>Tema claro (o padrão da TV é escuro)</span></label>`, 'Salvar e copiar o link', async () => {
    const cenas = [...document.querySelectorAll('[data-tvc]')].filter(i => i.checked).map(i => i.dataset.tvc); if (!cenas.length) throw new Error('Escolha pelo menos uma cena.');
    Object.assign(TVC, { cenas, t: +$('tvT').value, conj: $('tvConj') ? $('tvConj').value : TVC.conj, claro: $('tvClaro').checked, area: $('tvArea').value });
    if (TVC.area) TVC.conj = setDaArea(TVC.area);
    try { localStorage.setItem('dikma-tv', JSON.stringify(TVC)); } catch (e) { /* sem armazenamento */ }
    const url = `${location.origin}${location.pathname}?tv${DEMO ? '&demo' : ''}${TVC.area ? `&area=${encodeURIComponent(TVC.area)}` : ''}&cenas=${cenas.join(',')}&t=${TVC.t}&conj=${TVC.conj}${TVC.claro ? '&claro' : ''}`;
    setTimeout(() => history.replaceState(history.state, '', url), 500); // depois que a janela fecha (o Voltar desfaz a entrada dela)
    if (TVC.claro) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'dark');
    if (TVC.conj !== 'alt' && ss.includes(TVC.conj)) { UI.esSet = TVC.conj; aplicarSet(); }
    try { await navigator.clipboard.writeText(url); toast('Link do Modo TV copiado'); } catch (e) { toast('Configuração salva'); }
    TVS.i = 0; render(); tvAgendar();
  });
}
function tvCheia() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* sem tela cheia */ } }
export function renderTV() {
  if (!DB.cache.configLoaded) { pintar('view', M.ESQUELETO); return; }
  { const mi = tvMinhas(); if (!TVC.area && mi.length && !mi.some(a => AREAS.includes(a))) { UI.esSet = setDaArea(mi[0]); aplicarSet(); } }
  UI.ini = CUR_WEEK; UI.mes = CUR_MONTH; DB.watchMonths([CUR_MONTH, addMonth(CUR_MONTH, -1)]);
  if (!DB.cache.monthsLoaded.has(CUR_MONTH)) { pintar('view', M.ESQUELETO); return; }
  pintar('view', vTV());
}

// Liga o Modo TV (só com ?tv): relógio, escala da tela, teclado, cliques e a tela sempre acesa.
export function iniciarTV() {
  if (TV) {
    carregarModulo('EQ'); // cena de equipamentos
    if (TVC.area && setDaArea(TVC.area)) TVC.conj = setDaArea(TVC.area);
    if (TVC.conj !== 'alt') UI.esSet = TVC.conj;
    // relógio e tempo das paradas a cada segundo, sem redesenhar a tela
    setInterval(() => { const r = $('tvRelogio'); if (r) r.textContent = new Date().toTimeString().slice(0, 8); document.querySelectorAll('[data-desde]').forEach(e => { e.textContent = tvDecorrido(e.dataset.desde); }); }, 1000);
    // contra marca na tela (TV ligada o dia todo): desloca a tela 1 a 3 px a cada 3 minutos
    // A TV é desenhada numa tela lógica grande e escala para caber em qualquer tela (sem cortar nem sobrar texto).
    // Contra marca na tela: a cada 3 minutos a imagem se desloca 1 a 3 px.
    let jit = [0, 0];
    // A tela lógica tem pelo menos 1920 de largura ou 900 de altura e preenche a tela toda, em qualquer proporção.
    const tvEscala = () => { const sc = Math.min(innerWidth / 1920, innerHeight / 900); const r = document.documentElement.style; r.setProperty('--tvs', sc); r.setProperty('--tvw', Math.ceil(innerWidth / sc) + 'px'); r.setProperty('--tvh', Math.ceil(innerHeight / sc) + 'px'); r.setProperty('--tvx', jit[0] + 'px'); r.setProperty('--tvy', jit[1] + 'px'); };
    addEventListener('resize', tvEscala); tvEscala();
    setInterval(() => { jit = [Math.round(Math.random() * 4 - 2), Math.round(Math.random() * 4 - 2)]; tvEscala(); }, 180000);
    let tm = 0; addEventListener('mousemove', () => { document.body.classList.add('tvmexe'); clearTimeout(tm); tm = setTimeout(() => document.body.classList.remove('tvmexe'), 3000); });
    addEventListener('keydown', e => {
      if ($('layer').children.length || AUTH.status !== 'ready') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') tvIr(1); else if (e.key === 'ArrowLeft' || e.key === 'PageUp') tvIr(-1);
      else if (e.key === ' ' || e.key === 'MediaPlayPause' || e.key === 'Enter') { e.preventDefault(); TVS.pausa = !TVS.pausa; render(); tvAgendar(); }
      else if (e.key === 'f' || e.key === 'F') tvCheia();
      else if (/^[1-9]$/.test(e.key) && +e.key <= tvCenasAtivas().length) { TVS.i = +e.key - 1; render(); tvAgendar(); }
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-tv],[data-tvgo]'); if (!b) return;
      if (b.dataset.tvgo) { TVS.i = +b.dataset.tvgo; render(); tvAgendar(); return; }
      const a = b.dataset.tv; if (a === 'next') tvIr(1); else if (a === 'prev') tvIr(-1); else if (a === 'pausa') { TVS.pausa = !TVS.pausa; render(); tvAgendar(); } else if (a === 'cheia') tvCheia(); else if (a === 'config') tvConfig();
    });
    tvAgendar();
  }
  // Modo TV: mantém a tela da sala de controle acesa enquanto o painel está aberto.
  if (TV && 'wakeLock' in navigator) {
    const acender = () => navigator.wakeLock.request('screen').catch(() => {});
    acender(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acender(); });
  }
}
