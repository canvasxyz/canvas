import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("CID", function () {
	async function deployFixture() {
		const CID = await ethers.getContractFactory("CID_External")

		const contract = await CID.deploy()
		await contract.deployed()
		return { contract }
	}

	describe("Signing data", function () {
		it("test createDigest solidity implementation", async () => {
			const { sha256 } = await import("@noble/hashes/sha256")
			const { create: createDigest } = await import("multiformats/hashes/digest")

			const { contract } = await loadFixture(deployFixture)

			const [digestSize, contractDigest] = await contract.createDigest(3, sha256("hello world"))

			const mfDigest = `0x${Buffer.from(createDigest(3, sha256("hello world")).bytes).toString("hex")}`

			expect(contractDigest).to.equal(mfDigest)
		})

		it("test encodeCID solidity implementation", async () => {
			const { sha256 } = await import("@noble/hashes/sha256")
			const { CID } = await import("multiformats/cid")
			const { create: createDigest } = await import("multiformats/hashes/digest")

			const { contract } = await loadFixture(deployFixture)

			const [digestSize, contractDigest] = await contract.createDigest(0, sha256("hello world"))
			const contractCid = await contract.encodeCID(1, 712, contractDigest)

			const mfCid = CID.createV1(712, createDigest(0, sha256("hello world")))

			expect(contractCid).to.equal(`0x${Buffer.from(mfCid.bytes).toString("hex")}`)
		})

		// it("test creating and verifying CID for Message<Session>", async () => {
		// 	const { contract } = await loadFixture(deployFixture)
		// })
	})
})
