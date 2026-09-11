module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint/eslint-plugin", "import"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [".eslintrc.js", "dist", "node_modules"],
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "prettier/prettier": ["error", { "endOfLine": "auto" }],
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "./src",
            from: "../frontend",
            message:
              "Strict Isolation: backend cannot import directly from frontend. Communication must strictly happen via HTTP / OpenAPI contracts.",
          },
        ],
      },
    ],
  },
};
