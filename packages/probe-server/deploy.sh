#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-probe -c probe.fly.toml
