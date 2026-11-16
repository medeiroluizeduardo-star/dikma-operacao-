// Dikma Gestão — lançar a presença de uma pessoa num dia. O MESMO jeito na Frequência (Administrativo)
// e no Efetivo diário (Operação): toque no dia → escolha a situação → escolha até quando vale.
// Quem chama decide onde grava (situacao, folha) e o que vem depois (substituto, hora extra).
import { NOMES_CODIGO, CODIGOS_LANC, JUS_CODS } from '../contas/situacao.js';

const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dBR = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const ddmm = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const diaSem = s => DIA[new Date(s + 'T12:00:00').getDay()];
const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Justificativa de ausências e atrasos: o mesmo jeito no Efetivo diário e na Frequência.
// Situações que podem ser lançadas e as que pedem justificativa: saem da tabela única (situacao.js).
export { CODIGOS_LANC, JUS_CODS };
export const MOTIVOS_JUS = {
  FT: ['Sem justificativa', 'Problema de saúde', 'Problema familiar', 'Transporte', 'Compromisso pessoal', 'Outro'],
  SA: ['Problema de saúde', 'Consulta ou exame médico', 'Problema familiar', 'Liberado pela liderança', 'Compromisso pessoal', 'Sem justificativa', 'Outro'],
  ATR: ['Transporte / ônibus', 'Trânsito', 'Problema de saúde', 'Problema familiar', 'Compromisso pessoal', 'Sem justificativa', 'Outro'],
  AT: ['Atestado médico', 'Atestado odontológico', 'Acompanhamento de familiar', 'Declaração de comparecimento', 'Outro'],
  AF: ['Auxílio-doença (INSS)', 'Acidente de trabalho', 'Licença maternidade / paternidade', 'Outro'],
  AB: ['Abono do gestor', 'Banco de horas', 'Doação de sangue', 'Outro'],
  SP: ['Medida disciplinar', 'Outro'],
  TR: ['Integração', 'NR / segurança', 'Treinamento operacional', 'Outro']
};
// Texto curto: "Trânsito · chegou às 07:40 (40 min) · ônibus quebrou"
export const textoJus = j => (j && j.mot ? [j.mot, j.chegada ? `chegou às ${j.chegada}${j.min ? ` (${j.min} min)` : ''}` : j.saida ? `saiu às ${j.saida}${j.min ? ` (${j.min} min antes)` : ''}` : j.min ? `${j.min} min ${j.cod === 'SA' ? 'antes do fim do turno' : 'de atraso'}` : '', j.obs].filter(Boolean).join(' · ') : '');
// o = { formSheet, nome, dt, cod, atual, salvar(j), depois() } — depois roda ao salvar ou ao fechar ("Agora não")
export function pedirJus(o) {
  const at = o.atual && o.atual.cod === o.cod ? o.atual : {}; const ms = MOTIVOS_JUS[o.cod] || ['Outro'];
  const html = `<label class="sel"><span>Motivo</span><select class="in" id="jsMot">${ms.map(m => `<option ${m === at.mot ? 'selected' : ''}>${escH(m)}</option>`).join('')}</select></label>
    ${o.cod === 'ATR' ? `<div class="g2eq"><label class="sel"><span>Chegou às</span><input class="in" type="time" id="jsCheg" value="${escH(at.chegada || '')}"></label><label class="sel"><span>Minutos de atraso</span><input class="in" type="number" id="jsMin" min="1" max="720" inputmode="numeric" value="${at.min || ''}" placeholder="Ex.: 30"></label></div>` : ''}
    ${o.cod === 'SA' ? `<div class="g2eq"><label class="sel"><span>Saiu às</span><input class="in" type="time" id="jsSai" value="${escH(at.saida || '')}"></label><label class="sel"><span>Minutos antes do fim</span><input class="in" type="number" id="jsMin" min="1" max="720" inputmode="numeric" value="${at.min || ''}" placeholder="Ex.: 120"></label></div>` : ''}
    <label class="sel"><span>Observação ${o.cod === 'AT' ? '(quantos dias · não escreva o CID nem a doença)' : '(opcional)'}</span><textarea class="in" id="jsObs" rows="3" maxlength="300" placeholder="${o.cod === 'ATR' ? 'Ex.: ônibus da linha 12 quebrou' : o.cod === 'SA' ? 'Ex.: saiu para levar o filho ao médico' : 'Detalhe se precisar'}">${escH(at.obs || '')}</textarea></label>
    ${o.ocorr ? `<label class="switch"><input type="checkbox" id="jsOc"><span>Registrar também como ocorrência na ficha do colaborador</span></label><label class="sel" id="jsOcBox" hidden><span>Tipo de ocorrência</span><select class="in" id="jsOcTipo">${o.ocorr.tipos.map(t => `<option>${escH(t)}</option>`).join('')}</select></label>` : ''}
    <p class="muted small m0">Fica junto do lançamento e aparece na Escala do dia, na Frequência e nos resumos.</p>`;
  let salvo = false;
  o.formSheet(`Justificativa · ${NOMES_CODIGO[o.cod] || o.cod}`, `${escH(o.nome)} · ${diaSem(o.dt)}, ${dBR(o.dt)}`, html, 'Salvar justificativa', async () => {
    const g = id => document.getElementById(id);
    const j = { cod: o.cod, mot: g('jsMot').value, obs: (g('jsObs').value || '').replace(/\s+/g, ' ').trim().slice(0, 300) };
    if (o.cod === 'ATR') { const ch = g('jsCheg').value, mi = Math.round(+g('jsMin').value || 0); if (ch) j.chegada = ch; if (mi > 0) j.min = mi; }
    if (o.cod === 'SA') { const sa = g('jsSai').value, mi = Math.round(+g('jsMin').value || 0); if (sa) j.saida = sa; if (mi > 0) j.min = mi; }
    if (j.mot === 'Outro' && !j.obs) throw new Error('Em "Outro", escreva o motivo na observação.');
    if (g('jsOc') && g('jsOc').checked) j.ocorr = g('jsOcTipo').value;
    await o.salvar(j); salvo = true; if (o.depois) setTimeout(o.depois, 30);
  }, { cancelarTxt: 'Agora não', aoCancelar: () => { if (!salvo && o.depois) setTimeout(o.depois, 30); } });
  const oc = document.getElementById('jsOc'); if (oc) oc.addEventListener('change', () => { document.getElementById('jsOcBox').hidden = !oc.checked; });
  const m = document.getElementById('jsMot'); if (m) m.focus();
}
// Chip colorido da situação (o mesmo da grade)
export const chipSit = (v, ok) => `<span class="sit ${v}">${v === 'P' ? ok || '✓' : v}</span>`;

