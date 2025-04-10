#!/bin/node
const { bytesToHex } = await import("@noble/hashes/utils")
const { MessageId } = await import("@canvas-js/gossiplog")
const { base32hex } = await import("multiformats/bases/base32")

const msgId = process.argv[process.argv.length - 1]
const result = MessageId.decode(base32hex.baseDecode(msgId))

console.log({ ...result, key: bytesToHex(result.key) })
