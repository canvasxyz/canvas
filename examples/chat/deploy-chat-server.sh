#!/usr/bin/env sh
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat -c server/canvas-chat.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-2 -c server/canvas-chat-2.toml
fly deploy --build-arg NODE_ENV=production --remote-only -a canvas-chat-3 -c server/canvas-chat-3.toml
