#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a test-discovery-p0 -c services/p0.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a test-discovery-p1 -c services/p1.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a test-discovery-p2 -c services/p2.fly.toml
