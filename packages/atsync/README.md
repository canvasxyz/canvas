# @canvas-js/atsync <Badge type="tip" text="In development" />

Tools for syncing a local database to AT Protocol.

## Table of contents

* [Background](#background)
* [Motivation](#motivation)
* [Architecture](#architecture)
* [Example](#example)

## Background

Peer-to-peer and local-first applications can implement several
types of sync, each with different tradeoffs:

- server-to-server sync (e.g. Bluesky, Mastodon, Ethereum)
- client-to-server sync (e.g. Obsidian, iCloud sync)
- client-to-client sync (e.g. Firechat)

Peer-to-peer networks today commonly use server-to-server sync,
because servers have stable network identities. For the same reason,
Bluesky prescribes that PDSes, which control users' posting keys,
have to be servers that are always online.

Client-to-server sync is mostly used for personal applications like
notes apps, which often support storing notes in a local folder, but
also let you sync those notes to a server. It also appears in light
node blockchain sync systems, which provide better security than
hosted nodes, but even those are experimental.

## Motivation

**Make it possible to easily create local-first, client-to-server
synced applications which use networks like Bluesky for persistence.**

Today, it's possible to create server-first applications on Bluesky
and AT Protocol by creating a custom PDS and hosting a feed generator.

This works for committed developers and service providers, but it
still requires servers to stay up and services to be funded, and there
are already cases of indie services disappearing abruptly. Given
the difficulty of running services, most developers today use
Bluesky's APIs (or equivalently Farcaster's Neynar APIs) to write
custom clients, rather that creating new kinds of applications.

Local-first applications that sync with decentralized networks help
work around this issue. They keep working even if services go down,
give users more ownership over their data, and, like HTML and
static hosting, are also generally more in line with the original
spirit of the internet.

### Uses

While the Bluesky team continues to develop big-world tools like
private posts and DMs in the main protocol, some small-world
applications are a more natural fit for client-to-server sync:

* Private collections on a federated Are.na
* Collaboration for posts/drafts in a federated version of Buffer
* Shared notes with people you know/trust on Bluesky
* Adding collaboration to sites published from your personal Obsidian

You might think of these as "small-world applications", or
"collaborative local-first applications".

Today, if you want to build new applications on AT Protocol, you
have to build and host entire centralized services like feed generators,
but a collaborative local-first approach lets you avoid that.

## Architecture

`@canvas-js/atsync` uses a local Canvas application as a local-first
database, and augments it with sync to an AT Protocol PDS with a fixed
schema.

* We use the current ATPSigner but extend it to support deferred auth,
  so you can log in to a PDS after starting to use your application.
* We provide a sync hook that supports **sync strategies (triggers)**
  for the Lexicon that you specify.
* The sync hook talks to ATPSigner to get info about your PDS connection.
* Sync strategies are **offline-first** and can buffer or retry operations
  if they fail.

Since Canvas applications are built on ModelDB (SQLite/IndexedDB) and
JavaScript controllers, this means you can use Canvas as a transparent
sync layer, just like writing a regular JavaScript application.

You can also read from the local database using raw SQL or IndexedDB
queries and just use Canvas for writes.

## Example

```ts
import { useATSync } from "@canvas-js/atsync"
import { ATPSigner } from "@canvas-js/chain-atproto"

const contract = {
	models: {
		posts: { /* title, imageBlob, ... */  },
		collections: { /* title, description, owner, ... */ },
	},
	controllers: {
		createPost: () => {
			db.set(...)
		},
		updatePost: () => {
			db.set(...)
		}
	},
}

const { atpSigner } = useSigner(new ATPSigner({
	login: { identifier, password },
	allowUnauthenticatedSigner: true,
}))

const { app } = useCanvas({
	contract,
	signer: [atpSigner]
})

const { status } = useATSync({
	app,
	lexicon: { /* specify your target ATP lexicon here... */ }
	defaultPds: atpSigner.pds,
	onAction: (call, args) => {
		// when a local action is taken, propagate it to the PDS
	},
	onPDSAction: (schema, data) => {
		// when a new PDS action is seen, call app[action], etc...
		if (schema.name === 'post') {
			app.createPost({ text: data.text })
		}
	},
})
```