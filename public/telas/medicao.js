// Gestão › Medição: real × contratado por função no mês (Pátio ou Bateria), como na planilha de medição do contrato.
// A conta fica em contas/medicao.js; aqui só a tela, o ajuste do contratado e a exportação.
import { SETS, ddmm, monthLabel } from '../contas/cal.js';
import { BASES, REGS, REG_NOME, idLinha, medir, cfgMedicao, chaveFuncao, baseDe } from '../contas/medicao.js';
import { escala, regimeDe, sitDia, colabsDa } from '../calc/presenca.js';
import { registrosHE, fmtH } from './horas-justificativas.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, TODAY, framed, esc, title, $ } from '../nucleo/base.js';
import { SK, UI, admDe } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';
import { indicadores, tabela, etiqueta, recolhido, vazio } from '../ui/padrao.js';

const cfgAtual = () => cfgMedicao(DB.cache.config && DB.cache.config.medicao);
const regDe = (c, d) => { const r = escala().regimes[regimeDe(c, d)]; return r && r.tipo === 'ciclo' ? 'TURNO' : 'ADM'; };
function calcular(m) {
  const pessoas = colabsDa('TODAS');
  return medir({ m, pessoas, sitDe: (c, d) => sitDia(c, d).v, regDe, he: registrosHE('TODAS', m), feriados: escala().feriados, hoje: TODAY, cfg: DB.cache.config && DB.cache.config.medicao });
}
const n1 = v => (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const nomeLinha = l => (l.fixo ? l.nome : `${l.nome} · ${REG_NOME[l.reg]}`);
const difTxt = v => (v > 0 ? '+' : '') + n1(v);
const tomDif = (l) => (!(l.cont > 0) ? 'neutro' : l.dif >= 0 ? 'ok' : l.dif >= -l.cont * 0.1 ? 'atencao' : 'critico');

export function vMedicao() {
  const m = UI.mes; const r = calcular(m); const ed = admDe('ativ'); const T = r.total;
  const semCfg = !r.linhas.some(l => l.cont > 0);
  const botoes = `<div class="row-gap">${ed ? `<button class="btn" data-act="mdAjustar">${I.contrato} Ajustar contratado</button><button class="btn" data-act="mdFuncoes">Ligar funções</button>` : ''}${!framed && !isMobile() ? `<button class="btn" data-act="expMedicao">${I.dl} Exportar</button>` : ''}</div>`;
  const aviso = semCfg ? `<div class="card"><div class="body">${etiqueta('Contratado não cadastrado', 'atencao')} <span class="small">Sem o contratado de cada função, a tela mostra só o real (quem trabalhou). ${ed ? 'Toque em “Ajustar contratado” e digite os números do contrato.' : 'Peça ao administrador para cadastrar os números do contrato.'}</span></div></div>` : '';
  const kpi = indicadores([
    { rotulo: 'Real (FTE)', valor: n1(T.real), meta: '', variacao: T.cont ? `<span>Contratado ${n1(T.cont)}</span>` : '' },
    { rotulo: 'Diferença', valor: T.cont ? difTxt(T.dif) : '—', situacao: !T.cont ? '' : T.dif >= 0 ? 'ok' : 'critico', variacao: T.cont ? `<span>${Math.round(T.real / T.cont * 100)}% do contratado</span>` : '' },
    { rotulo: 'Horas extras', valor: fmtH(T.he), variacao: `<span>Noturna ${fmtH(T.hen)}</span>` },
    { rotulo: 'Faltas', valor: String(T.faltas), situacao: T.faltas ? 'atencao' : '', variacao: `<span>dias no mês</span>` }
  ]);
  const cols = [{ t: 'Função' }, { t: 'Real (FTE)', n: true }, { t: 'Contratado', n: true }, { t: 'Diferença', n: true }, { t: 'Postos/dia', n: true }, { t: 'Acima do contratado', n: true }, { t: 'Horas extras', n: true }, { t: 'HE noturna', n: true }, { t: 'Faltas', n: true }];
  const lin = r.linhas.map(l => [`<b>${esc(nomeLinha(l))}</b><div class="muted small">${l.fixo ? 'valor fixo nos dias úteis' : `${l.pessoas} pessoa${l.pessoas === 1 ? '' : 's'} no mês`}</div>`, `<b>${n1(l.real)}</b>`, l.cont ? n1(l.cont) : '—', l.cont ? etiqueta(difTxt(l.dif), tomDif(l)) : '—', l.postos ? n1(l.postos) : '—', l.acima ? `${l.acima} pessoa-dia` : '—', l.he ? fmtH(l.he) : '—', l.hen ? fmtH(l.hen) : '—', l.faltas || '—']);
  lin.push(['<b>Total</b>', `<b>${n1(T.real)}</b>`, `<b>${T.cont ? n1(T.cont) : '—'}</b>`, T.cont ? `<b>${difTxt(T.dif)}</b>` : '—', `<b>${n1(T.postosAdm + T.postosTurno)}</b>`, T.acima ? `<b>${T.acima}</b>` : '—', `<b>${fmtH(T.he)}</b>`, `<b>${fmtH(T.hen)}</b>`, `<b>${T.faltas}</b>`]);
  const tab = r.linhas.length ? tabela(cols, lin, { rotulo: 'Real × contratado por função' }) : `<div class="body">${vazio('Ninguém com função reconhecida neste mês', 'Confira a função das pessoas em RH › Colaboradores ou use “Ligar funções”.')}</div>`;
  const sem = r.semLinha.length ? `<div class="card"><header><h2>Funções fora da medição</h2><p>Pessoas com função que o sistema não reconheceu${ed ? ' · use “Ligar funções” para escolher a linha de cada uma' : ''}</p></header><div class="body"><div class="rchips">${r.semLinha.map(x => `<span class="rchip">${esc(title(x.nome))} · <b class="num">${x.n}</b></span>`).join('')}</div></div></div>` : '';
  // Dia a dia (como as abas ICCP/ICCC da planilha): só os dias até hoje.
  const ate = r.dias.filter(d => d <= TODAY);
  const grade = ate.length ? tabela([{ t: 'Função' }, ...ate.map(d => ({ t: ddmm(d), n: true })), { t: 'Soma', n: true }], r.linhas.map(l => [esc(nomeLinha(l)), ...ate.map((d, i) => (l.dia[i] ? n1(l.dia[i]) : '·')), `<b>${n1(l.soma)}</b>`]), { rotulo: 'Dia a dia' }) : '<p class="muted small">O mês ainda não começou.</p>';
  const como = `<ul class="small m0"><li>Vale a Presença lançada no sistema: conta quem está presente, atrasado ou com saída antecipada. Hora extra em dia de folga aparece só nas horas extras.</li>
    <li>ADM conta de segunda a sexta (sábado e domingo valem 0). Turno conta todos os dias.</li>
    <li>Em cada dia conta no máximo o número de postos. O que passa disso aparece em “Acima do contratado”.</li>
    <li>Coordenador: valor fixo (os postos) em cada dia útil, porque é dividido entre as áreas.</li>
    <li>Real (FTE) = soma do mês ÷ dias de referência: ADM ${r.refAdm} dias úteis em ${monthLabel(m)} (sem feriados); turno ${n1(r.refTurno)} dias.</li>
    <li>Horas extras vêm do Banco de horas extras (informadas ou estimadas). A noturna é a parte entre 22h e 5h e só aparece quando o horário foi informado.</li>
    <li>É uma prévia para acompanhar o mês. A medição oficial continua sendo a do ponto.</li></ul>`;
  return aviso + kpi + `<div class="card"><header><h2>Real × contratado por função</h2><p>${monthLabel(m)} · ${esc(SETS[SK].nome)} · até ${ddmm(TODAY < r.dias[r.dias.length - 1] ? TODAY : r.dias[r.dias.length - 1])}</p></header><div class="body pt0">${botoes}</div>${tab}</div>`
    + sem + `<div class="card"><div class="body">${recolhido('Dia a dia', grade)}${recolhido('Como é calculado', como)}</div></div>`;
}

// Ajuste do contratado: postos por dia e contratado (FTE) de cada função, ADM e turno, e os dias de referência do turno.
function ajustar() {
  if (!admDe('ativ')) return;
  const cfg = cfgAtual(); const lins = [];
  for (const b of BASES) for (const reg of REGS) { if (b.fixo && reg === 'TURNO') continue; lins.push({ id: idLinha(b.k, reg), nome: b.fixo ? b.nome : `${b.nome} · ${REG_NOME[reg]}` }); }
  const campo = (l, i) => { const v = cfg.n[l.id] || {}; return `<div class="g2eq"><label class="sel"><span>${esc(l.nome)} · postos/dia</span><input class="in" type="number" inputmode="decimal" min="0" max="500" step="0.5" id="mdP${i}" value="${v.postos || ''}" placeholder="0"></label><label class="sel"><span>Contratado (FTE)</span><input class="in" type="number" inputmode="decimal" min="0" max="500" step="0.5" id="mdC${i}" value="${v.cont || ''}" placeholder="0"></label></div>`; };
  formSheet('Contratado da medição', `${esc(SETS[SK].nome)} · os números do contrato de cada função. Postos/dia = quantos contam no máximo por dia. Contratado = o efetivo do mês (FTE).`,
    `<label class="sel"><span>Dias de referência do turno (por pessoa no mês)</span><input class="in" type="number" min="1" max="31" step="0.5" id="mdRef" value="${cfg.refTurno}"></label>${lins.map(campo).join('')}`, 'Salvar', async () => {
      const n = {}; lins.forEach((l, i) => { const p = Math.max(0, +String($('mdP' + i).value).replace(',', '.') || 0), c = Math.max(0, +String($('mdC' + i).value).replace(',', '.') || 0); if (p > 500 || c > 500) throw new Error(`${l.nome}: número alto demais.`); if (p || c) n[l.id] = { postos: p, cont: c }; });
      const ref = +$('mdRef').value; if (!(ref >= 1 && ref <= 31)) throw new Error('Dias de referência do turno: de 1 a 31.');
      await DB.saveConfig({ medicao: { ...cfg, refTurno: ref, n } });
      DB.log(`Medição (${SETS[SK].curto}): contratado atualizado`, 'gestao'); toast('Contratado salvo'); render();
    });
}
// Ligar funções: em que linha da medição entra cada função do cadastro (ou fora da medição).
function ligarFuncoes() {
  if (!admDe('ativ')) return;
  const cfg = cfgAtual(); const fs = new Map();
  for (const c of colabsDa('TODAS')) { const k = chaveFuncao(c.funcao) || ''; if (!k) continue; const x = fs.get(k) || { n: 0, nome: String(c.funcao).replace(/\(\s*[A-Za-z]\s*\)\s*$/, '').trim() }; x.n++; fs.set(k, x); }
  const lista = [...fs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!lista.length) { toast('Ninguém com função no cadastro deste conjunto'); return; }
  const opc = k => { const atual = baseDe(k, cfg.mapa) || ''; return `<option value="">Fora da medição</option>${BASES.map(b => `<option value="${b.k}" ${b.k === atual ? 'selected' : ''}>${esc(b.nome)}</option>`).join('')}`; };
  formSheet('Ligar funções', `${esc(SETS[SK].nome)} · em que função do contrato entra cada função do cadastro. ADM ou turno vem da escala de cada pessoa.`,
    lista.map(([k, x], i) => `<label class="sel"><span>${esc(title(x.nome))} · ${x.n} pessoa${x.n === 1 ? '' : 's'}</span><select class="in" id="mdF${i}">${opc(k)}</select></label>`).join(''), 'Salvar', async () => {
      const mapa = { ...cfg.mapa };
      lista.forEach(([k], i) => { const v = $('mdF' + i).value; const auto = baseDe(k, {}) || ''; if (v === auto) delete mapa[k]; else mapa[k] = v; });
      await DB.saveConfig({ medicao: { ...cfg, mapa } });
      DB.log(`Medição (${SETS[SK].curto}): funções ligadas`, 'gestao'); toast('Funções salvas'); render();
    });
}
function exportar() {
  const m = UI.mes; const r = calcular(m);
  const res = [['Função', 'Regime', 'Postos/dia', 'Contratado', 'Real (FTE)', 'Diferença', 'Acima do contratado (pessoa-dia)', 'Horas extras', 'HE noturna', 'Faltas', 'Pessoas']];
  r.linhas.forEach(l => res.push([l.nome, REG_NOME[l.reg], l.postos, l.cont, l.real, l.dif, l.acima, l.he, l.hen, l.faltas, l.pessoas]));
  res.push(['Total', '', r.total.postosAdm + r.total.postosTurno, r.total.cont, r.total.real, r.total.dif, r.total.acima, r.total.he, r.total.hen, r.total.faltas, '']);
  const dia = [['Função', 'Regime', ...r.dias.map(dataBR), 'Soma']];
  r.linhas.forEach(l => dia.push([l.nome, REG_NOME[l.reg], ...l.dia.map(v => (v == null ? '' : v)), l.soma]));
  const ft = [['Data', 'Nome', 'Função', 'Linha da medição', 'Área', 'Rota']];
  r.linhas.forEach(l => l.faltasLista.forEach(x => ft.push([dataBR(x.d), title(x.c.nome), x.c.funcao || '', nomeLinha(l), x.c.area, x.c.rota])));
  ft.splice(1, ft.length, ...ft.slice(1).sort((a, b) => (a[0].split('/').reverse().join() < b[0].split('/').reverse().join() ? -1 : 1)));
  const info = [['Medição', `${SETS[SK].nome} · ${monthLabel(m)}`], ['Dias úteis (ADM)', r.refAdm], ['Dias de referência (turno)', r.refTurno], ['Gerado em', dataBR(TODAY)], ['Fonte', 'Presença lançada no sistema (prévia; a medição oficial é a do ponto)']];
  baixarExcel(`medicao-${SETS[SK].curto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}-${m}`, [{ nome: 'Resumo ' + m, linhas: res }, { nome: 'Dia a dia', linhas: dia }, { nome: 'Faltas', linhas: ft }, { nome: 'Como foi calculado', linhas: info }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
acoes.mdAjustar = () => ajustar();
acoes.mdFuncoes = () => ligarFuncoes();
acoes.expMedicao = () => exportar();
