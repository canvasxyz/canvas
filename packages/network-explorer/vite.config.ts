import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteStaticCopy } from "vite-plugin-static-copy"

// debug
import { existsSync } from "fs"
import { resolve } from "path"

const workspaceRootWasmPath = resolve(__dirname, "../../node_modules/esbuild-wasm/esbuild.wasm")
const subpackageWasmPath = resolve(__dirname, "./node_modules/esbuild-wasm/esbuild.wasm")

console.log("workspace root:", existsSync(workspaceRootWasmPath))
console.log("subpackage path:", existsSync(subpackageWasmPath))

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		emptyOutDir: false,
	},
	base: "./",
	plugins: [
		viteStaticCopy({
			targets: [
				{
					src: "../../node_modules/esbuild-wasm/esbuild.wasm",
					dest: "",
				},
			],
		}),
		react(),
	],
})
