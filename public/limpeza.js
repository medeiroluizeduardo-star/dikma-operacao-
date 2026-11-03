// Dikma Gestão — contas da Limpeza de dados (Administração › Limpeza de dados, só o administrador).
// Sem tela e sem banco: a tela (telas/limpeza.js) lê os documentos, estas funções dizem o que apagar ou alterar,
// e os testes (testes/limpeza.test.mjs) conferem as contas.
//
// PENDÊNCIA DISPENSADA NA LIMPEZA
// A atividade programada (P) e nunca apontada até a data escolhida volta a ser '_' (sem programação) e a semana
// guarda a marca em dx['atividade|dia'] = data da limpeza. Assim ela deixa de contar como programada, atrasada,
// pendente e não realizada em TODAS as contas que já existem (Programação, Painel, Pendências, Meu dia, Aprovação,
// Dimensionamento, Resumos, Modo TV, avisos no celular e o Painel Coqueria), sem precisar ensinar um código novo a
// cada uma delas. Só a Programação olha a marca dx, para mostrar o traço "Dispensada na limpeza".
import { add, weekOf, monthOfWeek, addMonth } from './cal.js';
import { inicioAtrasadas } from './hoje.js';
import { fotosDoReg } from './segcalc.js';

// Operações por lote (writeBatch aceita 500; fica uma folga).
export const LOTE = 400;

// Mês de uma data pela regra da planilha (a semana é do mês da quinta-feira).
export const mesDaData = dt => monthOfWeek(weekOf(dt));
// O mês atual e o próximo estão em uso: não podem ser apagados.
export const mesProtegido = (m, hoje) => { const a = mesDaData(hoje); return m === a || m === addMonth(a, 1); };

// Linha de uma atividade na semana: no banco fica em s[atividade]; na tela também em d[i].
const linhaDe = (doc, pid) => (doc.s && doc.s[pid]) || (doc.d && doc.ids ? doc.d[doc.ids.indexOf(pid)] : '') || '_______';
// A célula foi dispensada na limpeza (e continua sem apontamento).
export const dispensada = (doc, pid, k) => !!(doc && doc.dx && doc.dx[pid + '|' + k]) && linhaDe(doc, pid)[k] === '_';

// Semanas de um mês: quantas e quantos apontamentos (realizada, não realizada e extra).
export function contarSemanas(docs) {
  let apont = 0, prog = 0;
  for (const doc of docs) for (const pid of doc.ids || []) for (const c of linhaDe(doc, pid)) { if (c === 'R' || c === 'N' || c === 'E') apont++; if (c !== '_' && c !== 'E') prog++; }
  return { semanas: docs.length, apont, prog };
}

// Pendências até a data `ate` (inclusive, e sempre antes de hoje): as atividades P de dias que já passaram.
// docs: semanas no formato do banco ({ id, area, ini, mes, ids, s }). em = data da limpeza (vai na marca dx).
// Devolve uma alteração por semana: { id, area, ini, mes, cel: [{ pid, k, dt }], campos: [[caminho, valor]] }.
export function planoDispensa(docs, { ate, hoje, em = hoje }) {
  const lim = ate < hoje ? ate : add(hoje, -1);
  const out = [];
  for (const doc of docs) {
    if (!doc || !doc.ini || doc.ini > lim) continue;
    const cel = [], novas = {};
    for (const pid of doc.ids || []) {
      const str = linhaDe(doc, pid); let a = null;
      for (let k = 0; k < 7; k++) {
        if (str[k] !== 'P') continue;
        const dt = add(doc.ini, k); if (dt > lim) continue;
        (a ||= [...str])[k] = '_'; cel.push({ pid, k, dt });
      }
      if (a) novas[pid] = a.join('');
    }
    if (!cel.length) continue;
    const campos = [...Object.entries(novas).map(([pid, s]) => [['s', pid], s]), ...cel.map(c => [['dx', c.pid + '|' + c.k], em])];
    out.push({ id: doc.id, area: doc.area, ini: doc.ini, mes: doc.mes, cel, campos });
  }
  return out;
}
// Quantas das células dispensadas aparecem hoje como atrasadas (a janela fixa dos últimos 60 dias: hoje.js).
export const atrasadasNoPlano = (plano, hoje) => { const de = inicioAtrasadas(hoje); return plano.reduce((n, x) => n + x.cel.filter(c => c.dt >= de && c.dt < hoje).length, 0); };

// Aplica as alterações (caminho → valor; null apaga o campo) num documento em memória (demonstração e testes).
export function aplicarCampos(doc, campos) {
  for (const [p, v] of campos) {
    let o = doc; for (const x of p.slice(0, -1)) o = (o[x] && typeof o[x] === 'object' ? o[x] : (o[x] = {}));
    const f = p[p.length - 1]; if (v === null) delete o[f]; else o[f] = v;
  }
  return doc;
}

// Registros da Segurança que entram na limpeza: interações todas; anomalias abertas ou em tratamento só com
// incluirAbertas. Devolve os registros e as fotos (antes e depois) que vão junto.
export function planoSeg(regs, { anom = false, incluirAbertas = false } = {}) {
  const l = regs.filter(r => !anom || incluirAbertas || r.status === 'concluida');
  return { regs: l, fotos: [...new Set(l.flatMap(fotosDoReg))] };
}

// Meses entre de e ate (AAAA-MM, inclusive). Sem de: só ate.
export function mesesEntre(de, ate) {
  const out = []; if (!ate) return out;
  for (let m = de || ate; m <= ate && out.length < 240; m = addMonth(m, 1)) out.push(m);
  return out;
}

// Divide as operações em lotes de até n.
export function emLotes(ops, n = LOTE) { const out = []; for (let i = 0; i < ops.length; i += n) out.push(ops.slice(i, i + n)); return out; }

// O que ficou faltando depois de um erro: quantas operações de cada grupo não foram feitas.
export function faltou(ops, feitas) {
  const m = new Map();
  for (const o of ops.slice(feitas)) m.set(o.grupo || 'Outros', (m.get(o.grupo || 'Outros') || 0) + 1);
  return [...m.entries()];
}

// Linha do histórico (sem dados pessoais): só o que foi limpo e quantos.
export const linhaHistorico = partes => `Limpeza de dados: ${partes.filter(Boolean).join('; ') || 'nada'}`;
