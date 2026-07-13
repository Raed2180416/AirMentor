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
    // Files that legitimately co-locate a component with its config/type-map or
    // re-export a sibling's non-component helper (ReactFlow node/edge type maps,
    // backward-compat re-export barrels). react-refresh is a dev-only HMR rule;
    // these degrade to a full reload, no runtime/behaviour impact.
    files: [
      'adapters/web/shared/ui/primitives.tsx',
      'adapters/web/features/admin/system-admin-ui.tsx',
      'adapters/web/features/admin/system-admin-faculties-workspace.tsx',
      'adapters/web/features/admin/curriculum-graph-workspace/curriculum-graph-nodes.tsx',
      'adapters/web/features/admin/curriculum-graph-workspace/curriculum-graph-edges.tsx',
      'adapters/web/features/admin/proof-dashboard/proof-launcher-popup.tsx',
      'adapters/web/features/pages/student-shell-parts/shared.tsx',
    ],
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
      // React Compiler is NOT part of the build (no babel-plugin-react-compiler);
      // this rule is advisory for a future adoption. Decomposing a large stateful
      // component into custom hooks legitimately breaks the compiler's manual-memo
      // preservation analysis, so it blocks modularity with zero runtime benefit
      // today. Downgrade to warn — the manual useMemo/useCallback still run exactly
      // as before, behaviour is unchanged. Correctness rules (refs, purity,
      // set-state-in-render, rules-of-hooks) remain errors.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Phase 3+ backend application layer must be framework/persistence-free:
    // ports + use-cases take repository interfaces, never touch Drizzle schema.
    // (The legacy air-mentor-api/src/modules still import db/schema directly and
    // are intentionally left ungated here until they are decomposed; that ban is
    // flipped on in Phase 6 once data access has moved behind repositories.)
    files: ['air-mentor-api/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/db/schema', '**/db/schema.js', 'drizzle-orm', 'drizzle-orm/*'],
            message: 'air-mentor-api/src/application/ must stay persistence-free: depend on a repository port, not db/schema or drizzle-orm.',
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
