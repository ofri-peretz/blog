import nestjsSecurity from 'eslint-plugin-nestjs-security';
import secureCoding from 'eslint-plugin-secure-coding';
import tsParser from '@typescript-eslint/parser';

// The exact config the article runs against both models' output.
export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: {
      'nestjs-security': nestjsSecurity,
      'secure-coding': secureCoding,
    },
    rules: {
      'nestjs-security/require-guards': 'error',
      'nestjs-security/no-exposed-private-fields': 'error',
      'nestjs-security/require-throttler': 'error',
      'nestjs-security/no-missing-validation-pipe': ['error', { assumeGlobalPipes: true }],
      'nestjs-security/require-class-validator': 'error',
      'nestjs-security/no-exposed-debug-endpoints': 'error',
      'secure-coding/no-hardcoded-credentials': 'error',
    },
  },
];
