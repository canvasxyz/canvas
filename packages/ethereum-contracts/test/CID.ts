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

	describe("contract.createDigest", function () {
		it("matches implementation in multiformats", async () => {
			const { sha256 } = await import("@noble/hashes/sha256")
			const { create: createDigest } = await import("multiformats/hashes/digest")

			const { contract } = await loadFixture(deployFixture)

			const [digestSize, contractDigest] = await contract.createDigest(3, sha256("hello world"))
			const multiformatsDigest = createDigest(3, sha256("hello world"))

			expect(contractDigest).to.equal(`0x${Buffer.from(multiformatsDigest.bytes).toString("hex")}`)
		})
	})

	describe("contract.encodeCID", function () {
		it("matches implementation in multiformats", async () => {
			const { sha256 } = await import("@noble/hashes/sha256")
			const { CID } = await import("multiformats/cid")
			const { create: createDigest } = await import("multiformats/hashes/digest")

			const { contract } = await loadFixture(deployFixture)

			const [digestSize, contractDigest] = await contract.createDigest(0, sha256("hello world"))
			const contractCid = await contract.encodeCID(1, 712, contractDigest)

			const multiformatsCid = CID.createV1(712, createDigest(0, sha256("hello world")))

			expect(contractCid).to.equal(`0x${Buffer.from(multiformatsCid.bytes).toString("hex")}`)
		})

		// it("test creating and verifying CID for Message<Session>", async () => {
		// 	const { contract } = await loadFixture(deployFixture)
		// })
	})
})
