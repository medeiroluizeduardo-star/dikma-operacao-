// Dikma Gestão — módulo Frequência e férias (dentro da Operação): Frequência (folha de 16 a 15), Férias e Importar planilhas.
// A presença de quem está nas Atividades é a mesma do Efetivo diário (situacao): o líder marca na Operação,
// a Frequência vê e corrige aqui. Quem não está nas Atividades (gestão, apoio) fica só na folha (freqcomp).
// Férias marcadas aqui aparecem sozinhas como FE no Efetivo diário e na folha.
import { SETS, today, add, ddmm, MESES_L } from './cal.js';
import { normRegime, letra } from './escala.js';
import { editaAdm, indiceFerias } from './acessos.js';
import { baixarExcel, dataBR } from './exportar.js';
import { diasDaCompetencia, competenciaDe, normNome, criarBusca, prepararImportacao, lerFrequencia, lerFerias, abasDoXLSX, addDias, NOMES_CODIGO, unirGrupos } from './planilhas-adm.js';
import { abrirLancamento, CODIGOS_LANC, JUS_CODS, pedirJus, textoJus } from './presenca.js';
import { caixaBusca } from './busca.js';
import { situacaoDoDia, contagemDia, CONTA, presente as presenteSit } from './situacao.js';

// As abas deste módulo (nome, grupo e subtítulo) ficam declaradas em navegacao.js.

