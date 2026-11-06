// Dikma Gestão — RELATÓRIOS E ARQUIVO DE FOTOS (Parte 2): contas sem tela, as mesmas no navegador e nos testes do Node.
// O que está aqui: a situação de cada foto (no banco, exportada, na lixeira, arquivada fora do banco), o que pode ir
// para a lixeira ou ser apagado de vez, os nomes de pastas e arquivos do .zip, o índice (indice.csv), a conferência do
// SHA-256, os lotes de gravação, a confirmação digitada, o espaço ocupado e o conteúdo do relatório em PowerPoint
// (indicadores, por rota, grupos de fotos e limite de fotos). A tela fica em telas/fotos-arquivo.js e o PowerPoint em
// telas/fotos-pptx.js. Explicação completa em docs/fotos-atividades.md (Parte 2).
import { add, weekOf, monthOfWeek } from './cal.js';
import { fotosDaCel } from './fotos.js';

export const LIXEIRA_DIAS = 7;        // a foto fica recuperável na lixeira por 7 dias
export const MAX_FOTOS_PPTX = 120;    // fotos por relatório em PowerPoint (~150 KB cada: ~18 MB)
export const MAX_FOTOS_ZIP = 600;     // fotos por arquivo .zip (~90 MB na memória do aparelho)
export const FOTOS_POR_SLIDE = 4;
export const OPS_POR_LOTE = 400;      // gravações por lote (o Firestore aceita 500)

// ---------- situação de uma foto ----------
// Datas podem chegar como Date, texto ISO, número (ms) ou Timestamp do Firestore.
export const ms = v => (v == null ? null : typeof v === 'number' ? v : v instanceof Date ? v.getTime() : typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'string' ? Date.parse(v) : v.ms != null ? v.ms : null);
export const STATUS = Object.freeze({
  banco: { t: 'No banco', c: 'No banco', tom: 'neu', d: 'Ainda não exportada: a foto completa está no banco' },
  exportada: { t: 'Exportada', c: 'Exportada', tom: 'ok', d: 'Já está num arquivo .zip salvo; a foto completa continua no banco' },
  lixeira: { t: 'Na lixeira', c: 'Na lixeira', tom: 'warn', d: `Some das telas; pode ser restaurada (fica ${LIXEIRA_DIAS} dias antes de apagar de vez)` },
  arquivada: { t: 'Arquivada fora do banco', c: 'Arquivada', tom: 'info', d: 'A foto completa foi apagada do banco; fica a miniatura e o registro' }
});
export function statusFoto(f) {
  if (!f) return 'banco';
  if (f.removidaEm) return 'arquivada';
  if (f.lixeiraEm) return 'lixeira';
  if (f.exportadoEm) return 'exportada';
  return 'banco';
}
export const diasNaLixeira = (f, agora) => (f && f.lixeiraEm ? Math.floor((ms(agora) - ms(f.lixeiraEm)) / 864e5) : null);

// As atividades que a foto comprova. Fotos do código antigo têm ref 'semana#PID|k' (uma só).
export function refsDe(f) {
  if (f && Array.isArray(f.refs) && f.refs.length) return f.refs;
  if (f && typeof f.ref === 'string' && f.ref.includes('#')) { const [sem, resto] = f.ref.split('#'); return [`${sem}|${resto}`]; }
  return [];
}
export function partesRef(ref) {
  const p = String(ref).split('|'); if (p.length < 4) return null;
  const k = +p.pop(); const pid = p.pop(); return { semana: p.join('|'), pid, k };
}

