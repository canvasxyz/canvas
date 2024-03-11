import * as ATP from "@atproto/api"
import { ATPSigner } from "@canvas-js/chain-atp"
import { Ed25519DelegateSigner } from "@canvas-js/signatures"
import { randomUUID } from "crypto"
import { writeFile } from "fs/promises"
import { stdin, stdout } from "process"
import { createInterface } from "readline/promises"

const BskyAgent = ATP.BskyAgent ?? ATP["default"].BskyAgent

const agent = new BskyAgent({ service: "https://bsky.social" })

const rl = createInterface({ input: stdin, output: stdout })
const identifier = await rl.question("Enter identifier: ")
const password = await rl.question("Enter app password: ")
rl.close()

await agent.login({ identifier, password })

const address = agent.session!.did

const topic = randomUUID()

const signer = new Ed25519DelegateSigner()
const message = ATPSigner.createAuthenticationMessage(topic, signer.uri, address)
const { uri, cid } = await agent.post({ text: message })

const prefix = `at://${address}/`
const [collection, rkey] = uri.slice(prefix.length).split("/")

const result = await agent.com.atproto.sync.getRecord({ did: address, collection, rkey })

await agent.deletePost(uri)

const testFixture = {
	address,
	signingKey: signer.uri,
	topic,
	archives: {
		[`test/archives/${rkey}.car`]: uri,
	},
}

const plcOperationLog = await fetch(`https://plc.directory/${address}/log`).then((res) => res.json())
const plcOperationLogPath = "./test/plcOperationLog.json"
await writeFile(plcOperationLogPath, JSON.stringify(plcOperationLog, null, "\t"))
console.log(`Updated ${plcOperationLogPath}`)

const fixturePath = `./test/fixture.json`
await writeFile(fixturePath, JSON.stringify(testFixture, null, "\t"))
console.log(`Updated ${fixturePath}`)

const archivePath = `./test/archives/${rkey}.car`
await writeFile(archivePath, result.data, "binary")
console.log(`Written record archive to ${archivePath}`)
