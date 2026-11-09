// Testes de quem recebe qual aviso no celular (integracao/avisos/planejar.mjs). Não precisa do emulador.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acessoDoLegado } from './legado.mjs';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let planejar, weekOf;
before(async () => {
  // a rotina copia as contas do site para lib/ antes de rodar; aqui faz o mesmo
  const lib = path.join(raiz, 'integracao', 'avisos', 'lib');
  const { copiarDoSite } = await import(path.join(raiz, 'integracao', 'avisos', 'lib-site.mjs'));
  copiarDoSite(['cal', 'hoje', 'escala', 'pessoas', 'aprovacao', 'situacao', 'acessos', 'planilhas-adm', 'segcalc', 'feriados', 'treinos'], lib);
  ({ planejar } = await import(path.join(raiz, 'integracao', 'avisos', 'planejar.mjs')));
  ({ weekOf } = await import(path.join(lib, 'cal.mjs')));
});

const HOJE = '2026-10-14'; // quarta-feira
// Usuários escritos no cadastro antigo ganham o acesso por módulo como a conversão gravou nos reais.
const conv = us => Object.fromEntries(Object.entries(us).map(([k, u]) => [k, u.acesso ? u : { ...u, ...acessoDoLegado(u) }]));
const tok = { tokens: ['t'] };
const usuarios = conv({
  admin: { papel: 'admin', nome: 'Administrador' },
  liderRec: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], nome: 'Ana Líder' },
  liderPrep: { papel: 'lider', area: 'PREPARAÇÃO', modulos: ['operacao', 'gestao'], nome: 'Beto Líder' },
  leitor: { papel: 'leitor', modulos: ['gestao'], nome: 'Leitor' },
  semAviso: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], nome: 'Sem Aviso' }
});
const avisos = { admin: tok, liderRec: tok, liderPrep: tok, leitor: tok, semAviso: { tokens: [] } };
const ocorr = [
  { id: 'o1', status: 'pendente', data: '2026-10-01', area: 'RECEBIMENTO', recolhe: 'ANA LÍDER', nome: 'FULANO DA SILVA' },
  { id: 'o2', status: 'pendente', data: '2026-10-02', area: 'RECEBIMENTO', recolhe: '', nome: 'CICLANO SOUZA' },
  { id: 'o3', status: 'pendente', data: '2026-10-02', area: 'PREPARAÇÃO', recolhe: 'BETO LÍDER', nome: 'BELTRANO LIMA' },
  { id: 'o4', status: 'pendente', data: '2026-10-13', area: 'RECEBIMENTO', recolhe: 'ANA LÍDER', nome: 'RECENTE' }
];
function setPatio() {
  const ini = weekOf(HOJE);
  const plano = [{ id: 'R1', rota: 'RECEBIMENTO' }, { id: 'R2', rota: 'MELHORIAS' }, { id: 'P1', rota: 'TOPO DO SILO' }];
  return {
    plano, colabs: [], sit: {}, rotas: [],
    semanas: {
      [`RECEBIMENTO|${ini}`]: { area: 'RECEBIMENTO', ini, ids: ['R1', 'R2'], s: { R1: 'PPPPP__', R2: 'RRPPP__' } },
      [`PREPARAÇÃO|${ini}`]: { area: 'PREPARAÇÃO', ini, ids: ['P1'], s: { P1: 'RRRRR__' } }
    }
  };
}
const rodar = (hora, extra = {}) => planejar({ usuarios, avisos, paradas: [], ocorr, sets: { patio: setPatio() }, enviados: {}, agora: new Date(`${HOJE}T${String(hora).padStart(2, '0')}:30:00`), hoje: HOJE, ...extra });
const de = (r, uid, tag) => r.msgs.filter(m => m.uid === uid && m.tag === tag);

