module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json"],
    },
    extends: [
        "eslint:recommended",
        "standard",
        "prettier",
        "plugin:@typescript-eslint/recommended",
        "plugin:workspaces/recommended",
    ],
    plugins: ["@typescript-eslint", "unused-imports", "workspaces", "notice"],
    env: {
        es6: true,
        node: true,
    },
    ignorePatterns: [".eslintrc.js", "dist", "node_modules", "/examples", "bin", "*.js"],
    rules: {
        "notice/notice": [
            "error",
            {
                mustMatch: "Copyright \\(c\\) [0-9]{0,4} Contributors to the Eclipse Foundation",
                templateFile: __dirname + "/license.template.txt",
                onNonMatchingHeader: "replace",
            },
        ],
        "@typescript-eslint/no-unused-vars": "off", // or "@typescript-eslint/no-unused-vars": "off",
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": ["error"],
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
            "warn",
            {
                args: "none",
                varsIgnorePattern: "Test", // Ignore test suites from unused-imports
            },
        ],
    },
};
