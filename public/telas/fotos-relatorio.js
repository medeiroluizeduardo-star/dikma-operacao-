// Relatório fotográfico em PowerPoint: a montagem comum (Administração › Fotos e o botão de Indicadores › Atividades)
// e a janela do supervisor/coordenador/gestor, que gera só da(s) área(s) dele e só o PowerPoint (o .zip, a lixeira e o
// apagar continuam só com o administrador, em Administração › Fotos). Carregado sob demanda.
// As contas ficam em contas/fotos-arquivo.js e os slides em telas/fotos-pptx.js.
import { SETS, AREA_S } from '../contas/cal.js';
import * as FA from '../contas/fotos-arquivo.js';
import { DB, DEMO, TODAY, esc, title, $ } from '../nucleo/base.js';
import { ME, SK, isAdmin, perfil, myAreas, setsDe } from '../nucleo/estado.js';
import { formSheet, toast } from '../ui/janelas.js';

const planoDe = k => new Map(Object.values((DB.dados(k) || {}).plano || {}).flat().map(p => [p.id, p]));
const nomeArea = a => AREA_S[a] || a;
const sufTipo = t => (t === 'qz' ? '-queda-zero' : t === 'om' ? '-oms' : '');
const sufFiltro = (area, rota) => [area, rota].filter(Boolean).map(x => '-' + FA.limparNome(x, 30).replace(/ /g, '-').toLowerCase()).join('');

// Monta e baixa o .pptx. o = { k, de, ate, tipo, area, rota, fotos (do período, já lidas), fora (Set), dest (Set),
//   obs, responsavel, semanas (opcional, já lidas), progresso(feito, total, texto) }. Devolve { nome, blob, lim }.
export async function gerarArquivo(o) {
  const { k, de, ate, tipo, area = '', rota = '' } = o; const prog = o.progresso || (() => {});
  const areas = area ? [area] : null;
  const [semanas, mod] = await Promise.all([o.semanas || DB.semanasPeriodo(k, FA.mesesDasSemanas(de, ate)), import('./fotos-pptx.js')]);
  prog(0, 0, 'Carregando a biblioteca do PowerPoint…');
  const [img] = await Promise.all([mod.imagensModelo(), mod.carregarBiblioteca()]);
  const rel = FA.montarRelatorio({ semanas, plano: planoDe(k), fotos: FA.noRelatorio(FA.doTipo(o.fotos, tipo), o.fora), de, ate, hoje: TODAY, rota, areas });
  // comparação com o período anterior (só atividades): reaproveita as semanas já lidas e lê só os meses que faltam
  let anterior = null;
  if (tipo === 'ativ') {
    try {
      const pa = FA.periodoAnterior(de, ate); const ja = FA.mesesDasSemanas(de, ate);
      const faltam = FA.mesesDasSemanas(pa.de, pa.ate).filter(m => !ja.includes(m));
      const semAnt = { ...semanas, ...(faltam.length ? await DB.semanasPeriodo(k, faltam) : {}) };
      const ra = FA.montarRelatorio({ semanas: semAnt, plano: planoDe(k), fotos: [], de: pa.de, ate: pa.ate, hoje: TODAY, rota, areas });
      if (ra.ind && ra.ind.prog) anterior = { ...pa, cumpr: ra.ind.cumpr, pctFoto: ra.ind.pctFoto };
    } catch (e) { anterior = null; }
  }
  const lim = FA.limitarFotos(rel.grupos, FA.MAX_FOTOS_PPTX);
  const blob = await mod.gerarPptx({ rel: { ...rel, grupos: lim.grupos }, gruposTodos: rel.grupos, fora: lim.fora, anterior, destaques: FA.destaques(rel.grupos, o.dest), observacoes: FA.limparObs(o.obs),
    tipo, nomeConj: SETS[k].nome, area: area ? nomeArea(area) : SETS[k].local, responsavel: String(o.responsavel || '').trim(), autor: ME.nome || ME.login || '', geradoEm: new Date(), img,
    carregarFoto: f => DB.abrirEvidencia(f.id, k), progresso: prog });
  const nome = `relatorio-fotos${sufTipo(tipo)}-${k}-${de}_a_${ate}${sufFiltro(area, rota)}.pptx`;
  mod.baixarBlob(blob, nome);
  const filtro = [area ? nomeArea(area) : '', rota].filter(Boolean).join(' · ');
  DB.log(`Relatório fotográfico${tipo === 'qz' ? ' da queda zero' : tipo === 'om' ? ' das OMs' : ''} ${SETS[k].curto} ${FA.dBR(de)} a ${FA.dBR(ate)}${filtro ? ' · ' + filtro : ''} (${lim.total - lim.fora} fotos)`, isAdmin() ? 'administracao' : 'operacao');
  return { nome, blob, lim };
}