test('assinaturas: cada um recebe só as dele; quem vê tudo recebe o total; sem nomes de colaboradores', () => {
  const r = rodar(8);
  const ana = de(r, 'liderRec', 'assinaturas');
  assert.equal(ana.length, 1);
  assert.equal(ana[0].titulo, '2 assinaturas pendentes há mais de 7 dias'); // o1 (com ela) + o2 (área dela, sem responsável)
  assert.match(ana[0].corpo, /1 com você/);
  const beto = de(r, 'liderPrep', 'assinaturas');
  assert.equal(beto[0].titulo, '1 assinatura com você há mais de 7 dias');
  assert.equal(de(r, 'admin', 'assinaturas')[0].titulo, '3 assinaturas pendentes há mais de 7 dias');
  assert.equal(de(r, 'leitor', 'assinaturas').length, 0, 'somente leitura não recolhe assinatura');
  assert.equal(de(r, 'semAviso', 'assinaturas').length, 0, 'sem aparelho, sem aviso');
  for (const m of r.msgs) for (const n of ['FULANO', 'CICLANO', 'BELTRANO', 'Fulano', 'Ciclano', 'Beltrano']) assert.ok(!(m.titulo + m.corpo).includes(n), 'nome de colaborador no aviso');
  assert.ok(r.marcar.includes('ass|' + HOJE));
  assert.equal(rodar(7).msgs.filter(m => m.tag === 'assinaturas').length, 0, 'antes das 8h não avisa');
  assert.equal(rodar(9, { enviados: { ['ass|' + HOJE]: HOJE } }).msgs.filter(m => m.tag === 'assinaturas').length, 0, 'uma vez por dia');
});

test('atividades sem apontar: às 15h, só líder e supervisor, só a área deles, uma vez por dia', () => {
  const r = rodar(15);
  const ana = de(r, 'liderRec', 'atividades');
  assert.equal(ana.length, 1);
  assert.equal(ana[0].titulo, 'Recebimento: 2 atividades sem apontar hoje');
  assert.match(ana[0].url, /m=operacao&v=apontar/);
  assert.equal(de(r, 'liderPrep', 'atividades').length, 0, 'Preparação já apontou tudo');
  assert.equal(de(r, 'admin', 'atividades').length, 0, 'administrador não recebe');
  assert.equal(rodar(14).msgs.filter(m => m.tag === 'atividades').length, 0, 'antes das 15h não avisa');
  assert.equal(rodar(16, { enviados: { [`apo|liderRec|${HOJE}`]: HOJE } }).msgs.filter(m => m.uid === 'liderRec' && m.tag === 'atividades').length, 0);
  const desligado = planejar({ usuarios, avisos: { ...avisos, liderRec: { tokens: ['t'], prefs: { atividades: false } } }, paradas: [], ocorr: [], sets: { patio: setPatio() }, enviados: {}, agora: new Date(`${HOJE}T15:30:00`), hoje: HOJE });
  assert.equal(de(desligado, 'liderRec', 'atividades').length, 0, 'respeita a preferência');
});

