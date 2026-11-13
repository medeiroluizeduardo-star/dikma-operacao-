// Página do guia visual (guia.html): mostra as cores, os espaçamentos, os títulos e cada componente padrão
// (ui/padrao.js + ui/padrao.css) com dados de exemplo. Não lê nem grava nada no banco.
import { I } from './icones.js';
import { cabecalho, botaoAcao, indicadores, etiqueta, tabela, vazio, carregando, recolhido, variacao } from './padrao.js';

const sec = (titulo, codigo, texto, corpo) => `<section class="g-sec"><header><h2 class="p-t2">${titulo}${codigo ? ` <small>${codigo}</small>` : ''}</h2>${texto ? `<p>${texto}</p>` : ''}</header>${corpo}</section>`;
const cor = (nome, v, uso) => `<div class="g-cor"><i style="background:var(${v})"></i><div><b>${nome}</b><code>${v}</code><span class="muted">${uso}</span></div></div>`;
const filtrosEx = `<label class="sel"><span>Mês</span><select class="in"><option>Novembro 2026</option><option>Outubro 2026</option></select></label>`
  + `<label class="sel"><span>Área</span><select class="in"><option>Todas</option><option>Pátio</option><option>Bateria</option></select></label>`;

const inds = [
  { rotulo: 'Atividades realizadas', valor: '94', unidade: '%', meta: '95', variacao: variacao(94, 91, { unidade: ' p.p.' }), serie: [88, 90, 89, 91, 93, 94], situacao: 'atencao' },
  { rotulo: 'Presença', valor: '97', unidade: '%', meta: '96', variacao: variacao(97, 97), serie: [95, 96, 97, 96, 97, 97], situacao: 'ok' },
  { rotulo: 'Faltas no mês', valor: '6', meta: '4', variacao: variacao(6, 3, { maiorMelhor: false }), serie: [2, 3, 3, 5, 4, 6], situacao: 'critico' },
  { rotulo: 'Equipamentos disponíveis', valor: '18', unidade: '/20', variacao: variacao(18, 17), serie: [16, 17, 17, 18, 17, 18] },
];
const linhas = [
  ['Pátio', etiqueta('No prazo', 'ok'), '42', '96%'],
  ['Bateria', etiqueta('Atenção', 'atencao'), '38', '91%'],
  ['Coqueria Geral', etiqueta('Atrasado', 'critico'), '12', '83%'],
  ['Equipamentos', etiqueta('Em análise', 'info'), '9', '—'],
];
const tab = tabela([{ t: 'Área' }, { t: 'Situação' }, { t: 'Atividades', n: true }, { t: 'Realizado', n: true }], linhas,
  { rotulo: 'Exemplo de tabela', acoes: () => `<button type="button" class="btn ghost" aria-label="Abrir">${I.eye}</button>` });

