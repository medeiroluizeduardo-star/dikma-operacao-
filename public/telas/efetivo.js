// Telas do Efetivo (escala e presença): cartões de ausências e balanço, Escala do dia (antiga Escala do dia), check-in
// do turno, lançamento da situação do dia com substituto, Mover de rota no dia, Dimensionamento e Balanço.
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
import { escala, comTurma, turmaDe, regimeDe, regimeNome, sitDia, fontesSit, sitTela, desligadoNoDia, contarDia, periodoDe, marcaPer, folgaEscala, escalaRota, SIT_NOME, SIT_TOM, colabsDa, HE_ORIG, HE_SIG, cobDoDia, cobertoPor, cobrindo, refSub, sitDoSub, folgaNoDia, nomeDe, curto, removerCobertura, areasSitDe, colabsDoSet, sitDoSet, movAprovDia, movDoDia, movDe, colabsDaNoDia } from '../calc/presenca.js';
import { pedirMov, decidirMov, podePedir, podeAprovar, partesRota, rotaK } from '../contas/mover-rota.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, isMobile, trocarTela } from '../ui/shell.js';
import { ocorrOpc, salvarJus, textoHE, horarioHE } from './horas-justificativas.js';
import { estadoEf, podeEf, travadoEf, ultimaEf, horaEf } from '../contas/efetivo-dia.js';
import { editaAdm } from '../contas/acessos.js';
import { etiqueta, botaoAcao } from '../ui/padrao.js';

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
    const dt = add(ini, k); const quadro = colabsDaNoDia(area, dt).filter(c => !desligadoNoDia(c, dt));
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
  if (!editaDia(c.area, dt)) { toast('Este dia já foi validado pelo RH. Para mudar, o administrador reabre o dia.'); return; }
  const sx = sitDia(c, dt); const info = DB.sitInfo(key); const cobre = cobrindo(id, dt);
  const prev = escala().previsto(regimeDe(c, dt), turmaDe(c, dt), dt);
  const linha = prev ? (prev.trab ? `Pela escala: trabalha${turmaDe(c, dt) ? ` (turma ${esc(turmaDe(c, dt))})` : ''}` : `Pela escala: folga (${esc(prev.motivo)})`) : 'Sem turma: a escala não marca folga sozinha';
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
      if (v === 'semcob') { removerCobertura(id, dt); DB.log(`${title(c.nome)} · ${ddmm(dt)} sem substituto`, 'operacao'); fimToque(); toast('Substituto removido'); return; }
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
      DB.log(`${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''} → ${nome}`, 'operacao');
      const desfazer = () => { antes.forEach(([d, x, inf]) => { DB.setSit(id + '|' + d, x); (DB.setSitExtra('he', id + '|' + d, inf.he || null), DB.setSitExtra('hed', id + '|' + d, inf.hed || null), DB.setSitExtra('jus', id + '|' + d, inf.jus || null)); }); DB.log(`${title(c.nome)} · desfez a mudança de ${ddmm(dt)}`, 'operacao'); render(); };
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
      DB.log(`${title(s.nome)}${r.outro ? ' (' + SETS[r.k].curto + ')' : ''} cobre ${title(c.nome)} · ${ddmm(dt)}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''}${feitos.length ? ` (hora extra a pedido da ${HE_ORIG[heOrig]})` : ''}`, 'operacao');
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
    dias.forEach(d => DB.setSitExtra('he', c.id + '|' + d, o.v)); DB.log(`${title(c.nome)} · hora extra ${ddmm(dias[0])} a pedido da ${HE_ORIG[o.v]}`, 'operacao'); fimToque(); toast(`Hora extra · ${HE_ORIG[o.v]}`, desfazer ? { desfazer } : undefined); horarioHE(c, dias, fimToque);
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
  return `${ciclos.length ? `<div class="hojeturma"><span class="muted small">Trabalham hoje:</span>${ciclos.map(x => `<span class="tchip">${esc(x.nome)}${x.tp.D.length ? ` · <i class="peri D">D</i> dia ${x.tp.D.join(' ')}` : ''}${x.tp.N.length ? ` · <i class="peri N">N</i> noite ${x.tp.N.join(' ')}` : ''}</span>`).join('')}${[0, 6].includes(pd(TODAY).getDay()) || escala().feriados.has(TODAY) ? '<span class="tchip mut">ADM de folga</span>' : '<span class="tchip">ADM</span>'}</div>` : ''}<div class="mini"><div><b class="num">${cs.length}</b><span>No quadro</span></div><div><b class="num">${cs.length - fe - fer}</b><span>Escalados hoje</span></div><div><b class="num">${cs.length - fe - fer - aus}</b><span>Presentes hoje</span></div><div><b class="num" style="color:${aus ? 'var(--st-nreal)' : 'inherit'}">${aus}</b><span>Ausentes hoje</span></div>${perHoje.D + perHoje.N ? `<div><b class="num">${perHoje.D}<small class="perx"> · ${perHoje.N}</small></b><span>Turno dia · noite</span></div>` : ''}${fer ? `<div><b class="num">${fer}</b><span>De férias</span></div>` : ''}<div><b class="num" style="color:${def ? 'var(--st-nreal)' : 'inherit'}">${def}</b><span>Rotas com déficit na semana</span></div></div>`;
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
    const itens = (DB.cache.colabs[c.area] || []).map(x => (x.id === c.id ? comTurma(x, o.v) : x));
    DB.salvarColabsArea(c.area, itens); DB.log(`${title(c.nome)} · turma ${o.v || 'removida'}`, 'operacao'); toast(o.v ? `${title(c.nome).split(' ')[0]}: turma ${o.v}` : 'Turma removida'); render();
  });
}
// Abre Pessoas no turno (Escala do dia) no conjunto atual, já na rota (area|rota) quando vier de um link.
export function irEscala(rota) {
  // A Escala do dia fica na Operação (vem do Dimensionamento e do Balanço, na Gestão, no mesmo conjunto).
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
  const band = M.faixa([{ r: 'Com déficit na semana', v: def, tom: def ? 'bad' : 'ok', s: def ? 'faltam pessoas em algum dia' : 'nenhuma rota em falta' }, { r: 'Adequadas', v: op.length - def, s: 'todos os dias cobertos' }, { r: 'Dias com déficit', v: diasDef, tom: diasDef ? 'warn' : '', s: 'somando todas as rotas' }, hj && { r: 'Hoje · disponíveis / necessários', v: `${hj.disp}/${hj.nec}`, tom: hj.disp < hj.nec ? 'bad' : '', s: ddmm(TODAY) }, { r: 'Rotas', v: op.length, s: area === 'TODAS' ? 'todas as áreas' : AREA_S[area] }], 'compacta');
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
  const gs = equipeCheckin().filter(g => !travadoEf(DB.efDia(SK, TODAY, g.a))); if (!gs.length) return '';
  const tom = v => (v === 'FT' ? 'bad' : PARCIAL.has(v) ? 'warn' : AUSENCIA.has(v) ? 'neu' : 'ok');
  return `<div class="card checkin"><header><h2>Quem falta confirmar</h2><p>${ddmm(TODAY)} · marque falta ou atraso de quem não veio e confirme os presentes</p></header><div class="body stackcol">${gs.map(g => {
    const [por, nome, hora, conta] = g.ck.split('|');
    if (g.ck) return `<div class="ckok"><span class="pill ok">✓</span> <b>${PER_NOME[g.per]}</b> · ${AREA_S[g.a]} · confirmado às ${esc(hora || '')} por ${esc(nome || '')}${conta ? ` · ${esc(conta)} presentes` : ''} <button class="btn ghost link" data-ckre="${esc(g.a)}|${g.per}">refazer</button></div>`;
    const pres = g.ps.filter(x => !AUSENCIA.has(x.v) && !PARCIAL.has(x.v)).length;
    return `<div class="ckg"><div class="row-between"><b>${PER_NOME[g.per]} · ${AREA_S[g.a]}</b><span class="row-gap"><span class="muted small">${pres} de ${g.ps.length} presentes</span><button class="btn sm pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar todos os presentes</button></span></div><div class="plist">${g.ps.map(x => `<div class="pitem"><div class="minw"><div class="t">${esc(title(x.c.nome))}</div><div class="l">${esc(x.c.rota)}${turmaDe(x.c) ? ' · turma ' + esc(turmaDe(x.c)) : ''}</div></div><div class="bt ckbt"><button class="btn sm ${x.v === 'P' || x.v === 'HE' ? 'on ok' : ''}" data-ck="${esc(x.c.id)}|P" aria-pressed="${x.v === 'P' || x.v === 'HE'}">Presente</button><button class="btn sm ${x.v === 'ATR' ? 'on warn' : ''}" data-ck="${esc(x.c.id)}|ATR" aria-pressed="${x.v === 'ATR'}">Atraso</button><button class="btn sm ${x.v === 'FT' ? 'on bad' : ''}" data-ck="${esc(x.c.id)}|FT" aria-pressed="${x.v === 'FT'}">Falta</button>${!['P', 'HE', 'ATR', 'FT'].includes(x.v) ? `<span class="pill ${tom(x.v)}">${SIT_NOME[x.v] || x.v}</span>` : ''}</div></div>`).join('')}</div><button class="btn pri" data-ckok="${esc(g.a)}|${g.per}">Confirmar todos os presentes · ${pres} de ${g.ps.length}</button></div>`;
  }).join('')}</div></div>`;
}
// Dia mostrado na Presença: o escolhido nos botões dos dias (dentro da semana do topo); se não houver, hoje (ou a segunda da semana).
const DIA_NOME = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
function diaEf() {
  const dias = DAYS.map((_, k) => add(UI.ini, k));
  return dias.includes(UI.eDia) ? UI.eDia : dias.includes(TODAY) ? TODAY : UI.ini;
}
export function vEsDia() {
  const area = areaScope();
  const rs = rotasDa(area);
  const dia = diaEf(); const kDia = DAYS.findIndex((_, k) => add(UI.ini, k) === dia); const ehHoje = dia === TODAY;
  const mob = isMobile(); const nCol = mob ? 2 : 3;
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
  const dRef = dia;
  const grpPer = c => { const s = sitDia(c, dRef); if (s.v === 'DS') return '5|Desligados'; if (s.auto || s.v === 'F' || s.v === 'FE') return '4|Folga ou férias'; const pr = periodoDe(c, dRef); if (pr) return pr === 'N' ? '2|Turno noturno' : '1|Turno diurno'; return escala().regimes[regimeDe(c, dRef)] && escala().regimes[regimeDe(c, dRef)].tipo === 'ciclo' ? '3|Turno sem turma' : '0|Administrativo'; };
  // Gestão mostra só a gestão; Rota mostra só o pessoal das rotas (a gestão fica na opção Gestão). Busca, período e líder mostram todos.
  const porRota = !q.trim() && !porGrupo && !porGestao;
  let cs = q.trim() ? colabsDa(area).filter(c => casa(kC(c), q)) : UI.eRota === '*' || porGrupo || porGestao ? colabsDa(area) : COLABS.filter(c => c.area + '|' + c.rota === UI.eRota);
  if (porGestao && !q.trim()) cs = cs.filter(c => nivelG(c)); else if (porRota) cs = cs.filter(c => !nivelG(c));
  // Mover de rota no dia: quem saiu fica na rota de origem com "foi para"; quem veio aparece também no destino ("veio da").
  // Pendente: a pessoa segue na origem, marcada. Só no agrupar por rota a pessoa aparece nas duas rotas.
  const movs = new Map(movDoDia(dia).map(v => [v.id, v]));
  const ap = movAprovDia(dia);
  cs = cs.map(c => { const v = movs.get(c.id); if (!v || v.de !== c.area + '|' + c.rota) return c; return v.st === 'aprovado' ? { ...c, _foi: v } : v.st === 'pendente' ? { ...c, _pend: v } : c; });
  const comVeio = porRota;
  if (comVeio) for (const v of ap.values()) {
    const o = COLABS.find(x => x.id === v.id); const p = partesRota(v.para); if (!o || o.area + '|' + o.rota !== v.de || nivelG(o)) continue;
    if (area !== 'TODAS' && p.area !== area) continue; if (UI.eRota !== '*' && UI.eRota !== v.para) continue;
    cs.push({ ...o, area: p.area, rota: p.rota, _veio: v });
  }
  const conta = l => (comVeio ? l.filter(x => !x._foi) : l);
  const gk = c => (porPer ? grpPer(c) : porLider ? 'L|' + (lid(c) || '~') : porGestao && nivelG(c) ? 'G|' + nivelG(c) : c.area + '|' + c.rota);
  const NOME_G = { 1: 'COORDENAÇÃO', 2: 'SUPERVISÃO', 3: 'LIDERANÇA', 4: 'SEGURANÇA DO TRABALHO' };
  cs = cs.slice().sort((x, y) => porGestao ? (!nivelG(x) - !nivelG(y)) || (nivelG(x) && nivelG(y) ? nivelG(x) - nivelG(y) : (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999)) || x.nome.localeCompare(y.nome) : porGrupo ? gk(x).localeCompare(gk(y)) || x.nome.localeCompare(y.nome) : (ordem.get(x.area + '|' + x.rota) ?? 999) - (ordem.get(y.area + '|' + y.rota) ?? 999) || x.nome.localeCompare(y.nome));
  // rodapé: presentes / escalados de cada dia (a mesma conta do topo e dos grupos; férias e folga lançada saem do total)
  const ctDia = contarDia(conta(cs), dia);
  const celula = c => {
    const dt = dia, k = kDia; const x = sitDia(c, dt); const v = x.v; const ed = editaDia(c.area, dt);
    const inf = DB.sitInfo(c.id + '|' + dt); const cob = !x.auto && AUS_COBRIVEL.has(v) ? inf.cob : ''; const cobre = cobrindo(c.id, dt);
    const per = ['P', 'ATR', 'SA', 'HE'].includes(v) ? periodoDe(c, dt) : '';
    const jus = !x.auto && JUS_CODS.includes(v) ? inf.jus : null; const semJus = !x.auto && JUS_CODS.includes(v) && !(jus && jus.cod === v) && dt <= TODAY;
    const tt = (x.auto ? `Folga pela escala (${x.motivo})` : SIT_NOME[v] || v) + (jus && jus.cod === v ? ` · ${textoJus(jus)}` : semJus ? ' · sem justificativa' : '') + (per ? ` · turno ${PERIODO[per].toLowerCase()}` : '') + (v === 'HE' && inf.he ? ` a pedido da ${HE_ORIG[inf.he]}` : '') + (v === 'HE' && inf.hed ? ' · ' + textoHE(inf.hed) : '') + (cob ? ` · coberto por ${nomeDe(cob)}` : (!x.auto && AUS_COBRIVEL.has(v) ? ' · sem substituto' : '')) + (cobre ? ` · cobrindo ${nomeDe(cobre)}` : '');
    return `<td class="efsit"><button class="sit ${v}${x.auto ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}${cob || cobre ? ' cobm' : ''}${semJus ? ' semjus' : ''}" ${ed ? `data-sit="${c.id}|${dt}"` : 'disabled'} aria-label="${esc(title(c.nome))}, ${DAYS[k]} ${ddmm(dt)}: ${esc(tt)}" title="${esc(tt)}">${v === 'P' ? I.ok : v}${v === 'HE' && inf.he ? `<sup>${HE_SIG[inf.he]}</sup>` : ''}${cob || cobre ? '<i class="cobi" aria-hidden="true">⇄</i>' : ''}${marcaPer(per)}</button><span class="efsitn${semJus ? ' bad' : ''}">${esc(x.auto ? 'Folga' : SIT_NOME[v] || v)}${semJus ? ' · sem justificativa' : cob ? ' · com substituto' : cobre ? ' · cobrindo' : ''}</span></td>`;
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
      const rot = porPer ? `${g.slice(2)}${['1', '2'].includes(g[0]) ? ` · turma ${[...new Set(doG.map(x => turmaDe(x)).filter(Boolean))].sort().join(', ')}` : ''}` : porLider ? (g === 'L|~' ? 'Sem líder na ficha' : 'LÍDER ' + g.slice(2)) : g.startsWith('G|') ? NOME_G[g.slice(2)] : c.rota;
      const ctG = contarDia(conta(doG), dia);
      const ph = ctG ? ctG.presentes : null;
      const eh = ctG ? ctG.escalados : null; // folga e férias não contam como escalado
      cab = `<tr class="grp-row"><th colspan="${nCol}">${recolhe ? `<button type="button" class="efg${fechado ? '' : ' on'}" data-efg="${esc(g)}" aria-expanded="${!fechado}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(rot)}</b>${area === 'TODAS' && !porGrupo && !g.startsWith('G|') && !ehAreaGeral(c.area) ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}</button>` : porGrupo || porGestao ? `<b>${esc(rot)}</b>` : `<button class="btn ghost link" data-erota="${esc(g)}">${esc(c.rota)}</button>${area === 'TODAS' && !ehAreaGeral(c.area) ? ` <span class="muted">· ${AREA_S[c.area]}</span>` : ''}`}<span class="gcount">${porPer && g[0] >= '4' ? `${doG.length} pessoa${doG.length === 1 ? '' : 's'}` : ph != null ? `<b class="gp ${!eh ? 'neu' : ph >= eh ? 'ok' : ph ? 'warn' : 'bad'}">${ph}/${eh}</b> presentes${ehHoje ? ' hoje' : ''}${(() => { if (porPer) return ''; const pp = ctG.periodo; return pp.D + pp.N ? ` (${pp.D} dia · ${pp.N} noite)` : ''; })()}${conta(doG).length > eh ? ` · ${conta(doG).length - eh} de folga` : ''}${doG.length > conta(doG).length ? ` · ${doG.length - conta(doG).length} em outra rota` : ''}` : `${doG.length} pessoa${doG.length > 1 ? 's' : ''}`}</span></th></tr>`;
    }
    if (fechado) return cab;
    const nm = podeMoverP(c, dia) ? `<button type="button" class="btn ghost link movnome" data-act="movPessoa" data-id="${esc(c.id)}" title="Mover de rota neste dia"><b>${esc(title(c.nome))}</b></button>` : `<b>${esc(title(c.nome))}</b>`;
    return cab + `<tr><td class="fnome">${nm}${seloMov(c)}<div class="muted small">${q.trim() || porGrupo || (porGestao && nivelG(c)) ? `${esc(c.rota)}${area === 'TODAS' && !ehAreaGeral(c.area) ? ' · ' + AREA_S[c.area] : ''} · ` : ''}${turmaTag(c)}${isMobile() && c.funcao ? ' · ' + esc(title(c.funcao)) : ''}</div></td>${mob ? '' : `<td class="muted small">${esc(title(c.funcao))}</td>`}${celula(c)}</tr>`;
  }).join('');
  // No celular a faixa do Efetivo fica compacta (4 à vista) e os turnos de hoje numa linha que desliza, para a lista subir.
  const faixaEf = miniEscala(area).replace('<div class="hojeturma">', '<div class="hojeturma scrollx">').replace('<div class="mini">', '<div class="mini compacta">');
  // Escolha do dia: os 7 dias da semana do topo, um toque por dia (hoje marcado)
  const diasNav = `<div class="body pt0 efdias" role="group" aria-label="Dia mostrado">${DAYS.map((d, k) => { const dt = add(UI.ini, k); return `<button type="button" class="efdia${dt === dia ? ' on' : ''}${dt === TODAY ? ' hoje' : ''}" data-act="efDia" data-d="${dt}" aria-pressed="${dt === dia}" aria-label="${DIA_NOME[k]} ${ddmm(dt)}${dt === TODAY ? ' (hoje)' : ''}"><span>${d.slice(0, 3)}</span><b>${dt.slice(8)}</b></button>`; }).join('')}</div>`;
  // Celular primeiro: quem falta confirmar, as rotas com falta de gente, os pedidos de movimentação; depois a lista e o envio.
  return faixaEf + (ehHoje ? cardCheckin() : '') + cardFalta(area, dia, kDia) + cardMovs(area) + `<div class="card efcard"><header><h2>Escala do dia · ${DIA_NOME[kDia]}, ${ddmm(dia)}${ehHoje ? ' (hoje)' : ''}</h2><p>${area !== 'TODAS' && travadoEf(DB.efDia(SK, dia, area)) ? 'Dia validado pelo RH: somente leitura' : canEditSit(area === 'TODAS' ? (myArea() || AREAS[0]) : area) ? 'Toque na situação para mudar · ✓ = presente · toque no nome para mover de rota neste dia' : 'Somente leitura'}</p></header>
  ${diasNav}${linhaEf(area, dia)}
  <div class="body lbar efbar efbar1">${caixaBusca('fEQ', q, 'Buscar colaborador, função ou rota')}${q.trim() ? `<span class="muted small"><b>${cs.length}</b> encontrado${cs.length === 1 ? '' : 's'} em ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</span><button class="btn sm ghost" data-act="limparEQ">Limpar busca</button>` : `<label class="sel"><span>Agrupar por</span><select class="in" id="fEAgr"><option value="rota" ${!porGrupo && !porGestao ? 'selected' : ''}>Rota</option><option value="gestao" ${porGestao ? 'selected' : ''}>Gestão (${colabsDa(area).filter(c => nivelG(c)).length} pessoas)</option><option value="periodo" ${porPer ? 'selected' : ''}>Dia e noite (${dRef === TODAY ? 'hoje' : ddmm(dRef)})</option>${lid ? `<option value="lider" ${porLider ? 'selected' : ''}>Líder</option>` : ''}</select></label>${porGrupo || porGestao ? '' : `<label class="sel efrota"><span>Rota</span><select class="in" id="fERota"><option value="*" ${UI.eRota === '*' ? 'selected' : ''}>Todas as rotas (${colabsDa(area).filter(c => !nivelG(c)).length} pessoas)</option>${rs.map(r => `<option value="${esc(r.area + '|' + r.rota)}" ${r.area + '|' + r.rota === UI.eRota ? 'selected' : ''}>${esc(r.rota)}${area === 'TODAS' ? ' · ' + AREA_S[r.area] : ''}</option>`).join('')}</select></label>`}`}${!framed && !isMobile() ? `<button class="btn sm" data-act="expEsdia" title="A semana inteira, de todas as rotas da área escolhida" style="margin-left:auto">${I.dl} Exportar semana</button>` : ''}</div>
  ${recolhe ? `<div class="body pt0 pb0 efabre"><button class="btn ghost link" data-act="efTodas">${efAb.size ? (porGrupo ? 'Recolher todos os grupos' : 'Recolher todas as rotas') : (porGrupo ? 'Abrir todos os grupos' : 'Abrir todas as rotas')}</button><span class="muted small">${nGrupos} ${porGrupo ? 'grupos · toque num grupo' : 'rotas · toque numa rota'} para ver as pessoas</span></div>` : ''}
  <details class="legdet body pb0 pt0"><summary>Legenda das siglas</summary><div class="legend sitleg"><span><span class="sit P">${I.ok}</span> Presente</span><span><span class="sit F auto">F</span> Folga pela escala</span><span><span class="sit FT cobm">FT<i class="cobi">⇄</i></span> Com substituto</span><span><span class="sit P">${I.ok}${marcaPer('D')}</span> Turno diurno</span><span><span class="sit P">${I.ok}${marcaPer('N')}</span> Turno noturno (conta no dia em que começa)</span><span><span class="sit HE">HE<sup>D</sup></span> Hora extra (D Dikma · A ArcelorMittal)</span>${SITS.filter(s => s[0] !== 'P').map(s => `<span><span class="sit ${s[0]}">${s[0]}</span> ${s[1]}</span>`).join('')}<span><span class="sit FT semjus">FT</span> Sem justificativa: toque para justificar</span></div></details>
  <div class="tw"><table class="efd efdia1"><thead><tr><th>Colaborador</th>${mob ? '' : '<th>Função</th>'}<th>Situação</th></tr></thead><tbody>
  ${cs.length ? linhas : `<tr><td colspan="${nCol}" class="empty">${q.trim() ? 'Ninguém encontrado com essa busca.' : 'Nenhum colaborador nesta rota.'}</td></tr>`}
  </tbody>${cs.length ? `<tfoot><tr><th colspan="${nCol - 1}">Presentes</th><td class="num"><b class="${ctDia.presentes < ctDia.escalados ? 'menos' : ctDia.escalados ? 'cheio' : ''}">${ctDia.presentes}</b><span class="muted">/${ctDia.escalados}</span></td></tr></tfoot>` : ''}</table></div></div>${cardEf(area, dia)}`;
}
/* ---------------- MOVER DE ROTA NO DIA ---------------- */
// Vale só naquele dia e não muda o cadastro (contas/mover-rota.js; campo mov da presença do mês). O líder pede para
// uma rota da área dele e o supervisor da área aprova; para outra área, o supervisor pede e o administrador aprova.
// Até aprovar, a pessoa segue na rota de origem. Trava quando o RH valida o dia (da área de origem ou de destino).
const quemMov = () => ({ uid: ME.uid, nome: title(ME.nome || ME.login || ''), perfil: perfil('operacao'), areas: areasSitDe(SK), admin: isAdmin() });
const livreMov = (a, dia) => !travadoEf(DB.efDia(SK, dia, a));
const podeMoverP = (c, dia) => !!ME && livreMov(c.area, dia) && (podePedir(quemMov(), c.area, c.area) || !!movDe(c.id, dia));
const nomeRota = (k, comArea) => { const p = partesRota(k); return comArea ? `${p.rota} · ${AREA_S[p.area] || p.area}` : p.rota; };
function seloMov(c) {
  if (c._veio) return ` ${etiqueta('veio da ' + nomeRota(c._veio.de, c._veio.ao !== c._veio.ap), 'info')}`;
  if (c._foi) return ` ${etiqueta('foi para ' + nomeRota(c._foi.para, c._foi.ao !== c._foi.ap), 'atencao')}`;
  if (c._pend) return ` ${etiqueta('movimentação pendente · ' + nomeRota(c._pend.para, c._pend.ao !== c._pend.ap), 'atencao')}`;
  return '';
}
// Rotas com falta de gente no dia: necessário × disponível do Dimensionamento (já com as movimentações aprovadas).
function cardFalta(area, dia, k) {
  if (k < 0) return '';
  const fal = rotasDa(area).filter(r => r.rota !== 'GESTÃO').map(r => ({ r, d: escalaRota(r, UI.ini).days[k] })).filter(x => x.d.prog > 0 && x.d.disp < x.d.nec).sort((a, b) => (a.d.disp - a.d.nec) - (b.d.disp - b.d.nec));
  if (!fal.length) return `<div class="card efalta"><div class="body row-gap">${etiqueta('Todas as rotas com gente suficiente', 'ok')}<span class="muted small">${ddmm(dia)} · necessário × disponível do Dimensionamento</span></div></div>`;
  return `<div class="card efalta"><header><h2>Rotas com falta de gente</h2><p>${ddmm(dia)} · disponível / necessário · toque para ver a rota e mover alguém</p></header><div class="body stackcol">${fal.map(({ r, d }) => `<div class="efenv"><div class="minw"><div class="row-gap"><b>${esc(r.rota)}</b>${area === 'TODAS' ? `<span class="muted small">${esc(AREA_S[r.area] || r.area)}</span>` : ''}${etiqueta(`faltam ${d.nec - d.disp}`, 'critico')}</div><div class="muted small">${d.disp} disponíve${d.disp === 1 ? 'l' : 'is'} de ${d.nec} necessário${d.nec === 1 ? '' : 's'} · ${d.prog} atividade${d.prog === 1 ? '' : 's'}</div></div><button type="button" class="btn sm" data-erota="${esc(r.area + '|' + r.rota)}">Ver a rota</button></div>`).join('')}</div></div>`;
}
// Pedidos pendentes da semana: quem aprova vê Aprovar e Recusar; quem pediu vê os seus.
function cardMovs(area) {
  if (!ME) return '';
  const q = quemMov(); const dias = DAYS.map((_, k) => add(UI.ini, k));
  const ps = dias.flatMap(d => movDoDia(d)).filter(v => v.st === 'pendente' && (area === 'TODAS' || v.ao === area || v.ap === area) && (podeAprovar(q, v.ao, v.ap) || v.por === ME.uid));
  if (!ps.length) return '';
  const lin = v => { const c = COLABS.find(x => x.id === v.id); const ok = podeAprovar(q, v.ao, v.ap) && livreMov(v.ao, v.dt) && livreMov(v.ap, v.dt); const k = v.id + '|' + v.dt;
    return `<div class="efenv"><div class="minw"><div class="row-gap"><b>${esc(c ? title(c.nome) : v.id)}</b>${etiqueta(ddmm(v.dt), 'neutro')}</div><div class="muted small">${esc(nomeRota(v.de, v.ao !== v.ap))} → <b>${esc(nomeRota(v.para, v.ao !== v.ap))}</b> · pedido por ${esc(curto(v.nome))}${v.ao !== v.ap ? ' · outra área: o administrador aprova' : ''}</div></div><div class="row-gap">${ok ? `<button type="button" class="btn sm pri" data-act="movAprovar" data-k="${esc(k)}">Aprovar</button><button type="button" class="btn sm" data-act="movRecusar" data-k="${esc(k)}">Recusar</button>` : v.por === ME.uid ? `<button type="button" class="btn sm ghost" data-act="movCancelar" data-k="${esc(k)}">Cancelar pedido</button>` : ''}</div></div>`; };
  return `<div class="card efmov"><header><h2>Movimentações pendentes</h2><p>Até aprovar, a pessoa segue na rota de origem</p></header><div class="body stackcol">${ps.map(lin).join('')}</div></div>`;
}
function gravarMov(v, msg, ok) {
  const c = COLABS.find(x => x.id === v.id);
  DB.setMov(v.id + '|' + v.dt, v); DB.log(`${c ? title(c.nome) : v.id} · ${ddmm(v.dt)} · ${msg}: ${nomeRota(v.de, true)} → ${nomeRota(v.para, true)}`, 'operacao'); toast(ok); render();
}
function tentarMov(f) { try { f(); } catch (e) { toast(e.message); } }
const agoraISO = () => new Date().toISOString();
acoes.movPessoa = (t, d) => {
  const c = COLABS.find(x => x.id === d.id); if (!c) return; const dia = diaEf(); const k = DAYS.findIndex((_, j) => add(UI.ini, j) === dia);
  if (!livreMov(c.area, dia)) return toast('Este dia já foi validado pelo RH. Para mudar, o administrador reabre o dia.');
  const q = quemMov(); const atual = movDe(c.id, dia); const ativo = atual && ['pendente', 'aprovado'].includes(atual.st) ? atual : null;
  const opts = [];
  if (ativo && ativo.st === 'pendente' && podeAprovar(q, ativo.ao, ativo.ap)) opts.push({ t: 'Aprovar a movimentação', d: `Para ${nomeRota(ativo.para, ativo.ao !== ativo.ap)} · pedido por ${curto(ativo.nome)}`, v: 'aprovar' }, { t: 'Recusar a movimentação', v: 'recusar' });
  if (ativo && (podeAprovar(q, ativo.ao, ativo.ap) || (ativo.st === 'pendente' && ativo.por === ME.uid))) opts.push({ t: ativo.st === 'aprovado' ? 'Voltar para a rota de origem' : 'Cancelar o pedido', d: ativo.st === 'aprovado' ? `Hoje em ${nomeRota(ativo.para, ativo.ao !== ativo.ap)} · volta para ${nomeRota(ativo.de)}` : `Pendente para ${nomeRota(ativo.para, ativo.ao !== ativo.ap)}`, v: 'cancelar' });
  const rota = r => { const x = k >= 0 ? escalaRota(r, UI.ini).days[k] : null; const falta = x && x.prog > 0 && x.disp < x.nec;
    return { t: r.rota + (r.area !== c.area ? ` · ${AREA_S[r.area] || r.area}` : ''), d: x ? `${x.disp} disponíve${x.disp === 1 ? 'l' : 'is'} de ${x.nec} necessário${x.nec === 1 ? '' : 's'}${falta ? ' · falta gente' : ''}` : '', v: 'r:' + rotaK(r.area, r.rota), cur: ativo && ativo.para === rotaK(r.area, r.rota) }; };
  const mesma = podePedir(q, c.area, c.area) ? rotasDa(c.area).filter(r => r.rota !== c.rota && r.rota !== 'GESTÃO') : [];
  const outras = SETS[SK].areas.filter(a => a !== c.area && podePedir(q, c.area, a) && livreMov(a, dia)).flatMap(a => rotasDa(a).filter(r => r.rota !== 'GESTÃO'));
  mesma.forEach((r, i) => opts.push({ ...rota(r), sec: i ? '' : `Rotas de ${AREA_S[c.area] || c.area}` }));
  outras.forEach((r, i) => opts.push({ ...rota(r), sec: i ? '' : 'Outras áreas (o administrador aprova)' }));
  if (!opts.length) return toast('Você não tem rotas para onde mover esta pessoa.');
  const aprova = podeAprovar(q, c.area, c.area);
  sheet(`Mover ${curto(title(c.nome))} · ${ddmm(dia)}`, `Hoje na rota ${esc(c.rota)}. Vale só neste dia e não muda o cadastro.${aprova ? '' : ' O supervisor da área aprova.'}`, opts, o => tentarMov(() => {
    if (o.v === 'aprovar') return gravarMov(decidirMov(ativo, 'aprovado', { quem: q, em: agoraISO() }), 'movimentação aprovada', 'Movimentação aprovada');
    if (o.v === 'recusar') return acoes.movRecusar(null, { k: c.id + '|' + dia });
    if (o.v === 'cancelar') return gravarMov(decidirMov(ativo, 'cancelado', { quem: q, em: agoraISO() }), ativo.st === 'aprovado' ? 'voltou para a rota de origem' : 'pedido cancelado', ativo.st === 'aprovado' ? 'Voltou para a rota de origem' : 'Pedido cancelado');
    const v = pedirMov(atual, { c, dt: dia, para: o.v.slice(2), quem: q, em: agoraISO() });
    gravarMov(v, v.st === 'aprovado' ? 'movida' : 'pediu movimentação', v.st === 'aprovado' ? `${curto(title(c.nome))} vai para ${nomeRota(v.para)} neste dia` : 'Pedido enviado: o supervisor aprova');
  }));
};
const movDaChave = key => { const i = key.lastIndexOf('|'); return movDe(key.slice(0, i), key.slice(i + 1)); };
acoes.movAprovar = (t, d) => tentarMov(() => gravarMov(decidirMov(movDaChave(d.k), 'aprovado', { quem: quemMov(), em: agoraISO() }), 'movimentação aprovada', 'Movimentação aprovada'));
acoes.movCancelar = (t, d) => tentarMov(() => gravarMov(decidirMov(movDaChave(d.k), 'cancelado', { quem: quemMov(), em: agoraISO() }), 'pedido cancelado', 'Pedido cancelado'));
acoes.movRecusar = (t, d) => {
  const v = movDaChave(d.k); if (!v) return;
  formSheet('Recusar a movimentação', `${esc(nomeRota(v.de, v.ao !== v.ap))} → ${esc(nomeRota(v.para, v.ao !== v.ap))} · ${ddmm(v.dt)}`, '<label class="sel"><span>Motivo</span><input class="in" id="movMot" maxlength="200" placeholder="Ex.: a rota de origem também está sem gente"></label>', 'Recusar', async () => {
    gravarMov(decidirMov(v, 'recusado', { quem: quemMov(), em: agoraISO(), mot: $('movMot').value }), 'movimentação recusada', 'Movimentação recusada');
  });
};
/* ---------------- EFETIVO DO DIA (envio ao RH) ---------------- */
// O líder ou supervisor preenche a Presença e envia o efetivo de cada área; o RH · Administrativo valida ou devolve na
// Frequência. O dia abre sozinho (qualquer dia até hoje). Validado, o dia fica travado aqui até o administrador reabrir.
// Status e regras em contas/efetivo-dia.js; documento efetivoDia/{data}_{área}.
const quemEf = area => ({ lanca: canEditSit(area), valida: editaAdm(ME), admin: isAdmin() });
// Pode mudar a presença dessa área nesse dia: quem lança e o dia não está validado.
export const editaDia = (area, dia) => canEditSit(area) && !travadoEf(DB.efDia(SK, dia, area));
// Áreas com gente na Presença (a escolhida no topo, ou todas), na ordem do conjunto e as gerais no fim.
function areasEf(area) {
  if (area !== 'TODAS') return [area];
  const tem = new Set(colabsDa('TODAS').map(c => c.area));
  return [...SETS[SK].areas, ...(SETS[SK].gerais || [])].filter(a => tem.has(a));
}
// Linha curta abaixo dos dias: o status do envio (uma área) ou quantas áreas já foram enviadas.
function linhaEf(area, dia) {
  if (dia > TODAY) return '';
  const as = areasEf(area); if (!as.length) return '';
  if (as.length === 1) { const e = estadoEf(DB.efDia(SK, dia, as[0]), dia, TODAY); return `<div class="body pt0 pb0 efst">Efetivo do dia: ${etiqueta(e.nome, e.tom)}</div>`; }
  const n = as.filter(a => { const d = DB.efDia(SK, dia, a); return d && ['enviado', 'validado'].includes(d.st); }).length;
  return `<div class="body pt0 pb0 efst">Efetivo do dia: ${etiqueta(`${n} de ${as.length} áreas enviadas`, n === as.length ? 'ok' : 'atencao')}</div>`;
}
// Uma área: o botão laranja (ação principal da tela); várias áreas: um botão comum por área.
const rotEnv = doc => (doc && ['devolvido', 'aberto'].includes(doc.st) ? 'Enviar de novo' : 'Enviar efetivo');
function cardEf(area, dia) {
  if (dia > TODAY) return '';
  const as = areasEf(area); if (!as.length) return '';
  const linhas = as.map(a => {
    const doc = DB.efDia(SK, dia, a); const e = estadoEf(doc, dia, TODAY); const q = quemEf(a);
    const ct = contarDia(colabsDa(a), dia);
    const env = ultimaEf(doc, 'enviado'), val = ultimaEf(doc, 'validado');
    const det = doc && doc.st === 'devolvido' ? `Devolvido por ${esc(doc.nome)}: <b>${esc(doc.mot)}</b>. Corrija e envie de novo.`
      : doc && doc.st === 'validado' ? `Validado por ${esc(val ? val.nome : doc.nome)}${val ? ' em ' + horaEf(val.em) : ''}. Para mudar, o administrador reabre o dia.`
      : doc && doc.st === 'aberto' ? `Reaberto por ${esc(doc.nome)}. Ajuste e envie de novo.`
      : env ? `Enviado por ${esc(env.nome)} em ${horaEf(env.em)}. Ainda dá para corrigir e reenviar até o RH validar.` : q.lanca ? 'Confira a presença acima e envie para o RH.' : 'Ainda não enviado pelo líder da área.';
    const bts = [podeEf('enviado', doc, q) ? (doc && doc.st === 'enviado' ? `<button type="button" class="btn sm" data-act="efEnviar" data-ef="${esc(a)}">Reenviar</button>` : (as.length === 1 ? botaoAcao(rotEnv(doc), `data-act="efEnviar" data-ef="${esc(a)}"`) : `<button type="button" class="btn sm pri" data-act="efEnviar" data-ef="${esc(a)}">${rotEnv(doc)}</button>`)) : '',
      podeEf('aberto', doc, q) ? `<button type="button" class="btn sm" data-act="efReabrir" data-ef="${esc(a)}">Reabrir o dia</button>` : ''].join('');
    return `<div class="efenv"><div class="minw"><div class="row-gap"><b>${esc(AREA_S[a] || a)}</b>${etiqueta(e.nome, e.tom)}${ct ? `<span class="muted small">${ct.presentes} de ${ct.escalados} presentes</span>` : ''}</div><div class="muted small">${det}</div></div>${bts ? `<div class="row-gap">${bts}</div>` : ''}</div>`;
  }).join('');
  return `<div class="card efenvcard"><header><h2>Efetivo do dia · ${ddmm(dia)}</h2><p>Envie ao RH quando a presença estiver conferida. Validado, o dia fica travado.</p></header><div class="body stackcol">${linhas}</div></div>`;
}
function efAcao(a, acao, msg, ok) {
  const dia = diaEf(); const doc = DB.efDia(SK, dia, a);
  if (!podeEf(acao, doc, quemEf(a))) return toast('Não é possível fazer isso neste dia.');
  DB.efGravar(SK, dia, a, acao); DB.log(`Efetivo do dia: ${msg} ${AREA_S[a] || a} de ${ddmm(dia)} (${SETS[SK].curto})`, 'operacao'); toast(ok); render();
}
acoes.efEnviar = (t, d) => {
  const a = d.ef; const dia = diaEf(); const ct = contarDia(colabsDa(a), dia);
  const semJus = colabsDa(a).filter(c => { const x = sitDia(c, dia); return !x.auto && JUS_CODS.includes(x.v) && !((DB.sitInfo(c.id + '|' + dia).jus || {}).cod === x.v); }).length;
  formSheet(`Enviar efetivo · ${AREA_S[a] || a}`, `${DIA_NOME[DAYS.findIndex((_, k) => add(UI.ini, k) === dia)] || ''} ${ddmm(dia)}`,
    `<p class="m0">${ct ? `<b>${ct.presentes} de ${ct.escalados}</b> presentes.` : ''} O RH confere e valida. Depois de validado, a presença deste dia só muda se o administrador reabrir.</p>${semJus ? `<p class="m0 small" style="color:var(--atencao)">${semJus} falta${semJus === 1 ? '' : 's'} ou atraso${semJus === 1 ? '' : 's'} sem justificativa. Dá para enviar assim e justificar depois.</p>` : ''}`,
    'Enviar', async () => { efAcao(a, 'enviado', 'enviou', 'Efetivo enviado ao RH'); });
};
acoes.efReabrir = (t, d) => {
  const a = d.ef; const dia = diaEf();
  formSheet(`Reabrir o dia · ${AREA_S[a] || a}`, ddmm(dia), '<p class="m0">O líder volta a poder mudar a presença deste dia e precisa enviar de novo para o RH validar.</p>', 'Reabrir', async () => { efAcao(a, 'aberto', 'reabriu', 'Dia reaberto'); });
};
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
acoes.efDia = (t, d) => { UI.eDia = d.d; render(); };
