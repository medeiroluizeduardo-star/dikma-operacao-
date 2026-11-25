# Fotos das atividades

Foto tirada no **Apontar** para comprovar a atividade. Este documento descreve o funcionamento e o **modelo de dados**,
que a Parte 2 (relatório em PowerPoint, exportação em .zip, lixeira e exclusão) usa.

Arquivos:

| Arquivo | O que tem |
| --- | --- |
| `public/contas/fotos.js` | Contas sem tela: configuração padrão e validação, situação que exige foto, contador, `refs`, contagem por célula (`ft`), indicador e estimativa de armazenamento. Testado em `testes/fotos.test.mjs`. |
| `public/ui/fotos.js` | No navegador: reduzir a foto (JPEG), miniatura, SHA-256 e a foto grande em tela cheia. A Segurança usa as mesmas funções. |
| `public/telas/fotos.js` | Telas: passo de fotos, fotos de uma atividade, selo 📷, indicadores e Administração › Fotos das atividades. |
| `public/nucleo/data.js` | Gravação (`apontarComFotos`), leitura (`listarFotosCel`, `listarEvidenciasSemanas`, `abrirEvidencia`), `ajustarRefsFoto`, `salvarCfgFotos`. |
| `public/nucleo/data-mock.js` | Os mesmos nomes na demonstração (fotos de exemplo desenhadas em canvas). |
| `firestore.rules` | Bloco "Fotos das atividades". Testado em `testes/regras.test.mjs`. |
| `public/contas/fotos-arquivo.js` | **Parte 2**, contas sem tela: situação da foto, o que pode ir para a lixeira/apagar, lotes, confirmação, nomes do .zip, `indice.csv`, SHA-256, espaço e conteúdo do relatório. Testado em `testes/fotos-arquivo.test.mjs`. |
| `public/telas/fotos-arquivo.js` | **Parte 2**, tela Administração › Relatórios e arquivo de fotos. |
| `public/telas/fotos-pptx.js` | **Parte 2**, monta o .pptx e o .zip no navegador (carregado só quando usado). |
| `public/vendor/pptxgen.bundle.js` | PptxGenJS 3.12.0 (MIT) com JSZip dentro. Fora do pacote que abre sem sinal (é grande): entra por uma tag `<script>` criada na hora. |

## Como funciona na tela

- **Configuração** (só o administrador): Administração › Atividades › **Fotos das atividades**. Liga ou desliga a
  obrigação, mínimo e máximo de fotos, situações que exigem foto (Realizada, Extra e, se quiser, Não realizada) e a data
  a partir da qual as realizadas sem foto contam como "sem foto". Mostra o efeito previsto no armazenamento.
- **Apontar**: ao marcar uma situação que exige foto, abre o **passo de fotos antes de concluir**. O contador mostra
  "Fotos: 0 de 1 obrigatória · máximo 3" (vermelho enquanto falta, âmbar com parte, verde quando está certo). O botão
  de confirmar só ativa com o mínimo; acima do máximo as fotos a mais não entram. **Cancelar não marca a atividade.**
- **Apontar por local/equipamento** (desde a v181): o líder abre o local, marca o checklist (feita / não feita com
  justificativa) e junta as **fotos do local**, que valem para todas as atividades do local no dia (`refs` de todas,
  guardadas uma vez só). Com a foto obrigatória, o local só salva com o mínimo de fotos. O número de fotos do local é o
  maior `ft` entre as atividades dele. Execução do local = feitas ÷ previstas (`public/contas/execucao.js`).
- **Antes e Depois** (desde a v193): no local, os botões **Foto do antes** e **Foto do depois** abrem o passo de fotos
  já com a escolha; no passo (também na foto de uma atividade e em "Adicionar foto") há "A foto é do: Antes | Depois"
  (começa em Antes quando ainda não há foto) e a marca na miniatura troca com um toque antes de salvar. Fica no campo
  `fase` da foto. No relatório em PowerPoint a foto marcada sai com a marca escolhida (Antes primeiro, Depois no fim);
  grupo sem nenhuma foto marcada continua pela hora (1ª Antes, última Depois, meio Durante). O `indice.csv` ganhou a
  coluna `antes_depois` (no fim).