// ---------- o que cada ação pode fazer ----------
// Exportar: precisa da foto completa no banco (no banco ou já exportada; a lixeira e as arquivadas não).
export const podeExportar = f => ['banco', 'exportada'].includes(statusFoto(f));
// Lixeira: só a já exportada. A foto que não bateu o SHA-256 na exportação fica fora do lote (confira o arquivo);
// pode ir sozinha com a confirmação (comDivergente).
export const podeLixeira = (f, { comDivergente = false } = {}) => statusFoto(f) === 'exportada' && (comDivergente || f.exportConf !== 'divergente');
export const podeRestaurar = f => statusFoto(f) === 'lixeira';
// Apagar de vez: só a que está na lixeira; antes dos 7 dias, só marcando "incluir as recentes".
export const podeApagarDefinitivo = (f, agora, { incluirRecentes = false } = {}) => statusFoto(f) === 'lixeira' && (incluirRecentes || diasNaLixeira(f, agora) >= LIXEIRA_DIAS);
// Separa a lista em quem pode e quem não pode, com o motivo (para a tela explicar).
export function separar(fotos, acao, { agora = Date.now(), incluirRecentes = false, comDivergente = false } = {}) {
  const sim = [], nao = [];
  for (const f of fotos) {
    const s = statusFoto(f);
    let ok = false, motivo = '';
    if (acao === 'exportar') { ok = podeExportar(f); motivo = ok ? '' : s === 'lixeira' ? 'está na lixeira' : 'já saiu do banco'; }
    else if (acao === 'lixeira') { ok = podeLixeira(f, { comDivergente }); motivo = ok ? '' : s === 'banco' ? 'ainda não foi exportada' : s === 'exportada' ? 'SHA-256 divergente na exportação' : s === 'lixeira' ? 'já está na lixeira' : 'já saiu do banco'; }
    else if (acao === 'restaurar') { ok = podeRestaurar(f); motivo = ok ? '' : 'não está na lixeira'; }
    else if (acao === 'apagar') { ok = podeApagarDefinitivo(f, agora, { incluirRecentes }); motivo = ok ? '' : s !== 'lixeira' ? 'não está na lixeira' : `na lixeira há menos de ${LIXEIRA_DIAS} dias`; }
    (ok ? sim : nao).push(ok ? f : { f, motivo });
  }
  return { sim, nao };
}

// ---------- lotes e confirmação ----------
// Ações em lotes: marcar exportada, lixeira e restaurar = 1 gravação por foto (400 por lote); apagar de vez = 2
// gravações por foto (apaga o arquivo e marca o documento leve) e a regra lê o documento leve de cada foto: o Firestore
// aceita no máximo 20 documentos lidos pelas regras num lote, então são 15 fotos por lote.
export const LOTE = Object.freeze({ exportar: OPS_POR_LOTE, lixeira: OPS_POR_LOTE, restaurar: OPS_POR_LOTE, apagar: 15 });
export function emLotes(lista, acao = 'lixeira') {
  const n = LOTE[acao] || OPS_POR_LOTE; const out = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}
// Identificador do lote de exportação: EXP-AAAAMMDD-HHMM-xxxx (hora local).
export function idLote(agora = new Date(), sufixo = Math.random().toString(36).slice(2, 6)) {
  const d = new Date(ms(agora)); const p = n => String(n).padStart(2, '0');
  return `EXP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${String(sufixo).replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'x'}`;
}
// Texto que o administrador digita para confirmar: a quantidade (lixeira) ou "APAGAR n" (apagar de vez).
export const textoConfirmacao = (acao, n) => (acao === 'apagar' ? `APAGAR ${n}` : String(n));
export const confirmacaoOk = (digitado, acao, n) => n > 0 && String(digitado || '').trim().replace(/\s+/g, ' ').toUpperCase() === textoConfirmacao(acao, n);

// ---------- conferência do SHA-256 ----------
// esperado = sha gravado pelo aparelho na hora da foto · calculado = sha dos bytes baixados agora.
export function conferirSha(esperado, calculado) {
  if (calculado == null) return 'sem-arquivo';
  if (!esperado) return 'sem-sha';
  return String(esperado).toLowerCase() === String(calculado).toLowerCase() ? 'ok' : 'divergente';
}
export const CONF_TXT = { ok: 'conferida', divergente: 'DIVERGENTE', 'sem-sha': 'sem SHA gravado (não conferida)', 'sem-arquivo': 'SEM ARQUIVO no banco (não exportada)' };

