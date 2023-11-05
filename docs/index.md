---
layout: home
---

<HeroRow text="The multiplayer computing platform for the decentralized web" image="/graphic_mainframe_4.png" tagline="A peer-to-peer stack for building web applications as decentralized protocols, with no blockchains required." v-bind:bullets="['Built on realtime sync for libp2p and signed data', 'Comes with embedded SQLite + IndexedDB', 'Fully programmable in TypeScript']">
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
  <TextItem>Instead of code running on a single hosted backend, Canvas applications are defined as TypeScript functions, running on both the browser and server.</TextItem>
  <TextItem>When users interact with the application, their actions are relayed between everyone on the network and executed by each client, using the same technology that powers multiplayer game engines.</TextItem>
  <TextItem>It's like smart contracts on the blockchain, except you can get started without learning a new language, issuing a token, or solving scalability issues.</TextItem>
  <TextItem>For decentralized app developers today, you can use Canvas as a peer-to-peer network with state sync for applications like chat, games, and governance. Or, if you add a data availability service, you can use it as a fully-fledged decentralized app platform.</TextItem>
</TextRow>

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