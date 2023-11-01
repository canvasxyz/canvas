# Introduction

Canvas is an application framework that lets you write web services and applications that work like decentralized protocols.

Instead of deploying a bundle of code to a server for your backend, you define your application as a multiplayer contract, which can run in the browser or on a hosted node on a server.

When users interact with your application, their interactions are relayed between everyone running the application, triggering action handlers that run locally on each node.

This allows complex applications to be written as a series of functions - like smart contracts on the blockchain, except that interactions happen instantly and no tokens are needed (since Canvas can run over any peer-to-peer network).

Canvas apps are built on a programmable multi-writer relational database. They're easy to configure and automatically have several useful properties:

- **Off-chain**. No transaction fees or confirmation wait times. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Real-time p2p**. Peers connect and sync directly with each other over libp2p, and use GossipSub topics to broadcast actions.
- **Eventually consistent**. Actions can freely read and write to a relational database. Every peer's database state will deterministically converge regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed by a session key authorized by an end user identity, using e.g. SIWE for Ethereum identities. The entire action log can be verified and replayed by anyone at any time; applications are trustless and portable.
- **Cross-platform**. Canvas apps run in the browser or on NodeJS, persisting data with IndexedDB and SQLite/LMDB, respectively.

Under the hood, the database uses a set of data structures similar to CRDTs, the multiplayer sync technologies that power Google Docs and Figma. Unlike CRDTs, which require difficult manual maintenance of shared state, we've abstracted away the complex multiplayer logic needed to keep clients in sync.

If you use Canvas in conjunction with a storage or data availability network, like Arweave, Celestia, or Filecoin, it turns into a scalable decentralized app platform, like a modular L2 runtime. Or, you can use it as a peer-to-peer network with persistent state, to build applications like chat, state channels, and minigames.
