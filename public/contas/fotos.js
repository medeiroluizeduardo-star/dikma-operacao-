// Dikma Gestão — FOTOS DAS ATIVIDADES: contas sem tela (as mesmas no navegador e nos testes do Node).
// O que está aqui: a configuração (config/fotos), quando uma situação exige foto, o contador do passo de fotos,
// as referências das células (refs), a contagem por célula guardada na semana (ft), o resumo para os indicadores
// e a estimativa de armazenamento. O modelo de dados completo está no topo de data.js e em docs/fotos-atividades.md.
import { add } from './cal.js';

// Configuração padrão (vale enquanto o administrador não salvar config/fotos).
// desde = a partir de que dia as realizadas sem foto contam como "sem foto" nos indicadores e no Meu dia.
// As atividades apontadas antes disso não pedem foto (não é retroativo).
export const FOTOS_DESDE_PADRAO = '2026-11-09';
// Máximo por tela: max = Atividades (Apontar), maxQZ = Queda zero, maxOM = Solicitações de OM (todas de 1 a MAX_FOTOS).
export const FOTOS_PADRAO = Object.freeze({ obrig: true, min: 1, max: 10, maxQZ: 2, maxOM: 2, situacoes: ['R', 'E'], desde: FOTOS_DESDE_PADRAO });
export const SITUACOES_FOTO = [['R', 'Realizada'], ['E', 'Extra (fora da programação)'], ['N', 'Não realizada']];
export const MAX_FOTOS = 10;      // teto do máximo por apontamento (as regras do banco conferem o mesmo)
export const MAX_REFS = 100;      // atividades que uma foto pode cobrir (Marcar restantes de uma rota)

// Tamanhos: a foto é reduzida no aparelho (JPEG, lado maior 1280 px, qualidade 0,7). Alvo de 150 KB; acima de
// 300 KB é recomprimida. A miniatura (240 px, até 15 KB) fica no documento leve; a foto completa, no arquivo.
// No banco as duas ficam como texto (data:image/jpeg;base64,…), que ocupa 4/3 do tamanho do arquivo.
export const IMG = Object.freeze({ lado: 1280, qualidade: 0.7, alvo: 150 * 1024, recomprimir: 300 * 1024, ladoMini: 240, qualidadeMini: 0.6, miniMax: 15 * 1024,
  thumbMaxCar: 40000, dadosMaxCar: 900000 });

// Lê a configuração gravada (ou nenhuma) e devolve sempre um objeto completo e válido.
export function cfgFotos(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const obrig = typeof r.obrig === 'boolean' ? r.obrig : FOTOS_PADRAO.obrig;
  const int = (v, d) => (Number.isInteger(v) ? v : Number.isInteger(+v) && v !== '' && v != null ? +v : d);
  let max = Math.min(MAX_FOTOS, Math.max(1, int(r.max, FOTOS_PADRAO.max)));
  let min = Math.max(obrig ? 1 : 0, Math.min(MAX_FOTOS, int(r.min, FOTOS_PADRAO.min)));
  if (max < min) max = min;
  const maxQZ = Math.min(MAX_FOTOS, Math.max(1, int(r.maxQZ, FOTOS_PADRAO.maxQZ)));
  const maxOM = Math.min(MAX_FOTOS, Math.max(1, int(r.maxOM, FOTOS_PADRAO.maxOM)));
  const situacoes = Array.isArray(r.situacoes) ? SITUACOES_FOTO.map(s => s[0]).filter(s => r.situacoes.includes(s)) : [...FOTOS_PADRAO.situacoes];
  const desde = typeof r.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.desde) ? r.desde : FOTOS_DESDE_PADRAO;
  return { obrig, min, max, maxQZ, maxOM, situacoes, desde };
}
// Confere o que o administrador digitou. Devolve a mensagem de erro, ou '' quando está tudo certo.
export function validarCfgFotos(c) {
  const ok = n => Number.isInteger(n);
  if (typeof c.obrig !== 'boolean') return 'Escolha se a foto é obrigatória.';
  if (!ok(c.min) || !ok(c.max)) return 'Mínimo e máximo precisam ser números inteiros.';
  if (c.obrig && c.min < 1) return 'Com a foto obrigatória, o mínimo é pelo menos 1.';
  if (c.min < 0) return 'O mínimo não pode ser negativo.';
  if (c.max < 1) return 'O máximo precisa ser pelo menos 1.';
  if (c.max < c.min) return 'O máximo não pode ser menor que o mínimo.';
  if (c.max > MAX_FOTOS) return `O máximo é de ${MAX_FOTOS} fotos por apontamento.`;
  for (const [k, nome] of [['maxQZ', 'Queda zero'], ['maxOM', 'OMs']]) if (c[k] != null && (!ok(c[k]) || c[k] < 1 || c[k] > MAX_FOTOS)) return `${nome}: o máximo vai de 1 a ${MAX_FOTOS} fotos.`;
  if (!Array.isArray(c.situacoes) || c.situacoes.some(s => !SITUACOES_FOTO.some(x => x[0] === s))) return 'Situação inválida.';
  if (c.obrig && !c.situacoes.length) return 'Marque pelo menos uma situação que exige foto (ou desligue a obrigação).';
  if (c.desde != null && !/^\d{4}-\d{2}-\d{2}$/.test(c.desde)) return 'Data de início inválida.';
  return '';
}

