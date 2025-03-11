import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteStaticCopy } from "vite-plugin-static-copy"
import { existsSync } from 'fs'
import { resolve } from 'path'

const workspaceRootWasmPath = resolve(__dirname, "../../node_modules/esbuild-wasm/esbuild.wasm")
const subpackageWasmPath = resolve(__dirname, "./node_modules/esbuild-wasm/esbuild.wasm")

let wasmPath
if (existsSync(workspaceRootWasmPath)) {
	wasmPath = workspaceRootWasmPath
 } else if (existsSync(subpackageWasmPath)) {
	wasmPath = subpackageWasmPath
 } else {
	throw new Error("could not find esbuild.wasm, which is required to build network-explorer")
 }

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
					src: wasmPath,
					dest: "",
				},
			],
		}),
		react()
	],
})
