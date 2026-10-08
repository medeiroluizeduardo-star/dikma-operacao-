// Converte o que veio do Senior no formato que o Dikma Operação entende:
// { mat, nome, funcao, area, rota, regime, turma, lider, adm, dem, situacao }
// O mapa diz, para cada campo, os nomes possíveis no Senior (o primeiro que vier preenchido vale).
// Nomes com ponto entram em objetos: "department.name". Maiúsculas e acentos não importam.

const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]/g, '');
const pad = n => String(n).padStart(2, '0');

function pegar(obj, caminho) {
  let atual = obj;
  for (const parte of caminho.split('.')) {
    if (atual == null || typeof atual !== 'object') return undefined;
    const alvo = semAcento(parte);
    const chave = Object.keys(atual).find(k => semAcento(k) === alvo);
    if (chave === undefined) return undefined;
    atual = atual[chave];
  }
  return atual;
}
function primeiro(obj, nomes) {
  for (const n of [].concat(nomes || [])) {
    const v = pegar(obj, n);
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}
export function data(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number') { if (v < 20000 || v > 80000) return null; const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5); return data(d); }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] === '1900' || m[1] === '0001' ? null : `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y === '1900' ? null : `${y}-${pad(m[2])}-${pad(m[1])}`; } // 31/12/1900 = vazio no Senior
  return null;
}
const texto = v => (v == null ? '' : typeof v === 'object' ? String(v.name || v.nome || v.description || '') : String(v)).replace(/\s+/g, ' ').trim();

export function normalizar(brutos, mapa) {
  const registros = [], avisos = [], vistos = new Set();
  for (const b of brutos) {
    const r = {
      mat: texto(primeiro(b, mapa.mat)).replace(/\.0+$/, '').replace(/^0+(?=\d)/, ''),
      nome: texto(primeiro(b, mapa.nome)).toUpperCase(),
      funcao: texto(primeiro(b, mapa.funcao)).toUpperCase(),
      area: texto(primeiro(b, mapa.area)),
      rota: texto(primeiro(b, mapa.rota)),
      regime: texto(primeiro(b, mapa.regime)),
      turma: texto(primeiro(b, mapa.turma)).toUpperCase(),
      lider: texto(primeiro(b, mapa.lider)).toUpperCase(),
      adm: data(primeiro(b, mapa.adm)),
      dem: data(primeiro(b, mapa.dem)),
      situacao: texto(primeiro(b, mapa.situacao))
    };
    if (!r.mat || !r.nome) { if (r.nome || r.mat) avisos.push(`Registro sem ${r.mat ? 'nome' : 'matrícula'}: ${r.nome || r.mat}`); continue; }
    if (vistos.has(r.mat)) { avisos.push(`Matrícula repetida: ${r.mat} (${r.nome}); ficou a primeira.`); continue; }
    vistos.add(r.mat);
    for (const k of Object.keys(r)) if (r[k] === '' || r[k] === null) delete r[k];
    registros.push(r);
  }
  return { registros, avisos };
}
