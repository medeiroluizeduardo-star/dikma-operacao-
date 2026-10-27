// Estado da interface: login (AUTH, ME), conjunto de atividades aberto (SK, AREAS), plano e colaboradores do conjunto,
// versão dos dados (DATAV), a memória da tela (UI) e o que a pessoa pode ver e fazer (módulos, áreas, itens).
// As variáveis são lidas pelos outros arquivos; só este arquivo as troca (definirAuth, rebuild, aplicarSet, mudouDados).
import { SETS, AREA_S, PAPEIS, weeksOfMonth, addMonth } from '../cal.js';
import { ACESSO, modulosDe } from '../acessos.js';
import { podeItemU } from '../permissoes.js';
import { TV, DB, CUR_WEEK, CUR_MONTH } from './base.js';


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
export const UI = { view: 'painel', mes: null, ini: null, area: 'TODAS', rota: 'TODAS', tipo: 'TODOS', q: '', soPend: false, escopo: 'semana', dia: null, aRota: null, eRota: null, pArea: 'RECEBIMENTO', confirm: null, iRota: 'TODAS', lider: '', more: 0, gMes: null, impIni: CUR_WEEK, busy: false };
UI.modulo = 'operacao';
try { const v = JSON.parse(localStorage.getItem('coqueria-ui') || '{}'); if (v.view) UI.view = v.view; if (v.modulo) UI.modulo = v.modulo === 'escala' ? 'gestao' : v.modulo === 'adm' ? 'frequencia' : v.modulo; if (v.esSet) UI.esSet = v.esSet; if (v.cfSet) UI.cfSet = v.cfSet; if (v.apArea) UI.apArea = v.apArea; if (v.aRotaPor) UI.aRotaPor = v.aRotaPor; if (v.progAbertas) UI.progAbertas = v.progAbertas; } catch (e) { /* ignora */ }
// Acesso (porta de entrada) desta sessão: operacao | sistema (o antigo Administrativo agora é um módulo da Operação).
try { const a = localStorage.getItem('dikma-acesso'); if (ACESSO[a]) UI.acesso = a; } catch (e) { /* ignora */ }
if (!UI.acesso) UI.acesso = 'operacao';
if (TV) { document.body.classList.add('tv'); UI.acesso = 'operacao'; UI.view = 'painel'; if (UI.modulo === 'bateria') UI.esSet = 'bateria'; UI.modulo = 'paineis'; }
export const ultimoLogin = () => { try { return localStorage.getItem('dikma-ultimo-login') || ''; } catch (e) { return ''; } };
export const salvarAcesso = () => { try { localStorage.setItem('dikma-acesso', UI.acesso); } catch (e) { /* ignora */ } };
export const salvarUI = () => { try { localStorage.setItem('coqueria-ui', JSON.stringify({ view: UI.view, modulo: UI.modulo, esSet: UI.esSet, cfSet: UI.cfSet, apArea: UI.apArea, aRotaPor: UI.aRotaPor })); } catch (e) { /* ignora */ } marcarHistorico(); };
function marcarHistorico() {
  const st = history.state || {};
  if (!st.v) history.replaceState({ v: UI.view, m: UI.modulo }, '');
  else if ((st.v !== UI.view || st.m !== UI.modulo) && !st.s) history.pushState({ v: UI.view, m: UI.modulo }, '');
}

