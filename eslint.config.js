import frontendConfig from './apps/frontend/eslint.config.js'
import serverConfig from './apps/server/eslint.config.js'
import globals from 'globals'

// Root ESLint config to support lint-staged running from repo root.
// It composes the workspace configs so `eslint` works anywhere.
export default [
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  // Ensure Node globals for root JS scripts (e.g., scripts/*.mjs)
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {},
  },
  ...frontendConfig,
  ...serverConfig,
]
