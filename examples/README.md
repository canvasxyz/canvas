# examples

Creating an example:

```
npm create vite@latest
```

Inside package.json, the example should be called `@canvas-js/example-[name]`.

```
pnpm install @canvas-js/chain-ethereum @canvas-js/hooks @canvas-js/templates ethers
pnpm install --save-dev vite-plugin-node-polyfills
```

Polyfills are required to use packages in the browser. Edit the Vite configuration file:

```
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { nodePolyfills } from "vite-plugin-node-polyfills"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
})
```
