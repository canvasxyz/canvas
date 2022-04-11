# Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

Start an IPFS daemon in a separate terminal

```
$ ipfs daemon --offline
```

Install dependencies and symlink the local packages:

```
$ npm i
```

Create a `packages/canvas-hub/.env` file with `DATABASE_URL` and `APP_DIRECTORY` environement variables:

```
DATABASE_URL=file:./db.sqlite
APP_DIRECTORY=./apps
```

Generate the prisma client:

```
$ cd packages/canvas-hub
$ npx prisma generate
$ cd ../..
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

Start the hub production NextJS server:

```
$ npm run start
```

## Canvas Core

## Canvas Hub

## Canvas CLI

Install the CLI

```
./install.sh
```

This just puts a stub shell script at `$(npm config get prefix)/bin/canvas` that calls `node ${PWD}/packages/canvas-cli/index.js $@`.

You must build the CLI before it will work (either running the dev server, running `npm run build` in the repo root, running `npm run build-cli` in the repo root, or running `npm run build` inside packages/canvas-cli), but once install, you should never have to think about it again.

The basic CLI commands are

```
canvas download QmFoo
canvas run QmFoo --port 8000
canvas action ls QmFoo
canvas session ls QmFoo
```
