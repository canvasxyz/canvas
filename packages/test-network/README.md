# @canvas-js/test-network

First build the dashboard client bundles

```
$ npm run dev
```

Then start the docker containers

```
$ npm run start
```

Open http://localhost:8000 to view the dashboard.

Configure the network by creating a .env file

```
NUM_TOPICS=1
NUM_PEERS=8
DELAY=10
INTERVAL=10
DEBUG=canvas:*
```

To test WebRTC clients, set NUM_PEERS to 0 in .env and run both `npm run start` and `spawn.sh` in separate terminals.
