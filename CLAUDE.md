# Instruções para o Claude neste repositório (Dikma Gestão)

## Conversa
- Responder sempre em **português do Brasil**, linguagem simples (o dono não é programador). Telas, commits e PRs também em português.
- Fuso: America/Sao_Paulo. Site no ar: dikma-operacao.web.app.

## Como entregar (obrigatório)
1. Nunca mexer direto na `main` (a `main` publica no ar sozinha). Criar uma branch nova (conferir antes com `git ls-remote --heads origin NOME` que o nome não existe), commit, push e **pull request**.
2. Esperar a CI do PR (`testar` e `previa`) e mandar ao usuário o **link da prévia** (comentário do PR com `...web.app`).
3. Só fazer o merge (squash) quando o usuário disser **"pode publicar"**. Depois conferir que o workflow **"Publicar no Firebase"** terminou com sucesso.
4. A cada mudança em `public/`, subir a versão `V` em `public/sw.js` (`dikma-operacao-vNN`) e incluir arquivos novos da tela no `SHELL`.
5. Ao terminar, resumir para o usuário: o que mudou, como usar e o que foi testado. Curto.

## Segurança e dados
- Nada de dados pessoais, nomes reais ou planilhas em `public/`. Antes de cada PR: `node ferramentas/conferir-site.mjs` precisa passar.
- Planilhas e dados de carga **não vão para o repositório nem para o site**: ficam só no banco (`seeds/`, entram no backup). `dados-importacao/` é ignorada pelo Git e serve só no computador de quem for enviar (`integracao/admin/enviar-dados.mjs`).
- Nunca mostrar nem enviar segredos (chaves, senhas, tokens).
- Política de segurança (CSP em `firebase.json`): sem `<script>` inline e sem `onclick=` no HTML; scripts só deste site, bibliotecas em `public/vendor/`.
- **Mudança em dados reais** (migração, gravar/apagar no Firestore, rodar workflow que grava) só com autorização explícita do usuário e com cópia de segurança antes (workflow `backup`).
- Mudou a estrutura de dados? Ajustar `firestore.rules` e os testes em `testes/regras.test.mjs` (rodam no CI, com emulador).

## Estrutura (resumo)
- Página estática sem build, JavaScript puro (módulos ES) em `public/`: `nucleo/`, `calc/`, `ui/`, `telas/`, `navegacao.js`, `eventos.js`, `data.js` (Firestore) e `data-mock.js` (modo `?demo`, dados de exemplo).
- 5 módulos: Operação, Gestão, Segurança, RH e Administração; acesso por módulo em `usuarios/{uid}.acesso` (ver `public/acessos.js`).
- Fotos das atividades: ver `docs/fotos-atividades.md`.
- Rotinas no GitHub Actions (`.github/workflows/`): publicar, prévia, testes, avisos, backup, feriados, trocar líder etc.

## Testes (proporcionais ao tamanho da mudança)
- Sempre: `node --check` nos .js alterados, `node --test` dos testes de lógica em `testes/` (lista em `testes/package.json`, sem `regras`/`rotinas`, que precisam do emulador) e `conferir-site`.
- Ajuste pequeno ("teste rápido"): conferir só a tela mexida no `?demo`.
- Mudança grande: Playwright no `?demo` em 1366 e 390 de largura, sem erros de JS e sem rolagem lateral.

## Economia
- Preferir fazer o trabalho direto, sem agentes auxiliares, salvo pedido do usuário.
- Ler só os trechos necessários dos arquivos; evitar capturas de tela e varreduras completas quando não precisam.
