// Mover a Sinter: as pessoas da área SINTER, que ficavam no Pátio, passam para o conjunto Sinter (coleções s_).
// O que muda está em mover-sinter-conta.mjs. Só manual (Actions › Mover a Sinter › Run workflow).
//   SINTER_MODO=simular (padrão): só lê e mostra no resumo da execução o que mudaria.
//   SINTER_MODO=gravar: guarda uma cópia dos documentos que vão mudar (arquivo da execução e coleção backups) e grava.
// Primeiro grava o destino (s_), depois tira do Pátio; as chaves da presença são apagadas uma a uma (não sobrescreve
// o que alguém lançar enquanto a rotina roda). Rodar de novo não duplica nada.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, resumo, codificar, gravarGz, tamanho } from './comum.mjs';
import { AREA, separarSituacao, separarFolha, juntarColabs, acertoUsuario } from './mover-sinter-conta.mjs';

const gravar = process.argv.includes('--gravar') || (!process.argv.includes('--simular') && process.env.SINTER_MODO === 'gravar');
const { db, F } = await conectar();
const md = ['### Mover a Sinter do Pátio para o conjunto Sinter', gravar ? '' : '_Modo simular: nada foi gravado._', ''];

// ---------- leitura ----------
const lerDoc = async p => { const d = await db.doc(p).get(); return d.exists ? d.data() : null; };
const colP = await lerDoc(`colaboradores/${AREA}`);
const colS = await lerDoc(`s_colaboradores/${AREA}`);
const pessoas = (colP && colP.itens) || [];
const ids = new Set([...pessoas, ...((colS && colS.itens) || [])].map(c => String(c.id)));
const itensS = juntarColabs(pessoas, (colS && colS.itens) || []);

const sit = (await db.collection('situacao').get()).docs.map(d => ({ id: d.id, mover: separarSituacao(d.data(), ids) })).filter(x => Object.keys(x.mover).length);
const nChaves = sit.reduce((n, x) => n + Object.values(x.mover).reduce((a, m) => a + Object.keys(m).length, 0), 0);

const efs = (await db.collection('efetivoDia').where('area', '==', AREA).get()).docs;

const folhasQs = await db.collection('freqcomp').get();
const folhasS = Object.fromEntries(folhasQs.docs.filter(d => d.id.startsWith('sinter|')).map(d => [d.id, d.data()]));
const folhas = [];
for (const d of folhasQs.docs) {
  if (!d.id.startsWith('patio|')) continue;
  const idS = 'sinter|' + d.id.slice(6);
  const r = separarFolha(d.data(), ids, folhasS[idS]);
  if (r.n) folhas.push({ id: d.id, idS, ...r });
}

const cfgP = await lerDoc('config/sistema');
const cfgS = await lerDoc('s_config/sistema');
const rotasS = ((cfgP && cfgP.rotas) || []).filter(r => r.area === AREA);
const novoCfgS = cfgS ? (rotasS.length ? { ...cfgS, rotas: [...(cfgS.rotas || []), ...rotasS.filter(r => !(cfgS.rotas || []).some(x => x.rota === r.rota))] } : null)
  : { rotas: rotasS, tipos: (cfgP && cfgP.tipos) || [], meses: [] };

const acoes = (await db.collection('acoes').where('area', '==', AREA).get()).docs;

const COM_CONJ = ['seginter', 'seganom', 'seginsp', 'segcartao', 'segfotos', 'atestados', 'atestadosFoto', 'oms', 'omsrec'];
const conjMuda = [];
for (const c of COM_CONJ) (await db.collection(c).where('area', '==', AREA).get()).forEach(d => { if (d.get('conj') === 'patio') conjMuda.push(d.ref); });
const segCfg = await lerDoc('config/seguranca');
const segAreas = segCfg && Array.isArray(segCfg.areas) && segCfg.areas.some(a => a.nome === AREA && a.conj !== 'sinter') ? segCfg.areas.map(a => (a.nome === AREA ? { ...a, conj: 'sinter' } : a)) : null;

const usuarios = (await db.collection('usuarios').get()).docs.map(d => ({ ref: d.ref, nome: d.get('nome') || d.id, p: acertoUsuario(d.data()) })).filter(x => x.p);

// Só avisos (não devia haver: a Sinter ainda não tem rotas)
const semanasS = (await db.collection('semanas').where('area', '==', AREA).get()).size;
const evidS = (await db.collection('evidencias').where('area', '==', AREA).get()).size;

md.push(
  '| O que | Quantos |', '|---|---|',
  `| Pessoas na área SINTER do Pátio | ${pessoas.length} (já na Sinter: ${(colS && colS.itens || []).length}) |`,
  `| Presença (chaves pessoa+dia) | ${nChaves} em ${sit.length} mês(es) |`,
  `| Efetivo do dia enviado | ${efs.length} |`,
  `| Folhas de frequência | ${folhas.map(f => `${f.id.slice(6)}: ${f.n} pessoa(s)`).join(', ') || '0'} |`,
  `| Rotas da área SINTER | ${rotasS.length}${cfgS ? '' : ' (cria a configuração da Sinter)'} |`,
  `| Ações (Tratativas) | ${acoes.length} |`,
  `| Registros de Segurança, atestados e OMs (conj → Sinter) | ${conjMuda.length}${segAreas ? ' + lista de áreas da Segurança' : ''} |`,
  `| Usuários com a área SINTER que ganham o escopo Sinter | ${usuarios.length}${usuarios.length ? ': ' + usuarios.map(u => u.nome).join(', ') : ''} |`,
  ''
);
if (semanasS || evidS) md.push(`::warning::Há ${semanasS} semana(s) e ${evidS} foto(s) da área SINTER no Pátio; ficam como estão.`, '');

