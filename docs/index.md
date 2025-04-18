---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow tagline="Early Developer Preview" text="Build powerful applications on peer-to-peer sync" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

<div :class="$style.mainInner">

Canvas is a peer-to-peer database that makes it easy to write distributed
applications, like a local-first Firebase or InstantDB.

Write an application in your browser in minutes. Launch a peer
with one command. Integrate with multiple identity systems and PKIs for login.

</div>

<FeatureTags :features="[
  {
    text: 'Runs on browser, desktop, or mobile',
    tooltip: 'Works in the browser, in Node.js, or in React Native',
    iconName: 'mobile'
  },
  {
    text: 'Cross-database persistence',
    tooltip: 'Uses SQLite, Postgres, or IndexedDB as the backing data store',
    iconName: 'database'
  },
  {
    text: 'Sync via libp2p',
    tooltip: 'Browser-to-server and server-to-server libp2p WebSockets',
    iconName: 'activity'
  },
  {
    text: 'Reactive queries',
    tooltip: 'React hooks for live-updating apps & database queries',
    iconName: 'compare'
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
    text: 'IPFS standards',
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

<div :class="$style.sectionHeader">

# Launch an application in minutes

</div>

<div :class="$style.flex">
  <div :class="$style.colRight">

::: code-group

```ts [Browser]
import { Canvas } from "@canvas-js/core"

const models = {
  messages: {
    id: "primary",
    text: "string",
    $indexes: ["id"]
  }
}

const actions = {
  createMessage: async (db, text) => {
    const { address, id } = this
    await db.set("messages", { id, text })
  }
}

const app = await Canvas.initialize({
  topic: "example.canvas.xyz",
  contract: { models, actions }
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

// From the command line:
$ canvas run contract.ts --topic demo.canvas.xyz // [!code highlight]
```

:::

<CodeGroupOpener /> <!-- needed for production build -->

  </div>
  <div :class="$style.colLeft">

**Create a database** by defining models and actions.
Models are an interoperable across platforms.

Actions define mutations that users can make to the database. Use them to
enforce authorization checks, or write business logic.

---

**Launch a peer** from your terminal. It will automatically connect
with everyone else running the same application, on the same topic.

```sh
canvas run contract.ts --topic example.xyz
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

---

**Upgrade your application** by adding new actions or
models at any time. Upgraded nodes will soft-fork
away from old ones.

To change existing actions or models, you can use the admin interface
to generate a snapshot which compacts the past history of the
application.

  </div>
</div>

---

<!-- <FeatureRow title="Components" detail="">
  <FeatureCard title="@canvas-js/okra" details="A Prolly tree written in Zig, that enables fast peer-to-peer sync for application histories." link="https://github.com/canvasxyz/okra" linkText="Github" secondaryLink="https://docs.canvas.xyz/blog/2023-05-04-merklizing-the-key-value-store.html" secondaryLinkText="Blog"/>
  <FeatureCard title="@canvas-js/gossiplog" details="A self-authenticating distributed log for multi-writer applications." link="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" linkText="Github" secondaryLinkText="Talk" secondaryLink="https://www.youtube.com/watch?v=X8nAdx1G-Cs"/>
  <FeatureCard title="@canvas-js/modeldb" details="A cross-platform relational database wrapper for IDB, SQLite, and Postgres." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/core" details="A database for local-first and peer-to-peer applications, with an embedded runtime." link="https://github.com/canvasxyz/canvas/tree/main/packages/modeldb" linkText="Github"/>
  <FeatureCard title="@canvas-js/chain-ethereum" details="Log in with an Ethereum wallet. Also supports Cosmos, Solana, and Polkadot." linkText="Demo" link="https://chat-example.canvas.xyz/"/>
</FeatureRow> -->

<div :class="$style.end">

The current release of Canvas is an early developer preview that we
are using in production pilots with a limited set of design partners. We
are excited to work with more developers to build on the system, and
to support more identity providers. Please reach out via
[Discord](https://discord.gg/EjczssxKpR) to discuss.

Technically inclined readers may be interested in some of our writing,
which covers the technical foundations of the system:

- [Merklizing the Key/Value Store for Fun and Profit](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit)
- [GossipLog: Reliable Causal Broadcast for libp2p](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
- [Introduction to Causal Logs](https://joelgustafson.com/posts/2024-09-30/introduction-to-causal-logs)

Canvas is an open source project built by a team with experience at
MIT, Princeton, and Protocol Labs, that has also built Web3
products used by tens of thousands of users. It has been under active development
since 2022 with support from <a href="https://www.protocol.vc/" target="_blank">PLVC</a>,
<a href="https://alliance.xyz/" target="_blank">Alliance</a>, <a href="https://zeitgeist.xyz/" target="_blank">Zeitgeist</a>, <a href="https://fil.org/" target="_blank">Filecoin</a>, and others.

</div>

We also send infrequent email updates. Subscribe here for more information:

<br/>

<EmailForm />

<HomepageFooter />

<style module>
.main p[class="text"],
.main a[class="tagline"],
.sectionHeader h1 { font-family: "Space Grotesk"; }

.main { max-width: 630px; }
.mainInner { max-width: 630px; } /* make room for jellyfish */
@media (max-width: 960px) {
  .main { margin: 0 auto; }
  .mainInner { max-width: none; }
}

.sectionHeader { margin: 2.5rem 0 0.7rem; }

.flex div[class*="vp-adaptive-theme"] { font-size: 98%; }
.colLeft div[class*="vp-adaptive-theme"] { font-size: 96%; }

.flex { display: flex; flex-direction: row-reverse; padding-bottom: 10px;}
.colLeft { width: 49%; padding-right: 33px; padding-top: 0px; }
.colLeft hr { margin: 1.75rem 0; }
.colRight { width: 51%; }
.colLeft div[class*="vp-adaptive-theme"] { margin: 1.33rem 0 1.32rem !important; }

@media (max-width: 640px) {
  .flex { display: block; padding-top: 1px; }
  .colLeft { width: 100%; padding-right: 0; }
  .colRight { width: 100%; }
}

.end {
  margin: 40px 0;
  max-width: 600px;
}
</style>
