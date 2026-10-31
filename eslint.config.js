import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  // Rules of hooks, plus what the React Compiler needs to hold.
  reactHooks.configs.flat.recommended,
  // A module that exports a component and something else breaks Fast Refresh.
  reactRefresh.configs.vite,
  prettier,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      // A leading underscore marks a parameter as intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
