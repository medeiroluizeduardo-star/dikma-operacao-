// Indicadores › Visão geral (os 8 indicadores do contrato, com meta e tendência de 6 meses) e Indicadores › Histórico
// (12 meses, com Excel). As contas ficam em contas/contrato.js; aqui só a ligação com os dados e o desenho.
// Números do mês: da presença (absenteísmo e horas extras), das semanas (programação e queda zero) e dos equipamentos
// (horas paradas e notas 5S), de Pátio e Bateria. ICCC e ICCP: digitados pelo Gestor dos Indicadores (ou o administrador).
// O mês que já está carregado é calculado na hora; os outros vêm do histórico guardado em config/indicadores (hist),
// que o Gestor e o administrador atualizam sozinhos ao abrir a Visão geral (só quando os números mudam).
import { IND_CONTRATO, metaDe, naMeta, situacaoInd, textoMeta, fmtNum, mesMais, mesesAte, diasDoMes, contarProgramacao, contarQuedas, contarAusencias, somarNumeros, calcularIndicadores, placar, CAMPOS, conferirMetas } from '../contas/contrato.js';
import { SETS, MESES_L, today } from '../contas/cal.js';
import { contagemDia } from '../contas/situacao.js';
import { fontesSit, colabsDoSet, sitDoSet, escala, regimeDe } from '../calc/presenca.js';
import { horasHE } from './horas-justificativas.js';
import { etiqueta, tabela, vazio, carregando, recolhido } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, isAdmin, podeItem, setsDe, temEquipEm, perfil, DATAV, salvarUI } from '../nucleo/estado.js';
import { viewsDoModulo } from '../nucleo/navegacao.js';
import { modulo } from '../nucleo/modulos.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile, trocarTela } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';

const TODAY = today();
const MES_HOJE = TODAY.slice(0, 7);
const U = () => (UI.ic ||= { mes: MES_HOJE, vista: 'coq' });
const cfg = () => (DB.cache.ind && DB.cache.ind.cfg) || {};
const nomeMes = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
const mesCurto = ym => `${MESES_L[+ym.slice(5, 7) - 1].slice(0, 3)}/${ym.slice(2, 4)}`;

// Quem vê o quê: conjuntos (Pátio, Bateria) e Equipamentos do escopo dos Indicadores.
const conjs = () => setsDe(ME, 'indicadores').filter(k => k === 'patio' || k === 'bateria');
const temEq = () => temEquipEm(ME, 'indicadores');
// Edita metas e ICCC/ICCP: o administrador e o Gestor dos Indicadores (item "Editar metas e valores" em Perfis).
export const editaMetas = () => isAdmin() || (perfil('indicadores') === 'gestor' && podeItem('i_metas', 'indicadores'));
// Guarda o histórico: o administrador e o Gestor (mesmo que o item de editar metas esteja desligado).
const gravaHist = () => isAdmin() || perfil('indicadores') === 'gestor';
// Vista: Coqueria (Pátio + Bateria) ou um conjunto. Quem só tem um conjunto vê só ele.
function vista() {
  const cs = conjs(); const u = U();
  if (cs.length < 2) u.vista = cs[0] || 'coq';
  else if (u.vista !== 'coq' && !cs.includes(u.vista)) u.vista = 'coq';
  return u.vista;
}
const conjsDaVista = v => (v === 'coq' ? conjs() : [v]);
const nomeVista = v => (v === 'coq' ? 'Coqueria (Pátio + Bateria)' : SETS[v].nome);

