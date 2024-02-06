import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { serializeActionForContract, serializeSessionForContract } from "./utils.ts"

const topic = "example:contract"

describe("Contract_Example", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")
		const eip712_Canvas = await EIP712_Canvas.deploy()

		const Contract_Example = await ethers.getContractFactory("Contract_Test", {
			libraries: {
				EIP712_Canvas: eip712_Canvas.address,
			},
		})

		const contract = await Contract_Example.deploy()
		await contract.deployed()
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

	describe("Contract_Example.claimUpvoted", function () {
		it("try to call claimUpvoted with a valid session and action, should only be applied once", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)
			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			await contract.claimUpvoted(
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature.signature,
				actionMessageForContract,
				actionMessageSignature.signature,
			)

			// Expect the upvote to have been applied
			expect(await contract.upvotes("123456")).to.equal(1)

			// If we submit the action again, it should be rejected
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				),
					expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Each action can only be applied once'",
				)
			}

			// Expect the upvote to still be 1
			expect(await contract.upvotes("123456")).to.equal(1)
		})

		it("claimUpvoted must be called with a session signed by the wallet address", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})
			const signer2 = new EIP712Signer({})

			const session = await signer.getSession(topic)
			const session2 = await signer2.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = {
				...sessionMessage,
				// replace the session address with an incorrect one
				payload: serializeSessionForContract({ ...session, address: session2.address }),
			}

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)
			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Session must be signed by wallet address'",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with a session message signed by the session address", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})
			const signer2 = new EIP712Signer({})

			const session = await signer.getSession(topic)
			const session2 = await signer2.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const sessionMessage2 = { topic, clock, parents, payload: session2 }
			const sessionMessageSignature2 = signer2.sign(sessionMessage2)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)
			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					// use the wrong session message signature
					sessionMessageSignature2.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Session message must be signed by session address'",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message signed by the session address", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})
			const signer2 = new EIP712Signer({})

			const session = await signer.getSession(topic)
			const session2 = await signer2.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }

			const action2 = {
				type: "action" as const,
				address: session2.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session2.timestamp,
			}
			const actionMessage2 = { topic, clock, parents, payload: action2 }
			const actionMessageSignature2 = signer2.sign(actionMessage2)

			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					// use the wrong action message signature
					actionMessageSignature2.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Action message must be signed by session address'",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message that has not expired", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)

			// set the action timestamp to be after the expiry period
			action.timestamp = session.timestamp + session.duration! + 1
			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Action must have been signed by a session that has not expired'",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message with the correct name", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "downvote",
				args: { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)

			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Action name must be 'upvote''",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message with the correct arg name", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				// arg name should be "post_id"
				args: { something: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)

			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with reason string 'Action argument name must be 'post_id''",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message with the correct arg type", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { getPublicKeyFromSignature } = await loadFixture(getPublicKeyFromSignatureFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = signer.sign(sessionMessage)

			const publicKey = getPublicKeyFromSignature(sessionMessageSignature)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: "upvote",
				// post_id should be a string
				args: { post_id: 42 },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)

			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				)
				expect.fail()
			} catch (e: any) {
				expect(e.message).to.equal(
					"VM Exception while processing transaction: reverted with panic code 0x41 (Too much memory was allocated, or an array was created that is too large)",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})
	})
})
