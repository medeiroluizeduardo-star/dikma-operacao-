// Testes da leitura das planilhas do Administrativo (frequência e férias) e da ligação com as Atividades.
// Usa planilhas montadas aqui, com nomes inventados (as planilhas reais não entram no repositório).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../public/vendor/xlsx.js';
import { lerFrequencia, lerFerias, abasDoXLSX, prepararImportacao, diasDaCompetencia, competenciaDe, criarBusca, unirGrupos, canonLideres } from '../public/planilhas-adm.js';
import { casaParte, lideresDasFichas, trocarNasFichas, moverNaFolha } from '../public/lideres.js';
import { indiceFerias, perfilDe, editaAdm, temFreq } from '../public/acessos.js';

const dias = [...Array(16).keys()].map(i => 16 + i).concat([...Array(15).keys()].map(i => i + 1)); // 16..31, 1..15 (outubro: 16/09 a 15/10)
function livro(abas) {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas, merges] of abas) { const ws = XLSX.utils.aoa_to_sheet(linhas); if (merges) ws['!merges'] = merges; XLSX.utils.book_append_sheet(wb, ws, nome); }
  return abasDoXLSX(XLSX, XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true }));
}
const linha = (nome, cods) => ['', nome, ...dias.slice(0, 30).map((_, i) => cods[i] ?? null)];

test('competência vai de 16 a 15 e o dia 16 já é da competência seguinte', () => {
  const d = diasDaCompetencia('2026-10');
  assert.equal(d[0], '2026-09-16'); assert.equal(d[d.length - 1], '2026-10-15'); assert.equal(d.length, 30);
  assert.equal(competenciaDe('2026-10-15'), '2026-10'); assert.equal(competenciaDe('2026-10-16'), '2026-11');
  assert.equal(diasDaCompetencia('2027-01')[0], '2026-12-16');
});

test('frequência: turno (D e N trabalhados, FO folga, F falta), administrativo (S e D folga) e férias mesclada', () => {
  const abas = livro([['OUTUBRO 2026', [
    ['', 'PÁTIO TURMA I - TURNO 3X3', ...dias.slice(0, 30)],
    linha('ANA EXEMPLO TESTE - I', ['D', 'N', 'FO', 'F', 'AT', 'X', 'HE']),
    linha('BRUNO EXEMPLO TESTE - I', ['FÉRIAS']),
    ['', 'GESTÃO', ...dias.slice(0, 30)],
    linha('CARLA EXEMPLO TESTE', ['P', 'S', 'D', 'AB', 'SP', 'T', 'DESLIGADO 22/09/2026'])
  ], [{ s: { r: 2, c: 2 }, e: { r: 2, c: 8 } }]]]);
  const f = lerFrequencia(abas, 'patio');
  assert.equal(f.competencias.length, 1);
  const c = f.competencias[0];
  assert.equal(c.competencia, '2026-10'); assert.equal(c.ini, '2026-09-16'); assert.equal(c.fim, '2026-10-15');
  const [turno, gestao] = c.grupos;
  assert.equal(turno.turno, true); assert.equal(gestao.turno, false);
  const ana = turno.pessoas[0];
  assert.equal(ana.nome, 'ANA EXEMPLO TESTE'); assert.equal(ana.turma, 'I');
  assert.deepEqual(ana.dias, { '2026-09-16': 'P', '2026-09-17': 'P', '2026-09-18': 'F', '2026-09-19': 'FT', '2026-09-20': 'AT', '2026-09-22': 'HE' });
  const bruno = turno.pessoas[1];
  assert.equal(Object.values(bruno.dias).filter(v => v === 'FE').length, 7, 'férias mesclada vale para os 7 dias');
  const carla = gestao.pessoas[0];
  assert.equal(carla.dias['2026-09-17'], 'F'); assert.equal(carla.dias['2026-09-18'], 'F');
  assert.equal(carla.dias['2026-09-19'], 'AB'); assert.equal(carla.dias['2026-09-20'], 'SP'); assert.equal(carla.dias['2026-09-21'], 'TR');
  assert.equal(carla.desligado, '2026-09-22');
});

