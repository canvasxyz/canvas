# @canvas-js/test-network

First build the dashboard client bundles

```
$ npm run dev
```

Then generate a docker-compose.yml file for the number of server peers you want to run

```
$ ./docker-compose.sh 16
```

Then start the docker contains

```
$ npm run start
```

Then open the dashboard at http://localhost:8000

To open a browser peer manually, open http://localhost:8000/peer-browser/index.html

To spawn several browser peers, run

```
$ ./spawn.sh
```
