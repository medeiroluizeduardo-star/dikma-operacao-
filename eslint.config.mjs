// Conferência de erros comuns no JavaScript (ESLint). Por enquanto só AVISA: nada aqui trava a CI nem a publicação.
// Rodar no computador: cd testes && npm install && npm run estilo (formato e detalhes em ferramentas/eslint/)
import { createRequire } from 'node:module';

// O ESLint e as listas de nomes ficam instalados em testes/ (junto com os outros testes).
const daPastaTestes = createRequire(new URL('./testes/package.json', import.meta.url));
const { default: js } = await import(daPastaTestes.resolve('@eslint/js'));
const { default: globals } = await import(daPastaTestes.resolve('globals'));

// Todas as regras recomendadas viram aviso ("warn"), nunca erro.
const avisos = Object.fromEntries(Object.keys(js.configs.recommended.rules).map(r => [r, 'warn']));

export default [
  { ignores: ['**/node_modules/**', 'public/vendor/**', 'dados-importacao/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      ...avisos,
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  { files: ['public/**/*.js'], languageOptions: { globals: { ...globals.browser } } },
  { files: ['public/sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  // ferramentas, rotinas e testes rodam no Node; os testes de tela também mandam código para o navegador
  { files: ['eslint.config.mjs', 'ferramentas/**', 'integracao/**', 'testes/**'], languageOptions: { globals: { ...globals.node } } },
  { files: ['testes/**'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
