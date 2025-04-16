---
layout: home
---



<HeroRow text="Write applications with peer-to-peer sync" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

Canvas is a programmable distributed database for web applications, that's as easy to use
as modern web databases.

Write an entire application from inside your browser, in less time than
it takes to set up a backend API.

Write applications like games inside a local-first database,
by embedding your business logic inside database functions.

<FeatureTags :features="[
  {
    text: 'Browser, desktop, or mobile',
    tooltip: 'Runs in the browser, Node.js, and React Native',
    iconName: 'mobile'
  },
  {
    text: 'SQLite, Postgres, IndexedDB',
    tooltip: 'Persists data to SQLite, Postgres, IndexedDB',
    iconName: 'database'
  },
  {
    text: 'Custom mutators',
    tooltip: 'Write custom mutators with business logic in the database',
    iconName: 'desktop'
  },
  {
    text: 'Transactions',
    tooltip: 'Write strongly consistent transactions that roll back on conflict',
    iconName: 'rewind'
  },
  {
    text: 'Sync via libp2p',
    tooltip: 'Production tested browser-to-server and server-to-server sync implementations',
    iconName: 'activity'
  },
  {
    text: 'React hooks',
    tooltip: 'Comes with a React hook for apps & subscribing to local database tables',
    iconName: 'compare'
  },
  {
    text: 'Customizable auth',
    tooltip: 'Use crypto wallets, passkeys, or more',
    iconName: 'compare'
  },
  {
    text: 'MIT License',
    tooltip: 'Open source, and serious about it',
    iconName: 'crown',
  },
  {
    text: 'CRDTs',
    tooltip: 'Automatic conflict resolution using conflict-free replicated data types',
    iconName: 'merge',
    disabled: true,
  },
  {
    text: 'Private Data',
    tooltip: 'Coming soon: Native support for end-to-end encrypted data',
    iconName: 'lock',
    disabled: true
  },
]" />

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

```ts [Node.js + WASM]
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

Canvas is built on a distributed runtime that allows database schemas,
permissions, and business logic to be compiled into
eventually-consistent mergeable data structures.

When new applications are started up, they catch up on history using
[efficient sync](https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html)
to catch up on the latest state.

To learn more, check out our [docs](/1-introduction).

<br/>

<FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog Post"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Presentation" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/core" details="A database for local-first and peer-to-peer applications, with an embedded runtime." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="Sign in with Ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
</FeatureRow>

<HomepageFooter />