- **Marcar restantes** (saiu da tela com o Apontar por local; o lote abaixo continua valendo para fotos antigas): um passo de fotos só para o lote. As mesmas fotos valem para todas as atividades marcadas naquele
  momento e ficam guardadas **uma vez só**, com `refs` de todas.
- **Fora da programação**: a atividade incluída pelo supervisor, ao ser marcada como realizada, vale como **Extra**
  (exige foto se Realizada ou Extra estiverem marcadas).
- **Trocar a situação** (ex.: desmarcar): as fotos continuam ligadas; ao marcar de novo, as fotos que a célula já tem
  contam para o mínimo.
- **Lista do Apontar e Programação**: cada atividade com foto mostra 📷n; tocar abre as miniaturas e, tocando numa, a
  foto grande (lida de `evidenciasArquivo`). Quem aponta pode **adicionar foto** a um apontamento já feito, até o máximo.
- **Apagar foto** (quem aponta na área, ou seja líder, supervisor, coordenador ou gestor da Operação, e o administrador; os outros perfis não veem o botão): nas fotos da atividade, cada
  miniatura tem **Apagar**, que pede confirmação. Apaga o documento leve e a foto completa e diminui a contagem `ft` da
  semana no **mesmo lote** (`DB.apagarFotoAtividade`; espera o servidor, sem sinal dá erro). A foto que vale para várias
  atividades ("Marcar restantes") sai de todas (a tela avisa). Quem aponta só apaga a foto **No banco** (ainda não
  exportada); o administrador apaga qualquer uma. Fica registrado no Histórico.
- **Queda zero**: não fica nas fotos nem no Apontar. Tem aba própria em Operação › Queda zero
  (`public/telas/queda-zero.js`). Os registros antigos feitos junto da foto aparecem lá, no dia deles.
  Cada lançamento pode ter local (transportador) e motivo das listas de `public/contas/queda-zero.js`; nomes novos
  cadastrados na hora ficam em `config/quedazero` (`locais`, `motivos`) e aparecem para todos.
  O lançamento pode ter **fotos** (opcionais, até o **máximo** de `config/fotos`). Ficam nas mesmas coleções
  (`evidencias` + `evidenciasArquivo`, mesmo lote do lançamento), com a "atividade" `QZ-<id>` no lugar do PID
  (`refs = 'semana|QZ-<id>|k'`, `pidFotoQZ`), **sem** somar em `ft`; o lançamento guarda quantas tem em `qz[key].f`.
  Entram no arquivo de fotos e no relatório como as outras (título = texto da queda). Apagar foto ou lançamento com
  foto: quem aponta na área (foto não exportada) ou administrador (`DB.apagarFotosQZ`).
- **Antes da regra** (dia anterior a `desde`): não pede foto; aparece "sem foto" discreto.
- **Indicadores**: Gestão › Indicadores › Atividades mostra "Atividades com foto" (% das realizadas/extras do período,
  desde `desde`). O Meu dia do supervisor, coordenador, gestor e administrador mostra as realizadas sem foto dos últimos
  60 dias (só com a foto obrigatória ligada).
- **Sem sinal**: a foto é reduzida no aparelho e entra no **mesmo `writeBatch`** do apontamento (fila do Firestore,
  `persistentLocalCache`). Sobe tudo junto quando a conexão volta: nunca fica apontamento sem foto nem foto sem apontamento.

## Tamanho das fotos

- Foto completa: JPEG, lado maior 1280 px, qualidade 0,7 (alvo de 150 KB). Se passar de 300 KB, é recomprimida
  (qualidade até 0,45 e depois o tamanho em passos de 15%) até chegar perto do alvo.
