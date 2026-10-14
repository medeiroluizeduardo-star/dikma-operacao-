// Dikma Gestão — acesso Administrativo: Painel, Frequência (folha de 16 a 15) e Férias.
// A presença de quem está nas Atividades é a mesma do Efetivo diário (situacao): o líder marca na Operação,
// o Administrativo vê e corrige aqui. Quem não está nas Atividades (gestão, apoio) fica só na folha (freqcomp).
// Férias marcadas aqui aparecem sozinhas como FE no Efetivo diário e na folha.
import { SETS, today, add, ddmm, MESES_L } from './cal.js';
import { normRegime, letra } from './escala.js';
import { editaAdm, indiceFerias } from './acessos.js';
import { baixarExcel, dataBR } from './exportar.js';
import { diasDaCompetencia, competenciaDe, normNome, criarBusca, prepararImportacao, lerFrequencia, lerFerias, abasDoXLSX, addDias, NOMES_CODIGO } from './planilhas-adm.js';

export const VIEWS_A = [
  { id: 'apainel', nome: 'Painel', ic: 'painel', grp: 'Administrativo', mod: 'ad' },
  { id: 'afreq', nome: 'Frequência', ic: 'prog', grp: 'Administrativo', mod: 'ad' },
  { id: 'aferias', nome: 'Férias', ic: 'sol', grp: 'Administrativo', mod: 'ad' },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'dl', grp: 'Administração', mod: 'ad' }
];
export const SUB_A = {
  apainel: 'Resumo da competência e das férias',
  afreq: 'Folha de frequência de 16 a 15, por grupo',
  aferias: 'Planejamento, quem está de férias e data limite',
  aimport: 'Planilhas de frequência e de férias'
};
// Códigos que dá para lançar na folha (os mesmos do Efetivo diário, mais abono e suspensão).
const CODS = ['P', 'F', 'FT', 'AT', 'AB', 'HE', 'FE', 'AF', 'TR', 'SP', 'DS'];
const CONTA = ['FT', 'AT', 'AB', 'SP', 'HE'];
const DIA_L = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function criarAdministrativo(X) {
  const { DB, esc, title, I, sheet, formSheet, toast, render, UI } = X;
  const ME = () => X.ME;
  const $ = id => document.getElementById(id);
  const TODAY = today();
  const A = () => DB.cache.adm || { ferias: [], comps: {}, sit: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
  const U = UI.a || (UI.a = { conj: 'patio', comp: competenciaDe(TODAY), abertos: [], fAba: 'agora', fSetor: '', fQ: '', imp: null, q: '' });
  const pode = () => editaAdm(ME());
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
  const nomeComp = c => { const [a, m] = c.split('-').map(Number); return `${MESES_L[m - 1]} ${a}`; };
  const compMais = (c, n) => { let [a, m] = c.split('-').map(Number); m += n; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; };
  const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

  /* ---------- presença de cada pessoa num dia ---------- */
  let FI = null, FIv = null;
  const ferIdx = () => { const l = A().ferias; if (FIv !== l) { FI = indiceFerias(l); FIv = l; } return FI; };
  const colabPorId = conj => { const m = new Map(); (A().colabs[conj] || []).forEach(c => m.set(c.id, c)); return m; };
  function regimeTurma(conj, g, p, cmap) {
    const c = p.ativ ? cmap.get(p.ativ) : null;
    const regime = c ? c.regime : g.turno ? (/3\s*X\s*3/i.test(g.nome) ? '3X3' : '4X4') : 'ADMINISTRATIVO';
    return { regime, turma: (c && letra(c.turma)) || letra(p.turma) || '' };
  }
  // { v: código, auto: veio da escala/férias/padrão, por: 'ferias' | 'escala' | 'padrao' }
  function codigo(conj, comp, doc, g, p, dt, cmap) {
    const m = p.ativ ? ((A().sit[conj] || {})[dt.slice(0, 7)] || {})[p.ativ + '|' + dt] : ((doc.d || {})[p.k] || {})[dt];
    if (m) return { v: m, auto: false };
    if (p.desligado && dt >= p.desligado) return { v: 'DS', auto: true, por: 'padrao' };
    if (ferIdx()({ mat: p.mat, nome: p.nome }, dt)) return { v: 'FE', auto: true, por: 'ferias' };
    const E = X.escala(); const rt = regimeTurma(conj, g, p, cmap);
    const pr = E.previsto(normRegime(rt.regime, E.regimes), rt.turma, dt);
    if (pr && !pr.trab) return { v: 'F', auto: true, por: 'escala', motivo: pr.motivo };
    return dt <= TODAY ? { v: 'P', auto: true, por: 'padrao' } : { v: '', auto: true, por: 'padrao' };
  }
  const compDoc = (conj, comp) => { DB.admWatch(conj, comp); return A().comps[conj + '|' + comp]; };

  /* ---------- topo: Pátio | Bateria e competência ---------- */
  function topo(view) {
    if (view !== 'afreq' && view !== 'apainel') return '';
    return `<div class="seg setsw" role="tablist" aria-label="Conjunto">${['patio', 'bateria'].map(k => `<button type="button" role="tab" data-a="conj" data-v="${k}" aria-selected="${U.conj === k}">${SETS[k].curto}</button>`).join('')}</div>
      <div class="compnav"><button class="btn ghost sm" data-a="comp" data-v="-1" aria-label="Competência anterior">‹</button><b>${nomeComp(U.comp)}</b><button class="btn ghost sm" data-a="comp" data-v="1" aria-label="Próxima competência">›</button></div>`;
  }

  /* ---------- Frequência ---------- */
  function totais(conj, comp, doc, g, p, datas, cmap) {
    const t = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0 };
    for (const dt of datas) { const c = codigo(conj, comp, doc, g, p, dt, cmap).v; if (c in t) t[c]++; }
    return t;
  }
  function vFreq() {
    const conj = U.conj, comp = U.comp, doc = compDoc(conj, comp);
    if (doc === undefined) return '<div class="card skel"><i></i><i></i><i></i></div>';
    if (!doc) {
      const ant = compDoc(conj, compMais(comp, -1));
      return `<div class="card"><div class="empty"><b>A folha de ${nomeComp(comp)} (${SETS[conj].curto}) ainda não foi aberta.</b><br>${ant && pode() ? `<button class="btn pri" data-a="abrirComp">Abrir a folha com os grupos de ${nomeComp(compMais(comp, -1))}</button>` : ant === null ? 'Sem folha anterior. O administrador importa as planilhas em Importar planilhas.' : ''}</div></div>`;
    }
    const datas = diasDaCompetencia(comp); const cmap = colabPorId(conj);
    const q = normNome(U.q || '');
    const ed = pode();
    const nG = doc.grupos.length; const recolhe = nG > 4 && !q;
    const ab = new Set(U.abertos);
    const resumo = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0, pessoas: 0 };
    let corpo = '';
    doc.grupos.forEach((g, gi) => {
      const ps = g.pessoas.filter(p => !q || normNome(p.nome).includes(q));
      if (!ps.length) return;
      const tot = ps.map(p => totais(conj, comp, doc, g, p, datas, cmap));
      tot.forEach(t => { for (const k of Object.keys(t)) resumo[k] += t[k] > 0 ? (k === 'HE' ? t[k] : t[k]) : 0; }); resumo.pessoas += ps.length;
      const aberto = !recolhe || ab.has(String(gi));
      const soma = k => tot.reduce((n, t) => n + t[k], 0);
      corpo += `<tr class="grp-row"><th colspan="${datas.length + 6}"><button type="button" class="efg${aberto ? ' on' : ''}" data-a="grupo" data-v="${gi}" aria-expanded="${aberto}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(g.nome)}</b></button><span class="gcount">${ps.length} pessoa${ps.length > 1 ? 's' : ''}${soma('FT') ? ` · ${soma('FT')} falta(s)` : ''}${soma('AT') ? ` · ${soma('AT')} atestado(s)` : ''}</span>${ed ? `<button class="btn ghost sm" data-a="addPessoa" data-v="${gi}">${I.plus} Pessoa</button>` : ''}</th></tr>`;
      if (!aberto) return;
      ps.forEach((p, i) => {
        const t = tot[i];
        corpo += `<tr><th class="fnome"><button type="button" class="btn ghost link" data-a="pessoa" data-g="${gi}" data-p="${esc(p.k)}">${esc(title(p.nome))}</button><small>${p.ativ ? 'Atividades' : 'só na folha'}${p.turma ? ' · turma ' + esc(p.turma) : ''}${p.desligado ? ' · desligado ' + ddmm(p.desligado) : ''}</small></th>${datas.map(dt => {
          const c = codigo(conj, comp, doc, g, p, dt, cmap);
          return `<td class="c${dt === TODAY ? ' today' : ''}"><button class="sit ${c.v}${c.auto ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}" ${ed ? `data-a="cel" data-g="${gi}" data-p="${esc(p.k)}" data-dt="${dt}"` : 'disabled'} title="${dBR(dt)} · ${esc(NOMES_CODIGO[c.v] || 'sem lançamento')}${c.por === 'ferias' ? ' (férias)' : c.por === 'escala' ? ' (folga pela escala)' : ''}">${c.v === 'P' ? '' : c.v}</button></td>`;
        }).join('')}${CONTA.map(k => `<td class="c num tot${t[k] ? ' on' : ''}">${t[k] || ''}</td>`).join('')}</tr>`;
      });
    });
    const head = `<tr><th class="fnome">Nome</th>${datas.map(dt => { const d = new Date(dt + 'T12:00:00'); return `<th class="c${dt === TODAY ? ' today' : ''}${[0, 6].includes(d.getDay()) ? ' fds' : ''}">${dt.slice(8)}<br><span class="thd">${DIA_L[d.getDay()]}</span></th>`; }).join('')}${CONTA.map(k => `<th class="c" title="${NOMES_CODIGO[k]}">${k}</th>`).join('')}</tr>`;
    return `<div class="mini"><div><b class="num">${resumo.pessoas}</b><span>Pessoas</span></div><div><b class="num" style="color:var(--st-nreal)">${resumo.FT}</b><span>Faltas</span></div><div><b class="num" style="color:var(--st-atr)">${resumo.AT}</b><span>Atestados</span></div><div><b class="num">${resumo.AB}</b><span>Abonos</span></div><div><b class="num" style="color:var(--st-extra)">${resumo.HE}</b><span>Horas extras</span></div><div><b class="num">${resumo.FE}</b><span>Dias de férias</span></div></div>
      <div class="card"><div class="body lbar"><label class="sel grow"><span>Buscar</span><input class="in" id="aQ" type="search" placeholder="Nome" value="${esc(U.q || '')}"></label>
        ${recolhe ? `<button class="btn sm" data-a="todos">${ab.size ? 'Recolher todos' : 'Abrir todos os grupos'}</button>` : ''}
        ${!X.framed ? `<button class="btn sm" data-a="exportar">${I.dl} Exportar Excel</button>` : ''}
        ${ed ? `<button class="btn sm" data-a="novoGrupo">${I.plus} Grupo</button>` : ''}</div>
        <details class="legdet body pt0 pb0"${X.isMobile() ? '' : ' open'}><summary>Legenda</summary><div class="legend sitleg">${CODS.map(c => `<span><span class="sit ${c}">${c === 'P' ? I.ok : c}</span> ${NOMES_CODIGO[c]}</span>`).join('')}<span><span class="sit F auto">F</span> Automático (escala, férias)</span><span class="muted">${ed ? 'Toque no dia para lançar. Quem está nas Atividades é a mesma presença do Efetivo diário.' : 'Somente leitura'}</span></div></details>
        <div class="tw freqtw"><table class="efd freq"><thead>${head}</thead><tbody>${corpo || `<tr><td colspan="${datas.length + 6}" class="empty">Ninguém encontrado.</td></tr>`}</tbody></table></div></div>`;
  }
  const achar = (doc, gi, k) => { const g = doc.grupos[+gi]; return { g, p: g && g.pessoas.find(x => x.k === k) }; };
  function lancar(gi, k, dt) {
    const conj = U.conj, comp = U.comp, doc = A().comps[conj + '|' + comp]; if (!doc) return;
    const { g, p } = achar(doc, gi, k); if (!p) return;
    const cmap = colabPorId(conj); const atual = codigo(conj, comp, doc, g, p, dt, cmap);
    const datas = diasDaCompetencia(comp);
    sheet(title(p.nome), `${dBR(dt)} · agora: ${NOMES_CODIGO[atual.v] || 'sem lançamento'}${atual.auto ? ' (automático)' : ''}`,
      [...CODS.map(c => ({ t: NOMES_CODIGO[c], d: c, v: c, cur: !atual.auto && atual.v === c })), ...(!atual.auto ? [{ t: 'Voltar ao automático', d: 'Escala, férias ou presente', v: '' }] : [])],
      o => {
        const restantes = datas.filter(x => x > dt);
        const aplicar = ate => { const lista = [dt, ...restantes.filter(x => x <= ate)]; lista.forEach(x => DB.admSetCodigo(conj, comp, p, x, o.v)); DB.log(`Administrativo: ${title(p.nome)} → ${o.v ? NOMES_CODIGO[o.v] : 'automático'} ${lista.length > 1 ? `de ${ddmm(dt)} a ${ddmm(lista[lista.length - 1])}` : 'em ' + ddmm(dt)}`); toast(lista.length > 1 ? `${lista.length} dias lançados` : 'Lançado'); };
        if (!o.v || !restantes.length || ['P', 'HE'].includes(o.v)) return aplicar(dt);
        sheet('Até quando?', `${NOMES_CODIGO[o.v]} a partir de ${dBR(dt)}`, [{ t: 'Só este dia', v: dt }, ...[2, 4, 6, 14].filter(n => restantes[n - 1]).map(n => ({ t: `${n + 1} dias`, d: `até ${dBR(restantes[n - 1])}`, v: restantes[n - 1] })), { t: 'Até o fim da competência', d: dBR(datas[datas.length - 1]), v: datas[datas.length - 1] }], x => aplicar(x.v));
      });
  }
  function opcoesPessoa() {
    const out = []; const vistos = new Set();
    for (const c of A().rh || []) { const k = normNome(c.nome); if (vistos.has(k)) continue; vistos.add(k); out.push({ nome: c.nome, mat: String(c.mat || '') }); }
    for (const conj of ['patio', 'bateria']) for (const c of A().colabs[conj] || []) { const k = normNome(c.nome); if (vistos.has(k)) continue; vistos.add(k); out.push({ nome: c.nome, mat: c.mat || '' }); }
    return out.sort((a, b) => a.nome.localeCompare(b.nome));
  }
  function addPessoa(gi) {
    const conj = U.conj, comp = U.comp, doc = A().comps[conj + '|' + comp]; if (!doc) return;
    const ops = opcoesPessoa();
    formSheet('Incluir na folha', `${esc(doc.grupos[+gi].nome)} · ${nomeComp(comp)}`, `<label class="sel"><span>Nome (escolha da lista ou digite)</span><input class="in" id="apNome" list="apLista" autocomplete="off" required></label><datalist id="apLista">${ops.map(o => `<option value="${esc(o.nome)}">${o.mat ? 'Matrícula ' + esc(o.mat) : ''}</option>`).join('')}</datalist><label class="sel"><span>Turma (turno)</span><input class="in" id="apTurma" maxlength="1" placeholder="A, B, I, J…"></label>`, 'Incluir', async () => {
      const nome = $('apNome').value.trim().toUpperCase(); if (normNome(nome).split(' ').length < 2) throw new Error('Informe o nome completo.');
      const rh = criarBusca(A().rh || [])(nome); const mat = rh ? String(rh.item.mat || '') : '';
      const at = criarBusca(A().colabs[conj] || [])(nome, mat);
      const p = { k: mat || 'n:' + normNome(nome), nome: rh ? rh.item.nome : nome, mat, turma: $('apTurma').value.trim().toUpperCase(), obs: '', notas: [], ativ: at ? at.item.id : null, desligado: null };
      if (doc.grupos.some(g => g.pessoas.some(x => x.k === p.k))) throw new Error('Essa pessoa já está na folha.');
      const grupos = doc.grupos.map((g, i) => (i === +gi ? { ...g, pessoas: [...g.pessoas, p].sort((a, b) => a.nome.localeCompare(b.nome)) } : g));
      doc.grupos = grupos; await DB.admSalvarGrupos(conj, comp, grupos); toast(`${title(p.nome)} incluído${p.ativ ? ' · ligado às Atividades' : ''}`); render();
    });
  }
  function menuPessoa(gi, k) {
    const conj = U.conj, comp = U.comp, doc = A().comps[conj + '|' + comp]; if (!doc) return;
    const { p } = achar(doc, gi, k); if (!p) return;
    const ed = pode();
    sheet(title(p.nome), `${p.mat ? 'Matrícula ' + esc(p.mat) + ' · ' : ''}${p.ativ ? 'Presença em comum com o Efetivo diário (' + esc(p.ativ) + ')' : 'Só na folha'}${p.notas && p.notas.length ? ' · ' + esc(p.notas.join(' · ')) : ''}`,
      [...(ed ? [...doc.grupos.map((g, i) => (i === +gi ? null : { t: 'Mover para ' + g.nome, v: 'mv:' + i })).filter(Boolean), { t: 'Tirar desta folha', d: 'Os lançamentos ficam guardados', v: 'rm' }] : []), { t: 'Ver férias', v: 'fer' }],
      async o => {
        if (o.v === 'fer') { U.fQ = p.nome; UI.view = 'aferias'; render(); return; }
        let grupos = doc.grupos.map(g => ({ ...g, pessoas: g.pessoas.filter(x => x.k !== k) }));
        if (o.v.startsWith('mv:')) { const i = +o.v.slice(3); grupos[i] = { ...grupos[i], pessoas: [...grupos[i].pessoas, p].sort((a, b) => a.nome.localeCompare(b.nome)) }; }
        doc.grupos = grupos; await DB.admSalvarGrupos(conj, comp, grupos); toast(o.v === 'rm' ? 'Tirado da folha' : 'Mudou de grupo'); render();
      });
  }
  function exportar() {
    const conj = U.conj, comp = U.comp, doc = A().comps[conj + '|' + comp]; if (!doc) return;
    const datas = diasDaCompetencia(comp); const cmap = colabPorId(conj);
    const linhas = [['Grupo', 'Nome', 'Matrícula', ...datas.map(d => ddmm(d)), ...CONTA.map(k => NOMES_CODIGO[k])]];
    for (const g of doc.grupos) for (const p of g.pessoas) { const t = totais(conj, comp, doc, g, p, datas, cmap); linhas.push([g.nome, p.nome, p.mat || '', ...datas.map(dt => codigo(conj, comp, doc, g, p, dt, cmap).v), ...CONTA.map(k => t[k] || '')]); }
    baixarExcel(`frequencia-${conj}-${comp}`, [{ nome: `${SETS[conj].curto} ${nomeComp(comp)}`, linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  }

  /* ---------- Férias ---------- */
  const situacaoFerias = f => {
    if (!f.inicio) return { t: 'Sem data', cls: 'neu' };
    if (f.termino && f.termino < TODAY) return { t: 'Gozada', cls: 'ok' };
    if (f.inicio <= TODAY) return { t: `Em férias · volta ${dBR(f.retorno || addDias(f.termino, 1))}`, cls: 'warn' };
    const n = diasEntre(TODAY, f.inicio); return { t: n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`, cls: n <= 15 ? 'warn' : 'neu' };
  };
  function vFerias() {
    const L = A().ferias || [];
    if (!A().fLoaded) return '<div class="card skel"><i></i><i></i><i></i></div>';
    const setores = [...new Set(L.map(f => f.setor).filter(Boolean))].sort();
    const q = normNome(U.fQ || '');
    let l = L.filter(f => (!U.fSetor || f.setor === U.fSetor) && (!q || normNome(f.nome).includes(q) || String(f.mat || '').includes(q)));
    const em60 = add(TODAY, 60), mesSel = U.fMes || TODAY.slice(0, 7);
    if (U.fAba === 'agora') l = l.filter(f => f.inicio && ((f.inicio <= TODAY && (f.termino || '') >= TODAY) || (f.inicio > TODAY && f.inicio <= em60))).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    else if (U.fAba === 'mes') l = l.filter(f => (f.inicio ? f.inicio.slice(0, 7) === mesSel : f.mesPlanejado === mesSel)).sort((a, b) => String(a.inicio || '9').localeCompare(String(b.inicio || '9')) || a.nome.localeCompare(b.nome));
    else if (U.fAba === 'limite') {
      const marcadas = new Set(L.filter(f => f.inicio && f.inicio >= TODAY.slice(0, 7) + '-01').map(f => f.mat || normNome(f.nome)));
      l = l.filter(f => f.limite && f.limite <= add(TODAY, 90) && !marcadas.has(f.mat || normNome(f.nome))).sort((a, b) => (a.limite < b.limite ? -1 : 1));
    } else l = l.sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
    const emFerias = L.filter(f => f.inicio && f.inicio <= TODAY && (f.termino || '') >= TODAY).length;
    const comecam = L.filter(f => f.inicio && f.inicio > TODAY && f.inicio <= add(TODAY, 30)).length;
    const marcadasT = new Set(L.filter(f => f.inicio && f.inicio >= TODAY.slice(0, 7) + '-01').map(f => f.mat || normNome(f.nome)));
    const vencendo = L.filter(f => f.limite && f.limite <= add(TODAY, 60) && !marcadasT.has(f.mat || normNome(f.nome))).length;
    const meses = []; for (let i = -2; i <= 12; i++) meses.push(compMais(TODAY.slice(0, 7), i));
    return `<div class="mini"><div><b class="num" style="color:var(--st-atr)">${emFerias}</b><span>Em férias hoje</span></div><div><b class="num">${comecam}</b><span>Começam em 30 dias</span></div><div><b class="num" style="color:var(--st-nreal)">${vencendo}</b><span>Limite vencido ou em 60 dias, sem data</span></div></div>
      <div class="card"><div class="body lbar">
        <div class="rchips" role="group" aria-label="Mostrar">${[['agora', 'Agora e próximos 60 dias'], ['mes', 'Por mês'], ['limite', 'Data limite'], ['todas', 'Todas']].map(([k, t]) => `<button class="rchip" data-a="fAba" data-v="${k}" aria-pressed="${U.fAba === k}">${t}</button>`).join('')}</div>
        ${U.fAba === 'mes' ? `<label class="sel"><span>Mês</span><select class="in" id="aFMes">${meses.map(m => `<option value="${m}" ${m === mesSel ? 'selected' : ''}>${nomeComp(m)}</option>`).join('')}</select></label>` : ''}
        <label class="sel"><span>Setor</span><select class="in" id="aFSetor"><option value="">Todos</option>${setores.map(s => `<option ${s === U.fSetor ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="sel grow"><span>Buscar</span><input class="in" id="aFQ" type="search" placeholder="Nome ou matrícula" value="${esc(U.fQ || '')}"></label>
        ${pode() ? `<button class="btn pri" data-a="novaFerias">${I.plus} Férias</button>` : ''}
        ${!X.framed ? `<button class="btn sm" data-a="exportarFerias">${I.dl} Exportar</button>` : ''}
      </div>
      ${l.length ? `<div class="plist ferlist">${l.slice(0, 300).map(f => { const s = situacaoFerias(f); const lim = f.limite && !f.inicio ? diasEntre(TODAY, f.limite) : null; return `<button class="pitem ferit" data-a="ferias" data-v="${esc(f.id)}"><div class="minw"><div class="t">${esc(title(f.nome))} <span class="muted small">${f.mat ? '· ' + esc(f.mat) : ''}</span></div><div class="l">${esc(f.setor || '')}${f.funcao ? ' · ' + esc(title(f.funcao)) : ''}${f.horario ? ' · ' + esc(f.horario) : ''}</div><div class="l">${f.inicio ? `<b>${dBR(f.inicio)} a ${dBR(f.termino)}</b> (${f.dias || ''} dias) · retorno ${dBR(f.retorno)}` : `Planejada para ${f.mesPlanejado ? nomeComp(f.mesPlanejado) : '—'}`}${f.substituto ? ' · ' + esc(f.substituto) : ''}</div></div><div class="fer-r"><span class="pill ${s.cls}">${esc(s.t)}</span>${f.limite ? `<small class="${lim != null && lim <= 60 ? 'bad' : 'muted'}">limite ${dBR(f.limite)}</small>` : ''}</div></button>`; }).join('')}</div>${l.length > 300 ? `<p class="muted small body">Mostrando 300 de ${l.length}. Use a busca ou o setor.</p>` : ''}` : `<div class="empty">${U.fAba === 'limite' ? 'Ninguém com data limite nos próximos 90 dias sem férias marcadas.' : 'Nenhuma férias com esses filtros.'}</div>`}</div>`;
  }
  function formFerias(id) {
    const f = id ? A().ferias.find(x => x.id === id) : null;
    const ed = pode();
    if (!ed && f) { sheet(title(f.nome), `${dBR(f.inicio)} a ${dBR(f.termino)}`, [{ t: 'Fechar', v: '' }], () => {}); return; }
    const ops = opcoesPessoa();
    const v = (k, d = '') => esc(f && f[k] != null ? f[k] : d);
    formSheet(f ? 'Férias de ' + title(f.nome) : 'Novas férias', f ? esc(f.setor || '') : 'Escolha a pessoa e as datas', `
      ${f ? '' : `<label class="sel"><span>Nome</span><input class="in" id="afNome" list="afLista" autocomplete="off" required></label><datalist id="afLista">${ops.map(o => `<option value="${esc(o.nome)}">${o.mat ? 'Matrícula ' + esc(o.mat) : ''}</option>`).join('')}</datalist>`}
      <div class="g2eq"><label class="sel"><span>Setor</span><input class="in" id="afSetor" value="${v('setor', U.conj === 'bateria' ? 'BATERIA' : 'PATIO')}"></label><label class="sel"><span>Horário</span><input class="in" id="afHor" value="${v('horario', 'ADM')}"></label></div>
      <div class="g2eq"><label class="sel"><span>Início</span><input class="in" type="date" id="afIni" value="${v('inicio')}"></label><label class="sel"><span>Dias</span><input class="in" type="number" min="5" max="30" id="afDias" value="${v('dias', 30)}"></label></div>
      <div class="g2eq"><label class="sel"><span>Retorno</span><input class="in" type="date" id="afRet" value="${v('retorno')}"></label><label class="sel"><span>Data limite</span><input class="in" type="date" id="afLim" value="${v('limite')}"></label></div>
      <label class="sel"><span>Substituto / observação</span><input class="in" id="afSub" value="${v('substituto')}"></label>
      <p class="muted small m0" id="afCalc"></p>
      ${f ? '<button type="button" class="btn ghost danger sm" id="afDel">Excluir estas férias</button>' : ''}`, 'Salvar', async () => {
      const ini = $('afIni').value || null, dias = +$('afDias').value || 30;
      const termino = ini ? addDias(ini, dias - 1) : null;
      let nome = f ? f.nome : $('afNome').value.trim().toUpperCase(); let mat = f ? f.mat : '';
      if (!f) { if (normNome(nome).split(' ').length < 2) throw new Error('Informe o nome completo.'); const r = criarBusca(A().rh || [])(nome); if (r) { mat = String(r.item.mat || ''); nome = r.item.nome; } }
      const dados = { nome, mat, setor: $('afSetor').value.trim().toUpperCase(), horario: $('afHor').value.trim().toUpperCase(), inicio: ini, dias, termino, retorno: $('afRet').value || (termino ? addDias(termino, 1) : null), limite: $('afLim').value || null, substituto: $('afSub').value.trim(), mesPlanejado: ini ? ini.slice(0, 7) : (f && f.mesPlanejado) || null };
      if (!f) Object.assign(dados, { funcao: '', admissao: null });
      if (dados.limite && termino && termino > dados.limite) toast('Atenção: as férias terminam depois da data limite');
      await DB.feriasSalvar(f ? f.id : null, dados); DB.log(`Administrativo: férias de ${title(nome)} ${ini ? `de ${ddmm(ini)} a ${ddmm(termino)}` : 'sem data'}`); toast('Férias salvas'); render();
    });
    const calc = () => { const i = $('afIni') && $('afIni').value, d = +($('afDias') && $('afDias').value) || 30; const out = $('afCalc'); if (!out) return; if (!i) { out.textContent = 'Sem início, fica como planejada.'; return; } const t = addDias(i, d - 1); out.textContent = `Termina em ${dBR(t)}. Retorno sugerido: ${dBR(addDias(t, 1))}.`; if ($('afRet') && !$('afRet').value) $('afRet').placeholder = addDias(t, 1); };
    ['afIni', 'afDias'].forEach(k => { const e = $(k); if (e) e.addEventListener('input', calc); }); calc();
    const del = $('afDel'); if (del) del.addEventListener('click', () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Excluir mesmo?'; return; } DB.feriasExcluir(f.id); document.getElementById('layer').innerHTML = ''; toast('Férias excluídas'); render(); });
  }

  /* ---------- Painel ---------- */
  function vPainel() {
    const conj = U.conj, comp = U.comp, doc = compDoc(conj, comp);
    const L = A().ferias || [];
    const emFer = L.filter(f => f.inicio && f.inicio <= TODAY && (f.termino || '') >= TODAY);
    const comecam = L.filter(f => f.inicio && f.inicio > TODAY && f.inicio <= add(TODAY, 30)).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const voltam = L.filter(f => f.retorno && f.retorno >= TODAY && f.retorno <= add(TODAY, 7));
    const marcadas = new Set(L.filter(f => f.inicio && f.inicio >= TODAY.slice(0, 7) + '-01').map(f => f.mat || normNome(f.nome)));
    const vencendo = L.filter(f => f.limite && f.limite <= add(TODAY, 60) && !marcadas.has(f.mat || normNome(f.nome))).sort((a, b) => (a.limite < b.limite ? -1 : 1));
    let freq = '<div class="card skel"><i></i><i></i></div>';
    if (doc === null) freq = `<div class="card"><div class="empty">A folha de ${nomeComp(comp)} (${SETS[conj].curto}) ainda não foi aberta. <button class="btn sm" data-a="ir" data-v="afreq">Abrir a Frequência</button></div></div>`;
    else if (doc) {
      const datas = diasDaCompetencia(comp).filter(d => d <= TODAY); const cmap = colabPorId(conj);
      const pessoas = []; const soma = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0 };
      for (const g of doc.grupos) for (const p of g.pessoas) { const t = totais(conj, comp, doc, g, p, datas, cmap); for (const k of Object.keys(soma)) soma[k] += t[k]; if (t.FT + t.AT + t.SP) pessoas.push({ p, g, t }); }
      pessoas.sort((a, b) => (b.t.FT * 2 + b.t.AT + b.t.SP * 3) - (a.t.FT * 2 + a.t.AT + a.t.SP * 3));
      freq = `<div class="card"><header><h2>Frequência · ${SETS[conj].curto}</h2><p>${nomeComp(comp)} até hoje</p><span class="r"><button class="btn sm" data-a="ir" data-v="afreq">Abrir a folha</button></span></header><div class="body stackcol">
        <div class="kpis5">${[['FT', 'Faltas', 'var(--st-nreal)'], ['AT', 'Atestados', 'var(--st-atr)'], ['AB', 'Abonos', ''], ['SP', 'Suspensões', ''], ['HE', 'Horas extras', 'var(--st-extra)']].map(([k, t, c]) => `<div><b class="num" ${c ? `style="color:${c}"` : ''}>${soma[k]}</b><span>${t}</span></div>`).join('')}</div>
        ${pessoas.length ? `<div class="md-sub">Mais ausências na competência</div><div class="plist">${pessoas.slice(0, 8).map(x => `<div class="pitem"><div class="minw"><div class="t">${esc(title(x.p.nome))}</div><div class="l">${esc(x.g.nome)}</div></div><span class="cell num">${[x.t.FT ? x.t.FT + ' FT' : '', x.t.AT ? x.t.AT + ' AT' : '', x.t.SP ? x.t.SP + ' SP' : ''].filter(Boolean).join(' · ')}</span></div>`).join('')}</div>` : '<p class="muted m0">Nenhuma falta, atestado ou suspensão até hoje.</p>'}
      </div></div>`;
    }
    const lista = (l, txt) => l.length ? `<div class="plist">${l.slice(0, 8).map(f => `<button class="pitem" data-a="ferias" data-v="${esc(f.id)}"><div class="minw"><div class="t">${esc(title(f.nome))}</div><div class="l">${esc(f.setor || '')} · ${txt(f)}</div></div></button>`).join('')}${l.length > 8 ? `<p class="muted small m0">+ ${l.length - 8}</p>` : ''}</div>` : '<p class="muted m0">Ninguém.</p>';
    return `<div class="md-top">${freq}<div class="card"><header><h2>Férias</h2><p>Hoje e próximos dias</p><span class="r"><button class="btn sm" data-a="ir" data-v="aferias">Abrir Férias</button></span></header><div class="body stackcol">
      <div class="md-sub">Em férias hoje (${emFer.length})</div>${lista(emFer, f => `volta ${dBR(f.retorno)}`)}
      <div class="md-sub">Começam em 30 dias (${comecam.length})</div>${lista(comecam, f => `de ${dBR(f.inicio)} a ${dBR(f.termino)}`)}
      ${voltam.length ? `<div class="md-sub">Voltam nesta semana (${voltam.length})</div>${lista(voltam, f => `retorno ${dBR(f.retorno)}`)}` : ''}
      <div class="md-sub ${vencendo.length ? 'bad' : ''}">Data limite vencida ou em 60 dias, sem férias marcadas (${vencendo.length})</div>${lista(vencendo, f => `limite ${dBR(f.limite)}`)}
    </div></div></div>`;
  }

  /* ---------- Importar ---------- */
  function vImport() {
    const st = U.imp;
    if (ME().papel !== 'admin') return '<div class="card"><div class="empty">Só o administrador importa planilhas.</div></div>';
    let h = `<div class="grid2"><div class="card"><header><h2>Planilhas recebidas</h2><p>CONTROLE DE FREQUÊNCIA (Pátio e Bateria) e FÉRIAS GERAL, já no sistema</p></header><div class="body stackcol"><p class="m0 small">Lê as planilhas, liga cada pessoa ao cadastro do RH e às Atividades e mostra a conferência antes de gravar. Na presença do dia, só preenche o que ainda está vazio: nada do que os líderes já lançaram é trocado.</p><div class="row-gap"><button class="btn pri" data-a="impSeeds" ${st && st.busy ? 'disabled' : ''}>${st && st.busy ? 'Lendo…' : 'Ler as planilhas recebidas'}</button></div></div></div>
      <div class="card"><header><h2>Importar arquivo</h2><p>Uma planilha nova de frequência ou de férias (Excel)</p></header><div class="body stackcol"><div class="seg setsw" role="tablist" aria-label="Frequência de">${['patio', 'bateria'].map(k => `<button type="button" role="tab" data-a="impConj" data-v="${k}" aria-selected="${(U.impConj || 'patio') === k}">${SETS[k].curto}</button>`).join('')}</div><p class="muted small m0">Frequência: escolha Pátio ou Bateria. Férias: o sistema reconhece sozinho.</p><label class="btn">${I.file} Escolher arquivo<input type="file" id="aImpArq" accept=".xlsx,.xlsm,.xls" hidden></label></div></div></div>`;
    if (st && st.erro) h += `<div class="card"><div class="body"><p class="err m0">${esc(st.erro)}</p></div></div>`;
    if (st && st.prep) {
      const r = st.prep.resumo;
      h += `<div class="card"><header><h2>Conferência</h2><p>${esc(st.origem || '')}</p></header><div class="body stackcol">
        ${Object.entries(r.frequencia).map(([conj, x]) => `<div><b>Frequência ${SETS[conj].curto}</b>: ${x.competencias.map(nomeComp).join(', ')} · ${x.pessoas} pessoas · ${x.diasPresenca} dias na presença do Efetivo diário (só os vazios) · ${x.diasFolha} dias de quem está só na folha</div>`).join('')}
        ${r.ferias ? `<div><b>Férias</b>: ${r.ferias.total} períodos (${r.ferias.comData} com data marcada)</div><label class="mchip"><input type="checkbox" id="aImpSubst" ${st.subst ? 'checked' : ''}><span>Substituir as férias que já estão no sistema (${A().ferias.length})</span></label>` : ''}
        ${r.semRH.length ? `<details class="legdet"><summary>${r.semRH.length} nome(s) sem ficha no RH (entram na folha mesmo assim)</summary><p class="small m0">${r.semRH.map(x => esc(title(x.nome))).join(' · ')}</p></details>` : ''}
        <div class="row-gap"><button class="btn pri" data-a="impOk" ${st.busy ? 'disabled' : ''}>${st.busy ? 'Gravando…' : 'Gravar no sistema'}</button><button class="btn" data-a="impCancel">Cancelar</button></div></div></div>`;
    }
    if (st && st.feito) h += `<div class="card"><div class="body"><p class="m0"><b>Importação concluída.</b> ${esc(st.feito)}</p></div></div>`;
    return h;
  }
  async function impSeeds() {
    U.imp = { busy: true }; render();
    try {
      const [fp, fb, fe] = await Promise.all(['seed-freq-patio.json', 'seed-freq-bateria.json', 'seed-ferias.json'].map(n => DB.seed(n)));
      const prep = prepararImportacao({ freq: { patio: fp, bateria: fb }, ferias: fe, colabs: A().colabs, rh: A().rh });
      U.imp = { prep, origem: 'Planilhas recebidas: frequência do Pátio, frequência da Bateria e férias', subst: true };
    } catch (e) { U.imp = { erro: (e && e.message) || String(e) }; }
    render();
  }
  async function impArquivo(file) {
    U.imp = { busy: true }; render();
    try {
      const XLSX = await import('./vendor/xlsx.js');
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
      const abas = abasDoXLSX(XLSX, wb);
      const ehFerias = abas.some(a => a.linhas.some(l => (l || []).some(v => typeof v === 'string' && /^matr[ií]cula$/i.test(v.trim()))));
      const conj = U.impConj || 'patio';
      const prep = ehFerias ? prepararImportacao({ ferias: lerFerias(abas), colabs: A().colabs, rh: A().rh }) : prepararImportacao({ freq: { [conj]: lerFrequencia(abas, conj) }, colabs: A().colabs, rh: A().rh });
      if (!prep.comps.length && !(prep.ferias && prep.ferias.length)) throw new Error('Não achei folha de frequência nem lista de férias nesse arquivo.');
      U.imp = { prep, origem: `${file.name} · ${ehFerias ? 'férias' : 'frequência ' + SETS[conj].curto}`, subst: false };
    } catch (e) { U.imp = { erro: 'Não foi possível ler o arquivo: ' + ((e && e.message) || e) }; }
    render();
  }
  async function impOk() {
    const st = U.imp; if (!st || !st.prep) return;
    st.subst = !!($('aImpSubst') && $('aImpSubst').checked);
    st.busy = true; render();
    try {
      const n = await DB.admImportar({ comps: st.prep.comps, presenca: st.prep.presenca, ferias: st.prep.ferias, substituirFerias: st.subst });
      DB.log(`Administrativo: importou ${st.origem}`);
      U.imp = { feito: `${st.prep.comps.length} folha(s) gravada(s), ${n} dia(s) de presença preenchidos${st.prep.ferias ? `, ${st.prep.ferias.length} férias` : ''}.` };
      if (st.prep.comps.length) { const ult = st.prep.comps[st.prep.comps.length - 1]; U.conj = ult.conj; }
    } catch (e) { U.imp = { ...st, busy: false, erro: (e && e.message) || String(e) }; }
    render();
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-a]'); if (!t || t.closest('#layer') || UI.modulo !== 'adm') return;
    const a = t.dataset.a, v = t.dataset.v;
    if (a === 'conj') { U.conj = v; render(); }
    else if (a === 'comp') { U.comp = compMais(U.comp, +v); render(); }
    else if (a === 'grupo') { const s = new Set(U.abertos); if (s.has(v)) s.delete(v); else s.add(v); U.abertos = [...s]; render(); }
    else if (a === 'todos') { const doc = A().comps[U.conj + '|' + U.comp]; U.abertos = U.abertos.length || !doc ? [] : doc.grupos.map((_, i) => String(i)); render(); }
    else if (a === 'cel') lancar(t.dataset.g, t.dataset.p, t.dataset.dt);
    else if (a === 'pessoa') menuPessoa(t.dataset.g, t.dataset.p);
    else if (a === 'addPessoa') addPessoa(v);
    else if (a === 'novoGrupo') {
      const doc = A().comps[U.conj + '|' + U.comp]; if (!doc) return;
      formSheet('Novo grupo', `${SETS[U.conj].curto} · ${nomeComp(U.comp)}`, '<label class="sel"><span>Nome do grupo</span><input class="in" id="agNome" required placeholder="Ex.: LIDER FULANO - SUPERVISÃO CICLANO"></label><label class="mchip"><input type="checkbox" id="agTurno"><span>Grupo de turno (D e N são dias trabalhados)</span></label>', 'Criar', async () => {
        const nome = $('agNome').value.trim().toUpperCase(); if (!nome) throw new Error('Informe o nome.');
        const grupos = [...doc.grupos, { nome, turno: $('agTurno').checked, pessoas: [] }]; doc.grupos = grupos; await DB.admSalvarGrupos(U.conj, U.comp, grupos); toast('Grupo criado'); render();
      });
    }
    else if (a === 'abrirComp') {
      const ant = A().comps[U.conj + '|' + compMais(U.comp, -1)]; if (!ant) return;
      const datas = diasDaCompetencia(U.comp);
      const grupos = ant.grupos.map(g => ({ ...g, pessoas: g.pessoas.filter(p => !p.desligado).map(p => ({ ...p, notas: [] })) }));
      await DB.admSalvarComp(U.conj, U.comp, { ini: datas[0], fim: datas[datas.length - 1], grupos, d: {} }); toast(`Folha de ${nomeComp(U.comp)} aberta`); render();
    }
    else if (a === 'exportar') exportar();
    else if (a === 'fAba') { U.fAba = v; render(); }
    else if (a === 'novaFerias') formFerias(null);
    else if (a === 'ferias') formFerias(v);
    else if (a === 'exportarFerias') baixarExcel('ferias', [{ nome: 'Férias', linhas: [['Matrícula', 'Nome', 'Setor', 'Função', 'Horário', 'Admissão', 'Data limite', 'Início', 'Dias', 'Término', 'Retorno', 'Substituto / observação'], ...A().ferias.slice().sort((x, y) => String(x.inicio || '9').localeCompare(String(y.inicio || '9')) || x.nome.localeCompare(y.nome)).map(f => [f.mat, f.nome, f.setor, f.funcao, f.horario, dataBR(f.admissao), dataBR(f.limite), dataBR(f.inicio), f.inicio ? f.dias : '', dataBR(f.termino), dataBR(f.retorno), f.substituto])] }]).catch(e => toast('Não foi possível exportar: ' + e.message));
    else if (a === 'ir') { UI.view = v; render(); scrollTo(0, 0); }
    else if (a === 'impSeeds') impSeeds();
    else if (a === 'impConj') { U.impConj = v; render(); }
    else if (a === 'impOk') impOk();
    else if (a === 'impCancel') { U.imp = null; render(); }
  });
  document.addEventListener('input', e => {
    if (UI.modulo !== 'adm') return;
    if (e.target.id === 'aQ') { U.q = e.target.value; clearTimeout(window._aqt); window._aqt = setTimeout(render, 220); }
    if (e.target.id === 'aFQ') { U.fQ = e.target.value; clearTimeout(window._aqt); window._aqt = setTimeout(render, 220); }
  });
  document.addEventListener('change', e => {
    if (UI.modulo !== 'adm') return;
    if (e.target.id === 'aFSetor') { U.fSetor = e.target.value; render(); }
    if (e.target.id === 'aFMes') { U.fMes = e.target.value; render(); }
    if (e.target.id === 'aImpArq' && e.target.files[0]) impArquivo(e.target.files[0]);
  });

  function renderView(view) {
    if (view === 'afreq') return vFreq();
    if (view === 'aferias') return vFerias();
    if (view === 'aimport') return vImport();
    return vPainel();
  }
  return { render: renderView, topo, badge: () => 0 };
}
