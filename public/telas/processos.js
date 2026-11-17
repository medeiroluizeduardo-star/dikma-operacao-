// Administração › Processos e rotina (era a tela Processos do Meu painel): os processos do analista (P01 a P09) e a
// rotina do dia que sai deles. Duas partes: Rotina (o que fazer hoje, atrasadas, diárias não marcadas e as próximas
// entregas) e Processos (passos, responsáveis Dikma e Arcelor, frequência, editar). Só o administrador vê e usa.
// As contas ficam em contas/processos.js; o banco, em processos/config e rotina/{pid}_{data} (nucleo/data.js).
// Avisos no celular às 7h (o que fazer hoje) e às 16h (o que ficou em aberto) saem da rotina dos avisos.
import { FREQ, DIAS, CONJ, PRIO, ESTADO, LIMITES, JANELA, processosDe, proximoId, conferirProcesso, quadro, andamento, marcar, statusPelosPassos, fechada, tarefa, maisDias, ultimoUtilDoMes } from '../contas/processos.js';
import { today } from '../contas/cal.js';
import { ehAdminU } from '../contas/acessos.js';
import { etiqueta, vazio, carregando, abas } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, isAdmin, salvarUI } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const TODAY = today();
const U = () => (UI.pr ||= { aba: 'rotina' });
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const diaNome = s => `${WD[new Date(s + 'T12:00:00Z').getUTCDay()]}, ${dm(s)}`;
const v$ = id => (document.getElementById(id) || {}).value || '';
// Abas que cada processo pode abrir (atalho no cartão e na tarefa).
const ABAS = { '': 'Nenhuma', gmed: 'Gestão › Medição', cfarqfotos: 'Relatórios e arquivo de fotos', prog: 'Gestão › Programação', quedazero: 'Operação › Queda zero', elanc: 'Operação › Lançamentos e paradas', sganom: 'Segurança › Anomalias', gtrat: 'Gestão › Tratativas', ivisao: 'Indicadores › Visão geral' };
const NOME_ABA = { gmed: 'Abrir Medição', cfarqfotos: 'Abrir fotos', prog: 'Abrir Programação', quedazero: 'Abrir Queda zero', elanc: 'Abrir Lançamentos', sganom: 'Abrir Anomalias', gtrat: 'Abrir Tratativas', ivisao: 'Abrir Indicadores' };

/* ---------- dados ---------- */
let gravouDesde = false;
function base() {
  if (DB.procWatch) DB.procWatch(maisDias(TODAY, -JANELA - 1));
  const b = DB.cache.proc || { cfg: null, docs: {}, loaded: false };
  // Primeira vez: a rotina passa a contar de hoje (antes disso nada fica atrasado nem "não marcado").
  if (b.loaded && !b.erro && !(b.cfg && b.cfg.desde) && !gravouDesde && isAdmin()) { gravouDesde = true; DB.procSalvarCfg({ desde: TODAY, dono: ME.uid, donoNome: ME.nome || ME.login || '' }).catch(() => { gravouDesde = false; }); }
  return b;
}
const tudo = () => { const b = base(); const procs = processosDe(b.cfg); return { b, procs, docs: b.docs || {}, desde: (b.cfg && b.cfg.desde) || TODAY }; };

