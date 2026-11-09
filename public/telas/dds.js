// Dikma Gestão — DDS (diálogo diário de segurança): tema, área e quem participou, com o estado de espírito de cada um.
// Aparece na Segurança (aba DDS) e na Operação (junto da Presença do dia), para o líder registrar o DDS da equipe.
// A lista de nomes vem dos colaboradores da área nas Atividades (Pátio e Bateria): é só marcar quem participou.
// Quem pode registrar e ver: contas/segcalc.js (registraDds, veDds), conferido também pelas regras do banco.
// Sem sinal, o registro fica na fila do aparelho e sobe quando a conexão voltar.
// segdds/{id}: { data, mes, area, conj, tema, pessoas[], humor[] (B, N, C, P, T ou ''), obs, por, porNome, em }
import { MESES_L, SETS, SET_KEYS, addMonth, today, setDaArea } from '../contas/cal.js';
import { registraSeg, veTudoSeg, registraDds, ddsConjsOp, supConjs, HUMOR_DDS } from '../contas/segcalc.js';
import { desligadoDe } from '../calc/presenca.js';
import { baixarExcel, dataBR } from '../ui/exportar.js';
import { DB, framed, esc, title, $ } from '../nucleo/base.js';
import { ME, isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { I } from '../ui/icones.js';
import { toast, formSheet, sheet } from '../ui/janelas.js';
import { render, isMobile } from '../ui/shell.js';

// Temas sugeridos (a pessoa pode escrever outro).
const TEMAS = ['Uso correto de EPI', 'Trabalho em altura', 'Bloqueio e etiquetagem', 'Espaço confinado', 'Gases e atmosfera da coqueria', 'Calor e hidratação',
  'Movimentação de veículos e pedestres', 'Organização e limpeza (5S)', 'Ferramentas manuais', 'Percepção de riscos', 'Comunicação de anomalias'];
const U = { mes: today().slice(0, 7), area: '' };
const mesNome = ym => `${MESES_L[+ym.slice(5, 7) - 1]}/${ym.slice(0, 4)}`;
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
const pessoasDe = txt => [...new Set(String(txt || '').split(/[\n;,]+/).map(norm).filter(s => s.length >= 3))];
const HUM = Object.fromEntries(HUMOR_DDS.map(([k, n, e]) => [k, { n, e }]));
const ATENCAO = ['P', 'T']; // preocupado e triste: pedem uma conversa

// Conjuntos em que a pessoa registra ou vê DDS: tudo para quem vê/registra na Segurança; senão os da Operação e da supervisão.
const conjsDds = () => (veTudoSeg(ME) || registraSeg(ME) ? SET_KEYS : [...new Set([...ddsConjsOp(ME), ...supConjs(ME)])]);
const areasDds = () => conjsDds().flatMap(k => SETS[k].areas);
// Colaboradores ativos da área (Atividades). Vazio quando a pessoa não lê as Atividades daquele conjunto.
function colabsArea(area) {
  const k = setDaArea(area); const d = k && DB.dados ? DB.dados(k) : null;
  const hoje = today();
  const l = ((d && d.colabs && d.colabs[area]) || []).filter(c => c && c.nome && !(desligadoDe(c) && desligadoDe(c) <= hoje));
  const vistos = new Set();
  return l.filter(c => { const n = norm(c.nome); if (vistos.has(n)) return false; vistos.add(n); return true; })
    .sort((a, b) => String(a.rota || '').localeCompare(String(b.rota || '')) || a.nome.localeCompare(b.nome));
}

export function criarDds() {
  const S = () => DB.cache.seg;
  const lista = () => (S().dds || []).filter(r => r.mes === U.mes && (!U.area || r.area === U.area))
    .sort((a, b) => b.data.localeCompare(a.data) || (+b.em || 0) - (+a.em || 0));

  function view() {
    const l = lista(), part = l.reduce((s, r) => s + (r.pessoas || []).length, 0);
    const minhas = areasDds();
    const areas = [...new Set([...minhas, ...(S().dds || []).map(r => r.area)])];
    const areasCom = new Set(l.map(r => r.area));
    const semDds = minhas.filter(a => !areasCom.has(a) && (!U.area || a === U.area));
    const hum = {}; for (const r of l) for (const h of r.humor || []) if (h) hum[h] = (hum[h] || 0) + 1;
    const nHum = Object.values(hum).reduce((a, b) => a + b, 0);
    const meses = []; for (let i = 0; i < 13; i++) meses.push(addMonth(today().slice(0, 7), -i));
    const lim = isMobile() ? 20 : 200;
    return `<div class="mini"><div><b class="num">${l.length}</b><span>DDS no mês</span></div><div><b class="num">${part}</b><span>Participações</span></div><div><b class="num" style="${(hum.P || 0) + (hum.T || 0) ? 'color:var(--st-atr)' : ''}">${(hum.P || 0) + (hum.T || 0)}</b><span>Preocupados ou tristes</span></div></div>
      <div class="card"><div class="body lbar">
        <label class="sel"><span>Mês</span><select class="in" id="ddsMes">${meses.map(m => `<option value="${m}" ${m === U.mes ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select></label>
        <label class="sel"><span>Área</span><select class="in" id="ddsArea"><option value="">Todas</option>${areas.map(a => `<option ${a === U.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
        ${registraDds(ME) ? `<button class="btn pri" data-act="ddsNovo">${I.plus} Registrar DDS</button>` : ''}
        ${!framed && l.length ? `<button class="btn sm" data-act="ddsExp">${I.dl} Exportar</button>` : ''}
      </div>
      ${nHum ? `<p class="small body pt0 m0">Estado de espírito no mês: ${HUMOR_DDS.filter(([k]) => hum[k]).map(([k, n, e]) => `${e} ${n} <b class="num">${hum[k]}</b>`).join(' · ')}</p>` : ''}
      ${semDds.length && l.length ? `<p class="muted small body pt0 m0">Sem DDS registrado no mês: ${semDds.map(esc).join(', ')}</p>` : ''}
      ${l.length ? `<div class="plist">${l.slice(0, lim).map(r => { const at = (r.humor || []).filter(h => ATENCAO.includes(h)).length; return `<button class="pitem" data-act="ddsVer" data-id="${esc(r.id)}"><div class="minw"><div class="t">${esc(r.tema)}</div><div class="l">${dataBR(r.data)} · ${esc(r.area)} · por ${esc(title(r.porNome || ''))}</div></div>${at ? `<span class="pill warn">${at} pede${at > 1 ? 'm' : ''} atenção</span>` : ''}<span class="pill neu">${(r.pessoas || []).length} pessoas</span></button>`; }).join('')}</div>${l.length > lim ? `<p class="muted small body">Mostrando ${lim} de ${l.length}. Escolha uma área.</p>` : ''}`
        : `<div class="empty"><b>Nenhum DDS em ${mesNome(U.mes)}</b><span>${registraDds(ME) ? 'Toque em Registrar DDS ao fim do diálogo: escolha a área, marque quem participou e o estado de espírito de cada um.' : 'Os DDS registrados aparecem aqui.'}</span></div>`}</div>`;
  }

  // Lista de nomes da área, para marcar quem participou e o estado de espírito.
  const opHumor = `<option value="">Como está?</option>${HUMOR_DDS.map(([k, n, e]) => `<option value="${k}">${e} ${n}</option>`).join('')}`;
  function listaHtml(area) {
    const cs = colabsArea(area);
    if (!cs.length) return '<p class="muted small m0">A lista de colaboradores desta área não está disponível para o seu acesso. Escreva os nomes em "Outros participantes".</p>';
    return `<div class="row-gap"><button type="button" class="btn sm" id="ddsTodos">Marcar todos</button><button type="button" class="btn sm ghost" id="ddsNenhum">Limpar</button></div>
      <div class="ddslista">${cs.map((c, i) => `<div class="ddsp"><label class="ddsnome"><input type="checkbox" data-ddsp="${i}" value="${esc(norm(c.nome))}"><span>${esc(title(c.nome))}${c.rota ? `<small class="muted"> · ${esc(c.rota)}</small>` : ''}</span></label><select class="in sm" data-ddsh="${i}" aria-label="Estado de espírito de ${esc(title(c.nome))}">${opHumor}</select></div>`).join('')}</div>`;
  }
  function form() {
    const hoje = today(), areas = areasDds();
    if (!areas.length) { toast('Seu acesso não tem área para registrar DDS'); return; }
    const a0 = [U.area, ME && ME.area, ME && ME.area2].find(a => a && areas.includes(a)) || areas[0];
    const recentes = [...new Set([...(S().dds || []).map(r => r.tema), ...TEMAS])].slice(0, 40);
    formSheet('Registrar DDS', 'Diálogo diário de segurança', `
      <div class="g2eq"><label class="sel"><span>Data</span><input class="in" type="date" id="ddsData" value="${hoje}" max="${hoje}" required></label>
      <label class="sel"><span>Área</span><select class="in" id="ddsAr" required>${areas.map(a => `<option ${a === a0 ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label></div>
      <label class="sel"><span>Tema</span><input class="in" id="ddsTema" list="ddsTemas" maxlength="200" required placeholder="Ex.: Trabalho em altura"></label>
      <datalist id="ddsTemas">${recentes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="sel"><span>Quem participou e como está <b class="num" id="ddsConta">0</b></span><div id="ddsLista">${listaHtml(a0)}</div></div>
      <label class="sel"><span>Outros participantes (um nome por linha)</span><textarea class="in" id="ddsOutros" rows="2" placeholder="Visitante, terceiro, outra área"></textarea></label>
      <label class="sel"><span>Observação</span><input class="in" id="ddsObs" maxlength="1000" placeholder="Opcional"></label>`, 'Salvar', async () => {
      const data = $('ddsData').value, area = $('ddsAr').value, tema = $('ddsTema').value.replace(/\s+/g, ' ').trim();
      const marcados = [...document.querySelectorAll('#ddsLista [data-ddsp]:checked')];
      const pessoas = [], humor = [];
      for (const c of marcados) { pessoas.push(c.value); const h = document.querySelector(`#ddsLista [data-ddsh="${c.dataset.ddsp}"]`); humor.push(h ? h.value : ''); }
      for (const n of pessoasDe($('ddsOutros').value)) if (!pessoas.includes(n)) { pessoas.push(n); humor.push(''); }
      if (!data || data > today()) throw new Error('Informe a data (hoje ou antes).');
      if (!tema) throw new Error('Informe o tema.');
      if (!pessoas.length) throw new Error('Marque quem participou.');
      if (pessoas.length > 200) throw new Error('No máximo 200 pessoas por DDS.');
      DB.segDds({ data, mes: data.slice(0, 7), area, conj: setDaArea(area) || '', tema, pessoas, humor, obs: $('ddsObs').value.trim() });
      DB.log && DB.log(`DDS "${tema}" em ${area} com ${pessoas.length} pessoas`);
      U.mes = data.slice(0, 7); toast('DDS registrado'); render();
    });
    const conta = () => { $('ddsConta').textContent = document.querySelectorAll('#ddsLista [data-ddsp]:checked').length + pessoasDe($('ddsOutros').value).length; };
    const ligar = () => {
      const lst = $('ddsLista');
      lst.addEventListener('change', e => {
        const h = e.target.dataset.ddsh; if (h != null && e.target.value) { const c = lst.querySelector(`[data-ddsp="${h}"]`); if (c) c.checked = true; }
        conta();
      });
      const marcar = v => () => { lst.querySelectorAll('[data-ddsp]').forEach(c => { c.checked = v; }); conta(); };
      if ($('ddsTodos')) $('ddsTodos').addEventListener('click', marcar(true));
      if ($('ddsNenhum')) $('ddsNenhum').addEventListener('click', marcar(false));
    };
    $('ddsAr').addEventListener('change', () => { const n = document.createElement('div'); n.id = 'ddsLista'; n.innerHTML = listaHtml($('ddsAr').value); $('ddsLista').replaceWith(n); ligar(); conta(); });
    $('ddsOutros').addEventListener('input', conta);
    ligar();
  }

  const comHumor = (r, i) => { const h = HUM[(r.humor || [])[i]]; return h ? ` ${h.e} ${h.n}` : ''; };
  acoes.ddsNovo = () => form();
  acoes.ddsVer = (t, d) => {
    const r = (S().dds || []).find(x => x.id === d.id); if (!r) return;
    const ps = (r.pessoas || []).map((p, i) => `${esc(title(p))}${comHumor(r, i)}`).join('<br>');
    const ops = [{ t: 'Fechar', v: '' }, ...(isAdmin() ? [{ t: 'Excluir este DDS', v: 'x' }] : [])];
    sheet(r.tema, `${dataBR(r.data)} · ${esc(r.area)} · por ${esc(title(r.porNome || ''))}<br><b>${(r.pessoas || []).length} pessoas</b><br>${ps}${r.obs ? `<br><br>${esc(r.obs)}` : ''}`, ops, v => {
      if (v !== 'x') return;
      DB.segDdsExcluir(r.id); DB.log && DB.log(`Excluiu o DDS "${r.tema}" de ${dataBR(r.data)}`); toast('DDS excluído'); render();
    });
  };
  acoes.ddsExp = () => {
    const linhas = [['Data', 'Área', 'Tema', 'Pessoas', 'Participante', 'Estado de espírito', 'Registrado por', 'Observação'],
      ...lista().flatMap(r => (r.pessoas || []).map((p, i) => [dataBR(r.data), r.area, r.tema, (r.pessoas || []).length, p, (HUM[(r.humor || [])[i]] || {}).n || '', r.porNome || '', r.obs || '']))];
    baixarExcel(`DDS ${U.mes}`, [{ nome: 'DDS', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  };
  document.addEventListener('change', e => {
    if (e.target.id === 'ddsMes') { U.mes = e.target.value; DB.ddsWatch([U.mes]); render(); }
    else if (e.target.id === 'ddsArea') { U.area = e.target.value; render(); }
  });
  return { view };
}
