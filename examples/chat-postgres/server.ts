import express from "express"
import next from "next"

import { Canvas, defaultBootstrapList } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { encode, decode } from "@ipld/dag-json"
import { inspect } from "util"
import { assert } from "@canvas-js/utils"

const dev = process.env.NODE_ENV !== "production"
const nextApp = next({ dev })
const handle = nextApp.getRequestHandler()

const HTTP_PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const HTTP_ADDR = "0.0.0.0";

process.on('uncaughtException', (error) => {
  console.error('Unhandled Exception:', error);
});

nextApp.prepare().then(async () => {
  const canvasApp = await Canvas.initialize({
    path: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/chat_postgres",
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

    try {
      assert(data.signature, "POST /insert must provide 'signature'")
      assert(data.message, "POST /insert must provide 'message'")

      const resp = await canvasApp.insert(data.signature, data.message)
      res.status(200).json({ message_id: resp.id })
    } catch (err) {
      console.error("Canvas insert error :>> ", err)
      res.status(400).json({ message_id: null })
    }
  })

  expressApp.post("/getSession", async (req, res) => {
    try {
      const session = req.body.session

      assert(session, "POST /insert must provide 'session'")
      assert(session.address, "POST /insert must provide 'session.address'")
      assert(session.publicKey, "POST /insert must provide 'session.publicKey'")
      assert(session.timestamp, "POST /insert must provide 'session.timestamp'")

      const message_id = await canvasApp.getSession(session)

      res.status(200).json({ message_id: message_id })
    } catch (err) {
      res.status(400).json({ message_id: null })
    }
  })

  expressApp.all("*", (req, res) => {
    return handle(req, res)
  })

  expressApp.listen(HTTP_PORT, HTTP_ADDR, () => {
    console.log(`> Ready on http://${HTTP_ADDR}:${HTTP_PORT}`)
  })
})