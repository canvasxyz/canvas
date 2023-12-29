import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import "@nomicfoundation/hardhat-ethers"
import hre from "hardhat"
const { ethers, network } = hre
import { signTypedData } from "./helpers/EIP712.js"
import { EIP712Domain, EIP712TypeDefinition } from "./helpers/EIP712.types.js"

describe("EIP712_Canvas", function () {
	// We define a fixture to reuse the same setup in every test.
	// We use loadFixture to run this setup once, snapshot that state,
	// and reset Hardhat Network to that snapshot in every test.
	async function deployFixture() {
		// Contracts are deployed using the first signer/account by default
		const [owner, otherAccount] = await ethers.getSigners()
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
		const argumentTypeHash = ethers.keccak256(ethers.toUtf8Bytes(typeHash)) // convert to byteslike, then hash it

		// https://eips.ethereum.org/EIPS/eip-712#specification-of-the-eth_signtypeddata-json-rpc
		const types: EIP712TypeDefinition = {
			Ticket: [
				{ name: "eventName", type: "string" },
				{ name: "price", type: "uint256" },
			],
		}
		// get an instance of the contract
		const contract = await EIP712_Canvas.deploy(domainName, signatureVersion, argumentTypeHash)

		const verifyingContract = contract.address as any // the address of the contract that will verify the signature. The user-agent may do contract specific phishing prevention.

		const domain: EIP712Domain = {
			name: domainName,
			version: signatureVersion,
			chainId: chainId,
			verifyingContract: verifyingContract,
		}

		return { contract, owner, otherAccount, domain, types }
	}

	it("Should verify that a ticket has been signed by the proper address", async function () {
		const { contract, domain, types, owner } = await loadFixture(deployFixture)
		const ticket = {
			eventName: "EthDenver",
			price: ethers.WeiPerEther,
		}

		const signature = await signTypedData(domain, types, ticket, owner)

		expect(await contract.getSigner(ticket.eventName, ticket.price, signature)).to.equal(owner.address)
	})
})
