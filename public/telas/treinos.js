// Dikma Gestão — Treinamentos e ASO (Segurança): validade de cada treinamento (NRs, ASO etc.), quem está vencido e quem
// vence nos próximos 30 dias, a visão por colaborador (igual à planilha de controle da empresa), cadastro um a um ou por planilha. A conta da situação e a leitura da planilha
// ficam em contas/treinos.js (as mesmas do Meu dia e da rotina de avisos).
import { today, SET_KEYS } from '../contas/cal.js';
import { normNome, criarBusca, abasDoXLSX } from '../contas/planilhas-adm.js';
import { TIPOS_TREINO, mesesSugeridos, addMeses, vigentes, situacaoTreino, resumoTreinos, diasAte, ANTECEDENCIA, editaTreinos, lerPlanilhaTreinos, MODELO_TREINOS, chaveTreino, chavePessoa, tipoOficial } from '../contas/treinos.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, framed, esc, title } from '../nucleo/base.js';
import { ME, UI } from '../nucleo/estado.js';
import { I } from '../ui/icones.js';
import { sheet, formSheet, toast } from '../ui/janelas.js';
import { render, isMobile, schedule } from '../ui/shell.js';

const SIT = {
  vencido: ['Vencido', 'bad'], vence: ['A vencer', 'warn'], ok: ['Em dia', 'ok'], sem: ['Sem validade', 'neu'], na: ['Não se aplica', 'neu'], renovado: ['Renovado', 'neu']
};
const VIEWS_TR = ['sgtrein'];

// Uma tela só (os ouvintes de clique são ligados uma vez).
let TELA = null;
export const telaTreinos = () => (TELA ||= criarTreinos());

