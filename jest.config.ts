export default {
  preset: "ts-jest",
  testEnvironment: "node",
  // roots: ["<rootDir>/src", "<rootDir>/test"],
  roots: ["test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "json", "node"],
  // collectCoverageFrom: ["**/test/**/*.(t|j)s"],
  coveragePathIgnorePatterns: ["./node_modules/", "./dist/", "./coverage/"],
  coverageDirectory: "./coverage",
}
