---
layout: home
---

<HeroRow text="A replicated log for decentralized applications" :image="{ light: '/graphic_mainframe_1.png', dark: '/graphic_mainframe_2.png' }">
  <HeroAction theme="brand big" text="Docs" href="./intro" />
  <HeroAction theme="alt big" text="Code" href="https://github.com/canvasxyz/canvas/tree/main/packages/gossiplog" target="_blank" noreferrer noopener/>
</HeroRow>

GossipLog is a decentralized, authenticated, multi-writer log that
serves as a general-purpose foundation for peer-to-peer
applications. It can be used as a replicated data store, transaction
log of a database, or execution log of a full-fledged VM.

It can run in the browser using IndexedDB for persistence, on
NodeJS using SQLite + LMDB, or entirely in-memory.

We use GossipLog as a core component of [Canvas](https://canvas.xyz),
a distributed runtime for TypeScript applications.

<br/>

---

<HomepageFooter />