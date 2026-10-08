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

export function criarImportador(X) {
  const { DB, esc, title, I, toast, render, PES, colabForm } = X;
  const G = () => DB.cache.g;
  const ST = { arq: '', P: null, busy: false, erro: '', atualizar: true, sync: true, ocorr: true };

  // Monta o plano de importação sem gravar nada.
  function analisar(tab, origem) {
    const P = { origem, aba: tab.colab ? tab.colab.aba : '', abaO: tab.ocorr ? tab.ocorr.aba : '', lidas: 0, novos: [], atual: [], iguais: 0, semMat: [], avisos: [], ocorr: [], ocDup: 0, ocSem: 0 };
    const efet = G().colabs; const porMat = new Map(efet.map(c => [String(c.mat), c])); const porNome = new Map(efet.map(c => [norm(c.nome), c]));
    if (tab.colab) {
      const { cols, dados } = tab.colab; const g = k => r => (k in cols ? r[cols[k]] : null);
      let regs = dados.map(r => ({ mat: matDe(g('mat')(r)), nome: txt(g('nome')(r)).toUpperCase(), funcao: txt(g('funcao')(r)).toUpperCase(), areaTxt: txt(g('area')(r)), rota: txt(g('rota')(r)).toUpperCase(), regime: txt(g('regime')(r)).toUpperCase(), turma: txt(g('turma')(r)).toUpperCase(), lider: txt(g('lider')(r)).toUpperCase(), adm: data(g('adm')(r)), dem: data(g('dem')(r)), mes: txt(g('mes')(r)).slice(0, 7), escala: txt(g('escala')(r)).toUpperCase() }))
        .filter(r => r.nome || r.mat).filter(r => !/^\d+$/.test(r.nome));
      // Planilhas mensais (uma linha por pessoa por mês): fica a linha do mês atual ou a mais recente até hoje.
      if ('mes' in cols) {
        const ym = today().slice(0, 7), grupos = new Map();
        for (const r of regs) { const k = r.mat || norm(r.nome); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); }
        regs = [...grupos.values()].map(l => { const ok = l.filter(x => x.mes && x.mes <= ym).sort((a, b) => (a.mes < b.mes ? 1 : -1)); return ok[0] || l.slice().sort((a, b) => (a.mes < b.mes ? -1 : 1))[0]; });
      }
      P.lidas = regs.length;
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
        if (r.areaTxt) {
          const a = areaDe(r.areaTxt);
          // "COQUERIA" é a área geral da ficha: não tira ninguém da rota onde já está.
          if (!a) P.avisos.push(`${title(r.nome || r.mat)}: área "${r.areaTxt}" não existe no sistema (mantida a atual).`);
          else if (a !== AREA_GERAL && a !== atual.area) { o.area = a; mudaArea = true; }
          if (a && a !== AREA_GERAL && a !== n.area) n.area = a;
        }
        if (setDaArea(o.area)) {
          const rotas = PES.rotasDe(o.area);
          if (r.rota) { const rr = rotas.find(x => norm(x) === norm(r.rota)); if (rr && rr !== atual.rota) { o.rota = rr; mudaArea = true; } else if (!rr) P.avisos.push(`${title(r.nome)}: rota "${r.rota}" não existe em ${AREA_S[o.area]}.`); }
          if (mudaArea && !rotas.includes(o.rota)) o.rota = rotas.find(x => x !== 'GESTÃO') || rotas[0] || '';
          if (r.regime) { const rg = REGIMES.find(x => norm(x) === norm(r.regime)); if (rg && rg !== atual.regime) { o.regime = rg; mudaArea = true; } }
        }
        if (r.escala && (o.op || o.area === AREA_OP)) { const e = /4/.test(r.escala) ? '4x4' : 'ADM'; if (e !== atual.escala) { o.escala = e; mudaArea = true; } }
        if (mudaArea) muda.push(`área: ${PES.lotacao(antes || n).txt} → ${PES.areaNome(o.area)}${setDaArea(o.area) ? ' · ' + o.rota : ''}`);
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
  async function planilhaOriginal() {
    ST.busy = true; ST.erro = ''; ST.P = null; ST.arq = 'Planilha original de fichas (FO-RED-COQ-004)'; render();
    try {
      const s = await (await fetch('seed-gestao.json')).json();
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
      if (P.novos.length || nAt) { G().colabs = itens; DB.gSalvarColabs(itens); }
      if (sync.length) PES.sincronizarVarios(sync);
      const nOc = ST.ocorr ? P.ocorr.length : 0;
      if (nOc) await DB.gImportarOcorrencias(P.ocorr);
      DB.log(`Efetivo: importou ${P.origem} (${P.novos.length} novos, ${nAt} atualizados${nOc ? ', ' + nOc + ' ocorrências' : ''})`);
      toast(`Importado: ${P.novos.length} novos, ${nAt} atualizados${nOc ? ', ' + nOc + ' ocorrências' : ''}`);
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
    let h = `<div class="grid2"><div class="card"><header><h2>Importar planilha</h2><p>Excel (.xlsx, .xlsm, .xls) ou CSV</p></header><div class="body stackcol">
      <p class="m0 small">O sistema procura sozinho a tabela de colaboradores (colunas <b>MATRÍCULA</b>, <b>NOME</b>, <b>FUNÇÃO</b>, <b>ÁREA</b>, <b>ROTA</b>, <b>REGIME</b>, <b>TURMA</b>, <b>LÍDER</b>, <b>ADMISSÃO</b>, <b>DEMISSÃO</b>; só nome e matrícula são obrigatórios) e, se houver, a de ocorrências. Serve a própria planilha de fichas, a aba EFETIVO das planilhas do Pátio e da Bateria ou uma lista do RH.</p>
      <div class="row-gap"><label class="btn pri">${I.file} ${ST.busy ? 'Lendo…' : 'Escolher arquivo'}<input type="file" id="impArq" accept=".xlsx,.xlsm,.xls,.csv,.txt" hidden ${ST.busy ? 'disabled' : ''}></label><button class="btn" data-g="impModelo">${I.dl} Baixar modelo</button></div>
      ${ST.erro ? `<p class="err m0">${esc(ST.erro)}</p>` : ''}</div></div>
      <div class="card"><header><h2>Planilha original de fichas</h2><p>FO-RED-COQ-004, a mesma do primeiro acesso</p></header><div class="body stackcol"><p class="m0 small">Traz de novo os colaboradores e as ocorrências da planilha original. Só entra o que ainda não existe no sistema: nada é apagado ou duplicado.</p><button class="btn" data-g="impOriginal" style="align-self:flex-start" ${ST.busy ? 'disabled' : ''}>Conferir o que falta</button></div></div></div>`;
    if (P) {
      const nOcor = P.ocorr.length;
      h += `<div class="card"><header><h2>Conferência · ${esc(P.origem)}</h2><p>${P.aba ? 'Colaboradores da aba ' + esc(P.aba) : ''}${P.abaO ? ' · ocorrências da aba ' + esc(P.abaO) : ''} · ${P.lidas} pessoa(s) lidas. Nada foi gravado ainda.</p></header>
        <div class="body stackcol"><div class="mini"><div><b class="num">${P.novos.length}</b><span>Novos colaboradores</span></div><div><b class="num">${P.atual.length}</b><span>Com alteração</span></div><div><b class="num">${P.iguais}</b><span>Sem mudança</span></div><div><b class="num">${P.semMat.length}</b><span>Sem matrícula (não entram)</span></div>${P.abaO ? `<div><b class="num">${nOcor}</b><span>Ocorrências novas</span></div>` : ''}</div>
        <div class="stackcol" style="gap:8px">
          <label class="switch"><input type="checkbox" id="impAtual" ${ST.atualizar ? 'checked' : ''}><span>Atualizar quem já está cadastrado (${P.atual.length})</span></label>
          <label class="switch"><input type="checkbox" id="impSync" ${ST.sync ? 'checked' : ''}><span>Levar área de atuação e função para Atividades Pátio, Atividades Bateria e Operação</span></label>
          ${P.abaO ? `<label class="switch"><input type="checkbox" id="impOcorr" ${ST.ocorr ? 'checked' : ''}><span>Importar as ocorrências (${nOcor} novas · ${P.ocDup} já existiam${P.ocSem ? ' · ' + P.ocSem + ' sem colaborador cadastrado' : ''})</span></label>` : ''}
        </div>
        ${P.avisos.length ? `<details><summary class="small">${P.avisos.length} aviso(s)</summary><ul class="small">${P.avisos.slice(0, 60).map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
        ${P.semMat.length ? `<details><summary class="small">${P.semMat.length} pessoa(s) sem matrícula e sem ficha: cadastre pelo botão Cadastrar em "Pessoas sem ficha"</summary><p class="small">${P.semMat.slice(0, 80).map(r => esc(title(r.nome))).join(', ')}</p></details>` : ''}
        <div class="row-gap"><button class="btn pri" data-g="impOk" ${ST.busy || !(P.novos.length || (ST.atualizar && P.atual.length) || (ST.ocorr && nOcor)) ? 'disabled' : ''}>${ST.busy ? 'Gravando…' : 'Importar'}</button><button class="btn" data-g="impCancel">Cancelar</button></div></div>
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
    if (t.id === 'impOcorr') { ST.ocorr = t.checked; render(); return true; }
    return false;
  }
  return { view, onClick, onChange, _analisar: analisar, _acharTabelas: acharTabelas };
}
