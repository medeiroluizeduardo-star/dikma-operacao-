// Dikma Gestão — lançar a presença de uma pessoa num dia. O MESMO jeito na Frequência (Administrativo)
// e no Efetivo diário (Operação): toque no dia → escolha a situação → escolha até quando vale.
// Quem chama decide onde grava (situacao, folha) e o que vem depois (substituto, hora extra).
import { NOMES_CODIGO } from './planilhas-adm.js';

const DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dBR = s => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const ddmm = s => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const diaSem = s => DIA[new Date(s + 'T12:00:00').getDay()];
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
    ...(!at.auto && at.v ? [{ t: 'Voltar ao automático', d: 'Pela escala, férias e presença padrão', v: '', ic: '<span class="sit auto">↺</span>' }] : []),
    ...(o.extras || [])
  ];
  sheet(o.nome, sub, opts, x => {
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
  });
}
