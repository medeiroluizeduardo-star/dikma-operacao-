// Gestão › Medição: faltas, horas extras, horas perdidas e correções de ICCC/ICCP do mês, para passar à medição oficial.
// Uso coletivo (era a Medição do Meu painel, pessoal): o "lançado" é o mesmo para todos, com quem marcou e quando,
// e ninguém lança duas vezes. Faltas e horas extras vêm da Escala do dia (Pátio e Bateria); horas perdidas, das
// paradas dos equipamentos. As contas ficam em contas/medicao.js; o banco, em medicao/{AAAA-MM} (nucleo/data.js).
// Quem vê: administrador e Gestão (Gestor, Coordenador e Administrativo). Quem marca e digita: administrador, Gestor e
// Coordenador da Gestão (o administrador pode tirar em Perfis e permissões › item "Lançar na Medição").
import { TIPOS, CONJ_NOME, registrosPresenca, registrosParadas, juntarMes, ocultosDoMes, pendente, resumoMes, conferirManual, linhasExcel } from '../contas/medicao.js';
import { mesMais, fmtNum } from '../contas/contrato.js';
import { MESES_L, today, foraDaCoqueria } from '../contas/cal.js';
import { colabsDoSet, escala, regimeDe } from '../calc/presenca.js';
import { etiqueta, tabela, vazio, carregando, recolhido } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME, UI, isAdmin, podeItem, setsDe, temEquipEm, perfil, salvarUI } from '../nucleo/estado.js';
import { modulo } from '../nucleo/modulos.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { baixarExcel } from '../ui/exportar.js';

const TODAY = today();
const MES_HOJE = TODAY.slice(0, 7);
const U = () => (UI.md ||= { mes: MES_HOJE, tipo: 'falta', vista: 'coq', so: false, oc: false, q: '' });
const nomeMes = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
const dm = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const fmtH = h => `${fmtNum(h)} h`;

export const veMedicao = () => isAdmin() || ['gestor', 'coordenador', 'administrativo'].includes(perfil('gestao'));
export const editaMedicao = () => isAdmin() || (['gestor', 'coordenador'].includes(perfil('gestao')) && podeItem('i_medicao', 'gestao'));
const conjs = () => setsDe(ME, 'gestao').filter(k => k === 'patio' || k === 'bateria');
const temEq = () => temEquipEm(ME, 'gestao');
function vista() {
  const cs = conjs(); const u = U();
  if (cs.length < 2) u.vista = cs[0] || 'coq';
  else if (u.vista !== 'coq' && !cs.includes(u.vista)) u.vista = 'coq';
  return u.vista;
}
const conjsDaVista = v => (v === 'coq' ? conjs() : [v]);

/* ---------- dados do mês ---------- */
// Faltas e horas extras de um conjunto no mês; null enquanto carrega.
const MEMO = new Map();
function presencaConj(k, ym) {
  const st = DB.dados(k); if (!st || !st.config) return null;
  if (DB.watchMonthsDe) DB.watchMonthsDe(k, [ym]);
  if (!st.monthsLoaded || !st.monthsLoaded.has(ym)) return null;
  if (!DB.isMock && (!(ym in (st.sitByMonth || {})) || !st.colabsLoaded)) return null;
  const sit = (st.sitByMonth || {})[ym] || {};
  const ch = `${k}|${ym}`; const m = MEMO.get(ch);
  if (m && m.sit === sit && m.ex === (st.sitExtra || {})[ym] && m.cs === st.colabs) return m.out;
  const hc = { ciclo: 12, adm: 8, ...((st.config.he) || {}) };
  const out = registrosPresenca({ k, colabs: colabsDoSet(k).filter(c => !foraDaCoqueria(c.area)), sit, info: key => DB.sitInfo(key, k), ym, hoje: TODAY,
    estimativa: (c, dt) => { if (!c) return hc.adm; const r = escala().regimes[regimeDe(c, dt)]; return r && r.tipo === 'ciclo' ? hc.ciclo : hc.adm; } });
  MEMO.set(ch, { sit, ex: (st.sitExtra || {})[ym], cs: st.colabs, out }); return out;
}
// Horas perdidas (paradas) do mês; [] sem acesso a Equipamentos; null enquanto carrega.
function paradas(ym) {
  if (!temEq()) return [];
  const EQ = modulo('EQ'); if (!EQ || !EQ.paradasMes) return null;
  const x = EQ.paradasMes(ym, true); if (!x) return null;
  return registrosParadas(x.paradas, ym, TODAY, x.respDe);
}
function docMes(ym) { if (DB.medWatch) DB.medWatch(ym); return (DB.cache.med || {})[ym] || null; }
// Tudo do mês na vista: { regs, ocultos, falta } (falta = algo ainda carregando).
function dadosMes(ym, v) {
  const ks = conjsDaVista(v); const d = docMes(ym);
  const pres = ks.map(k => presencaConj(k, ym)); const par = paradas(ym);
  const falta = !d || pres.some(p => !p) || !par;
  const auto = [...pres.filter(Boolean).flat(), ...(par || []).filter(r => v === 'coq' ? !r.conj || ks.includes(r.conj) : r.conj === v)];
  const regs = juntarMes(auto, d && d.d).filter(r => r.tipo === 'ind' || v === 'coq' || r.conj === v);
  return { regs, ocultos: ocultosDoMes(auto, d && d.d), falta, erro: d && d.erro };
}

