-- CreateTable
CREATE TABLE "addresses" (
    "topic" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    PRIMARY KEY ("topic", "address")
);

-- CreateTable
CREATE TABLE "messages" (
    "topic" TEXT NOT NULL,
    "message_id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "messages_type_idx" ON "messages"("type");

-- CreateIndex
CREATE INDEX "messages_topic_idx" ON "messages"("topic");
