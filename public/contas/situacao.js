// Dikma Gestão — conta única de presença: a tabela de códigos de situação e "qual é a situação desta pessoa neste dia".
// Funções puras (sem banco e sem tela): usadas pelo Efetivo diário, pela Frequência, pela Operação, pelo Meu dia
// e pela rotina de avisos no celular (GitHub Actions), para todos mostrarem o mesmo número.
import { normRegime, letra, comoEra } from './escala.js';

// Tabela única dos códigos. Um código novo entra só aqui; as listas abaixo saem dela.
//   ausente: a pessoa não está disponível no dia (inclui folga, férias e desligado)
//   ausencia: ausência de verdade (folga, férias e desligado não contam)
//   parcial: veio, mas chegou depois ou saiu antes (conta como presente)
//   cobrivel: pede substituto no Efetivo diário
//   justifica: pede justificativa
//   conta: tem coluna de total na folha de frequência
//   operacao: como aparece na Equipe e frota da Operação (null = trabalhando)
//   plural: [singular, plural] em minúsculas, para textos como "2 faltas"
export const CODIGOS = {
  P: { nome: 'Presente', operacao: null },
  F: { nome: 'Folga', ausente: true, cobrivel: true, operacao: 'FOLGA' },
  FE: { nome: 'Férias', ausente: true, cobrivel: true, operacao: 'FÉRIAS' },
  AT: { nome: 'Atestado', ausente: true, ausencia: true, cobrivel: true, justifica: true, conta: true, operacao: 'ATESTADO MÉDICO', plural: ['atestado', 'atestados'] },
  AF: { nome: 'Afastado', ausente: true, ausencia: true, cobrivel: true, justifica: true, operacao: 'AFASTAMENTO (INSS)', plural: ['afastamento', 'afastamentos'] },
  TR: { nome: 'Treinamento', ausente: true, ausencia: true, cobrivel: true, justifica: true, operacao: 'TREINAMENTO', plural: ['treinamento', 'treinamentos'] },
  FT: { nome: 'Falta', ausente: true, ausencia: true, cobrivel: true, justifica: true, conta: true, operacao: 'FALTA', plural: ['falta', 'faltas'] },
  DS: { nome: 'Desligado', ausente: true, operacao: 'DESLIGADO' },
  HE: { nome: 'Hora extra', conta: true, operacao: null },
  ATR: { nome: 'Atrasado', parcial: true, justifica: true, conta: true, operacao: null },
  SA: { nome: 'Saída antecipada', parcial: true, justifica: true, conta: true, operacao: null },
  AB: { nome: 'Abono', ausente: true, ausencia: true, justifica: true, conta: true, operacao: 'ABONO', plural: ['abono', 'abonos'] },
  SP: { nome: 'Suspensão', ausente: true, ausencia: true, justifica: true, conta: true, operacao: 'SUSPENSÃO', plural: ['suspensão', 'suspensões'] }
};
const TODOS = Object.keys(CODIGOS);
const com = campo => TODOS.filter(c => CODIGOS[c][campo]);
// Ordem de exibição de cada lista; um código marcado na tabela e esquecido aqui entra no fim, sem sumir.
const naOrdem = (seq, lista) => { const s = seq.split(' ').filter(c => lista.includes(c)); return [...s, ...lista.filter(c => !s.includes(c))]; };

// [código, nome] na ordem da legenda
export const SITS = TODOS.map(c => [c, CODIGOS[c].nome]);
export const NOMES_CODIGO = Object.fromEntries(SITS);
export const AUSENTE = new Set(com('ausente'));
export const AUSENCIA = new Set(com('ausencia'));
export const PARCIAL = new Set(com('parcial'));
export const AUS_COBRIVEL = new Set(com('cobrivel'));
// Situações que podem ser lançadas (a mesma lista no Efetivo diário e na Frequência)
export const CODIGOS_LANC = naOrdem('P F FT ATR SA AT AB HE FE AF TR SP DS', TODOS);
export const JUS_CODS = naOrdem('FT ATR SA AT AF AB SP TR', com('justifica'));
// Colunas de total da folha de frequência
export const CONTA = naOrdem('FT ATR SA AT AB SP HE', com('conta'));
// Situação na Operação (Equipe e frota): null = trabalhando
export const SIT_OPERACAO = Object.fromEntries(TODOS.filter(c => CODIGOS[c].operacao).map(c => [c, CODIGOS[c].operacao]));
export const textoOperacao = c => (!c ? undefined : CODIGOS[c] ? CODIGOS[c].operacao : 'OUTRO');
// Está trabalhando no dia (P, hora extra, atraso, saída antecipada; código desconhecido também conta)
export const presente = v => !!v && !AUSENTE.has(v);

// ---- Turma pela ficha ----
// Quem não tem a letra da turma nas Atividades usa a da ficha do Efetivo ou a do cadastro da Operação (mesmo nome).
const semAc = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const chaveNome = s => semAc(s).toUpperCase().replace(/\s+/g, ' ').trim(); // sem acento, maiúsculas e minúsculas iguais
// fichas = [{ nome, turma }] (Efetivo) · operadores = [{ nome, turma, escala }] (Operação). A ficha vale mais.
export function criarTurmaFicha(fichas = [], operadores = []) {
  const m = new Map();
  for (const o of operadores || []) { const l = letra(o.turma); if (l && o.escala === '4x4') m.set(chaveNome(o.nome), l); }
  for (const c of fichas || []) { const l = letra(c.turma); if (l) m.set(chaveNome(c.nome), l); }
  return nome => m.get(chaveNome(nome)) || '';
}

