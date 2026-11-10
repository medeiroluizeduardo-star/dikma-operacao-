// Dikma Gestão — Treinamentos e ASO (no RH e na Segurança): validade de cada treinamento (NRs, ASO etc.), quem está
// vencido e quem vence nos próximos 30 dias, cadastro um a um ou por planilha. A conta da situação e a leitura da planilha
// ficam em contas/treinos.js (as mesmas do Meu dia e da rotina de avisos).
import { today, SET_KEYS } from '../contas/cal.js';
import { normNome, criarBusca, abasDoXLSX } from '../contas/planilhas-adm.js';
import { TIPOS_TREINO, mesesSugeridos, addMeses, vigentes, situacaoTreino, resumoTreinos, diasAte, ANTECEDENCIA, editaTreinos, lerPlanilhaTreinos, MODELO_TREINOS, chaveTreino } from '../contas/treinos.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, framed, esc, title } from '../nucleo/base.js';
import { ME, UI } from '../nucleo/estado.js';
import { I } from '../ui/icones.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, isMobile, schedule } from '../ui/shell.js';

const SIT = {
  vencido: ['Vencido', 'bad'], vence: ['Vence em breve', 'warn'], ok: ['Em dia', 'ok'], sem: ['Sem validade', 'neu'], renovado: ['Renovado', 'neu']
};
const VIEWS_TR = ['sgtrein'];

// Uma tela só (os ouvintes de clique são ligados uma vez).
let TELA = null;
export const telaTreinos = () => (TELA ||= criarTreinos());

