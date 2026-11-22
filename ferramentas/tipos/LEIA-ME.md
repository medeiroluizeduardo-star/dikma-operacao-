# Checagem de tipos (só `public/contas/`)

O TypeScript lê os arquivos de `public/contas/` (JavaScript puro, sem build) e acusa erros comuns
antes de chegarem ao site: nome de campo errado, função chamada com argumentos a mais, conta com data
sem virar número etc. Nada muda no site: é só uma conferência, roda na CI (job `testar`).

- Rodar no computador: `cd testes && npm install && npm run tipos` (sem erros = sem saída).
- O modo é o leve (`strict: false`). Onde o TypeScript não adivinha o tipo, um comentário JSDoc
  (`/** @param {...} */` ou `/** @type {...} */`) explica.
- Datas em conta: usar `+data` (vira número), ex.: `(+fim - +inicio) / 864e5`.
