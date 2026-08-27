import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

/**
 * ESLint for apps/api. Formatting is delegated entirely to Prettier —
 * `eslint-config-prettier` switches off the rules that would fight it.
 *
 * Module boundaries are not checked here: they are described by file-name globs
 * and live in `.dependency-cruiser.cjs` (`npm run deps:check`).
 */
export default defineConfig([
  globalIgnores(['node_modules/**', 'dist/**', 'coverage/**']),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // The tooling's own configs sit outside the tsconfig project.
          allowDefaultProject: ['eslint.config.js', '.dependency-cruiser.cjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A type import is spelled out: it makes the layer a file depends on visible, and
      // dependency-cruiser counts it as a dependency exactly like a value import.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // The domain is described with type aliases: they do not merge via declaration
      // merging, so the shape of a contract is visible from one place.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // describe/it from node:test return a promise the runtime awaits on its own.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', package: 'node:test', name: ['describe', 'it', 'test', 'suite'] },
          ],
        },
      ],
      // A method is async by contract; an implementation that happens to be synchronous
      // — a stub in a spec, say — is no reason to rewrite the signature.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'enum has a runtime shape of its own: use a union or a const object.',
        },
        {
          selector: 'TSModuleDeclaration[kind="namespace"]',
          message: 'namespace predates ES modules: use ordinary modules.',
        },
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Named exports only: default makes the code base harder to search.',
        },
      ],
    },
  },

  {
    // Tool configs do not choose their export format — the tool dictates it.
    files: ['eslint.config.js', '.dependency-cruiser.cjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },

  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
]);
