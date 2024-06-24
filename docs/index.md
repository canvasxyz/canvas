---
layout: home
---

<HeroRow text="General-purpose compute, built on IPFS & TypeScript" :image="{ light: '/graphic_mainframe_4.png', dark: '/graphic_mainframe_3.png' }" tagline="Write distributed applications using the languages and syntax you already know." v-bind:bullets="['Fully programmable in TypeScript', 'Comes with an embedded database & sync engine', 'Built on open web standards']">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="alt big" text="Docs" href="/readme-core" />
  <HeroAction theme="alt big" text="Blog" href="/blog" />
</HeroRow>

<!--
<FeatureRow title="Demo">
  <FeatureCard title="Messaging" details="Deploy simple applications like chat & copresence." />
  <FeatureCard title="CausalDB" details="Write complex application backends in TypeScript, in your current workflow." />
  <FeatureCard title="CausalVM" details="Build immutable applications, with code and data stored on IPFS data structures."/>
</FeatureRow>
-->

<DemoToggle v-bind:options="['Game', 'Messaging']" defaultOption="Game"></DemoToggle>

<DemoCell />

```tsx:Messaging preview
const models = {
	messages: {
		id: "primary",
		message: "string",
		timestamp: "integer",
		$indexes: [["timestamp"]],
	}
}

const actions = {
	send: (db, { message }, { address, timestamp, id }) => {
		if (!message || !message.trim()) throw new Error()
		db.set("messages", { id, message, timestamp })
	}
}

// Use the application in React
const { app } = useCanvas({
	topic: "canvas-example-public-chat"
	contract: { models, actions },
})
const messages = useLiveQuery(app, "messages", { limit: 10 })
return <div>{messages.map((message) => { ... })}</div>
```

```tsx:Game preview
const models = {
  boards: {
    id: "primary",
    position: "string",
  },
}

const actions = {
  move: async (db, { from, to }, { address, timestamp, id }) => {
    const board = await db.get("boards", "<gameid>")
    const chess = new Chess(board.position)
    const move = chess.move({ from, to, promotion: "q" })
    if (move === null) throw new Error("invalid")
    await db.set("boards", { id: "<gameid>", position: chess.fen() })
  },
  reset: async (db, {}, { address, timestamp, id }) => {
    await db.set("boards", { id: "<gameid>", fen: new Chess().fen() })
  }
}

// Use the application in React
const { app } = useCanvas({
  topic: "canvas-example-chess"
  contract: { models, actions },
})
const boards = useLiveQuery(app, "boards")
return <Chessboard position={boards[0].position} onDrop={ ... } />
```

<!--
<TextRow title="About Canvas">
  <TextItem>Canvas applications are defined as multiplayer contracts, which run on both the browser and server.</TextItem>
  <TextItem>User actions are relayed between everyone on the network, and executed by each client. They read and write from a multi-writer, <a href="https://crdt.tech" target="_blank">conflict-free</a> database, which allows interactions to be merged as they're received.</TextItem>
  <TextItem>This means that unlike blockchains, interactions on Canvas applications sync instantly, without tokens or gas limits.</TextItem>
  <TextItem>They can also call outside code, fetch external data, or process data that would be difficult or unwieldy to put onchain.</TextItem>
  <TextItem>Today, you can use Canvas as a peer-to-peer network with persistent state, for applications like chat, games, governance, and decentralized compute. Or, if you add a data availability service, you can also use it as a full-fledged decentralized apps platform.</TextItem>
</TextRow>
-->

<FeatureRow title="Distributed execution, with no blockchains required" detail="Canvas uses CRDTs, the data structures that power Google Docs & Figma, to allow any two nodes running the same application to sync with each other.">
  <FeatureCard title="Sign in with Web3 DIDs" details="Log in with an Ethereum wallet. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers." soon="Coming soon"/>
  <FeatureCard title="Okra" details="A p2p-optimized data structure called a “Prolly tree” that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="An authenticated multiwriter log that allows functions to retrieve data from multiple causal histories." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="ModelDB" details="A cross-platform relational database wrapper, supporting IndexedDB and SQLite." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
</FeatureRow>

<HomepageFooter />
