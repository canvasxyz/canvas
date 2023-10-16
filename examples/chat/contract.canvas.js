export const models = {
  message: {
    id: "primary",
    user: "string",
    content: "string",
    timestamp: "integer",
    $indexes: ["user", "timestamp"],
  },
};

export const actions = {
  async createMessage(db, { content }, { id, chain, address, timestamp }) {
    const user = `${chain}:${address}`;
    await db.message.set({ id, user, content, timestamp });
  },
};
