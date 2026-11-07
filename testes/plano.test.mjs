// Plano padrão → Programação já gerada (public/contas/planoaplica.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(raiz, 'testes', '.lib-plano'); fs.mkdirSync(lib, { recursive: true });
for (const f of ['planoaplica', 'cal', 'situacao', 'escala', 'acessos', 'planilhas-adm']) if (fs.existsSync(path.join(raiz, 'public', 'contas', f + '.js'))) fs.writeFileSync(path.join(lib, f + '.mjs'), fs.readFileSync(path.join(raiz, 'public', 'contas', f + '.js'), 'utf8').replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'"));
const { planoNasSemanas, resumoMudanca } = await import(path.join(lib, 'planoaplica.mjs'));

// semana de seg 02/11/2026 a dom 08/11/2026; hoje = qua 04/11
const sem = (s, extra = {}) => ({ id: 'REC|2026-11-02', area: 'REC', ini: '2026-11-02', ids: Object.keys(s), s, ...extra });
const hoje = '2026-11-04';

test('dia desmarcado: só a célula programada de hoje em diante sai; passado e apontadas ficam', () => {
  const m = planoNasSemanas([sem({ A: 'RRPPPPP' })], { id: 'A', dias: '1110111' }, { hoje });
  assert.equal(m.length, 1); assert.equal(m[0].linha, 'RRP_PPP'); assert.equal(m[0].n, 1);
  const m2 = planoNasSemanas([sem({ A: 'RRRPPPP' })], { id: 'A', dias: '1100000' }, { hoje });
  assert.equal(m2[0].linha, 'RRR____', 'a realizada de qua (hoje) fica; o resto sai');
});
test('dia marcado: célula vazia de hoje em diante vira programada, menos feriado, dispensada ou fora da programação', () => {
  const m = planoNasSemanas([sem({ A: 'RR_____' }, { fe: { 'A|5': 'Feriado X' }, dx: { 'A|6': '2026-11-01' } })], { id: 'A', dias: '1111111' }, { hoje, fer: new Map([['2026-11-06', 'Feriado']]) });
  assert.equal(m[0].linha, 'RRPP___', 'qua (hoje) e qui viram P; sex é feriado; sáb marcado fe; dom dispensado');
});
test('atividade tirada do plano: tudo o que falta sai', () => {
  const m = planoNasSemanas([sem({ A: 'RPPPPP_' })], { id: 'A', dias: '1111110', ativo: false }, { hoje });
  assert.equal(m[0].linha, 'RP_____');
});
test('atividade nova entra nas semanas geradas só de hoje em diante', () => {
  const m = planoNasSemanas([sem({ B: 'PPPPP__' })], { id: 'NOVA', dias: '1111100' }, { hoje });
  assert.equal(m.length, 1); assert.equal(m[0].novo, true); assert.equal(m[0].linha, '__PPP__');
});
test('nada a mudar: não devolve nada; resumo em texto', () => {
  assert.deepEqual(planoNasSemanas([sem({ A: 'RRPPPPP' })], { id: 'A', dias: '1111111' }, { hoje }), []);
  assert.equal(resumoMudanca([{ id: 'x', n: 2 }, { id: 'y', n: 1 }]), 'Programação ajustada: 3 dias em 2 semanas, de hoje em diante');
  assert.equal(resumoMudanca([]), '');
});
