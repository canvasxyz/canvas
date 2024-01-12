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
		xit("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")
			const { base58btc } = await import("multiformats/bases/base58")
			const { varint } = await import("multiformats")
			const { verifySignedValue, didKeyPattern } = await import("@canvas-js/signed-cid")
			const { publicKeyToAddress } = await import("viem/utils")

			const { contract } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(domainName)
			signer.verifySession(domainName, session)

			const walletAddress = session.address.split(":")[2]

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

			// extract the public key from the URI
			const result = didKeyPattern.exec(sessionSignature.publicKey)
			const bytes = base58btc.decode(result![1])
			const [keyCodec, keyCodecLength] = varint.decode(bytes)
			const publicKey = bytes.subarray(keyCodecLength)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = publicKeyToAddress(`0x${publicKeyHex}`)

			const signedValue = sessionSignature.cid.bytes.slice(0, 32)

			// we don't return the recovery parameter currently, so we need to try both of them
			let matchingAddressFound = false
			// we should include the recovery parameter as part of the signature
			// and then just ignore it if we are verifying using a method that doesn't need it
			for (const v of [27, 28]) {
				const signatureWithRecoveryParam = [...sessionSignature.signature, v]
				const b = await contract.recoverAddressFromHash(signedValue, signatureWithRecoveryParam)
				console.log(`.sol recovered address when v = ${v}: ${b}`)
				if (b === expectedAddress) {
					matchingAddressFound = true
				}
			}
			expect(matchingAddressFound).to.equal(true)
		})

		it("test creating and verifying CID for Message<Session>", async () => {
			const { contract } = await loadFixture(deployFixture)
		})
	})
})
