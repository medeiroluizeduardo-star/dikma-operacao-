// Dikma Gestão — RH › Colaboradores: o cadastro único das pessoas (gcolab), com a ficha individual em abas.
// Lista (busca, área, situação e férias) e ficha: Dados (nome, matrículas Dikma e Arcelor, admissão, função…), Lotação (área
// de atuação, rota, regime, líder imediato e supervisor imediato, este calculado pelo líder do líder, como na Frequência) e
// Férias (períodos, data limite e próximas; o formulário é o da Frequência, administrativo.js, carregado sob demanda).
// A importação da planilha de férias continua em RH › Importar planilhas.
// A ficha de acompanhamento (ocorrências e assinaturas) continua na Gestão; um botão leva de uma para a outra.
// Quem edita: o RH · Administrativo e o administrador. O RH grava os dados do cadastro (DB.rhSalvarFicha); área de
// atuação, rota e função mudam também Atividades e Equipamentos, então ficam no formulário completo (gestao.js), que
// abre para o administrador. A Matrícula de sempre (chave de tudo) é a da Dikma; a da Arcelor é o campo matArc.
import { DB, esc, title, TODAY, framed } from '../nucleo/base.js';
import { UI, ME, meEm, admDe, temFichas, modsDe } from '../nucleo/estado.js';
import { PES, carregarModulo } from '../nucleo/modulos.js';
import { editaAdm } from '../contas/acessos.js';
import { AREA_GERAL, ehAreaAtiv } from '../contas/pessoas.js';
import { lideresDasFichas, nomeLider } from '../contas/lideres.js';
import { criarLiderancaDaFicha } from '../contas/folha-ficha.js';
import { cadastrosDuplicados } from '../contas/duplicados.js';
import { anotarTroca } from '../contas/escala.js';
import { indiceFeriasPessoa, situacaoPeriodo, resumoFeriasPessoa, deFeriasHoje, feriasEmBreve, limiteProximo, feriasSemCadastro } from '../contas/ferias.js';
import { campoBusca } from '../ui/busca.js';
import { abas, dados, etiqueta, tabela, vazio, carregando, botaoAcao } from '../ui/padrao.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';
import { registrarAcesso, botaoQuemAbriu } from '../ui/acessos-ficha.js';

const C = UI.co;
const $ = id => document.getElementById(id);
const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