// ---------- espaço ----------
// No banco a foto fica em texto base64 (4/3 do arquivo) + a miniatura + os campos (~0,6 KB).
export const bytesArquivo = f => Math.ceil(((f && (f.bytes || f.tamanho)) || 0) * 4 / 3);
export const bytesLeve = f => String((f && f.thumb) || '').length + 600;
export function resumoEspaco(fotos, agora = Date.now()) {
  const por = Object.fromEntries(Object.keys(STATUS).map(s => [s, { n: 0, bytes: 0 }]));
  let total = 0, liberavel = 0, prontas = 0;
  for (const f of fotos) {
    const s = statusFoto(f); const b = (s === 'arquivada' ? 0 : bytesArquivo(f)) + bytesLeve(f);
    por[s].n++; por[s].bytes += b; total += b;
    if (s === 'lixeira') { liberavel += bytesArquivo(f); if (podeApagarDefinitivo(f, agora)) prontas++; }
  }
  return { n: fotos.length, bytes: total, por, liberavel, prontas };
}
export function fmtBytes(b) {
  const v = Number(b) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} KB`;
  const mb = v / 1024 / 1024; return `${(mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10).toString().replace('.', ',')} MB`;
}

// ---------- período ----------
// Semana padrão: segunda a domingo da semana de `hoje` (desloc = -1 é a semana passada).
export function periodoSemana(hoje, desloc = 0) { const de = add(weekOf(hoje), 7 * desloc); return { de, ate: add(de, 6) }; }
export function mesesDoPeriodo(de, ate) {
  const out = []; let m = de.slice(0, 7); const fim = ate.slice(0, 7);
  while (m <= fim && out.length < 60) { out.push(m); const [a, b] = m.split('-').map(Number); m = b === 12 ? `${a + 1}-01` : `${a}-${String(b + 1).padStart(2, '0')}`; }
  return out;
}
// Segundas-feiras das semanas que cobrem o período e o mês (campo mes) de cada uma (as semanas são lidas por mês).
export function semanasDoPeriodo(de, ate) { const out = []; for (let s = weekOf(de); s <= ate && out.length < 60; s = add(s, 7)) out.push(s); return out; }
export const mesesDasSemanas = (de, ate) => [...new Set(semanasDoPeriodo(de, ate).map(monthOfWeek))];
export function validarPeriodo(de, ate) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(de || '') || !re.test(ate || '')) return 'Escolha as datas de início e fim.';
  if (ate < de) return 'A data final é antes da inicial.';
  if (add(de, 92) < ate) return 'Escolha um período de até 3 meses.';
  return '';
}
export const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export const ddmm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

// ---------- nomes no .zip ----------
// Sem acentos e sem os caracteres que o Windows não aceita; maiúsculas; até `max` caracteres.
export function limparNome(s, max = 60) {
  let t = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (t.length > max) t = t.slice(0, max).trim();
  t = t.replace(/[. ]+$/, '');
  return t || 'SEM NOME';
}
export const pastaPeriodo = (de, ate) => `${de}_a_${ate}`;
// Pasta da atividade: "ROTA - LOCAL - ATIVIDADE"; foto de várias atividades: "ROTA - VARIAS ATIVIDADES (n)".
export function pastaAtividade(f, itens = []) {
  const rota = limparNome(f.rota || (itens[0] && itens[0].rota) || 'SEM ROTA', 30);
  if (itens.length > 1) return `${rota} - VARIAS ATIVIDADES (${itens.length})`;
  const it = itens[0] || { local: f.local, ativ: f.ativ };
  return limparNome(`${rota} - ${limparNome(it.local || 'SEM LOCAL', 30)} - ${limparNome(it.ativ || 'SEM ATIVIDADE', 60)}`, 110);
}
export const nomeArquivo = f => `${f.dia}_${String(f.id).replace(/[^A-Za-z0-9_-]/g, '')}.jpg`;
export function caminhoZip(f, itens, de, ate) {
  return `${pastaPeriodo(de, ate)}/${limparNome(f.porNome || 'SEM COLABORADOR', 50)}/${pastaAtividade(f, itens)}/${nomeArquivo(f)}`;
}

// ---------- índice (indice.csv) ----------
// Separador ponto e vírgula (o Excel em português abre direto) e BOM (acentos certos). Uma linha por foto e
// atividade: a foto que vale para 5 atividades tem 5 linhas apontando para o mesmo arquivo.
export const CSV_CAB = ['id', 'data', 'area', 'rota', 'local', 'atividade', 'situacao', 'colaborador', 'sha256', 'arquivo', 'conferencia', 'lote'];
export const SIT_TXT = { R: 'Realizada', N: 'Não realizada', E: 'Extra', P: 'Programada', _: '' };
export function csvCampo(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmula ao abrir no Excel
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function linhasIndice(fotos, { itensDe, caminhoDe, confDe = () => '', lote = '' }) {
  const out = [];
  for (const f of fotos) {
    const itens = itensDe(f); const arq = caminhoDe(f); const conf = confDe(f);
    const ls = itens.length ? itens : [{ rota: f.rota, local: f.local, ativ: f.ativ, sit: f.sit }];
    for (const it of ls) out.push([f.id, f.dia, f.area, it.rota || f.rota || '', it.local || '', it.ativ || '', SIT_TXT[it.sit || f.sit] || it.sit || f.sit || '', f.porNome || '', f.sha || '', arq, CONF_TXT[conf] || conf, lote]);
  }
  return out;
}
export const gerarCsv = (linhas, cab = CSV_CAB) => '﻿' + [cab, ...linhas].map(l => l.map(csvCampo).join(';')).join('\r\n') + '\r\n';
// Leitura simples do CSV gerado (para os testes e para conferir o arquivo).
export function lerCsv(txt) {
  const t = String(txt).replace(/^﻿/, ''); const linhas = []; let campo = '', linha = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') q = false; else campo += c; continue; }
    if (c === '"') q = true; else if (c === ';') { linha.push(campo); campo = ''; } else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// ---------- relatório (PowerPoint) ----------
const linhaDoc = (doc, i) => (doc.d ? doc.d[i] : ((doc.s && doc.s[doc.ids[i]]) || '_______'));
const pctDe = (a, b) => (b ? Math.round(a / b * 100) : null);
// Atividades de uma foto (pela lista de refs e o plano): [{ pid, rota, local, ativ, tipo, sit, semana, k }].
export function itensDaFoto(f, { plano, semanas }) {
  const out = [];
  for (const r of refsDe(f)) {
    const x = partesRef(r); if (!x) continue;
    const p = (plano && plano.get(x.pid)) || {}; const doc = semanas && semanas[x.semana];
    const i = doc ? doc.ids.indexOf(x.pid) : -1; const sit = i >= 0 ? linhaDoc(doc, i)[x.k] : f.sit;
    out.push({ pid: x.pid, rota: p.rota || f.rota || '', local: p.local || '', ativ: p.ativ || '', tipo: p.tipo || '', sit: sit && sit !== '_' ? sit : f.sit || '', semana: x.semana, k: x.k });
  }
  return out;
}
// semanas: { id: doc } · plano: Map pid → { rota, local, ativ, tipo } · fotos: documentos leves do período
// Conta os dias do período até hoje: programadas (P, R, N), realizadas, não realizadas, pendentes, extras,
// % de cumprimento (R / programadas) e % com foto (realizadas e extras com pelo menos uma foto, pela contagem ft da
// semana; as fotos arquivadas fora do banco continuam contando).
export function montarRelatorio({ semanas, plano, fotos, de, ate, hoje, rota = '', areas = null }) {
  const fim = ate < hoje ? ate : hoje;
  const novo = () => ({ prog: 0, R: 0, N: 0, P: 0, E: 0, exigem: 0, comFoto: 0 });
  const ind = novo(); const porRota = new Map(); const naoReal = []; const semFoto = [];
  for (const doc of Object.values(semanas || {})) {
    if (areas && !areas.includes(doc.area)) continue;
    if (add(doc.ini, 6) < de || doc.ini > fim) continue;
    for (let k = 0; k < 7; k++) {
      const dt = add(doc.ini, k); if (dt < de || dt > fim) continue;
      for (let i = 0; i < doc.ids.length; i++) {
        const c = linhaDoc(doc, i)[k]; if (!c || c === '_') continue;
        const pid = doc.ids[i]; const p = (plano && plano.get(pid)); if (!p) continue;
        if (rota && p.rota !== rota) continue;
        const kr = doc.area + '|' + p.rota;
        if (!porRota.has(kr)) porRota.set(kr, { rota: p.rota, area: doc.area, ...novo() });
        const alvos = [ind, porRota.get(kr)];
        const temFoto = fotosDaCel(doc, pid, k) > 0;
        for (const a of alvos) {
          if (c === 'E') a.E++; else { a.prog++; if (c === 'R') a.R++; else if (c === 'N') a.N++; else a.P++; }
          if (c === 'R' || c === 'E') { a.exigem++; if (temFoto) a.comFoto++; }
        }
        if (c === 'N') naoReal.push({ dia: dt, area: doc.area, rota: p.rota, local: p.local || '', ativ: p.ativ || '', motivo: (doc.m && doc.m[pid + '|' + k]) || '' });
        if ((c === 'R' || c === 'E') && !temFoto) semFoto.push({ dia: dt, area: doc.area, rota: p.rota, local: p.local || '', ativ: p.ativ || '', sit: c });
      }
    }
  }
  const fechar = a => ({ ...a, cumpr: pctDe(a.R, a.prog), pctFoto: pctDe(a.comFoto, a.exigem) });
  // grupos de fotos: mesma(s) atividade(s) no mesmo dia (as fotos do "Marcar restantes" ficam juntas)
  const grupos = new Map();
  const ordena = (a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : String(a.rota).localeCompare(String(b.rota)) || String(a.titulo).localeCompare(String(b.titulo)));
  for (const f of fotos || []) {
    const s = statusFoto(f); if (s === 'lixeira') continue;
    if (f.dia < de || f.dia > ate) continue;
    const itens = itensDaFoto(f, { plano, semanas });
    const r0 = (itens[0] && itens[0].rota) || f.rota || '';
    if (rota && r0 !== rota) continue;
    const chave = f.dia + '#' + itens.map(x => x.semana + '|' + x.pid).sort().join(',');
    if (!grupos.has(chave)) {
      const um = itens.length === 1 ? itens[0] : null;
      grupos.set(chave, { chave, dia: f.dia, area: f.area, rota: r0, itens, titulo: um ? um.ativ || f.ativ : `${itens.length} atividades`, local: um ? um.local : [...new Set(itens.map(x => x.local).filter(Boolean))].join('; '), sit: um ? um.sit : f.sit, colabs: [], fotos: [] });
    }
    const g = grupos.get(chave); g.fotos.push(f); if (f.porNome && !g.colabs.includes(f.porNome)) g.colabs.push(f.porNome);
  }
  const lista = [...grupos.values()].sort(ordena);
  for (const g of lista) g.fotos.sort((a, b) => (ms(a.at) || 0) - (ms(b.at) || 0));
  return {
    de, ate, fim, rota, ind: fechar(ind),
    porRota: [...porRota.values()].map(fechar).sort((a, b) => String(a.area).localeCompare(String(b.area)) || String(a.rota).localeCompare(String(b.rota))),
    grupos: lista, naoReal: naoReal.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0)), semFoto: semFoto.sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0)),
    nFotos: lista.reduce((s, g) => s + g.fotos.length, 0)
  };
}
// Limite de fotos do relatório: em rodízio entre as atividades (a 1ª foto de cada uma, depois a 2ª…), para o
// relatório cobrir o período todo. Com mais atividades que o limite, entram atividades espalhadas pelo período
// (uma foto cada). Devolve os grupos com as fotos que entram e quantas ficaram de fora.
export function limitarFotos(grupos, max = MAX_FOTOS_PPTX) {
  const total = grupos.reduce((s, g) => s + g.fotos.length, 0);
  if (total <= max) return { grupos, fora: 0, total };
  const pega = grupos.map(() => 0); let usadas = 0;
  if (grupos.length > max) { for (let j = 0; j < max; j++) pega[Math.floor(j * grupos.length / max)] = 1; usadas = max; }
  let mexeu = true;
  while (usadas < max && mexeu) { mexeu = false; for (let i = 0; i < grupos.length && usadas < max; i++) if (pega[i] < grupos[i].fotos.length) { pega[i]++; usadas++; mexeu = true; } }
  const out = grupos.map((g, i) => ({ ...g, fotos: g.fotos.slice(0, pega[i]), foraAqui: g.fotos.length - pega[i] })).filter(g => g.fotos.length);
  return { grupos: out, fora: total - usadas, total };
}
// Slides de fotos (até n por slide): a atividade com 4 fotos ou mais fica em slides só dela; as atividades com poucas
// fotos do mesmo dia e rota dividem o slide (sem partir a atividade), cada foto com a legenda da sua atividade.
// Devolve [{ grupos: [g], fotos: [{ f, g }] }] na ordem dos grupos.
export function paginasFotos(grupos, n = FOTOS_POR_SLIDE) {
  const out = []; let aberta = null;
  for (const g of grupos) {
    if (g.fotos.length >= n) {
      aberta = null;
      for (let i = 0; i < g.fotos.length; i += n) out.push({ grupos: [g], fotos: g.fotos.slice(i, i + n).map(f => ({ f, g })), parte: [i / n + 1, Math.ceil(g.fotos.length / n)] });
      continue;
    }
    const cabe = aberta && aberta.dia === g.dia && aberta.rota === g.rota && aberta.area === g.area && aberta.fotos.length + g.fotos.length <= n;
    if (!cabe) { aberta = { dia: g.dia, rota: g.rota, area: g.area, grupos: [], fotos: [] }; out.push(aberta); }
    aberta.grupos.push(g); for (const f of g.fotos) aberta.fotos.push({ f, g });
  }
  return out.map(({ grupos: gs, fotos, parte }) => ({ grupos: gs, fotos, parte: parte || null }));
}
// Páginas de até n itens (slides de fotos e de tabelas).
export function paginar(lista, n) { const out = []; for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n)); return out; }
// Posição das fotos no slide: 1 grande, 2 lado a lado, 3 e 4 em grade 2 × 2. Caixa disponível (polegadas).
export function gradeFotos(n, caixa = { x: 0.5, y: 1.75, w: 12.33, h: 5.1 }, leg = 0.32, gap = 0.2) {
  const cols = n <= 1 ? 1 : 2; const rows = n <= 2 ? 1 : 2;
  const w = (caixa.w - gap * (cols - 1)) / cols; const h = (caixa.h - gap * (rows - 1)) / rows;
  const out = [];
  for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push({ x: caixa.x + c * (w + gap), y: caixa.y + r * (h + gap), w, h: h - leg, leg }); }
  return out;
}
// Encaixa a foto (largura × altura em pixels) na caixa sem deformar, centralizada.
export function encaixar(pw, ph, cx) {
  const r = pw > 0 && ph > 0 ? pw / ph : 4 / 3; let w = cx.w, h = w / r;
  if (h > cx.h) { h = cx.h; w = h * r; }
  return { x: cx.x + (cx.w - w) / 2, y: cx.y + (cx.h - h) / 2, w, h };
}
