import js from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

/**
 * ESLint for apps/web. Besides the usual Angular rules it pins down the boundaries from
 * the style guide: grouping by feature, features not importing one another, and no
 * `core/`, `shared/` or by-type directories at all.
 */
const FEATURES = ['auth', 'products'];

/** Ban on importing a sibling feature — one rule per feature. */
const featureBoundaries = FEATURES.map((feature) => ({
  files: [`src/app/${feature}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: FEATURES.filter((other) => other !== feature).map((other) => ({
          group: [`**/${other}/**`, `**/app/${other}`],
          message:
            `Feature ${feature} does not import ${other}. Anything shared moves up as a ` +
            'file at the app/ level under a concrete name.',
        })),
      },
    ],
  },
}));

export default defineConfig([
  globalIgnores(['node_modules/**', 'dist/**', '.angular/**', 'coverage/**']),

  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-explicit-any': 'error',
      // A shell component with no state of its own is a normal Angular class, not an
      // "extraneous class": the framework is what makes it exist.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Validators.* are static functions without this; passing them by value is safe.
      '@typescript-eslint/unbound-method': 'off',
      'no-console': ['error', { allow: ['error'] }],
      eqeqeq: ['error', 'always'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/core/**',
                '**/shared/**',
                '**/utils/**',
                '**/services/**',
                '**/components/**',
                // The ban is on directories of this project, not on package entry points:
                // `@angular/core/testing` and `@angular/core/rxjs-interop` are neither.
                '!@angular/**',
              ],
              message:
                'Group by feature, not by kind of code: this project has no core/, shared/, ' +
                'utils/, services/ or components/ directories (Angular style guide).',
            },
          ],
        },
      ],
    },
  },

  ...featureBoundaries,

  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },

  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },

  {
    files: ['eslint.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  prettier,
]);
