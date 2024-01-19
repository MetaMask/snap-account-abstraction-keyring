module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest',
  },
  testEnvironment: 'jest-environment-hardhat',
  testTimeout: 20000,
};
