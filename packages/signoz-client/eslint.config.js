const tseslint = require("typescript-eslint");

module.exports = tseslint.config(...tseslint.configs.recommended, {
  ignores: ["dist/*", "eslint.config.js"],
});
