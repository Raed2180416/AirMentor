import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist', '.worktrees/**', '**/.venv/**', '.kilo/**', '.absolute-human/**', '.audit/**', '.agents/**',
    'air-mentor-api/scripts/massive-e2e-validation.ts',
    'scripts/analyze-trajectory-realism.mjs',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    files: ['adapters/web/shared/ui/primitives.tsx', 'adapters/web/features/admin/system-admin-ui.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '../adapters/**',
              '../universities/**',
              '**/adapters/**',
              '**/universities/**',
              '@web/**',
              '@adapters/**',
              '@universities/**',
              '@persistence/**',
              '@http/**',
              '@simulation/**',
            ],
            message: 'kernel/ must not import from adapters/ or universities/ (use @kernel/* instead)',
          },
          {
            group: ['react', 'react-dom', 'framer-motion', 'fastify', 'drizzle-orm', 'embedded-postgres'],
            message: 'kernel/ must remain framework-free',
          },
        ],
      }],
    },
  },
  {
    files: ['adapters/web/**/*.ts', 'adapters/web/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/air-mentor-api/src/db/schema', '../air-mentor-api/src/db/schema', '../../air-mentor-api/src/db/schema'],
            message: 'adapters/web/ must not import from air-mentor-api database schema',
          },
        ],
      }],
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'air-mentor-api/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    files: ['tests-e2e/**/*.ts', 'tests-e2e/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['air-mentor-api/src/modules/curriculum-graph-routes.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['air-mentor-api/scripts/**/*.ts', 'scripts/**/*.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: 'module', jsx: false },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
    },
  },
])