// O cadastro como o RH recebe (todas as áreas); sem RH, a lista da Gestão.
const lista = () => ((DB.cache.adm && DB.cache.adm.rhLoaded) ? DB.cache.adm.rh : (DB.cache.g && DB.cache.g.colabs)) || [];
const pronto = () => !!((DB.cache.adm && DB.cache.adm.rhLoaded) || (DB.cache.g && DB.cache.g.loaded));
// Formulário completo (com área, rota e função, que mudam os outros módulos): quem administra as fichas.
const completo = () => admDe('fichas') && temFichas(ME);
const podeEditar = () => completo() || editaAdm(meEm('rh'));
const ativo = c => !c.dem || c.dem > TODAY;
const emExp = c => ativo(c) && !!c.adm && dias(c.adm, TODAY) >= 0 && dias(c.adm, TODAY) < 90;
function tempoCasa(adm) {
  if (!adm) return '';
  const [y1, m1, d1] = adm.split('-').map(Number), [y2, m2, d2] = TODAY.split('-').map(Number);
  let m = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0); if (m < 0) m = 0;
  const a = Math.floor(m / 12), r = m % 12;
  return [a ? `${a} ano${a > 1 ? 's' : ''}` : '', r || !a ? `${r} ${r === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean).join(' e ');
}

// Férias (ferias/{id}, lidas pelo RH): índice refeito só quando a lista ou o cadastro mudam.
const ferLista = () => (DB.cache.adm && DB.cache.adm.ferias) || [];
const ferPronto = () => !!(DB.cache.adm && DB.cache.adm.fLoaded);
let FX = null, FXl = null, FXc = null;
const feriasDe = c => { const l = ferLista(), L = lista(); if (FXl !== l || FXc !== L) { FX = indiceFeriasPessoa(l, L); FXl = l; FXc = L; } return FX(c); };
const editaFerias = () => editaAdm(meEm('rh'));
const comFerias = fn => carregarModulo('AD').then(m => { if (m) fn(m); });
const ddmm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
// Etiqueta curta das férias na lista: de férias agora, começa em breve ou data limite chegando.
function etqFerias(c) {
  const r = resumoFeriasPessoa(feriasDe(c), TODAY);
  if (r.atual) return etiqueta(`De férias até ${ddmm(r.atual.termino)}`, 'atencao');
  if (r.proxima && feriasEmBreve(feriasDe(c), TODAY)) return etiqueta(`Férias em ${ddmm(r.proxima.inicio)}`, 'info');
  if (r.limite && limiteProximo(feriasDe(c), TODAY)) return etiqueta(`${r.limite < TODAY ? 'Limite vencido' : 'Limite'} ${dBR(r.limite)}`, 'critico');
  return '';
}
const situacao = c => (!ativo(c) ? etiqueta('Desligado', 'neutro') : (etqFerias(c) || (emExp(c) ? etiqueta('Em experiência', 'info') : etiqueta('Ativo', 'ok'))));

// Cadastro repetido (contas/duplicados.js): fichas com o mesmo nome ou matrícula, ou matrícula diferente da Escala do dia.
let DUP = null, DUPk = [];
const dups = () => { const k = [lista(), ...(PES.naEscala ? [PES.naEscala().length] : [])]; if (!DUP || k.some((x, i) => x !== DUPk[i])) { DUP = cadastrosDuplicados({ fichas: lista(), escala: PES.naEscala ? PES.naEscala() : [], hoje: TODAY }); DUPk = k; } return DUP; };
const dupMats = () => new Set(dups().flatMap(d => d.mats.map(String)));
const FILTROS = [['ativos', 'Ativos', ativo], ['exp', 'Em experiência', emExp], ['semArc', 'Sem matrícula Arcelor', c => ativo(c) && !c.matArc],
  ['ferAgora', 'De férias agora', c => ativo(c) && deFeriasHoje(feriasDe(c), TODAY)],
  ['ferProx', 'Férias nos próximos 60 dias', c => ativo(c) && feriasEmBreve(feriasDe(c), TODAY)],
  ['ferLim', 'Data limite em 60 dias, sem férias marcadas', c => ativo(c) && limiteProximo(feriasDe(c), TODAY)],
  ['dup', 'Cadastro repetido', c => ativo(c) && dupMats().has(String(c.mat))],
  ['desl', 'Desligados', c => !ativo(c)], ['todos', 'Todos', () => true]];
// Coluna de férias da lista (quando o filtro é de férias).
function txtFerias(c) {
  const r = resumoFeriasPessoa(feriasDe(c), TODAY); const f = r.atual || r.proxima;
  if (f) return `${dBR(f.inicio)} a ${dBR(f.termino)}${f.retorno ? ` <span class="muted small">· volta ${dBR(f.retorno)}</span>` : ''}`;
  return r.limite ? `Limite ${dBR(r.limite)}, sem férias marcadas` : '';
}

function vLista() {
  const L = lista(); const lot = PES.lotacoes(L);
  const areaDe = c => (lot.get(String(c.mat)) || {}).area || c.area || AREA_GERAL;
  const areas = [...new Set(L.filter(ativo).map(areaDe))].sort((a, b) => PES.areaNome(a).localeCompare(PES.areaNome(b)));
  if (C.fa && !areas.includes(C.fa)) C.fa = '';
  const base = L.filter(c => !C.fa || areaDe(c) === C.fa);
  const f = FILTROS.find(x => x[0] === C.f) || FILTROS[0];
  const q = C.q.trim().toLowerCase();
  const l = base.filter(f[2]).filter(c => !q || `${c.mat} ${c.matArc || ''} ${c.nome} ${c.funcao || ''}`.toLowerCase().includes(q)).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const n = fn => base.filter(fn).length;
  const filtros = `<div class="p-form co-filtros">
    <label class="p-campo co-busca"><span>Buscar</span><input type="search" id="coQ" placeholder="Nome, matrícula ou função" value="${esc(C.q)}"></label>
    <label class="p-campo"><span>Área de atuação</span><select id="coFa"><option value="">Todas as áreas</option>${areas.map(a => `<option value="${esc(a)}" ${C.fa === a ? 'selected' : ''}>${esc(PES.areaNome(a))}</option>`).join('')}</select></label>
    <label class="p-campo"><span>Mostrar</span><select id="coF">${FILTROS.map(([k, t, fn]) => `<option value="${k}" ${f[0] === k ? 'selected' : ''}>${t} (${n(fn)})</option>`).join('')}</select></label>
  </div>`;
  const ferF = f[0].startsWith('fer');
  const exp = !framed && ferPronto() && ferLista().length ? `<button class="btn" data-act="coExpFerias">${I.dl} Exportar férias</button>` : '';
  const botoes = podeEditar() || completo() || exp ? `<div class="row-gap co-acoes">${podeEditar() ? botaoAcao('Novo colaborador', 'data-act="coNovo"', I.plus) : ''}${completo() ? '<button class="btn" data-act="coLideres" title="Trocar ou renomear o líder de várias pessoas de uma vez">Líderes</button>' : ''}${exp}</div>` : '';
  let h = `<div class="card"><div class="body stackcol">${filtros}${botoes}</div></div>`;
  const D = dups();
  if (D.length && f[0] === 'dup') h += `<div class="aviso"><b>Cadastro repetido</b>: a mesma pessoa aparece duas vezes na Frequência. Abra a ficha certa e corrija a matrícula (ou desligue a ficha repetida). A troca de letra e de escala também é feita aqui, na ficha.<ul class="m0">${D.map(d => `<li>${d.mats.filter(Boolean).map(m => `<button type="button" class="btn ghost link" data-act="coFicha" data-mat="${esc(m)}">${esc(title(d.nome))} · ${esc(m)}</button>`).join(' · ') || esc(title(d.nome))}: ${esc(d.motivo)}</li>`).join('')}</ul></div>`;
  else if (D.length) h += `<div class="aviso">${D.length} ${D.length === 1 ? 'cadastro repetido' : 'cadastros repetidos'} (a pessoa aparece duas vezes na Frequência). <button type="button" class="btn sm" data-act="irDuplicados">Ver e corrigir</button></div>`;
  if (ferF && !ferPronto()) return h + carregando();
  if (ferF) { // férias que não acham ninguém no cadastro: aparecem aqui para não sumirem
    const sem = feriasSemCadastro(ferLista().filter(x => x.inicio ? (x.termino || '') >= TODAY : true), L);
    if (sem.length) h += `<p class="muted small m0">${sem.length} ${sem.length === 1 ? 'período de férias' : 'períodos de férias'} de agora em diante sem ninguém com a mesma matrícula ou nome no cadastro: ${sem.slice(0, 8).map(x => esc(title(x.nome))).join(', ')}${sem.length > 8 ? '…' : ''}.</p>`;
  }
  if (!l.length) return h + vazio('Ninguém com esse filtro', 'Troque a busca, a área ou o que mostrar.');
  const lim = Math.min(UI.more || 200, l.length);
  const nome = c => `<button type="button" class="btn ghost link co-nome" data-act="coFicha" data-mat="${esc(c.mat)}">${esc(title(c.nome))}</button>${c.funcao ? `<div class="muted small">${esc(title(c.funcao))}</div>` : ''}`;
  const cel = isMobile();
  const colunas = cel ? [{ t: 'Colaborador' }, { t: 'Situação' }] : [{ t: 'Colaborador' }, { t: 'Matrícula Dikma' }, { t: 'Matrícula Arcelor' }, { t: 'Área de atuação' }, { t: 'Líder imediato' }, { t: ferF ? 'Férias' : 'Admissão' }, { t: 'Situação' }];
  const linhas = l.slice(0, lim).map(c => (cel
    ? [`${nome(c)}<div class="muted small mono">${esc(c.mat)}${c.matArc ? ' · Arcelor ' + esc(c.matArc) : ''}</div>${ferF ? `<div class="small">${txtFerias(c)}</div>` : ''}`, situacao(c)]
    : [nome(c), `<span class="mono">${esc(c.mat)}</span>`, c.matArc ? `<span class="mono">${esc(c.matArc)}</span>` : '<span class="p-falta">—</span>', esc((lot.get(String(c.mat)) || {}).txt || PES.areaNome(c.area)), c.lider ? esc(title(c.lider)) : '<span class="p-falta">—</span>', ferF ? txtFerias(c) || '—' : dBR(c.adm) || '—', situacao(c)]));
  h += `<p class="muted small co-total">${l.length} ${l.length === 1 ? 'pessoa' : 'pessoas'}</p>${tabela(colunas, linhas, { rotulo: 'Colaboradores' })}`;
  if (l.length > lim) h += `<div class="row-gap"><button class="btn center" data-act="more" data-n="${lim + 200}">Mostrar mais ${Math.min(200, l.length - lim)} (faltam ${l.length - lim})</button></div>`;
  return h;
}

function vFicha(c) {
  registrarAcesso(c, 'rh');
  const L = lista(); const lot = PES.lotacao(c); const ld = criarLiderancaDaFicha(L)(c);
  const at = lot.ativ ? lot.ativ.x : null, op = lot.op;
  const aba = ['dados', 'lot', 'fer'].includes(C.aba) ? C.aba : 'dados';
  const corpo = aba === 'fer' ? vFeriasFicha(c) : aba === 'dados'
    ? dados([
      ['Nome completo', esc(c.nome)], ['Matrícula Dikma', `<span class="mono">${esc(c.mat)}</span>`], ['Matrícula Arcelor', c.matArc ? `<span class="mono">${esc(c.matArc)}</span>` : ''],
      ['Admissão', c.adm ? `${dBR(c.adm)} <span class="muted small">· ${tempoCasa(c.adm)} de casa</span>` : ''], ['Demissão', dBR(c.dem)],
      ['Função', esc(title(c.funcao || (at && at.funcao) || ''))], ['Área (RH)', esc(c.setor || '')], ['Setor (RH)', esc(c.subsetor || '')]])
    : dados([
      ['Área de atuação', esc(lot.txt || PES.areaNome(lot.area))], ['Rota', at && ehAreaAtiv(at.area) ? esc(at.rota) : ''],
      ['Regime', at ? esc(title(at.regime || '')) : ''], ['Turma / turno', esc(c.turma || (at && at.turma) || '')],
      ...(op ? [['Equipamentos', esc(`Escala ${op.escala || 'ADM'}${op.turma ? ' · turma ' + op.turma : ''}`)]] : []),
      ['Líder imediato', ld.lider ? esc(title(ld.lider)) : ''], ['Supervisor imediato', ld.sup ? `${esc(title(ld.sup))} <span class="muted small">· líder do líder</span>` : '']]);
  const botoes = [
    podeEditar() ? botaoAcao('Editar', `data-act="coEditar" data-mat="${esc(c.mat)}"`) : '',
    temFichas(ME) && modsDe(ME).includes('gestao') ? `<button class="btn" data-act="irFicha" data-mat="${esc(c.mat)}">${I.ficha} Ficha de acompanhamento</button>` : '',
    botaoQuemAbriu(c)
  ].join('');
  return `<div class="row-gap"><button class="btn" data-act="coVoltar">← Colaboradores</button></div>
  <div class="card"><div class="body stackcol">
    <div class="co-hd"><div class="minw"><h2 class="p-t2">${esc(title(c.nome))}</h2>
      <p class="muted m0">Matrícula Dikma <b class="mono">${esc(c.mat)}</b>${c.matArc ? ` · Arcelor <b class="mono">${esc(c.matArc)}</b>` : ''}</p>
      <div class="row-gap co-etq">${situacao(c)}${c.adm && emExp(c) ? etiqueta(`${dias(c.adm, TODAY)} dias de casa`, 'info') : ''}</div></div>
      ${botoes ? `<div class="row-gap">${botoes}</div>` : ''}</div>
    ${abas([['dados', 'Dados'], ['lot', 'Lotação e liderança'], ['fer', 'Férias']], aba, 'co-aba', 'Ficha do colaborador')}
    ${corpo}
    ${aba === 'lot' && lot.outros && lot.outros.length ? `<div class="aviso small">Esta pessoa está cadastrada em ${lot.outros.length + 1} lugares das Atividades (${esc(lot.txt.replace(/ \+ Equipamentos$/, ''))}) e por isso aparece em mais de uma Escala do dia.${completo() ? ' Toque em Editar, escolha a área de atuação certa e salve: ela fica só nesse lugar.' : ' Peça ao administrador para abrir Editar e salvar a ficha: ela fica só na área escolhida.'}</div>` : ''}
    ${aba === 'lot' ? '<p class="muted small m0">O supervisor imediato é o líder da ficha do líder (o mesmo que agrupa a Frequência). Área de atuação e rota vêm das Atividades e dos Equipamentos.</p>' : ''}
  </div></div>`;
}

// Aba Férias da ficha: resumo (agora, próximas, data limite) e todos os períodos; tocar num período abre para editar.
function vFeriasFicha(c) {
  if (!ferPronto()) return carregando();
  const per = feriasDe(c); const r = resumoFeriasPessoa(per, TODAY);
  const novo = editaFerias() && ativo(c) ? botaoAcao('Novas férias', `data-act="coFerNova" data-mat="${esc(c.mat)}"`, I.plus) : '';
  const resumo = dados([
    ['Agora', r.atual ? `${etiqueta('De férias', 'atencao')} ${dBR(r.atual.inicio)} a ${dBR(r.atual.termino)} <span class="muted small">· volta ${dBR(r.atual.retorno)}</span>` : 'Trabalhando'],
    ['Próximas férias', r.proxima ? `${dBR(r.proxima.inicio)} a ${dBR(r.proxima.termino)} <span class="muted small">· ${r.proxima.dias || ''} dias</span>` : ''],
    ['Data limite', r.limite ? `${dBR(r.limite)}${r.limite < TODAY ? ` ${etiqueta('Vencida', 'critico')}` : limiteProximo(per, TODAY) ? ` ${etiqueta('Em 60 dias', 'critico')}` : ''}` : r.marcada ? '<span class="muted">Férias já marcadas</span>' : '']]);
  if (!per.length) return `${resumo}${vazio('Nenhum período de férias', 'Lance as férias aqui ou importe a planilha em Frequência › Importar planilhas.', novo)}`;
  const cel = isMobile();
  const per1 = f => `<button type="button" class="btn ghost link" data-act="coFer" data-id="${esc(f.id)}">${f.inicio ? `${dBR(f.inicio)} a ${dBR(f.termino)}` : `Planejada${f.mesPlanejado ? ' para ' + f.mesPlanejado.slice(5) + '/' + f.mesPlanejado.slice(0, 4) : ''}`}</button>${f.substituto ? `<div class="muted small">${esc(f.substituto)}</div>` : ''}`;
  const etq = f => { const s = situacaoPeriodo(f, TODAY); return etiqueta(s.t, s.s); };
  const colunas = cel ? [{ t: 'Período' }, { t: 'Situação' }] : [{ t: 'Período' }, { t: 'Dias', n: true }, { t: 'Retorno' }, { t: 'Data limite' }, { t: 'Situação' }];
  const linhas = per.map(f => (cel
    ? [`${per1(f)}<div class="muted small">${f.inicio ? `${f.dias || ''} dias · volta ${dBR(f.retorno)}` : ''}${f.limite ? ` · limite ${dBR(f.limite)}` : ''}</div>`, etq(f)]
    : [per1(f), f.inicio ? String(f.dias || '') : '', dBR(f.retorno) || '—', dBR(f.limite) || '—', etq(f)]));
  return `${resumo}${novo ? `<div class="row-gap">${novo}</div>` : ''}${tabela(colunas, linhas, { rotulo: 'Férias de ' + title(c.nome) })}`;
}

export function vColaboradores() {
  if (!pronto()) return carregando();
  if (C.mat) { const c = lista().find(x => String(x.mat) === String(C.mat)); if (c) return vFicha(c); C.mat = null; }
  return vLista();
}

// ---- edição ----
// RH · Administrativo: só os dados do cadastro. Nome e função só no cadastro novo (depois mudam também Atividades e
// Equipamentos e ficam com o administrador, no formulário completo).
function formRH(mat) {
  const c = mat ? lista().find(x => String(x.mat) === String(mat)) : { mat: '', nome: '', funcao: '', turma: '', lider: '', adm: TODAY, dem: '', intAnt: false, area: AREA_GERAL };
  if (!c) return;
  const L = lista();
  const opLider = () => lideresDasFichas(L, TODAY).map(l => ({ v: l.nome, t: title(l.nome), d: `${l.ativos} pessoa${l.ativos === 1 ? '' : 's'}` }));
  const dl = (id, campo) => `<datalist id="${id}">${[...new Set(['Coqueria - Geral', 'Coqueria - Pátio', 'Coqueria - Bateria', ...L.map(x => x[campo]).filter(Boolean)])].sort().map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  formSheet(mat ? 'Editar cadastro' : 'Novo colaborador', mat ? `${esc(title(c.nome))} · ${esc(c.mat)}` : 'Entra sem área de atuação; o administrador coloca na área e na rota', `
    <div class="row2"><label class="sel"><span>Matrícula Dikma</span><input class="in" id="coMat" value="${esc(c.mat)}" ${mat ? 'readonly' : ''} inputmode="numeric"></label>
    <label class="sel"><span>Matrícula Arcelor</span><input class="in" id="coArc" value="${esc(c.matArc || '')}" autocomplete="off"></label></div>
    ${mat ? '' : `<label class="sel"><span>Nome completo</span><input class="in" id="coNome" value=""></label>
    <label class="sel"><span>Função</span><input class="in" id="coFun" list="coDlFun" autocomplete="off" placeholder="Escolha da lista ou digite"><datalist id="coDlFun">${PES.funcoes().map(f => `<option value="${esc(f)}"></option>`).join('')}</datalist></label>`}
    <div class="row2"><label class="sel"><span>Admissão</span><input class="in" type="date" id="coAdm" value="${c.adm || ''}"></label><label class="sel"><span>Demissão</span><input class="in" type="date" id="coDem" value="${c.dem || ''}"></label></div>
    <div class="row2"><label class="sel"><span>Área (RH)</span><input class="in" id="coSetor" list="coDlSetor" autocomplete="off" value="${esc(c.setor || '')}" placeholder="Ex.: Coqueria - Pátio">${dl('coDlSetor', 'setor')}</label>
    <label class="sel"><span>Setor (RH)</span><input class="in" id="coSub" list="coDlSub" autocomplete="off" value="${esc(c.subsetor || '')}" placeholder="Ex.: Coqueria - Recebimento">${dl('coDlSub', 'subsetor')}</label></div>
    <div class="row2"><label class="sel"><span>Turma / turno (ficha)</span><input class="in" id="coTur" value="${esc(c.turma || '')}"></label><div class="sel"><span>Líder imediato</span>${campoBusca('coLid', nomeLider(c.lider), opLider, { livre: true, maiusculas: true, vazio: 'sem líder', placeholder: 'Escolha da lista ou digite' })}</div></div>
    ${mat ? `<label class="sel"><span>A troca de turma / turno vale a partir de</span><input class="in" type="date" id="coDesde" value="${TODAY}"></label>` : ''}
    ${mat ? '<p class="muted small m0">A letra da turma e a escala de turno valem pelo campo "Turma / turno" desta ficha (ex.: C, TURMA C, 4X4 C ou ADM). Nome, função, área de atuação e rota mudam também Atividades e Equipamentos: quem altera é o administrador.</p>' : ''}`, 'Salvar', async () => {
    const n = { ...c, matArc: $('coArc').value.trim().toUpperCase(), adm: $('coAdm').value || null, dem: $('coDem').value || null, setor: $('coSetor').value.trim(), subsetor: $('coSub').value.trim(), turma: $('coTur').value.trim().toUpperCase(), lider: nomeLider($('coLid').value) };
    if (!mat) Object.assign(n, { mat: $('coMat').value.trim().replace(/\.0$/, ''), nome: $('coNome').value.trim().toUpperCase().replace(/\s+/g, ' '), funcao: $('coFun').value.trim().toUpperCase() });
    validar(n, mat);
    if (mat) { const h = anotarTroca(c, n, ['turma'], ($('coDesde') && $('coDesde').value) || TODAY); if (h.length) n.escHist = h; else delete n.escHist; }
    if (!n.matArc) delete n.matArc;
    await DB.rhSalvarFicha(n);
    DB.log(`RH: ${mat ? 'editou o cadastro de' : 'cadastrou'} ${title(n.nome)}`, 'rh');
    toast(mat ? 'Cadastro atualizado' : 'Colaborador cadastrado');
  });
}
// Conferências comuns aos dois formulários (também usada pelo formulário completo da Gestão).
export function validar(n, mat, L = lista()) {
  if (!n.mat || !n.nome) throw new Error('Informe matrícula Dikma e nome.');
  if (!mat && L.some(x => String(x.mat) === String(n.mat))) throw new Error('Já existe um colaborador com essa matrícula Dikma.');
  if (n.matArc) { const o = L.find(x => x.matArc && String(x.matArc) === String(n.matArc) && String(x.mat) !== String(n.mat)); if (o) throw new Error(`A matrícula Arcelor ${n.matArc} já é de ${title(o.nome)}.`); }
  if (n.dem && n.adm && n.dem < n.adm) throw new Error('A demissão não pode ser antes da admissão.');
}
// Administrador: o formulário completo da Gestão (área, rota, função e escala, que vão para os outros módulos).
const comGestao = fn => carregarModulo('GE').then(m => { if (m) fn(m); });

acoes.coFicha = (t, d) => { C.mat = d.mat; C.aba = 'dados'; render(); scrollTo(0, 0); };
acoes.coVoltar = () => { C.mat = null; render(); };
acoes.coEditar = (t, d) => (completo() ? comGestao(m => m.editarColab(d.mat)) : formRH(d.mat));
acoes.coNovo = () => (completo() ? comGestao(m => m.editarColab(null)) : formRH(null));
acoes.coLideres = () => { if (completo()) comGestao(m => m.lideres()); };
acoes.coFer = (t, d) => comFerias(m => m.formFerias(d.id));
acoes.coFerNova = (t, d) => { const c = lista().find(x => String(x.mat) === String(d.mat)); if (c) comFerias(m => m.formFerias(null, { nome: c.nome, mat: c.mat, setor: c.setor || '' })); };
acoes.coExpFerias = () => comFerias(m => m.exportarFerias());
document.addEventListener('click', e => { const t = e.target.closest('[data-co-aba]'); if (!t || UI.view !== 'rcolab') return; C.aba = t.dataset.coAba; render(); });
document.addEventListener('input', e => {
  if (e.target.id !== 'coQ') return;
  C.q = e.target.value; UI.more = 0; clearTimeout(window._coq);
  window._coq = setTimeout(() => { const pos = e.target.selectionStart; render(); const n = $('coQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
});
document.addEventListener('change', e => {
  if (e.target.id === 'coFa') { C.fa = e.target.value; UI.more = 0; render(); }
  if (e.target.id === 'coF') { C.f = e.target.value; UI.more = 0; render(); }
});
