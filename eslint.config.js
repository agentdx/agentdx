import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/', 'node_modules/', '*.config.*', 'scripts/'],
  },
  {
    rules: {
      // TypeScript strict mode handles these better
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow non-null assertions — we use noUncheckedIndexedAccess
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
