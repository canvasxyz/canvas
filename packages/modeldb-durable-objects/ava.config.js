export default {
	watchMode: {
		ignoreChanges: [".wrangler/**/*"],
	},
	files: ["./test/*.test.ts"],
	concurrency: 1,
	typescript: {
		compile: false,
		rewritePaths: {
			"test/": "test/lib/",
		},
	},
}
