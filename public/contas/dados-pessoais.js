// Dikma Gestão — dados pessoais do colaborador (CPF, endereço, telefone e rota de ônibus), sem tela e sem banco.
// Ficam fora da ficha (gcolab), em dpessoais/{matrícula Dikma}, porque a ficha é lida por líderes, leitores e Indicadores.
// Quem vê: o administrador e o RH · Administrativo; o RH · Somente leitura só se o administrador ligar o item
// "Ver dados pessoais" em Perfis (firestore.rules › dpessoais confere o mesmo). Quem grava: administrador e RH · Administrativo.
// A matrícula Arcelor continua na ficha (campo matArc).
// Importação: a planilha do RH (abas por área, colunas NOME, MATRICULA AMT, CPF, MATRICULA DIK, ENDEREÇO, TELEFONE, ROTA).
// A ligação é pela matrícula Dikma; sem ela (ou sem achar), pelo nome idêntico (sem acento). Campo vazio na planilha não
// apaga o que já está gravado.
import { normNome } from './planilhas-adm.js';
import { addMeses } from './treinos.js';

export const CAMPOS_DP = ['cpf', 'end', 'tel', 'rotaOn'];
export const ROTULO_DP = { cpf: 'CPF', end: 'Endereço', tel: 'Telefone', rotaOn: 'Rota de ônibus' };
export const MAX_DP = { cpf: 11, end: 300, tel: 40, rotaOn: 40 };
// Prazo LGPD: de quem saiu, os dados pessoais saem 2 anos depois da demissão (o mesmo do ASO).
export const DP_ANOS_DEMISSAO = 2;

const sp = v => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
// CPF só com os 11 números. Na planilha ele vem como texto (141.979.987-83) ou como número, que perde o zero do começo.
export function cpfLimpo(v) {
  if (v == null || v === '') return '';
  const d = (typeof v === 'number' ? String(Math.round(v)) : String(v)).replace(/\D/g, '');
  return d && d.length <= 11 ? d.padStart(11, '0') : d;
}
export function cpfValido(c) {
  const d = cpfLimpo(c);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
export const cpfMostrar = c => { const d = cpfLimpo(c); return /^\d{11}$/.test(d) ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : sp(c); };
export const telLimpo = v => sp(v).slice(0, MAX_DP.tel);
export const endLimpo = v => sp(v).slice(0, MAX_DP.end);
export const rotaLimpa = v => sp(v).toUpperCase().slice(0, MAX_DP.rotaOn);
const matLimpa = v => (v == null ? '' : String(typeof v === 'number' ? Math.round(v) : v).replace(/\.0+$/, '').trim());

// Confere o que vai ser gravado (formulário e importação). Devolve a mensagem do problema ou ''.
export function problemaDP(d) {
  if (d.cpf && !cpfValido(d.cpf)) return 'CPF inválido: confira os 11 números.';
  for (const k of CAMPOS_DP) if (d[k] && String(d[k]).length > MAX_DP[k]) return `${ROTULO_DP[k]} muito longo.`;
  return '';
}
// Só os campos conhecidos, limpos; os vazios ficam de fora.
export function limparDP(d) {
  const o = { cpf: cpfLimpo(d.cpf), end: endLimpo(d.end), tel: telLimpo(d.tel), rotaOn: rotaLimpa(d.rotaOn) };
  for (const k of CAMPOS_DP) if (!o[k]) delete o[k];
  return o;
}

// ---- leitura da planilha ----
const semAc = s => sp(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.:º°]/g, '').replace(/\s+/g, ' ').trim();
const COLS = {
  nome: ['NOME', 'NOME COMPLETO', 'COLABORADOR', 'COLABORADORES'],
  mat: ['MATRICULA DIK', 'MATRICULA DIKMA', 'MAT DIK', 'MAT DIKMA'],
  matArc: ['MATRICULA AMT', 'MATRICULA ARCELOR', 'MAT AMT', 'MAT ARCELOR'],
  cpf: ['CPF'],
  end: ['ENDERECO', 'ENDERECO COMPLETO'],
  tel: ['TELEFONE', 'CELULAR', 'TEL', 'CONTATO'],
  rotaOn: ['ROTA', 'ROTA ONIBUS', 'ROTA DE ONIBUS', 'ROTA DO ONIBUS', 'ONIBUS']
};
const ALIAS = new Map(Object.entries(COLS).flatMap(([k, l]) => l.map(n => [n, k])));

