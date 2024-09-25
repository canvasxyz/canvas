#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-testnet-p0 -c testnet/p0.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-testnet-p1 -c testnet/p1.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-testnet-p2 -c testnet/p2.fly.toml
