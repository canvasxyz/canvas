#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat -c services/canvas-chat.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-2 -c services/canvas-chat-2.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-3 -c services/canvas-chat-3.toml
