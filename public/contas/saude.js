// Saúde do sistema (Administração › Visão geral › Saúde do sistema): junta num lugar só o que mostra se o sistema
// está bem cuidado. Sem tela e sem banco: a tela (telas/config.js) passa os dados e recebe a lista pronta.
//   saude  = sistema/saude, gravado pelo Alarme do backup (GitHub, 7h30 e 18h): cópia, ensaio, cópia mensal e cota
//   uso    = sistema/uso, gravado pela cópia de segurança diária (3h): tamanho do banco e leituras da cópia
//   erros  = os últimos registros de erros/ (nucleo/erros.js)
// Cada item: { id, titulo, situacao: 'ok' | 'atencao' | 'critico' | 'info', resumo, detalhe }.

export const COTA_LEITURAS = 50000;       // leituras por dia no plano grátis (Spark)
export const BANCO_BYTES = 1024 ** 3;     // 1 GiB guardado no plano grátis
export const COPIA_MAX_H = 26;            // a cópia roda às 3h; com folga para atraso do GitHub
export const ALARME_MAX_H = 14;           // o alarme roda às 7h30 e às 18h
export const ENSAIO_MAX_D = 35;           // o ensaio roda todo dia 1º
const DIA = 864e5;

const data = v => (v && typeof v.toDate === 'function' ? v.toDate() : v instanceof Date ? v : typeof v === 'string' || typeof v === 'number' ? new Date(v) : null);
const valida = d => (d && !isNaN(d.getTime()) ? d : null);
export const quando = (v, agora = new Date()) => {
  const d = valida(data(v));
  if (!d) return '—';
  const h = (agora - d) / 36e5;
  if (h < 1) return 'há menos de 1 hora';
  if (h < 24) return `há ${Math.floor(h)} hora${Math.floor(h) > 1 ? 's' : ''}`;
  const dias = Math.floor(h / 24);
  return `há ${dias} dia${dias > 1 ? 's' : ''}`;
};
const pct = (n, total) => Math.round((n / total) * 100);

// Erros dos últimos 7 dias, agrupados pela mensagem (o mais repetido primeiro).
export function errosDaSemana(erros = [], agora = new Date()) {
  const desde = agora.getTime() - 7 * DIA;
  const da = (erros || []).filter(e => { const d = valida(data(e.quando)); return d && d.getTime() >= desde; });
  const grupos = new Map();
  for (const e of da) {
    const k = e.msg || '(sem mensagem)';
    const g = grupos.get(k) || { msg: k, vezes: 0, pessoas: new Set(), telas: new Set(), ultimo: null };
    g.vezes += e.vezes || 1; if (e.uid) g.pessoas.add(e.uid); if (e.tela) g.telas.add(e.tela);
    const d = data(e.quando); if (!g.ultimo || d > g.ultimo) g.ultimo = d;
    grupos.set(k, g);
  }
  const lista = [...grupos.values()].map(g => ({ ...g, pessoas: g.pessoas.size, telas: [...g.telas] })).sort((a, b) => b.vezes - a.vezes);
  return { registros: da.length, vezes: lista.reduce((n, g) => n + g.vezes, 0), pessoas: new Set(da.map(e => e.uid).filter(Boolean)).size, grupos: lista };
}

