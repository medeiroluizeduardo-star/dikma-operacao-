# Dikma Gestão

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

> Se a pasta `.github` não subir: no repositório, clique em **Add file > Create new file**, digite o nome `.github/workflows/blank.yml` e cole o conteúdo do arquivo do mesmo nome.

### 8. Primeiro acesso
1. No GitHub: **Actions › Administrador do sistema › Run workflow**. Informe seu usuário (ex.: `luiz.eduardo`) e seu nome e clique em **Run workflow**.
2. Abra a execução que terminou (✓ verde). O resumo mostra a **senha provisória**.
3. Abra o endereço do sistema e entre com o usuário e a senha provisória. O sistema pede uma senha nova.
4. Na tela seguinte, escolha a semana inicial e clique em **Importar e gerar a programação**. Isso carrega o plano padrão, as rotas, o efetivo e gera o mês atual e os dois seguintes.
5. Em **Usuários e acessos**, cadastre cada líder: nome, usuário, perfil e área. O sistema sugere uma senha provisória e mostra os dados para você passar à pessoa. No primeiro acesso ela cria a própria senha.

## Usuários e senhas
- Só o administrador cadastra pessoas, em **Usuários e acessos**.
- Usuário: de 3 a 30 caracteres, letras minúsculas, números, ponto, hífen ou sublinhado. Sem espaço e sem acento.
- Esqueceu a senha: o administrador clica em **Redefinir senha** na linha da pessoa e passa a nova senha provisória.
- Cada pessoa troca a própria senha em **Alterar senha** (menu lateral ou **Mais** no celular).
- Para tirar o acesso de alguém, mude o perfil para **Bloqueado**.
- **Administrador sem acesso** (esqueceu a senha, perfil trocado por engano, conta apagada): no GitHub, **Actions › Administrador do sistema › Run workflow** com o usuário dele (o nome só é preciso se o usuário não existir). O resumo da execução mostra uma senha provisória. A mesma rotina promove um usuário existente a administrador.
- Por segurança, ninguém vira administrador pelo site: só por essa rotina, que exige acesso ao repositório do GitHub.

## Efetivo por área
- As fichas ficam divididas por área de atuação (`gcolab/{ÁREA}`): cada área das Atividades, **Operação de equipamentos** e **GERAL** (sem área no sistema: Coqueria sem rota, Alto Forno, Sinter, Sede…). Ocorrências e assinaturas guardam a mesma área.
- **Quem vê:** administrador, gestor, coordenador e somente leitura (com o Efetivo) veem todas as áreas. Supervisor vê as 2 áreas dele; líder, a área dele. Quem tem a Operação de equipamentos também vê os operadores. Líder e supervisor veem ainda as ocorrências que registraram e as que vão recolher.
- Quem muda de área leva junto a ficha, as ocorrências e as assinaturas. O sistema reorganiza sozinho quando o administrador abre o Efetivo.
- Na primeira publicação depois desta mudança, a rotina `integracao/admin/migrar-areas.mjs` dividiu a lista antiga por área.

## Segurança dos dados
- **Planilhas originais fora do site.** Os dados das planilhas (`seed*.json`, com nomes, matrículas e ocorrências) ficam na pasta `dados-importacao` do repositório. Na publicação, eles são gravados no banco (`seeds/`), e só a administração do módulo correspondente lê. Os botões de importação continuam iguais.
- **A demonstração (`?demo`) usa nomes e matrículas fictícios** (pasta `public/demo`). Se os arquivos de `dados-importacao` mudarem, gere de novo com `node ferramentas/gerar-demo.mjs`.
- **Conferência antes de publicar:** se algum arquivo de planilha ou nome real de colaborador aparecer na pasta `public`, a publicação para com erro.
- **Testes automáticos das regras:** antes de cada publicação, o GitHub roda os testes de `testes/` no emulador do Firebase. Eles conferem, perfil por perfil, quem lê e quem altera cada parte do banco (ex.: líder sem o Efetivo não lê ocorrências; ninguém se promove a administrador; assinatura gravada não muda). Se algum falhar, nada é publicado. Mudou as regras de propósito? Ajuste o teste correspondente em `testes/regras.test.mjs`.
- **Propostas de mudança (pull request):** os mesmos testes rodam na proposta, antes de ela entrar na `main`.
- **Senhas:** no mínimo 8 caracteres, sem sequências óbvias (12345678, senha123, dikma123…) e sem o próprio usuário ou nome. Vale para senhas novas.
- **Sessão:** depois de 7 dias sem abrir o sistema naquele aparelho, ele pede a senha de novo.
- **Cabeçalhos de proteção no site** (`firebase.json`): o sistema não abre dentro de outro site e só carrega código do próprio endereço e do Google (Firebase e fontes).
- **Leitor de planilhas** SheetJS 0.20.3, sem as falhas conhecidas da 0.18.5.

## Exportar para o Excel

Botão **Exportar** (computador) em: Folha do líder (a programação da semana), Efetivo diário (a semana da área escolhida, com legenda), Colaboradores (as ocorrências de quem está na lista), Lançamentos e paradas (lançamentos do mês inteiro, com horas operadas e paradas; paradas do mês), Frequência e Férias. Baixa um arquivo .xlsx.

## Contas sem usuário

Quando a senha de alguém é redefinida pelo site, a conta de login antiga fica sem uso. A rotina **Limpar contas sem usuário** (GitHub › Actions) roda todo dia 1 e apaga as que não têm usuário, não estão ligadas a nenhum login e estão há mais de 30 dias sem uso. Pelo botão Run workflow dá para só listar.

