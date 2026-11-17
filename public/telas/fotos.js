// Fotos das atividades (telas): passo de fotos antes de concluir o apontamento, fotos de uma atividade (miniaturas e
// foto grande), selo 📷 nas listas e a configuração (Administração › Fotos das atividades, só o administrador).
// As contas ficam em fotos.js; a gravação (um lote só com o apontamento), em data.js › apontarComFotos.
import { DAYS, SETS, ddmm, setDaArea } from '../contas/cal.js';
import { DB, TODAY, esc, title, n0, $ } from '../nucleo/base.js';
import { ME, PL, UI, SK, canEdit, isAdmin, perfil, setsDe } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { sheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { reduzirFotoAtividade, verFotoGrande } from '../ui/fotos.js';
import { cfgFotos, contador, exigeFoto, fotosDaCel, metaFoto, validarCfgFotos, estimativaFotos, resumoFotos, SITUACOES_FOTO, MAX_FOTOS, MAX_REFS, FOTOS_DESDE_PADRAO } from '../contas/fotos.js';
import { gravarApont, diasDe } from '../calc/atividades.js';
import { statusFoto, STATUS } from '../contas/fotos-arquivo.js';

// Configuração em vigor (config/fotos ou o padrão).
export const cfgF = () => cfgFotos(DB.cache.fotosCfg);
const fpDe = (doc, pid, k) => !!(doc.fp && doc.fp[pid + '|' + k]);
// A célula precisa do passo de fotos ao receber a situação v? (só quem aponta; as fotos que já tem contam)
export function precisaFotos(doc, i, k, v) {
  const cfg = cfgF(); const pid = doc.ids[i];
  if (!exigeFoto(cfg, v, fpDe(doc, pid, k))) return false;
  if (doc.d[i][k] === v) return false; // mesma situação (ex.: só trocar a justificativa)
  return fotosDaCel(doc, pid, k) < cfg.min;
}

// Fotos prontas para gravar: [{ meta, dados }]. Cada foto vale para todas as células `is` (mesmo dia e rota);
// com mais de 100 atividades, a foto é repetida em partes de 100 (limite de refs).
export function montarFotos(doc, k, is, imgs, sit) {
  const itens = is.map(i => { const p = PL.get(doc.ids[i]) || {}; return { pid: doc.ids[i], ativ: p.ativ || '', local: p.local || '' }; });
  const p0 = PL.get(doc.ids[is[0]]) || {}; const out = [];
  for (const img of imgs) for (let a = 0; a < itens.length; a += MAX_REFS) {
    const meta = metaFoto({ semana: doc.id, area: doc.area, conj: setDaArea(doc.area) || SK, rota: p0.rota || '', dia: diasDe(doc)[k], k, sit, itens: itens.slice(a, a + MAX_REFS), img, por: ME.uid, porNome: ME.nome || ME.login || '' });
    delete meta.por; delete meta.porNome; // quem grava é o data.js (por = quem está logado)
    out.push({ meta, dados: img.dados });
  }
  return out;
}

/* ---------------- passo de fotos ---------------- */
// o = { titulo, sub, cfg ({ obrig, min, max }), tem (fotos que já tem), rotuloOk, aoConfirmar(imgs), aoCancelar() }
// A atividade só é marcada no Confirmar; Cancelar (ou fechar) não marca nada.
export function passoFotos(o) {
  const L = $('layer'); const imgs = []; let ocupado = 0;
  const cfg = o.cfg || cfgF(); const tem = o.tem || 0;
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet fotosheet" role="dialog" aria-modal="true" aria-label="${esc(o.titulo)}">
    <h3>${esc(o.titulo)}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}
    <p class="fcont" id="fCont" role="status" aria-live="polite"></p>
    <div class="sgfotos" id="fLista"></div>
    <div class="row-gap"><label class="btn fadd" for="fIn" id="fAdd">${I.cam} Tirar foto / escolher</label><label class="btn ghost sm" for="fInG" id="fAddG">Da galeria</label><span class="muted small" id="fProc" aria-live="polite"></span></div>
    <input type="file" id="fIn" accept="image/*" capture="environment" multiple hidden><input type="file" id="fInG" accept="image/*" multiple hidden>
    <p class="muted small m0">${o.lote ? `As mesmas fotos valem para as ${o.lote} atividades (ficam guardadas uma vez só). ` : ''}A foto é reduzida no aparelho e sobe com o apontamento; sem sinal, sobe quando a conexão voltar.</p>
    <p class="err" id="fErr" role="alert" hidden></p>
    <div class="row-gap"><button class="btn pri" type="button" id="fOk" disabled>${esc(o.rotuloOk || 'Confirmar')}</button><button class="btn" type="button" data-close>Cancelar</button></div>
  </div></div>`;
  const erro = t => { const e = $('fErr'); if (!e) return; e.textContent = t || ''; e.hidden = !t; };
  function pintar() {
    if (!$('fLista')) return;
    const c = contador(cfg, imgs.length, tem);
    const p = $('fCont'); p.textContent = c.txt; p.className = 'fcont ' + c.tom;
    $('fLista').innerHTML = imgs.map((f, i) => `<div class="sgfth"><img src="${f.thumb}" alt="Foto ${i + 1}"><button type="button" class="btn sm ghost" data-frm="${i}" aria-label="Remover a foto ${i + 1}">✕</button></div>`).join('') || '<p class="muted small m0">Nenhuma foto ainda.</p>';
    const cheio = c.cabe <= 0 || ocupado > 0;
    for (const id of ['fAdd', 'fAddG']) { const b = $(id); if (b) { b.classList.toggle('dis', cheio); b.setAttribute('aria-disabled', String(cheio)); } }
    for (const id of ['fIn', 'fInG']) { const b = $(id); if (b) b.disabled = cheio; }
    $('fOk').disabled = !c.ok || ocupado > 0;
    $('fProc').textContent = ocupado ? `Preparando ${ocupado} foto${ocupado > 1 ? 's' : ''}…` : '';
  }
  const kd = e => { if (e.key === 'Escape' && !document.querySelector('.sgfoto')) cancelar(); };
  const fechar = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  const cancelar = () => { fechar(); if (o.aoCancelar) o.aoCancelar(); };
  document.addEventListener('keydown', kd);
  $('scrim').onclick = e => {
    e.stopPropagation();
    if (e.target.id === 'scrim' || e.target.closest('[data-close]')) return cancelar();
    const rm = e.target.closest('[data-frm]'); if (rm) { imgs.splice(+rm.dataset.frm, 1); erro(''); pintar(); return; }
    if (e.target.closest('#fOk')) {
      const c = contador(cfg, imgs.length, tem);
      if (!c.ok) { erro(imgs.length > c.max ? `No máximo ${c.max} foto${c.max > 1 ? 's' : ''}.` : `Falta${c.min - imgs.length > 1 ? 'm' : ''} ${c.min - imgs.length} foto${c.min - imgs.length > 1 ? 's' : ''}.`); return; }
      fechar(); o.aoConfirmar(imgs.slice());
    }
  };
  const escolher = async ev => {
    const fs = [...(ev.target.files || [])]; ev.target.value = ''; if (!fs.length) return;
    const c = contador(cfg, imgs.length, tem); const cabe = Math.max(0, c.cabe - ocupado);
    if (fs.length > cabe) { erro(`No máximo ${c.max} foto${c.max > 1 ? 's' : ''}: ${fs.length - cabe === 1 ? '1 foto não entrou' : `${fs.length - cabe} fotos não entraram`}.`); toast(`No máximo ${c.max} foto${c.max > 1 ? 's' : ''} por apontamento`); }
    else erro('');
    const usar = fs.slice(0, cabe); ocupado += usar.length; pintar();
    for (const f of usar) {
      try { const x = await reduzirFotoAtividade(f); if (x.sha && imgs.some(y => y.sha === x.sha)) toast('Esta foto já foi escolhida'); else imgs.push(x); }
      catch (err) { toast(err.message || 'Não foi possível usar esta foto'); }
      ocupado--; if (!$('fLista')) return; pintar();
    }
  };
  $('fIn').addEventListener('change', escolher); $('fInG').addEventListener('change', escolher);
  pintar();
  const a = $('fAdd'); if (a) a.focus();
}
// Passo de fotos de uma atividade (sit = situação que vai receber).
export function passoFotosCel(doc, i, k, sit, ok, cancelar) {
  const p = PL.get(doc.ids[i]) || {}; const cfg = cfgF(); const tem = fotosDaCel(doc, doc.ids[i], k);
  passoFotos({ titulo: 'Fotos da atividade', sub: `<b>${esc(p.ativ || doc.ids[i])}</b><br>${esc(p.rota || '')} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} · ${{ R: 'Realizada', N: 'Não realizada', E: 'Extra' }[sit] || ''}`, cfg, tem, rotuloOk: { R: 'Marcar como realizada', N: 'Marcar como não realizada', E: 'Registrar' }[sit] || 'Confirmar', aoConfirmar: ok, aoCancelar: cancelar });
}

/* ---------------- selo 📷 e fotos de uma atividade ---------------- */
// Selo da célula na lista: 📷n (abre as fotos) ou "sem foto" (discreto quando é de antes da regra).
export function seloFotos(doc, i, k) {
  const pid = doc.ids[i]; const n = fotosDaCel(doc, pid, k); const c = doc.d[i][k]; const ref = `${esc(doc.id)}|${i}|${k}`;
  if (n) return ` · <button type="button" class="fotob" data-act="verFotos" data-k="${ref}" aria-label="Ver ${n} foto${n > 1 ? 's' : ''}" title="Ver as fotos">${I.cam}<span class="num">${n}</span></button>`;
  if (!'RNE'.includes(c)) return '';
  const cfg = cfgF(); const pede = exigeFoto(cfg, c, fpDe(doc, pid, k)) && diasDe(doc)[k] >= cfg.desde;
  if (pede) return canEdit(doc.area) ? ` · <button type="button" class="fotob falta" data-act="verFotos" data-k="${ref}">sem foto · adicionar</button>` : ' · <span class="semfoto">sem foto</span>';
  // Foto não obrigatória aqui: quem aponta ainda pode juntar fotos, se quiser.
  if (canEdit(doc.area)) return ` · <button type="button" class="fotob" data-act="verFotos" data-k="${ref}" aria-label="Adicionar foto (opcional)" title="Foto opcional">${I.cam}<span>foto</span></button>`;
  if (cfg.obrig && exigeFoto(cfg, c, fpDe(doc, pid, k))) return ' · <span class="semfoto antiga" title="Apontada antes da foto obrigatória">sem foto</span>';
  return '';
}
const achar = ref => { const p = String(ref).split('|'); const k = +p.pop(), i = +p.pop(); const doc = DB.cache.semanas[p.join('|')]; return doc && doc.ids[i] ? { doc, i, k } : null; };
acoes.verFotos = (t, d) => { const x = achar(d.k); if (x) verFotosCel(x.doc, x.i, x.k); };
// Pode juntar fotos a um apontamento já feito (até o máximo): quem aponta na área.
const podeJuntar = (doc, i, k) => canEdit(doc.area) && 'RNE'.includes(doc.d[i][k]) && fotosDaCel(doc, doc.ids[i], k) < cfgF().max;
// Apagar foto (com confirmação): o administrador e o líder da área; o líder só a foto que ainda não foi exportada
// (a exportada faz parte do arquivo da empresa). As regras do banco conferem o mesmo.
const podeApagarFoto = (doc, x) => isAdmin() || (perfil('operacao') === 'lider' && canEdit(doc.area) && statusFoto(x) === 'banco');
export async function verFotosCel(doc, i, k) {
  const p = PL.get(doc.ids[i]) || {}; const L = $('layer'); const n = fotosDaCel(doc, doc.ids[i], k);
  const conj = setDaArea(doc.area) || SK; const juntar = podeJuntar(doc, i, k);
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet fotosheet" role="dialog" aria-modal="true" aria-label="Fotos da atividade"><h3>Fotos da atividade</h3><div class="sub"><b>${esc(p.ativ || doc.ids[i])}</b><br>${esc(p.rota || '')} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])}${n ? ` · ${n} foto${n > 1 ? 's' : ''}` : ''}</div>
    <div class="sgfotos fgrade" id="fVer"><p class="muted small m0">Carregando as fotos…</p></div><p class="muted small m0" id="fVerInfo"></p>
    <div class="fapagar" id="fApagar" hidden></div>
    <div class="row-gap">${juntar ? `<button class="btn" type="button" id="fJuntar">${I.cam} Adicionar foto</button>` : ''}<button class="btn" type="button" data-close>Fechar</button></div></div></div>`;
  const kd = e => { if (e.key === 'Escape' && !document.querySelector('.sgfoto')) fechar(); };
  const fechar = () => { L.innerHTML = ''; document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd);
  let lista = [];
  $('scrim').onclick = e => {
    e.stopPropagation();
    if (e.target.id === 'scrim' || e.target.closest('[data-close]')) return fechar();
    const f = e.target.closest('[data-fid]');
    if (f) {
      const x = lista.find(y => y.id === f.dataset.fid); if (!x) return;
      const st = statusFoto(x); const leg = `${title(x.porNome || '')} · ${x.at ? x.at.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}${(x.refs || []).length > 1 ? ` · vale para ${x.refs.length} atividades` : ''}`;
      // arquivada fora do banco: só a miniatura (a foto completa está no .zip do lote)
      if (st === 'arquivada') verFotoGrande(async () => x.thumb, x.thumb, 'Foto da atividade (miniatura)', `${leg} · ${STATUS.arquivada.t}${x.exportLote ? ` (lote ${x.exportLote})` : ''}: aparece só a miniatura`);
      else verFotoGrande(() => DB.abrirEvidencia(x.id, conj), x.thumb, 'Foto da atividade', `${leg}${st === 'exportada' ? ` · ${STATUS.exportada.t}${x.exportLote ? ` (lote ${x.exportLote})` : ''}` : ''}`);
      return;
    }
    if (e.target.closest('#fJuntar')) { fechar(); juntarFotos(doc, i, k); return; }
    const ap = e.target.closest('[data-apagar]');
    if (ap) {
      const x = lista.find(y => y.id === ap.dataset.apagar); if (!x) return;
      const varias = (x.refs || []).length > 1;
      $('fApagar').hidden = false;
      $('fApagar').innerHTML = `<p class="m0"><b>Apagar esta foto?</b> Ela sai do sistema e não dá para desfazer.${varias ? ` A foto vale para ${x.refs.length} atividades e sai de todas.` : ''}</p><div class="row-gap"><button class="btn perigo" type="button" data-sim="${esc(x.id)}">${I.lixo} Apagar a foto</button><button class="btn" type="button" data-nao>Cancelar</button></div>`;
      $('fApagar').scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-nao]')) { $('fApagar').hidden = true; return; }
    const sim = e.target.closest('[data-sim]');
    if (sim) {
      const x = lista.find(y => y.id === sim.dataset.sim); if (!x) return;
      sim.disabled = true; sim.textContent = 'Apagando…';
      DB.apagarFotoAtividade(x, conj).then(() => {
        DB.log(`${p.ativ || doc.ids[i]} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → foto apagada${(x.refs || []).length > 1 ? ` (valia para ${x.refs.length} atividades)` : ''}`, 'operacao');
        toast('Foto apagada'); fechar(); render();
      }).catch(() => { sim.disabled = false; sim.innerHTML = `${I.lixo} Apagar a foto`; toast('Não deu para apagar a foto agora. Confira o sinal e tente de novo.'); });
    }
  };
  try {
    lista = await DB.listarFotosCel(doc.id, doc.ids[i], k, conj);
    const v = $('fVer'); if (!v) return;
    // selo da situação da foto (Relatórios e arquivo de fotos): "No banco" só aparece para o administrador
    const selo = x => { const st = statusFoto(x); return st === 'banco' && !isAdmin() ? '' : `<span class="fstat ${st}">${esc(STATUS[st].c)}</span>`; };
    const btApagar = (x, j) => podeApagarFoto(doc, x) ? `<button type="button" class="btn sm danger fapb" data-apagar="${esc(x.id)}" aria-label="Apagar a foto ${j + 1}">${I.lixo} Apagar</button>` : '';
    v.innerHTML = lista.length ? lista.map((x, j) => `<div class="fcel"><button type="button" class="sgmini fmini${statusFoto(x) === 'arquivada' ? ' arq' : ''}" data-fid="${esc(x.id)}" aria-label="Abrir a foto ${j + 1} (${esc(STATUS[statusFoto(x)].t)})" title="${esc(STATUS[statusFoto(x)].d)}">${x.thumb ? `<img src="${x.thumb}" alt="">` : 'Ver'}${selo(x)}</button>${btApagar(x, j)}</div>`).join('') : `<p class="muted small m0">${n ? 'As fotos ainda não chegaram a este aparelho (sem sinal) ou estão na lixeira da administração.' : 'Nenhuma foto nesta atividade.'}</p>`;
    const comp = lista.filter(x => (x.refs || []).length > 1).length;
    const arq = lista.filter(x => statusFoto(x) === 'arquivada').length;
    $('fVerInfo').textContent = lista.length ? `Toque numa foto para ver grande.${comp ? ` ${comp === 1 ? 'Uma foto vale' : `${comp} fotos valem`} para várias atividades da rota.` : ''}${arq ? ` ${arq === 1 ? 'Uma foto foi arquivada' : `${arq} fotos foram arquivadas`} fora do banco (fica a miniatura).` : ''}` : '';
  } catch (err) { const v = $('fVer'); if (v) v.innerHTML = '<p class="muted small m0">Sem sinal: não deu para carregar as fotos agora.</p>'; }
}
// Juntar fotos a um apontamento já feito (ex.: realizada antes da regra, ou foto que faltou).
function juntarFotos(doc, i, k) {
  const cfg = cfgF(); const tem = fotosDaCel(doc, doc.ids[i], k); const sit = doc.d[i][k];
  passoFotos({ titulo: 'Adicionar foto', sub: `<b>${esc((PL.get(doc.ids[i]) || {}).ativ || '')}</b><br>${DAYS[k]} ${ddmm(diasDe(doc)[k])}`, cfg: { obrig: true, min: Math.max(tem + 1, cfg.min), max: cfg.max }, tem, rotuloOk: 'Salvar as fotos',
    aoConfirmar: imgs => { if (!canEdit(doc.area)) return toast('Seu perfil não pode apontar nesta área'); gravarApont(doc, [], montarFotos(doc, k, [i], imgs, sit)); DB.log(`${(PL.get(doc.ids[i]) || {}).ativ || doc.ids[i]} · ${DAYS[k]} ${ddmm(diasDe(doc)[k])} → ${imgs.length} foto${imgs.length > 1 ? 's' : ''} anexada${imgs.length > 1 ? 's' : ''}`, 'operacao'); toast(imgs.length > 1 ? `${imgs.length} fotos salvas` : 'Foto salva'); render(); } });
}
// Fotos da atividade na semana (Programação): abre o primeiro dia com foto; os outros dias ficam no seletor.
acoes.verFotosSem = (t, d) => {
  const p = String(d.k).split('|'); const i = +p.pop(); const doc = DB.cache.semanas[p.join('|')]; if (!doc) return;
  const ks = DAYS.map((_, k) => k).filter(k => fotosDaCel(doc, doc.ids[i], k) > 0);
  if (ks.length === 1) return verFotosCel(doc, i, ks[0]);
  sheet((PL.get(doc.ids[i]) || {}).ativ || 'Fotos', 'Fotos da semana · escolha o dia', ks.map(k => { const n = fotosDaCel(doc, doc.ids[i], k); return { t: `${DAYS[k]} ${ddmm(diasDe(doc)[k])}`, d: `${n} foto${n > 1 ? 's' : ''}`, k }; }), o => verFotosCel(doc, i, o.k));
};
export const fotosSemana = (doc, i) => DAYS.reduce((n, _, k) => n + fotosDaCel(doc, doc.ids[i], k), 0);

