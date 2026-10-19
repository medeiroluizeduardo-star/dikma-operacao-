// Dikma Gestão — tema da tela (automático, claro ou escuro), escolhido em cada aparelho.
// Roda antes da página aparecer, para não piscar no tema errado.
(function () {
  var t = ''; try { t = localStorage.getItem('dikma-tema') || ''; } catch (e) { /* sem armazenamento */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();
