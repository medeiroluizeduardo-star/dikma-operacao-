# Dikma Operação

Sistema web da Dikma para a Coqueria, com quatro módulos:
- **Atividades Pátio:** programação e apontamento de atividades do Pátio de Carvão.
- **Atividades Bateria:** programação e apontamento de atividades da Bateria 1, Bateria 2, Trilho e CDQ (planilha PLANEJAMENTO DE ATIVIDADES BATERIA).
- **Operação:** controle de equipamentos e operadores (planilha CONTROLE DE EQUIPAMENTOS - COQUERIA).
- **Efetivo:** Ficha de Acompanhamento de Funcionário (FO-RED-COQ-004).
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

- **Apagar usuário:** em **Usuários e acessos**, botão **Apagar** na linha da pessoa (pede confirmação). Ela perde o acesso na hora e o nome de usuário fica livre; o que ela registrou continua no sistema. Não dá para apagar a si mesmo nem o único administrador. Para só suspender, use o perfil **Bloqueado**. A conta interna fica no Firebase Authentication e pode ser apagada no console, se quiser (não é obrigatório).

## Módulos e acesso
- Na tela de login a pessoa escolhe **Atividades Pátio**, **Atividades Bateria**, **Operação** ou **Efetivo**. Se ela só tiver acesso a um módulo, entra direto nele.
- Quem tem os dois troca de módulo pelo seletor no topo do menu (no celular: **Mais › Ir para…**).
- Em **Usuários e acessos**, marque os módulos de cada pessoa. O administrador tem acesso a todos.

## Módulo Atividades Bateria
- Tem as mesmas telas do Atividades Pátio: Painel, Programação, Apontar, Escala e efetivo, Pendências, Folha do líder, Relatório fotográfico, Plano padrão, Gerador de meses e Rotas e configurações.
- **Primeiro acesso:** entre como administrador, escolha **Atividades Bateria** e clique em **Importar e gerar a programação**. Isso carrega as 120 atividades do plano padrão, as 18 rotas das áreas Bateria 1, Bateria 2, Trilho e CDQ e os 55 colaboradores, e gera a programação do mês atual e dos dois seguintes.
- Os dados ficam separados dos do Pátio (coleções com o prefixo `b_`).
- Para um líder ou supervisor da Bateria: em **Usuários e acessos**, marque o módulo **Atividades Bateria** e escolha a área dele (Bateria 1, Bateria 2, Trilho ou CDQ).

## Módulo Operação (controle de equipamentos)
- **Primeiro acesso:** entre como administrador, escolha **Operação** e clique em **Importar dados da planilha**. Isso carrega os 25 operadores, as 37 identificações da frota, os turnos, as causas, as metas, os pesos, os feriados e os lançamentos e paradas de setembro e outubro.
- **Painel:** mostra os mesmos indicadores do DASHBOARD da planilha, com semáforo pelas metas:
  - dias operados, horas operadas, disponibilidade física, efetividade, paradas, horas paradas, MTTR e MTBF;
  - operadores ativos, horas extras, paradas sem liberação, destaque do mês, quem está fora da coqueria hoje, nota média, avaliações pendentes e paradas do operador.
  - Abaixo vêm a produtividade por operador, as horas por dia, o Pareto das causas, os equipamentos com mais horas paradas e reincidentes e a classificação dos operadores com a variação em relação ao mês anterior.
- **Lançamentos:** as alocações do dia (equipamento, operador, área, status e horário). O horário vazio usa o turno. O sistema calcula a janela, as horas paradas e as horas operadas. **Copiar do dia anterior** repete as alocações do último dia, deixando de fora quem está ausente ou de folga na escala 4x4.
- **Paradas:** registro com causa e responsabilidade. Sem horário de fim, a parada fica como **sem liberação** até alguém tocar em **Liberar**. Também avisa de inconsistências, como parada sem lançamento correspondente.
- **Equipe e frota:**
  - operadores com função, escala (ADM ou 4x4 por turma), fixo ou não e situação (férias, folga, atestado…) com período;
  - **escala do mês**, que mostra quem foi lançado, quem estava escalado e não foi lançado, as folgas e as ausências;
  - cadastro da frota.
