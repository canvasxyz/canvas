---
layout: home
---

<HeroRow text="Distributed execution for TypeScript applications" :image="{ light: '/graphic_jellyfish.png', dark: '/graphic_jellyfish.png' }">
  <HeroAction theme="brand big" text="Tutorial" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

Canvas is a runtime for writing distributed TypeScript applications,
where each application is verifiable, interoperable, and syncs in realtime
over the open web.

A Canvas application defines a database, and a set of actions
that work like React state transitions:

```ts
export const models = {
	messages: {
		id: "primary",
		text: "string"
	}
}

export const actions = {
	createMessage: (db, { text }, { address, txid }) => {
		db.set("messages", { id: txid, text })
	}
}
```

```
$ canvas run contract.js
Running on localhost:8000...
```

Every application runs on top of a Git-like distributed log.
Users' actions are applied wherever the local instance of the
application is running (in the browser, or on a server).

The framework handles reconciliation, to guarantee that actions
execute exactly the same, whenever or wherever they're received.
It also handles sync if you provide a WebSocket or libp2p address:

```ts
import { useCanvas } from "@canvas-js/hooks"

const models = {} // ...
const actions = {} // ...

const { app } = useCanvas({
	topic: "demo.canvas.xyz",
	contract: { models, actions },
	peers: ["ws://canvas-demo-backend.fly.io:8000"],
})
```

This will sync the application hosted at `canvas-demo-backend.fly.io`
into your browser.

Unlike blockchain-based distributed applications, Canvas applications have
somewhat different properties:

* **Realtime multiplayer**: Actions sync in real time. If you're
familiar with Figma, Notion, or Google Docs' multiplayer capabilities,
Canvas gives you similar capabilities.
* **TypeScript-based**: Build on millions of packages from NPM & Github.
* **No crypto required**. For building apps, not launching tokens.
* **No consensus algorithm**. Developers define how they want to
  handle consensus and actions from the past.
* **Define your own conflict resolution**. When multiple writers
  edit the database concurrently, you can define custom conflict
  resolution strategies (e.g. CRDTs, or surface conflicts to the user).
* **Unlimited throughput**. Applications run as fast as your server,
  without waiting for consensus.

In general, it's appropriate for non-financial applications.

### Reconciling History

Each Canvas application executes over a distributed log. By default,
anyone can add branches to any point in the log, and different nodes
might be appending to different branches of the log at any time:

```
```

When nodes diverge on their interpretation of history, new branches
may be added anywhere in the history of the application, including in
the past.

To resolve this, we have a few options:

* Some applications are fine without strong protections against
  backdated actions. We expose an `indexed_at` field that can be
  used to detect actions sent from the past. This lets you use Canvas
  as a replicated database with TypeScript transactions.
* Some applications may wish to run with a coordinator node. This
  means that other nodes will only peer with the coordinator. This
  lets you provide stronger guarantees against backdated actions, while
  preserving the verifiable, interoperable backend.
* Other applications may wish to use a timestamping service or
  data availability network to finalize actions. We're in
  touch with teams about making this possible.


<FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A p2p-optimized Prolly tree that allows fast sync between ordered actions." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating causal log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IndexedDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="Sign in with Ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." linkText="Demo" link="https://canvas-chat.pages.dev/"/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers." soon="In development"/>
</FeatureRow>

<HomepageFooter />
