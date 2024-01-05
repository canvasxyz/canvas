import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { EIP712Domain } from "../helpers/EIP712.types"

const domainName = "example:signer"
const signatureVersion = "1"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		const contract = await EIP712_Canvas.deploy()

		const domain = {}

		return { contract, domain }
	}

	describe("Signing data", function () {
		it("Should verify that a ticket has been signed by the proper address", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")

			const { contract, domain } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(domainName)
			signer.verifySession(domainName, session)

			const walletAddress = session.address.split(":")[2]

			const recoveredAddress = await contract.recoverAddressFromSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
				session.authorizationData.signature,
			)

			expect(recoveredAddress).to.equal(walletAddress)
		})
	})
})
