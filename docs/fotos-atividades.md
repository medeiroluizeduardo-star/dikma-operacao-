# Fotos das atividades

Foto tirada no **Apontar** para comprovar a atividade. Este documento descreve o funcionamento e o **modelo de dados**,
que a Parte 2 (relatório em PowerPoint, exportação em .zip, lixeira e exclusão) usa.

Arquivos:

| Arquivo | O que tem |
| --- | --- |
| `public/fotos.js` | Contas sem tela: configuração padrão e validação, situação que exige foto, contador, `refs`, contagem por célula (`ft`), indicador e estimativa de armazenamento. Testado em `testes/fotos.test.mjs`. |
| `public/ui/fotos.js` | No navegador: reduzir a foto (JPEG), miniatura, SHA-256 e a foto grande em tela cheia. A Segurança usa as mesmas funções. |
| `public/telas/fotos.js` | Telas: passo de fotos, fotos de uma atividade, selo 📷, indicadores e Administração › Fotos das atividades. |
| `public/data.js` | Gravação (`apontarComFotos`), leitura (`listarFotosCel`, `listarEvidenciasSemanas`, `abrirEvidencia`), `ajustarRefsFoto`, `salvarCfgFotos`. |
| `public/data-mock.js` | Os mesmos nomes na demonstração (fotos de exemplo desenhadas em canvas). |
| `firestore.rules` | Bloco "Fotos das atividades". Testado em `testes/regras.test.mjs`. |

## Como funciona na tela

- **Configuração** (só o administrador): Administração › Atividades › **Fotos das atividades**. Liga ou desliga a
  obrigação, mínimo e máximo de fotos, situações que exigem foto (Realizada, Extra e, se quiser, Não realizada) e a data
  a partir da qual as realizadas sem foto contam como "sem foto". Mostra o efeito previsto no armazenamento.
- **Apontar**: ao marcar uma situação que exige foto, abre o **passo de fotos antes de concluir**. O contador mostra
  "Fotos: 0 de 1 obrigatória · máximo 3" (vermelho enquanto falta, âmbar com parte, verde quando está certo). O botão
  de confirmar só ativa com o mínimo; acima do máximo as fotos a mais não entram. **Cancelar não marca a atividade.**
- **Marcar restantes**: um passo de fotos só para o lote. As mesmas fotos valem para todas as atividades marcadas naquele
  momento e ficam guardadas **uma vez só**, com `refs` de todas.
- **Fora da programação**: a atividade incluída pelo supervisor, ao ser marcada como realizada, vale como **Extra**
  (exige foto se Realizada ou Extra estiverem marcadas).
- **Trocar a situação** (ex.: desmarcar): as fotos continuam ligadas; ao marcar de novo, as fotos que a célula já tem
  contam para o mínimo.
- **Lista do Apontar e Programação**: cada atividade com foto mostra 📷n; tocar abre as miniaturas e, tocando numa, a
  foto grande (lida de `evidenciasArquivo`). Quem aponta pode **adicionar foto** a um apontamento já feito, até o máximo.
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

Sem o documento vale o padrão de `public/fotos.js` (`obrig` true, `min` 1, `max` 3, `R` e `E`, `desde`
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
| `nome`, `tipo`, `tamanho` | criação | nome do arquivo escolhido, `'image/jpeg'`, `tamanho` = `bytes` |
| `bytes`, `w`, `h` | criação | tamanho do JPEG completo (até 700 mil) e pixels |
| `sha` | criação | SHA-256 (hex, 64) dos bytes do JPEG completo, calculado no aparelho; `''` se o navegador não deixou |
| `por`, `porNome`, `at` | criação | autor (= quem está logado) e hora do servidor (`at == request.time`) |
| `exportadoEm`, `exportLote` | **só o administrador** | `null` na criação. Parte 2: quando e em que lote a foto foi exportada |
| `lixeiraEm` | **só o administrador** | `null` na criação. Parte 2: foto na lixeira (as telas já escondem) |
| `removidaEm` | **só o administrador** | `null` na criação. Parte 2: arquivo completo apagado (as telas já escondem) |
| `atualizadoEm`, `atualizadoPor` | quem altera depois | |

Apagar o documento: **só o administrador**.

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
- **Apagar**: só o administrador.
- `semanas`/`b_semanas`: quem aponta pode alterar `ft` (além de `s`, `m`, `ev`).
- `config/fotos`: todos os ativos leem; só o administrador grava, com os limites.

## O que a Parte 2 precisa saber

1. Para listar as fotos de um período: `evidencias` por `mes` ou por `semana` (`listarEvidenciasSemanas`), sempre
   filtrando `lixeiraEm == null && removidaEm == null`. O arquivo completo vem de `abrirEvidencia(id, conj)`.
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
