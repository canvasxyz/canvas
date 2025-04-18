import { defineConfig } from "vitepress"
import namedCodeBlocks from "markdown-it-named-code-blocks"
import footnote from "markdown-it-footnote"
import { getSidebar } from "./getSidebar.js"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	markdown: {
		config: (md) => {
			md.use(footnote)
			md.use(namedCodeBlocks)
		},
	},
	vite: {
		resolve: {
			preserveSymlinks: true,
		},
		ssr: {
			noExternal: ["vue3-icons"],
		},
	},
	ignoreDeadLinks: [(url) => /^\.\/[0-9]+$/.test(url)], // ignore footnote links
	title: "Canvas",
	description:
		"A TypeScript runtime for distributed applications. Build decentralized applications, using the languages and databases you already know.",
	themeConfig: {
		logo: {
			light: "/icon_logo.png",
			dark: "/icon_logo_dark.png",
		},
		outlineTitle: "Contents",
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Docs", link: "/1-introduction" },
			{ text: "Blog", link: "/blog" },
			{ text: "Changelog", link: "https://github.com/canvasxyz/canvas/releases" },
		],
		sidebar: {
			"/blog": getSidebar({
				contentRoot: "/docs",
				contentDirs: ["blog"],
			}),
			"/": [
				{
					text: "Guide",
					items: [
						{ text: "Introduction", link: "/1-introduction" },
						{ text: "Creating an Application", link: "/2-applications" },
						{ text: "Querying Data", link: "/3-querying" },
						{ text: "Identities & Auth", link: "/4-identities-auth" },
						{ text: "Running an Application", link: "/5-deployment" },
					],
				},
				{
					text: "Reference",
					items: [
						{ text: "Core", link: "/readme-core.md" },
						{ text: "CLI", link: "/readme-cli.md" },
						{ text: "Hooks", link: "/readme-hooks.md" },
						{
							text: "Components",
							collapsed: true,
							items: [
								{ text: "GossipLog", link: "/readme-gossiplog.md" },
								{ text: "ModelDB", link: "/readme-modeldb.md" },
								{ text: "Signatures", link: "/readme-signatures.md" },
								{ text: "Interfaces", link: "/readme-interfaces.md" },
								{ text: "Signer: Ethereum", link: "/readme-chain-ethereum.md" },
								{ text: "Signer: Ethereum (Viem)", link: "/readme-chain-ethereum-viem.md" },
								{ text: "Signer: Bluesky", link: "/readme-chain-atp.md" },
								{ text: "Signer: Solana", link: "/readme-chain-solana.md" },
								{ text: "Signer: Cosmos", link: "/readme-chain-cosmos.md" },
								{ text: "Signer: Substrate", link: "/readme-chain-substrate.md" },
							],
						},
					],
				},
				{
					text: "Examples",
					items: [
						{ text: "Chat", link: "/examples-chat.md" },
						{ text: "Forum", link: "/examples-forum.md" },
						{ text: "Encrypted Chat", link: "/examples-encrypted-chat.md" },
						{ text: "Server-Side Chat  🚧", link: "/examples-chat-next.md" },
					],
				},
			],
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/canvasxyz/canvas" },
			{ icon: "discord", link: "https://discord.gg/EjczssxKpR" },
			{ icon: "twitter", link: "https://twitter.com/canvas_xyz" },
		],
		search: {
			provider: "local",
		},
	},
})
