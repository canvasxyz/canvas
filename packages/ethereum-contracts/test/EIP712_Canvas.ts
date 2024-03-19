import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

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
			const { Eip712Signer, Secp256k1DelegateSigner } = await import("@canvas-js/chain-ethereum")
			const { decodeURI } = await import("@canvas-js/signatures")
			const { ethers, utils } = await import("ethers")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()

			const session = await signer.getSession(topic)
			signer.verifySession(topic, session)

			const userAddress = session.address.split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1DelegateSigner.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))

			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				{
					userAddress: userAddress,
					sessionAddress: sessionAddress,
					authorizationData: {
						signature: session.authorizationData.signature,
					},
					publicKey: session.publicKey, // TODO: check against sessionAddress
					blockhash: session.blockhash || "",
					duration: session.duration || 0,
					timestamp: session.timestamp,
				},
				topic,
			)

			expect(recoveredWalletAddress).to.equal(userAddress)
		})
	})

	describe("contract.verifySessionMessage", function () {
		it("Should verify that a session has been signed by the proper address with sign", async function () {
			const { Eip712Signer, Secp256k1DelegateSigner } = await import("@canvas-js/chain-ethereum")
			const { decodeURI } = await import("@canvas-js/signatures")
			const { ethers, utils } = await import("ethers")

			const { contract } = await loadFixture(deployFixture)

			const signer = new Eip712Signer()
			const session = await signer.getSession(topic, { fromCache: false })

			const clock = 1
			const parents = ["parent1", "parent2"]
			const sessionMessage = { topic, clock, parents, payload: session }
			const sessionSignature = await signer.sign(sessionMessage)

			signer.verify(sessionSignature, sessionMessage)

			const userAddress = session.address.split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1DelegateSigner.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))

			const verified = await contract.verifySessionMessage(
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
						blockhash: session.blockhash || "",
						duration: session.duration || 0,
						publicKey: session.publicKey, // TODO: check against sessionAddress
						timestamp: session.timestamp,
					},
				},
				sessionSignature.signature,
				sessionAddress,
				topic,
			)
			expect(verified).to.equal(true)
		})
	})

	describe("contract.verifyActionMessage", function () {
		it("Should verify that an action has been signed by the proper address with sign", async function () {
			const { utils } = await import("ethers")
			const { decodeURI } = await import("@canvas-js/signatures")
			const { Eip712Signer, Secp256k1DelegateSigner, getAbiString } = await import("@canvas-js/chain-ethereum")

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

			const userAddress = session.address.split(":")[2]
			const { type: publicKeyType, publicKey: publicKeyBytes } = decodeURI(session.publicKey)
			expect(publicKeyType).to.equal(Secp256k1DelegateSigner.type)
			const sessionAddress = utils.computeAddress(utils.hexlify(publicKeyBytes))

			const verified = await contract.verifyActionMessage(
				{
					clock,
					parents,
					topic,
					payload: {
						userAddress,
						sessionAddress,
						args: getAbiString(action.args),
						blockhash: action.blockhash || "",
						publicKey: session.publicKey, // TODO: check against sessionAddress
						name: action.name,
						timestamp: action.timestamp,
					},
				},
				actionSignature.signature,
				sessionAddress,
				topic,
			)
			expect(verified).to.equal(true)
		})
	})
})
