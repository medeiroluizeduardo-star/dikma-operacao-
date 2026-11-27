// Dikma Gestão — contas do cadastro do RH (sem tela), usadas por RH › Colaboradores (telas/colaboradores.js):
// unidade (Coqueria, Sinter, Alto Forno), cadastro completo, prazos da experiência (45 + 45 dias), desligamento com
// motivo e a linha do tempo da ficha (montada do que já existe: admissão, trocas de turma, férias e desligamento).

export const UNIDADES = ['Coqueria', 'Sinter', 'Alto Forno'];
const semAc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Unidade da pessoa: Sinter e Alto Forno pela área de atuação ou pela Área/Setor do RH; o resto é Coqueria.
export function unidadeDe(c, area = '') {
  const t = `${semAc(area)} | ${semAc(c && c.setor)} | ${semAc(c && c.subsetor)}`;
  if (/SINTER/.test(t)) return 'Sinter';
  if (/ALTO\s*FORNO/.test(t)) return 'Alto Forno';
  return 'Coqueria';
}

// Cadastro completo: o que falta na ficha (dados que o RH controla). extra = { lider } quando o líder vem de outro lugar.
export const CAMPOS_CADASTRO = [['matArc', 'Matrícula Arcelor'], ['adm', 'Admissão'], ['funcao', 'Função'], ['setor', 'Área (RH)'], ['turma', 'Turma / turno'], ['lider', 'Líder imediato']];
export function cadastroFalta(c) {
  return CAMPOS_CADASTRO.filter(([k]) => !String((c && c[k]) || '').trim()).map(([, t]) => t);
}
export const cadastroPct = c => Math.round(100 * (CAMPOS_CADASTRO.length - cadastroFalta(c).length) / CAMPOS_CADASTRO.length);

// Experiência: 1º período termina no 45º dia e o 2º no 90º (contando o dia da admissão).
const somar = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dias = (a, b) => Math.round((+new Date(b + 'T12:00:00') - +new Date(a + 'T12:00:00')) / 864e5);
export function experiencia(c, hoje) {
  if (!c || !c.adm || (c.dem && c.dem <= hoje)) return null;
  const fim1 = somar(c.adm, 44), fim2 = somar(c.adm, 89);
  if (fim2 < hoje) return null;
  const prox = fim1 >= hoje ? fim1 : fim2;
  return { fim1, fim2, prox, periodo: fim1 >= hoje ? 1 : 2, faltam: dias(hoje, prox) };
}
// Vence (1º ou 2º período) nos próximos dias.
export const experienciaVence = (c, hoje, n = 15) => { const e = experiencia(c, hoje); return !!e && e.faltam <= n; };

// Desligamento: motivo (gravado na ficha como demMot).
export const MOTIVOS_DEM = ['Pedido de demissão', 'Dispensa sem justa causa', 'Dispensa por justa causa', 'Fim do contrato de experiência', 'Fim do contrato / obra', 'Acordo entre as partes', 'Transferência', 'Outro'];
export const desligadoNoMes = (c, mes) => !!(c && c.dem && c.dem.slice(0, 7) === mes);
export const admitidoNoMes = (c, mes) => !!(c && c.adm && c.adm.slice(0, 7) === mes);

// Linha do tempo da ficha, do mais novo para o mais antigo: [{ data, t, d }].
// ferias = períodos da pessoa (contas/ferias.js); escHist = [{ ate, turma }] (o que valia antes de cada troca).
export function linhaDoTempo(c, ferias = [], hoje = '') {
  const ev = [];
  if (c.adm) ev.push({ data: c.adm, t: 'Admissão', d: [c.funcao, c.setor].filter(Boolean).join(' · ') });
  const ex = c.adm ? { fim1: somar(c.adm, 44), fim2: somar(c.adm, 89) } : null;
  if (ex && (!c.dem || c.dem > ex.fim2) && (!hoje || ex.fim2 <= hoje)) ev.push({ data: ex.fim2, t: 'Fim da experiência', d: '90 dias' });
  const h = (c.escHist || []).filter(x => x && x.ate).sort((a, b) => (a.ate < b.ate ? -1 : 1));
  h.forEach((x, i) => { const depois = h[i + 1] ? h[i + 1].turma : c.turma; ev.push({ data: somar(x.ate, 1), t: 'Troca de turma', d: `${x.turma || 'sem turma'} → ${depois || 'sem turma'}` }); });
  for (const f of ferias) if (f.inicio && !f.apagado && (!hoje || f.inicio <= hoje)) ev.push({ data: f.inicio, t: 'Férias', d: `${f.dias || ''} dias${f.retorno ? ', volta ' + f.retorno.slice(8, 10) + '/' + f.retorno.slice(5, 7) : ''}` });
  if (c.dem) ev.push({ data: c.dem, t: 'Desligamento', d: c.demMot || '' });
  return ev.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}
