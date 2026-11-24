// Dikma Gestão — RH › Colaboradores › ficha › aba "Dados pessoais" (CPF, endereço, telefone e rota de ônibus) e a
// importação desses dados (e da matrícula Arcelor) pela planilha do RH. As contas ficam em contas/dados-pessoais.js.
// Os dados ficam em dpessoais/{matrícula}, lidos só quando a aba abre (na tela, só na memória).
// Quem vê: administrador e RH · Administrativo; RH · Somente leitura só com "Ver dados pessoais" ligado em Perfis.
// Quem grava e importa: administrador e RH · Administrativo. O banco confere o mesmo (firestore.rules › dpessoais).
import { DB, esc, title } from '../nucleo/base.js';
import { isAdmin, perfil, podeItem } from '../nucleo/estado.js';
import { CAMPOS_DP, ROTULO_DP, cpfMostrar, limparDP, problemaDP, lerPlanilhaDP, compararDP } from '../contas/dados-pessoais.js';
import { dados, carregando, botaoAcao } from '../ui/padrao.js';
import { formSheet, toast } from '../ui/janelas.js';
import { render } from '../ui/shell.js';
import { acoes } from '../nucleo/acoes.js';

const $ = id => document.getElementById(id);
export const podeVerDP = () => isAdmin() || (['administrativo', 'leitor'].includes(perfil('rh')) && podeItem('i_dpessoais', 'rh'));
export const podeEditarDP = () => isAdmin() || (perfil('rh') === 'administrativo' && podeVerDP());

// mat → { st: 'lendo' | 'ok' | 'erro', d }
const MEM = new Map();
function ler(mat) {
  const k = String(mat); if (MEM.has(k)) return MEM.get(k);
  const e = { st: 'lendo', d: null }; MEM.set(k, e);
  DB.dpLer(k).then(d => { e.st = 'ok'; e.d = d || {}; }).catch(() => { e.st = 'erro'; }).then(() => render());
  return e;
}

export function vDadosPessoais(c) {
  if (!podeVerDP()) return '<p class="muted">Só o administrador e o RH · Administrativo veem os dados pessoais.</p>';
  const e = ler(c.mat);
  if (e.st === 'lendo') return carregando();
  if (e.st === 'erro') return `<div class="aviso">Não deu para ler os dados pessoais agora. <button type="button" class="btn sm" data-act="dpRelear" data-mat="${esc(c.mat)}">Tentar de novo</button></div>`;
  const d = e.d || {};
  const lista = dados([['CPF', d.cpf ? `<span class="mono">${esc(cpfMostrar(d.cpf))}</span>` : ''], ['Telefone', esc(d.tel || '')], ['Endereço', esc(d.end || '')], ['Rota de ônibus', esc(d.rotaOn || '')]]);
  const ed = podeEditarDP() ? `<div class="row-gap">${botaoAcao('Editar dados pessoais', `data-act="dpEditar" data-mat="${esc(c.mat)}"`)}</div>` : '';
  return `${lista}${ed}<p class="muted small m0">Dados pessoais (LGPD): só o administrador e o RH · Administrativo veem. Cada abertura da ficha fica registrada em "Quem abriu".</p>`;
}

function formEditar(c) {
  const e = MEM.get(String(c.mat)); const d = (e && e.d) || {};
  formSheet('Dados pessoais', `${esc(title(c.nome))} · ${esc(c.mat)}`, `
    <div class="row2"><label class="sel"><span>CPF</span><input class="in" id="dpCpf" value="${esc(d.cpf ? cpfMostrar(d.cpf) : '')}" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00"></label>
    <label class="sel"><span>Telefone</span><input class="in" id="dpTel" value="${esc(d.tel || '')}" inputmode="tel" autocomplete="off" placeholder="27 90000-0000"></label></div>
    <label class="sel"><span>Endereço</span><input class="in" id="dpEnd" value="${esc(d.end || '')}" autocomplete="off" maxlength="300"></label>
    <label class="sel"><span>Rota de ônibus</span><input class="in" id="dpRota" value="${esc(d.rotaOn || '')}" autocomplete="off" placeholder="Ex.: ROTA 04" maxlength="40"></label>`, 'Salvar', async () => {
    const n = limparDP({ cpf: $('dpCpf').value, tel: $('dpTel').value, end: $('dpEnd').value, rotaOn: $('dpRota').value });
    const p = problemaDP(n); if (p) throw new Error(p);
    await DB.dpSalvar(c.mat, n);
    MEM.set(String(c.mat), { st: 'ok', d: n });
    DB.log(`RH: alterou os dados pessoais de ${title(c.nome)}`, 'rh');
    toast('Dados pessoais salvos'); render();
  });
}