export const rotas = () => (DB.cache.config && DB.cache.config.rotas) || [];
export const tipos = () => (DB.cache.config && DB.cache.config.tipos) || [];
export const meses = () => ((DB.cache.config && DB.cache.config.meses) || []).slice().sort();
export const isAdmin = () => ME && ME.papel === 'admin';
// Itens (o que a pessoa pode fazer dentro das abas), configurados em Perfis e permissões.
export const podeItem = id => podeItemU(ME, id, permCfg());
// Perfis: admin (tudo) · gestor (todas as áreas + administração dos módulos dele, menos usuários)
// coordenador (aponta em todas as áreas dos módulos dele) · supervisor (até 2 áreas) · líder (1 área) · leitor · bloqueado
const ehDoModulo = () => !!ME && modsDe(ME).includes(UI.modulo);
export const admMod = () => isAdmin() || (!!ME && ME.papel === 'gestor' && ehDoModulo());
export const todasAreas = () => isAdmin() || (!!ME && ['gestor', 'coordenador'].includes(ME.papel) && ehDoModulo());
export const myAreas = () => (ME && (ME.papel === 'lider' || ME.papel === 'supervisor') ? [...new Set([ME.area, ME.papel === 'supervisor' ? ME.area2 : null].filter(a => a && AREAS.includes(a)))] : []);
export const myArea = () => { const l = myAreas(); return l.length ? (l.includes(UI.area) ? UI.area : l[0]) : null; };
export const areaScope = () => myArea() || UI.area;
export const canEdit = area => (todasAreas() || myAreas().includes(area)) && podeItem('i_apontar');
// Atividade fora da programação: só administrador, coordenador e supervisor incluem, nas áreas deles.
export const podeForaProg = area => !!ME && (isAdmin() || ['coordenador', 'supervisor'].includes(ME.papel)) && (todasAreas() || myAreas().includes(area)) && podeItem('i_foraprog');
export const canEditSit = area => (todasAreas() || myAreas().includes(area)) && podeItem('i_efetivo');
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
// Escala e Efetivo não se marca no usuário: vem junto com Atividades Pátio ou Bateria.
export const MODS_MARCAVEIS = ['operacao', 'bateria', 'equipamentos', 'gestao', 'frequencia'];
// Módulos marcados no usuário (os que trazem dados) · modsDe = o que aparece no menu:
// Efetivo também aparece para quem tem Atividades (parte da escala); Configurações para administrador e gestor.
export const modsReais = u => (!u ? [] : u.papel === 'admin' ? MODS_MARCAVEIS : modulosDe(u).filter(m => MODS_MARCAVEIS.includes(m)));
export const temFichas = u => modsReais(u).includes('gestao');
// Módulos que aparecem no menu, conforme o acesso aberto: Operação (os módulos da pessoa) ou Administração do sistema.
export const modsDe = u => {
  if (!u) return [];
  if (UI.acesso === 'sistema') return u.papel === 'admin' ? ['config'] : [];
  const b = modsReais(u); const ms = MODS_MARCAVEIS.filter(m => b.includes(m) || (m === 'gestao' && (b.includes('operacao') || b.includes('bateria'))));
  // Painel: aparece para quem tem algum módulo com painel (atividades, equipamentos, fichas ou frequência).
  const l = (setsDe(u).length || b.includes('equipamentos') || b.includes('gestao') || b.includes('frequencia')) ? ['paineis', ...ms] : ms;
  // Gestor: Configurações dos módulos dele (plano, gerador, rotas, operação, tipos de ocorrência, escalas) no mesmo acesso
  return u.papel === 'gestor' ? [...l, 'config'] : l;
};
export const setsDe = u => ['patio', 'bateria'].filter(k => modsReais(u).includes(SETS[k].mod));
export const permCfg = () => DB.cache.permissoes || {};
// Liga as telas de atividades ao conjunto do módulo aberto (Pátio ou Bateria).
export function aplicarSet() {
  let k = UI.modulo === 'bateria' ? 'bateria' : 'patio';
  if (UI.modulo === 'gestao' || UI.modulo === 'paineis') { const ss = setsDe(ME); k = ss.includes(UI.esSet) ? UI.esSet : (ss[0] || 'patio'); UI.esSet = k; }
  if (UI.modulo === 'config') { const ss = setsDe(ME); k = ss.includes(UI.cfSet) ? UI.cfSet : (ss[0] || 'patio'); UI.cfSet = k; }
  if (k !== SK) { SK = k; Object.assign(UI, { area: 'TODAS', rota: 'TODAS', aRota: null, eRota: null, iRota: 'TODAS', dia: null, mes: null, ini: null, confirm: null }); }
  DB.useSet(k); AREAS = SETS[k].areas;
  if (!AREAS.includes(UI.pArea)) UI.pArea = AREAS[0];
  if (UI.area !== 'TODAS' && !AREAS.includes(UI.area)) UI.area = 'TODAS';
  if (myArea()) UI.area = myArea();
}
