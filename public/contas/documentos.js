// Administração › Documentos e OMs (era Campo › Documentos e OMs do Meu painel): contas sem tela.
// POP, PT, OS, ASO, treinamentos e OMs com validade, situação e responsável. Avisa o que está vencido ou vence dentro do
// prazo de aviso de cada documento (padrão: 30 dias).
// Usado pela tela (telas/documentos.js), pelos testes (testes/documentos.test.mjs) e pela rotina dos avisos no celular.
import { ehAdminU, perfilDe } from './acessos.js';

export const TIPOS = ['POP', 'PT', 'OS', 'ASO', 'Treinamento', 'OM', 'Outro'];
// O que cada tipo é, para a tela ajudar quem cadastra.
export const TIPO_NOME = { POP: 'Procedimento operacional padrão', PT: 'Permissão de trabalho', OS: 'Ordem de serviço de segurança', ASO: 'Atestado de saúde ocupacional', Treinamento: 'Treinamento ou certificado', OM: 'Ordem de manutenção', Outro: 'Outro documento' };
export const SITUACOES = ['Vigente', 'Em andamento', 'Pendente', 'Concluído', 'Cancelado', 'Arquivado'];
// Concluído, cancelado e arquivado não geram alerta.
export const ENCERRADAS = ['Concluído', 'Cancelado', 'Arquivado'];
// Onde vale o documento (os mesmos de Processos e rotina).
export const ONDE = { coq: 'Coqueria geral', patio: 'Pátio', bateria: 'Bateria' };
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', emergencia: 'Emergência' };
// Periodicidade (meses até vencer de novo; 0 = sem validade).
export const PERIODOS = { '': 'Informar a data', 0: 'Sem validade', 1: '1 mês', 3: '3 meses', 6: '6 meses', 12: '1 ano', 24: '2 anos', 36: '3 anos', 60: '5 anos' };
export const AVISOS = [7, 15, 30, 60, 90];
export const ALERTAS = { vencido: 'Vencidos', vence: 'Vencem em breve', ok: 'Em dia', sem: 'Sem validade', fim: 'Encerrados' };
export const ANTECEDENCIA = 30;
export const LIMITES = { numero: 40, rev: 10, titulo: 140, resp: 120, local: 120, area: 40, emitente: 120, colab: 150, mat: 20, link: 500, obs: 500, docs: 2000 };
// O que muda conforme o tipo: campos que aparecem, nomes das datas e o que é obrigatório.
const COM_REV = ['POP', 'PT', 'OS', 'Treinamento', 'Outro'];
const DA_PESSOA = ['ASO', 'Treinamento'];
const COM_NUMERO = ['POP', 'PT', 'OS', 'OM'];
export const regraDoTipo = tipo => ({
  rev: COM_REV.includes(tipo), pessoa: DA_PESSOA.includes(tipo), prio: tipo === 'OM', local: !DA_PESSOA.includes(tipo),
  numero: COM_NUMERO.includes(tipo),
  emissao: tipo === 'OM' ? 'Abertura' : tipo === 'ASO' ? 'Data do exame' : tipo === 'Treinamento' ? 'Data do treinamento' : 'Emissão',
  validade: tipo === 'OM' ? 'Prazo de execução' : tipo === 'ASO' ? 'Próximo exame' : tipo === 'PT' ? 'Válida até' : 'Validade',
  emitente: tipo === 'OM' ? 'Solicitante' : tipo === 'ASO' ? 'Clínica ou médico' : tipo === 'Treinamento' ? 'Instrutor ou instituição' : 'Elaborado / emitido por',
  numeroEx: tipo === 'OM' ? 'Ex.: OM 4500123' : tipo === 'PT' ? 'Ex.: PT-0457' : tipo === 'ASO' ? 'Opcional' : 'Ex.: POP-012'
});
const ORDEM = { vencido: 0, vence: 1, ok: 2, sem: 3, fim: 4 };

