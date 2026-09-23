/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  printWidth: 120,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  // Classes do Tailwind na ordem canônica: diff menor e duplicata visível.
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/index.css',
  // JSON com comentário (wrangler, tsconfig) segue o JSON estrito: sem vírgula no fim.
  overrides: [{ files: ['*.json', '*.jsonc'], options: { trailingComma: 'none' } }],
}