## Cópia de segurança
Rotina **Cópia de segurança** (`.github/workflows/backup.yml`), todo dia às 3h:
- **Diária:** todas as coleções, menos o histórico e as fotos. Fica guardada 30 dias.
- **Semanal (domingo):** inclui o histórico e a lista de fotos com miniatura. Fica guardada 90 dias.
- **Completa (só manual, Run workflow):** inclui as fotos e arquivos em tamanho cheio. Fica 7 dias. É pesada: use quando quiser baixar tudo para um computador.
- O resumo de cada execução mostra quantos documentos foram lidos (contam na cota grátis de 50 mil leituras por dia) e o tamanho do pacote. O GitHub grátis guarda até 500 MB de pacotes em repositório privado.
- Para baixar: abra a execução e clique no pacote em **Artifacts**.

**Restaurar** (rotina **Restaurar cópia de segurança**, Run workflow):
1. Pegue o número da execução da cópia (está no resumo dela e no endereço: `.../actions/runs/NÚMERO`).
2. Informe as coleções (`todas` ou, por exemplo, `gestao,gocorr`) e, se for um item só, os documentos.
3. Rode primeiro **sem** marcar *Aplicar de verdade*: o resumo mostra quantos documentos voltariam e quantos já estão iguais.
4. Rode de novo marcando *Aplicar de verdade*. O estado de antes fica no pacote **estado-antes-da-restauracao** daquela execução; para desfazer, restaure informando o número dela.
- *Apagar o que foi criado depois da cópia* remove, nas coleções escolhidas, os documentos que não existiam na cópia.
- Cada documento gravado conta na cota grátis de 20 mil gravações por dia.

> Por dentro, o Firebase guarda cada usuário com um e-mail interno gerado pelo sistema (`...@usuarios.dikma.app`). Ninguém precisa saber dele nem recebe nada nesse endereço.

---

- **Apagar usuário:** em **Usuários e acessos**, botão **Apagar** na linha da pessoa (pede confirmação). Ela perde o acesso na hora e o nome de usuário fica livre; o que ela registrou continua no sistema. Não dá para apagar a si mesmo nem o único administrador. Para só suspender, use o perfil **Bloqueado**. A conta interna fica no Firebase Authentication e pode ser apagada no console, se quiser (não é obrigatório).

## Uso no dia a dia (telas)
- **Busca rápida:** lupa no topo (no computador, Ctrl+K ou /). Acha pessoa, ficha, equipamento, rota ou tela e leva direto para lá.
- **Filtro no celular:** mês, semana e área ficam numa linha só no topo; tocar abre o painel para escolher.
- **Apontar:** abre direto na área e na rota (a última usada, ou a que tem mais coisa para apontar). Áreas e rotas ficam numa linha que desliza para o lado, com a quantidade pendente. O progresso fica preso no topo ao rolar. Ao terminar uma rota, o sistema oferece a próxima.
- **Programação:** a aba foi tirada (Pátio e Bateria). O dia a dia fica no **Apontar**, o atrasado em **Pendências** e a semana impressa e exportada na **Folha do líder**.
- **Efetivo diário:** com muitas rotas na tela, elas começam fechadas com "presentes hoje"; toque para ver as pessoas. A legenda das siglas fica em **Legenda das siglas**.
- **Pendências:** o número no menu conta só os atrasos dos últimos 7 dias da sua área.
- **Aprovação** (supervisor, coordenador, gestor e administrador): cada apontamento do líder (realizada, não realizada ou extra) fica com o selo **aguardando aprovação** e já conta nos números. Na aba **Aprovação**, por rota e dia, o supervisor **aprova** (um por um, a rota inteira ou tudo) ou **devolve** com o motivo: a atividade volta para "a fazer" e o líder vê, no Apontar e no Meu dia, o motivo para corrigir. O que o supervisor (ou acima) aponta já entra aprovado. O número no menu mostra quantos esperam; o Painel avisa também. Vale a partir dos apontamentos de 15/10/2026.

## Meu dia
- **Agora:** até 3 itens, do mais urgente para o menos, cada um com o botão que resolve (Apontar, Recolher, Abrir…). O resto fica em **Mais**.
- **Hoje:** o progresso do dia por módulo e os números de apoio (quem falta, etc.).
- É a primeira tela depois de entrar (e o primeiro item do menu em todos os módulos; no celular, a aba **Hoje**).
- Mostra só o que é da pessoa hoje, nos módulos dela e nas áreas dela: atividades para apontar e atrasadas (Pátio e Bateria, por rota), quem falta hoje, déficit de efetivo amanhã, paradas sem liberação, operadores fora, assinaturas pendentes e experiências vencendo.
- Cada número leva direto para a tela certa (Apontar, Pendências, Escala, Paradas, Ocorrências).
- Líder vê a área dele; supervisor, as duas; coordenador, gestor, somente leitura e administrador veem todas as áreas dos módulos deles.

## Avisos no celular
Uma rotina do GitHub (workflow **Avisos no celular**, arquivo `.github/workflows/avisos.yml`) roda de hora em hora, das 6h às 22h, e manda avisos para quem ligou no aparelho. Cada pessoa recebe só o que é dela, e os avisos não mostram nomes de colaboradores na tela bloqueada:
- **Parada sem liberação há mais de 2 horas** (uma vez por parada) — para quem tem o módulo Operação.
- **Assinatura pendente há mais de 7 dias** (um resumo por dia, a partir das 8h) — para quem vai recolher a assinatura e, nas áreas da pessoa, as que estão sem responsável (supervisor: todas da área). Administrador, gestor e coordenador recebem o total. Somente leitura não recebe.
- **Atividades do dia sem apontar** (às 15h, uma vez por dia, só se faltar alguma) — para líder e supervisor, das áreas deles.
- **Rota com déficit de efetivo amanhã** (às 17h, uma vez por dia) — só das áreas da pessoa.
- **Resumo da semana que passou** (segunda-feira, às 7h) — para administrador, gestor e coordenador: % de atividades realizadas, não realizadas, faltas e atestados de cada conjunto, assinaturas pendentes e paradas sem liberação. Sem nomes de colaboradores.
- Tocar no aviso abre a tela certa (Lançamentos e paradas, Colaboradores, Apontar ou Efetivo diário).
- O administrador vê no **Meu dia** quando a rotina rodou pela última vez, quantas pessoas e aparelhos estão com aviso ligado e quantos avisos foram entregues.

