import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// The design system's direction: a component imports only from the levels below its own, the tokens
// and packages (ui/CLAUDE.md, `components/`). Tests are outside it.
const LEVELS = [
  { level: 'atoms', above: ['molecules', 'organisms'] },
  { level: 'molecules', above: ['organisms'] },
  { level: 'organisms', above: [] },
];

// A hex colour, or a function that makes one, in a string.
const COLOUR = String.raw`/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl)a?\(/`;

// A numbered shade in a string: `brand.7`, or Mantine's `--mantine-color-brand-7`.
const SHADE = String.raw`/^[a-z]+\.[0-9]+$|--mantine-color-[a-z]+-[0-9]/`;

export default defineConfig(
  // services/c-storage/ is a Go project with its own face and gate (its CLAUDE.md line 2). ui/frame-mock/ is
  // a static look for the human to judge, its data written from the app's own files: no product code;
  // ui/signin-mock/ is the same for the sign-in screens. site/build/ and site/.docusaurus/ are the docs site's
  // build and Docusaurus's generated files.
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      '**/coverage/',
      'services/c-storage/',
      'ui/frame-mock/',
      'ui/signin-mock/',
      'site/build/',
      'site/.docusaurus/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  { files: ['**/*.{js,mjs}'], extends: [tseslint.configs.disableTypeChecked] },
  ...LEVELS.map(({ level, above }) => ({
    files: [`ui/src/components/${level}/*.{ts,tsx}`],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...(above.length === 0
              ? []
              : [
                  {
                    regex: `^\\.\\./(${above.join('|')})(/|$)`,
                    message: `A ${level.slice(0, -1)} imports only from the levels below its own.`,
                  },
                ]),
            {
              regex: '^\\.\\./\\.\\.(/(?!design-system/tokens$)|$)',
              message: 'A component imports only the tokens, and packages, outside components/.',
            },
          ],
        },
      ],
    },
  })),
  // No colour of its own outside the design system: a screen reads the theme's variables. The design
  // system, the tests and the mock harness (a page of fixtures) are outside it.
  {
    files: ['ui/src/**/*.{ts,tsx}'],
    ignores: ['ui/src/design-system/**', 'ui/src/mock/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${COLOUR}], TemplateElement[value.raw=${COLOUR}]`,
          message: 'A colour is written in the design system, and read by name or variable.',
        },
        {
          selector: `Literal[value=${SHADE}], TemplateElement[value.raw=${SHADE}]`,
          message: 'A shade is named in the design system; a screen reads a role.',
        },
      ],
    },
  },
  { files: ['ui/**/*.{ts,tsx}'], extends: [reactHooks.configs.flat['recommended-latest']] },
);
