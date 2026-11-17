// Gestão › Tratativas: contas sem tela (o site, os testes e o que vier depois usam as mesmas).
// Uma lista só de ações para todas as origens (atividades, equipamentos, efetivo, queda zero, segurança, reunião e outras),
// com o 5W2H, planos de ação que agrupam as ações e atas de reunião cujos encaminhamentos viram ações.
// Banco: tratativas/{id} com tipo 'acao' | 'plano' | 'ata' (nucleo/data.js; regras em firestore.rules).
// As ações antigas de Causas e ações (acoes/ e b_acoes/) aparecem junto, como origem Atividades (deAcaoAntiga).

export const ORIGENS = {
  atividades: 'Atividades', equipamentos: 'Equipamentos', efetivo: 'Efetivo', queda: 'Queda zero',
  seguranca: 'Segurança', reuniao: 'Reunião', processos: 'Processos', cliente: 'Cliente', outra: 'Outra'
};
export const STATUS = { aberta: 'A fazer', andamento: 'Em andamento', feita: 'Concluída', cancelada: 'Cancelada' };
export const CONJ = { coq: 'Coqueria', patio: 'Pátio', bateria: 'Bateria', equip: 'Equipamentos' };
// As 7 perguntas do 5W2H (o que conta como respondido está em w5).
export const W5 = [['oque', 'O quê?'], ['porque', 'Por quê?'], ['onde', 'Onde?'], ['quando', 'Quando?'], ['quem', 'Quem?'], ['como', 'Como?'], ['quanto', 'Quanto custa?']];
export const LIMITES = { titulo: 300, texto: 2000, ata: 5000, curto: 120, evol: 200, enc: 60 };

const txt = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const linha = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const dataOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// "1.234,56" / "1234.5" / "R$ 80" → número; vazio → null.
export function valor(v) {
  const s = String(v ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) throw new Error('Valor inválido: use só números (ex.: 1.500,00).');
  return Math.round(n * 100) / 100;
}

export const aberta = t => t.status === 'aberta' || t.status === 'andamento';
export const atrasada = (t, hoje) => aberta(t) && dataOk(t.prazo) && t.prazo < hoje;
const maisDias = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const venceLogo = (t, hoje, dias = 7) => aberta(t) && dataOk(t.prazo) && t.prazo >= hoje && t.prazo <= maisDias(hoje, dias);

// O que já foi respondido do 5W2H (só conta o que a pessoa escreveu ou escolheu).
export function w5(t) {
  return {
    oque: !!linha(t.titulo, 9), porque: !!linha(t.por || t.causa, 9), onde: !!(linha(t.local, 9) || t.area),
    quando: dataOk(t.prazo), quem: !!linha(t.resp, 9), como: !!linha(t.como, 9), quanto: t.custo != null && t.custo !== ''
  };
}
export const w5n = t => Object.values(w5(t)).filter(Boolean).length;

