import js from "@eslint/js";
import pluginRouter from "@tanstack/eslint-plugin-router";
import reactDom from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      // v7 moved the flat configs under `configs.flat.*`; the top-level keys
      // are now the eslintrc-format ones and are rejected by ESLint 10.
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
      reactDom.configs.recommended,
      pluginRouter.configs["flat/recommended"],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
      // eslint-plugin-react-hooks v7 enables the React Compiler rule set.
      // These flag genuine pre-existing patterns rather than upgrade fallout,
      // so keep them visible as warnings and address them separately.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      complexity: [
        "warn",
        {
          max: 30,
        },
      ],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
      "max-nested-callbacks": ["warn", 10],
      "no-debugger": ["warn"],
      "no-var": ["warn"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "no-param-reassign": [
        "warn",
        {
          props: true,
          ignorePropertyModificationsFor: [
            "map",
            "view",
            "mapView",
            "sceneView",
          ],
        },
      ],
    },
  },
  {
    // TanStack Router file routes export a `Route` const built by
    // createFileRoute() next to the components it references. That is the
    // framework's prescribed shape, and react-refresh v0.5's `localComponents`
    // check flags it in every route module, so scope the rule out here while
    // leaving it enforced for ordinary components.
    files: ["src/routes/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
