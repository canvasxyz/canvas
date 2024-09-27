---
layout: home
---

<HeroRow text="Realtime TypeScript on a distributed log" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }">
  <HeroAction theme="brand big" text="Guide" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

Canvas is a framework for TypeScript applications, that puts your
core application logic into a durable state container like Redux,
making it possible to write reactive applications that run everywhere.

You can use it like an embedded, instant-sync database in the browser,
that syncs browser-to-server and peer-to-peer.

Write your application as a set of [model mutations](#), and
user actions are replicated in realtime, with conflicts handled
through [rollback netcode](#) or [CRDTs](#) or custom logic.

Here's an example to get started:

::: code-group

```ts [React App]
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

const { app } = useCanvas({ // [!code highlight]
  topic: "demo.canvas.xyz", // [!code highlight]
  contract,                 // [!code highlight]
})                          // [!code highlight]
```

```ts [Node.js App]
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

// From the command line: // [!code highlight]
$ canvas run contract.ts --topic demo.canvas.xyz // [!code highlight]
```

:::

## Distributed Durable Execution

Under the hood, each state container stores a compacted version of
the execution history of the application.

When new applications are started up, they catch up on history using
an [efficient sync algorithm](https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html)
that only downloads the difference of their actions.

![Replicated log](./public/gossiplog.png)

This means that users don't need to wait for a network
roundtrip before they can apply their actions locally.
Every user can apply actions on their local replica.

This makes it possible to develop realtime applications like
multiplayer games, local-first applications like Linear,
and other use cases where performance is important.

For demanding applications, you can shard an application into multiple
state containers, and state containers can be snapshotted and
compacted.

## Learn more

To build realtime sync today, you might use a hosted service like
Firebase, or write multiple implementations of custom sync code for
your server and client.

Recent improvements in databases have made it possible to
abstract much of this away. Now, you can just write your state
mutations once, and have them run isomorphically on both the frontend
and backend.

To learn more, check out our [docs](/1-introduction), or
join us on [Github](https://github.com/canvasxyz/canvas) and
[Discord](https://discord.gg/yQ5pTkAS).

<br/>

<FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="Sign in with Ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://canvas-chat-example.p2p.app/"/>
  <FeatureCard title="Sign in with Bluesky" details="Log in with your decentralized identity from the Bluesky PLC network." linkText="Demo" link="https://canvas-chat-example.p2p.app/"/>
  <FeatureCard title="Sign in with OpenID" details="Log in trustlessly with Google, Apple, or other SSO providers." soon="In development"/>
</FeatureRow>

<HomepageFooter />