// Confere o formulário da ação e devolve o que vai para o banco (só os campos da ação).
export function conferirAcao(f) {
  const titulo = linha(f.titulo, LIMITES.titulo);
  if (titulo.length < 5) throw new Error('Diga o que será feito (O quê?).');
  if (!ORIGENS[f.origem]) throw new Error('Escolha a origem.');
  if (!STATUS[f.status || 'aberta']) throw new Error('Situação inválida.');
  if (f.inicio && !dataOk(f.inicio)) throw new Error('Data de início inválida.');
  if (f.prazo && !dataOk(f.prazo)) throw new Error('Prazo inválido.');
  if (f.inicio && f.prazo && f.prazo < f.inicio) throw new Error('O prazo não pode ser antes do início.');
  return {
    tipo: 'acao', titulo, por: txt(f.por, LIMITES.texto), origem: f.origem, ref: linha(f.ref, LIMITES.curto),
    conj: CONJ[f.conj] ? f.conj : 'coq', local: linha(f.local, LIMITES.curto), inicio: f.inicio || '', prazo: f.prazo || '',
    resp: linha(f.resp, LIMITES.curto), como: txt(f.como, LIMITES.texto), custo: valor(f.custo), custoReal: valor(f.custoReal),
    status: f.status || 'aberta', plano: String(f.plano || ''),
    ...(f.causa ? { causa: linha(f.causa, 160) } : {}), ...(f.area ? { area: linha(f.area, 60) } : {}), ...(f.ata ? { ata: String(f.ata) } : {})
  };
}
export function conferirPlano(f) {
  const nome = linha(f.nome, LIMITES.curto);
  if (nome.length < 3) throw new Error('Dê um nome ao plano.');
  return { tipo: 'plano', nome, objetivo: txt(f.objetivo, LIMITES.texto), conj: CONJ[f.conj] ? f.conj : 'coq', status: f.status === 'concluido' ? 'concluido' : 'ativo' };
}
// Encaminhamentos: [{ oque, quem, prazo, trat }]; linhas sem "o que" saem.
export function conferirAta(f) {
  const titulo = linha(f.titulo, LIMITES.titulo);
  if (titulo.length < 3) throw new Error('Dê um assunto à ata.');
  if (!dataOk(f.data)) throw new Error('Data da reunião inválida.');
  const enc = (f.enc || []).map(e => ({ oque: linha(e.oque, LIMITES.titulo), quem: linha(e.quem, LIMITES.curto), prazo: dataOk(e.prazo) ? e.prazo : '', trat: String(e.trat || '') }))
    .filter(e => e.oque || e.trat);
  if (enc.length > LIMITES.enc) throw new Error(`No máximo ${LIMITES.enc} encaminhamentos por ata.`);
  if (enc.some(e => !e.trat && e.oque.length < 5)) throw new Error('Escreva o que será feito em cada encaminhamento (pelo menos 5 letras).');
  return {
    tipo: 'ata', titulo, data: f.data, local: linha(f.local, LIMITES.curto), participantes: txt(f.participantes, 600),
    pauta: txt(f.pauta, LIMITES.ata), decisoes: txt(f.decisoes, LIMITES.ata), enc, plano: String(f.plano || '')
  };
}
// Ações que a ata cria: os encaminhamentos ainda sem ação. Devolve [{ i, acao }] (i = posição em enc).
export function acoesDaAta(ata, hoje) {
  const dm = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return (ata.enc || []).map((e, i) => ({ e, i })).filter(({ e }) => !e.trat && e.oque).map(({ e, i }) => ({
    i, acao: conferirAcao({ titulo: e.oque, origem: 'reuniao', ref: ata.titulo, resp: e.quem, prazo: e.prazo || maisDias(hoje, 7), inicio: hoje,
      por: `Encaminhamento da reunião “${ata.titulo}” (${dm(ata.data)})`, local: ata.local, plano: ata.plano, ata: ata.id, status: 'aberta' })
  }));
}
// Comentário de evolução (fica na lista evol da ação, do mais antigo para o mais novo).
export function novoComentario(lista, texto, quem) {
  const t = txt(texto, 600); if (!t) return lista || [];
  return [...(lista || []), { t, em: quem.em, nome: linha(quem.nome, 80), uid: quem.uid }].slice(-LIMITES.evol);
}

// Ação antiga de Causas e ações (acoes/{id} do Pátio ou b_acoes/{id} da Bateria) no formato das tratativas.
export function deAcaoAntiga(a, k) {
  return {
    id: `L:${k}:${a.id}`, legado: { k, id: a.id }, tipo: 'acao', titulo: a.acao || '', causa: a.causa || '', por: a.causa ? `Causa de não realização: ${a.causa}` : '',
    origem: 'atividades', ref: a.causa || '', conj: k, area: a.area && a.area !== 'TODAS' ? a.area : '', resp: a.resp || '', prazo: a.prazo || '',
    status: STATUS[a.status] ? a.status : 'aberta', criadoEm: a.em || '', criadoNome: a.porNome || '', plano: ''
  };
}

