module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  root: true,
  env: {
    browser: true,
    node: true,
  },
  ignorePatterns: [
    "webpack.config.js",
    "*.d.ts",
    "*.cts",
    "**/dist/**/*.js",
    "**/lib/**/*.js",
    "**/out/**/*.js",
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      node: {},
      typescript: {
        project: [
          "./tsconfig.json",
          "./packages/*/tsconfig.json",
          "./packages/*/tsconfig.test.json",
        ],
      },
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "no-empty-pattern": "off",
    "@typescript-eslint/ban-types": [
      "error",
      {
        "extendDefaults": true,
        "types": { "{}": false },
      },
    ],
  },
};
