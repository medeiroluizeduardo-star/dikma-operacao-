// Trocar o líder: diagnostica e corrige o nome do líder gravado nas fichas, na folha de frequência e nas ocorrências.
// A conta é a mesma da tela Gestão › Fichas › Líderes (public/contas/lideres.js).
//   --de "NOME"      líder que sai (aceita parte do nome, sem acento e sem diferença de maiúsculas)
//   --para "NOME"    líder que entra (se casar com um líder que já existe, usa a grafia dele)
//   --simular        (padrão) só lê e mostra no resumo da execução TODOS os líderes encontrados (fichas, grupos da folha
//                    da competência atual e das futuras, ocorrências abertas, cadastro da Operação), com quantas
//                    pessoas cada um tem, e o que mudaria. Sem --de, só a lista.
//   --gravar         faz a cópia dos documentos que vão mudar (arquivo da execução e coleção backups) e:
//                    - troca o líder nas fichas (gcolab);
//                    - na folha da competência atual e das futuras (freqcomp), move as pessoas do grupo do líder antigo
//                      para o grupo do líder novo (cria se não existir; a SUPERVISÃO do destino fica) e apaga o grupo antigo;
//                    - nas ocorrências ABERTAS (aguardando assinatura), troca "Responsável Dikma" e "recolhe" quando são o líder antigo.
//                    Não mexe em competências passadas nem em ocorrências já assinadas ou recusadas.
//   --arquivo X      lê de um arquivo em vez do banco: JSON no formato do banco ({ gcolab: {ÁREA: {itens}}, freqcomp: {id: {grupos}},
//                    gocorr: {id: {...}}, eq: {cadastro}, integracao: {senior}, usuarios: {uid: {...}} }) ou uma pasta com as
//                    planilhas convertidas (dados-importacao/ ou public/demo/). Com --gravar, precisa de --saida Y.json.
//   Também por variáveis (workflow): LIDER_DE, LIDER_PARA, LIDER_MODO=simular|gravar. HOJE=AAAA-MM-DD só para testes.
// O resumo tem nomes: o repositório é privado e só o administrador vê as execuções.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, raiz, resumo, codificar, gravarGz, tamanho } from './comum.mjs';

const args = process.argv.slice(2);
const arg = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
const DE = (arg('--de') ?? process.env.LIDER_DE ?? '').trim();
const PARA = (arg('--para') ?? process.env.LIDER_PARA ?? '').trim();
const gravar = args.includes('--gravar') || (!args.includes('--simular') && process.env.LIDER_MODO === 'gravar');
const arquivo = arg('--arquivo'), saida = arg('--saida');
const erro = m => { resumo(`::error::${m}`); process.exitCode = 1; };
if (gravar && (!DE || !PARA)) { erro('Para gravar, informe o líder que sai (de) e o que entra (para).'); process.exit(1); }
if (gravar && arquivo && !saida) { erro('--gravar com --arquivo precisa de --saida (arquivo onde fica o resultado).'); process.exit(1); }

