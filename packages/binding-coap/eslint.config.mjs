import rootConfig from "../../eslint.config.mjs";

export default [
    ...rootConfig,
    {
        rules: {
            "@typescript-eslint/no-unnecessary-condition": "warn",
        },
    },
];
