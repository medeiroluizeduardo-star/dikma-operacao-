// Efetivo: Justificativas (faltas, atrasos e atestados) e Banco de horas extras.
import { SETS, AREA_S, DAYS, pd, add, ddmm, monthLabel } from '../contas/cal.js';
import { JUS_CODS, textoJus } from '../ui/presenca.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { semAcento } from '../ui/busca.js';
import { DB, TODAY, framed, esc, title, $ } from '../nucleo/base.js';
import { ME, SK, UI, isAdmin, podeItem, admDe, todasAreas, areaScope, canEditSit, temFichas, perfil } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { escala, regimeDe, sitDia, periodoDe, SIT_NOME, colabsDa, HE_ORIG } from '../calc/presenca.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';

// Justificativas do mês: lista de faltas, atrasos, atestados… com o que falta justificar primeiro.
function regsJus(area, m) {
  const out = [];
  for (let d = m + '-01'; d.slice(0, 7) === m && d <= TODAY; d = add(d, 1)) for (const c of colabsDa(area)) {
    const x = sitDia(c, d); if (x.auto || !JUS_CODS.includes(x.v)) continue;
    const j = DB.sitInfo(c.id + '|' + d).jus; out.push({ c, d, v: x.v, j: j && j.cod === x.v ? j : null });
  }
  return out.sort((a, b) => (!!a.j - !!b.j) || (a.d < b.d ? 1 : a.d > b.d ? -1 : a.c.nome.localeCompare(b.c.nome)));
}
export function vEsJus() {
  const area = areaScope(); const m = UI.mes; const todos = regsJus(area, m);
  const rotasL = [...new Set(todos.map(x => x.c.rota))].sort();
  if (UI.jusRota && !rotasL.includes(UI.jusRota)) UI.jusRota = '';
  const f = UI.jusF || 'pend';
  const base = todos.filter(x => !UI.jusRota || x.c.rota === UI.jusRota);
  // dias seguidos da mesma pessoa, mesma situação e mesma justificativa viram uma linha (ex.: afastado de 20 a 27/10)
  const chave = x => x.c.id + '|' + x.v + '|' + (x.j ? (x.j.mot || '') + '|' + (x.j.obs || '') : '-');
  const grupos = []; const porCh = new Map();
  base.slice().sort((a, b) => a.c.id.localeCompare(b.c.id) || a.v.localeCompare(b.v) || (a.d < b.d ? -1 : 1)).forEach(x => { const k = chave(x); const g = porCh.get(k); if (g && add(g.fim, 1) === x.d) { g.fim = x.d; g.dias.push(x.d); return; } const n = { ...x, ini: x.d, fim: x.d, dias: [x.d] }; grupos.push(n); porCh.set(k, n); });
  grupos.sort((a, b) => (!!a.j - !!b.j) || (a.fim < b.fim ? 1 : a.fim > b.fim ? -1 : a.c.nome.localeCompare(b.c.nome)));
  const lista = grupos.filter(x => f === 'todas' || (f === 'pend' ? !x.j : !!x.j));
  const n = v => base.filter(x => x.v === v).length; const pend = grupos.filter(x => !x.j).length; const okG = grupos.length - pend;
  const LIM = UI.more || 80;
  const linha = x => { const ed = canEditSit(x.c.area); const bt = ed ? `<button class="btn sm ${x.j ? 'ghost' : 'lin'}" data-jusk="${esc(x.c.id + '|' + x.dias.join(','))}">${x.j ? 'Editar' : 'Justificar'}</button>` : '';
    return `<tr><td class="nowrap mono" data-l="Dia">${x.ini === x.fim ? ddmm(x.ini) : `${ddmm(x.ini)} a ${ddmm(x.fim)}<div class="muted small">${x.dias.length} dias</div>`}</td><td data-l="Colaborador"><b>${esc(title(x.c.nome))}</b><div class="muted small">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</div></td><td class="nowrap" data-l="Situação"><span class="sit ${x.v}">${x.v}</span> ${SIT_NOME[x.v]}</td><td data-l="Justificativa">${x.j ? `${esc(textoJus(x.j))}<div class="muted small">${esc(x.j.nomePor || '')}${x.j.em ? ' · ' + ddmm(x.j.em.slice(0, 10)) : ''}${x.j.ocorr ? ' · registrada na ficha' : ''}</div>` : '<span class="pill warn">sem justificativa</span>'}</td><td class="r">${bt}</td></tr>`; };
  return `<div class="mini"><div><b class="num" style="color:${pend ? 'var(--st-atr)' : 'inherit'}">${pend}</b><span>Para justificar</span></div><div><b class="num">${okG}</b><span>Justificadas</span></div><div><b class="num">${n('FT')}</b><span>Faltas</span></div><div><b class="num">${n('ATR')}</b><span>Atrasos</span></div><div><b class="num">${n('SA')}</b><span>Saídas antecipadas</span></div><div><b class="num">${n('AT')}</b><span>Atestados</span></div></div>
  <div class="card"><header><h2>Justificativas</h2><p>${monthLabel(m)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]}</p></header>
  <div class="body lbar"><div class="rchips">${[['pend', 'Sem justificativa', pend], ['ok', 'Justificadas', okG], ['todas', 'Todas', grupos.length]].map(([k, l, q]) => `<button class="rchip" data-jusf="${k}" aria-pressed="${f === k}">${l} <span class="c">${q}</span></button>`).join('')}</div>
  <label class="sel"><span>Rota</span><select class="in" id="fJusRota"><option value="">Todas as rotas</option>${rotasL.map(r => `<option ${r === UI.jusRota ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>${!framed && !isMobile() ? `<button class="btn" data-act="expJus">${I.dl} Exportar</button>` : ''}</div>
  ${lista.length ? `<div class="tw"><table class="jtab"><thead><tr><th>Dia</th><th>Colaborador</th><th>Situação</th><th>Justificativa</th><th></th></tr></thead><tbody>${lista.slice(0, LIM).map(linha).join('')}</tbody></table></div>${lista.length > LIM ? `<div class="body pt0"><button class="btn center" data-act="more" data-n="${LIM + 200}">Mostrar mais ${Math.min(200, lista.length - LIM)}</button></div>` : ''}` : `<div class="empty">${f === 'pend' ? 'Tudo justificado neste mês.' : 'Nada para mostrar com esse filtro.'}</div>`}</div>`;
}
function exportJus() {
  const area = areaScope(); const rs = regsJus(area, UI.mes);
  const linhas = [['Data', 'Nome', 'Área', 'Rota', 'Situação', 'Motivo', 'Chegada', 'Minutos de atraso', 'Observação', 'Registrado por']];
  rs.slice().sort((a, b) => (a.d < b.d ? -1 : 1)).forEach(x => linhas.push([dataBR(x.d), title(x.c.nome), AREA_S[x.c.area] || x.c.area, x.c.rota, SIT_NOME[x.v], x.j ? x.j.mot : 'Sem justificativa', x.j ? x.j.chegada || '' : '', x.j ? x.j.min || '' : '', x.j ? x.j.obs || '' : '', x.j ? x.j.nomePor || '' : '']));
  baixarExcel(`justificativas-${UI.mes}`, [{ nome: 'Justificativas', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
// Ficha do colaborador (módulo Efetivo) para registrar a falta ou o atraso como ocorrência, quando a pessoa pode.
function fichaDe(c) {
  const G = DB.cache.g; if (!G || !G.loaded || !ME || !temFichas(ME)) return null;
  if (!(isAdmin() || (['gestor', 'coordenador', 'supervisor', 'lider', 'administrativo'].includes(perfil('gestao')) && podeItem('i_fichas', 'gestao')))) return null;
  const nk = x => semAcento(String(x || '')).toUpperCase().replace(/\s+/g, ' ').trim();
  return (G.colabs || []).find(x => (c.mat && String(x.mat) === String(c.mat)) || nk(x.nome) === nk(c.nome)) || null;
}
export const ocorrOpc = (c, cod) => { if (!['FT', 'ATR', 'SA'].includes(cod)) return null; const f = fichaDe(c); if (!f) return null; const tipos = ((DB.cache.g.config && DB.cache.g.config.tipos) || []).map(t => t.tipo); return { tipos: [...new Set([cod === 'FT' ? 'Falta' : cod === 'SA' ? 'Saída antecipada' : 'Atraso', ...tipos])] }; };
// Grava a justificativa nos dias lançados (mesmo campo que a Frequência lê).
export function salvarJus(c, dias, j) {
  const oc = j.ocorr; delete j.ocorr;
  const v = { ...j, por: ME.uid, nomePor: ME.nome || ME.login || '', em: new Date().toISOString() };
  if (oc) { const f = fichaDe(c); if (f) { const o = DB.gNovaOcorrencia({ data: dias[0], mat: f.mat, nome: f.nome, tipo: oc, desc: `${SIT_NOME[j.cod]}${dias.length > 1 ? ` de ${ddmm(dias[0])} a ${ddmm(dias[dias.length - 1])}` : ` em ${ddmm(dias[0])}`}: ${textoJus({ ...j, obs: '' })}`, lider: String(ME.nome || '').toUpperCase(), recolhe: String(f.lider || ME.nome || '').toUpperCase(), status: 'pendente' }); v.ocorr = (o && o.id) || true; DB.log(`Efetivo: ocorrência "${oc}" para ${title(f.nome)} a partir da justificativa`, 'operacao'); } }
  dias.forEach(d => DB.setSitExtra('jus', c.id + '|' + d, v));
  DB.log(`${title(c.nome)} · justificativa de ${(SIT_NOME[j.cod] || j.cod).toLowerCase()} ${ddmm(dias[0])}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''}: ${textoJus({ ...j, obs: '' })}`, 'operacao'); // a observação não vai para o histórico (que todos leem)
  toast('Justificativa salva');
}

/* ---------------- BANCO DE HORAS EXTRAS ---------------- */
// Dias de hora extra (código HE no Efetivo diário) por pessoa no mês, por origem; horas = dias × horas por dia (ajustável).
// Detalhe da hora extra: início, fim, intervalo, motivo e observação (situacao.hed). Sem horário, a conta usa a estimativa por dia.
export const MOTIVOS_HE = ['Cobertura de ausência', 'Demanda operacional', 'Parada ou emergência', 'Limpeza ou serviço programado', 'Treinamento', 'Outro'];
const minDe = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
const horasHE = d => { if (!d) return null; const a = minDe(d.ini), b = minDe(d.fim); if (a == null || b == null) return null; const t = ((b - a + 1440) % 1440 || 1440) - (+d.int || 0); return t > 0 ? Math.round(t / 6) / 10 : null; };
export const fmtH = h => (h == null ? '—' : `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
export const textoHE = d => (d && d.ini && d.fim ? `${d.ini} às ${d.fim}${+d.int ? ` (−${d.int} min)` : ''} · ${fmtH(horasHE(d))}` : '');
export function horarioHE(c, dias, fim, k) {
  if (!dias.length) return;
  const k0 = c.id + '|' + dias[0]; const d0 = DB.sitInfo(k0, k).hed || {};
  const ehOutro = d0.mot && !MOTIVOS_HE.includes(d0.mot);
  formSheet('Horário da hora extra', `${esc(title(c.nome))} · ${dias.length > 1 ? `${dias.length} dias (${ddmm(dias[0])} a ${ddmm(dias[dias.length - 1])}) · o mesmo horário em todos` : ddmm(dias[0])}`,
    `<div class="g2eq"><label class="sel"><span>Início</span><input class="in" type="time" id="heIni" required value="${esc(d0.ini || '')}"></label><label class="sel"><span>Fim</span><input class="in" type="time" id="heFim" required value="${esc(d0.fim || '')}"></label></div>
    <label class="sel"><span>Intervalo (minutos, se houve)</span><input class="in" type="number" id="heInt" min="0" max="240" step="5" value="${+d0.int || 0}"></label>
    <p class="hetot" id="heTot" role="status"></p>
    <label class="sel"><span>Motivo</span><select class="in" id="heMot">${MOTIVOS_HE.map(m => `<option ${m === (ehOutro ? 'Outro' : d0.mot) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="sel"><span>Observação (opcional)</span><input class="in" id="heObs" maxlength="200" placeholder="Ex.: cobriu a falta do turno da noite na DG1" value="${esc(ehOutro ? d0.mot : d0.obs || '')}"></label>
    <p class="muted small m0">Quando o fim é menor que o início, conta como virada para o dia seguinte.</p>`, 'Salvar horário', async () => {
      const x = { ini: $('heIni').value, fim: $('heFim').value, int: Math.max(0, +$('heInt').value || 0), mot: $('heMot').value, obs: ($('heObs').value || '').trim().slice(0, 200) };
      const h = horasHE(x); if (h == null) throw new Error('Informe o início e o fim.'); if (h > 16) throw new Error('Mais de 16 horas de hora extra num dia: confira o horário.');
      const v = { ...x, por: ME.uid, nome: ME.nome || ME.login || '', em: new Date().toISOString() };
      dias.forEach(d => DB.setSitExtra('hed', c.id + '|' + d, v, k));
      DB.log(`${title(c.nome)} · hora extra ${ddmm(dias[0])}${dias.length > 1 ? ' a ' + ddmm(dias[dias.length - 1]) : ''} das ${x.ini} às ${x.fim} (${fmtH(h)})`, 'operacao');
      toast(`Hora extra · ${x.ini} às ${x.fim} · ${fmtH(h)}`); if (fim) fim(); else render();
    });
  const atual = () => { const h = horasHE({ ini: $('heIni').value, fim: $('heFim').value, int: $('heInt').value }); const t = $('heTot'); if (t) t.innerHTML = h == null ? 'Informe o início e o fim' : `Total: <b>${fmtH(h)}</b>${h > 16 ? ' · confira, passou de 16 h' : ''}`; };
  ['heIni', 'heFim', 'heInt'].forEach(i => $(i) && $(i).addEventListener('input', atual)); atual();
}
// Cartão dos ajustes das horas extras (horas por dia e limite), mostrado em Administração › Rotas e configurações.
export function cartaoAjustesHE() {
  const cfg = heCfg(); const ed = admDe('ativ');
  return `<div class="card"><header><h2>Horas extras</h2><p>Estimativa dos dias sem horário informado e limite de dias no mês · ${ed ? 'valem para todos' : 'só o administrador ou o gestor altera'}</p></header><div class="body row-gap"><label class="sel"><span>Horas por dia · turno</span><input class="in numin" type="number" min="1" max="24" data-hecfg="ciclo" value="${cfg.ciclo}" ${ed ? '' : 'disabled'}></label><label class="sel"><span>Horas por dia · administrativo</span><input class="in numin" type="number" min="1" max="24" data-hecfg="adm" value="${cfg.adm}" ${ed ? '' : 'disabled'}></label><label class="sel"><span>Limite de dias no mês (0 = sem limite)</span><input class="in numin" type="number" min="0" max="31" data-hecfg="limite" value="${cfg.limite}" ${ed ? '' : 'disabled'}></label></div></div>`;
}
export const heCfg = () => ({ ciclo: 12, adm: 8, limite: 0, ...((DB.cache.config && DB.cache.config.he) || {}) });
// Registros de hora extra do mês (ou dos dias pedidos): um por pessoa e dia, com horário (quando informado) e as horas.
// Usado no Banco de horas extras, na exportação e no Resumo de HE (dia ou semana).
export function registrosHE(area, m, diasPedidos) {
  const cfg = heCfg(); const out = [];
  const dias = diasPedidos ? [...diasPedidos] : []; if (!diasPedidos) for (let d = m + '-01'; d.slice(0, 7) === m; d = add(d, 1)) dias.push(d);
  for (const c of colabsDa(area)) {
    for (const d of dias) {
      const key = c.id + '|' + d; if (DB.sit(key) !== 'HE') continue;
      const r = escala().regimes[regimeDe(c, d)]; const est = r && r.tipo === 'ciclo' ? cfg.ciclo : cfg.adm; // regime do dia (troca de escala)
      const inf = DB.sitInfo(key); const h = horasHE(inf.hed);
      out.push({ c, d, key, orig: inf.he || '', det: inf.hed, horas: h, est, conta: h == null ? est : h, per: periodoDe(c, d) });
    }
  }
  return out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.c.nome.localeCompare(b.c.nome)));
}
// Hora extra lançada na Operação (equipamentos) no mês: aparece para quem lê os lançamentos (Operação ou Frequência).
function cardHeOperacao(m) {
  if (DB.heOpWatch) DB.heOpWatch(m);
  const l = ((DB.cache.heOp || {})[m] || []).slice().sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.op.localeCompare(b.op)));
  if (!l.length) return '';
  const tot = l.reduce((n, x) => n + (x.he || 0), 0); const pess = new Set(l.map(x => x.op)).size;
  return `<div class="card"><header><h2>Hora extra da Operação</h2><p>${monthLabel(m)} · ${l.length} lançamento${l.length === 1 ? '' : 's'} de ${pess} operador${pess === 1 ? '' : 'es'}${tot ? ' · ' + fmtH(tot) : ''} · também entra na folha (Frequência)</p></header>
  <div class="tw"><table class="tcard"><thead><tr><th>Data</th><th>Operador</th><th>Equipamento</th><th>Situação</th><th class="r">Horas</th></tr></thead><tbody>${l.slice(0, 80).map(x => `<tr><td class="num">${ddmm(x.data)}</td><td>${esc(title(x.op))}</td><td>${esc(x.eq)}</td><td>${x.status === 'HE NOTURNA' ? 'Noturna' : 'Hora extra'}</td><td class="r num">${x.he ? fmtH(x.he) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
}
export function vEsHe() {
  const area = areaScope(); const cfg = heCfg(); const m = UI.mes; const ed = admDe('ativ');
  const regs = registrosHE(area, m);
  const por = new Map(); for (const x of regs) { const p = por.get(x.c.id) || { c: x.c, dias: 0, DIKMA: 0, ARCELOR: 0, '': 0, hInf: 0, hEst: 0, semH: 0 }; p.dias++; p[x.orig]++; if (x.horas == null) { p.hEst += x.est; p.semH++; } else p.hInf += x.horas; por.set(x.c.id, p); }
  const linhas = [...por.values()].map(x => ({ ...x, total: x.hInf + x.hEst })).sort((a, b) => b.total - a.total || a.c.nome.localeCompare(b.c.nome));
  const T = { dias: regs.length, hInf: regs.reduce((n, x) => n + (x.horas || 0), 0), hEst: regs.filter(x => x.horas == null).reduce((n, x) => n + x.est, 0), semH: regs.filter(x => x.horas == null).length, DIKMA: regs.filter(x => x.orig === 'DIKMA').length, ARCELOR: regs.filter(x => x.orig === 'ARCELOR').length };
  const acima = cfg.limite ? linhas.filter(x => x.dias > cfg.limite).length : 0;
  const soSem = !!UI.heSemH; const lista = soSem ? regs.filter(x => x.horas == null) : regs;
  const LIM = UI.heMais || 60;
  const mot = {}; regs.forEach(x => { const k = x.det ? (MOTIVOS_HE.includes(x.det.mot) ? x.det.mot : 'Outro') : 'Sem horário informado'; mot[k] = (mot[k] || 0) + (x.horas == null ? x.est : x.horas); });
  const motL = Object.entries(mot).sort((a, b) => b[1] - a[1]); const motMx = motL.length ? motL[0][1] : 1;
  return `<div class="mini"><div><b class="num">${fmtH(T.hInf + T.hEst)}</b><span>Horas no mês</span></div><div><b class="num">${fmtH(T.hInf)}</b><span>Com horário informado</span></div><div><b class="num" style="color:${T.semH ? 'var(--st-atr)' : 'inherit'}">${T.semH}</b><span>Sem horário (${fmtH(T.hEst)} estimadas)</span></div><div><b class="num">${T.dias}</b><span>Registros</span></div><div><b class="num">${T.DIKMA}</b><span>A pedido da Dikma</span></div><div><b class="num">${T.ARCELOR}</b><span>A pedido da ArcelorMittal</span></div>${cfg.limite ? `<div><b class="num" style="color:${acima ? 'var(--st-nreal)' : 'inherit'}">${acima}</b><span>Acima do limite (${cfg.limite} dias)</span></div>` : ''}</div>
  <div class="card"><header><h2>Registros</h2><p>${monthLabel(m)} · ${area === 'TODAS' ? 'todas as áreas' : AREA_S[area]} · horário de início e fim de cada hora extra${canEditSit(area === 'TODAS' ? null : area) || todasAreas() ? ' · toque em “Informar” ou no horário para ajustar' : ''}</p><span class="r row-gap"><label class="btn sm"><input type="checkbox" id="heSemH" ${soSem ? 'checked' : ''}> Só sem horário</label>${!framed && !isMobile() && regs.length ? `<button class="btn sm" data-act="expHe">${I.dl} Exportar Excel</button>` : ''}</span></header>
  ${lista.length ? `<div class="tw"><table class="hetab tcard"><thead><tr><th>Data</th><th>Colaborador</th><th>Rota</th><th>Início</th><th>Fim</th><th class="r">Horas</th><th>A pedido de</th><th>Motivo</th></tr></thead><tbody>${lista.slice(0, LIM).map(x => { const pode = canEditSit(x.c.area); const hr = x.det && x.det.ini ? `${esc(x.det.ini)}` : ''; return `<tr${x.horas == null ? ' class="semh"' : ''}><td class="num" data-l="Data">${DAYS[(pd(x.d).getDay() + 6) % 7]} ${ddmm(x.d)}</td><td class="tc-t"><b>${esc(title(x.c.nome))}</b>${x.per ? ` <span class="tag">${x.per === 'N' ? 'noite' : 'dia'}</span>` : ''}</td><td class="muted small tc-s">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</td>${x.det && x.det.ini ? `<td class="num" data-l="Início">${pode ? `<button class="btn ghost link" data-heh="${esc(x.key)}">${hr}</button>` : hr}</td><td class="num" data-l="Fim">${esc(x.det.fim)}${+x.det.int ? ` <small class="muted">−${x.det.int} min</small>` : ''}</td><td class="r num" data-l="Horas"><b>${fmtH(x.horas)}</b></td>` : `<td colspan="2" class="tc-acao">${pode ? `<button class="btn sm" data-heh="${esc(x.key)}">${I.relogio} Informar</button>` : '<span class="muted">sem horário</span>'}</td><td class="r num muted" data-l="Horas" title="Estimado: ${x.est} h por dia">~${fmtH(x.est)}</td>`}<td data-l="A pedido de">${x.orig ? HE_ORIG[x.orig] : '<span class="muted">—</span>'}</td><td class="small tc-full" data-l="Motivo">${x.det ? esc(x.det.mot || '') + (x.det.obs ? `<div class="muted">${esc(x.det.obs)}</div>` : '') : ''}</td></tr>`; }).join('')}</tbody></table></div>${lista.length > LIM ? `<div class="body"><button class="btn" data-act="heMais">Mostrar mais ${Math.min(100, lista.length - LIM)}</button></div>` : ''}` : `<div class="body"><div class="empty">${soSem ? 'Todas as horas extras do mês têm horário informado.' : 'Nenhuma hora extra lançada neste mês.'}</div></div>`}</div>
  ${cardHeOperacao(m)}
  <div class="grid2"><div class="card"><header><h2>Por pessoa</h2><p>Horas informadas + estimadas para os dias sem horário (${cfg.ciclo} h turno · ${cfg.adm} h administrativo)${ed ? ' · ajuste em Administração › Rotas' : ''}</p></header>${linhas.length ? `<div class="tw"><table><thead><tr><th>Colaborador</th><th class="r">Dias</th><th class="r">Informadas</th><th class="r">Estimadas</th><th class="r">Total</th></tr></thead><tbody>${linhas.map(x => `<tr${cfg.limite && x.dias > cfg.limite ? ' class="acima"' : ''}><td><b>${esc(title(x.c.nome))}</b><div class="muted small">${esc(x.c.rota)}${area === 'TODAS' ? ' · ' + AREA_S[x.c.area] : ''}</div></td><td class="r num">${x.dias}${cfg.limite && x.dias > cfg.limite ? ' <span class="pill bad">acima</span>' : ''}</td><td class="r num">${x.hInf ? fmtH(x.hInf) : '·'}</td><td class="r num muted">${x.hEst ? '~' + fmtH(x.hEst) : '·'}</td><td class="r num"><b>${fmtH(x.total)}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="body"><div class="empty">Ninguém com hora extra neste mês.</div></div>'}</div>
  <div class="card"><header><h2>Por motivo</h2><p>Horas no mês</p></header><div class="body">${motL.length ? `<div class="bars">${motL.map(([k, h]) => `<div class="barrow"><span class="n">${esc(k)}</span><div class="stack"><i style="width:${h / motMx * 100}%;background:${k === 'Sem horário informado' ? 'var(--st-prog)' : 'var(--st-extra)'}"></i></div><span class="p num">${fmtH(h)}</span></div>`).join('')}</div>` : '<div class="empty">Sem horas extras.</div>'}</div></div></div>`;
}
function exportHe() {
  const area = areaScope(); const m = UI.mes; const regs = registrosHE(area, m);
  const det = [['Data', 'Nome', 'Área', 'Rota', 'Turno', 'Início', 'Fim', 'Intervalo (min)', 'Horas', 'Horas estimadas (sem horário)', 'A pedido de', 'Motivo', 'Observação', 'Registrado por']];
  regs.slice().reverse().forEach(x => det.push([dataBR(x.d), title(x.c.nome), AREA_S[x.c.area] || x.c.area, x.c.rota, x.per === 'N' ? 'Noite' : x.per === 'D' ? 'Dia' : '', x.det ? x.det.ini : '', x.det ? x.det.fim : '', x.det ? +x.det.int || 0 : '', x.horas == null ? '' : x.horas, x.horas == null ? x.est : '', x.orig ? HE_ORIG[x.orig] : '', x.det ? x.det.mot || '' : '', x.det ? x.det.obs || '' : '', x.det ? title(x.det.nome || '') : '']));
  const por = new Map(); for (const x of regs) { const p = por.get(x.c.id) || [title(x.c.nome), AREA_S[x.c.area] || x.c.area, x.c.rota, 0, 0, 0, 0]; p[3]++; if (x.horas == null) p[5] += x.est; else p[4] += x.horas; p[6] = Math.round((p[4] + p[5]) * 10) / 10; por.set(x.c.id, p); }
  const res = [['Nome', 'Área', 'Rota', 'Dias', 'Horas informadas', 'Horas estimadas', 'Total de horas'], ...por.values()];
  baixarExcel(`horas-extras-${SETS[SK].curto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}-${m}`, [{ nome: 'Registros ' + m, linhas: det }, { nome: 'Por pessoa ' + m, linhas: res }]).catch(e => toast('Não foi possível exportar: ' + e.message));
}
acoes.expJus = (t, d) => { exportJus(); };
acoes.expHe = (t, d) => { exportHe(); };
acoes.heMais = (t, d) => { UI.heMais = (UI.heMais || 60) + 100; render(); };
