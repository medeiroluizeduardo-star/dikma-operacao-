// Converte o cadastro dos usuários para o acesso por módulo (fase 1 da divisão em 5 módulos).
// A conversão é a mesma da tela de usuários (public/acessos.js, acessoDoLegado).
//   --simular (padrão)  só lê os usuários e mostra no resumo da execução como cada um está e como fica, com avisos.
//   --gravar            antes faz uma cópia de todos os usuários (arquivo da execução e coleção backups) e grava
//                       SÓ os campos acesso e escopos (papel, modulos e áreas ficam como estão). Pula quem já tem acesso.
//   --arquivo x.json    lê os usuários de um arquivo (lista, ou { usuarios: [...] }) em vez do banco. Para testar.
// O resumo tem nomes e logins: o repositório é privado e só o administrador vê as execuções.
import fs from 'node:fs';
import path from 'node:path';
import { conectar, raiz, resumo, codificar, gravarGz, tamanho } from './comum.mjs';

const args = process.argv.slice(2);
const gravar = args.includes('--gravar') || process.env.CONVERTER_MODO === 'gravar';
const iArq = args.indexOf('--arquivo');
const arquivo = iArq >= 0 ? args[iArq + 1] : null;
if (gravar && arquivo) { console.error('::error::--gravar só funciona com o banco, não com --arquivo.'); process.exit(1); }

// As contas ficam em public/ (são as mesmas do site). Copia como .mjs para o Node.
const lib = path.join(path.dirname(new URL(import.meta.url).pathname), 'lib');
fs.mkdirSync(lib, { recursive: true });
// acessos.js e tudo o que ele importa (planilhas-adm.js, situacao.js...), seguindo os imports.
const fila = ['acessos', 'cal'], feitos = new Set();
while (fila.length) {
  const f = fila.shift(); if (feitos.has(f)) continue; feitos.add(f);
  const src = fs.readFileSync(path.join(raiz, 'public', f + '.js'), 'utf8');
  for (const m of src.matchAll(/from '\.\/([\w-]+)\.js'/g)) fila.push(m[1]);
  fs.writeFileSync(path.join(lib, f + '.mjs'), src.replace(/from '\.\/([\w-]+)\.js'/g, "from './$1.mjs'"));
}
const { acessoDoLegado, legadoDoAcesso, modulosDe, selosAcesso, ESCOPOS } = await import('./lib/acessos.mjs');
const { AREA_S, setDaArea, SETS } = await import('./lib/cal.mjs');

// ---- lê os usuários ----
let usuarios = [], db = null, F = null;
if (arquivo) {
  const j = JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf8'));
  usuarios = (Array.isArray(j) ? j : j.usuarios || []).map(u => ({ ...u, uid: u.uid || u.login }));
} else {
  ({ db, F } = await conectar());
  usuarios = (await db.collection('usuarios').get()).docs.map(d => ({ uid: d.id, ...d.data() }));
}
usuarios.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