**Ligar (uma vez só, administrador)**
1. Firebase › ⚙ Configurações do projeto › **Cloud Messaging** › Configuração da Web › **Certificados push da Web** › **Gerar par de chaves**. Copie a chave (começa com B…).
2. No sistema, abra **Meu dia** › **Avisos no celular**, cole a chave e clique em **Salvar chave**. É uma chave pública; pode ficar no sistema.
3. No GitHub, crie o arquivo `.github/workflows/avisos.yml` (Add file › Create new file) com o conteúdo do zip. Ele usa o `FIREBASE_SERVICE_ACCOUNT` que já existe.

**Cada pessoa, no próprio celular**
- Abrir o sistema, ir em **Meu dia** › **Ligar avisos** e permitir as notificações. Dá para marcar quais avisos quer receber.
- Android (Chrome): funciona direto. iPhone: primeiro **Compartilhar › Adicionar à Tela de Início** e abrir o sistema por esse ícone (iOS 16.4 ou mais novo).
- **Testar neste aparelho** mostra um aviso na hora, para conferir que as notificações estão permitidas.

**Testar:** GitHub › Actions › **Avisos no celular** › Run workflow com **Só testar** marcado: o registro mostra quem receberia o quê, sem enviar.

Observações: as rotinas agendadas do GitHub podem atrasar alguns minutos. Em repositório privado, o GitHub dá 2.000 minutos grátis por mês; esta rotina usa cerca de 500. Em repositório público, não há limite, mas o GitHub pausa rotinas agendadas depois de 60 dias sem nenhuma alteração no repositório (basta reativar em Actions).

## Acessos: Operação e Administração do sistema

Ao abrir o sistema aparece só a tela de usuário e senha, e todo mundo entra na **Operação**. A **Administração do sistema** só aparece para o administrador: lá dentro, o botão **Administração do sistema** (no menu lateral ou em **Mais**, no celular) abre os ajustes, e **Voltar para a Operação** volta. Os demais perfis nunca veem esse acesso.

| Acesso | O que tem | Quem entra |
|---|---|---|
| **Operação** | os módulos marcados no usuário: Atividades Pátio, Atividades Bateria, Operação (equipamentos), Efetivo e **Frequência e férias**, mais o Meu dia | todos os usuários |
| **Administração do sistema** | Visão geral, Conferência do cadastro, Uso do plano grátis, Escalas, configurações de cada módulo, Usuários e acessos, Perfis e permissões | só o administrador |

- Em **Usuários e acessos**, marque os módulos de cada pessoa (inclusive **Frequência e férias**). Em **Perfis e permissões**, escolha o que cada perfil vê dentro de cada módulo, Frequência e férias inclusive (por exemplo, ligar **Importar planilhas** para o gestor).
- O antigo acesso **Administrativo** virou o módulo Frequência e férias: quem tinha o acesso marcado continua entrando, agora pela Operação, e já fica com o módulo.

### Causas e ações, prazo de aprovação, lembretes e modo TV
- **Causas e ações** (Atividades › Acompanhar): Pareto das justificativas do mês (total e percentual acumulado), semana a semana, rotas com mais não realizadas e a causa principal de cada uma. Supervisor, coordenador, gestor e administrador criam uma **ação** para a causa (o que fazer, responsável, prazo), concluem ou retiram. Cada ação mostra o **efeito**: a média por semana da causa nas 4 semanas antes e depois.
- **Prazo de aprovação:** o que o líder apontou num dia deve ser aprovado até o dia seguinte. A Aprovação mostra os mais antigos primeiro, com "fora do prazo · há N dias".
- **Lembretes no celular:** o líder recebe na hora cada atividade devolvida (com o motivo); supervisor e acima recebem às 8h o que espera aprovação há mais de 1 dia. Dá para desligar no Meu dia.
- **Dia e noite:** o Dimensionamento mostra, em rota de turno, quantos estão de dia (D) e de noite (N), em vermelho quando um turno fica sem ninguém. A Equipe e frota mostra "Trabalhando · dia/noite" para quem é 4x4.
- **Modo TV:** botão **Modo TV** no Painel (computador) abre o Painel em tela cheia, sem menus, trocando de área sozinho a cada 30 segundos (endereço com `?tv`).

### Tema claro ou escuro
- Botão **Tema** no menu lateral (no celular, em **Mais › Tema da tela**) e na tela de entrada: **Automático** (segue o aparelho), **Claro** ou **Escuro**. Vale só naquele aparelho e já abre no tema certo, sem piscar.

### Turno diurno e noturno
- Em **Administração do sistema › Escalas e turnos**, cada turno em ciclo diz quais dias de trabalho são de **dia (D)** e de **noite (N)**. O padrão do 4x4 é 2 dias + 2 noites (DDNN) e o do 3x3 é DDN. Toque no dia para trocar e salve.
- A noite conta no **dia em que começa** (a noite de segunda para terça é da segunda).
- **Efetivo diário e Frequência:** cada presença de turno ganha a marca **D** (diurno) ou **N** (noturno). "Trabalham hoje" mostra as letras de dia e de noite. O quadro "Turno dia · noite" e o "x/y presentes hoje" de cada grupo separam os dois períodos.
- **Agrupar por › Dia e noite:** separa as pessoas em Administrativo, Turno diurno, Turno noturno e Folga ou férias, com as letras de cada grupo.
- Se duas letras estiverem no mesmo dia do ciclo (datas iguais ou equivalentes), Escalas e turnos avisa para conferir as datas.

