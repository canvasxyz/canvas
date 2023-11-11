---
layout: home
---

<HeroRow text="The peer-to-peer TypeScript application runtime" :image="{ light: '/graphic_mainframe_4.png', dark: '/graphic_mainframe_3.png' }" tagline="Canvas is a stack for building any web application as a protocol running over peer-to-peer networking, with no blockchains required." v-bind:bullets="['Embed core application logic in a realtime, multiwriter database', 'Fast sync using p2p data structures', 'Fully programmable in TypeScript']">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

<!--
<FeatureRow title="Demo">
  <FeatureCard title="Messaging" details="Deploy simple applications like chat & copresence." />
  <FeatureCard title="CausalDB" details="Write complex application backends in TypeScript, in your current workflow." />
  <FeatureCard title="CausalVM" details="Build immutable applications, with code and data stored on IPFS data structures."/>
</FeatureRow>
-->

<TextRow title="How it Works">
  <TextItem>Canvas allows you to write fast, data-heavy decentralized applications by expressing the core logic of your application as a series of functions, which have access to a relational database.</TextItem>
  <TextItem>Applications run entirely over libp2p, with data stored on each node, using an invisible CRDT layer that reconciles input from different actors.</TextItem>
  <TextItem>It's like smart contracts, but without the blockchain. And you don't need to learn a new language, or new data structures - it just works, like writing a web application in Rails or Next.js.</TextItem>
</TextRow>

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
		db.messages.set({ id, message, timestamp })
	}
}

// Use the application in React
const { app } = useCanvas({
	contract: { models, actions },
	topic: "canvas-example-public-chat"
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
    const board = await db.boards.get("<gameid>")
    const chess = new Chess(board.position)
    const move = chess.move({ from, to, promotion: "q" })
    if (move === null) throw new Error("invalid")
    await db.boards.set({ id: "<gameid>", position: chess.fen() })
  },
  reset: async (db, {}, { address, timestamp, id }) => {
    await db.boards.set({ id: "<gameid>", fen: new Chess().fen() })
  }
}

// Use the application in React
const { app } = useCanvas({
  contract: { models, actions },
  topic: "canvas-example-chess"
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

<FeatureRow title="Interoperable Everywhere" detail="Canvas supports any cryptographically verifiable authentication strategy, including Web3 wallets, W3C DIDs, and even Apple & Google SSO. You can write your own custom adapters to support other authorization methods.">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Available today" />
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network."/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers, using zero-knowledge proofs." soon="Coming soon"/>
</FeatureRow>

<FeatureRow title="Built on Real-Time Collaboration" detail="Canvas is built on a realtime multiplayer database, that uses the same technology that powers Google Docs and Figma. We've abstracted away most of the complexity in these open-source modules below.">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="A decentralized, authenticated multiwriter log that allows functions to retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" soon="Blog post coming soon"/>
  <FeatureCard title="ModelDB" details="A cross-platform relational database wrapper, supporting IndexedDB and SQLite." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
  <FeatureCard title="Persister" details="A bundler that persists individual actions to Arweave, and rebundles them for efficient later retrieval." link="https://github.com/canvasxyz/canvas/tree/main/packages/persister-arweave"/>
</FeatureRow>

<HomepageFooter />