# Forum Example

[Demo](https://forum-example.canvas.xyz/) - [Github](https://github.com/canvasxyz/canvas/tree/main/examples/forum)

The forum example implements a simple publishing platform.

## Developing

- `npm run dev:server` to start the server, on port 8080
- `npm run dev` to start the client, on port 5173
- `cloudflared tunnel --url http://localhost:5173` for SIWF Mini App development

## Farcaster Mini App Development

First, update the domain manifest:

- Enable developer mode in Warpcast app.
- Go to Developer Tools > Domains
- Enter the domain of your Cloudflare tunnel, e.g.
  e.g. https://timber-trained-carey-composed.trycloudflare.com
- Select "Generate domain manifest" and copy-paste the generated manifest into
  public/.well-known/farcaster.json
- Select "Check domain status", and it should validate successfully.

Don't check in the domain manifest when committing to Git. The checked-in
manifest should always correspond to the production application.

Now, to preview the mini app:

- Go to Developer > Frame Playground > Preview
- Enter the cloudflared tunnel URL, and select "Launch", or "Preview Embed".

## Deploying to Railway

Create a Railway space based on the root of this Github workspace
(e.g. canvasxyz/canvas).

Set the railway config to `examples/forum/railway.json`. This will
configure the start command, build command, and watch paths.

Configure networking for the application:
- Port 8080 should map to the websocket server defined in VITE_CANVAS_WS_URL (e.g. forum-example.canvas.xyz).
- Port 4444 should map to a URL where your libp2p service will be exposed. (e.g. forum-example-libp2p.canvas.xyz).

Configure environment variables:
- ANNOUNCE (e.g. /dns4/forum-example-libp2p.canvas.xyz/tcp/443/wss)
- DATABASE_URL
- LIBP2P_PRIVATE_KEY (try: node ./scripts/generateLibp2pPrivkey.js)
- DEBUG (optional, for logging)