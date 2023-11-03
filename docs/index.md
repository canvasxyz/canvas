---
layout: home
---

<HeroRow text="The framework for realtime decentralized applications" image="/graphic_mainframe_4.png" tagline="Build multiplayer applications where interactions sync instantly, no blockchains required." v-bind:bullets="['Realtime sync engine using libp2p and signed messages', 'Reactive views on SQLite + IndexedDB', 'Programmable in EVM + TypeScript']">
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
// Write by creating actions
const { app } = useCanvas({
	contract: { ...PublicChat, topic: "canvas-example-public-chat" },
	signers: [new SIWESigner({ signer: wallet })],
})

app.actions.sendMessage({ message })

// Read with live reactive queries
const messages = useLiveQuery<Message>(app, "messages", {
	limit: 5,
	orderBy: { timestamp: "desc" },
})

return <div>{messages.map((message) => <div>{message.title}</div>)}</div>
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
  <TextItem>Canvas is a new architecture for multiplayer applications, that combines modern web technology with high-performance decentralized infrastructure.</TextItem>
  <TextItem>Instead of bundles of code that run on a server, applications are defined as <em>multiplayer contracts</em>, which can run in the browser or on the server.</TextItem>
  <TextItem>Contracts are written in TypeScript, and have a access to an embedded multi-writer relational database, built on SQLite and IndexedDB. They can also access external data or call external code, and are easy to upgrade.</TextItem>
  <TextItem>Since they run on peer-to-peer networking without a blockchain for consensus, actions can be applied as soon as they're received.</TextItem>
  <TextItem>If you add a storage or data availability network, like Arweave, Celestia, or Filecoin, you can use Canvas as a scalable decentralized app platform. Or, you can use it as a dynamic peer-to-peer network, to build applications like chat, state channels, and minigames with persistent state.</TextItem>
</TextRow>

<FeatureRow title="Interoperable Everywhere" detail="Canvas supports any cryptographically verifiable authentication system, like Web3 wallets, W3C DIDs, and even Apple & Google SSO.">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Available today" />
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network."/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers. Powered by zero-knowledge proofs." soon="Coming soon"/>
</FeatureRow>

<FeatureRow title="Built on Real-Time Collaboration Research" detail="We've created a set of modules that abstract away the complex parts of conflict-free data structures, the same ones that power Google Docs and Figma, so they can be used like a conventional database. You can check them out here:">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="A history-preserving multiwriter log that allows functions to efficiently retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" soon="Blog post coming soon"/>
  <FeatureCard title="ModelDB" details="A CRDT-friendly database abstraction over IndexedDB and SQLite, that runs in both the browser and server." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
  <FeatureCard title="Persister" details="A bundler that persists individual actions to Arweave, and rebundles them for efficient later retrieval." link="https://github.com/canvasxyz/canvas/tree/main/packages/persister-arweave"/>
</FeatureRow>

<HomepageFooter />