test('resumo da semana: segunda às 7h, só administrador, gestor e coordenador, sem nomes, uma vez', () => {
  const SEG = '2026-10-19'; const ini = '2026-10-12';
  const S = { plano: [{ id: 'R1', rota: 'RECEBIMENTO' }], rotas: [], colabs: [{ id: 'C1', area: 'RECEBIMENTO', rota: 'RECEBIMENTO', nome: 'FULANO DA SILVA' }],
    sit: { 'C1|2026-10-13': 'FT', 'C1|2026-10-14': 'AT', 'C1|2026-10-15': 'AT' },
    semanas: { [`RECEBIMENTO|${ini}`]: { area: 'RECEBIMENTO', ini, ids: ['R1', 'R2'], s: { R1: 'RRRRN__', R2: 'RRRPE__' } } } };
  const us = { ...usuarios, ...conv({ gest: { papel: 'gestor', modulos: ['operacao', 'gestao'], nome: 'Gestor' } }) };
  const av = { ...avisos, gest: tok };
  const r = planejar({ usuarios: us, avisos: av, paradas: [], ocorr, sets: { patio: S }, enviados: {}, agora: new Date(`${SEG}T07:10:00`), hoje: SEG });
  const g = de(r, 'gest', 'semanal');
  assert.equal(g.length, 1);
  assert.equal(g[0].titulo, 'Resumo da semana (12/10 a 18/10)');
  assert.match(g[0].corpo, /Pátio: 78% realizado \(7 de 9\) · 1 não realizada · 1 falta, 2 atestados/);
  assert.match(g[0].corpo, /Efetivo: 4 assinaturas pendentes/);
  assert.equal(de(r, 'admin', 'semanal').length, 1);
  assert.equal(de(r, 'liderRec', 'semanal').length, 0, 'líder não recebe');
  assert.ok(!g[0].corpo.includes('FULANO'));
  assert.ok(r.marcar.includes(`sem|gest|${SEG}`));
  const terca = planejar({ usuarios: us, avisos: av, paradas: [], ocorr, sets: { patio: S }, enviados: {}, agora: new Date('2026-10-20T07:10:00'), hoje: '2026-10-20' });
  assert.equal(terca.msgs.filter(m => m.tag === 'semanal').length, 0, 'só na segunda');
  const cedo = planejar({ usuarios: us, avisos: av, paradas: [], ocorr, sets: { patio: S }, enviados: {}, agora: new Date(`${SEG}T06:30:00`), hoje: SEG });
  assert.equal(cedo.msgs.filter(m => m.tag === 'semanal').length, 0, 'antes das 7h não');
  const ja = planejar({ usuarios: us, avisos: av, paradas: [], ocorr, sets: { patio: S }, enviados: { [`sem|gest|${SEG}`]: SEG }, agora: new Date(`${SEG}T09:10:00`), hoje: SEG });
  assert.equal(de(ja, 'gest', 'semanal').length, 0, 'uma vez');
});

test('aprovação: líder recebe o que foi devolvido (uma vez); supervisor recebe o que espera há mais de 1 dia (uma vez por dia)', () => {
  const H = '2026-10-21'; const ini = '2026-10-19';
  const S = { plano: [{ id: 'R1', rota: 'RECEBIMENTO' }, { id: 'R2', rota: 'RECEBIMENTO' }], rotas: [], colabs: [], sit: {},
    semanas: { [`RECEBIMENTO|${ini}`]: { area: 'RECEBIMENTO', ini, ids: ['R1', 'R2'], s: { R1: 'RNP____', R2: 'RPP____' } } },
    aprov: { [`RECEBIMENTO|${ini}`]: { 'R2|0': { s: 'A', c: 'R' }, 'R2|1': { s: 'D', c: 'P', mot: 'Não foi feita', em: 'e1' } } } };
  const us = { ...usuarios, ...conv({ supRec: { papel: 'supervisor', area: 'RECEBIMENTO', modulos: ['operacao'], nome: 'Sup' } }) };
  const av = { ...avisos, supRec: tok };
  const r = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: { patio: S }, enviados: {}, agora: new Date(`${H}T08:10:00`), hoje: H });
  const ana = de(r, 'liderRec', 'aprovacao');
  assert.equal(ana.length, 1); assert.equal(ana[0].titulo, 'O supervisor devolveu 1 atividade'); assert.match(ana[0].corpo, /Não foi feita/);
  assert.equal(de(r, 'liderPrep', 'aprovacao').length, 0, 'outra área não recebe');
  const sup = de(r, 'supRec', 'aprovacao');
  assert.equal(sup.length, 1); assert.equal(sup[0].titulo, '1 apontamento esperando aprovação há mais de 1 dia'); // R1 de segunda; o de terça ainda está no prazo
  const env = Object.fromEntries(r.marcar.map(k => [k, H]));
  const r2 = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: { patio: S }, enviados: env, agora: new Date(`${H}T09:10:00`), hoje: H });
  assert.equal(r2.msgs.filter(m => m.tag === 'aprovacao').length, 0, 'não repete');
});

