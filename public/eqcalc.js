// Cálculos do módulo Operação (controle de equipamentos).
// Reproduz as fórmulas da planilha CONTROLE DE EQUIPAMENTOS - COQUERIA (abas LANÇAMENTOS, PARADAS e CALC).
// Sem dependências: roda no navegador e no Node (usado para conferir os números com a planilha).

const toMin = h => { if (!h) return null; const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };
const pdate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addD = (s, n) => { const d = pdate(s); d.setDate(d.getDate() + n); return isoD(d); };
const dow = s => pdate(s).getDay(); // 0 dom … 5 sex 6 sáb
const diffD = (a, b) => Math.round((pdate(b) - pdate(a)) / 864e5);
const r2 = x => Math.round(x * 100) / 100;
export const fimMes = ym => { const [y, m] = ym.split('-').map(Number); return isoD(new Date(y, m, 0)); };
export const STATUS_FORA = ['FORA DE OPERAÇÃO', 'EM MANUTENÇÃO'];
export const STATUS_HE = ['HORA EXTRA', 'HE NOTURNA'];
export const ITENS_5S = [['cab', 'Cabine limpa'], ['eqlimpo', 'Equipamento limpo'], ['soltos', 'Sem objetos soltos'], ['vaz', 'Sem vazamentos']];
export const ITENS_SEG = [['epi', 'Uso de EPI'], ['cinto', 'Cinto de segurança'], ['check', 'Checklist pré-uso'], ['sinal', 'Sinalização e velocidade'], ['ext', 'Extintor e emergência']];

