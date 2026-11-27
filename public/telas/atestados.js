// Atestados (contas/atestados.js; formulário em ui/atestado.js; banco em nucleo/data.js › atWatch).
//   RH › Atestados (ratest): o RH · Administrativo e o administrador conferem, recusam, marcam o original entregue,
//     veem o alerta do INSS, os fora do prazo, a lista do mês para a folha (Excel) e o indicador por área.
//   Operação › Efetivo › Atestados (esatest): quem lança a presença vê os atestados que ele lançou (com a foto, enquanto
//     o RH não conferiu, pode mudar e apagar) e os dias de atestado por área no mês, só em números (sem nomes).
// Atestado é dado de saúde (LGPD): o banco só entrega os detalhes e a foto ao RH, ao administrador e a quem lançou.
import * as AT from '../contas/atestados.js';
import { SETS, AREA_S, add, monthLabel, addMonth } from '../contas/cal.js';
import { competenciaDe } from '../contas/planilhas-adm.js';
import { editaAdm } from '../contas/acessos.js';
import { abrirAtestado, abrirFotoAt, baixarAtestado, registrarVista, AVISO_LGPD } from '../ui/atestado.js';
import { vazio, carregando, abas, etiqueta, tabela, dados, indicadores, botaoAcao, recolhido } from '../ui/padrao.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, TODAY, esc, title } from '../nucleo/base.js';
import { ME, UI, SK, areaScope } from '../nucleo/estado.js';
import { colabsDa, sitDia } from '../calc/presenca.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';

const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const ddmm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const rh = () => editaAdm(ME);
const U = () => (UI.at ||= { aba: 'lista', st: 'conferir', conj: '', q: '', comp: competenciaDe(TODAY), mes: TODAY.slice(0, 7), sel: null });
const base = () => { if (DB.atWatch) DB.atWatch(rh()); return DB.cache.atest || { d: {}, loaded: false }; };
const todos = () => Object.values(base().d || {}).filter(a => !a.apagado);
const cfg = () => AT.cfgAt(DB.cache.atCfg && DB.cache.atCfg.d);
const achar = id => (base().d || {})[id] || null;
const conjNome = k => (SETS[k] ? SETS[k].curto : '');
const periodo = a => (a.tipo === AT.DECLARACAO ? `${ddmm(a.ini)} · ${String(a.horas || '').replace('.', ',')} h` : a.dias > 1 ? `${ddmm(a.ini)} a ${ddmm(a.fim)} · ${a.dias} dias` : `${ddmm(a.ini)} · 1 dia`);
const etqs = a => AT.etiquetasAt(a, cfg()).map(([t, s]) => etiqueta(t, s)).join(' ');
// Quem lançou muda e apaga enquanto o RH não conferiu; o RH e o administrador, sempre.
const mexe = a => rh() || (a.por === ME.uid && AT.autorMexe(a));

/* ---------- desenho ---------- */
export function renderView(v) {
  if (v === 'ratest' && !rh()) return vazio('Só o RH · Administrativo e o administrador', 'Atestado é dado de saúde: os detalhes e a foto ficam só com o RH, o administrador e quem lançou.');
  const b = base();
  if (!b.loaded) return carregando();
  if (b.erro) return vazio('Não foi possível ler os atestados', `O servidor recusou a leitura (${b.erro}). Feche e abra o app; se continuar, avise o administrador.`);
  const u = U();
  if (u.sel) { const a = achar(u.sel); if (a) return vDetalhe(a); u.sel = null; }
  const ehRH = rh();
  const lista = ehRH ? [['lista', 'Atestados'], ['folha', 'Lista da folha'], ['ind', 'Indicador'], ['regras', 'Regras']] : [['lista', 'Os que eu lancei'], ['ind', 'Dias por área']];
  if (!lista.some(([k]) => k === u.aba)) u.aba = 'lista';
  const corpo = u.aba === 'folha' ? vFolha() : u.aba === 'ind' ? (ehRH ? vIndicadorRH() : vIndicadorArea()) : u.aba === 'regras' ? vRegras() : vLista(ehRH);
  return `<p class="aviso small" role="note">${I.pend || ''} ${esc(AVISO_LGPD)}</p>
    ${abas(lista, u.aba, 'at-aba', 'Atestados')}
    ${corpo}`;
}

