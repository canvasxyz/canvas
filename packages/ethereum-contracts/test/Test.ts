import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

const topic = "example:contract"

describe("Contract_Test", function () {
	async function deployFixture() {
		const Hashers = await ethers.getContractFactory("Hashers")
		const hashers = await Hashers.deploy()

		const Verifiers = await ethers.getContractFactory("Verifiers", {
			libraries: {
				Hashers: hashers.address,
			},
		})
		const verifiers = await Verifiers.deploy()

		const Test = await ethers.getContractFactory("Test", {
			libraries: {
				Verifiers: verifiers.address,
			},
		})
		const contract = await Test.deploy()

		await contract.deployed()
		return { contract }
	}

	async function getArgumentsFixture() {
		const { decodeURI } = await import("@canvas-js/signatures")
		const { Eip712Signer, Secp256k1SignatureScheme, getAbiString } = await import("@canvas-js/chain-ethereum")
		// @ts-ignore TS2339
		const { utils } = await import("ethers")

		async function getArguments(args?: any) {
			const signer = new Eip712Signer()
			const { payload: session, signer: delegateSigner } = await signer.newSession(topic)
			// const session = (args && args.session) || (await signer.newSession(topic))

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionMessageSignature = await delegateSigner.sign(sessionMessage)

			// TODO: replace since this makes assuptions + will fail for solana
			const userAddress = session.did.replace("did:pkh", "").split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1SignatureScheme.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))
			const uncompressedPublicKeyBytes = "0x" + utils.computePublicKey(publicKeyBytes).slice(4)

			const sessionMessageForContract = {
				...sessionMessage,
				payload: {
					userAddress,
					sessionAddress,
					authorizationData: {
						signature: session.authorizationData.signature,
					},
					blockhash: session.context.blockhash || "",
					duration: session.context.duration || 0,
					publicKey: uncompressedPublicKeyBytes, // TODO: check against sessionAddress
					timestamp: session.context.timestamp,
				},
			}

			const action = {
				type: "action" as const,
				did: session.did,
				name: (args && args.action && args.action.name) || "upvote",
				args: (args && args.action && args.action.args) || { post_id: "123456" },
				context: { timestamp: session.context.timestamp, blockhash: session.context.blockhash },
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionMessageSignature = await delegateSigner.sign(actionMessage)
			const actionMessageForContract = {
				...actionMessage,
				payload: {
					userAddress,
					sessionAddress,
					args: getAbiString(action.args),
					blockhash: action.context.blockhash || "",
					publicKey: uncompressedPublicKeyBytes, // TODO: check against sessionAddress
					name: action.name,
					timestamp: action.context.timestamp,
				},
			}

			return {
				signer,
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

	describe("contract.recoverAddressFromSession", function () {
		it("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { Eip712Signer, Secp256k1SignatureScheme } = await import("@canvas-js/chain-ethereum")
			const { decodeURI } = await import("@canvas-js/signatures")
			// @ts-ignore TS2339
			const { utils } = await import("ethers")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()

			const { payload: session } = await signer.newSession(topic)
			signer.verifySession(topic, session)

			const userAddress = session.did.replace("did:pkh", "").split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1SignatureScheme.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))
			const uncompressedPublicKeyBytes = "0x" + utils.computePublicKey(publicKeyBytes).slice(4)

			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				{
					userAddress: userAddress,
					sessionAddress: sessionAddress,
					authorizationData: {
						signature: session.authorizationData.signature,
					},
					publicKey: uncompressedPublicKeyBytes, // TODO: check against sessionAddress
					blockhash: session.context.blockhash || "",
					duration: session.context.duration || 0,
					timestamp: session.context.timestamp,
				},
				topic,
			)

			expect(recoveredWalletAddress).to.equal(userAddress)
		})
	})

	describe("contract.verifySessionMessageSignature", function () {
		it("Should verify that a session has been signed by the proper address with sign", async function () {
			const { Eip712Signer, Secp256k1SignatureScheme } = await import("@canvas-js/chain-ethereum")
			const { decodeURI } = await import("@canvas-js/signatures")
			// @ts-ignore TS2339
			const { utils } = await import("ethers")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()
			const { payload: session, signer: delegateSigner } = await signer.newSession(topic)

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionSignature = await delegateSigner.sign(sessionMessage)

			signer.scheme.verify(sessionSignature, sessionMessage)

			const userAddress = session.did.replace("did:pkh", "").split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1SignatureScheme.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))
			const uncompressedPublicKeyBytes = "0x" + utils.computePublicKey(publicKeyBytes).slice(4)

			const verified = await contract.verifySessionMessageSignature(
				{
					clock,
					parents,
					topic,
					payload: {
						userAddress,
						sessionAddress,
						authorizationData: {
							signature: session.authorizationData.signature,
						},
						blockhash: session.context.blockhash || "",
						duration: session.context.duration || 0,
						publicKey: uncompressedPublicKeyBytes, // TODO: check against sessionAddress
						timestamp: session.context.timestamp,
					},
				},
				sessionSignature.signature,
			)
			expect(verified).to.equal(true)
		})
	})

	describe("contract.verifyActionMessageSignature", function () {
		it("Should verify that an action has been signed by the proper address with sign", async function () {
			// @ts-ignore TS2339
			const { utils } = await import("ethers")
			const { decodeURI } = await import("@canvas-js/signatures")
			const { Eip712Signer, Secp256k1SignatureScheme, getAbiString } = await import("@canvas-js/chain-ethereum")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()
			const { payload: session, signer: delegateSigner } = await signer.newSession(topic)

			// sign an action
			const clock = 1
			const parents = ["parent1", "parent2"]
			const action = {
				type: "action" as const,
				did: session.did,
				name: "foo",
				args: { bar: 7 },
				context: {
					timestamp: session.context.timestamp,
					blockhash: session.context.blockhash,
				},
			}
			const actionMessage = { topic, clock, parents, payload: action }
			const actionSignature = await delegateSigner.sign(actionMessage)

			// verify the action offchain
			signer.scheme.verify(actionSignature, actionMessage)

			const userAddress = session.did.replace("did:pkh", "").split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1SignatureScheme.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))
			const uncompressedPublicKeyBytes = "0x" + utils.computePublicKey(publicKeyBytes).slice(4)

			const verified = await contract.verifyActionMessageSignature(
				{
					clock,
					parents,
					topic,
					payload: {
						userAddress,
						sessionAddress,
						args: getAbiString(action.args),
						blockhash: action.context.blockhash || "",
						publicKey: uncompressedPublicKeyBytes, // TODO: check against sessionAddress
						name: action.name,
						timestamp: action.context.timestamp,
					},
				},
				actionSignature.signature,
				sessionAddress,
			)
			expect(verified).to.equal(true)
		})
	})

	describe("claimUpvoted", function () {
		it("try to call claimUpvoted with a valid session and action, should only be applied once", async () => {
			const { contract } = await loadFixture(deployFixture)
			const { getArguments } = await loadFixture(getArgumentsFixture)

			expect(await contract.upvotes("123456")).to.equal(0)

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract, actionMessageSignature } =
				await getArguments()

			// submit the upvote action
			await contract.claimUpvoted(
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

		it("claimUpvoted fails if called with the wrong session address", async () => {
			const { contract } = await loadFixture(deployFixture)
			const { getArguments } = await loadFixture(getArgumentsFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract, actionMessageSignature } =
				await getArguments()

			const { sessionMessageForContract: sessionMessageForContract2 } = await getArguments()

			// replace the session address with an incorrect one
			sessionMessageForContract.payload.sessionAddress = sessionMessageForContract2.payload.sessionAddress

			// submit the upvote action
			try {
				await contract.claimUpvoted(
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

		it("claimUpvoted fails if called with an incorrect session message signature", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			const { sessionMessageForContract, actionMessageForContract, actionMessageSignature } = await getArguments()

			const { sessionMessageSignature: sessionMessageSignature2 } = await getArguments()

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					sessionMessageForContract,
					sessionMessageSignature2.signature, // use the wrong session message signature
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

		it("claimUpvoted fails if called with an incorrect action message signature", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract } = await getArguments()
			const { actionMessageSignature: actionMessageSignature2 } = await getArguments()

			expect(await contract.upvotes("123456")).to.equal(0)

			// submit the upvote action
			try {
				await contract.claimUpvoted(
					sessionMessageForContract,
					sessionMessageSignature.signature,
					actionMessageForContract,
					actionMessageSignature2.signature, // use the wrong action message signature
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

		it("claimUpvoted fails if called with an expired session for the action message", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			const {
				session,
				sessionMessageForContract,
				sessionMessageSignature,
				actionMessageForContract,
				actionMessageSignature,
			} = await getArguments()
			expect(await contract.upvotes("123456")).to.equal(0)

			// set the action timestamp to be after the expiry period
			actionMessageForContract.payload.timestamp = session.context.timestamp + (session.context.duration ?? 0) + 1

			// submit the upvote action
			try {
				await contract.claimUpvoted(
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

		it("claimUpvoted fails if called with an action message with the wrong action name", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)
			expect(await contract.upvotes("123456")).to.equal(0)

			// change the action name to an invalid value
			const actionOverride = { action: { name: "downvote" } }

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract, actionMessageSignature } =
				await getArguments(actionOverride)

			// submit the upvote action
			try {
				await contract.claimUpvoted(
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

		it("claimUpvoted fails if called with an action message with the wrong args", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			// change the action args field name to an invalid value
			const actionOverride = { action: { args: { something: "123456" } } }

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract, actionMessageSignature } =
				await getArguments(actionOverride)

			expect(await contract.upvotes("123456")).to.equal(0)

			// submit the upvote action
			try {
				await contract.claimUpvoted(
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

		it("claimUpvoted fails if called with an action message with the wrong arg type", async () => {
			const { getArguments } = await loadFixture(getArgumentsFixture)
			const { contract } = await loadFixture(deployFixture)

			// change the action args value to an invalid value
			const actionOverride = { action: { args: { post_id: 42 } } }

			const { sessionMessageForContract, sessionMessageSignature, actionMessageForContract, actionMessageSignature } =
				await getArguments(actionOverride)

			expect(await contract.upvotes("123456")).to.equal(0)

			// submit the upvote action
			try {
				await contract.claimUpvoted(
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
