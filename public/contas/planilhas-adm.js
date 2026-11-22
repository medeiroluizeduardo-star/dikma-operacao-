// Dikma Gestão — leitura das planilhas do Administrativo (sem dependências: recebe as abas já lidas).
// 1) CONTROLE DE FREQUÊNCIA (Pátio e Bateria): uma aba por competência (16 do mês anterior a 15 do mês),
//    blocos por grupo (líder/supervisão, turma de turno), uma linha por pessoa e um código por dia.
// 2) FÉRIAS GERAL: uma aba por mês, blocos por setor, uma linha por período de férias.
// Usado pela tela Administrativo › Importar e pelo script que gera dados-importacao (mesma conta nos dois).
//
// Cada aba chega como { nome, linhas: [[valor, ...], ...], merges: [{ s: {r, c}, e: {r, c} }] } (linhas e colunas a partir de 0).

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normNome = s => semAcento(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

// Códigos da planilha → códigos do sistema (os mesmos do Efetivo diário).
// Nos grupos administrativos, S (sábado) e D (domingo) são folga. Nos grupos de turno, D é dia trabalhado,
// N é noite trabalhada e FO / Fg são folga.
export const CODIGOS_PLANILHA = {
  P: 'P', HE: 'HE', AT: 'AT', F: 'FT', AB: 'AB', SP: 'SP', T: 'TR', INSS: 'AF', N: 'P',
  S: 'F', FO: 'F', FG: 'F', FE: 'F'
};
// Nomes dos códigos: tabela única em situacao.js
export { NOMES_CODIGO } from './situacao.js';

function celula(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  return s === '' ? null : s;
}
// Espalha o valor das células mescladas por todo o intervalo (ex.: FÉRIAS de C a Q).
function expandir(aba) {
  const L = aba.linhas.map(l => (l || []).map(celula));
  for (const m of aba.merges || []) {
    const v = (L[m.s.r] || [])[m.s.c]; if (v == null) continue;
    for (let r = m.s.r; r <= m.e.r; r++) { L[r] = L[r] || []; for (let c = m.s.c; c <= m.e.c; c++) if (L[r][c] == null) L[r][c] = v; }
  }
  return L;
}
// Competência pelo nome da aba ("OUTUBRO", "JULHO 2026"); sem ano, usa o da aba anterior (as abas seguem em ordem).
function competencia(nome, anoAnterior, mesAnterior) {
  const n = semAcento(nome).toUpperCase();
  const i = MESES.findIndex(m => n.includes(semAcento(m)));
  if (i < 0) return null;
  const a = (n.match(/20\d\d/) || [])[0];
  let ano = a ? +a : anoAnterior;
  if (!a && mesAnterior != null && i < mesAnterior) ano++;
  return { ano, mes: i + 1 };
}
// Linha de cabeçalho de grupo: muitos dias (números 1–31 ou datas) a partir da coluna C.
function diasDoCabecalho(l) {
  const out = [];
  for (let c = 2; c < l.length; c++) {
    const v = l[c];
    if (v instanceof Date) out.push({ c, dia: v.getDate(), data: iso(v) });
    else if (typeof v === 'number' && v >= 1 && v <= 31 && Number.isInteger(v)) out.push({ c, dia: v });
    else if (typeof v === 'string' && /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 31) out.push({ c, dia: +v });
  }
  return out.length >= 20 ? out : null;
}
// Nome da pessoa e o que vem depois do " - " (turma, LIDER, observação).
function separarNome(bruto) {
  const s = String(bruto).replace(/\s+/g, ' ').trim();
  const m = s.match(/^(.*?)\s+-\s*(.*)$/);
  const nome = (m ? m[1] : s).trim(); const resto = m ? m[2].trim() : '';
  const turma = (resto.match(/^(?:LETRA\s+)?([A-Z])$/i) || resto.match(/LETRA\s+([A-Z])\b/i) || [])[1] || '';
  return { nome, turma: turma.toUpperCase(), obs: turma ? '' : resto, lider: /\bL[IÍ]DER\b/i.test(resto) };
}
// Texto longo numa célula (ou num trecho mesclado): o que significa para o dia.
function evento(txt) {
  const t = semAcento(txt).toUpperCase();
  if (/^FERIAS/.test(t)) return { cod: 'FE' };
  if (/^FERIADO/.test(t)) return { cod: 'F' };
  if (/INSS|AFASTAD|SINDICATO/.test(t)) return { cod: 'AF', nota: txt };
  if (/DESL|DESLIG|PEDIU CONTA|RESCIS/.test(t)) return { cod: 'DS', nota: txt, fim: true };
  if (/ADMISS/.test(t)) return { antes: true, nota: txt };
  if (/VOLTOU|VEIO|TRANSF|SEDE|PREDIAL|ALTO FORNO/.test(t)) return { nota: txt };
  return { nota: txt };
}

// Lê uma planilha de frequência inteira. conjunto = 'patio' | 'bateria'.
export function lerFrequencia(abas, conjunto) {
  const comps = []; let ano = null, mesAnt = null;
  const avisos = [];
  for (const aba of abas) {
    /** @type {{ ano?: number, mes: number } | null} */
    let cp = competencia(aba.nome, ano, mesAnt);
    const L = expandir(aba);
    // ano pelas datas, quando houver
    if (!cp || !cp.ano) {
      for (const l of L) for (const v of l || []) if (v instanceof Date) { cp = cp || { mes: v.getMonth() + 2 > 12 ? 1 : v.getMonth() + 2 }; cp.ano = cp.ano || (v.getMonth() === 11 && cp.mes === 1 ? v.getFullYear() + 1 : v.getFullYear()); break; }
    }
    if (!cp || !cp.ano) { avisos.push(`Aba "${aba.nome}": não deu para saber o mês. Ficou de fora.`); continue; }
    ano = cp.ano; mesAnt = cp.mes;
    const fim = `${cp.ano}-${pad(cp.mes)}-15`;
    const ini = addDias(`${cp.mes === 1 ? cp.ano - 1 : cp.ano}-${pad(cp.mes === 1 ? 12 : cp.mes - 1)}-16`, 0);
    const grupos = []; let g = null, cols = null;
    for (let r = 0; r < L.length; r++) {
      const l = L[r] || [];
      const cab = diasDoCabecalho(l);
      if (cab) {
        // data de cada coluna: do dia 16 do mês anterior em diante, seguindo os números do cabeçalho
        let atual = ini; cols = [];
        for (let i = 0; i < cab.length; i++) {
          const x = cab[i];
          if (x.data) atual = x.data;
          else if (i > 0) { let d = addDias(atual, 1); while (+d.slice(8) !== x.dia && d <= fim) d = addDias(d, 1); atual = d; }
          else { let d = ini; while (+d.slice(8) !== x.dia && d <= fim) d = addDias(d, 1); atual = d; }
          if (atual >= ini && atual <= fim) cols.push({ c: x.c, data: atual });
        }
        const rot = String(l[1] || l[0] || '').replace(/\s+/g, ' ').trim();
        const turno = /TURNO|3X3|4X4|LETRA/i.test(rot);
        g = { nome: rot || 'SEM GRUPO', turno, pessoas: [] }; grupos.push(g);
        continue;
      }
      if (!g || !cols) continue;
      if (l.filter(v => typeof v === 'string' && /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ|SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)$/i.test(v.trim())).length >= 10) continue;
      const bruto = l[1] != null && typeof l[1] === 'string' ? l[1] : (typeof l[0] === 'string' && l[0].length > 6 ? l[0] : null);
      if (!bruto || /^(SET|OUT|NOV|DEZ|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO)$/i.test(bruto)) continue;
      const pn = separarNome(bruto);
      if (normNome(pn.nome).split(' ').length < 2) continue;
      const dias = {}; const notas = []; let desligado = null;
      for (const { c, data } of cols) {
        let v = l[c]; if (v == null) continue;
        if (typeof v === 'number') continue;
        if (v instanceof Date) continue;
        const k = semAcento(v).toUpperCase().trim();
        if (k === 'X') continue;
        if (k.length <= 5 && !/^FERIA/.test(k)) {
          let cod = k === 'D' ? (g.turno ? 'P' : 'F') : CODIGOS_PLANILHA[k];
          if (!cod) { if (!notas.includes(`código "${v}"`)) notas.push(`código "${v}"`); continue; }
          dias[data] = cod;
        } else {
          const e = evento(v);
          if (e.nota && !notas.includes(e.nota)) notas.push(e.nota);
          if (e.cod === 'DS') { desligado = desligado || data; dias[data] = 'DS'; }
          else if (e.cod) dias[data] = e.cod;
        }
      }
      g.pessoas.push({ nome: pn.nome, chave: normNome(pn.nome), turma: pn.turma, lider: pn.lider, obs: pn.obs, dias, notas, desligado });
    }
    comps.push({ competencia: `${cp.ano}-${pad(cp.mes)}`, ini, fim, aba: aba.nome, grupos: grupos.filter(x => x.pessoas.length) });
  }
  return { conjunto, competencias: comps, avisos };
}

