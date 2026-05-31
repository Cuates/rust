import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    rules: {
      // Add custom rules here if needed
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/']
  }
);