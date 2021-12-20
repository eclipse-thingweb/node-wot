module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json"],
    },
    extends: ["eslint:recommended", "standard", "prettier", "plugin:@typescript-eslint/recommended"],
    plugins: ["@typescript-eslint", "unused-imports", "workspaces"],
    env: {
        es6: true,
        node: true,
    },
    ignorePatterns: [".eslintrc.js", "dist", "node_modules", "/examples", "bin"],
    rules: {
        "workspaces/no-relative-imports": "error",
        "@typescript-eslint/no-unused-vars": "off", // or "@typescript-eslint/no-unused-vars": "off",
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
