# Planilhas de importação (só no seu computador)

As planilhas originais (`seed*.json`, com nomes, matrículas, férias e frequência) **não ficam mais no repositório**,
por causa da LGPD. Desde 07/11/2026 elas estão só no banco (coleção `seeds/`), onde apenas a administração do
módulo lê, e entram na cópia de segurança diária (workflow `backup`).

O Git ignora tudo nesta pasta, menos este arquivo.

Para atualizar os dados no banco:
1. Coloque os arquivos `seed*.json` nesta pasta, no seu computador.
2. Rode `node integracao/admin/enviar-dados.mjs` com o segredo `FIREBASE_SERVICE_ACCOUNT` (só grava o que mudou).
3. Se os nomes mudaram, rode também `node ferramentas/conferir-site.mjs --atualizar-nomes` e
   `node ferramentas/gerar-demo.mjs`, e mande essas mudanças numa proposta (PR).
4. Apague os arquivos da pasta quando terminar.
