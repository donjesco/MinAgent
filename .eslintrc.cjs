module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['node'],
  extends: ['plugin:node/recommended'],
  rules: {
    'node/no-unpublished-import': 'error',
    'node/no-unsupported-features/es-syntax': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
