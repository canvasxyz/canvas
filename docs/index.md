---
layout: home
---

<HeroRow text="General computing for the decentralized web" :image="{ light: '/graphic_mainframe_4.png', dark: '/graphic_mainframe_3.png' }" tagline="Canvas is a peer-to-peer framework that makes writing distributed applications as easy as writing ordinary applications." v-bind:bullets="['Open-source devs: Build applications with data that syncs automatically between peers', 'Blockchain devs: Write decentralized applications with just TypeScript', 'User interactions are signed, replicated, and merged using a conflict-free database']">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

<TextRow title="About the platform">
  <TextItem>Canvas is a framework for distributed TypeScript applications.</TextItem>
  <TextItem>Each application is a contract, which defines backend actions and a database. Contracts are entirely distributed, and can be pinned to IPFS, hosted as a Github Gist, or just included as a file in your repo.</TextItem>
  <TextItem>Everyone with the contract can run a replica of the application, and sync with the entire history of everyone else who has used it.</TextItem>
  <TextItem>Contracts use an embedded, multi-writer, <a href="https://crdt.tech" target="_blank">conflict-free</a> database. Each application has its own network over libp2p, where actions are confirmed immediately, without consensus.
  </TextItem>
  <TextItem>Actions can call external code, fetch data, or trigger long-running computations.</TextItem>
</TextRow>

<TextRow title="Eventually-consistent mode">
  <TextItem>Unlike blockchains, Canvas runs in eventually-consistent mode by default. Each application's history is a distributed log similar to Git.</TextItem>
  <TextItem>For developers who prefer, you can run Canvas on a blockchain or data availability network to get consensus guarantees.</TextItem>
</TextRow>


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

<TextRow title="Built for the open web">
  <TextItem>When you clone an application from Github, it usually comes with an empty database. Peer-to-peer sync makes it possible to verifably replicate the database, so that anyone with a copy of the application can sync with everyone else who has used it.</TextItem>
  <TextItem>This makes it possible to create open-source applications with verifiable networked data, that can live forever, as long as at least one person has a copy of the application.</TextItem>
  <TextItem>We started working on it after years of experience at tech startups, research labs, and after building Web3 applications used by tens of thousands of people.</TextItem>
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
