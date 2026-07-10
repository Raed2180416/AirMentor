import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.worktrees/**', '**/.venv/**', '.kilo/**', '.absolute-human/**', '.audit/**', '.agents/**']),
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
    files: ['src/ui-primitives.tsx', 'src/system-admin-ui.tsx'],
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
            group: ['../adapters/**', '../universities/**', '**/adapters/**', '**/universities/**'],
            message: 'kernel/ must not import from adapters/ or universities/',
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
])
