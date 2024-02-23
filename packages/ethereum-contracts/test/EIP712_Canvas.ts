import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { serializeActionForContract, serializeSessionForContract } from "./utils.ts"

const topic = "example:signer"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")
		const eip712_Canvas = await EIP712_Canvas.deploy()

		const EIP712_Canvas_External = await ethers.getContractFactory("EIP712_Canvas_Test", {
			libraries: {
				EIP712_Canvas: eip712_Canvas.address,
			},
		})
		const contract = await EIP712_Canvas_External.deploy()
		await contract.deployed()
		return { contract }
	}

	describe("contract.recoverAddressFromSession", function () {
		it("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { Eip712Signer } = await import("@canvas-js/chain-ethereum")
			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()

			const session = await signer.getSession(topic)
			signer.verifySession(topic, session)

			const walletAddress = session.address.split(":")[2]

			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				{
					address_: walletAddress,
					authorizationData: {
						signature: session.authorizationData.signature,
					},
					blockhash: session.blockhash || "",
					duration: session.duration || 0,
					publicKey: session.publicKey,
					timestamp: session.timestamp,
				},
				topic,
			)

			expect(recoveredWalletAddress).to.equal(walletAddress)
		})
	})

	describe("contract.verifySessionMessage", function () {
		it("Should verify that a session has been signed by the proper address with sign", async function () {
			const { decodeURI } = await import("@canvas-js/signatures")
			const { Eip712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()
			const session = await signer.getSession(topic, { fromCache: false })

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionSignature = await signer.sign(sessionMessage)

			signer.verify(sessionSignature, sessionMessage)

			// extract the public key from the URI
			const { type, publicKey } = decodeURI(sessionSignature.publicKey)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const verified = await contract.verifySessionMessage(
				{
					clock,
					parents,
					topic,
					payload: serializeSessionForContract(session),
				},
				sessionSignature.signature,
				expectedAddress,
				topic,
			)
			expect(verified).to.equal(true)
		})
	})

	describe("contract.verifyActionMessage", function () {
		it("Should verify that an action has been signed by the proper address with sign", async function () {
			const { decodeURI } = await import("@canvas-js/signatures")
			const { Eip712Signer, getAbiString } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()
			const session = await signer.getSession(topic, { fromCache: false })

			// sign an action
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
			const actionSignature = await signer.sign(actionMessage)

			// verify the action offchain
			signer.verify(actionSignature, actionMessage)

			// extract the public key from the URI
			const { publicKey } = decodeURI(actionSignature.publicKey)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			// we should include the recovery parameter as part of the signature
			// and then just ignore it if we are verifying using a method that doesn't need it
			// this could be implemented inside the contract
			const verified = await contract.verifyActionMessage(
				{
					clock,
					parents,
					topic,
					// action fields
					payload: await serializeActionForContract(action),
				},
				actionSignature.signature,
				expectedAddress,
				topic,
			)
			expect(verified).to.equal(true)
		})
	})
})
