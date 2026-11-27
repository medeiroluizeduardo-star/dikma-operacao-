// Service worker: guarda a interface para abrir sem sinal.
// Os dados (Firestore) têm cache próprio no navegador e sincronizam quando o sinal volta.
const V = 'dikma-operacao-v240';
const SHELL = ['index.html', 'estilo.css', 'ui/padrao.css', 'ui/padrao.js', 'app.js', 'nucleo/base.js', 'nucleo/estado.js', 'nucleo/erros.js', 'nucleo/appcheck.js', 'nucleo/acoes.js', 'nucleo/modulos.js', 'ui/icones.js', 'ui/janelas.js', 'ui/acessos-ficha.js', 'ui/shell.js', 'calc/atividades.js', 'calc/presenca.js', 'nucleo/navegacao.js', 'telas/atividades.js', 'telas/apontar.js', 'telas/efetivo.js', 'telas/horas-justificativas.js', 'telas/relatorios.js', 'telas/config.js', 'telas/plano-prog.js', 'contas/planoaplica.js', 'telas/limpeza.js', 'telas/lgpd.js', 'contas/lgpd.js', 'telas/seguranca.js', 'telas/contrato.js', 'contas/contrato.js', 'telas/medicao.js', 'contas/medicao.js', 'telas/tratativas.js', 'telas/agenda.js', 'telas/atestados.js', 'contas/atestados.js', 'ui/atestado.js', 'contas/tratativas.js', 'contas/agenda.js', 'ui/lembrar.js', 'telas/processos.js', 'contas/processos.js', 'telas/oms.js', 'telas/oms-programacao.js', 'contas/oms-programacao.js', 'telas/oms-indicadores.js', 'contas/oms-indicadores.js', 'contas/oms.js', 'contas/oms-recorrentes.js', 'telas/funcoes.js', 'contas/funcoes.js', 'telas/inspecoes.js', 'contas/inspecoes.js', 'telas/fotos.js', 'telas/queda-zero.js', 'contas/queda-zero.js', 'ui/fotos.js', 'contas/fotos.js', 'contas/execucao.js', 'telas/fotos-arquivo.js', 'telas/fotos-relatorio.js', 'contas/fotos-arquivo.js', 'contas/limpeza.js', 'contas/feriados.js', 'contas/segcalc.js', 'contas/seg-resumo.js', 'contas/saude.js', 'nucleo/eventos.js', 'nucleo/inicio.js', 'contas/cal.js', 'contas/justificativa.js', 'nucleo/data.js', 'nucleo/incremental.js', 'nucleo/medidor.js', 'ui/velocidade.js', 'telas/gestao.js', 'telas/equip.js', 'contas/eqcalc.js', 'contas/pessoas.js', 'telas/importar.js', 'ui/movimento.js', 'telas/avisos.js', 'contas/hoje.js', 'contas/permissoes.js', 'ui/busca.js', 'ui/dobra.js', 'contas/escala.js', 'contas/acessos.js', 'telas/administrativo.js', 'telas/historico.js', 'telas/colaboradores.js', 'telas/ferias-plano.js', 'contas/ferias-plano.js', 'telas/dados-pessoais.js', 'contas/dados-pessoais.js', 'telas/treinos.js', 'contas/treinos.js', 'ui/exportar.js', 'ui/indicadores-acoes.js', 'ui/excel-relatorio.js', 'ui/fmt-texto.js', 'ui/presenca.js', 'contas/aprovacao.js', 'contas/situacao.js', 'tema.js', 'contas/planilhas-adm.js', 'contas/lideres.js', 'contas/ferias.js', 'contas/colab-rh.js', 'contas/efetivo-dia.js', 'contas/mover-rota.js', 'contas/filtro-freq.js', 'contas/folha-ficha.js', 'contas/duplicados.js', 'contas/senha.js', 'vendor/firebase.js', 'icons/icon-512.png', 'img/dikma-simbolo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'img/dikma-logo.png', 'img/dikma-logo-branco.png', 'vendor/fontes/fontes.css', 'vendor/fontes/barlow-condensed-latin-600-normal.woff2', 'vendor/fontes/barlow-condensed-latin-700-normal.woff2', 'vendor/fontes/ibm-plex-mono-latin-500-normal.woff2', 'vendor/fontes/ibm-plex-sans-latin-400-normal.woff2', 'vendor/fontes/ibm-plex-sans-latin-500-normal.woff2', 'vendor/fontes/ibm-plex-sans-latin-600-normal.woff2'];

// Versão nova: baixa só o que mudou. A publicação grava sw-marcas.json (uma marca do conteúdo de cada arquivo, feita por
// ferramentas/marcas-sw.mjs); o arquivo com a mesma marca da versão anterior é copiado da versão guardada no aparelho,
// sem passar pela rede. Sem as marcas (teste local, ?demo) ou se algo falhar, baixa tudo, como antes.
const MARCAS = 'sw-marcas.json';
async function marcasDe(c) { try { const r = await c.match(MARCAS); return r ? await r.json() : null; } catch (e) { return null; } }
async function instalar() {
  const nova = await caches.open(V);
  let marcas = null, velha = null, antes = null;
  try {
    const r = await fetch(new Request(MARCAS, { cache: 'reload' }));
    if (r.ok) { marcas = await r.clone().json(); await nova.put(MARCAS, r); }
  } catch (e) { marcas = null; }
  if (marcas) {
    for (const k of await caches.keys()) {
      if (k === V || !k.startsWith('dikma-operacao-')) continue;
      const c = await caches.open(k); const m = await marcasDe(c);
      if (m) { velha = c; antes = m; break; }
    }
  }
  await Promise.all(SHELL.map(async u => {
    if (velha && u !== 'index.html' && marcas[u] && antes[u] === marcas[u]) { // a página principal vem sempre da rede
      const r = await velha.match(u, { ignoreSearch: true });
      if (r) return nova.put(u, r);
    }
    const r = await fetch(new Request(u, { cache: 'reload' }));
    if (!r.ok) throw new Error('Arquivo da versão nova não baixou: ' + u);
    return nova.put(u, r);
  }));
}
self.addEventListener('install', e => {
  // Falhou no meio: apaga a versão incompleta; o navegador tenta de novo na próxima abertura.
  e.waitUntil(instalar().then(() => self.skipWaiting(), err => caches.delete(V).then(() => { throw err; })));
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
