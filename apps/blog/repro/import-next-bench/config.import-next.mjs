import importNext from 'eslint-plugin-import-next';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { 'import-next': importNext },
    rules: { 'import-next/no-cycle': 'error' },
  },
];
