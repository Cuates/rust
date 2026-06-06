import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import globals from 'globals'; // Ensure this is installed

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    // Fix: 'process' is not defined in vite.config.js
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  {
    // Fix: Parsing error: Unexpected token 'as' inside Svelte components
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    // Fix: Parsing error: Unexpected token in Svelte 5 state files
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: tseslint.parser
    }
  },
  {
    rules: {
      // Add custom rules here if needed
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/']
  }
);