test('Painel Coqueria: dia útil, 7h tarefas do dia e atrasadas; 16h abertas e Medição sem lançar; só quem usa; sem nomes', () => {
  const painel = {
    admin: {
      tasks: [
        { pid: 'P07', title: 'Gestão operacional · 14/10', due: HOJE, status: 'todo' },
        { pid: 'P04', title: 'Planejamento · Pátio de Carvão · 13/10', due: '2026-10-13', status: 'doing' },
        { pid: 'P02', title: 'Relatório fotográfico · Pátio de Carvão · 15/10', due: '2026-10-15', status: 'todo' },
        { pid: 'P08', title: 'Gestão administrativa · 14/10', due: HOJE, status: 'todo', deleted: true }
      ],
      regs: [
        { tipo: 'falta', data: HOJE, quem: 'FULANO DA SILVA', lancado: false },
        { tipo: 'he', data: '2026-10-02', quem: 'CICLANO SOUZA', horas: 2, lancado: true },
        { tipo: 'hp', data: '2026-10-03', quem: 'Pá carregadeira 03', horas: 1, lancado: false },
        { tipo: 'ind', data: '2026-10-05', cat: 'ICCC', status: 'pendente' },
        { tipo: 'falta', data: '2026-09-30', quem: 'MÊS PASSADO', lancado: false }
      ]
    }
  };
  const manha = de(rodar(7, { painel }), 'admin', 'painel');
  assert.equal(manha.length, 1);
  assert.equal(manha[0].titulo, 'Painel: 1 tarefa para hoje', 'tarefa apagada não conta');
  assert.match(manha[0].corpo, /Gestão operacional/);
  assert.match(manha[0].corpo, /1 atrasada/);
  assert.match(manha[0].corpo, /Amanhã: Relatório fotográfico · Pátio de Carvão/);
  assert.equal(manha[0].url, 'https://gestao-eduardo.web.app/');
  assert.equal(de(rodar(7, { painel, enviados: { [`pnl-m|admin|${HOJE}`]: HOJE } }), 'admin', 'painel').length, 0, 'uma vez por dia');
  const tarde = de(rodar(16, { painel, enviados: { [`pnl-m|admin|${HOJE}`]: HOJE } }), 'admin', 'painel');
  assert.equal(tarde.length, 1);
  assert.equal(tarde[0].titulo, 'Painel: 2 tarefas ainda em aberto');
  assert.match(tarde[0].corpo, /Medição sem lançar: 1 falta, 1 hora perdida/);
  assert.match(tarde[0].corpo, /1 correção ICCC\/ICCP pendente/);
  for (const m of [...manha, ...tarde]) for (const n of ['FULANO', 'CICLANO', 'MÊS PASSADO', 'carregadeira']) assert.ok(!(m.titulo + m.corpo).includes(n), 'nome no aviso');
  assert.equal(de(rodar(7, { painel }), 'liderRec', 'painel').length, 0, 'quem não usa o painel não recebe');
  assert.equal(de(rodar(9, { painel, hoje: '2026-10-17', agora: new Date('2026-10-17T09:30:00') }), 'admin', 'painel').length, 0, 'sábado: sem aviso do painel');
  assert.equal(de(rodar(7, { painel, avisos: { ...avisos, admin: { tokens: ['t'], prefs: { painel: false } } } }), 'admin', 'painel').length, 0, 'preferência desligada');
});

