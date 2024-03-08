import type { Contract } from "@canvas-js/core"

const APP_TOPIC = '96f42ea6-f170-4630-a827-77ec31d24f85';
const DISCOVERY_TOPIC = 'canvas-discovery';

export const contract = {
  topic: APP_TOPIC,
  models: {
    messages: {
      id: "primary",
      address: "string",
      content: "string",
      timestamp: "integer",
      $indexes: ["timestamp"],
    },
  },
  actions: {
    async sendMessage(db: any, { content }: {content: any}, { id, address, timestamp } : {id: any, address: any, timestamp: any}) {
      await db.set("messages", { id, address, content, timestamp })
    },
  },
} satisfies Contract