/* ---------------- indicadores ---------------- */
// Atividades com foto no período (Painel de Atividades): realizadas/extras desde a regra.
export const indicadorFotos = (docs, areas) => resumoFotos(docs, { areas, hoje: TODAY, cfg: cfgF() });

/* ---------------- Administração › Fotos das atividades ---------------- */
const rascF = () => { if (!UI.fotoR) { const c = cfgF(); UI.fotoR = { ...c, situacoes: [...c.situacoes] }; } return UI.fotoR; };
function lerForm() {
  const R = rascF(); const v = id => ($(id) || {});
  if ($('cfFtObrig')) R.obrig = v('cfFtObrig').checked;
  if ($('cfFtMin')) R.min = v('cfFtMin').value === '' ? NaN : Number(v('cfFtMin').value);
  if ($('cfFtMax')) R.max = v('cfFtMax').value === '' ? NaN : Number(v('cfFtMax').value);
  if ($('cfFtDesde')) R.desde = v('cfFtDesde').value || R.desde;
  R.situacoes = SITUACOES_FOTO.map(s => s[0]).filter(s => { const c = $('cfFtSit' + s); return c ? c.checked : R.situacoes.includes(s); });
  return R;
}
function textoEstimativa(R) {
  const lista = setsDe(ME).map(k => DB.dados(k).semanas || {});
  const e = estimativaFotos(lista, { hoje: TODAY, dias: 14, cfg: { ...R, min: Number.isInteger(R.min) ? R.min : 1 } });
  if (!R.obrig) return 'Com a foto opcional, o armazenamento depende de quanto as equipes fotografarem.';
  if (!e.apontDia) return 'Sem apontamentos nos últimos 14 dias para estimar.';
  const mb = e.mbDia >= 10 ? n0(Math.round(e.mbDia)) : e.mbDia.toFixed(1).replace('.', ',');
  return `~${n0(e.fotosDia)} fotos/dia × ~${e.kbFoto} KB ≈ ${mb} MB/dia; o plano gratuito tem 1 GB${e.diasAte1GB != null ? ` (enche em ~${n0(e.diasAte1GB)} dias sem exportar e limpar)` : ''}. Média de ${n0(e.apontDia)} apontamentos/dia nos últimos 14 dias (${setsDe(ME).map(k => SETS[k].curto).join(' + ')}); com “Marcar restantes” uma foto vale para a rota toda e o uso cai.`;
}
export function vCfFotos() {
  if (!isAdmin()) return '<div class="card"><div class="empty">Só o administrador altera a configuração das fotos.</div></div>';
  const R = rascF(); const salvo = cfgF(); const raw = DB.cache.fotosCfg;
  const mudou = JSON.stringify([R.obrig, R.min, R.max, R.situacoes, R.desde]) !== JSON.stringify([salvo.obrig, salvo.min, salvo.max, salvo.situacoes, salvo.desde]);
  const erro = validarCfgFotos(R);
  return `<div class="card" id="cfFotos"><header><h2>Fotos das atividades</h2><p>Foto tirada no Apontar para comprovar a atividade. Vale para Pátio e Bateria.</p></header><div class="body stackcol">
    <label class="mchip"><input type="checkbox" id="cfFtObrig" ${R.obrig ? 'checked' : ''}><span><b>Foto obrigatória</b> ao apontar nas situações marcadas abaixo</span></label>
    <div class="form cffotos">
      <label class="sel"><span>Mínimo de fotos</span><input class="in num" type="number" id="cfFtMin" min="${R.obrig ? 1 : 0}" max="${MAX_FOTOS}" step="1" value="${Number.isFinite(R.min) ? R.min : ''}"></label>
      <label class="sel"><span>Máximo de fotos</span><input class="in num" type="number" id="cfFtMax" min="1" max="${MAX_FOTOS}" step="1" value="${Number.isFinite(R.max) ? R.max : ''}"></label>
      <label class="sel"><span>Contar "sem foto" a partir de</span><input class="in" type="date" id="cfFtDesde" value="${esc(R.desde)}"></label>
    </div>
    <fieldset class="cfsit"><legend>Situações que exigem foto</legend>${SITUACOES_FOTO.map(([s, t]) => `<label class="mchip"><input type="checkbox" id="cfFtSit${s}" ${R.situacoes.includes(s) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</fieldset>
    <p class="err m0" id="cfFtErr" role="alert"${erro ? '' : ' hidden'}>${esc(erro)}</p>
    <div class="cfest"><b>Efeito previsto no armazenamento</b><p class="m0 small" id="cfFtEst">${esc(textoEstimativa(R))}</p></div>
    <p class="muted small m0">As atividades apontadas antes da regra não pedem foto (aparecem com “sem foto” discreto). Uma foto pode valer para várias atividades do mesmo dia e rota (“Marcar restantes”). ${raw && raw.por ? `Última alteração: ${esc(title(raw.por))}.` : 'Ainda no padrão do sistema (obrigatória, 1 a 3 fotos, Realizada e Extra).'}</p>
    <div class="row-gap"><button class="btn pri" data-act="cfFotosSalvar" ${mudou && !erro ? '' : 'disabled'}>Salvar</button>${mudou ? '<button class="btn" data-act="cfFotosDesfazer">Desfazer</button>' : ''}<button class="btn ghost" data-act="cfFotosPadrao">Voltar ao padrão</button></div>
  </div></div>`;
}
// Atualiza só o erro, a estimativa e os botões enquanto digita (sem redesenhar a tela inteira).
function aoMexer(e) {
  if (!e.target.closest || !e.target.closest('#cfFotos')) return;
  const R = lerForm(); const er = validarCfgFotos(R); const p = $('cfFtErr'); if (p) { p.textContent = er; p.hidden = !er; }
  const est = $('cfFtEst'); if (est) est.textContent = textoEstimativa(R);
  const mn = $('cfFtMin'); if (mn) mn.min = R.obrig ? 1 : 0;
  const s = cfgF(); const mudou = JSON.stringify([R.obrig, R.min, R.max, R.situacoes, R.desde]) !== JSON.stringify([s.obrig, s.min, s.max, s.situacoes, s.desde]);
  const b = document.querySelector('[data-act="cfFotosSalvar"]'); if (b) b.disabled = !mudou || !!er;
}
document.addEventListener('input', aoMexer); document.addEventListener('change', aoMexer);
acoes.cfFotosSalvar = async () => {
  if (!isAdmin()) return toast('Só o administrador altera a configuração das fotos');
  const R = lerForm(); const er = validarCfgFotos(R); if (er) return toast(er);
  await DB.salvarCfgFotos(R);
  DB.log(`Fotos das atividades: ${R.obrig ? `obrigatória, ${R.min} a ${R.max} fotos (${R.situacoes.map(s => SITUACOES_FOTO.find(x => x[0] === s)[1]).join(', ')})` : `opcional, até ${R.max} fotos`}`, 'administracao');
  UI.fotoR = null; toast('Configuração das fotos salva'); render();
};
acoes.cfFotosDesfazer = () => { UI.fotoR = null; render(); };
acoes.cfFotosPadrao = () => { UI.fotoR = { ...cfgFotos(null), desde: cfgF().desde || FOTOS_DESDE_PADRAO }; render(); toast('Padrão carregado. Salve para aplicar'); };
