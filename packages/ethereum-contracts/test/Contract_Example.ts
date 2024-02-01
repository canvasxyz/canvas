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
		it("try to call claimUpvoted with a valid session and action", async () => {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes()).to.equal(0)

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

			const sessionMessageForContract = {
				clock,
				parents,
				topic,
				payload: serializeSessionForContract(session),
			}

			const action = {
				type: "action" as const,
				address: session.address,
				name: "foo",
				args: { bar: 7 },
				blockhash: null,
				timestamp: session.timestamp,
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = signer.sign(actionMessage)
			const actionMessageForContract = {
				clock,
				parents,
				topic,
				// action fields
				payload: await serializeActionForContract(action),
			}

			// submit the upvote action
			await contract.claimUpvoted(
				expectedAddress,
				sessionMessageForContract,
				sessionMessageSignature.signature,
				actionMessageForContract,
				actionMessageSignature.signature,
			)

			// Expect the upvote to have been applied
			expect(await contract.upvotes()).to.equal(1)

			// If we submit the action again, it should be rejected
			expect(
				contract.claimUpvoted(
					expectedAddress,
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature.signature,
				),
			).to.be.rejectedWith(
				"Error: VM Exception while processing transaction: reverted with reason string 'Each action can only be applied once'",
			)

			// Expect the upvote to still be 1
			expect(await contract.upvotes()).to.equal(1)
		})
	})
})
