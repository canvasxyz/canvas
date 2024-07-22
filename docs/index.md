---
layout: home
---

<HeroRow text="The general computing platform for the decentralized web" :image="{ light: '/graphic_mainframe_4.png', dark: '/graphic_mainframe_3.png' }" tagline="Canvas is a serverless runtime for decentralized TypeScript applications." v-bind:bullets="['Write decentralized applications using idiomatic TypeScript, Postgres, and SQLite', 'Data and compute are automatically replicated using libp2p', 'Built on open web standards']">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

<!--
<FeatureRow title="Demo">
  <FeatureCard title="Messaging" details="Deploy simple applications like chat & copresence." />
  <FeatureCard title="CausalDB" details="Write complex application backends in TypeScript, in your current workflow." />
  <FeatureCard title="CausalVM" details="Build immutable applications, with code and data stored on IPFS data structures."/>
</FeatureRow>
-->

<DemoToggle v-bind:options="['Game']" defaultOption="Game"></DemoToggle>

<DemoCell />

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

<TextRow title="Distributed execution, no blockchains required">
  <TextItem>Canvas is a platform for distributed TypeScript applications. Each application defines a model, actions, and views, just like in MVC web frameworks.</TextItem>
  <TextItem>User actions are relayed between everyone on the network, and executed by each client. They read and write from a multi-writer, <a href="https://crdt.tech" target="_blank">conflict-free</a> database, which allows interactions to be merged as they're received.</TextItem>
  <TextItem>Unlike blockchains, interactions on Canvas applications sync instantly, without tokens or gas limits. They can call outside code, fetch external resources, or process data that would be difficult to put onchain.</TextItem>
</TextRow>

<FeatureRow title="Core Components" detail="">
  <FeatureCard title="Okra" details="A p2p-optimized Prolly tree that allows fast sync between ordered sets of actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="GossipLog" details="A self-authenticating causal log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="ModelDB" details="A cross-platform relational database wrapper, supporting IndexedDB and SQLite." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
</FeatureRow>

<FeatureRow title="Signers" detail="">
  <FeatureCard title="Sign in with Web3 DIDs" details="Log in with an Ethereum wallet. Also supports other chains like Cosmos, Solana, and Polkadot." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers." soon="Coming soon"/>
</FeatureRow>

<HomepageFooter />
