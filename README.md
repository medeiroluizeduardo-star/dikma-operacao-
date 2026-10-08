# Dikma Operação

Sistema web da Dikma para a Coqueria, com dois módulos:
- **Operação:** programação e apontamento de atividades do Pátio de Carvão.
- **Gestão:** Ficha de Acompanhamento de Funcionário (FO-RED-COQ-004).
Funciona no PC e no celular, com login por usuário e senha, dados em tempo real para todos e funcionamento sem sinal.

- **Hospedagem:** Firebase Hosting (grátis), endereço `https://SEU-PROJETO.web.app`
- **Banco:** Cloud Firestore (plano grátis Spark)
- **Login:** usuário e senha, cadastrados só pelo administrador
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

### 3. Ativar o login por senha
1. Menu **Segurança > Authentication > Vamos começar**.
2. Aba **Método de login > E-mail/senha**: ligue só a primeira chave (**E-mail/senha**) e **Salvar**. A opção "Link do e-mail" fica desligada.
3. Em **Configurações > Ações do usuário**, deixe **Ativar criação (inscrição)** ligado. É por ela que o administrador cadastra as pessoas pela tela do sistema. Quem se cadastrar por fora não entra, porque não tem perfil no sistema.

### 4. Criar o banco de dados
1. Menu **Bancos de dados e armazenamento > Firestore > Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)**.
3. Modo: **produção**. As regras certas são publicadas automaticamente no passo 7.

### 5. Gerar a chave de publicação
1. Clique na engrenagem **⚙ > Configurações do projeto > Contas de serviço**.
2. Clique em **Gerar nova chave privada > Gerar chave**. Um arquivo `.json` é baixado.
3. Abra esse arquivo no Bloco de Notas, selecione tudo e copie. **Não compartilhe esse arquivo com ninguém.**
4. Dê permissão de publicação para essa conta:
   - Abra `https://console.cloud.google.com/iam-admin/iam?project=ID-DO-PROJETO`
   - Na linha `firebase-adminsdk-...@...iam.gserviceaccount.com`, clique no lápis ✏️
   - **Adicionar outro papel** > **Administrador do Firebase**, e de novo **Adicionar outro papel** > **Consumidor do Service Usage** > **Salvar**

### 6. Criar o repositório no GitHub
1. Em https://github.com/new crie um repositório **privado**, por exemplo `dikma-operacao`. Ele deve ser criado vazio, sem README.
2. No repositório: **Settings > Secrets and variables > Actions > New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: cole o conteúdo do arquivo `.json` do passo 5
   - **Add secret**

### 7. Enviar os arquivos e publicar
1. Na página do repositório, clique em **uploading an existing file**.
2. Extraia o .zip e arraste **todo o conteúdo da pasta** `dikma-operacao` (as pastas `public`, `.github` e os arquivos soltos). Clique em **Commit changes**.
3. Abra a aba **Actions**. A publicação "Publicar no Firebase" roda sozinha e termina com ✓ verde em 1 a 2 minutos.
4. Acesse `https://ID-DO-PROJETO.web.app`.

> Se a pasta `.github` não subir: no repositório, clique em **Add file > Create new file**, digite o nome `.github/workflows/deploy.yml` e cole o conteúdo do arquivo do mesmo nome.

### 8. Primeiro acesso
1. Abra o endereço. Como ainda não existe administrador, aparece a tela **Primeiro acesso**: informe seu nome, um usuário (ex.: `luiz.eduardo`) e uma senha.
2. Na tela seguinte, escolha a semana inicial e clique em **Importar e gerar a programação**. Isso carrega o plano padrão, as rotas, o efetivo e gera o mês atual e os dois seguintes.
3. Em **Usuários e acessos**, cadastre cada líder: nome, usuário, perfil e área. O sistema sugere uma senha provisória e mostra os dados para você passar à pessoa. No primeiro acesso ela cria a própria senha.

## Usuários e senhas
- Só o administrador cadastra pessoas, em **Usuários e acessos**.
- Usuário: de 3 a 30 caracteres, letras minúsculas, números, ponto, hífen ou sublinhado. Sem espaço e sem acento.
- Esqueceu a senha: o administrador clica em **Redefinir senha** na linha da pessoa e passa a nova senha provisória.
- Cada pessoa troca a própria senha em **Alterar senha** (menu lateral ou **Mais** no celular).
- Para tirar o acesso de alguém, mude o perfil para **Bloqueado**.

> Por dentro, o Firebase guarda cada usuário com um e-mail interno gerado pelo sistema (`...@usuarios.dikma.app`). Ninguém precisa saber dele nem recebe nada nesse endereço.

---

## Módulos e acesso
- Na tela de login a pessoa escolhe **Operação** ou **Gestão**. Se ela só tiver acesso a um módulo, entra direto nele.
- Quem tem os dois troca de módulo pelo seletor no topo do menu (no celular: **Mais › Ir para…**).
- Em **Usuários e acessos**, marque os módulos de cada pessoa. O administrador tem acesso aos dois.

