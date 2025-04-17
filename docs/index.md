---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow text="The next-generation, local-first, peer-to-peer database" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

Canvas is a peer-to-peer database that makes writing
distributed software simple, like a local-first Firebase or InstantDB.

Write an application in your browser. Sync it to your desktop with
one command. Manage it from a simple web interface.

<FeatureTags :features="[
  {
    text: 'Runs on browser, desktop, or mobile',
    tooltip: 'Works in the browser, in Node.js, or in React Native',
    iconName: 'mobile'
  },
  {
    text: 'Persists to SQLite, Postgres, or IndexedDB',
    tooltip: 'Uses SQLite, Postgres, or IndexedDB as the backing data store',
    iconName: 'database'
  },
  {
    text: 'Custom mutators',
    tooltip: 'Write custom mutators for auth rules or business logic',
    iconName: 'atom'
  },
  {
    text: 'Transactions',
    tooltip: 'Serializable database transactions that roll back on conflict',
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
    text: 'Built on IPFS standards',
    tooltip: 'Built on IPFS standards and our Merkle sync system (Prolly-trees)',
    iconName: '123'
  },
  {
    text: 'Web UI',
    tooltip: 'Firebase-like database management interface',
    iconName: 'apps',
  },
  {
    text: 'MIT License',
    tooltip: 'Open source, and fully self-hostable',
    iconName: 'crown',
  },
  {
    text: 'CRDTs',
    tooltip: 'Soon: Multiplayer editing using embedded CRDTs',
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

</div>

---

<div :class="$style.flex">
  <div :class="$style.colRight">

::: code-group

```ts [Browser]
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
  topic: "example.canvas.xyz",
  contract: {
    models: {
      messages: {
        id: "primary",
        text: "string",
      }
    },
    actions: {
      createMessage: async (db, text) => {
        const { address, id } = this
        await db.set("messages", { id, text })
      }
    }
  }
})

app.actions.createMessage("hello world!")
```

```ts [React hook]
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { models, actions } from "contract.ts"

const wsURL = null

const Component = () => {
  const { app, ws } = useCanvas(wsURL, {
    topic: "example.canvas.xyz",
    contract: { models, actions }
  })

  const items = useLiveQuery(app, "posts", {
    orderBy: "created_at"
  })

  return <ItemView content={items}></ItemView>
}
```

```ts [Command Line]
// In contract.ts:
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

  </div>
  <div :class="$style.colLeft">

**Create a database** by defining models and actions.

Models define the schema of your database, which are interoperable across
platforms.

Actions define mutations that users can make to the database. Use them to
enforce authorization checks, or write business logic.

---

**Launch a peer** from your terminal by pointing it to contract.ts.

```sh
canvas run contract.ts --network-explorer \
  --admin 0x349...
  --topic chat-example.canvas.xyz
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

You can provide an admin address for the peer, which will allow you to
upgrade the running application, while preserving your users' data.

  </div>
</div>

<style module>
.main { max-width: 690px; }
.flex { display: flex; flex-direction: row-reverse; }
.colLeft { width: 49%; padding-right: 33px; padding-top: 0px; }
.colLeft hr { margin: 1.75rem 0; }
.colRight { width: 51%; }
.colLeft div[class*="vp-adaptive-theme"] { margin: 1.33rem 0 1.32rem !important; }
@media (max-width: 640px) {
  .flex { display: block; padding-top: 1px; }
  .colLeft { width: 100%; padding-right: 0; }
  .colRight { width: 100%; }
}
</style>

---

<br/>

<!-- <FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Talk" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/core" details="A database for local-first and peer-to-peer applications, with an embedded runtime." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/chain-ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
</FeatureRow> -->

<EmailForm />

<HomepageFooter />
