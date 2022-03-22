## Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

```
$ npm i
```

Create a `.env` file in the repo root with `DATABASE_URL` and `APP_DIRECTORY` environement variables.

```
DATABASE_URL=file:./db.sqlite
APP_DIRECTORY=./apps
DATA_DIRECOTRY=./db
```

Initialize the database.

```
$ npx prisma generate
$ npx prisma db push
```

In a separate process, start an IPFS daemon.

```
$ ipfs daemon --offline
```

Run the dev server.

```
$ npm run dev
```
