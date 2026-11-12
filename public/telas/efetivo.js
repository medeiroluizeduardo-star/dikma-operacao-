// Telas do Efetivo (escala e presença): cartões de ausências e balanço, Efetivo diário, check-in do turno,
// lançamento da situação do dia com substituto, Dimensionamento e Balanço.
import { SETS, AREA_S, ehAreaGeral, DAYS, DL, SITS, AUSENTE, AUSENCIA, pd, add, ddmm, weekLabel } from '../contas/cal.js';
import { canonLideres, criarBusca as buscaNomes } from '../contas/planilhas-adm.js';
import { abrirLancamento, JUS_CODS, pedirJus, textoJus, CODIGOS_LANC } from '../ui/presenca.js';
import { situacaoDoDia, PARCIAL, AUS_COBRIVEL } from '../contas/situacao.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import * as M from '../ui/movimento.js';
import { semAcento, casa, caixaBusca, campoBusca } from '../ui/busca.js';
import { PERIODO } from '../contas/escala.js';
import { DB, TODAY, framed, esc, pct, title, $ } from '../nucleo/base.js';
import { ME, COLABS, SK, AREAS, UI, salvarUI, isAdmin, myArea, areaScope, canEditSit, temFichas, setsDe, aplicarSet, perfil, admDe } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { rotasDa } from '../calc/atividades.js';
import { escala, turmaDe, regimeDe, regimeNome, sitDia, fontesSit, sitTela, desligadoNoDia, contarDia, periodoDe, marcaPer, folgaEscala, escalaRota, SIT_NOME, SIT_TOM, colabsDa, HE_ORIG, HE_SIG, cobDoDia, cobertoPor, cobrindo, refSub, sitDoSub, folgaNoDia, nomeDe, curto, removerCobertura, areasSitDe, colabsDoSet, sitDoSet } from '../calc/presenca.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, isMobile, trocarTela } from '../ui/shell.js';
import { ocorrOpc, salvarJus, textoHE, horarioHE } from './horas-justificativas.js';

