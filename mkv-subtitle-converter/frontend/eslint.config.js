import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import globals from 'globals'; // Ensure this is installed

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    // Fix: 'process' is not defined in vite.config.ts
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __COMMIT_HASH__: 'readonly',
        __BUILD_DATE__: 'readonly',
        __TAURI_VERSION__: 'readonly',
        __SVELTE_VERSION__: 'readonly',
        __NODE_VERSION__: 'readonly'
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
      'svelte/no-navigation-without-resolve': 'off'
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/']
  }
);
