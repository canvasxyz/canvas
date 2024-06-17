import { defineConfig } from "vite"

import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
	// ...other config settings
	plugins: [nodePolyfills({ globals: { Buffer: true } })],
	build: {
		minify: false,
	},
	optimizeDeps: {
		esbuildOptions: {
			// Node.js global to browser globalThis
			define: {
				global: "globalThis",
			},
		},
	},
})
