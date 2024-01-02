import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers, network } from "hardhat"
import { signTypedData } from "../helpers/EIP712"
import { EIP712Domain, EIP712TypeDefinition } from "../helpers/EIP712.types"
import { EIP712Signer } from "@canvas-js/chain-ethereum-eip712"

describe("EIP712_Canvas", function () {
	// We define a fixture to reuse the same setup in every test.
	// We use loadFixture to run this setup once, snapshot that state,
	// and reset Hardhat Network to that snapshot in every test.
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		// Create an EIP712 domainSeparator
		// https://eips.ethereum.org/EIPS/eip-712#definition-of-domainseparator
		const domainName = "TicketGenerator" // the user readable name of signing domain, i.e. the name of the DApp or the protocol.
		const signatureVersion = "1" // the current major version of the signing domain. Signatures from different versions are not compatible.
		const chainId = network.config.chainId as number // the EIP-155 chain id. The user-agent should refuse signing if it does not match the currently active chain.
		// The typeHash is designed to turn into a compile time constant in Solidity. For example:
		// bytes32 constant MAIL_TYPEHASH = keccak256("Mail(address from,address to,string contents)");
		// https://eips.ethereum.org/EIPS/eip-712#rationale-for-typehash
		const typeHash = "Ticket(string eventName,uint256 price)"
		const argumentTypeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(typeHash)) // convert to byteslike, then hash it

		// https://eips.ethereum.org/EIPS/eip-712#specification-of-the-eth_signtypeddata-json-rpc
		const types: EIP712TypeDefinition = {
			Ticket: [
				{ name: "eventName", type: "string" },
				{ name: "price", type: "uint256" },
			],
		}
		// get an instance of the contract
		const contract = await EIP712_Canvas.deploy(domainName, signatureVersion, argumentTypeHash)

		const verifyingContract = contract.address // the address of the contract that will verify the signature. The user-agent may do contract specific phishing prevention.

		const domain: EIP712Domain = {
			name: domainName,
			version: signatureVersion,
			chainId: chainId,
			verifyingContract: verifyingContract,
		}

		return { contract, domain, types }
	}

	describe("Signing data", function () {
		it("Should verify that a ticket has been signed by the proper address", async function () {
			const { contract, domain, types } = await loadFixture(deployFixture)
			const ticket = {
				eventName: "EthDenver",
				price: ethers.constants.WeiPerEther,
			}

			// const signature = await signTypedData(domain, types, ticket, owner)

			const topic = "example:signer"

			const signer = new EIP712Signer({})
			const session = await signer.getSession(topic)

			// expect(await contract.getSigner(ticket.eventName, ticket.price, signature)).to.equal(owner.address)
		})
	})
})
