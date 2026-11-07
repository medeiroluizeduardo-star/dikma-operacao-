// Fotos no navegador (comum às Atividades e à Segurança): abrir a imagem escolhida, reduzir para JPEG no próprio
// aparelho (economiza o plano grátis do banco e o sinal do pátio), miniatura, impressão digital (SHA-256) e a foto
// grande em tela cheia ao tocar na miniatura (carrega só ela).
import { IMG } from '../contas/fotos.js';

// Abre o arquivo escolhido como imagem (a orientação da câmera já vem aplicada pelo navegador).
export const carregarImg = file => new Promise((ok, ko) => {
  const u = URL.createObjectURL(file); const im = new Image();
  im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  im.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Não foi possível abrir esta imagem.')); };
  im.src = u;
});
// Desenha a imagem com o lado maior em `lado` px (nunca aumenta) e devolve { dados (data:image/jpeg;base64,…), w, h }.
export function jpegDe(im, lado, q) {
  const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
  const sc = Math.min(1, lado / Math.max(W, H));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * sc)); cv.height = Math.max(1, Math.round(H * sc));
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
  return { dados: cv.toDataURL('image/jpeg', q), w: cv.width, h: cv.height };
}
export const jpeg = (im, lado, q) => jpegDe(im, lado, q).dados;
// Tamanho real do arquivo JPEG guardado no texto base64.
export function bytesDe(dataUrl) { const b = String(dataUrl).split(',')[1] || ''; return Math.floor(b.length * 3 / 4) - (b.endsWith('==') ? 2 : b.endsWith('=') ? 1 : 0); }
// SHA-256 (hex) dos bytes da foto: identifica a mesma foto em qualquer lugar (exportação, repetidas). Sem
// crypto.subtle (endereço sem https), fica vazio.
export async function shaDe(dataUrl) {
  try {
    if (!(globalThis.crypto && crypto.subtle)) return '';
    const bin = atob(String(dataUrl).split(',')[1] || ''); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
    return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}

// Foto de atividade: JPEG com lado maior 1280 px e qualidade 0,7 (alvo de 150 KB). Se passar de 300 KB, recomprime
// (qualidade e depois tamanho) até chegar perto do alvo. Miniatura de 240 px com até 15 KB.
// Devolve { dados, thumb, bytes, w, h, sha, nome }.
export async function reduzirFotoAtividade(file) {
  if (file && file.type && !/^image\//.test(file.type)) throw new Error('Escolha uma foto (imagem).');
  const im = await carregarImg(file);
  let lado = IMG.lado, q = IMG.qualidade, f = jpegDe(im, lado, q);
  if (bytesDe(f.dados) > IMG.recomprimir) {
    let n = 0;
    while (bytesDe(f.dados) > IMG.alvo && n++ < 12) { if (q > 0.45) q = Math.round((q - 0.1) * 100) / 100; else lado = Math.round(lado * 0.85); f = jpegDe(im, lado, q); }
  }
  let qm = IMG.qualidadeMini, mini = jpegDe(im, IMG.ladoMini, qm);
  while (bytesDe(mini.dados) > IMG.miniMax && qm > 0.3) { qm -= 0.1; mini = jpegDe(im, IMG.ladoMini, qm); }
  if (f.dados.length > IMG.dadosMaxCar) throw new Error('A foto ficou grande demais. Tente outra.');
  return { dados: f.dados, thumb: mini.dados, bytes: bytesDe(f.dados), w: f.w, h: f.h, sha: await shaDe(f.dados), nome: String((file && file.name) || 'foto.jpg') };
}

// Foto grande em tela cheia. carregar() devolve a foto completa (ou null se ainda não chegou ao servidor).
// Fecha no X, no fundo e com Esc.
export async function verFotoGrande(carregar, mini, rotulo = 'Foto', legenda = '') {
  document.querySelectorAll('.sgfoto').forEach(x => x.remove());
  const el = document.createElement('div'); el.className = 'sgfoto'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', rotulo);
  el.innerHTML = `<button type="button" class="btn sgfoto-x" aria-label="Fechar a foto">✕ Fechar</button><img alt=""><p class="sgfoto-st" role="status">Carregando a foto…</p>${legenda ? '<p class="sgfoto-leg"></p>' : ''}`;
  el.querySelector('img').alt = rotulo; if (mini) el.querySelector('img').src = mini;
  if (legenda) el.querySelector('.sgfoto-leg').textContent = legenda;
  const fechar = () => { el.remove(); document.removeEventListener('keydown', kd, true); };
  const kd = e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('.sgfoto-x')) fechar(); });
  document.addEventListener('keydown', kd, true);
  document.body.appendChild(el); el.querySelector('.sgfoto-x').focus();
  try { const d = await carregar(); const st = el.querySelector('.sgfoto-st'); if (!st) return; if (d) { el.querySelector('img').src = d; st.remove(); } else st.textContent = 'Foto ainda não chegou ao servidor (sobe quando o sinal voltar).'; }
  catch (e) { const st = el.querySelector('.sgfoto-st'); if (st) st.textContent = 'Sem sinal: aparece só a miniatura.'; }
}
