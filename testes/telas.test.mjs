// Teste automático das telas: abre o site no modo demonstração (?demo, dados de exemplo) num navegador de verdade
// (Chromium, sem janela), entra como administrador (a demonstração já abre assim) e passa por todas as abas de todos os módulos,
// no tamanho de computador (1366) e de celular (390). Em cada aba confere:
//   - nenhum erro de JavaScript (nem aviso de erro no console, nem bloqueio da política de segurança do site);
//   - nenhum arquivo do site faltando (erro 404);
//   - a tela desenhou alguma coisa e não ficou presa no "Carregando";
//   - nada passa da largura da tela (sem rolagem lateral).
//   - nenhum ícone sem tamanho (fica gigante).
// Não usa o banco de verdade: o modo demonstração tem dados inventados e não grava nada.
// Para rodar no computador: cd testes && npm install && npx playwright install chromium && npm run telas
// Simulando uma máquina lenta (processador 6 vezes mais lento): LENTO=6 npm run telas
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(raiz, 'public');

// Os mesmos cabeçalhos de segurança do site no ar (firebase.json), para pegar <script> dentro do HTML, onclick= etc.
const fb = JSON.parse(fs.readFileSync(path.join(raiz, 'firebase.json'), 'utf8'));
const CABECALHOS = Object.fromEntries((fb.hosting.headers.find(h => h.source === '**')?.headers || [])
  .filter(h => h.key !== 'Strict-Transport-Security').map(h => [h.key, h.value]));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let servidor, base, navegador;
before(async () => {
  servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(pub, path.normalize(p));
    if (!f.startsWith(pub) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end('não achei'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...CABECALHOS });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}/`;
  navegador = await chromium.launch();
});
after(async () => { await navegador?.close(); await new Promise(r => servidor ? servidor.close(r) : r()); });

// Espera a tela terminar de desenhar olhando a própria tela, em vez de pausas de tempo fixo (item 3.3 do plano de ação).
// Antes: 100 ms depois do clique e mais 120 ms no fim. Numa máquina lenta (CI) às vezes não bastava e o teste acusava
// "tela em branco" ou "aba sumiu do menu" à toa (#145, #173); numa rápida, sobrava espera.
// Agora:
//   1) clicar() espera o desenho que o próprio clique agendou: o site troca de tela dois quadros depois do toque
//      (shell.js › trocarTela) e os outros botões desenham 40 ms + um quadro depois (shell.js › schedule). A conta é pela
//      ordem dos quadros e relógios do navegador, não pela velocidade da máquina;
//   2) nenhum arquivo do site a caminho (o arquivo da aba aberta sob demanda já chegou);
//   3) a tela pronta e quieta: sem esqueleto de "Carregando", com texto e sem conteúdo novo há QUIETO ms. Um vigia na
//      página (ESPIAO) anota a hora da última mudança de conteúdo (elementos e textos; não as classes e estilos que a
//      animação de entrada vai trocando). Os dados de exemplo chegam em lotes e cada lote redesenha.
// Cada espera tem limite (10 s); passado o limite, segue e as conferências acusam o problema (tela em branco etc.).
const QUIETO = 150;
const ESPIAO = () => {
  window.__mudou = performance.now();
  new MutationObserver(() => { window.__mudou = performance.now(); }).observe(document, { subtree: true, childList: true, characterData: true });
};
// Arquivos do site pedidos e ainda não chegados, por página.
const A_CAMINHO = new WeakMap();
function vigiarRede(page) {
  const s = new Set(); A_CAMINHO.set(page, s);
  page.on('request', r => { if (r.url().startsWith(base)) s.add(r); });
  page.on('requestfinished', r => s.delete(r)); page.on('requestfailed', r => s.delete(r));
}
async function esperar(page) {
  for (let i = 0; A_CAMINHO.get(page)?.size && i < 200; i++) await new Promise(r => setTimeout(r, 50));
  await page.waitForFunction(q => {
    const v = document.getElementById('view');
    return !!v && !v.querySelector('[aria-busy="true"], .skel') && v.innerText.trim().length > 0 && performance.now() - window.__mudou >= q;
  }, QUIETO, { timeout: 10000, polling: 50 }).catch(() => {});
}
// Clica pelo seletor e espera o desenho agendado pelo clique (passo 1 acima); false se o botão não existe.
// Os relógios do navegador disparam em ordem e os quadros também: um relógio de 45 ms seguido de dois quadros termina
// sempre depois do "40 ms + um quadro" e do "dois quadros" que o clique pediu, por mais lenta que seja a máquina.
const clicar = (page, sel) => page.evaluate(async s => {
  const b = document.querySelector(s); if (!b) return false;
  b.click();
  const quadro = () => new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 45)); await quadro(); await quadro();
  return true;
}, sel);
const fecharJanelas = page => page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });

for (const [nome, tela] of [['computador', { width: 1366, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  test(`telas no ${nome} (${tela.width} de largura)`, async t => {
    const ctx = await navegador.newContext({ viewport: tela, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...(nome === 'celular' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
    // Sem internet: só o próprio site (as fontes do Google ficam de fora, a tela usa as do sistema).
    await ctx.route(u => !u.href.startsWith(base), r => r.abort());
    await ctx.addInitScript(ESPIAO);
    const page = await ctx.newPage();
    // LENTO=4 npm run telas: simula uma máquina 4x mais lenta (como a da CI em dia ruim) para conferir que o teste aguenta.
    if (Number(process.env.LENTO) > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.LENTO) });
    vigiarRede(page);
    const erros = [];
    page.on('pageerror', e => erros.push('Erro de JavaScript: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_BLOCKED_BY_CLIENT|fonts\.googleapis/.test(m.text())) erros.push('Console: ' + m.text()); });
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) erros.push(`Arquivo faltando (${r.status()}): ${r.url().slice(base.length)}`); });

    await page.goto(base + '?demo');
    // A demonstração já entra como administrador; se pedir login, usa o da demonstração.
    await page.waitForSelector('#shell:not([hidden]), #lgUser', { timeout: 15000 });
    if (await page.$('#lgUser')) {
      await page.fill('#lgUser', 'admin');
      await page.fill('#lgPass', '123456');
      await page.click('#fLogin button[type="submit"]');
      await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
    }
    await esperar(page);
    assert.deepEqual(erros, [], 'erros ao entrar');

    const modulos = await page.$$eval('[data-mod]', bs => bs.map(b => b.dataset.mod));
    assert.ok(modulos.length >= 5, `o administrador devia ver os 5 módulos (viu ${modulos.join(', ')})`);
    let abas = 0;
    for (const m of modulos) {
      await clicar(page, `[data-mod="${m}"]`);
      await esperar(page);
      // Abas do menu e, logo depois de cada uma, as que abrem por botão no topo dela (Indicadores, Folha do líder, Impressão das fichas).
      const ids = (await page.$$eval('#nav [data-go]', bs => bs.map(b => b.dataset.go))).map(id => [id, '']);
      assert.ok(ids.length > 0, `módulo ${m} sem abas no menu`);
      const vistas = new Set(ids.map(([id]) => id));
      for (let i = 0; i < ids.length; i++) {
        const [id, pai] = ids[i];
        await t.test(`${m} › ${pai ? pai + ' › ' : ''}${id}`, async () => {
          erros.length = 0;
          if (pai) { assert.ok(await clicar(page, `#nav [data-go="${pai}"]`), 'aba pai sumiu do menu'); await esperar(page); }
          assert.ok(await clicar(page, pai ? `#fbarra [data-go="${id}"]` : `#nav [data-go="${id}"]`), pai ? 'botão sumiu do topo' : 'aba sumiu do menu');
          await esperar(page);
          if (!pai) {
            const novas = (await page.$$eval('#fbarra [data-go]', bs => bs.map(b => b.dataset.go))).filter(x => !vistas.has(x));
            novas.forEach(x => vistas.add(x)); ids.splice(i + 1, 0, ...novas.map(x => [x, id]));
          }
          const r = await page.evaluate(w => ({
            texto: (document.getElementById('view')?.innerText || '').trim().length,
            carregando: !!document.querySelector('#view [aria-busy="true"]'),
            largura: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), janela: w,
            // ícone (desenho 24x24) sem tamanho no CSS fica do tamanho da tela (Atestados, 27/11)
            iconeGrande: [...document.querySelectorAll('#view svg[viewBox="0 0 24 24"]')].some(e => e.getBoundingClientRect().height > 96),
            falhou: [...document.querySelectorAll('.toast')].map(e => e.innerText).find(s => /não foi possível/i.test(s)) || ''
          }), tela.width);
          assert.deepEqual(erros, [], 'erros na tela');
          assert.equal(r.falhou, '', 'aviso de falha na tela');
          assert.ok(r.texto > 0, 'tela em branco');
          assert.equal(r.iconeGrande, false, 'ícone gigante (falta tamanho no CSS)');
          assert.equal(r.carregando, false, 'tela presa no "Carregando"');
          assert.ok(r.largura <= r.janela + 1, `rolagem lateral: conteúdo com ${r.largura}px numa tela de ${r.janela}px`);
          await fecharJanelas(page);
        });
        abas++;
      }
    }
    assert.ok(abas >= 20, `poucas abas testadas (${abas})`);
    await ctx.close();
  });
}

