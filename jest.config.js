module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'd.ts'],
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {},
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!<rootDir>/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 99,
      statements: 98,
    },
  },
  coverageReporters: ['text'],
};
