# Canvas - Chat Server

This is an example package for deploying a Canvas spec to Fly.io, or other hosted services.

### Developing

1. Install the Canvas CLI with `npm install -g @canvas-js/cli`.
2. Start a local Canvas node with `canvas run spec.canvas.js`.

### Deploying to Fly.io

1. Install [flyctl](https://fly.io/docs/speedrun/) and make sure you are logged in.
2. Inside `fly.toml`, change `app` to your app name.
3. Run `fly volumes create canvas_example_chat_data --size 3` to create a 3GB storage volume.
4. Run `flyctl deploy`.

(c) 2022 Canvas Technology Corporation