test('justificativas: às 16h o supervisor recebe a contagem das faltas e atrasos sem justificativa da área, sem nomes', () => {
  const us = { ...usuarios, ...conv({ sup: { papel: 'supervisor', area: 'RECEBIMENTO', modulos: ['operacao', 'gestao'], nome: 'Sup' } }) };
  const av = { ...avisos, sup: tok };
  const S = setPatio();
  S.colabs = [{ id: 'C1', area: 'RECEBIMENTO', nome: 'FULANO DA SILVA' }, { id: 'C2', area: 'RECEBIMENTO', nome: 'CICLANO SOUZA' }, { id: 'C3', area: 'PREPARAÇÃO', nome: 'BELTRANO LIMA' }];
  S.sit = { [`C1|${HOJE}`]: 'FT', [`C2|${HOJE}`]: 'ATR', [`C3|${HOJE}`]: 'FT' };
  S.jus = { [`C2|${HOJE}`]: { cod: 'ATR', mot: 'Trânsito' } };
  const r = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: { patio: S }, enviados: {}, agora: new Date(`${HOJE}T16:10:00`), hoje: HOJE });
  const m = r.msgs.filter(x => x.uid === 'sup' && x.tag === 'justificativas');
  assert.equal(m.length, 1);
  assert.equal(m[0].titulo, '1 falta ou atraso sem justificativa hoje'); // C2 justificado; C3 é de outra área
  assert.ok(!/FULANO|Fulano/.test(m[0].titulo + m[0].corpo));
  assert.equal(r.msgs.filter(x => x.uid === 'liderRec' && x.tag === 'justificativas').length, 0, 'líder não recebe');
  const cedo = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: { patio: S }, enviados: {}, agora: new Date(`${HOJE}T15:10:00`), hoje: HOJE });
  assert.equal(cedo.msgs.filter(x => x.tag === 'justificativas').length, 0, 'antes das 16h não avisa');
});

// ---------------- Segurança: anomalia nova e prazo do tratamento ----------------
test('Segurança: anomalia nova avisa quem trata e o supervisor da área (não o autor, nem outra área, nem quem só registra)', () => {
  const us = {
    tec: { papel: 'leitor', nome: 'Técnico', acesso: { seguranca: 'trata' }, escopos: [] },
    reg: { papel: 'leitor', nome: 'Registra', acesso: { seguranca: 'registra' }, escopos: [] },
    supPat: { papel: 'supervisor', nome: 'Sup Pátio', area: 'PREPARAÇÃO', acesso: { operacao: 'supervisor' }, escopos: ['patio'] },
    supBat: { papel: 'supervisor', nome: 'Sup Bateria', area: 'BATERIA 1', acesso: { operacao: 'supervisor' }, escopos: ['bateria'] },
    lider: { papel: 'lider', nome: 'Líder', area: 'PREPARAÇÃO', acesso: { operacao: 'lider' }, escopos: ['patio'] },
    admin: { papel: 'admin', nome: 'Administrador', acesso: { administracao: 'admin' }, escopos: [] }
  };
  const av = Object.fromEntries(Object.keys(us).map(k => [k, tok]));
  const agora = new Date(`${HOJE}T10:00:00`);
  const anom = [{ id: 'a1', status: 'aberta', area: 'PÁTIO DE CARVÃO', conj: 'patio', local: 'CORREIA C1', desc: 'Proteção solta', por: 'reg', em: agora.getTime() - 36e5 },
    { id: 'a0', status: 'aberta', area: 'PÁTIO DE CARVÃO', conj: 'patio', local: 'VELHA', desc: 'x', por: 'reg', em: agora.getTime() - 3 * 864e5 }];
  const r = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: {}, enviados: {}, agora, hoje: HOJE, seg: { anom } });
  const seg = uid => r.msgs.filter(m => m.uid === uid && m.tag === 'seguranca');
  assert.equal(seg('tec').length, 1); assert.equal(seg('tec')[0].titulo, 'Anomalia nova: CORREIA C1');
  assert.match(seg('tec')[0].url, /m=seguranca&v=sganom/);
  assert.equal(seg('supPat').length, 1, 'supervisor da área do Pátio');
  assert.equal(seg('supBat').length, 0, 'supervisor de outra área');
  assert.equal(seg('reg').length, 0, 'o autor (e quem só registra) não recebe');
  assert.equal(seg('lider').length, 0); assert.equal(seg('admin').length, 0);
  assert.ok(r.marcar.includes('sga|a1')); assert.ok(!r.marcar.includes('sga|a0'), 'anomalia de dias atrás não é nova');
  const de2 = planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: {}, enviados: { 'sga|a1': HOJE }, agora, hoje: HOJE, seg: { anom } });
  assert.equal(de2.msgs.filter(m => m.tag === 'seguranca').length, 0, 'uma vez por anomalia');
  const semPref = planejar({ usuarios: us, avisos: { ...av, tec: { tokens: ['t'], prefs: { seguranca: false } } }, paradas: [], ocorr: [], sets: {}, enviados: {}, agora, hoje: HOJE, seg: { anom } });
  assert.equal(semPref.msgs.filter(m => m.uid === 'tec' && m.tag === 'seguranca').length, 0, 'respeita a preferência');
});