// As contas ficam em public/ (são as mesmas do site). Copia como .mjs para o Node, seguindo os imports.
const lib = path.join(path.dirname(new URL(import.meta.url).pathname), 'lib');
fs.mkdirSync(lib, { recursive: true });
{
  const fila = ['lideres', 'planilhas-adm'], feitos = new Set();
  while (fila.length) {
    const f = fila.shift(); if (feitos.has(f)) continue; feitos.add(f);
    const src = fs.readFileSync(path.join(raiz, 'public', 'contas', f + '.js'), 'utf8');
    for (const m of src.matchAll(/from '\.\/([\w-]+)\.js'/g)) fila.push(m[1]);
    fs.writeFileSync(path.join(lib, f + '.mjs'), src.replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'"));
  }
}
const { casaParte, mesmoComeco, nomeLider, chaveLider, trocarNasFichas, moverNaFolha } = await import('./lib/lideres.mjs');
const { partesGrupo, competenciaDe, prepararImportacao, normNome } = await import('./lib/planilhas-adm.mjs');

const HOJE = process.env.HOJE || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const ATUAL = competenciaDe(HOJE);
const compDe = id => String(id).split('|')[1] || '';

// ---------- leitura ----------
// Dados no formato do banco, montados a partir das planilhas convertidas (o que o sistema grava ao importar).
function daPasta(pasta) {
  const ler = n => { for (const p of [n, n.replace(/^seed/, 'exemplo')]) { const f = path.join(pasta, p); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } return null; };
  const ge = ler('seed-gestao.json') || { colabs: [], ocorrencias: [] }, ef = ler('seed-efetivo.json'), eq = ler('seed-equip.json');
  // fichas + lista do RH (como em Importar › Planilha EFETIVO: atualiza o líder de quem tem ficha e cadastra quem falta)
  const porMat = new Map(ge.colabs.map(c => [String(c.mat), { ...c }]));
  if (ef) {
    const ix = n => ef.colunas.findIndex(c => normNome(c) === n);
    const [cm, cn, cf, cl] = ['MATRICULA', 'NOME', 'FUNCAO', 'LIDER'].map(ix);
    for (const l of ef.linhas) {
      const mat = String(l[cm] || ''); if (!mat) continue;
      const c = porMat.get(mat) || { mat, nome: String(l[cn] || '').toUpperCase(), area: 'GERAL', funcao: '', turma: '', lider: '', adm: null, dem: null };
      if (l[cf] && !c.funcao) c.funcao = String(l[cf]).toUpperCase();
      if (l[cl]) c.lider = String(l[cl]).toUpperCase();
      porMat.set(mat, c);
    }
  }
  const fichas = [...porMat.values()];
  const freq = {}; for (const k of ['patio', 'bateria']) { const f = ler(`seed-freq-${k}.json`); if (f) freq[k] = f; }
  const prep = prepararImportacao({ freq, rh: fichas });
  return {
    gcolab: { TODAS: { itens: fichas } },
    freqcomp: Object.fromEntries(prep.comps.map(c => [`${c.conj}|${c.competencia}`, { grupos: c.grupos }])),
    gocorr: Object.fromEntries((ge.ocorrencias || []).map((o, i) => [`oc${i}`, o])),
    eq: { cadastro: eq ? { operadores: eq.operadores || [] } : null }, integracao: {}, usuarios: {}
  };
}
let db = null, F = null, base = null;
if (arquivo) {
  const p = path.resolve(arquivo);
  base = fs.statSync(p).isDirectory() ? daPasta(p) : JSON.parse(fs.readFileSync(p, 'utf8'));
} else {
  ({ db, F } = await conectar());
  const col = async c => Object.fromEntries((await db.collection(c).get()).docs.map(d => [d.id, d.data()]));
  const um = async p => { const d = await db.doc(p).get(); return d.exists ? d.data() : null; };
  // folha: só lê a competência atual e as futuras (ids "conjunto|AAAA-MM"); das passadas só conta quantas há
  const fc = await db.collection('freqcomp').get();
  base = {
    gcolab: await col('gcolab'),
    freqcomp: Object.fromEntries(fc.docs.map(d => [d.id, compDe(d.id) >= ATUAL ? d.data() : { passada: true, grupos: d.data().grupos || [] }])),
    gocorr: await col('gocorr'),
    eq: { cadastro: await um('eq/cadastro') }, integracao: { senior: await um('integracao/senior') },
    usuarios: Object.fromEntries((await db.collection('usuarios').get()).docs.map(d => [d.id, { nome: d.get('nome') || '', papel: d.get('papel') || '', acesso: d.get('acesso') || null }]))
  };
}
const gcolab = base.gcolab || {}, freqcomp = base.freqcomp || {}, gocorr = base.gocorr || {};
const aberta = o => o.status === 'pendente';
const atuais = Object.keys(freqcomp).filter(id => compDe(id) >= ATUAL).sort();
const passadas = Object.keys(freqcomp).filter(id => compDe(id) < ATUAL);

// ---------- todos os líderes (uma linha por grafia) ----------
const T = new Map();
const linha = n => { const k = chaveLider(n); if (!k) return null; if (!T.has(k)) T.set(k, { nome: nomeLider(n), fichas: 0, desl: 0, folha: {}, oc: 0, op: 0 }); return T.get(k); };
for (const d of Object.values(gcolab)) for (const c of d.itens || []) { const x = linha(c.lider); if (!x) continue; if (!c.dem || c.dem > HOJE) x.fichas++; else x.desl++; }
for (const id of atuais) for (const g of freqcomp[id].grupos || []) { const pt = partesGrupo(g.nome); const x = pt && linha(pt.lider); if (x) x.folha[id] = (x.folha[id] || 0) + (g.pessoas || []).length; }
for (const o of Object.values(gocorr)) if (aberta(o)) { const vistos = new Set(); for (const n of [o.lider, o.recolhe]) { const x = linha(n); if (x && !vistos.has(x)) { x.oc++; vistos.add(x); } } }
// Cadastro da Operação (eq/cadastro): hoje não tem campo de líder; se um dia tiver, entra aqui.
const ops = ((base.eq || {}).cadastro || {}).operadores || [];
const campoOp = ops.length ? [...new Set(ops.flatMap(o => Object.keys(o)).filter(k => /^l[ií]der/i.test(k)))] : [];
for (const o of ops) for (const k of campoOp) { const x = linha(o[k]); if (x) x.op++; }

// ---------- o que muda ----------
const cel = t => String(t ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const casaDe = n => !!DE && casaParte(DE, n);
const nomesTodos = [...T.values()].map(x => x.nome);
const deAchados = nomesTodos.filter(casaDe);
const compativeis = l => l.every(a => l.every(b => mesmoComeco(a, b)));
const avisos = [], notas = [];
let paraNome = PARA ? nomeLider(PARA) : '';
if (PARA) {
  const cands = nomesTodos.filter(n => casaParte(PARA, n) && !casaDe(n));
  if (cands.length && compativeis(cands)) {
    // grafia mais usada nas fichas entre os jeitos de escrever o líder novo (a folha usa o grupo que já existe)
    const nasFichas = cands.map(n => [n, T.get(chaveLider(n)).fichas]).sort((a, b) => b[1] - a[1]);
    paraNome = nasFichas[0][1] ? nasFichas[0][0] : cands.sort((a, b) => b.length - a.length)[0];
  } else if (cands.length) avisos.push(`"${PARA}" casa com mais de um líder (${cands.join(', ')}). Escreva o nome mais completo.`);
  if (casaDe(paraNome)) avisos.push(`O líder novo (${paraNome}) também casa com "${DE}". Escreva os dois nomes de forma que não se confundam.`);
}
if (DE && !deAchados.length) notas.push(`Nenhum líder casa com "${DE}".`);
if (deAchados.length > 1 && !compativeis(deAchados)) avisos.push(`"${DE}" casa com líderes diferentes (${deAchados.join(', ')}). Escreva o nome mais completo para trocar um só.`);

let mudFichas = [], novasFichas = {}, mudFolha = [], novasFolhas = {}, mudOc = [];
if (DE && paraNome) {
  for (const [area, d] of Object.entries(gcolab)) {
    const r = trocarNasFichas(d.itens || [], casaDe, paraNome);
    if (r.mudou.length) { novasFichas[area] = r.itens; mudFichas.push(...r.mudou.map(m => ({ ...m, area }))); }
  }
  for (const id of atuais) {
    const r = moverNaFolha(freqcomp[id].grupos || [], casaDe, paraNome);
    if (r.mudou) { novasFolhas[id] = r.grupos; mudFolha.push(...r.acoes.map(a => ({ ...a, id }))); }
  }
  for (const [id, o] of Object.entries(gocorr)) {
    if (!aberta(o)) continue;
    const p = {}; if (o.lider && casaDe(o.lider)) p.lider = paraNome; if (o.recolhe && casaDe(o.recolhe)) p.recolhe = paraNome;
    if (Object.keys(p).length) mudOc.push({ id, o, p });
  }
}
const ocFechadas = DE ? Object.values(gocorr).filter(o => !aberta(o) && [o.lider, o.recolhe].some(n => n && casaDe(n))).length : 0;
const gruposPassados = DE ? passadas.reduce((n, id) => n + (freqcomp[id].grupos || []).filter(g => { const pt = partesGrupo(g.nome); return pt && casaDe(pt.lider); }).length, 0) : 0;
// Ponte com o Senior: se a lista do RH trouxer o líder antigo, a próxima aplicação devolve o nome antigo às fichas.
const senior = ((base.integracao || {}).senior || {}).registros || [];
const noSenior = DE ? senior.filter(r => r.lider && casaDe(r.lider)).length : 0;
const usuariosDe = DE ? Object.values(base.usuarios || {}).filter(u => u.nome && casaDe(u.nome)) : [];

// ---------- resumo ----------
const ehDe = n => casaDe(n), ehPara = n => paraNome && chaveLider(n) !== '' && !casaDe(n) && (chaveLider(n) === chaveLider(paraNome) || mesmoComeco(n, paraNome));
const folhaTxt = f => Object.entries(f).map(([id, n]) => `${id.replace('patio', 'Pátio').replace('bateria', 'Bateria')}: ${n}`).join(', ');
const lista = [...T.values()].sort((a, b) => a.nome.localeCompare(b.nome));
const md = [
  `### Trocar líder · ${gravar ? 'GRAVAR' : 'simulação (nada foi gravado)'}`,
  `${arquivo ? `Lido de ${path.basename(path.resolve(arquivo))}. ` : ''}Hoje: ${HOJE.split('-').reverse().join('/')} · competência atual ${ATUAL}${atuais.length ? ` · folhas lidas: ${atuais.join(', ')}` : ' · nenhuma folha da competência atual ou futura'}.`,
  DE ? `**Sai:** ${cel(DE)} → casa com ${deAchados.length ? deAchados.map(n => `**${cel(n)}**`).join(', ') : 'ninguém'} · **Entra:** ${paraNome ? `**${cel(paraNome)}**${PARA && nomeLider(PARA) !== paraNome ? ` (grafia que já existe para "${cel(PARA)}")` : ''}` : '(informe --para)'}` : 'Sem --de: só a lista de líderes.',
  '',
  `#### Todos os líderes encontrados (${lista.length})`,
  '| Líder | Fichas (ativas) | Grupos da folha (pessoas) | Ocorrências abertas | Operação |', '|---|---|---|---|---|',
  ...lista.map(x => `| ${ehDe(x.nome) ? '⟵ ' : ehPara(x.nome) ? '⟶ ' : ''}${cel(x.nome)} | ${x.fichas}${x.desl ? ` (+${x.desl} desligado${x.desl > 1 ? 's' : ''})` : ''} | ${cel(folhaTxt(x.folha)) || '—'} | ${x.oc || '—'} | ${x.op || '—'} |`),
  '',
  `Cadastro da Operação (eq/cadastro): ${ops.length} operadores, ${campoOp.length ? `campo de líder: ${campoOp.join(', ')}` : 'sem campo de líder (nada a trocar lá)'}.`,
  ''
];
if (DE) {
  md.push('#### O que muda',
    `**Fichas:** ${mudFichas.length} pessoa(s) passam para ${cel(paraNome)}.`,
    ...mudFichas.slice(0, 300).map(m => `- ${cel(m.nome)} (${cel(m.mat)}) · ${cel(m.area)} · era "${cel(m.antes)}"`),
    mudFichas.length > 300 ? `- e mais ${mudFichas.length - 300}` : null,
    `**Folha (competência atual e futuras):** ${mudFolha.length ? `${mudFolha.length} grupo(s)` : 'nenhum grupo do líder antigo.'}`,
    ...mudFolha.map(a => `- ${a.id}: "${cel(a.de)}" → "${cel(a.para)}"${a.criado ? ' (grupo novo)' : ''} · ${a.pessoas.length} pessoa(s): ${cel(a.pessoas.join(', '))}. O grupo antigo é apagado.`),
    `**Ocorrências abertas:** ${mudOc.length}${mudOc.length ? ':' : '.'}`,
    ...mudOc.map(x => `- ${cel(x.o.data)} · ${cel(x.o.nome)} · ${cel(x.o.tipo)} · ${Object.entries(x.p).map(([k, v]) => `${k === 'lider' ? 'responsável' : 'recolhe'}: ${cel(x.o[k])} → ${cel(v)}`).join('; ')}`),
    `Não muda: ${ocFechadas} ocorrência(s) já assinadas/recusadas e ${gruposPassados} grupo(s) em ${passadas.length} folha(s) de competências passadas.`,
    noSenior ? `⚠ A ponte com o Senior tem ${noSenior} pessoa(s) com o líder "${cel(DE)}": se a lista for aplicada de novo, o nome antigo volta às fichas. Corrija no Senior/planilha do RH.` : null,
    usuariosDe.length ? `Usuários do sistema com esse nome: ${usuariosDe.map(u => `${cel(u.nome)} (${cel(u.papel)})`).join(', ')}.` : null,
    '');
}
if (avisos.length || notas.length) md.push('#### Avisos', ...[...notas, ...avisos].map(a => `- ${a}`), '');
const bloqueia = avisos.length > 0;

if (!gravar) {
  if (DE) md.push(bloqueia ? 'Corrija os avisos antes de gravar.' : 'Para gravar: Actions › **Trocar líder** › Run workflow, com os mesmos nomes e o modo **gravar**.');
  resumo(md.filter(l => l != null).join('\n'));
  process.exit(0);
}
if (bloqueia) { resumo(md.filter(l => l != null).join('\n')); erro('Nada foi gravado: corrija os avisos acima.'); process.exit(1); }
if (!mudFichas.length && !mudFolha.length && !mudOc.length) { resumo([...md, 'Nada a mudar.'].filter(l => l != null).join('\n')); process.exit(0); }

// ---------- gravar ----------
if (arquivo) {
  const out = JSON.parse(JSON.stringify(base));
  for (const [a, itens] of Object.entries(novasFichas)) out.gcolab[a] = { ...out.gcolab[a], itens };
  for (const [id, grupos] of Object.entries(novasFolhas)) out.freqcomp[id] = { ...out.freqcomp[id], grupos };
  for (const x of mudOc) out.gocorr[x.id] = { ...out.gocorr[x.id], ...x.p };
  fs.writeFileSync(path.resolve(saida), JSON.stringify(out, null, 1));
  resumo([...md, `**Gravado no arquivo** ${path.basename(saida)}.`].filter(l => l != null).join('\n'));
  process.exit(0);
}
// cópia de segurança dos documentos que vão mudar, antes de gravar
const refs = [...Object.keys(novasFichas).map(a => db.doc(`gcolab/${a}`)), ...Object.keys(novasFolhas).map(id => db.doc(`freqcomp/${id}`)), ...mudOc.map(x => db.doc(`gocorr/${x.id}`))];
const copia = {};
for (const r of refs) { const d = await r.get(); if (d.exists) copia[r.path] = codificar(d.data(), F); }
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-lider');
fs.mkdirSync(pasta, { recursive: true });
const quando = new Date().toISOString(); const marca = quando.slice(0, 19).replace(/[:T]/g, '-');
const arqCopia = path.join(pasta, `antes-trocar-lider-${marca}.json.gz`);
gravarGz(arqCopia, { em: quando, de: DE, para: paraNome, docs: copia });
let ondeCopia = `arquivo ${path.basename(arqCopia)} (${tamanho(fs.statSync(arqCopia).size)}) guardado nesta execução`;
const json = JSON.stringify(copia);
if (json.length < 900000) {
  const id = 'antes-trocar-lider-' + marca;
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: `antes de trocar o líder ${DE} por ${paraNome}`, n: Object.keys(copia).length, json });
  ondeCopia += ` e no banco em backups/${id}`;
} else console.log('::warning::Cópia grande demais para um documento do banco; fica só o arquivo da execução.');