// ---- importação da planilha ----
async function lerArquivo(file) {
  const XLSX = await import('../vendor/xlsx.js');
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  return wb.SheetNames.map(n => ({ nome: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }) }));
}
const pessoa = x => `${esc(title(x.nome))}${x.aba ? ` <span class="muted small">(${esc(x.aba)}, linha ${x.linha})</span>` : ''}`;
const bloco = (t, l, fn, aberto = false) => (l.length ? `<details${aberto ? ' open' : ''}><summary><b>${l.length}</b> ${t}</summary><ul class="small m0">${l.slice(0, 300).map(x => `<li>${fn(x)}</li>`).join('')}${l.length > 300 ? `<li>… e mais ${l.length - 300}</li>` : ''}</ul></details>` : '');

function conferir(r) {
  const campos = k => r.gravar.filter(x => x.campos.includes(k)).length;
  const html = `<div class="stackcol">
    <p class="m0"><b>${r.gravar.length}</b> ${r.gravar.length === 1 ? 'pessoa recebe' : 'pessoas recebem'} dados novos (${CAMPOS_DP.map(k => `${ROTULO_DP[k]}: ${campos(k)}`).join(' · ')}). ${r.iguais ? `${r.iguais} já estavam iguais.` : ''}</p>
    <p class="m0"><b>${r.arc.length}</b> ${r.arc.length === 1 ? 'matrícula Arcelor entra ou muda' : 'matrículas Arcelor entram ou mudam'} na ficha.</p>
    ${bloco('matrículas Arcelor que mudam (já tinham outra)', r.arc.filter(a => a.de), a => `${esc(title(a.nome))}: ${esc(a.de)} → ${esc(a.para)}`)}
    ${bloco('sem ficha no sistema (ficam de fora)', r.semFicha, pessoa, true)}
    ${bloco('com CPF inválido (o CPF fica de fora; corrija na ficha)', r.cpfInvalido, pessoa, true)}
    ${bloco('achadas pelo nome (sem matrícula Dikma na planilha)', r.pelonome, pessoa)}
    ${bloco('repetidas na planilha (vale a primeira, das abas de ativos)', r.repetidos, x => `${pessoa(x)} · já veio de ${esc(x.outra)}`)}
    ${bloco('matrículas Arcelor que já são de outra pessoa (ficam de fora)', r.arcConflito, x => `${esc(title(x.nome))}: ${esc(x.matArc)} já é de ${esc(title(x.de))}`, true)}
    <p class="muted small m0">Campo vazio na planilha não apaga o que já está gravado. A planilha não fica guardada no sistema.</p></div>`;
  const n = r.gravar.length + r.arc.length;
  if (!n) { formSheet('Conferir a importação', 'Nada para gravar', html, 'Fechar', async () => {}); return; }
  formSheet('Conferir antes de gravar', 'Nada foi gravado ainda', html, `Gravar ${r.gravar.length} ${r.gravar.length === 1 ? 'pessoa' : 'pessoas'}`, async () => {
    await DB.dpImportar(r.gravar.map(x => ({ mat: x.mat, dados: x.dados })), r.arc.map(a => ({ mat: a.mat, para: a.para })));
    for (const x of r.gravar) MEM.set(String(x.mat), { st: 'ok', d: x.dados });
    DB.log(`RH: importou dados pessoais de ${r.gravar.length} pessoas e ${r.arc.length} matrículas Arcelor`, 'rh');
    toast('Dados pessoais importados'); render();
  });
}

export function importarDP(fichas) {
  formSheet('Importar dados pessoais', 'Planilha do RH com NOME, MATRICULA DIK, MATRICULA AMT, CPF, ENDEREÇO, TELEFONE e ROTA', `
    <label class="sel"><span>Planilha (.xlsx)</span><input class="in" type="file" id="dpArq" accept=".xlsx,.xlsm,.xls"></label>
    <p class="muted small m0">Lê todas as abas (por exemplo Bateria, Pátio e Desligados), liga cada linha pela matrícula Dikma (sem ela, pelo nome) e mostra o que vai mudar antes de gravar. A matrícula AMT vai para a Matrícula Arcelor da ficha.</p>`, 'Ler a planilha', async () => {
    const f = $('dpArq').files[0]; if (!f) throw new Error('Escolha a planilha.');
    const linhas = lerPlanilhaDP(await lerArquivo(f));
    if (!linhas.length) throw new Error('Não achei a tabela: confira se a planilha tem as colunas NOME e MATRICULA DIK (ou CPF).');
    const atuais = new Map((await DB.dpLerTodos()).map(d => [String(d.id || d.mat), d]));
    conferir(compararDP(linhas, fichas, atuais));
  });
}

acoes.dpRelear = (t, d) => { MEM.delete(String(d.mat)); render(); };
// c = ficha da pessoa (colaboradores.js acha pela matrícula). Só abre depois que os dados foram lidos.
export function editarDP(c) { const e = MEM.get(String(c.mat)); if (c && e && e.st === 'ok' && podeEditarDP()) formEditar(c); }
