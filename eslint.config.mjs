import path from "path";
import { fileURLToPath } from "url";

import { defineConfig, globalIgnores } from "eslint/config";

import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";
import workspaces from "eslint-plugin-workspaces";
import notice from "eslint-plugin-notice";
import globals from "globals";
import js from "@eslint/js";
import checkFile from "eslint-plugin-check-file";

import extraneousDependencies from "eslint-plugin-import";
import { FlatCompat } from "@eslint/eslintrc";
import nodePlugin from "eslint-plugin-n";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    ...compat.extends(
        "eslint:recommended",
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:workspaces/recommended",
        "plugin:n/recommended"
    ),
    //
    nodePlugin.configs["flat/recommended-script"],
    {
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: ["./tsconfig.eslint.json"],
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            "unused-imports": unusedImports,
            workspaces,
            notice,
            "extraneous-dependencies": extraneousDependencies,
            n: nodePlugin,
            "check-file": checkFile,
        },

        rules: {
            // *************** Ensure that copyright notice is present ***************
            "notice/notice": [
                "error",
                {
                    mustMatch: "Copyright \\(c\\) [0-9]{0,4} Contributors to the Eclipse Foundation",
                    templateFile: __dirname + "/license.template.txt",
                    onNonMatchingHeader: "replace",
                },
            ],

            // *************** NodeJS specific rules - relaxing default setting of n  ***************
            "n/no-path-concat": "error",
            "n/no-unsupported-features/es-syntax": [
                "error",
                {
                    ignores: ["modules"],
                },
            ],

            // relax missing import rule to warning, as we sometimes have optional dependencies
            // import "../foo" will braise a warning ,
            // import "../foo.js" is the correct way to import a file that may not exist
            "n/no-missing-import": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1428

            "n/no-unsupported-features/node-builtins": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "n/no-extraneous-import": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "n/no-deprecated-api": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "n/no-unpublished-import": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "n/no-process-exit": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "n/hashbang": "warn",

            // *************** Ensure that only used dependencies are imported ***************
            "extraneous-dependencies/no-extraneous-dependencies": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430

            // *************** Code style and best practices ***************
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "off", // // https://github.com/eclipse-thingweb/node-wot/issues/1430
                {
                    args: "none",
                    varsIgnorePattern: "Test",
                },
            ],

            // **************** enforece kebab-case for filenames ****************
            "check-file/filename-naming-convention": [
                "error",
                {
                    "**/*.{js,ts}": "KEBAB_CASE",
                },
                {
                    ignoreMiddleExtensions: true,
                },
            ],
            "check-file/folder-naming-convention": [
                "error",
                {
                    "**/*": "KEBAB_CASE",
                },
            ],
            // *************** Customization of other typescript rules ***************
            "@typescript-eslint/no-use-before-define": "error",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/no-require-imports": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "@typescript-eslint/prefer-nullish-coalescing": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "@typescript-eslint/no-empty-object-type": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430
            "@typescript-eslint/no-floating-promises": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430

            // ****************  Enforce usage of `const` over `let` wherever possible, to prevent accidental reassignments
            "prefer-const": "off", // https://github.com/eclipse-thingweb/node-wot/issues/1430

            // *************** Other rules ***************
            "no-restricted-globals": "error",
            "no-restricted-properties": "error",

            "no-use-before-define": "error",

            "no-unused-private-class-members": "error",
            "no-prototype-builtins": "off",
            "no-case-declarations": "off",

            "no-console": "error",
            // ***************** Enforce that for-in loops include an if statement to filter properties from the prototype chain
            "guard-for-in": "error",
        },
    },
    globalIgnores([
        "utils/*",
        "packages/browser-bundle/types/index.d.ts",
        "packages/*/eslint.config.mjs",
        "eslint.config.mjs",
        "packages/browser-bundle/web-test-runner.config.mjs",
        "**/.eslintrc.js",
        "**/dist",
        "**/node_modules",
        "examples",
        "**/bin",
        "**/*.js",
    ]),
]);