const nada = !pessoas.length && !nChaves && !efs.length && !folhas.length && !novoCfgS && !acoes.length && !conjMuda.length && !segAreas && !usuarios.length;
if (nada) { resumo([...md, 'Nada a mudar: a Sinter já está no conjunto próprio.'].join('\n')); process.exit(0); }
if (!gravar) { resumo([...md, 'Para gravar: Actions › **Mover a Sinter** › Run workflow, modo **gravar** (depois do backup).'].join('\n')); process.exit(0); }

// ---------- cópia dos documentos que vão mudar ----------
const refs = [db.doc(`colaboradores/${AREA}`), db.doc(`s_colaboradores/${AREA}`), db.doc('s_config/sistema'), db.doc('config/seguranca'),
  ...sit.flatMap(x => [db.doc(`situacao/${x.id}`), db.doc(`s_situacao/${x.id}`)]), ...efs.map(d => d.ref),
  ...folhas.flatMap(f => [db.doc(`freqcomp/${f.id}`), db.doc(`freqcomp/${f.idS}`)]), ...acoes.map(d => d.ref), ...conjMuda, ...usuarios.map(u => u.ref)];
const copia = {};
for (const r of refs) { const d = await r.get(); if (d.exists) copia[r.path] = codificar(d.data(), F); }
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-sinter');
fs.mkdirSync(pasta, { recursive: true });
const quando = new Date().toISOString(); const marca = quando.slice(0, 19).replace(/[:T]/g, '-');
const arq = path.join(pasta, `antes-mover-sinter-${marca}.json.gz`);
gravarGz(arq, { em: quando, docs: copia });
let onde = `arquivo ${path.basename(arq)} (${tamanho(fs.statSync(arq).size)}) guardado nesta execução`;
const json = JSON.stringify(copia);
if (json.length < 900000) {
  const id = 'antes-mover-sinter-' + marca;
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: 'antes de mover a Sinter para o conjunto próprio', n: Object.keys(copia).length, json });
  onde += ` e no banco em backups/${id}`;
} else console.log('::warning::Cópia grande demais para um documento do banco; fica só o arquivo da execução.');

// ---------- gravar ----------
const lotes = []; let b = db.batch(), n = 0;
const op = f => { f(b); if (++n >= 400) { lotes.push(b); b = db.batch(); n = 0; } };
const porQuem = { atualizadoEm: F.FieldValue.serverTimestamp(), atualizadoPor: 'rotina mover-sinter' };
// 1) destino
if (novoCfgS) op(x => x.set(db.doc('s_config/sistema'), novoCfgS, { merge: true }));
if (pessoas.length) op(x => x.set(db.doc(`s_colaboradores/${AREA}`), { itens: itensS, ...porQuem }));
for (const s of sit) op(x => x.set(db.doc(`s_situacao/${s.id}`), s.mover, { merge: true }));
for (const d of efs) op(x => x.set(db.doc(`s_efetivoDia/${d.id}`), d.data()));
for (const f of folhas) op(x => x.set(db.doc(`freqcomp/${f.idS}`), { ...f.sinter, ...porQuem }));
for (const d of acoes) op(x => x.set(db.doc(`s_acoes/${d.id}`), d.data()));
lotes.push(b); for (const l of lotes) await l.commit();
// 2) tirar do Pátio e acertar o resto
lotes.length = 0; b = db.batch(); n = 0;
if (pessoas.length) op(x => x.delete(db.doc(`colaboradores/${AREA}`)));
for (const s of sit) for (const [campo, mapa] of Object.entries(s.mover)) for (const k of Object.keys(mapa)) op(x => x.update(db.doc(`situacao/${s.id}`), new F.FieldPath(campo, k), F.FieldValue.delete()));
for (const d of efs) op(x => x.delete(d.ref));
for (const f of folhas) op(x => x.update(db.doc(`freqcomp/${f.id}`), { grupos: f.patio.grupos, d: f.patio.d, jus: f.patio.jus, ...porQuem }));
for (const d of acoes) op(x => x.delete(d.ref));
for (const r of conjMuda) op(x => x.update(r, { conj: 'sinter' }));
if (segAreas) op(x => x.update(db.doc('config/seguranca'), { areas: segAreas }));
for (const u of usuarios) op(x => x.update(u.ref, u.p));
lotes.push(b); for (const l of lotes) await l.commit();

await db.collection('historico').add({ at: F.FieldValue.serverTimestamp(), uid: 'rotina', nome: 'Rotina do GitHub', mod: 'administracao', t: `Moveu a Sinter para o conjunto próprio: ${pessoas.length} pessoa(s), ${nChaves} lançamento(s) de presença, ${folhas.length} folha(s), ${usuarios.length} usuário(s) com o escopo Sinter.` });
resumo([...md, '**Gravado.**', `**Cópia antes de gravar:** ${onde}.`].join('\n'));
