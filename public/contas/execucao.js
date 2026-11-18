// Dikma Gestão — EXECUÇÃO POR LOCAL/EQUIPAMENTO: contas sem tela (as mesmas no navegador e nos testes do Node).
// O líder aponta por local: abre o local, marca no checklist o que foi feito e o que não foi, e junta as fotos do local.
//
// Métrica (a mesma em todo o sistema, igual à "Eficiência até hoje" dos Indicadores):
//   Execução = atividades feitas ÷ atividades previstas.
//   - Prevista: programada no dia (inclui a incluída fora da programação). Feriado e dispensada não entram.
//   - Feita (R) conta 1. Não feita (N, com justificativa) e ainda sem apontamento (P) contam 0.
//   - Extra antiga (E) não entra na conta (registro de antes da "fora da programação").
//   Apontamento = (feitas + não feitas) ÷ previstas: mostra se o checklist foi preenchido.
// Faixas de cor: 90% ou mais = ok (verde) · 70% a 89% = atenção (âmbar) · abaixo de 70% = crítico (vermelho).

export const FAIXA_OK = 90, FAIXA_ATENCAO = 70;
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

// Faixa de uma porcentagem.
export const faixa = p => (p == null ? '' : p >= FAIXA_OK ? 'ok' : p >= FAIXA_ATENCAO ? 'atencao' : 'critico');

// Situações do local (ou da rota) num dia.
export const SITUACAO = Object.freeze({
  vazio: { t: 'Sem programação', c: 'neu' },
  afazer: { t: 'A fazer', c: 'neu' },
  atrasado: { t: 'Atrasado', c: 'warn' },
  andamento: { t: 'Em andamento', c: 'neu' },
  concluido: { t: 'Concluído', c: 'ok' },
  fechado: { t: 'Concluído com não feitas', c: 'bad' }
});

// Resumo de um grupo de células (as situações gravadas: R, N, P, E ou '_') num dia.
// passou = o dia já passou (o que ficou sem apontamento está atrasado).
export function resumoExec(codigos, passou = false) {
  let prev = 0, feitas = 0, nao = 0, pend = 0;
  for (const c of codigos) {
    if (c === 'R') { prev++; feitas++; } else if (c === 'N') { prev++; nao++; } else if (c === 'P') { prev++; pend++; }
  }
  const situ = !prev ? 'vazio' : pend === prev ? (passou ? 'atrasado' : 'afazer') : pend ? 'andamento' : nao ? 'fechado' : 'concluido';
  const p = prev ? pct(feitas, prev) : null;
  return { prev, feitas, nao, pend, pct: p, apont: prev ? pct(feitas + nao, prev) : null, situ, faixa: faixa(p) };
}

// Agrupa as atividades por local/equipamento, na ordem em que aparecem no plano.
// itens: [{ local, ... }] · devolve [{ local, itens: [...] }]. Local em branco vira "Sem local".
export function agruparLocais(itens) {
  const mapa = new Map();
  for (const x of itens) {
    const nome = String(x.local || '').trim() || 'Sem local';
    const chave = nome.toUpperCase();
    if (!mapa.has(chave)) mapa.set(chave, { local: nome, itens: [] });
    mapa.get(chave).itens.push(x);
  }
  return [...mapa.values()];
}
// Mesmo local? (sem diferença de maiúsculas e espaços nas pontas)
export const mesmoLocal = (a, b) => (String(a || '').trim() || 'Sem local').toUpperCase() === (String(b || '').trim() || 'Sem local').toUpperCase();

// Execução por local num período, para os Indicadores. Conta só os dias até hoje (o futuro não pesa).
// semanas: lista de documentos de semana ({ ini, area, ids, d }) · plano(pid) -> { rota, local } ou null
// dias(doc) -> as 7 datas AAAA-MM-DD · filtro: { de, ate } (inclusive, opcionais) · devolve a lista ordenada
// da pior execução para a melhor (empate: mais previstas primeiro).
export function execPorLocal(semanas, plano, dias, hoje, { de = '0000-00-00', ate = '9999-99-99' } = {}) {
  const mapa = new Map();
  for (const doc of semanas) {
    const ds = dias(doc);
    for (let i = 0; i < doc.ids.length; i++) {
      const p = plano(doc.ids[i]); if (!p) continue;
      const str = doc.d[i];
      for (let k = 0; k < 7; k++) {
        const dt = ds[k]; if (dt > hoje || dt < de || dt > ate) continue;
        const c = str[k]; if (c !== 'R' && c !== 'N' && c !== 'P') continue;
        const local = String(p.local || '').trim() || 'Sem local';
        const ch = `${doc.area}|${p.rota}|${local.toUpperCase()}`;
        if (!mapa.has(ch)) mapa.set(ch, { area: doc.area, rota: p.rota, local, prev: 0, feitas: 0, nao: 0, pend: 0 });
        const x = mapa.get(ch); x.prev++;
        if (c === 'R') x.feitas++; else if (c === 'N') x.nao++; else x.pend++;
      }
    }
  }
  return [...mapa.values()].map(x => ({ ...x, pct: pct(x.feitas, x.prev), faixa: faixa(pct(x.feitas, x.prev)) }))
    .sort((a, b) => a.pct - b.pct || b.prev - a.prev || a.local.localeCompare(b.local));
}

// Fotos do local: o maior número de fotos entre as atividades do local no dia (a foto do local vale para todas).
export const fotosDoLocal = (contagens) => contagens.reduce((m, n) => Math.max(m, n || 0), 0);