/* ---------- desenho ---------- */
const marcaTxt = l => (l ? `${l.nome ? esc(l.nome.split(' ')[0]) : 'alguém'}${l.em ? ' · ' + dm(l.em) : ''}` : '');
function cartoes(r, u) {
  const c = (k, rot, v, sub, sit) => `<button type="button" class="p-ind ic-card md-card ${sit}${u.tipo === k ? ' md-on' : ''}" data-act="mdTipo" data-v="${k}"><span class="p-ind-rot">${esc(rot)}</span><span class="p-ind-v">${v}</span><span class="p-ind-pe">${sub}</span></button>`;
  return `<div class="md-cards">${[
    c('falta', 'Faltas', r.falta.n, `${r.falta.pend} a lançar · ${r.falta.semJus} sem justificativa`, r.falta.pend ? 'atencao' : ''),
    c('he', 'Horas extras', `${fmtNum(r.he.horas)}<small>h</small>`, `${r.he.n} lançamento${r.he.n === 1 ? '' : 's'} · ${r.he.pend} a lançar`, r.he.pend ? 'atencao' : ''),
    c('hp', 'Horas perdidas', `${fmtNum(r.hp.horas)}<small>h</small>`, `${r.hp.eqs} equipamento${r.hp.eqs === 1 ? '' : 's'} · ${r.hp.pend} a lançar`, r.hp.pend ? 'atencao' : ''),
    c('ind', 'ICCC / ICCP', r.ind.pend, `pendente${r.ind.pend === 1 ? '' : 's'} · ${r.ind.ok} corrigida${r.ind.ok === 1 ? '' : 's'}`, r.ind.pend ? 'critico' : '')
  ].join('')}</div>`;
}
function botoes(r, ed) {
  if (!ed) return r.tipo === 'ind' ? etiqueta(r.st === 'corrigido' ? 'Corrigido' : 'Pendente', r.st === 'corrigido' ? 'ok' : 'critico') : r.lanc ? etiqueta('Lançado', 'ok') : etiqueta('A lançar', 'atencao');
  const tog = r.tipo === 'ind'
    ? `<button type="button" class="btn sm md-tog${r.st === 'corrigido' ? ' on' : ''}" data-act="mdInd" data-id="${esc(r.id)}" aria-pressed="${r.st === 'corrigido'}">${r.st === 'corrigido' ? I.ok + ' Corrigido' : 'Pendente'}</button>`
    : `<button type="button" class="btn sm md-tog${r.lanc ? ' on' : ''}" data-act="mdLanc" data-id="${esc(r.id)}" aria-pressed="${!!r.lanc}">${r.lanc ? I.ok + ' Lançado' : 'A lançar'}</button>`;
  const tirar = r.origem === 'auto'
    ? `<button type="button" class="btn ghost sm" data-act="mdOcultar" data-id="${esc(r.id)}" title="Some da Medição; na Escala do dia e nos Equipamentos continua">Ocultar</button>`
    : `<button type="button" class="btn ghost sm" data-act="mdApagar" data-id="${esc(r.id)}">${r.tambem ? 'Apagar o digitado' : 'Excluir'}</button>`;
  return `<span class="md-bts">${tog}${tirar}</span>`;
}
function linhas(lista, tipo, ed) {
  const T = TIPOS[tipo];
  const selo = r => (r.origem === 'auto' ? '' : r.tambem ? ' <span class="tag" title="Digitado aqui e também veio do sistema: aparece uma vez só">também no sistema</span>' : ' <span class="tag">digitado</span>');
  const quem = r => `<b>${esc(r.quem || '')}</b>${selo(r)}<br><span class="muted small">${esc(CONJ_NOME[r.conj] || '')}${r.semHora ? ' · <b class="md-aviso">sem horário</b>' : ''}</span>`;
  const sit = r => `${botoes(r, ed)}${r.lanc ? `<br><span class="muted small">por ${marcaTxt(r.lanc)}</span>` : ''}`;
  const desc = r => `${tipo !== 'he' && r.cat ? `<b>${esc(r.cat)}</b>${r.desc ? ' · ' : ''}` : ''}${esc(r.desc || '')}`;
  const cols = tipo === 'ind' ? [{ t: 'Data' }, { t: 'Indicador' }, { t: 'Divergência' }, { t: 'Situação' }]
    : [{ t: 'Data' }, { t: T.who }, { t: tipo === 'falta' ? 'Tipo · justificativa' : tipo === 'hp' ? 'Motivo · observação' : 'Motivo' }, ...(T.horas ? [{ t: 'Horas', n: true }] : []), { t: 'Situação' }];
  const ls = lista.map(r => tipo === 'ind' ? [dm(r.data), `<b>${esc(r.cat)}</b>`, esc(r.desc || ''), sit(r)]
    : [dm(r.data), quem(r), desc(r), ...(T.horas ? [`<span class="mono">${fmtH(r.horas)}</span>`] : []), sit(r)]);
  return tabela(cols, ls, { rotulo: T.l });
}
function vMedicao() {
  const cs = conjs();
  if (!cs.length) return vazio('Sem conjunto no seu acesso', 'A Medição usa a Escala do dia de Pátio e Bateria. Peça ao administrador para incluir o conjunto no seu acesso à Gestão.');
  const u = U(); const v = vista(); const ym = u.mes; const ed = editaMedicao();
  const { regs, ocultos, falta, erro } = dadosMes(ym, v);
  if (falta && !regs.length) return carregando();
  if (!ocultos.length) u.oc = false;
  const r = resumoMes(regs); const T = TIPOS[u.tipo];
  const q = (u.q || '').toLowerCase();
  const lista = regs.filter(x => x.tipo === u.tipo && (!u.so || pendente(x)) && (!q || `${x.quem || ''} ${x.desc || ''} ${x.cat || ''}`.toLowerCase().includes(q)));
  let h = `<p class="ic-placar">${esc(nomeMes(ym))}${ym === MES_HOJE ? ' até hoje' : ''} · faltas e horas extras vêm da Escala do dia, horas perdidas das paradas dos equipamentos${temEq() ? '' : ' (sem acesso a Equipamentos: as horas perdidas não aparecem)'}. ${ed ? 'Marque “lançado” quando passar para a medição oficial: vale para todos.' : 'Somente leitura.'}</p>`;
  if (erro) h += `<p class="err">Não foi possível ler as marcações da Medição (${esc(erro)}). Os números do sistema aparecem, mas sem o “lançado”.</p>`;
  if (falta) h += '<p class="muted small" aria-busy="true">Carregando o resto do mês…</p>';
  h += cartoes(r, u);
  const seg = `<div class="seg md-tipos" role="tablist" aria-label="Tipo">${Object.entries(TIPOS).map(([k, t]) => `<button type="button" role="tab" data-act="mdTipo" data-v="${k}" aria-selected="${u.tipo === k}">${esc(t.l)} <span class="muted">${regs.filter(x => x.tipo === k).length}</span></button>`).join('')}</div>`;
  h += `<div class="md-barra">${seg}<label class="sel md-busca"><span>Buscar</span><input class="in" id="mdQ" type="search" value="${esc(u.q || '')}" placeholder="Nome, motivo…" autocomplete="off"></label>
    <button type="button" class="btn sm${u.so ? ' pri' : ''}" data-act="mdSo" aria-pressed="${u.so}">Só a lançar</button>
    ${ocultos.length ? `<button type="button" class="btn sm ghost" data-act="mdOc" aria-pressed="${u.oc}">${u.oc ? 'Esconder' : 'Mostrar'} ocultos (${ocultos.length})</button>` : ''}
    ${ed ? `<button type="button" class="btn sm" data-act="mdNovo">${I.plus} ${u.tipo === 'ind' ? 'Registrar correção' : 'Registrar ' + T.one}</button>` : ''}</div>`;
  if (u.oc && ocultos.length) h += recolhido(`Ocultos da Medição · ${ocultos.length}`, tabela([{ t: 'Data' }, { t: 'Registro' }, { t: 'Detalhe' }, { t: '' }], ocultos.map(o => [dm(o.data), `<b>${esc(o.quem || '')}</b> <span class="tag">${esc(TIPOS[o.tipo].one)}</span>`, esc(o.desc || ''), ed ? `<button type="button" class="btn sm" data-act="mdVoltar" data-id="${esc(o.id)}">Voltar para a Medição</button>` : '']), { rotulo: 'Ocultos' }), true);
  h += lista.length ? linhas(lista, u.tipo, ed) : vazio(`Nenhum registro de ${T.l.toLowerCase()} em ${nomeMes(ym)}`, u.so ? 'Tudo lançado. Desligue “Só a lançar” para ver todos.' : u.tipo === 'ind' ? 'Registre aqui o que estiver errado no ICCC ou no ICCP da medição, até ser corrigido.' : 'Nada lançado no sistema neste mês.');
  if (lista.length && T.horas) h += `<p class="muted small md-total">Total: <b>${fmtH(Math.round(lista.reduce((s, x) => s + (Number(x.horas) || 0), 0) * 100) / 100)}</b></p>`;
  return h;
}

