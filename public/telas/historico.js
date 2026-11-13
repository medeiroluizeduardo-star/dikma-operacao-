// Dikma Gestão — Administração › Histórico de alterações: quem mudou o quê e quando (coleção historico, gravada por
// DB.log em cada alteração do sistema). Lida só ao abrir a tela (as últimas 500), para não pesar na abertura do site.
// Quem vê: o administrador (tudo, também os registros antigos sem módulo) e o gestor de cada módulo (só o do módulo dele),
// pela aba Histórico de alterações do menu da conta. Conta em contas/acessos.js › modsHistorico; o banco confere igual.
import { DB, esc, title } from '../nucleo/base.js';
import { UI, ME } from '../nucleo/estado.js';
import { modsHistorico, NOME_MOD_HIST } from '../contas/acessos.js';
import { semAcento, casa } from '../ui/busca.js';
import { baixarExcel } from '../ui/exportar.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';

const LIMITE = 500;
const H = { l: null, carregando: false, erro: '', q: '', quem: '', mod: '' };
const nomeMod = m => NOME_MOD_HIST[m] || 'Sem módulo';
const filtrar = l => l.filter(x => (!H.quem || x.nome === H.quem) && (!H.mod || (x.mod || '_') === H.mod) && casa(semAcento(`${x.nome} ${x.t}`), H.q));
async function carregar() {
  if (H.carregando) return; H.carregando = true; H.erro = '';
  try { H.l = await DB.historicoLer(LIMITE); } catch (e) { H.erro = (e && e.message) || String(e); H.l = H.l || []; }
  H.carregando = false; render();
}
const dia = d => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function vHistorico() {
  if (H.uid !== (ME && ME.uid)) { H.uid = ME && ME.uid; H.l = null; H.mod = ''; H.quem = ''; } // outra pessoa entrou (demonstração)
  if (!H.l) { carregar(); return '<div class="card skel"><i></i><i></i><i></i></div>'; }
  const pessoas = [...new Set(H.l.map(x => x.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const l = filtrar(H.l);
  const mods = modsHistorico(ME); const varios = mods.length > 1 || H.l.some(x => !x.mod);
  const lim = Math.min(UI.more || 100, l.length);
  let g = '', h = '';
  for (const x of l.slice(0, lim)) {
    const k = dia(x.at); if (k !== g) { g = k; h += `<div class="md-sub">${esc(k)}</div>`; }
    h += `<div><time>${hora(x.at)}</time><span><b>${esc(title(x.nome || ''))}</b> · ${esc(x.t || '')}${varios ? ` <small class="muted">· ${esc(nomeMod(x.mod))}</small>` : ''}</span></div>`;
  }
  return `<div class="card"><div class="body lbar">
      <label class="sel"><span>Pessoa</span><select class="in" id="hiQuem"><option value="">Todas</option>${pessoas.map(p => `<option ${p === H.quem ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      ${varios ? `<label class="sel"><span>Módulo</span><select class="in" id="hiMod"><option value="">Todos</option>${[...mods, ...(H.l.some(x => !x.mod) ? ['_'] : [])].map(m => `<option value="${m}" ${m === H.mod ? 'selected' : ''}>${esc(m === '_' ? 'Sem módulo (antigos)' : nomeMod(m))}</option>`).join('')}</select></label>` : ''}
      <label class="sel grow"><span>Buscar</span><input class="in" id="hiQ" type="search" placeholder="Ex.: férias, aprovou, NR-35" value="${esc(H.q)}"></label>
      <button class="btn sm" data-act="hiRecarregar">Atualizar</button>
      ${l.length ? `<button class="btn sm" data-act="hiExp">${I.dl} Exportar</button>` : ''}
    </div>
    <p class="muted small body pt0 m0">${H.l.length ? `As últimas ${H.l.length} alterações` : ''}${H.l.length >= LIMITE ? ' (as mais antigas ficam na cópia de segurança)' : ''}. ${H.erro ? esc(H.erro) : ''}</p>
    ${l.length ? `<div class="body"><div class="log">${h}</div></div>${l.length > lim ? `<div class="body pt0"><button class="btn center" data-act="more" data-n="${lim + 100}">Mostrar mais ${Math.min(100, l.length - lim)} (faltam ${l.length - lim})</button></div>` : ''}`
      : H.l.length ? '<div class="empty"><b>Nada encontrado</b><span>Troque a pessoa ou a busca.</span></div>' : '<div class="empty"><b>Nenhuma alteração registrada ainda</b><span>Cada apontamento, aprovação e ajuste aparece aqui.</span></div>'}</div>`;
}
acoes.hiRecarregar = () => { H.l = null; render(); };
acoes.hiExp = () => {
  const l = filtrar(H.l || []);
  baixarExcel('historico', [{ nome: 'Histórico', linhas: [['Data', 'Hora', 'Pessoa', 'Módulo', 'O que mudou'], ...l.map(x => [x.at.toLocaleDateString('pt-BR'), hora(x.at), x.nome || '', nomeMod(x.mod), x.t || ''])] }]).catch(e => toast('Não foi possível exportar: ' + e.message));
};
document.addEventListener('input', e => { if (e.target.id === 'hiQ') { H.q = e.target.value; UI.more = 0; clearTimeout(window._hiq); window._hiq = setTimeout(render, 220); } });
document.addEventListener('change', e => { if (e.target.id === 'hiQuem') { H.quem = e.target.value; UI.more = 0; render(); } if (e.target.id === 'hiMod') { H.mod = e.target.value; UI.more = 0; render(); } });
