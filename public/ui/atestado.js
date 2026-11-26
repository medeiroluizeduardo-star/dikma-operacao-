// Dikma Gestão — formulário do atestado (Operação › Escala do dia e RH › Atestados). Contas em contas/atestados.js;
// banco em nucleo/data.js › atSalvar (atestados + atestadosFoto num lote só, sem esperar o sinal).
// Foto no mesmo padrão das fotos das atividades (ui/fotos.js › reduzirFotoAtividade: JPEG 1280 px, ~150 KB, miniatura
// de 240 px), mas guardada à parte: nunca entra no arquivo de fotos, no relatório fotográfico nem no PowerPoint.
// Dado de saúde (LGPD): os detalhes e a foto ficam só com o RH · Administrativo, o administrador e quem lançou.
import { TIPOS_AT, DECLARACAO, LIM, conferirAt, fimDe } from '../contas/atestados.js';
import { reduzirFotoAtividade, verFotoGrande } from './fotos.js';
import { formSheet, toast } from './janelas.js';
import { DB, TODAY, esc, title } from '../nucleo/base.js';
import { I } from './icones.js';

const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
const $ = id => /** @type {any} */ (document.getElementById(id));
export const AVISO_LGPD = 'Atestado é dado de saúde. Os detalhes e a foto ficam só com o RH, o administrador e quem lançou. Não escreva o CID nem a doença.';

// Registra quem abriu a foto (mesmo registro das fichas: Administração › LGPD › Quem abriu).
export function registrarVista(a) { if (DB.acessoFicha) DB.acessoFicha(String(a.mat || ('c:' + (a.cid || a.id))), a.nome || '', 'atestado'); }

// Abre a foto completa de um atestado (i = posição). rh = quem é do RH lê todas; os outros, as que eles puseram.
export async function abrirFotoAt(a, i, rh) {
  registrarVista(a);
  const mini = (a.minis || [])[i] || '';
  verFotoGrande(async () => { const l = await DB.atFotos(a.id, rh); const f = l[i] || l.find(x => x.ordem === i); return f ? f.dados : null; }, mini, 'Foto do atestado', `${title(a.nome || '')} · ${dBR(a.ini)}`);
}

