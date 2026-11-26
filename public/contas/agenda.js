// Gestão › Minha agenda: contas sem tela (o site, os testes e a rotina dos avisos usam as mesmas).
// Cada pessoa tem os próprios itens em agenda/{id} (campo uid = dono). Só o dono lê e grava (firestore.rules › agenda);
// uma ANOTAÇÃO pode ser compartilhada só para leitura com outras pessoas (comp = uids, compL = os usuários digitados).
// Três tipos: compromisso (dia e hora), tarefa (prazo opcional, marca feita) e anotação (texto livre, pode ficar fixada).
// Repetir (rep): todo dia, dia útil (seg a sex), toda semana ou todo mês. Tarefa repetida feita → vai para a próxima data;
// compromisso repetido → a tela e os avisos usam a próxima data a partir de hoje (proxima).
// Apagar manda para a lixeira (apagadoEm); some de vez depois de LIXEIRA_DIAS.

export const TIPOS = { compromisso: 'Compromisso', tarefa: 'Tarefa', nota: 'Anotação' };
export const REPETE = { '': 'Não repete', dia: 'Todo dia', util: 'Dia útil (seg a sex)', semana: 'Toda semana', mes: 'Todo mês' };
export const PRIO = { alta: 'Alta', normal: 'Normal', baixa: 'Baixa' };
export const LIMITES = { titulo: 200, texto: 5000, passo: 200, passos: 30, etq: 30, comp: 20 };
export const LIXEIRA_DIAS = 30;
// Cores das etiquetas (a mesma etiqueta tem sempre a mesma cor).
export const CORES = 6;
const DIA = /^20\d{2}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const add = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dow = d => new Date(d + 'T12:00:00Z').getUTCDay();
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const RANK = { alta: 0, normal: 1, baixa: 2 };

// Login digitado (para compartilhar): minúsculo e sem espaços nas pontas.
export const normLogin = s => String(s || '').trim().toLowerCase();

// Confere e limpa o que veio do formulário. Devolve { ok, erro, item }.
export function conferir(x = {}) {
  const tipo = TIPOS[x.tipo] ? x.tipo : 'tarefa';
  const nota = tipo === 'nota';
  const titulo = String(x.titulo || '').trim().slice(0, LIMITES.titulo);
  const texto = String(x.texto || '').trim().slice(0, LIMITES.texto);
  const data = !nota && DIA.test(x.data || '') ? x.data : '';
  const hora = !nota && data && HORA.test(x.hora || '') ? x.hora : '';
  const rep = !nota && data && REPETE[x.rep] && x.rep ? x.rep : '';
  const prio = PRIO[x.prio] ? x.prio : 'normal';
  const etq = String(x.etq || '').trim().replace(/\s+/g, ' ').slice(0, LIMITES.etq);
  const passos = tipo === 'tarefa' ? (Array.isArray(x.passos) ? x.passos : []).map(p => ({ t: String((p && p.t) || '').trim().slice(0, LIMITES.passo), ok: !!(p && p.ok) })).filter(p => p.t).slice(0, LIMITES.passos) : [];
  const compL = nota ? [...new Set((Array.isArray(x.compL) ? x.compL : []).map(normLogin).filter(Boolean))].slice(0, LIMITES.comp) : [];
  if (!titulo) return { ok: false, erro: 'Escreva o título.' };
  if (tipo === 'compromisso' && !data) return { ok: false, erro: 'Escolha o dia do compromisso.' };
  if (x.rep && !nota && !data) return { ok: false, erro: 'Para repetir, escolha o primeiro dia.' };
  const item = { tipo, titulo, texto, data, hora, rep, prio, etq, passos, feito: tipo === 'tarefa' ? !!x.feito : false, fixa: nota ? !!x.fixa : false, compL };
  const link = limparLink(x.link); if (link) item.link = link;
  return { ok: true, item };
}
// Ligação com outra tela (botão "Lembrar disto"): módulo, aba, ação que abre o registro e o id dele, e o nome mostrado.
const CAMPOS_LINK = ['m', 'v', 'act', 'id', 'col', 'mat', 'r'];
export function limparLink(l) {
  if (!l || typeof l !== 'object' || !l.v) return null;
  const o = {}; for (const k of CAMPOS_LINK) if (l[k] != null && l[k] !== '') o[k] = String(l[k]).slice(0, 200);
  return o;
}

