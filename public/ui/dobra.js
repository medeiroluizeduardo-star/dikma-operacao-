// Seções que abrem e fecham (<details class="card dobra" data-dobra="chave"${abre('chave')}><summary><h2>…</h2><p>…</p></summary>…</details>).
// No celular começam fechadas (tela mais curta); no computador, abertas. O que a pessoa abriu ou fechou fica guardado
// enquanto a página está aberta, para a seção não mudar sozinha quando a tela redesenha.
const ESTADO = {};
const celular = () => matchMedia('(max-width:860px)').matches;
export const abre = (chave, noCelular = false) => ((ESTADO[chave] ?? (celular() ? noCelular : true)) ? ' open' : '');
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.dobra) ESTADO[d.dataset.dobra] = d.open; }, true);
