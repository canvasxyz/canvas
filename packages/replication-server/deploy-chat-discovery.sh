#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-p0 -c chat-discovery/p0.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-p1 -c chat-discovery/p1.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-discovery-p2 -c chat-discovery/p2.fly.toml
