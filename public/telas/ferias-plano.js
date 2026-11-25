// Dikma Gestão — RH › Férias: controle mensal e planejamento das férias (contas/ferias-plano.js).
// Três abas: Mês (quem sai no mês, por área e turma, com etapa, aviso e substituto; PDF e Excel da programação),
// Plano do ano (12 meses: saídas, pico no mesmo dia, planejadas sem data, limites e, por área, quantos saem) e
// Pendências (limite vencido ou chegando sem férias marcadas, aviso de 30 dias, sem substituto, turma com gente demais).
// O formulário das férias é o mesmo da ficha (administrativo.js › formFerias). O máximo de pessoas da mesma área e
// turma de férias ao mesmo tempo fica em adm/feriasRegras { maxTurma } (RH Administrativo e administrador mudam).
import { DB, esc, title, TODAY, framed } from '../nucleo/base.js';
import { UI, meEm } from '../nucleo/estado.js';
import { PES, carregarModulo } from '../nucleo/modulos.js';
import { editaAdm } from '../contas/acessos.js';
import { AREA_GERAL } from '../contas/pessoas.js';
import { indiceFeriasPessoa } from '../contas/ferias.js';
import { UNIDADES, unidadeDe } from '../contas/colab-rh.js';
import { quadroDoMes, conflitosDoMes, pendenciasFerias, planoDoAno, pessoaDoPeriodo, turmaCurta, nomeMes, mesCurto, somarMeses, mesSugerido, MAX_TURMA_PADRAO } from '../contas/ferias-plano.js';
import { abas, etiqueta, tabela, vazio, carregando, indicadores } from '../ui/padrao.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';
import { imprimirRelatorio, agoraTxt } from '../ui/indicadores-acoes.js';

const F = UI.fp || (UI.fp = { aba: 'mes', mes: TODAY.slice(0, 7), fa: '', un: '' });
const $ = id => document.getElementById(id);
const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const ddmm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const lista = () => ((DB.cache.adm && DB.cache.adm.rhLoaded) ? DB.cache.adm.rh : []) || [];
const ferias = () => ((DB.cache.adm && DB.cache.adm.ferias) || []).filter(f => !f.apagado);
const pronto = () => !!(DB.cache.adm && DB.cache.adm.rhLoaded && DB.cache.adm.fLoaded);
const edita = () => editaAdm(meEm('rh'));
const maxTurma = () => { const r = DB.cache.adm && DB.cache.adm.regras; const n = r && +r.maxTurma; return n >= 1 ? n : MAX_TURMA_PADRAO; };
const comForm = fn => carregarModulo('AD').then(m => { if (m) fn(m); });

// Contexto das contas (refeito só quando o cadastro ou as férias mudam).
let CX = null, CXk = [];
function ctx() {
  const L = lista(), FL = (DB.cache.adm && DB.cache.adm.ferias) || [];
  if (CX && CXk[0] === L && CXk[1] === FL && CXk[2] === TODAY) return CX;
  const lot = PES.lotacoes(L); const idx = indiceFeriasPessoa(FL, L); const achar = pessoaDoPeriodo(L);
  const grupoDe = (p, f) => {
    if (!p) return { area: '', areaNome: f && f.setor ? title(f.setor) : 'Sem cadastro', turma: '', un: unidadeDe({ setor: f && f.setor }) };
    const l = lot.get(String(p.mat)) || {}; const area = l.area || p.area || AREA_GERAL;
    const turma = turmaCurta(p.turma || (l.patio && l.patio.turma) || (l.op && l.op.turma) || '');
    return { area, areaNome: PES.areaNome(area), turma, un: unidadeDe(p, area) };
  };
  CX = { L, achar, grupoDe, feriasDe: c => idx(c).filter(f => !f.apagado) }; CXk = [L, FL, TODAY];
  return CX;
}
const daArea = g => (!F.fa || (g && g.area) === F.fa) && (!F.un || (g && g.un) === F.un);
const nomePessoa = (p, f) => title((p && p.nome) || f.nome || '');
const linkFicha = (p, f) => (p ? `<button type="button" class="btn ghost link" data-act="fpFicha" data-mat="${esc(p.mat)}">${esc(nomePessoa(p, f))}</button>` : `<b>${esc(nomePessoa(p, f))}</b> <span class="muted small">sem cadastro</span>`);
const turmaTxt = g => [g.areaNome, g.turma ? `turma ${g.turma}` : ''].filter(Boolean).join(' · ');

