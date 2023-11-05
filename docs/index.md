---
layout: home
---

<HeroRow text="The general computing platform for the decentralized web" image="/graphic_mainframe_4.png" tagline="Build multiplayer applications, no blockchains required." v-bind:bullets="['Built on a realtime sync engine for libp2p and signed messages', 'Embedded SQLite + IndexedDB', 'Fully programmable in TypeScript + EVM']">
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

<DemoToggle v-bind:options="['Messaging', 'Gaming']" defaultOption="Messaging"></DemoToggle>

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

const { app } = useCanvas({
	contract: { models, actions },
	topic: "canvas-example-public-chat"
})

await app.actions.send({ message })
```

```tsx:Gaming preview
// Write by creating actions
const { app } = useCanvas({
	contract: { ...Forum, topic: "canvas-example-forum" },
	signers: [new SIWESigner({ signer: wallet })],
})

app.actions.createThread({ title, message })

// Read with live reactive queries
const threads = useLiveQuery<Thread>(app, "threads", {
	limit: 5,
	orderBy: { timestamp: "desc" },
})

return <div>{threads.map((thread) => <div>{thread.title}</div>)}</div>
```

<TextRow title="About Canvas">
  <TextItem>Canvas is a framework for writing any web application as a decentralized protocol, running over a peer-to-peer network.</TextItem>
  <TextItem>Instead of code running on a single hosted backend, Canvas applications are defined as <strong>TypeScript contracts</strong>, which run on both the browser and server.</TextItem>
  <TextItem>When users interact with the application, their actions are relayed between everyone on the network. They execute at the edge, where they can also access data or call external code.</TextItem>
  <TextItem>You can use it as a peer-to-peer network with dynamic, persistent state, for applications like chat, presence, and games. Or you can add a data availability service, which turns it into a full-fledged decentralized app platform.</TextItem>
</TextRow>

<FeatureRow title="Interoperable Everywhere" detail="Canvas supports any cryptographically verifiable authentication system, like Web3 wallets, W3C DIDs, and even Apple & Google SSO. You can write your own custom adapters to support other authorization methods.">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Available today" />
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network."/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers, using zero-knowledge proofs." soon="Coming soon"/>
</FeatureRow>

<FeatureRow title="Built on Real-Time Collaboration Research" detail="We've created a set of modules that use the latest research in collaborative data structures, the same tech that powers Google Docs and Figma, to combine them with conventional databases. Learn more here:">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="A history-preserving multiwriter log that allows functions to efficiently retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" soon="Blog post coming soon"/>
  <FeatureCard title="ModelDB" details="A CRDT-friendly database abstraction over IndexedDB and SQLite, that runs in both the browser and server." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
  <FeatureCard title="Persister" details="A bundler that persists individual actions to Arweave, and rebundles them for efficient later retrieval." link="https://github.com/canvasxyz/canvas/tree/main/packages/persister-arweave"/>
</FeatureRow>

<HomepageFooter />