---
aside: false
next: false
---

<HeroRow text="The programmable database for local-first applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

Canvas is a local-first database that makes writing distributed
software simple, like a local-first Firebase or InstantDB.

Write an application from your browser, without deploying a
backend. Replicate it to a server with one command. Manage your
applications from a simple web interface, with all the features of a
modern web database.

Write more powerful applications with custom mutations and
transactions, that weren't possible in a local-first
environment before.

<FeatureTags :features="[
  {
    text: 'Browser, desktop, or mobile',
    tooltip: 'Runs in the browser, in Node.js, or in React Native',
    iconName: 'mobile'
  },
  {
    text: 'Cross-database',
    tooltip: 'Persists data to SQLite, Postgres, or IndexedDB',
    iconName: 'database'
  },
  {
    text: 'Custom mutators',
    tooltip: 'Write custom mutators for auth rules or business logic',
    iconName: 'atom'
  },
  {
    text: 'Transactions',
    tooltip: 'Strongly consistent database transactions that roll back on conflict',
    iconName: 'rewind'
  },
  {
    text: 'Sync via libp2p',
    tooltip: 'Browser-to-server and server-to-server libp2p WebSockets',
    iconName: 'activity'
  },
  {
    text: 'React hooks',
    tooltip: 'React hooks with live-updating apps & database queries',
    iconName: 'compare'
  },
  {
    text: 'Flexible auth',
    tooltip: 'Use passkeys, wallets, or write your own auth strategy',
    iconName: '123'
  },
  {
    text: 'Web UI',
    tooltip: 'Comes with a Firebase-like database management interface',
    iconName: 'apps',
  },
  {
    text: 'MIT Licensed',
    tooltip: 'Open source, and fully self-hostable',
    iconName: 'crown',
  },
  {
    text: 'CRDTs',
    tooltip: 'Soon: Conflict resolution using embedded CRDTs',
    iconName: 'guide',
    disabled: true,
  },
  {
    text: 'Private Data',
    tooltip: 'Soon: Native support for end-to-end encrypted data',
    iconName: 'lock',
    disabled: true
  },
  {
    text: 'Web2 Login',
    tooltip: 'Soon: Login optimized for usability and accessibility',
    iconName: 'lock',
    disabled: true
  },
]" />

::: code-group

```ts [React app]
import { useCanvas } from "@canvas-js/hooks"

const models = {
  messages: {
    id: "primary",
    text: "string",
  }
}
const actions = {
  createMessage: (db, { text }, { address, msgid }) => {
    db.set("messages", { id: msgid, text })
  }
}

const { app } = useCanvas({ topic: "demo", contract: { models, actions } })   // [!code highlight]
```

```ts [Node.js + WASM]
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

$ canvas run contract.ts --topic demo.canvas.xyz // [!code highlight]
```

:::

<CodeGroupOpener />

<FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Talk" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/core" details="A database for local-first and peer-to-peer applications, with an embedded runtime." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/chain-ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
</FeatureRow>

<HomepageFooter />