### Frequência e Efetivo diário: o mesmo jeito de lançar
As duas telas têm o mesmo visual (grupos que recolhem, busca, filtro de grupo ou rota, legenda das siglas, ✓ = presente, rodapé com os presentes de cada dia) e o mesmo lançamento: toque no dia → escolha a situação → escolha até quando vale (só este dia, 3, 5, 7, 15 ou 30 dias, até domingo ou até o fim da competência). No Efetivo diário, depois de uma ausência num dia de trabalho, o sistema pergunta quem cobre; depois de uma hora extra, a pedido de quem.
- **Líder com o nome escrito de jeitos diferentes** (KAUAN, KAUAN SOUZA, KAUAN SUZA): os grupos da Frequência viram um só e o Efetivo diário pode **agrupar por líder** com o mesmo nome. O reconhecimento usa o cadastro do RH: nome que é o começo de uma única pessoa, ou com uma letra trocada; quando o RH tem duas pessoas possíveis e a lista não desempata, não troca.

### Dados em comum entre os módulos (nada é digitado duas vezes)
- **Presença do dia.** Quem está nas Atividades tem uma presença só: o que o líder marca no Efetivo diário aparece na Frequência, e o que é corrigido na Frequência aparece no Efetivo diário. Quem não está nas Atividades (gestão, apoio) fica só na folha.
- **Férias.** Marcadas em Frequência e férias, aparecem sozinhas como **FE** no Efetivo diário, no Dimensionamento, no Meu dia e nos avisos do celular (quem está de férias não conta como disponível).
- **Escala.** A folga pela letra da turma (Escalas e turnos) também aparece na Frequência.
- **Operação › Equipe e frota.** A situação de cada operador (férias, atestado, falta, folga lançada, desligado) vem da Frequência, do Efetivo diário e das Férias; a escala do mês e o painel usam essa situação. Faltas e atestados da Avaliação mensal vêm de lá quando não foram digitados. Operador que não está na folha continua com a situação do cadastro.
- **Pessoas.** A folha liga cada nome à ficha do RH (matrícula) e às Atividades, aceitando acento, espaço a mais ou uma letra trocada.

### Módulo Frequência e férias
- **Frequência:** escolha Pátio ou Bateria e a competência (16 a 15). Toque no dia para lançar (presente, folga, falta, atestado, abono, hora extra, férias, afastado, treinamento, suspensão, desligado) e escolha até quando vale. Grupos recolhem; **Exportar Excel** baixa a folha. **Abrir a folha** da competência nova copia os grupos da anterior.
- **Férias:** agora e próximos 60 dias, por mês (inclui as planejadas sem data), data limite (vencida ou nos próximos 90 dias sem férias marcadas) e todas. O término e o retorno são calculados pelo início e dias.
- **Importar planilhas** (administrador; o gestor do módulo também, se ligado em Perfis): o administrador lê as planilhas de frequência do Pátio e da Bateria e a de férias que já estão no sistema, ou uma planilha nova em Excel. Mostra a conferência antes de gravar e, na presença do dia, só preenche o que ainda está vazio.
- Códigos das planilhas: na folha de turno D e N são dias trabalhados e FO/Fg folga; nos grupos administrativos S e D são folga; **F na planilha é falta (FT)**; FE na planilha é feriado (folga); T é treinamento; X é ignorado.
- Para gerar de novo os dados de importação a partir das planilhas originais (que não vão para o repositório): `node ferramentas/gerar-adm.mjs <frequencia-patio.xlsx> <frequencia-bateria.xlsx> <ferias.xlsx>`.

## Módulo Atividades Bateria
- Tem as mesmas telas do Atividades Pátio: Painel, Apontar, Escala e efetivo, Pendências, Folha do líder, Plano padrão, Gerador de meses e Rotas e configurações.
- **Primeiro acesso:** entre como administrador, escolha **Atividades Bateria** e clique em **Importar e gerar a programação**. Isso carrega as 120 atividades do plano padrão, as 18 rotas das áreas Bateria 1, Bateria 2, Trilho e CDQ e os 55 colaboradores, e gera a programação do mês atual e dos dois seguintes.
- Os dados ficam separados dos do Pátio (coleções com o prefixo `b_`).
- Para um líder ou supervisor da Bateria: em **Usuários e acessos**, marque o módulo **Atividades Bateria** e escolha a área dele (Bateria 1, Bateria 2, Trilho ou CDQ).

## Administração do sistema

Acesso especial, só do administrador. Junta as telas de ajuste de todos os módulos: **Visão geral** (resumo de cada módulo com atalhos), **Conferência do cadastro** (turmas sem data, pessoas de turno sem turma, nomes das Atividades sem ficha, fichas sem área, líderes sem área, folha não aberta, férias com limite vencido), **Uso do plano grátis** (documentos, tamanho estimado, fotos e contas, medido pela cópia de segurança diária), **Escalas e turnos**, Rotas e configurações, Plano padrão e Gerador de meses (botão Pátio | Bateria), Configurações da Operação, Tipos de ocorrência, Importar dados, Usuários e acessos e Perfis e permissões.

### Escalas e turnos (fonte única)

Fica em `config/escalas` e vale para Escala e Efetivo, Atividades, Operação, Meu dia e avisos no celular.
- **Administrativo:** dias da semana de trabalho (padrão seg a sex) e lista de feriados = folga.
- **Turnos em ciclo (4x4, 3x3, e outros):** dias de trabalho e de folga, e para cada turma (letra) um dia em que ela começou um bloco de trabalho. Dá para incluir turmas.
- **Próximos 14 dias:** quadro de quem trabalha e quem folga, por turma.
- **Turma de cada pessoa de turno:** escolha a letra; sem letra, o sistema usa a da ficha do Efetivo ou do cadastro da Operação (botão para gravar todas de uma vez).

