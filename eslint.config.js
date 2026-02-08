// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // Fix: eslint-plugin-import rules (like import/namespace) need a TS parser
  // to parse imported TypeScript modules correctly under flat config.
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
  },
]);