const html = [
  `<div class="g-intro"><h1 class="p-t1">Como as telas devem ficar</h1><p class="muted">Este guia é a referência para as telas novas e para a revisão das antigas, um módulo por vez. Nada aqui muda as telas que já existem.</p>
   <ol><li>Espaçamento só em 6 degraus: 4, 8, 12, 16, 24 e 32.</li><li>Três tamanhos de título: tela, cartão e subtítulo.</li><li>Cor de situação (ok, atenção, crítico, informação) é diferente da cor da marca.</li><li>Um só laranja por tela: o botão da ação principal.</li><li>No topo do painel, no máximo 4 números. O detalhe vem embaixo e o que não pede ação fica recolhido.</li><li>No celular: uma coluna, botões grandes e a barra de baixo com as abas mais usadas.</li></ol></div>`,

  sec('Cores da marca', '', 'Identidade da Dikma. Não usar para indicar se algo está bom ou ruim.',
    `<div class="g-cores">${cor('Azul Dikma', '--marca', 'títulos de módulo, links, gráficos')}${cor('Menu', '--rail', 'menu lateral e topo')}${cor('Laranja', '--acao', 'só a ação principal')}${cor('Fundo', '--bg', 'fundo da tela')}${cor('Cartão', '--surface', 'cartões e tabelas')}${cor('Texto', '--ink', 'texto principal')}${cor('Texto fraco', '--ink-3', 'rótulos e frases curtas')}</div>`),

  sec('Cores de situação', '', 'Sempre com texto junto (nunca só a cor), para quem não distingue cores e para a impressão.',
    `<div class="g-cores">${cor('Ok', '--ok', 'no prazo, dentro da meta')}${cor('Atenção', '--atencao', 'perto do limite, pendente')}${cor('Crítico', '--critico', 'atrasado, fora da meta')}${cor('Informação', '--info', 'em análise, aviso neutro')}</div>
     <div class="g-linha">${etiqueta('No prazo', 'ok')}${etiqueta('Pendente', 'atencao')}${etiqueta('Atrasado', 'critico')}${etiqueta('Em análise', 'info')}${etiqueta('Arquivado', 'neutro')}</div>`),

  sec('Espaçamentos', '--s1 a --s6', 'Entre campos 8 ou 12; dentro do cartão 16; entre blocos 24; entre seções 32.',
    `<div class="g-palco"><div class="g-esp">${[['--s1', 4], ['--s2', 8], ['--s3', 12], ['--s4', 16], ['--s5', 24], ['--s6', 32]].map(([v, px]) => `<div><code class="mono">${px} px</code><i style="width:var(${v})"></i></div>`).join('')}</div></div>`),

  sec('Títulos', '--tit-1 a --tit-3', '',
    `<div class="g-palco"><h3 class="p-t1">Título da tela (26)</h3><h3 class="p-t2">Título do cartão (19)</h3><h3 class="p-t3">Subtítulo dentro do cartão (15)</h3><p class="muted">Texto corrido em 14, rótulos em 11 maiúsculas.</p></div>`),

  sec('Botões', '', 'O laranja é só para a ação principal da tela. As outras ações usam o botão comum ou o discreto.',
    `<div class="g-palco"><div class="g-linha">${botaoAcao('Nova tratativa', '', I.plus)}<button type="button" class="btn">${I.dl} Exportar</button><button type="button" class="btn ghost">Cancelar</button><button type="button" class="btn danger">Excluir</button></div>
     <div class="g-dupla"><div class="g-sim"><b>Certo:</b> um botão laranja por tela, à direita do título.</div><div class="g-nao"><b>Evitar:</b> vários botões laranja lado a lado.</div></div></div>`),

  sec('Cabeçalho de tela', 'cabecalho()', 'Sempre igual: módulo e ícone no alto, título, uma frase curta, a ação principal à direita e os filtros embaixo.',
    `<div class="g-palco">${cabecalho({ modulo: 'Gestão', icone: I.gestao, titulo: 'Resultados', frase: 'Indicadores do mês com a meta de cada um.', acao: botaoAcao('Nova tratativa', '', I.plus), filtros: filtrosEx })}</div>`),

  sec('Cartões de indicador', 'indicadores()', 'Número grande, meta, variação contra o mês anterior e mini-tendência. A borda colorida mostra a situação. No máximo 4.',
    `<div class="g-palco cinza">${indicadores(inds)}</div>`),

  sec('Tabela padrão', 'tabela()', 'Cabeçalho fixo ao rolar, números à direita, ações na última coluna.', `<div class="g-palco">${tab}</div>`),

  sec('Tela vazia e carregando', 'vazio() · carregando()', 'A tela vazia diz o que aconteceu e o que fazer.',
    `<div class="g-dupla">${vazio('Nenhuma tratativa aberta', 'Quando um indicador sair da meta, abra uma tratativa por aqui.', botaoAcao('Nova tratativa', '', I.plus), I.ok)}<div class="g-palco">${carregando().replace(' aria-busy="true"', '')}</div></div>`),

  sec('Área recolhida', 'recolhido()', 'O que não pede ação agora fica fechado, para a tela ficar curta.',
    recolhido('Histórico do mês (12 registros)', '<p class="muted">Conteúdo que só abre quando a pessoa quer ver.</p>')),

  sec('Formulário', '', 'Duas colunas no computador e uma no celular; campos e botões com pelo menos 40 px de altura.',
    `<div class="g-palco"><div class="p-form"><label class="p-campo"><span>Área</span><select><option>Pátio</option><option>Bateria</option></select></label><label class="p-campo"><span>Data</span><input type="date" value="2026-11-13"></label><label class="p-campo"><span>Responsável</span><input type="text" placeholder="Nome de quem vai tratar"></label><label class="p-campo"><span>Prazo</span><input type="date"></label></div><div class="g-linha">${botaoAcao('Salvar')}<button type="button" class="btn ghost">Cancelar</button></div></div>`),

  sec('Exemplo de tela montada no padrão', '', 'Como uma tela nova fica juntando as peças: cabeçalho, até 4 números no topo, o detalhe embaixo e o resto recolhido.',
    `<div class="g-palco cinza">${cabecalho({ modulo: 'Gestão', icone: I.gestao, titulo: 'Resultados', frase: 'Novembro de 2026 · todas as áreas', acao: botaoAcao('Nova tratativa', '', I.plus), filtros: filtrosEx })}
     ${indicadores(inds)}<div class="g-detalhe">${tab}<div class="g-palco"><h3 class="p-t2">Tratativas abertas</h3>${vazio('Nenhuma tratativa aberta', 'Tudo dentro da meta neste mês.')}</div></div>
     ${recolhido('Indicadores dentro da meta (8)', '<p class="muted">Lista do que está ok, sem pedir ação.</p>')}</div>`),
].join('');

document.getElementById('guia').innerHTML = html;

// Tema só desta página (não muda a escolha salva no aparelho).
const botoes = [...document.querySelectorAll('[data-tema]')];
const marcar = () => { const t = document.documentElement.getAttribute('data-theme') || ''; botoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t))); };
botoes.forEach(b => b.addEventListener('click', () => { if (b.dataset.tema) document.documentElement.setAttribute('data-theme', b.dataset.tema); else document.documentElement.removeAttribute('data-theme'); marcar(); }));
marcar();
