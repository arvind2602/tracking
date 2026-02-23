import js from '@eslint/js';

export default [
    {
        ignores: ['node_modules/**', 'generated/**', 'eslint.config.mjs'],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],
            'no-console': ['warn', { allow: ['error', 'warn'] }],
            'no-undef': 'error',
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'warn',
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Promise: 'readonly',
                URL: 'readonly',
            },
        },
    },
];
