// Dikma Gestão — Segurança › DDS: o diálogo diário de segurança com a lista de quem participou.
// Quem registra interações registra o DDS (Segurança · registra, trata ou gestor); o supervisor da área vê os DDS da área.
// Sem sinal, o registro fica na fila do aparelho e sobe quando a conexão voltar (o mesmo do resto da Segurança).
// segdds/{id}: { data, mes, area, conj, tema, pessoas[], obs, por, porNome, em }
import { MESES_L, addMonth, today } from '../contas/cal.js';
import { listasSeg, conjDaArea, registraSeg } from '../contas/segcalc.js';
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
const pessoasDe = txt => [...new Set(String(txt || '').split(/[\n;,]+/).map(s => s.replace(/\s+/g, ' ').trim().toUpperCase()).filter(s => s.length >= 3))];

export function criarDds() {
  const S = () => DB.cache.seg;
  const L = () => listasSeg(S().cfg);
  const lista = () => (S().dds || []).filter(r => r.mes === U.mes && (!U.area || r.area === U.area))
    .sort((a, b) => b.data.localeCompare(a.data) || (+b.em || 0) - (+a.em || 0));

  function view() {
    const l = lista(), part = l.reduce((s, r) => s + (r.pessoas || []).length, 0);
    const areasCom = new Set(l.map(r => r.area));
    const semDds = L().areas.map(a => a.nome).filter(a => !areasCom.has(a) && (!U.area || a === U.area));
    const meses = []; for (let i = 0; i < 13; i++) meses.push(addMonth(today().slice(0, 7), -i));
    const lim = isMobile() ? 20 : 200;
    return `<div class="mini"><div><b class="num">${l.length}</b><span>DDS no mês</span></div><div><b class="num">${part}</b><span>Participações</span></div><div><b class="num">${l.length ? Math.round(part / l.length) : 0}</b><span>Pessoas por DDS (média)</span></div></div>
      <div class="card"><div class="body lbar">
        <label class="sel"><span>Mês</span><select class="in" id="ddsMes">${meses.map(m => `<option value="${m}" ${m === U.mes ? 'selected' : ''}>${mesNome(m)}</option>`).join('')}</select></label>
        <label class="sel"><span>Área</span><select class="in" id="ddsArea"><option value="">Todas</option>${L().areas.map(a => `<option ${a.nome === U.area ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>
        ${registraSeg(ME) ? `<button class="btn pri" data-act="ddsNovo">${I.plus} Registrar DDS</button>` : ''}
        ${!framed && l.length ? `<button class="btn sm" data-act="ddsExp">${I.dl} Exportar</button>` : ''}
      </div>
      ${semDds.length && l.length ? `<p class="muted small body pt0 m0">Sem DDS registrado no mês: ${semDds.map(esc).join(', ')}</p>` : ''}
      ${l.length ? `<div class="plist">${l.slice(0, lim).map(r => `<button class="pitem" data-act="ddsVer" data-id="${esc(r.id)}"><div class="minw"><div class="t">${esc(r.tema)}</div><div class="l">${dataBR(r.data)} · ${esc(r.area)} · por ${esc(title(r.porNome || ''))}</div></div><span class="pill neu">${(r.pessoas || []).length} pessoas</span></button>`).join('')}</div>${l.length > lim ? `<p class="muted small body">Mostrando ${lim} de ${l.length}. Escolha uma área.</p>` : ''}`
        : `<div class="empty"><b>Nenhum DDS em ${mesNome(U.mes)}</b><span>${registraSeg(ME) ? 'Toque em Registrar DDS ao fim do diálogo: tema, área e quem participou.' : 'Os DDS registrados pela Segurança aparecem aqui.'}</span></div>`}</div>`;
  }

  function form() {
    const hoje = today();
    const recentes = [...new Set([...(S().dds || []).map(r => r.tema), ...TEMAS])].slice(0, 40);
    formSheet('Registrar DDS', 'Diálogo diário de segurança', `
      <div class="g2eq"><label class="sel"><span>Data</span><input class="in" type="date" id="ddsData" value="${hoje}" max="${hoje}" required></label>
      <label class="sel"><span>Área</span><select class="in" id="ddsAr" required>${L().areas.map(a => `<option ${a.nome === (U.area || (ME && ME.area)) ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label></div>
      <label class="sel"><span>Tema</span><input class="in" id="ddsTema" list="ddsTemas" maxlength="200" required placeholder="Ex.: Trabalho em altura"></label>
      <datalist id="ddsTemas">${recentes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <label class="sel"><span>Quem participou (um nome por linha)</span><textarea class="in" id="ddsPessoas" rows="6" required placeholder="JOÃO DA SILVA&#10;MARIA SOUZA"></textarea></label>
      <p class="muted small m0" id="ddsConta">0 pessoas</p>
      <label class="sel"><span>Observação</span><input class="in" id="ddsObs" maxlength="1000" placeholder="Opcional"></label>`, 'Salvar', async () => {
      const data = $('ddsData').value, area = $('ddsAr').value, tema = $('ddsTema').value.replace(/\s+/g, ' ').trim(), pessoas = pessoasDe($('ddsPessoas').value);
      if (!data || data > today()) throw new Error('Informe a data (hoje ou antes).');
      if (!tema) throw new Error('Informe o tema.');
      if (!pessoas.length) throw new Error('Informe quem participou.');
      if (pessoas.length > 200) throw new Error('No máximo 200 pessoas por DDS.');
      DB.segDds({ data, mes: data.slice(0, 7), area, conj: conjDaArea(S().cfg, area), tema, pessoas, obs: $('ddsObs').value.trim() });
      DB.log && DB.log(`Segurança: DDS "${tema}" em ${area} com ${pessoas.length} pessoas`);
      U.mes = data.slice(0, 7); toast('DDS registrado'); render();
    });
    const conta = () => { const n = pessoasDe($('ddsPessoas').value).length; $('ddsConta').textContent = `${n} pessoa${n === 1 ? '' : 's'}`; };
    $('ddsPessoas').addEventListener('input', conta);
  }

  acoes.ddsNovo = () => form();
  acoes.ddsVer = (t, d) => {
    const r = (S().dds || []).find(x => x.id === d.id); if (!r) return;
    const ps = (r.pessoas || []).map(p => esc(title(p))).join('<br>');
    const ops = [{ t: 'Fechar', v: '' }, ...(isAdmin() ? [{ t: 'Excluir este DDS', v: 'x' }] : [])];
    sheet(r.tema, `${dataBR(r.data)} · ${esc(r.area)} · por ${esc(title(r.porNome || ''))}<br><b>${(r.pessoas || []).length} pessoas</b><br>${ps}${r.obs ? `<br><br>${esc(r.obs)}` : ''}`, ops, v => {
      if (v !== 'x') return;
      DB.segDdsExcluir(r.id); DB.log && DB.log(`Segurança: excluiu o DDS "${r.tema}" de ${dataBR(r.data)}`); toast('DDS excluído'); render();
    });
  };
  acoes.ddsExp = () => {
    const linhas = [['Data', 'Área', 'Tema', 'Pessoas', 'Participantes', 'Registrado por', 'Observação'],
      ...lista().map(r => [dataBR(r.data), r.area, r.tema, (r.pessoas || []).length, (r.pessoas || []).join('; '), r.porNome || '', r.obs || ''])];
    baixarExcel(`DDS ${U.mes}`, [{ nome: 'DDS', linhas }]).catch(e => toast('Não foi possível exportar: ' + e.message));
  };
  document.addEventListener('change', e => {
    if (e.target.id === 'ddsMes') { U.mes = e.target.value; DB.segWatch([U.mes]); render(); }
    else if (e.target.id === 'ddsArea') { U.area = e.target.value; render(); }
  });
  return { view };
}
// Para o Painel da Segurança: DDS e participações no mês.
export const ddsDoMes = (dds, mes) => { const l = (dds || []).filter(r => r.mes === mes); return { n: l.length, pessoas: l.reduce((s, r) => s + (r.pessoas || []).length, 0) }; };