- Miniatura: JPEG 240 px, qualidade 0,6 (até 15 KB).
- No banco as duas ficam como texto `data:image/jpeg;base64,…`, que ocupa **4/3** do arquivo. Uma foto de 120 KB
  com a miniatura ocupa ~176 KB no Firestore.
- Medido nos testes: foto 3000×2000 JPEG → 126 KB (1280×853); PNG 3000×2000 → 38 KB; ruído 4000×3000 → 195 KB;
  ruído puro 2400×2400 (662 KB na primeira passada) → recomprimido para 141 KB (1088×1088). Miniaturas de 2 a 6 KB.

**Atenção ao plano gratuito (1 GB):** com ~300 apontamentos/dia e uma foto por apontamento são ~50 MB/dia, ou seja,
o banco enche em cerca de 3 semanas. O "Marcar restantes" (uma foto para a rota) reduz muito, mas a **Parte 2
(exportar e limpar) é necessária** para o uso contínuo. A tela de configuração mostra a conta com os números reais.

## Modelo de dados

### `config/fotos` (gravado só pelo administrador)

| Campo | Tipo | Observação |
| --- | --- | --- |
| `obrig` | bool | foto obrigatória ao apontar |
| `min` | int | ≥ 1 quando `obrig`; ≥ 0 quando não |
| `max` | int | ≥ `min`, entre 1 e 10 |
| `situacoes` | lista | parte de `['R', 'E', 'N']` (Realizada, Extra, Não realizada) |
| `desde` | 'AAAA-MM-DD' | a partir de quando as realizadas sem foto contam como "sem foto" |
| `atualizadoEm`, `por` | hora do servidor, nome | quem salvou |

Sem o documento vale o padrão de `public/contas/fotos.js` (`obrig` true, `min` 1, `max` 3, `R` e `E`, `desde`
`FOTOS_DESDE_PADRAO`). **Ao publicar, salve a configuração uma vez** para gravar a data real de início.

### Contagem por célula: `semanas/{id}.ft` (e `b_semanas`)

`ft: { 'PID|k': n }` = quantas fotos a atividade `PID` tem no dia `k` (0 = segunda). Sobe com `increment(n)` no
**mesmo lote** que grava as fotos. As telas mostram 📷n sem ler as fotos. O campo antigo `ev` (código de evidências de
antes) também é somado. Uma foto com 20 `refs` soma 1 em cada uma das 20 células.

### `evidencias/{id}` (Bateria: `b_evidencias`) — documento leve, um por foto

| Campo | Quem grava / altera | Observação |
| --- | --- | --- |
| `refs` | autor na criação; autor (até 24 h) e administrador ajustam | lista de `'ÁREA\|AAAA-MM-DD\|PID\|k'` (= `semana\|pid\|k`), de 1 a 100. Consulta: `where('refs', 'array-contains', ref)` |
| `semana` | criação | id da semana (`'ÁREA\|AAAA-MM-DD'`, a segunda-feira) |
| `area`, `conj` | criação | área (igual à da semana, conferido pela regra) e `'patio'` ou `'bateria'` |
| `pid`, `k` | criação | primeira atividade de `refs` e o dia da semana (0 = segunda) |
| `dia`, `mes` | criação | `'AAAA-MM-DD'` e `'AAAA-MM'` (o mês confere com o dia) |
| `rota` | criação | rota das atividades |
| `local`, `ativ` | criação | descrição; com várias atividades, `"N atividades: a; b; …"` (até 400/600 caracteres). Para o texto de cada uma, use `refs` + plano (`PID`) |
| `sit` | criação | situação no momento da foto (`R`, `N` ou `E`) |
| `thumb` | criação | miniatura em texto `data:…` (até 40 mil caracteres) |
| `fase` | criação (opcional) | `'antes'` ou `'depois'`: escolhida por quem tira a foto no Apontar (desde a v193). Sem o campo (fotos antigas, Queda zero, OMs), o relatório marca pela hora |
| `nome`, `tipo`, `tamanho` | criação | nome do arquivo escolhido, `'image/jpeg'`, `tamanho` = `bytes` |
| `bytes`, `w`, `h` | criação | tamanho do JPEG completo (até 700 mil) e pixels |
| `sha` | criação | SHA-256 (hex, 64) dos bytes do JPEG completo, calculado no aparelho; `''` se o navegador não deixou |
| `por`, `porNome`, `at` | criação | autor (= quem está logado) e hora do servidor (`at == request.time`) |
| `exportadoEm`, `exportLote` | **só o administrador** | `null` na criação. Parte 2: quando e em que lote a foto foi exportada (`EXP-AAAAMMDD-HHMM-xxxx`) |
| `exportConf` | **só o administrador** | ausente/`null` na criação. Parte 2: conferência do SHA-256 na exportação: `ok`, `divergente` ou `sem-sha` |
| `lixeiraEm` | **só o administrador** | `null` na criação. Parte 2: foto na lixeira (as telas já escondem) |
| `removidaEm` | **só o administrador** | `null` na criação. Parte 2: arquivo completo apagado; as telas mostram só a miniatura com o selo "Arquivada fora do banco" |
| `atualizadoEm`, `atualizadoPor` | quem altera depois | |

