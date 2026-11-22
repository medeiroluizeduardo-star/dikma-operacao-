// Dikma Gestão — contas do descarte LGPD (Administração › LGPD, só o administrador). Sem tela e sem banco: a tela
// (telas/lgpd.js) lê os dados, estas funções dizem o que passou do prazo, e os testes (testes/lgpd.test.mjs) conferem.
//
// Prazos aprovados pelo Eduardo em 22/11/2026:
// - ASO (treinos com tipo 'ASO'): aqui só ficam a data do exame e a validade. Fica sempre o mais recente de cada
//   pessoa. Os antigos saem 2 anos depois de vencer. De quem saiu da empresa, todos saem 2 anos depois da demissão.
// - Atestado (AT) e afastamento (AF): o código fica (frequência, horas e medição dependem dele). Só a observação
//   escrita da justificativa (jus.obs) sai, 12 meses depois do dia.
// - Registro de quem abriu a ficha (acessosFicha): 1 ano.
// Nada sai sozinho: o administrador vê a lista, baixa a cópia e confirma.
import { addMeses } from './treinos.js';
import { normNome } from './planilhas-adm.js';

export const PRAZOS = { asoAnos: 2, demissaoAnos: 2, obsMeses: 12, acessoMeses: 12 };
export const CODS_SAUDE = ['AT', 'AF'];
export const LOTE = 400;

// Data limite: o que for ANTERIOR a ela passou do prazo.
export const limiteObs = hoje => addMeses(hoje, -PRAZOS.obsMeses);
export const limiteAcesso = hoje => addMeses(hoje, -PRAZOS.acessoMeses);

const ehASO = t => !!t && !t.apagado && !Array.isArray(t.naTipos) && String(t.tipo || '').trim().toUpperCase() === 'ASO';
const chavePessoa = x => (x.mat ? 'm:' + String(x.mat).trim() : 'n:' + normNome(x.nome));
// Até quando o ASO vale: a validade; sem ela, 12 meses depois do exame.
const fimASO = t => t.validade || (t.realizado ? addMeses(t.realizado, 12) : null);

// treinos = todos os registros; fichas = cadastro (mat, nome, dem). Devolve os ASO que passaram do prazo, com o motivo.
export function asoParaDescartar(treinos, fichas, hoje) {
  const dem = new Map();
  for (const f of fichas || []) if (f && f.dem) { if (f.mat) dem.set('m:' + String(f.mat).trim(), f.dem); if (f.nome) dem.set('n:' + normNome(f.nome), f.dem); }
  const porPessoa = new Map();
  for (const t of (treinos || []).filter(ehASO)) { const k = chavePessoa(t); if (!porPessoa.has(k)) porPessoa.set(k, []); porPessoa.get(k).push(t); }
  const sai = [];
  for (const [k, l] of porPessoa) {
    l.sort((a, b) => String(b.realizado || '').localeCompare(String(a.realizado || '')) || String(b.validade || '').localeCompare(String(a.validade || '')));
    const d = dem.get(k) || (l[0].nome ? dem.get('n:' + normNome(l[0].nome)) : null);
    if (d && addMeses(d, PRAZOS.demissaoAnos * 12) < hoje) { for (const t of l) sai.push({ ...t, motivo: 'demissao', dem: d }); continue; }
    for (const t of l.slice(1)) { const f = fimASO(t); if (f && addMeses(f, PRAZOS.asoAnos * 12) < hoje) sai.push({ ...t, motivo: 'vencido' }); }
  }
  return sai.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')) || String(a.realizado || '').localeCompare(String(b.realizado || '')));
}

// Observações escritas de atestado e afastamento com mais de 12 meses.
// Presença (situacao e b_situacao/{AAAA-MM}): jus['PESSOA|AAAA-MM-DD'] = { cod, mot, obs, ... }; código em v[mesma chave].
export function obsDaSituacao(docSit, hoje) {
  const lim = limiteObs(hoje); const out = [];
  for (const [k, j] of Object.entries((docSit && docSit.jus) || {})) {
    const dia = k.slice(k.lastIndexOf('|') + 1); const cod = (j && j.cod) || ((docSit.v || {})[k]);
    if (j && j.obs && CODS_SAUDE.includes(cod) && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia < lim) out.push({ caminho: ['jus', k, 'obs'], dia, cod, obs: j.obs });
  }
  return out;
}
// Folha da Frequência (freqcomp/{conj|AAAA-MM}): jus[pessoa][AAAA-MM-DD] = { cod, obs, ... }; código em d[pessoa][dia].
export function obsDaFolha(docComp, hoje) {
  const lim = limiteObs(hoje); const out = [];
  for (const [p, dias] of Object.entries((docComp && docComp.jus) || {})) for (const [dia, j] of Object.entries(dias || {})) {
    const cod = (j && j.cod) || (((docComp.d || {})[p] || {})[dia]);
    if (j && j.obs && CODS_SAUDE.includes(cod) && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia < lim) out.push({ caminho: ['jus', p, dia, 'obs'], dia, cod, obs: j.obs });
  }
  return out;
}

// Registros de acesso com mais de 1 ano (dia = 'AAAA-MM-DD' do acesso).
export const acessosParaDescartar = (acessos, hoje) => (acessos || []).filter(a => a && a.dia && a.dia < limiteAcesso(hoje));

// Divide as operações em lotes do tamanho que o banco aceita.
export function emLotes(ops, n = LOTE) { const l = []; for (let i = 0; i < ops.length; i += n) l.push(ops.slice(i, i + n)); return l; }
