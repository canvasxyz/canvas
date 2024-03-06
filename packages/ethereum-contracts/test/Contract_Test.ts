import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { serializeActionForContract, serializeSessionForContract } from "./utils.ts"

const topic = "example:contract"

describe("Contract_Test", function () {
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

	async function getArgumentsFixture() {
		// This function returns a function that returns the arguments needed to call `contract.claimUpvoted`

		const { decodeURI } = await import("@canvas-js/signatures")
		const { Eip712Signer } = await import("@canvas-js/chain-ethereum")

		async function getArguments(args?: any) {
			const signer = new Eip712Signer()

			const session = (args && args.session) || (await signer.getSession(topic))

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = await signer.sign(sessionMessage)

			const { publicKey } = decodeURI(sessionMessageSignature.publicKey)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")
			const expectedAddress = ethers.utils.computeAddress(`0x${publicKeyHex}`)

			const sessionMessageForContract = { ...sessionMessage, payload: serializeSessionForContract(session) }

			const action = {
				type: "action" as const,
				address: session.address,
				name: (args && args.action && args.action.name) || "upvote",
				args: (args && args.action && args.action.args) || { post_id: "123456" },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = await signer.sign(actionMessage)
			const actionMessageForContract = { ...actionMessage, payload: await serializeActionForContract(action) }

			return {
				signer,
				expectedAddress,
				session,
				sessionMessage,
				sessionMessageSignature,
				sessionMessageForContract,
				actionMessage,
				actionMessageSignature,
				actionMessageForContract,
			}
		}
		return { getArguments }
	}

	describe("Contract_Example.claimUpvoted", function () {
		it("try to call claimUpvoted with a valid session and action, should only be applied once", async () => {
			const { contract } = await loadFixture(deployFixture)
			const { getArguments } = await loadFixture(getArgumentsFixture)

			expect(await contract.upvotes("123456")).to.equal(0)

			const {
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments()

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
					"VM Exception while processing transaction: reverted with reason string 'Action has already been processed'",
				)
			}

			// Expect the upvote to still be 1
			expect(await contract.upvotes("123456")).to.equal(1)
		})

		it("claimUpvoted must be called with a session signed by the wallet address", async () => {
			const { contract } = await loadFixture(deployFixture)
			const { getArguments } = await loadFixture(getArgumentsFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const {
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments()

			const { sessionMessageForContract: sessionMessageForContract2 } = await getArguments()

			// replace the session address with an incorrect one
			sessionMessageForContract.payload.address_ = sessionMessageForContract2.payload.address_

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
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { expectedAddress, sessionMessageForContract, actionMessageForContract, actionMessageSignature } =
				await getArguments()

			const { sessionMessageSignature: sessionMessageSignature2 } = await getArguments()

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
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			const { expectedAddress, sessionMessageForContract, sessionMessageSignature, actionMessageForContract } =
				await getArguments()
			const { actionMessageSignature: actionMessageSignature2 } = await getArguments()

			expect(await contract.upvotes("123456")).to.equal(0)

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
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			const {
				expectedAddress,
				session,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments()
			expect(await contract.upvotes("123456")).to.equal(0)

			// set the action timestamp to be after the expiry period
			actionMessageForContract.payload.timestamp = session.timestamp + session.duration! + 1

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
					"VM Exception while processing transaction: reverted with reason string 'Action message must be signed by session address'",
				)
			}

			// Expect the upvote to have not been applied
			expect(await contract.upvotes("123456")).to.equal(0)
		})

		it("claimUpvoted must be called with an action message with the correct name", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			// change the action name to an invalid value
			const actionOverride = { action: { name: "downvote" } }

			const {
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments(actionOverride)

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
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			// change the action args field name to an invalid value
			const actionOverride = { action: { args: { something: "123456" } } }

			const {
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments(actionOverride)

			expect(await contract.upvotes("123456")).to.equal(0)

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
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			// change the action args value to an invalid value
			const actionOverride = { action: { args: { post_id: 42 } } }

			const {
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments(actionOverride)

			expect(await contract.upvotes("123456")).to.equal(0)

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
