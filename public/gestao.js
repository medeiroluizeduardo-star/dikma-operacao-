// Dikma Gestão — módulo EFETIVO: Ficha de Acompanhamento de Funcionário (FO-RED-COQ-004).
// Telas: Painel, Colaboradores (cadastro + controle da ficha, com a ficha individual e as ocorrências), Impressão e Tipos.
// Assinatura: na tela (colaborador e responsável assinam com o dedo), por foto da via em papel, ou registro de recusa.
import { pd, add, pad, today, MESES_L, AREA_S, SETS, setDaArea } from './cal.js';
import { AREA_GERAL, AREA_OP, REGIMES, ehAreaAtiv, veTodasFichas, areasFichaDe } from './pessoas.js';
import { criarImportador } from './importar.js';
import { campoBusca, definirValor, semAcento } from './busca.js';
import { baixarExcel, dataBR } from './exportar.js';

export const VIEWS_G = [
  { id: 'gpainel', nome: 'Painel', ic: 'painel', grp: 'Fichas de acompanhamento', mod: 'ge' },
  { id: 'gcolab', nome: 'Colaboradores', ic: 'users', grp: 'Fichas de acompanhamento', mod: 'ge' },
  { id: 'gimpr', nome: 'Impressão', ic: 'print', grp: 'Fichas de acompanhamento', mod: 'ge' },
  { id: 'gimport', nome: 'Importar dados', ic: 'dl', grp: 'Administração', mod: 'ge', admin: true },
  { id: 'gtipos', nome: 'Tipos de ocorrência', ic: 'config', grp: 'Administração', mod: 'ge', admin: true }
];
export const SUB_G = {
  gpainel: 'Indicadores das fichas de acompanhamento',
  gcolab: 'Cadastro, controle da ficha e assinaturas de cada colaborador',
  gimpr: 'Ficha (Folhas 1 e 2) e via de assinatura',
  gimport: 'Colaboradores e ocorrências a partir de uma planilha',
  gtipos: 'Tipos, texto padrão e o que vai para a Folha 1'
};

