import express from "express"

import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { encode, decode } from "@ipld/dag-json"
import { inspect } from "util"

const dev = process.env.NODE_ENV !== "production"

process.on('uncaughtException', (error) => {
  console.error('Unhandled Exception:', error);
  console.log(inspect(error));

  throw error;
});

const canvasApp = await Canvas.initialize({
  path: "postgresql://postgres:postgres@localhost:5432/chat_postgres",
  contract: {
    topic: "chat-example.canvas.xyz",
    models: {
      message: {
        id: "primary",
        address: "string",
        content: "string",
        timestamp: "integer",
        $indexes: ["address", "timestamp"],
      },
    },
    actions: {
      async createMessage(db, { content }, { id, address, timestamp }) {
        await db.set("message", { id, address, content, timestamp })
      },
    }
  },
  signers: [new SIWESigner()],
  indexHistory: false,
  discoveryTopic: "canvas-discovery",
  trackAllPeers: true,
  presenceTimeout: 12 * 60 * 60 * 1000, // keep up to 12 hours of offline peers
  bootstrapList: [
    "/dns4/canvas-chat-discovery-staging-p0.fly.dev/tcp/443/wss/p2p/12D3KooWFtS485QGEZwquMQbq7MZTMxiuHs6xUKEi664i4yWUhWa",
    "/dns4/canvas-chat-discovery-staging-p1.fly.dev/tcp/443/wss/p2p/12D3KooWPix1mT8QavTjfiha3hWy85dQDgPb9VWaxRhY8Yq3cC7L",
    "/dns4/canvas-chat-discovery-staging-p2.fly.dev/tcp/443/wss/p2p/12D3KooWRbxAWmpvc9U7q1ftBTd3bKa1iQ2rn6RkwRb1d9K7hVg5",
    "/dns4/canvas-chat.fly.dev/tcp/443/wss/p2p/12D3KooWRrJCTFxZZPWDkZJboAHBCmhZ5MK1fcixDybM8GAjJM2Q",
    "/dns4/canvas-chat-2.fly.dev/tcp/443/wss/p2p/12D3KooWKGP8AqaPALAqjUf9Bs7KtKtkwDavZBjWhaPqKnisQL7M",
    "/dns4/canvas-chat-3.fly.dev/tcp/443/wss/p2p/12D3KooWAC1vj6ZGhbW8jgsDCZDK3y2sSJG2QGVZEqhEK7Rza8ic",
    ...defaultBootstrapList,
  ],
})

canvasApp.libp2p.start()

const expressApp = express()
expressApp.use(express.json())
expressApp.set("json spaces", 2)

expressApp.get("/read", async (_, res) => {
  try {
    const results = await canvasApp.db.query("message", {})
    const connections = canvasApp.libp2p.getConnections()

    return res.json({
      messages: results,
      status: canvasApp.status,
      connectionsLength: connections.length,
      connections,
    })
  } catch (err) {
    return res.status(400).json({ error: "[Canvas] query failed" })
  }
})

expressApp.get("/send", async (req, res) => {
  const messageContent = req.body.message || "<debug>"

  try {
    await canvasApp.actions.createMessage({ content: messageContent })

    res.json({ message: messageContent })
  } catch (error) {
    console.error("Error creating message:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

expressApp.get("/getClock", async (_, res) => {
  try {
    const [nextClockValue, parentMessageIds] = await canvasApp.messageLog.getClock()

    res.json({ nextClockValue, parentMessageIds })
  } catch (error) {
    console.error("Error fetching clock values:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

expressApp.post("/insert", async (req, res) => {
  const data = decode(encode(req.body))

  if (!data.signature || !data.message) {
    console.error("~~ message didnt come through ~~")
  }

  try {
    const resp = await canvasApp.insert(data.signature, data.message)
    res.status(200).json({ message_id: resp.id })
  } catch (err) {
    console.error("Canvas insert error :>> ", err)
    res.status(200).json({ message_id: null })
  }
})

expressApp.post("/getSession", async (req, res) => {
  const session = req.body.session

  const message_id = await canvasApp.getSession(session)

  res.status(200).json({ message_id: message_id })
})

expressApp.all("*", (req, res) => {
  return handle(req, res)
})

expressApp.listen(3000, () => {
  console.log("> Ready on http://localhost:3000")
})