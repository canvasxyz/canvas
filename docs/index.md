---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow tagline="Developer Preview" text="Build local-first, peer-to-peer applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

<div :class="$style.mainInner">

Canvas is a peer-to-peer database, like a local-first version of
Firebase, that lets you write entire applications without leaving your
frontend.

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
    text: 'Embedded runtime',
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
    text: 'IPFS',
    tooltip: 'Built on IPFS components (IPLD, DAG-CBOR, and Kademlia) and Prolly-trees',
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

<div :class="$style.partial">

<EmailForm />

</div>

<div :class="$style.badges">
<a href="https://github.com/canvasxyz/canvas" target="_blank">

![NPM Version](https://img.shields.io/npm/v/%40canvas-js%2Fcore)
![GitHub stars](https://img.shields.io/github/stars/canvasxyz/canvas?style=flat)
![NPM Downloads](https://img.shields.io/npm/dm/%40canvas-js%2Fcore)

</a>
</div>

---

<div :class="$style.sectionHeaderCol">

# Quick start

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
  createMessage: async (text) => {
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
  createMessage: ({ text }) => {
    const { id, address } = this
    db.set("messages", { id, text })
  }
}

// From the command line:
$ canvas run contract.ts --topic demo.canvas.xyz // [!code highlight]
```

:::

<CodeGroupOpener /> <!-- needed for production build -->

  </div>
  <div :class="$style.colLeft">

Each application is built around a contract, which contains models and
actions:

Models define your database schema.

Actions define mutations that users can make to the database. Use them
to enforce authorization checks, or write business logic.

---

You can define a contract inline in the browser, or as a file
that you run using the `canvas` CLI.

Easily use the CLI to start a peer, which connects to everyone else
running the application's topic via DHT.

```sh
canvas run contract.ts --topic example.xyz
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

---

You can upgrade your application by adding new actions or models. Upgraded
contracts will safely soft-fork away from nodes running the old contract.

To change existing data, you can use the admin interface to
generate a hard-fork snapshot, which compacts and flattens the state of the application.

  </div>
</div>

---

<div :class="$style.end">

<div :class="$style.sectionHeader">

# About Canvas

</div>

Traditionally, local-first databases have only offered simple data
structures like KV-stores, maps, and feeds. They provide limited
database consistency guarantees and relatively few options for
persistence and sync.

To solve these problems, we built an embedded runtime that preserves
convergence in an eventually-consistent environment. Using the
runtime, we compile database schemas, permissions, and custom mutations
into code.

We also built a modular signer system that allows us to integrate with
different identity systems, including crypto wallets, DIDs, and soon,
WebAuthn and OpenID Connect. For more traditional login, we're working
on integrations with traditional identity providers to custody users'
private keys.

We've published some of our research as technical presentations here:

- [Merklizing the Key/Value Store for Fun and Profit](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit)
- [Introduction to Causal Logs](https://joelgustafson.com/posts/2024-09-30/introduction-to-causal-logs)
- [GossipLog: Reliable Causal Broadcast for libp2p](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
- [GossipLog: libp2p Day Presentation](https://www.youtube.com/watch?v=X8nAdx1G-Cs)

The current release of Canvas is an early developer preview that we
are using in a limited set of production pilots. We are excited to
work with more developers to build on the system, and support more
identity providers. For more information, please reach out via
[Discord](https://discord.gg/EjczssxKpR).

</div>

<HomepageFooter />

<style module>
.main p[class="text"],
.main a[class="tagline"],
.sectionHeader h1,
.sectionHeaderCol h1 { font-family: "Space Grotesk"; }

.main, .partial { max-width: 630px; }
.mainInner { max-width: 630px; } /* make room for jellyfish */
@media (max-width: 960px) {
  .main, .partial { margin: 0 auto; }
  .mainInner { max-width: none; }
}

.sectionHeaderCol { margin: 2.5rem 0 0.7rem; }
.sectionHeader { margin: 2.5rem 0 1.3rem; }

.badges {
  margin: 0 auto;
}
.badges p {
  display: flex;
  flex-direction: row;
  transform: scale(1.04);
  transform-origin: left center;
  margin-bottom: 2rem;
  justify-content: center;
}
.badges p img { height: 140%; margin-right: 6px; }
@media (min-width: 960px) {
  .badges p { justify-content: left; }
}

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