Sem lançamento no dia, o **Efetivo diário marca a folga sozinho** pela escala (F tracejado). Marcar presente num dia de folga fica gravado; "voltar ao da escala" apaga o lançamento. Escalados, presentes, dimensionamento, balanço, déficit do Meu dia e avisos já descontam a folga da escala. Em rotas de turno, o necessário considera só a parte do quadro que trabalha por dia (4x4 = metade).

## Módulo Efetivo (escala, presença e fichas)

Um módulo só com duas partes. **Escala e presença** (Efetivo diário, Dimensionamento, Balanço e ausências), para Pátio e Bateria (botão **Pátio | Bateria** no topo): aparece para quem tem Atividades Pátio ou Bateria, nas mesmas áreas. **Fichas de acompanhamento** (Painel, Colaboradores, Ocorrências, Controle, Impressão): aparece para quem tem o Efetivo marcado no usuário. Quem tem só uma das partes vê só ela.

**Quem recolhe a assinatura:** ao registrar uma ocorrência, escolha quem vai recolher a assinatura (sugere o líder imediato da ficha; lista você, os líderes das fichas e os usuários de liderança, ou digite o nome). "Colher agora" só aparece quando é você. Na lista, cada pendência mostra o responsável (com **trocar**), o filtro **Comigo para recolher** mostra as suas, e o Meu dia avisa quantas estão com você.

- **Efetivo diário:** todas as rotas da área de uma vez (agrupadas, com "presentes hoje" de cada rota) ou uma rota só; busca por nome, função ou rota; ✓ verde = presente; toque no dia para trocar a situação (com "Repetir até domingo" e **Desfazer**).
- **Dimensionamento:** disponíveis × necessários por rota e dia.
- **Balanço e ausências:** ausências de hoje, balanço semanal (quadro, ausências por motivo, disponíveis, necessários, saldo, rotas em déficit) e quem tem ausência na semana.

### Substituição e hora extra (Efetivo diário)

- **Substituir colaborador:** ao lançar falta, atestado, afastado, férias, treinamento ou folga num dia de trabalho, o sistema pergunta **quem vai cobrir** (opcional). A lista mostra primeiro quem é da mesma rota, depois quem está de folga pela escala (vira **hora extra**) e quem está trabalhando em outra rota. O substituto passa a contar na rota de quem faltou e sai da dele; no dimensionamento e no balanço a conta já sai certa. Célula com ⇄ = tem substituição (passe o mouse para ver quem).
- **Hora extra:** ao marcar HE, escolha **a pedido da Dikma ou da ArcelorMittal** (D ou A ao lado do HE). O balanço semanal separa as horas extras por origem. Em Operação › Lançamentos, horas extras também pedem a origem.
- Tudo fica no mesmo documento de situação do mês (campos `cob` e `he`); "Desfazer" e "remover" desfazem a hora extra criada pela cobertura.

## Operação › Troca de equipamento (danificado → reserva)

Em **Lançamentos** (botão de troca na linha) ou em **Paradas** (botão **Substituir** numa parada sem liberação): informe a hora, o equipamento reserva e a causa. O sistema encerra o lançamento original na hora da troca, registra a parada do danificado (sem liberação) e lança o mesmo operador no reserva a partir dali. A parada conta contra a disponibilidade do equipamento, mas não tira horas do operador. Ao **Liberar** o danificado, dá para devolver o operador a ele automaticamente. Tudo tem **Desfazer** por alguns segundos.

## Módulo Operação (controle de equipamentos)
- **Primeiro acesso:** entre como administrador, escolha **Operação** e clique em **Importar dados da planilha**. Isso carrega os 25 operadores, as 37 identificações da frota, os turnos, as causas, as metas, os pesos, os feriados e os lançamentos e paradas de setembro e outubro.
- **Painel:** mostra os mesmos indicadores do DASHBOARD da planilha, com semáforo pelas metas:
  - dias operados, horas operadas, disponibilidade física, efetividade, paradas, horas paradas, MTTR e MTBF;
  - operadores ativos, horas extras, paradas sem liberação, destaque do mês, quem está fora da coqueria hoje, nota média, avaliações pendentes e paradas do operador.
  - Abaixo vêm a produtividade por operador, as horas por dia, o Pareto das causas, os equipamentos com mais horas paradas e reincidentes e a classificação dos operadores com a variação em relação ao mês anterior.
- **Lançamentos e paradas** é uma aba só (troca no topo). **Lançamentos:** as alocações do dia (equipamento, operador, área, status e horário). O horário vazio usa o turno. O sistema calcula a janela, as horas paradas e as horas operadas. **Copiar do dia anterior** repete as alocações do último dia, deixando de fora quem está ausente ou de folga na escala 4x4.
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

- **Paradas:** além dos filtros por situação e responsável, a faixa de dias do mês mostra quantas paradas houve em cada dia; toque num dia para ver só ele. A lista fica agrupada por dia, com o total de paradas e de horas.

**Lançamentos:** busca por equipamento, operador ou área; quadro com os operadores escalados que ainda não foram lançados (toque no nome para lançar) e quem está fora no dia. No formulário, operador e equipamento são escolhidos digitando, com a situação de cada um no dia (disponível, em outro equipamento, folga na escala, ausente; livre, com alguém, parado), e avisos antes de salvar.

**Paradas:** parados agora e há quanto tempo, busca por equipamento, operador, causa ou OS, causas agrupadas por responsável (Equipamento, Operador, Operacional) com a explicação de cada uma, botão "Agora" para a hora da liberação e operador preenchido pelo lançamento do equipamento no dia.

