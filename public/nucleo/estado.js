// Estado da interface: login (AUTH, ME), conjunto de atividades aberto (SK, AREAS), plano e colaboradores do conjunto,
// versão dos dados (DATAV), a memória da tela (UI) e o que a pessoa pode ver e fazer (módulos, áreas, itens).
// As variáveis são lidas pelos outros arquivos; só este arquivo as troca (definirAuth, rebuild, aplicarSet, mudouDados).
import { SETS, AREA_S, PAPEIS, weeksOfMonth, addMonth } from '../cal.js';
import { perfilDe, ehAdminU, escoposDe, temFichasU, marcasDe, usuarioEm } from '../acessos.js';
import { podeItemU } from '../permissoes.js';
import { competenciaDe } from '../planilhas-adm.js';
import { temSeg } from '../segcalc.js';
import { TV, DB, TODAY, CUR_WEEK, CUR_MONTH } from './base.js';


/* ---------------- estado ---------------- */
export let AUTH = { status: 'loading' }, ME = null;
export let PLANO = [], PL = new Map(), COLABS = [];
export let SK = 'patio', AREAS = SETS.patio.areas;
 // conjunto de atividades aberto (patio | bateria)
// Versão dos dados: muda a cada gravação ou atualização que chega; as contas guardadas (memória) valem até ela mudar.
export let DATAV = 0;
export function mudouDados() { DATAV++; }
// Login: quem entrou (ME) e em que situação está a entrada (AUTH.status).
export function definirAuth(a) { AUTH = a; ME = a.user || null; }
export const UI = { view: 'meudia', mes: null, ini: null, area: 'TODAS', rota: 'TODAS', tipo: 'TODOS', q: '', soPend: false, escopo: 'semana', dia: null, aRota: null, eRota: null, pArea: 'RECEBIMENTO', confirm: null, iRota: 'TODAS', lider: '', more: 0, gMes: null, impIni: CUR_WEEK, busy: false };
UI.modulo = 'operacao';
// Módulos de antes da divisão em 5 (guardados no aparelho, em links e avisos) → módulo de agora e o conjunto.
// A tela (view) manda mais: ensureModulo leva para o módulo onde a aba está agora.
const MOD_ANTIGO = { paineis: ['gestao'], bateria: ['operacao', 'bateria'], equipamentos: ['operacao'], frequencia: ['rh'], adm: ['rh'], administrativo: ['rh'], config: ['administracao'], escala: ['operacao'], sistema: ['administracao'] };
export const MODULOS = ['operacao', 'gestao', 'seguranca', 'rh', 'administracao'];
// Converte o módulo recebido (antigo ou novo); antigo=true quando veio de antes da divisão (o antigo 'gestao' era
// Pessoas no turno e o antigo 'operacao' era Atividades do Pátio). Devolve o módulo de agora.
export function moduloNovo(m, antigo) {
  if (MOD_ANTIGO[m]) { const [n, set] = MOD_ANTIGO[m]; if (set) UI.esSet = set; return n; }
  if (antigo && m === 'operacao') UI.esSet = 'patio';
  return MODULOS.includes(m) ? m : 'operacao';
}
try {
  const v = JSON.parse(localStorage.getItem('coqueria-ui') || '{}');
  if (v.esSet) UI.esSet = v.esSet;
  if (v.view) UI.view = v.view;
  // v5 = memória já no formato dos 5 módulos; sem a marca, é a de antes (módulos antigos).
  if (v.modulo) UI.modulo = moduloNovo(v.modulo, !v.v5);
  if (v.cfSet) UI.cfSet = v.cfSet; if (v.apArea) UI.apArea = v.apArea; if (v.aRotaPor) UI.aRotaPor = v.aRotaPor; if (v.progAbertas) UI.progAbertas = v.progAbertas;
} catch (e) { /* ignora */ }
// O antigo acesso separado "Administração do sistema" virou o módulo Administração: quem estava nele abre lá.
try { if (localStorage.getItem('dikma-acesso') === 'sistema') { UI.modulo = 'administracao'; if (!UI.view) UI.view = 'cfgeral'; } localStorage.removeItem('dikma-acesso'); } catch (e) { /* ignora */ }
if (TV) { document.body.classList.add('tv'); UI.view = 'painel'; UI.modulo = 'gestao'; }
// Memória das telas de Operação (UI.e), fichas do Efetivo (UI.g) e Frequência (UI.a). Fica aqui, e não nos arquivos
// dessas telas, porque eles chegam depois (sob demanda) e a busca e o Meu dia já mexem nela antes (ex.: abrir uma ficha).
UI.e = { mes: TODAY.slice(0, 7), dia: TODAY, pf: 'aberta', avMes: TODAY.slice(0, 7), inMes: TODAY.slice(0, 7), hist: null };
UI.g = { de: TODAY.slice(0, 8) + '01', ate: TODAY, q: '', filtro: 'ativos', ocSt: 'pendente', ocTipo: '', ocQ: '', mat: null, impMat: '', impDoc: 'ficha', cq: '', cf: 'todos', area: '', fa: '' };
// Segurança (telas/seguranca.js): mês e filtros das listas, situação da fila de anomalias e mês do painel.
UI.sg = { mes: TODAY.slice(0, 7), area: '', sit: 'abertas', q: '', pMes: TODAY.slice(0, 7) };
UI.a = { conj: 'patio', comp: competenciaDe(TODAY), abertos: [], fAba: 'agora', fSetor: '', fQ: '', imp: null, q: '' };
export const ultimoLogin = () => { try { return localStorage.getItem('dikma-ultimo-login') || ''; } catch (e) { return ''; } };
// gravarUI: só a memória do aparelho · salvarUI: memória + histórico (botão Voltar).
export const gravarUI = () => { try { localStorage.setItem('coqueria-ui', JSON.stringify({ v5: 1, view: UI.view, modulo: UI.modulo, esSet: UI.esSet, cfSet: UI.cfSet, apArea: UI.apArea, aRotaPor: UI.aRotaPor })); } catch (e) { /* ignora */ } };
export const salvarUI = () => { gravarUI(); marcarHistorico(); };
function marcarHistorico() {
  const st = history.state || {};
  if (!st.v) history.replaceState({ v: UI.view, m: UI.modulo }, '');
  else if ((st.v !== UI.view || st.m !== UI.modulo) && !st.s) history.pushState({ v: UI.view, m: UI.modulo }, '');
}