// Próxima data da repetição depois de d (sem contar d).
export function seguinte(d, rep, base = d) {
  if (rep === 'dia') return add(d, 1);
  if (rep === 'util') { let x = add(d, 1); while ([0, 6].includes(dow(x))) x = add(x, 1); return x; }
  if (rep === 'semana') return add(d, 7);
  if (rep === 'mes') { // mesmo dia do mês da data de início (31 vira o último dia nos meses mais curtos)
    let a = +d.slice(0, 4), m = +d.slice(5, 7) + 1; if (m > 12) { m = 1; a++; }
    const dia = Math.min(+base.slice(8, 10), ultimoDia(a, m));
    return `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  return '';
}
// Primeira data da repetição a partir de hoje (inclusive). Sem repetição, a própria data.
export function proxima(it, hoje) {
  if (!it.rep || !it.data || it.data >= hoje) return it.data || '';
  let d = it.data;
  for (let i = 0; i < 2000 && d < hoje; i++) d = seguinte(d, it.rep, it.data);
  return d;
}
// Data que vale na tela: compromisso repetido anda sozinho; tarefa fica na data dela até ser feita.
export const quando = (it, hoje) => (it.tipo === 'compromisso' ? proxima(it, hoje) : it.data || '');
// Todas as datas do item entre ini e fim (inclusive), para o calendário.
export function ocorrencias(it, ini, fim) {
  if (it.tipo === 'nota' || !it.data) return [];
  if (!it.rep) return it.data >= ini && it.data <= fim ? [it.data] : [];
  if (it.tipo === 'tarefa') { // tarefa repetida: só a data atual (a próxima aparece quando esta for feita)
    return it.data >= ini && it.data <= fim ? [it.data] : [];
  }
  const out = []; let d = it.data;
  for (let i = 0; i < 2000 && d <= fim; i++) { if (d >= ini) out.push(d); d = seguinte(d, it.rep, it.data); }
  return out;
}
// Marcar uma tarefa como feita: repetida vai para a próxima data (passos desmarcados); senão fica feita.
export function marcarFeita(it, hoje) {
  if (it.rep && it.data) {
    let d = seguinte(it.data, it.rep, it.data);
    while (d < hoje) d = seguinte(d, it.rep, it.data);
    if (d === it.data) d = seguinte(d, it.rep, it.data);
    return { ...it, data: d, feito: false, passos: (it.passos || []).map(p => ({ ...p, ok: false })) };
  }
  return { ...it, feito: true };
}
// Adiar para amanhã (n = 1) ou daqui a uma semana (n = 7), sempre contando de hoje.
export const adiar = (it, hoje, n) => ({ ...it, data: add(hoje, n) });

// Em que grupo da agenda o item cai, olhando o dia de hoje.
export function grupo(it, hoje) {
  if (it.apagadoEm) return 'lixeira';
  if (it.tipo === 'nota') return 'nota';
  if (it.feito) return 'feito';
  const d = quando(it, hoje);
  if (!d) return 'semdata';
  if (d < hoje) return it.tipo === 'compromisso' ? 'passou' : 'atrasada';
  if (d === hoje) return 'hoje';
  if (d === add(hoje, 1)) return 'amanha';
  if (d <= add(hoje, 7)) return 'semana';
  return 'depois';
}
export const GRUPOS = [['atrasada', 'Atrasadas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Próximos 7 dias'], ['depois', 'Mais para frente'], ['semdata', 'Sem data']];

// Ordem dentro do grupo: dia, prioridade (alta primeiro), hora e título.
const chave = (it, hoje) => `${quando(it, hoje) || '9999'}${RANK[it.prio] ?? 1}${it.hora || '99:99'}${String(it.titulo || '').toLowerCase()}`;
export function agrupar(itens, hoje) {
  const out = Object.fromEntries(GRUPOS.map(([k]) => [k, []]));
  for (const it of itens) { const g = grupo(it, hoje); if (out[g]) out[g].push(it); }
  for (const k of Object.keys(out)) out[k].sort((a, b) => chave(a, hoje).localeCompare(chave(b, hoje)));
  return out;
}
const recente = it => String(it.atualizadoEm || it.criadoEm || '');
// Anotações (sem as da lixeira): fixadas primeiro, depois a mais recente.
export const notas = itens => itens.filter(it => it.tipo === 'nota' && !it.apagadoEm).sort((a, b) => (b.fixa ? 1 : 0) - (a.fixa ? 1 : 0) || recente(b).localeCompare(recente(a)));
// Feitos e compromissos que já passaram, do mais recente para o mais antigo.
export const concluidos = (itens, hoje) => itens.filter(it => ['feito', 'passou'].includes(grupo(it, hoje))).sort((a, b) => chave(b, hoje).localeCompare(chave(a, hoje)));
// Lixeira: o que foi apagado, do mais recente; e o que já passou do prazo (some de vez).
export const lixeira = itens => itens.filter(it => it.apagadoEm).sort((a, b) => String(b.apagadoEm).localeCompare(String(a.apagadoEm)));
export const vencidosLixeira = (itens, hoje) => itens.filter(it => it.apagadoEm && String(it.apagadoEm).slice(0, 10) <= add(hoje, -LIXEIRA_DIAS));

// Números do topo.
export function resumo(itens, hoje) {
  const r = { hoje: 0, atrasadas: 0, semana: 0, notas: 0 };
  for (const it of itens) {
    const g = grupo(it, hoje);
    if (g === 'hoje') r.hoje++;
    else if (g === 'atrasada') r.atrasadas++;
    if (['hoje', 'amanha', 'semana'].includes(g)) r.semana++;
    if (g === 'nota') r.notas++;
  }
  return r;
}
// Passos da tarefa: "2 de 5".
export const andamento = it => { const p = it.passos || []; return p.length ? { feitos: p.filter(x => x.ok).length, total: p.length } : null; };
// Etiquetas usadas (para o filtro e a sugestão) e a cor de cada uma.
export const etiquetas = itens => [...new Set(itens.filter(it => !it.apagadoEm && it.etq).map(it => it.etq))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export const corEtq = s => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % CORES; };

// Busca no título, no texto, nos passos e na etiqueta, sem diferença de acento e maiúscula; e filtro por etiqueta.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function buscar(itens, q, etq = '') {
  const t = norm(q).trim();
  return itens.filter(it => (!etq || it.etq === etq) && (!t || norm([it.titulo, it.texto, it.etq, ...(it.passos || []).map(p => p.t)].join(' ')).includes(t)));
}

// Dias de um mês para o calendário: semanas de domingo a sábado, com os itens de cada dia.
export function calendario(itens, ym) {
  const ini = ym + '-01'; const fim = `${ym}-${String(ultimoDia(+ym.slice(0, 4), +ym.slice(5, 7))).padStart(2, '0')}`;
  const porDia = {};
  for (const it of itens) { if (it.apagadoEm) continue; for (const d of ocorrencias(it, ini, fim)) (porDia[d] ||= []).push(it); }
  for (const l of Object.values(porDia)) l.sort((a, b) => `${a.hora || '99'}${RANK[a.prio] ?? 1}`.localeCompare(`${b.hora || '99'}${RANK[b.prio] ?? 1}`));
  const semanas = []; let d = add(ini, -dow(ini));
  while (d <= fim) { const s = []; for (let i = 0; i < 7; i++) { s.push({ d, fora: d.slice(0, 7) !== ym, itens: porDia[d] || [] }); d = add(d, 1); } semanas.push(s); }
  return semanas;
}
export const mesMais = (ym, n) => { let a = +ym.slice(0, 4), m = +ym.slice(5, 7) + n; while (m > 12) { m -= 12; a++; } while (m < 1) { m += 12; a--; } return `${a}-${String(m).padStart(2, '0')}`; };

// Resumo de 7 dias (PDF): cada dia com os compromissos e tarefas abertas dele, as atrasadas e as anotações fixadas.
export function semanaPdf(itens, hoje) {
  const fim = add(hoje, 6); const dias = [];
  for (let d = hoje; d <= fim; d = add(d, 1)) dias.push({ d, itens: [] });
  for (const it of itens) {
    if (it.apagadoEm || it.tipo === 'nota' || it.feito) continue;
    for (const d of ocorrencias(it, hoje, fim)) { const x = dias.find(y => y.d === d); if (x) x.itens.push(it); }
  }
  for (const x of dias) x.itens.sort((a, b) => `${a.hora || '99'}${RANK[a.prio] ?? 1}`.localeCompare(`${b.hora || '99'}${RANK[b.prio] ?? 1}`));
  const ativos = itens.filter(it => !it.apagadoEm);
  return { dias, atrasadas: agrupar(ativos, hoje).atrasada, fixadas: notas(ativos).filter(n => n.fixa) };
}

// ---- Avisos no celular (rotina de hora em hora, integracao/avisos) ----
// Às 7h: o dia (compromissos e tarefas) e as atrasadas. Compromisso com hora: na rodada em que faltam de 1 a 90 minutos.
// itens = os itens abertos (não feitos e fora da lixeira) de quem tem os avisos ligados. agoraMin = minutos do dia.
export function avisosAgenda(itens, hoje, agoraMin) {
  const porUid = {};
  for (const it of itens) { if (it.apagadoEm || it.tipo === 'nota' || it.feito) continue; (porUid[it.uid] ||= []).push(it); }
  const out = [];
  for (const [uid, l] of Object.entries(porUid)) {
    const g = agrupar(l, hoje);
    out.push({ uid, tipo: 'dia', chave: `ag-d|${uid}|${hoje}`, hoje: g.hoje, atrasadas: g.atrasada });
    for (const it of g.hoje) {
      if (it.tipo !== 'compromisso' || !it.hora) continue;
      const falta = +it.hora.slice(0, 2) * 60 + +it.hora.slice(3) - agoraMin;
      if (falta > 0 && falta <= 90) out.push({ uid, tipo: 'hora', chave: `ag-h|${it.id}|${hoje}`, it, falta });
    }
  }
  return out;
}
