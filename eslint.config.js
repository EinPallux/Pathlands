// @ts-check
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

/** Flat ESLint config. Enforces the determinism + no-any standards from CLAUDE.md §4. */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        ...globals.browser,
        __BUILD_VERSION__: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // The interface + companion-const component pattern is valid TS (separate
      // type/value namespaces); tsc catches genuine value redeclarations.
      'no-redeclare': 'off',
      // TypeScript resolves DOM/ambient types; no-undef can't see them.
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // The simulation must be deterministic: ban wall-clock + Math.random inside sim/.
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use sim/rng.ts (seeded) inside the simulation.' },
        { object: 'Date', property: 'now', message: 'No wall-clock reads inside the simulation.' },
        { object: 'performance', property: 'now', message: 'No wall-clock reads inside the simulation.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'No wall-clock reads inside the simulation.' },
      ],
    },
  },
  {
    files: ['tools/**/*.ts', 'tests/**/*.ts', 'src/**/*.test.ts', '*.config.ts', '*.config.js'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-console': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
    },
  },
];