// ---------- botão de Indicadores › Atividades ----------
// Quem pode: administrador, ou supervisor/coordenador/gestor da Operação com acesso ao conjunto (Pátio/Bateria).
// O banco já deixa essas pessoas lerem as fotos e a programação (firestore.rules › lePB).
const PAPEIS_REL = ['supervisor', 'coordenador', 'gestor'];
export const podeRelArea = (k = SK) => !!ME && (isAdmin() || (PAPEIS_REL.includes(perfil('operacao')) && setsDe(ME, 'operacao').includes(k)));
// Áreas que a pessoa pode escolher: todas do conjunto (admin, coordenador, gestor) ou só as do cadastro (supervisor).
export function areasRelArea(k = SK) {
  const todas = SETS[k] ? SETS[k].areas : [];
  if (isAdmin() || perfil('operacao') !== 'supervisor') return todas;
  return myAreas('operacao').filter(a => todas.includes(a));
}
const rotasDe = (k, area) => { const pl = (DB.dados(k) || {}).plano || {}; return [...new Set((pl[area] || []).map(p => p.rota).filter(Boolean))].sort((a, b) => a.localeCompare(b)); };

let ultimo = null; // última escolha (só na memória)
export function abrirRelatorioArea() {
  const k = SK;
  if (!podeRelArea(k)) return toast('Sem acesso ao relatório fotográfico desta área');
  const areas = areasRelArea(k); if (!areas.length) return toast('Nenhuma área no seu cadastro');
  const sem = FA.periodoSemana(TODAY, 0), ant = FA.periodoSemana(TODAY, -1);
  const u = ultimo || { per: 'ant', area: areas.length === 1 ? areas[0] : '', rota: '', tipo: 'ativ', resp: title(ME.nome || ME.login || ''), obs: '' };
  const opts = (l, v) => l.map(([val, t]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const areaOpts = [...(areas.length > 1 && areas.length === SETS[k].areas.length ? [['', 'Todas as áreas']] : []), ...areas.map(a => [a, nomeArea(a)])];
  formSheet('Relatório fotográfico', `${esc(SETS[k].nome)} · PowerPoint no modelo da Dikma. Não muda nada no banco.`, `
    <label class="sel"><span>Relatório de</span><select class="in" id="rfTipo">${opts(Object.entries(FA.TIPOS_REL), u.tipo)}</select></label>
    <label class="sel"><span>Período</span><select class="in" id="rfPer">${opts([['sem', `Esta semana (${FA.ddmm(sem.de)} a ${FA.ddmm(sem.ate)})`], ['ant', `Semana passada (${FA.ddmm(ant.de)} a ${FA.ddmm(ant.ate)})`]], u.per)}</select></label>
    <label class="sel"><span>Área</span><select class="in" id="rfArea">${opts(areaOpts, u.area)}</select></label>
    <label class="sel"><span>Rota (opcional)</span><select class="in" id="rfRota"><option value="">Todas as rotas</option>${(u.area ? rotasDe(k, u.area) : []).map(r => `<option ${r === u.rota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
    <label class="sel"><span>Observações do período (opcional)</span><textarea class="in" id="rfObs" rows="3" maxlength="${FA.MAX_OBS}">${esc(u.obs)}</textarea></label>
    <label class="sel"><span>Responsável na capa</span><input class="in" id="rfResp" maxlength="60" value="${esc(u.resp)}"></label>
    <p class="small muted m0" id="rfMsg" role="status"></p>`, 'Gerar relatório (.pptx)', async () => {
    if (!navigator.onLine && !DEMO) throw new Error('Sem sinal: o relatório precisa ler as fotos do servidor.');
    const esc2 = { per: $('rfPer').value, area: $('rfArea').value, rota: $('rfRota').value, tipo: $('rfTipo').value, resp: $('rfResp').value, obs: $('rfObs').value };
    if (esc2.area && !areas.includes(esc2.area)) throw new Error('Área fora do seu acesso.');
    if (!esc2.area && areaOpts[0][0] !== '') throw new Error('Escolha a área.');
    ultimo = esc2;
    const p = esc2.per === 'sem' ? sem : ant; const msg = $('rfMsg');
    const progresso = (f, t, txt) => { if (msg) msg.textContent = txt || (t ? `${f} de ${t}` : ''); };
    progresso(0, 0, 'Lendo as fotos do período…');
    const fotos = (await DB.listarEvidenciasPeriodo(k, p.de, p.ate)).filter(f => (!esc2.area || f.area === esc2.area) && (!esc2.rota || (f.rota || '') === esc2.rota));
    if (!FA.doTipo(fotos, esc2.tipo).length) throw new Error('Nenhuma foto desse tipo no período e na área escolhidos.');
    const r = await gerarArquivo({ k, de: p.de, ate: p.ate, tipo: esc2.tipo, area: esc2.area, rota: esc2.rota, fotos, obs: esc2.obs, responsavel: esc2.resp, progresso });
    toast(`Relatório baixado: ${r.lim.total - r.lim.fora} fotos${r.lim.fora ? ` (${r.lim.fora} de fora pelo limite; escolha uma rota)` : ''}`);
  });
  // trocar a área recarrega as rotas dela
  const sa = $('rfArea'), sr = $('rfRota');
  if (sa && sr) sa.addEventListener('change', () => { sr.innerHTML = `<option value="">Todas as rotas</option>${(sa.value ? rotasDe(k, sa.value) : []).map(r => `<option>${esc(r)}</option>`).join('')}`; });
}
