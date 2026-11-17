// Administração › Trazer do Meu painel: o administrador lê o próprio Meu painel (site antigo, painel/{uid}/...) e traz
// os dados para as telas do Dikma (Tratativas, Processos e rotina, Inspeções, Documentos e OMs, Medição e Indicadores).
// Só grava o que ainda não existe (rodar de novo não duplica). As contas ficam em contas/trazer-painel.js; a leitura e
// a gravação, em nucleo/data.js (painelLer, painelTrazer). Esta aba sai junto com o Meu painel, depois de conferido.
import { COLECOES, planoDoPainel, contarPlano, faltaMed, faltaInd, textoNotas } from '../contas/trazer-painel.js';
import { etiqueta, vazio, carregando } from '../ui/padrao.js';
import { DB, esc } from '../nucleo/base.js';
import { ME } from '../nucleo/estado.js';
import { ehAdminU } from '../contas/acessos.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

// etapa: inicio → lendo → lido (plano pronto) → gravando → feito; erro em qualquer uma.
const S = { etapa: 'inicio', P: null, pl: null, res: null, erro: '', confirma: false };
const NOME_COL = { tratativas: 'Tratativas', documentos: 'Documentos e OMs', seginsp: 'Inspeções', rotina: 'Processos e rotina', medicao: 'Medição', indicadores: 'Metas dos Indicadores' };

function linhas(c) {
  const l = [
    ['Ações (5W2H)', c.acoes, 'Gestão › Tratativas', 'gtrat'],
    ['Planos 5W2H', c.planos, 'Gestão › Tratativas', 'gtrat'],
    ['Atas de reunião', c.atas, 'Gestão › Tratativas', 'gtrat'],
    ['Tarefas da rotina já marcadas', c.rotina, 'Administração › Processos e rotina', 'cfproc'],
    ['Inspeções (5S, segurança, área)', c.insp, 'Segurança › Inspeções', 'sginsp'],
    ['Documentos e OMs', c.docs, 'Administração › Documentos e OMs', 'cfdocs'],
    ['Medição: lançados e ocultos', c.lanc + c.ocul, 'Gestão › Medição', 'gmed'],
    ['Medição: registros digitados', c.man, 'Gestão › Medição', 'gmed'],
    ['Metas e ICCC/ICCP dos meses', c.metas + c.valores, 'Indicadores › Visão geral', 'ivisao']
  ];
  return `<div class="tp-lista">${l.map(([o, n, onde, aba]) => `<div class="tp-it${n ? '' : ' tp-zero'}"><b class="tp-n">${n}</b><span><b>${esc(o)}</b><small>vai para ${esc(onde)}</small></span>${n && S.etapa === 'feito' ? `<button type="button" class="btn sm ghost" data-go="${aba}">Abrir</button>` : ''}</div>`).join('')}</div>`;
}

function fora(f) {
  const l = [];
  if (f.notas) l.push(`<li>${f.notas} anotaç${f.notas > 1 ? 'ões' : 'ão'} (combinado não trazer). <button type="button" class="btn sm ghost" data-act="tpNotas">${I.dl} Baixar num arquivo</button></li>`);
  if (f.quedas) l.push(`<li>${f.quedas} registro${f.quedas > 1 ? 's' : ''} da Queda Zero do painel: a Operação › Queda zero já é a oficial.</li>`);
  if (f.relatorios) l.push(`<li>${f.relatorios} relatório${f.relatorios > 1 ? 's' : ''} fotográfico${f.relatorios > 1 ? 's' : ''}: as fotos do Dikma já fazem esse papel.</li>`);
  l.push('<li>Equipe e calculadoras: não precisam (o Dikma já tem o cadastro das pessoas).</li>');
  return `<details class="p-recolhe"><summary>O que não vem</summary><div><ul class="tp-fora">${l.join('')}</ul><p class="muted small m0">Tudo continua guardado no banco e na cópia de segurança diária, mesmo depois de desligar o Meu painel.</p></div></details>`;
}

