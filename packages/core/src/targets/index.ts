import type { PlatformTarget } from "./interface.js"

export default (location: string | null): PlatformTarget => {
	throw new Error("unsupported platform")
}
