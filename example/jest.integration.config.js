/**
 * Jest configuration for integration tests
 * These tests connect to real gRPC servers
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|grpc-react-native)/)',
  ],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/node_modules/react-native',
  },
  // Integration tests may take longer
  testTimeout: 30000,
  verbose: true,
  // Don't force exit - we want to see if there are open handles
  forceExit: false,
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration.setup.js'],
};
