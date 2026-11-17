// Dikma Gestão — Segurança › Inspeções (vindas do Campo do Meu painel): 5S, segurança e limpeza e qualidade da área.
// Cada item recebe OK, Não OK ou N/A; a nota é OK ÷ itens avaliados. Os itens "Não OK" viram anomalias na fila da
// Segurança (Anomalias), onde ganham responsável e prazo no acompanhamento. As contas ficam em contas/inspecoes.js e o
// banco em data.js (seginsp). Criada por telas/seguranca.js, que passa as peças comuns do módulo (folha, filtros...).
import { TIPOS_INSP, RESP_INSP, MAX_OBS_ITEM, nomeTipoInsp, itensNovos, notaInsp, faixaNota, naoOk, semAnomalia, faltaInsp, anomDaInsp, resumoInsp } from '../contas/inspecoes.js';
import { conjDaArea, editaProprio, normNomeSeg } from '../contas/segcalc.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, esc, title, $ } from '../nucleo/base.js';
import { ME, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast, formSheet } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';

// c = { U, S, L, folha(opções, ação), selMes, selArea, busca, vazio, mesNome, dm, quemVe, podeRegistrar, podeExportar,
//       minhaMat, sugestoesLocal(area), abrirAnom(id), hoje() }
export function criarInspecoes(c) {
  const { U, S, L } = c;
  const lista = () => S().insp || [];
  const pillNota = n => `<span class="pill ${faixaNota(n)} num">${n == null ? '—' : n + '%'}</span>`;
  const anomDe = id => (S().anom || []).find(a => a.id === id);
  if (!TIPOS_INSP[U.itipo] && U.itipo !== '') U.itipo = '';

  // ---------- tela: números do mês e a lista ----------
  function view() {
    DB.segWatch([U.mes]);
    const doMes = lista().filter(x => x.mes === U.mes && (!U.area || x.area === U.area));
    const l = doMes.filter(x => (!U.itipo || x.tipo === U.itipo) && casaQ(x)).sort((a, b) => b.data.localeCompare(a.data) || (+b.em || 0) - (+a.em || 0));
    const r = resumoInsp(doMes);
    let h = `<div class="filters">${c.selMes('sgMes', U.mes)}${c.selArea()}
      <label class="sel"><span>Tipo</span><select class="in" id="sgITipo"><option value="">Todos</option>${Object.entries(TIPOS_INSP).map(([k, t]) => `<option value="${k}" ${U.itipo === k ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></label>
      ${c.busca('Local, item, observação…')}
      ${c.podeExportar() ? `<button class="btn" data-act="sgIExp" style="align-self:flex-end">${I.dl} Exportar</button>` : ''}
      ${c.podeRegistrar() ? `<button class="btn pri" data-act="sgINova" style="align-self:flex-end">${I.plus} Nova inspeção</button>` : ''}</div>`;
    h += `<div class="kpis">
      <div class="kpi hero"><span class="lbl">Inspeções no mês</span><span class="v num">${r.n}</span><span class="s">${c.mesNome(U.mes)} · ${c.quemVe()}</span></div>
      ${Object.entries(TIPOS_INSP).map(([k, t]) => { const p = r.porTipo[k]; return `<div class="kpi"><span class="lbl">Nota ${esc(t.nome === 'Limpeza e qualidade da área' ? 'da área' : t.nome)}</span><span class="v num">${p.media == null ? '—' : p.media + '%'}</span><span class="s">${p.n ? `média de ${p.n} inspeç${p.n > 1 ? 'ões' : 'ão'}` : 'nenhuma no mês'}</span></div>`; }).join('')}
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Fora do padrão</span><span class="v num">${r.naoOk}</span><span class="s">${r.naoOk ? `${r.anomalias} viraram anomalia` : 'nenhum item Não OK'}</span></div></div>`;
    if (!l.length) return h + `<div class="card">${c.vazio(doMes.length ? 'Nada encontrado com estes filtros' : `Nenhuma inspeção em ${c.mesNome(U.mes)}`, doMes.length ? 'Mude o tipo ou a busca.' : c.podeRegistrar() ? 'Faça a primeira pelo botão Nova inspeção: marque OK, Não OK ou N/A em cada item.' : 'As inspeções aparecem aqui assim que forem feitas.', !doMes.length && c.podeRegistrar() ? `<button class="btn pri" data-act="sgINova">${I.plus} Nova inspeção</button>` : '')}</div>`;
    h += `<div class="card"><div class="tw"><table class="tcard sgtab"><thead><tr><th>Data</th><th>Inspeção</th><th>Fora do padrão</th><th>Nota</th><th></th></tr></thead><tbody>
      ${l.map(x => { const no = naoOk(x.itens); const sem = semAnomalia(x.itens).length; return `<tr><td data-l="Data" class="nowrap">${c.dm(x.data)}</td>
        <td class="tc-t"><b>${esc(nomeTipoInsp(x.tipo))} · ${esc(x.local)}</b><small class="muted"> · ${esc(x.area)}</small></td>
        <td class="tc-full" data-l="Fora do padrão">${no.length ? `${no.map(i => `<span class="pill bad">${esc(i.t.split(':')[0])}</span>`).join(' ')}${sem ? ` <span class="muted small">${sem} sem anomalia</span>` : ''}` : '<span class="muted small">Tudo no padrão</span>'}</td>
        <td data-l="Nota">${pillNota(notaInsp(x.itens))}</td>
        <td class="tc-acao r"><button class="btn sm" data-act="sgIVer" data-id="${esc(x.id)}">Abrir</button></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    return h;
  }
  function casaQ(x) {
    const q = normNomeSeg(U.q); if (!q) return true;
    const t = normNomeSeg([x.local, x.area, x.obs, nomeTipoInsp(x.tipo), ...(x.itens || []).flatMap(i => [i.t, i.obs])].join(' '));
    return q.split(' ').every(p => t.includes(p));
  }

  // ---------- formulário (nova ou correção do autor, por 24 h) ----------
  let E = null; // { id, tipo, itens, reg }
  const linhaItem = (i, k) => `<div class="insp-i r-${i.r || 'nada'}" id="ii_${k}"><div class="insp-t">${esc(i.t)}${i.anom ? ' <span class="pill neu">anomalia aberta</span>' : ''}</div>
    <div class="sgops insp-r" role="radiogroup" aria-label="${esc(i.t)}">${RESP_INSP.map(([v, n]) => `<label class="sgop"><input type="radio" name="ir_${k}" value="${v}" ${i.r === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
    <input class="in" id="io_${k}" maxlength="${MAX_OBS_ITEM}" value="${esc(i.obs || '')}" placeholder="${i.r === 'no' ? 'O que está fora do padrão? (obrigatório)' : 'Observação (se quiser)'}" aria-label="Observação do item"></div>`;
  function lerItens() {
    if (!E) return [];
    return E.itens.map((i, k) => { const x = document.querySelector(`input[name="ir_${k}"]:checked`); const o = $('io_' + k); return { ...i, r: x ? x.value : '', obs: o ? o.value.trim().slice(0, MAX_OBS_ITEM) : i.obs || '' }; });
  }
  const valRadio = n => { const x = document.querySelector(`input[name="${n}"]:checked`); return x ? x.value : ''; };
  function pintarResumo() {
    const it = lerItens(); const n = notaInsp(it); const novos = semAnomalia(it).length;
    const nt = $('iNota'); if (nt) nt.innerHTML = `Nota ${pillNota(n)}`;
    it.forEach((i, k) => { const row = $('ii_' + k); if (row) row.className = `insp-i r-${i.r || 'nada'}`; const o = $('io_' + k); if (o) o.placeholder = i.r === 'no' ? 'O que está fora do padrão? (obrigatório)' : 'Observação (se quiser)'; });
    const g = $('iGera'); if (g) { g.hidden = !novos; const t = $('iGeraT'); if (t) t.textContent = novos === 1 ? '1 item fora do padrão vira anomalia' : `${novos} itens fora do padrão viram anomalias`; }
    const b = $('iSalvar'); if (b) b.textContent = novos ? `Salvar e abrir ${novos === 1 ? '1 anomalia' : novos + ' anomalias'}` : E && E.reg ? 'Salvar correção' : 'Salvar inspeção';
  }
  function abrirForm(reg, tipo0) {
    if (!reg && !c.podeRegistrar()) { toast('Seu perfil não registra na Segurança'); return; }
    const tipo = reg ? reg.tipo : TIPOS_INSP[tipo0] ? tipo0 : TIPOS_INSP[U.itipo] ? U.itipo : 's5';
    E = { id: reg ? reg.id : '', tipo, itens: reg ? reg.itens.map(i => ({ ...i })) : itensNovos(tipo), reg: reg || null };
    const v = reg || { data: c.hoje(), area: U.area || (L().areas.length === 1 ? L().areas[0].nome : ''), local: '', obs: '' };
    const cfg = L();
    const corpo = `${reg ? '<p class="muted small m0">Correção da sua inspeção: vale por 24 horas depois de salva. Os itens que já viraram anomalia continuam na fila.</p>' : '<p class="muted small m0">Marque OK, Não OK ou N/A em cada item. O que estiver Não OK vira anomalia na fila da Segurança.</p>'}
      <div class="sgq"><div class="sgq-rot"><span class="minw"><b>TIPO DE INSPEÇÃO</b></span></div><div class="sgops" role="radiogroup" aria-label="Tipo de inspeção">${Object.entries(TIPOS_INSP).map(([k, t]) => `<label class="sgop"><input type="radio" name="iTipo" value="${k}" ${k === tipo ? 'checked' : ''} ${reg ? 'disabled' : ''}><span>${esc(t.nome)}</span></label>`).join('')}</div></div>
      <div class="sgq"><div class="sgq-rot"><span class="minw"><b>DATA, ÁREA E LOCAL</b><span class="obr"> *</span></span></div>
        <div class="insp-cab"><label class="sel"><span>Data</span><input class="in" type="date" id="iData" value="${esc(v.data)}" max="${c.hoje()}"></label>
        <label class="sel"><span>Local</span><input class="in" id="iLocal" list="iLocais" maxlength="120" value="${esc(v.local)}" placeholder="Ex.: Correia C5613A, Torre 2" autocomplete="off"><datalist id="iLocais"></datalist></label></div>
        <div class="sgops" role="radiogroup" aria-label="Área">${cfg.areas.map(a => `<label class="sgop"><input type="radio" name="iArea" value="${esc(a.nome)}" ${a.nome === v.area ? 'checked' : ''}><span>${esc(a.nome)}</span></label>`).join('')}</div></div>
      <div class="insp-topo"><b>Itens</b><span id="iNota"></span></div>
      <div class="insp-l" id="iItens">${E.itens.map(linhaItem).join('')}</div>
      <div class="sgq insp-gera" id="iGera" hidden><div class="sgq-rot"><span class="minw"><b id="iGeraT"></b><small>Cada uma entra em Segurança › Anomalias como aberta; o responsável e o prazo são definidos no acompanhamento.</small></span></div>
        <div class="sgops" role="radiogroup" aria-label="Regime de trabalho">${cfg.regimes.map((x, k) => `<label class="sgop"><input type="radio" name="iRegime" value="${esc(x)}" ${k === 0 ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>
        <label class="sel"><span>Sua matrícula (vai na anomalia)</span><input class="in" id="iMat" inputmode="numeric" maxlength="30" value="${esc(c.minhaMat())}"></label></div>
      <label class="sel"><span>Observações gerais (se quiser)</span><textarea class="in" id="iObs" rows="2" maxlength="2000">${esc(v.obs || '')}</textarea></label>`;
    const rodape = `<p class="err" id="iErr" role="alert" hidden></p><div class="row-gap"><button class="btn pri big" type="submit" id="iSalvar">Salvar inspeção</button><button class="btn" type="button" data-sgclose>Cancelar</button></div>`;
    const fo = c.folha({ titulo: reg ? 'Corrigir inspeção' : 'Nova inspeção', sub: reg ? `${dataBR(reg.data)} · ${esc(reg.local)}` : 'Segurança', corpo, rodape, form: true, aoFechar: () => { E = null; } }, null);
    const el = fo.el;
    const locais = () => { const dl = $('iLocais'); if (dl) dl.innerHTML = c.sugestoesLocal(valRadio('iArea')).map(x => `<option value="${esc(x)}"></option>`).join(''); };
    locais(); pintarResumo();
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'iTipo' && !E.reg) {
        const antes = lerItens(); if (antes.some(i => i.r || i.obs)) toast('Itens trocados para o tipo escolhido');
        E.tipo = t.value; E.itens = itensNovos(t.value); $('iItens').innerHTML = E.itens.map(linhaItem).join('');
      }
      if (t.name === 'iArea') locais();
      pintarResumo();
    });
    el.addEventListener('input', e => { if (/^io_/.test(e.target.id)) pintarResumo(); });
    el.onsubmit = e => { e.preventDefault(); salvar(fo); };
    if (!isMobile()) { const p = $('iLocal'); if (p) p.focus(); }
  }
  function salvar(fo) {
    if (!E) return;
    const area = valRadio('iArea');
    const dados = { tipo: E.tipo, data: ($('iData') || {}).value || '', area, conj: conjDaArea(S().cfg, area), local: (($('iLocal') || {}).value || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 120), itens: lerItens(), obs: (($('iObs') || {}).value || '').trim().slice(0, 2000) };
    const falta = faltaInsp(dados, c.hoje());
    const novos = semAnomalia(dados.itens);
    const mat = (($('iMat') || {}).value || '').trim();
    if (novos.length && !mat) falta.push('Preencha a sua matrícula (vai nas anomalias).');
    const er = $('iErr');
    if (falta.length) { er.textContent = falta.join(' '); er.hidden = false; const k = dados.itens.findIndex(i => !i.r || (i.r === 'no' && !i.obs)); const row = k >= 0 ? $('ii_' + k) : novos.length && !mat ? $('iMat') : null; if (row) { row.scrollIntoView({ block: 'center' }); if (row.id === 'iMat') row.focus({ preventScroll: true }); } return; }
    er.hidden = true;
    dados.mes = dados.data.slice(0, 7); dados.nota = notaInsp(dados.itens);
    const extra = { hora: new Date().toTimeString().slice(0, 5), regime: valRadio('iRegime') || L().regimes[0], comunic: title(ME.nome || ME.login || '').toUpperCase(), mat };
    const anoms = dados.itens.map((i, k) => ({ i, k })).filter(x => x.i.r === 'no' && !x.i.anom).map(x => ({ i: x.k, dados: anomDaInsp({ ...dados, id: E.id }, x.i, extra) }));
    try { localStorage.setItem('dikma-seg-mat|' + ME.uid, mat); } catch (e) { /* ignora */ }
    const offline = !navigator.onLine;
    DB.segInspSalvar(E.id, dados, anoms);
    DB.log && DB.log(`Segurança: ${E.reg ? 'corrigiu' : 'fez'} uma inspeção de ${nomeTipoInsp(dados.tipo)} em ${dataBR(dados.data)} (${dados.local})${anoms.length ? ` e abriu ${anoms.length} anomalia${anoms.length > 1 ? 's' : ''}` : ''}`, 'seguranca');
    toast(`${E.reg ? 'Correção salva' : 'Inspeção salva'}${anoms.length ? ` · ${anoms.length} anomalia${anoms.length > 1 ? 's' : ''} na fila` : ''}${offline ? ' · sobe quando o sinal voltar' : ''}`);
    if (dados.mes !== U.mes) { U.mes = dados.mes; DB.segWatch([U.mes]); }
    fo.fechar(); render();
  }

  // ---------- detalhe ----------
  function abrirDetalhe(id) {
    const x = lista().find(y => y.id === id); if (!x) { toast('Inspeção não encontrada'); return; }
    const n = notaInsp(x.itens);
    const rot = { ok: '<span class="pill ok">OK</span>', no: '<span class="pill bad">Não OK</span>', na: '<span class="pill neu">N/A</span>' };
    const corpo = `<div class="insp-topo"><b>${esc(nomeTipoInsp(x.tipo))}</b><span>Nota ${pillNota(n)}</span></div>
      <div class="insp-l">${(x.itens || []).map(i => { const a = i.anom && anomDe(i.anom); return `<div class="insp-i r-${i.r || 'nada'}"><div class="insp-t">${esc(i.t)}</div><div>${rot[i.r] || '<span class="muted small">Sem resposta</span>'}</div>${i.obs ? `<div class="small">${esc(i.obs)}</div>` : ''}${i.anom ? (a ? `<button type="button" class="btn sm" data-sgf="anom" data-id="${esc(i.anom)}">Ver anomalia</button>` : '<span class="muted small">Virou anomalia</span>') : i.r === 'no' ? '<span class="muted small">Sem anomalia</span>' : ''}</div>`; }).join('')}</div>
      ${x.obs ? `<p class="m0"><b>Observações:</b> ${esc(x.obs).replace(/\n/g, '<br>')}</p>` : ''}
      <p class="muted small m0">Feita por ${esc(title(x.porNome || ''))}${x.em ? ' em ' + new Date(+x.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}.</p>`;
    let bt = '';
    if (editaProprio(ME, x, Date.now(), false)) bt += '<button type="button" class="btn" data-sgf="editar">Corrigir</button>';
    if (isAdmin()) bt += '<button type="button" class="btn danger" data-sgf="excluir">Excluir</button>';
    const fo = c.folha({ titulo: 'Inspeção', sub: `${dataBR(x.data)} · ${esc(x.area)} · ${esc(x.local)}`, corpo, rodape: `<div class="row-gap">${bt}<button type="button" class="btn" data-sgclose>Fechar</button></div>` }, b => {
      if (b.dataset.sgf === 'anom') { fo.fechar(); c.abrirAnom(b.dataset.id); }
      if (b.dataset.sgf === 'editar') { fo.fechar(); abrirForm(x); }
      if (b.dataset.sgf === 'excluir') { fo.fechar(); excluir(x); }
    });
  }
  function excluir(x) {
    if (!isAdmin()) return;
    const n = naoOk(x.itens).filter(i => i.anom).length;
    formSheet('Excluir inspeção', `${dataBR(x.data)} · ${esc(x.area)} · ${esc(x.local)}`,
      `<p class="m0">A inspeção sai do sistema e não dá para desfazer.${n ? ` As ${n === 1 ? 'anomalia aberta por ela continua' : n + ' anomalias abertas por ela continuam'} na fila.` : ''}</p>`,
      'Excluir', async () => { await DB.segExcluir('seginsp', x); DB.log && DB.log(`Segurança: excluiu uma inspeção de ${dataBR(x.data)}`, 'seguranca'); toast('Inspeção excluída'); render(); });
    const b = document.querySelector('#fSheet [type=submit]'); if (b) { b.classList.remove('pri'); b.classList.add('perigo'); }
  }

  // ---------- Excel: uma linha por item ----------
  async function exportar() {
    const l = lista().filter(x => x.mes === U.mes && (!U.area || x.area === U.area) && (!U.itipo || x.tipo === U.itipo)).sort((a, b) => a.data.localeCompare(b.data));
    const cab = ['Data', 'Tipo', 'Área', 'Local', 'Nota (%)', 'Item', 'Resultado', 'Observação do item', 'Virou anomalia', 'Observações gerais', 'Feita por'];
    const res = { ok: 'OK', no: 'Não OK', na: 'N/A' };
    const linhas = l.flatMap(x => (x.itens || []).map(i => [dataBR(x.data), nomeTipoInsp(x.tipo), x.area, x.local, notaInsp(x.itens) ?? '', i.t, res[i.r] || '', i.obs || '', i.anom ? 'Sim' : '', x.obs || '', title(x.porNome || '')]));
    try { await baixarExcel(`Inspeções ${U.mes}`, [{ nome: 'Inspeções', linhas: [cab, ...linhas] }]); toast('Planilha baixada'); } catch (e) { toast('Não foi possível gerar a planilha agora'); }
  }

  acoes.sgINova = () => abrirForm(null);
  acoes.sgIVer = (t, d) => abrirDetalhe(d.id);
  acoes.sgIExp = () => exportar();
  document.addEventListener('change', e => { if (e.target.id === 'sgITipo') { U.itipo = e.target.value; render(); } });
  return { view };
}
