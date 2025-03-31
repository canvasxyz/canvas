import typescriptEslint from "@typescript-eslint/eslint-plugin"
import _import from "eslint-plugin-import"
import { fixupPluginRules } from "@eslint/compat"
import globals from "globals"
import tsParser from "@typescript-eslint/parser"
import path from "node:path"
import { fileURLToPath } from "node:url"
import js from "@eslint/js"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

export default [
	{
		ignores: [
			"**/webpack.config.js",
			"**/*.d.ts",
			"**/.next/**",
			"**/dist/**/*.js",
			"**/lib/**/*.js",
			"**/build/**/*.js",
			"**/.vitepress/**/*.js",
			"**/.next/**/*.js",
			"**/.wrangler/**/*.js",
		],
	},
	...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"),
	{
		plugins: {
			"@typescript-eslint": typescriptEslint,
			import: fixupPluginRules(_import),
		},

		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},

			parser: tsParser,
		},

		settings: {
			"import/parsers": {
				"@typescript-eslint/parser": [".ts", ".tsx"],
			},

			"import/resolver": {
				node: {},

				typescript: {
					project: ["./tsconfig.json", "./packages/*/tsconfig.json"],
				},
			},
		},

		rules: {
			eqeqeq: ["error", "smart"],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-empty-interface": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"@typescript-eslint/no-unsafe-function-type": "error",
			"@typescript-eslint/no-wrapper-object-types": "error",
			"no-empty-pattern": "off",
			"no-empty": "off",
			"require-yield": "off",
		},
	},
	{
		files: ["**/*.canvas.js"],

		rules: {
			"no-undef": "off",
		},
	},
]
