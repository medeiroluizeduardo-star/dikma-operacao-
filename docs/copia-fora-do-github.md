# Cópia mensal fora do GitHub

Todas as cópias de segurança do banco ficam no GitHub. Se a conta do GitHub travar ou for perdida, elas somem junto
com o código do sistema. Por isso, uma vez por mês, um pacote com tudo vai para fora do GitHub (Drive da empresa).

## Como funciona

- Todo dia 1º, às 7h (Brasília), a rotina **"Cópia mensal para guardar fora do GitHub"** (`.github/workflows/copia-mensal.yml`)
  monta o pacote `copia-mensal-AAAA-MM`:
  - `copia/`: a cópia semanal mais recente do banco (todas as coleções, com o histórico e a lista de fotos);
  - `sistema/`: o código do site e das rotinas, do jeito que está na `main`;
  - `LEIA-ME.md` (este guia) e `SOBRE.txt` (de quando é cada parte).
- Ela abre um aviso (Issue) para você no GitHub, que chega por e-mail com o link para baixar.
- Não lê nem grava o banco (não gasta cota). O pacote fica 90 dias no GitHub.
- Dá para gerar um pacote na hora: Actions › Cópia mensal para guardar fora do GitHub › Run workflow.

## Os 5 passos de todo mês

1. **Abra o e-mail do aviso** "Guardar a cópia mensal AAAA-MM fora do GitHub" e clique no link do pacote (precisa estar entrando no GitHub).
2. **Não abra nem mexa** no `.zip`: guarde do jeito que veio.
3. **Guarde no Drive da empresa**, numa pasta restrita (ex.: `Dikma Gestão - Cópias de segurança`), só com acesso seu e de quem você confiar.
   O pacote tem dados pessoais dos colaboradores (nomes, matrículas, ASO, férias).
4. **Apague do Drive** os pacotes com mais de 12 meses (fica um por mês).
5. **Feche o aviso** no GitHub (botão *Close issue*). Assim fica registrado que a cópia do mês está guardada.

Se um aviso de um mês anterior ainda estiver aberto, o aviso novo lembra.

## Como restaurar sem o GitHub (só em emergência)

Se o GitHub estiver funcionando, use a rotina **"Restaurar cópia de segurança"** (é mais simples). Sem o GitHub:

1. Num computador com o [Node.js 22](https://nodejs.org), descompacte o pacote do mês.
2. Pegue uma chave do banco: console do Firebase › Configurações do projeto › Contas de serviço › **Gerar nova chave privada**.
   Salve o arquivo como `chave.json` ao lado da pasta do pacote (não dentro dela) e **não envie para ninguém**.
3. Abra o terminal na pasta `sistema` do pacote e instale: `npm install --prefix integracao/admin`
4. Primeiro **só confira** o que mudaria (nada é gravado):
   - Windows (PowerShell):
     ```
     $env:FIREBASE_SERVICE_ACCOUNT = Get-Content ..\..\chave.json -Raw
     $env:RESTAURAR_PASTA = "..\copia"
     $env:RESTAURAR_COLECOES = "todas"
     node integracao/admin/restaurar.mjs
     ```
   - Mac/Linux: `FIREBASE_SERVICE_ACCOUNT="$(cat ../../chave.json)" RESTAURAR_PASTA=../copia RESTAURAR_COLECOES=todas node integracao/admin/restaurar.mjs`
5. Se estiver certo, rode de novo com `RESTAURAR_APLICAR=1` para gravar de verdade. Antes de gravar, ele guarda o estado atual
   na pasta `antes` (dá para desfazer). Depois, apague a chave do console do Firebase e do computador.

Para pôr o site no ar de novo sem o GitHub: na pasta `sistema`, `npx firebase-tools deploy --only hosting` (entrando com a conta Google dona do projeto).
