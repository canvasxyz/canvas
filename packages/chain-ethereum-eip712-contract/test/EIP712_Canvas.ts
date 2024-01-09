import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

const domainName = "example:signer"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		const contract = await EIP712_Canvas.deploy()

		return { contract }
	}

	describe("Signing data", function () {
		it("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")
			const { base58btc } = await import("multiformats/bases/base58")
			const { verifySignedValue, didKeyPattern } = await import("@canvas-js/signed-cid")
			const { varint } = await import("multiformats")
			const { sha256 } = await import("@noble/hashes/sha256")
			const ethers = await import("ethers")

			const { contract } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(domainName)
			signer.verifySession(domainName, session)

			const walletAddress = session.address.split(":")[2]

			console.log(Buffer.from(session.authorizationData.signature).toString("hex"))
			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
				session.authorizationData.signature,
			)

			expect(recoveredWalletAddress).to.equal(walletAddress)

			const topic = "example:signer"
			const sessionMessage = { topic, clock: 1, parents: [], payload: session }
			const sessionSignature = signer.sign(sessionMessage)

			verifySignedValue(sessionSignature, sessionMessage)

			const result = didKeyPattern.exec(sessionSignature.publicKey)
			const bytes = base58btc.decode(result![1])
			const [keyCodec, keyCodecLength] = varint.decode(bytes)
			const publicKey = bytes.subarray(keyCodecLength)

			const expectedAddress = `0x${ethers.utils.keccak256(publicKey).slice(-40)}`
			console.log(`session address from publicKey: ${expectedAddress}`)

			console.log(sessionSignature.cid.bytes.slice(0, 32))
			console.log("using the whole signature:")

			console.log(`sessionSignature.cid.bytes.slice(0, 32):`)
			console.log(sessionSignature.cid.bytes.slice(0, 32))

			// why doesn't this work?
			// one of the b values should equal expectedAddress
			for (const v of [27, 28]) {
				const b = await contract.validateAddressFromCidSignature2(sessionSignature.cid.bytes.slice(0, 32), [
					...sessionSignature.signature,
					v,
				])
				console.log(`recovered address when v = ${v}: ${b}`)
			}
		})
	})
})
