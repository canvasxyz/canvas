# @canvas-js/test-network

First build the dashboard client bundles

```
$ npm run dev
```

Then generate a docker-compose.yml file for the number of server peers you want to run

```
$ ./generate.sh 16
```

Then start the docker contains

```
$ docker compose rm -f && docker compose up --build
```

Then open the dashboard at http://localhost:8000

To open a browser peer manually, open http://localhost:8000/peer-browser/index.html?bootstrapList=/dns4/localhost/tcp/8080/ws/p2p/12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn

To spawn several browser peers, run

```
$ ./spawn.sh
```
