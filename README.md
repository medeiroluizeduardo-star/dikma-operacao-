# Dikma Operação

Sistema web da Dikma para a Coqueria. Primeiro módulo: programação e apontamento de atividades do Pátio de Carvão.
Funciona no PC e no celular, com login Google, dados em tempo real para todos e funcionamento sem sinal.

- **Hospedagem:** Firebase Hosting (grátis), endereço `https://SEU-PROJETO.web.app`
- **Banco:** Cloud Firestore (plano grátis Spark)
- **Login:** conta Google
- **Publicação:** automática pelo GitHub a cada alteração. Não precisa instalar nada no computador.

Para ver sem configurar nada, abra `index.html?demo` depois de publicado. Esse modo usa dados de exemplo que ficam só no navegador.

---

## Configuração (uma vez só, tudo pelo navegador, cerca de 20 minutos)

### 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e clique em **Criar um projeto**.
2. Dê um nome, por exemplo `dikma-operacao`. O Google Analytics pode ficar desativado.
3. Anote o **ID do projeto**, que aparece embaixo do nome (ex.: `dikma-operacao-1a2b3`). O endereço do sistema será `https://ID-DO-PROJETO.web.app`.

### 2. Registrar o app web e ativar o Hosting
1. Na página inicial do projeto, clique no ícone **`</>`** (Web).
2. Dê um apelido (ex.: `sistema`) e **marque "Também configurar o Firebase Hosting"**.
3. Clique em **Registrar app**. Nas telas seguintes, só clique em **Avançar** até concluir. Não precisa copiar nenhum código.

### 3. Ativar o login com Google
1. Menu **Criação > Authentication > Vamos começar**.
2. Aba **Método de login > Google > Ativar**, escolha seu e-mail de suporte e **Salvar**.

### 4. Criar o banco de dados
1. Menu **Criação > Firestore Database > Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**.
3. Modo: **produção**. As regras certas são publicadas automaticamente no passo 7.

### 5. Gerar a chave de publicação
1. Clique na engrenagem **⚙ > Configurações do projeto > Contas de serviço**.
2. Clique em **Gerar nova chave privada > Gerar chave**. Um arquivo `.json` é baixado.
3. Abra esse arquivo no Bloco de Notas, selecione tudo e copie. **Não compartilhe esse arquivo com ninguém.**
4. Dê permissão de publicação para essa conta:
   - Abra `https://console.cloud.google.com/iam-admin/iam?project=ID-DO-PROJETO`
   - Na linha `firebase-adminsdk-...@...iam.gserviceaccount.com`, clique no lápis ✏️
   - **Adicionar outro papel** > procure **Administrador do Firebase** > **Salvar**

### 6. Criar o repositório no GitHub
1. Em https://github.com/new crie um repositório **privado**, por exemplo `dikma-operacao`. Ele deve ser criado vazio, sem README.
2. No repositório: **Settings > Secrets and variables > Actions > New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: cole o conteúdo do arquivo `.json` do passo 5
   - **Add secret**

### 7. Enviar os arquivos e publicar
1. Na página do repositório, clique em **uploading an existing file**.
2. Extraia o .zip e arraste **todo o conteúdo da pasta** `sistema-coqueria` (as pastas `public`, `.github` e os arquivos soltos). Clique em **Commit changes**.
3. Abra a aba **Actions**. A publicação "Publicar no Firebase" roda sozinha e termina com ✓ verde em 1 a 2 minutos.
4. Acesse `https://ID-DO-PROJETO.web.app`.

> Se a pasta `.github` não subir: no repositório, clique em **Add file > Create new file**, digite o nome `.github/workflows/deploy.yml` e cole o conteúdo do arquivo do mesmo nome.

### 8. Primeiro acesso
1. Entre com **sua** conta Google primeiro. O primeiro login do sistema vira **Administrador**.
2. Na tela "Primeiro acesso", escolha a semana inicial e clique em **Importar e gerar a programação**. Isso carrega o plano padrão, as rotas, o efetivo e gera o mês atual e os dois seguintes.
3. Peça para cada líder abrir o endereço e entrar com a conta Google. Eles aparecem em **Usuários e acessos** como "Aguardando liberação". Defina o perfil e a área de cada um.

---

## Perfis

| Perfil | O que pode fazer |
|---|---|
| Administrador | Tudo: plano padrão, gerador de meses, rotas, usuários e apontamento em todas as áreas |
| Supervisor / Líder | Vê tudo da própria área, aponta atividades e marca a situação do efetivo |
| Somente leitura | Vê todas as áreas, não altera nada |
| Aguardando liberação | Não vê nada até ser liberado |

As permissões são garantidas pelo servidor (arquivo `firestore.rules`), não só pela tela.

## No celular
Abra o endereço no Chrome (Android) ou Safari (iPhone) e use **Adicionar à tela inicial**. O sistema abre como um aplicativo. Sem sinal, os apontamentos ficam guardados no aparelho e são enviados quando a conexão voltar. O topo da tela mostra **Sem sinal · N aguardando envio**.

## Para alterar o sistema depois
Edite o arquivo direto no GitHub (ícone de lápis) e salve com **Commit changes**. A publicação roda sozinha.

## Arquivos

```
public/
  index.html          visual e estrutura da página
  app.js              telas e regras de negócio
  data.js             conexão com o Firebase (login e banco)
  data-mock.js        modo demonstração (?demo)
  cal.js              calendário operacional (semana pertence ao mês da quinta-feira)
  seed.json           dados extraídos da planilha (usados só na importação)
  vendor/firebase.js  biblioteca do Firebase 10.14.1
  img/                logo da Dikma
  sw.js, manifest.webmanifest, icons/   instalação no celular e uso sem sinal
firestore.rules       regras de segurança por perfil e área
firebase.json         configuração do Hosting
.github/workflows/deploy.yml   publicação automática
```

## Estrutura do banco (Firestore)

| Coleção / documento | Conteúdo |
|---|---|
| `config/sistema` | rotas (efetivo e carga padrão), tipos de atividade, meses gerados |
| `usuarios/{uid}` | nome, e-mail, perfil, área |
| `plano/{ÁREA}` | atividades do plano padrão da área |
| `colaboradores/{ÁREA}` | efetivo da área por rota |
| `situacao/{AAAA-MM}` | folgas, férias, atestados etc. do mês |
| `semanas/{ÁREA\|AAAA-MM-DD}` | programação da semana com o status de cada dia e os motivos |
| `historico` | registro de quem apontou o quê |

Um documento por área e semana mantém cada tela em poucas leituras, dentro do plano grátis (50 mil leituras por dia).

## Problemas comuns
- **Actions falhou com "permission denied" ou "403":** confira o passo 5.4 (papel Administrador do Firebase).
- **Erro citando `serviceusage`:** no mesmo lugar do passo 5.4, adicione também o papel **Consumidor do Service Usage**.
- **Actions falhou com "Falta o secret":** confira o passo 6.2. O nome precisa ser exatamente `FIREBASE_SERVICE_ACCOUNT`.
- **Tela "Sistema ainda não conectado":** faltou registrar o app web (passo 2).
- **Login abre e fecha:** confira o passo 3. No celular, se o pop-up for bloqueado, o sistema usa redirecionamento automaticamente.