test('férias: lê o bloco, ignora o título, calcula o término e não repete a mesma pessoa', () => {
  const cab = ['MATRÍCULA', 'NOME', 'SETOR', 'FUNÇÃO', 'HORÁRIO', 'ADMISSÃO', 'DATA LIMITE', 'INÍCIO', 'DIAS', 'TÉRMINO', 'RETORNO', 'OBS'];
  const abas = livro([
    ['OUTUBRO', [['FÉRIAS OUTUBRO', 'FÉRIAS OUTUBRO'], cab, [1234, 'ANA EXEMPLO TESTE', 'PATIO', 'AJUDANTE', 'ADM', '01/02/2020', '01/12/2026', '05/10/2026', 30, null, '04/11/2026', 'cobre: fulano']]],
    ['NOVEMBRO', [cab, [1234, 'ANA EXEMPLO TESTE', 'PATIO', 'AJUDANTE', 'ADM', '01/02/2020', '01/12/2026', '05/10/2026', 30, null, null, ''], [999, 'BRUNO SEM DATA', 'BATERIA', 'OPERADOR', 'TURNO', null, '10/11/2026', null, null, null, null, '']]]
  ]);
  const r = lerFerias(abas).ferias;
  assert.equal(r.length, 2);
  assert.equal(r[0].mat, '1234'); assert.equal(r[0].inicio, '2026-10-05'); assert.equal(r[0].termino, '2026-11-03'); assert.equal(r[0].limite, '2026-12-01');
  assert.equal(r[1].inicio, null); assert.equal(r[1].aba, 'NOVEMBRO');
});

test('importação: liga ao RH e às Atividades, presença de quem está nas Atividades vai para a presença do dia e P não é gravado', () => {
  const freq = { patio: { competencias: [{ competencia: '2026-10', grupos: [{ nome: 'G', turno: true, pessoas: [
    { nome: 'ANA EXEMPLO TESTE', dias: { '2026-09-16': 'P', '2026-09-17': 'AT' } },
    { nome: 'BRUNO EXEMPLO TESTE', dias: { '2026-09-16': 'FT' } },
    { nome: 'CARLA FORA DO RH', d: ',FT' }
  ] }] }] } };
  const rh = [{ mat: '1001', nome: 'ANA EXEMPLO TESTE' }, { mat: '1002', nome: 'BRUNO EXEMPLO TESTI' }];
  const colabs = { patio: [{ id: 'C001', nome: 'ANA EXEMPLO TESTE' }] };
  const p = prepararImportacao({ freq, colabs, rh });
  const [ana, bruno, carla] = p.comps[0].grupos[0].pessoas;
  assert.equal(ana.ativ, 'C001'); assert.equal(ana.mat, '1001');
  assert.equal(bruno.mat, '1002', 'uma letra trocada ainda acha no RH'); assert.equal(bruno.ativ, null);
  assert.deepEqual(p.presenca.patio, { 'C001|2026-09-17': 'AT' });
  assert.deepEqual(p.comps[0].d, { 1002: { '2026-09-16': 'FT' }, 'n:CARLA FORA DO RH': { '2026-09-17': 'FT' } });
  assert.deepEqual(p.resumo.semRH.map(x => x.nome), ['CARLA FORA DO RH']);
});

test('busca de pessoas: matrícula vence o nome, nome curto demais não liga', () => {
  const b = criarBusca([{ mat: '1', nome: 'JOSE DA SILVA' }, { mat: '2', nome: 'JOSÉ DA SILVA SANTOS' }]);
  assert.equal(b('JOSÉ DA SILVA').item.mat, '1');
  assert.equal(b('QUALQUER NOME', '2').item.mat, '2');
  assert.equal(b('MARIA'), null);
});