/* ---------- números do mês, calculados na hora (quando o mês já está carregado) ---------- */
const MEMO = new Map();
const heCfgDe = st => ({ ciclo: 12, adm: 8, ...((st.config && st.config.he) || {}) });
// Presença, horas extras e atividades de um conjunto no mês; null enquanto carrega.
function numerosConj(k, ym, assistir) {
  const st = DB.dados(k); if (!st || !st.config) return null;
  if (assistir && DB.watchMonthsDe) DB.watchMonthsDe(k, [ym]);
  if (!st.monthsLoaded || !st.monthsLoaded.has(ym)) return null;
  if (!DB.isMock && (!(ym in (st.sitByMonth || {})) || !st.colabsLoaded)) return null;
  const ch = `${k}|${ym}|${DATAV}`; if (MEMO.has(ch)) return MEMO.get(ch);
  const cs = colabsDoSet(k); const dias = diasDoMes(ym, TODAY); const f = fontesSit(key => sitDoSet(k, key));
  const { esc: e, aus } = contarAusencias(dias.map(dt => contagemDia(cs, dt, f)));
  const hc = heCfgDe(st); let he = 0, heD = 0;
  for (const c of cs) for (const dt of dias) {
    const key = c.id + '|' + dt; if (sitDoSet(k, key) !== 'HE') continue;
    const h = horasHE(DB.sitInfo(key, k).hed);
    const r = escala().regimes[regimeDe(c, dt)];
    he += h == null ? (r && r.tipo === 'ciclo' ? hc.ciclo : hc.adm) : h; heD++;
  }
  const sem = Object.values(st.semanas || {});
  const { R, prog } = contarProgramacao(sem, ym, TODAY);
  const out = { esc: e, aus, he: Math.round(he * 100) / 100, heD, R, prog, qz: contarQuedas(sem, ym) };
  if (MEMO.size > 60) MEMO.clear();
  MEMO.set(ch, out); return out;
}
// Equipamentos do mês (por conjunto); null enquanto carrega ou sem acesso.
function numerosEq(ym, assistir) {
  if (!temEq()) return null;
  const EQ = modulo('EQ'); return EQ && EQ.contrato ? EQ.contrato(ym, assistir) : null;
}
// Números de cada conjunto da vista no mês: { k: { números, vivo } } (vivo = calculado agora; senão, do histórico).
function numerosMes(ym, assistir = false) {
  const H = cfg().hist || {}; const out = {}; const eq = numerosEq(ym, assistir);
  for (const k of conjs()) {
    const s = numerosConj(k, ym, assistir); const h = H[k + '|' + ym] || null;
    if (s && (!temEq() || eq)) out[k] = { n: { ...s, ...(eq ? eq[k] : {}) }, vivo: true };
    else if (h) out[k] = { n: s ? { ...h, ...s } : h, vivo: false, em: h.em };
    else out[k] = null;
  }
  return out;
}
// Indicadores da vista no mês: { vals, n, falta } (falta = algum conjunto da vista sem número).
function indicadoresMes(ym, v, assistir = false) {
  const por = numerosMes(ym, assistir); const ks = conjsDaVista(v);
  const falta = ks.some(k => !por[k]);
  const n = somarNumeros(ks.map(k => por[k] && por[k].n));
  const vals = ym > MES_HOJE ? {} : calcularIndicadores(falta ? {} : n, (cfg().valores || {})[ym]);
  return { vals, n: falta ? {} : n, falta, por };
}

/* ---------- histórico guardado (Gestor e administrador) ---------- */
let ultGrav = 0, agGrav = 0;
// Compara só os campos calculados agora (quem não tem Equipamentos não apaga as horas paradas guardadas).
const mudou = (vivo, guardado) => CAMPOS.some(c => Number.isFinite(vivo[c]) && Math.round(vivo[c] * 100) !== Math.round(((guardado || {})[c] ?? NaN) * 100));
function guardarHistorico(meses) {
  if (!gravaHist() || !DB.indSalvar || !DB.cache.ind || !DB.cache.ind.loaded || agGrav) return;
  const H = cfg().hist || {}; const patch = {};
  for (const ym of meses) {
    if (ym > MES_HOJE) continue;
    const por = numerosMes(ym, false);
    for (const k of conjs()) { const x = por[k]; if (x && x.vivo && mudou(x.n, H[k + '|' + ym])) patch[k + '|' + ym] = { ...x.n, em: TODAY }; }
  }
  const ks = Object.keys(patch); if (!ks.length) return;
  // O mês atual muda a todo lançamento: grava no máximo a cada 10 minutos. Mês fechado grava quando muda.
  const soAtual = ks.every(x => x.endsWith('|' + MES_HOJE));
  if (soAtual && Date.now() - ultGrav < 10 * 60e3) return;
  agGrav = setTimeout(() => { agGrav = 0; ultGrav = Date.now(); DB.indSalvar({ hist: patch }).catch(() => {}); }, 4000);
}

