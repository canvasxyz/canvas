## Canvas

A programmable append-only log.

## Quick start

```
brew install ipfs
npm i
node prologue.js test.prologue.js
```

### How it works

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

Each application defines a set of append-only logs, and a "spec" that
checks signatures to decide what are valid actions to add to the log.

The spec also defines queries, which are executed over the log to
generate views. Queries are defined over a sqlite database right now.
We will support custom reducers and high-throughput CRDTs later.

Anyone can build a Canvas application or run a Canvas node without
tokens or cryptocurrency.
