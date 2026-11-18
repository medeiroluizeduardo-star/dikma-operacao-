// Tela Apontar: o líder marca o que foi feito no dia (e a justificativa do que não foi).
import { AREA_S, DAYS, MOTIVOS, pd, add, ddmm } from '../contas/cal.js';
import { DB, TODAY, esc, title, $ } from '../nucleo/base.js';
import { PL, COLABS, AREAS, UI, admDe, myAreas, myArea, areaScope, canEdit, podeForaProg } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { st, feriadoDe, rotasDa, diasDe, localChange, setSt, incluirFora, tirarFora, escolherFora, areasAprov, aprovDe, estAprov, gravarApont, CHIP, ST_NOME } from '../calc/atividades.js';
import { curto, movDoDia } from '../calc/presenca.js';
import { partesRota } from '../contas/mover-rota.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, desenharLogo } from '../ui/shell.js';
import { precisaFotos, passoFotos, passoFotosCel, montarFotos, verFotosCel, verFotosLocal, cfgF } from './fotos.js';
import { exigeFoto, fotosDaCel } from '../contas/fotos.js';
import { resumoExec, agruparLocais, mesmoLocal, fotosDoLocal, SITUACAO } from '../contas/execucao.js';

/* ---------------- APONTAR ---------------- */
// O líder vê os locais/equipamentos da rota no dia; abre um local, marca no checklist o que foi feito e o que não foi
// (com a justificativa), junta as fotos do local e salva tudo de uma vez. Execução = feitas ÷ previstas (contas/execucao.js).
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
  const rRes = resumoExec(items.map(x => doc.d[x.i][k]), add(UI.ini, k) < TODAY);
  const apAqui = areasAprov().includes(area) ? items.filter(x => estAprov(doc, x.i, k) === 'pend').length : 0;
  let h = chipsArea + `<div class="dayscroll" role="group" aria-label="Dia">${DAYS.map((d, j) => { const dt = add(UI.ini, j); const fd = ferDia(j); return `<button class="dbtn ${dt === TODAY ? 'hoje' : ''}${fd ? ' fer' : ''}" data-dia="${j}" aria-pressed="${j === k}"${fd ? ` title="Feriado · ${esc(fd)}" aria-label="${d} ${dt.slice(8)} · feriado"` : ''}><small>${d}</small><b>${dt.slice(8)}</b></button>`; }).join('')}</div>
  <div class="rchips linha" role="group" aria-label="Rota">${rts.map(r => { const c = cnt(r), p = pendR(r); return `<button class="rchip" data-arota="${esc(r)}" aria-pressed="${r === UI.aRota}">${esc(r)}<span class="c num">${p ? p : c ? '✓' : '—'}</span></button>`; }).join('')}</div>
  <div class="apbar"><div class="row-between"><b>${esc(UI.aRota)}${varias ? ` · ${AREA_S[area]}` : ''} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}</b><span class="muted num">${!items.length && fers.length ? `Feriado · ${esc(ferDia(k))}` : `${rRes.pct == null ? '—' : rRes.pct + '% executado'} · ${done} de ${items.length} apontadas`}</span></div>
  <div class="stack"><i style="width:${R / t * 100}%;background:var(--st-real)"></i><i style="width:${N / t * 100}%;background:var(--st-nreal)"></i><i style="width:${E / t * 100}%;background:var(--st-extra)"></i></div>
  ${edit || podeForaProg(area) ? `<div class="row-gap">${podeForaProg(area) ? `<button class="btn sm" data-act="foraProg">${I.plus} Fora da programação</button>` : ''}${apAqui ? `<button class="btn sm" data-act="aprvGrupo" data-k="${esc(add(UI.ini, k) + '|' + area + '|' + UI.aRota)}">${I.ok} Aprovar ${apAqui}</button>` : ''}</div>` : '<p class="muted small m0">Somente leitura nesta área.</p>'}</div>`;
  if (items.length && done === items.length) h += `<div class="card fimrota"><div class="body row-between"><span><b>Rota concluída.</b>${proxima ? ` Próxima com pendência: ${esc(proxima)} (${pendR(proxima)}).` : ' Nenhuma outra rota pendente neste dia.'}</span>${proxima ? `<button class="btn pri sm" data-arota="${esc(proxima)}">Ir para ${esc(proxima)}</button>` : ''}</div></div>`;
  if (ferDia(k)) h += `<p class="ferav"><b>Feriado · ${esc(ferDia(k))}</b> — dia sem operação. ${fers.length ? `${fers.length === 1 ? 'A atividade programada desta rota não conta' : `As ${fers.length} atividades programadas desta rota não contam`} como atrasada${fers.length === 1 ? '' : 's'} nem pendente${fers.length === 1 ? '' : 's'}.` : 'As atividades programadas não contam como atrasadas nem pendentes.'}</p>`;
  if (!items.length && !fers.length) h += `<div class="card"><div class="empty">Nada programado para esta rota em ${DAYS[k]}.${podeForaProg(area) ? ' Use “Fora da programação” para incluir uma atividade.' : ''}</div></div>`;
  // extras que o supervisor devolveu (saíram da lista): o líder vê o motivo e registra de novo se for o caso
  const exDev = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] === '_' && estAprov(doc, x.i, k) === 'dev');
  if (exDev.length) h += `<p class="aviso">${exDev.map(x => { const a = aprovDe(doc, x.p.id, k) || {}; return `Extra devolvida: <b>${esc(x.p.ativ)}</b> — ${esc(a.mot || '')}${a.nome ? ` (${esc(title(curto(a.nome)))})` : ''}`; }).join('<br>')}</p>`;
  // Mover de rota no dia (Escala do dia): quem veio para esta rota e quem saiu dela neste dia (só as aprovadas).
  { const dt = add(UI.ini, k), rk = area + '|' + UI.aRota; const nm = v => { const c = COLABS.find(x => x.id === v.id); return c ? title(curto(c.nome)) : v.id; };
    const mv = movDoDia(dt).filter(v => v.st === 'aprovado' && (v.para === rk || v.de === rk));
    if (mv.length) h += `<p class="aviso">${mv.map(v => v.para === rk ? `<b>${esc(nm(v))}</b> veio da ${esc(partesRota(v.de).rota)} neste dia` : `<b>${esc(nm(v))}</b> foi para a ${esc(partesRota(v.para).rota)} neste dia`).join('<br>')}</p>`; }
  const grupos = agruparLocais(items.map(x => ({ ...x, local: x.p.local })));
  const aberto = UI.apLocal && grupos.find(g => mesmoLocal(g.local, UI.apLocal));
  if (aberto) return vLocal(doc, k, area, aberto, edit, varias);
  if (UI.apRasc) UI.apRasc = null; // saiu do local: o rascunho não salvo fica para trás (a tela já perguntou)
  if (grupos.length) h += `<p class="muted small m0 aplead">${grupos.length === 1 ? '1 local' : `${grupos.length} locais`} nesta rota. Toque no local para abrir o checklist${edit ? ', marcar o que foi feito e juntar as fotos' : ''}.</p>`;
  h += '<div class="lclista">';
  for (const g of grupos) {
    const r = resumoExec(g.itens.map(x => doc.d[x.i][k]), add(UI.ini, k) < TODAY); const sit = SITUACAO[r.situ];
    const nf = fotosDoLocal(g.itens.map(x => fotosDaCel(doc, x.p.id, k)));
    const pend = g.itens.filter(x => estAprov(doc, x.i, k) === 'pend').length, dev = g.itens.filter(x => estAprov(doc, x.i, k) === 'dev').length;
    const ext = g.itens.filter(x => doc.d[x.i][k] === 'E').length;
    h += `<button type="button" class="lcard ${r.situ === 'afazer' || r.situ === 'vazio' ? 'neu' : r.faixa}${dev ? ' devolvida' : ''}" data-act="apLocal" data-k="${esc(g.local)}" aria-label="${esc(g.local)}: ${r.feitas} de ${r.prev} feitas${r.pct == null ? '' : `, ${r.pct}%`}, ${sit.t}">
      <span class="lc-top"><b>${esc(g.local)}</b><span class="pill ${sit.c}">${sit.t}</span></span>
      <span class="lc-sub">${r.prev} atividade${r.prev === 1 ? '' : 's'}${ext ? ` · ${ext} extra${ext > 1 ? 's' : ''}` : ''}${nf ? ` · <span class="lc-foto">${I.cam}<span class="num">${nf}</span></span>` : ''}${pend ? ` · ${pend} aguardando aprovação` : ''}${dev ? ` · <b class="semt">${dev} devolvida${dev > 1 ? 's' : ''}</b>` : ''}</span>
      <span class="lc-bar"><span class="meter"><i style="width:${r.pct || 0}%"></i></span><span class="lc-p num">${r.pct == null ? '—' : r.pct + '%'}</span></span>
      <span class="lc-num num">${r.feitas} feita${r.feitas === 1 ? '' : 's'} · ${r.nao} não feita${r.nao === 1 ? '' : 's'} · ${r.pend} a fazer</span>
    </button>`;
  }
  return h + '</div>';
}
/* ---------------- checklist do local ---------------- */
// Rascunho do checklist: o que o líder marcou e ainda não salvou ({ chave, v: {i: R|N|P}, m: {i: motivo}, imgs: [] }).
const chaveLocal = (doc, k, local) => `${doc.id}|${k}|${String(local).trim().toUpperCase()}`;
function rascDe(doc, k, local) {
  const ch = chaveLocal(doc, k, local);
  if (!UI.apRasc || UI.apRasc.chave !== ch) UI.apRasc = { chave: ch, v: {}, m: {}, imgs: [] };
  return UI.apRasc;
}
const efetivo = (doc, k, r, i) => (r.v[i] != null ? r.v[i] : doc.d[i][k]);
const motivoDe = (doc, k, r, i) => (r.m[i] != null ? r.m[i] : doc.m[doc.ids[i] + '|' + k] || '');
// O que mudou em relação ao que está gravado (situação ou justificativa).
function mudancas(doc, k, r) {
  const out = [];
  for (const [si, v] of Object.entries(r.v)) {
    const i = +si; const ant = doc.d[i][k];
    if (ant === 'E' || ant === '_') continue;
    const m = v === 'N' ? motivoDe(doc, k, r, i) : null;
    if (v !== ant || (v === 'N' && m !== (doc.m[doc.ids[i] + '|' + k] || ''))) out.push({ i, v, m });
  }
  return out;
}
const sujo = (doc, k, r) => mudancas(doc, k, r).length > 0 || r.imgs.length > 0;
// Fotos exigidas para salvar o local: quando alguma atividade vai ficar numa situação que pede foto.
function fotosExigidas(doc, k, g, r) {
  const cfg = cfgF(); if (!cfg.obrig || diasDe(doc)[k] < cfg.desde) return 0;
  const pede = g.itens.some(x => { const v = efetivo(doc, k, r, x.i); return 'RN'.includes(v) && exigeFoto(cfg, v, !!(doc.fp && doc.fp[x.p.id + '|' + k])); });
  return pede ? cfg.min : 0;
}
const temFotos = (doc, k, g) => fotosDoLocal(g.itens.map(x => fotosDaCel(doc, x.p.id, k)));
const localAberto = () => {
  const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; const k = UI.dia; if (!doc || !UI.apLocal) return null;
  const itens = doc.ids.map((id, i) => ({ i, p: PL.get(id) })).filter(x => x.p && x.p.rota === UI.aRota && doc.d[x.i][k] !== '_' && mesmoLocal(x.p.local, UI.apLocal));
  return itens.length ? { doc, k, g: { local: itens[0].p.local, itens } } : null;
};
function vLocal(doc, k, area, g, edit, varias) {
  const r = rascDe(doc, k, g.local); const passou = add(UI.ini, k) < TODAY;
  const res = resumoExec(g.itens.map(x => efetivo(doc, k, r, x.i)), passou); const sit = SITUACAO[res.situ];
  const nSalvas = temFotos(doc, k, g); const exig = fotosExigidas(doc, k, g, r); const cfg = cfgF();
  const faltaF = Math.max(0, exig - nSalvas - r.imgs.length); const mud = mudancas(doc, k, r); const dirty = mud.length > 0 || r.imgs.length > 0;
  const pendAp = g.itens.filter(x => efetivo(doc, k, r, x.i) === 'P').length;
  let h = `<div class="apbar lchead"><div class="row-between"><button type="button" class="btn ghost sm" data-act="ckVoltar">← Locais da rota</button><span class="pill ${sit.c}">${sit.t}</span></div>
    <div><h2 class="lc-tit">${esc(g.local)}</h2><p class="muted small m0">${esc(UI.aRota)}${varias ? ` · ${AREA_S[area]}` : ''} · ${DAYS[k]} ${ddmm(add(UI.ini, k))} · ${res.prev} atividade${res.prev === 1 ? '' : 's'} previstas</p></div>
    <div class="lc-bar ${res.situ === 'afazer' ? '' : res.faixa}"><span class="meter"><i style="width:${res.pct || 0}%"></i></span><span class="lc-p num ${res.situ === 'afazer' ? '' : res.faixa}">${res.pct == null ? '—' : res.pct + '%'}</span></div>
    <p class="muted small m0 num">Execução: ${res.feitas} feita${res.feitas === 1 ? '' : 's'} de ${res.prev} · ${res.nao} não feita${res.nao === 1 ? '' : 's'} · ${res.pend} a fazer</p>
    ${UI.confirm === 'sairLocal' ? `<p class="confirm m0">Sair sem salvar o que você marcou? <button class="btn sm" data-act="ckDescartar">Sair sem salvar</button><button class="btn sm pri" data-act="ckSalvar">Salvar</button></p>` : ''}</div>`;
  h += `<div class="card"><header><h2>Checklist das atividades</h2><p>${edit ? 'Marque ✓ feita ou ✕ não feita (pede a justificativa)' : 'Somente leitura nesta área'}</p>${edit && pendAp ? `<span class="r"><button class="btn sm" data-act="ckTudo">${I.ok} Tudo feito</button></span>` : ''}</header><div class="body"><div class="mlist cklist">`;
  for (const { i, p } of g.itens) {
    const raw = doc.d[i][k]; const v = efetivo(doc, k, r, i); const c = v === 'P' && passou ? 'A' : v; const m = motivoDe(doc, k, r, i);
    const ea = estAprov(doc, i, k); const av = ea ? aprovDe(doc, p.id, k) || {} : null; const fp = doc.fp && doc.fp[p.id + '|' + k];
    const alterada = r.v[i] != null && (v !== raw || (v === 'N' && m !== (doc.m[p.id + '|' + k] || '')));
    const selo = alterada ? ' · <span class="pill neu">não salvo</span>' : ea === 'pend' ? ' · <span class="pill neu">aguardando aprovação</span>' : ea === 'ok' ? ' · <span class="pill ok">aprovada</span>' : ea === 'dev' ? ' · <span class="pill bad">devolvida</span>' : '';
    h += `<div class="act ${c}${ea === 'dev' && !alterada ? ' devolvida' : ''}"><div class="minw"><div class="t">${esc(p.ativ)}</div><div class="l">${p.tipo ? esc(title(p.tipo)) + ' · ' : ''}<span class="mono">${p.id}</span>${raw === 'E' ? ' · <span class="pill ext">extra</span>' : ''}${fp ? ` · <span class="pill ext" title="Incluída por ${esc(title(curto(fp.nome || '')))}">fora da programação</span>${raw === 'P' && v === 'P' && podeForaProg(area) ? ` <button class="btn ghost link" data-tirafp="${i}|${k}">tirar</button>` : ''}` : ''}${c === 'A' ? ' · <span class="pill warn">atrasada</span>' : ''}${selo}</div>${v === 'N' ? `<div class="m">${m ? `Justificativa: ${esc(m)}` : '<span class="semt">Sem justificativa</span>'}${edit ? ` <button class="btn ghost link" data-act="ckJust" data-k="${i}">${m ? 'editar' : 'justificar'}</button>` : ''}</div>` : ''}${ea === 'dev' && !alterada ? `<div class="m devm">Devolvida${av.nome ? ` por ${esc(title(curto(av.nome)))}` : ''}: ${esc(av.mot || '')}. Confira e aponte de novo.</div>` : ''}</div>
    ${edit ? `<div class="bt">${raw === 'E' ? `<button class="no-btn" data-ap="${i}|${k}|rmE" aria-label="Remover extra" title="Remover extra">✕</button>` : `<button class="ok-btn" data-act="ckR" data-k="${i}" aria-pressed="${v === 'R'}" aria-label="Feita">✓</button><button class="no-btn" data-act="ckN" data-k="${i}" aria-pressed="${v === 'N'}" aria-label="Não feita">✕</button>`}</div>` : `<span class="pill ${{ R: 'ok', E: 'ok', N: 'bad', A: 'warn' }[c] || 'neu'}">${{ R: 'Feita', E: 'Extra', N: 'Não feita', A: 'Atrasada', P: 'A fazer' }[c] || ST_NOME[c] || ''}</span>`}</div>`;
  }
  h += '</div></div></div>';
  // Fotos do local: valem para todas as atividades do local no dia (guardadas uma vez só).
  const maxNovas = Math.max(0, cfg.max - nSalvas - r.imgs.length);
  h += `<div class="card"><header><h2>Fotos do local</h2><p>${exig ? `Obrigatória: pelo menos ${exig} foto${exig > 1 ? 's' : ''} do local` : 'Opcional: comprove o local com foto'} · máximo ${cfg.max}</p>${nSalvas ? `<span class="r"><button class="btn sm" data-act="ckVerFotos">${I.cam} Ver as ${nSalvas} salva${nSalvas > 1 ? 's' : ''}</button></span>` : ''}</header><div class="body">
    ${r.imgs.length ? `<div class="sgfotos">${r.imgs.map((f, j) => `<div class="sgfth"><img src="${f.thumb}" alt="Foto nova ${j + 1}"><button type="button" class="btn sm ghost" data-act="ckFotoRm" data-k="${j}" aria-label="Tirar a foto nova ${j + 1}">✕</button></div>`).join('')}</div>` : ''}
    ${edit ? `<div class="row-gap">${maxNovas ? `<button type="button" class="btn" data-act="ckFoto">${I.cam} ${r.imgs.length || nSalvas ? 'Mais fotos' : 'Tirar foto do local'}</button>` : '<span class="muted small">Chegou ao máximo de fotos.</span>'}${r.imgs.length ? `<span class="muted small">${r.imgs.length} foto${r.imgs.length > 1 ? 's' : ''} nova${r.imgs.length > 1 ? 's' : ''}: sobe${r.imgs.length > 1 ? 'm' : ''} ao salvar</span>` : ''}</div>` : nSalvas ? '' : '<p class="muted small m0">Nenhuma foto neste local.</p>'}
    ${faltaF && edit ? `<p class="fcont falta m0">Falta${faltaF > 1 ? 'm' : ''} ${faltaF} foto${faltaF > 1 ? 's' : ''} do local para salvar.</p>` : ''}</div></div>`;
  if (edit) h += `<div class="lcsalvar"><button type="button" class="btn pri" data-act="ckSalvar"${!dirty || faltaF ? ' disabled' : ''}>Salvar apontamento do local</button><span class="muted small">${dirty ? `${mud.length ? `${mud.length} mudança${mud.length > 1 ? 's' : ''}` : ''}${mud.length && r.imgs.length ? ' e ' : ''}${r.imgs.length ? `${r.imgs.length} foto${r.imgs.length > 1 ? 's' : ''}` : ''} para salvar` : 'Tudo salvo'}</span></div>`;
  return h;
}
const comLocal = f => (t, d) => { const x = localAberto(); if (!x || !canEdit(x.doc.area)) return; const r = rascDe(x.doc, x.k, x.g.local); f(x, r, d); };
acoes.apLocal = (t, d) => { UI.apLocal = d.k; UI.apRasc = null; UI.confirm = null; render(); scrollTo(0, 0); };
acoes.ckVoltar = () => { const x = localAberto(); if (x && canEdit(x.doc.area) && UI.apRasc && sujo(x.doc, x.k, UI.apRasc)) { UI.confirm = 'sairLocal'; render(); return; } UI.apLocal = null; UI.apRasc = null; UI.confirm = null; render(); };
acoes.ckDescartar = () => { UI.apLocal = null; UI.apRasc = null; UI.confirm = null; render(); };
acoes.ckR = comLocal(({ doc, k }, r, d) => { const i = +d.k; r.v[i] = efetivo(doc, k, r, i) === 'R' ? 'P' : 'R'; UI.confirm = null; render(); });
acoes.ckN = comLocal(({ doc, k }, r, d) => {
  const i = +d.k; if (efetivo(doc, k, r, i) === 'N') { r.v[i] = 'P'; UI.confirm = null; render(); return; }
  pedirJustificativa(doc, i, k, m => { r.v[i] = 'N'; r.m[i] = m; UI.confirm = null; render(); }, motivoDe(doc, k, r, i));
});
acoes.ckJust = comLocal(({ doc, k }, r, d) => { const i = +d.k; pedirJustificativa(doc, i, k, m => { r.v[i] = 'N'; r.m[i] = m; render(); }, motivoDe(doc, k, r, i)); });
acoes.ckTudo = comLocal(({ doc, k, g }, r) => { let n = 0; for (const x of g.itens) if (doc.d[x.i][k] !== 'E' && efetivo(doc, k, r, x.i) === 'P') { r.v[x.i] = 'R'; n++; } toast(n === 1 ? '1 atividade marcada como feita · falta salvar' : `${n} atividades marcadas como feitas · falta salvar`); render(); });
acoes.ckFotoRm = comLocal((x, r, d) => { r.imgs.splice(+d.k, 1); render(); });
acoes.ckVerFotos = () => { const x = localAberto(); if (x) verFotosLocal(x.doc, x.g.itens.map(y => y.i), x.k, x.g.local); };
acoes.ckFoto = comLocal(({ doc, k, g }, r) => {
  const cfg = cfgF(); const tem = temFotos(doc, k, g) + r.imgs.length; const exig = fotosExigidas(doc, k, g, r);
  passoFotos({ titulo: 'Fotos do local', sub: `<b>${esc(g.local)}</b><br>${esc(UI.aRota)} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}`, cfg: { obrig: true, min: Math.max(1, exig - tem), max: cfg.max }, tem, lote: g.itens.length > 1 ? g.itens.length : 0, rotuloOk: 'Juntar ao local',
    aoConfirmar: imgs => { if (UI.apRasc === r) r.imgs.push(...imgs); render(); }, aoCancelar: () => render() });
});
acoes.ckSalvar = comLocal(({ doc, k, g }, r) => {
  const mud = mudancas(doc, k, r);
  if (!mud.length && !r.imgs.length) { UI.apLocal = null; UI.apRasc = null; UI.confirm = null; render(); return; }
  const falta = fotosExigidas(doc, k, g, r) - temFotos(doc, k, g) - r.imgs.length;
  if (falta > 0) { UI.confirm = null; toast(`Falta${falta > 1 ? 'm' : ''} ${falta} foto${falta > 1 ? 's' : ''} do local para salvar`); render(); return; }
  if (mud.some(x => x.v === 'N' && !x.m)) { toast('Falta a justificativa de uma atividade não feita'); render(); return; }
  const ch = mud.map(x => localChange(doc, x.i, k, x.v, x.m));
  const fotos = r.imgs.length ? montarFotos(doc, k, g.itens.map(x => x.i), r.imgs, 'R') : null;
  gravarApont(doc, ch, fotos);
  const res = resumoExec(g.itens.map(x => doc.d[x.i][k]), add(UI.ini, k) < TODAY);
  const nR = mud.filter(x => x.v === 'R').length, nN = mud.filter(x => x.v === 'N').length;
  DB.log(`${g.local} · ${UI.aRota} · ${DAYS[k]} ${ddmm(add(UI.ini, k))}: checklist salvo (${nR} feita${nR === 1 ? '' : 's'}, ${nN} não feita${nN === 1 ? '' : 's'}${r.imgs.length ? `, ${r.imgs.length} foto${r.imgs.length > 1 ? 's' : ''}` : ''}) · execução ${res.pct == null ? '—' : res.pct + '%'}`, 'operacao');
  toast(`${g.local}: salvo · execução ${res.pct == null ? '—' : res.pct + '%'}${r.imgs.length ? ` · ${r.imgs.length === 1 ? '1 foto' : r.imgs.length + ' fotos'}` : ''}`);
  UI.apLocal = null; UI.apRasc = null; UI.confirm = null; desenharLogo(); render(); scrollTo(0, 0);
});
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
  if (nf || 'RNE'.includes(raw)) o.push({ t: nf ? `Ver as fotos (${nf})` : 'Adicionar foto', d: nf ? 'Miniaturas; toque para ver grande' : exigeFoto(cfgF(), raw, !!fp) ? 'Esta atividade está sem foto' : 'Opcional: se quiser, comprove com foto', v: 'FOTOS', ic: `<span class="chip P fotoic">${I.cam}</span>`, larga: true });
  sheet(p.ativ, fp ? sub + '<br>Incluída fora da programação' : sub, o, x => (x.v === 'rmFP' ? tirarFora(doc, i, k) : x.v === 'FOTOS' ? verFotosCel(doc, i, k) : apply(doc, i, k, x.v)));
}
// Justificativa de por que a atividade não foi feita: um motivo da lista ou escrito pela pessoa (obrigatória).
export function pedirJustificativa(doc, i, k, ok, agora) {
  const p = PL.get(doc.ids[i]); const atual = agora != null ? agora : doc.m[p.id + '|' + k] || '';
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
acoes.foraProg = (t, d) => { const doc = DB.cache.semanas[apArea() + '|' + UI.ini]; if (doc) escolherFora(doc, UI.dia, UI.aRota); };
