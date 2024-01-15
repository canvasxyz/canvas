#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat -c services/canvas-chat.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-2 -c services/canvas-chat-2.fly.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-3 -c services/canvas-chat-3.fly.toml
