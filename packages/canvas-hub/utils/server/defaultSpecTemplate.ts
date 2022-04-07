import fs from "node:fs"

export function getDefaultSpec(): string {
	const template = fs.readFileSync("../../examples/reddit.canvas.js", "utf-8")
	const date = new Date()
	const header = `// Created on ${date.toDateString()} at ${date.toTimeString()}`
	return `${header}\n\n${template}`
}
