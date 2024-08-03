---
layout: home
---

<HeroRow text="The general computing runtime for the decentralized web" :image="{ light: '/graphic_mainframe_4.png', dark: '/graphic_mainframe_3.png' }" tagline="Canvas is a framework that makes writing distributed & decentralized applications as easy as writing ordinary applications." v-bind:bullets="['Build on TypeScript, Postgres, and SQLite', 'User interactions are signed, replicated, and merged using a conflict-free database', 'Works with any chain or DID provider']">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

<TextRow title="About the platform">
  <TextItem>Canvas is a runtime for distributed TypeScript applications.</TextItem>
  <TextItem>Each application is defined as a <strong>contract</strong>, which defines a set of models and user actions. Contracts can be pinned to IPFS, published to Github Gists, or just hosted in your repo.</TextItem>
  <TextItem>User actions are relayed between everyone on the network, and executed by nodes who receives them. Apps use an embedded multi-writer, <a href="https://crdt.tech" target="_blank">conflict-free</a> database, so interactions are processed as they're received.</TextItem>
  <TextItem>There are no transaction delays or gas limits. Actions can call external code, fetch data, or trigger long-running computations.</TextItem>
</TextRow>

<TextRow title="Eventually-consistent mode">
  <TextItem>Unlike blockchains, Canvas runs in eventually-consistent mode by default. Each application's history is a distributed log, like Git, Bluesky, or Farcaster, and you can define custom logic for how to accept actions from the past.</TextItem>
  <TextItem>For stronger guarantees, you can run Canvas on top of a blockchain or data availability network.</TextItem>
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
  <TextItem>Canvas enables open-source applications with verifiable networked data. When you clone an application from Github, it usually comes with an empty database. We make it possible to protocolize the database, so that anyone with the application code can sync with everyone else who has used it.</TextItem>
  <TextItem>Doing this effectively is a distributed systems problem, that combines difficult parts of database engineering and realtime web programming.</TextItem>
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
