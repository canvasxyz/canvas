import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import wasm from "vite-plugin-wasm"
import { viteStaticCopy } from "vite-plugin-static-copy"

import { existsSync } from "fs"
import { resolve } from "path"

// npm puts esbuild.wasm in the workspace root node_modules, pnpm puts it in the subpackage node_modules
const inWorkspaceRoot = existsSync(resolve(__dirname, "../../node_modules/esbuild-wasm/esbuild.wasm"))

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		emptyOutDir: false,
		chunkSizeWarningLimit: 2_000_000,
	},
	base: "./",
	optimizeDeps: {
		exclude: ["@sqlite.org/sqlite-wasm", "quickjs-emscripten"],
		esbuildOptions: {
			// Node.js global to browser globalThis
			define: {
				global: "globalThis",
			},
		},
	},
	plugins: [
		viteStaticCopy({
			targets: [
				{
					src: `${inWorkspaceRoot ? "../../" : "./"}node_modules/esbuild-wasm/esbuild.wasm`,
					dest: "",
				},
			],
		}),
		wasm(),
		react(),
	],
})
