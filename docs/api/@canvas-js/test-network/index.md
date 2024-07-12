[Documentation](../../packages.md) / @canvas-js/test-network

# @canvas-js/test-network

Build the dashboard client bundle

```
$ npm run build
```

Then start the simulation

```
$ docker-compose up --build
```

Then open the dashboard at http://localhost:8000

To open a browser peer manually, open http://localhost:8000/peer-browser/index.html?bootstrapList=/dns4/localhost/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn

To spawn several browser peers, run

```
$ ./spawn.sh 3
```
