// Dikma Operação — cadastro único de pessoas.
// O Efetivo (fichas) é o cadastro mestre (tem a matrícula). A área de atuação e a função
// definidas lá são gravadas também no Atividades Pátio (colaboradores/{ÁREA}), no Atividades Bateria
// (b_colaboradores/{ÁREA}) e na Operação (eq/cadastro.operadores). A ligação é pela matrícula e,
// na falta dela, pelo nome.
import { SETS, SET_KEYS, AREAS_ATIV, setDaArea, AREA_S } from './cal.js';

export const AREA_GERAL = 'COQUERIA';
export const AREA_OP = 'OPERAÇÃO DE EQUIPAMENTOS';
export const REGIMES = ['ADMINISTRATIVO', 'TURNO 4X4'];
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const ehAreaAtiv = a => AREAS_ATIV.includes(a);

export function criarPessoas(DB) {
  const st = k => DB.dados(k);
  const temSetDados = k => !!st(k).config;
  const temOp = () => !!(DB.cache.e && DB.cache.e.config);
  const ativ = () => SET_KEYS.flatMap(k => SETS[k].areas.flatMap(a => (st(k).colabs[a] || []).map(x => ({ set: k, x }))));
  const ops = () => (temOp() && DB.cache.e.cad && DB.cache.e.cad.operadores) || [];
  const efetivo = () => (DB.cache.g && DB.cache.g.colabs) || [];
  const casa = (x, c) => !!x && !!c && ((x.mat && c.mat && String(x.mat) === String(c.mat)) || (!!x.nome && norm(x.nome) === norm(c.nome)));
  const rotasDe = area => { const k = setDaArea(area); return k ? ((st(k).config && st(k).config.rotas) || []).filter(r => r.area === area).map(r => r.rota) : []; };

  // ativ = { set, x } onde x é o item em colaboradores/{ÁREA} do conjunto
  function vinculo(c) { const a = ativ().find(y => casa(y.x, c)) || null; return { ativ: a, patio: a ? a.x : null, op: ops().find(x => casa(x, c)) || null }; }

  // Onde a pessoa está hoje, lido dos próprios módulos.
  function lotacao(c) {
    const v = vinculo(c);
    const area = v.ativ ? v.ativ.x.area : v.op ? AREA_OP : (c.area && c.area !== AREA_GERAL ? c.area : AREA_GERAL);
    const partes = [];
    if (v.ativ) partes.push(`${SETS[v.ativ.set].curto} · ${AREA_S[v.ativ.x.area] || v.ativ.x.area} · ${v.ativ.x.rota}`);
    if (v.op) partes.push('Operação de equipamentos');
    return { ...v, area, txt: partes.join(' + ') || areaNome(area) };
  }
  function areaNome(a) {
    if (a === AREA_OP) return 'Operação de equipamentos';
    if (!a || a === AREA_GERAL) return 'Coqueria (sem rota)';
    const k = setDaArea(a); return k ? `${SETS[k].curto} · ${AREA_S[a] || a}` : a;
  }
  const areasAtuacao = () => [AREA_GERAL, ...SET_KEYS.filter(temSetDados).flatMap(k => SETS[k].areas), ...(temOp() ? [AREA_OP] : [])];
  // Grupos para o <select> de área de atuação
  const gruposArea = () => [['Geral', [AREA_GERAL]], ...SET_KEYS.filter(temSetDados).map(k => [SETS[k].nome, SETS[k].areas]), ...(temOp() ? [['Operação', [AREA_OP]]] : [])];

  function funcoes() {
    const s = new Set();
    ativ().forEach(y => y.x.funcao && s.add(y.x.funcao));
    ((temOp() && DB.cache.e.config.funcoes) || []).forEach(f => s.add(f));
    efetivo().forEach(x => x.funcao && s.add(x.funcao));
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  function proximoId(k) {
    let m = 0; for (const a of SETS[k].areas) for (const x of st(k).colabs[a] || []) { const n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > m) m = n; }
    return SETS[k].idp + String(m + 1).padStart(3, '0');
  }

  // Aplica a mudança nos dados locais e marca o que precisa ser gravado (sem gravar).
  // antes: colaborador como estava (para achar os vínculos); c: como ficou.
  // o: { area, rota, regime, op: bool, escala, turma }
  function aplicar(antes, c, o, sujo) {
    const v = vinculo(antes || c);
    const kNovo = setDaArea(o.area);
    if (v.ativ || kNovo) {
      const mesmoSet = v.ativ && v.ativ.set === kNovo;
      const base = mesmoSet ? v.ativ.x : { id: kNovo ? proximoId(kNovo) : null, regime: (v.ativ && v.ativ.x.regime) || 'ADMINISTRATIVO', funcao: v.ativ && v.ativ.x.funcao };
      const novo = kNovo && temSetDados(kNovo) ? { ...base, mat: c.mat, nome: c.nome, funcao: c.funcao || base.funcao || '', area: o.area, rota: o.rota || (mesmoSet && v.ativ.x.area === o.area ? v.ativ.x.rota : rotasDe(o.area)[0]) || o.area, regime: o.regime || base.regime || 'ADMINISTRATIVO' } : null;
      if (v.ativ) {
        const k = v.ativ.set, a = v.ativ.x.area;
        st(k).colabs[a] = (st(k).colabs[a] || []).filter(x => x.id !== v.ativ.x.id); sujo.add(k + '|' + a);
      }
      if (novo) {
        const l = (st(kNovo).colabs[o.area] || []).concat([novo]).sort((x, y) => x.nome.localeCompare(y.nome));
        st(kNovo).colabs[o.area] = l; sujo.add(kNovo + '|' + o.area);
      }
    }
    if (temOp()) {
      const quer = o.op || o.area === AREA_OP;
      const lista = ops().slice();
      if (quer) {
        const novo = { ...(v.op || { nome: c.nome, fixo: true, situacao: 'TRABALHANDO', de: null, ate: null }), mat: c.mat, funcao: c.funcao || (v.op && v.op.funcao) || '', escala: o.escala || (v.op && v.op.escala) || 'ADM', turma: (o.escala || (v.op && v.op.escala)) === '4x4' ? (o.turma || (v.op && v.op.turma) || '') : '' };
        const i = lista.findIndex(x => x === v.op); if (i >= 0) lista[i] = novo; else lista.push(novo);
        DB.cache.e.cad = { ...DB.cache.e.cad, operadores: lista.sort((x, y) => x.nome.localeCompare(y.nome)) }; sujo.add('op');
      } else if (v.op) { DB.cache.e.cad = { ...DB.cache.e.cad, operadores: lista.filter(x => x !== v.op) }; sujo.add('op'); }
    }
  }
  // Grava uma vez cada documento alterado. Não espera o servidor: sem sinal, fica na fila.
  function gravar(sujo) {
    const t = [];
    for (const s of sujo) {
      if (s === 'op') { t.push(DB.eSalvarCad({ operadores: DB.cache.e.cad.operadores })); continue; }
      const [k, a] = s.split('|'); t.push(DB.salvarColabsArea(a, st(k).colabs[a] || [], k));
    }
    return Promise.all(t);
  }
  function sincronizar(antes, c, o) { const sujo = new Set(); aplicar(antes, c, o, sujo); return gravar(sujo); }
  // Vários de uma vez (importação): [{ antes, c, o }]
  function sincronizarVarios(lista) { const sujo = new Set(); for (const x of lista) aplicar(x.antes, x.c, x.o, sujo); return gravar(sujo); }

  // Situação atual da pessoa nos módulos, no formato que sincronizar() recebe.
  function opcoesAtuais(c) {
    const L = lotacao(c);
    return { area: L.area, rota: L.ativ ? L.ativ.x.rota : '', regime: L.ativ ? L.ativ.x.regime : 'ADMINISTRATIVO', op: !!L.op, escala: L.op ? L.op.escala : 'ADM', turma: L.op ? L.op.turma : '' };
  }

  // Mudança de função feita fora do Efetivo (ex.: tela de operador): leva para os outros módulos.
  function syncFuncao(pessoa, funcao) {
    const t = [];
    const g = efetivo(); const i = g.findIndex(x => casa(x, pessoa));
    if (i >= 0 && g[i].funcao !== funcao) { const n = g.slice(); n[i] = { ...g[i], funcao }; t.push(DB.gSalvarColabs(n)); }
    const ref = i >= 0 ? g[i] : pessoa;
    for (const k of SET_KEYS) for (const a of SETS[k].areas) {
      const l = st(k).colabs[a] || []; const j = l.findIndex(x => casa(x, ref) || casa(x, pessoa));
      if (j >= 0 && l[j].funcao !== funcao) { const n = l.slice(); n[j] = { ...l[j], funcao }; st(k).colabs[a] = n; t.push(DB.salvarColabsArea(a, n, k)); }
    }
    return Promise.all(t);
  }

  // Pessoas que estão nos módulos de atividades ou na Operação e ainda não têm ficha no Efetivo.
  function semFicha() {
    const g = efetivo(); const out = [];
    for (const y of ativ()) if (!g.some(c => casa(y.x, c))) out.push({ nome: y.x.nome, funcao: y.x.funcao, area: y.x.area, rota: y.x.rota, regime: y.x.regime, onde: `${SETS[y.set].curto} · ${AREA_S[y.x.area]} · ${y.x.rota}` });
    for (const o of ops()) if (!g.some(c => casa(o, c)) && !out.some(p => norm(p.nome) === norm(o.nome))) out.push({ nome: o.nome, funcao: o.funcao, area: AREA_OP, op: true, escala: o.escala, turma: o.turma, onde: 'Operação de equipamentos' });
    return out.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  return { vinculo, lotacao, areaNome, areasAtuacao, gruposArea, funcoes, rotasDe, sincronizar, sincronizarVarios, opcoesAtuais, syncFuncao, semFicha, temOp, casa, temSetDados };
}
