// Dikma Operação — Efetivo › Importar dados.
// Lê uma planilha (Excel .xlsx/.xlsm/.xls ou CSV), acha sozinho a tabela de colaboradores (e a de ocorrências,
// se houver), mostra o que vai mudar e só grava depois da confirmação. A área de atuação e a função
// importadas vão também para Atividades Pátio, Atividades Bateria e Operação (pessoas.js).
import { pad, today, AREA_S, AREAS_ATIV, SETS, setDaArea } from './cal.js';
import { AREA_GERAL, AREA_OP, REGIMES, norm } from './pessoas.js';

// Nomes de coluna aceitos (comparados sem acento, em maiúsculas).
const CAMPOS = {
  mat: ['MATRICULA', 'MAT', 'MATRIC', 'CHAPA', 'RE', 'REGISTRO', 'N MATRICULA', 'Nº MATRICULA'],
  nome: ['NOME', 'NOME COMPLETO', 'COLABORADOR', 'FUNCIONARIO', 'NOME DO COLABORADOR'],
  funcao: ['FUNCAO', 'CARGO'],
  area: ['AREA', 'AREA DE ATUACAO', 'SETOR', 'LOTACAO'],
  rota: ['ROTA'],
  regime: ['REGIME'],
  turma: ['TURMA', 'TURMA/TURNO', 'TURNO', 'TURMA / TURNO'],
  lider: ['LIDER', 'LIDER IMEDIATO', 'LIDER (DIKMA)'],
  adm: ['ADMISSAO', 'DATA ADMISSAO', 'DATA DE ADMISSAO'],
  dem: ['DEMISSAO', 'DATA DEMISSAO', 'DATA DE DEMISSAO', 'DESLIGAMENTO'],
  mes: ['MES'],
  escala: ['ESCALA'],
  data: ['DATA'],
  tipo: ['TIPO', 'TIPO DE OCORRENCIA'],
  desc: ['DESCRICAO', 'DESCRICAO (OPCIONAL)', 'OBSERVACAO'],
  assin: ['ASSINATURA', 'ASSINOU'],
  assinadoEm: ['ASSINADO EM'],
  testemunha: ['TESTEMUNHA', 'TESTEMUNHA (SE RECUSOU)']
};
const ALIAS = new Map(Object.entries(CAMPOS).flatMap(([k, l]) => l.map(n => [norm(n), k])));
const campoDe = v => ALIAS.get(norm(v).replace(/[.:]/g, '').trim()) || null;

const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function data(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : isoLocal(new Date(v.getTime() + 12 * 3600e3));
  if (typeof v === 'number') { if (v < 20000 || v > 80000) return null; const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
const txt = v => (v == null ? '' : v instanceof Date ? isoLocal(v) : String(v)).replace(/\s+/g, ' ').trim();
const matDe = v => txt(v).replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');

// CSV com ; ou , e aspas
function lerCSV(t) {
  t = t.replace(/^﻿/, '');
  const prim = t.split(/\r?\n/)[0] || ''; const sep = (prim.match(/;/g) || []).length >= (prim.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cel = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cel); cel = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cel); rows.push(row); row = []; cel = ''; } else cel += ch;
  }
  if (cel || row.length) { row.push(cel); rows.push(row); }
  return rows;
}
async function lerArquivo(file) {
  if (/\.(csv|txt)$/i.test(file.name)) return [{ nome: file.name, rows: lerCSV(await file.text()) }];
  const XLSX = await import('./vendor/xlsx.js');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  return wb.SheetNames.map(n => ({ nome: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }) }));
}

// Acha a melhor tabela de colaboradores e a de ocorrências em todas as abas.
function acharTabelas(abas) {
  let colab = null, ocorr = null;
  for (const a of abas) {
    for (let i = 0; i < Math.min(40, a.rows.length); i++) {
      const cols = {}; (a.rows[i] || []).forEach((v, j) => { const c = v != null && typeof v !== 'number' ? campoDe(v) : null; if (c && !(c in cols)) cols[c] = j; });
      const dados = a.rows.slice(i + 1).filter(r => r && r.some(v => v != null && v !== ''));
      if ('data' in cols && 'tipo' in cols && ('mat' in cols || 'nome' in cols)) {
        const n = dados.filter(r => data(r[cols.data]) && txt(r[cols.tipo])).length;
        if (n && (!ocorr || n > ocorr.n)) ocorr = { aba: a.nome, cols, dados, n };
        break;
      }
      if ('nome' in cols && ('mat' in cols || 'funcao' in cols || 'area' in cols)) {
        const n = dados.filter(r => txt(r[cols.nome])).length;
        if (!colab || ('mat' in cols) > ('mat' in colab.cols) || (('mat' in cols) === ('mat' in colab.cols) && n > colab.n)) colab = { aba: a.nome, cols, dados, n };
        break;
      }
    }
  }
  return { colab, ocorr };
}