// Quem não está hoje (folga, férias, atestado, afastado, treinamento, falta). Desligado não conta como ausência.
export function cardAusencias(area) {
  const cs = colabsDa(area).filter(c => !desligadoNoDia(c, TODAY));
  const sh = new Map(cs.map(c => [c.id, sitDia(c, TODAY)]));
  const ct = contarDia(cs, TODAY); const folgaHoje = ct.folga, ferias = ct.ferias;
  const aus = cs.map(c => ({ c, v: sh.get(c.id).v, auto: sh.get(c.id).auto })).filter(x => !x.auto && (AUSENCIA.has(x.v) || PARCIAL.has(x.v))).sort((a, b) => a.v.localeCompare(b.v) || a.c.rota.localeCompare(b.c.rota) || a.c.nome.localeCompare(b.c.nome));
  const atr = cs.filter(c => DB.sit(c.id + '|' + TODAY) === 'ATR').length; const sai = cs.filter(c => DB.sit(c.id + '|' + TODAY) === 'SA').length;
  const ausR = aus.filter(x => !PARCIAL.has(x.v)); // atrasado e saída antecipada estão presentes: aparece na lista, mas não conta como ausência
  const por = {}; ausR.forEach(x => { por[x.v] = (por[x.v] || 0) + 1; });
  const pres = ct.presentes;
  const lista = aus.length ? `<div class="aus-l">${aus.slice(0, 40).map(x => `<button class="aus-it" data-goescala="${esc(x.c.area + '|' + x.c.rota)}"><span class="minw"><b>${esc(title(x.c.nome))}</b><small>${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}${AUS_COBRIVEL.has(x.v) ? (cobertoPor(x.c.id, TODAY) ? ` · coberto por ${esc(curto(nomeDe(cobertoPor(x.c.id, TODAY))))}` : ' · <em class="semt">sem substituto</em>') : ''}${(j => (j && j.cod === x.v ? ` · ${esc(textoJus(j))}` : JUS_CODS.includes(x.v) ? ' · <em class="semt">sem justificativa</em>' : ''))(DB.sitInfo(x.c.id + '|' + TODAY).jus)}</small></span><span class="pill ${SIT_TOM[x.v] || 'neu'}">${SIT_NOME[x.v]}</span></button>`).join('')}${aus.length > 40 ? `<p class="muted small m0">+ ${aus.length - 40}</p>` : ''}</div>` : '<div class="empty small">Ninguém ausente ou atrasado hoje.</div>';
  return `<div class="card"><header><h2>Ausências e atrasos de hoje</h2><p>${ddmm(TODAY)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</p></header><div class="body">
    <div class="mini aus-mini"><div><b class="num">${pres}</b><span>Presentes</span></div><div><b class="num">${folgaHoje}</b><span>Folga</span></div>${ferias ? `<div><b class="num">${ferias}</b><span>Férias</span></div>` : ''}<div><b class="num" style="color:${ausR.length ? 'var(--st-nreal)' : 'inherit'}">${ausR.length}</b><span>Ausentes</span></div><div><b class="num">${pct(pres, cs.length - folgaHoje - ferias)}%</b><span>Presença dos escalados</span></div></div>
    ${aus.length ? `<div class="rchips">${Object.entries(por).map(([k, n]) => `<span class="rchip">${SIT_NOME[k]} · <b class="num">${n}</b></span>`).join('')}${atr ? `<span class="rchip">Atrasados · <b class="num">${atr}</b></span>` : ''}${sai ? `<span class="rchip">Saída antecipada · <b class="num">${sai}</b></span>` : ''}</div>` : ''}
    ${lista}</div></div>`;
}
// Balanço da semana: quadro, ausências por motivo, disponíveis × necessários e rotas em déficit, dia a dia.
export function cardBalanco(area, ini) {
  const cs = colabsDa(area); const rs = rotasDa(area); const tk = DAYS.map((_, k) => add(ini, k) === TODAY);
  const esc7 = rs.map(r => escalaRota(r, ini));
  const dias = DAYS.map((_, k) => {
    const dt = add(ini, k); const quadro = cs.filter(c => !desligadoNoDia(c, dt));
    const ct = contarDia(quadro, dt); const fe = ct.folga, fer = ct.ferias, aus = ct.ausentes;
    const mot = {}; for (const m of AUSENCIA) if (ct.porCodigo[m]) mot[m] = ct.porCodigo[m];
    const nec = esc7.reduce((n, e) => n + e.days[k].nec, 0);
    const def = rs.filter((r, i) => r.rota !== 'GESTÃO' && esc7[i].days[k].prog > 0 && esc7[i].days[k].disp < esc7[i].days[k].nec).length;
    const ids = new Set(cs.map(c => c.id)); const cob = cobDoDia(dt).filter(x => ids.has(x.aus)).length;
    const heD = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && DB.sitInfo(c.id + '|' + dt).he === 'DIKMA').length, heA = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && DB.sitInfo(c.id + '|' + dt).he === 'ARCELOR').length, heN = cs.filter(c => DB.sit(c.id + '|' + dt) === 'HE' && !DB.sitInfo(c.id + '|' + dt).he).length;
    return { cob, heD, heA, heN, q: quadro.length, fe, fer, esc: quadro.length - fe - fer, aus, mot, disp: quadro.length - fe - fer - aus, nec, saldo: quadro.length - fe - fer - aus - nec, def };
  });
  const motivos = [...AUSENCIA].filter(m => dias.some(d => d.mot[m]));
  const soma = f => dias.reduce((n, d) => n + f(d), 0);
  const cel = (k, v, cls = '') => `<td class="c num ${tk[k] ? 'today' : ''} ${cls}">${v}</td>`;
  const linha = (rot, f, tot, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${rot}</th>${dias.map((d, k) => cel(k, f(d))).join('')}<td class="c num tot">${tot}</td></tr>`;
  const sinal = v => (v > 0 ? '+' + v : String(v));
  const pDisp = soma(d => d.disp), pQ = soma(d => d.esc);
  return `<div class="card"><header><h2>Balanço semanal do efetivo</h2><p>${weekLabel(ini)} · pessoas por dia</p></header>
    <div class="tw"><table class="bal"><thead><tr><th></th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(ini, k).slice(8)}</span></th>`).join('')}<th class="c">Semana</th></tr></thead><tbody>
    ${linha('Quadro', d => d.q, '')}
    ${linha('<span class="sub">Folga</span>', d => d.fe || '·', soma(d => d.fe), 'mot')}
    ${soma(d => d.fer) ? linha('<span class="sub">Férias</span>', d => d.fer || '·', soma(d => d.fer), 'mot') : ''}
    ${linha('Escalados', d => d.esc, '')}
    ${motivos.map(m => linha(`<span class="sub">${SIT_NOME[m]}</span>`, d => d.mot[m] || '·', soma(d => d.mot[m] || 0), 'mot')).join('')}
    ${linha('Ausências', d => d.aus, soma(d => d.aus), 'aus')}
    ${soma(d => d.cob) ? linha('<span class="sub">Cobertas por substituto</span>', d => d.cob || '·', soma(d => d.cob), 'mot') : ''}
    ${linha('Disponíveis', d => d.disp, pQ ? `${(Math.floor(pDisp / pQ * 1000) / 10).toLocaleString('pt-BR')}%` : '')}
    ${linha('Necessários', d => d.nec, '')}
    <tr class="saldo"><th scope="row">Saldo</th>${dias.map((d, k) => cel(k, sinal(d.saldo), d.saldo < 0 ? 'neg' : 'pos')).join('')}<td class="c num tot"></td></tr>
    ${soma(d => d.heD + d.heA + d.heN) ? `${linha('Hora extra', d => (d.heD + d.heA + d.heN) || '·', soma(d => d.heD + d.heA + d.heN))}${linha('<span class="sub">a pedido da Dikma</span>', d => d.heD || '·', soma(d => d.heD), 'mot')}${linha('<span class="sub">a pedido da ArcelorMittal</span>', d => d.heA || '·', soma(d => d.heA), 'mot')}${soma(d => d.heN) ? linha('<span class="sub">sem origem informada</span>', d => d.heN || '·', soma(d => d.heN), 'mot') : ''}` : ''}
    <tr><th scope="row">Rotas em déficit</th>${dias.map((d, k) => cel(k, d.def ? `<span class="pill bad">${d.def}</span>` : '0')).join('')}<td class="c num tot">${soma(d => d.def)}</td></tr>
    </tbody></table></div>
    <div class="body pt0 row-between"><details class="calc"><summary>Como é calculado</summary><p>Escalados = quadro − folga (da escala ou lançada) − férias.</p><p>Ausências = atestado, afastamento, treinamento, falta, abono e suspensão (folga e férias não contam).</p><p>Disponíveis = escalados − ausências. Saldo = disponíveis − necessários. Necessário vem do dimensionamento por rota (efetivo padrão × atividades do dia ÷ carga).</p></details><button class="btn ghost link" data-goescala="">Abrir o Efetivo diário</button></div></div>`;
}
function opcoesSubst(c, dt) {
  return () => {
    const out = [];
    for (const k of setsDe(ME)) {
      const lista = k === SK ? COLABS : Object.values((DB.dados(k) || {}).colabs || {}).flat();
      for (const x of lista) {
        if (k === SK && x.id === c.id) continue;
        const r = { k, id: x.id, c: x, outro: k !== SK }; const s0 = sitDoSub(r, dt);
        if (s0.v === 'DS') continue; // desligado não cobre
        const cob = k === SK ? cobrindo(x.id, dt) : '';
        const fora = !folgaNoDia(s0) && AUSENTE.has(s0.v);
        const tag = cob ? `<span class="pill neu">já cobre ${esc(curto(nomeDe(cob)))}</span>` : fora ? `<span class="pill warn">${esc(SIT_NOME[s0.v] || s0.v)}</span>` : folgaNoDia(s0) ? '<span class="pill ext">de folga · vira hora extra</span>' : s0.v === 'HE' ? '<span class="pill ext">já em hora extra</span>' : '<span class="pill ok">trabalhando</span>';
        const ord = fora ? 5 : cob ? 4 : (k === SK && x.area === c.area && x.rota === c.rota) ? 0 : folgaNoDia(s0) ? 1 : (k === SK && x.area === c.area) ? 2 : 3;
        out.push({ v: k === SK ? x.id : k + ':' + x.id, t: title(x.nome), d: `${x.rota} · ${AREA_S[x.area] || x.area}${k !== SK ? ' · ' + SETS[k].curto : ''}${s0.auto && s0.motivo ? ' · ' + s0.motivo : ''}`, tag, ord, k: [x.funcao, x.mat, SETS[k].curto].filter(Boolean).join(' ') });
      }
    }
    return out.sort((a, b) => a.ord - b.ord || a.t.localeCompare(b.t));
  };
}
export function fecharSitPop() { const p = document.querySelector('.sitpop'); if (p) p.remove(); document.removeEventListener('keydown', sitPopEsc, true); }
function sitPopEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); fecharSitPop(); } }
// Efetivo diário: o mesmo lançamento da Frequência (janela com as situações → até quando),
// e depois, quando é ausência num dia de trabalho, quem cobre; quando é hora extra, a pedido de quem.
const CODS_EF = CODIGOS_LANC;
export function lancarEfetivo(key) {
  fecharSitPop();
  const [id, dt] = key.split('|'); const c = COLABS.find(x => x.id === id); if (!c) return;
  const sx = sitDia(c, dt); const info = DB.sitInfo(key); const cobre = cobrindo(id, dt);
  const prev = escala().previsto(regimeDe(c), turmaDe(c), dt);
  const linha = prev ? (prev.trab ? `Pela escala: trabalha${turmaDe(c) ? ` (turma ${esc(turmaDe(c))})` : ''}` : `Pela escala: folga (${esc(prev.motivo)})`) : 'Sem turma: a escala não marca folga sozinha';
  const extras = [];
  if (!sx.auto && AUS_COBRIVEL.has(sx.v)) {
    if (info.cob) extras.push({ t: 'Trocar substituto', d: `Hoje cobre: ${nomeDe(info.cob)}`, v: 'cob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` }, { t: 'Tirar o substituto', v: 'semcob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
    else extras.push({ t: 'Definir substituto', d: 'Ninguém cobrindo', v: 'cob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
  }
  if (cobre) extras.push({ t: `Deixar de cobrir ${nomeDe(cobre)}`, v: 'sairCob', extra: true, ic: `<span class="opt-ic">${I.swap}</span>` });
  if (!sx.auto && JUS_CODS.includes(sx.v)) { const j = info.jus && info.jus.cod === sx.v ? info.jus : null; extras.unshift({ t: j ? 'Editar a justificativa' : `Justificar ${(SIT_NOME[sx.v] || '').toLowerCase()}`, d: j ? textoJus(j) : 'Ainda sem justificativa', v: 'jus', extra: true, ic: `<span class="opt-ic">${I.edit || '✎'}</span>` }); }
  if (sx.v === 'HE') extras.push({ t: 'Hora extra a pedido de…', d: info.he ? `Agora: ${HE_ORIG[info.he]}` : 'Não informado', v: 'heo', extra: true, ic: '<span class="sit HE">HE</span>' }, { t: 'Horário da hora extra', d: textoHE(info.hed) || 'Informar início e fim', v: 'heh', extra: true, ic: `<span class="opt-ic">${I.relogio}</span>` });
  const k = (pd(dt).getDay() + 6) % 7; const domingo = add(dt, 6 - k);
  const depois = []; for (let i = 1; i <= 30; i++) depois.push(add(dt, i));
  const fimToque = () => { render(); const nb = document.querySelector(`[data-sit="${CSS.escape(key)}"]`); if (nb) { nb.focus({ preventScroll: true }); M.pulsar(nb); } };
  abrirLancamento({
    sheet, nome: title(c.nome), dt, atual: sx.auto ? { v: sx.v, auto: true, motivo: 'pela escala' } : sx.ferias ? { v: 'FE', auto: true, motivo: 'férias' } : DB.sit(key) ? { v: sx.v } : { v: sx.v, auto: true, motivo: '' },
    codigos: CODS_EF, linhaInfo: linha, extras, depois, ok: I.ok,
    fim: k < 6 ? { t: 'Até domingo', v: domingo } : null,
    aoExtra: v => {
      if (v === 'cob') return passoCobertura(c, dt, [dt], null, fimToque);
      if (v === 'semcob') { removerCobertura(id, dt); DB.log(`${title(c.nome)} · ${ddmm(dt)} sem substituto`); fimToque(); toast('Substituto removido'); return; }
      if (v === 'sairCob') { removerCobertura(cobre, dt); fimToque(); toast('Cobertura removida'); return; }
      if (v === 'heo') return passoHE(c, [dt], null, fimToque);
      if (v === 'heh') return horarioHE(c, [dt], fimToque);
      if (v === 'jus') return pedirJus({ formSheet, nome: title(c.nome), dt, cod: sx.v, atual: info.jus, ocorr: info.jus && info.jus.ocorr ? null : ocorrOpc(c, sx.v), salvar: j => salvarJus(c, [dt], j), depois: fimToque });
    },
    aoEscolher: (v, dias) => {
      const antes = dias.map(d => [d, DB.sit(id + '|' + d) || null, DB.sitInfo(id + '|' + d)]);
      // grava só o que difere da escala: presente num dia de folga fica gravado; folga num dia de folga, não
      const gravar = d => { if (!v) return null; const fe = folgaEscala(c, d); if (v === 'P') return fe ? 'P' : null; if (v === 'F' && fe) return null; return v; };
      dias.forEach(d => { DB.setSit(id + '|' + d, gravar(d)); if (!AUS_COBRIVEL.has(v)) removerCobertura(id, d); if (v !== 'HE') (DB.setSitExtra('he', id + '|' + d, null), DB.setSitExtra('hed', id + '|' + d, null)); const ju = DB.sitInfo(id + '|' + d).jus; if (ju && ju.cod !== v) DB.setSitExtra('jus', id + '|' + d, null); });
      const nome = !v ? 'automático' : SIT_NOME[v];
      DB.log(`${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''} → ${nome}`);
      const desfazer = () => { antes.forEach(([d, x, inf]) => { DB.setSit(id + '|' + d, x); (DB.setSitExtra('he', id + '|' + d, inf.he || null), DB.setSitExtra('hed', id + '|' + d, inf.hed || null), DB.setSitExtra('jus', id + '|' + d, inf.jus || null)); }); DB.log(`${title(c.nome)} · desfez a mudança de ${ddmm(dt)}`); render(); };
      fimToque();
      const segue = () => { if (AUS_COBRIVEL.has(v) && gravar(dt)) return passoCobertura(c, dt, dias, desfazer, fimToque); if (v === 'HE') return passoHE(c, dias, desfazer, fimToque); toast(dias.length > 1 ? `${curto(title(c.nome))}: ${nome.toLowerCase()} em ${dias.length} dias` : `${curto(title(c.nome))}: ${nome.toLowerCase()}`, { desfazer }); };
      // falta, atraso, atestado…: pede a justificativa (pode deixar para depois) e segue para o substituto
      if (JUS_CODS.includes(v) && gravar(dt)) return pedirJus({ formSheet, nome: title(c.nome), dt, cod: v, atual: antes[0][2].jus, ocorr: ocorrOpc(c, v), salvar: j => salvarJus(c, dias, j), depois: segue });
      if (AUS_COBRIVEL.has(v) && gravar(dt)) return passoCobertura(c, dt, dias, desfazer, fimToque);
      if (v === 'HE') return passoHE(c, dias, desfazer, fimToque);
      toast(dias.length > 1 ? `${curto(title(c.nome))}: ${nome.toLowerCase()} em ${dias.length} dias` : `${curto(title(c.nome))}: ${nome.toLowerCase()}`, { desfazer });
    }
  });
}
// Depois de uma ausência: quem cobre (opcional). Se quem cobre está de folga pela escala, vira hora extra.
function passoCobertura(c, dt, dias, desfazerBase, fimToque) {
  const id = c.id;
  formSheet('Quem vai cobrir?', `${esc(title(c.nome))} · ${SIT_NOME[DB.sit(id + '|' + dt)] || 'ausência'} ${dias.length > 1 ? `de ${ddmm(dt)} a ${ddmm(dias[dias.length - 1])}` : `em ${ddmm(dt)}`} · opcional`,
    `<div class="sel"><span>Substituto</span>${campoBusca('spSub', cobertoPor(id, dt), opcoesSubst(c, dt), { placeholder: 'Digite o nome de quem substitui', vazio: '—' })}</div>
     <div id="spSubHe" hidden><p class="small m0">Está de folga pela escala: vira <b>hora extra</b>. A pedido de:</p><div class="mchips">${Object.entries(HE_ORIG).map(([k, n], i) => `<label class="mchip"><input type="radio" name="spHeo" value="${k}" ${i === 0 ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>`,
    'Confirmar substituto', async () => {
      const sid = $('spSub').value; if (!sid) { if (desfazerBase) toast('Lançado sem substituto', { desfazer: desfazerBase }); return; }
      const r = refSub(sid); const s = r.c; if (!s) throw new Error('Escolha o substituto da lista.'); const heOrig = (document.querySelector('input[name="spHeo"]:checked') || {}).value || 'DIKMA'; const feitos = [];
      for (const d of dias) { removerCobertura(id, d); DB.setSitExtra('cob', id + '|' + d, sid); if (folgaNoDia(sitDoSub(r, d))) { DB.setSit(r.id + '|' + d, 'HE', r.k); DB.setSitExtra('he', r.id + '|' + d, heOrig, r.k); feitos.push(d); } }
      DB.log(`${title(s.nome)}${r.outro ? ' (' + SETS[r.k].curto + ')' : ''} cobre ${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''}${feitos.length ? ` (hora extra a pedido da ${HE_ORIG[heOrig]})` : ''}`);
      fimToque();
      toast(`${curto(title(s.nome))} cobre ${curto(title(c.nome))}${feitos.length ? ' · hora extra ' + HE_ORIG[heOrig] : ''}`, { desfazer: () => { dias.forEach(d => removerCobertura(id, d)); if (desfazerBase) desfazerBase(); render(); } });
      // Virou hora extra: já pede o horário (senão cai em "Sem horário" no Banco de horas extras)
      if (feitos.length) setTimeout(() => horarioHE({ ...s, id: r.id }, feitos, fimToque, r.k), 350);
    });
  const cancelar = document.querySelector('#fSheet [data-close]'); if (cancelar) cancelar.textContent = 'Sem substituto';
  const mostrarHe = () => { const r = refSub($('spSub').value); $('spSubHe').hidden = !(r.c && dias.some(d => folgaNoDia(sitDoSub(r, d)))); };
  $('spSub').addEventListener('change', mostrarHe);
  setTimeout(() => { const q = $('spSub_q'); if (q) q.focus(); }, 60);
}
// Depois de uma hora extra: a pedido de quem
function passoHE(c, dias, desfazer, fimToque) {
  sheet('Hora extra a pedido de quem?', `${esc(title(c.nome))} · ${dias.length > 1 ? `${dias.length} dias` : ddmm(dias[0])}`, [...Object.entries(HE_ORIG).map(([k, n]) => ({ t: n, v: k })), { t: 'Não informar agora', v: '' }], o => {
    if (!o.v) { if (desfazer) toast('Hora extra lançada', { desfazer }); return; }
    dias.forEach(d => DB.setSitExtra('he', c.id + '|' + d, o.v)); DB.log(`${title(c.nome)} · hora extra ${ddmm(dias[0])} a pedido da ${HE_ORIG[o.v]}`); fimToque(); toast(`Hora extra · ${HE_ORIG[o.v]}`, desfazer ? { desfazer } : undefined); horarioHE(c, dias, fimToque);
  });
}

/* ---------------- MÓDULO ESCALA E EFETIVO ---------------- */
// Usa o conjunto (Pátio ou Bateria) escolhido no topo do módulo. Dados e permissões são os mesmos das atividades.
function dimRotas(area) {
  const rs = rotasDa(area); let def = 0, ausT = 0;
  const rows = rs.map(r => { const e = escalaRota(r, UI.ini); const dd = e.days.filter(d => d.prog > 0 && d.disp < d.nec).length; if (dd && r.rota !== 'GESTÃO') def++; ausT += e.days.reduce((n, d) => n + (d.aloc - d.disp), 0); return { r, e, dd }; });
  return { rs, rows, def, ausT };
}
function miniEscala(area) {
  const cs = colabsDa(area).filter(c => !desligadoNoDia(c, TODAY));
  // folga (da escala ou lançada) e férias não são ausência: só tiram a pessoa da escala do dia (contagemDia, situacao.js)
  const ct = contarDia(cs, TODAY); const fe = ct.folga, fer = ct.ferias, aus = ct.ausentes;
  const { def } = dimRotas(area);
  // letras de cada turno hoje, separadas em dia e noite
  const ciclos = Object.entries(escala().regimes).filter(([, r]) => r.tipo === 'ciclo').map(([k, r]) => ({ k, nome: k, tp: escala().turmasPeriodo(k, TODAY) })).filter(x => x.tp.D.length || x.tp.N.length);
  // presentes hoje por período (só quem está em turno)
  const perHoje = ct.periodo;
  return `${ciclos.length ? `<div class="hojeturma"><span class="muted small">Trabalham hoje:</span>${ciclos.map(x => `<span class="tchip">${esc(x.nome)}${x.tp.D.length ? ` · <i class="peri D">D</i> dia ${x.tp.D.join(' ')}` : ''}${x.tp.N.length ? ` · <i class="peri N">N</i> noite ${x.tp.N.join(' ')}` : ''}</span>`).join('')}${[0, 6].includes(pd(TODAY).getDay()) || escala().feriados.has(TODAY) ? '<span class="tchip mut">ADM de folga</span>' : '<span class="tchip">ADM</span>'}</div>` : ''}<div class="mini"><div><b class="num">${cs.length}</b><span>No quadro</span></div><div><b class="num">${cs.length - fe - fer}</b><span>Escalados hoje</span></div><div><b class="num">${cs.length - fe - fer - aus}</b><span>Presentes hoje</span></div>${perHoje.D + perHoje.N ? `<div><b class="num">${perHoje.D}<small class="perx"> · ${perHoje.N}</small></b><span>Turno dia · noite</span></div>` : ''}<div><b class="num" style="color:${aus ? 'var(--st-nreal)' : 'inherit'}">${aus}</b><span>Ausentes hoje</span></div>${fer ? `<div><b class="num">${fer}</b><span>De férias</span></div>` : ''}<div><b class="num" style="color:${def ? 'var(--st-nreal)' : 'inherit'}">${def}</b><span>Rotas com déficit na semana</span></div></div>`;
}
// Regime e turma da pessoa; quem pode mexer no cadastro toca para escolher a letra.
// Turma de quem trabalha em turno: grava no cadastro das rotas (quem administra Pátio/Bateria).
const podeTurma = () => admDe('ativ');
function turmaTag(c) {
  const rg = regimeDe(c); const r = escala().regimes[rg]; const t = turmaDe(c);
  if (!r || r.tipo !== 'ciclo') return esc(regimeNome(c));
  const txt = t ? `${esc(r.nome)} · turma <b>${esc(t)}</b>` : `${esc(r.nome)} · <span class="semt">sem turma</span>`;
  return podeTurma() ? `<button class="btn ghost link turma-b" data-turma="${esc(c.id)}" title="Escolher a turma">${txt}</button>` : txt;
}
export function turmaSheet(id) {
  const c = COLABS.find(x => x.id === id); if (!c) return;
  const rg = regimeDe(c); const r = escala().regimes[rg]; if (!r || r.tipo !== 'ciclo') return;
  const letras = Object.keys(r.turmas || {}); const atual = turmaDe(c);
  const prox = l => { const ds = []; for (let i = 0; i < 8; i++) { const d = add(TODAY, i); const p = escala().previsto(rg, l, d); ds.push(p ? (p.trab ? '●' : '○') : '?'); } return ds.join(' '); };
  sheet(`Turma de ${title(c.nome)}`, `${esc(r.nome)} · ● trabalha ○ folga, a partir de hoje`, [...letras.map(l => ({ t: `Turma ${l}`, d: prox(l), v: l, cur: l === atual })), { t: 'Sem turma', d: 'A folga não é marcada sozinha', v: '' }], o => {
    const itens = (DB.cache.colabs[c.area] || []).map(x => (x.id === c.id ? { ...x, turma: o.v } : x));
    DB.salvarColabsArea(c.area, itens); DB.log(`${title(c.nome)} · turma ${o.v || 'removida'}`); toast(o.v ? `${title(c.nome).split(' ')[0]}: turma ${o.v}` : 'Turma removida'); render();
  });
}
// Abre Pessoas no turno (Presença do dia) no conjunto atual, já na rota (area|rota) quando vier de um link.
export function irEscala(rota) {
  // A Presença do dia fica na Operação (vem do Dimensionamento e do Balanço, na Gestão, no mesmo conjunto).
  if (!setsDe(ME, 'operacao').includes(SK)) return;
  UI.esSet = SK; UI.modulo = 'operacao'; UI.modOpen = false; aplicarSet(); UI.view = 'esdia'; UI.eRota = rota || '*'; UI.eQ = ''; UI.confirm = null;
  salvarUI(); trocarTela(UI.view);
}
export function vEsDim() {
  const area = areaScope(); const { rows, def } = dimRotas(area);
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  // Faixa só com os números desta aba (a faixa completa do Efetivo fica no Efetivo diário)
  const op = rows.filter(x => x.r.rota !== 'GESTÃO'); const kh = tk.indexOf(true);
  const diasDef = op.reduce((n, x) => n + x.dd, 0);
  const hj = kh >= 0 ? op.reduce((a, x) => ({ disp: a.disp + x.e.days[kh].disp, nec: a.nec + x.e.days[kh].nec }), { disp: 0, nec: 0 }) : null;
  const band = M.faixa([{ r: 'Rotas', v: op.length, s: area === 'TODAS' ? 'todas as áreas' : AREA_S[area] }, { r: 'Com déficit na semana', v: def, tom: def ? 'bad' : 'ok', s: def ? 'faltam pessoas em algum dia' : 'nenhuma rota em falta' }, { r: 'Adequadas', v: op.length - def, s: 'todos os dias cobertos' }, { r: 'Dias com déficit', v: diasDef, tom: diasDef ? 'warn' : '', s: 'somando todas as rotas' }, hj && { r: 'Hoje · disponíveis / necessários', v: `${hj.disp}/${hj.nec}`, tom: hj.disp < hj.nec ? 'bad' : '', s: ddmm(TODAY) }]);
  // Celular: primeiro só as rotas com déficit (o que pede ação); as adequadas aparecem num toque.
  const curto = isMobile() && !UI.more, vis = curto ? rows.filter(x => x.dd) : rows, ocultas = rows.length - vis.length;
  const maisDim = ocultas ? `<div class="body"><button class="btn center" data-act="more" data-n="1">Mostrar ${vis.length ? 'também ' : ''}as ${ocultas} rotas sem déficit</button></div>` : '';
  return band + `<div class="card"><header><h2>Dimensionamento por rota</h2><p>Disponíveis / necessários por dia · toque na rota para ver as pessoas</p></header><div class="body pt0 pb0"><details class="calc"><summary>Como é calculado</summary><p>Necessário = efetivo padrão × atividades do dia ÷ carga padrão (em rota de turno, só a parte do quadro que trabalha por dia).</p><p>Disponível já desconta a folga da escala. Em rota de turno, D e N mostram quantos estão de dia e de noite (em vermelho quando um dos turnos fica sem ninguém).</p></details></div><div class="tw"><table class="dimt tcard"><thead><tr><th>Rota</th>${area === 'TODAS' ? '<th>Área</th>' : ''}<th class="r">Ef. padrão</th><th class="r">Carga</th>${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${d}<br><span class="thd">${ddmm(add(UI.ini, k))}</span></th>`).join('')}<th>Situação</th></tr></thead><tbody>
  ${vis.map(({ r, e, dd }) => `<tr><td class="tc-t"><button class="btn ghost link" data-goescala="${esc(r.area + '|' + r.rota)}">${esc(r.rota)}</button></td>${area === 'TODAS' ? `<td class="muted tc-s">${AREA_S[r.area]}</td>` : ''}<td class="r num dimn" data-l="Ef. padrão">${r.ef}</td><td class="r num dimn" data-l="Carga">${r.carga}</td>${e.days.map((d, k) => `<td class="c dimd ${tk[k] ? 'today' : ''}" data-l="${DL[k]} ${add(UI.ini, k).slice(8)}"><span class="cell num ${!d.prog && r.rota !== 'GESTÃO' ? 'neu' : d.disp < d.nec ? 'bad' : 'ok'}" title="${d.prog} atividades · ${d.aloc} alocados · ${d.aloc - d.disp} ausentes${d.dispD + d.dispN ? ` · turno: ${d.dispD} de dia e ${d.dispN} de noite` : ''}">${d.disp}/${d.nec}</span>${d.dispD + d.dispN ? `<small class="dnx${(d.dispD === 0 || d.dispN === 0) && d.prog ? ' bad' : ''}">D${d.dispD} · N${d.dispN}</small>` : ''}</td>`).join('')}<td class="dimsit">${r.rota === 'GESTÃO' ? '<span class="pill neu">Gestão</span>' : dd ? `<span class="pill bad" title="Faltam pessoas em ${dd} ${dd > 1 ? 'dias' : 'dia'} da semana">Déficit · ${dd} ${dd > 1 ? 'dias' : 'dia'}</span>` : '<span class="pill ok">Adequado</span>'}</td></tr>`).join('')}
  </tbody></table></div>${curto && !vis.length ? '<div class="body"><div class="empty">Nenhuma rota com déficit nesta semana.</div></div>' : ''}${maisDim}</div>`;
}
export function vEsBal() {
  const area = areaScope();
  // quem tem alguma ausência na semana, com os dias
  const cs = colabsDa(area);
  const ehAus = y => !y.auto && AUSENCIA.has(y.v); // só ausência de verdade (folga e férias ficam de fora)
  const sem = cs.map(c => ({ c, d: DAYS.map((_, k) => sitDia(c, add(UI.ini, k))) })).filter(x => x.d.some(ehAus)).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  const mob = isMobile();
  return `<div class="grid2 g-ef">${cardAusencias(area)}${cardBalanco(area, UI.ini)}</div>
  <div class="card"><header><h2>Ausências da semana</h2><p>${weekLabel(UI.ini)} · ${sem.length} pessoa${sem.length === 1 ? '' : 's'} com alguma ausência (folga e férias não entram)</p></header>${sem.length ? `<div class="tw"><table class="efd${mob ? ' efmob' : ''}"><thead><tr><th>Colaborador</th>${mob ? '' : '<th>Rota</th>'}${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(UI.ini, k).slice(8)}</span></th>`).join('')}</tr></thead><tbody>
    ${sem.map(x => `<tr><td><button class="btn ghost link" data-goescala="${esc(x.c.area + '|' + x.c.rota)}"><b>${esc(title(x.c.nome))}</b></button>${mob ? `<div class="muted small">${esc(x.c.rota)}</div>` : ''}</td>${mob ? '' : `<td class="muted small">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</td>`}${x.d.map((y, k) => `<td class="c ${tk[k] ? 'today' : ''}">${ehAus(y) ? `<span class="sit ${y.v} ro" title="${SIT_NOME[y.v] || y.v}">${y.v}</span>` : '<span class="muted" aria-hidden="true">·</span>'}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>` : '<div class="body"><div class="empty">Ninguém ausente nesta semana.</div></div>'}</div>`;
}
// Líder de cada pessoa das Atividades, pela ficha do Efetivo (só para quem tem as fichas). Nomes do mesmo líder viram um só.
let LIDc = null, LIDk = null;
function liderDosColabs() {
  const fichas = (temFichas(ME) && DB.cache.g && DB.cache.g.colabs) || []; if (!fichas.some(f => f.lider)) return null;
  if (LIDc && LIDk === fichas) return LIDc;
  const canon = canonLideres(fichas.map(f => f.lider).filter(Boolean), fichas); const busca = buscaNomes(fichas); const m = new Map();
  // grupo = o líder (chave do RH); o nome mostrado é o mais completo como foi escrito nas fichas
  const graf = new Map(); for (const f of fichas) if (f.lider) { const k = canon(f.lider), g = canon.grafia(f.lider); if (!graf.has(k) || g.length > graf.get(k).length) graf.set(k, g); }
  LIDk = fichas; LIDc = c => { if (!m.has(c.id)) { const r = busca(c.nome, c.mat); const k = r && r.item.lider ? canon(r.item.lider) : ''; m.set(c.id, k ? graf.get(k) || k : ''); } return m.get(c.id); };
  return LIDc;
}
/* ---------------- CHECK-IN DO TURNO ---------------- */
// O líder confirma a equipe no início do turno (dia, noite ou administrativo): presente, falta ou atraso, um toque por pessoa.
// Vira a presença do dia (o mesmo Efetivo diário) e fica registrado quem confirmou e a que horas.
export const PER_NOME = { D: 'Turno diurno', N: 'Turno noturno', ADM: 'Administrativo' };
// k = conjunto (Pátio ou Bateria); sem k, o conjunto aberto. Líder e supervisor fazem o check-in das áreas deles.
export function equipeCheckin(k = SK) {
  const areas = ME && ['lider', 'supervisor'].includes(perfil('operacao')) ? areasSitDe(k) : []; const out = [];
  const sitK = c => (k === SK ? sitDia(c, TODAY) : sitTela(situacaoDoDia(c, TODAY, fontesSit(key => sitDoSet(k, key)))));
  const ckMes = k === SK ? (DB.sitExtraMes(TODAY.slice(0, 7)).ck || {}) : ((((DB.dados(k) || {}).sitExtra || {})[TODAY.slice(0, 7)] || {}).ck || {});
  const lista = k === SK ? COLABS : colabsDoSet(k);
  for (const a of areas) {
    const g = {};
    for (const c of lista.filter(c => c.area === a)) { const x = sitK(c); if (x.auto || ['F', 'FE', 'DS'].includes(x.v)) continue; const per = x.periodo || 'ADM'; (g[per] = g[per] || []).push({ c, v: x.v }); }
    for (const per of ['D', 'N', 'ADM']) if (g[per]) out.push({ a, per, ps: g[per].sort((x, y) => x.c.nome.localeCompare(y.c.nome)), ck: ckMes[`ck|${TODAY}|${a}|${per}`] || '' });
  }
  return out;
}
function cardCheckin() {
  const gs = equipeCheckin(); if (!gs.length) return '';
  const tom = v => (v === 'FT' ? 'bad' : PARCIAL.has(v) ? 'warn' : AUSENCIA.has(v) ? 'neu' : 'ok');
  return `<div class="card checkin"><header><h2>Check-in do turno</h2><p>${ddmm(TODAY)} · confirme quem está na equipe: presente, falta ou atraso</p></header><div class="body stackcol">${gs.map(g => {
    const [por, nome, hora, conta] = g.ck.split('|');
    if (g.ck) return `<div class="ckok"><span class="pill ok">✓</span> <b>${PER_NOME[g.per]}</b> · ${AREA_S[g.a]} · check-in às ${esc(hora || '')} por ${esc(nome || '')}${conta ? ` · ${esc(conta)} presentes` : ''} <button class="btn ghost link" data-ckre="${esc(g.a)}|${g.per}">refazer</button></div>`;
    const pres = g.ps.filter(x => !AUSENCIA.has(x.v) && !PARCIAL.has(x.v)).length;
    return `<div class="ckg"><div class="row-between"><b>${PER_NOME[g.per]} · ${AREA_S[g.a]}</b><span class="row-gap"><span class="muted small">${pres} de ${g.ps.length} presentes</span><button class="btn sm pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar</button></span></div><div class="plist">${g.ps.map(x => `<div class="pitem"><div class="minw"><div class="t">${esc(title(x.c.nome))}</div><div class="l">${esc(x.c.rota)}${turmaDe(x.c) ? ' · turma ' + esc(turmaDe(x.c)) : ''}</div></div><div class="bt ckbt"><button class="btn sm ${x.v === 'P' || x.v === 'HE' ? 'on ok' : ''}" data-ck="${esc(x.c.id)}|P" aria-pressed="${x.v === 'P' || x.v === 'HE'}">Presente</button><button class="btn sm ${x.v === 'ATR' ? 'on warn' : ''}" data-ck="${esc(x.c.id)}|ATR" aria-pressed="${x.v === 'ATR'}">Atraso</button><button class="btn sm ${x.v === 'FT' ? 'on bad' : ''}" data-ck="${esc(x.c.id)}|FT" aria-pressed="${x.v === 'FT'}">Falta</button>${!['P', 'HE', 'ATR', 'FT'].includes(x.v) ? `<span class="pill ${tom(x.v)}">${SIT_NOME[x.v] || x.v}</span>` : ''}</div></div>`).join('')}</div><button class="btn pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar check-in · ${pres} de ${g.ps.length} presentes</button></div>`;
  }).join('')}</div></div>`;
}
export function vEsDia() {
  const area = areaScope();
  const rs = rotasDa(area);
  const tk = DAYS.map((_, k) => add(UI.ini, k) === TODAY);
  const opts = rs.map(r => r.area + '|' + r.rota);
  if (UI.eRota !== '*' && !opts.includes(UI.eRota)) UI.eRota = '*';
  // Busca: com texto, mostra quem casar em todas as rotas da área escolhida no topo.
  const q = UI.eQ || '';
  const kC = c => semAcento([c.nome, c.funcao, c.rota, c.regime, AREA_S[c.area]].filter(Boolean).join(' '));
  const todas = UI.eRota === '*' || UI.eAgr === 'lider' || UI.eAgr === 'periodo' || UI.eAgr === 'gestao' || !!q.trim();
  const ordem = new Map(rs.map((r, i) => [r.area + '|' + r.rota, i]));
  // Agrupar por rota (padrão) ou por líder (o líder vem da ficha do Efetivo; nomes do mesmo líder viram um só)
  const lid = liderDosColabs(); const porLider = UI.eAgr === 'lider' && !!lid;
  // Período de hoje (turno diurno, noturno, administrativo, fora): quem trabalha de dia e quem trabalha de noite
  const porPer = UI.eAgr === 'periodo'; const porGrupo = porLider || porPer;
  // Gestão: coordenador, supervisores, líderes e técnicos de segurança saem das rotas e ficam juntos no topo; o resto segue por rota
  const porGestao = UI.eAgr === 'gestao';
  const nivelG = c => { const f = semAcento(c.funcao || '').toUpperCase(); return /COORDEN/.test(f) ? 1 : /SUPERVIS/.test(f) ? 2 : /LIDER/.test(f) ? 3 : /SEGURANCA|\bTST\b/.test(f) && /TEC/.test(f) ? 4 : 0; };
  const dRef = tk.includes(true) ? TODAY : UI.ini;
  const grpPer = c => { const s = sitDia(c, dRef); if (s.v === 'DS') return '5|Desligados'; if (s.auto || s.v === 'F' || s.v === 'FE') return '4|Folga ou férias'; const pr = periodoDe(c, dRef); if (pr) return pr === 'N' ? '2|Turno noturno' : '1|Turno diurno'; return escala().regimes[regimeDe(c)] && escala().regimes[regimeDe(c)].tipo === 'ciclo' ? '3|Turno sem turma' : '0|Administrativo'; };
  // Gestão mostra só a gestão; Rota mostra só o pessoal das rotas (a gestão fica na opção Gestão). Busca, período e líder mostram todos.
  const porRota = !q.trim() && !porGrupo && !porGestao;
  let cs = q.trim() ? colabsDa(area).filter(c => casa(kC(c), q)) : UI.eRota === '*' || porGrupo || porGestao ? colabsDa(area) : COLABS.filter(c => c.area + '|' + c.rota === UI.eRota);
  if (porGestao && !q.trim()) cs = cs.filter(c => nivelG(c)); else if (porRota) cs = cs.filter(c => !nivelG(c));
  const gk = c => (porPer ? grpPer(c) : porLider ? 'L|' + (lid(c) || '~') : porGestao && nivelG(c) ? 'G|' + nivelG(c) : c.area + '|' + c.rota);
  const NOME_G = { 1: 'COORDENAÇÃO', 2: 'SUPERVISÃO', 3: 'LIDERANÇA', 4: 'SEGURANÇA DO TRABALHO' };
  cs = cs.slice().sort((x, y) => porGestao ? (!nivelG(x) - !nivelG(y)) || (nivelG(x) && nivelG(y) ? nivelG(x) - nivelG(y) : (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999)) || x.nome.localeCompare(y.nome) : porGrupo ? gk(x).localeCompare(gk(y)) || x.nome.localeCompare(y.nome) : (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999) || x.nome.localeCompare(y.nome));
  // rodapé: presentes / escalados de cada dia (a mesma conta do topo e dos grupos; férias e folga lançada saem do total)
  const ctDia = DAYS.map((_, k) => contarDia(cs, add(UI.ini, k)));
  const pres = ctDia.map(x => x.presentes), quadro = ctDia.map(x => x.escalados);
  const celula = (c, k) => {
    const dt = add(UI.ini, k); const x = sitDia(c, dt); const v = x.v; const ed = canEditSit(c.area);
    const inf = DB.sitInfo(c.id + '|' + dt); const cob = !x.auto && AUS_COBRIVEL.has(v) ? inf.cob : ''; const cobre = cobrindo(c.id, dt);
    const per = ['P', 'ATR', 'SA', 'HE'].includes(v) ? periodoDe(c, dt) : '';
    const jus = !x.auto && JUS_CODS.includes(v) ? inf.jus : null; const semJus = !x.auto && JUS_CODS.includes(v) && !(jus && jus.cod === v) && dt <= TODAY;
    const tt = (x.auto ? `Folga pela escala (${x.motivo})` : SIT_NOME[v] || v) + (jus && jus.cod === v ? ` · ${textoJus(jus)}` : semJus ? ' · sem justificativa' : '') + (per ? ` · turno ${PERIODO[per].toLowerCase()}` : '') + (v === 'HE' && inf.he ? ` a pedido da ${HE_ORIG[inf.he]}` : '') + (v === 'HE' && inf.hed ? ' · ' + textoHE(inf.hed) : '') + (cob ? ` · coberto por ${nomeDe(cob)}` : (!x.auto && AUS_COBRIVEL.has(v) ? ' · sem substituto' : '')) + (cobre ? ` · cobrindo ${nomeDe(cobre)}` : '');
    return `<td class="c ${tk[k] ? 'today' : ''}"><button class="sit ${v}${x.auto ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}${cob || cobre ? ' cobm' : ''}${semJus ? ' semjus' : ''}" ${ed ? `data-sit="${c.id}|${dt}"` : 'disabled'} aria-label="${esc(title(c.nome))}, ${DAYS[k]} ${ddmm(dt)}: ${esc(tt)}" title="${esc(tt)}">${v === 'P' ? I.ok : v}${v === 'HE' && inf.he ? `<sup>${HE_SIG[inf.he]}</sup>` : ''}${cob || cobre ? '<i class="cobi" aria-hidden="true">⇄</i>' : ''}${marcaPer(per)}</button></td>`;
  };
  // agrupa por rota quando mostra várias rotas; com muitas rotas, os grupos começam fechados (toque para abrir)
  let ant = '';
  const nGrupos = todas && !q.trim() ? new Set(cs.map(gk)).size : 0;
  const recolhe = nGrupos > 4;
  const efAb = new Set(UI.efAbertas || []);
  const linhas = cs.map(c => {
    const g = gk(c); let cab = '';
    const fechado = recolhe && !efAb.has(g);
    if (todas && !q.trim() && g !== ant) {
      ant = g; const doG = cs.filter(x => gk(x) === g);
      const rot = porPer ? `${g.slice(2)}${['1', '2'].includes(g[0]) ? ` · turma ${[...new Set(doG.map(x => turmaDe(x)).filter(Boolean))].sort().join(', ')}` : ''}` : porLider ? (g === 'L|~' ? 'Sem líder na ficha' : 'LÍDER ' + g.slice(2)) : g.startsWith('G|') ? NOME_G[g.slice(2)] : c.rota; const kh = DAYS.findIndex((_, k) => tk[k]);
      const ctG = kh >= 0 ? contarDia(doG, TODAY) : null;
      const ph = ctG ? ctG.presentes : null;
      const eh = ctG ? ctG.escalados : null; // folga e férias não contam como escalado
      cab = `<tr class="grp-row"><th colspan="${isMobile() ? 8 : 9}">${recolhe ? `<button type="button" class="efg${fechado ? '' : ' on'}" data-efg="${esc(g)}" aria-expanded="${!fechado}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(rot)}</b>${area === 'TODAS' && !porGrupo && !g.startsWith('G|') && !ehAreaGeral(c.area) ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}</button>` : porGrupo || porGestao ? `<b>${esc(rot)}</b>` : `<button class="btn ghost link" data-erota="${esc(g)}">${esc(c.rota)}</button>${area === 'TODAS' && !ehAreaGeral(c.area) ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}`}<span class="gcount">${porPer && g[0] >= '4' ? `${doG.length} pessoa${doG.length === 1 ? '' : 's'}` : ph != null ? `<b class="gp ${!eh ? 'neu' : ph >= eh ? 'ok' : ph ? 'warn' : 'bad'}">${ph}/${eh}</b> presentes hoje${(() => { if (porPer) return ''; const pp = ctG.periodo; return pp.D + pp.N ? ` (${pp.D} dia · ${pp.N} noite)` : ''; })()}${doG.length > eh ? ` · ${doG.length - eh} de folga` : ''}` : `${doG.length} pessoa${doG.length > 1 ? 's' : ''}`}</span></th></tr>`;
    }
    if (fechado) return cab;
    return cab + `<tr><td class="fnome"><b>${esc(title(c.nome))}</b><div class="muted small">${q.trim() || porGrupo || (porGestao && nivelG(c)) ? `${esc(c.rota)}${area === 'TODAS' && !ehAreaGeral(c.area) ? ' · ' + AREA_S[c.area] : ''} · ` : ''}${turmaTag(c)}${isMobile() && c.funcao ? ' · ' + esc(title(c.funcao)) : ''}</div></td>${isMobile() ? '' : `<td class="muted small">${esc(title(c.funcao))}</td>`}${DAYS.map((_, k) => celula(c, k)).join('')}</tr>`;
  }).join('');
  // No celular a faixa do Efetivo fica compacta (4 à vista) e os turnos de hoje numa linha que desliza, para a lista subir.
  const faixaEf = miniEscala(area).replace('<div class="hojeturma">', '<div class="hojeturma scrollx">').replace('<div class="mini">', '<div class="mini compacta">');
  return faixaEf + (tk.includes(true) ? cardCheckin() : '') + `<div class="card efcard"><header><h2>Presença do dia</h2><p>${canEditSit(area === 'TODAS' ? (myArea() || AREAS[0]) : area) ? 'Toque no dia para mudar a situação · ✓ = presente' : 'Somente leitura'}</p></header>
  <div class="body lbar efbar efbar1">${caixaBusca('fEQ', q, 'Buscar colaborador, função ou rota')}${q.trim() ? `<span class="muted small"><b>${cs.length}</b> encontrado${cs.length === 1 ? '' : 's'} em ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span><button class="btn sm ghost" data-act="limparEQ">Limpar busca</button>` : `<label class="sel"><span>Agrupar por</span><select class="in" id="fEAgr"><option value="rota" ${!porGrupo && !porGestao ? 'selected' : ''}>Rota</option><option value="gestao" ${porGestao ? 'selected' : ''}>Gestão (${colabsDa(area).filter(c => nivelG(c)).length} pessoas)</option><option value="periodo" ${porPer ? 'selected' : ''}>Dia e noite (${dRef === TODAY ? 'hoje' : ddmm(dRef)})</option>${lid ? `<option value="lider" ${porLider ? 'selected' : ''}>Líder</option>` : ''}</select></label>${porGrupo || porGestao ? '' : `<label class="sel efrota"><span>Rota</span><select class="in" id="fERota"><option value="*" ${UI.eRota === '*' ? 'selected' : ''}>Todas as rotas (${colabsDa(area).filter(c => !nivelG(c)).length} pessoas)</option>${rs.map(r => `<option value="${esc(r.area + '|' + r.rota)}" ${r.area + '|' + r.rota === UI.eRota ? 'selected' : ''}>${esc(r.rota)}${area === 'TODAS' ? ' · ' + AREA_S[r.area] : ''}</option>`).join('')}</select></label>`}`}${!framed && !isMobile() ? `<button class="btn sm" data-act="expEsdia" title="A semana inteira, de todas as rotas da área escolhida" style="margin-left:auto">${I.dl} Exportar semana</button>` : ''}</div>
  ${recolhe ? `<div class="body pt0 pb0 efabre"><button class="btn ghost link" data-act="efTodas">${efAb.size ? (porGrupo ? 'Recolher todos os grupos' : 'Recolher todas as rotas') : (porGrupo ? 'Abrir todos os grupos' : 'Abrir todas as rotas')}</button><span class="muted small">${nGrupos} ${porGrupo ? 'grupos · toque num grupo' : 'rotas · toque numa rota'} para ver as pessoas</span></div>` : ''}
  <details class="legdet body pb0 pt0"><summary>Legenda das siglas</summary><div class="legend sitleg"><span><span class="sit P">${I.ok}</span> Presente</span><span><span class="sit F auto">F</span> Folga pela escala</span><span><span class="sit FT cobm">FT<i class="cobi">⇄</i></span> Com substituto</span><span><span class="sit P">${I.ok}${marcaPer('D')}</span> Turno diurno</span><span><span class="sit P">${I.ok}${marcaPer('N')}</span> Turno noturno (conta no dia em que começa)</span><span><span class="sit HE">HE<sup>D</sup></span> Hora extra (D Dikma · A ArcelorMittal)</span>${SITS.filter(s => s[0] !== 'P').map(s => `<span><span class="sit ${s[0]}">${s[0]}</span> ${s[1]}</span>`).join('')}<span><span class="sit FT semjus">FT</span> Sem justificativa: toque para justificar</span></div></details>
  <div class="tw"><table class="efd${isMobile() ? ' efmob' : ''}"><thead><tr><th>Colaborador</th>${isMobile() ? '' : '<th>Função</th>'}${DAYS.map((d, k) => `<th class="c ${tk[k] ? 'today' : ''}">${DL[k]}<br><span class="thd">${add(UI.ini, k).slice(8)}</span></th>`).join('')}</tr></thead><tbody>
  ${cs.length ? linhas : `<tr><td colspan="${isMobile() ? 8 : 9}" class="empty">${q.trim() ? 'Ninguém encontrado com essa busca.' : 'Nenhum colaborador nesta rota.'}</td></tr>`}
  </tbody>${cs.length ? `<tfoot><tr><th colspan="${isMobile() ? 1 : 2}">Presentes</th>${DAYS.map((_, k) => `<td class="c num ${tk[k] ? 'today' : ''}"><b class="${pres[k] < quadro[k] ? 'menos' : quadro[k] ? 'cheio' : ''}">${pres[k]}</b><span class="muted">/${quadro[k]}</span></td>`).join('')}</tr></tfoot>` : ''}</table></div></div>`;
}
// Efetivo diário da semana (área escolhida no topo, todas as rotas) para o Excel: o mesmo código que aparece na tela.
function exportEsdia() {
  const area = areaScope(); const dias = DAYS.map((_, k) => add(UI.ini, k));
  const ordem = new Map(rotasDa(area).map((r, i) => [r.area + '|' + r.rota, i]));
  const cs = colabsDa(area).slice().sort((x, y) => (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999) || x.nome.localeCompare(y.nome));
  const linhas = [['Nome', 'Função', 'Área', 'Rota', 'Regime', 'Turma', ...dias.map((d, k) => `${DAYS[k]} ${dataBR(d).slice(0, 5)}`), 'Ausências na semana']];
  for (const c of cs) { const v = dias.map(d => sitDia(c, d).v); linhas.push([title(c.nome), c.funcao || '', AREA_S[c.area] || c.area, c.rota, regimeNome(c), turmaDe(c) || '', ...v, v.filter(x => AUSENCIA.has(x)).length]); }
  const leg = [['Código', 'Significado'], ...SITS];
  const jl = [['Nome', 'Rota', 'Data', 'Situação', 'Motivo', 'Chegada', 'Minutos de atraso', 'Observação', 'Registrado por']];
  for (const c of cs) for (const d of dias) { const x = sitDia(c, d); if (x.auto || !JUS_CODS.includes(x.v)) continue; const j = DB.sitInfo(c.id + '|' + d).jus; const ok = j && j.cod === x.v; jl.push([title(c.nome), c.rota, dataBR(d), SIT_NOME[x.v], ok ? j.mot : 'Sem justificativa', ok ? j.chegada || '' : '', ok ? j.min || '' : '', ok ? j.obs || '' : '', ok ? j.nomePor || '' : '']); }
  baixarExcel(`efetivo-${SETS[SK].curto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}-${UI.ini}`, [{ nome: 'Efetivo ' + dataBR(UI.ini).slice(0, 5).replace('/', '-'), linhas }, { nome: 'Justificativas', linhas: jl }, { nome: 'Legenda', linhas: leg }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
acoes.limparEQ = (t, d) => { UI.eQ = ''; render(); { const n = $('fEQ'); if (n) n.focus(); } };
acoes.efTodas = (t, d) => { const ks = [...document.querySelectorAll('[data-efg]')].map(b => b.dataset.efg); UI.efAbertas = (UI.efAbertas || []).length ? [] : ks; render(); };
acoes.expEsdia = (t, d) => { exportEsdia(); };
