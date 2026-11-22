// Alarme da cópia de segurança e da cota grátis. Roda pelo GitHub (Actions › Alarme do backup e da cota), 2 vezes por dia.
// Não lê nenhum documento do banco (não gasta cota): olha só o GitHub e o painel de uso do Google (Cloud Monitoring).
//   1) A cópia de segurança (backup.yml) deu certo nas últimas 26 horas e o pacote tem o tamanho de costume?
//   2) O uso de leituras, gravações e exclusões do Firestore passou de 70% da cota grátis (hoje e ontem)?
// Se algo estiver errado, a rotina falha e o GitHub manda e-mail.
// No fim grava um resumo em sistema/saude (1 gravação, sem leitura) para a tela Administração › Saúde do sistema:
// cópia, ensaio de restauração, cópia mensal (avisos abertos), cota e os problemas achados.
// ATENÇÃO (22/11/2026): no plano grátis (Spark) o Google recusa ler o uso ("requires billing"); aí a parte 2
// fica de fora sem aviso e só a cópia vale. Passa a funcionar sozinha se o projeto for para o plano Blaze.
//   GH_TOKEN, GITHUB_REPOSITORY        para ler as execuções da cópia
//   FIREBASE_SERVICE_ACCOUNT           para ler o uso no Google (opcional; sem ela, só a cópia)
//   ALARME_TESTE=1                     falha de propósito, para conferir que o e-mail chega
import { resumo, conectar } from './comum.mjs';
import { avaliarBackup, avaliarCota, inicioDiaCota, ultimaRotina, LIMITE } from './alarme-contas.mjs';

const agora = new Date();
const problemas = [], avisos = [], md = [];
// Resumo para a tela Saúde do sistema (sistema/saude). Datas em texto ISO; a tela calcula "há quanto tempo".
const saude = { backup: { ultima: null, nome: '', bytes: 0, problemas: [] }, ensaio: null, mensal: null, cota: { lida: false, dias: [] } };
const hora = d => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

// ---------- 1) cópia de segurança ----------
async function gh(caminho) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${caminho}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${caminho}`);
  return r.json();
}
try {
  const { workflow_runs: runs = [] } = await gh('actions/workflows/backup.yml/runs?per_page=15');
  const execucoes = [];
  let boas = 0;
  for (const e of runs) {
    const x = { id: e.id, status: e.status, conclusion: e.conclusion, created_at: e.created_at, pacote: null };
    if (e.conclusion === 'success' && boas++ < 8) {
      const { artifacts = [] } = await gh(`actions/runs/${e.id}/artifacts`);
      const a = artifacts.find(k => k.name.startsWith('copia-'));
      if (a) x.pacote = { nome: a.name, bytes: a.size_in_bytes, expirado: a.expired };
    }
    execucoes.push(x);
  }
  const b = avaliarBackup(execucoes, agora);
  problemas.push(...b.problemas); avisos.push(...b.avisos);
  saude.backup = { ultima: b.ultima ? b.ultima.created_at : null, nome: b.ultima?.pacote?.nome || '', bytes: b.ultima?.pacote?.bytes || 0, problemas: b.problemas };
  md.push('### Cópia de segurança', b.ultima
    ? `Última que deu certo: ${hora(new Date(b.ultima.created_at))} (execução \`${b.ultima.id}\`${b.ultima.pacote ? `, ${b.ultima.pacote.nome}, ${(b.ultima.pacote.bytes / 1048576).toFixed(1).replace('.', ',')} MB` : ''}).`
    : 'Nenhuma cópia encontrada.', '');
} catch (e) {
  problemas.push('Não deu para conferir a cópia de segurança: ' + e.message);
  saude.backup.problemas = ['Não deu para conferir a cópia de segurança.'];
}

// ---------- 1b) ensaio de restauração e cópia mensal (só para a tela; não fazem o alarme falhar: têm e-mail próprio) ----------
try {
  saude.ensaio = ultimaRotina((await gh('actions/workflows/ensaio-restauracao.yml/runs?per_page=5')).workflow_runs || []);
  saude.mensal = ultimaRotina((await gh('actions/workflows/copia-mensal.yml/runs?per_page=5')).workflow_runs || []) || {};
  const abertos = await gh('issues?state=open&per_page=50');
  saude.mensal.pendentes = abertos.filter(i => !i.pull_request && /^Guardar a cópia mensal/.test(i.title || '')).length;
} catch (e) {
  avisos.push('Não deu para ler o ensaio de restauração e a cópia mensal: ' + e.message);
}

