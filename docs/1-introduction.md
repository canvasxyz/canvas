# Introduction

Canvas is a framework for real-time distributed and decentralized applications.

Canvas apps are built on a programmable multi-writer relational database. They're easy to configure and automatically have several useful properties:

- **Lock-free and off-chain**. No transaction fees or confirmation wait times. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Real-time**. Nodes connect and sync directly with each other over WebSockets, and optionally can use GossipSub to broadcast actions over an open mesh of users.
- **Eventually consistent**. Actions can freely read and write to a relational database. Every peer's database state will deterministically converge regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed by a session key authorized by an end user identity. The entire action log can be verified and replayed by anyone at any time; applications are trustless and portable.
- **Cross-platform**. Canvas apps run in the browser or on NodeJS, persisting data with IndexedDB, SQLite in WASM, SQLite with LMDB, or Postgres.
