// Envia os dados das planilhas (pasta dados-importacao) para o Firestore, em seeds/{nome}.
// Roda na publicação. Os arquivos não vão para o site: só quem administra o módulo lê pelo sistema.
// Só grava o que mudou (compara um resumo do conteúdo).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { conectar, raiz, resumo, tamanho } from './comum.mjs';

const pasta = path.join(raiz, 'dados-importacao');
const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter(f => /^seed[\w-]*\.json$/.test(f)) : [];
if (!arquivos.length) { console.log('::notice::Nenhum arquivo em dados-importacao. Nada a enviar.'); process.exit(0); }

const { db, F } = await conectar();
const linhas = [];
for (const f of arquivos) {
  const json = fs.readFileSync(path.join(pasta, f), 'utf8');
  JSON.parse(json); // para aqui se o arquivo estiver quebrado
  if (Buffer.byteLength(json) > 1000000) { console.error(`::error::${f} passa de 1 MB, o limite de um documento do Firestore.`); process.exit(1); }
  const id = f.replace(/\.json$/, '');
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  const ref = db.collection('seeds').doc(id);
  const atual = await ref.get();
  if (atual.exists && atual.get('hash') === hash) { linhas.push(`| ${id} | ${tamanho(Buffer.byteLength(json))} | sem mudança |`); continue; }
  await ref.set({ json, hash, arquivo: f, atualizadoEm: F.FieldValue.serverTimestamp() });
  linhas.push(`| ${id} | ${tamanho(Buffer.byteLength(json))} | enviado |`);
}
resumo(['### Dados de importação no banco', '| Arquivo | Tamanho | Situação |', '|---|---|---|', ...linhas].join('\n'));
