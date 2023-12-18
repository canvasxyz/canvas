import * as ATP from "@atproto/api"
import { ATPSigner } from "@canvas-js/chain-atp"
import { Secp256k1Signer } from "@canvas-js/signed-cid"
import { writeFile } from "fs/promises"
import { stdin, stdout } from "process"
import { createInterface } from "readline/promises"

const BskyAgent = ATP.BskyAgent ?? ATP["default"].BskyAgent

const agent = new BskyAgent({ service: "https://bsky.social" })

const rl = createInterface({ input: stdin, output: stdout })
const identifier = await rl.question("Enter identifier: ")
const password = await rl.question("Enter app password: ")
rl.close()

await agent.login({
	identifier,
	password,
})

const address = agent.session.did

const plcOperationLog = await fetch(`https://plc.directory/${address}/log`).then((res) => res.json())
console.log(JSON.stringify(plcOperationLog))

const topic = "foobar"

const signer = new Secp256k1Signer()
const message = ATPSigner.createAuthenticationMessage(topic, signer.uri, address)
console.log(message)
const { uri, cid } = await agent.post({ text: message })

const prefix = `at://${address}/`
const [collection, rkey] = uri.slice(prefix.length).split("/")

const result = await agent.com.atproto.sync.getRecord({ did: address, collection, rkey })

await agent.deletePost(uri)

console.log(`address: ${address}`)
console.log(`signingKey: ${signer.uri}`)
console.log(`uri: ${uri}`)
console.log(`rkey: ${rkey}`)

await writeFile(`./archives/${rkey}.car`, result.data, "binary")
