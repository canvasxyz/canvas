#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-staging-p0 -c services/p0.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-staging-p1 -c services/p1.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-staging-p2 -c services/p2.fly.toml
