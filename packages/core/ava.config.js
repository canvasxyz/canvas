export default {
	files: ["./test/*.test.ts", "./test/replicated/*.test.ts"],
	concurrency: 1,
	typescript: {
		compile: false,
		rewritePaths: {
			"test/": "test/lib/",
		},
	},
}
