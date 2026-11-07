// Gera os dados da demonstração (public/demo/exemplo*.json) a partir das planilhas reais (dados-importacao/),
// trocando nomes, apelidos, líderes e matrículas por fictícios. Ocorrências viram exemplos genéricos.
// As planilhas reais não ficam no repositório: coloque os seed*.json em dados-importacao/ (só no seu computador)
// e rode:  node ferramentas/gerar-demo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = f => JSON.parse(fs.readFileSync(path.join(raiz, 'dados-importacao', f), 'utf8'));
const destino = path.join(raiz, 'public', 'demo');
fs.mkdirSync(destino, { recursive: true });

const NOMES = ['ANA', 'BRUNO', 'CARLOS', 'DANIELA', 'EDUARDO', 'FERNANDA', 'GABRIEL', 'HELENA', 'IGOR', 'JULIANA', 'KLEBER', 'LARISSA',
  'MARCELO', 'NATALIA', 'OTAVIO', 'PATRICIA', 'RAFAEL', 'SABRINA', 'TIAGO', 'URSULA', 'VINICIUS', 'WESLEY', 'YASMIN', 'ALAN', 'BEATRIZ',
  'CAIO', 'DIEGO', 'ELISA', 'FABIO', 'GUSTAVO', 'HUGO', 'ISABELA', 'JOAO', 'LEANDRO', 'MATEUS', 'NICOLAS', 'PAULO', 'RENATO', 'SERGIO', 'TATIANE'];
const MEIOS = ['ALVES', 'BARROS', 'CAMPOS', 'DIAS', 'FARIAS', 'GOMES', 'LIMA', 'MACEDO', 'NUNES', 'PIRES', 'REIS', 'TEIXEIRA'];
const SOBRE = ['ANDRADE', 'BATISTA', 'CARDOSO', 'DUARTE', 'ESTEVES', 'FREITAS', 'GUIMARAES', 'HOLANDA', 'MOREIRA', 'NASCIMENTO', 'PRADO',
  'QUEIROZ', 'RIBEIRO', 'SAMPAIO', 'TAVARES', 'VASCONCELOS', 'XAVIER', 'ZANETTI', 'MONTEIRO', 'LACERDA', 'FONSECA', 'BRAGA', 'COUTO', 'ROCHA'];

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
const nomes = new Map(), usados = new Set();
let n = 0;
function nomeFicticio(real) {
  const k = norm(real);
  if (!k) return real;
  if (nomes.has(k)) return nomes.get(k);
  let f;
  do { const i = n++; f = `${NOMES[i % NOMES.length]} ${MEIOS[(i * 5 + Math.floor(i / (NOMES.length * SOBRE.length))) % MEIOS.length]} ${SOBRE[Math.floor(i / NOMES.length) % SOBRE.length]}`; } while (usados.has(f));
  usados.add(f); nomes.set(k, f);
  return f;
}
// Apelidos e líderes ("Kauan", "GEDIAEL"): primeiro nome fictício, mantendo maiúsculas/minúsculas.
const apelidos = new Map();
function apelido(real) {
  const k = norm(real);
  if (!k) return real;
  if (!apelidos.has(k)) apelidos.set(k, nomeFicticio('apelido ' + k).split(' ').slice(0, k.includes(' ') ? 2 : 1).join(' '));
  const f = apelidos.get(k);
  return real === real.toUpperCase() ? f : f.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
}
const mats = new Map();
const matricula = real => { const k = String(real || '').trim(); if (!k) return real; if (!mats.has(k)) mats.set(k, String(1000 + mats.size)); return mats.get(k); };
const nomeOuApelido = s => (norm(s).includes(' ') ? nomeFicticio(s) : apelido(s));

const grava = (f, d) => { fs.writeFileSync(path.join(destino, f), JSON.stringify(d)); console.log('demo/' + f); };

// Atividades Pátio e Bateria: só os nomes dos colaboradores são pessoais.
for (const [orig, dest] of [['seed.json', 'exemplo.json'], ['seed-bateria.json', 'exemplo-bateria.json']]) {
  const s = ler(orig);
  s.colabs = s.colabs.map(c => ({ ...c, nome: nomeFicticio(c.nome) }));
  grava(dest, s);
}

// Operação: operadores, lançamentos e paradas (operador e substituto podem vir como apelido).
{
  const s = ler('seed-equip.json');
  s.operadores = s.operadores.map(o => ({ ...o, nome: nomeOuApelido(o.nome) }));
  // Textos livres ("OPERADOR FULANO SUBSTITUINDO…"): troca o primeiro nome ou apelido de quem é da equipe.
  const doTime = new Set();
  for (const o of s.operadores) doTime.add(norm(o.nome).split(' ')[0]);
  for (const x of [...s.lanc, ...s.paradas]) for (const v of [x.op, x.sub]) if (v) doTime.add(norm(v).split(' ')[0]);
  doTime.delete('');
  const texto = t => (t ? String(t).replace(/[A-Za-zÀ-ÿ]+/g, w => (doTime.has(norm(w)) ? apelido(w) : w)) : t);
  s.lanc = s.lanc.map(x => ({ ...x, op: nomeOuApelido(x.op), sub: x.sub ? nomeOuApelido(x.sub) : x.sub, obs: texto(x.obs) }));
  s.paradas = s.paradas.map(x => ({ ...x, op: x.op ? nomeOuApelido(x.op) : x.op, desc: texto(x.desc), os: texto(x.os) }));
  s.aval = Object.fromEntries(Object.entries(s.aval || {}).map(([m, itens]) => [m, Object.fromEntries(Object.entries(itens).map(([op, v]) => [nomeOuApelido(op), v]))]));
  grava('exemplo-equip.json', s);
}

