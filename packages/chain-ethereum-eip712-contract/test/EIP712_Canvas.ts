import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai"
import { ethers } from "hardhat"

const domainName = "example:signer"

describe("EIP712_Canvas", function () {
	async function deployFixture() {
		const EIP712_Canvas = await ethers.getContractFactory("EIP712_Canvas")

		const contract = await EIP712_Canvas.deploy()

		return { contract }
	}

	describe("Signing data", function () {
		xit("Should verify that a session has been signed by the proper address with getSession", async function () {
			const { EIP712Signer } = await import("@canvas-js/chain-ethereum-eip712")
			const { base58btc } = await import("multiformats/bases/base58")
			const { varint } = await import("multiformats")
			const { verifySignedValue, didKeyPattern } = await import("@canvas-js/signed-cid")
			const { sha256 } = await import("@noble/hashes/sha256")
			const { publicKeyToAddress } = await import("viem/utils")

			const { contract } = await loadFixture(deployFixture)

			const signer = new EIP712Signer({})

			const session = await signer.getSession(domainName)
			signer.verifySession(domainName, session)

			const walletAddress = session.address.split(":")[2]

			console.log(Buffer.from(session.authorizationData.signature).toString("hex"))
			const recoveredWalletAddress = await contract.recoverAddressFromSession(
				walletAddress,
				session.blockhash || "",
				session.duration || 0,
				session.publicKey,
				session.timestamp,
				session.authorizationData.signature,
			)

			expect(recoveredWalletAddress).to.equal(walletAddress)

			const topic = "example:signer"
			const sessionMessage = { topic, clock: 1, parents: [], payload: session }
			const sessionSignature = signer.sign(sessionMessage)

			verifySignedValue(sessionSignature, sessionMessage)

			const result = didKeyPattern.exec(sessionSignature.publicKey)
			const bytes = base58btc.decode(result![1])
			const [keyCodec, keyCodecLength] = varint.decode(bytes)
			const publicKey = bytes.subarray(keyCodecLength)
			const publicKeyHex = Buffer.from(publicKey).toString("hex")

			const expectedAddress = publicKeyToAddress(`0x${publicKeyHex}`)
			console.log(`expectedAddress using publicKeyToAddress: ${expectedAddress}`)

			console.log(`cid.bytes: ${Buffer.from(sessionSignature.cid.bytes).toString("hex")}`)

			const shaCidBytes = sha256(sessionSignature.cid.bytes)

			// why doesn't this work?
			// one of the b values should equal expectedAddress
			for (const v of [27, 28]) {
				const b = await contract.validateAddressFromCidSignature2(shaCidBytes, [...sessionSignature.signature, v])
				console.log(`recovered address when v = ${v}: ${b}`)
			}
		})

		it("test sign", async function () {
			const { secp256k1 } = await import("@noble/curves/secp256k1")
			const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts")
			const { hashMessage } = await import("viem/utils")
			const { toBytes } = await import("viem")

			const { contract } = await loadFixture(deployFixture)

			const message =
				"hello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello world"
			const signedData = hashMessage(message)

			const privateKey = generatePrivateKey()
			const viemAccount = privateKeyToAccount(privateKey)

			const viemSignature = await viemAccount.signMessage({ message })
			const secpSignature = secp256k1.sign(signedData.slice(2), privateKey.slice(2))

			const secpSignatureWithRecovery = [...secpSignature.toCompactRawBytes(), secpSignature.recovery + 27]

			console.log(secpSignature)
			expect(viemSignature).to.equal(viemSignature)

			const expectedAddress = viemAccount.address
			const recoveredAddressViemSolidity = await contract.validateAddressFromCidSignature2(
				signedData,
				toBytes(viemSignature),
			)

			expect(recoveredAddressViemSolidity).to.equal(expectedAddress)
			const recoveredAddressSecpSolidity = await contract.validateAddressFromCidSignature2(
				signedData,
				secpSignatureWithRecovery,
			)
			console.log(`recoveredAddressSecpSolidity: ${recoveredAddressSecpSolidity}`)
			expect(recoveredAddressSecpSolidity).to.equal(expectedAddress)

			const secpRecoveredPublicKey = secpSignature.recoverPublicKey(signedData.slice(2)).toRawBytes()
			console.log(`viemAccount.publicKey: ${Buffer.from(viemAccount.publicKey).toString("hex")}`)
			console.log(`secpRecoveredPublicKey: ${Buffer.from(secpRecoveredPublicKey).toString("hex")}`)

			/*
			const signer = new Secp256k1Signer()
			const sessionSignature = signer.sign("hello world", { codec: "dag-cbor", digest: "sha2-256" })

			// secp256k1.sign(cid.bytes, this.#privateKey).toCompactRawBytes()

			const result = didKeyPattern.exec(sessionSignature.publicKey)
			const bytes = base58btc.decode(result![1])
			const [keyCodec, keyCodecLength] = varint.decode(bytes)
			const publicKey = bytes.subarray(keyCodecLength)

			const expectedAddress = `0x${ethers.utils.keccak256(publicKey).slice(-40)}`
			console.log(`session address from publicKey: ${expectedAddress}`)
			const signedData = sessionSignature.cid.bytes.slice(0, 32)
			for (const v of [27, 28]) {
				const b = await contract.validateAddressFromCidSignature2(signedData, [...sessionSignature.signature, v])
				console.log(b)
			}
			*/
		})
	})
})
