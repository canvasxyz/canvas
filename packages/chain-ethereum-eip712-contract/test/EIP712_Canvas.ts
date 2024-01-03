import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers, network } from "hardhat"
import { signTypedData } from "../helpers/EIP712"
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.types"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		const domainName = "Canvas"
		const signatureVersion = "1"
		const chainId = network.config.chainId as number

		// get an instance of the contract
		const contract = await EIP712_Canvas.deploy(domainName, signatureVersion)

		const verifyingContract = contract.address

		const domain: EIP712Domain = {
			name: domainName,
			version: signatureVersion,
			chainId: chainId,
			verifyingContract: verifyingContract,
		}

		return { contract, domain }
	}

	describe("Signing data", function () {
		it("Should verify that a ticket has been signed by the proper address", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")
			const { contract, domain } = await loadFixture(deployFixture)
			// TODO: implement test

			const topic = "example:signer"

			const signer = new EIP712Signer({
				chainId: domain.chainId,
				verifyingContract: domain.verifyingContract,
				version: domain.version,
			})
			const session = await signer.getSession(topic)

			// abi encode the session

			// expect(await contract.getSigner(ticket.eventName, ticket.price, signature)).to.equal(owner.address)
		})
	})
})