// Lê a planilha de férias. Datas viram AAAA-MM-DD.
export function lerFerias(abas) {
  const out = []; const avisos = [];
  const data = v => (v instanceof Date ? iso(v) : typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(v.trim()) ? v.trim().split('/').reverse().join('-') : null);
  for (const aba of abas) {
    const L = expandir(aba); let cols = null;
    for (const l0 of L) {
      const l = l0 || [];
      const hdr = l.map(v => semAcento(v || '').toUpperCase().trim());
      if (hdr.includes('MATRICULA') && hdr.includes('NOME')) {
        const ix = re => hdr.findIndex(h => re.test(h));
        cols = { mat: ix(/^MATRICULA/), nome: ix(/^NOME/), setor: ix(/SETOR/), funcao: ix(/FUNCAO/), horario: ix(/HORARIO/), adm: ix(/ADMISSAO/), limite: ix(/LIMITE/), ini: ix(/INICIO/), dias: ix(/^DIAS/), fim: ix(/TERMINO/), retorno: ix(/RETORNO/), obs: ix(/^OBS/) };
        continue;
      }
      if (!cols) continue;
      const nome = l[cols.nome]; const mat = l[cols.mat];
      if (!nome || typeof nome !== 'string' || normNome(nome).split(' ').length < 2) continue;
      if (mat === nome || /F[EÉ]RIAS/i.test(nome)) continue; // título do bloco (mesclado na linha toda)
      const reg = {
        mat: mat != null ? String(mat).replace(/\.0$/, '').trim() : '', nome: nome.replace(/\s+/g, ' ').trim(), setor: String(l[cols.setor] || '').trim(),
        funcao: String(l[cols.funcao] || '').replace(/\s+/g, ' ').trim(), horario: String(l[cols.horario] || '').trim(),
        admissao: data(l[cols.adm]), limite: data(l[cols.limite]), inicio: data(l[cols.ini]),
        dias: typeof l[cols.dias] === 'number' ? l[cols.dias] : (parseInt(l[cols.dias], 10) || null),
        termino: data(l[cols.fim]), retorno: data(l[cols.retorno]), obs: cols.obs >= 0 && l[cols.obs] ? String(l[cols.obs]).trim() : '', aba: aba.nome
      };
      if (reg.inicio && !reg.termino && reg.dias) reg.termino = addDias(reg.inicio, reg.dias - 1);
      out.push(reg);
    }
  }
  // a mesma pessoa e o mesmo início em duas abas: fica uma vez
  const vistos = new Set(); const unicos = [];
  for (const r of out) { const k = (r.mat || normNome(r.nome)) + '|' + (r.inicio || r.aba); if (vistos.has(k)) continue; vistos.add(k); unicos.push(r); }
  return { ferias: unicos, avisos };
}

