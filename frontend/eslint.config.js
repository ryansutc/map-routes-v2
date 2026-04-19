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
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
      reactDom.configs.recommended,
      pluginRouter.configs["flat/recommended"],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    rules: {
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
]);
