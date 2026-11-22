// Medidor de velocidade deste aparelho (menu › Velocidade deste aparelho).
// Mede a abertura do app, a chegada dos dados do banco e o tempo de cada troca de aba.
// Fica só neste aparelho (localStorage): nada é gravado no banco. Guarda as últimas 8 aberturas.
const CHAVE = 'dikma-vel';
const MAX_SESSOES = 8, MAX_TROCAS = 20;
const agora = () => Math.round(performance.now()); // ms desde que a página começou a carregar

const lerTudo = () => { try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; } };
const con = navigator.connection || {};
const S = {
  em: Date.now(), rede: con.effectiveType || '', mem: navigator.deviceMemory || 0, nucleos: navigator.hardwareConcurrency || 0,
  tela: 0, dados1: 0, dadosN: 0, dadosFim: 0, des: 0, desMs: 0, desMax: 0, desMaxAba: '', trocas: []
};
let gravar = 0;
const salvar = () => {
  if (gravar) return;
  gravar = setTimeout(() => {
    gravar = 0;
    try { const l = lerTudo().filter(x => x.em !== S.em); l.unshift(S); localStorage.setItem(CHAVE, JSON.stringify(l.slice(0, MAX_SESSOES))); } catch (e) { /* sem espaço ou modo privado: só não guarda */ }
  }, 2000);
};

// Cada lote de dados que chega do banco (os primeiros 2 minutos contam como "abertura").
export function marcarDados() {
  const t = agora(); if (t > 120000) return;
  if (!S.dados1) S.dados1 = t;
  S.dadosN++; S.dadosFim = t; salvar();
}

// Um desenho da tela: quanto tempo o aparelho levou para montar.
export function medirDesenho(aba, ms) {
  S.des++; S.desMs += ms;
  if (ms > S.desMax) { S.desMax = Math.round(ms); S.desMaxAba = aba; }
  salvar();
}

// Troca de aba: do toque até a tela nova aparecer com os dados (sem o esqueleto de carregando).
let pend = null;
export function toque() { pend = { aba: '', a: agora() }; } // toque no menu (trocarTela): o desenho vem 2 quadros depois
export function navegou(aba) { if (pend && !pend.aba && agora() - pend.a < 3000) pend.aba = aba; else if (!pend || pend.aba !== aba) pend = { aba, a: agora() }; }
export function telaPronta(aba) {
  if (!S.tela) { S.tela = agora(); pend = null; salvar(); return; }
  if (!pend || pend.aba !== aba) return;
  const p = pend; pend = null;
  requestAnimationFrame(() => setTimeout(() => { S.trocas.push({ aba: p.aba, ms: agora() - p.a }); if (S.trocas.length > MAX_TROCAS) S.trocas.shift(); salvar(); }, 0));
}

export const sessoes = () => { const l = lerTudo().filter(x => x.em !== S.em); return [S, ...l].slice(0, MAX_SESSOES); };
