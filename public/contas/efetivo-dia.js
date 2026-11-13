// Dikma Gestão — Efetivo do dia (sem tela): status do envio da presença por área e dia.
// O líder ou supervisor preenche a Presença e envia; o RH · Administrativo valida ou devolve (com motivo); o
// administrador reabre um dia validado. O dia abre sozinho (liberação automática): qualquer dia até hoje pode ser enviado.
// Documento: efetivoDia/{AAAA-MM-DD}_{ÁREA} (Bateria: b_efetivoDia) = { area, data, mes, st, por, nome, em, mot, hist[] }
//   st = enviado | validado | devolvido | aberto (reaberto) · por/nome/em = quem fez a última ação (em = hora do servidor)
//   mot = motivo da devolução · hist = [{ st, nome, em (ISO), mot }] (as últimas 60 ações, mais antiga primeiro)
// Sem documento: "Não enviado". Dias antes de EF_DESDE (quando a função entrou no ar): "Sem registro de envio".

export const EF_DESDE = '2026-11-13';
export const EF_HIST_MAX = 60;
export const EF_ST = {
  pendente: { nome: 'Não enviado', tom: 'atencao' },
  antigo: { nome: 'Sem registro de envio', tom: 'neutro' },
  aberto: { nome: 'Reaberto', tom: 'atencao' },
  enviado: { nome: 'Enviado, aguardando o RH', tom: 'info' },
  devolvido: { nome: 'Devolvido pelo RH', tom: 'critico' },
  validado: { nome: 'Validado pelo RH', tom: 'ok' }
};

// Horários dos avisos no celular (rotina de hora em hora, das 6h às 22h). O administrador muda em Avisos no celular
// (config/avisos.horas). efLider = cobra do líder o efetivo não enviado; efRH = avisa o RH do que espera validação.
export const HORAS_EF_PADRAO = { efLider: 9, efRH: 11 };
export const HORAS_AVISO = Array.from({ length: 17 }, (_, i) => i + 6);
export function horasEf(cfg) {
  const h = { ...HORAS_EF_PADRAO };
  for (const k of Object.keys(h)) { const v = Number(cfg && cfg.horas && cfg.horas[k]); if (HORAS_AVISO.includes(v)) h[k] = v; }
  return h;
}

export const idEf = (data, area) => `${data}_${area}`;

// Status mostrado: o do documento; sem documento, pendente (ou antigo, antes de EF_DESDE). Dia futuro: null.
export function estadoEf(doc, data, hoje) {
  if (data > hoje) return null;
  const st = doc && doc.st ? doc.st : data < EF_DESDE ? 'antigo' : 'pendente';
  return { st, ...EF_ST[st] };
}

// Quem pode fazer cada passo. quem = { lanca (preenche a presença da área), valida (RH · Administrativo ou admin), admin }
// enviar: quem lança, se o dia não está validado (vale reenviar depois de devolvido ou reaberto)
// validar e devolver: o RH, só o que foi enviado · reabrir: o administrador, só o validado
export function podeEf(acao, doc, quem = {}) {
  const st = (doc && doc.st) || '';
  if (acao === 'enviado') return !!quem.lanca && st !== 'validado';
  if (acao === 'validado' || acao === 'devolvido') return !!quem.valida && st === 'enviado';
  if (acao === 'aberto') return !!quem.admin && st === 'validado';
  return false;
}

// O dia está travado para quem preenche a Presença: validado pelo RH.
export const travadoEf = doc => !!doc && doc.st === 'validado';

// Documento novo depois da ação (sem a hora do servidor, que a camada de dados acrescenta em "em").
export function novoEf(doc, data, area, acao, quem, emISO, mot = '') {
  const m = acao === 'devolvido' ? String(mot || '').trim().slice(0, 300) : '';
  if (acao === 'devolvido' && !m) throw new Error('Escreva o motivo da devolução.');
  const hist = [...((doc && doc.hist) || []), { st: acao, nome: String(quem.nome || '').slice(0, 80), em: emISO, ...(m ? { mot: m } : {}) }].slice(-EF_HIST_MAX);
  return { area, data, mes: data.slice(0, 7), st: acao, por: quem.uid, nome: String(quem.nome || '').slice(0, 80), mot: m, hist };
}

// Última vez que a ação aconteceu (para "Enviado por X às 08:10").
export function ultimaEf(doc, acao) {
  const h = ((doc && doc.hist) || []).filter(x => x.st === acao);
  return h.length ? h[h.length - 1] : null;
}
export const horaEf = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)} às ${new Date(iso).toTimeString().slice(0, 5)}` : '');

// Linhas do quadro do RH num dia: cada área com gente na Presença, com o status. docs = { id: doc }
export function quadroEf(areas, docs, data, hoje) {
  return areas.map(a => { const doc = (docs || {})[idEf(data, a)] || null; return { area: a, doc, ...estadoEf(doc, data, hoje) }; }).filter(x => x.st);
}

// Aguardando o RH (enviados), do mais antigo para o mais novo. docs = { id: doc }
export const aguardandoEf = docs => Object.values(docs || {}).filter(d => d && d.st === 'enviado').sort((x, y) => x.data.localeCompare(y.data) || x.area.localeCompare(y.area));