test('férias em comum: o índice acha pela matrícula ou pelo nome, só dentro do período', () => {
  const idx = indiceFerias([{ mat: '1001', nome: 'ANA EXEMPLO', inicio: '2026-10-05', termino: '2026-11-03' }, { nome: 'BRUNO EXEMPLO', inicio: '2026-12-01', termino: '2026-12-30' }, { nome: 'SEM DATA' }]);
  assert.ok(idx({ mat: '1001', nome: 'OUTRO NOME' }, '2026-10-05'));
  assert.ok(idx({ nome: 'Bruno  Exemplo' }, '2026-12-30'));
  assert.equal(idx({ nome: 'BRUNO EXEMPLO' }, '2026-12-31'), null);
  assert.equal(idx({ mat: '1001', nome: 'ANA EXEMPLO' }, '2026-10-04'), null);
});

test('acessos: Administração completa só o administrador; Frequência e férias são do RH', () => {
  assert.equal(perfilDe({ papel: 'lider', acesso: { operacao: 'lider' }, escopos: ['patio'] }, 'administracao'), null);
  assert.equal(perfilDe({ papel: 'gestor', acesso: { operacao: 'gestor', rh: 'administrativo', administracao: 'modulo' }, escopos: ['patio'] }, 'administracao'), 'modulo');
  assert.equal(perfilDe({ papel: 'admin', acesso: { administracao: 'admin' } }, 'administracao'), 'admin');
  assert.equal(perfilDe({ papel: 'gestor', acesso: { operacao: 'gestor', rh: 'administrativo' }, escopos: ['patio'] }, 'rh'), 'administrativo');
  assert.equal(temFreq({ papel: 'lider', acesso: { operacao: 'lider' }, escopos: ['patio'] }), false);
  assert.equal(temFreq({ papel: 'administrativo', acesso: { rh: 'administrativo' }, escopos: [] }), true);
  assert.equal(temFreq({ papel: 'supervisor', modulos: ['frequencia'] }), false, 'cadastro antigo (sem acesso) não vale');
  assert.equal(editaAdm({ papel: 'leitor', acesso: { rh: 'leitor' }, escopos: [] }), false);
  assert.equal(editaAdm({ papel: 'administrativo', acesso: { rh: 'administrativo' }, escopos: [] }), true);
});
test('líder com o nome escrito de jeitos diferentes vira um grupo só (como Kauan / Kauan Souza / Kauan Suza)', () => {
  const g = (nome, ...ps) => ({ nome, pessoas: ps.map(n => ({ k: n, nome: n })) });
  const rh = ['TALISON MOURA DA CRUZ', 'TALIS ROCHA LEMOS', 'OTAVIO NUNES PRADO', 'OTAVIO LIMA REIS', 'SERGIO ALVES']; // nomes inventados
  const u = unirGrupos([g('GESTÃO', 'A'), g('LIDER TALISON - SUPERVISÃO KAROL', 'B'), g('LIDER TALISON MOURA- SUPERVISÃO KAROL', 'C', 'B'), g('LIDER TALSON - SUPERVISÃO KAROL', 'D'),
    g('GÁS - LIDER SERGIO - SUPERVISÃO KAROL', 'E'), g('PREPARACAO - LIDER SERGIO - SUPERVISÃO KAROL', 'F')], rh);
  assert.deepEqual(u.map(x => x.nome), ['GESTÃO', 'LIDER TALISON MOURA - SUPERVISÃO KAROL', 'GÁS - LIDER SERGIO - SUPERVISÃO KAROL', 'PREPARACAO - LIDER SERGIO - SUPERVISÃO KAROL'], 'o nome fica como foi escrito; só junta e corrige letras');
  assert.deepEqual(u[1].pessoas.map(p => p.nome), ['B', 'C', 'D'], 'junta sem repetir a mesma pessoa');
  assert.equal(unirGrupos([g('LIDER TALISON MURA- SUPERVISÃO KAROL')], rh)[0].nome, 'LIDER TALISON MOURA - SUPERVISÃO KAROL', 'uma letra trocada no sobrenome');
  const c = canonLideres(['Talison', 'Otavio', 'Sergio'], rh);
  assert.equal(c('Talison'), 'TALISON MOURA');
  assert.equal(c('Otavio'), 'OTAVIO', 'dois Otávios no RH: não troca');
  assert.equal(unirGrupos([g('LIDER TALISON - SUPERVISÃO X'), g('LIDER TALISON MOURA - SUPERVISÃO X')], [])[0].nome, 'LIDER TALISON MOURA - SUPERVISÃO X', 'sem o RH, o nome curto vira o único nome maior');
});