export function saudeDoSistema({ saude = null, uso = null, erros = [], agora = new Date() } = {}) {
  const itens = [];
  const s = saude || {};

  // 1) Cópia de segurança diária: vale o que o alarme viu no GitHub; sem ele, a medição gravada pela própria cópia.
  const b = s.backup || {};
  const ultCopia = valida(data(b.ultima)) || valida(data(uso && uso.em));
  const hCopia = ultCopia ? (agora - ultCopia) / 36e5 : Infinity;
  const tam = b.bytes ? ` · ${(b.bytes / 1048576).toFixed(1).replace('.', ',')} MB` : '';
  itens.push({
    id: 'copia', titulo: 'Cópia de segurança',
    situacao: !ultCopia ? 'atencao' : (b.problemas || []).length || hCopia > COPIA_MAX_H ? 'critico' : 'ok',
    resumo: ultCopia ? `Última que deu certo ${quando(ultCopia, agora)}${tam}` : 'Ainda sem notícia da cópia',
    detalhe: (b.problemas || []).length ? b.problemas.join(' ') : hCopia > COPIA_MAX_H ? 'A cópia de hoje faltou. Veja GitHub › Actions › Cópia de segurança.' : 'Roda todo dia às 3h e fica guardada 30 dias (a de domingo, 90).'
  });

  // 2) Ensaio de restauração (todo dia 1º): prova que a cópia volta inteira.
  const en = s.ensaio || {};
  const ultEnsaio = valida(data(en.ultima));
  itens.push({
    id: 'ensaio', titulo: 'Ensaio de restauração',
    situacao: !ultEnsaio ? 'atencao' : en.ok === false ? 'critico' : (agora - ultEnsaio) / DIA > ENSAIO_MAX_D ? 'atencao' : 'ok',
    resumo: ultEnsaio ? `${en.ok === false ? 'Falhou' : 'Deu certo'} ${quando(ultEnsaio, agora)}` : 'Ainda sem ensaio registrado',
    detalhe: en.ok === false ? 'A cópia não voltou inteira no teste. Veja GitHub › Actions › Ensaio de restauração da cópia.' : 'Todo dia 1º a cópia é restaurada num banco de teste e conferida documento por documento.'
  });

  // 3) Cópia mensal fora do GitHub: o aviso (Issue) fica aberto até o Eduardo guardar no Drive e fechar.
  const me = s.mensal || {};
  const pend = me.pendentes || 0;
  itens.push({
    id: 'mensal', titulo: 'Cópia do mês fora do GitHub',
    situacao: me.ok === false ? 'critico' : pend ? 'atencao' : valida(data(me.ultima)) ? 'ok' : 'info',
    resumo: pend ? `${pend} cópia${pend > 1 ? 's' : ''} esperando ser guardada${pend > 1 ? 's' : ''} no Drive` : valida(data(me.ultima)) ? `Pacote do mês feito ${quando(me.ultima, agora)}` : 'Sem pacote registrado ainda',
    detalhe: pend ? 'Abra o aviso no GitHub (Issues), baixe o pacote, guarde no Drive e feche o aviso.' : 'Todo dia 1º sai um pacote para guardar no Drive da empresa.'
  });

  // 4) Cota grátis do banco. No plano grátis o Google não deixa as rotinas lerem o uso do dia; mostra o que dá.
  const c = s.cota || {};
  const espaco = uso && uso.pacoteBytes ? Math.min(100, pct(uso.pacoteBytes * 4, BANCO_BYTES)) : null;
  const leitCopia = uso && uso.leiturasCopia ? pct(uso.leiturasCopia, COTA_LEITURAS) : null;
  if (c.lida && (c.dias || []).length) {
    const maior = Math.max(...c.dias.flatMap(d => [d.leituras / 50000, d.gravacoes / 20000, d.exclusoes / 20000].filter(Number.isFinite)));
    itens.push({
      id: 'cota', titulo: 'Cota grátis do banco', situacao: maior > 0.7 ? 'critico' : maior > 0.5 ? 'atencao' : 'ok',
      resumo: `Maior uso: ${Math.round(maior * 100)}% da cota do dia`, detalhe: 'Leituras, gravações e exclusões de hoje e de ontem, lidas no painel do Google.'
    });
  } else {
    itens.push({
      id: 'cota', titulo: 'Cota grátis do banco', situacao: espaco != null && espaco > 70 ? 'critico' : 'info',
      resumo: espaco != null ? `Espaço usado: ${espaco < 1 ? 'menos de 1' : espaco}% · a cópia diária gasta ${leitCopia < 1 ? 'menos de 1' : leitCopia}% das leituras` : 'Uso do dia não disponível no plano grátis',
      detalhe: 'O uso do dia (leituras e gravações) só pode ser lido pelas rotinas no plano pago (Blaze). Para ver hoje: console do Firebase › Firestore › Uso.'
    });
  }

  // 5) Erros nos aparelhos dos últimos 7 dias.
  const e = errosDaSemana(erros, agora);
  itens.push({
    id: 'erros', titulo: 'Erros da semana',
    situacao: !e.registros ? 'ok' : e.vezes >= 20 || e.pessoas >= 3 ? 'critico' : 'atencao',
    resumo: e.registros ? `${e.grupos.length} erro${e.grupos.length > 1 ? 's' : ''} diferente${e.grupos.length > 1 ? 's' : ''} · ${e.vezes} vez${e.vezes > 1 ? 'es' : ''} · ${e.pessoas} pessoa${e.pessoas > 1 ? 's' : ''}` : 'Nenhum erro nos últimos 7 dias',
    detalhe: e.registros ? 'Mostre a lista ao Claude para corrigir. Depois de corrigido, apague em Erros nos aparelhos.' : 'Nenhuma tela falhou nos celulares e computadores de quem usa.'
  });

  // 6) O próprio alarme: se ele parou de rodar, as informações acima ficam velhas.
  const ultAlarme = valida(data(s.em));
  itens.push({
    id: 'alarme', titulo: 'Alarme do backup',
    situacao: !ultAlarme ? 'atencao' : (agora - ultAlarme) / 36e5 > ALARME_MAX_H ? 'atencao' : (s.problemas || []).length ? 'critico' : 'ok',
    resumo: ultAlarme ? `Conferiu ${quando(ultAlarme, agora)}${(s.problemas || []).length ? ' e achou problema' : ''}` : 'Ainda não conferiu',
    detalhe: (s.problemas || []).length ? s.problemas.join(' ') : !ultAlarme || (agora - ultAlarme) / 36e5 > ALARME_MAX_H ? 'O alarme roda às 7h30 e às 18h. Se parou, veja GitHub › Actions › Alarme do backup e da cota.' : 'Confere às 7h30 e às 18h e manda e-mail se algo der errado.'
  });

  const ordem = { critico: 0, atencao: 1, info: 2, ok: 3 };
  const pior = itens.reduce((p, i) => (ordem[i.situacao] < ordem[p] ? i.situacao : p), 'ok');
  return { itens, geral: pior === 'info' ? 'ok' : pior, erros: e, espaco };
}
