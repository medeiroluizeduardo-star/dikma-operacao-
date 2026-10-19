// Dikma Gestão — cálculos do "Meu dia". Funções puras, usadas pela tela (navegador)
// e pela rotina de avisos no celular (GitHub Actions), para os dois mostrarem a mesma coisa.
import { add, weekOf, AUSENTE, AUSENCIA } from './cal.js';

const linha = (doc, i) => (doc.d ? doc.d[i] : ((doc.s && doc.s[doc.ids[i]]) || '_______'));
const diaSemana = data => (new Date(data + 'T12:00:00').getDay() + 6) % 7; // 0 = segunda

// Atividades de um conjunto (Pátio ou Bateria) nas áreas da pessoa.
// d = { areas[], plano[] (itens do plano), semanas {id: doc}, colabs[], sit (chave "id|data" → código), rotas[] (config), hoje }
// d.sitDe(c, data) opcional: situação considerando a escala de turno (folga automática da turma). Sem ela, só o que foi lançado.
export function resumoAtividades(d) {
  const sd = d.sitDe || ((c, dt) => d.sit[c.id + '|' + dt]);
  const PL = new Map(d.plano.map(p => [p.id, p]));
  const hoje = d.hoje, k = diaSemana(hoje), ini = weekOf(hoje);
  const amanha = add(hoje, 1), kA = diaSemana(amanha), iniA = weekOf(amanha);
  const porRota = new Map(); let P = 0, R = 0, N = 0, E = 0, atrasadas = 0;
  for (const area of d.areas) {
    const doc = d.semanas[area + '|' + ini];
    if (doc) doc.ids.forEach((pid, i) => {
      const c = linha(doc, i)[k]; if (!c || c === '_') return;
      const p = PL.get(pid); const rota = p ? p.rota : '—';
      const chave = area + '|' + rota; if (!porRota.has(chave)) porRota.set(chave, { area, rota, P: 0, R: 0, N: 0, E: 0, total: 0 });
      const x = porRota.get(chave); x.total++;
      if (c === 'P') { x.P++; P++; } else if (c === 'R') { x.R++; R++; } else if (c === 'N') { x.N++; N++; } else if (c === 'E') { x.E++; E++; }
    });
    for (const w of Object.values(d.semanas)) {
      if (w.area !== area) continue;
      if (w.ini > hoje) continue;
      const ds = [0, 1, 2, 3, 4, 5, 6].map(j => add(w.ini, j));
      w.ids.forEach((pid, i) => { const s = linha(w, i); for (let j = 0; j < 7; j++) if (s[j] === 'P' && ds[j] < hoje) atrasadas++; });
    }
  }
  // quem falta hoje
  const faltas = [];
  for (const c of d.colabs) { if (!d.areas.includes(c.area)) continue; const cod = d.sit[c.id + '|' + hoje]; if (cod && AUSENCIA.has(cod)) faltas.push({ nome: c.nome, funcao: c.funcao, area: c.area, rota: c.rota, cod }); }
  // déficit de efetivo amanhã (mesma conta da tela Escala e efetivo)
  const deficit = [];
  const docA = a => d.semanas[a + '|' + iniA];
  for (const r of d.rotas) {
    if (!d.areas.includes(r.area)) continue;
    const cs = d.colabs.filter(c => c.area === r.area && c.rota === r.rota);
    const aloc = cs.filter(c => sd(c, amanha) !== 'DS').length;
    const aus = cs.filter(c => { const v = sd(c, amanha); return v !== 'DS' && AUSENTE.has(v); }).length;
    const doc = docA(r.area); let prog = 0;
    if (doc) doc.ids.forEach((pid, i) => { const p = PL.get(pid); if (p && p.rota === r.rota && linha(doc, i)[kA] !== '_') prog++; });
    const nec = r.carga > 0 ? Math.ceil(r.ef * prog / r.carga * (d.fator ? d.fator(cs) : 1)) : 0;
    if (prog > 0 && aloc - aus < nec) deficit.push({ area: r.area, rota: r.rota, disp: aloc - aus, nec, prog });
  }
  const rotas = [...porRota.values()].sort((a, b) => b.P - a.P || a.rota.localeCompare(b.rota));
  return { hoje: { P, R, N, E, total: P + R + N + E }, rotas, atrasadas, faltas, deficit, amanha };
}

// Paradas de equipamento ainda sem liberação, com quantas horas estão abertas.
export function paradasAbertas(par, agora = new Date()) {
  return par.filter(p => !p.fim && p.data && p.ini).map(p => {
    const inicio = new Date(`${p.data}T${p.ini}:00`);
    return { ...p, horas: Math.max(0, (agora - inicio) / 36e5) };
  }).sort((a, b) => b.horas - a.horas);
}

// Ocorrências do Efetivo aguardando assinatura.
export function assinaturasPendentes(ocorr, hoje, dias = 7) {
  const pend = ocorr.filter(o => o.status === 'pendente');
  const limite = add(hoje, -dias);
  const velhas = pend.filter(o => o.data <= limite).sort((a, b) => (a.data < b.data ? -1 : 1));
  return { total: pend.length, velhas };
}

// Operadores fora hoje (férias, atestado etc.), pela situação do cadastro da Operação.
export function operadoresFora(operadores, hoje) {
  return operadores.filter(o => o.situacao && o.situacao !== 'TRABALHANDO' && !/DESLIG/i.test(o.situacao) && (!o.de || o.de <= hoje) && (!o.ate || o.ate >= hoje)).map(o => ({ nome: o.nome, cod: o.situacao }));
}

// Resumo de uma semana (segunda a domingo) nas áreas da pessoa: atividades e ausências lançadas.
// d = { areas[], semanas {id: doc}, colabs[], sit } · ini = segunda-feira da semana
export function resumoSemana(d, ini) {
  let R = 0, N = 0, P = 0, E = 0; const aus = {};
  for (const area of d.areas) {
    const doc = d.semanas[area + '|' + ini]; if (!doc) continue;
    doc.ids.forEach((_, i) => { for (const c of linha(doc, i)) { if (c === 'R') R++; else if (c === 'N') N++; else if (c === 'P') P++; else if (c === 'E') E++; } });
  }
  for (const c of d.colabs) {
    if (!d.areas.includes(c.area)) continue;
    for (let j = 0; j < 7; j++) { const v = d.sit[c.id + '|' + add(ini, j)]; if (v && ['FT', 'AT', 'AF', 'SP'].includes(v)) aus[v] = (aus[v] || 0) + 1; }
  }
  const prog = R + N + P;
  return { ini, fim: add(ini, 6), R, N, P, E, prog, pct: prog ? Math.round((R / prog) * 100) : null, aus };
}
