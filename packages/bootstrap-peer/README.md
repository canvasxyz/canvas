# @canvas-js/bootstrap-peer

This package has the bootstrap peers we deploy to fly.io.

All three must be deployed separately:

```
$ fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p0 -c p0.fly.toml
$ fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p1 -c p1.fly.toml
$ fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p2 -c p2.fly.toml
```
