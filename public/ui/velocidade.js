// Janela "Velocidade deste aparelho": mostra o que o medidor (nucleo/medidor.js) anotou neste aparelho.
import { sessoes } from '../nucleo/medidor.js';
import { esc } from '../nucleo/base.js';
import { sheet } from './janelas.js';
import { aba } from '../nucleo/navegacao.js';

const seg = ms => (!ms ? '—' : ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' s');
const nomeAba = k => { const v = String(k || '').split('|')[1] || ''; return (v && aba(v) && aba(v).nome) || v || '—'; };
const hora = t => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function velocidadeSheet() {
  const l = sessoes(), s = l[0];
  const aparelho = [s.rede && 'rede ' + s.rede.toUpperCase(), s.mem && s.mem + ' GB de memória', s.nucleos && s.nucleos + ' núcleos'].filter(Boolean).join(' · ');
  const linhas = l.map(x => `<tr><td>${hora(x.em)}</td><td class="num">${seg(x.tela)}</td><td class="num">${seg(x.dadosFim)}</td><td class="num">${x.dadosN}</td><td class="num">${x.des ? Math.round(x.desMs / x.des) + ' ms' : '—'}</td></tr>`).join('');
  const trocas = [...s.trocas].sort((a, b) => b.ms - a.ms).slice(0, 8).map(t => `<tr><td>${esc(nomeAba(t.aba))}</td><td class="num">${seg(t.ms)}</td></tr>`).join('');
  // Partes do banco desta abertura, das mais demoradas (servidor) para as mais rápidas.
  const ps = Object.entries(s.partes || {}).sort((a, b) => (b[1].s || b[1].c) - (a[1].s || a[1].c)).slice(0, 10);
  const partes = ps.map(([n, p]) => `<tr><td>${esc(n)}</td><td class="num">${seg(p.c)}</td><td class="num">${seg(p.s)}</td><td class="num">${p.n}</td></tr>`).join('');
  const html = `<div class="velo">
    <p class="mut">Fica só neste aparelho. Tire uma foto desta janela e mande para quem cuida do sistema.${aparelho ? '<br>' + esc(aparelho) : ''}</p>
    <div class="tw"><table><thead><tr><th>Abertura</th><th>Tela</th><th>Dados</th><th>Lotes</th><th>Desenho</th></tr></thead><tbody>${linhas}</tbody></table></div>
    <p class="mut">Tela: até aparecer a primeira tela. Dados: até chegar o último lote do banco. Desenho: tempo médio para montar a tela.</p>
    ${trocas ? `<div class="tw"><table><thead><tr><th>Abas mais lentas agora</th><th>Tempo</th></tr></thead><tbody>${trocas}</tbody></table></div>` : '<p class="mut">Troque algumas abas e abra de novo para ver as mais lentas.</p>'}
    ${partes ? `<div class="tw"><table><thead><tr><th>Dados por parte (esta abertura)</th><th>Do aparelho</th><th>Do servidor</th><th>Docs</th></tr></thead><tbody>${partes}</tbody></table></div>
    <p class="mut">As 10 partes do banco que mais demoraram. Do aparelho: cópia guardada no celular. Do servidor: confirmação pela internet (— quando ainda não chegou ou não precisou).</p>` : ''}
    ${s.desMax ? `<p class="mut">Desenho mais demorado: ${s.desMax} ms em ${esc(nomeAba(s.desMaxAba))}.</p>` : ''}
  </div>`;
  sheet('Velocidade deste aparelho', html, [], () => {}, { fechar: 'Fechar' });
}
