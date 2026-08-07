import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Build-time helpers run in Node, not in a browser tab. Without this block
    // they are simply not linted at all — the config above only matches TS.
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Scripts that drive a real browser. The bodies they hand to
    // `page.waitForFunction` are serialised and evaluated in the page, so they
    // reference `document` from a file that otherwise runs in Node.
    files: ['scripts/*LiveCheck.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