// Grava numa transação: lê de novo cada documento e refaz a conta (se alguém mexeu enquanto a rotina rodava, vale o atual).
const feito = await db.runTransaction(async t => {
  const ds = await Promise.all(refs.map(r => t.get(r)));
  const n = { fichas: 0, grupos: 0, oc: 0 };
  for (const d of ds) {
    if (!d.exists) continue;
    const [col] = d.ref.path.split('/');
    if (col === 'gcolab') { const r = trocarNasFichas(d.get('itens') || [], casaDe, paraNome); if (r.mudou.length) { t.update(d.ref, { itens: r.itens }); n.fichas += r.mudou.length; } }
    else if (col === 'freqcomp') { const r = moverNaFolha(d.get('grupos') || [], casaDe, paraNome); if (r.mudou) { t.update(d.ref, { grupos: r.grupos, atualizadoEm: F.FieldValue.serverTimestamp(), atualizadoPor: 'rotina trocar-lider' }); n.grupos += r.acoes.length; } }
    else if (col === 'gocorr') { const o = d.data(); if (!aberta(o)) continue; const p = {}; if (o.lider && casaDe(o.lider)) p.lider = paraNome; if (o.recolhe && casaDe(o.recolhe)) p.recolhe = paraNome; if (Object.keys(p).length) { t.update(d.ref, p); n.oc++; } }
  }
  return n;
});
// histórico do sistema (aparece em Administração › Histórico)
await db.collection('historico').add({ at: F.FieldValue.serverTimestamp(), uid: 'rotina', nome: 'Rotina do GitHub', t: `Trocou o líder ${deAchados.join(' / ')} por ${paraNome}: ${feito.fichas} ficha(s), ${feito.grupos} grupo(s) da folha, ${feito.oc} ocorrência(s) aberta(s)` });
resumo([...md, `**Gravado:** ${feito.fichas} ficha(s), ${feito.grupos} grupo(s) da folha movido(s), ${feito.oc} ocorrência(s) aberta(s).`, `**Cópia antes de gravar:** ${ondeCopia}.`].filter(l => l != null).join('\n'));
