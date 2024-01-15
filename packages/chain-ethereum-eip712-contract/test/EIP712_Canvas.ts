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

	async function getPublicKeyFromSignatureFixture() {
		const { base58btc } = await import("multiformats/bases/base58")
		const { varint } = await import("multiformats")
		const { didKeyPattern } = await import("@canvas-js/signed-cid")

		function getPublicKeyFromSignature(signature: any) {
			const result = didKeyPattern.exec(signature.publicKey)
			const bytes = base58btc.decode(result![1])
			const [keyCodec, keyCodecLength] = varint.decode(bytes)
			return bytes.subarray(keyCodecLength)
		}

		return { getPublicKeyFromSignature }
	}

	describe("Signing data", function () {
		it("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")
			const { contract } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(domainName)
			signer.verifySession(domainName, session)

			const walletAddress = session.address.split(":")[2]

			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				{
					address_: walletAddress,
					blockhash_: session.blockhash || "",
					duration: session.duration || 0,
					publicKey: session.publicKey,
					timestamp: session.timestamp,
				},
				session.authorizationData.signature,
			)

			expect(recoveredWalletAddress).to.equal(walletAddress)
		})

		it("Should verify that a session has been signed by the proper address with sign", async function () {
			const { verifySignedValue } = await import("@canvas-js/signed-cid")
			const ethers = await import("ethers")
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")

			const { contract } = await loadFixture(deployFixture)
			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})
			const session = await signer.getSession(domainName)

			const topic = "example:signer"
			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionSignature = signer.sign(sessionMessage)

			verifySignedValue(sessionSignature, sessionMessage)

			// extract the public key from the URI
			const publicKey = getPublicKeyFromSignature(sessionSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const verified = await contract.verifyAddressForMessageSession(
				{
					clock,
					parents,
					topic,
					payload: {
						address_: session.address.split(":")[2],
						blockhash_: session.blockhash || "",
						duration: session.duration || 0,
						publicKey: session.publicKey,
						timestamp: session.timestamp,
					},
				},
				sessionSignature.signature,
				expectedAddress,
			)
			expect(verified).to.equal(true)
		})

		it("Should verify that an action has been signed by the proper address with sign", async function () {
			const { verifySignedValue, dynamicAbiEncodeArgs } = await import("@canvas-js/signed-cid")
			const ethers = await import("ethers")
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")

			const { contract } = await loadFixture(deployFixture)
			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})
			const session = await signer.getSession(domainName)

			const topic = "example:signer"
			const clock = 1
			const parents = ["parent1", "parent2"]

			const action = {
				type: "action" as const,
				address: session.address,
				name: "foo",
				args: { bar: 7 },
				blockhash: null,
				timestamp: session.timestamp,
			}

			const actionMessage = { topic, clock, parents, payload: action }
			const actionSignature = signer.sign(actionMessage)

			verifySignedValue(actionSignature, actionMessage)

			// extract the public key from the URI
			const publicKey = getPublicKeyFromSignature(actionSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			// we should include the recovery parameter as part of the signature
			// and then just ignore it if we are verifying using a method that doesn't need it
			// this could be implemented inside the contract
			const verified = await contract.verifyAddressForMessageAction(
				{
					clock,
					parents,
					topic,
					// action fields
					payload: {
						address_: action.address.split(":")[2],
						args: dynamicAbiEncodeArgs(action.args),
						blockhash_: action.blockhash || "",
						name: action.name,
						timestamp: action.timestamp,
					},
				},
				actionSignature.signature,
				expectedAddress,
			)
			expect(verified).to.equal(true)
		})
	})
})