// o = { sheet, nome, dt, atual: { v, auto, motivo }, codigos: ['P','F',...], linhaInfo, extras: [{ t, d, v, ic }],
//       depois: [datas seguintes que podem receber o mesmo código], fim: { t, v } (última opção do "até quando"),
//       aoEscolher(cod, datas), aoExtra(v), ok: ícone de presente }
export function abrirLancamento(o) {
  const { sheet } = o; const at = o.atual || {};
  const agora = at.v ? `${NOMES_CODIGO[at.v] || at.v}${at.auto ? (at.motivo ? ` (${at.motivo})` : at.motivo === '' ? '' : ' (automático)') : ''}` : 'sem lançamento';
  const sub = `${diaSem(o.dt)}, ${dBR(o.dt)} · agora: <b>${agora}</b>${o.linhaInfo ? `<br>${o.linhaInfo}` : ''}`;
  const opts = [
    ...o.codigos.map(c => ({ t: NOMES_CODIGO[c] || c, v: c, ic: chipSit(c, o.ok), cur: !at.auto && at.v === c })),
    ...(!at.auto && at.v ? [{ t: 'Voltar ao automático', d: 'Pela escala, férias e presença padrão', v: '', larga: true, ic: '<span class="sit auto">↺</span>' }] : []),
    ...(o.extras || []).map(x => ({ ...x, larga: true }))
  ];
  sheet(o.nome, sub, opts, x => {
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* sem vibração */ }
    if (x.extra) return o.aoExtra && o.aoExtra(x.v);
    const cod = x.v; const dep = (o.depois || []);
    // presente, hora extra e "automático" valem só no dia tocado (o comum); o resto pergunta até quando
    if (!cod || cod === 'P' || cod === 'HE' || !dep.length) return o.aoEscolher(cod, [o.dt]);
    const passos = [2, 4, 6, 14, 29].filter(n => dep[n - 1]).map(n => ({ t: `${n + 1} dias`, d: `até ${diaSem(dep[n - 1])}, ${ddmm(dep[n - 1])}`, v: dep[n - 1] }));
    const fim = o.fim && dep.includes(o.fim.v) && !passos.some(p => p.v === o.fim.v) ? [{ t: o.fim.t, d: `${diaSem(o.fim.v)}, ${ddmm(o.fim.v)}`, v: o.fim.v }] : [];
    const ate = [{ t: 'Só este dia', d: `${diaSem(o.dt)}, ${ddmm(o.dt)}`, v: o.dt }, ...fim, ...passos].sort((a, b) => (a.v < b.v ? -1 : 1));
    sheet('Até quando?', `${NOMES_CODIGO[cod] || cod} a partir de ${diaSem(o.dt)}, ${dBR(o.dt)}`, ate.map(a => ({ ...a, ic: chipSit(cod, o.ok) })), y => {
      o.aoEscolher(cod, [o.dt, ...dep.filter(d => d <= y.v)]);
    });
  }, { grade: true });
}
