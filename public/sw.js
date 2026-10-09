// Service worker: guarda a interface para abrir sem sinal.
// Os dados (Firestore) têm cache próprio no navegador e sincronizam quando o sinal volta.
const V = 'dikma-operacao-v19';
const SHELL = ['index.html', 'app.js', 'cal.js', 'data.js', 'gestao.js', 'equip.js', 'eqcalc.js', 'pessoas.js', 'importar.js', 'movimento.js', 'meudia.js', 'hoje.js', 'permissoes.js', 'vendor/firebase.js', 'icons/icon-512.png', 'img/dikma-simbolo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'img/dikma-logo.png', 'img/dikma-logo-branco.png', 'seed.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Página (index.html): sempre pela rede, para pegar versão nova; sem sinal, usa a guardada.
// Código, imagens e planilhas de exemplo: direto da versão guardada (abre na hora). A cada publicação o
// nome V muda, o navegador baixa a versão nova inteira em segundo plano e ela vale a partir da próxima abertura.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (u.pathname.startsWith('/__/')) return; // configuração e login do Firebase: sempre pela rede
    const pagina = e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html');
    if (pagina) {
      e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(ca => ca.put('index.html', c)); } return r; })
        .catch(() => caches.match('index.html')));
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
  const titulo = m.titulo || m.title || 'Dikma Operação';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: m.corpo || m.body || '', tag: m.tag || undefined, renotify: !!m.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: m.url || './?v=meudia' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || './?v=meudia', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.startsWith(self.location.origin)) { c.postMessage({ tipo: 'abrir', url: alvo }); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