/* ---------- desenho ---------- */
const conjEtq = c => `<span class="tag">${esc(CONJ[c] || '')}</span>`;
const estEtq = t => (t.status === 'feita' ? etiqueta('Feita', 'ok') : t.status === 'nfeita' ? etiqueta('Não feita', 'neutro') : t.status === 'andamento' ? etiqueta('Em andamento', 'info') : t.data < TODAY ? (t.diaria ? etiqueta('Não marcada', 'atencao') : etiqueta('Atrasada', 'critico')) : etiqueta('A fazer', 'atencao'));
function itemTarefa(t, { comData = false, marcarDia = false } = {}) {
  const ok = t.status === 'feita';
  const meta = [t.p.id, CONJ[t.p.conj], t.passos.length ? `${t.feitos}/${t.passos.length} passos` : '', comData ? diaNome(t.data) : '', t.obs ? 'com observação' : ''].filter(Boolean).map(esc).join(' · ');
  const bts = marcarDia
    ? `<span class="pr-bts"><button type="button" class="btn sm" data-act="prMarca" data-id="${esc(t.id)}" data-v="feita">Feita</button><button type="button" class="btn sm ghost" data-act="prMarca" data-id="${esc(t.id)}" data-v="nfeita">Não feita</button></span>`
    : `<span class="pr-bts">${t.p.aba && NOME_ABA[t.p.aba] ? `<button type="button" class="btn sm ghost" data-go="${esc(t.p.aba)}">${esc(NOME_ABA[t.p.aba])}</button>` : ''}<button type="button" class="btn sm" data-act="prAbrir" data-id="${esc(t.id)}">Abrir</button></span>`;
  return `<div class="tr-it pr-it${fechada(t) ? ' fechada' : ''}">${marcarDia ? '' : `<button type="button" class="pr-chk${ok ? ' on' : ''}" data-act="prMarca" data-id="${esc(t.id)}" data-v="${ok ? 'aberta' : 'feita'}" aria-pressed="${ok}" aria-label="${ok ? 'Desmarcar' : 'Marcar como feita'}: ${esc(t.titulo)}">${ok ? I.ok : ''}</button>`}
    <span class="tr-it-t"><b>${esc(t.titulo)}</b><small>${meta}</small></span><span class="tr-it-s">${estEtq(t)}</span>${bts}</div>`;
}
function cartoes(q) {
  const c = (rot, v, sub, cls) => `<div class="p-ind md-card ${cls}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${esc(sub)}</span></div>`;
  return `<div class="md-cards">${[
    c(q.dia === TODAY ? 'Rotina de hoje' : 'Rotina de ' + WD[new Date(q.dia + 'T12:00:00Z').getUTCDay()], `${q.feitasDia}/${q.doDia.length}`, 'feitas', q.doDia.length && q.feitasDia === q.doDia.length ? 'ok' : ''),
    c('Atrasadas', q.atrasadas.length, 'entregas semanais e do mês', q.atrasadas.length ? 'critico' : ''),
    c('Não marcadas', q.naoMarcadas.length, 'rotinas diárias de dias que passaram', q.naoMarcadas.length ? 'atencao' : ''),
    c('Próximos 7 dias', q.proximas.length, 'entregas semanais e do mês', '')
  ].join('')}</div>`;
}
function vRotina() {
  const { procs, docs, desde } = tudo(); const q = quadro(procs, docs, TODAY, desde);
  let h = cartoes(q);
  h += `<section class="card"><header><h2>${q.dia === TODAY ? 'Rotina de hoje' : 'Rotina de ' + esc(diaNome(q.dia))}</h2><p>Marque o que foi feito. Os passos de cada processo ficam em "Abrir".</p></header><div class="body">`
    + (q.doDia.length ? `<div class="tr-lista">${q.doDia.map(t => itemTarefa(t)).join('')}</div>` : vazio('Nada para este dia', 'Nenhum processo ativo vence neste dia.')) + '</div></section>';
  if (q.atrasadas.length) h += `<section class="card"><header><h2>Atrasadas</h2><p>Entregas semanais e do mês que passaram do dia sem fechar.</p></header><div class="body"><div class="tr-lista">${q.atrasadas.map(t => itemTarefa(t, { comData: true })).join('')}</div></div></section>`;
  if (q.naoMarcadas.length) h += `<section class="card"><header><h2>Rotinas diárias não marcadas</h2><p>Rotina diária não fica atrasada: diga se foi feita ou não (conta no andamento de cada processo).</p></header><div class="body">
    <div class="row-gap pr-todas"><button type="button" class="btn sm" data-act="prTodas" data-v="feita">Todas feitas</button><button type="button" class="btn sm ghost" data-act="prTodas" data-v="nfeita">Todas não feitas</button></div>
    <div class="tr-lista">${q.naoMarcadas.map(t => itemTarefa(t, { comData: true, marcarDia: true })).join('')}</div></div></section>`;
  if (q.proximas.length) h += `<section class="card"><header><h2>Próximas entregas</h2><p>Semanais e fechamento do mês nos próximos 7 dias.</p></header><div class="body"><div class="tr-lista">${q.proximas.map(t => itemTarefa(t, { comData: true })).join('')}</div></div></section>`;
  h += vDono(desde);
  return h;
}
function vDono(desde) {
  const { b } = tudo(); const cfg = b.cfg || {};
  const adms = (DB.cache.usuarios || []).filter(ehAdminU).sort((a, c) => String(a.nome || '').localeCompare(String(c.nome || ''), 'pt-BR'));
  const dono = cfg.dono || '';
  const sel = adms.length ? `<label class="sel"><span>Quem cuida da rotina (recebe os avisos)</span><select class="in" id="prDono"><option value="">Todos os administradores</option>${adms.map(u => `<option value="${esc(u.uid)}" ${u.uid === dono ? 'selected' : ''}>${esc(u.nome || u.login || '')}</option>`).join('')}</select></label>` : '';
  return `<section class="card"><header><h2>Avisos no celular</h2><p>Às 7h, o que fazer no dia; às 16h, o que ficou em aberto (dias úteis). Ligue em Avisos no celular › Processos e rotina.</p></header><div class="body pr-dono">${sel}
    <p class="muted small m0">A rotina conta desde ${esc(dm(desde))}/${esc(String(desde).slice(0, 4))}. Só o administrador vê esta tela.</p><button type="button" class="btn sm ghost" data-go="avisos">${I.celular} Avisos no celular</button></div></section>`;
}
function vProcessos() {
  const { procs, docs, desde } = tudo(); const an = andamento(procs, docs, TODAY, desde);
  const freq = p => (p.freq === 'semanal' ? `Toda ${DIAS[p.dia] ? DIAS[p.dia].toLowerCase() : '?'}` : p.freq === 'mensal' ? `Fechamento do mês (${dm(ultimoUtilDoMes(TODAY))})` : FREQ[p.freq]);
  return `<p class="ic-placar">Os processos do analista com os passos e os responsáveis. A rotina de cada dia sai da frequência de cada um; P09 e os "sob demanda" viram ações nas Tratativas quando aparecem.</p>
  <div class="pr-procs">${procs.map(p => { const a = an[p.id] || { n: 0, feitas: 0, nfeitas: 0 };
    return `<article class="card pr-proc${p.ativo ? '' : ' fechada'}"><header><div class="row-gap"><span class="mono">${esc(p.id)}</span>${conjEtq(p.conj)}${etiqueta('Prioridade ' + (PRIO[p.prio] || '').toLowerCase(), p.prio === 'alta' ? 'atencao' : 'neutro')}${p.ativo ? '' : etiqueta('Desligado', 'neutro')}</div><h2>${esc(p.nome)}</h2><p>${esc(freq(p))}${p.por ? ' · ' + esc(p.por) : ''}</p></header><div class="body">
      ${p.passos.length ? `<ol class="pr-passos">${p.passos.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted small m0">Sem passos cadastrados.</p>'}
      <div class="pr-resp"><div><span class="eyebrow">Dikma</span><b>${esc(p.dikma || '') || '<span class="muted">não definido</span>'}</b></div><div><span class="eyebrow">Arcelor</span><b>${esc(p.arcelor || '') || '<span class="muted">não definido</span>'}</b></div>
      ${p.freq !== 'demanda' ? `<div><span class="eyebrow">Últimos ${JANELA} dias</span><b>${a.feitas} de ${a.n} feitas</b>${a.nfeitas ? `<small class="muted"> · ${a.nfeitas} não feita${a.nfeitas > 1 ? 's' : ''}</small>` : ''}</div>` : ''}</div>
      <div class="row-gap"><button type="button" class="btn sm" data-act="prAcao" data-id="${esc(p.id)}">${I.plus} Ação nas Tratativas</button>${p.aba && NOME_ABA[p.aba] ? `<button type="button" class="btn sm ghost" data-go="${esc(p.aba)}">${esc(NOME_ABA[p.aba])}</button>` : ''}<button type="button" class="btn sm ghost" data-act="prEditar" data-id="${esc(p.id)}">Editar</button></div></div></article>`; }).join('')}</div>`;
}
function vTela() {
  if (!isAdmin()) return vazio('Só para o administrador', 'Processos e rotina é a rotina do analista.');
  const u = U(); const { b, procs } = tudo();
  if (!b.loaded || !b.rotLoaded) return carregando();
  let h = b.erro ? `<p class="err">Não foi possível ler os processos (${esc(b.erro)}).</p>` : '';
  h += abas([['rotina', 'Rotina'], ['processos', `Processos (${procs.filter(p => p.ativo).length})`]], u.aba, 'pr-aba', 'Partes de Processos e rotina');
  return h + (u.aba === 'processos' ? vProcessos() : vRotina());
}

/* ---------- ações ---------- */
function achar(id) {
  const { procs, docs } = tudo(); const i = id.lastIndexOf('_'); const p = procs.find(x => x.id === id.slice(0, i));
  return p ? tarefa(p, id.slice(i + 1), docs) : null;
}
const gravar = (t, campos) => DB.rotinaMarcar(t.id, marcar(t, campos)).catch(e => toast(e.message || 'Não foi possível salvar'));
function abrirTarefa(id) {
  const t = achar(id); if (!t) return;
  const html = `<div class="p-form">
    ${t.p.por ? `<p class="muted small m0">${esc(t.p.por)}</p>` : ''}
    ${t.passos.length ? `<div class="sel"><span>Passos</span><div class="pr-chks">${t.passos.map((s, i) => `<label class="tr-del tr-ok"><input type="checkbox" data-prp="${i}" ${s.ok ? 'checked' : ''}> ${esc(s.t)}</label>`).join('')}</div></div>` : ''}
    <label class="sel"><span>Situação</span><select class="in" id="prSt">${Object.entries(ESTADO).map(([k, n]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <label class="sel"><span>Observação (opcional)</span><textarea class="in" id="prObs" rows="3" maxlength="${LIMITES.obs}" placeholder="O que ficou pendente, com quem foi conferido">${esc(t.obs)}</textarea></label></div>`;
  formSheet(t.titulo, `${esc(t.p.id)} · ${esc(CONJ[t.p.conj] || '')} · ${esc(diaNome(t.data))}`, html, 'Salvar', async () => {
    const passos = t.passos.map((x, i) => !!(document.querySelector(`[data-prp="${i}"]`) || {}).checked);
    let status = v$('prSt');
    if (status === t.status) status = statusPelosPassos(passos, t.status); // mexeu só nos passos: a situação acompanha
    await DB.rotinaMarcar(t.id, marcar(t, { status, passos, obs: v$('prObs') }));
    toast(status === 'feita' ? 'Rotina feita' : 'Rotina salva'); render();
  });
}
function editarProcesso(id) {
  const { procs } = tudo(); const p = id ? procs.find(x => x.id === id) : null; if (id && !p) return;
  const x = p || { id: proximoId(procs), nome: '', conj: 'coq', prio: 'media', freq: 'demanda', dia: 1, passos: [], por: '', dikma: '', arcelor: '', ativo: true, aba: '', novo: true };
  const op = (obj, val) => Object.entries(obj).map(([k, n]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const html = `<div class="p-form">
    <label class="sel"><span>Nome do processo</span><input class="in" id="ppNome" maxlength="${LIMITES.nome}" value="${esc(x.nome)}"></label>
    <div class="row2"><label class="sel"><span>Frequência</span><select class="in" id="ppFreq">${op(FREQ, x.freq)}</select></label><label class="sel"><span>Dia (semanal)</span><select class="in" id="ppDia">${op(DIAS, x.dia || 1)}</select></label></div>
    <div class="row2"><label class="sel"><span>Onde</span><select class="in" id="ppConj">${op(CONJ, x.conj)}</select></label><label class="sel"><span>Prioridade</span><select class="in" id="ppPrio">${op(PRIO, x.prio)}</select></label></div>
    <label class="sel"><span>Passos (um por linha)</span><textarea class="in" id="ppPassos" rows="5">${esc(x.passos.join('\n'))}</textarea></label>
    <label class="sel"><span>Por quê? · objetivo do processo</span><input class="in" id="ppPor" maxlength="${LIMITES.por}" value="${esc(x.por || '')}"></label>
    <div class="row2"><label class="sel"><span>Responsáveis Dikma</span><input class="in" id="ppDik" maxlength="${LIMITES.pessoas}" value="${esc(x.dikma || '')}" placeholder="Nomes ou funções"></label><label class="sel"><span>Responsáveis Arcelor</span><input class="in" id="ppArc" maxlength="${LIMITES.pessoas}" value="${esc(x.arcelor || '')}" placeholder="Nomes ou funções"></label></div>
    <label class="sel"><span>Atalho para a aba</span><select class="in" id="ppAba">${op(ABAS, x.aba || '')}</select></label>
    <label class="tr-del tr-ok"><input type="checkbox" id="ppAtivo" ${x.ativo ? 'checked' : ''}> Processo ligado (desligado, não entra na rotina)</label>
    ${p ? `<label class="tr-del"><input type="checkbox" id="ppVolta"> ${p.novo ? 'Excluir este processo (o que já foi marcado fica no banco)' : 'Voltar ao padrão (passos, frequência e responsáveis como vieram do Meu painel)'}</label>` : ''}</div>`;
  formSheet(p ? `${x.id} · ${x.nome}` : 'Novo processo', 'Os passos viram a lista de cada tarefa da rotina', html, p ? 'Salvar' : 'Criar processo', async () => {
    if (p && (document.getElementById('ppVolta') || {}).checked) {
      await DB.procSalvarCfg({ itens: { [x.id]: null } }); DB.log(`Processos: ${x.id} ${p.novo ? 'excluído' : 'voltou ao padrão'}`, 'administracao'); toast(p.novo ? 'Processo excluído' : 'Processo no padrão'); render(); return;
    }
    const y = conferirProcesso({ nome: v$('ppNome'), freq: v$('ppFreq'), dia: v$('ppDia'), conj: v$('ppConj'), prio: v$('ppPrio'), passos: v$('ppPassos'), por: v$('ppPor'), dikma: v$('ppDik'), arcelor: v$('ppArc'), aba: v$('ppAba'), ativo: !!(document.getElementById('ppAtivo') || {}).checked });
    if (!p && tudo().procs.length >= LIMITES.processos) throw new Error(`No máximo ${LIMITES.processos} processos.`);
    await DB.procSalvarCfg({ itens: { [x.id]: y } });
    DB.log(`Processos: ${x.id} ${p ? 'alterado' : 'criado'} (${y.nome})`, 'administracao'); toast(p ? 'Processo salvo' : 'Processo criado'); render();
  });
}

acoes.prAbrir = (t, d) => abrirTarefa(d.id);
acoes.prMarca = (el, d) => { const t = achar(d.id); if (!t) return; const passos = d.v === 'feita' ? t.passos.map(() => true) : d.v === 'aberta' ? t.passos.map(() => false) : t.passos.map(x => x.ok); gravar(t, { status: d.v, passos }); };
acoes.prTodas = (el, d) => {
  const { procs, docs, desde } = tudo(); const l = quadro(procs, docs, TODAY, desde).naoMarcadas;
  l.forEach(t => gravar(t, { status: d.v, passos: d.v === 'feita' ? t.passos.map(() => true) : t.passos.map(x => x.ok) }));
  toast(`${l.length} rotina${l.length > 1 ? 's' : ''} marcada${l.length > 1 ? 's' : ''} como ${d.v === 'feita' ? 'feita' : 'não feita'}${l.length > 1 ? 's' : ''}`);
};
acoes.prEditar = (t, d) => editarProcesso(d.id);
acoes.prNovo = () => editarProcesso('');
// Ação avulsa de um processo (ex.: uma OM do P09): abre a ação nova das Tratativas já preenchida.
acoes.prAcao = async (el, d) => {
  const p = tudo().procs.find(x => x.id === d.id); if (!p) return;
  const TR = await import('./tratativas.js');
  TR.abrirAcao('', { titulo: '', origem: 'processos', ref: `${p.id} · ${p.nome}`.slice(0, 120), conj: p.conj, por: p.por, resp: ME.nome || '', inicio: TODAY, prazo: maisDias(TODAY, 7) });
};
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pr-aba]'); if (b) { U().aba = b.dataset.prAba; salvarUI(); render(); } });
document.addEventListener('change', e => { if (e.target && e.target.id === 'prDono') { const uid = e.target.value; const u = (DB.cache.usuarios || []).find(x => x.uid === uid); DB.procSalvarCfg({ dono: uid, donoNome: u ? u.nome || u.login || '' : '' }).then(() => toast(uid ? 'Os avisos da rotina vão para ' + (u ? u.nome : 'essa pessoa') : 'Os avisos da rotina vão para todos os administradores')); } });

export function topo() { return U().aba === 'processos' ? `<button type="button" class="btn pri" data-act="prNovo">${I.plus} Novo processo</button>` : ''; }
export const renderView = () => vTela();