// Quem vê e cuida: o administrador e o Gestor e o Coordenador da Gestão (as regras do banco conferem o mesmo).
export const veDocsU = u => !!u && u.papel !== 'bloqueado' && (ehAdminU(u) || ['gestor', 'coordenador'].includes(perfilDe(u, 'gestao')));

const dia = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const ehData = s => typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(s);
const pad = n => String(n).padStart(2, '0');
// Dias da data de hoje até a validade (negativo = já venceu).
export const diasAte = (validade, hoje) => Math.round((dia(validade) - dia(hoje)) / 864e5);
// Data + meses (31/01 + 1 mês = 28 ou 29/02).
export function somaMeses(data, meses) {
  if (!ehData(data) || !meses) return '';
  const y = +data.slice(0, 4), m = +data.slice(5, 7) - 1 + +meses, d = +data.slice(8, 10);
  const fim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); const x = new Date(Date.UTC(y, m, Math.min(d, fim)));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
export const avisoDe = d => (AVISOS.includes(+d.aviso) ? +d.aviso : ANTECEDENCIA);
// vencido · vence (dentro do aviso, inclusive hoje) · ok · sem (sem validade) · fim (encerrado: sem alerta)
export function alerta(d, hoje) {
  if (ENCERRADAS.includes(d.situacao)) return 'fim';
  if (!ehData(d.validade)) return 'sem';
  const n = diasAte(d.validade, hoje);
  return n < 0 ? 'vencido' : n <= avisoDe(d) ? 'vence' : 'ok';
}
export function textoAlerta(d, hoje) {
  const a = alerta(d, hoje); const n = ehData(d.validade) ? diasAte(d.validade, hoje) : 0; const s = k => (k !== 1 ? 's' : '');
  if (a === 'vencido') return `Vencido há ${-n} dia${s(-n)}`;
  if (a === 'vence') return n === 0 ? 'Vence hoje' : `Vence em ${n} dia${s(n)}`;
  return a === 'ok' ? 'Em dia' : a === 'fim' ? d.situacao : 'Sem validade';
}
export const nomeDoc = d => [[d.numero, d.rev ? 'rev. ' + d.rev : ''].filter(Boolean).join(' '), d.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' · ') || 'Sem número';
export const linkOk = s => /^https:\/\/\S+$/i.test(String(s || '').trim());

// Vencidos primeiro, depois os que vencem, em dia, sem validade e encerrados; dentro de cada um, pela validade.
export const ordenar = (lista, hoje) => [...lista].sort((a, b) => ORDEM[alerta(a, hoje)] - ORDEM[alerta(b, hoje)] || (a.validade || '9').localeCompare(b.validade || '9') || nomeDoc(a).localeCompare(nomeDoc(b), 'pt-BR'));

// Filtro da tela: f = { tipo, onde, alerta, q } ('' = todos).
export function filtrar(lista, f, hoje) {
  const q = String(f.q || '').toLowerCase().trim();
  return ordenar(lista.filter(d => (!f.tipo || d.tipo === f.tipo) && (!f.onde || d.conj === f.onde) && (!f.alerta || alerta(d, hoje) === f.alerta)
    && (!q || [d.tipo, d.numero, d.rev, d.titulo, ONDE[d.conj], d.area, d.local, d.resp, d.emitente, d.colab, d.mat, d.situacao, d.obs].join(' ').toLowerCase().includes(q))), hoje);
}
// Contagens para os cartões e o aviso no celular.
export function resumo(lista, hoje) {
  const r = { total: lista.length, vencido: 0, vence: 0, ok: 0, sem: 0, fim: 0 };
  for (const d of lista) r[alerta(d, hoje)]++;
  r.alerta = r.vencido + r.vence;
  return r;
}