- **Inspeções 5S e segurança:** checklist de 9 itens. As porcentagens entram na nota do operador.
- **Avaliação mensal:** proatividade, 5S e segurança (1 a 5), faltas, atrasos e atestados. A nota é recalculada na hora.
- **Análises:** evolução mês a mês e verificação de consistência dos lançamentos.
- **Configurações** (administrador): turnos, turmas 4x4, metas, pesos e faixas da classificação, causas de parada e feriados.
- Supervisor ou Líder com o módulo Operação lança, registra paradas, inspeções e avaliações e atualiza a situação dos operadores. Somente leitura só consulta.
- As fórmulas reproduzem as da planilha. Conferido em outubro/2026: 8 dias, 59 alocações, 432,42 h previstas, 408,54 h operadas, disponibilidade 94,3%, MTTR 1,63 h, MTBF 27,2 h e nota média 79,4.
- **Diferença em setembro:** os números ficam um pouco diferentes da planilha. Na planilha, as paradas digitadas com apelido (ex.: "VITOR") não se ligavam ao lançamento feito com o nome completo. Na importação o sistema corrige isso, e daqui em diante o operador é escolhido da lista.

## Módulo Efetivo (fichas de acompanhamento)
- **Primeiro acesso:** entre como administrador, escolha **Efetivo** e clique em **Importar dados da planilha**. Isso carrega os 179 colaboradores, as ocorrências já lançadas e os 12 tipos com texto padrão.
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
- **Área de atuação e função (cadastro único):** em **Colaboradores › abrir a ficha › Editar**, o administrador escolhe a **área de atuação** (Coqueria sem rota, uma das áreas do Pátio ou da Bateria com rota e regime, ou Operação de equipamentos) e a **função**. Ao salvar, a mudança vai junto para os outros módulos:
  - **Atividades Pátio e Atividades Bateria:** a pessoa sai da rota antiga e entra na nova (Escala e efetivo), com a função e o regime novos. Pode passar do Pátio para a Bateria e vice-versa. O histórico de faltas e folgas continua com ela no módulo onde foi lançado.
  - **Operação:** marque **Opera equipamentos** para colocar a pessoa na equipe de operadores (com escala ADM ou 4x4 e turma). Desmarcando, ela sai da equipe; os lançamentos antigos continuam no histórico.
  - A ligação entre os módulos é pela matrícula e, na falta dela, pelo nome completo.
  - Quando o administrador muda a função de um operador em **Operação › Equipe e frota**, a função também é atualizada no Efetivo, no Pátio e na Bateria.
- **Filtro por área** no Painel, Colaboradores, Ocorrências e Controle de fichas: por área do RH (Coqueria - Pátio, Alto Forno, Sinter…), por setor (Coqueria - Recebimento, Alto Forno - Carregamento AF1…) ou pela área de atuação no sistema. O filtro escolhido vale para todas essas telas.
- **Excluir colaboradores** (administrador): na ficha, botão **Excluir**; na lista, marque as caixas e use **Excluir selecionados**. Dá para tirar a pessoa também de Atividades Pátio, Atividades Bateria e Operação e, se quiser, apagar as ocorrências dela. Pede confirmação e não dá para desfazer.
- Quem tem acesso ao Efetivo com perfil **Supervisor** ou **Líder** registra ocorrências e colhe assinaturas. Com **Somente leitura**, só consulta. Excluir ocorrências e editar o cadastro é só do administrador.

## Efetivo › Importar dados (administrador)
- **Importar planilha:** escolha um arquivo Excel (.xlsx, .xlsm, .xls) ou CSV. O sistema acha sozinho a tabela de colaboradores (colunas MATRÍCULA, NOME, FUNÇÃO, ÁREA, ROTA, REGIME, TURMA, LÍDER, ADMISSÃO, DEMISSÃO; só nome e matrícula são obrigatórios) e, se houver, a de ocorrências.
  - Serve a própria planilha de fichas, a aba EFETIVO das planilhas do Pátio e da Bateria (a pessoa é achada pelo nome) ou uma lista do RH. O botão **Baixar modelo** traz um CSV pronto para preencher.
  - Antes de gravar aparece a **conferência**: quantos são novos, quantos mudam (e o que muda), quantos estão sem matrícula, os avisos e as ocorrências novas. Nada é apagado e nada é duplicado.
  - Com **Levar área de atuação e função…** marcado, a área, a rota e a função importadas vão também para Atividades Pátio, Atividades Bateria e Operação. A área COQUERIA não tira ninguém da rota onde já está.
