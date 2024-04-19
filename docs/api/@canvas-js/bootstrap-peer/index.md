[Documentation](../../index.md) / @canvas-js/bootstrap-peer

# @canvas-js/bootstrap-peer

This package has the bootstrap peers we deploy to fly.io.

Grafana dashboard: https://fly-metrics.net/d/CHtfgfF4k/canvas-bootstrap-peers?orgId=93025&var-app=canvas-bootstrap-p0

## Local development

First create a local PeerID and save it in a `.env` file:

```
./create-peer-id.js > .env
```

Then start a local bootstrap server with

```
npm run start
```

The bootstrap peer's full multiaddr will appear in stdout, which you can copy and add to another app's `bootstrapList` array.

```
% npm run start

> @canvas-js/bootstrap-peer@0.5.0 start
> node lib/index.js

[bootstrap-peer] started libp2p with PeerId 12D3KooWKEW6KAnhn7Sr4gh9nxvwCmeTY83xrfLqTJSmgvTpauCx
[bootstrap-peer] listening on [
  '/ip4/127.0.0.1/tcp/8080/ws/p2p/12D3KooWKEW6KAnhn7Sr4gh9nxvwCmeTY83xrfLqTJSmgvTpauCx'
]
[bootstrap-peer] API server listening on http://localhost:8000
```

## Deploying

Deploy all three in serial with

```
$ ./deploy.sh
```

Deploy the three testnet peers in serial with

```
$ ./deploy-testnet.sh
```

## Private APIs

Canvas team members can [connect to our fly.io organization's wireguard mesh](https://fly.io/docs/reference/private-networking/) and query our internal API for some basic DHT stats using the private `.internal` addresses. The API is mounted on port `8000` but isn't exposed outside the private network.

### Get active connections

```
% curl 'http://canvas-testnet-p0.internal:8000/connections' | jq
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100   813  100   813    0     0   8969      0 --:--:-- --:--:-- --:--:--  9795
{
  "7rm3tn1684205343627": {
    "peer": "12D3KooWM7JabMS95FXoBSYpVBuRFXx3NbCnBhPACG2SuSyuJQwn",
    "addr": "/dns6/canvas-testnet-p1.internal/tcp/8080/ws/p2p/12D3KooWM7JabMS95FXoBSYpVBuRFXx3NbCnBhPACG2SuSyuJQwn",
    "streams": {
      "i1": "/meshsub/1.1.0"
    }
  },
  "2amuun1684205420766": {
    "peer": "12D3KooWM7JabMS95FXoBSYpVBuRFXx3NbCnBhPACG2SuSyuJQwn",
    "addr": "/ip6/fdaa:0:ce3a:a7b:7c:f8f2:6e2a:2/tcp/33272",
    "streams": {
      "r1": "/meshsub/1.1.0"
    }
  },
  "6pnqms1684205343710": {
    "peer": "12D3KooWSTEPj46WriuPpGeEEaGWLo95Wkeu4pZxe3QwDiAATp1o",
    "addr": "/dns6/canvas-testnet-p2.internal/tcp/8080/ws/p2p/12D3KooWSTEPj46WriuPpGeEEaGWLo95Wkeu4pZxe3QwDiAATp1o",
    "streams": {
      "i1": "/meshsub/1.1.0"
    }
  },
  "dnv8ox1684205494555": {
    "peer": "12D3KooWSTEPj46WriuPpGeEEaGWLo95Wkeu4pZxe3QwDiAATp1o",
    "addr": "/ip6/fdaa:0:ce3a:a7b:cb:bdaf:3282:2/tcp/51776",
    "streams": {
      "r1": "/meshsub/1.1.0"
    }
  }
}
```

### Ping a peer

```
% curl -X POST http://canvas-bootstrap-p0.internal:8000/ping/12D3KooWMES93VM4oWHXuRqRC4a4CYch3nNyqxSbqtZ4hGAi6R2f
Got response from 12D3KooWMES93VM4oWHXuRqRC4a4CYch3nNyqxSbqtZ4hGAi6R2f in 81ms
```