function pendencias() {
  const c = ctx();
  return pendenciasFerias({ cadastro: c.L, ferias: ferias(), hoje: TODAY, feriasDe: c.feriasDe, grupoDe: c.grupoDe, achar: c.achar, max: maxTurma() })
    .filter(x => (x.tipo === 'conflito' ? daArea(x.g) : daArea(c.grupoDe(x.p, x.f))));
}

export function vFerias() {
  if (!pronto()) return carregando();
  const c = ctx();
  const areas = [...new Set(c.L.filter(p => (!p.dem || p.dem > TODAY) && (!F.un || c.grupoDe(p).un === F.un)).map(p => c.grupoDe(p).area))].sort((a, b) => PES.areaNome(a).localeCompare(PES.areaNome(b)));
  if (F.fa && !areas.includes(F.fa)) F.fa = '';
  const P = pendencias();
  const mesHoje = TODAY.slice(0, 7);
  const doMesAtual = quadroDoMes({ ferias: ferias(), mes: mesHoje, achar: c.achar, grupoDe: c.grupoDe, hoje: TODAY }).filter(l => daArea(l.g));
  const agora = doMesAtual.filter(l => l.etapa.k === 'gozo').length;
  const saem = doMesAtual.filter(l => l.f.inicio && l.f.inicio.slice(0, 7) === mesHoje).length;
  const nLim = P.filter(x => ['vencido', 'lim30', 'lim60', 'depoisLimite'].includes(x.tipo)).length;
  const nAviso = P.filter(x => x.tipo === 'aviso').length;
  const topo = indicadores([
    { rotulo: 'De férias hoje', valor: String(agora) },
    { rotulo: `Saem em ${mesCurto(mesHoje)}`, valor: String(saem) },
    { rotulo: 'Limite vencido ou em 60 dias', valor: String(nLim), situacao: nLim ? 'critico' : 'ok' },
    { rotulo: 'Avisos a entregar', valor: String(nAviso), situacao: nAviso ? 'atencao' : 'ok' }]);
  const filtro = `<div class="p-form co-filtros"><label class="p-campo"><span>Unidade</span><select id="fpUn"><option value="">Todas</option>${UNIDADES.map(u => `<option value="${u}" ${F.un === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label><label class="p-campo"><span>Área de atuação</span><select id="fpFa"><option value="">Todas as áreas</option>${areas.map(a => `<option value="${esc(a)}" ${F.fa === a ? 'selected' : ''}>${esc(PES.areaNome(a))}</option>`).join('')}</select></label>
    <div class="fp-max"><p class="m0 small"><b>Máximo por turma:</b> ${maxTurma()} ${maxTurma() === 1 ? 'pessoa' : 'pessoas'} da mesma área e turma de férias ao mesmo tempo</p>${edita() ? '<button type="button" class="btn sm ghost" data-act="fpMax">Alterar</button>' : ''}</div></div>`;
  const aba = ['mes', 'ano', 'pend'].includes(F.aba) ? F.aba : 'mes';
  const corpo = aba === 'ano' ? vAno() : aba === 'pend' ? vPend(P) : vMes();
  return `${topo}<div class="card"><div class="body stackcol">${filtro}
    ${abas([['mes', 'Mês'], ['ano', 'Plano do ano'], ['pend', `Pendências (${P.length})`]], aba, 'fp-aba', 'Férias')}
    ${corpo}</div></div>`;
}

// ---- Mês ----
function linhasDoMes(mes) { const c = ctx(); return quadroDoMes({ ferias: ferias(), mes, achar: c.achar, grupoDe: c.grupoDe, hoje: TODAY }).filter(l => daArea(l.g)); }
const avisoTxt = l => (!l.f.inicio ? '' : l.f.avisoEm ? `Entregue ${ddmm(l.f.avisoEm)}` : ['gozo', 'gozada'].includes(l.etapa.k) ? '' : `Até ${ddmm(l.aviso)}${l.aviso < TODAY ? ' (atrasado)' : ''}`);
const periodoTxt = l => (l.f.inicio ? `<span class="nowrap">${ddmm(l.f.inicio)} a ${ddmm(l.termino)}</span>${l.f.dias ? `<span class="muted small fp-dias">${l.f.dias} dias</span>` : ''}` : '<span class="muted">Sem data</span>');

function vMes() {
  const mes = F.mes || TODAY.slice(0, 7); const ls = linhasDoMes(mes);
  const conf = conflitosDoMes(ls, mes, maxTurma());
  const nav = `<div class="row-gap fp-nav"><button type="button" class="btn sm" data-act="fpMes" data-d="-1" aria-label="Mês anterior">‹</button><b>${esc(nomeMes(mes))}</b><button type="button" class="btn sm" data-act="fpMes" data-d="1" aria-label="Próximo mês">›</button>${mes !== TODAY.slice(0, 7) ? '<button type="button" class="btn sm ghost" data-act="fpMes" data-d="0">Mês atual</button>' : ''}
    ${!framed ? `<span class="fp-acoes"><button type="button" class="btn sm" data-act="fpPdf">${I.dl} Programação do mês (PDF)</button><button type="button" class="btn sm ghost" data-act="fpXls">${I.dl} Excel</button></span>` : ''}</div>`;
  let h = nav;
  if (conf.length) h += `<div class="aviso"><b>Turma com gente demais de férias</b> (máximo ${maxTurma()}):<ul class="m0">${conf.map(x => `<li>${esc(turmaTxt(x.g))}: ${x.pico} ao mesmo tempo (${x.nomes.map(n => esc(title(n))).join(', ')})</li>`).join('')}</ul></div>`;
  if (!ls.length) return h + vazio('Ninguém de férias neste mês', 'Troque o mês ou a área, ou planeje em Pendências.');
  const cel = isMobile();
  const etq = l => etiqueta(l.etapa.t, l.etapa.s);
  const ab = l => `<button type="button" class="btn ghost link" data-act="fpAbrir" data-id="${esc(l.f.id)}">${periodoTxt(l)}</button>`;
  const colunas = cel ? [{ t: 'Colaborador' }, { t: 'Etapa' }] : [{ t: 'Colaborador' }, { t: 'Área · turma' }, { t: 'Período' }, { t: 'Retorno' }, { t: 'Aviso (30 dias)' }, { t: 'Substituto' }, { t: 'Etapa' }];
  const linhas = ls.map(l => (cel
    ? [`${linkFicha(l.p, l.f)}<div class="muted small">${esc(turmaTxt(l.g))}</div><div class="small">${ab(l)}</div>${avisoTxt(l) ? `<div class="muted small">Aviso: ${esc(avisoTxt(l))}</div>` : ''}${l.f.substituto ? `<div class="muted small">Substituto: ${esc(l.f.substituto)}</div>` : ''}`, etq(l)]
    : [linkFicha(l.p, l.f), esc(turmaTxt(l.g)), ab(l), l.f.retorno ? ddmm(l.f.retorno) : '—', esc(avisoTxt(l)) || '—', l.f.substituto ? esc(l.f.substituto) : (l.f.inicio && !['gozada'].includes(l.etapa.k) ? '<span class="p-falta">sem substituto</span>' : '—'), etq(l)]));
  return `${h}<p class="muted small m0">${ls.length} ${ls.length === 1 ? 'período' : 'períodos'} em ${esc(nomeMes(mes))}. Toque no período para mudar datas, aviso ou substituto.</p>${tabela(colunas, linhas, { rotulo: 'Férias de ' + nomeMes(mes) })}`;
}

// ---- Plano do ano ----
function vAno() {
  const c = ctx();
  const fer = ferias().filter(f => daArea(c.grupoDe(c.achar(f), f)));
  const cad = c.L.filter(p => daArea(c.grupoDe(p)));
  const pl = planoDoAno({ cadastro: cad, ferias: fer, hoje: TODAY, feriasDe: c.feriasDe, grupoDe: c.grupoDe, achar: c.achar, max: maxTurma() });
  const mesBtn = m => `<button type="button" class="btn ghost link" data-act="fpIrMes" data-m="${m.mes}">${esc(nomeMes(m.mes))}</button>`;
  const alerta = m => [m.conflitos ? etiqueta(`${m.conflitos} turma${m.conflitos > 1 ? 's' : ''} acima do máximo`, 'atencao') : '', m.limites ? etiqueta(`${m.limites} limite${m.limites > 1 ? 's' : ''} sem férias`, 'critico') : ''].filter(Boolean).join(' ') || '<span class="muted">—</span>';
  const cel = isMobile();
  const colunas = cel ? [{ t: 'Mês' }, { t: 'Férias', n: true }, { t: 'Alertas' }] : [{ t: 'Mês' }, { t: 'Saem', n: true }, { t: 'De férias no mês', n: true }, { t: 'Máx. no mesmo dia', n: true }, { t: 'Planejadas sem data', n: true }, { t: 'Alertas' }];
  const linhas = pl.meses.map(m => (cel ? [mesBtn(m), String(m.ferias + m.planejadas), alerta(m)] : [mesBtn(m), String(m.saem), String(m.ferias), String(m.pico), String(m.planejadas), alerta(m)]));
  let h = `<p class="muted small m0">Próximos 12 meses. "Limites sem férias" = pessoas cuja data limite cai no mês e ainda não têm férias marcadas. Toque no mês para ver quem sai.</p>${tabela(colunas, linhas, { rotulo: 'Plano de férias do ano' })}`;
  if (!cel && pl.areas.length > 1) {
    const cols = [{ t: 'Área de atuação' }, ...pl.meses.map(m => ({ t: mesCurto(m.mes), n: true }))];
    const lin = pl.areas.map(a => [esc(a.nome), ...pl.meses.map(m => (m.porArea[a.k] ? `<b>${m.porArea[a.k]}</b>` : '<span class="muted">·</span>'))]);
    h += `<h3 class="p-t3 m0">Por área: pessoas com férias em cada mês</h3>${tabela(cols, lin, { rotulo: 'Férias por área e mês' })}`;
  }
  return h;
}

// ---- Pendências ----
const ACAO = { vencido: 'Planejar', lim30: 'Planejar', lim60: 'Planejar', lim90: 'Planejar', depoisLimite: 'Abrir', aviso: 'Registrar aviso', semSub: 'Definir', conflito: 'Ver o mês' };
function vPend(P) {
  if (!P.length) return vazio('Nada pendente', 'Ninguém com limite vencendo sem férias, avisos em dia e turmas dentro do máximo.');
  const c = ctx();
  const botao = x => {
    if (x.tipo === 'conflito') return `<button type="button" class="btn sm" data-act="fpIrMes" data-m="${x.mes}">${ACAO.conflito}</button>`;
    if (!edita()) return x.f ? `<button type="button" class="btn sm ghost" data-act="fpAbrir" data-id="${esc(x.f.id)}">Ver</button>` : '';
    if (x.f) return `<button type="button" class="btn sm" data-act="fpAbrir" data-id="${esc(x.f.id)}">${ACAO[x.tipo]}</button>`;
    if (x.plan) return `<button type="button" class="btn sm" data-act="fpAbrir" data-id="${esc(x.plan.id)}">Marcar as datas</button>`;
    return x.p ? `<button type="button" class="btn sm" data-act="fpPlanejar" data-mat="${esc(x.p.mat)}">${ACAO[x.tipo]}</button>` : '';
  };
  const quem = x => (x.tipo === 'conflito' ? `<b>${esc(turmaTxt(x.g))}</b><div class="muted small">${x.nomes.map(n => esc(title(n))).join(', ')}</div>` : `${linkFicha(x.p, x.f || {})}<div class="muted small">${esc(turmaTxt(c.grupoDe(x.p, x.f)))}</div>`);
  const det = x => `${esc(x.t)}${x.f && x.f.inicio ? `<div class="muted small">Férias de ${ddmm(x.f.inicio)} a ${ddmm(x.f.termino)}</div>` : ''}${['vencido', 'lim30', 'lim60', 'lim90'].includes(x.tipo) ? `<div class="muted small">Data limite ${dBR(x.data)}</div>` : ''}`;
  const cel = isMobile();
  const colunas = cel ? [{ t: 'Pendência' }, { t: '' }] : [{ t: 'Gravidade' }, { t: 'Colaborador' }, { t: 'O que falta' }, { t: '' }];
  const GRAV = { critico: 'Urgente', atencao: 'Atenção', info: 'Planejar' };
  const linhas = P.slice(0, 300).map(x => (cel ? [`<div>${etiqueta(GRAV[x.s], x.s)}</div>${quem(x)}<div class="small">${det(x)}</div>`, botao(x)] : [etiqueta(GRAV[x.s], x.s), quem(x), det(x), botao(x)]));
  return `<p class="muted small m0">Da mais urgente para a mais leve. O aviso de férias vai ao colaborador pelo menos 30 dias antes do início; férias depois da data limite são pagas em dobro.</p>${tabela(colunas, linhas, { rotulo: 'Pendências das férias' })}${P.length > 300 ? `<p class="muted small">Mostrando 300 de ${P.length}.</p>` : ''}`;
}

// ---- Programação do mês (PDF e Excel), no padrão dos resumos ----
function relatorioMes(mes) {
  const ls = linhasDoMes(mes); const conf = conflitosDoMes(ls, mes, maxTurma());
  const area = [F.un, F.fa ? PES.areaNome(F.fa) : ''].filter(Boolean).join(' · ') || 'Todas as áreas';
  const porArea = new Map(); for (const l of ls) { const k = l.g.areaNome || 'Sem área'; porArea.set(k, (porArea.get(k) || 0) + 1); }
  const semAviso = ls.filter(l => l.f.inicio && !l.f.avisoEm && !['gozo', 'gozada'].includes(l.etapa.k)).length;
  const semSub = ls.filter(l => l.f.inicio && !String(l.f.substituto || '').trim()).length;
  return {
    titulo: `Programação de férias · ${nomeMes(mes)}`, papel: 'PROGRAMAÇÃO DE FÉRIAS DO MÊS', arquivo: [nomeMes(mes).replace('/', '-'), F.fa || F.un ? area : ''].filter(Boolean),
    meta: ['ArcelorMittal · Coqueria', `Mês: ${nomeMes(mes)}`, `Área: ${area}`, `Gerado em: ${agoraTxt()}`],
    kpis: [
      { rot: 'Períodos no mês', v: ls.length, fmt: 'int', det: `${ls.filter(l => !l.f.inicio).length} planejados sem data` },
      { rot: 'Saem no mês', v: ls.filter(l => l.f.inicio && l.f.inicio.slice(0, 7) === mes).length, fmt: 'int', det: 'começam neste mês' },
      { rot: 'Sem aviso entregue', v: semAviso, fmt: 'int', det: 'aviso 30 dias antes' },
      { rot: 'Sem substituto', v: semSub, fmt: 'int', det: conf.length ? `${conf.length} turma(s) acima do máximo` : 'turmas dentro do máximo' }],
    tabelas: [
      { id: 'area', titulo: 'Por área', sub: 'Pessoas com férias no mês', meia: true, cols: [{ t: 'Área' }, { t: 'Pessoas', fmt: 'int' }], linhas: [...porArea.entries()].sort((a, b) => a[0].localeCompare(b[0])), vazio: 'Ninguém de férias.' },
      { id: 'lista', titulo: 'Programação', sub: 'Por data de início', aba: 'Programação', lista: true, filtro: true,
        cols: ['Colaborador', 'Matrícula', 'Área', 'Turma', 'Início', 'Término', 'Dias', 'Retorno', 'Aviso entregue', 'Substituto', 'Etapa'].map(t => ({ t, fmt: t === 'Dias' ? 'int' : 'txt' })),
        linhas: ls.map(l => [nomePessoa(l.p, l.f), (l.p && l.p.mat) || l.f.mat || '', l.g.areaNome || '', l.g.turma || '', dBR(l.f.inicio) || 'Sem data', dBR(l.termino), l.f.inicio ? +l.f.dias || null : null, dBR(l.f.retorno), dBR(l.f.avisoEm), l.f.substituto || '', l.etapa.t]),
        vazio: 'Ninguém de férias neste mês.' }],
    graficos: [],
    assinaturas: ['RH Administrativo (Dikma)', 'Gestor do contrato (Dikma)']
  };
}

acoes.fpMes = (t, d) => { const n = +d.d; F.mes = n === 0 ? TODAY.slice(0, 7) : somarMeses(F.mes || TODAY.slice(0, 7), n); render(); };
acoes.fpIrMes = (t, d) => { F.mes = d.m; F.aba = 'mes'; render(); scrollTo(0, 0); };
acoes.fpFicha = (t, d) => { Object.assign(UI.co, { mat: d.mat, aba: 'fer' }); UI.view = 'rcolab'; render(); scrollTo(0, 0); };
acoes.fpAbrir = (t, d) => comForm(m => m.formFerias(d.id));
acoes.fpPlanejar = (t, d) => {
  const c = lista().find(x => String(x.mat) === String(d.mat)); if (!c) return;
  const r = ctx().feriasDe(c).map(f => f.limite).filter(Boolean).sort().find(l => l >= TODAY) || ctx().feriasDe(c).map(f => f.limite).filter(Boolean).sort().pop();
  comForm(m => m.formFerias(null, { nome: c.nome, mat: c.mat, setor: c.setor || '', mes: mesSugerido(r, TODAY), limite: r || null }));
};
acoes.fpPdf = () => { const v = $('view'); if (v) imprimirRelatorio(v, relatorioMes(F.mes || TODAY.slice(0, 7))); };
acoes.fpXls = async () => {
  try {
    const rel = relatorioMes(F.mes || TODAY.slice(0, 7)); const { baixarRelatorioExcel } = await import('../ui/excel-relatorio.js');
    baixarRelatorioExcel(['Programacao de ferias', ...rel.arquivo].join(' - ').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 120), rel);
    toast('Planilha baixada');
  } catch (e) { toast('Não foi possível exportar: ' + (e.message || e)); }
};
acoes.fpMax = () => {
  if (!edita()) return;
  formSheet('Máximo por turma', 'Pessoas da mesma área e turma de férias ao mesmo tempo', `<label class="sel"><span>Máximo de pessoas</span><input class="in" type="number" id="fpMaxN" min="1" max="20" value="${maxTurma()}"></label><p class="muted small m0">Acima disso, o mês e a turma aparecem em Pendências. Vale para todas as áreas.</p>`, 'Salvar', async () => {
    const n = Math.round(+$('fpMaxN').value); if (!(n >= 1 && n <= 20)) throw new Error('Informe um número de 1 a 20.');
    await DB.feriasRegrasSalvar({ maxTurma: n }); DB.log(`RH: máximo de férias por turma mudou para ${n}`, 'rh'); toast('Máximo salvo'); render();
  });
};
document.addEventListener('click', e => { const t = e.target.closest('[data-fp-aba]'); if (!t || UI.view !== 'rferias') return; F.aba = t.dataset.fpAba; render(); });
document.addEventListener('change', e => { if (e.target.id === 'fpFa') { F.fa = e.target.value; render(); } if (e.target.id === 'fpUn') { F.un = e.target.value; F.fa = ''; render(); } });
