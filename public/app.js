// Dikma Gestão — ponto de entrada. Atividades Pátio e Atividades Bateria usam as mesmas telas (conjunto ativo em SK).
// Os dados vêm de nucleo/data.js (Firebase) ou nucleo/data-mock.js (abrir com ?demo). O código fica dividido assim:
//   nucleo/base.js      ambiente (demonstração), banco de dados (DB), data de hoje e utilidades de texto
//   nucleo/estado.js    estado da tela (UI), quem entrou (ME), conjunto aberto (SK) e o que a pessoa pode ver e fazer
//   nucleo/erros.js     anota os erros que acontecem no aparelho e grava no banco (Administração › Erros nos aparelhos)
//   nucleo/acoes.js     registro das ações dos botões (data-act)
//   nucleo/modulos.js   Avisos no celular, pessoas e as telas de Operação, fichas do Efetivo e Frequência (carregadas quando precisa)
//   calc/               contas das telas: atividades (programado, atrasadas, aprovação) e presença (escala, situação do dia)
//   contas/             contas sem tela e sem banco, as mesmas no site, nos testes e nas rotinas do GitHub (cal, situacao...)
//   nucleo/navegacao.js abas (VIEWS), módulos (MODS), barra de baixo do celular e troca de módulo
//   nucleo/eventos.js   cliques, envios e mudanças dos campos · nucleo/inicio.js: liga tudo e entra no sistema
//   ui/                 ícones, janelas (sheet, formSheet, toast), a moldura da tela (render, menu, topo, filtros, busca),
//                       busca nas listas, baixar Excel, animações e o lançamento de presença
//   telas/              cada tela: atividades, apontar, efetivo, horas extras e justificativas, relatórios, configurações,
//                       Operação (equip), fichas do Efetivo (gestao, importar), Frequência (administrativo), Avisos no celular (avisos)
//                       Resumos e configurações da Administração só são baixados quando abertos (nucleo/modulos.js).
// A ordem dos imports abaixo é a ordem em que cada parte fica pronta.
import './nucleo/base.js';
import './nucleo/estado.js';
import './nucleo/erros.js';
import './nucleo/acoes.js';
import './ui/icones.js';
import './calc/atividades.js';
import './calc/presenca.js';
import './nucleo/navegacao.js';
import './ui/janelas.js';
import './ui/shell.js';
import './telas/atividades.js';
import './telas/apontar.js';
import './telas/efetivo.js';
import './telas/horas-justificativas.js';
import './nucleo/modulos.js';
import './nucleo/eventos.js';
import './nucleo/inicio.js';