test('Segurança: prazo amanhã e prazo vencido avisam só o responsável pelo tratamento, das 7h em diante, uma vez por prazo', () => {
  const us = {
    tec: { papel: 'leitor', nome: 'Técnico Um', acesso: { seguranca: 'trata' }, escopos: [] },
    outro: { papel: 'leitor', nome: 'Técnico Dois', acesso: { seguranca: 'trata' }, escopos: [] },
    supPat: { papel: 'supervisor', nome: 'Sup Pátio', area: 'PREPARAÇÃO', acesso: { operacao: 'supervisor' }, escopos: ['patio'] }
  };
  const av = Object.fromEntries(Object.keys(us).map(k => [k, tok]));
  const velho = new Date(`${HOJE}T08:00:00`).getTime() - 10 * 864e5;
  const anom = [
    { id: 'p1', status: 'tratamento', area: 'BATERIA', conj: 'bateria', local: 'PORTA 12', por: 'x', em: velho, trat: { resp: 'Técnico Um', respUid: 'tec', prazo: '2026-10-15' } },
    { id: 'p2', status: 'tratamento', area: 'PÁTIO DE CARVÃO', conj: 'patio', local: 'PASSARELA', por: 'x', em: velho, trat: { resp: 'SUP PATIO', prazo: '2026-10-10' } },
    { id: 'p3', status: 'concluida', area: 'BATERIA', conj: 'bateria', local: 'TRILHO', por: 'x', em: velho, trat: { resp: 'Técnico Um', respUid: 'tec', prazo: '2026-10-01' } },
    { id: 'p4', status: 'tratamento', area: 'BATERIA', conj: 'bateria', local: 'CDQ', por: 'x', em: velho, trat: { resp: 'Técnico Um', respUid: 'tec', prazo: '2026-10-20' } }
  ];
  const rodarS = (h, enviados = {}) => planejar({ usuarios: us, avisos: av, paradas: [], ocorr: [], sets: {}, enviados, agora: new Date(`${HOJE}T${String(h).padStart(2, '0')}:30:00`), hoje: HOJE, seg: { anom } });
  const r = rodarS(8);
  const seg = uid => r.msgs.filter(m => m.uid === uid && m.tag === 'seguranca');
  assert.deepEqual(seg('tec').map(m => m.titulo), ['Prazo amanhã: 1 anomalia com você'], 'p1 vence amanhã; p3 concluída e p4 longe não contam');
  assert.match(seg('tec')[0].corpo, /PORTA 12/);
  assert.deepEqual(seg('supPat').map(m => m.titulo), ['Prazo vencido: 1 anomalia com você'], 'responsável achado pelo nome digitado');
  assert.equal(seg('outro').length, 0, 'quem não é o responsável não recebe');
  assert.ok(r.marcar.includes('sgp1|p1|2026-10-15') && r.marcar.includes('sgpv|p2|2026-10-10'));
  assert.equal(rodarS(6).msgs.filter(m => m.tag === 'seguranca').length, 0, 'antes das 7h não avisa prazo');
  assert.equal(rodarS(9, { 'sgp1|p1|2026-10-15': HOJE, 'sgpv|p2|2026-10-10': HOJE }).msgs.filter(m => m.tag === 'seguranca').length, 0, 'uma vez por prazo');
  for (const m of r.msgs) assert.ok(!/FULANO|Fulano/.test(m.titulo + m.corpo));
});

