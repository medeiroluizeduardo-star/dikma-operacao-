// LGPD: registro de quem abriu a ficha de cada pessoa (RH › Colaboradores e Gestão › Ficha de acompanhamento).
// registrarAcesso grava no máximo uma linha por usuário, pessoa, ficha e dia (DB.acessoFicha). Só o administrador vê a
// lista, pelo botão "Quem abriu" da ficha (data-act="quemAbriu"); o banco também só deixa o administrador ler.
import { DB, esc, title } from '../nucleo/base.js';
import { isAdmin } from '../nucleo/estado.js';
import { acoes } from '../nucleo/acoes.js';
import { sheet, toast } from './janelas.js';

const FICHA = { rh: 'Cadastro (RH)', gestao: 'Ficha de acompanhamento' };
const dhBR = d => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

export const registrarAcesso = (c, ficha) => { if (c && c.mat) DB.acessoFicha(c.mat, c.nome, ficha); };
export const botaoQuemAbriu = c => (isAdmin() && c && c.mat ? `<button class="btn ghost" data-act="quemAbriu" data-mat="${esc(c.mat)}" data-nome="${esc(c.nome || '')}">Quem abriu</button>` : '');

acoes.quemAbriu = async (t, d) => {
  if (!isAdmin()) return;
  let l;
  try { l = await DB.acessosFichaDe(d.mat); } catch (e) { toast('Não deu para ler o registro agora. Tente de novo.'); return; }
  const opts = l.length ? l.slice(0, 200).map(x => ({ t: title(x.nome || 'Sem nome'), d: `${FICHA[x.ficha] || x.ficha} · ${dhBR(x.at)}` }))
    : [{ t: 'Ninguém abriu ainda', d: 'O registro começou com o pacote LGPD.' }];
  sheet(`Quem abriu a ficha de ${title(d.nome || d.mat)}`, 'Uma linha por pessoa, ficha e dia. Só o administrador vê esta lista. Guardado por tempo limitado (Administração › LGPD).', opts, () => {}, { fechar: 'Fechar' });
};