const PAPEL = { admin: 'Administrador', gestor: 'Gestor', coordenador: 'Coordenador', supervisor: 'Supervisor', lider: 'Líder', administrativo: 'Administrativo', leitor: 'Somente leitura', bloqueado: 'Bloqueado' };
const MOD = { operacao: 'Pátio', bateria: 'Bateria', equipamentos: 'Equipamentos', gestao: 'Fichas', frequencia: 'Frequência' };
const cel = t => String(t ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const area = a => (a ? AREA_S[a] || a : '');
const comoEsta = u => {
  const mods = u.papel === 'admin' ? 'todos' : modulosDe(u).map(m => MOD[m] || m).join(', ') || 'nenhum';
  const ar = [area(u.area), u.papel === 'supervisor' ? area(u.area2) : ''].filter(Boolean).join(' + ');
  return `${PAPEL[u.papel] || u.papel || '?'} · módulos: ${mods}${ar ? ' · área: ' + ar : ''}${Array.isArray(u.acessos) && u.acessos.includes('administrativo') ? ' · acesso antigo Administrativo' : ''}`;
};
const comoFica = r => {
  const s = selosAcesso(r.acesso).map(([m, p]) => `${m}: ${p}`).join(' · ') || 'sem acesso';
  const e = r.escopos.map(k => ESCOPOS.find(x => x[0] === k)[1]).join(', ');
  return `${s}${e ? ' · escopos: ' + e : ''}${r.acesso.gestao && !r.fichas && r.acesso.administracao !== 'admin' ? ' · Gestão sem as fichas' : ''}`;
};
// Casos estranhos para o administrador conferir antes de gravar.
function avisos(u, r) {
  const l = [];
  const m = modulosDe(u);
  if (!PAPEL[u.papel]) l.push(`perfil desconhecido "${u.papel}"`);
  if (u.papel !== 'bloqueado' && u.papel !== 'admin' && !Object.keys(r.acesso).length) l.push('fica sem nenhum módulo');
  if (Array.isArray(u.modulos) && !u.modulos.length && u.papel !== 'admin' && u.papel !== 'bloqueado') l.push('cadastro com a lista de módulos vazia (hoje vale como Pátio)');
  const ativ = m.includes('operacao') || m.includes('bateria');
  if (['lider', 'supervisor'].includes(u.papel) && ativ && !u.area) l.push(`${PAPEL[u.papel].toLowerCase()} de Pátio/Bateria sem área`);
  if (u.papel === 'lider' && !ativ && !m.includes('equipamentos') && m.includes('gestao') && !u.area) l.push('líder só com fichas e sem área');
  for (const a of [u.area, u.papel === 'supervisor' ? u.area2 : null].filter(Boolean)) {
    const k = setDaArea(a); if (k && !m.includes(SETS[k].mod) && u.papel !== 'admin') l.push(`área ${area(a)} sem o módulo ${SETS[k].curto}`);
  }
  if (u.area && !['lider', 'supervisor'].includes(u.papel)) l.push('tem área gravada, mas o perfil vê todas (a área é ignorada)');
  const v = legadoDoAcesso(r.acesso, r.escopos, { fichas: r.fichas, area: u.area, area2: u.area2 });
  if (u.papel !== 'bloqueado' && v.papel !== u.papel) l.push(`se o acesso for salvo pela tela, o perfil antigo vira ${PAPEL[v.papel]} (mesmas permissões)`);
  if (u.papel === 'leitor' && r.acesso.gestao && !m.includes('gestao')) l.push('somente leitura com Pátio/Bateria ganha Gestão · Somente leitura (Programação e Indicadores, que já vê hoje)');
  return l;
}

const linhas = [], estranhos = [];
const aGravar = [];
for (const u of usuarios) {
  const quem = `${cel(u.nome || '(sem nome)')} (${cel(u.login || 'conta Google')})`;
  if (u.acesso && typeof u.acesso === 'object') {
    linhas.push(`| ${quem} | ${cel(comoEsta(u))} | já convertido: ${cel(comoFica({ acesso: u.acesso, escopos: u.escopos || [], fichas: modulosDe(u).includes('gestao') }))} |`);
    continue;
  }
  const r = acessoDoLegado(u);
  const av = avisos(u, r);
  linhas.push(`| ${quem} | ${cel(comoEsta(u))} | ${cel(comoFica(r))}${av.length ? ' ⚠' : ''} |`);
  if (av.length) estranhos.push(`- **${quem}**: ${av.join('; ')}.`);
  aGravar.push({ uid: u.uid, acesso: r.acesso, escopos: r.escopos });
}

const ja = usuarios.length - aGravar.length;
const cab = [
  `### Conversão dos acessos por módulo · ${gravar ? 'GRAVAR' : 'simulação (nada foi gravado)'}`,
  `${usuarios.length} usuário(s): ${aGravar.length} a converter, ${ja} já convertido(s).${arquivo ? ` Lido do arquivo ${path.basename(arquivo)}.` : ''}`,
  '',
  '| Usuário | Como está (papel, módulos, áreas) | Como fica (módulo: perfil, escopos) |', '|---|---|---|',
  ...linhas, ''
];
const avisosMd = estranhos.length ? ['#### Avisos (conferir antes de gravar)', ...estranhos, ''] : ['Nenhum caso estranho encontrado.', ''];

if (!gravar) {
  resumo([...cab, ...avisosMd, 'Para gravar: Actions › **Converter acessos** › Run workflow, modo **gravar**. Só os campos novos `acesso` e `escopos` são gravados; papel, módulos e áreas ficam como estão.'].join('\n'));
  process.exit(0);
}

// ---- gravar: cópia de segurança dos usuários antes ----
const pasta = path.resolve(process.env.BACKUP_PASTA || 'copia-usuarios');
fs.mkdirSync(pasta, { recursive: true });
const copia = Object.fromEntries((await db.collection('usuarios').get()).docs.map(d => [d.id, codificar(d.data(), F)]));
const quando = new Date().toISOString();
const arqCopia = path.join(pasta, `usuarios-${quando.slice(0, 19).replace(/[:T]/g, '-')}.json.gz`);
gravarGz(arqCopia, { em: quando, usuarios: copia });
const json = JSON.stringify(copia);
let ondeCopia = `arquivo ${path.basename(arqCopia)} (${tamanho(fs.statSync(arqCopia).size)}) guardado nesta execução`;
if (json.length < 900000) {
  const id = 'usuarios-antes-acessos-' + quando.slice(0, 19).replace(/[:T]/g, '-');
  await db.collection('backups').doc(id).set({ em: F.FieldValue.serverTimestamp(), motivo: 'antes da conversão dos acessos por módulo', n: Object.keys(copia).length, json });
  ondeCopia += ` e no banco em backups/${id}`;
} else console.log('::warning::Cópia grande demais para um documento do banco; fica só o arquivo da execução.');

// Grava só acesso e escopos, de 400 em 400; confere de novo se ninguém foi convertido pela tela nesse meio-tempo.
let gravados = 0, pulados = 0;
for (let i = 0; i < aGravar.length; i += 400) {
  const parte = aGravar.slice(i, i + 400);
  // a transação pode repetir: conta só no fim
  const [g, p] = await db.runTransaction(async t => {
    const docs = await Promise.all(parte.map(x => t.get(db.collection('usuarios').doc(x.uid))));
    let g = 0, p = 0;
    docs.forEach((d, j) => {
      if (!d.exists || d.get('acesso')) { p++; return; }
      t.update(d.ref, { acesso: parte[j].acesso, escopos: parte[j].escopos }); g++;
    });
    return [g, p];
  });
  gravados += g; pulados += p;
}
resumo([...cab, ...avisosMd, `**Gravado:** acesso e escopos em ${gravados} usuário(s)${pulados ? `; ${pulados} pulado(s) (convertidos ou apagados enquanto a rotina rodava)` : ''}.`, `**Cópia antes de gravar:** ${ondeCopia}.`].join('\n'));