const AREA_ALIAS = new Map([[norm(AREA_GERAL), AREA_GERAL], ['GERAL', AREA_GERAL], [norm(AREA_OP), AREA_OP], ['OPERACAO', AREA_OP], ['EQUIPAMENTOS', AREA_OP], ['OPERACAO DE EQUIPAMENTO', AREA_OP], ...AREAS_ATIV.flatMap(a => [[norm(a), a], [norm(AREA_S[a]), a]])]);
const areaDe = v => (v ? AREA_ALIAS.get(norm(v)) || null : null);
const regimeDe = v => { const s = norm(v); return !s ? null : /4X4|TURNO/.test(s) ? 'TURNO 4X4' : /^ADM/.test(s) ? 'ADMINISTRATIVO' : null; };
const escalaDe = v => { const s = norm(v); return /4X4/.test(s) ? '4x4' : /^ADM/.test(s) ? 'ADM' : null; };

// Lê a ÁREA/ROTA da planilha. Dois formatos:
//  - direto: ÁREA = área do sistema (RECEBIMENTO, BATERIA 1…) e ROTA = rota do sistema (abas EFETIVO do Pátio/Bateria);
//  - por setor (planilha do RH): ÁREA "Coqueria - Pátio", ROTA "Coqueria - Recebimento"; "Alto Forno", "Sinter"…
// aceita = áreas do sistema compatíveis (se a pessoa já está numa delas, fica onde está); padrao = para onde vai se não estiver.
function interpretarArea(aT, rT) {
  if (!aT && !rT) return { aceita: null };
  const a0 = areaDe(aT);
  if (a0 && a0 !== AREA_GERAL) return { direta: true, aceita: [a0], padrao: a0 };
  if (a0 === AREA_GERAL && !rT) return { aceita: null };
  const res = { setor: aT, subsetor: rT || aT };
  const PAT = SETS.patio.areas, BAT = SETS.bateria.areas;
  const s = norm(rT || aT), sa = norm(aT);
  if (!/^COQUERIA/.test(s) && !/^COQUERIA/.test(sa)) return { ...res, aceita: [], padrao: AREA_GERAL };
  const rest = s.replace(/^COQUERIA\s*-?\s*/, ''), ar = sa.replace(/^COQUERIA\s*-?\s*/, '');
  if (!rest) return /^PATIO/.test(ar) ? { ...res, aceita: PAT, padrao: null } : /^BATERIA/.test(ar) ? { ...res, aceita: BAT, padrao: 'BATERIA 1' } : { ...res, aceita: null };
  const d = areaDe(rest); if (d && d !== AREA_GERAL && d !== AREA_OP) return { ...res, aceita: [d], padrao: d };
  if (/^PATIO/.test(rest)) return { ...res, aceita: PAT, padrao: null };
  if (/TRILHO/.test(rest)) return { ...res, aceita: ['TRILHO', 'CDQ'], padrao: 'TRILHO' };
  if (/CDQ/.test(rest)) return { ...res, aceita: ['CDQ'], padrao: 'CDQ' };
  if (/TURNO/.test(rest) && /BATERIA/.test(rest + ar)) return { ...res, aceita: BAT, padrao: 'BATERIA 1', rota: 'TURNO 4X4' };
  if (/^BATERIA/.test(rest)) return { ...res, aceita: BAT, padrao: 'BATERIA 1' };
  return { ...res, aceita: null, aviso: `"${rT || aT}" não tem área correspondente no sistema (mantida a atual).` };
}

