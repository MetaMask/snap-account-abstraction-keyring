module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  testTimeout: 20000,
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    'src/types/',
    'contracts',
    'artifacts',
  ],
  coverageThreshold: {
    './src/keyring.ts': {
      statements: 95,
      functions: 95,
      lines: 95,
    },
  },
};
