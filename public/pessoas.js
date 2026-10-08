// Dikma Operação — cadastro único de pessoas.
// O Efetivo (fichas) é o cadastro mestre (tem a matrícula). A área de atuação e a função
// definidas lá são gravadas também no Atividades Pátio (colaboradores/{ÁREA}) e na Operação
// (eq/cadastro.operadores). A ligação é pela matrícula e, na falta dela, pelo nome.
import { AREAS, AREA_S } from './cal.js';

export const AREA_GERAL = 'COQUERIA';
export const AREA_OP = 'OPERAÇÃO DE EQUIPAMENTOS';
export const REGIMES = ['ADMINISTRATIVO', 'TURNO 4X4'];
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

export function criarPessoas(DB) {
  const temPatio = () => !!DB.cache.config;
  const temOp = () => !!(DB.cache.e && DB.cache.e.config);
  const patio = () => AREAS.flatMap(a => DB.cache.colabs[a] || []);
  const ops = () => (temOp() && DB.cache.e.cad && DB.cache.e.cad.operadores) || [];
  const efetivo = () => (DB.cache.g && DB.cache.g.colabs) || [];
  const casa = (x, c) => !!x && !!c && ((x.mat && c.mat && String(x.mat) === String(c.mat)) || (!!x.nome && norm(x.nome) === norm(c.nome)));
  const rotasDe = area => ((DB.cache.config && DB.cache.config.rotas) || []).filter(r => r.area === area).map(r => r.rota);

  function vinculo(c) { return { patio: patio().find(x => casa(x, c)) || null, op: ops().find(x => casa(x, c)) || null }; }

  // Onde a pessoa está hoje, lido dos próprios módulos.
  function lotacao(c) {
    const v = vinculo(c);
    const area = v.patio ? v.patio.area : v.op ? AREA_OP : (c.area && c.area !== AREA_GERAL ? c.area : AREA_GERAL);
    const partes = [];
    if (v.patio) partes.push(`${AREA_S[v.patio.area] || v.patio.area} · ${v.patio.rota}`);
    if (v.op) partes.push('Operação de equipamentos');
    return { ...v, area, txt: partes.join(' + ') || areaNome(area) };
  }
  function areaNome(a) { return a === AREA_OP ? 'Operação de equipamentos' : !a || a === AREA_GERAL ? 'Coqueria (sem rota)' : 'Pátio · ' + (AREA_S[a] || a); }
  const areasAtuacao = () => [AREA_GERAL, ...(temPatio() ? AREAS : []), ...(temOp() ? [AREA_OP] : [])];

  function funcoes() {
    const s = new Set();
    patio().forEach(x => x.funcao && s.add(x.funcao));
    ((temOp() && DB.cache.e.config.funcoes) || []).forEach(f => s.add(f));
    efetivo().forEach(x => x.funcao && s.add(x.funcao));
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  function proximoId() {
    let m = 0; for (const x of patio()) { const n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > m) m = n; }
    return 'C' + String(m + 1).padStart(3, '0');
  }

  // antes: colaborador como estava (para achar os vínculos); c: como ficou.
  // o: { area, rota, regime, op: bool, escala, turma }
  function sincronizar(antes, c, o) {
    const ref = antes || c; const v = vinculo(ref); const tarefas = [];
    if (temPatio()) {
      const dentro = AREAS.includes(o.area);
      const base = v.patio || { id: proximoId(), regime: o.regime || 'ADMINISTRATIVO' };
      const novo = dentro ? { ...base, mat: c.mat, nome: c.nome, funcao: c.funcao || base.funcao || '', area: o.area, rota: o.rota || rotasDe(o.area)[0] || o.area, regime: o.regime || base.regime } : null;
      for (const a of AREAS) {
        const l = DB.cache.colabs[a] || [];
        const tinha = v.patio && v.patio.area === a;
        if (!tinha && !(novo && novo.area === a)) continue;
        let n = l.filter(x => !(v.patio && x.id === v.patio.id));
        if (novo && novo.area === a) { const i = l.findIndex(x => v.patio && x.id === v.patio.id); if (i >= 0) n.splice(Math.min(i, n.length), 0, novo); else n.push(novo); n = n.slice().sort((x, y) => x.nome.localeCompare(y.nome)); }
        DB.cache.colabs[a] = n; tarefas.push(DB.salvarColabsArea(a, n));
      }
    }
    if (temOp()) {
      const quer = o.op || o.area === AREA_OP;
      const lista = ops().slice();
      if (quer) {
        const novo = { ...(v.op || { nome: c.nome, fixo: true, situacao: 'TRABALHANDO', de: null, ate: null }), mat: c.mat, funcao: c.funcao || (v.op && v.op.funcao) || '', escala: o.escala || (v.op && v.op.escala) || 'ADM', turma: o.escala === '4x4' ? (o.turma || '') : '' };
        const i = lista.findIndex(x => x === v.op); if (i >= 0) lista[i] = novo; else lista.push(novo);
        tarefas.push(DB.eSalvarCad({ operadores: lista.sort((x, y) => x.nome.localeCompare(y.nome)) }));
      } else if (v.op) tarefas.push(DB.eSalvarCad({ operadores: lista.filter(x => x !== v.op) }));
    }
    // não espera o servidor: sem sinal, fica na fila e sobe quando a conexão voltar
    return Promise.all(tarefas);
  }

  // Mudança de função feita fora do Efetivo (ex.: tela de operador): leva para os outros módulos.
  function syncFuncao(pessoa, funcao) {
    const t = [];
    const g = efetivo(); const i = g.findIndex(x => casa(x, pessoa));
    if (i >= 0 && g[i].funcao !== funcao) { const n = g.slice(); n[i] = { ...g[i], funcao }; t.push(DB.gSalvarColabs(n)); }
    const ref = i >= 0 ? g[i] : pessoa;
    if (temPatio()) for (const a of AREAS) {
      const l = DB.cache.colabs[a] || []; const j = l.findIndex(x => casa(x, ref) || casa(x, pessoa));
      if (j >= 0 && l[j].funcao !== funcao) { const n = l.slice(); n[j] = { ...l[j], funcao }; DB.cache.colabs[a] = n; t.push(DB.salvarColabsArea(a, n)); }
    }
    return Promise.all(t);
  }

  return { vinculo, lotacao, areaNome, areasAtuacao, funcoes, rotasDe, sincronizar, syncFuncao, temPatio, temOp };
}