function vLista(ehRH) {
  const u = U(); const c = cfg(); const l = todos();
  const n = AT.contagensAt(l, c);
  const inss = ehRH ? AT.alertasINSS(l, TODAY, c) : [];
  const fs = [['conferir', 'A conferir', n.conferir], ['semfoto', 'Sem foto', n.semfoto], ['prazo', 'Fora do prazo', n.prazo], ['recusado', 'Recusados', n.recusado], ['conferido', 'Conferidos', null], ['', 'Todos', null]];
  const f = AT.filtrarAt(l, { st: u.st, conj: u.conj, q: u.q, comp: ehRH && u.st === 'conferido' ? u.comp : '' }, c);
  let h = '';
  if (inss.length) h += `<div class="card at-inss"><div class="body stackcol"><b>${I.pend || ''} Encaminhar ao INSS: ${inss.length} pessoa${inss.length > 1 ? 's' : ''}</b><p class="muted small m0">Os atestados somam mais de ${c.inssDias} dias nos últimos ${c.inssJanela} dias (cada dia conta uma vez; recusados e declarações não contam).</p>
    <ul class="at-inss-l">${inss.map(p => `<li><b>${esc(title(p.nome))}</b>${p.mat ? ` <span class="muted mono small">${esc(p.mat)}</span>` : ''} · <span class="num">${p.dias}</span> dias (${ddmm(p.de)} a ${ddmm(p.ate)})</li>`).join('')}</ul></div></div>`;
  h += `<div class="card"><div class="body lbar"><div class="rchips">${fs.map(([k, t, q]) => `<button type="button" class="rchip" data-at-st="${k}" aria-pressed="${u.st === k}">${t}${q != null ? ` <span class="num">${q}</span>` : ''}</button>`).join('')}</div>
    ${ehRH ? `<label class="sel"><span>Conjunto</span><select class="in" id="atConj"><option value="">Todos</option>${['patio', 'bateria', 'sinter'].map(k => `<option value="${k}" ${u.conj === k ? 'selected' : ''}>${conjNome(k)}</option>`).join('')}</select></label>
    <label class="sel"><span>Buscar</span><input class="in" type="search" id="atQ" value="${esc(u.q)}" placeholder="Nome ou matrícula" autocomplete="off"></label>` : ''}
    ${ehRH && u.st === 'conferido' ? `<label class="sel"><span>Competência</span>${selComp('atCompL', u.comp)}</label>` : ''}</div></div>`;
  if (!f.length) return h + vazio(u.st === 'conferir' ? 'Nenhum atestado a conferir' : 'Nenhum atestado aqui', ehRH ? 'Os atestados chegam quando o líder lança AT na Escala do dia.' : 'Lance o atestado na Escala do dia: toque no nome, escolha Atestado e junte a foto.');
  const cel = isMobile();
  const nome = a => `<button type="button" class="btn ghost link" data-act="atAbrir" data-id="${esc(a.id)}">${esc(title(a.nome))}</button>`;
  const colunas = cel ? [{ t: 'Atestado' }, { t: 'Situação' }] : [{ t: 'Colaborador' }, { t: 'Período' }, { t: 'Tipo' }, { t: 'Lançado' }, { t: 'Situação' }];
  const linhas = f.slice(0, 300).map(a => (cel
    ? [`${nome(a)}<div class="muted small">${periodo(a)} · ${esc(a.tipo)}</div>`, etqs(a)]
    : [`${nome(a)}<div class="muted small">${a.mat ? `<span class="mono">${esc(a.mat)}</span> · ` : ''}${esc(AREA_S[a.area] || a.area || '')}${a.conj ? ' · ' + conjNome(a.conj) : ''}</div>`, periodo(a), esc(a.tipo), `${ddmm(a.diaLanc)}<div class="muted small">${esc(title(a.porNome || ''))}</div>`, etqs(a)]));
  return h + `<p class="muted small">${f.length} atestado${f.length > 1 ? 's' : ''}</p>` + tabela(colunas, linhas, { rotulo: 'Atestados' });
}