export function criarImportador(X) {
  const { DB, esc, title, I, toast, render, PES, colabForm } = X;
  const G = () => DB.cache.g;
  const ST = { arq: '', P: null, busy: false, erro: '', atualizar: true, sync: true, ocorr: true, excluirFora: false };

  // Monta o plano de importação sem gravar nada.
  function analisar(tab, origem) {
    const P = { fora: [], origem, aba: tab.colab ? tab.colab.aba : '', abaO: tab.ocorr ? tab.ocorr.aba : '', lidas: 0, novos: [], atual: [], iguais: 0, semMat: [], avisos: [], ocorr: [], ocDup: 0, ocSem: 0 };
    const efet = G().colabs; const porMat = new Map(efet.map(c => [String(c.mat), c])); const porNome = new Map(efet.map(c => [norm(c.nome), c]));
    if (tab.colab) {
      const { cols, dados } = tab.colab; const g = k => r => (k in cols ? r[cols[k]] : null);
      let regs = dados.map(r => ({ mat: matDe(g('mat')(r)), nome: txt(g('nome')(r)).toUpperCase(), funcao: txt(g('funcao')(r)).toUpperCase(), areaTxt: txt(g('area')(r)), rotaTxt: txt(g('rota')(r)), rota: txt(g('rota')(r)).toUpperCase(), regime: txt(g('regime')(r)).toUpperCase(), turma: txt(g('turma')(r)).toUpperCase(), lider: txt(g('lider')(r)).toUpperCase(), adm: data(g('adm')(r)), dem: data(g('dem')(r)), mes: txt(g('mes')(r)).slice(0, 7), escala: txt(g('escala')(r)).toUpperCase() }))
        .filter(r => r.nome || r.mat).filter(r => !/^\d+$/.test(r.nome));
      // Planilhas mensais (uma linha por pessoa por mês): fica a linha do mês atual ou a mais recente até hoje.
      if ('mes' in cols) {
        const ym = today().slice(0, 7), grupos = new Map();
        for (const r of regs) { const k = r.mat || norm(r.nome); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); }
        regs = [...grupos.values()].map(l => { const ok = l.filter(x => x.mes && x.mes <= ym).sort((a, b) => (a.mes < b.mes ? 1 : -1)); return ok[0] || l.slice().sort((a, b) => (a.mes < b.mes ? -1 : 1))[0]; });
      }
      P.lidas = regs.length;
      // Quem está no Efetivo e não aparece na planilha (para a opção de excluir).
      if ('mat' in cols && regs.length >= 10) { const m = new Set(regs.map(r => r.mat).filter(Boolean)); const nm = new Set(regs.map(r => norm(r.nome))); P.fora = efet.filter(c => !m.has(String(c.mat)) && !nm.has(norm(c.nome))); }
      const vistos = new Set();
      for (const r of regs) {
        const chave = r.mat || norm(r.nome); if (vistos.has(chave)) continue; vistos.add(chave);
        const antes = (r.mat && porMat.get(r.mat)) || (!r.mat && porNome.get(norm(r.nome))) || null;
        const base = antes || { mat: r.mat, nome: r.nome, area: AREA_GERAL, funcao: '', turma: '', lider: '', adm: null, dem: null, intAnt: !(r.adm && (Date.parse(today()) - Date.parse(r.adm)) / 864e5 < 90) };
        if (!antes && !r.mat) { P.semMat.push(r); continue; }
        if (!antes && porNome.has(norm(r.nome))) { P.avisos.push(`${title(r.nome)}: já cadastrado com a matrícula ${porNome.get(norm(r.nome)).mat} (a planilha diz ${r.mat}). Não importado.`); continue; }
        if (!antes && !r.nome) { P.avisos.push(`Matrícula ${r.mat}: sem nome, não importada.`); continue; }
        const n = { ...base };
        const muda = [];
        const set = (k, v, rot) => { if (v && v !== (base[k] || '')) { muda.push(`${rot}: ${base[k] || '—'} → ${v}`); n[k] = v; } };
        set('nome', r.nome, 'nome'); set('funcao', r.funcao, 'função'); set('turma', r.turma, 'turma'); set('lider', r.lider, 'líder'); set('adm', r.adm, 'admissão'); set('dem', r.dem, 'demissão');
        // área de atuação
        const atual = PES.opcoesAtuais(antes || n); const o = { ...atual };
        let mudaArea = false;
        const ia = interpretarArea(r.areaTxt, r.rotaTxt);
        if (ia.setor) { set('setor', ia.setor, 'área (planilha)'); set('subsetor', ia.subsetor, 'setor'); }
        set('regime', r.regime, 'regime');
        if (ia.aviso) P.avisos.push(`${title(r.nome)}: ${ia.aviso}`);
        const atualAtiv = setDaArea(atual.area) ? atual.area : AREA_GERAL; // quem só está na Operação conta como "sem rota"
        if (ia.aceita && !ia.aceita.includes(atualAtiv)) {
          if (ia.padrao) { if (ia.padrao !== atualAtiv) { o.area = ia.padrao; o.rota = ia.rota || ''; mudaArea = true; } }
          else if (ia.aceita.length) P.avisos.push(`${title(r.nome)}: "${r.rotaTxt || r.areaTxt}" não diz a área exata. Ficou como está (${PES.lotacao(antes || n).txt}); ajuste em Editar se precisar.`);
        }
        if (o.area !== n.area && (ia.aceita || ia.direta)) n.area = o.area;
        if (setDaArea(o.area)) {
          const rotas = PES.rotasDe(o.area);
          if (ia.direta && r.rota) { const rr = rotas.find(x => norm(x) === norm(r.rota)); if (rr && rr !== atual.rota) { o.rota = rr; mudaArea = true; } else if (!rr) P.avisos.push(`${title(r.nome)}: rota "${r.rota}" não existe em ${AREA_S[o.area]}.`); }
          if (mudaArea && !rotas.includes(o.rota)) o.rota = rotas.find(x => norm(x) === norm(o.area)) || rotas.find(x => x !== 'GESTÃO') || rotas[0] || '';
          const rg = regimeDe(r.regime); if (rg && rg !== atual.regime) { o.regime = rg; mudaArea = true; }
        }
        if (o.op || o.area === AREA_OP) {
          const e = escalaDe(r.escala || r.regime); if (e && e !== atual.escala) { o.escala = e; mudaArea = true; }
          const turmas = Object.keys((DB.cache.e && DB.cache.e.config && DB.cache.e.config.turmas) || {});
          if (o.escala === '4x4' && turmas.includes(r.turma) && r.turma !== atual.turma) { o.turma = r.turma; mudaArea = true; }
        }
        if (mudaArea) muda.push(`no sistema: ${PES.lotacao(antes || n).txt} → ${PES.areaNome(o.area)}${setDaArea(o.area) ? ' · ' + o.rota : ''}${o.regime !== atual.regime && setDaArea(o.area) ? ' · ' + o.regime.toLowerCase() : ''}${o.escala !== atual.escala ? ' · escala ' + o.escala : ''}${o.op && o.area !== AREA_OP ? ' + Operação' : ''}`);
        const sync = mudaArea || muda.some(m => m.startsWith('função')) || !antes;
        const item = { antes, n, o, sync, muda };
        if (!antes) P.novos.push(item); else if (muda.length) P.atual.push(item); else P.iguais++;
      }
    }
    if (tab.ocorr) {
      const { cols, dados } = tab.ocorr; const g = k => r => (k in cols ? r[cols[k]] : null);
      const mats = new Map([...G().colabs, ...P.novos.map(x => x.n)].map(c => [String(c.mat), c]));
      const nomes = new Map([...mats.values()].map(c => [norm(c.nome), c]));
      const chave = o => `${o.mat}|${o.data}|${norm(o.tipo)}|${norm(o.desc)}`;
      const exist = new Set(G().ocorr.map(chave));
      for (const r of dados) {
        const dt = data(g('data')(r)); const tipo = txt(g('tipo')(r)); if (!dt || !tipo) continue;
        let mat = matDe(g('mat')(r)); const nome = txt(g('nome')(r)).toUpperCase();
        let c = mats.get(mat) || (!mat && nomes.get(norm(nome))); if (!c) { P.ocSem++; continue; }
        mat = String(c.mat);
        const as = norm(txt(g('assin')(r)));
        const o = { data: dt, mat, nome: c.nome, tipo, desc: txt(g('desc')(r)), lider: txt(g('lider')(r)).toUpperCase(), status: as === 'SIM' || as === 'ASSINADA' ? 'assinada' : /RECUS/.test(as) ? 'recusada' : 'pendente', assinadoEm: data(g('assinadoEm')(r)), testemunha: txt(g('testemunha')(r)) };
        if (o.status === 'assinada' && !o.assinadoEm) o.assinadoEm = dt;
        if (exist.has(chave(o))) { P.ocDup++; continue; }
        exist.add(chave(o)); P.ocorr.push(o);
      }
    }
    return P;
  }

  async function carregar(file) {
    ST.busy = true; ST.erro = ''; ST.P = null; ST.arq = file.name; render();
    try {
      const tab = acharTabelas(await lerArquivo(file));
      if (!tab.colab && !tab.ocorr) throw new Error('Não achei uma tabela de colaboradores nesta planilha. A primeira linha da tabela precisa ter as colunas NOME e MATRÍCULA (ou COLABORADOR e FUNÇÃO).');
      ST.P = analisar(tab, file.name);
    } catch (err) { ST.erro = (err && err.message) || String(err); }
    ST.busy = false; render();
  }
  // Planilha "EFETIVO PARA O SISTEMA" (RH), já embutida no sistema.
  // Ponte com o Senior: registros que a rotina do GitHub deixou em integracao/senior.
  function planilhaSenior() {
    const S = G().senior; if (!S || !S.registros) return;
    const cols = { mat: 0, nome: 1, funcao: 2, area: 3, rota: 4, regime: 5, turma: 6, lider: 7, adm: 8, dem: 9 };
    ST.erro = ''; ST.arq = 'Senior';
    ST.P = analisar({ colab: { aba: 'Senior', cols, dados: S.registros.map(r => [r.mat, r.nome, r.funcao, r.area, r.rota, r.regime, r.turma, r.lider, r.adm, r.dem]) } }, `Senior (${fmtData(S.recebidoEm)})`);
    ST.P.senior = true; render();
  }
  const fmtData = d => (d instanceof Date && !isNaN(d) ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—');
  function cardSenior() {
    const S = G().senior;
    let est, corpo, bt = '';
    if (!S) { est = '<span class="pill neu">Aguardando a TI</span>'; corpo = 'A ponte já está pronta. Quando a TI da Dikma liberar um usuário de integração, basta cadastrar os dados no GitHub (veja "Integração com o Senior" no README). A partir daí, todo dia às 6h o sistema busca os colaboradores no Senior e deixa aqui para você conferir e aplicar.'; }
    else if (S.estado === 'erro') { est = '<span class="pill bad">Erro na última leitura</span>'; corpo = `${esc(S.erro || '')}<br><span class="muted">Tentativa em ${fmtData(S.tentativaEm)}${S.recebidoEm ? ' · última leitura boa em ' + fmtData(S.recebidoEm) : ''}.</span>`; if (S.registros) bt = `<button class="btn" data-g="impSenior">Conferir a última leitura boa</button>`; }
    else {
      const novo = !S.aplicadoEm || (S.recebidoEm && S.aplicadoEm < S.recebidoEm);
      est = novo ? '<span class="pill warn">Leitura nova para conferir</span>' : '<span class="pill ok">Em dia</span>';
      corpo = `${S.total || (S.registros || []).length} colaboradores lidos em ${fmtData(S.recebidoEm)}${S.modo ? ' (' + esc(S.modo) + ')' : ''}.${S.aplicadoEm ? ` Aplicado em ${fmtData(S.aplicadoEm)}${S.aplicadoPor ? ' por ' + esc(title(S.aplicadoPor)) : ''}.` : ''}${(S.avisos || []).length ? ` ${S.avisos.length} aviso(s) na leitura.` : ''}`;
      bt = `<button class="btn ${novo ? 'pri' : ''}" data-g="impSenior" ${ST.busy ? 'disabled' : ''}>Conferir e aplicar</button>`;
    }
    return `<div class="card"><header><h2>Integração Senior</h2>${est}</header><div class="body stackcol"><p class="m0 small">${corpo}</p>${bt ? `<div class="row-gap">${bt}${S && S.execucao ? `<a class="btn ghost" href="${esc(S.execucao)}" target="_blank" rel="noopener">Ver execução no GitHub</a>` : ''}</div>` : ''}</div></div>`;
  }
  async function planilhaRH() {
    ST.busy = true; ST.erro = ''; ST.P = null; ST.arq = 'EFETIVO PARA O SISTEMA'; render();
    try {
      const s = await DB.seed('seed-efetivo.json');
      const cols = {}; s.colunas.forEach((c, i) => { const k = campoDe(c); if (k) cols[k] = i; });
      ST.P = analisar({ colab: { aba: 'Planilha1', cols, dados: s.linhas } }, ST.arq);
    } catch (err) { ST.erro = (err && err.message) || String(err); }
    ST.busy = false; render();
  }
  async function planilhaOriginal() {
    ST.busy = true; ST.erro = ''; ST.P = null; ST.arq = 'Planilha original de fichas (FO-RED-COQ-004)'; render();
    try {
      const s = await DB.seed('seed-gestao.json');
      const cols = { mat: 0, nome: 1, funcao: 2, turma: 3, lider: 4, adm: 5, dem: 6 };
      const ocols = { data: 0, mat: 1, nome: 2, tipo: 3, desc: 4, lider: 5, assin: 6, assinadoEm: 7, testemunha: 8 };
      ST.P = analisar({
        colab: { aba: 'Colaboradores', cols, dados: s.colabs.map(c => [c.mat, c.nome, c.funcao, c.turma, c.lider, c.adm, c.dem]) },
        ocorr: { aba: 'Ocorrências', cols: ocols, dados: s.ocorrencias.map(o => [o.data, o.mat, o.nome, o.tipo, o.desc, o.lider, o.status === 'assinada' ? 'Sim' : o.status === 'recusada' ? 'Recusou' : 'Não', o.assinadoEm, o.testemunha]) }
      }, ST.arq);
    } catch (err) { ST.erro = (err && err.message) || String(err); }
    ST.busy = false; render();
  }

  async function confirmar() {
    const P = ST.P; if (!P) return;
    ST.busy = true; render();
    try {
      const itens = G().colabs.slice(); const sync = [];
      for (const x of P.novos) { itens.push(x.n); if (ST.sync && x.sync) sync.push({ antes: null, c: x.n, o: x.o }); }
      if (ST.atualizar) for (const x of P.atual) { const i = itens.findIndex(c => c.mat === x.antes.mat); if (i >= 0) itens[i] = x.n; if (ST.sync && x.sync) sync.push({ antes: x.antes, c: x.n, o: x.o }); }
      const nAt = ST.atualizar ? P.atual.length : 0;
      if (P.novos.length || nAt) { G().colabs = itens; DB.cache.gVersao++; DB.gSalvarColabs(itens); }
      const nEx = ST.excluirFora && P.fora.length ? X.excluirColabs(P.fora.map(c => c.mat), { modulos: true }) : 0;
      if (sync.length) PES.sincronizarVarios(sync);
      const nOc = ST.ocorr ? P.ocorr.length : 0;
      if (nOc) await DB.gImportarOcorrencias(P.ocorr);
      DB.log(`Efetivo: importou ${P.origem} (${P.novos.length} novos, ${nAt} atualizados${nOc ? ', ' + nOc + ' ocorrências' : ''}${nEx ? ', ' + nEx + ' excluídos' : ''})`);
      toast(`Importado: ${P.novos.length} novos, ${nAt} atualizados${nOc ? ', ' + nOc + ' ocorrências' : ''}${nEx ? ', ' + nEx + ' excluídos' : ''}`);
      if (P.senior && DB.gSeniorAplicado) DB.gSeniorAplicado();
      ST.P = null; ST.arq = '';
    } catch (err) { ST.erro = (err && err.message) || String(err); }
    ST.busy = false; render();
  }

  function modeloCSV() {
    const linhas = [['MATRÍCULA', 'NOME', 'FUNÇÃO', 'ÁREA', 'ROTA', 'REGIME', 'TURMA', 'LÍDER', 'ADMISSÃO', 'DEMISSÃO'],
      ['1234', 'NOME COMPLETO DO COLABORADOR', 'EXECUTANTE ADM', 'BATERIA 1', 'CANALETAS', 'ADMINISTRATIVO', '', '', '01/10/2026', ''],
      ['5678', 'OUTRO COLABORADOR', 'OPERADOR DE EQUIPAMENTOS 1', 'OPERAÇÃO DE EQUIPAMENTOS', '', '', '', '', '15/09/2026', '']];
    const csv = '﻿' + linhas.map(r => r.map(x => `"${x}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'modelo-colaboradores.csv'; a.click();
  }

  function view() {
    const P = ST.P; const sf = PES.semFicha();
    let h = `${cardSenior()}<div class="grid2"><div class="card"><header><h2>Importar planilha</h2><p>Excel (.xlsx, .xlsm, .xls) ou CSV</p></header><div class="body stackcol">
      <p class="m0 small">O sistema procura sozinho a tabela de colaboradores (colunas <b>MATRÍCULA</b>, <b>NOME</b>, <b>FUNÇÃO</b>, <b>ÁREA</b>, <b>ROTA</b>, <b>REGIME</b>, <b>TURMA</b>, <b>LÍDER</b>, <b>ADMISSÃO</b>, <b>DEMISSÃO</b>; só nome e matrícula são obrigatórios) e, se houver, a de ocorrências. Serve a própria planilha de fichas, a aba EFETIVO das planilhas do Pátio e da Bateria ou uma lista do RH.</p>
      <div class="row-gap"><label class="btn pri">${I.file} ${ST.busy ? 'Lendo…' : 'Escolher arquivo'}<input type="file" id="impArq" accept=".xlsx,.xlsm,.xls,.csv,.txt" hidden ${ST.busy ? 'disabled' : ''}></label><button class="btn" data-g="impModelo">${I.dl} Baixar modelo</button></div>
      ${ST.erro ? `<p class="err m0">${esc(ST.erro)}</p>` : ''}</div></div>
      <div class="card"><header><h2>Planilha EFETIVO PARA O SISTEMA</h2><p>Lista do RH já carregada no sistema (450 colaboradores)</p></header><div class="body stackcol"><p class="m0 small">Atualiza função, área, setor, regime, turma, líder e admissão de quem já tem ficha, cadastra quem falta e leva a área e a função para Atividades Pátio, Atividades Bateria e Operação. Antes de gravar mostra a conferência.</p><button class="btn pri" data-g="impRH" style="align-self:flex-start" ${ST.busy ? 'disabled' : ''}>Conferir e atualizar</button></div></div>
      <div class="card"><header><h2>Planilha original de fichas</h2><p>FO-RED-COQ-004, a mesma do primeiro acesso</p></header><div class="body stackcol"><p class="m0 small">Traz de novo os colaboradores e as ocorrências da planilha original. Só entra o que ainda não existe no sistema: nada é apagado ou duplicado.</p><button class="btn" data-g="impOriginal" style="align-self:flex-start" ${ST.busy ? 'disabled' : ''}>Conferir o que falta</button></div></div></div>`;
    if (P) {
      const nOcor = P.ocorr.length;
      h += `<div class="card"><header><h2>Conferência · ${esc(P.origem)}</h2><p>${P.aba ? 'Colaboradores da aba ' + esc(P.aba) : ''}${P.abaO ? ' · ocorrências da aba ' + esc(P.abaO) : ''} · ${P.lidas} pessoa(s) lidas. Nada foi gravado ainda.</p></header>
        <div class="body stackcol"><div class="mini"><div><b class="num">${P.novos.length}</b><span>Novos colaboradores</span></div><div><b class="num">${P.atual.length}</b><span>Com alteração</span></div><div><b class="num">${P.iguais}</b><span>Sem mudança</span></div><div><b class="num">${P.semMat.length}</b><span>Sem matrícula (não entram)</span></div>${P.abaO ? `<div><b class="num">${nOcor}</b><span>Ocorrências novas</span></div>` : ''}</div>
        <div class="stackcol" style="gap:8px">
          <label class="switch"><input type="checkbox" id="impAtual" ${ST.atualizar ? 'checked' : ''}><span>Atualizar quem já está cadastrado (${P.atual.length})</span></label>
          <label class="switch"><input type="checkbox" id="impSync" ${ST.sync ? 'checked' : ''}><span>Levar área de atuação e função para Atividades Pátio, Atividades Bateria e Operação</span></label>
          ${P.fora.length ? `<label class="switch"><input type="checkbox" id="impFora" ${ST.excluirFora ? 'checked' : ''}><span>Excluir do Efetivo quem não está na planilha (${P.fora.length}: ${P.fora.slice(0, 6).map(c => esc(title(c.nome))).join(', ')}${P.fora.length > 6 ? '…' : ''}). Sai também de Atividades Pátio, Atividades Bateria e Operação; as ocorrências ficam.</span></label>` : ''}
          ${P.abaO ? `<label class="switch"><input type="checkbox" id="impOcorr" ${ST.ocorr ? 'checked' : ''}><span>Importar as ocorrências (${nOcor} novas · ${P.ocDup} já existiam${P.ocSem ? ' · ' + P.ocSem + ' sem colaborador cadastrado' : ''})</span></label>` : ''}
        </div>
        ${P.avisos.length ? `<details><summary class="small">${P.avisos.length} aviso(s)</summary><ul class="small">${P.avisos.slice(0, 60).map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
        ${P.semMat.length ? `<details><summary class="small">${P.semMat.length} pessoa(s) sem matrícula e sem ficha: cadastre pelo botão Cadastrar em "Pessoas sem ficha"</summary><p class="small">${P.semMat.slice(0, 80).map(r => esc(title(r.nome))).join(', ')}</p></details>` : ''}
        <div class="row-gap"><button class="btn pri" data-g="impOk" ${ST.busy || !(P.novos.length || (ST.atualizar && P.atual.length) || (ST.ocorr && nOcor) || (ST.excluirFora && P.fora.length)) ? 'disabled' : ''}>${ST.busy ? 'Gravando…' : 'Importar'}</button><button class="btn" data-g="impCancel">Cancelar</button></div></div>
        ${P.novos.length + P.atual.length ? `<div class="tw"><table><thead><tr><th>Matrícula</th><th>Nome</th><th></th><th>O que muda</th></tr></thead><tbody>
          ${[...P.novos, ...P.atual].slice(0, 300).map(x => `<tr><td class="mono">${esc(x.n.mat)}</td><td><b>${esc(title(x.n.nome))}</b></td><td>${x.antes ? '<span class="pill warn">altera</span>' : '<span class="pill ok">novo</span>'}</td><td class="small">${x.antes ? x.muda.map(esc).join('<br>') : esc([x.n.funcao, PES.areaNome(x.o.area) + (setDaArea(x.o.area) ? ' · ' + x.o.rota : '')].filter(Boolean).join(' · '))}</td></tr>`).join('')}
          </tbody></table></div>` : ''}</div>`;
    }
    h += `<div class="card"><header><h2>Pessoas sem ficha no Efetivo</h2><p>${sf.length} pessoa(s) estão em Atividades Pátio, Atividades Bateria ou Operação e ainda não têm ficha. Para ligar, cadastre com a matrícula.</p></header>${sf.length ? `<div class="tw"><table><thead><tr><th>Nome</th><th>Função</th><th>Onde está</th><th></th></tr></thead><tbody>
      ${sf.slice(0, 200).map((p, i) => `<tr><td><b>${esc(title(p.nome))}</b></td><td class="small">${esc(title(p.funcao || ''))}</td><td class="small">${esc(p.onde)}</td><td><button class="btn" data-g="impCad" data-i="${i}">${I.plus} Cadastrar</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="body"><div class="empty">Todos os colaboradores dos outros módulos já têm ficha.</div></div>'}</div>`;
    return h;
  }

  function onClick(d) {
    switch (d.g) {
      case 'impModelo': modeloCSV(); return true;
      case 'impOriginal': planilhaOriginal(); return true;
      case 'impRH': planilhaRH(); return true;
      case 'impSenior': planilhaSenior(); return true;
      case 'impOk': confirmar(); return true;
      case 'impCancel': ST.P = null; ST.arq = ''; ST.erro = ''; render(); return true;
      case 'impCad': { const p = PES.semFicha()[+d.i]; if (p) colabForm(null, p); return true; }
    }
    return false;
  }
  function onChange(t) {
    if (t.id === 'impArq') { const f = t.files[0]; t.value = ''; if (f) carregar(f); return true; }
    if (t.id === 'impAtual') { ST.atualizar = t.checked; render(); return true; }
    if (t.id === 'impSync') { ST.sync = t.checked; return true; }
    if (t.id === 'impFora') { ST.excluirFora = t.checked; render(); return true; }
    if (t.id === 'impOcorr') { ST.ocorr = t.checked; render(); return true; }
    return false;
  }
  return { view, onClick, onChange, _analisar: analisar, _acharTabelas: acharTabelas };
}
