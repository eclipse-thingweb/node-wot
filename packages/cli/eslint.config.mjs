import { defineConfig, globalIgnores } from "eslint/config";
import baseConfig from "../../eslint.config.mjs";

export default defineConfig([
    baseConfig,
    globalIgnores(["src/generated/**.ts", "./import-json.js"])
])
