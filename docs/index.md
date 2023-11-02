---
layout: home
---

<HeroRow text="The framework for realtime decentralized applications" image="/graphic_mainframe_4.png" tagline="Build multiplayer applications where interactions sync instantly, no blockchains required." v-bind:bullets="['Realtime sync using libp2p, signed messages, and multiwriter peer-to-peer databases', 'Supports reactive views on SQLite + IndexedDB', 'Programmable in EVM + TypeScript']">
  <HeroAction theme="brand big" text="Try the tutorial" href="/1-introduction" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

<TextRow title="About Canvas">
  <TextItem>Canvas is an framework for writing realtime multiplayer applications.</TextItem>
  <TextItem>Instead of bundles of code that run on a server, applications are defined as <strong>multiplayer contracts</strong>, which interact with an embedded relational database.</TextItem>
  <TextItem>This allows complex applications to be written as a series of functions. It's like smart contracts on the blockchain, except that interactions happen instantly, and you're not limited by the chain's throughput.</TextItem>
</TextRow>

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

<FeatureRow title="Universal Signer Architecture" detail="Canvas is flexible enough to support any cryptographically verifiable auth system, including Web3 wallets, W3C DIDs, and even Apple & Google SSO.">
  <FeatureCard title="Sign in with Wallet" details="Log in with a Web3 wallet from Ethereum. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Available today" />
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers. Powered by zero-knowledge proofs." soon="Coming soon"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." soon="Coming soon"/>
</FeatureRow>

<FeatureRow title="Technical Foundations" detail="Canvas uses multiplayer data structures similar to CRDTs, the multiplayer sync technologies that power Google Docs and Figma. We've created an abstraction layer on top so it all works like a conventional database.">
  <FeatureCard title="Okra" details="A deterministic Prolly-tree that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="A history-preserving multiwriter log that allows functions to efficiently retrieve data from the past." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog"/>
  <FeatureCard title="ModelDB" details="A CRDT-friendly database abstraction over IndexedDB and SQLite, that runs in both the browser and server." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb"/>
  <FeatureCard title="Persister" details="A bundler that persists individual actions to Arweave, and rebundles them for efficient later retrieval." link="https://github.com/canvasxyz/canvas/tree/main/packages/persister-arweave"/>
</FeatureRow>

<HomepageFooter />