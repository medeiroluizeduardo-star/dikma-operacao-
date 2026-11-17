// Meu painel de exemplo (sem nomes reais) para os testes da migração: trazer-painel.test.mjs e regras.test.mjs.
export const PAINEL = {
  config: { equipe: { people: { p1: { n: 'Pessoa Um' }, p2: { n: 'Pessoa Dois' } } }, main: { metas: { abs: 3, he: '180', xyz: 1 }, indVal: { '2026-10': { iccc: 96, iccp: null }, ruim: { iccc: 1 } } } },
  planos: { pl1: { id: 'pl1', nome: 'Limpeza', objetivo: 'Zerar acúmulo', area: 'pat', status: 'concluido' }, pl2: { nome: 'X', area: 'zzz' } },
  tasks: {
    t1: { id: 't1', title: 'Revisar a escala', area: 'pat', prio: 'alta', due: '2026-11-20', inicio: '2026-11-15', status: 'doing', resp: ['p2', 'nao'], why: 'Acúmulo', plano: 'pl1', notes: 'ver turno C', checklist: [{ t: 'A', ok: true }, { t: 'B', ok: false }], createdAt: '2026-11-10T10:00:00.000Z', custo: '80' },
    t2: { id: 't2', title: 'Ok', area: 'ger', status: 'done', ata: 'ata1', completedAt: '2026-11-12T15:00:00.000Z', plano: 'naoexiste' },
    t3: { id: 't3', title: 'Corrigir dreno', area: 'bat', status: 'review', insp: 'in1', due: '2026-11-01', inicio: '2026-11-05' },
    t4: { id: 't4', title: 'Tratar queda', area: 'pat', status: 'todo', queda: 'q1' },
    t5: { id: 't5', title: 'Apagada', status: 'todo', deleted: true },
    'P01_2026-11-12': { pid: 'P01', due: '2026-11-12', status: 'done', routine: true, checklist: [{ t: 'a', ok: true }, { t: 'b', ok: false }], completedAt: '2026-11-12T17:00:00.000Z', notes: 'feito' },
    'P02_2026-11-13': { pid: 'P02', due: '2026-11-13', status: 'todo', routine: true },
    'P03_2026-11-10': { pid: 'P03', due: '2026-11-10', status: 'nfeita', routine: true }
  },
  atas: {
    ata1: { id: 'ata1', titulo: 'Reunião semanal', data: '2026-11-05', participantes: 'Coord', acoes: [{ oque: 'Conferir faltas', quem: 'p1', prazo: '2026-11-12', task: 't2' }, { oque: 'abc', quem: 'Fulano' }, { oque: 'Ajustar a escala', quem: 'Outro', prazo: 'x' }] },
    ata2: { id: 'ata2', titulo: 'Sem data' }
  },
  inspecoes: {
    in1: { id: 'in1', tipo: 'seg', data: '2026-11-03', area: 'bat', local: 'cdq', itens: [{ t: 'EPI', r: 'ok' }, { t: 'Área', r: 'no', obs: 'sem fita', task: 't3' }, { t: 'Piso', r: '' }] },
    in2: { id: 'in2', tipo: 's5', data: '', area: 'pat', itens: [] }
  },
  documentos: { dc1: { id: 'dc1', tipo: 'OM', numero: 'OM 1', titulo: 'Rolete', area: 'bat', resp: 'p2', emissao: '2026-11-01', validade: '2026-12-01', situacao: 'Em andamento', link: '', obs: '', criadoEm: '2026-11-01T08:00:00.000Z' }, dc2: { id: 'dc2', numero: '', titulo: '' } },
  registros: {
    'dk_patio_10_2026-11-03': { id: 'dk_patio_10_2026-11-03', tipo: 'falta', data: '2026-11-03', lancado: true, ts: Date.UTC(2026, 10, 4, 12) },
    'dk_par_abc': { id: 'dk_par_abc', tipo: 'hp', data: '2026-11-04', oculto: true },
    'dk_bateria_1_2026-11-05': { id: 'dk_bateria_1_2026-11-05', tipo: 'he', data: '2026-11-05' },
    r1: { id: 'r1', tipo: 'he', data: '2026-11-06', quem: 'Operador', area: 'pat', horas: 2.5, desc: 'Cobertura', lancado: true },
    r2: { id: 'r2', tipo: 'ind', data: '2026-10-30', area: 'ger', cat: 'ICCP', desc: 'Divergência no total', status: 'corrigido' },
    r3: { id: 'r3', tipo: 'falta', data: '2026-11-07', quem: 'Op', area: 'ger', cat: 'Inexistente' },
    r4: { id: 'r4', tipo: 'hp', data: '2026-11-08', quem: 'CB-01', area: 'bat', horas: 30, cat: 'Outro' }
  },
  notas: { n1: { id: 'n1', texto: 'Primeira', ts: 1 }, n2: { id: 'n2', texto: 'Segunda', ts: 2 } }, quedas: { q1: {} }, relatorios: {}
};