// ---------- 2) cota grátis (Cloud Monitoring) ----------
// Métricas do Firestore no Google; tenta o nome mais novo e, sem dados, o antigo.
const METRICAS = {
  leituras: ['document/read_ops_count', 'document/read_count'],
  gravacoes: ['document/write_ops_count', 'document/write_count'],
  exclusoes: ['document/delete_ops_count', 'document/delete_count']
};
async function somar(token, projeto, metrica, ini, fim) {
  const seg = Math.max(60, Math.ceil((fim - ini) / 1000));
  const q = new URLSearchParams({
    filter: `metric.type="firestore.googleapis.com/${metrica}"`,
    'interval.startTime': ini.toISOString(), 'interval.endTime': fim.toISOString(),
    'aggregation.alignmentPeriod': seg + 's', 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM'
  });
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${projeto}/timeSeries?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new Error(j.error?.message || `Google respondeu ${r.status}`); err.status = r.status; throw err; }
  const series = j.timeSeries || [];
  if (!series.length) return null;
  return series.reduce((t, s) => t + s.points.reduce((u, p) => u + Number(p.value.int64Value ?? p.value.doubleValue ?? 0), 0), 0);
}
const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!sa) avisos.push('Sem a chave de serviço: o uso da cota não foi conferido.');
else {
  try {
    const cred = JSON.parse(sa);
    const { cert } = await import('firebase-admin/app');
    const { access_token: token } = await cert(cred).getAccessToken();
    const hoje = inicioDiaCota(agora);
    const ontem = inicioDiaCota(new Date(hoje.getTime() - 3600e3));
    const dias = [['Hoje (até agora)', hoje, agora], ['Ontem (dia inteiro)', ontem, hoje]];
    const tabela = [];
    for (const [rotulo, ini, fim] of dias) {
      const usos = {};
      for (const [k, nomes] of Object.entries(METRICAS)) {
        usos[k] = null;
        for (const m of nomes) { const v = await somar(token, cred.project_id, m, ini, fim); if (v != null) { usos[k] = v; break; } }
        if (usos[k] == null) usos[k] = 0; // sem nenhum dado no período = nada usado
      }
      const c = avaliarCota(usos, rotulo);
      problemas.push(...c.problemas);
      saude.cota.dias.push({ rotulo, ...usos });
      tabela.push(`| ${rotulo} | ${c.linhas.map(l => `${l.n.toLocaleString('pt-BR')} (${Math.round(l.pct * 100)}%)`).join(' | ')} |`);
    }
    saude.cota.lida = true;
    md.push('### Uso da cota grátis do Firestore', `Dia da cota começa ~${hoje.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' })} de Brasília. Alarme acima de ${LIMITE * 100}%.`, '',
      '| Dia | Leituras | Gravações | Exclusões |', '|---|---|---|---|', ...tabela, '');
  } catch (e) {
    // No plano grátis (Spark) o Google só entrega o uso com faturamento ativo: não é erro, só fica de fora.
    const semFaturamento = /billing/i.test(e.message);
    saude.cota = { lida: false, dias: [], motivo: semFaturamento ? 'plano grátis' : 'erro' };
    md.push('### Uso da cota grátis do Firestore', semFaturamento
      ? 'Não conferido: no plano grátis o Google só mostra o uso para rotinas com o faturamento ativo (plano Blaze). Vale só a parte da cópia de segurança. O uso do dia continua no console do Firebase › Firestore › Uso.'
      : 'Não conferido (ver aviso abaixo). A parte da cópia de segurança continua valendo.', '');
    if (!semFaturamento) avisos.push(`Não deu para ler o uso da cota no Google${e.status === 403 ? ' (falta permissão da conta de serviço)' : ''}: ${e.message}`);
  }
}

if (process.env.ALARME_TESTE === '1') problemas.push('Teste do alarme (pedido no Run workflow): esta falha é de propósito, para conferir que o e-mail do GitHub chega.');

// Resumo para a tela (não no teste de e-mail, para a tela não mostrar a falha de mentira).
if (process.env.ALARME_TESTE !== '1' && sa) {
  try {
    const { db, F } = await conectar();
    await db.doc('sistema/saude').set({ em: F.FieldValue.serverTimestamp(), ...saude, problemas: problemas.slice(0, 10), avisos: avisos.slice(0, 10) });
  } catch (e) { avisos.push('Não deu para gravar o resumo da Saúde do sistema: ' + e.message); }
}

for (const a of avisos) console.log('::warning::' + a);
resumo([`## Alarme do backup e da cota (${hora(agora)})`, '', ...md,
  problemas.length ? '### ❌ Problemas\n' + problemas.map(p => '- ' + p).join('\n') : '### ✅ Tudo certo',
  avisos.length ? '\n**Avisos**\n' + avisos.map(p => '- ' + p).join('\n') : ''].join('\n'));
if (problemas.length) { for (const p of problemas) console.log('::error::' + p); process.exit(1); }
