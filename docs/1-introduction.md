# Introduction

Canvas is a framework for making real-time decentralized applications.

Canvas apps are built on a programmable multi-writer relational database. They're easy to configure and automatically have several useful properties:

- **Off-chain**. No transaction fees or confirmation wait times. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Real-time p2p**. Peers connect and sync directly with each other over libp2p, and use GossipSub topics to broadcast actions.
- **Eventually consistent**. Actions can freely read and write to a relational database. Every peer's database state will deterministically converge regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed by a session key authorized by an end user identity, using e.g. SIWE for Ethereum identities. The entire action log can be verified and replayed by anyone at any time; applications are trustless and portable.
- **Cross-platform**. Canvas apps run in the browser or on NodeJS, persisting data with IndexedDB and SQLite/LMDB, respectively.
