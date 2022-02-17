## Prologue

A technical prototype of Canvas, a protocol for everlasting
decentralized applications.

## Quick start

```
brew install ipfs
npm i
node prologue.js test.prologue.js
```

### How it works

Canvas is a P2P network that allows developers to build decentralized,
frontend-independent applications, where every action in the
application is a signed message from an Ethereum address.

A signed message could be a Discord message, a forum post, a vote
in a governance system, or a move in a game.

Each application also defines a set of append-only logs where
these messages are stored.

Applications also define a "spec", a short block of executable code which
check signed messages to determine whether they’re valid. Finally, the
application also defines queries, which are executed over the append-only
logs to generate views, like the homepage of Reddit or most recent messages
in Discord.

Over time we expect many of these components will be replaced with
high-performance CRDTs (conflict-free replicated data types).

Anyone can build a Canvas application or run a Canvas node without
tokens or cryptocurrency.

We aim for blockchain minimization - some Canvas applications may use
smart contracts to give certain members permission to post, but others
will be offchain, [immutable](https://jacob.energy/hyperstructures.html),
and upgradeable through soft forking alone.
