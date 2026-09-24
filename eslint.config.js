// @ts-check
import js from '@eslint/js'
import eslintReact from '@eslint-react/eslint-plugin'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', '.wrangler', '3d', 'public', '.claude', '.wai', 'worker/worker-configuration.d.ts']),

  // Todo TypeScript: regras com informação de tipo e análise de qualidade (as mesmas do SonarQube/SonarLint).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, sonarjs.configs.recommended],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Número em template string é o caso comum e seguro (limites, contagens nos textos).
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `() => setAlgo(x)` é o idioma do React; o que importa é não usar o void como valor.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // _nome marca parâmetro exigido pela assinatura e não usado.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `declare global { namespace Cloudflare }` é como se estende o Env gerado pelo wrangler.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      // `void promessa` é o jeito explícito (typescript-eslint) de dizer "não espero": conflita com esta.
      'sonarjs/void-use': 'off',
      // Aleatório visual (partículas, piscar); nada aqui é segredo. Segredo usa crypto.randomUUID.
      'sonarjs/pseudo-random': 'off',
      // Readonly<Props> em todo componente é cerimônia: ninguém atribui a props.
      'sonarjs/prefer-read-only-props': 'off',
    },
  },

  // Site: React (componentes e hooks) e acessibilidade.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['recommended-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // Sufixo Ref em todo ref é convenção de nome, não defeito.
      '@eslint-react/naming-convention-ref-name': 'off',
    },
  },

  // Cena do React Three Fiber: mutar objetos do three.js (câmera, cena, uniforms) no quadro é o modelo da biblioteca.
  // As regras do React Compiler sobre mutação e pureza não se aplicam a esta camada imperativa.
  {
    files: ['src/features/hero/scene/**/*.{ts,tsx}'],
    rules: { 'react-hooks/immutability': 'off', 'react-hooks/purity': 'off' },
  },

  // Configurações das ferramentas rodam no Node.
  { files: ['*.{js,ts}'], languageOptions: { globals: globals.node } },
  { files: ['*.js'], extends: [tseslint.configs.disableTypeChecked] },

  // Prettier cuida da forma; depois dele, só os limites de tamanho do projeto.
  prettier,
  {
    rules: {
      'max-lines': ['error', { max: 300 }],
      // Código até 120 colunas (o Prettier quebra). Literais longos (classes do Tailwind, SQL, GLSL, URLs) não quebram.
      'max-len': [
        'error',
        { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true, ignoreUrls: true },
      ],
    },
  },
])
