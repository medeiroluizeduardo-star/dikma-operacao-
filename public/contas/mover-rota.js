// Mover de rota no dia (Operação › Escala do dia). Contas sem tela: as mesmas do site e dos testes.
// A movimentação vale só naquele dia e não muda o cadastro. Fica no documento da presença do mês (situacao e
// b_situacao), no campo mov: { 'PESSOA|AAAA-MM-DD': { id, dt, de, para, ao, ap, st, por, nome, em, ok, okNome, okEm, mot } }
//   de / para = 'ÁREA|ROTA' (origem e destino) · ao / ap = área de origem e de destino
//   st = pendente (pedido, a pessoa segue na rota de origem) | aprovado (vale no dia) | recusado | cancelado
// Quem pede: na mesma área, líder, supervisor, coordenador e gestor da área; para outra área, só do supervisor para cima.
// Quem aprova: na mesma área, o supervisor (ou coordenador e gestor) da área; para outra área, só o administrador.
// Quem pode aprovar já grava aprovado (não precisa pedir para si mesmo). O administrador pode tudo.
// As regras do banco (firestore.rules, movOk) conferem as mesmas coisas.

export const MOV_ST = ['pendente', 'aprovado', 'recusado', 'cancelado'];
export const MOV_NOME = { pendente: 'Movimentação pendente', aprovado: 'Movimentação aprovada', recusado: 'Movimentação recusada', cancelado: 'Movimentação cancelada' };
const ACIMA = ['supervisor', 'coordenador', 'gestor'];
const LANCA = ['lider', ...ACIMA];

export const chaveMov = (id, dt) => id + '|' + dt;
export const rotaK = (area, rota) => area + '|' + rota;
export const partesRota = k => { const s = String(k || ''); const i = s.indexOf('|'); return i < 0 ? { area: '', rota: s } : { area: s.slice(0, i), rota: s.slice(i + 1) }; };

// q = { perfil: perfil na Operação, areas: áreas em que lança, admin }
const daArea = (q, a) => (q.areas || []).includes(a);
export function podePedir(q, ao, ap) {
  if (!q) return false; if (q.admin) return true;
  if (ao === ap) return LANCA.includes(q.perfil) && daArea(q, ao);
  return ACIMA.includes(q.perfil) && daArea(q, ao);
}
export function podeAprovar(q, ao, ap) {
  if (!q) return false; if (q.admin) return true;
  return ao === ap && ACIMA.includes(q.perfil) && daArea(q, ap);
}

// Pedido novo (ou trocar o destino). Devolve o valor a gravar; erro com mensagem simples quando não pode.
// c = pessoa (id, area, rota) · quem = { uid, nome, ...q } · em = data e hora (ISO)
export function pedirMov(atual, { c, dt, para, quem, em }) {
  const de = rotaK(c.area, c.rota); const p = partesRota(para);
  if (!p.area || !p.rota) throw new Error('Escolha a rota de destino.');
  if (para === de) throw new Error('A pessoa já está nesta rota.');
  if (atual && atual.st === 'aprovado' && !podeAprovar(quem, atual.ao, atual.ap)) throw new Error('Esta movimentação já foi aprovada. Para mudar, fale com o supervisor da área.');
  if (!podePedir(quem, c.area, p.area)) throw new Error(c.area === p.area ? 'Só quem lança a presença da área pede a movimentação.' : 'Para outra área, só o supervisor pede a movimentação.');
  const base = { id: c.id, dt, de, para, ao: c.area, ap: p.area, por: quem.uid, nome: quem.nome || '', em };
  if (podeAprovar(quem, c.area, p.area)) return { ...base, st: 'aprovado', ok: quem.uid, okNome: quem.nome || '', okEm: em };
  return { ...base, st: 'pendente' };
}
// Aprovar, recusar (com motivo) ou cancelar. Cancelar: quem pediu (enquanto pendente) ou quem pode aprovar.
export function decidirMov(atual, acao, { quem, em, mot = '' }) {
  if (!atual || !MOV_ST.includes(atual.st)) throw new Error('Movimentação não encontrada.');
  const aprova = podeAprovar(quem, atual.ao, atual.ap);
  if (acao === 'aprovado' || acao === 'recusado') {
    if (atual.st !== 'pendente') throw new Error('Esta movimentação já foi decidida.');
    if (!aprova) throw new Error(atual.ao === atual.ap ? 'Só o supervisor da área aprova.' : 'Movimentação para outra área: só o administrador aprova.');
    if (acao === 'recusado' && !String(mot).trim()) throw new Error('Escreva o motivo da recusa.');
    return { ...atual, st: acao, ok: quem.uid, okNome: quem.nome || '', okEm: em, mot: acao === 'recusado' ? String(mot).trim().slice(0, 200) : '' };
  }
  if (acao === 'cancelado') {
    const dono = atual.st === 'pendente' && atual.por === quem.uid;
    if (!['pendente', 'aprovado'].includes(atual.st)) throw new Error('Esta movimentação já foi encerrada.');
    if (!dono && !aprova) throw new Error('Só quem pediu ou o supervisor da área cancela.');
    return { ...atual, st: 'cancelado', ok: quem.uid, okNome: quem.nome || '', okEm: em, mot: '' };
  }
  throw new Error('Ação desconhecida.');
}

// Movimentações de um dia (sem as canceladas), do mapa do mês: [{ ...valor }]
export function movsDoDia(mapa, dt) {
  const out = []; for (const [k, v] of Object.entries(mapa || {})) { if (!v || v.st === 'cancelado') continue; const i = k.lastIndexOf('|'); if (k.slice(i + 1) === dt) out.push({ ...v, id: v.id || k.slice(0, i), dt }); }
  return out;
}
// Só as aprovadas, por pessoa: Map(id → valor)
export const aprovadasDoDia = (mapa, dt) => new Map(movsDoDia(mapa, dt).filter(v => v.st === 'aprovado').map(v => [v.id, v]));
// Rota da pessoa no dia ('ÁREA|ROTA'): o destino da movimentação aprovada, senão a do cadastro.
export const rotaNoDia = (c, aprov) => { const v = aprov && aprov.get(c.id); return v && v.de === rotaK(c.area, c.rota) ? v.para : rotaK(c.area, c.rota); };
// Pessoas que estão na rota no dia: as do cadastro que não saíram + as que vieram (movimentação aprovada).
export const pessoasDaRota = (cs, area, rota, aprov) => { const k = rotaK(area, rota); return cs.filter(c => rotaNoDia(c, aprov) === k); };
// Pessoas de uma área no dia ('TODAS' = todas): sai quem foi para outra área, entra quem veio de outra.
export const pessoasDaArea = (cs, area, aprov) => (area === 'TODAS' ? cs.slice() : cs.filter(c => partesRota(rotaNoDia(c, aprov)).area === area));
