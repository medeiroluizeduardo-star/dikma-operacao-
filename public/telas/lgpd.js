// Administração › LGPD · descarte por prazo (só o administrador). Os prazos e as contas ficam em contas/lgpd.js; a
// leitura e a gravação, em data.js (data-mock.js na demonstração). Nada sai sozinho: 1) ler o que passou do prazo,
// 2) baixar a cópia (arquivo JSON no computador), 3) digitar APAGAR e confirmar. Usa o visual da Limpeza de dados.
import * as LG from '../contas/lgpd.js';
import { DB, DEMO, TODAY, esc, title } from '../nucleo/base.js';
import { isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const dBR = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const n0 = n => Number(n || 0).toLocaleString('pt-BR');
const novo = () => ({ previa: null, lendo: false, erro: '', baixou: false, conf: '', exec: null });
let L = novo();

async function montar() {
  const d = await DB.lgpdLer(LG.limiteAcesso(TODAY));
  const aso = LG.asoParaDescartar(d.aso, d.fichas, TODAY);
  const obs = [];
  for (const s of d.sit) for (const x of LG.obsDaSituacao(s, TODAY)) obs.push({ ...x, col: s.col, id: s.id, onde: s.col === 'b_situacao' ? 'Presença da Bateria' : 'Presença do Pátio' });
  for (const c of d.comps) for (const x of LG.obsDaFolha(c, TODAY)) obs.push({ ...x, col: 'freqcomp', id: c.id, onde: 'Folha da Frequência' });
  const acessos = LG.acessosParaDescartar(d.acessos, TODAY);
  const ops = [...obs.map(o => ({ tipo: 'obs', col: o.col, id: o.id, caminho: o.caminho })), ...aso.map(t => ({ tipo: 'aso', id: t.id })), ...acessos.map(a => ({ tipo: 'acesso', id: a.id }))];
  const copia = { tipo: 'dikma-lgpd', versao: 1, geradoEm: new Date().toISOString(), hoje: TODAY, prazos: LG.PRAZOS,
    aso: aso.map(({ motivo, dem, ...t }) => t), observacoes: obs.map(o => ({ colecao: o.col, id: o.id, caminho: o.caminho, obs: o.obs })), acessos };
  return { aso, obs, acessos, ops, copia };
}
async function ler() {
  if (!isAdmin() || L.lendo) return;
  L = { ...novo(), lendo: true }; render();
  try { L.previa = await montar(); } catch (e) { L.erro = (e && e.message) || 'Não foi possível ler os dados agora.'; }
  L.lendo = false; render();
}
function baixar() {
  const P = L.previa; if (!P) return;
  try {
    const blob = new Blob([JSON.stringify(P.copia, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `copia-lgpd-${TODAY}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    L.baixou = true; toast('Cópia baixada · guarde o arquivo num lugar restrito'); render();
  } catch (e) { toast('Não foi possível gerar a cópia neste aparelho'); }
}
const pode = () => !!L.previa && L.previa.ops.length > 0 && L.baixou && L.conf.trim().toUpperCase() === 'APAGAR' && !(L.exec && L.exec.rodando);
async function executar() {
  if (!isAdmin() || !pode()) return;
  if (!DEMO && !navigator.onLine) { toast('Sem sinal: o descarte precisa de conexão com o servidor'); return; }
  const P = L.previa; const resumo = `LGPD · descarte por prazo: ${n0(P.aso.length)} ASO, ${n0(P.obs.length)} observações de atestado/afastamento e ${n0(P.acessos.length)} registros de acesso`;
  L.exec = { feito: 0, total: P.ops.length, rodando: true }; render();
  try {
    for (const l of LG.emLotes(P.ops)) { await DB.lgpdGravar(l); L.exec.feito += l.length; render(); }
    L.exec.fim = true; DB.log(resumo, 'administracao'); toast('Descarte concluído');
  } catch (e) {
    L.exec.erro = (e && (e.code === 'permission-denied' ? 'Sem permissão no banco para esta operação.' : e.message)) || 'Erro inesperado';
    DB.log(`${resumo} · interrompido (${L.exec.feito} de ${L.exec.total})`, 'administracao');
  }
  L.exec.rodando = false; L.conf = ''; render();
}

const passo = (n, titulo, sub, corpo, ativo = true) => `<section class="card lppasso${ativo ? '' : ' off'}" aria-label="Passo ${n}: ${titulo}"><header><span class="lpn">${n}</span><div class="minw"><h2>${titulo}</h2><p>${sub}</p></div></header><div class="body stackcol">${corpo}</div></section>`;
const lista = (l, f, vazio) => (l.length ? `<ul>${l.slice(0, 30).map(x => `<li>${f(x)}</li>`).join('')}${l.length > 30 ? `<li><span class="muted">e mais ${n0(l.length - 30)}</span></li>` : ''}</ul>` : `<p class="muted small m0">${vazio}</p>`);
function previa(P) {
  const item = (t, n, corpo) => `<div class="lpitem"><div class="row-between"><b>${t}</b><span class="num">${n0(n)}</span></div>${corpo}</div>`;
  return `<div class="lpprev">
    ${item('ASO antigos', P.aso.length, lista(P.aso, t => `<span>${esc(title(t.nome || t.mat || ''))}</span><span class="muted num">exame ${dBR(t.realizado)} · ${t.motivo === 'demissao' ? `saiu em ${dBR(t.dem)}` : `venceu em ${dBR(t.validade)}`}</span>`, 'Nenhum ASO passou do prazo.'))}
    ${item('Observações de atestado e afastamento', P.obs.length, lista(P.obs, o => `<span>${esc(o.onde)} · ${o.cod === 'AF' ? 'afastamento' : 'atestado'}</span><span class="muted num">${dBR(o.dia)}</span>`, 'Nenhuma observação passou do prazo.'))}
    ${item('Registros de quem abriu a ficha', P.acessos.length, lista(P.acessos, a => `<span>${esc(title(a.nome || ''))} abriu a ficha de ${esc(title(a.pessoa || a.mat))}</span><span class="muted num">${dBR(a.dia)}</span>`, 'Nenhum registro passou do prazo.'))}
  </div>${P.ops.length ? '' : '<p class="muted m0">Nada passou do prazo hoje. Volte daqui a algumas semanas.</p>'}`;
}
export function vLgpd() {
  if (!isAdmin()) return '<div class="card"><div class="empty">Só o administrador faz o descarte por prazo.</div></div>';
  const P = L.previa, E = L.exec, temOps = !!P && P.ops.length > 0;
  let h = `<div class="lpaviso" role="note">${I.pend}<p class="m0"><b>Prazos de guarda (LGPD), aprovados em 22/11/2026.</b> ASO: fica sempre o mais recente de cada pessoa; os antigos saem 2 anos depois de vencer e, de quem saiu da empresa, 2 anos depois da demissão. Atestado e afastamento: o código fica (frequência, horas e medição), só a observação escrita sai depois de 12 meses. Quem abriu a ficha: 1 ano. Nada sai sozinho.</p></div>`;
  h += passo(1, 'O que passou do prazo', 'Lido agora do banco', `${P ? previa(P) : ''}${L.erro ? `<p class="err m0" role="alert">${esc(L.erro)}</p>` : ''}<div class="row-gap"><button class="btn${P ? '' : ' pri'}" data-act="lgLer" ${L.lendo || (E && E.rodando) ? 'disabled' : ''}>${L.lendo ? 'Lendo do banco…' : P ? 'Ler de novo' : 'Ver o que passou do prazo'}</button></div>`);
  h += passo(2, 'Cópia de segurança', 'Arquivo com tudo o que vai sair. Guarde num lugar restrito e apague quando não precisar mais', `<div class="row-gap"><button class="btn${L.baixou ? '' : ' pri'}" data-act="lgCopia" ${temOps ? '' : 'disabled'}>${I.dl} ${L.baixou ? 'Baixar de novo' : 'Baixar cópia antes de apagar'}</button>${L.baixou ? '<span class="pill ok">Cópia baixada</span>' : ''}</div>`, temOps);
  let res = '';
  if (E) {
    const pct = E.total ? Math.round(E.feito / E.total * 100) : 0;
    res = `<div role="status" aria-live="polite"><div class="small">${E.rodando ? 'Apagando…' : E.erro ? 'Parou no meio' : 'Concluído'} · <b class="num">${n0(E.feito)}</b> de <span class="num">${n0(E.total)}</span></div><div class="barra lpbarra${E.fim ? ' ok' : ''}"><i style="width:${Math.max(E.feito ? 2 : 0, pct)}%"></i></div></div>`;
    if (E.fim) res += '<div class="lpfim"><b>Descarte feito.</b> <span class="muted small">Registrado no histórico (só os números, sem nomes).</span></div><div class="row-gap"><button class="btn" data-act="lgLer">Ler de novo</button></div>';
    if (E.erro) res += `<div class="lpfim bad" role="alert"><b>Erro:</b> ${esc(E.erro)}<br><span class="muted small">Leia de novo para tentar o que faltou.</span></div>`;
  }
  const lib = temOps && L.baixou;
  h += passo(3, 'Confirmação', 'Digite APAGAR para liberar o botão', `${E && (E.rodando || E.fim) ? '' : `<div class="row-gap lpconf"><label class="sel"><span>Digite APAGAR</span><input class="in" id="lgConf" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(L.conf)}" ${lib ? '' : 'disabled'}></label><button class="btn perigo" data-act="lgApagar" id="lgApagar" ${pode() ? '' : 'disabled'}>Apagar</button></div>${temOps && !lib ? '<p class="muted small m0">Baixe a cópia no passo 2.</p>' : ''}`}${res}`, lib || !!E);
  return h;
}

acoes.lgLer = () => ler();
acoes.lgCopia = () => baixar();
acoes.lgApagar = () => executar();
document.addEventListener('input', e => {
  if (e.target.id !== 'lgConf') return;
  L.conf = e.target.value; const b = document.getElementById('lgApagar'); if (b) b.disabled = !pode();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'lgConf' && pode()) { e.preventDefault(); executar(); } });
