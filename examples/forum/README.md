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

Create a Railway space based on the root of this Github workspace (e.g. canvasxyz/canvas).

* Custom build command: `npm run build && VITE_CANVAS_WS_URL=wss://forum-example.canvas.xyz npm run build --workspace=@canvas-js/forum-example`
* Custom start command: `./install-prod.sh && canvas run /tmp/canvas-example-forum --port 8080 --static examples/forum/dist --topic forum-example.canvas.xyz --init examples/forum/src/contract.ts`
* Watch paths: `/examples/forum/**`
* Public networking:
  * Add a service domain for port 8080.
  * Add a service domain for port 4444.
* Watch path: `/examples/forum/**`. (Only build when forum code is updated, or a forum package is updated.)