export const rotas = () => (DB.cache.config && DB.cache.config.rotas) || [];
export const tipos = () => (DB.cache.config && DB.cache.config.tipos) || [];
export const meses = () => ((DB.cache.config && DB.cache.config.meses) || []).slice().sort();
// ---- Perfil por módulo ----
// Cada tela usa o perfil da pessoa NO MÓDULO em que a tela está (acesso.operacao na Operação, acesso.gestao na Gestão,
// acesso.rh no RH...). perfil(mod) devolve 'admin' para o administrador, o perfil do módulo, ou null (sem acesso).
export const perfil = (mod, u = ME) => perfilDe(u, mod);
export const isAdmin = () => ehAdminU(ME);
// Módulo da tela aberta (a Administração usa as áreas como o administrador: todas).
export const modAqui = () => (MODULOS.includes(UI.modulo) ? UI.modulo : 'operacao');
export const papelAqui = () => perfil(modAqui());
// A pessoa como ela é vista dentro de um módulo (o papel vira o perfil daquele módulo).
export const meEm = mod => usuarioEm(ME, mod);
// Itens (o que a pessoa pode fazer dentro das abas), configurados em Perfis e permissões por módulo.
export const podeItem = (id, mod = modAqui()) => podeItemU(ME, id, permCfg(), mod);
// Administração "Dos módulos" (o gestor de hoje): cuida das configurações dos módulos em que é Gestor.
// alvo: ativ (rotas, plano, gerador e horas extras de Pátio/Bateria) · equip (Equipamentos) · fichas (tipos de
// ocorrência) · escala (Escalas e turnos) · seg (listas dos formulários da Segurança: Gestor da Segurança).
export function gerencia(alvo, u = ME) {
  if (ehAdminU(u)) return true;
  if (perfilDe(u, 'administracao') !== 'modulo') return false;
  const ge = perfilDe(u, 'gestao') === 'gestor', op = perfilDe(u, 'operacao') === 'gestor', esc = escoposDe(u);
  if (alvo === 'ativ') return ge && (esc.includes('patio') || esc.includes('bateria'));
  if (alvo === 'equip') return (ge || op) && esc.includes('equipamentos');
  if (alvo === 'fichas') return ge && temFichasU(u);
  if (alvo === 'escala') return ge || op;
  if (alvo === 'seg') return perfilDe(u, 'seguranca') === 'gestor';
  return false;
}
export const admDe = alvo => gerencia(alvo);
// Compatibilidade: "administra o que está nesta tela" (Pátio/Bateria, Equipamentos ou Fichas).
export const admMod = () => admDe(['elanc', 'eequipe', 'einsp', 'eaval', 'eanal', 'econfig', 'epainel'].includes(UI.view) ? 'equip' : ['gcolab', 'gimpr', 'gpainel', 'gtipos'].includes(UI.view) ? 'fichas' : 'ativ');
// Áreas: gestor e coordenador (do módulo) veem todas; supervisor até 2; líder 1. Valem no módulo pedido (padrão: o da tela).
export const todasAreas = (mod = modAqui()) => isAdmin() || ['gestor', 'coordenador'].includes(perfil(mod)) || (mod === 'administracao' && perfil(mod) === 'modulo');
export const myAreas = (mod = modAqui()) => { const p = perfil(mod); return ME && (p === 'lider' || p === 'supervisor') ? [...new Set([ME.area, p === 'supervisor' ? ME.area2 : null].filter(a => a && AREAS.includes(a)))] : []; };
export const myArea = () => { const l = myAreas(); return l.length ? (l.includes(UI.area) ? UI.area : l[0]) : null; };
export const areaScope = () => myArea() || UI.area;
const EDITA = ['gestor', 'coordenador', 'supervisor', 'lider'];
// Aponta na área: perfil da Operação (é ele que a regra confere). Na Gestão (Programação, Folha do líder) é preciso
// também o perfil da Gestão permitir: quem só lê a Gestão não vê botões de edição lá.
const editaEm = (mod, area) => (isAdmin() || EDITA.includes(perfil(mod))) && (todasAreas(mod) || myAreas(mod).includes(area));
export const canEdit = area => editaEm('operacao', area) && (modAqui() !== 'gestao' || editaEm('gestao', area)) && podeItem('i_apontar', 'operacao');
// Atividade fora da programação: só administrador, coordenador e supervisor (da Operação) incluem, nas áreas deles.
export const podeForaProg = area => !!ME && (isAdmin() || ['coordenador', 'supervisor'].includes(perfil('operacao'))) && editaEm('operacao', area) && podeItem('i_foraprog', 'operacao');
export const canEditSit = area => editaEm('operacao', area) && (modAqui() !== 'gestao' || editaEm('gestao', area)) && podeItem('i_efetivo', 'operacao');
// Seletor de área para quem tem área fixa: uma área = travado; duas (supervisor) = escolhe entre as dele.
export const selMinhaArea = (id, rot = 'Área') => myAreas().length > 1
  ? `<label class="sel"><span>${rot}</span><select class="in" id="${id}">${myAreas().map(a => `<option value="${a}" ${a === myArea() ? 'selected' : ''}>${AREA_S[a]}</option>`).join('')}</select></label>`
  : `<label class="sel"><span>${rot}</span><select class="in" disabled><option>${AREA_S[myArea()]}</option></select></label>`;
