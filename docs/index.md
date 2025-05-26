---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow text="Embedded instant database for modular applications" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

<div :class="$style.mainInner">

Canvas is a local-first, distributed database similar to Firebase,
built on the same principles as collaborative data types.

Write your application logic inside the database, and deploy anywhere.
Every client can use the database concurrently, and interactions are
automatically synced and merged.

Use it to build mini apps, shared databases, browser extensions,
multiplayer games, or decentralized applications.

</div>

<FeatureTags :features="[
  {
    text: 'Cross-platform',
    tooltip: 'Works in the browser, in Node.js, or in React Native',
    iconName: 'mobile'
  },
  {
    text: 'Cross-database',
    tooltip: 'Uses SQLite, Postgres, or IndexedDB as the backing data store',
    iconName: 'database'
  },
  {
    text: 'Realtime',
    tooltip: 'Instant-sync via libp2p WebSockets',
    iconName: 'activity'
  },
  {
    text: 'React hooks',
    tooltip: 'React hooks for live apps & database queries',
    iconName: 'compare'
  },
  {
    text: 'Transactions',
    tooltip: 'Transactional logic inside your database',
    iconName: 'atom'
  },
  {
    text: 'Management UI',
    tooltip: 'Edit your application through a database management interface',
    iconName: 'apps',
  },
  {
    text: 'MIT Licensed',
    tooltip: 'Open source, minimal vendor lock-in',
    iconName: 'crown',
  },
  {
    text: 'Embedded CRDTs',
    tooltip: 'Soon: Multiplayer editing using embedded CRDTs',
    iconName: 'guide',
    disabled: true,
  },
  {
    text: 'Private Data',
    tooltip: 'Soon: Native end-to-end encrypted data',
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

```ts [Class Contract]
import { Canvas, Contract, ModelSchema } from "@canvas-js/core"

class Chat extends Contract<typeof Chat.models> {
  static models = {
    messages: {
      id: "primary",
      content: "string",
      address: "string",
    }
  } satisfies ModelSchema

  async createMessage(content: string) {
    this.db.create("messages", {
      content,
      address: this.address
    })
  }
}

const app = await Canvas.initialize({
  topic: "example.xyz",
  contract: Chat,
})

app.actions.createMessage("Hello world!")
```

```ts [React Usage]
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"
import { Chat } from "./contract.ts"

const wsURL = process.env.SERVER_WSURL || null

export const App = () => {
  const { app, ws } = useCanvas(wsURL, {
    topic: "example.xyz",
    contract: Chat,
  })
  const items = useLiveQuery(app, "messages")

  return (<div>
    <ComposeBox
      onSend={app.actions.createMessage}
    />
    <ItemView content={items}></ItemView>
  </div>)
}
```

:::

<CodeGroupOpener /> <!-- needed for production build -->

  </div>
  <div :class="$style.colLeft">

Canvas is a conflict-free replicated object, similar to CRDTs like Y.js, that provides the ability to write application logic inside a deterministic environment.

Your application logic goes inside `actions` on the JS class, where each action has access to a multiwriter relational database.

Actions sync between peers using a distributed event log, so every peer can validate the history of your application, without a central server.

Users log in through `signers`, which are used to authenticate their actions. Each signer is a DID, so you can use Ethereum, ATProto, or services like Clerk and Privy for login.

Applications run across platforms, using IndexedDB in the browser or SQLite/Postgres in Node.js.

```sh
canvas run contract.ts --topic example.xyz
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

This starts a peer that you can connect to from your browser. By
default, it will also connect to other servers on the
application's topic.

Read on to learn how to [authenticate users](/4-identities-auth),
[upgrade your app](/6-deploying), or [deploy to a
server](/7-upgrading).

  </div>
</div>

---

<div :class="$style.end">

<div :class="$style.sectionHeader">

# About Canvas

</div>

Canvas is based on several years of research on a new architecture for
distributed web applications. It builds on work from projects including IPFS,
OrbitDB, and other peer-to-peer databases.

We've published some of our technical presentations here:

- [Merklizing the Key/Value Store for Fun and Profit](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit)
- [Introduction to Causal Logs](https://joelgustafson.com/posts/2024-09-30/introduction-to-causal-logs)
- [GossipLog: Reliable Causal Broadcast for libp2p](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
- [GossipLog: libp2p Day Presentation](https://www.youtube.com/watch?v=X8nAdx1G-Cs)

The current release of Canvas is an early developer preview that we
are using in a limited set of production pilots. This first release is
particularly recommended for mini apps and protocolized
applications with public data, that anyone can permissionlessly
interoperate with.

In 2025, we are working to expand the categories of applications that
we can support, and provide support to developers building on the system.
For more information, please reach out on [Discord](https://discord.gg/EjczssxKpR).

</div>

<HomepageFooter />

<style module>
.main p[class="text"],
.main a[class="tagline"],
.sectionHeader h1,
.sectionHeaderCol h1 { font-family: "Space Grotesk"; }

.main, .partial { max-width: 520px; }
.mainInner { max-width: 520px; } /* make room for jellyfish */
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
