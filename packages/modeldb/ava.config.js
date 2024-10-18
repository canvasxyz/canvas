export default {
	watchMode: {
		ignoreChanges: ["test/server/vite.config.js*", ".wrangler/**/*"],
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
