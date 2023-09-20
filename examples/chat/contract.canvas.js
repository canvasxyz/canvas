export const models = {
  message: {
    user: "string",
    content: "string",
    timestamp: "integer",
    $indexes: ["user", "timestamp"],
  },
};

export const actions = {
  async createMessage(db, { content }, { chain, address, timestamp }) {
    const user = `${chain}:${address}`;
    return await db.message.add({ user, content, timestamp });
  },
};