export function criarGestao(X) {
  const { DB, esc, title, I, sheet, formSheet, toast, showErr, render, isAdmin, prepararFoto, framed, UI, PES } = X;
  const $ = id => document.getElementById(id);
  const TODAY = today();
  const G = () => DB.cache.g;
  const ME = () => X.ME;
  const podeEditar = () => isAdmin() || ['gestor', 'coordenador', 'supervisor', 'lider'].includes(ME().papel);
  const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const dias = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
  const U = UI.g || (UI.g = { de: TODAY.slice(0, 8) + '01', ate: TODAY, q: '', filtro: 'ativos', ocSt: 'pendente', ocTipo: '', ocQ: '', mat: null, impMat: '', impDoc: 'ficha', cq: '', cf: 'todos', area: '', fa: '' });
  const SEL = new Set(); // matrículas marcadas na lista (exclusão em lote)

  /* ---------- cálculos ---------- */
  const tiposF1 = () => ((G().config && G().config.tipos) || []).filter(t => t.f1).sort((a, b) => (a.pos || 9) - (b.pos || 9)).slice(0, 5);
  const tipos = () => (G().config && G().config.tipos) || [];
  function tempoCasa(adm) {
    if (!adm) return '';
    const [y1, m1, d1] = adm.split('-').map(Number), [y2, m2, d2] = TODAY.split('-').map(Number);
    let m = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0); if (m < 0) m = 0;
    return `${Math.floor(m / 12)}a ${m % 12}m`;
  }
  let IDX = null, IDXv = -1;
  function indice() {
    const v = DB.cache.gVersao || 0;
    if (IDX && IDXv === v) return IDX;
    const f1 = tiposF1(); const byMat = new Map();
    for (const o of G().ocorr) { if (!byMat.has(o.mat)) byMat.set(o.mat, []); byMat.get(o.mat).push(o); }
    for (const l of byMat.values()) l.sort((a, b) => (a.data < b.data ? -1 : 1));
    IDX = new Map();
    for (const c of G().colabs) {
      const oc = byMat.get(c.mat) || [];
      const integ = f1.map(t => ((oc.find(o => o.tipo === t.tipo) || {}).data || (c.intAnt ? 'Anterior' : '')));
      const nInt = integ.filter(Boolean).length;
      const f2 = oc.filter(o => !f1.some(t => t.tipo === o.tipo));
      const pend = oc.filter(o => o.status === 'pendente');
      const rec = oc.filter(o => o.status === 'recusada');
      const ativo = !c.dem || c.dem > TODAY;
      const dc = c.adm ? dias(c.adm, TODAY) : null;
      const exp = ativo && dc != null && dc < 90;
      const status = !ativo ? 'Desligado' : pend.length ? 'Pendente assinatura' : rec.length ? 'Recusou assinar' : 'Em dia';
      IDX.set(c.mat, { c, oc, integ, nInt, intOk: nInt >= f1.length, f2, pend, rec, ativo, dc, exp, status, tempo: tempoCasa(c.adm) });
    }
    IDXv = v; return IDX;
  }
  /* ---------- filtro por área ---------- */
  // Valores: s:<área da planilha do RH> · u:<setor> · a:<área de atuação no sistema>
  const setorDe = c => c.setor || 'Coqueria';
  let LOTv = -1, LOTk = '', LOT = null;
  function lot() { const k = `${DB.cache.gVersao}|${DB.cache.eVersao || 0}|${Object.keys(DB.cache.colabs || {}).length}`; const v = G().colabs; if (!LOT || LOTv !== v || LOTk !== k) { LOT = PES.lotacoes(v); LOTv = v; LOTk = k; } return LOT; }
  function filtroArea(fa = U.fa) {
    if (!fa) return () => true;
    const t = fa.slice(0, 1), v = fa.slice(2);
    if (t === 's') return c => setorDe(c) === v;
    if (t === 'u') return c => (c.subsetor || '') === v;
    const L = lot(); return c => { const l = L.get(String(c.mat)); return !!l && (l.area === v || (v === AREA_OP && !!l.op)); };
  }
  function selArea(id) {
    const cs = G().colabs; const porSetor = new Map();
    // Quem só vê uma área (líder) não precisa escolher área: o filtro some.
    if (X.ME && !veTodasFichas(X.ME) && areasFichaDe(X.ME).length <= 1) { U.fa = ''; return ''; }
    for (const c of cs) { const s0 = setorDe(c); if (!porSetor.has(s0)) porSetor.set(s0, new Map()); if (c.subsetor) { const m = porSetor.get(s0); m.set(c.subsetor, (m.get(c.subsetor) || 0) + 1); } }
    const conta = s0 => cs.filter(c => setorDe(c) === s0).length;
    const setores = [...porSetor.keys()].sort((a, b) => a.localeCompare(b));
    const o = (v, t) => `<option value="${esc(v)}" ${U.fa === v ? 'selected' : ''}>${esc(t)}</option>`;
    return `<label class="sel"><span>Área</span><select class="in" id="${id}" data-gfa="1"><option value="">Todas as áreas</option>
      <optgroup label="Áreas (planilha do RH)">${setores.map(s0 => o('s:' + s0, `${s0} (${conta(s0)})`)).join('')}</optgroup>
      ${setores.filter(s0 => porSetor.get(s0).size > 1).map(s0 => `<optgroup label="${esc(s0)} · setores">${[...porSetor.get(s0).entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([u, n]) => o('u:' + u, `${u} (${n})`)).join('')}</optgroup>`).join('')}
      ${PES.gruposArea().filter(([g]) => g !== 'Geral').map(([g, l]) => `<optgroup label="No sistema · ${esc(g)}">${l.map(a => o('a:' + a, PES.areaNome(a))).join('')}</optgroup>`).join('')}
    </select></label>`;
  }
  const pillSt = s => `<span class="pill ${s === 'Em dia' ? 'ok' : s === 'Desligado' ? 'neu' : s === 'Recusou assinar' ? 'bad' : 'warn'}">${s}</span>`;
  const pillOc = o => (o.status === 'assinada' ? `<span class="pill ok">Assinada${o.metodo === 'papel' ? ' · papel' : o.metodo === 'tela' ? ' · na tela' : ''}</span>` : o.status === 'recusada' ? '<span class="pill bad">Recusou</span>' : `<span class="pill warn">Aguardando${dias(o.data, TODAY) > 7 ? ' · ' + dias(o.data, TODAY) + ' dias' : ''}</span>`);
  function alertas() {
    const out = [];
    for (const x of indice().values()) {
      if (!x.ativo) continue;
      if (x.dc != null && x.dc >= 38 && x.dc <= 45) out.push({ t: 'warn', mat: x.c.mat, txt: `${title(x.c.nome)} completa 45 dias de experiência ${x.dc === 45 ? 'hoje' : 'em ' + (45 - x.dc) + ' dia(s)'}` });
      if (x.dc != null && x.dc >= 83 && x.dc <= 90) out.push({ t: 'bad', mat: x.c.mat, txt: `${title(x.c.nome)}: fim da experiência (90 dias) ${x.dc === 90 ? 'hoje' : 'em ' + (90 - x.dc) + ' dia(s)'}` });
      if (!x.intOk && !x.c.intAnt) out.push({ t: 'warn', mat: x.c.mat, txt: `${title(x.c.nome)}: integração ${x.nInt} de ${tiposF1().length}` });
      const velha = x.pend.find(o => dias(o.data, TODAY) > 7);
      if (velha) out.push({ t: 'bad', mat: x.c.mat, txt: `${title(x.c.nome)}: assinatura pendente há ${dias(velha.data, TODAY)} dias` });
    }
    return out;
  }
  const pendentesVelhas = () => G().ocorr.filter(o => o.status === 'pendente' && dias(o.data, TODAY) > 7).length;

  /* ---------- telas ---------- */
  function vazio() {
    if (!G().loaded) return '<div class="card skel" aria-busy="true" aria-label="Carregando"><i></i><i></i><i></i><i></i></div>';
    if (!G().config) return isAdmin()
      ? `<div class="card"><header><h2>Importar a planilha de fichas</h2><p>179 colaboradores, as ocorrências já lançadas e os 12 tipos de ocorrência com texto padrão</p></header><div class="body stackcol"><p class="m0 muted">Os colaboradores importados ficam com a integração marcada como "Anterior", como na planilha.</p><button class="btn pri" data-g="importar" style="align-self:flex-start" ${UI.busy ? 'disabled' : ''}>${UI.busy ? 'Importando…' : 'Importar dados da planilha'}</button></div></div>`
      : '<div class="card"><div class="empty">O administrador ainda não importou a planilha de fichas.</div></div>';
    return null;
  }

  function vPainel() {
    const fa = filtroArea(); const idx = indice(); const all = [...idx.values()].filter(x => fa(x.c));
    const mats = new Set(all.map(x => String(x.c.mat))); const OC = U.fa ? G().ocorr.filter(o => mats.has(String(o.mat))) : G().ocorr;
    const at = all.filter(x => x.ativo);
    const noPer = OC.filter(o => o.data >= U.de && o.data <= U.ate);
    const aguard = OC.filter(o => o.status === 'pendente');
    const velhas = aguard.filter(o => dias(o.data, TODAY) > 7);
    const assinadas = noPer.filter(o => o.status === 'assinada');
    const dm = assinadas.filter(o => o.assinadoEm).map(o => dias(o.data, o.assinadoEm));
    const media = dm.length ? (dm.reduce((a, b) => a + b, 0) / dm.length).toFixed(1).replace('.', ',') : '—';
    const disc = noPer.filter(o => /advert|suspens/i.test(o.tipo)).length;
    const f1n = tiposF1().map(t => t.tipo);
    const emDia = at.filter(x => x.status === 'Em dia').length;
    const pc = (a, b) => (b ? Math.round(a / b * 100) : 0);
    let h = `<div class="filters"><label class="sel"><span>De</span><input class="in" type="date" id="gDe" value="${U.de}"></label><label class="sel"><span>Até</span><input class="in" type="date" id="gAte" value="${U.ate}"></label>${selArea('gFaP')}</div>
    <div class="kpis">
      <div class="kpi hero"><span class="lbl">Fichas em dia (ativos)</span><span class="v num">${pc(emDia, at.length)}%</span><span class="s num">${emDia} de ${at.length} colaboradores ativos</span><div class="meter"><i style="width:${pc(emDia, at.length)}%"></i></div></div>
      <div class="kpi"><span class="lbl">Ativos</span><span class="v num">${at.length}</span><span class="s">${all.length - at.length} desligados</span></div>
      <div class="kpi"><span class="lbl">Em experiência</span><span class="v num">${at.filter(x => x.exp).length}</span><span class="s">até 90 dias de casa</span></div>
      <div class="kpi"><span class="lbl">Integração completa</span><span class="v num">${pc(at.filter(x => x.intOk).length, at.length)}%</span><span class="s">dos ativos</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-atr)"></i>Aguardando assinatura</span><span class="v num">${aguard.length}</span><span class="s">${velhas.length} há mais de 7 dias</span></div>
      <div class="kpi"><span class="lbl"><i class="dot" style="background:var(--st-nreal)"></i>Recusas</span><span class="v num">${noPer.filter(o => o.status === 'recusada').length}</span><span class="s">no período</span></div>
    </div>
    <div class="mini"><div><b class="num">${noPer.length}</b><span>Ocorrências no período</span></div><div><b class="num">${pc(assinadas.length, noPer.length)}%</b><span>Taxa de assinatura</span></div><div><b class="num">${media}</b><span>Dias até assinar (média)</span></div><div><b class="num">${disc}</b><span>Advertências e suspensões</span></div></div>`;
    // tendência 12 meses
    const meses = []; let [y, m] = TODAY.split('-').map(Number);
    for (let i = 0; i < 12; i++) { meses.unshift(`${y}-${pad(m)}`); m--; if (!m) { m = 12; y--; } }
    const porMes = meses.map(mm => { const l = OC.filter(o => o.data.slice(0, 7) === mm); return { mm, i: l.filter(o => f1n.includes(o.tipo)).length, o: l.filter(o => !f1n.includes(o.tipo)).length }; });
    const mx = Math.max(1, ...porMes.map(x => x.i + x.o));
    const porTipo = {}; for (const o of noPer) porTipo[o.tipo] = (porTipo[o.tipo] || 0) + 1;
    const pt = Object.entries(porTipo).sort((a, b) => b[1] - a[1]); const mt = Math.max(1, ...pt.map(x => x[1]));
    h += `<div class="grid2"><div class="card"><header><h2>Ocorrências por mês</h2><p>Últimos 12 meses</p></header><div class="body"><div class="legend"><span><i style="background:var(--navy,var(--st-prog))"></i>Integração (Folha 1)</span><span><i style="background:var(--accent)"></i>Outras (Folha 2)</span></div>
      <div class="cols c12" role="img" aria-label="Ocorrências por mês">${porMes.map(x => `<div class="col" title="${MESES_L[+x.mm.slice(5) - 1]} ${x.mm.slice(0, 4)}: ${x.i} de integração, ${x.o} outras"><span class="tot num">${x.i + x.o || ''}</span>${x.o ? `<i style="height:${x.o / mx * 100}%;background:var(--accent)"></i>` : ''}${x.i ? `<i style="height:${x.i / mx * 100}%;background:var(--navy,var(--st-prog))"></i>` : ''}</div>`).join('')}</div>
      <div class="colx c12">${porMes.map(x => `<div><b>${MESES_L[+x.mm.slice(5) - 1].slice(0, 3)}</b></div>`).join('')}</div></div></div>
      <div class="card"><header><h2>Por tipo</h2><p>No período</p></header><div class="body">${pt.length ? `<div class="bars">${pt.map(([t, n]) => `<div class="barrow mot"><span class="n">${esc(t)}</span><div class="stack clear"><i style="width:${n / mt * 100}%;background:var(--accent)"></i></div><span class="p num">${n}</span></div>`).join('')}</div>` : '<div class="empty">Nenhuma ocorrência no período.</div>'}</div></div></div>`;
    const al = alertas().filter(a => mats.has(String(a.mat)));
    const antigas = aguard.slice().sort((a, b) => (a.data < b.data ? -1 : 1)).slice(0, 8);
    h += `<div class="grid2"><div class="card"><header><h2>Alertas</h2><p>Experiência, integração e assinaturas</p></header><div class="body">${al.length ? `<div class="plist">${al.slice(0, 12).map(a => `<div class="pitem"><div class="minw"><span class="pill ${a.t}">${a.t === 'bad' ? 'Urgente' : 'Atenção'}</span> <span>${esc(a.txt)}</span></div><button class="btn" data-g="ficha" data-mat="${a.mat}">Abrir ficha</button></div>`).join('')}</div>${al.length > 12 ? `<p class="muted small m0">+ ${al.length - 12} alertas</p>` : ''}` : '<div class="empty">Nenhum alerta.</div>'}</div></div>
      <div class="card"><header><h2>Assinaturas mais antigas</h2><p>Aguardando assinatura</p></header><div class="body">${antigas.length ? `<div class="plist">${antigas.map(o => `<div class="pitem"><div class="minw"><div class="t">${esc(title(o.nome))}</div><div class="l">${dBR(o.data)} · ${esc(o.tipo)}${o.desc ? ' · ' + esc(o.desc) : ''} · ${dias(o.data, TODAY)} dia(s)</div></div>${podeEditar() ? `<button class="btn pri" data-g="assinar" data-mat="${o.mat}">Assinar</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">Nenhuma assinatura pendente.</div>'}</div></div></div>`;
    return h;
  }

  // Colaboradores: cadastro e controle da ficha numa tabela só. As ocorrências ficam na ficha de cada um
  // (Nova ocorrência, assinar, ver) e nos filtros "Pendente assinatura" e "Comigo para recolher".
  function vColab() {
    if (U.mat) return vFicha(U.mat);
    const idx = indice(); const f1 = tiposF1();
    const q = U.q.trim().toLowerCase();
    const F = { ativos: x => x.ativo, exp: x => x.exp, integ: x => x.ativo && !x.intOk, pend: x => x.pend.length, comigo: x => x.pend.some(o => souEu(o.recolhe)), rec: x => x.rec.length, desl: x => !x.ativo, todos: () => true };
    if (!F[U.filtro]) U.filtro = 'ativos';
    const L = lot(); const fa = filtroArea();
    const base = [...idx.values()].filter(x => fa(x.c));
    const lista = base.filter(F[U.filtro]).filter(x => !q || (x.c.mat + ' ' + x.c.nome + ' ' + (x.c.funcao || '')).toLowerCase().includes(q)).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
    const n = k => base.filter(F[k]).length;
    for (const m of [...SEL]) if (!idx.has(m)) SEL.delete(m);
    const adm = isAdmin(); const todosMarc = lista.length && lista.slice(0, 500).every(x => SEL.has(x.c.mat));
    U.ocLista = lista.flatMap(x => x.oc);
    let h = `<div class="filters"><label class="sel grow"><span>Buscar</span><input class="in" type="search" id="gQ" placeholder="Nome, matrícula ou função" value="${esc(U.q)}"></label>
      ${selArea('gFaC')}
      ${!framed && !matchMedia('(max-width:860px)').matches ? `<button class="btn" data-g="expOc" style="align-self:flex-end" title="Ocorrências de quem está na lista">${I.dl} Exportar ocorrências</button>` : ''}
      ${podeEditar() ? `<button class="btn" data-g="novaOc" style="align-self:flex-end">${I.plus} Ocorrência</button>` : ''}
      ${isAdmin() ? `<button class="btn pri" data-g="novoColab" style="align-self:flex-end">${I.plus} Colaborador</button>` : ''}</div>
      <div class="rchips">${[['ativos', 'Ativos'], ['exp', 'Em experiência'], ['integ', 'Integração incompleta'], ['pend', 'Pendente assinatura'], ['comigo', 'Comigo para recolher'], ['rec', 'Recusaram'], ['desl', 'Desligados'], ['todos', 'Todos']].filter(([k]) => k !== 'comigo' || n('comigo')).map(([k, t]) => `<button class="rchip" data-gf="${k}" aria-pressed="${U.filtro === k}">${t}<span class="c num">${n(k)}</span></button>`).join('')}</div>`;
    if (adm && SEL.size) h += `<div class="selbar" role="region" aria-label="Selecionados"><b>${SEL.size} selecionado(s)</b><button class="btn danger" data-g="excluirSel">Excluir selecionados</button><button class="btn" data-g="limparSel">Limpar seleção</button></div>`;
    if (!lista.length) return h + '<div class="card"><div class="empty">Ninguém com esse filtro.</div></div>';
    // Celular: cartões em vez da tabela larga
    if (matchMedia('(max-width:860px)').matches) {
      return h + `<div class="mlist colabm">${lista.slice(0, 300).map(x => `<button type="button" class="mcard" data-g="ficha" data-mat="${x.c.mat}"><div class="row-between"><b class="t">${esc(title(x.c.nome))}</b>${pillSt(x.status)}</div><div class="muted small">${x.c.mat}${x.c.funcao ? ' · ' + esc(title(x.c.funcao)) : ''}${x.exp ? ' · <span class="pill ext">experiência</span>' : ''}</div><div class="small">${esc((L.get(String(x.c.mat)) || {}).txt || x.c.subsetor || '')}</div><div class="cmet"><span>Integração <b>${x.c.intAnt ? 'anterior' : `${x.nInt}/${f1.length}`}</b></span><span>Folha 2 <b>${x.f2.length}</b></span>${x.pend.length ? `<span class="warn-t">Aguardando <b>${x.pend.length}</b>${x.pend.some(o => souEu(o.recolhe)) ? ' · com você' : ''}</span>` : ''}${x.rec.length ? `<span class="bad-t">Recusas <b>${x.rec.length}</b></span>` : ''}</div></button>`).join('')}</div>${lista.length > 300 ? `<p class="muted small">Mostrando 300 de ${lista.length}. Use a busca.</p>` : ''}`;
    }
    const intTxt = x => x.c.intAnt ? '<span class="muted">Anterior</span>' : `<span class="${x.intOk ? '' : 'warn-t'}" title="${esc(f1.map((t, i) => `${t.tipo}: ${x.integ[i] === 'Anterior' ? 'anterior' : x.integ[i] ? dBR(x.integ[i]) : 'pendente'}`).join('\n'))}">${x.nInt}/${f1.length}</span>`;
    h += `<div class="card"><div class="tw"><table class="hoverable colabt"><thead><tr>${adm ? `<th class="c selc"><input type="checkbox" data-g="selTodos" aria-label="Marcar todos da lista" ${todosMarc ? 'checked' : ''}></th>` : ''}<th>Matrícula</th><th>Nome</th><th>Área de atuação</th><th>Admissão</th><th class="c">Integração</th><th class="c">Folha 2</th><th class="c">Aguard. assinatura</th><th class="c">Recusas</th><th>Ficha</th></tr></thead><tbody>
      ${lista.slice(0, 500).map(x => `<tr data-g="ficha" data-mat="${x.c.mat}" tabindex="0">${adm ? `<td class="c selc" data-g="sel" data-mat="${x.c.mat}"><input type="checkbox" ${SEL.has(x.c.mat) ? 'checked' : ''} aria-label="Marcar ${esc(title(x.c.nome))}"></td>` : ''}<td class="mono">${x.c.mat}</td><td><b>${esc(title(x.c.nome))}</b>${x.exp ? ' <span class="pill ext">experiência</span>' : ''}${x.c.funcao ? `<div class="muted small">${esc(title(x.c.funcao))}</div>` : ''}</td><td class="small">${x.c.subsetor ? `<div>${esc(x.c.subsetor)}</div>` : ''}<div class="${x.c.subsetor ? 'muted' : ''}">${esc((L.get(String(x.c.mat)) || {}).txt || '')}</div></td><td class="num">${dBR(x.c.adm)}<div class="muted small">${x.tempo}</div></td><td class="c num">${intTxt(x)}</td><td class="c num">${x.f2.length ? `${x.f2.length}/33` : '<span class="muted">0</span>'}</td><td class="c num">${x.pend.length ? `<b class="warn-t">${x.pend.length}</b>${x.pend.some(o => souEu(o.recolhe)) ? ' <span class="pill ext">você</span>' : ''}` : ''}</td><td class="c num">${x.rec.length ? `<b class="bad-t">${x.rec.length}</b>` : ''}</td><td>${pillSt(x.status)}</td></tr>`).join('')}
      </tbody></table></div>${lista.length > 500 ? `<div class="body"><p class="muted small m0">Mostrando 500 de ${lista.length}. Use a busca ou o filtro de área.</p></div>` : ''}</div>`;
    return h;
  }

  function vFicha(mat) {
    const x = indice().get(mat); if (!x) { U.mat = null; return vColab(); }
    const c = x.c; const f1 = tiposF1();
    let h = `<div class="row-gap"><button class="btn" data-g="voltar">← Colaboradores</button></div>
    <div class="card"><div class="body ficha-hd"><div class="minw"><h2 class="disp">${esc(title(c.nome))}</h2><p class="muted m0">Matrícula <b class="mono">${c.mat}</b>${c.subsetor || c.setor ? ' · ' + esc(c.subsetor || c.setor) : ''} · ${esc(PES.lotacao(c).txt)}${c.funcao ? ' · ' + esc(c.funcao) : ''}${c.turma ? ' · Turma ' + esc(c.turma) : ''}${c.lider ? ' · Líder: ' + esc(title(c.lider)) : ''}</p>
      <p class="muted m0">Admissão ${dBR(c.adm) || '—'} · ${x.tempo}${c.dem ? ' · Demissão ' + dBR(c.dem) : ''}</p><div class="row-gap" style="margin-top:8px">${pillSt(x.status)}${x.exp ? `<span class="pill ext">Experiência · ${x.dc} dias</span>` : ''}${c.intAnt ? '<span class="pill neu">Integração anterior</span>' : ''}</div></div>
      <div class="row-gap">${podeEditar() && x.ativo ? `<button class="btn pri" data-g="novaOc" data-mat="${c.mat}">${I.plus} Nova ocorrência</button>` : ''}${podeEditar() && x.pend.length ? `<button class="btn" data-g="assinar" data-mat="${c.mat}">✍ Assinar pendentes (${x.pend.length})</button>` : ''}<button class="btn" data-g="imprimir" data-mat="${c.mat}">${I.print} Imprimir</button>${isAdmin() ? `<button class="btn" data-g="editColab" data-mat="${c.mat}">Editar</button><button class="btn ghost danger" data-g="excluirColab" data-mat="${c.mat}">Excluir</button>` : ''}</div></div></div>
    <div class="grid2"><div class="card"><header><h2>Folha 1 · Integração</h2><p>${x.nInt} de ${f1.length}</p></header><div class="body"><div class="plist">${f1.map((t, i) => `<div class="pitem"><div class="minw"><div class="t">${esc(t.tipo)}</div><div class="l">${esc(t.texto)}</div></div><span class="${x.integ[i] ? 'pill ok' : 'pill warn'}">${x.integ[i] === 'Anterior' ? 'Anterior' : x.integ[i] ? dBR(x.integ[i]) : 'Pendente'}</span></div>`).join('')}</div></div></div>
    <div class="card"><header><h2>Folha 2 · Ocorrências</h2><p>${x.f2.length} de 33 linhas</p></header><div class="body">${ocLista(x.oc.slice().reverse())}</div></div></div>`;
    return h;
  }
  function ocLista(l, comNome) {
    if (!l.length) return '<div class="empty">Nenhuma ocorrência registrada.</div>';
    return `<div class="plist">${l.map(o => `<div class="pitem"><div class="minw"><div class="t">${comNome ? esc(title(o.nome)) + ' · ' : ''}${esc(o.tipo)}</div><div class="l">${dBR(o.data)}${o.desc ? ' · ' + esc(o.desc) : ''}${o.lider ? ' · Dikma: ' + esc(title(o.lider)) : ''}</div>${o.status === 'pendente' ? `<div class="l resp">${o.recolhe ? `Recolher assinatura: <b>${esc(title(o.recolhe))}</b>${souEu(o.recolhe) ? ' <span class="pill ext">você</span>' : ''}` : '<span class="semt">sem responsável pela assinatura</span>'}${podeEditar() ? ` · <button class="btn ghost link" data-g="trocaResp" data-id="${o.id}">${o.recolhe ? 'trocar' : 'definir'}</button>` : ''}</div>` : ''}<div style="margin-top:4px">${pillOc(o)}</div></div><div class="row-gap">${o.status === 'pendente' && podeEditar() ? `<button class="btn" data-g="assinar" data-mat="${o.mat}" data-oc="${o.id}">✍ Assinar</button>` : ''}${o.assinaturaId ? `<button class="btn" data-g="verAss" data-id="${o.assinaturaId}">Ver</button>` : ''}${isAdmin() ? `<button class="btn ghost danger" data-g="delOc" data-id="${o.id}" aria-label="Excluir ocorrência">✕</button>` : ''}</div></div>`).join('')}</div>`;
  }

  /* ---------- impressão ---------- */
  const cfg = () => G().config || {};
  const cab = (titulo, folha) => `<div class="fhd"><img src="img/dikma-logo.png" alt="Dikma" class="plogo"><div class="ft">${titulo}</div><div class="fc"><span>Código</span><b>${esc(cfg().codigo || 'FO-RED-COQ-004')}</b></div><div class="fc"><span>${folha ? 'Folha' : 'Revisão'}</span><b>${folha || esc(cfg().revisao || '00')}</b></div></div>`;
  const localFicha = c => (c.setor ? c.setor.split(' - ')[0] : 'Coqueria').toUpperCase();
  const dadosColab = c => `<div class="fdados"><span><b>Nome:</b> ${esc(c.nome)}</span><span><b>Matrícula:</b> ${c.mat}</span><span><b>Área:</b> ${esc(c.subsetor ? c.subsetor.toUpperCase() : !c.area || c.area === AREA_GERAL ? 'COQUERIA' : 'COQUERIA – ' + (c.area === AREA_OP ? 'OPERAÇÃO DE EQUIPAMENTOS' : (setDaArea(c.area) ? SETS[setDaArea(c.area)].curto.toUpperCase() + ' ' : '') + c.area))}</span>${c.funcao ? `<span><b>Função:</b> ${esc(c.funcao)}</span>` : ''}<span><b>Admissão:</b> ${dBR(c.adm)}</span><span><b>Demissão:</b> ${dBR(c.dem)}</span></div>`;
  const assinCel = (o, quem) => {
    if (!o) return '';
    if (o.status === 'recusada') return quem === 'f' ? '<span class="small">Recusou-se a assinar</span>' : esc(o.lider || '');
    if (o.status === 'assinada') { const a = DB.cache.gAssin[o.assinaturaId]; if (!a && o.assinaturaId) DB.gCarregarAssin(o.assinaturaId); if (a && a.metodo === 'tela') return `<img class="sigimg" src="${quem === 'f' ? a.colab : a.resp}" alt="assinatura">`; return `<span class="small">Assinada${o.assinadoEm ? ' ' + dBR(o.assinadoEm) : ''}${a && a.metodo === 'papel' ? ' (via em papel)' : ''}</span>`; }
    return quem === 'd' ? esc(o.lider || '') : '';
  };
  function docFicha(mat) {
    const x = indice().get(mat); const c = x.c; const f1 = tiposF1();
    const f1oc = f1.map(t => x.oc.find(o => o.tipo === t.tipo));
    const linhas = x.f2.slice(0, 33);
    return `<div class="paper pg">${cab('FICHA DE ACOMPANHAMENTO DE FUNCIONÁRIO – ' + localFicha(c), '1/2')}${dadosColab(c)}
      <table class="ftab"><thead><tr><th style="width:84px">Data</th><th>Descrição</th><th style="width:120px">Dikma</th><th style="width:120px">Funcionário</th></tr></thead><tbody>
      ${f1.map((t, i) => `<tr class="tall"><td class="c">${x.integ[i] === 'Anterior' ? 'Anterior' : dBR(x.integ[i])}</td><td>${esc(t.texto)}</td><td class="c">${assinCel(f1oc[i], 'd')}</td><td class="c">${assinCel(f1oc[i], 'f')}</td></tr>`).join('')}
      </tbody></table><div class="ffoot"><span>Controle: ${c.mat}-1-${x.nInt}</span><span>Emitida em: ${dBR(TODAY)}</span></div></div>
      <div class="paper pg">${cab('FICHA DE ACOMPANHAMENTO DE FUNCIONÁRIO – ' + localFicha(c), '2/2')}${dadosColab(c)}
      <table class="ftab"><thead><tr><th style="width:84px">Data</th><th>Descrição</th><th style="width:120px">Dikma</th><th style="width:120px">Funcionário</th></tr></thead><tbody>
      ${Array.from({ length: 33 }, (_, i) => { const o = linhas[i]; return `<tr><td class="c">${o ? dBR(o.data) : ''}</td><td>${o ? esc(o.tipo) + (o.desc ? ': ' + esc(o.desc) : '') : ''}</td><td class="c">${assinCel(o, 'd')}</td><td class="c">${assinCel(o, 'f')}</td></tr>`; }).join('')}
      </tbody></table><div class="flines"><div><b>Habilidades:</b></div><div><b>Avaliação:</b></div></div><div class="ffoot"><span>Controle: ${c.mat}-2-${x.f2.length}</span><span>Emitida em: ${dBR(TODAY)}</span></div></div>`;
  }
  const codigoVia = (mat, n) => `VA-${mat}-${TODAY.replace(/-/g, '')}-${n}`;
  function docVia(mat, resp) {
    const x = indice().get(mat); const c = x.c; const l = x.pend.slice(0, 7);
    return `<div class="paper pg">${cab('VIA DE ASSINATURA – CIÊNCIA DE OCORRÊNCIAS – ' + localFicha(c), '')}
      <div class="fdados"><span><b>Emitida em:</b> ${dBR(TODAY)}</span><span><b>Código de controle:</b> ${codigoVia(mat, l.length)}</span></div>${dadosColab(c)}
      <table class="ftab"><thead><tr><th style="width:36px">Nº</th><th style="width:84px">Data</th><th style="width:150px">Tipo</th><th>Descrição</th></tr></thead><tbody>
      ${l.length ? l.map((o, i) => `<tr><td class="c">${i + 1}</td><td class="c">${dBR(o.data)}</td><td>${esc(o.tipo)}</td><td>${esc(o.desc || '')}</td></tr>`).join('') : '<tr><td colspan="4" class="c">Nenhuma ocorrência pendente de assinatura.</td></tr>'}
      </tbody></table><p class="fdecl">${esc(cfg().declaracao || '')}</p>
      <div class="fsign"><div><div class="ln"></div>Assinatura do colaborador<br><b>${esc(c.nome)}</b><br>Matrícula: ${c.mat}<br>Data: ____/____/________</div><div><div class="ln"></div>Assinatura do responsável Dikma<br><b>${esc(resp || '')}</b><br>Cargo: ____________________<br>Data: ____/____/________</div></div>
      <p class="small">Em caso de recusa do colaborador em assinar, preencher com duas testemunhas:</p>
      <div class="fsign"><div><div class="ln"></div>Testemunha 1 – nome e matrícula</div><div><div class="ln"></div>Testemunha 2 – nome e matrícula</div></div>
      <p class="small muted">Via vinculada à ficha ${esc(cfg().codigo || 'FO-RED-COQ-004')}. Depois de assinada, fotografe e registre em Dikma Gestão › Gestão › Assinar › Via em papel.</p></div>`;
  }
  // Impressão: lista de fichas com busca (nome, matrícula, função, área) ao lado do documento.
  // A busca filtra a lista na hora, sem redesenhar a tela (o cursor não sai do campo).
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const chaveBusca = x => semAcento([x.c.mat, x.c.nome, x.c.funcao, x.c.setor, x.c.subsetor, (lot().get(String(x.c.mat)) || {}).txt].filter(Boolean).join(' '));
  const casaBusca = (k, q) => { const t = semAcento(q).trim().split(/\s+/).filter(Boolean); return t.every(p => k.includes(p)); };
  function filtrarListaImpr() {
    const box = $('gImpLista'); if (!box) return;
    let n = 0;
    box.querySelectorAll('.imp-it').forEach(el => { const ok = casaBusca(el.dataset.k, U.impQ || ''); el.hidden = !ok; if (ok) n++; });
    const vz = $('gImpVazio'); if (vz) vz.hidden = n > 0;
    const ct = $('gImpN'); if (ct) ct.textContent = `${n} ficha${n === 1 ? '' : 's'}`;
    // Sobrou uma ficha só: abre ela sozinha quando a pessoa para de digitar.
    clearTimeout(filtrarListaImpr.t);
    const um = n === 1 ? box.querySelector('.imp-it:not([hidden])') : null;
    if (um && um.dataset.mat !== U.impMat) filtrarListaImpr.t = setTimeout(() => {
      const q = $('gImpQ'); const foco = document.activeElement === q; const pos = q ? q.selectionStart : 0;
      U.impMat = um.dataset.mat; render();
      const nq = $('gImpQ'); if (foco && nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) { /* ignora */ } }
    }, 450);
  }
  function vImpr() {
    const idx = indice(); const fa = filtroArea();
    const F = { ativos: x => x.ativo, pend: x => x.ativo && x.pend.length > 0, deslig: x => !x.ativo, todos: () => true };
    U.impF = U.impF || 'ativos';
    const base = [...idx.values()].filter(x => fa(x.c)).filter(F[U.impF]).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
    if (!U.impMat || !idx.has(U.impMat)) U.impMat = (base.find(x => casaBusca(chaveBusca(x), U.impQ || '')) || base[0] || { c: {} }).c.mat;
    const nPend = [...idx.values()].filter(x => fa(x.c) && F.pend(x)).length;
    const chip = (k, t) => `<button type="button" class="rchip" data-g="impF" data-v="${k}" aria-pressed="${U.impF === k}">${t}</button>`;
    let vis = 0;
    const itens = base.map(x => {
      const k = chaveBusca(x); const ok = casaBusca(k, U.impQ || ''); if (ok) vis++;
      const sel = x.c.mat === U.impMat;
      const tag = !x.ativo ? '<span class="pill neu">desligado</span>' : x.pend.length ? `<span class="pill warn">${x.pend.length} p/ assinar</span>` : x.rec.length ? '<span class="pill bad">recusou</span>' : '';
      return `<button type="button" class="imp-it" data-g="impSel" data-mat="${x.c.mat}" data-k="${esc(k)}" ${ok ? '' : 'hidden'} ${sel ? 'aria-current="true"' : ''}><span class="minw"><b>${esc(title(x.c.nome))}</b><small><span class="mono">${x.c.mat}</span>${x.c.funcao ? ' · ' + esc(title(x.c.funcao)) : ''}</small></span>${tag}</button>`;
    }).join('');
    const atual = idx.get(U.impMat);
    const lista = `<aside class="card imp-lista noprint">
      <div class="imp-busca"><label class="srch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input class="in" type="search" id="gImpQ" value="${esc(U.impQ || '')}" placeholder="Buscar nome, matrícula ou função" autocomplete="off" spellcheck="false" aria-label="Buscar ficha"></label>
      ${selArea('gImpArea')}
      <div class="rchips imp-chips">${chip('ativos', 'Ativos')}${chip('pend', `Para assinar${nPend ? ' · ' + nPend : ''}`)}${chip('deslig', 'Desligados')}${chip('todos', 'Todos')}</div>
      <p class="muted small m0" id="gImpN">${vis} ficha${vis === 1 ? '' : 's'}</p></div>
      <div class="tw imp-scroll" id="gImpLista">${itens}<p class="empty small" id="gImpVazio" ${vis ? 'hidden' : ''}>Nenhuma ficha encontrada.${U.impQ ? ' Confira a grafia ou busque pela matrícula.' : ''}${U.impF !== 'todos' ? ' Tente o filtro <b>Todos</b>.' : ''}</p></div></aside>`;
    if (!atual) return `<div class="imp-grid">${lista}<div class="card"><div class="empty">Escolha um colaborador na lista.</div></div></div>`;
    const segDoc = `<div class="seg imp-seg" role="tablist" aria-label="Documento"><button type="button" role="tab" data-g="impDoc" data-v="ficha" aria-selected="${U.impDoc !== 'via'}">Ficha (Folhas 1 e 2)</button><button type="button" role="tab" data-g="impDoc" data-v="via" aria-selected="${U.impDoc === 'via'}">Via de assinatura${atual.pend.length ? ' · ' + atual.pend.length : ''}</button></div>`;
    return `<div class="imp-grid">${lista}<section class="imp-doc" id="gImpDocBox">
      <div class="card imp-hd noprint"><div class="minw"><h2 class="disp">${esc(title(atual.c.nome))}</h2><p class="muted small m0">Matrícula <b class="mono">${atual.c.mat}</b>${atual.c.funcao ? ' · ' + esc(title(atual.c.funcao)) : ''} · ${atual.oc.length} ocorrência${atual.oc.length === 1 ? '' : 's'} · ${esc(atual.status)}</p></div>
      <div class="imp-acts">${segDoc}${!framed ? `<button class="btn pri" data-act="print">${I.print} Imprimir / PDF</button>` : ''}</div></div>
      <div class="tw docs">${U.impDoc === 'via' ? docVia(U.impMat, title(ME().nome || '')) : docFicha(U.impMat)}</div></section></div>`;
  }

  function vTipos() {
    const t = tipos();
    return `<div class="card"><header><h2>Tipos de ocorrência</h2><p>Até 5 tipos vão pré-escritos na Folha 1 (integração), na ordem da posição. Os demais vão para a Folha 2.</p></header><div class="tw"><table class="tipos"><thead><tr><th>Tipo</th><th class="c">Folha 1</th><th class="c">Posição</th><th>Texto padrão</th><th></th></tr></thead><tbody>
      ${t.map((x, i) => `<tr><td><input class="in" data-gt="${i}|tipo" value="${esc(x.tipo)}" aria-label="Nome do tipo"></td><td class="c"><input type="checkbox" data-gt="${i}|f1" ${x.f1 ? 'checked' : ''} aria-label="Vai na Folha 1"></td><td class="c"><input class="in numin" type="number" min="1" max="5" data-gt="${i}|pos" value="${x.pos || ''}" aria-label="Posição"></td><td><textarea class="in ta" data-gt="${i}|texto" rows="2" aria-label="Texto padrão">${esc(x.texto || '')}</textarea></td><td><button class="btn ghost danger" data-g="delTipo" data-i="${i}" aria-label="Excluir tipo">✕</button></td></tr>`).join('')}
      </tbody></table></div><div class="body"><button class="btn" data-g="addTipo">${I.plus} Novo tipo</button></div></div>`;
  }

  /* ---------- formulários ---------- */
  const opcoesColab = () => [...indice().values()].filter(x => x.ativo).sort((a, b) => a.c.nome.localeCompare(b.c.nome)).map(x => `<option value="${x.c.mat} · ${esc(x.c.nome)}"></option>`).join('');
  // Quem pode recolher a assinatura: você, os líderes imediatos das fichas e (para o administrador) os usuários de liderança.
  const nomeN = s => semAcento(s).replace(/\s+/g, ' ').trim().toUpperCase();
  const souEu = nome => !!nome && nomeN(nome) === nomeN(ME().nome || '');
  function opcoesResp() {
    const m = new Map(); const add = (nome, d, ord) => { const k = nomeN(nome); if (!k || k.length < 3) return; const x = m.get(k); if (!x || ord < x.ord) m.set(k, { v: String(nome).trim().toUpperCase(), t: title(nome), d, ord }); };
    add(ME().nome || '', 'você', 0);
    const lid = new Map(); for (const c of G().colabs) if (c.lider && (!c.dem || c.dem > TODAY)) lid.set(nomeN(c.lider), [(lid.get(nomeN(c.lider)) || [0, c.lider])[0] + 1, c.lider]);
    for (const [, [n, nome]] of lid) add(nome, `líder imediato de ${n} pessoa${n > 1 ? 's' : ''}`, 1);
    for (const u of (DB.cache.usuarios || [])) if (['lider', 'supervisor', 'coordenador', 'gestor', 'admin'].includes(u.papel)) add(u.nome, `usuário · ${{ lider: 'Líder', supervisor: 'Supervisor', coordenador: 'Coordenador', gestor: 'Gestor', admin: 'Administrador' }[u.papel]}`, 2);
    return [...m.values()].sort((a, b) => a.ord - b.ord || a.t.localeCompare(b.t));
  }
  function novaOcorrencia(mat) {
    const c = mat ? indice().get(mat).c : null;
    formSheet('Nova ocorrência', c ? `${esc(title(c.nome))} · ${c.mat}` : '', `
      ${c ? '' : `<label class="sel"><span>Colaborador</span><input class="in" id="noColab" list="dlColab" placeholder="Digite nome ou matrícula" autocomplete="off"><datalist id="dlColab">${opcoesColab()}</datalist></label>`}
      <div class="row2"><label class="sel"><span>Data</span><input class="in" type="date" id="noData" value="${TODAY}" max="${TODAY}"></label>
      <label class="sel"><span>Tipo</span><select class="in" id="noTipo">${tipos().map(t => `<option>${esc(t.tipo)}</option>`).join('')}</select></label></div>
      <label class="sel"><span>Descrição</span><textarea class="in ta" id="noDesc" rows="3">${esc((tipos()[0] || {}).texto || '')}</textarea></label>
      <label class="sel"><span>Responsável Dikma</span><input class="in" id="noLider" value="${esc((ME().nome || '').toUpperCase())}"></label>
      <div class="sel"><span>Quem vai recolher a assinatura</span>${campoBusca('noResp', (c && c.lider ? String(c.lider).toUpperCase() : '') || (ME().nome || '').toUpperCase(), opcoesResp, { livre: true, maiusculas: true, placeholder: 'Digite o nome do responsável' })}<small class="muted" id="noRespDica">${c && c.lider ? 'Sugestão: líder imediato na ficha' : ''}</small></div>
      <label class="switch" id="noAssBox"><input type="checkbox" id="noAssinar" checked><span>Colher a assinatura agora, logo depois de salvar</span></label>`, 'Salvar ocorrência', async () => {
      let m = mat;
      if (!m) { const v = $('noColab').value.trim(); m = v.split(' ')[0]; if (!indice().has(m)) { const achou = [...indice().values()].find(x => x.c.nome.toLowerCase() === v.toLowerCase()); m = achou ? achou.c.mat : null; } }
      if (!m || !indice().has(m)) throw new Error('Escolha o colaborador da lista.');
      const data = $('noData').value; if (!data) throw new Error('Informe a data.');
      const tipo = $('noTipo').value; const desc = $('noDesc').value.trim(); const lider = $('noLider').value.trim();
      const recolhe = $('noResp').value.trim().toUpperCase(); if (!recolhe) throw new Error('Informe quem vai recolher a assinatura.');
      const assinar = $('noAssinar').checked && !$('noAssBox').hidden;
      const o = DB.gNovaOcorrencia({ data, mat: m, nome: indice().get(m).c.nome, tipo, desc, lider, recolhe, status: 'pendente' });
      DB.log(`Efetivo: ocorrência "${tipo}" para ${indice().get(m) ? title(indice().get(m).c.nome) : m}`);
      toast(souEu(recolhe) ? 'Ocorrência registrada' : `Ocorrência registrada · assinatura com ${title(recolhe)}`);
      if (assinar) setTimeout(() => assinarSheet(m, [o.id]), 50);
    });
    // Responsável: sugere o líder imediato do colaborador escolhido; "colher agora" só aparece quando é você.
    let mexeu = false;
    const ajustar = () => { const eu = souEu($('noResp').value); $('noAssBox').hidden = !eu; };
    $('noResp').addEventListener('change', () => { mexeu = true; ajustar(); });
    const nc = $('noColab');
    if (nc) nc.addEventListener('change', () => { const v = nc.value.trim(); const mm = v.split(' ')[0]; const x = indice().get(mm) || [...indice().values()].find(y => y.c.nome.toLowerCase() === v.toLowerCase()); if (x && x.c.lider && !mexeu) { definirValor('noResp', String(x.c.lider).toUpperCase()); $('noRespDica').textContent = 'Sugestão: líder imediato na ficha'; ajustar(); } });
    ajustar();
    const tp = $('noTipo'), ds = $('noDesc');
    if (tp) tp.onchange = () => { const t = tipos().find(x => x.tipo === tp.value); if (t && (!ds.value || tipos().some(x => x.texto === ds.value))) ds.value = t.texto || ''; };
  }
  // pre: dados para já vir preenchido (ex.: pessoa que está no Pátio, na Bateria ou na Operação e ainda não tem ficha)
  function colabForm(mat, pre) {
    const c = mat ? indice().get(mat).c : { mat: '', nome: '', funcao: '', turma: '', lider: '', adm: TODAY, dem: '', intAnt: false, area: AREA_GERAL, ...(pre ? { nome: pre.nome, funcao: pre.funcao || '', area: pre.area || AREA_GERAL } : {}) };
    const L = mat ? PES.lotacao(c) : pre ? { area: pre.area || AREA_GERAL, patio: pre.rota ? { area: pre.area, rota: pre.rota, regime: pre.regime, funcao: pre.funcao } : null, op: pre.op ? { escala: pre.escala, turma: pre.turma, funcao: pre.funcao } : null } : { patio: null, op: null, area: AREA_GERAL };
    const eqc = (DB.cache.e && DB.cache.e.config) || {};
    const opt = (l, v, nome = x => x) => l.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(nome(x))}</option>`).join('');
    formSheet(mat ? 'Editar colaborador' : 'Novo colaborador', mat ? `${esc(title(c.nome))} · ${c.mat}` : '', `
      <div class="row2"><label class="sel"><span>Matrícula</span><input class="in" id="ncMat" value="${esc(c.mat)}" ${mat ? 'readonly' : ''} inputmode="numeric"></label><label class="sel"><span>Admissão</span><input class="in" type="date" id="ncAdm" value="${c.adm || ''}"></label></div>
      <label class="sel"><span>Nome completo</span><input class="in" id="ncNome" value="${esc(c.nome)}"></label>
      <div class="row2"><label class="sel"><span>Área (RH)</span><input class="in" id="ncSetor" list="dlSetor" autocomplete="off" value="${esc(c.setor || '')}" placeholder="Ex.: Coqueria - Pátio"><datalist id="dlSetor">${[...new Set(G().colabs.map(x => x.setor).filter(Boolean))].sort().map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist></label>
      <label class="sel"><span>Setor (RH)</span><input class="in" id="ncSub" list="dlSub" autocomplete="off" value="${esc(c.subsetor || '')}" placeholder="Ex.: Coqueria - Recebimento"><datalist id="dlSub">${[...new Set(G().colabs.map(x => x.subsetor).filter(Boolean))].sort().map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist></label></div>
      <div class="fsec"><b>Área de atuação e função</b><small>Vale para todos os módulos: Efetivo, Atividades Pátio, Atividades Bateria e Operação.</small></div>
      <label class="sel"><span>Área de atuação</span><select class="in" id="ncArea">${PES.gruposArea().map(([g, l]) => `<optgroup label="${esc(g)}">${opt(l, L.area, PES.areaNome)}</optgroup>`).join('')}</select></label>
      <div class="row2" id="ncPatioBox"><label class="sel"><span id="ncRotaLbl">Rota</span><select class="in" id="ncRota"></select></label><label class="sel"><span>Regime</span><select class="in" id="ncReg">${opt(REGIMES, (L.patio && L.patio.regime) || 'ADMINISTRATIVO', title)}</select></label></div>
      ${PES.temOp() ? `<label class="switch" id="ncOpLbl"><input type="checkbox" id="ncOp" ${L.op ? 'checked' : ''}><span>Opera equipamentos (equipe do módulo Operação)</span></label>
      <div class="row2" id="ncOpBox"><label class="sel"><span>Escala (Operação)</span><select class="in" id="ncEsc">${opt(['ADM', '4x4'], (L.op && L.op.escala) || 'ADM')}</select></label><label class="sel"><span>Turma 4x4</span><select class="in" id="ncTurOp"><option value="">—</option>${opt(Object.keys(eqc.turmas || {}), (L.op && L.op.turma) || '')}</select></label></div>` : ''}
      <label class="sel"><span>Função</span><input class="in" id="ncFun" list="dlFun" autocomplete="off" value="${esc(c.funcao || (L.patio && L.patio.funcao) || (L.op && L.op.funcao) || '')}" placeholder="Escolha da lista ou digite"><datalist id="dlFun">${PES.funcoes().map(f => `<option value="${esc(f)}"></option>`).join('')}</datalist></label>
      <div class="row2"><label class="sel"><span>Turma / turno (ficha)</span><input class="in" id="ncTur" value="${esc(c.turma || '')}"></label><label class="sel"><span>Líder imediato</span><input class="in" id="ncLid" value="${esc(c.lider || '')}"></label></div>
      <label class="sel"><span>Demissão</span><input class="in" type="date" id="ncDem" value="${c.dem || ''}"></label>
      <label class="switch"><input type="checkbox" id="ncAnt" ${c.intAnt ? 'checked' : ''}><span>Integração feita antes do sistema ("Anterior")</span></label>`, 'Salvar', async () => {
      const n = { ...c, mat: $('ncMat').value.trim().replace(/\.0$/, ''), nome: $('ncNome').value.trim().toUpperCase().replace(/\s+/g, ' '), funcao: $('ncFun').value.trim().toUpperCase(), turma: $('ncTur').value.trim().toUpperCase(), lider: $('ncLid').value.trim().toUpperCase(), adm: $('ncAdm').value || null, dem: $('ncDem').value || null, intAnt: $('ncAnt').checked, area: $('ncArea').value, setor: $('ncSetor').value.trim(), subsetor: $('ncSub').value.trim() };
      if (!n.mat || !n.nome) throw new Error('Informe matrícula e nome.');
      const o = { area: n.area, rota: $('ncRota').value, regime: $('ncReg').value, op: !!($('ncOp') && $('ncOp').checked), escala: $('ncEsc') ? $('ncEsc').value : 'ADM', turma: $('ncTurOp') ? $('ncTurOp').value : '' };
      if (ehAreaAtiv(o.area) && !o.rota) throw new Error('Escolha a rota.');
      if ((o.op || o.area === AREA_OP) && o.escala === '4x4' && !o.turma) throw new Error('Escolha a turma da escala 4x4.');
      const itens = G().colabs.slice();
      if (!mat && itens.some(x => x.mat === n.mat)) throw new Error('Já existe um colaborador com essa matrícula.');
      const i = itens.findIndex(x => x.mat === n.mat); if (i >= 0) itens[i] = n; else itens.push(n);
      DB.gSalvarColabs(itens);
      PES.sincronizar(mat ? c : null, n, o);
      const mud = [];
      if (mat && L.area !== n.area) mud.push(`área ${PES.areaNome(L.area)} → ${PES.areaNome(n.area)}`);
      if (mat && (c.funcao || '') !== n.funcao) mud.push(`função ${c.funcao || '—'} → ${n.funcao || '—'}`);
      DB.log(`Efetivo: ${mat ? 'editou' : 'cadastrou'} ${title(n.nome)}${mud.length ? ' (' + mud.join('; ') + ')' : ''}`);
      toast(mat ? 'Colaborador atualizado em todos os módulos' : 'Colaborador cadastrado');
    });
    const ar = $('ncArea'), rt = $('ncRota'), op = $('ncOp');
    const atualizar = () => {
      const a = ar.value, pat = ehAreaAtiv(a);
      if (pat) $('ncRotaLbl').textContent = 'Rota (' + SETS[setDaArea(a)].nome + ')';
      $('ncPatioBox').hidden = !pat;
      if (pat) { const rs = PES.rotasDe(a); const cur = L.patio && L.patio.area === a ? L.patio.rota : rt.value; rt.innerHTML = rs.map(r => `<option ${r === cur ? 'selected' : ''}>${esc(r)}</option>`).join(''); }
      if (op) { if (a === AREA_OP) { op.checked = true; op.disabled = true; } else op.disabled = false; $('ncOpBox').hidden = !op.checked; }
    };
    ar.onchange = atualizar; if (op) op.onchange = atualizar; atualizar();
  }

  /* ---------- exclusão ---------- */
  function excluirSheet(mats) {
    const xs = mats.map(m => indice().get(m)).filter(Boolean); if (!xs.length) return;
    const nOc = xs.reduce((n, x) => n + x.oc.length, 0);
    const L = lot(); const emMod = xs.filter(x => { const l = L.get(String(x.c.mat)); return l && (l.ativ || l.op); }).length;
    formSheet(xs.length === 1 ? 'Excluir colaborador' : `Excluir ${xs.length} colaboradores`, xs.length === 1 ? `${esc(title(xs[0].c.nome))} · ${xs[0].c.mat}` : '', `
      <p class="m0">A ficha sai do Efetivo. Não dá para desfazer.</p>
      ${xs.length > 1 ? `<p class="small muted m0">${xs.slice(0, 12).map(x => esc(title(x.c.nome))).join(', ')}${xs.length > 12 ? ` e mais ${xs.length - 12}` : ''}</p>` : ''}
      ${emMod ? `<label class="switch"><input type="checkbox" id="exMod" checked><span>Tirar também de Atividades Pátio, Atividades Bateria e Operação (${emMod} pessoa(s) estão lá)</span></label>` : ''}
      ${nOc ? `<label class="switch"><input type="checkbox" id="exOc"><span>Apagar também as ${nOc} ocorrência(s)</span></label><p class="small muted m0">Desmarcado, as ocorrências continuam em Ocorrências com o nome da pessoa.</p>` : ''}
      <label class="switch"><input type="checkbox" id="exOk"><span>Confirmo a exclusão</span></label>`, 'Excluir', async () => {
      if (!$('exOk').checked) throw new Error('Marque "Confirmo a exclusão".');
      excluirColabs(xs.map(x => x.c.mat), { modulos: !!($('exMod') && $('exMod').checked), ocorr: !!($('exOc') && $('exOc').checked) });
    });
  }
  function excluirColabs(mats, op = {}) {
    const set = new Set(mats.map(String));
    const removidos = G().colabs.filter(c => set.has(String(c.mat))); if (!removidos.length) return 0;
    const itens = G().colabs.filter(c => !set.has(String(c.mat)));
    G().colabs = itens; DB.cache.gVersao++; DB.gSalvarColabs(itens);
    if (op.modulos) PES.sincronizarVarios(removidos.map(c => ({ antes: c, c, o: { area: AREA_GERAL, op: false } })));
    let nOc = 0;
    if (op.ocorr) { const ids = G().ocorr.filter(o => set.has(String(o.mat))).map(o => o.id); nOc = ids.length; if (ids.length) DB.gExcluirOcorrencias(ids); }
    DB.log(`Efetivo: excluiu ${removidos.length === 1 ? title(removidos[0].nome) + ' (' + removidos[0].mat + ')' : removidos.length + ' colaboradores'}${op.modulos ? ', também dos outros módulos' : ''}${nOc ? ' e ' + nOc + ' ocorrência(s)' : ''}`);
    removidos.forEach(c => SEL.delete(c.mat)); if (set.has(String(U.mat))) U.mat = null;
    toast(removidos.length === 1 ? 'Colaborador excluído' : `${removidos.length} colaboradores excluídos`);
    render(); return removidos.length;
  }

  /* ---------- assinatura ---------- */
  function padAssin(cv) {
    const g = cv.getContext('2d'); let des = false, vazio = true, last = null;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); g.scale(dpr, dpr);
    g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0d0d25'; g.fillStyle = '#0d0d25';
    const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = e => { e.preventDefault(); des = true; vazio = false; last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ } g.beginPath(); g.arc(last[0], last[1], 1.2, 0, 7); g.fill(); };
    cv.onpointermove = e => { if (!des) return; const p = pos(e); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { des = false; };
    return {
      vazio: () => vazio,
      limpar: () => { g.clearRect(0, 0, cv.width, cv.height); vazio = true; },
      img: () => { const o = document.createElement('canvas'); o.width = 600; o.height = Math.round(600 * cv.height / cv.width); const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(cv, 0, 0, o.width, o.height); return o.toDataURL('image/jpeg', 0.7); }
    };
  }
  function assinarSheet(mat, sel) {
    const x = indice().get(mat); if (!x) return;
    const pend = x.pend; if (!pend.length) { toast('Nenhuma ocorrência aguardando assinatura'); return; }
    const marcadas = new Set(sel && sel.length ? sel : pend.map(o => o.id));
    const L = $('layer'); let modo = 'tela', foto = null, pads = {};
    const close = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); render(); };
    const kd = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', kd);
    L.innerHTML = `<div class="scrim" id="scrim"><form class="sheet wide" id="fAss" novalidate><h3>Assinatura</h3><div class="sub">${esc(title(x.c.nome))} · ${x.c.mat}</div>
      <div class="opts">${pend.map(o => `<label class="opt chk"><input type="checkbox" value="${o.id}" ${marcadas.has(o.id) ? 'checked' : ''}><span><b>${dBR(o.data)} · ${esc(o.tipo)}</b>${o.desc ? `<br><small class="muted">${esc(o.desc)}</small>` : ''}</span></label>`).join('')}</div>
      <div class="seg" role="tablist"><button type="button" role="tab" data-modo="tela" aria-selected="true">Assinar na tela</button><button type="button" role="tab" data-modo="papel" aria-selected="false">Via em papel</button><button type="button" role="tab" data-modo="recusa" aria-selected="false">Recusou</button></div>
      <div class="mpane" data-p="tela"><p class="small m0">${esc(cfg().declaracao || '')}</p>
        <div class="sigbox"><span>Colaborador: ${esc(title(x.c.nome))}</span><canvas id="sgColab"></canvas><button type="button" class="btn ghost" data-limpar="colab">Limpar</button></div>
        <label class="sel"><span>Responsável Dikma</span><input class="in" id="sgRespNome" value="${esc((ME().nome || '').toUpperCase())}"></label>
        <div class="sigbox"><span>Responsável Dikma</span><canvas id="sgResp"></canvas><button type="button" class="btn ghost" data-limpar="resp">Limpar</button></div></div>
      <div class="mpane" data-p="papel" hidden><p class="small m0">1. Imprima a via em <b>Impressão › Via de assinatura</b> e colha as assinaturas. 2. Fotografe a via assinada aqui.</p>
        <div class="row-gap"><label class="btn pri">${I.cam} Fotografar via<input type="file" accept="image/*" capture="environment" id="sgFoto" hidden></label><label class="btn">${I.file} Escolher imagem<input type="file" accept="image/*" id="sgFoto2" hidden></label></div><div id="sgPrev"></div></div>
      <div class="mpane" data-p="recusa" hidden><p class="small m0">O colaborador se recusou a assinar. Informe as testemunhas (nome e matrícula).</p>
        <label class="sel"><span>Testemunha 1</span><input class="in" id="sgT1"></label><label class="sel"><span>Testemunha 2</span><input class="in" id="sgT2"></label></div>
      <p class="err" id="sgErr" role="alert" hidden></p>
      <div class="row-gap"><button class="btn pri" type="submit">Confirmar</button><button class="btn" type="button" data-close>Cancelar</button></div></form></div>`;
    const setModo = m => { modo = m; L.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-selected', b.dataset.modo === m)); L.querySelectorAll('.mpane').forEach(p => { p.hidden = p.dataset.p !== m; }); if (m === 'tela' && !pads.colab) iniciarPads(); };
    const iniciarPads = () => { pads.colab = padAssin($('sgColab')); pads.resp = padAssin($('sgResp')); };
    requestAnimationFrame(iniciarPads);
    const sc = $('scrim');
    sc.onclick = e => {
      e.stopPropagation();
      if (e.target.id === 'scrim' || e.target.closest('[data-close]')) return close();
      const m = e.target.closest('[data-modo]'); if (m) return setModo(m.dataset.modo);
      const lp = e.target.closest('[data-limpar]'); if (lp) pads[lp.dataset.limpar].limpar();
    };
    const pegarFoto = async el => {
      const f = el.files[0]; el.value = ''; if (!f) return;
      try { foto = (await prepararFoto(f, `${pad(new Date().getDate())}/${pad(new Date().getMonth() + 1)}/${new Date().getFullYear()} · Via ${x.c.mat} · ${ME().login || ''}`)).dados; $('sgPrev').innerHTML = `<img src="${foto}" alt="Via assinada" class="viaprev">`; }
      catch (err) { showErr('sgErr', err); }
    };
    $('sgFoto').onchange = e => pegarFoto(e.target); $('sgFoto2').onchange = e => pegarFoto(e.target);
    $('fAss').onsubmit = async e => {
      e.preventDefault();
      const ids = [...L.querySelectorAll('.opt.chk input:checked')].map(i => i.value);
      try {
        if (!ids.length) throw new Error('Marque pelo menos uma ocorrência.');
        const base = { mat: x.c.mat, nome: x.c.nome, ocorrIds: ids, em: TODAY };
        if (modo === 'tela') {
          if (pads.colab.vazio()) throw new Error('Falta a assinatura do colaborador.');
          if (pads.resp.vazio()) throw new Error('Falta a assinatura do responsável Dikma.');
          DB.gAssinar({ ...base, metodo: 'tela', colab: pads.colab.img(), resp: pads.resp.img(), respNome: $('sgRespNome').value.trim() });
        } else if (modo === 'papel') {
          if (!foto) throw new Error('Fotografe a via assinada.');
          DB.gAssinar({ ...base, metodo: 'papel', foto, codigo: codigoVia(x.c.mat, ids.length) });
        } else {
          const t1 = $('sgT1').value.trim(), t2 = $('sgT2').value.trim();
          if (!t1) throw new Error('Informe ao menos uma testemunha.');
          DB.gAssinar({ ...base, metodo: 'recusa', testemunhas: [t1, t2].filter(Boolean) });
        }
        DB.log(`Efetivo: ${modo === 'recusa' ? 'registrou recusa' : 'colheu assinatura'} de ${title(x.c.nome)} (${ids.length} ocorrência(s))`);
        toast(modo === 'recusa' ? 'Recusa registrada' : 'Assinatura registrada');
        close();
      } catch (err) { showErr('sgErr', err); }
    };
  }
  async function verAssinatura(id) {
    const L = $('layer');
    L.innerHTML = '<div class="scrim" id="scrim"><div class="sheet wide"><h3>Assinatura</h3><p class="muted">Abrindo…</p></div></div>';
    const close = () => { L.innerHTML = ''; };
    $('scrim').onclick = e => { e.stopPropagation(); if (e.target.id === 'scrim' || e.target.closest('[data-close]')) close(); };
    let a = null; try { a = await DB.gAbrirAssinatura(id); } catch (err) { /* sem permissão ou sem sinal */ }
    const box = L.querySelector('.sheet'); if (!box) return;
    if (!a) { box.innerHTML = '<h3>Assinatura</h3><p class="muted">Não foi possível abrir neste aparelho.</p><button class="btn" data-close>Fechar</button>'; return; }
    box.innerHTML = `<h3>${a.metodo === 'recusa' ? 'Recusa registrada' : 'Assinatura'}</h3><div class="sub">${esc(title(a.nome || ''))} · ${a.mat} · ${dBR(a.em)} · registrado por ${esc(title(a.porNome || ''))}${a.codigo ? ' · ' + esc(a.codigo) : ''}</div>
      ${a.metodo === 'tela' ? `<div class="sigview"><div><span>Colaborador</span><img src="${a.colab}" alt="Assinatura do colaborador"></div><div><span>Responsável Dikma${a.respNome ? ': ' + esc(title(a.respNome)) : ''}</span><img src="${a.resp}" alt="Assinatura do responsável"></div></div>` : ''}
      ${a.metodo === 'papel' ? `<img src="${a.foto}" alt="Via assinada" class="viaprev">` : ''}
      ${a.metodo === 'recusa' ? `<p class="m0">Testemunhas: <b>${esc((a.testemunhas || []).join(' e '))}</b></p>` : ''}
      <p class="small muted m0">${(a.ocorrIds || []).length} ocorrência(s) nesta assinatura.</p><button class="btn" data-close>Fechar</button>`;
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-g],[data-gf],[data-gst]'); if (!t || t.closest('#layer')) return;
    const d = t.dataset;
    if (d.gf) { U.filtro = d.gf; return render(); }
    if (d.gst != null) { U.ocSt = d.gst; U.ocMeu = false; return render(); }
    switch (d.g) {
      case 'ficha': UI.view = 'gcolab'; U.mat = d.mat; render(); scrollTo(0, 0); break;
      case 'voltar': U.mat = null; render(); break;
      case 'ocMeu': U.ocMeu = !U.ocMeu; if (U.ocMeu) U.ocSt = 'pendente'; render(); break;
      case 'trocaResp': {
        const o = G().ocorr.find(x => x.id === d.id); if (!o) break;
        formSheet('Quem vai recolher a assinatura', `${esc(title(o.nome))} · ${esc(o.tipo)} · ${dBR(o.data)}`, `<div class="sel"><span>Responsável</span>${campoBusca('trResp', o.recolhe || '', opcoesResp, { livre: true, maiusculas: true, placeholder: 'Digite o nome' })}</div>`, 'Salvar', async () => {
          const v = $('trResp').value.trim().toUpperCase(); if (!v) throw new Error('Informe o responsável.');
          DB.gAtualizarOcorrencia(o.id, { recolhe: v }); DB.log(`Efetivo: ${title(v)} vai recolher a assinatura de ${title(o.nome)}`); toast(`Assinatura com ${title(v)}`);
        });
        break;
      }
      case 'impSel': U.impMat = d.mat; render(); if (matchMedia('(max-width:860px)').matches) { const b = $('gImpDocBox'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); } break;
      case 'impF': U.impF = d.v; U.impMat = ''; render(); break;
      case 'impDoc': U.impDoc = d.v; render(); break;
      case 'novaOc': novaOcorrencia(d.mat || null); break;
      case 'expOc': {
        const ST = { pendente: 'Aguardando assinatura', assinada: 'Assinada', recusada: 'Recusada' };
        const linhas = [['Data', 'Matrícula', 'Nome', 'Área', 'Tipo', 'Descrição', 'Líder (Dikma)', 'Recolher assinatura', 'Situação', 'Assinada em', 'Testemunha'], ...(U.ocLista || []).map(o => [dataBR(o.data), o.mat, o.nome, o.area || '', o.tipo, o.desc || '', o.lider || '', o.recolhe || '', ST[o.status] || o.status, dataBR(typeof o.assinadoEm === 'string' ? o.assinadoEm : ''), o.testemunha || ''])];
        baixarExcel('ocorrencias', [{ nome: 'Ocorrências', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
        break;
      }
      case 'assinar': assinarSheet(d.mat, d.oc ? [d.oc] : null); break;
      case 'verAss': verAssinatura(d.id); break;
      case 'imprimir': UI.view = 'gimpr'; U.impMat = d.mat; U.impDoc = indice().get(d.mat).pend.length ? 'via' : 'ficha'; render(); scrollTo(0, 0); break;
      case 'novoColab': colabForm(null); break;
      case 'sel': { const m = d.mat; if (SEL.has(m)) SEL.delete(m); else SEL.add(m); render(); break; }
      case 'selTodos': { const fa = filtroArea(); const F = { ativos: x => x.ativo, exp: x => x.exp, integ: x => x.ativo && !x.intOk, pend: x => x.pend.length, desl: x => !x.ativo, todos: () => true }; const q = U.q.trim().toLowerCase();
        const l = [...indice().values()].filter(x => fa(x.c)).filter(F[U.filtro] || F.todos).filter(x => !q || (x.c.mat + ' ' + x.c.nome + ' ' + (x.c.funcao || '')).toLowerCase().includes(q)).sort((a, b) => a.c.nome.localeCompare(b.c.nome)).slice(0, 500);
        const todos = l.every(x => SEL.has(x.c.mat)); l.forEach(x => (todos ? SEL.delete(x.c.mat) : SEL.add(x.c.mat))); render(); break; }
      case 'limparSel': SEL.clear(); render(); break;
      case 'excluirSel': excluirSheet([...SEL]); break;
      case 'excluirColab': excluirSheet([d.mat]); break;
      case 'editColab': colabForm(d.mat); break;
      case 'delOc': {
        if (t.dataset.ok !== '1') { t.dataset.ok = '1'; t.textContent = 'Excluir?'; setTimeout(() => { if (t.isConnected) { t.dataset.ok = ''; t.textContent = '✕'; } }, 3000); return; }
        DB.gExcluirOcorrencia(d.id); DB.log('Efetivo: excluiu uma ocorrência'); toast('Ocorrência excluída'); break;
      }
      case 'addTipo': { const l = tipos().concat([{ tipo: 'Novo tipo', f1: false, texto: '', pos: null }]); DB.gSalvarConfig({ tipos: l }); break; }
      case 'delTipo': { const l = tipos().filter((_, i) => i !== +d.i); DB.gSalvarConfig({ tipos: l }); toast('Tipo excluído'); break; }
      default: if (isAdmin()) IMP.onClick(d); break;
      case 'importar': {
        UI.busy = true; render();
        try { const s = await DB.seed('seed-gestao.json'); await DB.gImportar(s); DB.log('Efetivo: importou a planilha de fichas'); toast('Planilha de fichas importada'); }
        catch (err) { toast('Erro ao importar: ' + (err.message || err)); }
        UI.busy = false; render(); break;
      }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-g="ficha"]')) e.target.click(); });
  // Enter na busca da Impressão abre a primeira ficha encontrada.
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'gImpQ') { e.preventDefault(); const it = document.querySelector('#gImpLista .imp-it:not([hidden])'); if (it) it.click(); } });
  document.addEventListener('input', e => {
    const t = e.target; const map = { gQ: 'q', gOcQ: 'ocQ', gCQ: 'cq' };
    if (t.id === 'gImpQ') { U.impQ = t.value; filtrarListaImpr(); return; }
    if (map[t.id]) { U[map[t.id]] = t.value; clearTimeout(window._gq); window._gq = setTimeout(() => { const pos = t.selectionStart; render(); const n = $(t.id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (isAdmin() && UI.view === 'gimport' && IMP.onChange(t)) return;
    if (t.dataset && t.dataset.gfa) { U.fa = t.value; render(); return; }
    if (t.id === 'gDe') { U.de = t.value; render(); } else if (t.id === 'gAte') { U.ate = t.value; render(); }
    else if (t.id === 'gOcTipo') { U.ocTipo = t.value; render(); } else if (t.id === 'gCF') { U.cf = t.value; render(); }
    else if (t.id === 'gImpMat') { U.impMat = t.value; render(); } else if (t.id === 'gImpDoc') { U.impDoc = t.value; render(); }
    else if (t.dataset.gt) {
      const [i, f] = t.dataset.gt.split('|'); const l = tipos().map(x => ({ ...x }));
      if (f === 'f1') { if (t.checked && l.filter(x => x.f1).length >= 5) { t.checked = false; toast('A Folha 1 tem no máximo 5 tipos'); return; } l[+i].f1 = t.checked; }
      else if (f === 'pos') l[+i].pos = t.value ? +t.value : null; else l[+i][f] = t.value;
      DB.gSalvarConfig({ tipos: l }); toast('Tipo atualizado');
    }
  });

  const IMP = criarImportador({ DB, esc, title, I, toast, render, PES, colabForm, excluirColabs });
  return {
    render(view) {
      const v = vazio(); if (v) return v;
      return ({ gpainel: vPainel, gcolab: vColab, gimpr: vImpr, gtipos: vTipos, gimport: () => (isAdmin() ? IMP.view() : vPainel()) }[view] || vPainel)();
    },
    badge: () => (G().loaded && G().config ? pendentesVelhas() : 0)
  };
}
