---
layout: home
---

<HeroRow text="Realtime multiplayer TypeScript applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }">
  <HeroAction theme="brand big" text="Guide" href="/1-introduction" />
  <HeroAction theme="brand big" text="Blog" href="/blog" />
  <HeroAction theme="alt big" text="API Docs" href="/readme-core" />
</HeroRow>

Canvas is a framework for building realtime TypeScript applications,
that runs your core application logic in a durable state container
similar to Redux.

It's like if your React state manager implemented a smart contract,
with verifiable state transitions and end-to-end verifiability.

Write your application backend as a set of [mutations](#),
and user actions get replicated in realtime, with conflicts
handled through rollback, CRDTs, and/or custom merge logic.

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

<CodeGroupOpener />

## Distributed Execution

Every Canvas state container runs on a durable execution log, which stores
a compactable history of the application.

When new applications are started up, they catch up on history using
[efficient sync](https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html)
to catch up on the latest state.

![Replicated log](./public/gossiplog.png)

This makes it possible to develop multiplayer games, local-first
applications like Linear, and realtime applications with higher
responsiveness, since users don't need to wait for a network roundtrip.

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
