// Administração › Limpeza de dados (só o administrador): apaga dados antigos em 4 passos na mesma tela.
// 1) o que apagar · 2) prévia (lida do banco: quantos documentos e células) · 3) cópia de segurança (arquivo JSON
// baixado no computador) · 4) confirmação (digitar APAGAR) e execução em lotes de até 400, com barra de progresso.
// As contas ficam em limpeza.js; a leitura e a gravação, em data.js (ou data-mock.js na demonstração).
// Não entram aqui: ocorrências das fichas (gocorr, documentos assinados), folhas de frequência (freqcomp) e férias.
import { SETS, SET_KEYS, add, addMonth, monthLabel } from '../contas/cal.js';
import * as LP from '../contas/limpeza.js';
import { DB, DEMO, TODAY, esc } from '../nucleo/base.js';
import { isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const C = (n, k) => SETS[k].pre + n;
const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const mBR = m => (m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : '');
const n0 = n => Number(n || 0).toLocaleString('pt-BR');
const plural = (n, um, varios) => `${n0(n)} ${n === 1 ? um : varios}`;
const ONTEM = add(TODAY, -1);
const MES_ANT = addMonth(LP.mesDaData(TODAY), -1);

// Estado da tela (fica só na memória: ao recarregar, começa de novo).
const novo = () => ({
  sel: {
    prog: { on: false, sets: { patio: true, bateria: true }, meses: {} },
    pend: { on: false, sets: { patio: true, bateria: true }, ate: add(TODAY, -60) },
    seg: { on: false, inter: true, anom: true, de: '', ate: addMonth(MES_ANT, -11), abertas: false },
    eq: { on: false, lanc: true, par: true, insp: true, de: '', ate: addMonth(MES_ANT, -11) },
    hist: { on: false, antes: add(TODAY, -180) }
  },
  cont: {}, previa: null, lendo: false, baixou: false, semCopia: false, conf: '', exec: null, erroPrevia: ''
});
let L = novo();

const conjuntos = () => SET_KEYS.filter(k => DB.dados && DB.dados(k) && DB.dados(k).config);
const mesesDe = k => ((DB.dados(k).config || {}).meses || []).slice().sort().reverse();
const algoMarcado = () => Object.values(L.sel).some(x => x.on);
// Qualquer mudança no que apagar invalida a prévia, a cópia e a confirmação.
function mudou() { L.previa = null; L.baixou = false; L.conf = ''; L.erroPrevia = ''; if (L.exec && !L.exec.rodando) L.exec = null; }

// Quantas semanas e apontamentos cada mês tem (lido do banco uma vez por mês, quando a lista aparece).
function contar(k, m) {
  const ch = k + '|' + m; if (L.cont[ch]) return;
  L.cont[ch] = { lendo: true };
  DB.limpezaLer(C('semanas', k), [['mes', '==', m]]).then(d => { L.cont[ch] = LP.contarSemanas(d); render(); }, () => { L.cont[ch] = { erro: true }; render(); });
}

/* ---------------- passo 1: o que apagar ---------------- */
const chk = (path, v, txt, extra = '') => `<label class="lpchk"><input type="checkbox" data-lp="${path}" ${v ? 'checked' : ''} ${extra}><span>${txt}</span></label>`;
const campo = (path, tipo, v, rot, attrs = '') => `<label class="sel"><span>${rot}</span><input class="in" type="${tipo}" data-lp="${path}" value="${esc(v)}" ${attrs}></label>`;
function cartao(id, titulo, desc, corpo) {
  const on = L.sel[id].on;
  return `<div class="card lpc${on ? ' on' : ''}"><label class="lpcab"><input type="checkbox" data-lp="${id}.on" ${on ? 'checked' : ''}><span class="minw"><b>${titulo}</b><small>${desc}</small></span></label>${on ? `<div class="body stackcol lpcorpo">${corpo}</div>` : ''}</div>`;
}
function cartaoProg() {
  const s = L.sel.prog; const ks = conjuntos();
  let h = ks.length > 1 ? `<div class="row-gap">${ks.map(k => chk(`prog.sets.${k}`, s.sets[k], SETS[k].curto)).join('')}</div>` : '';
  for (const k of ks.filter(x => s.sets[x])) {
    const ms = mesesDe(k);
    h += `<div class="lpmeses"><div class="small muted">${SETS[k].nome} · meses gerados</div>${ms.length ? ms.map(m => {
      const prot = LP.mesProtegido(m, TODAY); const c = L.cont[k + '|' + m]; if (!prot) contar(k, m);
      const info = prot ? '<span class="pill neu">em uso</span>' : !c || c.lendo ? '<span class="muted small">contando…</span>' : c.erro ? '<span class="muted small">não deu para contar</span>' : `<span class="muted small num">${plural(c.semanas, 'semana', 'semanas')} · ${plural(c.apont, 'apontamento', 'apontamentos')}</span>`;
      return `<label class="lpmes${prot ? ' dis' : ''}"><input type="checkbox" data-lp="prog.meses.${k}|${m}" ${s.meses[k + '|' + m] && !prot ? 'checked' : ''} ${prot ? 'disabled' : ''}><span class="minw"><b>${monthLabel(m)}</b></span>${info}</label>`;
    }).join('') : '<p class="muted small m0">Nenhum mês gerado.</p>'}</div>`;
  }
  return h + '<p class="muted small m0">Apaga as semanas e as aprovações do mês e tira o mês da lista de meses gerados. O mês atual e o próximo não podem ser apagados.</p>';
}
function cartaoPend() {
  const s = L.sel.pend; const ks = conjuntos();
  return `${ks.length > 1 ? `<div class="row-gap">${ks.map(k => chk(`pend.sets.${k}`, s.sets[k], SETS[k].curto)).join('')}</div>` : ''}
    ${campo('pend.ate', 'date', s.ate, 'Até a data (inclusive)', `max="${ONTEM}"`)}
    <p class="muted small m0">As atividades programadas e nunca apontadas até essa data deixam de contar como pendência, atrasada e programada. Não viram "não realizada". Na Programação aparecem com um traço: <span class="chip sm D">–</span> Dispensada na limpeza.</p>`;
}
function cartaoSeg() {
  const s = L.sel.seg;
  return `<div class="row-gap">${chk('seg.inter', s.inter, 'Interações')}${chk('seg.anom', s.anom, 'Anomalias')}</div>
    <div class="row-gap lpdatas">${campo('seg.de', 'month', s.de, 'De (mês, opcional)', `max="${MES_ANT}"`)}${campo('seg.ate', 'month', s.ate, 'Até (mês)', `max="${MES_ANT}"`)}</div>
    ${chk('seg.abertas', s.abertas, 'Incluir as anomalias em aberto ou em tratamento')}
    <p class="muted small m0">Os registros saem com as fotos deles. Sem a marca acima, só as anomalias concluídas são apagadas. Vai até o mês anterior ao atual.</p>`;
}
function cartaoEq() {
  const s = L.sel.eq;
  return `<div class="row-gap">${chk('eq.lanc', s.lanc, 'Lançamentos')}${chk('eq.par', s.par, 'Paradas')}${chk('eq.insp', s.insp, 'Inspeções')}</div>
    <div class="row-gap lpdatas">${campo('eq.de', 'month', s.de, 'De (mês, opcional)', `max="${MES_ANT}"`)}${campo('eq.ate', 'month', s.ate, 'Até (mês)', `max="${MES_ANT}"`)}</div>
    <p class="muted small m0">Pelo mês do lançamento. Vai até o mês anterior ao atual.</p>`;
}
function cartaoHist() {
  return `${campo('hist.antes', 'date', L.sel.hist.antes, 'Apagar o que for anterior a', `max="${TODAY}"`)}<p class="muted small m0">O histórico de alterações (quem fez o quê). A linha desta limpeza fica registrada.</p>`;
}

/* ---------------- passo 2: prévia (lê do banco o que vai sair) ---------------- */
async function montarPrevia() {
  const S = L.sel; const itens = []; const hist = [];
  const alterar = [], apagarSeg = [], apagar = [], fim = [];
  const copia = { tipo: 'dikma-limpeza', versao: 1, geradoEm: new Date().toISOString(), hoje: TODAY, apagados: [], alterados: [] };
  const guardar = (lista, col, docs, grupo) => {
    if (!docs.length) return;
    copia.apagados.push({ colecao: col, grupo, docs: docs.map(({ id, ...dados }) => ({ id, dados })) });
    for (const d of docs) lista.push({ tipo: 'apagar', col, id: d.id, grupo });
  };
  const mesesSai = {};
  // Programação por mês
  if (S.prog.on) {
    const linhas = []; let nd = 0; const partes = [];
    for (const k of conjuntos().filter(x => S.prog.sets[x])) {
      const ms = mesesDe(k).filter(m => S.prog.meses[k + '|' + m] && !LP.mesProtegido(m, TODAY)).sort();
      if (!ms.length) continue; mesesSai[k] = new Set(ms);
      for (const m of ms) {
        const [sem, ap] = await Promise.all([DB.limpezaLer(C('semanas', k), [['mes', '==', m]]), DB.limpezaLer(C('aprov', k), [['mes', '==', m]])]);
        const c = LP.contarSemanas(sem); const g = `Programação ${SETS[k].curto} ${monthLabel(m)}`;
        guardar(apagar, C('semanas', k), sem, g); guardar(apagar, C('aprov', k), ap, g);
        nd += sem.length + ap.length;
        linhas.push([`${SETS[k].curto} · ${monthLabel(m)}`, `${plural(sem.length, 'semana', 'semanas')} · ${plural(c.apont, 'apontamento', 'apontamentos')} · ${plural(ap.length, 'aprovação', 'aprovações')}`]);
      }
      const cfg = (await DB.limpezaLerIds(C('config', k), ['sistema']))[0] || { id: 'sistema', ...DB.dados(k).config };
      const novos = (cfg.meses || []).filter(m => !mesesSai[k].has(m));
      copia.alterados.push({ colecao: C('config', k), id: 'sistema', antes: cfg });
      fim.push({ tipo: 'alterar', col: C('config', k), id: 'sistema', campos: [[['meses'], novos]], grupo: `Lista de meses gerados ${SETS[k].curto}` });
      partes.push(`${SETS[k].curto} ${ms.map(mBR).join(', ')}`);
    }
    itens.push({ t: 'Programação de atividades', linhas, n: nd, un: 'documentos' });
    if (partes.length) hist.push(`programação ${partes.join(' e ')} (${n0(nd)} documentos)`);
  }
  // Pendências antigas
  if (S.pend.on) {
    const ate = S.pend.ate && S.pend.ate < TODAY ? S.pend.ate : ONTEM;
    const linhas = []; let ncel = 0, natr = 0;
    for (const k of conjuntos().filter(x => S.pend.sets[x])) {
      const ms = mesesDe(k).filter(m => m <= LP.mesDaData(ate) && !(mesesSai[k] && mesesSai[k].has(m))).sort();
      const docs = (await Promise.all(ms.map(m => DB.limpezaLer(C('semanas', k), [['mes', '==', m]])))).flat();
      const plano = LP.planoDispensa(docs, { ate, hoje: TODAY, em: TODAY });
      const porId = new Map(docs.map(d => [d.id, d]));
      const g = `Pendências ${SETS[k].curto}`;
      for (const x of plano) { alterar.push({ tipo: 'alterar', col: C('semanas', k), id: x.id, campos: x.campos, grupo: g }); const { id, ...antes } = porId.get(x.id); copia.alterados.push({ colecao: C('semanas', k), id, antes }); }
      const n = plano.reduce((s, x) => s + x.cel.length, 0), a = LP.atrasadasNoPlano(plano, TODAY); ncel += n; natr += a;
      linhas.push([`${SETS[k].curto} · até ${dBR(ate)}`, `${plural(n, 'atividade', 'atividades')} em ${plural(plano.length, 'semana', 'semanas')} · ${n0(a)} hoje contam como atrasadas`]);
    }
    itens.push({ t: 'Pendências antigas (dispensar)', linhas, n: ncel, un: 'células', atr: natr });
    if (ncel) hist.push(`pendências dispensadas até ${dBR(ate)} (${n0(ncel)} atividades)`);
  }
  // Segurança
  if (S.seg.on) {
    const ate = S.seg.ate && S.seg.ate <= MES_ANT ? S.seg.ate : MES_ANT; const de = S.seg.de && S.seg.de <= ate ? S.seg.de : '';
    const conds = [['mes', '<=', ate], ...(de ? [['mes', '>=', de]] : [])];
    const linhas = []; let nd = 0; const partes = [];
    for (const [col, on, nome, um, anom] of [['seginter', S.seg.inter, 'interações', 'interação', false], ['seganom', S.seg.anom, 'anomalias', 'anomalia', true]]) {
      if (!on) continue;
      const regs = await DB.limpezaLer(col, conds);
      const p = LP.planoSeg(regs, { anom, incluirAbertas: S.seg.abertas });
      const fotos = p.fotos.length ? await DB.limpezaLerIds('segfotos', p.fotos) : [];
      const g = `Segurança · ${nome}`;
      guardar(apagarSeg, 'segfotos', fotos, g); guardar(apagarSeg, col, p.regs, g);
      nd += p.regs.length + fotos.length;
      const ficam = regs.length - p.regs.length;
      linhas.push([`${nome[0].toUpperCase() + nome.slice(1)} · ${de ? mBR(de) + ' a ' : 'até '}${mBR(ate)}`, `${plural(p.regs.length, um, nome)} · ${plural(fotos.length, 'foto', 'fotos')}${ficam ? ` · ${n0(ficam)} em aberto ficam` : ''}`]);
      partes.push(`${n0(p.regs.length)} ${nome} e ${n0(fotos.length)} fotos`);
    }
    itens.push({ t: 'Registros de Segurança', linhas, n: nd, un: 'documentos' });
    if (nd) hist.push(`Segurança ${de ? mBR(de) + ' a ' : 'até '}${mBR(ate)} (${partes.join(', ')})`);
  }
  // Equipamentos
  if (S.eq.on) {
    const ate = S.eq.ate && S.eq.ate <= MES_ANT ? S.eq.ate : MES_ANT; const de = S.eq.de && S.eq.de <= ate ? S.eq.de : '';
    const conds = [['mes', '<=', ate], ...(de ? [['mes', '>=', de]] : [])];
    const linhas = []; let nd = 0; const partes = [];
    for (const [col, on, nome] of [['eqlanc', S.eq.lanc, 'lançamentos'], ['eqpar', S.eq.par, 'paradas'], ['eqinsp', S.eq.insp, 'inspeções']]) {
      if (!on) continue;
      const docs = await DB.limpezaLer(col, conds);
      guardar(apagar, col, docs, `Equipamentos · ${nome}`); nd += docs.length;
      linhas.push([`${nome[0].toUpperCase() + nome.slice(1)} · ${de ? mBR(de) + ' a ' : 'até '}${mBR(ate)}`, `${n0(docs.length)} ${nome}`]);
      partes.push(`${n0(docs.length)} ${nome}`);
    }
    itens.push({ t: 'Equipamentos', linhas, n: nd, un: 'documentos' });
    if (nd) hist.push(`equipamentos ${de ? mBR(de) + ' a ' : 'até '}${mBR(ate)} (${partes.join(', ')})`);
  }
  // Histórico
  if (S.hist.on) {
    const antes = S.hist.antes && S.hist.antes <= TODAY ? S.hist.antes : TODAY;
    const docs = await DB.limpezaLer('historico', [['at', '<', new Date(antes + 'T00:00:00')]]);
    guardar(apagar, 'historico', docs, 'Histórico de alterações');
    itens.push({ t: 'Histórico de alterações', linhas: [[`Antes de ${dBR(antes)}`, plural(docs.length, 'linha', 'linhas')]], n: docs.length, un: 'documentos' });
    if (docs.length) hist.push(`histórico antes de ${dBR(antes)} (${n0(docs.length)} linhas)`);
  }
  // Ordem: dispensas, Segurança (fotos antes dos registros), o resto e, por último, a lista de meses gerados.
  const ops = [...alterar, ...apagarSeg, ...apagar, ...fim];
  const docsApagar = ops.filter(o => o.tipo === 'apagar').length;
  const celulas = itens.filter(x => x.un === 'células').reduce((s, x) => s + x.n, 0);
  return { itens, ops, copia, docsApagar, celulas, docsAlterar: alterar.length + fim.length, historico: LP.linhaHistorico(hist) };
}
async function verPrevia() {
  if (!isAdmin() || L.lendo) return;
  if (!algoMarcado()) { toast('Marque pelo menos uma coisa para apagar'); return; }
  L.lendo = true; L.erroPrevia = ''; render();
  try { L.previa = await montarPrevia(); }
  catch (e) { L.previa = null; L.erroPrevia = (e && e.message) || 'Não foi possível ler os dados agora.'; }
  L.lendo = false; render();
}

/* ---------------- passo 3: cópia de segurança ---------------- */
function baixarCopia() {
  const P = L.previa; if (!P) return;
  try {
    const blob = new Blob([JSON.stringify({ ...P.copia, resumo: P.historico }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `copia-limpeza-${TODAY}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    L.baixou = true; toast('Cópia baixada · guarde o arquivo antes de apagar'); render();
  } catch (e) { toast('Não foi possível gerar a cópia neste aparelho'); }
}

/* ---------------- passo 4: confirmação e execução ---------------- */
const podeApagar = () => !!L.previa && L.previa.ops.length > 0 && (L.baixou || L.semCopia) && L.conf.trim().toUpperCase() === 'APAGAR' && !(L.exec && L.exec.rodando);
async function executar() {
  if (!isAdmin() || !podeApagar()) return;
  if (!DEMO && !navigator.onLine) { toast('Sem sinal: a limpeza precisa de conexão com o servidor'); return; }
  const P = L.previa; const lotes = LP.emLotes(P.ops);
  L.exec = { feito: 0, total: P.ops.length, rodando: true }; render();
  try {
    for (const l of lotes) { await DB.limpezaGravar(l); L.exec.feito += l.length; render(); }
    L.exec.fim = true; L.cont = {}; DB.log(P.historico); toast('Limpeza concluída');
  } catch (e) {
    L.exec.erro = (e && (e.code === 'permission-denied' ? 'Sem permissão no banco para esta operação.' : e.message)) || 'Erro inesperado';
    L.exec.faltou = LP.faltou(P.ops, L.exec.feito);
    DB.log(`${P.historico} · interrompida (${L.exec.feito} de ${L.exec.total} operações)`);
    toast('Erro: a limpeza parou no meio · veja o que faltou');
  }
  L.exec.rodando = false; L.conf = ''; render();
}

/* ---------------- tela ---------------- */
const passo = (n, titulo, sub, corpo, ativo = true) => `<section class="card lppasso${ativo ? '' : ' off'}" aria-label="Passo ${n}: ${titulo}"><header><span class="lpn">${n}</span><div class="minw"><h2>${titulo}</h2><p>${sub}</p></div></header><div class="body stackcol">${corpo}</div></section>`;
export function vLimpeza() {
  if (!isAdmin()) return '<div class="card"><div class="empty">Só o administrador faz a limpeza de dados.</div></div>';
  const P = L.previa, E = L.exec;
  let h = `<div class="lpaviso" role="note">${I.pend}<p class="m0"><b>Apaga dados de vez.</b> Use para aliviar o banco do plano grátis. Faça na ordem: escolha, veja a prévia, baixe a cópia e confirme. Ocorrências das fichas, folhas de frequência e férias não entram aqui.</p></div>`;
  // 1
  h += passo(1, 'O que apagar', 'Marque um ou mais itens', `<div class="lpgrid">
    ${cartao('prog', 'Programação de atividades por mês', 'Semanas e aprovações de meses antigos', L.sel.prog.on ? cartaoProg() : '')}
    ${cartao('pend', 'Pendências antigas', 'Dispensar o que ficou sem apontamento até uma data', L.sel.pend.on ? cartaoPend() : '')}
    ${cartao('seg', 'Registros de Segurança', 'Interações e anomalias de um período, com as fotos', L.sel.seg.on ? cartaoSeg() : '')}
    ${cartao('eq', 'Equipamentos', 'Lançamentos, paradas e inspeções por mês', L.sel.eq.on ? cartaoEq() : '')}
    ${cartao('hist', 'Histórico de alterações', 'O registro de quem fez o quê, até uma data', L.sel.hist.on ? cartaoHist() : '')}</div>`);
  // 2
  const prev = P ? `<div class="lpprev">${P.itens.map(x => `<div class="lpitem"><div class="row-between"><b>${esc(x.t)}</b><span class="num">${n0(x.n)} ${x.un}</span></div>${x.linhas.length ? `<ul>${x.linhas.map(([a, b]) => `<li><span>${esc(a)}</span><span class="muted num">${esc(b)}</span></li>`).join('')}</ul>` : '<p class="muted small m0">Nada escolhido neste item.</p>'}</div>`).join('')}</div>
    <div class="mini"><div><b class="num">${n0(P.docsApagar)}</b><span>Documentos a apagar</span></div><div><b class="num">${n0(P.celulas)}</b><span>Atividades a dispensar</span></div><div><b class="num">${n0(P.ops.length)}</b><span>Operações · ${n0(LP.emLotes(P.ops).length)} lote(s)</span></div></div>
    ${P.ops.length ? '' : '<p class="muted m0">Nada para apagar com essas escolhas.</p>'}` : '';
  h += passo(2, 'Prévia', 'Quantos documentos e células serão afetados, lidos agora do banco', `${prev}${L.erroPrevia ? `<p class="err m0" role="alert">${esc(L.erroPrevia)}</p>` : ''}<div class="row-gap"><button class="btn${P ? '' : ' pri'}" data-act="lpPrevia" ${!algoMarcado() || L.lendo || (E && E.rodando) ? 'disabled' : ''}>${L.lendo ? 'Lendo do banco…' : P ? 'Ler de novo' : 'Ver a prévia'}</button>${!algoMarcado() ? '<span class="muted small">Marque algo no passo 1.</span>' : ''}</div>`, algoMarcado());
  // 3
  const temOps = !!P && P.ops.length > 0;
  h += passo(3, 'Cópia de segurança', 'Arquivo com tudo o que vai ser apagado ou alterado, no formato do banco', `<div class="row-gap"><button class="btn${L.baixou ? '' : ' pri'}" data-act="lpCopia" ${temOps ? '' : 'disabled'}>${I.dl} ${L.baixou ? 'Baixar de novo' : 'Baixar cópia antes de apagar'}</button>${L.baixou ? '<span class="pill ok">Cópia baixada</span>' : ''}</div>
    <label class="lpchk"><input type="checkbox" data-lp="semCopia" ${L.semCopia ? 'checked' : ''} ${temOps ? '' : 'disabled'}><span>Não preciso de cópia</span></label>`, temOps);
  // 4
  let res = '';
  if (E) {
    const pct = E.total ? Math.round(E.feito / E.total * 100) : 0;
    res = `<div role="status" aria-live="polite"><div class="small">${E.rodando ? 'Apagando…' : E.erro ? 'Parou no meio' : 'Concluída'} · <b class="num">${n0(E.feito)}</b> de <span class="num">${n0(E.total)}</span> operações</div><div class="barra lpbarra${E.fim ? ' ok' : ''}"><i style="width:${Math.max(E.feito ? 2 : 0, pct)}%"></i></div></div>`;
    if (E.fim) res += `<div class="lpfim"><b>Apagados:</b> ${P.itens.filter(x => x.n).map(x => `${esc(x.t)} (${n0(x.n)} ${x.un})`).join(' · ') || 'nada'}.<br><span class="muted small">Registrado no histórico.</span></div><div class="row-gap"><button class="btn" data-act="lpNova">Fazer outra limpeza</button></div>`;
    if (E.erro) res += `<div class="lpfim bad" role="alert"><b>Erro:</b> ${esc(E.erro)}<br>Já feito: ${n0(E.feito)} operações. Faltou: ${E.faltou.map(([g, n]) => `${esc(g)} (${n0(n)})`).join(' · ')}.<br><span class="muted small">Leia a prévia de novo para tentar o que faltou.</span></div>`;
  }
  const lib = temOps && (L.baixou || L.semCopia);
  h += passo(4, 'Confirmação', 'Digite APAGAR para liberar o botão', `${E && (E.rodando || E.fim) ? '' : `<div class="row-gap lpconf"><label class="sel"><span>Digite APAGAR</span><input class="in" id="lpConf" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(L.conf)}" ${lib ? '' : 'disabled'}></label><button class="btn perigo" data-act="lpApagar" id="lpApagar" ${podeApagar() ? '' : 'disabled'}>Apagar</button></div>${temOps && !lib ? '<p class="muted small m0">Baixe a cópia ou marque "Não preciso de cópia" no passo 3.</p>' : ''}`}${res}`, lib || !!E);
  return h;
}

/* ---------------- eventos da tela ---------------- */
acoes.lpPrevia = () => verPrevia();
acoes.lpCopia = () => baixarCopia();
acoes.lpApagar = () => executar();
acoes.lpNova = () => { L = novo(); render(); };
// Caixas, datas e meses do passo 1 (data-lp = caminho no estado) e o "Não preciso de cópia".
document.addEventListener('change', e => {
  const t = e.target; const p = t && t.dataset && t.dataset.lp; if (!p) return;
  if (p === 'semCopia') { L.semCopia = t.checked; render(); return; }
  const [id, campo, chave] = p.split('.');
  const o = L.sel[id]; if (!o) return;
  const v = t.type === 'checkbox' ? t.checked : t.value;
  if (chave != null) o[campo][chave] = v; else o[campo] = v;
  mudou(); render();
});
document.addEventListener('input', e => {
  if (e.target.id !== 'lpConf') return;
  L.conf = e.target.value; const b = document.getElementById('lpApagar'); if (b) b.disabled = !podeApagar();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'lpConf' && podeApagar()) { e.preventDefault(); executar(); } });
