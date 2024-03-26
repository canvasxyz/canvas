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
	},
	ignoreDeadLinks: [(url) => /^\.\/[0-9]+$/.test(url)], // ignore footnote links
	title: "Canvas",
	description: "A peer-to-peer runtime for decentralized applications",
	themeConfig: {
		logo: {
			light: "/icon_logo.png",
			dark: "/icon_logo_dark.png",
		},
		outlineTitle: "Contents",
		nav: [
			{ text: "Home", link: "/" },
			{ text: "API", link: "/readme-core" },
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
					text: "Tutorial",
					items: [
						{ text: "Introduction", link: "/1-introduction" },
						{ text: "Contracts", link: "/2-contracts" },
						{ text: "Actions", link: "/3-actions" },
						{ text: "Authentication", link: "/4-authentication" },
						{ text: "Querying", link: "/5-querying" },
						{ text: "🚧 &nbsp;Deployment", link: "/6-deployment" },
						{ text: "Networking", link: "/7-networking" },
						{
							text: "Advanced Features",
							link: "/8-advanced",
							collapsed: true,
							items: [
								{ text: "Conflict Resolution", link: "/8-advanced#handling-conflicting-offline-edits" },
								{ text: "Custom Signers", link: "/8-advanced#creating-your-own-session-signer" },
								{ text: "Custom Actions", link: "/8-advanced#validating-custom-action-schemas-using-ipld" },
							],
						},
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
								{ text: "Discovery Service", link: "/readme-discovery.md" },
							],
						},
						{
							text: "Signers",
							collapsed: true,
							items: [
								{ text: "Ethereum", link: "/readme-chain-ethereum.md" },
								{ text: "Ethereum (Viem)", link: "/readme-chain-ethereum-viem.md" },
								{ text: "Bluesky/ATP", link: "/readme-chain-atp.md" },
								{ text: "Solana", link: "/readme-chain-solana.md" },
								{ text: "Cosmos", link: "/readme-chain-cosmos.md" },
								{ text: "Substrate", link: "/readme-chain-substrate.md" },
								{ text: "Near", link: "/readme-chain-near.md" },
							],
						},
						{
							text: "Integrations",
							collapsed: true,
							items: [{ text: "🚧 &nbsp;Next.js", link: "/readme-next.md" }],
						},
					],
				},
				{
					text: "Examples",
					items: [
						{ text: "Chat", link: "/examples-chat.md" },
						{ text: "Encrypted Chat", link: "/examples-encrypted-chat.md" },
						{ text: "Snake", link: "/examples-snake.md" },
						{ text: "Forum", link: "/examples-forum.md" },
						// { text: "Notes", link: "/examples-notes.md" }
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