## Módulo Gestão (fichas de acompanhamento)
- **Primeiro acesso:** entre como administrador, escolha **Gestão** e clique em **Importar dados da planilha**. Isso carrega os 179 colaboradores, as ocorrências já lançadas e os 12 tipos com texto padrão.
- **Painel:** fichas em dia, ativos, em experiência, integração completa, assinaturas pendentes e recusas. Mostra também as ocorrências por mês e por tipo e alertas de experiência (45 e 90 dias), integração incompleta e assinatura parada há mais de 7 dias.
- **Colaboradores:** busca, filtros e a ficha de cada pessoa, com a Folha 1 (integração) e a Folha 2 (ocorrências). O administrador cadastra, edita e informa a demissão.
- **Ocorrências:** registro com o texto padrão do tipo e acompanhamento da situação (aguardando, assinada ou recusada).
- **Assinatura, de três formas:**
  1. **Na tela:** o colaborador e o responsável Dikma assinam com o dedo.
  2. **Via em papel:** imprima a via, colha as assinaturas e fotografe a folha assinada.
  3. **Recusou:** informe as testemunhas.
- **Controle de fichas:** grade com as datas da integração, Folha 2 (de 33), pendências e status de cada um.
- **Impressão:** ficha (Folhas 1 e 2, com as assinaturas feitas na tela) e via de assinatura com código de controle.
- **Tipos de ocorrência** (administrador): até 5 vão para a Folha 1, na ordem da posição.
- Quem tem acesso à Gestão com perfil **Supervisor** ou **Líder** registra ocorrências e colhe assinaturas. Com **Somente leitura**, só consulta. Excluir ocorrências e editar o cadastro é só do administrador.

## Fotos e arquivos (evidências)
- Em **Apontar**, cada atividade tem o botão da câmera: **Tirar foto** abre a câmera do celular, e **Galeria ou arquivo** aceita imagens, PDF, Word, Excel e texto.
- Na **Programação**, toque no dia da atividade e escolha **Fotos e arquivos**. Os dias com anexo têm um ponto laranja no canto.
- A foto é reduzida automaticamente (máx. 1600 px) e recebe um carimbo com **data, hora, atividade e usuário** de quem enviou.
- Até **6 fotos ou arquivos** por atividade em cada dia.
- Arquivos que não são foto podem ter até **700 KB**.
- Sem sinal, o anexo fica guardado no aparelho e sobe quando a conexão voltar.
- Quem enviou pode excluir o próprio anexo. O administrador pode excluir qualquer um.
- **Validação por foto:** em **Rotas e configurações**, ligue **Exigir foto ao marcar uma atividade como realizada**. Com isso, o ✓ só conclui depois de anexar uma foto.
- Os anexos ficam no próprio Firestore, que tem 1 GB grátis. Isso dá cerca de 5 a 8 mil fotos. Se um dia precisar de mais espaço, dá para migrar para o Firebase Storage (plano Blaze).

## Perfis

| Perfil | O que pode fazer |
|---|---|
| Administrador | Tudo: plano padrão, gerador de meses, rotas, usuários e apontamento em todas as áreas |
| Supervisor / Líder | Vê tudo da própria área, aponta atividades e marca a situação do efetivo |
| Somente leitura | Vê todas as áreas, não altera nada |
| Bloqueado | Não entra no sistema |

As permissões são garantidas pelo servidor (arquivo `firestore.rules`), não só pela tela.

## No celular
Abra o endereço no Chrome (Android) ou Safari (iPhone) e use **Adicionar à tela inicial**. O sistema abre como um aplicativo. Sem sinal, os apontamentos ficam guardados no aparelho e são enviados quando a conexão voltar. O topo da tela mostra **Sem sinal · N aguardando envio**.

## Para alterar o sistema depois
Edite o arquivo direto no GitHub (ícone de lápis) e salve com **Commit changes**. A publicação roda sozinha.

## Arquivos

```
public/
  index.html          visual e estrutura da página
  app.js              telas e regras de negócio (módulo Operação)
  gestao.js           módulo Gestão (fichas de acompanhamento)
  seed-gestao.json    dados da planilha de fichas (usados só na importação)
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
| `usuarios/{uid}` | nome, usuário, perfil, área |
| `logins/{usuario}` | liga o usuário digitado à conta interna do Firebase |
| `plano/{ÁREA}` | atividades do plano padrão da área |
| `colaboradores/{ÁREA}` | efetivo da área por rota |
| `situacao/{AAAA-MM}` | folgas, férias, atestados etc. do mês |
| `semanas/{ÁREA\|AAAA-MM-DD}` | programação da semana com o status de cada dia e os motivos |
| `historico` | registro de quem apontou o quê |
| `gestao/config` | código e revisão da ficha, declaração, tipos de ocorrência |
| `gestao/colaboradores` | colaboradores da Gestão (matrícula, nome, admissão, demissão…) |
| `gocorr/{id}` | ocorrências (data, tipo, descrição, situação da assinatura) |
| `gassin/{id}` | assinaturas (na tela, foto da via em papel ou recusa com testemunhas) |
| `evidencias/{id}` | lista de anexos com miniatura (atividade, dia, quem enviou) |
| `evidenciasArquivo/{id}` | foto ou arquivo completo, lido só ao abrir |

Um documento por área e semana mantém cada tela em poucas leituras, dentro do plano grátis (50 mil leituras por dia).

## Problemas comuns
- **Actions falhou com "permission denied" ou "403":** confira o passo 5.4 (papel Administrador do Firebase).
- **Erro citando `serviceusage`:** no mesmo lugar do passo 5.4, adicione também o papel **Consumidor do Service Usage**.
- **Actions falhou com "Falta o secret":** confira o passo 6.2. O nome precisa ser exatamente `FIREBASE_SERVICE_ACCOUNT`.
- **Tela "Sistema ainda não conectado":** faltou registrar o app web (passo 2).
- **"O login por senha não está ativado":** confira o passo 3.
