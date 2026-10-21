// Dikma Gestão — tema da tela (automático, claro ou escuro) e estilo visual (padrão, retrô,
// minimalista ou futurista), escolhidos em cada aparelho.
// Roda antes da página aparecer, para não piscar no tema errado.
(function () {
  var FONTES = {
    retro: 'family=Zilla+Slab:wght@600;700&family=Courier+Prime:wght@400;700&family=Work+Sans:wght@400;500;600',
    minimal: 'family=Inter:wght@400;500;600;700',
    futuro: 'family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@500&family=Inter:wght@400;500;600'
  };
  // Usada também pelo app ao trocar de estilo (carrega as fontes do estilo só quando ele é escolhido).
  window.dikmaEstilo = function (s) {
    var h = document.documentElement;
    if (FONTES[s]) h.setAttribute('data-estilo', s); else h.removeAttribute('data-estilo');
    if (FONTES[s] && !document.getElementById('fonte-' + s)) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.id = 'fonte-' + s;
      l.href = 'https://fonts.googleapis.com/css2?' + FONTES[s] + '&display=swap';
      document.head.appendChild(l);
    }
  };
  var t = '', s = ''; try { t = localStorage.getItem('dikma-tema') || ''; s = localStorage.getItem('dikma-estilo') || ''; } catch (e) { /* sem armazenamento */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  if (FONTES[s]) window.dikmaEstilo(s);
})();