/* ---------- ações ---------- */
const marca = () => ({ por: ME.uid, nome: ME.nome || ME.login || '', em: new Date().toISOString().slice(0, 16) });
const regDe = id => dadosMes(U().mes, vista()).regs.find(r => r.id === id);
const gravar = (campo, id, val, msg) => DB.medGravar(U().mes, campo, id, val).then(() => { if (msg) toast(msg); }, e => toast('Não foi possível gravar: ' + (e.code === 'permission-denied' ? 'sem permissão' : e.message || 'erro')));
acoes.mdTipo = (t, d) => { U().tipo = d.v; salvarUI(); render(); };
acoes.mdSo = () => { U().so = !U().so; render(); };
acoes.mdOc = () => { U().oc = !U().oc; render(); };
acoes.mdVista = (t, d) => { U().vista = d.v; render(); };
acoes.mdLanc = (t, d) => {
  if (!editaMedicao()) return; const r = regDe(d.id); if (!r) return;
  // Digitado que repete um do sistema: a marca vale para os dois.
  const ids = [r.id, ...(r.tambem ? [r.tambem] : [])];
  ids.forEach(id => gravar('l', id, r.lanc ? null : marca()));
  if (!r.lanc) DB.log(`Medição ${nomeMes(U().mes)}: ${TIPOS[r.tipo].one} de ${r.quem || ''} (${dm(r.data)}) lançada`, 'gestao');
};
acoes.mdInd = (t, d) => {
  if (!editaMedicao()) return; const r = regDe(d.id); if (!r || r.origem !== 'man') return;
  const { id, origem, lanc, tambem, ...dados } = r; // eslint-disable-line no-unused-vars
  gravar('man', id, { ...dados, st: r.st === 'corrigido' ? 'pendente' : 'corrigido', ...(r.st === 'corrigido' ? {} : { corr: marca() }) });
};
acoes.mdOcultar = (t, d) => { if (!editaMedicao()) return; gravar('oc', d.id, marca(), 'Oculto da Medição. Use “Mostrar ocultos” para voltar.'); };
acoes.mdVoltar = (t, d) => { if (!editaMedicao()) return; gravar('oc', d.id, null, 'De volta na Medição'); };
acoes.mdApagar = (t, d) => {
  if (!editaMedicao()) return; const r = regDe(d.id); if (!r || r.origem !== 'man') return;
  if (UI.mdArm !== d.id) { UI.mdArm = d.id; toast('Toque de novo em Excluir para confirmar'); setTimeout(() => { if (UI.mdArm === d.id) UI.mdArm = null; }, 4000); return; }
  UI.mdArm = null; gravar('man', r.id, null, r.tambem ? 'Digitado apagado: fica o do sistema' : 'Registro excluído'); gravar('l', r.id, null);
  DB.log(`Medição ${nomeMes(U().mes)}: registro digitado apagado (${TIPOS[r.tipo].one} ${r.quem || r.cat || ''} ${dm(r.data)})`, 'gestao');
};
acoes.mdNovo = () => {
  if (!editaMedicao()) return;
  const u = U(); const tipo = u.tipo; const T = TIPOS[tipo]; const ym = u.mes; const cs = conjs();
  const padrao = ym === MES_HOJE ? TODAY : ym + '-01';
  const ult = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);
  const nomes = [...new Set(dadosMes(ym, 'coq').regs.filter(r => r.tipo === tipo && r.quem).map(r => r.quem))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const vConj = vista() === 'coq' ? cs[0] : vista();
  formSheet(tipo === 'ind' ? 'Correção de ICCC / ICCP' : `Registrar ${T.one}`, `${esc(nomeMes(ym))} · digitado à mão (o que já está na Escala do dia ou nos Equipamentos aparece sozinho)`,
    `<div class="p-form"><label class="sel"><span>Data</span><input class="in" id="mdData" type="date" min="${ym}-01" max="${ult}" value="${padrao}"></label>
    ${T.who ? `<label class="sel"><span>${esc(T.who)}</span><input class="in" id="mdQuem" list="mdNomes" maxlength="120" autocomplete="off" placeholder="${tipo === 'hp' ? 'Ex.: Pá carregadeira 03' : 'Nome do colaborador'}"><datalist id="mdNomes">${nomes.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>` : ''}
    ${tipo !== 'ind' ? `<label class="sel"><span>Conjunto</span><select class="in" id="mdConj">${cs.map(k => `<option value="${k}" ${k === vConj ? 'selected' : ''}>${CONJ_NOME[k]}</option>`).join('')}</select></label>` : ''}
    ${T.cat ? `<label class="sel"><span>${esc(T.cat)}</span><select class="in" id="mdCat">${T.cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>` : ''}
    ${T.horas ? '<label class="sel"><span>Horas</span><input class="in" id="mdHoras" inputmode="decimal" autocomplete="off" placeholder="Ex.: 2,5"></label>' : ''}
    <label class="sel"><span>${esc(T.desc)}${tipo === 'ind' ? '' : ' (opcional)'}</span><input class="in" id="mdDesc" maxlength="300" placeholder="${tipo === 'ind' ? 'O que estava errado na medição' : ''}"></label></div>`, 'Registrar', async () => {
      const val = id => (document.getElementById(id) || {}).value || '';
      const reg = conferirManual(tipo, { data: val('mdData'), quem: val('mdQuem'), conj: val('mdConj'), cat: val('mdCat'), horas: val('mdHoras'), desc: val('mdDesc') }, ym);
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await DB.medGravar(ym, 'man', id, { ...reg, ...marca() });
      DB.log(`Medição ${nomeMes(ym)}: ${T.one} digitada (${reg.quem || reg.cat} ${dm(reg.data)})`, 'gestao');
      toast(`${T.one[0].toUpperCase() + T.one.slice(1)} registrada`); render();
    });
};
acoes.expMedicao = async () => {
  const ym = U().mes; const v = vista(); const { regs, falta } = dadosMes(ym, v);
  if (falta) { toast('Espere o mês terminar de carregar'); return; }
  await baixarExcel(`Medição - ${v === 'coq' ? 'Coqueria' : CONJ_NOME[v]} - ${ym}`, linhasExcel(regs)).catch(e => toast(e.message || 'Não foi possível exportar'));
};
document.addEventListener('change', e => { if (e.target && e.target.id === 'mdMes') { U().mes = e.target.value; render(); } });
document.addEventListener('input', e => { if (e.target && e.target.id === 'mdQ') { U().q = e.target.value; clearTimeout(window._mdq); window._mdq = setTimeout(() => { render(); const i = document.getElementById('mdQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); } });

/* ---------- topo ---------- */
export function topo() {
  const u = U(); const cs = conjs(); const v = vista();
  const ops = []; for (let i = 0; i < 13; i++) ops.push(mesMais(MES_HOJE, -i));
  const sw = cs.length > 1 ? `<div class="seg setsw ic-sw" role="tablist" aria-label="Conjunto">${[['coq', 'Coqueria'], ...cs.map(k => [k, CONJ_NOME[k]])].map(([k, t]) => `<button type="button" role="tab" data-act="mdVista" data-v="${k}" aria-selected="${v === k}">${esc(t)}</button>`).join('')}</div>` : '';
  const mes = `<label class="sel"><span>Mês</span><select class="in" id="mdMes">${ops.map(m => `<option value="${m}" ${m === u.mes ? 'selected' : ''}>${esc(nomeMes(m))}</option>`).join('')}</select></label>`;
  return sw + mes + `<button type="button" class="btn" data-act="expMedicao">${I.dl} Exportar mês</button>`;
}
export const renderView = () => vMedicao();
