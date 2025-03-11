import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteStaticCopy } from "vite-plugin-static-copy"

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
