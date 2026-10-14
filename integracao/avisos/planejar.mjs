// Decide quem recebe qual aviso agora. Função pura: recebe os dados já lidos e devolve as mensagens.
// Usa as mesmas contas da tela "Meu dia" (public/hoje.js), copiadas para esta pasta na hora de rodar.
import { SETS, SET_KEYS, AREA_S, add, today } from './lib/cal.mjs';
import { resumoAtividades, paradasAbertas, assinaturasPendentes } from './lib/hoje.mjs';
import { veTodasFichas, areasFichaDe } from './lib/pessoas.mjs';

const ATIVOS = ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'leitor'];
const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true, atividades: true };
const up = s => String(s || '').toUpperCase();
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
    for (const x of alvo) if (x.prefs.paradas && mods(x.u).includes('equipamentos')) msgs.push({ uid: x.uid, titulo, corpo, tag: 'paradas', url: '/?m=equipamentos&v=epar' });
    novas.forEach(p => marcar.add('par|' + p.id));
  }

  // 2) Assinaturas pendentes há mais de 7 dias (resumo uma vez por dia, a partir das 8h).
  //    Cada pessoa recebe só as dela: as que vai recolher e, se for responsável pela área, as da área sem responsável.
  //    Quem vê todas as áreas (administrador, gestor, coordenador) recebe o total. Sem nomes na tela bloqueada.
  if (hora >= 8 && !d.enviados['ass|' + hoje]) {
    const a = assinaturasPendentes(d.ocorr || [], hoje);
    if (a.velhas.length) {
      for (const x of alvo) {
        if (!x.prefs.assinaturas || !mods(x.u).includes('gestao') || x.u.papel === 'leitor') continue;
        const eu = up(x.u.nome);
        const comigo = a.velhas.filter(o => o.recolhe && up(o.recolhe) === eu);
        const todas = veTodasFichas(x.u);
        const areas = areasFichaDe(x.u);
        const daArea = a.velhas.filter(o => !comigo.includes(o) && (todas || (areas.includes(o.area) && (!o.recolhe || x.u.papel === 'supervisor'))));
        const n = comigo.length + daArea.length; if (!n) continue;
        const s = n > 1 ? 's' : '';
        const titulo = comigo.length === n ? `${n} assinatura${s} com você há mais de 7 dias` : `${n} assinatura${s} pendente${s} há mais de 7 dias`;
        const corpo = comigo.length && comigo.length < n ? `${comigo.length} com você para recolher. Toque para ver.` : 'Toque para ver no Meu dia.';
        msgs.push({ uid: x.uid, titulo, corpo, tag: 'assinaturas', url: '/?m=gestao&v=gocorr' });
      }
    }
    marcar.add('ass|' + hoje);
  }

  // 4) Atividades do dia ainda sem apontar (às 15h, uma vez por dia), para líder e supervisor, só nas áreas deles
  if (hora >= 15) {
    for (const x of alvo) {
      const chave = `apo|${x.uid}|${hoje}`; if (!x.prefs.atividades || d.enviados[chave] || !['lider', 'supervisor'].includes(x.u.papel)) continue;
      const partes = []; let total = 0, mod = null;
      for (const k of SET_KEYS) {
        const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue;
        for (const area of areas) {
          const r = resumoAtividades({ ...S, areas: [area], hoje });
          if (!r.hoje.P) continue;
          total += r.hoje.P; mod = mod || SETS[k].mod;
          partes.push({ area, P: r.hoje.P, rotas: r.rotas.filter(y => y.P).slice(0, 2).map(y => `${y.rota.toLowerCase()} ${y.P}`) });
        }
      }
      if (total) {
        const titulo = partes.length === 1 ? `${AREA_S[partes[0].area]}: ${total} atividade${total > 1 ? 's' : ''} sem apontar hoje` : `${total} atividades sem apontar hoje`;
        const corpo = (partes.length === 1 ? partes[0].rotas.join(' · ') : partes.map(p => `${AREA_S[p.area]} ${p.P}`).join(' · ')) + '\nToque para apontar.';
        msgs.push({ uid: x.uid, titulo, corpo, tag: 'atividades', url: `/?m=${mod}&v=apontar` });
      }
      marcar.add(chave);
    }
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
      if (linhas.length) msgs.push({ uid: x.uid, titulo: `Amanhã (${add(hoje, 1).slice(8)}/${add(hoje, 1).slice(5, 7)}): ${linhas.length} rota${linhas.length > 1 ? 's' : ''} com déficit de efetivo`, corpo: linhas.slice(0, 4).join('\n') + (linhas.length > 4 ? `\n+ ${linhas.length - 4}` : ''), tag: 'deficit', url: '/?m=gestao&v=esdia' });
      marcar.add(chave);
    }
  }
  return { msgs, marcar: [...marcar] };
}
