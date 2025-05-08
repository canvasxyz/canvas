import { defineConfig } from "vitepress"
import namedCodeBlocks from "markdown-it-named-code-blocks"
import footnote from "markdown-it-footnote"
import checkbox from "markdown-it-checkbox"
import { getSidebar } from "./getSidebar.js"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	markdown: {
		config: (md) => {
			md.use(footnote)
			md.use(namedCodeBlocks)
			md.use(checkbox)
		},
	},
	vite: {
		resolve: {
			preserveSymlinks: true,
		},
		ssr: {
			noExternal: ["vue3-icons"],
		},
		define: {
			__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
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
			{ text: "Roadmap", link: "/ref/roadmap" },
		],
		sidebar: {
			"/blog": getSidebar({
				contentRoot: "/docs",
				contentDirs: ["blog"],
			}),
			"/": [
				{
					text: "Quickstart",
					items: [
						{ text: "Introduction", link: "/1-introduction" },
						{ text: "Creating an Application", link: "/2-applications" },
						{ text: "Querying Data", link: "/3-querying" },
						{ text: "Authenticating Users", link: "/4-identities-auth" },
						{ text: "Managing Sessions", link: "/5-managing-sessions" },
						{ text: "Deploying Peers", link: "/6-deploying" },
						{ text: "Upgrading Applications", link: "/7-upgrading" },
					],
				},
				{
					text: "Reference",
					items: [
						// { text: "Application API", link: "/ref/application" },
						// { text: "Database API", link: "/ref/database" },
						// { text: "FAQ", link: "/ref/faq" },
						{ text: "Consistency Model", link: "/ref/consistency" },
						{ text: "Roadmap", link: "/ref/roadmap" },
						{
							text: "Packages",
							collapsed: true,
							items: [
								{ text: "Core", link: "/api/core" },
								{ text: "CLI", link: "/api/cli" },
								{ text: "Hooks", link: "/api/hooks" },
								{ text: "ModelDB", link: "/api/modeldb" },
								{ text: "GossipLog", link: "/api/gossiplog" },
								{ text: "Signatures", link: "/api/signatures" },
								{ text: "Interfaces", link: "/api/interfaces" },
								// { text: "Client", link: "/api/client" },
								// { text: "Relay Server", link: "/api/relay-server" },
								// { text: "VM", link: "/api/vm" },
								{ text: "Signer: Ethereum", link: "/api/signer-ethereum" },
								{ text: "Signer: Ethereum (Viem)", link: "/api/signer-ethereum-viem" },
								{ text: "Signer: Bluesky", link: "/api/signer-atp" },
								{ text: "Signer: Solana", link: "/api/signer-solana" },
								{ text: "Signer: Cosmos", link: "/api/signer-cosmos" },
								{ text: "Signer: Substrate", link: "/api/signer-substrate" },
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
						{ text: "Server-Side Chat", link: "/examples-chat-next.md" },
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