## Módulo Efetivo (fichas de acompanhamento)
- **Primeiro acesso:** entre como administrador, escolha **Efetivo** e clique em **Importar dados da planilha**. Isso carrega os 179 colaboradores, as ocorrências já lançadas e os 12 tipos com texto padrão.
- **Painel:** fichas em dia, ativos, em experiência, integração completa, assinaturas pendentes e recusas. Mostra também as ocorrências por mês e por tipo e alertas de experiência (45 e 90 dias), integração incompleta e assinatura parada há mais de 7 dias.
- **Colaboradores:** busca, filtros e a ficha de cada pessoa, com a Folha 1 (integração) e a Folha 2 (ocorrências). O administrador cadastra, edita e informa a demissão.
- **Ocorrências:** ficam na ficha de cada colaborador (Nova ocorrência, assinar, ver). A aba Ocorrências foi tirada; em **Colaboradores** os filtros **Pendente assinatura** e **Comigo para recolher** mostram quem tem assinatura para recolher.
- **Assinatura, de três formas:**
  1. **Na tela:** o colaborador e o responsável Dikma assinam com o dedo.
  2. **Via em papel:** imprima a via, colha as assinaturas e fotografe a folha assinada.
  3. **Recusou:** informe as testemunhas.
- **Colaboradores** (juntou o antigo Controle de fichas): uma tabela com cadastro, integração (x de 5, com as datas ao passar o mouse), Folha 2 (de 33), assinaturas aguardando, recusas e situação da ficha.
- **Impressão:** ficha (Folhas 1 e 2, com as assinaturas feitas na tela) e via de assinatura com código de controle.
- **Tipos de ocorrência** (administrador): até 5 vão para a Folha 1, na ordem da posição.
- **Área de atuação e função (cadastro único):** em **Colaboradores › abrir a ficha › Editar**, o administrador escolhe a **área de atuação** (Coqueria sem rota, uma das áreas do Pátio ou da Bateria com rota e regime, ou Operação de equipamentos) e a **função**. Ao salvar, a mudança vai junto para os outros módulos:
  - **Atividades Pátio e Atividades Bateria:** a pessoa sai da rota antiga e entra na nova (Escala e efetivo), com a função e o regime novos. Pode passar do Pátio para a Bateria e vice-versa. O histórico de faltas e folgas continua com ela no módulo onde foi lançado.
  - **Operação:** marque **Opera equipamentos** para colocar a pessoa na equipe de operadores (com escala ADM ou 4x4 e turma). Desmarcando, ela sai da equipe; os lançamentos antigos continuam no histórico.
  - A ligação entre os módulos é pela matrícula e, na falta dela, pelo nome completo.
  - Quando o administrador muda a função de um operador em **Operação › Equipe e frota**, a função também é atualizada no Efetivo, no Pátio e na Bateria.
- **Filtro por área** no Painel e Colaboradores: por área do RH (Coqueria - Pátio, Alto Forno, Sinter…), por setor (Coqueria - Recebimento, Alto Forno - Carregamento AF1…) ou pela área de atuação no sistema. O filtro escolhido vale para todas essas telas.
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

## Integração com o Senior (ponte pronta, aguardando a TI)
O sistema já tem uma ponte para buscar os colaboradores no Senior todo dia, sozinho. Enquanto ela não é configurada, nada acontece.

**Como funciona**
- Uma rotina do GitHub (workflow **Integração Senior**, arquivo `.github/workflows/senior-sync.yml`) roda de segunda a sábado às 6h.
- Ela entra no Senior com um usuário de integração (só leitura), lê os colaboradores e grava o resultado no Firestore (`integracao/senior`). Nada é alterado no Efetivo nesse momento.
- Em **Efetivo › Importar dados**, o cartão **Integração Senior** mostra a leitura nova. O administrador clica em **Conferir e aplicar**, vê a mesma conferência das planilhas e aplica. Área e função vão também para Atividades Pátio, Bateria e Operação.
- O código fica em `integracao/senior`: `sync.mjs` (rotina), `normalizar.mjs` (padroniza os campos), `mapa-padrao.json` (nomes dos campos no Senior) e `adaptadores/` (um por tipo de Senior).

**Três formas de ligar (segredo `SENIOR_MODO`)**
| Modo | Quando usar | O que a TI precisa passar |
|---|---|---|
| `seniorx` | Senior X (nuvem) | usuário e senha de integração (ou chave de aplicação) e o nome do tenant |
| `g5` | Senior instalado nos servidores da Dikma (HCM / Administração de Pessoal) | endereço do web service de colaboradores, nome da porta, usuário e senha; e liberar o acesso externo ao servidor |
| `arquivo` | Teste, ou enquanto não há API | nada: coloque a planilha exportada do Senior em `integracao/senior/entrada` |

**Onde cadastrar (GitHub › Settings › Secrets and variables › Actions)**
- Em **Secrets** (ficam escondidos): `SENIOR_MODO`, `SENIOR_USUARIO`, `SENIOR_SENHA` (ou `SENIOR_CHAVE` e `SENIOR_SEGREDO`) e, no G5, `SENIOR_G5_URL`. O `FIREBASE_SERVICE_ACCOUNT` já existe.
- Em **Variables**: `SENIOR_TENANT`, `SENIOR_URL` (só se a Dikma usar outro endereço), `SENIOR_G5_PORTA`, `SENIOR_G5_PARAMETROS` (JSON), `SENIOR_MAPA` (JSON, para trocar os nomes dos campos) e `SENIOR_ARQUIVO`.
- Nunca coloque senha em arquivo do repositório nem envie para ninguém.