/* ---------- desenho ---------- */
// Tendência de 6 meses com a linha da meta tracejada. Ponto verde = dentro da meta; vermelho = fora; sem ponto = sem dado.
function grafico(i, pontos) {
  const W = 260, H = 70, pl = 6, pr = 6, pt = 8, pb = 16;
  const meta = metaDe(cfg(), i.k); const vs = pontos.map(p => p.v).filter(Number.isFinite);
  let max = Math.max(meta, ...vs, 0); if (i.u === '%' && i.dir > 0) max = Math.max(max, 100); max = max ? max * 1.1 : 1;
  let min = 0; if (i.u === '%' && i.dir > 0) { min = Math.max(0, Math.min(meta, ...vs) - 10); }
  const x = j => pl + j * (W - pl - pr) / Math.max(1, pontos.length - 1);
  const y = v => pt + (1 - (v - min) / ((max - min) || 1)) * (H - pt - pb);
  let s = `<svg class="ic-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(i.nome)} nos últimos 6 meses: ${pontos.map(p => `${p.l} ${fmtNum(p.v)}`).join(', ')}">`;
  s += `<line class="ic-meta" x1="${pl}" x2="${W - pr}" y1="${y(meta)}" y2="${y(meta)}"/>`;
  let seg = []; const segs = [];
  pontos.forEach((p, j) => { if (!Number.isFinite(p.v)) { if (seg.length) segs.push(seg); seg = []; } else seg.push(`${x(j).toFixed(1)},${y(p.v).toFixed(1)}`); });
  if (seg.length) segs.push(seg);
  segs.forEach(g => { if (g.length > 1) s += `<polyline class="ic-linha" points="${g.join(' ')}"/>`; });
  pontos.forEach((p, j) => {
    s += `<text x="${x(j).toFixed(1)}" y="${H - 3}" text-anchor="${j === 0 ? 'start' : j === pontos.length - 1 ? 'end' : 'middle'}">${esc(p.l)}</text>`;
    if (Number.isFinite(p.v)) s += `<circle class="${naMeta(cfg(), i.k, p.v) ? 'ok' : 'fora'}${p.atual ? ' atual' : ''}" cx="${x(j).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.atual ? 4.5 : 3.5}"><title>${esc(p.l)}: ${fmtNum(p.v)}${i.u === '%' ? '%' : ' ' + i.u}</title></circle>`;
  });
  return s + '</svg>';
}
const unid = i => (i.u === '%' ? '%' : i.u === 'h' ? 'h' : '');
// Explicação de cada número (de onde veio).
function detalhe(i, r, ym) {
  const n = r.n; const dig = (cfg().valores || {})[ym] || {};
  if (ym > MES_HOJE) return 'Mês que ainda não começou.';
  if (i.fonte === 'm') return Number.isFinite(dig[i.k]) ? 'Valor apurado, informado em Metas e valores.' : editaMetas() ? 'Ainda não informado: toque em Metas e valores.' : 'Ainda não informado pelo Gestor dos Indicadores.';
  if (i.fonte === 'e' && !temEq()) return 'Sem acesso aos números de Equipamentos.';
  if (r.falta) return 'Carregando os números do mês…';
  if (i.k === 'abs') return n.esc ? `${n.aus} faltas e atestados ÷ ${n.esc} dias escalados` : 'Ninguém escalado no mês até hoje.';
  if (i.k === 'he') return `${n.heD || 0} dia${n.heD === 1 ? '' : 's'} com hora extra (sem horário, conta a estimativa por dia)`;
  if (i.k === 'hp') return `${n.npar || 0} parada${n.npar === 1 ? '' : 's'} de equipamento no mês`;
  if (i.k === 'efic') return n.prog ? `${n.R} realizadas de ${n.prog} programadas até hoje` : 'Nada programado até hoje.';
  if (i.k === 'queda') return n.qz ? `${n.qz} lançamento${n.qz === 1 ? '' : 's'} de queda no mês` : 'Nenhuma queda lançada no mês.';
  if (i.k === 's5') return n.s5n ? `Média de ${n.s5n} inspeç${n.s5n === 1 ? 'ão' : 'ões'} 5S nos equipamentos` : 'Nenhuma inspeção 5S no mês.';
  return '';
}
function cartao(i, r, serie, ym, abas) {
  const v = r.vals[i.k]; const ok = naMeta(cfg(), i.k, v); const sit = situacaoInd(cfg(), i.k, v);
  const destino = i.fonte === 'm' ? (editaMetas() ? 'data-act="icMetas"' : '') : i.aba && abas.has(i.aba) ? `data-go="${i.aba}"` : '';
  const tag = destino ? 'button type="button"' : 'div';
  return `<${tag} class="p-ind ic-card ${sit}" ${destino} aria-label="${esc(i.nome)}: ${fmtNum(v)}${unid(i)}, meta ${esc(textoMeta(cfg(), i.k))}${ok === true ? ', dentro da meta' : ok === false ? ', fora da meta' : ''}">
    <span class="ic-topo"><span class="p-ind-rot">${esc(i.nome)}</span>${etiqueta(ok === true ? 'Dentro da meta' : ok === false ? 'Fora da meta' : 'Sem dado', ok === true ? 'ok' : ok === false ? 'critico' : 'neutro')}</span>
    <span class="p-ind-v">${fmtNum(v)}${Number.isFinite(v) && i.u !== 'quedas' ? `<small>${unid(i)}</small>` : Number.isFinite(v) ? `<small>${v === 1 ? 'queda' : 'quedas'}</small>` : ''}</span>
    <span class="p-ind-pe"><span>Meta ${esc(textoMeta(cfg(), i.k))}</span></span>
    <span class="ic-det">${esc(detalhe(i, r, ym))}</span>
    ${grafico(i, serie)}</${tag}>`;
}
function vVisao() {
  const cs = conjs(); const u = U();
  if (!cs.length && !temEq()) return vazio('Sem números para mostrar', 'Seu acesso aos Indicadores não tem Pátio, Bateria nem Equipamentos. Peça ao administrador.');
  const v = vista(); const ym = u.mes;
  const atual = indicadoresMes(ym, v, true);
  if (cs.length && atual.falta && ym <= MES_HOJE && !Object.values(atual.por).some(Boolean)) return carregando();
  const meses = mesesAte(ym, 6);
  const series = Object.fromEntries(IND_CONTRATO.map(i => [i.k, []]));
  for (const m of meses) {
    const r = m === ym ? atual : indicadoresMes(m, v, false);
    for (const i of IND_CONTRATO) series[i.k].push({ l: mesCurto(m), v: r.vals[i.k], atual: m === ym });
  }
  guardarHistorico(mesesAte(ym, 2));
  const pl = placar(cfg(), atual.vals);
  const abas = new Set(viewsDoModulo().map(x => x.id));
  const cards = IND_CONTRATO.map(i => cartao(i, atual, series[i.k], ym, abas));
  const guardado = Object.values(atual.por).some(x => x && !x.vivo);
  let h = `<p class="ic-placar">${pl.comValor ? `<b>${pl.dentro} de ${pl.comValor}</b> indicadores dentro da meta em ${esc(nomeMes(ym))}` : `Sem números em ${esc(nomeMes(ym))} ainda`} · ${esc(nomeVista(v))}${ym === MES_HOJE ? ' · até hoje' : ''}${guardado ? ' · números guardados no histórico' : ''}</p>`;
  // No celular, os 4 primeiros aparecem e o resto fica num toque.
  h += isMobile() ? `<div class="ic-grade">${cards.slice(0, 4).join('')}</div>${recolhido('Mais 4 indicadores', `<div class="ic-grade">${cards.slice(4).join('')}</div>`)}` : `<div class="ic-grade">${cards.join('')}</div>`;
  h += `<p class="muted small ic-nota">Competência pelo mês civil (1º ao último dia). Absenteísmo = faltas e atestados ÷ dias escalados (Escala do dia). Horas extras pela Escala do dia. Horas perdidas = paradas dos equipamentos. Eficiência = realizadas ÷ programadas até hoje. Queda Zero = quedas lançadas. 5S = média das inspeções dos equipamentos. ICCC e ICCP: valores informados no mês. Toque num cartão para ver o detalhe.</p>`;
  return h;
}
function linhaHist(ym, v) {
  const r = indicadoresMes(ym, v, false);
  return { ym, r, tem: IND_CONTRATO.some(i => Number.isFinite(r.vals[i.k])) };
}
function vHist() {
  const v = vista(); const meses = mesesAte(MES_HOJE, 12).reverse();
  const linhas = meses.map(m => linhaHist(m, v));
  const cel = (i, val) => { const ok = naMeta(cfg(), i.k, val); return Number.isFinite(val) ? `<span class="ic-hv ${ok ? 'ok' : 'fora'}" title="${ok ? 'Dentro da meta' : 'Fora da meta'}">${fmtNum(val)}${unid(i)}</span>` : '<span class="p-falta">—</span>'; };
  const cols = [{ t: 'Mês' }, ...IND_CONTRATO.map(i => ({ t: `${i.nome} (${textoMeta(cfg(), i.k)})`, n: true })), { t: 'Na meta', n: true }];
  const tb = tabela(cols, linhas.map(x => { const p = placar(cfg(), x.r.vals); return [`<button type="button" class="btn ghost link" data-act="icMes" data-mes="${x.ym}"><b>${esc(nomeMes(x.ym))}</b></button>`, ...IND_CONTRATO.map(i => cel(i, x.r.vals[i.k])), p.comValor ? `${p.dentro}/${p.comValor}` : '—']; }), { rotulo: 'Histórico de 12 meses' });
  const semDado = linhas.filter(x => !x.tem && x.ym <= MES_HOJE).length;
  let h = `<p class="muted small">${esc(nomeVista(v))} · verde = dentro da meta, vermelho = fora. Toque no mês para abrir a Visão geral dele.${semDado ? ` ${semDado} mês${semDado > 1 ? 'es' : ''} ainda sem números guardados: ${gravaHist() ? 'abra o mês na Visão geral para calcular e guardar.' : 'o Gestor dos Indicadores guarda ao abrir o mês na Visão geral.'}` : ''}</p>`;
  return h + tb;
}

