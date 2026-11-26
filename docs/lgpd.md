# LGPD no Dikma Gestão

Decidido pelo Eduardo em 22/11/2026.

## Quem abriu a ficha
- Ao abrir a ficha de uma pessoa (RH › Colaboradores e Gestão › Ficha de acompanhamento), o sistema grava quem abriu, qual ficha, de quem e o dia. Uma linha por usuário, pessoa, ficha e dia (coleção `acessosFicha`, id `uid|mat|ficha|dia`).
- Só o administrador vê (botão **Quem abriu** na ficha). Ninguém altera. Só o administrador apaga (descarte por prazo).
- Código: `public/ui/acessos-ficha.js`, `DB.acessoFicha` e `DB.acessosFichaDe` em `public/nucleo/data.js`.

## Dados pessoais (CPF, endereço, telefone, rota de ônibus)
- Ficam fora da ficha, em `dpessoais/{matrícula Dikma}` (a ficha `gcolab` é lida por líderes, leitores e Indicadores). Aparecem na aba **Dados pessoais** da ficha em RH › Colaboradores.
- Quem vê: administrador e RH · Administrativo. RH · Somente leitura só se o administrador ligar **Ver dados pessoais** em Administração › Perfis (RH). O banco confere o mesmo (`firestore.rules` › `dpessoais`, lê `config/permissoes`).
- Quem grava: administrador e RH · Administrativo (editar na aba ou **Importar dados pessoais** na lista, com prévia antes de gravar). Quem apaga: só o administrador (descarte por prazo).
- A planilha usada na importação não fica guardada no sistema nem no repositório.
- Código: `public/contas/dados-pessoais.js` (testes em `testes/dados-pessoais.test.mjs`), `public/telas/dados-pessoais.js`, `DB.dpLer`/`dpSalvar`/`dpImportar` em `public/nucleo/data.js`.

## Minha agenda (Gestão)
- Compromissos, tarefas e anotações de cada pessoa ficam em `agenda/{id}`, com o dono no campo `uid`. Só o dono lê, grava e apaga: nem o administrador vê a agenda dos outros (`firestore.rules` › `agenda`). A cópia de segurança diária inclui a coleção (como o resto do banco).
- Exceção escolhida pelo dono: uma **anotação** pode ser compartilhada só para leitura com até 20 pessoas (campo `comp`, pelo usuário de login). Quem recebe não altera nem apaga.
- Lixeira: o que a pessoa apaga fica 30 dias com `apagadoEm` e depois some de vez (a tela apaga ao abrir).
- Avisos no celular: a rotina dos avisos (servidor) lê os itens com data perto de hoje e os que se repetem, só de quem ligou o aviso, e manda o título e a hora apenas para o aparelho do dono.
- A aba começa desligada para todos; o administrador liga por perfil (Administração › Perfis) ou por pessoa (Usuários › exceções).
- Código: `public/contas/agenda.js` (testes em `testes/agenda.test.mjs`), `public/telas/agenda.js`, `DB.agendaWatch`/`agendaSalvar`/`agendaApagar` em `public/nucleo/data.js`.

## Prazos de guarda
| O quê | Prazo | O que sai |
|---|---|---|
| ASO (Treinamentos e ASO, tipo `ASO`) | 2 anos depois de vencer; de quem saiu, 2 anos depois da demissão | o registro antigo (o mais recente de cada pessoa ativa sempre fica) |
| Atestado (AT) e afastamento (AF) | 12 meses depois do dia | só a observação escrita (`jus.obs`); o código e o motivo da lista ficam |
| Registro de quem abriu a ficha | 1 ano | a linha |
| Dados pessoais (CPF, endereço, telefone, rota de ônibus) | 2 anos depois da demissão | o documento `dpessoais` da pessoa |

O exame em si (prontuário, NR-7) fica com a medicina do trabalho, não neste sistema.

## Como descartar
Administração › Visão geral › **LGPD**: ler o que passou do prazo, baixar a cópia (JSON) e digitar APAGAR. Nada sai sozinho. O histórico guarda só os números.
- O ASO apagado vira "apagado" (as datas e a observação saem na hora); a rotina diária dos avisos apaga o documento de vez depois de 45 dias.
- Cuidado: importar de novo uma planilha antiga de treinamentos traz os ASO antigos de volta.
- Contas: `public/contas/lgpd.js` (testes em `testes/lgpd.test.mjs`); tela: `public/telas/lgpd.js`.

## Atestados lançados pelos líderes (desde a v238)

- Onde: o líder lança na **Operação › Escala do dia** (tocar no nome › Atestado): tipo, primeiro dia, data de emissão,
  quantos dias (ou as horas da declaração de comparecimento), observação sem CID e até 2 fotos. O AT vai sozinho para os
  dias do atestado. O RH confere em **RH › Atestados**; quem lançou acompanha em **Operação › Justificativas › Atestados**.
- Banco: `atestados/{id}` (dados e miniaturas) e `atestadosFoto/{id}` (a foto completa, uma por documento), fora das
  fotos das atividades: nunca entram no arquivo de fotos, no relatório fotográfico nem no PowerPoint.
- Quem lê: **RH · Administrativo, administrador e quem lançou** (`firestore.rules` › atestados). Supervisor,
  coordenador, gestor e cliente veem só o código AT na Escala do dia; a justificativa na Presença leva só o tipo, os
  dias e o id do atestado, sem a observação.
- Quem abriu a foto fica em `acessosFicha` (ficha = `atestado`), visto em "Quem abriu" na ficha do RH.
- Prazo: a foto e a observação saem **12 meses depois do último dia** (Administração › LGPD, descarte manual com cópia).
  As datas, o tipo e os dias ficam (frequência, folha e indicadores).
- Avisos no celular: só números (nunca nome, tipo ou observação).
