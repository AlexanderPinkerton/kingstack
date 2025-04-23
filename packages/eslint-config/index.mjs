import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';


const ts_lint_config = tseslint.config({
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
    plugins: {
        prettier: eslintPluginPrettier,
    },
    rules: {
        ...eslintConfigPrettier.rules,
        'prettier/prettier': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        // '@typescript-eslint/no-floating-promises': 'warn',
        // '@typescript-eslint/no-unsafe-argument': 'warn',
    },
});

export default [
    ...tseslint.configs.recommended,
    ...ts_lint_config,
]
