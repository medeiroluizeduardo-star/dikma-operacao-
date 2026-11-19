// Administração › Relatórios e arquivo de fotos (só o administrador). Parte 2 das fotos das atividades:
// relatório semanal em PowerPoint, exportação das fotos em .zip (com índice e conferência do SHA-256), lixeira e
// exclusão das fotos completas do banco (só das já exportadas; o apontamento e o documento leve com a miniatura ficam).
// As contas ficam em fotos-arquivo.js; o PowerPoint e o .zip em telas/fotos-pptx.js (carregado sob demanda);
// a leitura e a gravação em data.js (ou data-mock.js na demonstração). Explicação em docs/fotos-atividades.md.
import { SETS, SET_KEYS, DAYS } from '../contas/cal.js';
import * as FA from '../contas/fotos-arquivo.js';
import { DB, DEMO, TODAY, esc, title, $ } from '../nucleo/base.js';
import { ME, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { verFotoGrande } from '../ui/fotos.js';

const n0 = n => Number(n || 0).toLocaleString('pt-BR');
const plural = (n, um, varios) => `${n0(n)} ${n === 1 ? um : varios}`;
const conjuntos = () => SET_KEYS.filter(k => DB.dados && DB.dados(k) && DB.dados(k).config);
const SEM = FA.periodoSemana(TODAY, 0), ANT = FA.periodoSemana(TODAY, -1);

// Estado da tela (só na memória).
// Quantas fotos aparecem de cada vez (no celular, menos: a lista fica curta).
const PASSO = () => (matchMedia('(max-width:860px)').matches ? 12 : 48);
const A = { aba: 'periodo', tipo: 'ativ', conj: '', per: 'sem', de: SEM.de, ate: SEM.ate, rota: '', filtro: 'todas', mostrar: PASSO(),
  fotos: null, chave: '', lendo: false, erro: '', semanas: null, chaveSem: '',
  incluirExportadas: false, tarefa: null, zip: null, aviso: '',
  lix: null, lixChave: '', lixLendo: false, incluirRecentes: false };
const conjAtual = () => { const ks = conjuntos(); if (!ks.includes(A.conj)) A.conj = ks[0] || 'patio'; return A.conj; };
const periodo = () => (A.per === 'sem' ? SEM : A.per === 'ant' ? ANT : { de: A.de, ate: A.ate });
const planoDe = k => new Map(Object.values((DB.dados(k) || {}).plano || {}).flat().map(p => [p.id, p]));
const rotasDe = k => [...new Set(Object.values((DB.dados(k) || {}).plano || {}).flat().map(p => p.rota).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const ocupado = () => !!(A.tarefa && A.tarefa.rodando);
const semRede = () => !DEMO && !navigator.onLine;

/* ---------------- leitura ---------------- */
function carregar() {
  const k = conjAtual(); const p = periodo(); if (FA.validarPeriodo(p.de, p.ate)) return;
  const ch = `${k}|${p.de}|${p.ate}`; if (A.chave === ch && (A.fotos || A.lendo)) return;
  A.chave = ch; A.fotos = null; A.lendo = true; A.erro = ''; A.zip = null; A.mostrar = PASSO();
  DB.listarEvidenciasPeriodo(k, p.de, p.ate).then(l => { if (A.chave !== ch) return; A.fotos = l; A.lendo = false; render(); },
    e => { if (A.chave !== ch) return; A.lendo = false; A.erro = (e && e.code === 'permission-denied') ? 'Sem permissão para ler as fotos.' : 'Não foi possível ler as fotos agora (sem sinal?).'; render(); });
}
function carregarLixeira(forcar = false) {
  const k = conjAtual(); if (!forcar && A.lixChave === k && (A.lix || A.lixLendo)) return;
  A.lixChave = k; A.lix = null; A.lixLendo = true;
  DB.listarEvidenciasLixeira(k).then(l => { if (A.lixChave !== k) return; A.lix = l.sort((a, b) => FA.ms(a.lixeiraEm) - FA.ms(b.lixeiraEm)); A.lixLendo = false; render(); },
    () => { A.lixLendo = false; A.lix = []; toast('Não foi possível ler a lixeira agora'); render(); });
}
const recarregar = () => { A.chave = ''; A.lixChave = ''; carregar(); if (A.aba === 'lixeira') carregarLixeira(true); render(); };
async function semanasDoPeriodo(k, p) {
  const ch = `${k}|${p.de}|${p.ate}`; if (A.chaveSem === ch && A.semanas) return A.semanas;
  A.semanas = await DB.semanasPeriodo(k, FA.mesesDasSemanas(p.de, p.ate)); A.chaveSem = ch; return A.semanas;
}
// Fotos do período na rota escolhida.
// Fotos do período do tipo escolhido (Atividades ou Queda zero) e da rota escolhida.
const daRota = l => { const t = FA.doTipo(l, A.tipo); return A.rota ? t.filter(f => (f.rota || '') === A.rota) : t; };
const sufixoTipo = () => (A.tipo === 'qz' ? '-queda-zero' : '');

/* ---------------- progresso ---------------- */
function progresso(feito, total, texto) {
  const T = A.tarefa; if (!T) return; T.feito = feito; T.total = total; T.texto = texto;
  const el = $('faProg');
  if (el) { const pct = total ? Math.round(feito / total * 100) : 0; el.querySelector('.fa-pt').textContent = texto; const b = el.querySelector('.barra i'); if (b) b.style.width = Math.max(2, pct) + '%'; }
  else render();
}
const iniciar = (tipo, texto) => { A.tarefa = { tipo, rodando: true, feito: 0, total: 0, texto }; A.aviso = ''; render(); };
const terminar = (erro, fim) => { A.tarefa = { ...A.tarefa, rodando: false, erro: erro || '', fim: fim || '' }; render(); };
const msgErro = e => (e && e.code === 'permission-denied' ? 'Sem permissão no banco para esta operação.' : (e && e.message) || 'Erro inesperado');

/* ---------------- relatório em PowerPoint ---------------- */
async function gerarRelatorio() {
  if (!isAdmin() || ocupado() || !A.fotos) return;
  if (semRede()) return toast('Sem sinal: o relatório precisa ler as fotos do servidor');
  const k = conjAtual(); const p = periodo();
  iniciar('pptx', 'Lendo a programação do período…');
  try {
    const [semanas, mod] = await Promise.all([semanasDoPeriodo(k, p), import('./fotos-pptx.js')]);
    progresso(0, 0, 'Carregando a biblioteca do PowerPoint…');
    const [logoBranco] = await Promise.all([mod.imagemDoSite('img/dikma-logo-branco.png').catch(() => null), mod.carregarBiblioteca()]);
    const rel = FA.montarRelatorio({ semanas, plano: planoDe(k), fotos: FA.doTipo(A.fotos, A.tipo), de: p.de, ate: p.ate, hoje: TODAY, rota: A.rota });
    const lim = FA.limitarFotos(rel.grupos, FA.MAX_FOTOS_PPTX);
    const blob = await mod.gerarPptx({ rel: { ...rel, grupos: lim.grupos }, fora: lim.fora, tipo: A.tipo, nomeConj: SETS[k].nome, autor: ME.nome || ME.login || '', geradoEm: new Date(), logoBranco,
      carregarFoto: f => DB.abrirEvidencia(f.id, k), progresso });
    const nome = `relatorio-fotos${sufixoTipo()}-${k}-${p.de}_a_${p.ate}${A.rota ? '-' + FA.limparNome(A.rota, 30).replace(/ /g, '-').toLowerCase() : ''}.pptx`;
    mod.baixarBlob(blob, nome);
    DB.log(`Relatório fotográfico${A.tipo === 'qz' ? ' da queda zero' : ''} ${SETS[k].curto} ${FA.dBR(p.de)} a ${FA.dBR(p.ate)}${A.rota ? ' · ' + A.rota : ''} (${lim.total - lim.fora} fotos)`, 'administracao');
    terminar('', `Relatório gerado: ${nome} (${FA.fmtBytes(blob.size)}, ${n0(lim.total - lim.fora)} fotos).${lim.fora ? ` ${plural(lim.fora, 'foto ficou', 'fotos ficaram')} de fora pelo limite de ${FA.MAX_FOTOS_PPTX}: escolha uma rota ou um período menor.` : ''}`);
    toast('Relatório em PowerPoint baixado');
  } catch (e) { terminar(msgErro(e)); toast('Não foi possível gerar o relatório'); }
}

/* ---------------- exportar .zip ---------------- */
const paraExportar = () => daRota(A.fotos || []).filter(f => FA.podeExportar(f) && (A.incluirExportadas || FA.statusFoto(f) === 'banco'));
async function exportarZip() {
  if (!isAdmin() || ocupado() || !A.fotos) return;
  if (semRede()) return toast('Sem sinal: a exportação precisa baixar as fotos do servidor');
  const k = conjAtual(); const p = periodo(); const lista = paraExportar();
  if (!lista.length) return toast('Nenhuma foto para exportar com essas escolhas');
  if (lista.length > FA.MAX_FOTOS_ZIP) { A.aviso = `São ${n0(lista.length)} fotos: o limite por arquivo é ${n0(FA.MAX_FOTOS_ZIP)}. Escolha um período menor ou uma rota.`; render(); return; }
  iniciar('zip', 'Preparando…'); A.zip = null;
  try {
    const [semanas, mod] = await Promise.all([semanasDoPeriodo(k, p), import('./fotos-pptx.js')]);
    const plano = planoDe(k); const lote = FA.idLote(new Date());
    const r = await mod.gerarZip({ fotos: lista, itensDe: f => FA.itensDaFoto(f, { plano, semanas }), de: p.de, ate: p.ate, lote, nomeConj: SETS[k].nome, rota: A.rota, carregarFoto: f => DB.abrirEvidencia(f.id, k), progresso });
    const nome = `fotos${sufixoTipo()}-${k}-${p.de}_a_${p.ate}${A.rota ? '-' + FA.limparNome(A.rota, 30).replace(/ /g, '-').toLowerCase() : ''}.zip`;
    A.zip = { ...r, nome, lote, conj: k, marcado: false };
    mod.baixarBlob(r.blob, nome);
    terminar('', '');
    requestAnimationFrame(() => { const z = document.querySelector('.fazip'); if (z) z.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  } catch (e) { terminar(msgErro(e)); toast('Não foi possível montar o arquivo .zip'); }
}
async function baixarDeNovo() { if (!A.zip) return; const mod = await import('./fotos-pptx.js'); mod.baixarBlob(A.zip.blob, A.zip.nome); }
// O administrador confirma que o arquivo foi salvo: marca exportadoEm/exportLote/exportConf nas fotos que entraram.
async function confirmarSalvo() {
  const Z = A.zip; if (!isAdmin() || !Z || Z.marcado || ocupado()) return;
  if (semRede()) return toast('Sem sinal: tente de novo com conexão');
  const itens = Z.incluidas.map(id => ({ id, conf: Z.conf[id] })); const lotes = FA.emLotes(itens, 'exportar');
  iniciar('marcar', 'Marcando as fotos como exportadas…'); A.tarefa.total = itens.length;
  try {
    let feito = 0;
    for (const l of lotes) { await DB.marcarExportadas(Z.conj, l, Z.lote); feito += l.length; progresso(feito, itens.length, `Marcando ${n0(feito)} de ${n0(itens.length)}`); }
    Z.marcado = true; Z.blob = null;
    DB.log(`Fotos exportadas: ${n0(itens.length)} no lote ${Z.lote} (${Z.nome})${Z.divergentes ? ` · ${Z.divergentes} com SHA-256 divergente` : ''}`, 'administracao');
    terminar('', `${plural(itens.length, 'foto marcada', 'fotos marcadas')} como exportada no lote ${Z.lote}.`);
    A.chave = ''; carregar(); toast('Fotos marcadas como exportadas');
  } catch (e) { terminar(msgErro(e)); toast('Erro ao marcar: veja a mensagem'); }
}

/* ---------------- lixeira e apagar de vez ---------------- */
const NOMES = { lixeira: ['Mover para a lixeira', 'movida para a lixeira', 'movidas para a lixeira'], restaurar: ['Restaurar da lixeira', 'restaurada', 'restauradas'], apagar: ['Apagar de vez do banco', 'apagada do banco', 'apagadas do banco'] };
// Janela de confirmação: digitar a quantidade (lixeira) ou "APAGAR n" (apagar de vez). Restaurar não pede texto.
function confirmar(acao, fotos, k) {
  const n = fotos.length; if (!n) return;
  const L = $('layer'); const pede = acao !== 'restaurar'; const alvo = FA.textoConfirmacao(acao, n);
  const lib = acao === 'apagar' ? FA.fmtBytes(fotos.reduce((s, f) => s + FA.bytesArquivo(f), 0)) : '';
  const texto = acao === 'lixeira' ? `${plural(n, 'foto exportada sai', 'fotos exportadas saem')} das telas e ${n === 1 ? 'fica' : 'ficam'} na lixeira. Dá para restaurar; depois de ${FA.LIXEIRA_DIAS} dias, apague de vez para liberar espaço. Os apontamentos não mudam.`
    : acao === 'apagar' ? `A foto completa de ${plural(n, 'foto', 'fotos')} sai do banco (libera ~${lib}). Fica a miniatura, os dados da atividade e o lote da exportação; a foto continua no .zip que você salvou. <b>Não dá para desfazer.</b> Os apontamentos não mudam.`
      : `${plural(n, 'foto volta', 'fotos voltam')} a aparecer nas telas (continua${n === 1 ? '' : 'm'} marcada${n === 1 ? '' : 's'} como exportada${n === 1 ? '' : 's'}).`;
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet faconf" role="dialog" aria-modal="true" aria-label="${esc(NOMES[acao][0])}"><h3>${esc(NOMES[acao][0])}</h3>
    <div class="sub">${texto}</div>
    ${pede ? `<label class="sel"><span>Para confirmar, digite <b class="mono">${esc(alvo)}</b></span><input class="in" id="faConfIn" autocomplete="off" spellcheck="false" autocapitalize="characters"></label>` : ''}
    <div class="row-gap"><button class="btn ${acao === 'restaurar' ? 'pri' : 'perigo'}" type="button" id="faConfOk" ${pede ? 'disabled' : ''}>${esc(NOMES[acao][0])} (${n0(n)})</button><button class="btn" type="button" data-close>Cancelar</button></div></div></div>`;
  const kd = e => { if (e.key === 'Escape') fechar(); };
  const fechar = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  const inp = $('faConfIn'); const ok = $('faConfOk');
  if (inp) { inp.addEventListener('input', () => { ok.disabled = !FA.confirmacaoOk(inp.value, acao, n); }); inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !ok.disabled) ok.click(); }); inp.focus(); } else ok.focus();
  $('scrim').onclick = e => {
    e.stopPropagation();
    if (e.target.id === 'scrim' || e.target.closest('[data-close]')) return fechar();
    if (e.target.closest('#faConfOk')) { if (pede && !FA.confirmacaoOk(inp.value, acao, n)) return; fechar(); executar(acao, fotos, k); }
  };
}
async function executar(acao, fotos, k) {
  if (!isAdmin() || ocupado()) return;
  if (semRede()) return toast('Sem sinal: esta ação precisa de conexão com o servidor');
  const ids = fotos.map(f => f.id); const lotes = FA.emLotes(ids, acao);
  iniciar(acao, `${NOMES[acao][0]}…`); A.tarefa.total = ids.length;
  const fn = { lixeira: DB.moverLixeira, restaurar: DB.restaurarLixeira, apagar: DB.apagarDefinitivo }[acao];
  let feito = 0;
  try {
    for (const l of lotes) { await fn(k, l); feito += l.length; progresso(feito, ids.length, `${n0(feito)} de ${n0(ids.length)}`); }
    DB.log(`Fotos das atividades ${SETS[k].curto}: ${plural(ids.length, 'foto ' + NOMES[acao][1], 'fotos ' + NOMES[acao][2])}`, 'administracao');
    terminar('', `${plural(ids.length, 'foto ' + NOMES[acao][1], 'fotos ' + NOMES[acao][2])}.`);
    toast(`${plural(ids.length, 'foto ' + NOMES[acao][1], 'fotos ' + NOMES[acao][2])}`);
  } catch (e) { terminar(`${msgErro(e)} · feito: ${n0(feito)} de ${n0(ids.length)}.`); toast('A ação parou no meio · veja a mensagem'); }
  A.chave = ''; A.lixChave = ''; carregar(); if (A.aba === 'lixeira') carregarLixeira(true); render();
}

/* ---------------- tela ---------------- */
const selo = f => { const s = FA.statusFoto(f); return `<span class="fstat ${s}" title="${esc(FA.STATUS[s].d)}">${esc(FA.STATUS[s].t)}</span>`; };
const quando = v => { const t = FA.ms(v); if (!t) return ''; const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
function cartaoFoto(f, { lixeira = false } = {}) {
  const s = FA.statusFoto(f); const dl = FA.diasNaLixeira(f, Date.now());
  const extra = s === 'exportada' || s === 'arquivada' ? `<small>Lote ${esc(f.exportLote || '')}${f.exportConf === 'divergente' ? ' · <b class="bad-t">SHA-256 divergente</b>' : f.exportConf === 'sem-sha' ? ' · sem SHA' : ''}</small>` : '';
  const lx = s === 'lixeira' ? `<small>Na lixeira desde ${quando(f.lixeiraEm)} (${plural(dl, 'dia', 'dias')})</small>` : '';
  let bts = '';
  if (s === 'exportada') bts = `<button class="btn sm" data-act="faUm" data-a="lixeira" data-id="${esc(f.id)}">Lixeira</button>`;
  if (s === 'lixeira') bts = `<button class="btn sm" data-act="faUm" data-a="restaurar" data-id="${esc(f.id)}">Restaurar</button><button class="btn sm perigo" data-act="faUm" data-a="apagar" data-id="${esc(f.id)}" ${FA.podeApagarDefinitivo(f, Date.now(), { incluirRecentes: A.incluirRecentes }) ? '' : `disabled title="Na lixeira há menos de ${FA.LIXEIRA_DIAS} dias (marque “incluir as recentes”)"`}>Apagar de vez</button>`;
  return `<div class="facard ${s}"><button class="famini" data-act="faVer" data-id="${esc(f.id)}" data-lx="${lixeira ? 1 : ''}" aria-label="Ver a foto">${f.thumb ? `<img src="${f.thumb}" alt="" loading="lazy">` : ''}</button>
    <div class="fainfo">${selo(f)}<b>${esc(f.ativ || '')}</b><small>${DAYS[(new Date(f.dia + 'T12:00:00').getDay() + 6) % 7]} ${FA.dBR(f.dia)} · ${esc(f.rota || '')}${f.local ? ' · ' + esc(f.local) : ''}</small><small>${esc(title(f.porNome || ''))} · ${FA.fmtBytes(FA.bytesArquivo(f))}</small>${extra}${lx}${bts ? `<div class="row-gap">${bts}</div>` : ''}</div></div>`;
}
function vTarefa() {
  const T = A.tarefa; if (!T) return '';
  if (T.rodando) { const pct = T.total ? Math.round(T.feito / T.total * 100) : 0; return `<div class="faprog" id="faProg" role="status" aria-live="polite"><div class="small"><span class="fa-pt">${esc(T.texto || 'Trabalhando…')}</span></div><div class="barra"><i style="width:${Math.max(2, pct)}%"></i></div></div>`; }
  if (T.erro) return `<div class="lpfim bad" role="alert"><b>Erro:</b> ${esc(T.erro)}</div>`;
  if (T.fim) return `<div class="lpfim" role="status">${esc(T.fim)}</div>`;
  return '';
}
function vZip() {
  const Z = A.zip; if (!Z) return '';
  if (Z.marcado) return '';
  const avisos = [Z.divergentes ? `<li class="bad-t"><b>${plural(Z.divergentes, 'foto com SHA-256 divergente', 'fotos com SHA-256 divergente')}</b>: o arquivo baixado não bate com o gravado pelo celular. Está no .zip e marcada no indice.csv (DIVERGENTE); não vai para a lixeira em lote.</li>` : '',
    Z.semArquivo ? `<li class="warn-t">${plural(Z.semArquivo, 'foto sem o arquivo completo', 'fotos sem o arquivo completo')} no banco (ainda subindo do celular?): ficou fora do .zip e não será marcada.</li>` : ''].join('');
  return `<div class="fazip" role="region" aria-label="Confirmar o arquivo salvo"><p class="m0"><b>${esc(Z.nome)}</b> · ${FA.fmtBytes(Z.blob ? Z.blob.size : 0)} · ${plural(Z.incluidas.length, 'foto', 'fotos')} · lote <span class="mono">${esc(Z.lote)}</span></p>
    ${avisos ? `<ul class="m0">${avisos}</ul>` : ''}
    <p class="m0">Confira se o arquivo foi salvo no computador (pasta Downloads ou a que você escolheu). Só depois as fotos ficam marcadas como <b>Exportada</b> e podem ir para a lixeira.</p>
    <div class="row-gap"><button class="btn pri" data-act="faSalvo" ${ocupado() ? 'disabled' : ''}>${I.ok} O arquivo foi salvo</button><button class="btn" data-act="faBaixarDeNovo">${I.dl} Baixar de novo</button><button class="btn ghost" data-act="faZipCancelar">Não salvei · cancelar</button></div></div>`;
}
function vPeriodo(k) {
  const p = periodo(); const errP = FA.validarPeriodo(p.de, p.ate);
  const todas = A.fotos ? daRota(A.fotos) : []; const r = FA.resumoEspaco(todas, Date.now());
  const exp = paraExportar(); const lix = FA.separar(todas, 'lixeira').sim;
  const divergentes = todas.filter(f => FA.statusFoto(f) === 'exportada' && f.exportConf === 'divergente').length;
  const noRel = todas.filter(f => FA.statusFoto(f) !== 'lixeira').length;
  const rotas = rotasDe(k);
  let h = `<section class="card"><header><h2>Período e filtros</h2><p>${esc(FA.TIPOS_REL[A.tipo])} · ${esc(SETS[k].nome)} · ${FA.dBR(p.de)} a ${FA.dBR(p.ate)}${A.rota ? ' · ' + esc(A.rota) : ''}</p></header><div class="body stackcol">
    <div class="form fafiltros">
      <label class="sel"><span>Período</span><select class="in" data-fa="per"><option value="sem" ${A.per === 'sem' ? 'selected' : ''}>Esta semana (${FA.ddmm(SEM.de)} a ${FA.ddmm(SEM.ate)})</option><option value="ant" ${A.per === 'ant' ? 'selected' : ''}>Semana passada (${FA.ddmm(ANT.de)} a ${FA.ddmm(ANT.ate)})</option><option value="datas" ${A.per === 'datas' ? 'selected' : ''}>Escolher as datas</option></select></label>
      ${A.per === 'datas' ? `<label class="sel"><span>De</span><input class="in" type="date" data-fa="de" value="${esc(A.de)}" max="${TODAY}"></label><label class="sel"><span>Até</span><input class="in" type="date" data-fa="ate" value="${esc(A.ate)}"></label>` : ''}
      <label class="sel"><span>Rota (opcional)</span><select class="in" data-fa="rota"><option value="">Todas as rotas</option>${rotas.map(x => `<option ${x === A.rota ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    </div>
    ${errP ? `<p class="err m0" role="alert">${esc(errP)}</p>` : ''}
    ${A.lendo ? '<p class="muted m0" role="status">Lendo as fotos do período…</p>' : A.erro ? `<p class="err m0" role="alert">${esc(A.erro)}</p>` : ''}
    ${A.fotos ? `<div class="mini famini5">
      <div><b class="num">${n0(r.n)}</b><span>Fotos no período</span><small>${FA.fmtBytes(r.bytes)} no banco</small></div>
      ${Object.entries(FA.STATUS).map(([s, x]) => `<div class="fak ${s}"><b class="num">${n0(r.por[s].n)}</b><span>${esc(x.t)}</span><small>${FA.fmtBytes(r.por[s].bytes)}</small></div>`).join('')}
    </div><p class="muted small m0">Espaço estimado no banco: foto completa (4/3 do arquivo, em texto) + miniatura. Arquivada fora do banco ocupa só a miniatura (~${FA.fmtBytes(5000)}).</p>` : ''}
  </div></section>`;
  // ações
  const dis = !A.fotos || ocupado() ? 'disabled' : '';
  h += `<section class="card"><header><h2>Ações</h2><p>Na ordem: relatório, exportar e confirmar o arquivo salvo, lixeira e apagar de vez</p></header><div class="body stackcol">
    <div class="fagrid">
      <div class="faacao"><b>${I.file} Relatório em PowerPoint</b><p class="small muted m0">${A.tipo === 'qz' ? `Só as fotos da queda zero: capa com os lançamentos e as fotos, e um slide por lançamento (até ${FA.FOTOS_POR_SLIDE} fotos por slide, com toneladas, local e motivo na legenda).` : `Só as fotos das atividades: capa, indicadores (programadas, realizadas, não realizadas, extras, % de cumprimento e % com foto), resultado por rota e os registros fotográficos (até ${FA.FOTOS_POR_SLIDE} por slide, com legenda).`} Não muda nada no banco.</p>
        ${noRel > FA.MAX_FOTOS_PPTX ? `<p class="warn-t small m0"><b>${n0(noRel)} fotos no período:</b> entram ${FA.MAX_FOTOS_PPTX}, em rodízio entre as atividades do período. Para todas, escolha uma rota ou um período menor.</p>` : ''}
        <div class="row-gap"><button class="btn pri" data-act="faPptx" ${dis || !noRel ? 'disabled' : ''}>${I.dl} Gerar relatório (.pptx)</button></div></div>
      <div class="faacao"><b>${I.cam} Exportar fotos (.zip)</b><p class="small muted m0">Pastas por período, colaborador e atividade, com <span class="mono">indice.csv</span> e conferência do SHA-256 de cada foto. Depois de salvar, confirme para marcar como exportadas.</p>
        <label class="lpchk"><input type="checkbox" data-fa="incluirExportadas" ${A.incluirExportadas ? 'checked' : ''}><span>Incluir as já exportadas</span></label>
        ${exp.length > FA.MAX_FOTOS_ZIP ? `<p class="warn-t small m0">${n0(exp.length)} fotos: o limite por arquivo é ${n0(FA.MAX_FOTOS_ZIP)}. Escolha um período menor ou uma rota.</p>` : ''}
        <div class="row-gap"><button class="btn pri" data-act="faZip" ${dis || !exp.length || exp.length > FA.MAX_FOTOS_ZIP ? 'disabled' : ''}>${I.dl} Exportar ${plural(exp.length, 'foto', 'fotos')} (.zip)</button></div></div>
      <div class="faacao"><b>${I.pend} Tirar do banco (lixeira)</b><p class="small muted m0">Só fotos já exportadas. Somem das telas e podem ser restauradas por ${FA.LIXEIRA_DIAS} dias; depois, na aba Lixeira, apague de vez para liberar espaço.${divergentes ? ` ${plural(divergentes, 'foto com SHA-256 divergente fica', 'fotos com SHA-256 divergente ficam')} fora do lote.` : ''}</p>
        <div class="row-gap"><button class="btn perigo" data-act="faLixLote" ${dis || !lix.length ? 'disabled' : ''}>Mover ${plural(lix.length, 'exportada', 'exportadas')} para a lixeira</button></div></div>
    </div>
    ${A.aviso ? `<p class="warn-t m0" role="alert">${esc(A.aviso)}</p>` : ''}
    ${vTarefa()}${vZip()}
  </div></section>`;
  // lista
  if (A.fotos) {
    const cont = s => (s === 'todas' ? todas.length : todas.filter(f => FA.statusFoto(f) === s).length);
    const vis = A.filtro === 'todas' ? todas : todas.filter(f => FA.statusFoto(f) === A.filtro);
    vis.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : String(a.rota).localeCompare(String(b.rota))));
    h += `<section class="card"><header><h2>Fotos do período</h2><p>Toque na foto para ver grande</p></header><div class="body stackcol">
      <div class="fachips" role="group" aria-label="Filtrar pela situação">${['todas', ...Object.keys(FA.STATUS)].map(s => `<button class="btn sm${A.filtro === s ? ' pri' : ''}" data-act="faFiltro" data-s="${s}" aria-pressed="${A.filtro === s}">${s === 'todas' ? 'Todas' : esc(FA.STATUS[s].t)} <span class="num">${n0(cont(s))}</span></button>`).join('')}</div>
      ${vis.length ? `<div class="falista">${vis.slice(0, A.mostrar).map(f => cartaoFoto(f)).join('')}</div>${vis.length > A.mostrar ? `<div class="row-gap"><button class="btn" data-act="faMais">Mostrar mais (${n0(vis.length - A.mostrar)})</button></div>` : ''}` : '<p class="muted m0">Nenhuma foto com esse filtro.</p>'}
    </div></section>`;
  }
  return h;
}
function vLixeira(k) {
  carregarLixeira();
  const l = A.lix || []; const agora = Date.now();
  const prontas = FA.separar(l, 'apagar', { agora, incluirRecentes: A.incluirRecentes }).sim;
  const velhas = l.filter(f => FA.podeApagarDefinitivo(f, agora)).length;
  const lib = prontas.reduce((s, f) => s + FA.bytesArquivo(f), 0);
  return `<section class="card"><header><h2>Lixeira · ${esc(SETS[k].nome)}</h2><p>Fotos exportadas tiradas das telas (todos os períodos)</p></header><div class="body stackcol">
    ${A.lixLendo ? '<p class="muted m0" role="status">Lendo a lixeira…</p>' : ''}
    <div class="mini"><div><b class="num">${n0(l.length)}</b><span>Na lixeira</span><small>${FA.fmtBytes(l.reduce((s, f) => s + FA.bytesArquivo(f), 0))} de fotos completas</small></div><div><b class="num">${n0(velhas)}</b><span>Há ${FA.LIXEIRA_DIAS} dias ou mais</span><small>prontas para apagar de vez</small></div></div>
    <p class="muted small m0">Apagar de vez tira a foto completa do banco (libera espaço). Fica o documento leve com a miniatura, os dados da atividade, o SHA-256 e o lote da exportação: a foto aparece como <span class="fstat arquivada">Arquivada fora do banco</span>. Os apontamentos e a contagem 📷 não mudam.</p>
    <label class="lpchk"><input type="checkbox" data-fa="incluirRecentes" ${A.incluirRecentes ? 'checked' : ''}><span>Incluir as que estão na lixeira há menos de ${FA.LIXEIRA_DIAS} dias</span></label>
    <div class="row-gap"><button class="btn perigo" data-act="faApagarLote" ${!prontas.length || ocupado() ? 'disabled' : ''}>Apagar de vez ${plural(prontas.length, 'foto', 'fotos')}${prontas.length ? ` (~${FA.fmtBytes(lib)})` : ''}</button><button class="btn" data-act="faRestLote" ${!l.length || ocupado() ? 'disabled' : ''}>Restaurar todas</button></div>
    ${vTarefa()}
    ${l.length ? `<div class="falista">${l.map(f => cartaoFoto(f, { lixeira: true })).join('')}</div>` : A.lixLendo ? '' : '<p class="muted m0">A lixeira está vazia.</p>'}
  </div></section>`;
}
export function vArqFotos() {
  if (!isAdmin()) return '<div class="card"><div class="empty">Só o administrador gera relatórios e arquiva as fotos.</div></div>';
  const ks = conjuntos(); if (!ks.length) return '<div class="card"><div class="empty">Nenhum conjunto de atividades configurado.</div></div>';
  const k = conjAtual(); if (A.aba === 'periodo') carregar();
  return `<div class="row-gap fatopo">
      ${ks.length > 1 ? `<div class="seg fasets" role="group" aria-label="Atividades">${ks.map(x => `<button data-act="faConj" data-k="${x}" aria-pressed="${x === k}" aria-selected="${x === k}">${esc(SETS[x].curto)}</button>`).join('')}</div>` : ''}
      <div class="seg fasets" role="tablist" aria-label="Relatório de">${Object.entries(FA.TIPOS_REL).map(([t, n]) => `<button role="tab" data-act="faTipo" data-t="${t}" aria-selected="${A.aba === 'periodo' && A.tipo === t}">${esc(n)}</button>`).join('')}</div>
      <div class="seg fasets" role="tablist" aria-label="Parte da tela"><button role="tab" data-act="faAba" data-a="periodo" aria-selected="${A.aba === 'periodo'}">Período</button><button role="tab" data-act="faAba" data-a="lixeira" aria-selected="${A.aba === 'lixeira'}">Lixeira${A.lix && A.lix.length ? ` <span class="badge num">${A.lix.length}</span>` : ''}</button></div>
    </div>${A.aba === 'lixeira' ? vLixeira(k) : vPeriodo(k)}`;
}

/* ---------------- eventos ---------------- */
const acharFoto = id => (A.fotos || []).find(f => f.id === id) || (A.lix || []).find(f => f.id === id);
acoes.faConj = (t, d) => { if (ocupado()) return; A.conj = d.k; A.rota = ''; A.zip = null; A.tarefa = null; A.aviso = ''; A.lixChave = ''; render(); };
acoes.faAba = (t, d) => { A.aba = d.a; render(); };
acoes.faTipo = (t, d) => { if (ocupado()) return; A.tipo = d.t === 'qz' ? 'qz' : 'ativ'; A.aba = 'periodo'; A.zip = null; A.tarefa = null; A.aviso = ''; A.filtro = 'todas'; A.mostrar = PASSO(); render(); };
acoes.faFiltro = (t, d) => { A.filtro = d.s; A.mostrar = PASSO(); render(); };
acoes.faMais = () => { A.mostrar += PASSO() * 2; render(); };
acoes.faPptx = () => gerarRelatorio();
acoes.faZip = () => exportarZip();
acoes.faSalvo = () => confirmarSalvo();
acoes.faBaixarDeNovo = () => baixarDeNovo();
acoes.faZipCancelar = () => { A.zip = null; A.tarefa = null; render(); toast('Exportação cancelada: nada foi marcado'); };
acoes.faLixLote = () => confirmar('lixeira', FA.separar(daRota(A.fotos || []), 'lixeira').sim, conjAtual());
acoes.faApagarLote = () => confirmar('apagar', FA.separar(A.lix || [], 'apagar', { agora: Date.now(), incluirRecentes: A.incluirRecentes }).sim, conjAtual());
acoes.faRestLote = () => confirmar('restaurar', A.lix || [], conjAtual());
acoes.faUm = (t, d) => {
  const f = acharFoto(d.id); if (!f) return;
  const op = { agora: Date.now(), incluirRecentes: A.incluirRecentes, comDivergente: true };
  const { sim, nao } = FA.separar([f], d.a, op);
  if (!sim.length) return toast(`Não dá: ${nao[0].motivo}`);
  confirmar(d.a, sim, conjAtual());
};
acoes.faVer = (t, d) => {
  const f = acharFoto(d.id); if (!f) return; const k = conjAtual(); const s = FA.statusFoto(f);
  const leg = `${FA.dBR(f.dia)} · ${f.rota || ''} · ${f.ativ || ''} · ${title(f.porNome || '')} · ${FA.STATUS[s].t}${f.exportLote ? ` (lote ${f.exportLote})` : ''}`;
  verFotoGrande(s === 'arquivada' ? async () => f.thumb : () => DB.abrirEvidencia(f.id, k), f.thumb, 'Foto da atividade', s === 'arquivada' ? leg + ': aparece só a miniatura' : leg);
};
acoes.faAtualizar = () => recarregar();
document.addEventListener('change', e => {
  const t = e.target; const c = t && t.dataset && t.dataset.fa; if (!c) return;
  if (c === 'incluirExportadas' || c === 'incluirRecentes') { A[c] = t.checked; render(); return; }
  if (ocupado()) return;
  if (c === 'per') { A.per = t.value; if (A.per === 'datas' && (!A.de || !A.ate)) { A.de = SEM.de; A.ate = SEM.ate; } }
  else if (c === 'de' || c === 'ate') A[c] = t.value;
  else if (c === 'rota') A.rota = t.value;
  A.zip = null; A.tarefa = null; A.aviso = ''; A.filtro = 'todas';
  render();
});
