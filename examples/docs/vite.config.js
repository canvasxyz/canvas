import { defineConfig } from "vite"
import wasm from "vite-plugin-wasm"
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
	// ...other config settings
	plugins: [nodePolyfills({ globals: { Buffer: true } }), wasm()],
	server: {
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	build: {
		minify: false,
	},
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm"],
		esbuildOptions: {
			// Node.js global to browser globalThis
			define: {
				global: "globalThis",
			},
		},
	},
})
