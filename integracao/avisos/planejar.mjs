// Decide quem recebe qual aviso agora. Função pura: recebe os dados já lidos e devolve as mensagens.
// Usa as mesmas contas da tela "Meu dia" (public/hoje.js), copiadas para esta pasta na hora de rodar.
import { SETS, SET_KEYS, AREA_S, add, today } from './lib/cal.mjs';
import { resumoAtividades, resumoSemana, paradasAbertas, assinaturasPendentes } from './lib/hoje.mjs';
import { veTodasFichas, areasFichaDe } from './lib/pessoas.mjs';
import { estadoAprov, aprovaPapel } from './lib/aprovacao.mjs';
import { JUS_CODS, CODIGOS } from './lib/situacao.mjs';

const ATIVOS = ['admin', 'gestor', 'coordenador', 'supervisor', 'lider', 'administrativo', 'leitor'];
const PREFS_PADRAO = { paradas: true, assinaturas: true, deficit: true, atividades: true, semanal: true, aprovacao: true, painel: true, justificativas: true };
// Painel Coqueria (repositório Gest-o-Eduardo): endereço e processos diários (não contam como "entrega de amanhã").
export const PAINEL_URL = 'https://gestao-eduardo.web.app/';
const PAINEL_DIARIOS = new Set(['P04', 'P05', 'P07', 'P08']);
const up = s => String(s || '').toUpperCase();
const fmtH = h => h.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mods = u => (u.papel === 'admin' ? ['operacao', 'bateria', 'equipamentos', 'gestao'] : (u.modulos && u.modulos.length ? u.modulos : ['operacao']));
const todas = (u, m) => u.papel === 'admin' || (['gestor', 'coordenador', 'administrativo', 'leitor'].includes(u.papel) && mods(u).includes(m));
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

  // 8) Faltas, atrasos e atestados de hoje ainda sem justificativa (às 16h, uma vez por dia),
  //    para supervisor, coordenador e gestor, só nas áreas deles. Mostra contagens por área, nunca nomes.
  if (hora >= 16) {
    for (const x of alvo) {
      const chave = `jus|${x.uid}|${hoje}`;
      if (!x.prefs.justificativas || d.enviados[chave] || !['supervisor', 'coordenador', 'gestor'].includes(x.u.papel)) continue;
      const por = {}; let total = 0;
      for (const k of SET_KEYS) {
        const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue;
        for (const c of S.colabs || []) {
          if (!areas.includes(c.area)) continue;
          const key = c.id + '|' + hoje; const v = (S.sit || {})[key]; if (!JUS_CODS.includes(v)) continue;
          const j = (S.jus || {})[key]; if (j && j.cod === v) continue;
          total++; por[c.area] = (por[c.area] || 0) + 1;
        }
      }
      if (total) msgs.push({ uid: x.uid, titulo: total === 1 ? '1 falta ou atraso sem justificativa hoje' : `${total} faltas e atrasos sem justificativa hoje`, corpo: Object.entries(por).map(([a, n]) => `${AREA_S[a] || a} ${n}`).join(' · ') + '\nToque para justificar.', tag: 'justificativas', url: '/?m=gestao&v=esjus' });
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
  // 5) Resumo da semana que passou (segunda-feira, a partir das 7h), para administrador, gestor e coordenador.
  if (hora >= 7 && new Date(hoje + 'T12:00:00').getDay() === 1) {
    const ini = add(hoje, -7); const dm = s => `${s.slice(8)}/${s.slice(5, 7)}`;
    const nomeAus = c => (CODIGOS[c] && CODIGOS[c].plural) || [c, c]; // tabela única (situacao.js)
    const pend = assinaturasPendentes(d.ocorr || [], hoje).total;
    const abertas = paradasAbertas(d.paradas || [], agora).length;
    for (const x of alvo) {
      const chave = `sem|${x.uid}|${hoje}`;
      if (!x.prefs.semanal || d.enviados[chave] || !['admin', 'gestor', 'coordenador'].includes(x.u.papel)) continue;
      const linhas = []; let mod = null;
      for (const k of SET_KEYS) {
        const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue;
        const r = resumoSemana({ ...S, areas }, ini); if (!r.prog && !Object.keys(r.aus).length) continue;
        mod = mod || SETS[k].mod;
        const aus = Object.entries(r.aus).map(([c, n]) => `${n} ${nomeAus(c)[n > 1 ? 1 : 0]}`);
        linhas.push(`${SETS[k].curto}: ${r.pct != null ? `${r.pct}% realizado (${r.R} de ${r.prog})` : 'sem programação'}${r.N ? ` · ${r.N} não realizada${r.N > 1 ? 's' : ''}` : ''}${aus.length ? ' · ' + aus.join(', ') : ''}`);
      }
      if (mods(x.u).includes('gestao') && pend) linhas.push(`Efetivo: ${pend} assinatura${pend > 1 ? 's' : ''} pendente${pend > 1 ? 's' : ''}`);
      if (mods(x.u).includes('equipamentos') && abertas) linhas.push(`Operação: ${abertas} parada${abertas > 1 ? 's' : ''} sem liberação`);
      if (linhas.length) msgs.push({ uid: x.uid, titulo: `Resumo da semana (${dm(ini)} a ${dm(add(ini, 6))})`, corpo: linhas.join('\n'), tag: 'semanal', url: mod ? `/?m=${mod}&v=resumo&s=${ini}` : '/?v=meudia' });
      marcar.add(chave);
    }
  }
  // 6) Aprovação dos apontamentos (das 7h em diante):
  //    líder → cada atividade devolvida pelo supervisor, assim que for devolvida (uma vez por atividade);
  //    supervisor e acima → uma vez por dia, o que espera aprovação há mais de 1 dia nas áreas dele.
  if (hora >= 7) {
    const celulas = (S, areas, fn) => { for (const [id, doc] of Object.entries(S.semanas || {})) { if (!areas.includes(doc.area)) continue; const ap = (S.aprov || {})[id] || {}; for (const [pid, str] of Object.entries(doc.s || {})) for (let k = 0; k < 7; k++) { const dt = add(doc.ini || id.split('|')[1], k); fn({ id, pid, k, dt, c: str[k], a: ap[pid + '|' + k], m: (doc.m || {})[pid + '|' + k] }); } } };
    for (const x of alvo) {
      if (!x.prefs.aprovacao) continue;
      if (x.u.papel === 'lider') {
        const novas = []; let mod = null;
        for (const k of SET_KEYS) { const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue; celulas(S, areas, z => { if (estadoAprov(z.c, z.dt, z.a, hoje, z.m) !== 'dev') return; const ch = `devi|${k}|${z.id}|${z.pid}|${z.k}|${(z.a && z.a.em) || ''}`; if (d.enviados[ch]) return; novas.push({ ...z, ch }); mod = mod || SETS[k].mod; }); }
        if (novas.length) {
          msgs.push({ uid: x.uid, titulo: novas.length === 1 ? 'O supervisor devolveu 1 atividade' : `O supervisor devolveu ${novas.length} atividades`, corpo: novas.slice(0, 3).map(z => `${z.dt.slice(8)}/${z.dt.slice(5, 7)}: ${(z.a && z.a.mot) || 'sem motivo'}`).join('\n') + '\nToque para corrigir no Apontar.', tag: 'aprovacao', url: `/?m=${mod}&v=apontar` });
          novas.forEach(z => marcar.add(z.ch));
        }
      } else if (aprovaPapel(x.u.papel) && hora >= 8) {
        const chave = `apr|${x.uid}|${hoje}`; if (d.enviados[chave]) continue;
        let n = 0, mod = null; const limite = add(hoje, -1);
        for (const k of SET_KEYS) { const areas = areasDe(x.u, k); const S = d.sets[k]; if (!areas.length || !S) continue; celulas(S, areas, z => { if (z.dt < limite && estadoAprov(z.c, z.dt, z.a, hoje, z.m) === 'pend') { n++; mod = mod || SETS[k].mod; } }); }
        if (n) msgs.push({ uid: x.uid, titulo: `${n} apontamento${n > 1 ? 's' : ''} esperando aprovação há mais de 1 dia`, corpo: 'Toque para aprovar ou devolver.', tag: 'aprovacao', url: `/?m=${mod}&v=aprovar` });
        marcar.add(chave);
      }
    }
  }
  // 7) Painel Coqueria, só em dia útil e só para quem usa o painel (d.painel[uid], lido pela rotina):
  //    às 7h, tarefas do dia, atrasadas e entregas de amanhã; às 16h, o que ficou em aberto e os lançamentos da
  //    Medição pendentes no mês. Mostra títulos de processos e contagens, nunca nomes de colaboradores.
  const dow = new Date(hoje + 'T12:00:00').getDay();
  if (d.painel && dow > 0 && dow < 6) {
    const s = n => (n > 1 ? 's' : '');
    const curto = t => String(t.title || '').replace(/\s·\s\d{2}\/\d{2}$/, '');
    for (const x of alvo) {
      const P = d.painel[x.uid]; if (!P || !x.prefs.painel) continue;
      const abertas = (P.tasks || []).filter(t => t && !t.deleted && t.due && t.status !== 'done');
      const doDia = abertas.filter(t => t.due === hoje), atr = abertas.filter(t => t.due < hoje);
      const cm = `pnl-m|${x.uid}|${hoje}`;
      if (hora >= 7 && !d.enviados[cm]) {
        const amanha = abertas.filter(t => t.due === add(hoje, 1) && !PAINEL_DIARIOS.has(t.pid));
        if (doDia.length || atr.length || amanha.length) {
          const linhas = [];
          if (doDia.length) linhas.push(doDia.slice(0, 3).map(curto).join(' · ') + (doDia.length > 3 ? ` · +${doDia.length - 3}` : ''));
          if (atr.length) linhas.push(`${atr.length} atrasada${s(atr.length)}`);
          if (amanha.length) linhas.push('Amanhã: ' + amanha.slice(0, 2).map(curto).join(' · '));
          msgs.push({ uid: x.uid, titulo: doDia.length ? `Painel: ${doDia.length} tarefa${s(doDia.length)} para hoje` : atr.length ? `Painel: ${atr.length} tarefa${s(atr.length)} atrasada${s(atr.length)}` : 'Painel: entrega amanhã', corpo: linhas.join('\n'), tag: 'painel', url: PAINEL_URL });
        }
        marcar.add(cm);
      }
      const ct = `pnl-t|${x.uid}|${hoje}`;
      if (hora >= 16 && !d.enviados[ct]) {
        const regs = (P.regs || []).filter(r => r && r.data && r.data.slice(0, 7) === hoje.slice(0, 7));
        const sem = tp => regs.filter(r => r.tipo === tp && !r.lancado).length;
        const f = sem('falta'), he = sem('he'), hp = sem('hp'), ind = regs.filter(r => r.tipo === 'ind' && r.status !== 'corrigido').length;
        const aberto = doDia.length + atr.length, med = f + he + hp;
        if (aberto || med || ind) {
          const linhas = [];
          if (aberto) linhas.push([...atr, ...doDia].slice(0, 3).map(curto).join(' · ') + (aberto > 3 ? ` · +${aberto - 3}` : ''));
          const partes = [f && `${f} falta${s(f)}`, he && `${he} hora${s(he)} extra${s(he)}`, hp && `${hp} hora${s(hp)} perdida${s(hp)}`].filter(Boolean);
          if (partes.length) linhas.push(`Medição sem lançar: ${partes.join(', ')}`);
          if (ind) linhas.push(`${ind} correção${ind > 1 ? 'ões' : ''} ICCC/ICCP pendente${s(ind)}`);
          msgs.push({ uid: x.uid, titulo: aberto ? `Painel: ${aberto} tarefa${s(aberto)} ainda em aberto` : `Painel: ${med + ind} lançamento${s(med + ind)} da Medição pendente${s(med + ind)}`, corpo: linhas.join('\n'), tag: 'painel', url: PAINEL_URL });
        }
        marcar.add(ct);
      }
    }
  }
  return { msgs, marcar: [...marcar] };
}
