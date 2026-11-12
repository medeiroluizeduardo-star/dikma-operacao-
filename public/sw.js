// Service worker: guarda a interface para abrir sem sinal.
// Os dados (Firestore) têm cache próprio no navegador e sincronizam quando o sinal volta.
const V = 'dikma-operacao-v139';
const SHELL = ['index.html', 'estilo.css', 'app.js', 'nucleo/base.js', 'nucleo/estado.js', 'nucleo/erros.js', 'nucleo/appcheck.js', 'nucleo/acoes.js', 'nucleo/modulos.js', 'ui/icones.js', 'ui/janelas.js', 'ui/shell.js', 'calc/atividades.js', 'calc/presenca.js', 'nucleo/navegacao.js', 'telas/atividades.js', 'telas/apontar.js', 'telas/efetivo.js', 'telas/horas-justificativas.js', 'telas/relatorios.js', 'telas/config.js', 'telas/plano-prog.js', 'contas/planoaplica.js', 'telas/limpeza.js', 'telas/seguranca.js', 'telas/fotos.js', 'telas/queda-zero.js', 'contas/queda-zero.js', 'ui/fotos.js', 'contas/fotos.js', 'telas/fotos-arquivo.js', 'contas/fotos-arquivo.js', 'contas/limpeza.js', 'contas/feriados.js', 'contas/segcalc.js', 'nucleo/eventos.js', 'telas/tv.js', 'nucleo/inicio.js', 'contas/cal.js', 'nucleo/data.js', 'telas/gestao.js', 'telas/equip.js', 'contas/eqcalc.js', 'contas/pessoas.js', 'telas/importar.js', 'ui/movimento.js', 'telas/avisos.js', 'contas/hoje.js', 'contas/permissoes.js', 'ui/busca.js', 'ui/dobra.js', 'contas/escala.js', 'contas/acessos.js', 'telas/administrativo.js', 'telas/historico.js', 'telas/treinos.js', 'contas/treinos.js', 'ui/exportar.js', 'ui/presenca.js', 'contas/aprovacao.js', 'contas/situacao.js', 'tema.js', 'contas/planilhas-adm.js', 'contas/lideres.js', 'contas/folha-ficha.js', 'contas/senha.js', 'vendor/firebase.js', 'icons/icon-512.png', 'img/dikma-simbolo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'img/dikma-logo.png', 'img/dikma-logo-branco.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Página principal (/ e index.html): abre da versão guardada na hora e, ao mesmo tempo, busca a da rede em segundo
// plano para a próxima abertura (stale-while-revalidate). Assim o sinal fraco do pátio não segura a abertura.
// A versão nova do sistema continua chegando pelo próprio service worker (V muda a cada publicação) e o aviso
// "Nova versão do sistema disponível" aparece como antes (inicio.js, controllerchange).
// Outros endereços (como /painel, que é redirecionado): pela rede; sem sinal, a tela principal guardada.
// Código, imagens e dados da demonstração: direto da versão guardada (abre na hora). A cada publicação o
// nome V muda, o navegador baixa a versão nova inteira em segundo plano e ela vale a partir da próxima abertura.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith('/__/')) return; // configuração e login do Firebase: sempre pela rede
    const pagina = e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html');
    if (pagina) {
      // Só a tela principal fica guardada para abrir sem sinal.
      const chave = 'index.html';
      const daRede = () => fetch(e.request).then(r => { if (r.ok && !r.redirected) { const c = r.clone(); caches.open(V).then(ca => ca.put(chave, c)); } return r; });
      if (u.pathname === '/' || u.pathname === '/index.html') {
        const nova = daRede();
        e.waitUntil(nova.then(() => {}, () => {}));
        e.respondWith(caches.match(chave).then(hit => hit || nova).catch(() => caches.match(chave)));
      } else e.respondWith(daRede().catch(() => caches.match(chave)));
      return;
    }
    e.respondWith(caches.open(V).then(ca => ca.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { if (r.ok) ca.put(e.request, r.clone()); return r; }))));
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(V).then(ca => ca.put(e.request, c)); return res; })));
  }
});

// ---------- avisos no celular (Firebase Cloud Messaging) ----------
// A rotina "Avisos" do GitHub manda mensagens só com dados: { titulo, corpo, url, tag }.
self.addEventListener('push', e => {
  let m = {};
  try { const j = e.data ? e.data.json() : {}; m = j.data || j.notification || j; } catch (err) { m = { corpo: e.data ? e.data.text() : '' }; }
  const titulo = m.titulo || m.title || 'Dikma Gestão';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: m.corpo || m.body || '', tag: m.tag || undefined, renotify: !!m.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: m.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || './', self.location.origin).href;
  // Aviso de outro site (ex.: o Painel Coqueria): abre direto, sem passar pelo Dikma Gestão.
  if (!alvo.startsWith(self.location.origin)) { e.waitUntil(self.clients.openWindow(alvo)); return; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.startsWith(self.location.origin)) { c.postMessage({ tipo: 'abrir', url: alvo }); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
