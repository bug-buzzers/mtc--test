import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Existing client pages intentionally derive view state from fetched data in effects.
    'react-hooks/set-state-in-effect': 'off',
  } },
  globalIgnores(['.next/**', 'node_modules/**', 'data/**']),
]);