/* ---------- metas e valores (Gestor dos Indicadores e administrador) ---------- */
function abrirMetas() {
  if (!editaMetas()) return;
  const ym = U().mes; const c = cfg(); const dig = (c.valores || {})[ym] || {};
  const campo = (id, rot, val, ph = '') => `<label class="sel"><span>${esc(rot)}</span><input class="in" id="${id}" inputmode="decimal" autocomplete="off" value="${esc(val == null ? '' : String(val).replace('.', ','))}" placeholder="${esc(ph)}"></label>`;
  const metas = IND_CONTRATO.map(i => campo('icm_' + i.k, `${i.nome} · ${i.dir < 0 ? 'até' : 'no mínimo'} (${i.u})`, metaDe(c, i.k))).join('');
  formSheet('Metas e valores', `Metas valem para todos os meses · ICCC e ICCP de ${esc(nomeMes(ym))}`,
    `<p class="lbl m0">Valores apurados em ${esc(nomeMes(ym))}</p><div class="p-form">${campo('icv_iccc', 'ICCC apurado (%)', dig.iccc, 'Ex.: 96,5')}${campo('icv_iccp', 'ICCP apurado (%)', dig.iccp, 'Ex.: 97')}</div>
     <p class="lbl">Metas (vazio = a padrão)</p><div class="p-form">${metas}</div>`, 'Salvar', async () => {
      const val = id => (document.getElementById(id) || {}).value || '';
      const { metas: m, valores } = conferirMetas(Object.fromEntries(IND_CONTRATO.map(i => [i.k, val('icm_' + i.k)])), { iccc: val('icv_iccc'), iccp: val('icv_iccp') });
      const antes = Object.fromEntries(IND_CONTRATO.map(i => [i.k, metaDe(c, i.k)]));
      await DB.indSalvar({ metas: m, valores: { [ym]: valores } });
      const mudouMeta = IND_CONTRATO.filter(i => metaDe({ metas: m }, i.k) !== antes[i.k]).map(i => `${i.nome} ${textoMeta({ metas: m }, i.k)}`);
      DB.log(`Indicadores: ${nomeMes(ym)} ICCC ${fmtNum(valores.iccc)} · ICCP ${fmtNum(valores.iccp)}${mudouMeta.length ? ` · metas: ${mudouMeta.join(', ')}` : ''}`, 'administracao');
      toast('Metas e valores salvos'); render();
    });
}

