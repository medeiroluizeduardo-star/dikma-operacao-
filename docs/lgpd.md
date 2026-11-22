# LGPD no Dikma Gestão

Decidido pelo Eduardo em 22/11/2026.

## Quem abriu a ficha
- Ao abrir a ficha de uma pessoa (RH › Colaboradores e Gestão › Ficha de acompanhamento), o sistema grava quem abriu, qual ficha, de quem e o dia. Uma linha por usuário, pessoa, ficha e dia (coleção `acessosFicha`, id `uid|mat|ficha|dia`).
- Só o administrador vê (botão **Quem abriu** na ficha). Ninguém altera. Só o administrador apaga (descarte por prazo).
- Código: `public/ui/acessos-ficha.js`, `DB.acessoFicha` e `DB.acessosFichaDe` em `public/nucleo/data.js`.

## Prazos de guarda
| O quê | Prazo | O que sai |
|---|---|---|
| ASO (Treinamentos e ASO, tipo `ASO`) | 2 anos depois de vencer; de quem saiu, 2 anos depois da demissão | o registro antigo (o mais recente de cada pessoa ativa sempre fica) |
| Atestado (AT) e afastamento (AF) | 12 meses depois do dia | só a observação escrita (`jus.obs`); o código e o motivo da lista ficam |
| Registro de quem abriu a ficha | 1 ano | a linha |

O exame em si (prontuário, NR-7) fica com a medicina do trabalho, não neste sistema.

## Como descartar
Administração › Visão geral › **LGPD**: ler o que passou do prazo, baixar a cópia (JSON) e digitar APAGAR. Nada sai sozinho. O histórico guarda só os números.
- O ASO apagado vira "apagado" (as datas e a observação saem na hora); a rotina diária dos avisos apaga o documento de vez depois de 45 dias.
- Cuidado: importar de novo uma planilha antiga de treinamentos traz os ASO antigos de volta.
- Contas: `public/contas/lgpd.js` (testes em `testes/lgpd.test.mjs`); tela: `public/telas/lgpd.js`.
