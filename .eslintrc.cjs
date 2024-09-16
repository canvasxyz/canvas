module.exports = {
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	plugins: ["@typescript-eslint", "import"],
	parser: "@typescript-eslint/parser",
	root: true,
	env: {
		browser: true,
		node: true,
	},
	ignorePatterns: ["webpack.config.js", "*.d.ts", "**/dist/**/*.js", "**/lib/**/*.js"],
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
		"no-empty-pattern": "off",
		"no-empty": "off",
		"require-yield": "off",
		"@typescript-eslint/ban-types": [
			"error",
			{
				extendDefaults: true,
				types: { "{}": false },
			},
		],
	},
	overrides: [
		{
			files: ["*.canvas.js"],
			rules: {
				// this rule is disabled because canvas contract have global values
				// injected into the vm, such as `ethersComputeAddress`
				"no-undef": "off",
			},
		},
	],
}