// o = { c: { id, area, nome, mat }, conj, dt (1º dia sugerido), atual (atestado já lançado ou null), titulo,
//       aoSalvar(at, dias, diasAntes) depois de gravar, aoCancelar() }
export function abrirAtestado(o) {
  const a = o.atual || null; const c = o.c;
  const x = a || { tipo: TIPOS_AT[0], ini: o.dt || TODAY, emis: o.dt || TODAY, dias: 1, horas: null, obs: '', minis: [], nf: 0 };
  const tem = (a && a.nf) || 0; const cabe = Math.max(0, LIM.fotos - tem);
  const novas = []; let ocupado = 0;
  const html = `<div class="p-form at-form">
    <p class="aviso small m0" role="note">${esc(AVISO_LGPD)}</p>
    <label class="sel"><span>Tipo</span><select class="in" id="atTipo">${TIPOS_AT.map(t => `<option ${t === x.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <div class="row2"><label class="sel"><span>Primeiro dia</span><input class="in" type="date" id="atIni" value="${esc(x.ini)}"></label>
      <label class="sel"><span>Data de emissão</span><input class="in" type="date" id="atEmis" value="${esc(x.emis || x.ini)}" max="${TODAY}"></label></div>
    <div class="row2"><label class="sel at-dias"><span>Quantos dias</span><input class="in" type="number" id="atDias" min="1" max="${LIM.diasMax}" inputmode="numeric" value="${esc(x.dias || 1)}"></label>
      <label class="sel at-horas"><span>Horas (declaração)</span><input class="in" type="text" id="atHoras" inputmode="decimal" placeholder="Ex.: 3 ou 2,5" value="${x.horas != null ? esc(String(x.horas).replace('.', ',')) : ''}"></label></div>
    <p class="muted small m0" id="atAte" aria-live="polite"></p>
    <label class="sel"><span>Observação (opcional · sem CID e sem a doença)</span><textarea class="in" id="atObs" rows="2" maxlength="${LIM.obs}" placeholder="Ex.: entregou a cópia, o original fica com o RH">${esc(x.obs || '')}</textarea></label>
    <div class="at-fotos"><span class="ag-rot">Foto do atestado${cabe ? ` (até ${LIM.fotos})` : ''}</span>
      <div class="sgfotos" id="atLista"></div>
      ${cabe ? `<div class="row-gap"><label class="btn" for="atIn" id="atAdd">${I.cam} Tirar foto</label><label class="btn ghost sm" for="atInG">Da galeria</label><span class="muted small" id="atProc" aria-live="polite"></span></div>
      <input type="file" id="atIn" accept="image/*" capture="environment" hidden><input type="file" id="atInG" accept="image/*" multiple hidden>` : '<p class="muted small m0">Já tem o máximo de fotos. Para trocar, apague uma no atestado.</p>'}
      <p class="muted small m0">A foto é reduzida no aparelho e sobe com o atestado; sem sinal, sobe quando a conexão voltar. Fica fora do arquivo e dos relatórios de fotos.</p></div>
  </div>`;
  const sub = `${esc(title(c.nome))}${a ? ` · ${a.st === 'recusado' ? 'recusado pelo RH: corrija e salve de novo' : 'editar'}` : ''}`;
  formSheet(o.titulo || (a ? 'Atestado' : 'Lançar atestado'), sub, html, a ? 'Salvar' : 'Lançar atestado', async () => {
    if (ocupado) throw new Error('Espere a foto terminar de preparar.');
    const r = conferirAt({ tipo: $('atTipo').value, ini: $('atIni').value, emis: $('atEmis').value, dias: $('atDias').value, horas: $('atHoras').value, obs: $('atObs').value }, TODAY);
    if (!r.ok) throw new Error(r.erro);
    const it = r.item;
    const minis = [...((a && a.minis) || []), ...novas.map(f => f.thumb)].slice(0, LIM.fotos);
    const dados = { ...it, nf: minis.length, minis };
    const id = a ? a.id : DB.atNovoId();
    const fotos = novas.map((f, i) => ({ dados: f.dados, ordem: tem + i }));
    if (a) { if (a.st === 'recusado') Object.assign(dados, { st: 'conferir', motRec: '' }); }
    else Object.assign(dados, { conj: o.conj, area: c.area, cid: String(c.id || ''), mat: String(c.mat || ''), nome: String(c.nome || '').slice(0, LIM.nome), diaLanc: TODAY });
    const diasAntes = a ? { ini: a.ini, dias: a.dias } : null;
    DB.atSalvar(id, dados, !a, fotos).catch(e => toast(e && e.code === 'permission-denied' ? 'Sem permissão para gravar este atestado' : 'Não foi possível salvar o atestado agora'));
    DB.log(`Atestado ${a ? 'alterado' : 'lançado'}: ${title(c.nome)} · ${dBR(it.ini)}${it.dias > 1 ? ` a ${dBR(it.fim)}` : ''}${fotos.length ? ` · ${fotos.length} foto${fotos.length > 1 ? 's' : ''}` : ''}`, 'operacao'); // sem tipo nem observação (todos do módulo leem o histórico)
    if (!minis.length) toast('Atestado lançado sem foto · junte a foto depois em Justificativas › Atestados');
    if (o.aoSalvar) o.aoSalvar({ ...(a || {}), id, ...dados }, it, diasAntes);
  }, { cancelarTxt: 'Cancelar', aoCancelar: o.aoCancelar });
  const ajusta = () => {
    const decl = $('atTipo').value === DECLARACAO; const f = document.querySelector('.at-form'); if (!f) return;
    /** @type {any} */ (f.querySelector('.at-dias')).hidden = decl; /** @type {any} */ (f.querySelector('.at-horas')).hidden = !decl;
    const ini = $('atIni').value; const n = Math.max(1, Math.min(LIM.diasMax, Math.round(+$('atDias').value || 1)));
    $('atAte').textContent = !ini ? '' : decl ? `Vale só para ${dBR(ini)} (lança AT neste dia).` : n === 1 ? `AT só em ${dBR(ini)}.` : `AT de ${dBR(ini)} a ${dBR(fimDe(ini, n))} (${n} dias corridos), lançado sozinho na Escala do dia.`;
  };
  const pinta = () => {
    const box = $('atLista'); if (!box) return;
    const ant = ((a && a.minis) || []).map((m, i) => `<div class="sgfth"><img src="${m}" alt="Foto ${i + 1} do atestado" data-atver="${i}" tabindex="0" role="button"></div>`);
    box.innerHTML = [...ant, ...novas.map((f, i) => `<div class="sgfth"><img src="${f.thumb}" alt="Foto nova ${i + 1}"><button type="button" class="btn sm ghost" data-atrm="${i}" aria-label="Tirar a foto nova ${i + 1}">✕</button></div>`)].join('');
    const cheio = tem + novas.length >= LIM.fotos || ocupado > 0;
    for (const id of ['atIn', 'atInG']) { const b = $(id); if (b) b.disabled = cheio; }
    const ad = $('atAdd'); if (ad) { ad.classList.toggle('dis', cheio); ad.setAttribute('aria-disabled', String(cheio)); }
    const p = $('atProc'); if (p) p.textContent = ocupado ? 'Preparando a foto…' : '';
  };
  const lerArq = async files => {
    for (const file of [...files]) {
      if (tem + novas.length + ocupado >= LIM.fotos) break;
      ocupado++; pinta();
      try { novas.push(await reduzirFotoAtividade(file)); } catch (e) { toast((e && e.message) || 'Não foi possível abrir esta imagem.'); }
      ocupado--; pinta();
    }
  };
  for (const id of ['atIn', 'atInG']) { const el = $(id); if (el) el.addEventListener('change', e => { const t = /** @type {any} */ (e.target); lerArq(t.files || []); t.value = ''; }); }
  const f = $('fSheet');
  if (f) f.addEventListener('click', e => {
    const t = /** @type {any} */ (e.target);
    const rm = t.closest('[data-atrm]'); if (rm) { novas.splice(+rm.dataset.atrm, 1); pinta(); return; }
    const v = t.closest('[data-atver]'); if (v && a) abrirFotoAt(a, +v.dataset.atver, !!o.rh);
  });
  for (const id of ['atTipo', 'atIni', 'atDias']) { const el = $(id); if (el) el.addEventListener('input', ajusta); }
  ajusta(); pinta();
}
