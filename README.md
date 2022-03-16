## Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

In a separate process, start an IPFS daemon

```
$ ipfs daemon --offline
```

The hub application stores specs in a `db` directory. Initialize the directory using the folder of example specs with

```
$ npm run init -- examples
```

If you change the specs, you can reset the `db` directory using

```
$ npm run clean
$ npm run init -- examples
```

Run the dev server with

```
$ npm run dev
```