async function exportar() {
  const v = vista(); const meses = mesesAte(MES_HOJE, 12);
  const cab = ['Mês', ...IND_CONTRATO.map(i => `${i.nome} (${i.u})`), ...IND_CONTRATO.map(i => `Meta ${i.nome}`), 'Dias escalados', 'Faltas e atestados', 'Dias de HE', 'Programadas', 'Realizadas', 'Paradas', 'Inspeções 5S'];
  const r1 = x => (Number.isFinite(x) ? Math.round(x * 10) / 10 : '');
  const linhas = meses.map(m => { const r = indicadoresMes(m, v, false); const n = r.n; return [nomeMes(m), ...IND_CONTRATO.map(i => r1(r.vals[i.k])), ...IND_CONTRATO.map(i => metaDe(cfg(), i.k)), n.esc ?? '', n.aus ?? '', n.heD ?? '', n.prog ?? '', n.R ?? '', n.npar ?? '', n.s5n ?? '']; });
  await baixarExcel(`Indicadores do contrato - ${nomeVista(v)} - ${MES_HOJE}`, [{ nome: 'Indicadores', linhas: [cab, ...linhas] }]);
}

/* ---------- topo e eventos ---------- */
export function topo(view) {
  const u = U(); const cs = conjs(); const v = vista();
  const ops = []; for (let i = 0; i < 13; i++) ops.push(mesMais(MES_HOJE, -i));
  const mes = view === 'ivisao' ? `<label class="sel"><span>Mês</span><select class="in" id="icMes">${ops.map(m => `<option value="${m}" ${m === u.mes ? 'selected' : ''}>${esc(nomeMes(m))}</option>`).join('')}</select></label>` : '';
  const sw = cs.length > 1 ? `<div class="seg setsw ic-sw" role="tablist" aria-label="Conjunto">${[['coq', 'Coqueria'], ...cs.map(k => [k, SETS[k].curto])].map(([k, t]) => `<button type="button" role="tab" data-act="icVista" data-v="${k}" aria-selected="${v === k}">${esc(t)}</button>`).join('')}</div>` : '';
  const metas = view === 'ivisao' && editaMetas() ? `<button type="button" class="btn" data-act="icMetas">${I.nota} Metas e valores</button>` : '';
  return sw + mes + metas;
}
export function renderView(view) { return view === 'ihist' ? vHist() : vVisao(); }

acoes.icVista = (t, d) => { U().vista = d.v; render(); };
acoes.icMetas = () => abrirMetas();
acoes.icExcel = () => exportar().catch(e => toast(e.message || 'Não foi possível exportar'));
acoes.icMes = (t, d) => { U().mes = d.mes; UI.view = 'ivisao'; salvarUI(); trocarTela('ivisao'); };
document.addEventListener('change', e => { if (e.target && e.target.id === 'icMes') { U().mes = e.target.value; render(); } });
