---
layout: home
---

<HeroRow text="Peer-to-peer sync for TypeScript applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }">
  <HeroAction theme="brand big" text="Guide" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

Canvas is a replicated system for instant-sync TypeScript applications,
based on a peer-to-peer database and runtime.

Write your core application logic in a [replicated contract](#),
that syncs over libp2p. Users' actions are applied and sync instantly.

You can handle conflicts with CRDTs, the data structures that Figma and Linear
use to make their UI fast. Or, resolve conflicts using MMO-style optimistic
rollback, without writing extra code.

It's fully open source, and built on SQLite, Postgres, and IndexedDB.

::: code-group

```ts [React app]
import { useCanvas } from "@canvas-js/hooks"

const contract = {
  models: {
    messages: {
      id: "primary",
      text: "string",
    }
  },
  actions: {
    createMessage: (db, { text }, { address, msgid }) => {
      db.set("messages", { id: msgid, text })
    }
  }
}

const { app } = useCanvas({ topic: "demo.canvas.xyz", contract })   // [!code highlight]
```

```ts [Node.js]
export const contract = {
  models: {
    messages: {
      id: "primary",
      text: "string"
    }
  },
  actions: {
    createMessage: (db, { text }, { address, txid }) => {
      db.set("messages", { id: txid, text })
    }
  }
}

$ canvas run contract.ts --topic demo.canvas.xyz // [!code highlight]
```

:::

<CodeGroupOpener />

## A Peer-to-peer Distributed Runtime

Every Canvas application runs on a [distributed
log](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
that stores a history of users' actions.

When new applications are started up, they catch up on history using
[efficient sync](https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html)
to catch up on the latest state.

On top of the sync layer, we've written a peer-to-peer
runtime that sandboxes users' actions, that executes them in a
deterministic environment to maintain convergence and mergeability.

![Replicated log](./public/gossiplog.png)

Now you can develop multiplayer games, local-first
applications, and realtime applications with instant
responsiveness, while maintaining strong decentralization properties.

For demanding applications, you can shard an application into
multiple state containers, and state containers can be snapshotted
and compacted as they grow.

To learn more, check out our [docs](/1-introduction), or
join us on [Github](https://github.com/canvasxyz/canvas) and
[Discord](https://discord.gg/yQ5pTkAS).

<br/>

<FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="Sign in with Ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers." soon="In development"/>
</FeatureRow>

<HomepageFooter />
