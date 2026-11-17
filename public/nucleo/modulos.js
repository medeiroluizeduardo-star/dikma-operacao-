// Partes criadas na entrada: pessoas (PES) e Avisos no celular (AV). As telas de Operação (EQ), Frequência e férias (AD) e
// fichas do Efetivo (GE) e Segurança (SG) ficam em arquivos grandes que só são baixados quando precisa: ao abrir a tela, ou logo
// depois do login para quem tem o módulo (em segundo plano). Sem sinal, vêm do service worker (estão no SHELL).
import { SET_KEYS } from '../contas/cal.js';
import { criarPessoas, chaveFicha } from '../contas/pessoas.js';
import * as M from '../ui/movimento.js';
import { criarAvisos } from '../telas/avisos.js';
import { DB, framed, esc, title } from './base.js';
import { ME, UI, podeItem, admDe, modsReais, isAdmin, meEm, perfil } from './estado.js';
import { I } from '../ui/icones.js';
import { temSeg } from '../contas/segcalc.js';
import { conjsInd, eqInd, areasInd } from '../contas/acessos.js';
import { escala, turmaFicha, desligadoDe, limparPresenca } from '../calc/presenca.js';
import { sheet, formSheet, showErr, prepararFoto, toast } from '../ui/janelas.js';
import { render, schedule, isMobile } from '../ui/shell.js';

// Criadas por inicio.js (PES, AV) ou quando o arquivo da tela chega (EQ, AD, GE). Os outros arquivos leem estas variáveis.
export let PES = null, AV = null, EQ = null, AD = null, GE = null, SG = null;
// Telas que quase ninguém abre, baixadas só quando abertas: configurações da Administração (CF), e Resumos (RE).
let CF = null, RE = null, CO = null, IC = null, MD = null, TR = null, PR = null, DC = null, FN = null, OM = null;

// Pessoas e Avisos no celular (antes de abrir o link recebido).
export function criarModulos() {
  PES = criarPessoas(DB);
  // Área de atuação de cada ficha do Efetivo (organiza as fichas por área no banco). Só o administrador calcula,
  // e só depois que os dados de todos os módulos chegaram; antes disso devolve null e nada muda de lugar.
  if (DB.definirChaveArea) DB.definirChaveArea(c => {
    if (!isAdmin()) return null;
    const ok = SET_KEYS.every(k => { const d = DB.dados(k); return d.configLoaded && (!d.config || d.colabsLoaded); }) && (!DB.cache.e || DB.cache.e.loaded);
    return ok ? chaveFicha(PES.lotacao(c).area) : null;
  });
  AV = criarAvisos({ get ME() { return ME; }, perfil: m => perfil(m), DB, esc, toast, render: () => render(), modsDe: modsReais });
}