**Primeiro teste**
1. Cadastre os segredos.
2. Em **Actions › Integração Senior › Run workflow**, marque **Só testar** e rode. O registro da execução mostra quantos colaboradores vieram e dois de exemplo, sem gravar nada.
3. Se aparecer "nenhum registro tinha matrícula e nome", a mensagem lista os nomes dos campos que o Senior mandou. Ajuste o `SENIOR_MAPA` com esses nomes. Exemplo: `{"mat":["numCad"],"nome":["nomFun"],"funcao":["titCar"]}`.
4. Rode de novo sem **Só testar**. A leitura aparece em **Efetivo › Importar dados**.

Os endereços padrão do Senior X e os nomes de campo do G5 em `mapa-padrao.json` são o ponto de partida. Confirme-os com a TI, porque cada instalação do Senior pode ter serviços e campos próprios.

## Justificativa das não realizadas
- Ao marcar **✕ Não realizada** (no Apontar ou em Pendências), o sistema pergunta **por que não foi feita**: escolha um motivo da lista ou **Escrever a justificativa** (até 200 caracteres). Sem justificativa, não marca.
- No Apontar, a justificativa aparece embaixo da atividade, com **editar** para quem aponta na área.
- O supervisor vê a justificativa na **Aprovação** e pode devolver com "Justificativa não confere". Pendências mostra o resumo **Por que não foi feito** (as escritas entram em "Outras justificativas"). A Folha do líder e o Excel levam a justificativa.
- **Fotos das atividades:** foram retiradas (botão da câmera, Relatório fotográfico e "Exigir foto"). As fotos antigas continuam guardadas no banco e na cópia de segurança, mas não aparecem mais no sistema. A foto da via em papel das fichas do Efetivo continua.

## Perfis
| Perfil | O que faz |
|---|---|
| Administrador | Tudo, inclusive cadastrar, redefinir senha e apagar usuários |
| Gestor | Aponta e edita em todas as áreas e usa as telas de administração dos módulos marcados (plano padrão, gerador de meses, rotas, configurações, tipos de ocorrência, importar dados, cadastro de colaboradores). Não mexe em usuários |
| Coordenador | Aponta e edita em todas as áreas dos módulos marcados, sem as telas de administração |
| Supervisor | Aponta em até 2 áreas (podem ser uma do Pátio e outra da Bateria). Com duas áreas no mesmo módulo, escolhe a área no filtro |
| Líder | Aponta em 1 área. O que ele aponta fica **aguardando aprovação** até o supervisor conferir |
| Administrativo | Frequência e férias (edita) e as fichas do Efetivo de todas as áreas: ocorrências, assinaturas e impressão. Vê as Atividades sem apontar e não aprova. Ao escolher o perfil, Efetivo e Frequência e férias já vêm marcados |
| Somente leitura | Vê tudo e não altera nada |
| Bloqueado | Não entra |

## Perfis e permissões (administrador)

Menu **Administração › Perfis e permissões**: liga e desliga, perfil por perfil, quais abas aparecem em cada módulo. Aba desligada some do menu e não abre nem por link. O administrador vê tudo sempre; abas de administração só podem ser ligadas para o Gestor. Pátio e Bateria usam a mesma configuração. Sem nada configurado, todos veem todas as abas comuns dos seus módulos.

**Exceção por pessoa (opcional):** em **Usuários e acessos**, coluna **Abas**, botão **Personalizar**. O que ficar diferente do perfil vale só para aquela pessoa; **Voltar ao padrão do perfil** apaga a exceção.

A permissão controla as abas. O que cada perfil pode alterar no banco continua definido pelo perfil (regras do Firestore).

## No celular
- **Lançar presença** (Efetivo diário e Frequência): a janela mostra as situações em grade, um toque escolhe; arrastar a janela para baixo fecha.
- **Frequência** mostra uma semana por vez (‹ › ou arraste a folha para o lado); **Efetivo diário** sem a coluna Função (vai embaixo do nome), com os dias maiores.
- **Colaboradores**, **Equipe e frota** e **Avaliação mensal** viram cartões em vez de tabelas largas.
- Campos com letra de 16 px (o iPhone não dá zoom ao tocar para digitar); o último usuário fica lembrado na entrada (a senha não).
- Vibração curta ao confirmar um lançamento (Android).
Abra o endereço no Chrome (Android) ou Safari (iPhone) e use **Adicionar à tela inicial**. O sistema abre como um aplicativo. Sem sinal, os apontamentos ficam guardados no aparelho e são enviados quando a conexão voltar. O topo da tela mostra **Sem sinal · N aguardando envio**.

## Para alterar o sistema depois
Edite o arquivo direto no GitHub (ícone de lápis) e salve com **Commit changes**. A publicação roda sozinha.

## Arquivos