export const papelNome = p => (PAPEIS.find(x => x[0] === p) || [p, p])[1];

export function rebuild() {
  PLANO = AREAS.flatMap(a => DB.cache.plano[a] || []);
  PL = new Map(PLANO.map(p => [p.id, p]));
  COLABS = AREAS.flatMap(a => DB.cache.colabs[a] || []);
}
export function ensurePeriod() {
  const ms = meses();
  if (!ms.length) return;
  if (!UI.mes || !ms.includes(UI.mes)) UI.mes = ms.includes(CUR_MONTH) ? CUR_MONTH : ms[ms.length - 1];
  const ws = weeksOfMonth(UI.mes);
  if (!UI.ini || !ws.includes(UI.ini)) UI.ini = ws.includes(CUR_WEEK) ? CUR_WEEK : ws[0];
  DB.watchMonths([UI.mes, CUR_MONTH, addMonth(CUR_MONTH, -1)]);
}
// Marcas no formato antigo, tiradas do acesso por módulo: operacao (Pátio), bateria, equipamentos, gestao (fichas),
// frequencia (RH). Dizem que dados carregar e o que existe para a pessoa, sem olhar o perfil.
export const MODS_MARCAVEIS = ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'];
export const modsReais = u => marcasDe(u);
export const temFichas = u => temFichasU(u);
export const escopos = (u = ME) => escoposDe(u);
// Conjuntos de atividades (Pátio, Bateria) da pessoa, no módulo pedido (sem módulo: em qualquer um dos dois).
export const setsDe = (u, mod) => { if (!u) return []; const ok = mod ? !!perfilDe(u, mod) : !!(perfilDe(u, 'operacao') || perfilDe(u, 'gestao')); return ok ? ['patio', 'bateria'].filter(k => escoposDe(u).includes(k)) : []; };
export const temEquipEm = (u, mod) => !!u && !!perfilDe(u, mod) && escoposDe(u).includes('equipamentos');
// Módulos que aparecem no seletor, nesta ordem: Operação · Gestão · Segurança · RH · Administração.
export const modsDe = u => {
  if (!u || u.papel === 'bloqueado') return [];
  const l = [];
  if (setsDe(u, 'operacao').length || temEquipEm(u, 'operacao')) l.push('operacao');
  if (setsDe(u, 'gestao').length || temEquipEm(u, 'gestao') || temFichasU(u)) l.push('gestao');
  // Segurança: quem tem perfil no módulo e o supervisor da área (trata as anomalias da área dele).
  if (temSeg(u)) l.push('seguranca');
  if (perfilDe(u, 'rh')) l.push('rh');
  if (ehAdminU(u) || (perfilDe(u, 'administracao') === 'modulo' && ['ativ', 'equip', 'fichas', 'escala', 'seg'].some(a => gerencia(a, u)))) l.push('administracao');
  return l;
};
export const permCfg = () => DB.cache.permissoes || {};
// Liga as telas de atividades ao conjunto do módulo aberto (Pátio ou Bateria).
export function aplicarSet() {
  let k = SK;
  if (UI.modulo === 'operacao' || UI.modulo === 'gestao') { const ss = setsDe(ME, UI.modulo); k = ss.includes(UI.esSet) ? UI.esSet : (ss[0] || 'patio'); if (ss.length) UI.esSet = k; }
  if (UI.modulo === 'administracao') { const ss = setsDe(ME); k = ss.includes(UI.cfSet) ? UI.cfSet : (ss[0] || 'patio'); UI.cfSet = k; }
  if (k !== SK) { SK = k; Object.assign(UI, { area: 'TODAS', rota: 'TODAS', aRota: null, eRota: null, iRota: 'TODAS', dia: null, mes: null, ini: null, confirm: null }); }
  DB.useSet(k); AREAS = SETS[k].areas;
  if (!AREAS.includes(UI.pArea)) UI.pArea = AREAS[0];
  if (UI.area !== 'TODAS' && !AREAS.includes(UI.area)) UI.area = 'TODAS';
  if (myArea()) UI.area = myArea();
}