function criarTreinos() {
  const $ = id => document.getElementById(id);
  const U = { aba: 'atencao', q: '', tipo: '', turno: '' };
  let PES = new Map(); // pessoas da visão por colaborador (para o + de uma célula vazia)
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
    if (s === 'sem' && t.realizado) return 'Cadastre a validade';
    if (s === 'sem' && t.obs) return t.obs.length > 24 ? t.obs.slice(0, 23) + '…' : t.obs;
    return SIT[s][0];
  }

  // Por colaborador: uma linha por pessoa e uma coluna por treinamento, como a planilha de controle da empresa.
  function pessoas(L, vig) {
    const m = new Map();
    for (const t of L) {
      if (!vig.has(t.id)) continue;
      const k = chavePessoa(t); let p = m.get(k);
      if (!p) m.set(k, p = { k, nome: t.nome || '', mat: t.mat || '', turno: '', funcao: '', admissao: '', setor: '', por: {} });
      for (const c of ['turno', 'funcao', 'admissao', 'setor']) if (t[c]) p[c] = t[c];
      p.por[tipoOficial(t.tipo)] = t;
    }
    return m;
  }
  const colunas = L => { const u = new Set(L.map(t => tipoOficial(t.tipo))); return [...TIPOS_TREINO.map(([t]) => t).filter(t => u.has(t)), ...[...u].filter(t => !TIPOS_TREINO.some(([x]) => x === t)).sort()]; };
  function matriz(L, vig, hoje, q) {
    PES = pessoas(L, vig);
    const ps = [...PES.values()].filter(p => (!q || normNome(p.nome).includes(q) || String(p.mat).includes(q)) && (!U.turno || p.turno === U.turno)).sort((a, b) => a.nome.localeCompare(b.nome));
    const cols = colunas(L).filter(t => !U.tipo || t === U.tipo);
    if (!ps.length || !cols.length) return `<div class="empty">${L.length ? 'Ninguém com esses filtros.' : 'Nenhum treinamento cadastrado ainda. Importe a planilha de controle.'}</div>`;
    const d2 = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : '');
    const cel = (p, tipo) => {
      const t = p.por[tipo];
      if (!t) return pode() ? `<button class="trc trv" data-tr="add" data-v="${esc(p.k)}" data-t="${esc(tipo)}" aria-label="Cadastrar ${esc(tipo)}">+</button>` : '<span class="muted">—</span>';
      const s = situacaoTreino(t, hoje, vig), txt = s === 'na' ? 'N/A' : t.validade ? d2(t.validade) : t.realizado ? 'feito ' + d2(t.realizado) : (t.obs || '?').slice(0, 14);
      return `<button class="trc pill ${SIT[s][1]}" data-tr="abrir" data-v="${esc(t.id)}" title="${esc(textoSit(t, s, hoje))}">${esc(txt)}</button>`;
    };
    return `<p class="muted small body pt0 m0">${ps.length} colaborador${ps.length > 1 ? 'es' : ''} · a data é o vencimento · cores: vencido, a vencer em ${ANTECEDENCIA} dias, em dia.${pode() ? ' Toque numa célula para alterar ou no + para cadastrar.' : ''}</p>
      <div class="tw"><table class="trmat"><thead><tr><th class="trp">Colaborador</th>${cols.map(t => `<th class="tt">${esc(t)}</th>`).join('')}</tr></thead>
      <tbody>${ps.map(p => `<tr><td class="trp"><b>${esc(title(p.nome))}</b><small class="muted">${[p.mat, p.turno, p.funcao && title(p.funcao)].filter(Boolean).map(esc).join(' · ')}</small></td>${cols.map(t => `<td>${cel(p, t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function view() {
    if (DB.treinosCarregar) DB.treinosCarregar();
    if (!DB.cache.tLoaded) return '<div class="card skel"><i></i><i></i><i></i></div>';
    const hoje = today(), L = lista(), vig = vigentes(L), r = resumoTreinos(L, hoje);
    const tipos = [...new Set([...TIPOS_TREINO.map(([t]) => t), ...L.map(t => tipoOficial(t.tipo)).filter(Boolean)])];
    const turnos = [...new Set(L.map(t => t.turno).filter(Boolean))].sort();
    const q = normNome(U.q || '');
    let l = L.map(t => ({ t, s: situacaoTreino(t, hoje, vig) }))
      .filter(({ t }) => (!U.tipo || tipoOficial(t.tipo) === U.tipo) && (!U.turno || t.turno === U.turno) && (!q || normNome(t.nome || '').includes(q) || String(t.mat || '').includes(q)));
    if (U.aba === 'atencao') l = l.filter(({ s }) => s === 'vencido' || s === 'vence');
    else if (U.aba === 'pessoas') l = [];
    else if (U.aba === 'vigentes') l = l.filter(({ s }) => s !== 'renovado');
    const ord = { vencido: 0, vence: 1, sem: 2, ok: 3, na: 4, renovado: 5 };
    l.sort((a, b) => ord[a.s] - ord[b.s] || String(a.t.validade || '9').localeCompare(String(b.t.validade || '9')) || String(a.t.nome).localeCompare(String(b.t.nome)));
    const lim = isMobile() ? Math.min(UI.more || 20, 300) : 300;
    const vazio = U.aba === 'atencao' ? 'Ninguém vencido nem vencendo nos próximos 30 dias.' : L.length ? 'Nenhum treinamento com esses filtros.' : 'Nenhum treinamento cadastrado ainda.';
    return `<div class="mini"><div><b class="num" style="color:var(--st-nreal)">${r.vencido}</b><span>Vencidos</span></div><div><b class="num" style="color:var(--st-atr)">${r.vence}</b><span>A vencer em ${ANTECEDENCIA} dias</span></div><div><b class="num">${r.ok}</b><span>Em dia</span></div></div>
      <div class="card"><div class="body lbar">
        <div class="rchips" role="group" aria-label="Mostrar">${[['atencao', 'Vencidos e a vencer'], ['pessoas', 'Por colaborador'], ['vigentes', 'Todos os atuais'], ['todos', 'Histórico completo']].map(([k, t]) => `<button class="rchip" data-tr="aba" data-v="${k}" aria-pressed="${U.aba === k}">${t}</button>`).join('')}</div>
        <label class="sel"><span>Tipo</span><select class="in" id="trTipo"><option value="">Todos</option>${tipos.map(t => `<option ${t === U.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        ${turnos.length ? `<label class="sel"><span>Turno</span><select class="in" id="trTurno"><option value="">Todos</option>${turnos.map(t => `<option ${t === U.turno ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}
        <label class="sel grow"><span>Buscar</span><input class="in" id="trQ" type="search" placeholder="Nome ou matrícula" value="${esc(U.q)}"></label>
        ${pode() ? `<button class="btn pri" data-tr="novo">${I.plus} Treinamento</button>` : ''}
        ${pode() ? `<button class="btn sm" data-tr="importar">${I.dl} Importar planilha</button><input type="file" id="trArq" accept=".xlsx,.xls,.csv" hidden><button class="btn ghost sm" data-tr="modelo">Baixar modelo</button>` : ''}
        ${!framed && L.length ? `<button class="btn sm" data-tr="exportar">${I.dl} Exportar</button>` : ''}
      </div>
      ${U.aba === 'pessoas' ? matriz(L, vig, hoje, q) : l.length ? `<div class="plist ferlist">${l.slice(0, lim).map(({ t, s }) => `<button class="pitem ferit" data-tr="abrir" data-v="${esc(t.id)}"><div class="minw"><div class="t">${esc(title(t.nome || ''))} <span class="muted small">${t.mat ? '· ' + esc(t.mat) : ''}</span></div><div class="l"><b>${esc(tipoOficial(t.tipo))}</b>${[t.setor, t.turno, t.funcao && title(t.funcao)].filter(Boolean).map(x => ' · ' + esc(x)).join('')}${t.realizado ? ' · feito em ' + dBR(t.realizado) : ''}</div>${t.obs ? `<div class="l">${esc(t.obs)}</div>` : ''}</div><div class="fer-r"><span class="pill ${SIT[s][1]}">${esc(textoSit(t, s, hoje))}</span>${s === 'na' ? '' : `<small class="muted">validade ${dBR(t.validade)}</small>`}</div></button>`).join('')}</div>${l.length > lim ? (lim < 300 ? `<div class="body pt0"><button class="btn center" data-act="more" data-n="${lim + 40}">Mostrar mais ${Math.min(40, l.length - lim)} (faltam ${l.length - lim})</button></div>` : `<p class="muted small body">Mostrando 300 de ${l.length}. Use a busca ou o tipo.</p>`) : ''}` : `<div class="empty">${vazio}</div>`}</div>`;
  }

  // id: alterar um registro; base: novo registro de uma pessoa já conhecida (célula vazia da visão por colaborador).
  function form(id, base) {
    const t = id ? lista().find(x => x.id === id) : null;
    if (!pode()) { if (t) sheet(title(t.nome || ''), `${esc(tipoOficial(t.tipo))} · ${esc(textoSit(t, situacaoTreino(t, today(), vigentes(lista())), today()))}${t.validade ? ` · validade ${dBR(t.validade)}` : ''}`, [{ t: 'Fechar', v: '' }], () => {}); return; }
    const o0 = t || base || {};
    const v = (k, d = '') => esc(o0[k] != null ? o0[k] : d);
    const ops = opcoesPessoa(), fixo = t || (base && base.nome);
    const turnos = [...new Set(['Adm', 'Turno', ...lista().map(x => x.turno).filter(Boolean)])];
    formSheet(t ? `${tipoOficial(t.tipo)} · ${title(t.nome || '')}` : fixo ? `${base.tipo ? tipoOficial(base.tipo) : 'Novo treinamento'} · ${title(base.nome)}` : 'Novo treinamento', t ? 'Altere as datas ou registre a renovação' : 'Escolha a pessoa, o tipo e as datas', `
      ${fixo ? '' : `<label class="sel"><span>Nome</span><input class="in" id="trNome" list="trLista" autocomplete="off" required></label><datalist id="trLista">${ops.map(o => `<option value="${esc(o.nome)}">${o.mat ? 'Matrícula ' + esc(o.mat) : ''}</option>`).join('')}</datalist>`}
      <div class="g2eq"><label class="sel"><span>Treinamento</span><input class="in" id="trTp" list="trTipos" value="${esc(o0.tipo ? tipoOficial(o0.tipo) : '')}" required placeholder="Ex.: NR 35 TRABALHO EM ALTURA"></label><label class="sel"><span>Setor</span><input class="in" id="trSetor" value="${v('setor')}"></label></div>
      <datalist id="trTipos">${TIPOS_TREINO.map(([x]) => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="g2eq"><label class="sel"><span>Data de realização</span><input class="in" type="date" id="trFeito" value="${v('realizado')}"></label><label class="sel"><span>Vencimento</span><input class="in" type="date" id="trVal" value="${v('validade')}"></label></div>
      <label class="trna"><input type="checkbox" id="trNa" ${o0.na && t ? 'checked' : ''}> Não se aplica a esta pessoa</label>
      <p class="muted small m0" id="trDica">O vencimento é calculado pela validade do treinamento; confira a exigência da norma e da empresa.</p>
      <div class="g2eq"><label class="sel"><span>Turno</span><input class="in" id="trTurno2" list="trTurnos" value="${v('turno')}" placeholder="Adm ou Turno"></label><label class="sel"><span>Função</span><input class="in" id="trFunc" value="${v('funcao')}"></label></div>
      <datalist id="trTurnos">${turnos.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="g2eq"><label class="sel"><span>Data de admissão</span><input class="in" type="date" id="trAdm" value="${v('admissao')}"></label><label class="sel"><span>Observação</span><input class="in" id="trObs" value="${t ? v('obs') : ''}" placeholder="Ex.: inapto, instrutor"></label></div>
      ${t ? `<button type="button" class="btn sm" id="trRenovar">${I.plus} Registrar renovação</button> <button type="button" class="btn ghost danger sm" id="trDel">Excluir</button>` : ''}`, 'Salvar', async () => {
      let nome = fixo ? o0.nome : $('trNome').value.trim().toUpperCase(); let mat = fixo ? o0.mat || '' : '';
      if (!fixo) { if (normNome(nome).split(' ').length < 2) throw new Error('Informe o nome completo.'); const r = criarBusca(ops.filter(o => o.mat))(nome); if (r) { mat = String(r.item.mat || ''); nome = r.item.nome; } else { const o = ops.find(x => normNome(x.nome) === normNome(nome)); if (o) mat = o.mat || ''; } }
      const tipo = tipoOficial($('trTp').value); if (!tipo) throw new Error('Informe o treinamento (ex.: NR 35 TRABALHO EM ALTURA, ASO).');
      const na = $('trNa').checked;
      const realizado = na ? null : $('trFeito').value || null, validade = na ? null : $('trVal').value || null;
      if (realizado && validade && validade < realizado) throw new Error('O vencimento não pode ser antes da data de realização.');
      const dados = { nome, mat, tipo, setor: $('trSetor').value.trim().toUpperCase(), realizado, validade, obs: $('trObs').value.trim(), na,
        turno: $('trTurno2').value.trim(), funcao: $('trFunc').value.trim().toUpperCase(), admissao: $('trAdm').value || null };
      await DB.treinoSalvar(t ? t.id : null, dados);
      DB.log(`Treinamentos: ${tipo} de ${title(nome)}${validade ? ` válido até ${dBR(validade)}` : ''}`); toast('Treinamento salvo'); render();
    });
    const sugerir = () => { const f = $('trFeito').value, m = mesesSugeridos($('trTp').value.trim()); if (f && m && !$('trVal').dataset.mexeu) $('trVal').value = addMeses(f, m); };
    ['trFeito', 'trTp'].forEach(k => $(k).addEventListener('input', sugerir));
    $('trVal').addEventListener('input', () => { $('trVal').dataset.mexeu = '1'; });
    const ren = $('trRenovar');
    if (ren) ren.addEventListener('click', () => { document.getElementById('layer').innerHTML = ''; novo({ nome: t.nome, mat: t.mat, tipo: tipoOficial(t.tipo), setor: t.setor, turno: t.turno, funcao: t.funcao, admissao: t.admissao }); });
    const del = $('trDel');
    if (del) del.addEventListener('click', () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Excluir mesmo?'; return; } DB.treinoExcluir(t.id); DB.log(`Treinamentos: excluiu ${t.tipo} de ${title(t.nome || '')}`); document.getElementById('layer').innerHTML = ''; toast('Treinamento excluído'); render(); });
  }
  // Renovação: novo registro da mesma pessoa e tipo (o antigo fica no histórico como "Renovado").
  function novo(base) {
    const hoje = today(), m = mesesSugeridos(base.tipo);
    formSheet(`Renovar ${base.tipo}`, esc(title(base.nome || '')), `
      <div class="g2eq"><label class="sel"><span>Data de realização</span><input class="in" type="date" id="trFeito" value="${hoje}"></label><label class="sel"><span>Vencimento</span><input class="in" type="date" id="trVal" value="${m ? addMeses(hoje, m) : ''}"></label></div>
      <label class="sel"><span>Observação</span><input class="in" id="trObs"></label>`, 'Salvar', async () => {
      const realizado = $('trFeito').value || null, validade = $('trVal').value || null;
      if (realizado && validade && validade < realizado) throw new Error('A validade não pode ser antes da data em que foi feito.');
      await DB.treinoSalvar(null, { nome: base.nome, mat: base.mat || '', tipo: base.tipo, setor: base.setor || '', turno: base.turno || '', funcao: base.funcao || '', admissao: base.admissao || null, realizado, validade, obs: $('trObs').value.trim() });
      DB.log(`Treinamentos: renovou ${base.tipo} de ${title(base.nome || '')}${validade ? ` até ${dBR(validade)}` : ''}`); toast('Renovação salva'); render();
    });
  }
  // Exporta no formato do controle da empresa (uma linha por colaborador) e, numa 2ª aba, a lista com o histórico.
  function exportar() {
    const hoje = today(), L = lista(), vig = vigentes(L), cols = colunas(L);
    const ps = [...pessoas(L, vig).values()].sort((a, b) => a.nome.localeCompare(b.nome));
    const st = t => { const s = situacaoTreino(t, hoje, vig); return s === 'vencido' ? 'Vencido' : s === 'vence' ? 'A vencer' : s === 'ok' ? 'Em dia' : s === 'na' ? 'Não se aplica' : t.realizado ? 'Cadastre a validade' : t.obs || ''; };
    const controle = [['CONTROLE DE VALIDADE DOS TREINAMENTOS DE SEGURANÇA'], [`Total de colaboradores: ${ps.length}`],
      ['Nº', 'Nome do colaborador', 'Matrícula', 'Data de admissão', 'Turno', 'Função', ...cols.flatMap(t => [t, '', ''])],
      ['', '', '', '', '', '', ...cols.flatMap(() => ['Data de realização', 'Vencimento', 'Status'])],
      ...ps.map((p, i) => [i + 1, p.nome, p.mat, dataBR(p.admissao), p.turno, p.funcao, ...cols.flatMap(c => { const t = p.por[c]; return t ? [t.na ? 'NÃO SE APLICA' : t.realizado ? dataBR(t.realizado) : t.obs || '', dataBR(t.validade), st(t)] : ['', '', '']; })])];
    const linhas = [['Matrícula', 'Nome', 'Setor', 'Turno', 'Função', 'Treinamento', 'Data de realização', 'Vencimento', 'Situação', 'Observação'],
      ...L.map(t => [t.mat || '', t.nome || '', t.setor || '', t.turno || '', t.funcao || '', tipoOficial(t.tipo), dataBR(t.realizado), dataBR(t.validade), textoSit(t, situacaoTreino(t, hoje, vig), hoje), t.obs || ''])];
    baixarExcel('treinamentos', [{ nome: 'Controle de Treinamentos', linhas: controle }, { nome: 'Lista e histórico', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
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
      const pl = (k, a, b) => (k > 1 ? b : a);
      const erros = r.erros.length ? `<br><br>${r.erros.slice(0, 6).map(esc).join('<br>')}${r.erros.length > 6 ? '<br>…' : ''}` : '';
      if (!novos.length) {
        sheet('Importar planilha', `${esc(file.name)}<br>${r.itens.length ? `Todas as ${r.itens.length} linhas já estão cadastradas.` : 'Nenhum treinamento encontrado.'}${erros}<br><br>Use a planilha de controle da empresa (uma linha por colaborador) ou o modelo.`,
          [{ t: 'Baixar o modelo', v: 'm' }], o => { if (o.v === 'm') baixarModelo(); }, { fechar: 'Fechar' });
        return;
      }
      const ex = novos.slice(0, 5).map(t => `${esc(title(t.nome))} · ${esc(t.tipo)} · ${t.na ? 'não se aplica' : t.validade ? 'vence ' + dBR(t.validade) : esc(t.obs || 'sem validade')}`).join('<br>');
      const av = (r.avisos || []).length ? `<br><br><b>Para conferir:</b><br>${r.avisos.slice(0, 6).map(esc).join('<br>')}` : '';
      const fmt = r.formato === 'matriz' ? `<br>Controle por colaborador: ${r.pessoas} ${pl(r.pessoas, 'colaborador', 'colaboradores')} (o CPF não é gravado).` : '';
      const n = novos.length;
      sheet('Importar planilha', `${esc(file.name)}${r.aba ? ` · aba ${esc(r.aba)}` : ''}${fmt}<br><b>${n} ${pl(n, 'treinamento novo', 'treinamentos novos')}</b>${repetidos ? ` · ${repetidos} ${pl(repetidos, 'já cadastrado', 'já cadastrados')} (ficam como estão)` : ''}${r.erros.length ? ` · ${r.erros.length} ${pl(r.erros.length, 'linha com erro', 'linhas com erro')} (não entram)` : ''}<br><br>${ex}${n > 5 ? '<br>…' : ''}${av}${erros}`,
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
    else if (a === 'add') { const p = PES.get(v); if (p) form(null, { nome: p.nome, mat: p.mat, setor: p.setor, turno: p.turno, funcao: p.funcao, admissao: p.admissao, tipo: t.dataset.t }); }
    else if (a === 'exportar') exportar();
    else if (a === 'modelo') baixarModelo();
    else if (a === 'importar') { const f = $('trArq'); if (f) { f.value = ''; f.click(); } }
  });
  document.addEventListener('input', e => { if (aqui() && e.target.id === 'trQ') { U.q = e.target.value; UI.more = 0; schedule(); } });
  document.addEventListener('change', e => {
    if (!aqui()) return;
    if (e.target.id === 'trTipo') { U.tipo = e.target.value; UI.more = 0; render(); }
    if (e.target.id === 'trTurno') { U.turno = e.target.value; UI.more = 0; render(); }
    if (e.target.id === 'trArq' && e.target.files[0]) importar(e.target.files[0]);
  });

  return { view };
}