Apagar o documento: o **administrador** ou **quem aponta na área** (líder, supervisor, coordenador ou gestor; só a foto ainda não exportada). Veja "Apagar foto no Apontar" abaixo.

### `evidenciasArquivo/{id}` (Bateria: `b_evidenciasArquivo`) — foto completa, mesmo id do leve

`{ area, semana, dia, sha, por, dados }`. `dados` = JPEG completo em texto `data:…` (até 900 mil caracteres). Lido só
ao abrir a foto grande ou exportar. Ninguém altera; apagar só o administrador. A regra só aceita o arquivo junto do
documento leve do mesmo autor e área (`getAfter`).

### Fotos antigas

O código antigo de evidências gravava `ref: 'semana#PID|k'` (um só) e somava em `ev`. `listarFotosCel` também busca
por esse campo, e a contagem soma `ev`. A Parte 2 deve tratar `refs` ausente como `[ref convertido]`.

## Regras (resumo)

- **Criar**: quem aponta na área (a mesma regra do apontamento: Operação · líder a gestor, na área e no escopo) ou o
  administrador; `por == request.auth.uid`; campos obrigatórios; tamanhos; área igual à da semana; campos de
  exportação/lixeira/remoção vazios.
- **Ler**: quem lê as semanas do conjunto (Operação ou Gestão com o escopo).
- **Alterar**: autor só `refs` (24 h e ainda apontando na área); administrador `refs`, `exportadoEm`, `exportLote`,
  `lixeiraEm`, `removidaEm`.
- **Apagar**: o administrador; quem aponta na área só a foto ainda não exportada (Apontar).
- `semanas`/`b_semanas`: quem aponta pode alterar `ft` (além de `s`, `m`, `ev`).
- `config/fotos`: todos os ativos leem; só o administrador grava, com os limites.

## O que a Parte 2 precisa saber

1. Para listar as fotos de um período: `evidencias` por `mes` ou por `semana` (`listarEvidenciasSemanas`), sempre
   filtrando `lixeiraEm == null && removidaEm == null` (a Parte 2 mostra as arquivadas com a miniatura; veja abaixo). O arquivo completo vem de `abrirEvidencia(id, conj)`.
2. Uma foto pode valer para várias atividades: no relatório, use `refs` (e o plano) para listar as atividades; no .zip,
   guarde o arquivo uma vez (o `sha` identifica fotos iguais).