// ---- Feriados ----
// Os da Operação (eq/config) só tiram o dia quando "sem operação" está marcado; os de Escalas e turnos, sempre
// (a não ser que digam semOp: false). Aqui os da Operação viram o formato da escala central.
export const feriadosOperacao = eqCfg => ((eqCfg && eqCfg.feriados) || []).filter(f => f && f.data).map(f => ({ data: f.data, desc: f.desc || 'feriado', semOp: !!f.semOp }));

// ---- Situação do dia ----
// pessoa = { id, nome, mat, regime, turma, escHist } · data = AAAA-MM-DD (escHist: escala.js › comoEra)
// fontes = {
//   lancado(pessoa, data) → código lançado no dia (Efetivo diário, Frequência, check-in) ou vazio,
//   desligadoEm(pessoa) → data de demissão/desligamento (vale a partir dela) ou vazio,
//   ferias(pessoa, data) → verdadeiro quando há férias marcadas no dia,
//   escala → criarEscala(...) (sem ela não marca folga sozinha),
//   turmaFicha(nome) → letra da turma pela ficha (quando a pessoa não tem letra),
//   regime(pessoa), turma(pessoa) → para quem guarda regime/turma de outro jeito (Frequência),
//   escalaFicha(pessoa, data) → { regime, turma } pela ficha (vale mais que as Atividades) ou null,
//   hoje → dias depois de hoje sem nada lançado ficam vazios em vez de "presente",
//   turnoDesde → (AAAA-MM-DD) quem é de turno: folga (F) ou presente (P) gravados depois desse dia não valem; manda a
//     escala da turma (planilhas trazem F nos fins de semana e no resto do mês, que não são a escala do turno) }
// Devolve { v, auto, por, periodo, motivo, semTurma }:
//   por: 'lancado' | 'desligado' | 'ferias' | 'escala' | 'padrao' · auto: não foi lançado
//   periodo: 'D' | 'N' quando a escala diz que a pessoa trabalha no dia em turno; '' no administrativo ou de folga
// A ordem é a mesma em todo o sistema: o lançado vale mais; depois desligamento, férias, folga da escala e presente.
export function previstoDe(pessoa, data, fontes = {}) {
  const E = fontes.escala; if (!E) return null;
  // a ficha (RH › Colaboradores) manda na letra e na escala quando diz (escala.js › escalaDaFicha)
  const pf = fontes.escalaFicha ? fontes.escalaFicha(pessoa, data) : null;
  if (pf) return E.previsto(normRegime(pf.regime, E.regimes), pf.turma, data);
  pessoa = comoEra(pessoa, data); // troca de escala vale só a partir da data dela
  const regime = fontes.regime ? fontes.regime(pessoa) : normRegime(pessoa.regime, E.regimes);
  const t = fontes.turma ? fontes.turma(pessoa) : letra(pessoa.turma);
  const turma = t || (fontes.turmaFicha ? fontes.turmaFicha(pessoa.nome) : '');
  return E.previsto(regime, turma, data);
}
export function situacaoDoDia(pessoa, data, fontes = {}) {
  const p = previstoDe(pessoa, data, fontes);
  const periodo = p && p.trab ? p.periodo || '' : '';
  let m = fontes.lancado ? fontes.lancado(pessoa, data) : '';
  if (m && p && p.ciclo && (m === 'F' || m === 'P') && fontes.turnoDesde && data > fontes.turnoDesde) m = '';
  if (m) return { v: m, auto: false, por: 'lancado', periodo };
  const dem = fontes.desligadoEm ? fontes.desligadoEm(pessoa) : '';
  if (dem && data >= dem) return { v: 'DS', auto: true, por: 'desligado', periodo: '' };
  if (fontes.ferias && fontes.ferias(pessoa, data)) return { v: 'FE', auto: true, por: 'ferias', periodo: '' };
  if (p && !p.trab) return { v: 'F', auto: true, por: 'escala', periodo: '', motivo: p.motivo };
  return { v: fontes.hoje && data > fontes.hoje ? '' : 'P', auto: true, por: 'padrao', periodo, semTurma: !!fontes.escala && !p };
}

// ---- Contagem do dia ----
// lista de pessoas → { quadro, folga, ferias, escalados, ausentes, presentes, parciais, desligados, porCodigo, periodo: { D, N } }
//   quadro = todos menos desligados · escalados = quadro − folga (da escala ou lançada) − férias
//   ausentes = atestado, afastamento, treinamento, falta, abono e suspensão · presentes = escalados − ausentes
//   (dia futuro sem lançamento: escalado, mas ainda não presente)
// fontes.sitDe(pessoa, data) opcional: situação já calculada (o app guarda as contas); sem ela, usa situacaoDoDia.
export function contagemDia(lista, data, fontes = {}) {
  const sd = fontes.sitDe || ((p, d) => situacaoDoDia(p, d, fontes));
  const r = { quadro: 0, folga: 0, ferias: 0, escalados: 0, ausentes: 0, presentes: 0, parciais: 0, desligados: 0, porCodigo: {}, periodo: { D: 0, N: 0 } };
  for (const p of lista || []) {
    const s = sd(p, data); const v = s.v;
    if (v === 'DS') { r.desligados++; continue; }
    r.quadro++;
    if (v === 'F') { r.folga++; continue; }
    if (v === 'FE') { r.ferias++; continue; }
    r.escalados++;
    if (AUSENCIA.has(v)) { r.ausentes++; r.porCodigo[v] = (r.porCodigo[v] || 0) + 1; continue; }
    if (!v) continue;
    r.presentes++;
    if (PARCIAL.has(v)) { r.parciais++; r.porCodigo[v] = (r.porCodigo[v] || 0) + 1; }
    if (s.periodo === 'D' || s.periodo === 'N') r.periodo[s.periodo]++;
  }
  return r;
}