// Códigos que dá para lançar na folha (os mesmos do Efetivo diário, mais abono e suspensão).
const CODS = CODIGOS_LANC;
// CONTA (colunas de total da folha) vem da tabela única de códigos (situacao.js).
const DIA_L = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function criarAdministrativo(X) {
  const { DB, esc, title, I, sheet, formSheet, toast, render, UI } = X;
  const ME = () => X.ME;
  const $ = id => document.getElementById(id);
  const TODAY = today();
  const A = () => DB.cache.adm || { ferias: [], comps: {}, sit: { patio: {}, bateria: {} }, colabs: { patio: [], bateria: [] }, rh: [] };
  const U = UI.a; // valores iniciais em nucleo/estado.js
  const pode = () => editaAdm(ME()) && (!X.podeItem || X.podeItem('i_freq'));
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
  const nomeComp = c => { const [a, m] = c.split('-').map(Number); return `${MESES_L[m - 1]} ${a}`; };
  // A folha aparece pelas datas (16 a 15), como o RH confere: "16/10 a 15/11/2026".
  const periodoComp = c => { const d = diasDaCompetencia(c); if (!d.length) return nomeComp(c); const i = d[0], f = d[d.length - 1]; return `${i.slice(8)}/${i.slice(5, 7)}${i.slice(0, 4) !== f.slice(0, 4) ? '/' + i.slice(0, 4) : ''} a ${f.slice(8)}/${f.slice(5, 7)}/${f.slice(0, 4)}`; };
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
  // { v: código, auto: veio da escala/férias/padrão, por: 'lancado' | 'desligado' | 'ferias' | 'escala' | 'padrao' }
  // per: turno do dia pela letra ('D' diurno, 'N' noturno; a noite conta no dia em que começa)
  // A conta é a mesma do Efetivo diário (situacao.js): lançado, depois desligamento (da folha ou da demissão na ficha),
  // férias, folga da escala (com feriados e turma pela ficha quando falta a letra) e presente.
  const lancadoDe = (conj, doc, p, dt) => (p.ativ ? ((A().sit[conj] || {})[dt.slice(0, 7)] || {})[p.ativ + '|' + dt] : ((doc.d || {})[p.k] || {})[dt]);
  const desligadoEm = p => { const a = p.desligado || '', b = X.desligadoDe ? X.desligadoDe(p) : ''; return a && b ? (a < b ? a : b) : a || b; };
  // Hora extra lançada na Operação (lançamento de equipamento com status de hora extra): entra na folha pelo nome do operador.
  let HEOP = null, HEOPv = -1;
  const heOperacao = (nome, dt) => {
    if (DB.heOpWatch) DB.heOpWatch(dt.slice(0, 7));
    if (!HEOP || HEOPv !== (DB.cache.heOpV || 0)) { HEOPv = DB.cache.heOpV || 0; HEOP = new Map(); for (const l of Object.values(DB.cache.heOp || {}).flat()) HEOP.set(normNome(l.op) + '|' + l.data, l); }
    return HEOP.get(normNome(nome) + '|' + dt) || null;
  };
  function codigo(conj, comp, doc, g, p, dt, cmap) {
    const E = X.escala(); const rt = regimeTurma(conj, g, p, cmap);
    const s = situacaoDoDia(p, dt, {
      lancado: () => lancadoDe(conj, doc, p, dt), desligadoEm, ferias: (x, d) => ferIdx()({ mat: x.mat, nome: x.nome }, d),
      escala: E, regime: () => normRegime(rt.regime, E.regimes), turma: () => rt.turma, turmaFicha: X.turmaFicha, hoje: TODAY
    });
    if (s.por === 'lancado') return ['P', 'HE', 'ATR', 'SA'].includes(s.v) ? { v: s.v, auto: false, per: s.periodo } : { v: s.v, auto: false };
    // nada lançado na folha, mas a Operação lançou hora extra para essa pessoa nesse dia
    if ((s.por === 'escala' || s.por === 'padrao') && dt <= TODAY) { const h = heOperacao(p.nome, dt); if (h) return { v: 'HE', auto: true, por: 'operacao', motivo: `lançada na Operação · ${h.eq}${h.he ? ' · ' + String(h.he).replace('.', ',') + ' h' : ''}` }; }
    if (s.por === 'escala') return { v: 'F', auto: true, por: 'escala', motivo: s.motivo };
    if (s.por === 'padrao') return { v: s.v, auto: true, por: 'padrao', per: s.periodo };
    return { v: s.v, auto: true, por: s.por === 'desligado' ? 'padrao' : s.por };
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
    if (view !== 'afreq' && view !== 'fpainel') return '';
    return `<div class="seg setsw" role="tablist" aria-label="Conjunto">${['patio', 'bateria'].map(k => `<button type="button" role="tab" data-a="conj" data-v="${k}" aria-selected="${U.conj === k}">${SETS[k].curto}</button>`).join('')}</div>
      <div class="compnav"><button class="btn ghost sm" data-a="comp" data-v="-1" aria-label="Competência anterior">‹</button><b>${periodoComp(U.comp)}</b><button class="btn ghost sm" data-a="comp" data-v="1" aria-label="Próxima competência">›</button></div>`;
  }

  /* ---------- Frequência ---------- */
  function totais(conj, comp, doc, g, p, datas, cmap) {
    const t = { FT: 0, ATR: 0, SA: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0 };
    for (const dt of datas) { const c = codigo(conj, comp, doc, g, p, dt, cmap).v; if (c in t) t[c]++; }
    return t;
  }
  // Frequência com o mesmo visual e funcionamento do Efetivo diário: grupos que recolhem, busca, filtro de grupo,
  // legenda das siglas, ✓ = presente, rodapé com presentes do dia. A folha vai de 16 a 15.
  const funcaoRH = () => { const m = new Map(); for (const c of A().rh || []) if (c.mat) m.set(String(c.mat), c.funcao || ''); return m; };
  const presente = presenteSit; // tabela única (situacao.js)
  // contagem do dia a partir dos códigos já calculados: a mesma do Efetivo diário (escalados = sem folga, férias e desligado)
  const contar = lista => contagemDia(lista, '', { sitDe: c => c });
  // Justificativa do dia: quem está nas Atividades usa a mesma do Efetivo diário (situacao); os demais, a da folha.
  const jusDe = (conj, doc, p, dt) => { const j = p.ativ ? (((A().jus || {})[conj] || {})[dt.slice(0, 7)] || {})[p.ativ + '|' + dt] : (((doc && doc.jus) || {})[p.k] || {})[dt]; return j || null; };
  function vFreq() {
    const conj = U.conj, comp = U.comp, doc = compDoc(conj, comp);
    if (doc === undefined) return '<div class="card skel"><i></i><i></i><i></i></div>';
    if (!doc) {
      const ant = compDoc(conj, compMais(comp, -1));
      return `<div class="card"><div class="empty"><b>A folha de ${periodoComp(comp)} (${SETS[conj].curto}) ainda não foi aberta.</b><br>${ant && pode() ? `<button class="btn pri" data-a="abrirComp">Abrir a folha com os grupos de ${periodoComp(compMais(comp, -1))}</button>` : ant === null ? 'Sem folha anterior. O administrador importa as planilhas em Importar planilhas.' : ''}</div></div>`;
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
      datas.forEach((_, i) => { const ct = contar(cods.map(l => l[i])); quadro[i] += ct.escalados; pres[i] += ct.presentes; });
      const iH = datas.indexOf(TODAY);
      const ctH = hojeNa ? contar(cods.map(l => l[iH])) : null;
      const ph = ctH ? ctH.presentes : null, eh = ctH ? ctH.escalados : null;
      const aberto = !recolhe || ab.has(String(gi));
      if (todos) corpo += `<tr class="grp-row"><th colspan="${ncol}">${recolhe ? `<button type="button" class="efg${aberto ? ' on' : ''}" data-a="grupo" data-v="${gi}" aria-expanded="${aberto}"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><b>${esc(g.nome)}</b></button>` : `<button class="btn ghost link" data-a="soGrupo" data-v="${gi}">${esc(g.nome)}</button>`}${ed ? ` <button class="btn ghost sm" data-a="addPessoa" data-v="${gi}">${I.plus} Pessoa</button>` : ''}<span class="gcount">${ph != null ? `${ph}/${eh} presentes hoje${(() => { const pp = { D: 0, N: 0 }; cods.forEach(l => { const c = l[iH]; if (presente(c.v) && c.per) pp[c.per]++; }); return pp.D + pp.N ? ` (${pp.D} dia · ${pp.N} noite)` : ''; })()}${ps.length > eh ? ` · ${ps.length - eh} de folga` : ''}` : `${ps.length} pessoa${ps.length > 1 ? 's' : ''}`}</span></th></tr>`;
      if (!aberto) continue;
      ps.forEach((p, i) => {
        const t = tot[i];
        corpo += `<tr><td class="fnome"><button type="button" class="btn ghost link" data-a="pessoa" data-g="${gi}" data-p="${esc(p.k)}"><b>${esc(title(p.nome))}</b></button><div class="muted small">${q ? esc(g.nome) + ' · ' : ''}${p.turma ? `<span class="tag">turma ${esc(p.turma)}</span> ` : ''}${p.ativ ? 'Atividades' : 'só na folha'}${p.desligado ? ' · desligado ' + ddmm(p.desligado) : ''}${mob && fRH.get(String(p.mat)) ? ' · ' + esc(title(fRH.get(String(p.mat)))) : ''}</div></td>${mob ? '' : `<td class="muted small">${esc(title(fRH.get(String(p.mat)) || ''))}</td>`}${vi.map(j => {
          const c = cods[i][j]; const dt = datas[j]; const nm = NOMES_CODIGO[c.v] || 'sem lançamento';
          const ju = !c.auto && JUS_CODS.includes(c.v) ? jusDe(conj, doc, p, dt) : null; const semJus = !c.auto && JUS_CODS.includes(c.v) && !(ju && ju.cod === c.v) && dt <= TODAY;
          const tt = `${dBR(dt)} · ${nm}${c.por === 'ferias' ? ' (férias)' : c.por === 'escala' ? ' (folga pela escala)' : c.por === 'operacao' ? ` (${c.motivo})` : ''}${c.per ? ` · turno ${c.per === 'N' ? 'noturno' : 'diurno'}` : ''}${ju && ju.cod === c.v ? ' · ' + textoJus(ju) : semJus ? ' · sem justificativa' : ''}`;
          return `<td class="c${dt === TODAY ? ' today' : ''}"><button class="sit ${c.v}${c.auto && c.v !== 'P' ? ' auto' : ''}${dt > TODAY ? ' fut' : ''}${semJus ? ' semjus' : ''}" ${ed ? `data-a="cel" data-g="${gi}" data-p="${esc(p.k)}" data-dt="${dt}"` : 'disabled'} aria-label="${esc(title(p.nome))}, ${esc(tt)}" title="${esc(tt)}">${c.v === 'P' ? I.ok : c.v}${c.per ? `<i class="peri ${c.per}" aria-hidden="true">${c.per}</i>` : ''}</button></td>`;
        }).join('')}${mob ? '' : CONTA.map(k => `<td class="c num tot${t[k] ? ' on' : ''}">${t[k] || ''}</td>`).join('')}</tr>`;
      });
    }
    const head = `<tr><th class="fnome">Colaborador</th>${mob ? '' : '<th>Função</th>'}${vi.map(j => datas[j]).map(dt => { const d = new Date(dt + 'T12:00:00'); return `<th class="c${dt === TODAY ? ' today' : ''}${[0, 6].includes(d.getDay()) ? ' fds' : ''}">${DIA_L[d.getDay()]}<br><span class="thd">${dt.slice(8)}</span></th>`; }).join('')}${mob ? '' : CONTA.map(k => `<th class="c" title="${NOMES_CODIGO[k]}">${k}</th>`).join('')}</tr>`;
    const foot = vis.length ? `<tfoot><tr><th colspan="${mob ? 1 : 2}" class="fnome">Presentes</th>${vi.map(i => [datas[i], i]).map(([dt, i]) => `<td class="c num${dt === TODAY ? ' today' : ''}">${dt > TODAY ? '' : `<b class="${pres[i] < quadro[i] ? 'menos' : ''}">${pres[i]}</b><span class="muted">/${quadro[i]}</span>`}</td>`).join('')}${mob ? '' : CONTA.map(k => `<td class="c num tot">${resumo[k] || ''}</td>`).join('')}</tr></tfoot>` : '';
    const nPes = doc.grupos.reduce((n, g) => n + g.pessoas.length, 0);
    return `<div class="mini"><div><b class="num">${resumo.pessoas}</b><span>Pessoas</span></div><div><b class="num" style="color:var(--st-nreal)">${resumo.FT}</b><span>Faltas</span></div><div><b class="num" style="color:var(--st-atr)">${resumo.AT}</b><span>Atestados</span></div><div><b class="num">${resumo.AB}</b><span>Abonos</span></div><div><b class="num" style="color:var(--st-extra)">${resumo.HE}</b><span>Horas extras</span></div><div><b class="num">${resumo.FE}</b><span>Dias de férias</span></div></div>
      <div class="card"><header><h2>Frequência</h2><p>${ed ? 'Toque no dia para mudar a situação · ✓ = presente' : 'Somente leitura'} · ${SETS[conj].curto} · ${dBR(datas[0])} a ${dBR(datas[datas.length - 1])}</p>${ed ? `<span class="r"><button class="btn sm" data-a="novoGrupo">${I.plus} Grupo</button></span>` : ''}</header>
        <div class="body lbar efbar efbar1">${caixaBusca('aQ', U.q || '', 'Buscar colaborador')}${q ? `<span class="muted small"><b>${resumo.pessoas}</b> encontrado${resumo.pessoas === 1 ? '' : 's'}</span><button class="btn sm ghost" data-a="limparQ">Limpar busca</button>` : `<label class="sel efrota"><span>Grupo</span><select class="in" id="aGrp"><option value="*" ${U.grp === '*' ? 'selected' : ''}>Todos os grupos (${nPes} pessoas)</option>${doc.grupos.map((g, gi) => `<option value="${gi}" ${String(U.grp) === String(gi) ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select></label>`}${!X.framed && !X.isMobile() ? `<button class="btn sm" data-a="exportar" style="margin-left:auto">${I.dl} Exportar Excel</button>` : ''}</div>
        ${recolhe ? `<div class="body pt0 pb0 efabre"><button class="btn ghost link" data-a="todos">${ab.size ? 'Recolher todos os grupos' : 'Abrir todos os grupos'}</button><span class="muted small">${vis.length} grupos · toque num grupo para ver as pessoas</span></div>` : ''}
        <details class="legdet body pb0 pt0"><summary>Legenda das siglas</summary><div class="legend sitleg"><span><span class="sit P">${I.ok}</span> Presente</span><span><span class="sit P">${I.ok}<i class="peri D">D</i></span> Turno diurno</span><span><span class="sit P">${I.ok}<i class="peri N">N</i></span> Turno noturno (conta no dia em que começa)</span><span><span class="sit F auto">F</span> Folga pela escala</span><span><span class="sit FE auto">FE</span> Férias (do cadastro de férias)</span>${CODS.filter(c => c !== 'P').map(c => `<span><span class="sit ${c}">${c}</span> ${NOMES_CODIGO[c]}</span>`).join('')}<span><span class="sit FT semjus">FT</span> Sem justificativa: toque para justificar</span><span class="muted">Quem está nas Atividades tem a mesma presença do Efetivo diário.</span></div></details>
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
    const jAt0 = jusDe(conj, doc, p, dt); const jAt = jAt0 && jAt0.cod === atual.v ? jAt0 : null;
    abrirLancamento({
      sheet, nome: title(p.nome), dt, ok: I.ok, codigos: CODS,
      atual: atual.auto ? { v: atual.v, auto: true, motivo: atual.por === 'ferias' ? 'férias' : atual.por === 'escala' ? 'pela escala' : '' } : { v: atual.v },
      linhaInfo: (p.ativ ? 'Mesma presença da Presença do dia' : 'Só na folha (fora das Atividades)') + (jAt ? `<br>Justificativa: ${esc(textoJus(jAt))}` : ''),
      extras: !atual.auto && JUS_CODS.includes(atual.v) ? [{ t: jAt ? 'Editar a justificativa' : `Justificar ${(NOMES_CODIGO[atual.v] || '').toLowerCase()}`, d: jAt ? textoJus(jAt) : 'Ainda sem justificativa', v: 'jus', extra: true, ic: '<span class="opt-ic">✎</span>' }] : [],
      aoExtra: v => { if (v === 'jus') justificar(conj, comp, p, [dt], atual.v, jAt); },
      depois: datas.filter(x => x > dt), fim: { t: 'Até o fim da competência', v: datas[datas.length - 1] },
      aoEscolher: (cod, lista) => {
        const antes = lista.map(x => [x, codigo(conj, comp, doc, g, p, x, cmap)]);
        lista.forEach(x => { DB.admSetCodigo(conj, comp, p, x, cod); const ju = jusDe(conj, doc, p, x); if (ju && ju.cod !== cod) DB.admSetJus(conj, comp, p, x, null); if (p.ativ && X.limparPresenca) X.limparPresenca(conj, p.ativ, x, cod); });
        DB.log(`Frequência: ${title(p.nome)} → ${cod ? NOMES_CODIGO[cod] : 'automático'} ${lista.length > 1 ? `de ${ddmm(dt)} a ${ddmm(lista[lista.length - 1])}` : 'em ' + ddmm(dt)}`);
        render();
        const b = document.querySelector(`[data-a="cel"][data-p="${CSS.escape(p.k)}"][data-dt="${dt}"]`); if (b && X.pulsar) X.pulsar(b);
        if (JUS_CODS.includes(cod)) { justificar(conj, comp, p, lista, cod, null); return; }
        toast(lista.length > 1 ? `${title(p.nome).split(' ')[0]}: ${(cod ? NOMES_CODIGO[cod] : 'automático').toLowerCase()} em ${lista.length} dias` : `${title(p.nome).split(' ')[0]}: ${(cod ? NOMES_CODIGO[cod] : 'automático').toLowerCase()}`,
          { desfazer: () => { antes.forEach(([x, c]) => DB.admSetCodigo(conj, comp, p, x, c.auto ? '' : c.v)); render(); } });
      }
    });
  }
  // Justificativa de falta, atraso, atestado… (pode ficar para depois)
  function justificar(conj, comp, p, lista, cod, atual) {
    pedirJus({ formSheet, nome: title(p.nome), dt: lista[0], cod, atual, salvar: j => {
      const v = { ...j, por: X.ME ? X.ME.uid : '', nomePor: X.ME ? (X.ME.nome || X.ME.login || '') : '', em: new Date().toISOString() };
      lista.forEach(x => DB.admSetJus(conj, comp, p, x, v));
      DB.log(`Frequência: justificativa de ${(NOMES_CODIGO[cod] || cod).toLowerCase()} de ${title(p.nome)} ${ddmm(lista[0])}${lista.length > 1 ? ' a ' + ddmm(lista[lista.length - 1]) : ''}: ${textoJus({ ...j, obs: "" })}`);
      toast('Justificativa salva'); render();
    } });
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
    formSheet('Incluir na folha', `${esc(doc.grupos[+gi].nome)} · ${periodoComp(comp)}`, `<label class="sel"><span>Nome (escolha da lista ou digite)</span><input class="in" id="apNome" list="apLista" autocomplete="off" required></label><datalist id="apLista">${ops.map(o => `<option value="${esc(o.nome)}">${o.mat ? 'Matrícula ' + esc(o.mat) : ''}</option>`).join('')}</datalist><label class="sel"><span>Turma (turno)</span><input class="in" id="apTurma" maxlength="1" placeholder="A, B, I, J…"></label>`, 'Incluir', async () => {
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
    sheet(title(p.nome), `${p.mat ? 'Matrícula ' + esc(p.mat) + ' · ' : ''}${p.ativ ? 'Presença em comum com a Presença do dia (' + esc(p.ativ) + ')' : 'Só na folha'}${p.notas && p.notas.length ? ' · ' + esc(p.notas.join(' · ')) : ''}`,
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
    const jl = [['Grupo', 'Nome', 'Matrícula', 'Data', 'Situação', 'Motivo', 'Chegada', 'Minutos de atraso', 'Observação', 'Registrado por']];
    for (const g of doc.grupos) for (const p of g.pessoas) for (const dt of datas) { const c = codigo(conj, comp, doc, g, p, dt, cmap); if (c.auto || !JUS_CODS.includes(c.v)) continue; const j = jusDe(conj, doc, p, dt); const ok = j && j.cod === c.v; jl.push([g.nome, p.nome, p.mat || '', dataBR(dt), NOMES_CODIGO[c.v], ok ? j.mot : 'Sem justificativa', ok ? j.chegada || '' : '', ok ? j.min || '' : '', ok ? j.obs || '' : '', ok ? j.nomePor || '' : '']); }
    baixarExcel(`frequencia-${conj}-${comp}`, [{ nome: `${SETS[conj].curto} ${periodoComp(comp).replace(/\//g, "-")}`, linhas }, { nome: 'Justificativas', linhas: jl }]).catch(e => toast('Não foi possível exportar: ' + e.message));
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
        ${Object.entries(r.frequencia).map(([conj, x]) => `<div><b>Frequência ${SETS[conj].curto}</b>: ${x.competencias.map(nomeComp).join(', ')} · ${x.pessoas} pessoas · ${x.diasPresenca} dias na Presença do dia (só os vazios) · ${x.diasFolha} dias de quem está só na folha</div>`).join('')}
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


  /* ---------- Painel de frequência e resumo da semana (módulo Painel) ---------- */
  // Códigos de cada pessoa em cada data, pela mesma regra da folha (escala, férias, desligamento e lançamentos).
  // Uma semana pode cruzar duas folhas (16 a 15): cada data usa a folha da sua competência.
  // soArea: só quem está nas áreas do conjunto (ligado às Atividades do Pátio de Carvão ou da Bateria) — usado nos resumos.
  function levantar(conj, datas, soArea = false) {
    const cmap = colabPorId(conj); const pessoas = new Map(); let carregando = false;
    for (const dt of datas) {
      const comp = competenciaDe(dt); const doc = compDoc(conj, comp);
      if (doc === undefined) { carregando = true; continue; } if (!doc) continue;
      for (const g of doc.grupos || []) for (const p of g.pessoas || []) {
        if (soArea && !(p.ativ && cmap.get(p.ativ))) continue;
        const key = p.mat ? 'm' + p.mat : 'n' + normNome(p.nome);
        let x = pessoas.get(key); if (!x) { x = { nome: p.nome, grupo: g.nome, c: {} }; pessoas.set(key, x); }
        x.c[dt] = codigo(conj, comp, doc, g, p, dt, cmap);
        const ju = jusDe(conj, doc, p, dt); if (ju) (x.j ||= {})[dt] = ju;
      }
    }
    return { carregando, pessoas: [...pessoas.values()] };
  }
  // Fora da conta de presença: desligado, folga (da escala ou lançada) e férias — férias e folga não são ausência.
  const NAOCONTA = c => !c || !c.v || c.v === 'DS' || c.v === 'F' || c.v === 'FE' || (c.auto && c.por === 'escala');
  function indicadores(lev, datas) {
    const ate = datas.filter(dt => dt <= TODAY);
    const t = { FT: 0, ATR: 0, SA: 0, AT: 0, AB: 0, SP: 0, HE: 0, FE: 0, AF: 0, TR: 0 }; const dia = ate.map(() => ({ p: 0, q: 0 })); const grupos = new Map();
    for (const x of lev.pessoas) {
      const g = grupos.get(x.grupo) || { nome: x.grupo, p: 0, q: 0, FT: 0, AT: 0, n: 0 }; g.n++; grupos.set(x.grupo, g);
      x.t = { FT: 0, ATR: 0, SA: 0, AT: 0, AB: 0, SP: 0, semJ: 0 };
      ate.forEach((dt, i) => {
        const c = x.c[dt]; if (!c) return;
        if (c.v in t) t[c.v]++; if (c.v in x.t) x.t[c.v]++; if (!c.auto && JUS_CODS.includes(c.v) && !((x.j || {})[dt] && x.j[dt].cod === c.v)) x.t.semJ++; if (c.v === 'FT') g.FT++; if (c.v === 'AT') g.AT++;
        if (NAOCONTA(c)) return; dia[i].q++; g.q++; if (presente(c.v)) { dia[i].p++; g.p++; }
      });
    }
    const P = dia.reduce((s, d) => s + d.p, 0), Q = dia.reduce((s, d) => s + d.q, 0);
    return { t, dia, ate, grupos: [...grupos.values()], pres: Q ? P / Q : 0, P, Q };
  }
  const pc = v => `${Math.round(v * 1000) / 10}`.replace('.', ',') + '%';
  const feriasProximas = () => { const l = A().ferias || []; const em30 = add(TODAY, 30), em7 = add(TODAY, 7);
    return { agora: l.filter(f => f.inicio && f.inicio <= TODAY && (f.termino || f.inicio) >= TODAY), saem: l.filter(f => f.inicio > TODAY && f.inicio <= em30).sort((a, b) => (a.inicio < b.inicio ? -1 : 1)), voltam: l.filter(f => f.retorno && f.retorno > TODAY && f.retorno <= em7) }; };
  function vPainelFreq() {
    const conj = U.conj, comp = U.comp, datas = diasDaCompetencia(comp);
    const lev = levantar(conj, datas);
    if (lev.carregando && !lev.pessoas.length) return '<div class="card skel"><i></i><i></i><i></i></div>';
    if (!lev.pessoas.length) return `<div class="card"><div class="empty"><b>A folha de ${periodoComp(comp)} (${SETS[conj].curto}) ainda não foi aberta.</b><br>Ela é aberta em RH › Frequência.</div></div>`;
    const k = indicadores(lev, datas); const fe = feriasProximas();
    const hojeI = k.ate.indexOf(TODAY); const hj = hojeI >= 0 ? k.dia[hojeI] : null;
    const kp = (l, v, sub, cor) => `<div class="kpi"><span class="lbl">${cor ? `<i class="dot" style="background:${cor}"></i>` : ''}${l}</span><span class="v num">${v}</span><span class="s">${sub}</span></div>`;
    let h = `<div class="kpis k8">
      ${kp('Presença no período', pc(k.pres), `${k.P} presenças de ${k.Q} dias previstos · até ${dBR(k.ate[k.ate.length - 1] || datas[0])}`, 'var(--st-real)')}
      ${kp('Presentes hoje', hj ? hj.p : '–', hj ? `de ${hj.q} escalados hoje` : 'hoje fora desta folha')}
      ${kp('Pessoas na folha', lev.pessoas.length, `${SETS[conj].curto} · ${periodoComp(comp)}`)}
      ${kp('Faltas, atrasos e saídas', k.t.FT + k.t.ATR + k.t.SA, `${k.t.FT} faltas · ${k.t.ATR} atrasos · ${k.t.SA} saídas antecipadas`, 'var(--st-nreal)')}
      ${kp('Atestados', k.t.AT, `${k.t.AF} dias de afastamento`, 'var(--st-atr)')}
      ${kp('Abonos e suspensões', k.t.AB + k.t.SP, `${k.t.AB} abonos · ${k.t.SP} suspensões`)}
      ${kp('Horas extras', k.t.HE, 'dias com hora extra', 'var(--st-extra)')}
      ${kp('Em férias hoje', fe.agora.length, `${fe.saem.length} saem nos próximos 30 dias`)}
    </div>`;
    h += `<div class="grid2"><div class="card"><header><h2>Presença por dia</h2><p>Presentes ÷ escalados · ${periodoComp(comp)}</p></header><div class="body">
      <div class="cols cmes" role="img" aria-label="Presença por dia">${k.dia.map((d, i) => `<div class="col" title="${dBR(k.ate[i])}: ${d.p} de ${d.q} presentes">${d.q ? `<i style="height:${d.p / d.q * 100}%;background:${d.p / d.q >= .95 ? 'var(--st-real)' : d.p / d.q >= .85 ? 'var(--st-atr)' : 'var(--st-nreal)'}"></i>` : ''}</div>`).join('')}${datas.slice(k.ate.length).map(() => '<div class="col"></div>').join('')}</div>
      <div class="colx cmes">${datas.map((dt, i) => `<div class="${dt === TODAY ? 'today' : ''}">${i % 5 === 0 || dt === TODAY ? `<b>${dt.slice(8)}</b>` : ''}</div>`).join('')}</div>
      <div class="legend"><span><i style="background:var(--st-real)"></i>95% ou mais</span><span><i style="background:var(--st-atr)"></i>85 a 95%</span><span><i style="background:var(--st-nreal)"></i>abaixo de 85%</span></div></div></div>
      <div class="card"><header><h2>Presença por grupo</h2><p>Do menor para o maior</p></header><div class="body"><div class="bars">${k.grupos.filter(g => g.q).sort((a, b) => a.p / a.q - b.p / b.q).slice(0, 12).map(g => `<div class="barrow"><span class="n">${esc(title(g.nome))}<small>${g.n} pessoas${g.FT ? ` · ${g.FT} falta${g.FT > 1 ? 's' : ''}` : ''}${g.AT ? ` · ${g.AT} atestado${g.AT > 1 ? 's' : ''}` : ''}</small></span><div class="stack"><i style="width:${g.p / g.q * 100}%;background:var(--st-real)"></i></div><span class="p num">${pc(g.p / g.q)}</span></div>`).join('') || '<div class="empty">Sem dias previstos ainda.</div>'}</div></div></div></div>`;
    const peso = x => x.t.FT * 3 + x.t.ATR * 2 + x.t.SA * 2 + x.t.SP * 3 + x.t.AT; // falta e suspensão pesam mais; atraso repetido aparece
    const oc = lev.pessoas.filter(x => x.t.FT + x.t.ATR + x.t.SA + x.t.AT + x.t.SP > 0).sort((a, b) => peso(b) - peso(a) || a.nome.localeCompare(b.nome)).slice(0, 12);
    h += `<div class="grid2"><div class="card"><header><h2>Quem mais falta e atrasa</h2><p>Faltas, atrasos, atestados e suspensões no período · os que repetem aparecem primeiro</p></header><div class="tw"><table><thead><tr><th>Colaborador</th><th>Grupo</th><th class="r">Faltas</th><th class="r">Atrasos</th><th class="r">Saídas antecip.</th><th class="r">Atestados</th><th class="r">Suspensões</th><th class="r">Sem justificativa</th></tr></thead><tbody>${oc.map(x => `<tr><td><b>${esc(title(x.nome))}</b></td><td class="muted">${esc(title(x.grupo))}</td><td class="r num">${x.t.FT || ''}</td><td class="r num">${x.t.ATR ? `<b${x.t.ATR >= 3 ? ' style="color:var(--st-nreal)"' : ''}>${x.t.ATR}</b>` : ''}</td><td class="r num">${x.t.SA || ''}</td><td class="r num">${x.t.AT || ''}</td><td class="r num">${x.t.SP || ''}</td><td class="r num">${x.t.semJ ? `<span class="pill warn">${x.t.semJ}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhuma ocorrência no período.</td></tr>'}</tbody></table></div></div>
      <div class="card"><header><h2>Férias</h2><p>Hoje e nos próximos dias · todos os conjuntos</p></header><div class="tw"><table><tbody>
        ${fe.saem.slice(0, 8).map(f => `<tr><td><b>${esc(title(f.nome))}</b><div class="muted small">${esc(f.setor || '')}</div></td><td>sai ${dBR(f.inicio)}</td><td class="r num">${f.dias || ''} dias</td></tr>`).join('')}
        ${fe.voltam.map(f => `<tr><td><b>${esc(title(f.nome))}</b><div class="muted small">${esc(f.setor || '')}</div></td><td>volta ${dBR(f.retorno)}</td><td></td></tr>`).join('')}
        ${!fe.saem.length && !fe.voltam.length ? `<tr><td class="empty">${fe.agora.length} em férias hoje · ninguém sai nos próximos 30 dias.</td></tr>` : ''}
      </tbody></table></div></div></div>`;
    return h;
  }
  // Resumo da semana (folha de impressão): presença, ocorrências e férias da semana.
  function resumoSemana(ini, conj) {
    const datas = Array.from({ length: 7 }, (_, i) => add(ini, i)); const lev = levantar(conj, datas, true);
    if (lev.carregando && !lev.pessoas.length) return null;
    const k = indicadores(lev, datas); const fe = A().ferias || [];
    const DL7 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const oc = lev.pessoas.map(x => ({ x, l: datas.filter(dt => dt <= TODAY && x.c[dt] && ['FT', 'ATR', 'SA', 'AT', 'AF', 'AB', 'SP', 'TR'].includes(x.c[dt].v)).map(dt => `${DL7[datas.indexOf(dt)]} ${NOMES_CODIGO[x.c[dt].v].toLowerCase()}`) })).filter(o => o.l.length).sort((a, b) => b.l.length - a.l.length);
    const sai = fe.filter(f => f.inicio >= ini && f.inicio <= datas[6]), volta = fe.filter(f => f.retorno >= ini && f.retorno <= datas[6]);
    return {
      kpis: [[pc(k.pres), 'Presença na semana'], [lev.pessoas.length, 'Pessoas'], [k.t.FT, 'Faltas'], [k.t.ATR + k.t.SA, 'Atrasos e saídas'], [k.t.AT, 'Atestados'], [k.t.HE, 'Dias com hora extra']],
      corpo: `<h4>Presença por dia</h4><table><thead><tr><th></th>${datas.map((dt, i) => `<th class="r">${DL7[i]} ${ddmm(dt)}</th>`).join('')}</tr></thead><tbody><tr><td>Presentes / escalados</td>${datas.map(dt => { const i = k.ate.indexOf(dt); return `<td class="r">${i < 0 ? '' : `${k.dia[i].p}/${k.dia[i].q}`}</td>`; }).join('')}</tr><tr><td>Presença</td>${datas.map(dt => { const i = k.ate.indexOf(dt); return `<td class="r"><b>${i < 0 || !k.dia[i].q ? '' : pc(k.dia[i].p / k.dia[i].q)}</b></td>`; }).join('')}</tr></tbody></table>
        <h4>Por grupo</h4><table><thead><tr><th>Grupo</th><th class="r">Pessoas</th><th class="r">Presença</th><th class="r">Faltas</th><th class="r">Atestados</th></tr></thead><tbody>${k.grupos.sort((a, b) => (a.q ? a.p / a.q : 1) - (b.q ? b.p / b.q : 1)).map(g => `<tr><td>${esc(title(g.nome))}</td><td class="r">${g.n}</td><td class="r"><b>${g.q ? pc(g.p / g.q) : '—'}</b></td><td class="r">${g.FT || ''}</td><td class="r">${g.AT || ''}</td></tr>`).join('')}</tbody></table>
        <div class="rcols"><div><h4>Ocorrências da semana</h4>${oc.length ? `<table><tbody>${oc.slice(0, 15).map(o => `<tr><td>${esc(title(o.x.nome))}</td><td>${o.l.join(', ')}</td></tr>`).join('')}</tbody></table>${oc.length > 15 ? `<p class="muted small">e mais ${oc.length - 15} pessoas.</p>` : ''}` : '<p class="muted">Nenhuma falta, atestado ou afastamento.</p>'}</div>
        <div><h4>Férias na semana</h4>${sai.length || volta.length ? `<table><tbody>${sai.map(f => `<tr><td>${esc(title(f.nome))}</td><td>sai ${ddmm(f.inicio)}</td></tr>`).join('')}${volta.map(f => `<tr><td>${esc(title(f.nome))}</td><td>volta ${ddmm(f.retorno)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Ninguém sai ou volta de férias nesta semana.</p>'}</div></div>`
    };
  }

  // Resumo de um dia: presença por grupo, quem faltou ou está fora e quem fez hora extra.
  function resumoDia(dt, conj) {
    const lev = levantar(conj, [dt], true); if (lev.carregando && !lev.pessoas.length) return null;
    const k = indicadores(lev, [dt]); const fe = A().ferias || [];
    const cod = x => x.c[dt] && x.c[dt].v;
    const oc = lev.pessoas.filter(x => ['FT', 'ATR', 'SA', 'AT', 'AF', 'AB', 'SP', 'TR'].includes(cod(x))).sort((a, b) => cod(a).localeCompare(cod(b)) || a.nome.localeCompare(b.nome));
    const he = lev.pessoas.filter(x => cod(x) === 'HE').sort((a, b) => a.nome.localeCompare(b.nome));
    const sai = fe.filter(f => f.inicio === dt), volta = fe.filter(f => f.retorno === dt);
    const fut = dt > TODAY;
    return {
      kpis: [[fut || !k.Q ? '—' : pc(k.pres), 'Presença do dia'], [fut ? '—' : `${k.P}/${k.Q}`, 'Presentes / escalados'], [k.t.FT, 'Faltas'], [k.t.ATR + k.t.SA, 'Atrasos e saídas'], [k.t.AT, 'Atestados'], [k.t.HE, 'Hora extra']],
      corpo: `${fut ? '<p class="muted">Dia ainda não chegou: aparecem só férias e lançamentos já feitos.</p>' : ''}<h4>Presença por grupo</h4><table><thead><tr><th>Grupo</th><th class="r">Pessoas</th><th class="r">Presentes / escalados</th><th class="r">Presença</th><th class="r">Faltas</th><th class="r">Atestados</th></tr></thead><tbody>${k.grupos.sort((a, b) => (a.q ? a.p / a.q : 1) - (b.q ? b.p / b.q : 1)).map(g => `<tr><td>${esc(title(g.nome))}</td><td class="r">${g.n}</td><td class="r">${g.q ? `${g.p}/${g.q}` : '—'}</td><td class="r"><b>${g.q ? pc(g.p / g.q) : '—'}</b></td><td class="r">${g.FT || ''}</td><td class="r">${g.AT || ''}</td></tr>`).join('')}</tbody></table>
        <div class="rcols"><div><h4>Ocorrências do dia</h4>${oc.length ? `<table><tbody>${oc.map(x => `<tr><td>${esc(title(x.nome))}<div class="muted small">${esc(title(x.grupo || ''))}</div></td><td>${esc(NOMES_CODIGO[cod(x)] || cod(x))}${(x.j || {})[dt] && x.j[dt].cod === cod(x) ? `<div class="muted small">${esc(textoJus(x.j[dt]))}</div>` : JUS_CODS.includes(cod(x)) ? '<div class="muted small">sem justificativa</div>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma falta, atraso, atestado ou afastamento.</p>'}</div>
        <div><h4>Hora extra</h4>${he.length ? `<table><tbody>${he.map(x => `<tr><td>${esc(title(x.nome))}</td><td class="muted small">${esc(title(x.grupo || ''))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Ninguém em hora extra.</p>'}
        <h4>Férias</h4>${sai.length || volta.length ? `<table><tbody>${sai.map(f => `<tr><td>${esc(title(f.nome))}</td><td>sai hoje</td></tr>`).join('')}${volta.map(f => `<tr><td>${esc(title(f.nome))}</td><td>volta hoje</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${k.t.FE} pessoa(s) em férias · ninguém sai ou volta neste dia.</p>`}</div></div>`
    };
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-a]'); if (!t || t.closest('#layer') || UI.modulo !== 'rh') return;
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
      formSheet('Novo grupo', `${SETS[U.conj].curto} · ${periodoComp(U.comp)}`, '<label class="sel"><span>Nome do grupo</span><input class="in" id="agNome" required placeholder="Ex.: LIDER FULANO - SUPERVISÃO CICLANO"></label><label class="mchip"><input type="checkbox" id="agTurno"><span>Grupo de turno (D e N são dias trabalhados)</span></label>', 'Criar', async () => {
        const nome = $('agNome').value.trim().toUpperCase(); if (!nome) throw new Error('Informe o nome.');
        const grupos = [...doc.grupos, { nome, turno: $('agTurno').checked, pessoas: [] }]; doc.grupos = grupos; await DB.admSalvarGrupos(U.conj, U.comp, grupos); toast('Grupo criado'); render();
      });
    }
    else if (a === 'abrirComp') {
      const ant = A().comps[U.conj + '|' + compMais(U.comp, -1)]; if (!ant) return;
      const datas = diasDaCompetencia(U.comp);
      const grupos = ant.grupos.map(g => ({ ...g, pessoas: g.pessoas.filter(p => !p.desligado).map(p => ({ ...p, notas: [] })) }));
      await DB.admSalvarComp(U.conj, U.comp, { ini: datas[0], fim: datas[datas.length - 1], grupos, d: {} }); toast(`Folha de ${periodoComp(U.comp)} aberta`); render();
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
    document.addEventListener('touchstart', e => { const t = e.target.closest && e.target.closest('.freqtw.semana'); if (!t || UI.modulo !== 'rh') { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return; const b = document.querySelector(`[data-a="fsem"][data-v="${dx < 0 ? 1 : -1}"]:not([disabled])`); if (b) b.click(); }, { passive: true });
  }
  document.addEventListener('input', e => {
    if (UI.modulo !== 'rh') return;
    if (e.target.id === 'aQ') { U.q = e.target.value; (X.agendar || render)(); }
    if (e.target.id === 'aFQ') { U.fQ = e.target.value; (X.agendar || render)(); }
  });
  document.addEventListener('change', e => {
    if (UI.modulo !== 'rh') return;
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
  return { render: renderView, topo, painel: vPainelFreq, resumoSemana, resumoDia, badge: () => 0 };
}