test('perfil por módulo: cada aviso segue o perfil do módulo do assunto, não o cargo antigo (papel)', () => {
  // Gestor na Gestão e Líder na Operação (o papel antigo grava o maior: gestor).
  const misto = { papel: 'gestor', nome: 'Duda Mista', area: 'RECEBIMENTO', modulos: [], acesso: { operacao: 'lider', gestao: 'gestor' }, escopos: ['patio'] };
  // Só Gestão (gestor): não aponta nem aprova na Operação.
  const soGe = { papel: 'gestor', nome: 'Gil Gestão', area: 'RECEBIMENTO', modulos: [], acesso: { gestao: 'gestor' }, escopos: ['patio'] };
  const us = { ...usuarios, misto, soGe };
  const r = planejar({ usuarios: us, avisos: { ...avisos, misto: tok, soGe: tok }, paradas: [], ocorr, sets: { patio: setPatio() }, enviados: {}, agora: new Date(`${HOJE}T15:30:00`), hoje: HOJE });
  assert.equal(de(r, 'misto', 'atividades').length, 1, 'líder na Operação recebe o lembrete de apontar');
  assert.equal(de(r, 'soGe', 'atividades').length, 0, 'sem Operação não recebe o lembrete de apontar');
  const seg = planejar({ usuarios: us, avisos: { ...avisos, misto: tok, soGe: tok }, paradas: [], ocorr, sets: { patio: setPatio() }, enviados: {}, agora: new Date('2026-10-19T07:30:00'), hoje: '2026-10-19' });
  assert.equal(de(seg, 'soGe', 'semanal').length, 1, 'gestor na Gestão recebe o resumo da semana');
});

test('treinamentos e ASO: segunda às 7h, só quem tem o RH, só números, uma vez', () => {
  const SEG = '2026-10-19';
  const us = conv({ rh: { papel: 'supervisor', nome: 'RH', acesso: { rh: 'administrativo' }, escopos: [] }, lider: { papel: 'lider', area: 'RECEBIMENTO', modulos: ['operacao'], nome: 'Líder' } });
  const av = { rh: tok, lider: tok };
  const treinos = [{ id: 'a', nome: 'FULANO DE TAL', mat: '1', tipo: 'ASO', validade: '2026-10-01' }, { id: 'b', nome: 'CICLANO', mat: '2', tipo: 'NR-35', validade: '2026-11-05' }, { id: 'c', nome: 'BELTRANO', mat: '3', tipo: 'NR-10', validade: '2028-01-01' }];
  const base = { usuarios: us, avisos: av, paradas: [], ocorr: [], sets: {}, enviados: {}, treinos };
  const r = planejar({ ...base, agora: new Date(`${SEG}T07:10:00`), hoje: SEG });
  const m = r.msgs.filter(x => x.tag === 'treinos');
  assert.equal(m.length, 1); assert.equal(m[0].uid, 'rh');
  assert.match(m[0].titulo, /1 vencido, 1 vence em 30 dias/);
  assert.ok(!/FULANO|CICLANO/.test(m[0].titulo + m[0].corpo), 'sem nomes de colaboradores');
  assert.equal(planejar({ ...base, agora: new Date('2026-10-20T07:10:00'), hoje: '2026-10-20' }).msgs.filter(x => x.tag === 'treinos').length, 0, 'só na segunda');
  assert.equal(planejar({ ...base, enviados: { [`trein|rh|${SEG}`]: SEG }, agora: new Date(`${SEG}T09:10:00`), hoje: SEG }).msgs.filter(x => x.tag === 'treinos').length, 0, 'uma vez');
  assert.equal(planejar({ ...base, avisos: { rh: { tokens: ['t'], prefs: { treinos: false } } }, agora: new Date(`${SEG}T07:10:00`), hoje: SEG }).msgs.filter(x => x.tag === 'treinos').length, 0, 'desligado');
});
