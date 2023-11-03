import { defineConfig } from "vitepress"
import namedCodeBlocks from "markdown-it-named-code-blocks"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	markdown: {
		config: (md) => {
			md.use(namedCodeBlocks)
		},
	},
	vite: {
		resolve: {
			preserveSymlinks: true,
		},
	},
	title: "Canvas",
	description: "An instant-sync engine for decentralized applications",
	themeConfig: {
		logo: "/logo.png",
		outlineTitle: "Contents",
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Introduction", link: "/1-introduction" },
		],
		sidebar: [
			{
				text: "Tutorial",
				items: [
					{ text: "Introduction", link: "/1-introduction" },
					{ text: "Contracts", link: "/2-contracts" },
					{ text: "Actions", link: "/3-actions" },
					{ text: "Authentication", link: "/4-authentication" },
					{ text: "Querying", link: "/5-querying" },
					{ text: "Advanced Features", link: "/6-advanced" },
				],
			},
			{
				text: "Reference",
				items: [
					{ text: "CLI", link: "/readme-cli.md" },
					{ text: "Core", link: "/readme-core.md" },
					{ text: "GossipLog", link: "/readme-gossiplog.md" },
					{ text: "Hooks", link: "/readme-hooks.md" },
					{ text: "ModelDB", link: "/readme-modeldb.md" },
					{ text: "Signed CID", link: "/readme-signed-cid.md" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/canvasxyz/canvas" },
			{ icon: "discord", link: "https://discord.gg/2Dc7nPUz" },
			{ icon: "twitter", link: "https://twitter.com/canvas_xyz" },
		],
	},
})