// Filtro da lista de ações. f: { sit, origem, conj, plano, q, minhas }, eu: { uid, nome }.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function filtrar(lista, f, hoje, eu = {}) {
  const q = norm(f.q);
  return lista.filter(t => {
    if (f.sit === 'abertas' && !aberta(t)) return false;
    if (f.sit === 'atrasadas' && !atrasada(t, hoje)) return false;
    if (f.sit === 'semana' && !venceLogo(t, hoje)) return false;
    if (f.sit === 'feitas' && t.status !== 'feita') return false;
    if (f.sit === 'canceladas' && t.status !== 'cancelada') return false;
    if (f.sit !== 'canceladas' && f.sit !== 'todas' && t.status === 'cancelada') return false;
    if (f.origem && f.origem !== 'todas' && t.origem !== f.origem) return false;
    if (f.conj && f.conj !== 'todos' && t.conj !== f.conj) return false;
    if (f.plano && f.plano !== 'todos' && (f.plano === 'sem' ? !!t.plano : t.plano !== f.plano)) return false;
    if (f.minhas && !(t.criadoPor === eu.uid || (eu.nome && norm(t.resp) === norm(eu.nome)))) return false;
    if (q && !norm([t.titulo, t.por, t.resp, t.local, t.ref, t.causa, t.como].join(' ')).includes(q)) return false;
    return true;
  });
}
// Ordem: atrasadas primeiro, depois pelo prazo (sem prazo no fim); concluídas e canceladas no fim.
export function ordenar(lista, hoje) {
  const peso = t => (atrasada(t, hoje) ? 0 : aberta(t) ? 1 : t.status === 'feita' ? 2 : 3);
  return lista.slice().sort((a, b) => peso(a) - peso(b) || String(a.prazo || '9').localeCompare(String(b.prazo || '9')) || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
}
// Números do topo: abertas, atrasadas, vencem em 7 dias e concluídas no mês (pela data em que foi concluída).
export function resumo(lista, hoje) {
  const mes = hoje.slice(0, 7);
  return {
    abertas: lista.filter(aberta).length, atrasadas: lista.filter(t => atrasada(t, hoje)).length,
    semana: lista.filter(t => venceLogo(t, hoje)).length,
    feitasMes: lista.filter(t => t.status === 'feita' && String(t.feitaEm || '').slice(0, 7) === mes).length
  };
}
// Andamento de um plano: ações, concluídas, atrasadas, % feito, custos e quanto do 5W2H está respondido.
export function andamentoPlano(acoes, planoId, hoje) {
  const T = acoes.filter(t => t.plano === planoId && t.status !== 'cancelada');
  const feitas = T.filter(t => t.status === 'feita').length;
  const fim = T.reduce((m, t) => (t.prazo && t.prazo > m ? t.prazo : m), '');
  return {
    n: T.length, feitas, atrasadas: T.filter(t => atrasada(t, hoje)).length, pct: T.length ? Math.round(feitas / T.length * 100) : 0,
    previsto: T.reduce((s, t) => s + (Number(t.custo) || 0), 0), realizado: T.reduce((s, t) => s + (Number(t.custoReal) || 0), 0),
    w5: T.length ? Math.round(T.reduce((s, t) => s + w5n(t), 0) / (T.length * 7) * 100) : 0, fim
  };
}

// Texto da ata para WhatsApp ou e-mail (negrito do WhatsApp com *asteriscos*).
export function textoAta(a) {
  const dm = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const l = [`*Ata de reunião: ${a.titulo || 'Sem assunto'}*`];
  const info = [a.data ? 'Data: ' + dm(a.data) : '', a.local ? 'Local: ' + a.local : ''].filter(Boolean).join(' · '); if (info) l.push(info);
  if (a.participantes) l.push('Participantes: ' + a.participantes);
  if (a.pauta) l.push('', '*Pauta e discussão*', a.pauta);
  if (a.decisoes) l.push('', '*Decisões*', a.decisoes);
  const enc = (a.enc || []).filter(e => e.oque);
  if (enc.length) { l.push('', '*Encaminhamentos*'); enc.forEach((e, i) => l.push(`${i + 1}. ${e.oque}${e.quem ? ' · ' + e.quem : ''}${e.prazo ? ' · até ' + dm(e.prazo).slice(0, 5) : ''}`)); }
  return l.join('\n');
}

// Planilha das ações (Exportar para o Excel).
export function linhasExcel(lista, planos, hoje) {
  const dbr = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
  const cab = ['Situação', 'O quê', 'Por quê', 'Origem', 'Referência', 'Conjunto', 'Local', 'Início', 'Prazo', 'Responsável', 'Como', 'Custo previsto', 'Custo realizado', 'Plano', '5W2H', 'Concluída em', 'Criada por'];
  return [{ nome: 'Tratativas', linhas: [cab, ...lista.map(t => [
    atrasada(t, hoje) ? 'Atrasada' : STATUS[t.status] || t.status, t.titulo, t.por || '', ORIGENS[t.origem] || t.origem, t.ref || '', CONJ[t.conj] || '', t.local || '',
    dbr(t.inicio), dbr(t.prazo), t.resp || '', t.como || '', t.custo ?? '', t.custoReal ?? '', (planos[t.plano] || {}).nome || '', `${w5n(t)}/7`,
    dbr(String(t.feitaEm || '').slice(0, 10)), t.criadoNome || ''
  ])] }];
}
