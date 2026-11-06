# Testes automáticos

Rodam sozinhos no GitHub (workflow **Testes automáticos**) em toda proposta de mudança e antes de cada publicação.

- `regras.test.mjs`: regras de segurança do Firestore, perfil por perfil (quem lê e quem altera cada coleção).
- `rotinas.test.mjs`: rotinas de `integracao/admin` (dados de importação, administrador, cópia de segurança e restauração).
- `limpeza.test.mjs`: contas da Limpeza de dados (dispensa das pendências antigas, meses protegidos, lotes) — `node --test testes/limpeza.test.mjs`.
- `feriados.test.mjs`: atividades em feriado sem operação (saem da conta com a marca `fe`, voltam quando o feriado sai; R, N e E não mudam) — `node --test testes/feriados.test.mjs`.
- `fotos.test.mjs`: fotos das atividades (configuração e validação, situação que exige foto, contador, refs compartilhadas, contagem por célula `ft`, indicador e estimativa de armazenamento) — `node --test testes/fotos.test.mjs`.
- `fotos-arquivo.test.mjs`: Parte 2 das fotos — relatório e arquivo (situação de cada foto, o que pode ir para a lixeira e ser apagado de vez, lotes, confirmação digitada, nomes das pastas do .zip, índice CSV, conferência do SHA-256, espaço e conteúdo do relatório em PowerPoint) — `node --test testes/fotos-arquivo.test.mjs`.
- `acessos.test.mjs`: conversão do cadastro antigo para o acesso por módulo e o caminho inverso (não precisa do emulador: `node --test testes/acessos.test.mjs`).

Para rodar num computador (precisa de Node 20 e Java 21):

```
npm install --prefix integracao/admin
cd testes
npm install
npm run emulador
```

Os testes usam um projeto de teste (`demo-dikma`) no emulador local; não tocam no banco de verdade.
