import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Локальные образцы загружаемого кода и старые git-ignored smoke-скрипты.
    // Серверные регрессионные тесты в tests/ и e2e/ проверяются как обычно.
    "test-product/**",
    "scanner-test-fixtures/**",
    "test-zip-bomb.ts",
    "test-run.mjs",
    "docs/index.bleve/**",
  ]),
]);

export default eslintConfig;