function vTela() {
  if (!ehAdminU(ME)) return vazio('Sem acesso', 'Só o administrador traz os dados do próprio Meu painel.');
  const intro = `<p class="muted">Lê os dados do <b>seu</b> Meu painel e coloca cada um na tela nova do Dikma. Só entra o que ainda não está aqui: pode repetir sem duplicar, e o que você mudar depois não é desfeito. O Meu painel continua funcionando até você mandar desligar.</p>`;
  if (S.etapa === 'inicio' || (S.etapa === 'erro' && !S.pl)) {
    return `${intro}${S.erro ? `<p class="err">${esc(S.erro)}</p>` : ''}<button type="button" class="btn pri" data-act="tpLer">${I.dl} Ler o meu Meu painel</button>
      <p class="muted small">A leitura é feita uma vez só, ao tocar no botão.</p>`;
  }
  if (S.etapa === 'lendo') return `${intro}${carregando()}`;
  const c = contarPlano(S.pl);
  const total = c.acoes + c.planos + c.atas + c.rotina + c.insp + c.docs + c.lanc + c.ocul + c.man + c.metas + c.valores;
  if (!total && S.etapa !== 'feito') return `${intro}${vazio('Nada para trazer', 'O seu Meu painel não tem ações, planos, atas, inspeções, documentos nem registros da Medição.')}${fora(S.pl.fora)}`;
  let h = intro;
  if (S.etapa === 'feito') {
    const r = S.res;
    h += `<p class="ic-placar">${r.falhas.length ? etiqueta('Trazido em parte', 'atencao') : etiqueta('Pronto', 'ok')} <b>${r.novos}</b> ite${r.novos === 1 ? 'm trazido' : 'ns trazidos'}${r.ja ? ` · ${r.ja} já estava${r.ja > 1 ? 'm' : ''} no Dikma` : ''}. Confira nas telas abaixo.</p>`;
    if (r.falhas.length) h += `<p class="err">Não entraram: ${r.falhas.map(f => `${esc(NOME_COL[f.col] || f.col)} (${f.n}, ${esc(f.erro)})`).join('; ')}. Toque em Trazer de novo depois; se repetir, me avise.</p>`;
  } else h += `<p class="ic-placar"><b>${total}</b> ite${total === 1 ? 'm' : 'ns'} encontrado${total === 1 ? '' : 's'} no seu Meu painel.</p>`;
  h += linhas(c);
  if (S.pl.erros.length) h += `<details class="p-recolhe" open><summary>${S.pl.erros.length} ite${S.pl.erros.length > 1 ? 'ns' : 'm'} com problema (não ${S.pl.erros.length > 1 ? 'vão' : 'vai'})</summary><div><ul class="tp-fora">${S.pl.erros.slice(0, 50).map(e => `<li>${esc(e)}</li>`).join('')}</ul></div></details>`;
  h += fora(S.pl.fora);
  if (S.etapa === 'gravando') h += `<p>${carregando()} Gravando…</p>`;
  else h += `<div class="row-gap"><button type="button" class="btn pri" data-act="tpTrazer">${S.confirma ? 'Confirmar: trazer agora' : S.etapa === 'feito' ? 'Trazer de novo (só o que faltar)' : 'Trazer para o Dikma'}</button>
    <button type="button" class="btn ghost" data-act="tpLer">Ler de novo</button></div>
    ${S.confirma ? '<p class="muted small">A cópia de segurança do banco roda todo dia às 5h. Se quiser uma agora, rode o workflow de backup antes.</p>' : ''}`;
  return h;
}

acoes.tpLer = async () => {
  S.etapa = 'lendo'; S.erro = ''; S.confirma = false; S.res = null; render();
  try {
    S.P = await DB.painelLer(COLECOES);
    S.pl = planoDoPainel(S.P, { uid: ME.uid, nome: ME.nome || ME.login || '' });
    S.etapa = 'lido';
  } catch (e) { S.etapa = 'erro'; S.pl = null; S.erro = 'Não foi possível ler o Meu painel: ' + (e.code === 'permission-denied' ? 'sem permissão' : e.code === 'resource-exhausted' ? 'a cota grátis do banco acabou hoje, tente amanhã' : e.message || 'erro'); }
  render();
};
acoes.tpTrazer = async () => {
  if (!S.pl || S.etapa === 'gravando') return;
  if (!S.confirma) { S.confirma = true; render(); return; }
  S.confirma = false; S.etapa = 'gravando'; render();
  try {
    S.res = await DB.painelTrazer(S.pl, { faltaMed, faltaInd });
    S.etapa = 'feito';
    DB.log(`Trazer do Meu painel: ${S.res.novos} itens trazidos, ${S.res.ja} já existiam${S.res.falhas.length ? `, falhou: ${S.res.falhas.map(f => f.col).join(', ')}` : ''}`, 'administracao');
    toast(S.res.falhas.length ? 'Parte não entrou: veja na tela' : 'Dados trazidos do Meu painel');
  } catch (e) { S.etapa = 'lido'; toast('Não foi possível gravar: ' + (e.code === 'permission-denied' ? 'sem permissão' : e.message || 'erro')); }
  render();
};
acoes.tpNotas = () => {
  const t = textoNotas((S.P || {}).notas); if (!t) { toast('Nenhuma anotação'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' }));
  a.download = 'anotacoes-meu-painel.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

export const topo = () => '';
export const renderView = () => vTela();