3. Ao exportar: grave `exportadoEm` (hora) e `exportLote` (id do lote) — só o administrador pode.
4. Ao mandar para a lixeira: `lixeiraEm`. Ao remover de vez: apague `evidenciasArquivo/{id}` e grave `removidaEm`
   (ou apague o leve também). Se quiser que o 📷 da tela suma, diminua `ft['PID|k']` de cada `ref` no mesmo lote
   (`increment(-1)`; o administrador pode alterar a semana inteira).
5. A cópia de segurança diária já deixa as fotos completas de fora (`integracao/admin/backup.mjs`).
6. `firestore.indexes.json` tira `thumb` e `dados` dos índices (economiza espaço). A publicação automática hoje envia só
   as regras (`firestore:rules`): para valer, publique os índices uma vez (`firebase deploy --only firestore:indexes`)
   ou acrescente `firestore:indexes` ao passo de publicação.

---

# Parte 2 — Relatórios e arquivo de fotos

Tela **Administração › Relatórios e arquivo de fotos** (aba "Arquivo de fotos", ao lado de "Fotos"), só do
**administrador** (`isAdmin()`; fica em `SO_ADMIN` de `permissoes.js`, não aparece para o perfil "Dos módulos").
Escolhe-se **Pátio ou Bateria**, o **período** (esta semana, semana passada ou datas, até 3 meses) e, se quiser, a
**rota**. A tela lê as fotos do período (`listarEvidenciasPeriodo`, por `mes`) e mostra quantas há em cada situação e o
espaço estimado no banco.

## Situação de cada foto (selos)

| Selo | Campos | O que quer dizer |
| --- | --- | --- |
| **No banco** | sem `exportadoEm` | ainda não foi para nenhum .zip |
| **Exportada** | `exportadoEm`, `exportLote`, `exportConf` | está num .zip que o administrador confirmou ter salvo; a foto completa continua no banco |
| **Na lixeira** | + `lixeiraEm` | some das telas (Apontar, Programação); pode ser restaurada |
| **Arquivada fora do banco** | + `removidaEm` | a foto completa (`evidenciasArquivo`) foi apagada; fica o documento leve |

Os selos aparecem na tela de gestão e no visualizador (fotos de uma atividade). No visualizador, "No banco" só aparece
para o administrador; a arquivada abre só a miniatura, com o lote da exportação na legenda.

## Relatório em PowerPoint (.pptx)

Gerado no navegador com a PptxGenJS (tamanho 16:9, cores da marca: azul `#272662`, laranja `#F05A26`, logotipo
branco). Não grava nada no banco.

Comparação (só Atividades): na capa e nos cartões de Cumprimento e Com foto do painel aparece a diferença em pontos
para o período anterior com os mesmos dias ("▲ 4 pts sobre a semana anterior"; `FA.periodoAnterior`,
`FA.variacaoPts`). Só os percentuais se comparam (as quantidades mudam se o período ainda não terminou). A tela
reaproveita as semanas já lidas e só lê do banco os meses que faltam (em geral, nenhum).

Escolha das fotos: na lista "Fotos do período", cada foto tem "Tirar do relatório" e "☆ Destaque". A escolha fica
só no aparelho (localStorage `dikma-fotos-relatorio`; não grava no banco nem muda o .zip). As tiradas não entram no
relatório nem nos números de fotos; os destaques (até 4, `FA.destaques`) ganham o slide "Destaques do período" logo
antes dos registros fotográficos e continuam também no seu slide normal.

Todos os slides internos têm o número da página no canto da barra azul ("5 / 14").

1. **Capa**: área (Pátio/Bateria), período, rota, responsável e os 3 números principais (fotos, % de cumprimento e
   % com foto; na Queda zero e nas OMs: fotos, ocorrências e locais).
2. **Painel de resultados** (logo depois da capa, para quem lê ver os números primeiro): 6 cartões (programadas,
   realizadas, não realizadas, extras, % de cumprimento = realizadas ÷ programadas contando os dias até hoje, % com
   foto pela contagem `ft` da semana), rosca da situação das programadas, cumprimento por rota (da menor para a maior)
   e fotos por dia (por semana acima de 35 dias).
