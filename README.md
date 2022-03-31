## Canvas

Canvas is a P2P protocol that allows developers to build
decentralized, frontend-independent applications, where every action
in the application is a signed message from an Ethereum address.

## Quick start

```
npm i
npm install -g next
```

Create a `.env` file in the repo root with `DATABASE_URL` and `APP_DIRECTORY` environement variables.

```
DATABASE_URL=file:./db.sqlite
APP_DIRECTORY=./apps
```

Initialize the database.

```
npx prisma generate
npx prisma db push
```

In a separate process, start an IPFS daemon.

```
ipfs daemon --offline
```

Run the dev server.

```
npm run dev
```

## App API

To bind a deployed instance's API to a port, install `socat` and forward from the appropriate domain socket in a separate thread:

```
$ brew install socat
$ socat TCP-LISTEN:1234,reuseaddr,fork UNIX-CLIENT:./apps/QmSbY7RxTFjGcb8VuGYLPYshyqxDKD4TsSWEHxvPUARe2T/api.sock
```