// Página do guia visual (guia.html): sem erros, sem arquivo faltando e sem rolagem lateral, no computador e no celular.
for (const [nome, tela] of [['computador', { width: 1366, height: 800 }], ['celular', { width: 390, height: 844 }]]) {
  test(`guia visual no ${nome}`, async () => {
    const ctx = await navegador.newContext({ viewport: tela, serviceWorkers: 'block', locale: 'pt-BR', ...(nome === 'celular' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
    await ctx.route(u => !u.href.startsWith(base), r => r.abort());
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push('Erro de JavaScript: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|ERR_BLOCKED_BY_CLIENT|fonts\.googleapis/.test(m.text())) erros.push('Console: ' + m.text()); });
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) erros.push(`Arquivo faltando (${r.status()}): ${r.url().slice(base.length)}`); });
    await page.goto(base + 'guia.html');
    await page.waitForSelector('#guia .p-cab', { timeout: 10000 });
    for (const t of ['dark', 'light']) {
      await page.click(`[data-tema="${t}"]`);
      const r = await page.evaluate(() => ({ largura: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), secoes: document.querySelectorAll('#guia .g-sec').length, preso: !!document.querySelector('#guia [aria-busy="true"]') }));
      assert.ok(r.secoes >= 10, `guia com poucas seções (${r.secoes})`);
      assert.equal(r.preso, false, 'guia preso no "Carregando"');
      assert.ok(r.largura <= tela.width + 1, `rolagem lateral no guia (${t}): ${r.largura}px numa tela de ${tela.width}px`);
    }
    assert.deepEqual(erros, [], 'erros no guia');
    await ctx.close();
  });
}