// A situação c (R, N ou E) exige foto? fp = a atividade foi incluída fora da programação: vale como extra
// (marcada como realizada, exige foto se Realizada OU Extra estiver marcada).
export function exigeFoto(cfg, c, fp = false) {
  if (!cfg || !cfg.obrig) return false;
  const s = cfg.situacoes || [];
  if (c === 'R') return s.includes('R') || (!!fp && s.includes('E'));
  if (c === 'E') return s.includes('E');
  if (c === 'N') return s.includes('N');
  return false;
}
// Quantas fotos ainda faltam para a célula que já tem `tem` fotos (as fotos continuam ligadas quando a situação muda).
export const faltamFotos = (cfg, tem = 0) => Math.max(0, (cfg ? cfg.min : 0) - (tem || 0));

// Contador do passo de fotos: "Fotos: 1 de 1 obrigatória · máximo 3".
// n = fotos escolhidas agora · tem = fotos que a célula já tinha · tom: falta (vermelho), parcial (âmbar), ok (verde), acima.
export function contador(cfg, n, tem = 0) {
  const min = cfg.obrig ? Math.max(0, cfg.min - tem) : 0, max = Math.max(0, cfg.max - tem);
  const tom = n > max ? 'acima' : n >= min ? 'ok' : n === 0 ? 'falta' : 'parcial';
  const ob = `obrigatória${min > 1 ? 's' : ''}`;
  const obr = !min ? `${n} (opcional)` : n <= min ? `${n} de ${min} ${ob}` : `${n} (${min} ${ob})`;
  const txt = `Fotos: ${obr} · máximo ${max}${tem ? ` · já tem ${tem}` : ''}`;
  return { min, max, tom, ok: n >= min && n <= max, txt, cabe: Math.max(0, max - n) };
}

// Referência de uma célula (atividade num dia): 'ÁREA|AAAA-MM-DD|PID|k'. A semana (id do documento) já tem um '|'.
export const refCel = (semana, pid, k) => `${semana}|${pid}|${k}`;
export function lerRef(ref) {
  const p = String(ref).split('|'); if (p.length < 4) return null;
  const k = +p.pop(); const pid = p.pop();
  return { semana: p.join('|'), pid, k };
}
// Incremento da contagem por célula (campo ft da semana: { 'PID|k': n }) para n fotos que valem para estas refs.
export function incrementosFt(refs, n) {
  const out = {};
  for (const r of refs) { const x = lerRef(r); if (!x) continue; const key = x.pid + '|' + x.k; out[key] = (out[key] || 0) + n; }
  return out;
}
// Fotos de uma célula: as do modelo novo (ft) e as antigas (ev, do código de evidências de antes).
export const fotosDaCel = (doc, pid, k) => ((doc && doc.ft && doc.ft[pid + '|' + k]) || 0) + ((doc && doc.ev && doc.ev[pid + '|' + k]) || 0);

