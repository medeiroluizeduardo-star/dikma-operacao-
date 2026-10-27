// Dikma Gestão — ponto de entrada. Atividades Pátio e Atividades Bateria usam as mesmas telas (conjunto ativo em SK).
// Os dados vêm de data.js (Firebase) ou data-mock.js (abrir com ?demo). O código fica dividido assim:
//   nucleo/base.js      ambiente (demonstração, TV), banco de dados (DB), data de hoje e utilidades de texto
//   nucleo/estado.js    estado da tela (UI), quem entrou (ME), conjunto aberto (SK) e o que a pessoa pode ver e fazer
//   nucleo/acoes.js     registro das ações dos botões (data-act)
//   nucleo/modulos.js   Meu dia, pessoas e as telas de Operação, fichas do Efetivo e Frequência (carregadas quando precisa)
//   calc/               contas sem tela: atividades (programado, atrasadas, aprovação) e presença (escala, situação do dia)
//   navegacao.js        abas (VIEWS), módulos (MODS), barra de baixo do celular e troca de módulo
//   ui/                 ícones, janelas (sheet, formSheet, toast) e a moldura da tela (render, menu, topo, filtros, busca)
//   telas/              cada tela: atividades, apontar, efetivo, horas extras e justificativas, relatórios, configurações
//   eventos.js          cliques, envios e mudanças dos campos · tv.js: Modo TV · inicio.js: liga tudo e entra no sistema
// A ordem dos imports abaixo é a ordem em que cada parte fica pronta.
import './nucleo/base.js';
import './nucleo/estado.js';
import './nucleo/acoes.js';
import './ui/icones.js';
import './calc/atividades.js';
import './calc/presenca.js';
import './navegacao.js';
import './ui/janelas.js';
import './ui/shell.js';
import './telas/atividades.js';
import './telas/apontar.js';
import './telas/efetivo.js';
import './telas/horas-justificativas.js';
import './telas/relatorios.js';
import './telas/config.js';
import './tv.js';
import './nucleo/modulos.js';
import './eventos.js';
import './inicio.js';