3. **Painel por rota**: tabela com barras de cumprimento e de foto (12 rotas por slide, com o total). Cores:
   verde 90% ou mais, amarelo 70% a 89%, vermelho abaixo de 70% (`FA.semaforo`).
4. **Pontos de atenção**: não realizadas por motivo e por rota, realizadas sem foto por rota.
5. **Registros fotográficos**: até 4 fotos por slide; a marca Antes/Durante/Depois fica numa etiqueta colorida em
   cima da foto e a hora embaixo. Os dados (data, atividade ou motivo da queda / serviço da OM, rota e área,
   colaborador e a situação colorida) ficam num cartão à direita; com exatamente 2 fotos deitadas
   (`FA.fotosEmFaixa`), as fotos ficam grandes lado a lado e os dados numa faixa embaixo. Embaixo do título,
   "Registro 3 de 25". A atividade com 4 fotos ou mais tem slides só dela; atividades com poucas fotos do mesmo dia,
   área e rota dividem o slide (título "ROTA 4 · 2 atividades"; fotos com "Atividade 1", "2"…).
6. **Anexos**: listas das não realizadas (com o motivo) e das realizadas sem foto (até 4 e 3 slides) e o encerramento.

Queda zero e OMs: no lugar dos itens 2 a 4 e 6, um **Painel de registros** (logo depois da capa: fotos, ocorrências, dias, locais,
colaboradores, fotos por dia e locais com mais fotos). As contas do painel ficam em `contas/fotos-arquivo.js`
(`fotosPorPeriodo`, `contarPor`, `resumoRegistros`) e usam todas as fotos do período, mesmo as que ficaram fora do
arquivo pelo limite.

**Limite:** 120 fotos por relatório (~150 KB cada). Acima disso, as fotos entram em rodízio entre as atividades do
período (a 1ª de cada, depois a 2ª…) e a tela e a capa avisam quantas ficaram de fora — para todas,
escolha uma rota ou um período menor. A foto arquivada entra com a miniatura (e o aviso na legenda).

## Exportar fotos (.zip)

- Entram as fotos **No banco** (marcando "Incluir as já exportadas", também as exportadas). Até 600 fotos por arquivo.
- Para cada foto, o navegador baixa a foto completa (`abrirEvidencia`), **calcula o SHA-256** e compara com o `sha`
  gravado pelo celular. Resultado em `indice.csv` (coluna `conferencia`): `conferida`, `DIVERGENTE`,
  `sem SHA gravado (não conferida)` ou `SEM ARQUIVO no banco` (a foto ainda não subiu: fica fora do .zip e não é
  marcada). A tela avisa as divergentes.
- Estrutura (sem acentos e sem caracteres proibidos no Windows, em maiúsculas):

  ```
  2026-11-09_a_2026-11-15/
    indice.csv
    LEIA-ME.txt
    NOME DO COLABORADOR/
      ROTA - LOCAL - ATIVIDADE/2026-11-10_<id>.jpg
      ROTA - VARIAS ATIVIDADES (5)/2026-11-10_<id>.jpg     ← foto que vale para 5 atividades (guardada uma vez)
  ```

  Colaborador = `porNome` (quem tirou a foto). As fotos entram sem compressão (já são JPEG).
- `indice.csv`: UTF-8 com BOM, separado por **ponto e vírgula** (abre direto no Excel em português), uma linha por foto
  e atividade (a foto de 5 atividades tem 5 linhas com o mesmo arquivo). Colunas: `id; data; area; rota; local;
  atividade; situacao; colaborador; sha256; arquivo; conferencia; lote`. Texto que começa com `=`, `+`, `-` ou `@`
  ganha um apóstrofo (não vira fórmula).
- Depois do download a tela pergunta **"O arquivo foi salvo?"**. Só no **"O arquivo foi salvo"** as fotos que entraram
  recebem `exportadoEm` (hora do servidor), `exportLote` e `exportConf` (lotes de 400). "Baixar de novo" entrega o mesmo
  arquivo; "Não salvei · cancelar" não marca nada. O histórico registra o lote.

