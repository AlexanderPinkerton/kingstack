import baseConfig from "@kingstack/eslint-config";

export default [
  ...baseConfig,
  {
    files: ["__tests__/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: false, project: "./tsconfig.test.json" },
    },
  },
];
