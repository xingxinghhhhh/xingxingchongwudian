module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  modulePathIgnorePatterns: ["<rootDir>/dist", "<rootDir>/web/.next"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: ["src/**/*.(t|j)s"],
  testEnvironment: "node"
};