## Lixeira e apagar de vez

- **Mover para a lixeira** (em lote ou uma a uma): só fotos **Exportadas**. Em lote, as de SHA-256 divergente ficam de
  fora (uma a uma, com a confirmação, podem ir). Confirmação: **digitar a quantidade**. Grava `lixeiraEm`.
- **Restaurar**: tira `lixeiraEm` (continua exportada). Não pede texto.
- **Apagar de vez** (aba Lixeira, em lote ou uma a uma): só as que estão na lixeira há **7 dias ou mais**; marcando
  "Incluir as que estão na lixeira há menos de 7 dias", também as recentes. Confirmação: **digitar `APAGAR n`**. No
  mesmo lote: apaga `evidenciasArquivo/{id}` (a foto completa) e grava `removidaEm` no documento leve. **Lotes de 15
  fotos**: a regra lê o documento leve de cada foto e o Firestore aceita no máximo 20 leituras de regra por lote.
- Não há limpeza automática: depois dos 7 dias a foto continua na lixeira até o administrador apagar de vez (sem
  servidor próprio no plano grátis).

### Decisões

- **O documento leve fica** (com a miniatura de ~5 KB, `sha`, dados da atividade, `exportLote`): o histórico continua
  mostrando que a atividade teve foto e onde ela foi arquivada (lote), e o relatório pode usar a miniatura. Cada foto
  arquivada ocupa ~6 KB em vez de ~200 KB.
- **A contagem `ft` da semana não diminui**: o 📷n continua igual e o indicador "% com foto" não cai, porque a
  atividade *teve* foto (só não está mais no banco). Diminuir faria a atividade aparecer como "sem foto" no Meu dia e no
  Painel, o que seria falso. No visualizador, a foto arquivada aparece com a miniatura e o selo; a da lixeira não
  aparece (o 📷n pode mostrar mais fotos do que a lista enquanto a foto está na lixeira).
- **Os apontamentos não mudam** (semanas, aprovações): nenhuma ação desta tela grava nas semanas.
- O relatório em PowerPoint não marca exportação: só o .zip é o arquivo de guarda.

### Regras (firestore.rules) — o que a Parte 2 acrescentou

- `exportConf` entra na lista de campos (nasce vazio).
- O administrador altera `exportadoEm` (hora ou null), `exportLote` (texto até 60), `exportConf` (`ok`, `divergente`,
  `sem-sha` ou null), `lixeiraEm` (hora, **só com `exportadoEm`**; null = restaurar) e `removidaEm` (hora, **só com
  `lixeiraEm`**). Depois de removida a foto não volta (removidaEm, lixeiraEm e exportadoEm ficam como estão).
- `evidenciasArquivo` (e `b_`): apagar só o administrador e **só junto da marca `removidaEm` numa foto exportada**
  (`getAfter` do leve) ou junto com o próprio documento leve.
- Fotos do código antigo (só `ref`, sem `refs`): o administrador pode marcar exportação, lixeira e remoção.
- Testes em `testes/regras.test.mjs` (blocos "Fotos (Parte 2)").

### Funções novas (data.js e data-mock.js)

`listarEvidenciasPeriodo(conj, de, ate)`, `listarEvidenciasLixeira(conj)` (`where('lixeiraEm', '!=', null)`),
`semanasPeriodo(conj, meses)`, `marcarExportadas(conj, itens, lote)`, `moverLixeira(conj, ids)`,
`restaurarLixeira(conj, ids)`, `apagarDefinitivo(conj, ids)`. As gravações esperam o servidor (sem sinal a tela não
começa) e mostram o progresso. A demonstração (`?demo`) já começa com fotos nas quatro situações e uma foto com SHA-256
"errado" de propósito, para mostrar o aviso.
