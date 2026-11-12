// Tela Apontar: o líder marca o que foi feito no dia (e a justificativa do que não foi).
import { AREA_S, DAYS, MOTIVOS, pd, add, ddmm } from '../contas/cal.js';
import { DB, TODAY, esc, title, $ } from '../nucleo/base.js';
import { PL, AREAS, UI, admDe, myAreas, myArea, areaScope, canEdit, podeForaProg } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { st, feriadoDe, rotasDa, localChange, setSt, incluirFora, tirarFora, escolherFora, areasAprov, aprovDe, estAprov, gravarApont, CHIP, ST_NOME } from '../calc/atividades.js';
import { curto } from '../calc/presenca.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, desenharLogo } from '../ui/shell.js';
import { precisaFotos, passoFotos, passoFotosCel, montarFotos, seloFotos, verFotosCel, cfgF } from './fotos.js';
import { cartaoQZ } from './queda-zero.js';
import { totalDiaQZ, fmtT } from '../contas/queda-zero.js';
import { exigeFoto, fotosDaCel } from '../contas/fotos.js';

/* ---------------- APONTAR ---------------- */
// Área aberta no Apontar (quem vê todas as áreas usa a última escolhida).
export const apArea = () => { const a = areaScope(); return a === 'TODAS' ? (UI.apArea || AREAS[0]) : a; };
// Pendentes de uma área num dia da semana (para escolher a área e a rota que abrem primeiro).
function pendDia(area, k) { const d = DB.cache.semanas[area + '|' + UI.ini]; return d ? d.ids.reduce((n, id, i) => n + (d.d[i][k] === 'P' ? 1 : 0), 0) : 0; }
export function vApontar() {
  // Quem vê todas as áreas não precisa escolher antes: abre na última área usada ou na que tem mais coisa para apontar hoje.
  if (UI.dia == null || UI.dia < 0 || UI.dia > 6) { const t = Math.round((pd(TODAY) - pd(UI.ini)) / 864e5); UI.dia = t >= 0 && t < 7 ? t : 0; }
  let area = areaScope();
  const varias = !myArea() || myAreas().length > 1;
  if (area === 'TODAS') { area = AREAS.includes(UI.apArea) ? UI.apArea : AREAS.slice().sort((a, b) => pendDia(b, UI.dia) - pendDia(a, UI.dia))[0]; }
  UI.apArea = area;
  const areasLista = myArea() ? myAreas() : AREAS;
  const chipsArea = varias ? `<div class="rchips linha" role="group" aria-label="Área">${areasLista.map(a => { const p = pendDia(a, UI.dia); return `<button class="rchip" data-aparea="${a}" aria-pressed="${a === area}">${AREA_S[a]}${p ? `<span class="c num">${p}</span>` : ''}</button>`; }).join('')}</div>` : '';
  const doc = DB.cache.semanas[area + '|' + UI.ini];
  if (!doc) return chipsArea + `<div class="card"><div class="empty">Esta semana ainda não foi gerada para ${AREA_S[area]}.${admDe('ativ') ? ' <button class="btn sm" data-go="gerador">Abrir o Gerador de meses</button>' : ' O administrador gera os meses em Gerador de meses.'}</div></div>`;
  const k = UI.dia;
  const rts = rotasDa(area).filter(r => r.carga > 0).map(r => r.rota);
  const edit = canEdit(area);
  const cnt = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] !== '_' ? 1 : 0), 0);
  const pendR = r => doc.ids.reduce((n, id, i) => n + (PL.get(id) && PL.get(id).rota === r && doc.d[i][k] === 'P' ? 1 : 0), 0);
  // Rota: a escolhida antes nesta área; senão a primeira com algo para apontar
  UI.aRotaPor = UI.aRotaPor || {};
  if (UI.aRota && rts.includes(UI.aRota)) UI.aRotaPor[area] = UI.aRota;
  UI.aRota = rts.includes(UI.aRotaPor[area]) ? UI.aRotaPor[area] : (rts.find(r => pendR(r)) || rts[0]);
  UI.aRotaPor[area] = UI.aRota;
  const items = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] !== '_');
  // Feriado sem operação: as atividades programadas do dia aparecem em cinza, sem botão (feriados.js)
  const fers = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && feriadoDe(doc, x.i, k));
  const ferDia = j => { for (const [key, v] of Object.entries(doc.fe || {})) if (v && key.endsWith('|' + j)) return v; return ''; };
  const proxima = rts.find(r => r !== UI.aRota && pendR(r));
  const done = items.filter(x => 'RNE'.includes(doc.d[x.i][k])).length;
  const R = items.filter(x => doc.d[x.i][k] === 'R').length, N = items.filter(x => doc.d[x.i][k] === 'N').length, E = items.filter(x => doc.d[x.i][k] === 'E').length;
  const t = items.length || 1;
  const apAqui = areasAprov().includes(area) ? items.filter(x => estAprov(doc, x.i, k) === 'pend').length : 0;
  let h = chipsArea + `<div class="dayscroll" role="group" aria-label="Dia">${DAYS.map((d, j) => { const dt = add(UI.ini, j); const fd = ferDia(j); return `<button class="dbtn ${dt === TODAY ? 'hoje' : ''}${fd ? ' fer' : ''}" data-dia="${j}" aria-pressed="${j === k}"${fd ? ` title="Feriado · ${esc(fd)}" aria-label="${d} ${dt.slice(8)} · feriado"` : ''}><small>${d}</small><b>${dt.slice(8)}</b></button>`; }).join('')}</div>
  <div class="rchips linha" role="group" aria-label="Rota">${rts.map(r => { const c = cnt(r), p = pendR(r); return `<button class="rchip" data-arota="${esc(r)}" aria-pressed="${r === UI.aRota}">${esc(r)}<span class="c num">${p ? p : c ? '✓' : '—'}</span></button>`; }).join('')}</div>
  <div class="apbar"><div class="row-between"><b>${esc(UI.aRota)}${varias ? ` · ${AREA_S[area]}` : ''} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}</b><span class="muted num">${!items.length && fers.length ? `Feriado · ${esc(ferDia(k))}` : `${done} de ${items.length} feitas`}</span></div>
  <div class="stack"><i style="width:${R / t * 100}%;background:var(--st-real)"></i><i style="width:${N / t * 100}%;background:var(--st-nreal)"></i><i style="width:${E / t * 100}%;background:var(--st-extra)"></i></div>
  ${edit || podeForaProg(area) ? `<div class="row-gap">${edit && items.length - done > 0 ? (UI.confirm === 'all' ? `<span class="confirm">Marcar as ${items.length - done} restantes como realizadas? <button class="btn pri sm" data-act="allok">Confirmar</button><button class="btn sm" data-act="cancel">Cancelar</button></span>` : '<button class="btn sm" data-act="askAll">✓ Marcar restantes</button>') : ''}${podeForaProg(area) ? `<button class="btn sm" data-act="foraProg">${I.plus} Fora da programação</button>` : ''}${edit ? `<button class="btn sm" data-act="qzNovo" title="Lançar queda zero (material recolhido)">${I.plus} Queda zero${totalDiaQZ(doc, k) ? ` · ${esc(fmtT(totalDiaQZ(doc, k)).replace(/ \(.*\)$/, ''))}` : ''}</button>` : ''}${apAqui ? `<button class="btn sm" data-act="aprvGrupo" data-k="${esc(add(UI.ini, k) + '|' + area + '|' + UI.aRota)}">${I.ok} Aprovar ${apAqui}</button>` : ''}</div>` : '<p class="muted small m0">Somente leitura nesta área.</p>'}</div>`;
  if (items.length && done === items.length) h += `<div class="card fimrota"><div class="body row-between"><span><b>Rota concluída.</b>${proxima ? ` Próxima com pendência: ${esc(proxima)} (${pendR(proxima)}).` : ' Nenhuma outra rota pendente neste dia.'}</span>${proxima ? `<button class="btn pri sm" data-arota="${esc(proxima)}">Ir para ${esc(proxima)}</button>` : ''}</div></div>`;
  if (ferDia(k)) h += `<p class="ferav"><b>Feriado · ${esc(ferDia(k))}</b> — dia sem operação. ${fers.length ? `${fers.length === 1 ? 'A atividade programada desta rota não conta' : `As ${fers.length} atividades programadas desta rota não contam`} como atrasada${fers.length === 1 ? '' : 's'} nem pendente${fers.length === 1 ? '' : 's'}.` : 'As atividades programadas não contam como atrasadas nem pendentes.'}</p>`;
  if (!items.length && !fers.length) h += `<div class="card"><div class="empty">Nada programado para esta rota em ${DAYS[k]}.${podeForaProg(area) ? ' Use “Fora da programação” para incluir uma atividade.' : ''}</div></div>`;
  // extras que o supervisor devolveu (saíram da lista): o líder vê o motivo e registra de novo se for o caso
  const exDev = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] === '_' && estAprov(doc, x.i, k) === 'dev');
  if (exDev.length) h += `<p class="aviso">${exDev.map(x => { const a = aprovDe(doc, x.p.id, k) || {}; return `Extra devolvida: <b>${esc(x.p.ativ)}</b> — ${esc(a.mot || '')}${a.nome ? ` (${esc(title(curto(a.nome)))})` : ''}`; }).join('<br>')}</p>`;
  h += '<div class="mlist">';
  for (const { i, p } of items) {
    const c = st(doc, i, k); const raw = doc.d[i][k]; const m = doc.m[p.id + '|' + k];
    const ea = estAprov(doc, i, k); const av = ea ? aprovDe(doc, p.id, k) || {} : null;
    const selo = ea === 'pend' ? ' · <span class="pill neu">aguardando aprovação</span>' : ea === 'ok' ? ' · <span class="pill ok">aprovada</span>' : ea === 'dev' ? ' · <span class="pill bad">devolvida</span>' : '';
    h += `<div class="act ${c}${ea === 'dev' ? ' devolvida' : ''}"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${esc(p.local)} · <span class="mono">${p.id}</span>${raw === 'E' ? ' · <span class="pill ext">extra</span>' : ''}${doc.fp && doc.fp[p.id + '|' + k] ? ` · <span class="pill ext" title="Incluída por ${esc(title(curto(doc.fp[p.id + '|' + k].nome || '')))}">fora da programação</span>${raw === 'P' && podeForaProg(area) ? ` <button class="btn ghost link" data-tirafp="${i}|${k}">tirar</button>` : ''}` : ''}${c === 'A' ? ' · <span class="pill warn">atrasada</span>' : ''}${selo}${seloFotos(doc, i, k)}</div>${raw === 'N' ? `<div class="m">${m ? `Justificativa: ${esc(m)}` : '<span class="semt">Sem justificativa</span>'}${edit ? ` <button class="btn ghost link" data-just="${i}|${k}">${m ? 'editar' : 'justificar'}</button>` : ''}</div>` : ''}${ea === 'dev' ? `<div class="m devm">Devolvida${av.nome ? ` por ${esc(title(curto(av.nome)))}` : ''}: ${esc(av.mot || '')}. Confira e aponte de novo.</div>` : ''}</div>
    ${edit ? `<div class="bt">${raw === 'E' ? `<button class="no-btn" data-ap="${i}|${k}|rmE" aria-label="Remover extra" title="Remover extra">✕</button>` : `<button class="ok-btn" data-ap="${i}|${k}|R" aria-pressed="${raw === 'R'}" aria-label="Realizada">✓</button><button class="no-btn" data-ap="${i}|${k}|N" aria-pressed="${raw === 'N'}" aria-label="Não realizada">✕</button>`}</div>` : `<span class="pill ${{ R: 'ok', E: 'ok', N: 'bad', A: 'warn' }[c] || 'neu'}">${{ R: 'Realizada', E: 'Extra', N: 'Não realizada', A: 'Atrasada', P: 'A fazer' }[c] || ST_NOME[c] || ''}</span>`}</div>`;
  }
  for (const { i, p } of fers) h += `<div class="act F"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${esc(p.local)} · <span class="mono">${p.id}</span> · <span class="pill neu">Feriado · ${esc(feriadoDe(doc, i, k))}</span></div></div><button class="btn ghost link" data-act="ferInfo" data-k="${i}|${k}">por quê?</button></div>`;
  return h + '</div>' + cartaoQZ(doc, k, edit);
}
acoes.ferInfo = (t, d) => { const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const [i, k] = String(d.k).split('|').map(Number); if (doc && doc.ids[i]) cellMenu(doc, i, k); };
const chipIc = c => `<span class="chip ${c}">${CHIP[c]}</span>`;
export function cellMenu(doc, i, k) {
  const p = PL.get(doc.ids[i]); const raw = doc.d[i][k]; const c = st(doc, i, k);
  const sub = `${esc(p.rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}<br>${esc(p.local)}`;
  const fp = doc.fp && doc.fp[p.id + '|' + k]; const pf = podeForaProg(doc.area);
  // Dia sem programação: coordenador e supervisor podem incluir a atividade fora da programação.
  if (raw === '_') {
    if (c === 'D') { toast('Dispensada na limpeza de dados: não conta como programada nem como pendência'); return; }
    if (c === 'F') {
      const info = { t: `Feriado · ${feriadoDe(doc, i, k)}`, d: 'Dia sem operação: a atividade não conta como programada, atrasada nem pendente', ic: chipIc('F'), larga: true };
      if (pf) return sheet(p.ativ, sub, [info, { t: 'Incluir fora da programação', d: 'Se houve operação nesta atividade: entra como "a fazer" e o líder aponta', v: 'FP', ic: chipIc('P') }], o => { if (o.v === 'FP') incluirFora(doc, i, k); });
      return sheet(p.ativ, sub, [info], () => {}, { fechar: 'Fechar' });
    }
    if (pf) return sheet(p.ativ, sub, [{ t: 'Incluir fora da programação', d: 'Entra no dia como "a fazer"; o líder aponta se foi feita', v: 'FP', ic: chipIc('P') }], () => incluirFora(doc, i, k));
    toast('Não programada neste dia'); return;
  }
  // Quem só acompanha (somente leitura, ou outra área) não aponta, mas vê por que a atividade não foi feita.
  if (!canEdit(doc.area)) {
    if (fp && raw === 'P' && pf) return sheet(p.ativ, sub + '<br>Incluída fora da programação', [{ t: 'Tirar da programação', d: 'O líder ainda não apontou', v: 'rmFP', ic: chipIc('X') }], () => tirarFora(doc, i, k));
    if (fotosDaCel(doc, p.id, k)) return verFotosCel(doc, i, k);
    if (c !== 'N') { toast(`${ST_NOME[c]} · seu perfil só acompanha esta área`); return; }
    const m = doc.m[p.id + '|' + k];
    return sheet(p.ativ, sub, [{ t: m || 'Sem justificativa registrada', d: 'Justificativa de por que não foi feita', ic: chipIc('N'), larga: true }], () => {}, { fechar: 'Fechar' });
  }
  const o = raw === 'E'
    ? [{ t: 'Remover extra', d: 'Registro antigo de atividade extra', v: '_', ic: chipIc('X') }]
    : [{ t: 'Realizado', v: 'R', ic: chipIc('R'), cur: raw === 'R' }, { t: 'Não realizado', d: 'Pede a justificativa', v: 'N', ic: chipIc('N'), cur: raw === 'N' }, { t: 'Programado', d: c === 'A' ? 'Continua atrasado' : 'Sem apontamento', v: 'P', ic: chipIc(c === 'A' ? 'A' : 'P'), cur: raw === 'P' },
      ...(fp && raw === 'P' && pf ? [{ t: 'Tirar da programação', d: 'Foi incluída fora da programação', v: 'rmFP', ic: chipIc('X') }] : [])];
  const nf = fotosDaCel(doc, p.id, k);
  if (nf || ('RNE'.includes(raw) && exigeFoto({ ...cfgF(), obrig: true }, raw, !!fp))) o.push({ t: nf ? `Ver as fotos (${nf})` : 'Adicionar foto', d: nf ? 'Miniaturas; toque para ver grande' : 'Esta atividade está sem foto', v: 'FOTOS', ic: `<span class="chip P fotoic">${I.cam}</span>`, larga: true });
  sheet(p.ativ, fp ? sub + '<br>Incluída fora da programação' : sub, o, x => (x.v === 'rmFP' ? tirarFora(doc, i, k) : x.v === 'FOTOS' ? verFotosCel(doc, i, k) : apply(doc, i, k, x.v)));
}
// Justificativa de por que a atividade não foi feita: um motivo da lista ou escrito pela pessoa (obrigatória).
export function pedirJustificativa(doc, i, k, ok) {
  const p = PL.get(doc.ids[i]); const atual = doc.m[p.id + '|' + k] || '';
  const sub = `${esc(p.ativ)} · ${esc(p.rota)} · ${DAYS[k]} ${ddmm(add(doc.ini, k))}${atual ? `<br>Agora: <b>${esc(atual)}</b>` : ''}`;
  sheet('Por que não foi feita?', sub, [...MOTIVOS.map(t => ({ t, cur: t === atual })), { t: 'Escrever a justificativa…', d: 'Explique com as suas palavras', outro: true, larga: true, cur: !!atual && !MOTIVOS.includes(atual) }], o => {
    if (!o.outro) return ok(o.t);
    formSheet('Justificativa', esc(p.ativ), `<label class="sel"><span>Por que não foi feita</span><textarea class="in" id="jsTxt" rows="6" maxlength="500" placeholder="Ex.: caminhão de vácuo quebrado desde as 8h">${MOTIVOS.includes(atual) ? '' : esc(atual)}</textarea></label><p class="muted small m0"><span id="jsCont">0</span> de 500 caracteres. O supervisor vê na Aprovação.</p>`, 'Salvar', async () => {
      const t = ($('jsTxt').value || '').replace(/\s+/g, ' ').trim(); if (t.length < 5) throw new Error('Escreva a justificativa (pelo menos 5 letras).');
      ok(t);
    });
    { const t = $('jsTxt'), n = $('jsCont'); if (t && n) { const f = () => { n.textContent = t.value.length; }; t.addEventListener('input', f); f(); } }
  }, { grade: false });
}
// fotos: já escolhidas no passo de fotos. Situação que exige foto abre o passo ANTES de concluir; cancelar não marca.
export function apply(doc, i, k, v, motivo, fotos) {
  if (v === 'N' && !motivo) return pedirJustificativa(doc, i, k, m => apply(doc, i, k, 'N', m));
  // cancelar: o botão marcado na hora (eventos.js) volta a mostrar a situação gravada
  const voltar = () => { document.querySelectorAll(`[data-ap^="${i}|${k}|"]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ap.endsWith('|' + doc.d[i][k])))); render(); };
  if (!fotos && canEdit(doc.area) && precisaFotos(doc, i, k, v)) return passoFotosCel(doc, i, k, v, imgs => apply(doc, i, k, v, motivo, montarFotos(doc, k, [i], imgs, v)), voltar);
  setSt(doc, i, k, v, motivo, fotos);
  toast(({ R: 'Marcada como realizada', N: 'Marcada como não realizada', P: 'Apontamento desfeito', E: 'Extra registrada', _: 'Extra removida' }[v] || 'Atualizado') + (fotos && fotos.length ? ` · ${fotos.length === 1 ? '1 foto' : fotos.length + ' fotos'}` : ''));
  desenharLogo();
}
// Com foto obrigatória, o passo de fotos já é a confirmação; sem foto, pergunta antes de marcar tudo.
acoes.askAll = (t, d) => {
  const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const k = UI.dia;
  const foto = doc && doc.ids.some((id, i) => { const p = PL.get(id); return p && p.rota === UI.aRota && doc.d[i][k] === 'P' && precisaFotos(doc, i, k, 'R'); });
  if (foto) return acoes.allok(t, d);
  UI.confirm = 'all'; render();
};
// Marcar restantes: um passo de fotos só para o lote; as mesmas fotos valem para todas as atividades marcadas agora
// (guardadas uma vez só, com refs de todas).
acoes.allok = (t, d) => {
  const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const k = UI.dia;
  if (!doc || !canEdit(doc.area)) return;
  const is = []; doc.ids.forEach((id, i) => { const p = PL.get(id); if (p && p.rota === UI.aRota && doc.d[i][k] === 'P') is.push(i); });
  if (!is.length) { UI.confirm = null; render(); return; }
  const rota = UI.aRota;
  const marcar = imgs => {
    const agora = is.filter(i => doc.d[i][k] === 'P'); if (!agora.length) { UI.confirm = null; render(); return; }
    const ch = agora.map(i => localChange(doc, i, k, 'R'));
    gravarApont(doc, ch, imgs && imgs.length ? montarFotos(doc, k, agora, imgs, 'R') : null);
    DB.log(`${rota} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}: ${ch.length} atividades marcadas como realizadas${imgs && imgs.length ? ` (${imgs.length === 1 ? '1 foto' : imgs.length + ' fotos'})` : ''}`);
    UI.confirm = null; toast(`${ch.length} atividades marcadas como realizadas${imgs && imgs.length ? ` · ${imgs.length === 1 ? '1 foto para todas' : imgs.length + ' fotos para todas'}` : ''}`); render();
  };
  if (!is.some(i => precisaFotos(doc, i, k, 'R'))) return marcar(null);
  passoFotos({ titulo: `Fotos das ${is.length} atividades`, sub: `${esc(rota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}<br>Marcar as ${is.length} restantes como realizadas`, cfg: cfgF(), tem: 0, lote: is.length, rotuloOk: `Marcar as ${is.length} como realizadas`, aoConfirmar: marcar, aoCancelar: () => render() });
};
acoes.foraProg = (t, d) => { const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; if (doc) escolherFora(doc, UI.dia, UI.aRota); };
