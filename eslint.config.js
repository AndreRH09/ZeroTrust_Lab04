// ESLint 10 flat config (CA-NF08.1). Prohíbe Bootstrap (principio VII).
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-e2e/**",
      "**/coverage/**",
      "test-results/**",
      "playwright-report/**",
      "capturas/**",
      ".aws-sam/**",
      ".specify/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["bootstrap", "bootstrap/*", "react-bootstrap"],
              message: "Bootstrap está prohibido: usar Tailwind CSS.",
            },
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["scripts/**/*.mjs", "**/build.mjs", "**/test/**/*.{ts,tsx}", "tests/**/*.{ts,mjs}"],
    rules: { "no-console": "off" },
  },
);
