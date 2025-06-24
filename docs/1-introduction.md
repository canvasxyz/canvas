# Introduction

Canvas applications are built on a programmable multi-writer relational database. They're easy to configure and automatically have several useful properties:

- **Real-time**. Nodes connect and sync directly with each other over WebSockets, and optionally can use GossipSub to broadcast actions over an open mesh of servers.
- **Convergent**. Actions can freely read and write to a relational database with [strong eventual consistency](https://en.wikipedia.org/wiki/Eventual_consistency). Every peer's database state will converge to the same state, regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed with a cryptographically verifiable user identity, and attributable to a user's DID. The entire action history of an application can be replayed and verified.
- **Lock-free**. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Cross-platform**. Canvas apps run in the browser, desktop, or React Native, persisting data with IndexedDB, SQLite in WASM, native SQLite, or Postgres.