// SheetJS → formato de abas usado acima.
export function abasDoXLSX(XLSX, wb) {
  return wb.SheetNames.map(n => {
    const ws = wb.Sheets[n];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    // a leitura começa onde a aba tem dados; as mesclagens usam a posição real: alinha as duas
    const r0 = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s : { r: 0, c: 0 };
    const alinhadas = [...Array(r0.r).fill(null).map(() => []), ...linhas.map(l => [...Array(r0.c).fill(null), ...l])];
    return { nome: n, linhas: alinhadas, merges: ws['!merges'] || [] };
  });
}

// ---- Encontrar a mesma pessoa em outra lista (nomes com acento, espaço a mais ou uma letra trocada) ----
function distancia(a, b) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > 3) return 9;
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let p = v[0]; v[0] = i; for (let j = 1; j <= b.length; j++) { const t = v[j]; v[j] = Math.min(v[j] + 1, v[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return v[b.length];
}
// lista: itens com nome (e mat, se houver). Devolve (nome, mat?) → { item, certeza: 'mat' | 'exato' | 'parecido' } ou null.
export function criarBusca(lista, nomeDe = x => x.nome) {
  const porNome = new Map(), porMat = new Map(), todos = [];
  for (const x of lista || []) {
    const k = normNome(nomeDe(x)); if (!k) continue;
    if (!porNome.has(k)) porNome.set(k, x);
    if (x.mat) porMat.set(String(x.mat), x);
    todos.push({ k, t: k.split(' '), x });
  }
  return (nome, mat) => {
    if (mat && porMat.has(String(mat))) return { item: porMat.get(String(mat)), certeza: 'mat' };
    const k = normNome(nome); if (!k) return null;
    if (porNome.has(k)) return { item: porNome.get(k), certeza: 'exato' };
    const t = k.split(' '); let melhor = null, nota = 0, empate = false;
    for (const c of todos) {
      if (c.t[0] !== t[0]) continue;
      // mesmas palavras, uma faltando (ex.: sem o "DE"), ou no máximo 2 letras diferentes no nome todo
      const comuns = t.filter(p => c.t.includes(p)).length;
      const n = distancia(k, c.k) <= 2 ? 3 : comuns >= Math.min(t.length, c.t.length) && Math.min(t.length, c.t.length) >= 3 ? 2 : comuns >= 3 && t[t.length - 1] === c.t[c.t.length - 1] ? 1 : 0;
      if (n > nota) { nota = n; melhor = c.x; empate = false; } else if (n && n === nota && c.x !== melhor) empate = true;
    }
    return melhor && !empate ? { item: melhor, certeza: 'parecido' } : null;
  };
}

// ---- Líderes com o nome escrito de jeitos diferentes (apelido, só o primeiro nome, erro de digitação) ----
// Ex.: "KAUN", "KAUAN" e "KAUAN SUZA" são a mesma pessoa que "KAUAN SOUZA". Sem lista fixa de nomes no código:
// 1) procura no cadastro do RH (pessoas) uma única pessoa cujo nome começa com as palavras do líder, aceitando
//    uma letra trocada em cada palavra (KAUN ≈ KAUAN, SUZA ≈ SOUZA) → o líder vira "PRIMEIRO SEGUNDO" nome dela;
// 2) sem isso, dentro da própria lista: um nome que é o começo de um único outro (KAUAN → KAUAN SOUZA).
// Cuidados (para um líder nunca virar outra pessoa):
// - a letra trocada só vale no PRIMEIRO nome quando ninguém no RH tem aquele primeiro nome exato
//   (TALSON vira TALISON se ninguém se chama TALSON, mas OTAVIA LIMA não vira OTAVIO LIMA se existe alguém chamado OTAVIA);
// - mais de uma pessoa possível = ambíguo: fica como está escrito (FULANO não vira FULANO DE TAL nem FULANO SILVA),
//   a não ser que só um dos candidatos já seja líder na própria lista;
// - a função no RH NÃO decide: o líder de fato pode estar cadastrado como ajudante e outro como "líder de turma".
const palavraParecida = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && distancia(a, b) <= 1);
export function canonLideres(nomes, pessoas = []) {
  const P = [...new Set((pessoas || []).map(x => normNome(typeof x === 'string' ? x : x.nome)).filter(Boolean))].map(n => n.split(' '));
  const lista = [...new Set((nomes || []).map(n => normNome(n)).filter(Boolean))];
  const primeiros = new Set(P.map(p => p[0]));
  // primeiro nome com letra trocada só quando não existe ninguém com esse primeiro nome escrito assim
  const parecida = (w0, igual) => (x, y, i) => (i === 0 && primeiros.has(w0) ? x === y : igual(x, y));
  // primeiro com as palavras iguais; só se ninguém bater, aceita uma letra trocada. Mais de uma pessoa = ambíguo (não troca).
  const doRH = n => {
    const w = n.split(' '); if (!w.length || w[0].length < 3) return null;
    for (const igual of [(a, b) => a === b, palavraParecida]) {
      const ig = parecida(w[0], igual);
      const ach = [...new Set(P.filter(p => p.length >= w.length && w.every((x, i) => ig(x, p[i], i))).map(p => p.slice(0, Math.max(2, w.length)).join(' ')))];
      if (ach.length === 1) return ach[0];
      if (ach.length > 1) return ach; // ambíguo: decide depois, se só um dos candidatos é líder nesta lista
    }
    return null;
  };
  const mapa = new Map(); const ambiguo = new Map();
  for (const n of lista) { const r = doRH(n); if (Array.isArray(r)) ambiguo.set(n, r); mapa.set(n, typeof r === 'string' ? r : n); }
  const lideres = new Set([...mapa.entries()].filter(([n]) => !ambiguo.has(n)).map(([, v]) => v));
  for (const [n, cands] of ambiguo) { const l = cands.filter(c => lideres.has(c)); if (l.length === 1) { mapa.set(n, l[0]); ambiguo.delete(n); } }
  const canon = [...new Set(mapa.values())];
  for (const n of lista) {
    let c = mapa.get(n); if (c !== n) continue;
    const maiores = canon.filter(m => m !== c && m.startsWith(c + ' '));
    if (maiores.length === 1) c = maiores[0]; // vale também quando o RH tem mais de um com esse nome: entre os líderes da lista só há um
    else if (!maiores.length && !ambiguo.has(n)) { const w = c.split(' '); const ig = parecida(w[0], palavraParecida); const perto = canon.filter(m => m !== c && m.length > c.length && m.split(' ').length >= w.length && w.every((x, i) => ig(x, m.split(' ')[i], i))); if (perto.length === 1) c = perto[0]; }
    mapa.set(n, c);
  }
  const f = n => { const k = normNome(n); if (mapa.has(k)) return mapa.get(k); const r = doRH(k); return typeof r === 'string' ? r : k; };
  // grafia: o nome como foi escrito, só com as letras corrigidas pelo RH (KAUAN SUZA → KAUAN SOUZA), sem acrescentar palavras
  f.grafia = n => { const k = normNome(n); const c = f(k); const w = k.split(' '), cw = c.split(' '); return cw.length >= w.length && w.every((x, i) => palavraParecida(x, cw[i])) ? cw.slice(0, w.length).join(' ') : k; };
  return f;
}
// Nome do grupo da folha: "[PREFIXO -] LIDER <nome> - SUPERVISÃO <nome>"
export function partesGrupo(nome) {
  const s = String(nome || '').replace(/\s+/g, ' ').trim();
  const m = s.match(/^(.*?)\bL[IÍ]DER\s+(.+?)\s*-\s*(SUPERVIS[ÃA]O.*)$/i) || s.match(/^(.*?)\bL[IÍ]DER\s+(.+)$/i);
  if (!m) return null;
  return { prefixo: m[1].replace(/[-\s]+$/, '').trim(), lider: m[2].replace(/[-\s]+$/, '').trim(), resto: (m[3] || '').trim() };
}
// Junta os grupos do mesmo líder (mesmo prefixo e mesma supervisão) e escreve o nome do líder sempre igual.
export function unirGrupos(grupos, pessoas = []) {
  const canon = canonLideres((grupos || []).map(g => (partesGrupo(g.nome) || {}).lider).filter(Boolean), pessoas);
  const out = []; const porChave = new Map();
  for (const g of grupos || []) {
    const pt = partesGrupo(g.nome);
    let nome = g.nome, chave = normNome(g.nome);
    let grafia = null;
    if (pt) {
      const lid = canon(pt.lider); grafia = canon.grafia(pt.lider);
      nome = `${pt.prefixo ? pt.prefixo + ' - ' : ''}LIDER ${grafia}${pt.resto ? ' - ' + pt.resto.toUpperCase() : ''}`;
      chave = normNome(pt.prefixo) + '|' + lid + '|' + normNome(pt.resto);
    }
    const ja = porChave.get(chave);
    if (ja) {
      const ks = new Set(ja.pessoas.map(p => p.k || p.chave || normNome(p.nome))); for (const p of g.pessoas || []) if (!ks.has(p.k || p.chave || normNome(p.nome))) ja.pessoas.push(p); ja.turno = ja.turno || !!g.turno;
      if (grafia && grafia.length > (ja._grafia || '').length) { ja._grafia = grafia; ja.nome = nome; } // fica o nome mais completo
      continue;
    }
    const novo = { ...g, nome, pessoas: [...(g.pessoas || [])] }; if (grafia) novo._grafia = grafia; porChave.set(chave, novo); out.push(novo);
  }
  for (const g of out) delete g._grafia;
  for (const g of out) g.pessoas.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  return out;
}

// Datas de uma competência (16 do mês anterior a 15).
export function diasDaCompetencia(comp) {
  const [a, m] = comp.split('-').map(Number);
  const ini = `${m === 1 ? a - 1 : a}-${pad(m === 1 ? 12 : m - 1)}-16`, fim = `${a}-${pad(m)}-15`;
  const out = []; for (let d = ini; d <= fim; d = addDias(d, 1)) out.push(d);
  return out;
}
// A competência em que cai uma data (dia 16 em diante já é a do mês seguinte).
export function competenciaDe(data) {
  const [a, m, d] = data.split('-').map(Number);
  if (d <= 15) return `${a}-${pad(m)}`;
  return m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;
}
const MES_ABA = s => { const n = semAcento(s).toUpperCase(); const i = MESES.findIndex(m => n.includes(semAcento(m))); const a = (n.match(/20\d\d/) || [])[0]; return i >= 0 && a ? `${a}-${pad(i + 1)}` : null; };

// Monta o que vai para o banco a partir das planilhas lidas (formato completo ou compacto) e do que já existe.
// freq: { patio, bateria } (resultado de lerFrequencia ou o compacto de dados-importacao) · ferias: resultado de lerFerias
// colabs: { patio: [...], bateria: [...] } (Atividades) · rh: fichas do Efetivo (com matrícula)
export function prepararImportacao({ freq = {}, ferias = null, colabs = {}, rh = [] }) {
  const buscaRH = criarBusca(rh);
  const comps = [], presenca = { patio: {}, bateria: {} }, resumo = { frequencia: {}, ferias: null, semRH: [], ligadas: 0 };
  for (const conj of ['patio', 'bateria']) {
    const f = freq[conj]; if (!f) continue;
    const buscaAt = criarBusca(colabs[conj] || []);
    const r = { competencias: [], pessoas: 0, ligadas: 0, diasPresenca: 0, diasFolha: 0 };
    const semRH = new Set();
    for (const c of f.competencias) {
      const datas = diasDaCompetencia(c.competencia);
      const d = {};
      const grupos = unirGrupos(c.grupos.map(g => ({
        nome: g.nome, turno: !!g.turno,
        pessoas: g.pessoas.map(p => {
          const dias = p.dias || Object.fromEntries((p.d || '').split(',').map((v, i) => [datas[i], v]).filter(([, v]) => v));
          const fr = buscaRH(p.nome); const mat = fr ? String(fr.item.mat || '') : '';
          const at = buscaAt(p.nome, mat); const ativ = at ? at.item.id : null;
          const k = mat || 'n:' + normNome(p.nome);
          if (!fr) semRH.add(p.nome);
          for (const [dt, cod] of Object.entries(dias)) {
            if (cod === 'P') continue; // presente é o padrão: não grava
            if (ativ) { presenca[conj][ativ + '|' + dt] = cod; r.diasPresenca++; } else { (d[k] ||= {})[dt] = cod; r.diasFolha++; }
          }
          if (ativ) r.ligadas++;
          return { k, nome: p.nome, mat, turma: p.turma || '', obs: p.obs || '', notas: p.notas || [], ativ, desligado: p.desligado || null };
        })
      })), rh);
      r.pessoas = Math.max(r.pessoas, grupos.reduce((n, g) => n + g.pessoas.length, 0));
      r.competencias.push(c.competencia);
      comps.push({ conj, competencia: c.competencia, ini: datas[0], fim: datas[datas.length - 1], grupos, d });
    }
    resumo.frequencia[conj] = r; resumo.ligadas += r.ligadas;
    resumo.semRH.push(...[...semRH].map(n => ({ conj, nome: n })));
  }
  let fer = null;
  if (ferias) {
    fer = ferias.ferias.map(x => {
      const fr = !x.mat ? buscaRH(x.nome) : null;
      const termino = x.termino || (x.inicio && x.dias ? addDias(x.inicio, x.dias - 1) : null);
      return { mat: x.mat || (fr ? String(fr.item.mat) : ''), nome: x.nome, setor: x.setor, funcao: x.funcao, horario: x.horario, admissao: x.admissao, limite: x.limite, inicio: x.inicio, dias: x.dias || 30, termino, retorno: x.retorno || (termino ? addDias(termino, 1) : null), substituto: x.obs || '', mesPlanejado: MES_ABA(x.aba) };
    });
    resumo.ferias = { total: fer.length, comData: fer.filter(x => x.inicio).length };
  }
  return { comps, presenca, ferias: fer, resumo };
}
export { addDias };