// abas: [{ nome, rows: [[...], ...] }] (como o xlsx devolve, header: 1). Devolve as linhas com pessoa:
// [{ aba, linha, nome, mat, matArc, cpf, cpfBruto, end, tel, rotaOn, desligado }]
export function lerPlanilhaDP(abas) {
  const out = [];
  for (const a of abas || []) {
    const rows = a.rows || [];
    let h = -1; /** @type {Record<string, number> | null} */ let cols = null;
    for (let i = 0; i < Math.min(15, rows.length) && h < 0; i++) {
      /** @type {Record<string, number>} */ const c = {}; (rows[i] || []).forEach((v, j) => { const k = typeof v === 'string' ? ALIAS.get(semAc(v)) : null; if (k && !(k in c)) c[k] = j; });
      if ('nome' in c && ('mat' in c || 'cpf' in c)) { h = i; cols = c; }
    }
    if (!cols) continue;
    const K = cols;
    const dados = rows.slice(h + 1);
    // Nome com o título numa coluna e o nome na seguinte (a coluna do título tem só a numeração 1, 2, 3...).
    let jn = K.nome;
    const nums = dados.filter(r => r && typeof r[jn] === 'number').length, txts = dados.filter(r => r && typeof r[jn] === 'string' && /[A-Za-z]/.test(r[jn])).length;
    if (nums > txts) jn = jn + 1;
    const desl = /DESLIG|DEMIT/.test(semAc(a.nome));
    dados.forEach((r, i) => {
      if (!r) return; const nome = sp(r[jn]).toUpperCase(); if (!nome || !/[A-Z]/.test(nome)) return;
      const v = k => (k in K ? r[K[k]] : null);
      out.push({ aba: sp(a.nome), linha: h + i + 2, nome, mat: matLimpa(v('mat')), matArc: matLimpa(v('matArc')).toUpperCase(), cpf: cpfLimpo(v('cpf')), cpfBruto: sp(v('cpf')), end: endLimpo(v('end')), tel: telLimpo(v('tel')), rotaOn: rotaLimpa(v('rotaOn')), desligado: desl });
    });
  }
  return out;
}

// Nome para ligar: sem acento e sem o que vem depois de " - " (ex.: "FULANO - SINDICATO").
const chaveNome = n => normNome(String(n || '').split(' - ')[0]);

// linhas: lerPlanilhaDP · fichas: cadastro (gcolab: mat, nome, matArc, dem) · atuais: Map(mat → dados pessoais gravados)
// Devolve o que a importação faz, sem gravar:
//   gravar: [{ mat, nome, dados, antes, campos }] (só quem muda alguma coisa)
//   arc: [{ mat, nome, de, para }] matrículas Arcelor que entram ou mudam na ficha
//   iguais, semFicha, cpfInvalido, repetidos, arcConflito, pelonome (achados pelo nome)
export function compararDP(linhas, fichas, atuais = new Map()) {
  const F = (fichas || []).filter(f => f && f.mat != null);
  const porMat = new Map(F.map(f => [matLimpa(f.mat), f]));
  const porNome = new Map(); for (const f of F) { const k = chaveNome(f.nome); porNome.set(k, porNome.has(k) ? null : f); }
  const arcDe = new Map(); for (const f of F) if (f.matArc) arcDe.set(String(f.matArc).toUpperCase(), f);
  const r = { gravar: [], arc: [], iguais: 0, semFicha: [], cpfInvalido: [], repetidos: [], arcConflito: [], pelonome: [] };
  const vistos = new Map();
  // Quem está numa aba de ativos ganha de quem está na aba de desligados (a mesma pessoa nas duas).
  const ordem = [...linhas].sort((a, b) => Number(a.desligado) - Number(b.desligado));
  for (const l of ordem) {
    let f = l.mat ? porMat.get(l.mat) : null;
    if (!f) { f = porNome.get(chaveNome(l.nome)) || null; if (f && l.mat && matLimpa(f.mat) !== l.mat) f = null; if (f) r.pelonome.push({ ...l, mat: matLimpa(f.mat) }); }
    if (!f) { r.semFicha.push(l); continue; }
    const mat = matLimpa(f.mat);
    if (vistos.has(mat)) { r.repetidos.push({ ...l, mat, outra: vistos.get(mat) }); continue; }
    vistos.set(mat, `${l.aba} linha ${l.linha}`);
    const d = { cpf: l.cpf, end: l.end, tel: l.tel, rotaOn: l.rotaOn };
    if (d.cpf && !cpfValido(d.cpf)) { r.cpfInvalido.push({ ...l, mat, nomeFicha: f.nome }); delete d.cpf; }
    const antes = atuais.get(mat) || {};
    const novo = { ...limparDP(antes), ...limparDP(d) };
    const campos = CAMPOS_DP.filter(k => (novo[k] || '') !== (antes[k] || ''));
    if (campos.length) r.gravar.push({ mat, nome: f.nome, dados: novo, antes, campos }); else r.iguais++;
    if (l.matArc) {
      const o = arcDe.get(l.matArc);
      if (o && matLimpa(o.mat) !== mat) r.arcConflito.push({ mat, nome: f.nome, matArc: l.matArc, de: o.nome });
      else if (String(f.matArc || '').toUpperCase() !== l.matArc) r.arc.push({ mat, nome: f.nome, de: f.matArc || '', para: l.matArc });
    }
  }
  return r;
}

// LGPD: dados pessoais de quem saiu há mais de 2 anos. dps: [{ id (= mat), ... }] · fichas: cadastro (mat, dem)
export function dpParaDescartar(dps, fichas, hoje) {
  const dem = new Map((fichas || []).filter(f => f && f.mat != null && f.dem).map(f => [matLimpa(f.mat), f]));
  return (dps || []).filter(d => { const f = dem.get(matLimpa(d.id || d.mat)); return f && addMeses(f.dem, DP_ANOS_DEMISSAO * 12) < hoje; })
    .map(d => { const f = dem.get(matLimpa(d.id || d.mat)); return { id: String(d.id || d.mat), nome: f.nome, dem: f.dem }; });
}
