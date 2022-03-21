import fs from "node:fs"

export function getDefaultSpecTemplate(): string {
	return fs.readFileSync("examples/reddit.canvas.js", "utf-8")
}