function criarTreinos() {
  const $ = id => document.getElementById(id);
  const U = { aba: 'atencao', q: '', tipo: '' };
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
  const lista = () => DB.cache.treinos || [];
  const pode = () => editaTreinos(ME);
  const aqui = () => VIEWS_TR.includes(UI.view);
  // Nomes para sugerir no cadastro: fichas do RH, colaboradores das Atividades e quem já tem treinamento.
  function opcoesPessoa() {
    const out = [], vistos = new Set();
    const add = (nome, mat) => { const k = normNome(nome || ''); if (!k || vistos.has(k)) return; vistos.add(k); out.push({ nome, mat: String(mat || '') }); };
    for (const c of (DB.cache.adm && DB.cache.adm.rh) || []) add(c.nome, c.mat);
    for (const c of (DB.cache.g && DB.cache.g.colabs) || []) add(c.nome, c.mat);
    for (const l of Object.values((DB.cache.adm && DB.cache.adm.colabs) || {})) for (const c of l || []) add(c.nome, c.mat);
    for (const k of SET_KEYS) { const d = DB.dados ? DB.dados(k) : null; for (const l of Object.values((d && d.colabs) || {})) for (const c of l || []) add(c.nome, c.mat); }
    for (const t of lista()) add(t.nome, t.mat);
    return out.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  function textoSit(t, s, hoje) {
    if (s === 'vencido') { const n = -diasAte(hoje, t.validade); return `Vencido há ${n} dia${n > 1 ? 's' : ''}`; }
    if (s === 'vence') { const n = diasAte(hoje, t.validade); return n === 0 ? 'Vence hoje' : `Vence em ${n} dia${n > 1 ? 's' : ''}`; }
    return SIT[s][0];
  }

  function view() {
    if (DB.treinosCarregar) DB.treinosCarregar();
    if (!DB.cache.tLoaded) return '<div class="card skel"><i></i><i></i><i></i></div>';
    const hoje = today(), L = lista(), vig = vigentes(L), r = resumoTreinos(L, hoje);
    const tipos = [...new Set([...TIPOS_TREINO.map(([t]) => t), ...L.map(t => t.tipo).filter(Boolean)])];
    const q = normNome(U.q || '');
    let l = L.map(t => ({ t, s: situacaoTreino(t, hoje, vig) }))
      .filter(({ t }) => (!U.tipo || t.tipo === U.tipo) && (!q || normNome(t.nome || '').includes(q) || String(t.mat || '').includes(q)));
    if (U.aba === 'atencao') l = l.filter(({ s }) => s === 'vencido' || s === 'vence');
    else if (U.aba === 'vigentes') l = l.filter(({ s }) => s !== 'renovado');
    const ord = { vencido: 0, vence: 1, sem: 2, ok: 3, renovado: 4 };
    l.sort((a, b) => ord[a.s] - ord[b.s] || String(a.t.validade || '9').localeCompare(String(b.t.validade || '9')) || String(a.t.nome).localeCompare(String(b.t.nome)));
    const lim = isMobile() ? Math.min(UI.more || 20, 300) : 300;
    const vazio = U.aba === 'atencao' ? 'Ninguém vencido nem vencendo nos próximos 30 dias.' : L.length ? 'Nenhum treinamento com esses filtros.' : 'Nenhum treinamento cadastrado ainda.';
    return `<div class="mini"><div><b class="num" style="color:var(--st-nreal)">${r.vencido}</b><span>Vencidos</span></div><div><b class="num" style="color:var(--st-atr)">${r.vence}</b><span>Vencem em ${ANTECEDENCIA} dias</span></div><div><b class="num">${r.ok}</b><span>Em dia</span></div></div>
      <div class="card"><div class="body lbar">
        <div class="rchips" role="group" aria-label="Mostrar">${[['atencao', 'Vencidos e próximos'], ['vigentes', 'Todos os atuais'], ['todos', 'Histórico completo']].map(([k, t]) => `<button class="rchip" data-tr="aba" data-v="${k}" aria-pressed="${U.aba === k}">${t}</button>`).join('')}</div>
        <label class="sel"><span>Tipo</span><select class="in" id="trTipo"><option value="">Todos</option>${tipos.map(t => `<option ${t === U.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="sel grow"><span>Buscar</span><input class="in" id="trQ" type="search" placeholder="Nome ou matrícula" value="${esc(U.q)}"></label>
        ${pode() ? `<button class="btn pri" data-tr="novo">${I.plus} Treinamento</button>` : ''}
        ${pode() ? `<button class="btn sm" data-tr="importar">${I.dl} Importar planilha</button><input type="file" id="trArq" accept=".xlsx,.xls,.csv" hidden><button class="btn ghost sm" data-tr="modelo">Baixar modelo</button>` : ''}
        ${!framed && L.length ? `<button class="btn sm" data-tr="exportar">${I.dl} Exportar</button>` : ''}
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
      if (!t) { if (normNome(nome).split(' ').length < 2) throw new Error('Informe o nome completo.'); const r = criarBusca(ops.filter(o => o.mat))(nome); if (r) { mat = String(r.item.mat || ''); nome = r.item.nome; } else { const o = ops.find(x => normNome(x.nome) === normNome(nome)); if (o) mat = o.mat || ''; } }
      const tipo = $('trTp').value.trim(); if (!tipo) throw new Error('Informe o tipo (ex.: ASO, NR-35).');
      const realizado = $('trFeito').value || null, validade = $('trVal').value || null;
      if (realizado && validade && validade < realizado) throw new Error('A validade não pode ser antes da data em que foi feito.');
      const dados = { nome, mat, tipo, setor: $('trSetor').value.trim().toUpperCase(), realizado, validade, obs: $('trObs').value.trim() };
      await DB.treinoSalvar(t ? t.id : null, dados);
      DB.log(`Treinamentos: ${tipo} de ${title(nome)}${validade ? ` válido até ${dBR(validade)}` : ''}`); toast('Treinamento salvo'); render();
    });
    const sugerir = () => { const f = $('trFeito').value, m = mesesSugeridos($('trTp').value.trim()); if (f && m && !$('trVal').dataset.mexeu) $('trVal').value = addMeses(f, m); };
    ['trFeito', 'trTp'].forEach(k => $(k).addEventListener('input', sugerir));
    $('trVal').addEventListener('input', () => { $('trVal').dataset.mexeu = '1'; });
    const ren = $('trRenovar');
    if (ren) ren.addEventListener('click', () => { document.getElementById('layer').innerHTML = ''; novo({ nome: t.nome, mat: t.mat, tipo: t.tipo, setor: t.setor }); });
    const del = $('trDel');
    if (del) del.addEventListener('click', () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Excluir mesmo?'; return; } DB.treinoExcluir(t.id); DB.log(`Treinamentos: excluiu ${t.tipo} de ${title(t.nome || '')}`); document.getElementById('layer').innerHTML = ''; toast('Treinamento excluído'); render(); });
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
      DB.log(`Treinamentos: renovou ${base.tipo} de ${title(base.nome || '')}${validade ? ` até ${dBR(validade)}` : ''}`); toast('Renovação salva'); render();
    });
  }
  function exportar() {
    const hoje = today(), L = lista(), vig = vigentes(L);
    const linhas = [['Matrícula', 'Nome', 'Setor', 'Tipo', 'Feito em', 'Validade', 'Situação', 'Observação'],
      ...L.map(t => [t.mat || '', t.nome || '', t.setor || '', t.tipo || '', dataBR(t.realizado), dataBR(t.validade), textoSit(t, situacaoTreino(t, hoje, vig), hoje), t.obs || ''])];
    baixarExcel('treinamentos', [{ nome: 'Treinamentos', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  }

  // Importar planilha: lê, mostra o resumo (novos, já cadastrados, com erro) e só grava depois de confirmar.
  async function importar(file) {
    try {
      const XLSX = await import('../vendor/xlsx.js');
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
      const r = lerPlanilhaTreinos(abasDoXLSX(XLSX, wb));
      const ja = new Set(lista().map(chaveTreino)); const busca = criarBusca(opcoesPessoa().filter(o => o.mat));
      const novos = [], vistos = new Set(); let repetidos = 0;
      for (const t of r.itens) {
        if (!t.mat) { const b = busca(t.nome); if (b) { t.mat = String(b.item.mat || ''); t.nome = b.item.nome; } }
        const k = chaveTreino(t); if (ja.has(k) || vistos.has(k)) { repetidos++; continue; } vistos.add(k); novos.push(t);
      }
      const erros = r.erros.length ? `<br><br>${r.erros.slice(0, 6).map(esc).join('<br>')}${r.erros.length > 6 ? '<br>…' : ''}` : '';
      if (!novos.length) {
        sheet('Importar planilha', `${esc(file.name)}<br>${r.itens.length ? `Todas as ${r.itens.length} linhas já estão cadastradas.` : 'Nenhum treinamento encontrado.'}${erros}<br><br>Use o modelo: colunas Matrícula, Nome, Setor, Tipo, Feito em, Validade e Observação.`,
          [{ t: 'Baixar o modelo', v: 'm' }], o => { if (o.v === 'm') baixarModelo(); }, { fechar: 'Fechar' });
        return;
      }
      const ex = novos.slice(0, 5).map(t => `${esc(title(t.nome))} · ${esc(t.tipo)} · validade ${dBR(t.validade)}`).join('<br>');
      const n = novos.length, pl = (k, a, b) => (k > 1 ? b : a);
      sheet('Importar planilha', `${esc(file.name)}${r.aba ? ` · aba ${esc(r.aba)}` : ''}<br><b>${n} ${pl(n, 'treinamento novo', 'treinamentos novos')}</b>${repetidos ? ` · ${repetidos} ${pl(repetidos, 'já cadastrado', 'já cadastrados')} (ficam como estão)` : ''}${r.erros.length ? ` · ${r.erros.length} ${pl(r.erros.length, 'linha com erro', 'linhas com erro')} (não entram)` : ''}<br><br>${ex}${n > 5 ? '<br>…' : ''}${erros}`,
        [{ t: `Gravar ${n} ${pl(n, 'treinamento', 'treinamentos')}`, v: 'ok', cls: 'pri' }], async o => {
          if (o.v !== 'ok') return;
          try { await DB.treinosImportar(novos); DB.log(`Treinamentos: importou ${n} da planilha ${file.name}`); toast(`${n} ${pl(n, 'treinamento importado', 'treinamentos importados')}`); render(); }
          catch (e) { toast('Não foi possível gravar: ' + ((e && e.message) || e)); }
        });
    } catch (e) { toast('Não foi possível ler a planilha: ' + ((e && e.message) || e)); }
  }
  const baixarModelo = () => baixarExcel('modelo-treinamentos', [{ nome: 'Treinamentos', linhas: MODELO_TREINOS }]).catch(e => toast('Não foi possível baixar: ' + e.message));

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tr]'); if (!t || t.closest('#layer') || !aqui()) return;
    const a = t.dataset.tr, v = t.dataset.v;
    if (a === 'aba') { U.aba = v; UI.more = 0; render(); }
    else if (a === 'novo') form(null);
    else if (a === 'abrir') form(v);
    else if (a === 'exportar') exportar();
    else if (a === 'modelo') baixarModelo();
    else if (a === 'importar') { const f = $('trArq'); if (f) { f.value = ''; f.click(); } }
  });
  document.addEventListener('input', e => { if (aqui() && e.target.id === 'trQ') { U.q = e.target.value; UI.more = 0; schedule(); } });
  document.addEventListener('change', e => {
    if (!aqui()) return;
    if (e.target.id === 'trTipo') { U.tipo = e.target.value; UI.more = 0; render(); }
    if (e.target.id === 'trArq' && e.target.files[0]) importar(e.target.files[0]);
  });

  return { view };
}
