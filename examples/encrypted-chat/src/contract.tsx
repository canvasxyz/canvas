import type { Contract } from "@canvas-js/core"

const APP_TOPIC = '96f42ea6-f170-4630-a827-77ec31d24f85';
const DISCOVERY_TOPIC = 'canvas-discovery';

export const contract = {
  topic: APP_TOPIC,
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
    async createMessage(db: any, { content }: {content: any}, { id, address, timestamp } : {id: any, address: any, timestamp: any}) {
      console.log("received message:", content)
      await db.set("message", { id, address, content, timestamp })
    },
  },
} satisfies Contract