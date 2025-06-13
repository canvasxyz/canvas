#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-relay-server -c mainnet/fly.toml