// ext(o, data): situação vinda da Frequência / Efetivo diário / Férias (nome da situação, null = trabalhando,
// undefined = sem informação, usa a do cadastro).
export function criarCalc(cfg, cad, ext) {
  const T = cfg.turno;
  const opMap = new Map((cad.operadores || []).map(o => [o.nome, o]));
  const frotaMap = new Map((cad.frota || []).map(f => [f.id, f]));
  const causaResp = new Map((cfg.causas || []).map(c => [c.causa, c.resp]));
  const feriadosSemOp = new Set((cfg.feriados || []).filter(f => f.semOp).map(f => f.data));
  const escalaDe = op => ((opMap.get(op) || {}).escala === '4x4' ? '4x4' : 'ADM');
  const fimPadrao = (esc, data) => (esc === '4x4' ? T.x4Fim : dow(data) === 5 ? T.admFimSex : T.admFim);

  // Janela (horas previstas) de um lançamento — coluna JANELA H
  function janela(l) {
    const esc = escalaDe(l.op);
    const ini = toMin(l.ini || (esc === '4x4' ? T.x4Ini : T.admIni));
    const fim = toMin(l.fim || fimPadrao(esc, l.data));
    const dur = ((fim - ini) % 1440 + 1440) % 1440;
    if (esc === '4x4') return r2(Math.max(0, dur / 60 - (dur / 60 > 6 ? (T.x4Int || 0) : 0)));
    const alm = fim < ini ? 0 : Math.max(0, Math.min(fim, toMin(T.almFim)) - Math.max(ini, toMin(T.almIni)));
    return r2((dur - alm) / 60);
  }
  // Duração de uma parada — coluna DURAÇÃO H (vazio = até o fim do turno)
  function duracao(p) {
    if (!p.ini) return 0;
    const esc = escalaDe(p.op);
    const ini = toMin(p.ini), fim = toMin(p.fim || fimPadrao(esc, p.data));
    const dur = ((fim - ini) % 1440 + 1440) % 1440;
    if (esc === '4x4') return r2(dur / 60);
    const alm = fim < ini ? 0 : Math.max(0, Math.min(fim, toMin(T.almFim)) - Math.max(ini, toMin(T.almIni)));
    return r2((dur - alm) / 60);
  }
  const resp = p => causaResp.get(p.causa) || '';
  const situacao = p => (p.fim ? 'LIBERADO' : 'SEM LIBERAÇÃO');

  // 4x4: dia de trabalho se (dia − base) mod 8 < 4
  const trabalha4x4 = (turma, data) => { const b = (cfg.turmas || {})[turma]; if (!b) return null; return (((diffD(b, data) % 8) + 8) % 8) < 4; };
  const diaUtil = data => dow(data) >= 1 && dow(data) <= 5 && !feriadosSemOp.has(data);
  function contar(a, b, f) { let n = 0; if (a > b) return 0; for (let d = a; d <= b; d = addD(d, 1)) if (f(d)) n++; return n; }
  const diasUteis = (a, b) => contar(a, b, diaUtil);
  function diasPrevistosOp(o, a, b) {
    if (a > b) return 0;
    if ((o.escala || 'ADM') === '4x4') { if (!(cfg.turmas || {})[o.turma]) return Math.round((diffD(a, b) + 1) / 2); return contar(a, b, d => trabalha4x4(o.turma, d)); }
    return diasUteis(a, b);
  }
  const sitDesconta = s => { const x = (cfg.situacoes || []).find(z => z.sit === s); return x ? x.desconta : true; };
  function ausenteEm(o, data) {
    if (!o) return null;
    if (ext) { const x = ext(o, data); if (x !== undefined) return x; }
    if (!o.situacao || o.situacao === 'TRABALHANDO') return null;
    const de = o.de || '0000-01-01', ate = o.ate || '9999-12-31';
    return data >= de && data <= ate ? o.situacao : null;
  }
  function escalado(o, data) { // previsto para trabalhar na data (sem contar ausência)
    if (!o) return false;
    if ((o.escala || 'ADM') === '4x4') { const t = trabalha4x4(o.turma, data); return t === null ? true : t; }
    return diaUtil(data);
  }

  // Mês completo, no formato da aba CALC
  function mes(ym, lancTodos, parTodos, insp, aval, hoje) {
    const ini = ym + '-01', fim = fimMes(ym);
    const L = lancTodos.filter(l => l.data >= ini && l.data <= fim);
    const P = parTodos.filter(p => p.data >= ini && p.data <= fim);
    const I = (insp || []).filter(x => x.data >= ini && x.data <= fim);
    const A = aval || {};
    // horas paradas de cada alocação (mesma data, equipamento e operador)
    const parKey = new Map();
    // Parada com substituição (p.subst): o operador seguiu em outro equipamento, então ela não tira horas dele —
    // continua contando contra a disponibilidade do equipamento parado.
    for (const p of parTodos) { if (p.subst) continue; const k = p.data + '|' + p.eq + '|' + p.op; if (!parKey.has(k)) parKey.set(k, []); parKey.get(k).push(p); }
    const linhas = L.map(l => {
      const jan = janela(l); const ps = parKey.get(l.data + '|' + l.eq + '|' + l.op) || [];
      const hpar = Math.min(jan, ps.reduce((s, p) => s + duracao(p), 0));
      return { ...l, escala: escalaDe(l.op), jan, hpar: r2(hpar), hoper: r2(Math.max(0, jan - hpar)), npar: ps.length };
    });
    const pars = P.map(p => ({ ...p, dur: duracao(p), resp: resp(p), situacao: situacao(p), tipo: (frotaMap.get(p.eq) || {}).tipo || '', escala: escalaDe(p.op) }));
    const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    const cnt = (arr, f) => arr.filter(f).length;
    const k = {};
    k.diasOperados = new Set(linhas.map(l => l.data)).size;
    k.aloc = linhas.length;
    k.final = cnt(linhas, l => l.status === 'OPERAÇÃO FINALIZADA');
    k.emOp = cnt(linhas, l => l.status === 'EM OPERAÇÃO');
    k.fora = cnt(linhas, l => l.status === 'FORA DE OPERAÇÃO');
    k.manut = cnt(linhas, l => l.status === 'EM MANUTENÇÃO');
    k.alocHE = cnt(linhas, l => STATUS_HE.includes(l.status));
    k.efet = k.aloc ? 1 - (k.fora + k.manut) / k.aloc : 0;
    k.hprev = sum(linhas, l => l.jan); k.hoper = sum(linhas, l => l.hoper); k.hparAloc = sum(linhas, l => l.hpar);
    k.nPar = cnt(pars, p => p.ini);
    k.parEq = cnt(pars, p => p.resp === 'EQUIPAMENTO'); k.hParEq = sum(pars.filter(p => p.resp === 'EQUIPAMENTO'), p => p.dur);
    k.disp = k.hprev ? Math.max(0, 1 - k.hParEq / k.hprev) : 0;
    k.mttr = k.parEq ? k.hParEq / k.parEq : 0; k.mtbf = k.parEq ? k.hoper / k.parEq : 0;
    k.semLib = cnt(pars, p => p.situacao === 'SEM LIBERAÇÃO');
    k.aprov = k.hprev ? k.hoper / k.hprev : 0;
    k.parOp = cnt(pars, p => p.resp === 'OPERADOR'); k.hParOp = sum(pars.filter(p => p.resp === 'OPERADOR'), p => p.dur);
    k.heH = sum(linhas, l => l.he); k.cobert = cnt(linhas, l => l.sub);
    const datas = lancTodos.map(l => l.data).sort();
    const jIni = datas.length ? (ini > datas[0] ? ini : datas[0]) : ini;
    const jFim = datas.length ? [fim, (hoje > datas[datas.length - 1] ? hoje : datas[datas.length - 1])].sort()[0] : addD(ini, -1);
    k.diasUteis = diasUteis(jIni, jFim);
    k.janela = [jIni, jFim];
    // por operador (CALC linhas 44+)
    const P_ = cfg.pesos, F_ = cfg.faixas;
    const ops = (cad.operadores || []).map(o => {
      const lo = linhas.filter(l => l.op === o.nome); const po = pars.filter(p => p.op === o.nome);
      const io = I.filter(x => x.op === o.nome); const av = A[o.nome] || {};
      const x = { o, aloc: lo.length, final: cnt(lo, l => l.status === 'OPERAÇÃO FINALIZADA'), he: cnt(lo, l => STATUS_HE.includes(l.status)), heh: sum(lo, l => l.he), cob: cnt(lo, l => l.sub),
        fora: cnt(lo, l => l.status === 'FORA DE OPERAÇÃO'), manut: cnt(lo, l => l.status === 'EM MANUTENÇÃO'), hprev: sum(lo, l => l.jan), hoper: sum(lo, l => l.hoper), hpar: sum(lo, l => l.hpar),
        hparOp: sum(po.filter(p => p.resp === 'OPERADOR'), p => p.dur), npar: cnt(po, p => p.ini), ninsp: io.length };
      // dias depois do desligamento não são previstos (nem contam como ausência)
      const desl = contar(jIni, jFim, d => ausenteEm(o, d) === 'DESLIGADO' && escalado(o, d));
      x.diasOp = Math.max(0, diasPrevistosOp(o, jIni, jFim) - desl);
      let ferd = 0;
      if (ext) ferd = contar(jIni, jFim, d => { const s = ausenteEm(o, d); return !!s && s !== 'DESLIGADO' && sitDesconta(s) && escalado(o, d); });
      else if (o.situacao && o.situacao !== 'TRABALHANDO' && o.situacao !== 'DESLIGADO' && sitDesconta(o.situacao)) {
        const a = [o.de || jIni, jIni].sort()[1], b = [o.ate || '9999-12-31', jFim].sort()[0];
        ferd = a > b ? 0 : diasPrevistosOp(o, a, b);
      }
      x.dprev = Math.max(0, x.diasOp - ferd);
      x.cobEsc = x.dprev ? Math.min(1, x.aloc / x.dprev) : 0;
      x.dispOp = x.hprev ? Math.max(0, 1 - x.hparOp / x.hprev) : 0;
      x.scProd = 100 * (x.dispOp * P_.pDisp + x.cobEsc * P_.pCob);
      const tem = c => av[c] !== undefined && av[c] !== '' && av[c] !== null;
      const i5 = io.map(z => z.p5s).filter(v => v != null), iS = io.map(z => z.pseg).filter(v => v != null);
      const media = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
      x.xProat = tem('proat') ? av.proat * 20 : P_.notaPadrao * 20;
      x.xS5 = i5.length ? media(i5) * 100 : tem('s5') ? av.s5 * 20 : P_.notaPadrao * 20;
      x.xSeg = iS.length ? media(iS) * 100 : tem('seg') ? av.seg * 20 : P_.notaPadrao * 20;
      // faltas e atestados: o que foi digitado na Avaliação; sem isso, o que está lançado na Frequência / Efetivo diário
      const vazio = c => av[c] === undefined || av[c] === '' || av[c] === null;
      const conta = nome => (ext ? contar(jIni, jFim, d => ext(o, d) === nome) : 0);
      x.faltas = vazio('faltas') ? conta('FALTA') : +av.faltas || 0; x.atrasos = +av.atrasos || 0; x.atest = vazio('atest') ? conta('ATESTADO MÉDICO') : +av.atest || 0;
      x.xF = Math.max(0, 100 - x.faltas * P_.ptsFalta); x.xA = Math.max(0, 100 - x.atrasos * P_.ptsAtraso); x.xT = Math.max(0, 100 - x.atest * P_.ptsAtest);
      x.pend = (tem('proat') ? 0 : 1) + (i5.length || tem('s5') ? 0 : 1) + (iS.length || tem('seg') ? 0 : 1);
      const algumaAval = ['proat', 's5', 'seg', 'faltas', 'atrasos', 'atest'].some(tem) || i5.length || iS.length;
      x.ranked = (P_.quem === 'SOMENTE FIXOS' && o.fixo === false) ? false : x.aloc > 0 ? true : x.dprev === 0 ? false : !!algumaAval;
      const somaP = P_.prod + P_.proat + P_.seg + P_.s5 + P_.faltas + P_.atrasos + P_.atest;
      x.nota = x.ranked && somaP ? (x.scProd * P_.prod + x.xProat * P_.proat + x.xSeg * P_.seg + x.xS5 * P_.s5 + x.xF * P_.faltas + x.xA * P_.atrasos + x.xT * P_.atest) / somaP : 0;
      x.classe = !x.ranked ? '' : x.nota >= F_.exc ? 'EXCELENTE' : x.nota >= F_.bom ? 'BOM' : x.nota >= F_.reg ? 'REGULAR' : 'ATENÇÃO';
      x.proatD = tem('proat') ? av.proat : null; x.s5D = i5.length ? media(i5) * 5 : tem('s5') ? av.s5 : null; x.segD = iS.length ? media(iS) * 5 : tem('seg') ? av.seg : null;
      return x;
    });
    const rk = ops.filter(x => x.ranked).sort((a, b) => b.nota - a.nota || b.hprev - a.hprev);
    rk.forEach((x, i) => { x.pos = i + 1; });
    k.opsAtivos = cnt(ops, x => x.aloc > 0);
    k.classificados = rk.length;
    k.notaMedia = rk.length ? rk.reduce((s, x) => s + x.nota, 0) / rk.length : 0;
    k.pendentes = cnt(rk, x => x.pend > 0);
    k.destaque = rk[0] || null;
    k.inspecoes = I.length;
    // causas (pareto) e equipamentos
    const porCausa = {};
    for (const p of pars) { if (!p.causa) continue; const c = porCausa[p.causa] || (porCausa[p.causa] = { causa: p.causa, resp: p.resp, qtd: 0, horas: 0 }); c.qtd++; c.horas += p.dur; }
    const totH = Object.values(porCausa).reduce((s, c) => s + c.horas, 0); let ac = 0;
    k.pareto = Object.values(porCausa).sort((a, b) => b.horas - a.horas).map(c => { const pc = totH ? c.horas / totH : 0; ac += pc; return { ...c, pc, ac }; });
    const ids = new Set([...(cad.frota || []).map(f => f.id), ...linhas.map(l => l.eq)]);
    k.equip = [...ids].map(id => {
      const le = linhas.filter(l => l.eq === id), pe = pars.filter(p => p.eq === id && p.resp === 'EQUIPAMENTO');
      const hprev = sum(le, l => l.jan), hpe = sum(pe, p => p.dur);
      const rep = {}; for (const p of pe) rep[p.causa] = (rep[p.causa] || 0) + 1;
      const maxRep = Math.max(0, ...Object.values(rep)); const causaRep = Object.keys(rep).find(c => rep[c] === maxRep);
      return { id, tipo: (frotaMap.get(id) || {}).tipo || (le[0] || {}).tipo || '', aloc: le.length, hprev, npar: pe.length, hpar: hpe, disp: hprev ? Math.max(0, 1 - hpe / hprev) : 0, maxRep, causaRep: maxRep >= cfg.metas.reinRep ? causaRep : '', reincidente: pe.length >= cfg.metas.reinFalhas || maxRep >= cfg.metas.reinRep };
    });
    k.reincidentes = cnt(k.equip, e => e.reincidente);
    k.equipUsados = cnt(k.equip, e => e.aloc > 0);
    // por dia
    k.porDia = []; for (let d = ini; d <= fim; d = addD(d, 1)) { const ld = linhas.filter(l => l.data === d); k.porDia.push({ data: d, aloc: ld.length, hoper: sum(ld, l => l.hoper), hpar: sum(ld, l => l.hpar) }); }
    return { k, linhas, pars, ops, rk };
  }

  // Semáforo: 1 verde, 2 amarelo, 3 vermelho (CALC!H6:H13)
  function semaforo(k) {
    const M = cfg.metas, t = M.tol; const s = {};
    if (!k.aloc) return { disp: 0, efet: 0, aprov: 0, mttr: 0, mtbf: 0, semlib: 0, parop: 0, nota: 0 };
    const maior = (v, m) => (v >= m ? 1 : v >= m * (1 - t) ? 2 : 3);
    s.disp = maior(k.disp, M.disp); s.efet = maior(k.efet, M.efet); s.aprov = maior(k.aprov, M.aprov);
    s.mttr = !k.parEq ? 1 : k.mttr <= M.mttr ? 1 : k.mttr <= M.mttr * (1 + t) ? 2 : 3;
    s.mtbf = !k.parEq ? 1 : maior(k.mtbf, M.mtbf);
    s.semlib = k.semLib <= M.semlib ? 1 : k.semLib <= M.semlib + 1 ? 2 : 3;
    s.parop = k.parOp <= M.parop ? 1 : k.parOp <= M.parop + 1 ? 2 : 3;
    s.nota = maior(k.notaMedia, M.nota);
    return s;
  }

  // Verificação de consistência (aba ANÁLISES)
  function alertas(lanc, par, hoje) {
    const out = [];
    const idsFrota = new Set((cad.frota || []).map(f => f.id));
    const vistos = new Map();
    for (const l of lanc) {
      if (!l.eq || !l.op || !l.status) out.push({ aba: 'Lançamentos', ref: l, tipo: 'INCOMPLETO' });
      else if (!idsFrota.has(l.eq)) out.push({ aba: 'Lançamentos', ref: l, tipo: 'IDENTIFICAÇÃO NÃO CADASTRADA NA FROTA' });
      const kd = l.data + '|' + l.eq + '|' + l.op; if (vistos.has(kd)) out.push({ aba: 'Lançamentos', ref: l, tipo: 'DUPLICADO' }); vistos.set(kd, 1);
      const o = opMap.get(l.op); if (o && ausenteEm(o, l.data) && !STATUS_HE.includes(l.status)) out.push({ aba: 'Lançamentos', ref: l, tipo: 'OPERADOR FORA DA ESCALA NA DATA' });
    }
    const lk = new Set(lanc.map(l => l.data + '|' + l.eq + '|' + l.op));
    for (const p of par) {
      const esc = escalaDe(p.op);
      if (!p.eq || !p.op || !p.ini) out.push({ aba: 'Paradas', ref: p, tipo: 'INCOMPLETO' });
      else if (!p.causa) out.push({ aba: 'Paradas', ref: p, tipo: 'SEM CAUSA' });
      else if (!lk.has(p.data + '|' + p.eq + '|' + p.op)) out.push({ aba: 'Paradas', ref: p, tipo: 'SEM LANÇAMENTO CORRESPONDENTE' });
      else if (esc !== '4x4' && p.fim && toMin(p.fim) < toMin(p.ini)) out.push({ aba: 'Paradas', ref: p, tipo: 'FIM ANTES DO INÍCIO' });
      else if (!p.fim && p.data < hoje) out.push({ aba: 'Paradas', ref: p, tipo: 'SEM LIBERAÇÃO — INFORMAR O FIM' });
    }
    return out;
  }

  return { janela, duracao, resp, situacao, escalaDe, mes, semaforo, alertas, ausenteEm, escalado, trabalha4x4, diaUtil, opMap, frotaMap };
}

// Conformidade de uma inspeção (C = conforme, NC = não conforme, NA = não se aplica)
export function conformidade(itens, lista) {
  const v = lista.map(([k]) => itens[k]).filter(x => x === 'C' || x === 'NC');
  return v.length ? v.filter(x => x === 'C').length / v.length : null;
}