// Fichas: colaboradores com nome e matrícula fictícios; ocorrências trocadas por exemplos genéricos.
{
  const s = ler('seed-gestao.json');
  s.colabs = s.colabs.map(c => ({ ...c, mat: matricula(c.mat), nome: nomeFicticio(c.nome), lider: c.lider ? apelido(c.lider) : c.lider }));
  const tipos = s.tipos.map(t => t.tipo);
  s.ocorrencias = s.colabs.slice(0, 3).map((c, i) => ({
    data: s.ocorrencias[i] ? s.ocorrencias[i].data : '2026-10-01', mat: c.mat, nome: c.nome, tipo: tipos[i % tipos.length],
    desc: 'Exemplo da demonstração', lider: 'LÍDER EXEMPLO', status: 'pendente', assinadoEm: null, testemunha: '', comprovante: ''
  }));
  grava('exemplo-gestao.json', s);
}

// Lista do RH: matrícula, nome e líder fictícios (colunas 0, 1 e 7).
{
  const s = ler('seed-efetivo.json');
  s.origem = 'Lista de exemplo (nomes fictícios)';
  s.linhas = s.linhas.map(l => { const x = l.slice(); x[0] = matricula(x[0]); x[1] = nomeFicticio(x[1]); if (x[7]) x[7] = apelido(x[7]); return x; });
  grava('exemplo-efetivo.json', s);
}

// Administrativo: folhas de frequência e férias. Nomes e matrículas fictícios (os mesmos das Atividades, para a
// presença em comum aparecer na demonstração); nomes de grupo só com as palavras genéricas; observações e substitutos saem.
const GENERICAS = new Set(('GESTÃO GESTAO OPERADOR OPERADORES DE DA DO DAS DOS E ADM ARTÍFICE ARTIFICE 3X3 4X4 TURNO TURMA A B C D I J CDQ PATIO PÁTIO ' +
  'CARVÃO CARVAO MD\'S CAMINHÃO MÉDIA PRESSÃO CANALETAS/PREVENTIVA CANALETAS PREVENTIVA CAPTAÇÃO GÁS GAS AFASTADO AFASTADOS OPERAÇÃO OPERACAO LIDER LÍDER ' +
  'SUPERVISÃO SUPERVISAO PREPARACAO PREPARAÇÃO BATERIA TRILHO RECEBIMENTO FINAL TRATAMENTO COQUE APOIO LIMPEZA MAQUINAS MÁQUINAS CONTROLE TERMICO TÉRMICO TOPO ' +
  'JARDINAGEM PINTURA ALMOXARIFADO ALMOXARIFE PROCESSO EQUIPAMENTOS AJUDANTE AJUDANTES MECANICA MECÂNICA ELETRICA ELÉTRICA -').split(' '));
const nomeGrupo = g => g.split(/(\s+|-)/).map(w => (!w.trim() || w === '-' || GENERICAS.has(w.toUpperCase()) ? w : apelido(w))).join('');
const NOTA_OK = /^(ADMISS|DESLIGA|desligado|Desligado|código|COBRIR)/;
for (const conj of ['patio', 'bateria']) {
  const f = 'seed-freq-' + conj + '.json';
  if (!fs.existsSync(path.join(raiz, 'dados-importacao', f))) continue;
  const s = ler(f);
  s.avisos = [];
  s.competencias = s.competencias.map(c => ({ ...c, grupos: c.grupos.map(g => ({ ...g, nome: nomeGrupo(g.nome), pessoas: g.pessoas.map(p => {
    const nome = nomeFicticio(p.nome);
    return { ...p, nome, chave: nome, ...(p.mat ? { mat: matricula(p.mat) } : {}), obs: '', notas: (p.notas || []).filter(n => NOTA_OK.test(n)) };
  }) })) }));
  grava('exemplo-freq-' + conj + '.json', s);
}
if (fs.existsSync(path.join(raiz, 'dados-importacao', 'seed-ferias.json'))) {
  const s = ler('seed-ferias.json');
  s.ferias = s.ferias.map(r => ({ ...r, nome: nomeFicticio(r.nome), mat: r.mat ? matricula(r.mat) : r.mat, substituto: r.substituto ? 'Substituto de exemplo' : '', obs: '' }));
  grava('exemplo-ferias.json', s);
}

// Conferência: nenhum nome real pode sobrar nos arquivos da demonstração.
const ficticios = new Set([...NOMES, ...MEIOS, ...SOBRE]);
const reais = new Set();
for (const k of nomes.keys()) if (!k.startsWith('APELIDO ')) reais.add(k);
for (const k of apelidos.keys()) if (!ficticios.has(k)) reais.add(k);
let vazou = 0;
for (const f of fs.readdirSync(destino)) {
  const txt = norm(fs.readFileSync(path.join(destino, f), 'utf8'));
  for (const r of reais) if (r.length > 3 && new RegExp(`(^|[^A-Z])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z]|$)`).test(txt) && !usados.has(r) && ![...apelidos.values()].some(a => norm(a) === r)) { console.error(`Nome real em demo/${f}: ${r.slice(0, 3)}…`); vazou++; }
}
if (vazou) { console.error(`${vazou} nome(s) real(is) na demonstração. Corrija antes de publicar.`); process.exit(1); }
console.log(`OK: ${nomes.size} nomes e ${mats.size} matrículas trocados.`);
