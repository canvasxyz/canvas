module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  root: true,
  env: {
    browser: true,
    node: true,
  },
  ignorePatterns: ["*.d.ts", "**/dist/**/*.js", "**/lib/**/*.js"],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"]
    },
    "import/resolver": {
      node: {},
      typescript: {
        project: [
          "./tsconfig.json",
          "./packages/*/tsconfig.json",
          "./packages/*/tsconfig.test.json"
        ]
      }
    }
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  }
};
