// Liga o módulo Indicadores (perfil "Vê") para quem já via os painéis antes do módulo existir (PR #135).
// Só manual (Actions › Ligar Indicadores para quem já via). Rode antes a Cópia de segurança.
//   LIGAR_MODO = simular (padrão): só mostra quem ganharia o módulo e não grava.
//              = gravar: guarda uma cópia do acesso e dos escopos de cada um na coleção backups e grava.
// A conta (quem ganha e com que escopo) fica em public/contas/acessos.js (ligarIndicadores), testada em testes/.
import { conectar, resumo } from './comum.mjs';
import { ligarIndicadores, selosAcesso } from '../../public/contas/acessos.js';

const gravar = process.env.LIGAR_MODO === 'gravar';
const { db, F } = await conectar();
const qs = await db.collection('usuarios').get();
const muda = [];
for (const d of qs.docs) { const u = d.data(); const n = ligarIndicadores(u); if (n) muda.push({ uid: d.id, u, n }); }
// Sem nomes no resumo público da rotina: só o login (o mesmo que aparece em Usuários) e os módulos.
const linhas = muda.map(({ u, n }) => `| ${u.login || '—'} | ${selosAcesso(u.acesso).map(([m, p]) => `${m} · ${p}`).join(', ')} | ${n.escopos.join(', ')}${(u.escopos || []).length ? '' : ' (novo)'} |`);
let onde = '';
if (gravar && muda.length) {
  const id = 'antes-ligar-indicadores-' + new Date().toISOString().replace(/[:.]/g, '-');
  const copia = Object.fromEntries(muda.map(({ uid, u }) => [uid, { acesso: u.acesso, escopos: u.escopos || [] }]));
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: 'antes de ligar o módulo Indicadores para quem já via os painéis', n: muda.length, json: JSON.stringify(copia) });
  const b = db.batch();
  for (const { uid, n } of muda) b.update(db.collection('usuarios').doc(uid), { acesso: n.acesso, escopos: n.escopos });
  await b.commit();
  onde = `Cópia de antes guardada no banco em backups/${id}.`;
}
resumo([
  gravar ? '### Indicadores ligados' : '### Indicadores: só conferência (nada foi gravado)',
  '', `${muda.length} de ${qs.size} usuário(s) ${gravar ? 'ganharam' : 'ganhariam'} Indicadores · Vê.`, '',
  '| Usuário | Acesso de hoje | Escopos nos Indicadores |', '|---|---|---|', ...linhas, '',
  !muda.length ? 'Nada a fazer.' : gravar ? onde : 'Para gravar, rode de novo com o modo **gravar**.'
].join('\n'));
