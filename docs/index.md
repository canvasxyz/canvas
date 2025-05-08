---
aside: false
next: false
---

<div :class="$style.main">

<HeroRow text="Build serverless applications,<br/>on peer-to-peer sync" :image="{ light: '/graphic_jellyfish_dark.png', dark: '/graphic_jellyfish.png' }" />

<div :class="$style.mainInner">

Canvas is an open-source database, built on an embedded peer-to-peer
runtime that allows regular applications to run as distributed
applications.

You can use it as a local-first version of Firebase, that lets you write
entire applications inside your frontend.

Or use it to build web applications as open protocols, with
cryptographic security that anyone can interoperate with.

</div>

<FeatureTags :features="[
  {
    text: 'Runs on browser, desktop, or mobile',
    tooltip: 'Works in the browser, in Node.js, or in React Native',
    iconName: 'mobile'
  },
  {
    text: 'Works with your database',
    tooltip: 'Uses SQLite, Postgres, or IndexedDB as the backing data store',
    iconName: 'database'
  },
  {
    text: 'Sync via libp2p',
    tooltip: 'Browser-to-server and server-to-server libp2p WebSockets',
    iconName: 'activity'
  },
  {
    text: 'React hooks',
    tooltip: 'React hooks for live apps & live database queries',
    iconName: 'compare'
  },
  {
    text: 'Database editor',
    tooltip: 'Edit your application through a database management interface',
    iconName: 'apps',
  },
  {
    text: 'Transactional runtime',
    tooltip: 'Write game logic & state machines inside your database',
    iconName: 'atom'
  },
  {
    text: 'MIT License',
    tooltip: 'Open source, fully self-hostable',
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
    const { address, db, id } = this
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
import { models, actions } from "./contract.ts"

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
    const { address, db, id } = this
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

Every application is defined as a contract, a virtual backend
with  `models` and `actions`.

- Models define your database schema.
- Actions define mutations that users can make to the database, like API routes.

By embedding your application logic in the database, we enable each
peer to validate the full history of your application. Applications
are local-first, without any dependency on a server.

To run your contract, include it in your frontend using React
hooks, or run it from the command line:

```sh
canvas run contract.ts --topic example
[canvas] Bundled .ts contract: 4386 chars
[canvas] Serving HTTP API: ...
```

This starts a peer that you can connect to from your browser. By
default, it will also peer with other servers running the
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

We've published some of our research as technical presentations here:

- [Merklizing the Key/Value Store for Fun and Profit](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit)
- [Introduction to Causal Logs](https://joelgustafson.com/posts/2024-09-30/introduction-to-causal-logs)
- [GossipLog: Reliable Causal Broadcast for libp2p](https://joelgustafson.com/posts/2024-09-30/gossiplog-reliable-causal-broadcast-for-libp2p)
- [GossipLog: libp2p Day Presentation](https://www.youtube.com/watch?v=X8nAdx1G-Cs)

The current release of Canvas is an early developer preview that we
are using in a limited set of production pilots. This first release is
well suited for *protocolized applications* - applications with public
data that anyone can permissionlessly interoperate with.

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

.main, .partial { max-width: 620px; }
.mainInner { max-width: 620px; } /* make room for jellyfish */
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