// Documento leve (evidencias/{id}) de uma foto: os campos que o aparelho grava.
// o = { semana, area, conj, rota, dia, k, sit, itens: [{ pid, ativ, local }], img: { thumb, bytes, w, h, sha, nome }, por, porNome }
export function metaFoto(o) {
  const itens = o.itens.slice(0, MAX_REFS);
  const unicos = l => [...new Set(l.filter(Boolean))];
  const juntar = (l, max) => { const u = unicos(l); const t = u.length > 1 ? `${u.length} atividades: ${u.join('; ')}` : (u[0] || ''); return t.length > max ? t.slice(0, max - 1) + '…' : t; };
  return {
    refs: itens.map(x => refCel(o.semana, x.pid, o.k)),
    semana: o.semana, area: o.area, conj: o.conj || '', pid: itens[0] ? itens[0].pid : '', k: o.k,
    dia: o.dia, mes: o.dia.slice(0, 7), rota: o.rota || '', sit: o.sit || '',
    local: juntar(itens.map(x => x.local), 300), ativ: juntar(itens.map(x => x.ativ), 500),
    nome: String((o.img && o.img.nome) || 'foto.jpg').slice(0, 120), tipo: 'image/jpeg', tamanho: o.img.bytes, bytes: o.img.bytes, w: o.img.w, h: o.img.h, sha: o.img.sha || '',
    thumb: o.img.thumb, por: o.por, porNome: o.porNome || '',
    exportadoEm: null, exportLote: null, lixeiraEm: null, removidaEm: null
  };
}

// Células realizadas/extras (as situações que pedem foto) num período, com ou sem foto.
// semanas: { id: doc } (doc.d ou doc.s) · areas: lista ou null (todas) · de/ate: AAAA-MM-DD (inclusive) · cfg: cfgFotos()
// Só contam os dias a partir de cfg.desde (antes disso não se pedia foto) e até hoje.
const linha = (doc, i) => (doc.d ? doc.d[i] : ((doc.s && doc.s[doc.ids[i]]) || '_______'));
export function resumoFotos(semanas, { areas = null, de = '0000-00-00', ate, hoje, cfg, noPlano = null, lista = false }) {
  const c = cfg || cfgFotos(null); const ini = de > c.desde ? de : c.desde; const fim = ate && ate < hoje ? ate : hoje;
  const out = { total: 0, comFoto: 0, semFoto: 0, itens: lista ? [] : null, desde: c.desde };
  if (!c.situacoes.length) return out;
  for (const doc of Object.values(semanas || {})) {
    if (areas && !areas.includes(doc.area)) continue;
    if (add(doc.ini, 6) < ini || doc.ini > fim) continue;
    for (let k = 0; k < 7; k++) {
      const dt = add(doc.ini, k); if (dt < ini || dt > fim) continue;
      for (let i = 0; i < doc.ids.length; i++) {
        const s = linha(doc, i)[k]; if (s !== 'R' && s !== 'E' && s !== 'N') continue;
        const pid = doc.ids[i]; if (noPlano && !noPlano(pid)) continue;
        const fp = !!(doc.fp && doc.fp[pid + '|' + k]);
        if (!exigeFoto({ ...c, obrig: true }, s, fp)) continue;
        out.total++;
        if (fotosDaCel(doc, pid, k) > 0) out.comFoto++;
        else { out.semFoto++; if (lista) out.itens.push({ doc, i, k, dt, pid }); }
      }
    }
  }
  return out;
}

// Estimativa de armazenamento: média de apontamentos por dia (nas situações marcadas) dos últimos `dias` dias,
// vezes o mínimo de fotos. Cada foto guardada ocupa ~4/3 do arquivo (texto base64) mais a miniatura.
export const KB_FOTO = 120;      // JPEG médio de uma foto de celular reduzida a 1280 px
export const KB_MINI = 12;
export const kbGuardado = (kb = KB_FOTO, mini = KB_MINI) => Math.round((kb + mini) * 4 / 3);
export function estimativaFotos(listaSemanas, { hoje, dias = 14, cfg }) {
  const c = cfg || cfgFotos(null); const ini = add(hoje, -dias), fim = add(hoje, -1);
  let apont = 0;
  for (const semanas of listaSemanas) for (const doc of Object.values(semanas || {})) {
    if (add(doc.ini, 6) < ini || doc.ini > fim) continue;
    for (let k = 0; k < 7; k++) {
      const dt = add(doc.ini, k); if (dt < ini || dt > fim) continue;
      for (let i = 0; i < doc.ids.length; i++) { const s = linha(doc, i)[k]; if ((s === 'R' || s === 'E' || s === 'N') && exigeFoto({ ...c, obrig: true }, s, !!(doc.fp && doc.fp[doc.ids[i] + '|' + k]))) apont++; }
    }
  }
  const porDia = apont / dias; const fotosDia = Math.round(porDia * Math.max(1, c.min));
  const kb = kbGuardado(); const mbDia = fotosDia * kb / 1024;
  return { apontDia: Math.round(porDia), fotosDia, kbFoto: kb, mbDia, diasAte1GB: mbDia > 0 ? Math.floor(1024 / mbDia) : null };
}
