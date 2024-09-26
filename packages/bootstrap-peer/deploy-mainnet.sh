#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p0 -c mainnet/p0.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p1 -c mainnet/p1.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-bootstrap-p2 -c mainnet/p2.fly.toml
