# @canvas-js/bootstrap-peer

The public multiaddrs for the mainnet bootstrap peers are

```
- /dns4/canvas-bootstrap-p0.fly.dev/tcp/443/wss/p2p/12D3KooWB3X5KnsTMknFLqxMf2979zddpwCWZ5ix1FosV5sFC4py
- /dns4/canvas-bootstrap-p1.fly.dev/tcp/443/wss/p2p/12D3KooWCSsK4VGWx4gA2FiUKQFEHyLrL6bf4xAJm6kqB2gkB59w
- /dns4/canvas-bootstrap-p2.fly.dev/tcp/443/wss/p2p/12D3KooWHWLKtWifVTMwJQRG6jcVCV3kLQ49GCB4DgevLTnKWor3
```

## Deploy

Deploy "mainnet":

```
$ ./deploy-mainnet.sh
```

## HTTP API

These routes are only accessible from the internal Canvas wireguard VPN.

```
- GET /api/connections
- GET /api/registrations
- GET /metrics
```

e.g.

```
$ curl http://canvas-bootstrap-p0.internal:8000/api/registrations | jq
```
