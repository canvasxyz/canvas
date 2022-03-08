## Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

```
brew install ipfs
npm i
node canvas.js examples/polis.canvas.js
```

## Directory structure

The project is structured as a monorepo.

- lib/ is the frontend module and React library
- lib/index.js is the entry point for importing the frontend module
- server/ includes modules used on the server
- canvas.js is the entry point for running the server

## Persistent installation

```
cp node.service /etc/systemd/system/node.service
systemctl daemon-reload
systemctl enable node
service node start
```
