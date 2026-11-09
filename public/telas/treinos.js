// Dikma Gestão — RH › Treinamentos e ASO: validade de cada treinamento (NRs, ASO etc.), quem está vencido e quem vence
// nos próximos 30 dias. A conta da situação fica em contas/treinos.js (a mesma do Meu dia e da rotina de avisos).
// Desenhada a partir de administrativo.js (mesmo módulo RH, mesmos dados em DB.cache.adm).
import { today } from '../contas/cal.js';
import { normNome, criarBusca } from '../contas/planilhas-adm.js';
import { TIPOS_TREINO, mesesSugeridos, addMeses, vigentes, situacaoTreino, resumoTreinos, diasAte, ANTECEDENCIA } from '../contas/treinos.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';

const SIT = {
  vencido: ['Vencido', 'bad'], vence: ['Vence em breve', 'warn'], ok: ['Em dia', 'ok'], sem: ['Sem validade', 'neu'], renovado: ['Renovado', 'neu']
};

export function criarTreinos(X, A, pode, opcoesPessoa) {
  const { DB, esc, title, I, sheet, formSheet, toast, render, UI } = X;
  const $ = id => document.getElementById(id);
  const U = { aba: 'atencao', q: '', tipo: '' };
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
  const lista = () => A().treinos || [];

  function textoSit(t, s, hoje) {
    if (s === 'vencido') { const n = -diasAte(hoje, t.validade); return `Vencido há ${n} dia${n > 1 ? 's' : ''}`; }
    if (s === 'vence') { const n = diasAte(hoje, t.validade); return n === 0 ? 'Vence hoje' : `Vence em ${n} dia${n > 1 ? 's' : ''}`; }
    return SIT[s][0];
  }

  function view() {
    if (!A().tLoaded) return '<div class="card skel"><i></i><i></i><i></i></div>';
    const hoje = today(), L = lista(), vig = vigentes(L), r = resumoTreinos(L, hoje);
    const tipos = [...new Set([...TIPOS_TREINO.map(([t]) => t), ...L.map(t => t.tipo).filter(Boolean)])];
    const q = normNome(U.q || '');
    let l = L.map(t => ({ t, s: situacaoTreino(t, hoje, vig) }))
      .filter(({ t }) => (!U.tipo || t.tipo === U.tipo) && (!q || normNome(t.nome || '').includes(q) || String(t.mat || '').includes(q)));
    if (U.aba === 'atencao') l = l.filter(({ s }) => s === 'vencido' || s === 'vence');
    else if (U.aba === 'vigentes') l = l.filter(({ s }) => s !== 'renovado');
    const ord = { vencido: 0, vence: 1, sem: 2, ok: 3, renovado: 4 };
    l.sort((a, b) => ord[a.s] - ord[b.s] || String(a.t.validade || '9').localeCompare(String(b.t.validade || '9')) || String(a.t.nome).localeCompare(String(b.t.nome)));
    const lim = X.isMobile() ? Math.min(UI.more || 20, 300) : 300;
    const vazio = U.aba === 'atencao' ? 'Ninguém vencido nem vencendo nos próximos 30 dias.' : L.length ? 'Nenhum treinamento com esses filtros.' : 'Nenhum treinamento cadastrado ainda.';
    return `<div class="mini"><div><b class="num" style="color:var(--st-nreal)">${r.vencido}</b><span>Vencidos</span></div><div><b class="num" style="color:var(--st-atr)">${r.vence}</b><span>Vencem em ${ANTECEDENCIA} dias</span></div><div><b class="num">${r.ok}</b><span>Em dia</span></div></div>
      <div class="card"><div class="body lbar">
        <div class="rchips" role="group" aria-label="Mostrar">${[['atencao', 'Vencidos e próximos'], ['vigentes', 'Todos os atuais'], ['todos', 'Histórico completo']].map(([k, t]) => `<button class="rchip" data-tr="aba" data-v="${k}" aria-pressed="${U.aba === k}">${t}</button>`).join('')}</div>
        <label class="sel"><span>Tipo</span><select class="in" id="trTipo"><option value="">Todos</option>${tipos.map(t => `<option ${t === U.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="sel grow"><span>Buscar</span><input class="in" id="trQ" type="search" placeholder="Nome ou matrícula" value="${esc(U.q)}"></label>
        ${pode() ? `<button class="btn pri" data-tr="novo">${I.plus} Treinamento</button>` : ''}
        ${!X.framed && L.length ? `<button class="btn sm" data-tr="exportar">${I.dl} Exportar</button>` : ''}
      </div>
      ${l.length ? `<div class="plist ferlist">${l.slice(0, lim).map(({ t, s }) => `<button class="pitem ferit" data-tr="abrir" data-v="${esc(t.id)}"><div class="minw"><div class="t">${esc(title(t.nome || ''))} <span class="muted small">${t.mat ? '· ' + esc(t.mat) : ''}</span></div><div class="l"><b>${esc(t.tipo || '')}</b>${t.setor ? ' · ' + esc(t.setor) : ''}${t.realizado ? ' · feito em ' + dBR(t.realizado) : ''}</div>${t.obs ? `<div class="l">${esc(t.obs)}</div>` : ''}</div><div class="fer-r"><span class="pill ${SIT[s][1]}">${esc(textoSit(t, s, hoje))}</span><small class="muted">validade ${dBR(t.validade)}</small></div></button>`).join('')}</div>${l.length > lim ? (lim < 300 ? `<div class="body pt0"><button class="btn center" data-act="more" data-n="${lim + 40}">Mostrar mais ${Math.min(40, l.length - lim)} (faltam ${l.length - lim})</button></div>` : `<p class="muted small body">Mostrando 300 de ${l.length}. Use a busca ou o tipo.</p>`) : ''}` : `<div class="empty">${vazio}</div>`}</div>`;
  }

  function form(id) {
    const t = id ? lista().find(x => x.id === id) : null;
    if (!pode()) { if (t) sheet(title(t.nome || ''), `${esc(t.tipo || '')} · validade ${dBR(t.validade)}`, [{ t: 'Fechar', v: '' }], () => {}); return; }
    const v = (k, d = '') => esc(t && t[k] != null ? t[k] : d);
    const ops = opcoesPessoa();
    formSheet(t ? `${t.tipo} · ${title(t.nome || '')}` : 'Novo treinamento', t ? 'Altere as datas ou registre a renovação' : 'Escolha a pessoa, o tipo e as datas', `
      ${t ? '' : `<label class="sel"><span>Nome</span><input class="in" id="trNome" list="trLista" autocomplete="off" required></label><datalist id="trLista">${ops.map(o => `<option value="${esc(o.nome)}">${o.mat ? 'Matrícula ' + esc(o.mat) : ''}</option>`).join('')}</datalist>`}
      <div class="g2eq"><label class="sel"><span>Tipo</span><input class="in" id="trTp" list="trTipos" value="${v('tipo')}" required placeholder="Ex.: NR-35"></label><label class="sel"><span>Setor</span><input class="in" id="trSetor" value="${v('setor')}"></label></div>
      <datalist id="trTipos">${TIPOS_TREINO.map(([x]) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="g2eq"><label class="sel"><span>Feito em</span><input class="in" type="date" id="trFeito" value="${v('realizado')}"></label><label class="sel"><span>Validade</span><input class="in" type="date" id="trVal" value="${v('validade')}"></label></div>
      <p class="muted small m0" id="trDica">A validade é sugerida pelo tipo; confira a exigência da norma e da empresa.</p>
      <label class="sel"><span>Observação</span><input class="in" id="trObs" value="${v('obs')}" placeholder="Ex.: instrutor, carga horária, restrição do ASO"></label>
      ${t ? `<button type="button" class="btn sm" id="trRenovar">${I.plus} Registrar renovação</button> <button type="button" class="btn ghost danger sm" id="trDel">Excluir</button>` : ''}`, 'Salvar', async () => {
      let nome = t ? t.nome : $('trNome').value.trim().toUpperCase(); let mat = t ? t.mat || '' : '';
      if (!t) { if (normNome(nome).split(' ').length < 2) throw new Error('Informe o nome completo.'); const r = criarBusca(A().rh || [])(nome); if (r) { mat = String(r.item.mat || ''); nome = r.item.nome; } else { const o = ops.find(x => normNome(x.nome) === normNome(nome)); if (o) mat = o.mat || ''; } }
      const tipo = $('trTp').value.trim(); if (!tipo) throw new Error('Informe o tipo (ex.: ASO, NR-35).');
      const realizado = $('trFeito').value || null, validade = $('trVal').value || null;
      if (realizado && validade && validade < realizado) throw new Error('A validade não pode ser antes da data em que foi feito.');
      const dados = { nome, mat, tipo, setor: $('trSetor').value.trim().toUpperCase(), realizado, validade, obs: $('trObs').value.trim() };
      await DB.treinoSalvar(t ? t.id : null, dados);
      DB.log(`RH: ${tipo} de ${title(nome)}${validade ? ` válido até ${dBR(validade)}` : ''}`); toast('Treinamento salvo'); render();
    });
    const sugerir = () => { const f = $('trFeito').value, m = mesesSugeridos($('trTp').value.trim()); if (f && m && !$('trVal').dataset.mexeu) $('trVal').value = addMeses(f, m); };
    ['trFeito', 'trTp'].forEach(k => $(k).addEventListener('input', sugerir));
    $('trVal').addEventListener('input', () => { $('trVal').dataset.mexeu = '1'; });
    const ren = $('trRenovar');
    if (ren) ren.addEventListener('click', () => { document.getElementById('layer').innerHTML = ''; novo({ nome: t.nome, mat: t.mat, tipo: t.tipo, setor: t.setor }); });
    const del = $('trDel');
    if (del) del.addEventListener('click', () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Excluir mesmo?'; return; } DB.treinoExcluir(t.id); DB.log(`RH: excluiu ${t.tipo} de ${title(t.nome || '')}`); document.getElementById('layer').innerHTML = ''; toast('Treinamento excluído'); render(); });
  }
  // Renovação: novo registro da mesma pessoa e tipo (o antigo fica no histórico como "Renovado").
  function novo(base) {
    const hoje = today(), m = mesesSugeridos(base.tipo);
    formSheet(`Renovar ${base.tipo}`, esc(title(base.nome || '')), `
      <div class="g2eq"><label class="sel"><span>Feito em</span><input class="in" type="date" id="trFeito" value="${hoje}"></label><label class="sel"><span>Validade</span><input class="in" type="date" id="trVal" value="${m ? addMeses(hoje, m) : ''}"></label></div>
      <label class="sel"><span>Observação</span><input class="in" id="trObs"></label>`, 'Salvar', async () => {
      const realizado = $('trFeito').value || null, validade = $('trVal').value || null;
      if (realizado && validade && validade < realizado) throw new Error('A validade não pode ser antes da data em que foi feito.');
      await DB.treinoSalvar(null, { nome: base.nome, mat: base.mat || '', tipo: base.tipo, setor: base.setor || '', realizado, validade, obs: $('trObs').value.trim() });
      DB.log(`RH: renovou ${base.tipo} de ${title(base.nome || '')}${validade ? ` até ${dBR(validade)}` : ''}`); toast('Renovação salva'); render();
    });
  }
  function exportar() {
    const hoje = today(), L = lista(), vig = vigentes(L);
    const linhas = [['Matrícula', 'Nome', 'Setor', 'Tipo', 'Feito em', 'Validade', 'Situação', 'Observação'],
      ...L.map(t => [t.mat || '', t.nome || '', t.setor || '', t.tipo || '', dataBR(t.realizado), dataBR(t.validade), textoSit(t, situacaoTreino(t, hoje, vig), hoje), t.obs || ''])];
    baixarExcel('treinamentos', [{ nome: 'Treinamentos', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tr]'); if (!t || t.closest('#layer') || UI.view !== 'atrein') return;
    const a = t.dataset.tr, v = t.dataset.v;
    if (a === 'aba') { U.aba = v; UI.more = 0; render(); }
    else if (a === 'novo') form(null);
    else if (a === 'abrir') form(v);
    else if (a === 'exportar') exportar();
  });
  document.addEventListener('input', e => { if (UI.view === 'atrein' && e.target.id === 'trQ') { U.q = e.target.value; UI.more = 0; (X.agendar || render)(); } });
  document.addEventListener('change', e => { if (UI.view === 'atrein' && e.target.id === 'trTipo') { U.tipo = e.target.value; UI.more = 0; render(); } });

  return { view };
}
