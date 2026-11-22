# ESLint (conferência de erros comuns no JavaScript)

O ESLint lê todo o JavaScript do repositório (site em `public/`, rotinas em `integracao/`, `ferramentas/` e
`testes/`; fica de fora só `public/vendor/`) e aponta problemas comuns: variável usada sem existir, nome
repetido num objeto, variável criada e nunca usada etc.

- **Por enquanto só avisa.** Todas as regras estão como aviso (`warn`) e o passo da CI tem
  `continue-on-error`: nada aqui trava a CI nem a publicação. Os avisos aparecem em amarelo no PR
  (aba "Files changed" e no resumo do job `testar`).
- Rodar no computador: `cd testes && npm install && npm run estilo`.
- Configuração: `eslint.config.mjs` na raiz (regras recomendadas do ESLint, todas como aviso).
  Formato das anotações do GitHub: `ferramentas/eslint/formato-github.mjs`.
- Próximo passo (depois de zerar os avisos): trocar algumas regras para erro (`error`), começando
  por `no-undef` e `no-dupe-keys`, e tirar o `continue-on-error`.