// Confere e limpa o que foi digitado. outros = documentos já cadastrados (para não repetir tipo + número + revisão).
// Devolve o documento pronto para gravar ou lança um erro com a mensagem para a tela (e o campo, em e.campo).
export function conferir(x, outros = [], id = '') {
  const t = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const tipo = TIPOS.includes(x.tipo) ? x.tipo : 'Outro'; const R = regraDoTipo(tipo);
  const period = x.period === '' || x.period == null || PERIODOS[x.period] == null ? null : +x.period;
  const y = {
    tipo, numero: t(x.numero, LIMITES.numero), rev: R.rev ? t(x.rev, LIMITES.rev) : '', titulo: t(x.titulo, LIMITES.titulo),
    conj: ONDE[x.conj] ? x.conj : 'coq', area: t(x.area, LIMITES.area), local: R.local ? t(x.local, LIMITES.local) : '',
    resp: t(x.resp, LIMITES.resp), emitente: t(x.emitente, LIMITES.emitente),
    colab: R.pessoa ? t(x.colab, LIMITES.colab) : '', mat: R.pessoa ? t(x.mat, LIMITES.mat) : '',
    prio: R.prio ? (PRIORIDADES[x.prio] ? x.prio : 'media') : '',
    emissao: ehData(x.emissao) ? x.emissao : '', period, validade: ehData(x.validade) ? x.validade : '', aviso: AVISOS.includes(+x.aviso) ? +x.aviso : ANTECEDENCIA,
    situacao: SITUACOES.includes(x.situacao) ? x.situacao : 'Vigente', link: t(x.link, LIMITES.link), obs: t(x.obs, LIMITES.obs)
  };
  if (period > 0 && y.emissao) y.validade = somaMeses(y.emissao, period);
  if (period === 0) y.validade = '';
  const erro = (m, campo) => { const e = new Error(m); e.campo = campo; throw e; };
  if (R.numero && !y.numero) erro(`Informe o número ${tipo === 'OM' ? 'da OM' : 'do documento'}.`, 'dcNum');
  if (!y.titulo) erro(tipo === 'OM' ? 'Descreva o serviço da OM.' : 'Informe a descrição.', 'dcTit');
  if (R.pessoa && !y.colab) erro(tipo === 'ASO' ? 'Informe o colaborador do ASO.' : 'Informe o colaborador treinado.', 'dcColab');
  if (!y.resp) erro('Informe o responsável pelo acompanhamento.', 'dcResp');
  if (!y.emissao) erro(`Informe a data (${R.emissao.toLowerCase()}).`, 'dcEmi');
  if (period !== 0 && !y.validade) erro(`Informe ${R.validade.toLowerCase()} ou escolha "Sem validade" na periodicidade.`, 'dcVal');
  if (y.validade && y.validade < y.emissao) erro(`${R.validade} não pode ser antes da ${R.emissao.toLowerCase()}.`, 'dcVal');
  if (y.link && !linkOk(y.link)) erro('Link inválido: comece com https://', 'dcLink');
  const chave = d => [d.tipo, String(d.numero || '').toLowerCase().replace(/\s+/g, ''), String(d.rev || '').toLowerCase(), String(d.colab || '').toLowerCase()].join('|');
  if (y.numero && outros.some(d => d.id !== id && chave(d) === chave(y))) erro(`Já existe ${tipo} ${y.numero}${y.rev ? ' rev. ' + y.rev : ''} cadastrado. Abra o existente ou mude a revisão.`, 'dcNum');
  return y;
}

// Linhas da planilha do Excel (cabeçalho + uma linha por documento).
export function linhasExcel(lista, hoje, dataBR = s => s) {
  return [['Tipo', 'Número', 'Revisão', 'Descrição', 'Onde', 'Área', 'Equipamento ou local', 'Colaborador', 'Matrícula', 'Prioridade', 'Responsável', 'Emitente / solicitante', 'Emissão', 'Validade', 'Situação', 'Alerta', 'Link', 'Observação'],
    ...ordenar(lista, hoje).map(d => [d.tipo || '', d.numero || '', d.rev || '', d.titulo || '', ONDE[d.conj] || '', d.area || '', d.local || '', d.colab || '', d.mat || '', PRIORIDADES[d.prio] || '', d.resp || '', d.emitente || '',
      dataBR(d.emissao || ''), dataBR(d.validade || ''), d.situacao || '', alerta(d, hoje) === 'fim' ? '' : textoAlerta(d, hoje), d.link || '', d.obs || ''])];
}
