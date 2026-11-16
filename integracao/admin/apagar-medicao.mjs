// Apaga o contratado da antiga Gestão › Medição do contrato (campo medicao de config/sistema e b_config/sistema,
// Pátio e Bateria). A aba saiu do sistema no PR #132. Só manual (Actions › Apagar dados da Medição antiga).
//   APAGAR_MODO = simular (padrão): só mostra o que existe e não grava.
//               = gravar: guarda uma cópia do campo na coleção backups e apaga o campo.
import { conectar, resumo } from './comum.mjs';

const gravar = process.env.APAGAR_MODO === 'gravar';
const { db, F } = await conectar();
const linhas = [], copia = {};
for (const [col, nome] of [['config', 'Pátio'], ['b_config', 'Bateria']]) {
  const ref = db.collection(col).doc('sistema');
  const s = await ref.get();
  const m = s.exists ? s.get('medicao') : undefined;
  if (m === undefined) { linhas.push(`| ${nome} | não tem | — |`); continue; }
  copia[col] = m;
  const funcoes = Object.keys((m && m.n) || {}).length;
  linhas.push(`| ${nome} | ${funcoes} função(ões) com contratado | ${gravar ? 'apagado' : 'seria apagado'} |`);
}
let onde = '';
if (gravar && Object.keys(copia).length) {
  const id = 'antes-apagar-medicao-' + new Date().toISOString().replace(/[:.]/g, '-');
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: 'antes de apagar o contratado da Medição do contrato (aba removida)', n: Object.keys(copia).length, json: JSON.stringify(copia) });
  for (const col of Object.keys(copia)) await db.collection(col).doc('sistema').update({ medicao: F.FieldValue.delete() });
  onde = `Cópia do que foi apagado guardada no banco em backups/${id}.`;
}
resumo([
  gravar ? '### Medição antiga: contratado apagado' : '### Medição antiga: só conferência (nada foi gravado)',
  '', '| Conjunto | O que havia | Situação |', '|---|---|---|', ...linhas, '',
  !Object.keys(copia).length ? 'Nada a apagar.' : gravar ? onde : 'Para apagar, rode de novo com o modo **gravar**.'
].join('\n'));