function selComp(id, atual) {
  const l = []; for (let i = -1; i <= 12; i++) l.push(addMonth(competenciaDe(TODAY), -i));
  return `<select class="in" id="${id}">${l.map(c => `<option value="${c}" ${c === atual ? 'selected' : ''}>${monthLabel(c)} (16/${add(c + '-01', -1).slice(5, 7)} a 15/${c.slice(5, 7)})</option>`).join('')}</select>`;
}

// Detalhe: os dados, as fotos (tocar abre e fica registrado quem abriu) e o que cada um pode fazer.
function vDetalhe(a) {
  const ehRH = rh(); const c = cfg(); const pode = mexe(a);
  const fotos = (a.minis || []).map((m, i) => `<div class="sgfth"><button type="button" class="at-ftb" data-act="atFoto" data-id="${esc(a.id)}" data-i="${i}" aria-label="Abrir a foto ${i + 1} do atestado"><img src="${m}" alt=""></button>${pode ? `<button type="button" class="btn sm ghost" data-act="atFotoX" data-id="${esc(a.id)}" data-i="${i}" aria-label="Apagar a foto ${i + 1}">✕</button>` : ''}</div>`).join('');
  const lim = a.emis ? AT.limiteEntrega(a.emis, c) : '';
  const info = dados([
    ['Colaborador', `${esc(title(a.nome))}${a.mat ? ` <span class="muted mono small">${esc(a.mat)}</span>` : ''}`],
    ['Área', `${esc(AREA_S[a.area] || a.area || '')}${a.conj ? ' · ' + conjNome(a.conj) : ''}`],
    ['Tipo', esc(a.tipo)], ['Período', periodo(a)], ['Emissão', dBR(a.emis)],
    ['Lançado', `${dBR(a.diaLanc)} por ${esc(title(a.porNome || ''))}${lim ? ` <span class="muted small">· prazo até ${dBR(lim)}</span>` : ''}${AT.foraDoPrazo(a, c) ? ' ' + etiqueta('Fora do prazo', 'critico') : ''}`],
    ['Observação', a.obs ? esc(a.obs) : a.fotosApagadasEm ? '<span class="muted">Apagada pelo prazo da LGPD</span>' : ''],
    ['Situação', etqs(a)],
    ...(a.st === 'recusado' && a.motRec ? [['Motivo da recusa', esc(a.motRec)]] : []),
    ...(a.confNome ? [['Conferido por', `${esc(title(a.confNome))}${a.confEm ? ` <span class="muted small">· ${new Date(a.confEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>` : ''}`]] : [])
  ]);
  const bt = [];
  if (ehRH && a.st !== 'conferido') bt.push(botaoAcao('Conferir', `data-act="atConferir" data-id="${esc(a.id)}"`, I.ok || ''));
  if (ehRH && a.st !== 'recusado') bt.push(`<button class="btn" data-act="atRecusar" data-id="${esc(a.id)}">Recusar</button>`);
  if (ehRH && a.st === 'conferido') bt.push(`<button class="btn" data-act="atOrig" data-id="${esc(a.id)}">${a.orig ? 'Desmarcar original' : 'Original entregue'}</button>`, `<button class="btn ghost" data-act="atReabrir" data-id="${esc(a.id)}">Voltar para a conferir</button>`);
  if (pode) bt.push(`<button class="btn" data-act="atEditar" data-id="${esc(a.id)}">${a.st === 'recusado' && !ehRH ? 'Corrigir e reenviar' : 'Editar'}${(a.nf || 0) < AT.LIM.fotos ? ' / juntar foto' : ''}</button>`);
  if (pode) bt.push(`<button class="btn ghost" data-act="atApagar" data-id="${esc(a.id)}">Apagar</button>`);
  return `<div class="row-gap"><button class="btn" data-act="atVoltar">← Atestados</button></div>
  <div class="card"><div class="body stackcol">
    <h2 class="p-t2">Atestado · ${esc(title(a.nome))}</h2>
    ${info}
    <div><span class="ag-rot">Foto do atestado</span>${fotos ? `<div class="sgfotos">${fotos}</div><div class="row-gap"><button type="button" class="btn sm" data-act="atBaixar" data-id="${esc(a.id)}">${I.dl} Baixar o atestado</button></div><p class="muted small m0">Tocar abre a foto; quem abre ou baixa fica registrado (Administração › LGPD).</p>` : `<p class="muted small m0">${a.fotosApagadasEm ? 'A foto saiu pelo prazo da LGPD (12 meses depois do último dia).' : 'Sem foto ainda.'}</p>`}</div>
    ${!pode && a.por === ME.uid ? '<p class="muted small m0">Já foi conferido pelo RH: só o RH muda agora.</p>' : ''}
    ${bt.length ? `<div class="row-gap">${bt.join('')}</div>` : ''}
  </div></div>`;
}

// Lista do mês para a folha (competência 16 a 15) e o Excel.
function vFolha() {
  const u = U(); const l = AT.folhaDaCompetencia(todos(), u.comp, u.conj);
  const tot = l.reduce((n, r) => n + r.diasComp, 0);
  let h = `<div class="card"><div class="body lbar"><label class="sel"><span>Competência</span>${selComp('atComp', u.comp)}</label>
    <label class="sel"><span>Conjunto</span><select class="in" id="atConj"><option value="">Todos</option>${['patio', 'bateria', 'sinter'].map(k => `<option value="${k}" ${u.conj === k ? 'selected' : ''}>${conjNome(k)}</option>`).join('')}</select></label>
    ${l.length ? `<button class="btn" data-act="atExcel">${I.dl} Baixar Excel</button>` : ''}</div></div>`;
  if (!l.length) return h + vazio('Nenhum atestado nesta competência', 'A lista mostra os dias de atestado que caem de 16 a 15.');
  h += `<p class="muted small">${l.length} atestado${l.length > 1 ? 's' : ''} · <b class="num">${tot}</b> dias na competência · ${l.filter(r => r.st === 'conferir').length} ainda a conferir</p>`;
  return h + tabela([{ t: 'Colaborador' }, { t: 'Matrícula' }, { t: 'Período' }, { t: 'Dias na competência', n: true }, { t: 'Tipo' }, { t: 'Situação' }],
    l.map(r => [`<button type="button" class="btn ghost link" data-act="atAbrir" data-id="${esc(r.id)}">${esc(title(r.nome))}</button>`, `<span class="mono">${esc(r.mat || '—')}</span>`, `${ddmm(r.de)}${r.ate !== r.de ? ' a ' + ddmm(r.ate) : ''}`, r.tipo === AT.DECLARACAO ? `${String(r.horas || '').replace('.', ',')} h` : String(r.diasComp), esc(r.tipo), etiqueta(AT.ST[r.st], AT.ST_COR[r.st]) + (r.st === 'conferido' ? ' ' + etiqueta(r.orig ? 'Original' : 'Sem original', r.orig ? 'ok' : 'info') : '')]),
    { rotulo: 'Lista da folha' });
}
function excelFolha() {
  const u = U(); const l = AT.folhaDaCompetencia(todos(), u.comp, u.conj);
  const linhas = [['Nome', 'Matrícula', 'Conjunto', 'Área', 'Tipo', 'Primeiro dia', 'Último dia', 'Dias do atestado', 'Dias na competência', 'Horas (declaração)', 'Emissão', 'Situação', 'Original entregue']];
  for (const r of l) linhas.push([title(r.nome), r.mat, conjNome(r.conj), AREA_S[r.area] || r.area, r.tipo, dataBR(r.ini), dataBR(r.fim), r.dias, r.diasComp, r.horas || '', dataBR(r.emis), AT.ST[r.st], r.st === 'conferido' ? (r.orig ? 'Sim' : 'Não') : '']);
  // sem a observação: a planilha sai do sistema e não deve levar texto de saúde
  baixarExcel(`atestados-folha-${u.comp}${u.conj ? '-' + u.conj : ''}`, [{ nome: 'Atestados ' + u.comp, linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}

// Indicador do RH: atestados e dias por área no mês (sem nomes) e a tendência dos últimos 6 meses.
function vIndicadorRH() {
  const u = U(); const l = todos().filter(a => !u.conj || a.conj === u.conj); const r = AT.resumoPorArea(l, u.mes);
  const meses = []; for (let i = 5; i >= 0; i--) meses.push(addMonth(u.mes, -i));
  const serie = AT.diasPorMes(l, meses); const tot = r.reduce((n, x) => n + x.dias, 0);
  const sel = `<div class="card"><div class="body lbar"><label class="sel"><span>Mês</span><select class="in" id="atMes">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => addMonth(TODAY.slice(0, 7), -i)).map(m => `<option value="${m}" ${m === u.mes ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></label>
    <label class="sel"><span>Conjunto</span><select class="in" id="atConj"><option value="">Todos</option>${['patio', 'bateria', 'sinter'].map(k => `<option value="${k}" ${u.conj === k ? 'selected' : ''}>${conjNome(k)}</option>`).join('')}</select></label></div></div>`;
  const ind = indicadores([
    { rotulo: 'Dias de atestado', valor: String(tot), serie },
    { rotulo: 'Atestados', valor: String(r.reduce((n, x) => n + x.atestados, 0)) },
    { rotulo: 'Pessoas', valor: String(r.reduce((n, x) => n + x.pessoas, 0)) },
    { rotulo: 'Declarações', valor: String(r.reduce((n, x) => n + x.declaracoes, 0)) }]);
  if (!r.length) return sel + ind + vazio('Nenhum atestado neste mês', 'Recusados não contam.');
  return sel + ind + tabela([{ t: 'Área' }, { t: 'Atestados', n: true }, { t: 'Dias', n: true }, { t: 'Pessoas', n: true }, { t: 'Declarações', n: true }],
    r.map(x => [esc(AREA_S[x.area] || x.area), String(x.atestados), String(x.dias), String(x.pessoas), String(x.declaracoes)]), { rotulo: 'Atestados por área' })
    + `<p class="muted small">Mês civil (1º ao último dia). Para a folha, use a Lista da folha (16 a 15).</p>`;
}
// Indicador da Operação: dias com AT na Presença, por área, no mês e nas áreas do filtro. Só números, sem nomes.
function vIndicadorArea() {
  const area = areaScope(); const m = UI.mes || TODAY.slice(0, 7);
  const por = new Map();
  for (let d = m + '-01'; d.slice(0, 7) === m && d <= TODAY; d = add(d, 1)) for (const c of colabsDa(area)) {
    if (sitDia(c, d).v !== 'AT') continue;
    const k = c.area; if (!por.has(k)) por.set(k, { dias: 0, pessoas: new Set() });
    const x = por.get(k); x.dias++; x.pessoas.add(c.id);
  }
  const l = [...por.entries()].map(([a, x]) => ({ area: a, dias: x.dias, pessoas: x.pessoas.size })).sort((a, b) => b.dias - a.dias);
  const h = `<p class="muted small">${monthLabel(m)} · ${area === 'TODAS' ? 'todas as áreas' : esc(AREA_S[area] || area)} · ${esc(SETS[SK].nome)} · dias com AT na Escala do dia, sem nomes</p>`;
  if (!l.length) return h + vazio('Nenhum dia de atestado neste mês', '');
  return h + indicadores([{ rotulo: 'Dias de atestado', valor: String(l.reduce((n, x) => n + x.dias, 0)) }, { rotulo: 'Pessoas', valor: String(l.reduce((n, x) => n + x.pessoas, 0)) }])
    + tabela([{ t: 'Área' }, { t: 'Dias', n: true }, { t: 'Pessoas', n: true }], l.map(x => [esc(AREA_S[x.area] || x.area), String(x.dias), String(x.pessoas)]), { rotulo: 'Dias de atestado por área' });
}

function vRegras() {
  const c = cfg();
  return `<div class="card"><div class="body stackcol">
    <h2 class="p-t2">Regras dos atestados</h2>
    <div class="row2"><label class="sel"><span>Prazo de entrega (horas depois da emissão)</span><input class="in" type="number" id="atPrazo" min="12" max="720" step="12" value="${c.prazoH}"></label></div>
    <p class="muted small m0">${c.prazoH} h = lançado até ${Math.ceil(c.prazoH / 24)} dia${Math.ceil(c.prazoH / 24) > 1 ? 's' : ''} depois do dia da emissão. Depois disso, aparece "Fora do prazo".</p>
    <div class="row2"><label class="sel"><span>Alerta do INSS: mais de (dias)</span><input class="in" type="number" id="atInssD" min="1" max="60" value="${c.inssDias}"></label>
      <label class="sel"><span>dentro dos últimos (dias)</span><input class="in" type="number" id="atInssJ" min="7" max="365" value="${c.inssJanela}"></label></div>
    <p class="muted small m0">Padrão: mais de 15 dias em 60 (a partir do 16º dia, quem paga é o INSS). Cada dia conta uma vez.</p>
    ${recolhido('Quem vê o quê (LGPD)', '<ul class="small m0"><li><b>Foto, tipo e observação:</b> RH · Administrativo, administrador e quem lançou.</li><li><b>Supervisor, coordenador e gestor:</b> só o código AT e os dias na Escala do dia.</li><li><b>Cliente (somente leitura):</b> só o código AT.</li><li>Cada abertura da foto fica registrada (Administração › LGPD).</li><li>A foto e a observação saem 12 meses depois do último dia (tela de descarte da LGPD). As datas e os dias ficam.</li></ul>')}
    <div class="row-gap">${botaoAcao('Salvar regras', 'data-act="atRegras"')}</div>
  </div></div>`;
}

/* ---------- ações ---------- */
const sel = id => { U().sel = id; render(); window.scrollTo(0, 0); };
acoes.atAbrir = (t, d) => sel(d.id);
acoes.atVoltar = () => { U().sel = null; render(); };
acoes.atBaixar = (t, d) => { const a = achar(d.id); if (a) baixarAtestado(a, rh()); };
acoes.atFoto = (t, d) => { const a = achar(d.id); if (a) abrirFotoAt(a, +d.i, rh()); };
acoes.atFotoX = async (t, d) => {
  const a = achar(d.id); if (!a || !mexe(a)) return;
  formSheet('Apagar a foto', esc(title(a.nome)), '<p class="m0">A foto sai do sistema. Não dá para desfazer.</p>', 'Apagar a foto', async () => {
    const l = await DB.atFotos(a.id, rh()); const i = +d.i; const f = l[i];
    const minis = (a.minis || []).filter((m, j) => j !== i);
    await DB.atApagarFoto(a.id, f ? f.id : '', { minis, nf: minis.length });
    DB.log(`Atestado: foto apagada (${title(a.nome)} · ${ddmm(a.ini)})`, rh() ? 'rh' : 'operacao'); toast('Foto apagada'); render();
  });
};
acoes.atEditar = (t, d) => {
  const a = achar(d.id); if (!a || !mexe(a)) return;
  // Pela Escala do dia o lançamento também ajusta os dias na Presença; aqui só o atestado (os dias da Presença ficam).
  abrirAtestado({ c: { id: a.cid, area: a.area, nome: a.nome, mat: a.mat }, conj: a.conj, dt: a.ini, atual: a, rh: rh(), aoSalvar: (x, it, antes) => {
    if (antes && (antes.ini !== it.ini || antes.dias !== it.dias)) toast('Atestado salvo · confira os dias de AT na Escala do dia');
    else toast(a.st === 'recusado' ? 'Reenviado ao RH' : 'Atestado salvo');
    render();
  } });
};
acoes.atApagar = (t, d) => {
  const a = achar(d.id); if (!a || !mexe(a)) return;
  formSheet('Apagar o atestado', esc(title(a.nome)), '<p class="m0">Apaga o atestado e as fotos. O código AT na Escala do dia continua: se a pessoa não faltou, troque lá.</p>', 'Apagar', async () => {
    const l = await DB.atFotos(a.id, rh());
    await DB.atApagar(a.id, l.map(f => f.id)); U().sel = null;
    DB.log(`Atestado apagado (${title(a.nome)} · ${ddmm(a.ini)})`, rh() ? 'rh' : 'operacao'); toast('Atestado apagado'); render();
  });
};
const conf = (a, patch, msg) => DB.atSalvar(a.id, patch).then(() => { toast(msg); render(); }, e => toast(e && e.code === 'permission-denied' ? 'Sem permissão' : 'Não foi possível salvar agora'));
acoes.atConferir = (t, d) => {
  const a = achar(d.id); if (!a || !rh()) return;
  formSheet('Conferir o atestado', `${esc(title(a.nome))} · ${periodo(a)}`, `${(a.minis || []).length ? '' : '<p class="aviso small">Este atestado está sem foto.</p>'}<label class="ag-op"><input type="checkbox" id="atOrigC" ${a.orig ? 'checked' : ''}> O original já foi entregue ao RH</label>`, 'Conferir', async () => {
    const orig = !!(/** @type {any} */ (document.getElementById('atOrigC')) || {}).checked;
    registrarVista(a);
    await conf(a, { st: 'conferido', motRec: '', orig, confPor: ME.uid, confNome: ME.nome || ME.login || '', confEm: new Date().toISOString() }, 'Atestado conferido');
    DB.log(`Atestado conferido (${title(a.nome)} · ${ddmm(a.ini)})`, 'rh');
  });
};
acoes.atRecusar = (t, d) => {
  const a = achar(d.id); if (!a || !rh()) return;
  formSheet('Recusar o atestado', `${esc(title(a.nome))} · ${periodo(a)}`, `<label class="sel"><span>Motivo (vai para quem lançou)</span><textarea class="in" id="atMot" rows="3" maxlength="300" placeholder="Ex.: foto ilegível, data errada, falta a assinatura do médico"></textarea></label>`, 'Recusar', async () => {
    const m = String((/** @type {any} */ (document.getElementById('atMot')) || {}).value || '').replace(/\s+/g, ' ').trim();
    if (m.length < 3) throw new Error('Escreva o motivo da recusa.');
    await conf(a, { st: 'recusado', motRec: m.slice(0, 300), orig: false, confPor: ME.uid, confNome: ME.nome || ME.login || '', confEm: new Date().toISOString() }, 'Atestado recusado');
    DB.log(`Atestado recusado (${title(a.nome)} · ${ddmm(a.ini)})`, 'rh');
  });
};
acoes.atOrig = (t, d) => { const a = achar(d.id); if (a && rh()) conf(a, { orig: !a.orig }, a.orig ? 'Original desmarcado' : 'Original entregue'); };
acoes.atReabrir = (t, d) => { const a = achar(d.id); if (a && rh()) conf(a, { st: 'conferir', orig: false }, 'Voltou para a conferir'); };
acoes.atExcel = () => excelFolha();
acoes.atRegras = () => {
  if (!rh()) return; const v = id => Math.round(+(/** @type {any} */ (document.getElementById(id)) || {}).value || 0);
  const c = AT.cfgAt({ prazoH: v('atPrazo'), inssDias: v('atInssD'), inssJanela: v('atInssJ') });
  DB.atCfgSalvar(c).then(() => { toast('Regras salvas'); render(); }, () => toast('Não foi possível salvar as regras agora'));
  DB.log(`Atestados: regras (prazo ${c.prazoH} h, INSS mais de ${c.inssDias} dias em ${c.inssJanela})`, 'rh');
};
// Abre um atestado vindo de outra tela (ficha do colaborador).
export function abrirDe(id) { U().sel = id; }

document.addEventListener('click', e => {
  const t = /** @type {any} */ (e.target);
  if (!['ratest', 'esatest'].includes(UI.view)) return;
  const ab = t.closest('[data-at-aba]'); if (ab) { U().aba = ab.dataset.atAba; U().sel = null; render(); return; }
  const st = t.closest('[data-at-st]'); if (st) { U().st = st.dataset.atSt; render(); }
});
document.addEventListener('change', e => {
  const t = /** @type {any} */ (e.target); if (!['ratest', 'esatest'].includes(UI.view)) return;
  const u = U();
  if (t.id === 'atConj') { u.conj = t.value; render(); }
  if (t.id === 'atComp' || t.id === 'atCompL') { u.comp = t.value; render(); }
  if (t.id === 'atMes') { u.mes = t.value; render(); }
});
let tq = 0;
document.addEventListener('input', e => {
  const t = /** @type {any} */ (e.target); if (t.id !== 'atQ' || !['ratest', 'esatest'].includes(UI.view)) return;
  clearTimeout(tq); tq = setTimeout(() => { U().q = t.value; render(); }, 250);
});
