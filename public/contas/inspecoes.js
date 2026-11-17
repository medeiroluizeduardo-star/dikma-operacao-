// Dikma Gestão — Segurança › Inspeções (vindas do Campo do Meu painel): inspeção de 5S, de segurança e de limpeza e
// qualidade da área, com OK / Não OK / Não se aplica em cada item e a nota (OK ÷ itens avaliados). Cada item "Não OK"
// vira uma anomalia na fila que já existe (Segurança › Anomalias), onde ganha responsável e prazo no acompanhamento.
// Sem tela e sem banco: usado por telas/inspecoes.js e pelos testes. As regras do Firestore conferem o formato.
// A inspeção 5S do equipamento continua em Operação › Equipamentos › Inspeções.

// Os três tipos e os itens de cada um (os mesmos do Meu painel).
export const TIPOS_INSP = {
  s5: { nome: '5S', itens: ['Utilização: só o necessário no local', 'Organização: cada coisa no seu lugar, identificada', 'Limpeza: área, equipamentos e drenos limpos', 'Padronização: sinalização e padrões visíveis', 'Disciplina: rotina de 5S sendo cumprida'] },
  seg: { nome: 'Segurança', itens: ['EPIs corretos e em bom estado', 'Área isolada e sinalizada quando necessário', 'Ferramentas e equipamentos em condição segura', 'Sem condição insegura (piso, escadas, guarda-corpo)', 'Permissão de trabalho e bloqueios em dia'] },
  area: { nome: 'Limpeza e qualidade da área', itens: ['Correias e passarelas sem acúmulo de material', 'Sem queda de material nas transferências', 'Drenagem e canaletas desobstruídas', 'Coleta seletiva e descarte corretos', 'Registro fotográfico feito'] }
};
export const RESP_INSP = [['ok', 'OK'], ['no', 'Não OK'], ['na', 'N/A']];
export const MAX_OBS_ITEM = 300;
export const nomeTipoInsp = t => (TIPOS_INSP[t] ? TIPOS_INSP[t].nome : 'Inspeção');
// Itens em branco de um tipo (inspeção nova).
export const itensNovos = tipo => (TIPOS_INSP[tipo] ? TIPOS_INSP[tipo].itens : []).map(t => ({ t, r: '', obs: '' }));

// Nota: itens OK ÷ itens avaliados (OK + Não OK), de 0 a 100. N/A não conta. Sem item avaliado = null.
export function notaInsp(itens) {
  const l = Array.isArray(itens) ? itens : [];
  const ok = l.filter(i => i && i.r === 'ok').length, no = l.filter(i => i && i.r === 'no').length;
  return ok + no ? Math.round(ok / (ok + no) * 100) : null;
}
// Faixa da nota (cor): ≥ 90 bom, ≥ 70 atenção, abaixo disso ruim.
export const faixaNota = n => (n == null ? 'neu' : n >= 90 ? 'ok' : n >= 70 ? 'warn' : 'bad');
export const naoOk = itens => (Array.isArray(itens) ? itens : []).filter(i => i && i.r === 'no');
// Itens "Não OK" que ainda não viraram anomalia.
export const semAnomalia = itens => naoOk(itens).filter(i => !i.anom);

// O que falta para salvar (mensagens para a tela). insp = { tipo, data, area, local, itens }.
export function faltaInsp(insp, hoje) {
  const f = [];
  const x = insp || {};
  if (!TIPOS_INSP[x.tipo]) f.push('Escolha o tipo de inspeção.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data || '')) f.push('Preencha a data.');
  else if (hoje && x.data > hoje) f.push('A data não pode ser no futuro.');
  if (!String(x.area || '').trim()) f.push('Escolha a área.');
  if (!String(x.local || '').trim()) f.push('Preencha o local.');
  const l = Array.isArray(x.itens) ? x.itens : [];
  const sem = l.filter(i => !['ok', 'no', 'na'].includes(i.r)).length;
  if (sem) f.push(sem === 1 ? 'Falta responder 1 item.' : `Faltam responder ${sem} itens.`);
  const semObs = l.filter(i => i.r === 'no' && !String(i.obs || '').trim()).length;
  if (semObs) f.push(semObs === 1 ? 'Diga o que está fora do padrão no item Não OK.' : `Diga o que está fora do padrão nos ${semObs} itens Não OK.`);
  return f;
}

// Anomalia (o mesmo formato do formulário de anomalia, coleção seganom) para um item "Não OK".
// extra = { hora, regime, comunic, mat }. O responsável e o prazo são definidos depois, no acompanhamento.
export function anomDaInsp(insp, item, extra = {}) {
  const t = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const nome = nomeTipoInsp(insp.tipo);
  return {
    data: insp.data, hora: extra.hora, mes: insp.data.slice(0, 7), area: insp.area, conj: insp.conj || '', local: t(insp.local, 120).toUpperCase(),
    regime: t(extra.regime, 40),
    desc: t(`${item.obs} (inspeção de ${nome}: ${item.t})`, 3000),
    conseq: t(`Item fora do padrão na inspeção de ${nome}: ${item.t}.`, 3000),
    acao: 'Registrada na inspeção. A ação é definida no acompanhamento da anomalia.',
    causas: 'A levantar no acompanhamento.',
    sugest: t(`Voltar ao padrão: ${item.t}.`, 3000),
    comunic: t(extra.comunic, 120) || 'INSPEÇÃO', mat: t(extra.mat, 30),
    status: 'aberta', insp: insp.id || ''
  };
}

// Números do mês para a tela: quantas inspeções, a nota média (geral e por tipo), itens Não OK e anomalias geradas.
export function resumoInsp(lista, mes) {
  const l = (Array.isArray(lista) ? lista : []).filter(x => x && (!mes || x.mes === mes));
  const media = xs => { const v = xs.map(x => notaInsp(x.itens)).filter(n => n != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const porTipo = {};
  for (const k of Object.keys(TIPOS_INSP)) { const d = l.filter(x => x.tipo === k); porTipo[k] = { n: d.length, media: media(d) }; }
  const nos = l.flatMap(x => naoOk(x.itens));
  return { n: l.length, media: media(l), porTipo, naoOk: nos.length, anomalias: nos.filter(i => i.anom).length };
}