- **Planilha EFETIVO PARA O SISTEMA:** a lista do RH (450 colaboradores) já vem dentro do sistema. O botão **Conferir e atualizar** atualiza função, área e setor do RH, regime, turma, líder e admissão; cadastra quem falta; e leva a área e a função para os outros módulos. Opção para excluir quem não está na lista.
  - Como a planilha do RH traz o setor ("Coqueria - Recebimento", "Coqueria - Bateria - Trilho"…) e não a rota, quem já está numa área compatível continua na rota onde está; quem muda de área vai para a rota padrão da área. "Coqueria - Pátio de Carvão" não diz a área exata: a pessoa fica como está e aparece nos avisos.
  - Áreas fora da Coqueria (Alto Forno, Sinter, Utilidade, Sede) entram no Efetivo e saem de Atividades Pátio e Bateria. A equipe de Operação não é mexida.
- **Planilha original de fichas:** traz de novo o que estiver faltando da planilha FO-RED-COQ-004.
- **Pessoas sem ficha no Efetivo:** lista quem está no Pátio, na Bateria ou na Operação e ainda não tem ficha. O botão **Cadastrar** abre a ficha já preenchida: falta só a matrícula.

## Fotos e arquivos (evidências)
- Em **Apontar**, cada atividade tem o botão da câmera: **Tirar foto** abre a câmera do celular, e **Galeria ou arquivo** aceita imagens, PDF, Word, Excel e texto.
- Na **Programação**, toque no dia da atividade e escolha **Fotos e arquivos**. Os dias com anexo têm um ponto laranja no canto.
- A foto é reduzida automaticamente (máx. 1600 px) e recebe um carimbo com **data, hora, atividade e usuário** de quem enviou.
- Até **6 fotos ou arquivos** por atividade em cada dia.
- Arquivos que não são foto podem ter até **700 KB**.
- Sem sinal, o anexo fica guardado no aparelho e sobe quando a conexão voltar.
- Quem enviou pode excluir o próprio anexo. O administrador pode excluir qualquer um.
- **Validação por foto:** em **Rotas e configurações**, ligue **Exigir foto ao marcar uma atividade como realizada**. Com isso, o ✓ só conclui depois de anexar uma foto.
- **Relatório fotográfico** (menu Acompanhar do Atividades Pátio): mostra as fotos do mês ou de uma semana, separadas por **rota**, com a atividade, o dia e a situação. Toque na miniatura para abrir a foto. **Imprimir / salvar PDF** gera uma página por rota com as fotos em boa qualidade (até 60 fotos por impressão; para mais, filtre por semana ou rota).
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
  app.js              telas e regras de negócio (módulo Atividades Pátio)
  equip.js, eqcalc.js módulo Operação (equipamentos) e as fórmulas dos indicadores
  seed-equip.json     dados da planilha de equipamentos (usados só na importação)
  gestao.js           módulo Efetivo (fichas de acompanhamento)
  pessoas.js          cadastro único: leva área de atuação e função para todos os módulos
  importar.js         Efetivo › Importar dados (lê Excel e CSV)
  movimento.js        animações e fluidez (entrada de tela, menu, janelas, números, rolagem)
  seed-bateria.json   dados da planilha da Bateria (usados só na importação)
  seed-efetivo.json   planilha EFETIVO PARA O SISTEMA do RH (usada em Efetivo › Importar dados)
  vendor/xlsx.js      leitor de planilhas SheetJS 0.18.5 (carregado só na importação)
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
| `eq/config`, `eq/cadastro` | Operação: turnos, causas, metas, pesos, feriados · operadores e frota |
| `eqlanc`, `eqpar`, `eqinsp` | Operação: lançamentos, paradas e inspeções (campo `mes`) |
| `eqaval/{AAAA-MM}` | Operação: avaliação mensal dos operadores |
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
