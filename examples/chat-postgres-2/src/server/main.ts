import express from "express";
import ViteExpress from "vite-express";
import { topic, models, actions } from './contract.canvas.js';
import { Canvas, defaultBootstrapList } from '@canvas-js/core';

const canvasApp = await Canvas.initialize({
  path: 'postgresql://postgres:postgres@localhost:5432/chat_postgres',
  contract: {
    topic,
    models,
    actions
  },
  indexHistory: false,
  discoveryTopic: "canvas-discovery",
  trackAllPeers: true,
  presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
  bootstrapList: [
    "/dns4/canvas-chat-discovery-p0.fly.dev/tcp/443/wss/p2p/12D3KooWG1zzEepzv5ib5Rz16Z4PXVfNRffXBGwf7wM8xoNAbJW7",
    "/dns4/canvas-chat-discovery-p1.fly.dev/tcp/443/wss/p2p/12D3KooWNfH4Z4ayppVFyTKv8BBYLLvkR1nfWkjcSTqYdS4gTueq",
    "/dns4/canvas-chat-discovery-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRBdFp5T1fgjWdPSCf9cDqcCASMBgcLqjzzBvptjAfAxN",
    "/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
    "/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWKGP8AqaPALAqjUf9Bs7KtKtkwDavZBjWhaPqKnisQL7M",
    "/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWAC1vj6ZGhbW8jgsDCZDK3y2sSJG2QGVZEqhEK7Rza8ic",
    ...defaultBootstrapList,
  ],
});

canvasApp.libp2p.start();

const expressApp = express();
expressApp.set('json spaces', 2);

expressApp.get("/read", async (_, res) => {
  console.log('canvasApp.status :>> ', canvasApp.status);

  try {
    const results = await canvasApp.db.query("message", {})
    console.log('results :>> ', results);
    const connections = canvasApp.libp2p.getConnections();

    return res.json({
      messages: results,
      status: canvasApp.status,
      connectionsLength: connections.length,
      connections,
    });
  } catch (err) {
    return res.status(400).json({ error: '[Canvas] query failed' });
  }
});

// api.get("/connections", (req, res) => {
//   const result: Record<string, { peer: string; addr: string; streams: Record<string, string | null> }> = {}

//   for (const { id, remotePeer, remoteAddr, streams } of libp2p.getConnections()) {
//     result[id] = {
//       peer: remotePeer.toString(),
//       addr: remoteAddr.toString(),
//       streams: Object.fromEntries(streams.map((stream) => [stream.id, stream.protocol ?? null])),
//     }
//   }

//   return res.status(StatusCodes.OK).json(result)
// })

expressApp.get("/send", (req, res) => {
  const messageContent = req.query.message || 'Default message';

  canvasApp.actions.createMessage({ content: messageContent });

  res.json({ message: messageContent });
  console.log('you sent :>> ', messageContent);
});

ViteExpress.listen(expressApp, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
