// Decide quem recebe qual aviso agora. Função pura: recebe os dados já lidos e devolve as mensagens.
// Usa as mesmas contas da tela "Meu dia" (public/hoje.js), copiadas para esta pasta na hora de rodar.
import { SETS, SET_KEYS, AREA_S, add, today } from './lib/cal.mjs';
import { resumoAtividades, paradasAbertas, assinaturasPendentes } from './lib/hoje.mjs';

const ATIVOS = ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'leitor'];
const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true };
const fmtH = h => h.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mods = u => (u.papel === 'admin' ? ['operacao', 'bateria', 'equipamentos', 'gestao'] : (u.modulos && u.modulos.length ? u.modulos : ['operacao']));
const todas = (u, m) => u.papel === 'admin' || (['gestor', 'coordenador', 'leitor'].includes(u.papel) && mods(u).includes(m));
function areasDe(u, k) {
  if (!mods(u).includes(SETS[k].mod)) return [];
  if (todas(u, SETS[k].mod)) return SETS[k].areas;
  return [...new Set([u.area, u.papel === 'supervisor' ? u.area2 : null].filter(a => a && SETS[k].areas.includes(a)))];
}

// d = { usuarios: {uid: perfil}, avisos: {uid: {tokens, prefs}}, paradas[], ocorr[], sets: {k: dadosDoConjunto}, enviados: {chave: true}, agora: Date }
export function planejar(d) {
  const agora = d.agora || new Date(); const hoje = d.hoje || today(); const hora = agora.getHours();
  const msgs = [], marcar = new Set();
  const alvo = Object.entries(d.avisos).filter(([uid, a]) => (a.tokens || []).length && d.usuarios[uid] && ATIVOS.includes(d.usuarios[uid].papel))
    .map(([uid, a]) => ({ uid, u: d.usuarios[uid], prefs: { ...PREFS_PADRAO, ...(a.prefs || {}) } }));

  // 1) Paradas sem liberação há mais de 2 horas (uma vez por parada)
  const longas = paradasAbertas(d.paradas || [], agora).filter(p => p.horas >= 2);
  const novas = longas.filter(p => !d.enviados['par|' + p.id]);
  if (novas.length) {
    const titulo = novas.length === 1 ? `Parada sem liberação há ${fmtH(novas[0].horas)} h` : `${novas.length} paradas sem liberação há mais de 2 h`;
    const corpo = novas.slice(0, 3).map(p => `${p.eq} · ${(p.causa || 'sem causa').toLowerCase()} · desde ${p.data.slice(8)}/${p.data.slice(5, 7)} ${p.ini}`).join('\n') + (novas.length > 3 ? `\n+ ${novas.length - 3}` : '');
    for (const x of alvo) if (x.prefs.paradas && mods(x.u).includes('equipamentos')) msgs.push({ uid: x.uid, titulo, corpo, tag: 'paradas', url: '/?v=meudia' });
    novas.forEach(p => marcar.add('par|' + p.id));
  }

  // 2) Assinaturas pendentes há mais de 7 dias (resumo uma vez por dia, a partir das 8h)
  if (hora >= 8 && !d.enviados['ass|' + hoje]) {
    const a = assinaturasPendentes(d.ocorr || [], hoje);
    if (a.velhas.length) {
      const titulo = `${a.velhas.length} assinatura${a.velhas.length > 1 ? 's' : ''} pendente${a.velhas.length > 1 ? 's' : ''} há mais de 7 dias`;
      const nomes = [...new Set(a.velhas.map(o => o.nome.split(' ')[0]))];
      const corpo = `Fichas do Efetivo aguardando assinatura: ${nomes.slice(0, 4).map(n => n[0] + n.slice(1).toLowerCase()).join(', ')}${nomes.length > 4 ? ' e outros' : ''}.`;
      for (const x of alvo) if (x.prefs.assinaturas && mods(x.u).includes('gestao') && x.u.papel !== 'leitor') msgs.push({ uid: x.uid, titulo, corpo, tag: 'assinaturas', url: '/?v=meudia' });
    }
    marcar.add('ass|' + hoje);
  }

  // 3) Déficit de efetivo amanhã (uma vez por dia por pessoa, a partir das 17h), só nas áreas da pessoa
  if (hora >= 17) {
    for (const x of alvo) {
      const chave = `def|${x.uid}|${hoje}`; if (!x.prefs.deficit || d.enviados[chave]) continue;
      const linhas = [];
      for (const k of SET_KEYS) {
        const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue;
        const r = resumoAtividades({ ...S, areas, hoje });
        r.deficit.forEach(df => linhas.push(`${df.rota} (${AREA_S[df.area]}): ${df.disp} de ${df.nec}`));
      }
      if (linhas.length) msgs.push({ uid: x.uid, titulo: `Amanhã (${add(hoje, 1).slice(8)}/${add(hoje, 1).slice(5, 7)}): ${linhas.length} rota${linhas.length > 1 ? 's' : ''} com déficit de efetivo`, corpo: linhas.slice(0, 4).join('\n') + (linhas.length > 4 ? `\n+ ${linhas.length - 4}` : ''), tag: 'deficit', url: '/?v=meudia' });
      marcar.add(chave);
    }
  }
  return { msgs, marcar: [...marcar] };
}
