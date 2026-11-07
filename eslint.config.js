// 書き間違い（使っていない変数・定義していない名前）を見つけるための設定。実行：npm run lint
// ページの JS は <script> で順に読み込み、window.* で受け渡すので、ブラウザのグローバルとして読む
const globals = require('globals');

module.exports = [
  { ignores: ['vendor/', 'node_modules/'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
    },
  },
  {
    files: ['api/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
