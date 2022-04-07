# Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

Install dependencies and symlink the local packages:

```
$ npm i
```

Create a `packages/canvas-hub/.env` file with `DATABASE_URL` and `APP_DIRECTORY` environement variables:

```
DATABASE_URL=file:./db.sqlite
APP_DIRECTORY=./apps
```

The `dev` script in the repo run runs the NextJS dev server and TypeScript compilers for canvas-core and canvas-cli, all in parallel:

```
$ npm run dev
```

## Deploy hub

Build the core, CLI, and hub projects:

```
$ npm run build
```

Then start the hub production NextJS server:

```
$ npm run start
```

## Canvas Core

## Canvas Hub

## Canvas CLI

## App API

To bind a deployed instance's API to a port, install `socat` and forward from the appropriate domain socket in a separate thread:

```
$ brew install socat
$ socat TCP-LISTEN:1234,reuseaddr,fork UNIX-CLIENT:./apps/QmSbY7RxTFjGcb8VuGYLPYshyqxDKD4TsSWEHxvPUARe2T/api.sock
```
