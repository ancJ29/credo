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

export default defineConfig(
  // services/c-storage/ is a Go project with its own face and gate (its CLAUDE.md line 2). ui/frame-mock/ is
  // a static look for the human to judge, its data written from the app's own files: no product code;
  // ui/signin-mock/ is the same for the sign-in screens.
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      '**/coverage/',
      'services/c-storage/',
      'ui/frame-mock/',
      'ui/signin-mock/',
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
  { files: ['ui/**/*.{ts,tsx}'], extends: [reactHooks.configs.flat['recommended-latest']] },
);
