import fs from "fs"
import path from "path"

// https://github.com/JonathanSchndr/vitepress-plugin-auto-sidebar/blob/main/src/index.ts
interface Options {
	contentRoot?: string
	contentDirs?: string[] | null
}

function getSidebarItems(
	dir: string[],
	currentRoot: string | undefined,
	root: string | undefined,
	options: Options
): object[] {
	return dir
		.filter((e) => e.endsWith(".md") || fs.statSync(path.resolve(currentRoot ?? "/", e)).isDirectory())
		.map((e: string) => {
			const childDir = path.resolve(currentRoot ?? "/", e)
			if (fs.statSync(childDir).isDirectory()) {
				const items = getSidebarItems(fs.readdirSync(childDir), childDir, root, options)
				const fileName = e.split("/").pop() ?? ""

				return items.length
					? {
							text: (fileName.charAt(0).toUpperCase() + fileName.slice(1)).replaceAll("-", " "),
							items
					  }
					: null!
			} else if (e.endsWith(".md") && e[0] !== "_") {
				// Assume the file starts with an <h1> and use that as the sidebar title
				const file = fs.readFileSync(childDir, { encoding: "utf8", flag: "r" })
				const matches = file.match(/^\#.*/)
				const text = matches[0]
					? matches[0].replace(/# /, "")
					: (e.charAt(0).toUpperCase() + e.slice(1)).slice(0, -3).replaceAll("-", " ")

				return {
					text,
					link: childDir.replace(root ?? "", "")
				}
			}
			return null!
		})
		.filter((i) => !!i)
}

export function getSidebar(options: Options = {}) {
	options.contentRoot = options?.contentRoot ?? "/"
	options.contentDirs = options?.contentDirs?.length ? options.contentDirs : ["/"]

	options.contentRoot = path.join(process.cwd(), options.contentRoot)

	return getSidebarItems(options.contentDirs, options.contentRoot, options.contentRoot, options)
}
