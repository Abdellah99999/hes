module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'src/api/generated'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'import', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './src',
            from: '../api',
            message: 'Strict Isolation: apps/web cannot import directly from apps/api. Communication must strictly happen via HTTP / OpenAPI contracts.',
          },
        ],
      },
    ],
  },
};
