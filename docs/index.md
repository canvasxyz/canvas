---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow tagline="Early Developer Preview" text="Build local-first, peer-to-peer applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

<div :class="$style.mainInner">

Canvas is a peer-to-peer database, like a local-first version of Firebase.

It's a real-time database that you can use from the frontend,
with the programmability of a traditional backend, and usability
of a modern web database.

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
    text: 'Live queries',
    tooltip: 'React hooks for live-updating apps & database queries',
    iconName: 'compare'
  },
  {
    text: 'Custom logic',
    tooltip: 'Write custom mutators for auth rules or business logic',
    iconName: 'atom'
  },
  {
    text: 'Transactions',
    tooltip: 'Serializable database transactions that roll back on conflict',
    iconName: 'rewind'
  },
  {
    text: 'Database Editor',
    tooltip: 'Comes with a database management interface',
    iconName: 'apps',
  },
  {
    text: 'IPFS standards-based',
    tooltip: 'Built on IPFS standards (IPLD, DAG-CBOR) and Prolly-trees',
    iconName: '123'
  },
  {
    text: 'MIT Licensed',
    tooltip: 'Open source, fully self-hostable',
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
    text: 'Email Login',
    tooltip: 'Soon: Login optimized for usability and accessibility',
    iconName: 'lock',
    disabled: true
  },
]" />

</div>

---

<div :class="$style.sectionHeaderCol">

# Get started in minutes

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

Models define your database's schema, in a way that's interoperable
across platforms, like Prisma.

Actions define mutations that users can make to the database. Use them to
enforce authorization checks, or write business logic.

---

**Launch a peer** from your terminal. It will connect with everyone
else running the application's topic, via DHT.

```sh
canvas run contract.ts --topic example.xyz
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

---

**Upgrade your application** by adding new actions or
models at any time. Upgraded nodes will safely soft-fork
away from ones on the old contract.

To change existing actions or models, you can use the admin interface
to generate a hard-fork snapshot, and compact the state of the application.

  </div>
</div>

---

<div :class="$style.end">

<div :class="$style.sectionHeader">

# Built for the open web

</div>

Traditionally, local-first databases have only offered simple data
structures (e.g. KV-stores, maps, and feeds). They often enforce strict
data schemas, require developers to set up private keys for users,
and provide limited options for persistence and sync.

To solve these problems, we built an embedded runtime that preserves
determinism and convergence in an eventually-consistent
environment. Using the runtime, we can compile database schemas,
permission checks, and custom mutations into code.

We also wrote a modular signer system that allows us to integrate with
different login systems, including crypto wallets, DIDs, and (soon)
WebAuthn and OIDC SSO. For more traditional logins, we also have
cryptographically verifiable strategies using traditional identity
providers on the roadmap.

We've published some of our research as technical presentations here:

- [Merklizing the Key/Value Store for Fun and Profit](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit)
- [GossipLog: libp2p Day Presentation](https://www.youtube.com/watch?v=X8nAdx1G-Cs)
- [GossipLog: Reliable Causal Broadcast for libp2p](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
- [Introduction to Causal Logs](https://joelgustafson.com/posts/2024-09-30/introduction-to-causal-logs)

The current release of Canvas is an early developer preview that we
are using in a limited set of production pilots. We are excited to
work with more developers to build on the system, and support more
identity providers. For more information, please reach out via
[Discord](https://discord.gg/EjczssxKpR).

To stay updated, you can subscribe here for more information:

<EmailForm />

</div>

<HomepageFooter />

<style module>
.main p[class="text"],
.main a[class="tagline"],
.sectionHeader h1,
.sectionHeaderCol h1 { font-family: "Space Grotesk"; }

.main { max-width: 630px; }
.mainInner { max-width: 630px; } /* make room for jellyfish */
@media (max-width: 960px) {
  .main { margin: 0 auto; }
  .mainInner { max-width: none; }
}

.sectionHeaderCol { margin: 2.5rem 0 0.7rem; }
.sectionHeader { margin: 2.5rem 0 1.3rem; }

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
