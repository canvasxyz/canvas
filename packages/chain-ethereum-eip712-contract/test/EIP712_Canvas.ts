import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import * as web3 from "web3"
import { ethers, network } from "hardhat"
import { EIP712Domain } from "../helpers/EIP712.types"
import { keccak256, toUtf8Bytes } from "ethers/lib/utils"

const topic = "example:signer"
const signatureVersion = "1"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		const domainName = topic

		// get an instance of the contract
		console.log(`deploying contract with domain name: ${domainName} and version: ${signatureVersion}`)
		const contract = await EIP712_Canvas.deploy(domainName, signatureVersion)

		const domain: EIP712Domain = {
			name: domainName,
			version: signatureVersion,
		}

		return { contract, domain }
	}

	describe("Signing data", function () {
		it("Should verify that a ticket has been signed by the proper address", async function () {
			const { EIP712Signer, eip712TypeDefinitions } = await import("@canvas-js/chain-ethereum-eip712")

			const { contract, domain } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({
				version: domain.version,
			})

			const session = await signer.getSession(topic)
			console.log(domain)
			console.log(session)
			signer.verifySession(topic, session)

			// abi encode the session
			const walletAddress = session.address.split(":")[2]

			const structHash = ethers.utils._TypedDataEncoder.hashStruct("Session", eip712TypeDefinitions, {
				address: walletAddress,
				blockhash: session.blockhash || "",
				duration: session.duration || 0,
				publicKey: session.publicKey,
				timestamp: session.timestamp,
			})
			console.log(`struct hash: ${structHash}`)

			const structHashFromContract = await contract.getStructHashForSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
			)
			console.log(`struct hash from contract: ${structHashFromContract}`)

			const tdeDomainSeparator = ethers.utils._TypedDataEncoder.hashDomain(domain)
			console.log(`tdeDomainSeparator: ${tdeDomainSeparator}`)

			const tdeDomainSeparatorFromContract = await contract.getDomainSeparator()
			console.log(`tdeDomainSeparator from contract: ${tdeDomainSeparatorFromContract}`)

			const tdeDigestString = ethers.utils._TypedDataEncoder.hash(
				{
					name: domain.name,
					version: domain.version,
				},
				eip712TypeDefinitions,
				{
					address: walletAddress,
					blockhash: session.blockhash || "",
					duration: session.duration || 0,
					publicKey: session.publicKey,
					timestamp: session.timestamp,
				},
			)
			console.log(`tde digest: ${tdeDigestString}`)

			const signerFromHash = await contract.getSignerFromDigest(tdeDigestString, session.authorizationData.signature)
			console.log(`signer from hash: ${signerFromHash}`)

			const digest = await contract.getDigestForSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
			)
			console.log(`digest: ${digest}`)

			const signerFromEthersVerifyTypedData = ethers.utils.verifyTypedData(
				domain,
				eip712TypeDefinitions,
				{
					address: walletAddress,
					blockhash: session.blockhash || "",
					duration: session.duration || 0,
					publicKey: session.publicKey,
					timestamp: session.timestamp,
				},
				session.authorizationData.signature,
			)
			console.log(`signer from ethers verifytypeddata: ${signerFromEthersVerifyTypedData}`)

			const signerFromSession = await contract.getSignerForSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
				session.authorizationData.signature,
			)
			console.log(`signer from session: ${signerFromSession}`)
			console.log(`wallet address: ${walletAddress}`)
			// expect(
			// 	,
			// ).to.equal(walletAddress)
		})
	})
})