// ---- telas carregadas sob demanda ----
// EQ: Operação (equip.js, que traz eqcalc.js) · AD: Frequência e férias (administrativo.js) · GE: fichas do Efetivo (gestao.js, que traz importar.js)
const CARGA = {
  // Cada tela recebe a pessoa vista no módulo em que está (o papel vira o perfil daquele módulo): Equipamentos na
  // Operação (lançar) ou na Gestão (Avaliação mensal e Análises), Frequência no RH e fichas na Gestão.
  // Nos Indicadores (Indicadores e Análises de equipamentos) a pessoa é vista pelo perfil dos Indicadores (só ver).
  EQ: () => import('../telas/equip.js').then(m => { EQ = m.criarEquip({ podeItem: id => (UI.modulo === 'gestao' && id === 'i_operacao' ? podeItem('i_aval', 'gestao') : podeItem(id)), escala: () => escala(), desligadoDe, PES, get ME() { return meEm(['gestao', 'indicadores'].includes(UI.modulo) ? UI.modulo : 'operacao'); }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: () => admDe('equip'), framed, UI }); }),
  // Indicadores › Pessoas (painel e resumo da frequência): só os conjuntos do escopo e, para o "Vê" com área, só as dele.
  AD: () => import('../telas/administrativo.js').then(m => { AD = m.criarAdministrativo({ podeItem: id => podeItem(id, 'rh'), limparPresenca, turmaFicha, desligadoDe, pulsar: el => M.pulsar(el), get ME() { return meEm('rh'); },
    conjs: () => (UI.modulo === 'indicadores' ? conjsInd(ME) : ['patio', 'bateria']), areas: () => (UI.modulo === 'indicadores' ? areasInd(ME) : []), DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), agendar: () => { clearTimeout(window._aqt); window._aqt = setTimeout(schedule, 200); }, UI, isMobile, escala: () => escala(), framed }); }),
  SG: () => import('../telas/seguranca.js').then(m => { SG = m.criarSeguranca(); }),
  // IC: Indicadores › Visão geral e Histórico (indicadores do contrato)
  IC: () => import('../telas/contrato.js').then(m => { IC = m; }),
  // MD: Gestão › Medição (faltas, horas extras, horas perdidas e ICCC/ICCP do mês)
  MD: () => import('../telas/medicao.js').then(m => { MD = m; }),
  // TR: Gestão › Tratativas (ações, planos 5W2H e atas de reunião)
  TR: () => import('../telas/tratativas.js').then(m => { TR = m; }),
  // PR: Administração › Processos e rotina (rotina do analista)
  PR: () => import('../telas/processos.js').then(m => { PR = m; }),
  // OM: Operação › Solicitações de OM
  OM: () => import('../telas/oms.js').then(m => { OM = m; }),
  // DC: Administração › Documentos e OMs
  DC: () => import('../telas/documentos.js').then(m => { DC = m; }),
  // FN: Administração › Funções (lista das funções e troca de função de muitas pessoas)
  FN: () => import('../telas/funcoes.js').then(m => { FN = m; }),
  CF: () => import('../telas/config.js').then(m => { CF = m; }),
  RE: () => import('../telas/relatorios.js').then(m => { RE = m; }),
  // CO: RH › Colaboradores (cadastro único, ficha em abas)
  CO: () => import('../telas/colaboradores.js').then(m => { CO = m; }),
  GE: () => import('../telas/gestao.js').then(m => { GE = m.criarGestao({ podeItem: id => podeItem(id, 'gestao'), PES, get ME() { return meEm('gestao'); }, DB, esc, title, I, sheet, formSheet, toast, showErr, render: () => render(), isAdmin: () => admDe('fichas'), prepararFoto, framed, UI }); })
};
const pronto = { OM: () => OM, FN: () => FN, DC: () => DC, PR: () => PR, TR: () => TR, MD: () => MD, IC: () => IC, EQ: () => EQ, AD: () => AD, GE: () => GE, SG: () => SG, CF: () => CF, RE: () => RE, CO: () => CO };
const pedidos = {};
// Baixa (uma vez só) o arquivo da tela; quando chega, a tela é redesenhada. Devolve uma promessa.
export function carregarModulo(k) {
  if (pronto[k]()) return Promise.resolve(pronto[k]());
  if (!pedidos[k]) {
    pedidos[k] = CARGA[k]().then(() => { schedule(); return pronto[k](); }, err => {
      pedidos[k] = null; console.error(err);
      toast('Não foi possível abrir esta tela agora. Confira o sinal e tente de novo.');
      return null;
    });
  }
  return pedidos[k];
}
// O módulo, se já chegou; senão pede o arquivo e devolve null (quem desenha mostra o esqueleto enquanto isso).
export function modulo(k) {
  const m = pronto[k](); if (m) return m;
  carregarModulo(k); return null;
}
// Desenha com o módulo, ou o esqueleto enquanto o arquivo chega.
export const comModulo = (k, fn) => { const m = modulo(k); return m ? fn(m) : M.ESQUELETO; };
// Logo depois do login: baixa em segundo plano as telas dos módulos da pessoa (abrem na hora quando ela tocar).
export function precarregarModulos(u) {
  const ms = modsReais(u); const ks = [];
  if (ms.includes('equipamentos') || eqInd(u)) ks.push('EQ');
  if (ms.includes('gestao')) ks.push('GE');
  if (ms.includes('frequencia') || conjsInd(u).length) ks.push('AD');
  if (temSeg(u) || conjsInd(u).length) ks.push('SG');
  if (!ks.length) return;
  const ir = () => ks.forEach(k => carregarModulo(k));
  if ('requestIdleCallback' in window) requestIdleCallback(ir, { timeout: 1500 }); else setTimeout(ir, 300);
}
