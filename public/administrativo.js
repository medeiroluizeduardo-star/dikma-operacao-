// Dikma Gestão — módulo Frequência e férias (dentro da Operação): Frequência (folha de 16 a 15), Férias e Importar planilhas.
// A presença de quem está nas Atividades é a mesma do Efetivo diário (situacao): o líder marca na Operação,
// a Frequência vê e corrige aqui. Quem não está nas Atividades (gestão, apoio) fica só na folha (freqcomp).
// Férias marcadas aqui aparecem sozinhas como FE no Efetivo diário e na folha.
import { SETS, today, add, ddmm, MESES_L } from './cal.js';
import { normRegime, letra } from './escala.js';
import { editaAdm, indiceFerias } from './acessos.js';
import { baixarExcel, dataBR } from './exportar.js';
import { diasDaCompetencia, competenciaDe, normNome, criarBusca, prepararImportacao, lerFrequencia, lerFerias, abasDoXLSX, addDias, NOMES_CODIGO, unirGrupos } from './planilhas-adm.js';
import { abrirLancamento } from './presenca.js';
import { caixaBusca } from './busca.js';

export const VIEWS_A = [
  { id: 'afreq', nome: 'Frequência', ic: 'prog', grp: 'Frequência e férias', mod: 'ad' },
  { id: 'aferias', nome: 'Férias', ic: 'sol', grp: 'Frequência e férias', mod: 'ad' },
  { id: 'aimport', nome: 'Importar planilhas', ic: 'dl', grp: 'Administração', mod: 'ad', admin: true }
];
export const SUB_A = {
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
  // per: turno do dia pela letra ('D' diurno, 'N' noturno; a noite conta no dia em que começa)
  function codigo(conj, comp, doc, g, p, dt, cmap) {
    const m = p.ativ ? ((A().sit[conj] || {})[dt.slice(0, 7)] || {})[p.ativ + '|' + dt] : ((doc.d || {})[p.k] || {})[dt];
    if (m) { if (!['P', 'HE', 'ATR'].includes(m)) return { v: m, auto: false }; const E = X.escala(); const rt = regimeTurma(conj, g, p, cmap); const pr = E.previsto(normRegime(rt.regime, E.regimes), rt.turma, dt); return { v: m, auto: false, per: pr && pr.trab ? pr.periodo || '' : '' }; }
    if (p.desligado && dt >= p.desligado) return { v: 'DS', auto: true, por: 'padrao' };
    if (ferIdx()({ mat: p.mat, nome: p.nome }, dt)) return { v: 'FE', auto: true, por: 'ferias' };
    const E = X.escala(); const rt = regimeTurma(conj, g, p, cmap);
    const pr = E.previsto(normRegime(rt.regime, E.regimes), rt.turma, dt);
    if (pr && !pr.trab) return { v: 'F', auto: true, por: 'escala', motivo: pr.motivo };
    const per = pr && pr.trab ? pr.periodo || '' : '';
    return dt <= TODAY ? { v: 'P', auto: true, por: 'padrao', per } : { v: '', auto: true, por: 'padrao', per };
  }
  // Grupos do mesmo líder escritos de jeitos diferentes (KAUAN, KAUAN SOUZA, KAUAN SUZA) viram um grupo só;
  // quem edita grava a folha já arrumada.
  const compDoc = (conj, comp) => {
    DB.admWatch(conj, comp); const doc = A().comps[conj + '|' + comp];
    if (doc && !doc._unidos) {
      const u = unirGrupos(doc.grupos || [], A().rh || []); const sig = l => JSON.stringify(l.map(g => [g.nome, g.pessoas.length]));
      const mudou = sig(u) !== sig(doc.grupos || []); doc.grupos = u; doc._unidos = true;
      if (mudou && pode()) DB.admSalvarGrupos(conj, comp, u);
    }
    return doc;
  };

  /* ---------- topo: Pátio | Bateria e competência ---------- */
  function topo(view) {
    if (view !== 'afreq') return '';
    return `<div class="seg setsw" role="tablist" aria-label="Conjunto">${['patio', 'bateria'].map(k => `<button type="button" role="tab" data-a="conj" data-v="${k}" aria-selected="${U.conj === k}">${SETS[k].curto}</button>`).join('')}</div>
      <div class="compnav"><button class="btn ghost sm" data-a="comp" data-v="-1" aria-label="Competência anterior">‹</button><b>${nomeComp(U.comp)}</b><button class="btn ghost sm" data-a="comp" data-v="1" aria-label="Próxima competência">›</button></div>`;
  }

  /* ---------- Frequência ---------- */
  function totais(conj, comp, doc, g, p, datas, cmap) {
    const t = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0 };
    for (const dt of datas) { const c = codigo(conj, comp, doc, g, p, dt, cmap).v; if (c in t) t[c]++; }
    return t;
  }
  // Frequência com o mesmo visual e funcionamento do Efetivo diário: grupos que recolhem, busca, filtro de grupo,
  // legenda das siglas, ✓ = presente, rodapé com presentes do dia. A folha vai de 16 a 15.
  const funcaoRH = () => { const m = new Map(); for (const c of A().rh || []) if (c.mat) m.set(String(c.mat), c.funcao || ''); return m; };
  const presente = v => v && v !== 'DS' && !['F', 'FE', 'AT', 'AF', 'TR', 'FT', 'AB', 'SP'].includes(v);
  function vFreq() {
    const conj = U.conj, comp = U.comp, doc = compDoc(conj, comp);
    if (doc === undefined) return '<div class="card skel"><i></i><i></i><i></i></div>';
    if (!doc) {
      const ant = compDoc(conj, compMais(comp, -1));
      return `<div class="card"><div class="empty"><b>A folha de ${nomeComp(comp)} (${SETS[conj].curto}) ainda não foi aberta.</b><br>${ant && pode() ? `<button class="btn pri" data-a="abrirComp">Abrir a folha com os grupos de ${nomeComp(compMais(comp, -1))}</button>` : ant === null ? 'Sem folha anterior. O administrador importa as planilhas em Importar planilhas.' : ''}</div></div>`;
    }
    const datas = diasDaCompetencia(comp); const cmap = colabPorId(conj); const fRH = funcaoRH();
    // No celular a folha mostra uma semana por vez (os 30 dias não cabem): ‹ › troca a semana dentro da competência.
    const mob = X.isMobile();
    const semanas = []; datas.forEach((dt, i) => { const dw = new Date(dt + 'T12:00:00').getDay(); if (!semanas.length || dw === 1) semanas.push([]); semanas[semanas.length - 1].push(i); });
    if (U.fSem == null || !semanas[U.fSem]) { const iH = datas.indexOf(TODAY); U.fSem = iH >= 0 ? semanas.findIndex(w => w.includes(iH)) : 0; }
    const vi = mob ? semanas[U.fSem] : datas.map((_, i) => i);
    const ncol = vi.length + (mob ? 1 : 2 + CONTA.length);
    const q = normNome(U.q || ''); const ed = pode();
    if (U.grp == null || (U.grp !== '*' && !doc.grupos[+U.grp])) U.grp = '*';
    const todos = U.grp === '*' || !!q;
    const vis = doc.grupos.map((g, gi) => ({ g, gi, ps: g.pessoas.filter(p => (!q || normNome(p.nome).includes(q))) })).filter(x => x.ps.length && (todos || String(x.gi) === String(U.grp)));
    const recolhe = todos && !q && vis.length > 4;
    const ab = new Set(U.abertos);
    const hojeNa = datas.includes(TODAY);
    const resumo = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0, pessoas: 0 };
    const pres = datas.map(() => 0), quadro = datas.map(() => 0);
    let corpo = '';
    for (const { g, gi, ps } of vis) {
      const cods = ps.map(p => datas.map(dt => codigo(conj, comp, doc, g, p, dt, cmap)));
      const tot = cods.map(l => { const t = { FT: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0 }; l.forEach(c => { if (c.v in t) t[c.v]++; }); return t; });
      tot.forEach(t => { for (const k of Object.keys(resumo)) if (k in t) resumo[k] += t[k]; }); resumo.pessoas += ps.length;
      cods.forEach(l => l.forEach((c, i) => { if (c.v !== 'DS' && !(c.auto && c.por === 'escala')) quadro[i]++; if (presente(c.v)) pres[i]++; }));
      const iH = datas.indexOf(TODAY);
      const ph = hojeNa ? cods.filter(l => presente(l[iH].v)).length : null, eh = hojeNa ? cods.filter(l => l[iH].v !== 'DS' && !(l[iH].auto && l[iH].por === 'escala')).length : null;
      const aberto = !recolhe || ab.has(String(gi));
      if (todos) corpo += `<tr class="grp-row"><th colspan="${ncol}">${recolhe ? `<button type="button" class="efg${aberto ? ' on' : ''}" data-a="grupo" data-v="${gi}" aria-expanded="${aberto}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(g.nome)}</b></button>` : `<button class="btn ghost link" data-a="soGrupo" data-v="${gi}">${esc(g.nome)}</button>`}${ed ? ` <button class="btn ghost sm" data-a="addPessoa" data-v="${gi}">${I.plus} Pessoa</button>` : ''}<span class="gcount">${ph != null ? `${ph}/${eh} presentes hoje${(() => { const pp = { D: 0, N: 0 }; cods.forEach(l => { const c = l[iH]; if (presente(c.v) && c.per) pp[c.per]++; }); return pp.D + pp.N ? ` (${pp.D} dia · ${pp.N} noite)` : ''; })()}${ps.length > eh ? ` · ${ps.length - eh} de folga` : ''}` : `${ps.length} pessoa${ps.length > 1 ? 's' : ''}`}</span></th></tr>`;
      if (!aberto) continue;
      ps.forEach((p, i) => {
        const t = tot[i];
        corpo += `<tr><td class="fnome"><button type="button" class="btn ghost link" data-a="pessoa" data-g="${gi}" data-p="${esc(p.k)}"><b>${esc(title(p.nome))}</b></button><div class="muted small">${q ? esc(g.nome) + ' · ' : ''}${p.turma ? `<span class="tag">turma ${esc(p.turma)}</span> ` : ''}${p.ativ ? 'Atividades' : 'só na folha'}${p.desligado ? ' · desligado ' + ddmm(p.desligado) : ''}${mob && fRH.get(String(p.mat)) ? ' · ' + esc(title(fRH.get(String(p.mat)))) : ''}</div></td>${mob ? '' : `<td class="muted small">${esc(title(fRH.get(String(p.mat)) || ''))}</td>`}${vi.map(j => {
          const c = cods[i][j]; const dt = datas[j]; const nm = NOMES_CODIGO[c.v] || 'sem lançamento';
          const tt = `${dBR(dt)} · ${nm}${c.por === 'ferias' ? ' (férias)' : c.por === 'escala' ? ' (folga pela escala)' : ''}${c.per ? ` · turno ${c.per === 'N' ? 'noturno' : 'diurno'}` : ''}`;
          return `<td class="c${dt === TODAY ? ' today' : ''}"><button class="sit ${c.v}${c.auto && c.v !== 'P' ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}" ${ed ? `data-a="cel" data-g="${gi}" data-p="${esc(p.k)}" data-dt="${dt}"` : 'disabled'} aria-label="${esc(title(p.nome))}, ${esc(tt)}" title="${esc(tt)}">${c.v === 'P' ? I.ok : c.v}${c.per ? `<i class="peri ${c.per}" aria-hidden="true">${c.per}</i>` : ''}</button></td>`;
        }).join('')}${mob ? '' : CONTA.map(k => `<td class="c num tot${t[k] ? ' on' : ''}">${t[k] || ''}</td>`).join('')}</tr>`;
      });
    }
    const head = `<tr><th class="fnome">Colaborador</th>${mob ? '' : '<th>Função</th>'}${vi.map(j => datas[j]).map(dt => { const d = new Date(dt + 'T12:00:00'); return `<th class="c${dt === TODAY ? ' today' : ''}${[0, 6].includes(d.getDay()) ? ' fds' : ''}">${DIA_L[d.getDay()]}<br><span class="thd">${dt.slice(8)}</span></th>`; }).join('')}${mob ? '' : CONTA.map(k => `<th class="c" title="${NOMES_CODIGO[k]}">${k}</th>`).join('')}</tr>`;
    const foot = vis.length ? `<tfoot><tr><th colspan="${mob ? 1 : 2}" class="fnome">Presentes</th>${vi.map(i => [datas[i], i]).map(([dt, i]) => `<td class="c num${dt === TODAY ? ' today' : ''}">${dt > TODAY ? '' : `<b class="${pres[i] < quadro[i] ? 'menos' : ''}">${pres[i]}</b><span class="muted">/${quadro[i]}</span>`}</td>`).join('')}${mob ? '' : CONTA.map(k => `<td class="c num tot">${resumo[k] || ''}</td>`).join('')}</tr></tfoot>` : '';
    const nPes = doc.grupos.reduce((n, g) => n + g.pessoas.length, 0);
    return `<div class="mini"><div><b class="num">${resumo.pessoas}</b><span>Pessoas</span></div><div><b class="num" style="color:var(--st-nreal)">${resumo.FT}</b><span>Faltas</span></div><div><b class="num" style="color:var(--st-atr)">${resumo.AT}</b><span>Atestados</span></div><div><b class="num">${resumo.AB}</b><span>Abonos</span></div><div><b class="num" style="color:var(--st-extra)">${resumo.HE}</b><span>Horas extras</span></div><div><b class="num">${resumo.FE}</b><span>Dias de férias</span></div></div>
      <div class="card"><header><h2>Frequência</h2><p>${ed ? 'Toque no dia para mudar a situação · ✓ = presente' : 'Somente leitura'} · ${SETS[conj].curto} · ${dBR(datas[0])} a ${dBR(datas[datas.length - 1])}</p>${ed ? `<span class="r"><button class="btn sm" data-a="novoGrupo">${I.plus} Grupo</button></span>` : ''}</header>
        <div class="body lbar efbar">${!X.framed && !X.isMobile() ? `<button class="btn sm" data-a="exportar">${I.dl} Exportar Excel</button>` : ''}${caixaBusca('aQ', U.q || '', 'Buscar colaborador')}${q ? `<span class="muted small"><b>${resumo.pessoas}</b> encontrado${resumo.pessoas === 1 ? '' : 's'}</span><button class="btn sm ghost" data-a="limparQ">Limpar busca</button>` : `<label class="sel efrota"><span>Grupo</span><select class="in" id="aGrp"><option value="*" ${U.grp === '*' ? 'selected' : ''}>Todos os grupos (${nPes} pessoas)</option>${doc.grupos.map((g, gi) => `<option value="${gi}" ${String(U.grp) === String(gi) ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select></label>`}</div>
        ${recolhe ? `<div class="body pt0 pb0 row-gap"><button class="btn sm" data-a="todos">${ab.size ? 'Recolher todos os grupos' : 'Abrir todos os grupos'}</button><span class="muted small">${vis.length} grupos · toque num grupo para ver as pessoas</span></div>` : ''}
        <details class="legdet body pb0 pt0"${X.isMobile() ? '' : ' open'}><summary>Legenda das siglas</summary><div class="legend sitleg"><span><span class="sit P">${I.ok}</span> Presente</span><span><span class="sit P">${I.ok}<i class="peri D">D</i></span> Turno diurno</span><span><span class="sit P">${I.ok}<i class="peri N">N</i></span> Turno noturno (conta no dia em que começa)</span><span><span class="sit F auto">F</span> Folga pela escala</span><span><span class="sit FE auto">FE</span> Férias (do cadastro de férias)</span>${CODS.filter(c => c !== 'P').map(c => `<span><span class="sit ${c}">${c}</span> ${NOMES_CODIGO[c]}</span>`).join('')}<span class="muted">Quem está nas Atividades tem a mesma presença do Efetivo diário.</span></div></details>
        ${mob ? `<div class="semnav body pt0 pb0"><button class="btn ghost sm" data-a="fsem" data-v="-1" ${U.fSem ? '' : 'disabled'} aria-label="Semana anterior">‹</button><b>${ddmm(datas[vi[0]])} a ${ddmm(datas[vi[vi.length - 1]])}</b><span class="muted small">semana ${U.fSem + 1} de ${semanas.length}</span><button class="btn ghost sm" data-a="fsem" data-v="1" ${U.fSem < semanas.length - 1 ? '' : 'disabled'} aria-label="Próxima semana">›</button></div>` : ''}
        <div class="tw freqtw${mob ? ' semana' : ''}"><table class="efd freq"><thead>${head}</thead><tbody>${corpo || `<tr><td colspan="${ncol}" class="empty">${q ? 'Ninguém encontrado com essa busca.' : 'Nenhuma pessoa neste grupo.'}</td></tr>`}</tbody>${foot}</table></div></div>`;
  }
  const achar = (doc, gi, k) => { const g = doc.grupos[+gi]; return { g, p: g && g.pessoas.find(x => x.k === k) }; };
  // Lançar: o mesmo jeito do Efetivo diário (situação → até quando)
  function lancar(gi, k, dt) {
    const conj = U.conj, comp = U.comp, doc = A().comps[conj + '|' + comp]; if (!doc) return;
    const { g, p } = achar(doc, gi, k); if (!p) return;
    const cmap = colabPorId(conj); const atual = codigo(conj, comp, doc, g, p, dt, cmap);
    const datas = diasDaCompetencia(comp);
    abrirLancamento({
      sheet, nome: title(p.nome), dt, ok: I.ok, codigos: CODS,
      atual: atual.auto ? { v: atual.v, auto: true, motivo: atual.por === 'ferias' ? 'férias' : atual.por === 'escala' ? 'pela escala' : '' } : { v: atual.v },
      linhaInfo: p.ativ ? 'Mesma presença do Efetivo diário' : 'Só na folha (fora das Atividades)',
      depois: datas.filter(x => x > dt), fim: { t: 'Até o fim da competência', v: datas[datas.length - 1] },
      aoEscolher: (cod, lista) => {
        const antes = lista.map(x => [x, codigo(conj, comp, doc, g, p, x, cmap)]);
        lista.forEach(x => DB.admSetCodigo(conj, comp, p, x, cod));
        DB.log(`Frequência: ${title(p.nome)} → ${cod ? NOMES_CODIGO[cod] : 'automático'} ${lista.length > 1 ? `de ${ddmm(dt)} a ${ddmm(lista[lista.length - 1])}` : 'em ' + ddmm(dt)}`);
        render();
        const b = document.querySelector(`[data-a="cel"][data-p="${CSS.escape(p.k)}"][data-dt="${dt}"]`); if (b && X.pulsar) X.pulsar(b);
        toast(lista.length > 1 ? `${title(p.nome).split(' ')[0]}: ${(cod ? NOMES_CODIGO[cod] : 'automático').toLowerCase()} em ${lista.length} dias` : `${title(p.nome).split(' ')[0]}: ${(cod ? NOMES_CODIGO[cod] : 'automático').toLowerCase()}`,
          { desfazer: () => { antes.forEach(([x, c]) => DB.admSetCodigo(conj, comp, p, x, c.auto ? '' : c.v)); render(); } });
      }
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
      await DB.feriasSalvar(f ? f.id : null, dados); DB.log(`Frequência: férias de ${title(nome)} ${ini ? `de ${ddmm(ini)} a ${ddmm(termino)}` : 'sem data'}`); toast('Férias salvas'); render();
    });
    const calc = () => { const i = $('afIni') && $('afIni').value, d = +($('afDias') && $('afDias').value) || 30; const out = $('afCalc'); if (!out) return; if (!i) { out.textContent = 'Sem início, fica como planejada.'; return; } const t = addDias(i, d - 1); out.textContent = `Termina em ${dBR(t)}. Retorno sugerido: ${dBR(addDias(t, 1))}.`; if ($('afRet') && !$('afRet').value) $('afRet').placeholder = addDias(t, 1); };
    ['afIni', 'afDias'].forEach(k => { const e = $(k); if (e) e.addEventListener('input', calc); }); calc();
    const del = $('afDel'); if (del) del.addEventListener('click', () => { if (del.dataset.ok !== '1') { del.dataset.ok = '1'; del.textContent = 'Excluir mesmo?'; return; } DB.feriasExcluir(f.id); document.getElementById('layer').innerHTML = ''; toast('Férias excluídas'); render(); });
  }

  /* ---------- Importar ---------- */
  function vImport() {
    const st = U.imp;
    if (!pode()) return '<div class="card"><div class="empty">Somente leitura: quem edita a Frequência importa planilhas.</div></div>';
    const adm = ME().papel === 'admin';
    let h = `<div class="${adm ? 'grid2' : ''}">${adm ? `<div class="card"><header><h2>Planilhas recebidas</h2><p>CONTROLE DE FREQUÊNCIA (Pátio e Bateria) e FÉRIAS GERAL, já no sistema</p></header><div class="body stackcol"><p class="m0 small">Lê as planilhas, liga cada pessoa ao cadastro do RH e às Atividades e mostra a conferência antes de gravar. Na presença do dia, só preenche o que ainda está vazio: nada do que os líderes já lançaram é trocado.</p><div class="row-gap"><button class="btn pri" data-a="impSeeds" ${st && st.busy ? 'disabled' : ''}>${st && st.busy ? 'Lendo…' : 'Ler as planilhas recebidas'}</button></div></div></div>` : ''}
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
      DB.log(`Frequência: importou ${st.origem}`);
      U.imp = { feito: `${st.prep.comps.length} folha(s) gravada(s), ${n} dia(s) de presença preenchidos${st.prep.ferias ? `, ${st.prep.ferias.length} férias` : ''}.` };
      if (st.prep.comps.length) { const ult = st.prep.comps[st.prep.comps.length - 1]; U.conj = ult.conj; }
    } catch (e) { U.imp = { ...st, busy: false, erro: (e && e.message) || String(e) }; }
    render();
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-a]'); if (!t || t.closest('#layer') || UI.modulo !== 'frequencia') return;
    const a = t.dataset.a, v = t.dataset.v;
    if (a === 'conj') { U.conj = v; render(); }
    else if (a === 'comp') { U.comp = compMais(U.comp, +v); U.fSem = null; render(); }
    else if (a === 'fsem') { U.fSem = Math.max(0, (U.fSem || 0) + (+v)); render(); }
    else if (a === 'soGrupo') { U.grp = v; render(); }
    else if (a === 'limparQ') { U.q = ''; render(); }
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
  // Celular: arrastar a folha para o lado troca a semana
  { let x0 = null, y0 = null;
    document.addEventListener('touchstart', e => { const t = e.target.closest && e.target.closest('.freqtw.semana'); if (!t || UI.modulo !== 'frequencia') { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return; const b = document.querySelector(`[data-a="fsem"][data-v="${dx < 0 ? 1 : -1}"]:not([disabled])`); if (b) b.click(); }, { passive: true });
  }
  document.addEventListener('input', e => {
    if (UI.modulo !== 'frequencia') return;
    if (e.target.id === 'aQ') { U.q = e.target.value; (X.agendar || render)(); }
    if (e.target.id === 'aFQ') { U.fQ = e.target.value; (X.agendar || render)(); }
  });
  document.addEventListener('change', e => {
    if (UI.modulo !== 'frequencia') return;
    if (e.target.id === 'aFSetor') { U.fSetor = e.target.value; render(); }
    if (e.target.id === 'aGrp') { U.grp = e.target.value; U.abertos = []; render(); }
    if (e.target.id === 'aFMes') { U.fMes = e.target.value; render(); }
    if (e.target.id === 'aImpArq' && e.target.files[0]) impArquivo(e.target.files[0]);
  });

  function renderView(view) {
    if (view === 'afreq') return vFreq();
    if (view === 'aferias') return vFerias();
    if (view === 'aimport') return vImport();
    return vFreq();
  }
  return { render: renderView, topo, badge: () => 0 };
}
