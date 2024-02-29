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
  threshold: {
    global: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },
};