// Caso real (nomes trocados): três pessoas com o mesmo primeiro nome no RH, uma delas cadastrada como "líder de turma",
// e o líder de fato (Kauan) cadastrado como ajudante. Nenhum jeito de escrever o líder pode virar outra pessoa.
test('líder não vira outra pessoa do RH: primeiro nome igual a vários, letra trocada e função no RH', () => {
  const rh = [{ nome: 'BRENO FERREIRA ALMEIDA', funcao: 'AJUDANTE' }, { nome: 'BRENO ANDRADE DOS SANTOS', funcao: 'LIDER DE TURMA' },
    { nome: 'BRENO ALVES SANTOS', funcao: 'AJUDANTE' }, { nome: 'BRUNO SANTOS LIMA', funcao: 'AJUDANTE' }, { nome: 'KAUAN SOUZA DOS SANTOS', funcao: 'AJUDANTE' }];
  const todos = ['BRENO', 'BRENO A', 'BRENO ALVES', 'KAUAN', 'KAUAN SOUZA'];
  const c = canonLideres(todos, rh);
  assert.deepEqual(todos.map(c), ['BRENO ALVES', 'BRENO A', 'BRENO ALVES', 'KAUAN SOUZA', 'KAUAN SOUZA'], 'BRENO só vira BRENO ALVES porque ele já é líder na lista');
  for (const lista of [['BRENO'], ['BRENO A'], ['BRENO', 'KAUAN'], ['BRENO AN'], ['BRENO SANTOS'], ['BRENO DOS SANTOS']]) {
    const f = canonLideres(lista, rh);
    for (const n of lista) assert.ok(!/ANDRADE|BRUNO/.test(f(n)), `${n} (em ${lista.join(', ')}) virou ${f(n)}`);
  }
  assert.equal(canonLideres(['BRENO'], rh)('BRENO'), 'BRENO', 'três Brenos no RH: fica como está, mesmo um sendo "líder de turma"');
  assert.equal(canonLideres(['BRENO SANTOS'], rh)('BRENO SANTOS'), 'BRENO SANTOS', 'não troca BRENO por BRUNO: existe gente chamada BRENO');
  assert.equal(canonLideres(['BRUNO ANDRADE'], rh)('BRUNO ANDRADE'), 'BRUNO ANDRADE', 'não troca BRUNO por BRENO');
  assert.equal(canonLideres(['KAUN'], rh)('KAUN'), 'KAUAN SOUZA', 'primeiro nome que ninguém tem: aceita uma letra trocada');
  assert.equal(canonLideres(['KAUAN SUZA'], rh)('KAUAN SUZA'), 'KAUAN SOUZA');
  const g = (nome, ...ps) => ({ nome, pessoas: ps.map(n => ({ k: n, nome: n })) });
  const u = unirGrupos([g('LIDER BRENO - SUPERVISÃO KAROL', 'A'), g('LIDER KAUAN - SUPERVISÃO KAROL', 'B'), g('LIDER KAUAN SOUZA- SUPERVISÃO KAROL', 'C')], rh);
  assert.deepEqual(u.map(x => x.nome), ['LIDER BRENO - SUPERVISÃO KAROL', 'LIDER KAUAN SOUZA - SUPERVISÃO KAROL']);
});

