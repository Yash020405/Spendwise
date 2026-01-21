module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/server/'],
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    '!**/node_modules/**',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js,jsx}'],
  moduleNameMapper: {
    '^expo-constants$': '<rootDir>/__tests__/__mocks__/expo-constants.js',
    '^expo-router$': '<rootDir>/__tests__/__mocks__/expo-router.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__tests__/__mocks__/async-storage.js',
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.js',
    '^react$': '<rootDir>/node_modules/react',
  },
};