```
public/
  index.html          visual e estrutura da página
  app.js              telas e regras de negócio (módulo Atividades Pátio)
  equip.js, eqcalc.js módulo Operação (equipamentos) e as fórmulas dos indicadores
  gestao.js           módulo Efetivo (fichas de acompanhamento)
  pessoas.js          cadastro único: leva área de atuação e função para todos os módulos
  importar.js         Efetivo › Importar dados (lê Excel e CSV)
  meudia.js, hoje.js  tela Meu dia e as contas que ela usa (as mesmas dos avisos)
  permissoes.js       abas por perfil e exceção por pessoa
  busca.js            busca com lista abaixo do campo (operadores, equipamentos) e filtro das listas
  escala.js           escala de turno: regime, turma, folga automática (também usada pelos avisos)
  acessos.js          os acessos (Operação e, só para o administrador, Administração do sistema) e as férias em comum
  aprovacao.js        aprovação dos apontamentos do líder pelo supervisor
  presenca.js         o jeito único de lançar presença (Frequência e Efetivo diário)
  administrativo.js   módulo Frequência e férias (frequência, férias, importar)
  planilhas-adm.js    leitura das planilhas de frequência e férias
  exportar.js         baixar listas como planilha do Excel
  movimento.js        animações e fluidez (entrada de tela, menu, janelas, números, rolagem)
  vendor/xlsx.js      leitor de planilhas SheetJS 0.20.3 (carregado só na importação)
  data.js             conexão com o Firebase (login e banco)
  data-mock.js        modo demonstração (?demo)
  cal.js              calendário operacional (semana pertence ao mês da quinta-feira)
  demo/               dados da demonstração, com nomes e matrículas fictícios
  vendor/firebase.js  biblioteca do Firebase 10.14.1
  img/                logo da Dikma
  sw.js, manifest.webmanifest, icons/   instalação no celular e uso sem sinal
firestore.rules       regras de segurança por perfil e área
firebase.json         configuração do Hosting
.github/workflows/blank.yml        publicação automática (roda os testes antes)
.github/workflows/testes.yml       testes automáticos (regras, rotinas e site sem dados pessoais)
.github/workflows/backup.yml       cópia de segurança diária
.github/workflows/restaurar.yml    restaurar uma cópia
.github/workflows/administrador.yml   criar ou recuperar administrador
.github/workflows/limpar-contas.yml   apagar contas de login sem usuário (todo mês)
dados-importacao/     planilhas originais (seed.json, seed-bateria.json, seed-equip.json, seed-gestao.json,
                      seed-efetivo.json, seed-freq-patio.json, seed-freq-bateria.json, seed-ferias.json);
                      vão para o banco na publicação, nunca para o site
integracao/admin/     rotinas do GitHub: dados de importação, administrador, cópia e restauração
testes/               testes automáticos no emulador do Firebase
ferramentas/          gerar-demo.mjs (demonstração com nomes fictícios), gerar-adm.mjs (planilhas de frequência e férias) e conferir-site.mjs
```

## Estrutura do banco (Firestore)

| Coleção / documento | Conteúdo |
|---|---|
| `config/sistema` | rotas (efetivo e carga padrão), tipos de atividade, meses gerados |
| `usuarios/{uid}` | nome, usuário, perfil, área, módulos (operacao, bateria, equipamentos, gestao, frequencia) |
| `logins/{usuario}` | liga o usuário digitado à conta interna do Firebase |
| `plano/{ÁREA}` | atividades do plano padrão da área |
| `colaboradores/{ÁREA}` | efetivo da área por rota |
| `situacao/{AAAA-MM}` | folgas, férias, atestados etc. do mês |
| `semanas/{ÁREA\|AAAA-MM-DD}` | programação da semana com o status de cada dia e os motivos |
| `aprov/{ÁREA\|AAAA-MM-DD}` | aprovação dos apontamentos da semana: aprovado ou devolvido (com motivo), quem e quando. Na Bateria, `b_aprov` |
| `historico` | registro de quem apontou o quê |
| `eq/config`, `eq/cadastro` | Operação: turnos, causas, metas, pesos, feriados · operadores e frota |
| `eqlanc`, `eqpar`, `eqinsp` | Operação: lançamentos, paradas e inspeções (campo `mes`) |
| `eqaval/{AAAA-MM}` | Operação: avaliação mensal dos operadores |
| `gestao/config` | código e revisão da ficha, declaração, tipos de ocorrência |
| `gcolab/{ÁREA}` | fichas dos colaboradores da área (matrícula, nome, admissão, demissão…) |
| `gocorr/{id}` | ocorrências (área, data, tipo, descrição, quem recolhe, situação da assinatura) |
| `gassin/{id}` | assinaturas (na tela, foto da via em papel ou recusa com testemunhas) |
| `evidencias/{id}` | lista de anexos com miniatura (atividade, dia, quem enviou) |
| `evidenciasArquivo/{id}` | foto ou arquivo completo, lido só ao abrir |
| `seeds/{nome}` | dados das planilhas originais para a importação (gravados na publicação; só a administração lê) |
| `avisos_enviados/estado` | avisos já enviados e resultado da última execução da rotina |
| `freqcomp/{conjunto\|AAAA-MM}` | Frequência: folha da competência (grupos, pessoas e os dias de quem não está nas Atividades) |
| `ferias/{id}` | Férias: um período de férias (matrícula, nome, setor, início, dias, término, retorno, data limite) |
| `adm/feriasAtivas` | resumo das férias de agora e dos próximos meses, lido pela Operação |
| `sistema/uso` | uso do plano grátis, gravado pela cópia de segurança diária (só o administrador lê) |
| `config/bootstrap` | marca que o sistema tem administrador (gravado só pela rotina do GitHub) |

Um documento por área e semana mantém cada tela em poucas leituras, dentro do plano grátis (50 mil leituras por dia).

## Problemas comuns
- **Actions falhou com "permission denied" ou "403":** confira o passo 5.4 (papel Administrador do Firebase).
- **Erro citando `serviceusage`:** no mesmo lugar do passo 5.4, adicione também o papel **Consumidor do Service Usage**.
- **Actions falhou com "Falta o secret":** confira o passo 6.2. O nome precisa ser exatamente `FIREBASE_SERVICE_ACCOUNT`.
- **Tela "Sistema ainda não conectado":** faltou registrar o app web (passo 2).
- **"O login por senha não está ativado":** confira o passo 3.


Outros arquivos fora de `public`:
```
integracao/senior/            ponte com o Senior (roda no GitHub Actions, não vai para o site)
integracao/avisos/            avisos no celular (roda no GitHub Actions)
.github/workflows/avisos.yml  agenda dos avisos (de hora em hora, 6h às 22h)
.github/workflows/senior-sync.yml   agenda da ponte (seg a sáb, 6h)
```