test('trocar líder: parte do nome, fichas e grupos da folha (move as pessoas e mantém a supervisão do destino)', () => {
  assert.ok(casaParte('breno and', 'BRENO ANDRADE')); assert.ok(casaParte('ANDRADE', 'Breno Andrade dos Santos'));
  assert.ok(!casaParte('breno and', 'BRENO ALVES')); assert.ok(casaParte('kauan', 'KAUAN SOUZA')); assert.ok(!casaParte('kauan souza', 'KAUAN'));
  const fichas = [{ mat: '1', nome: 'ANA', lider: 'Breno Andrade' }, { mat: '2', nome: 'BIA', lider: 'BRENO ANDRADE' }, { mat: '3', nome: 'CAIO', lider: 'KAUAN' },
    { mat: '4', nome: 'DANI', lider: 'BRENO ALVES' }, { mat: '5', nome: 'EVA', lider: 'BRENO ANDRADE', dem: '2026-01-10' }, { mat: '6', nome: 'FABI', lider: '' }];
  const L = lideresDasFichas(fichas, '2026-11-03');
  assert.deepEqual(L.map(x => [x.nome, x.ativos, x.desligados]), [['BRENO ALVES', 1, 0], ['BRENO ANDRADE', 2, 1], ['KAUAN', 1, 0]]);
  const r = trocarNasFichas(fichas, n => casaParte('breno andrade', n), 'Kauan');
  assert.deepEqual(r.mudou.map(x => x.mat), ['1', '2', '5']);
  assert.deepEqual(r.itens.map(x => x.lider), ['KAUAN', 'KAUAN', 'KAUAN', 'BRENO ALVES', 'KAUAN', '']);
  assert.equal(fichas[0].lider, 'Breno Andrade', 'não altera a lista original');

  const g = (nome, ...ps) => ({ nome, turno: false, pessoas: ps.map(n => ({ k: n, nome: n })) });
  const grupos = [g('GESTÃO', 'Z'), g('LIDER BRENO ANDRADE - SUPERVISÃO KAROL', 'B', 'A'), g('LIDER KAUAN SOUZA - SUPERVISÃO ANEILTON', 'C', 'A'), g('GÁS - LIDER BRENO ANDRADE - SUPERVISÃO KAROL', 'D')];
  const m = moverNaFolha(grupos, n => casaParte('breno andrade', n), 'KAUAN');
  assert.deepEqual(m.grupos.map(x => [x.nome, x.pessoas.map(p => p.nome).join('')]), [['GESTÃO', 'Z'], ['LIDER KAUAN SOUZA - SUPERVISÃO ANEILTON', 'ABC'], ['GÁS - LIDER KAUAN - SUPERVISÃO KAROL', 'D']],
    'sem repetir quem já estava no destino; GÁS ganha grupo novo com a supervisão do antigo');
  assert.deepEqual(m.acoes.map(a => [a.movidas, a.criado]), [[1, false], [1, true]]);
  assert.equal(grupos[1].pessoas.length, 2, 'não altera a lista original');
  const nada = moverNaFolha(grupos, n => casaParte('ninguem', n), 'KAUAN');
  assert.equal(nada.mudou, false); assert.equal(nada.grupos, grupos);
  // sem nenhum grupo do líder novo: cria no lugar do antigo
  const c = moverNaFolha([g('A'), g('LIDER BRENO ANDRADE - SUPERVISÃO KAROL', 'X'), g('B')], n => casaParte('breno andrade', n), 'Kauan Souza');
  assert.deepEqual(c.grupos.map(x => x.nome), ['A', 'LIDER KAUAN SOUZA - SUPERVISÃO KAROL', 'B']);
});
