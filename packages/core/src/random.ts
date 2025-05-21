import { XoShiRo256PlusPlus } from "prng-xoshiro"
import { assert } from "@canvas-js/utils"

const MAX_UINT64 = 0xffffffffffffffffn
const MAX_UINT32 = 0xffffffffn

export class PRNG {
	#buffer = new ArrayBuffer(8)
	#view = new DataView(this.#buffer)
	#rng: XoShiRo256PlusPlus

	constructor(seed: bigint = 0n) {
		assert(seed <= MAX_UINT64, "expected seed <= MAX_UINT64")
		const mix = new SplitMix64(seed)
		const s1 = mix.next()
		const s2 = mix.next()
		const s3 = mix.next()
		const s4 = mix.next()
		this.#rng = new XoShiRo256PlusPlus(s1, s2, s3, s4)
	}

	public getUint64(): bigint {
		return this.#rng.nextBigInt()
	}

	public getUint32(): number {
		const n = this.#rng.nextBigInt()
		return Number(n >> 32n)
	}

	/** get a float evenly distributed in the range [0, 1) */
	public getFloat(): number {
		const rand = this.#rng.nextBigInt()

		// Use 52 random bits for the mantissa, and the rest for the exponent
		let rand_lz: number = clz(rand)

		// If all 12 bits are zero, generate additional random bits
		if (rand_lz >= 12) {
			rand_lz = 12
			while (true) {
				const addl_rand = this.#rng.nextBigInt()
				const addl_rand_lz = clz(addl_rand)
				rand_lz += addl_rand_lz

				if (addl_rand_lz !== 64) break

				if (rand_lz >= 1022) {
					rand_lz = 1022
					break
				}
			}
		}

		// Extract mantissa bits (lower 52 bits)
		const mantissa = rand & 0xfffffffffffffn

		// Calculate the biased exponent value (matching Zig's implementation)
		const biasedExponent = (1022n - BigInt(rand_lz)) << 52n

		// Combine exponent and mantissa exactly as Zig does
		const bits = biasedExponent | mantissa

		// Convert to IEEE-754 format
		this.#view.setBigUint64(0, bits, false) // Use big-endian (false)
		return this.#view.getFloat64(0, false)
	}
}

/**
 * Counts the number of leading zeros in a BigInt (u64) using Math.clz32
 * This implementation splits the 64-bit value into high and low 32-bit parts
 *
 * @param n BigInt to count leading zeros in
 * @returns Number of leading zeros (0-64)
 */
function clz(n: bigint): number {
	if (n === 0n) return 64

	// Split into high and low 32-bit values
	const high = Number(n >> 32n)

	if (high !== 0) {
		// If high bits exist, count zeros in the high part
		return Math.clz32(high)
	} else {
		// If high part is all zeros, count zeros in low part and add 32
		const low = Number(n & MAX_UINT32)
		return 32 + Math.clz32(low)
	}
}

export class SplitMix64 {
	static modulus = 1n << 64n
	#state: bigint

	constructor(state: bigint = 0n) {
		assert(state <= MAX_UINT64, "expected seed <= MAX_UINT64")
		this.#state = state
	}

	next(): bigint {
		this.#state = (this.#state + 0x9e3779b97f4a7c15n) % SplitMix64.modulus
		let z = this.#state
		z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) % SplitMix64.modulus
		z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) % SplitMix64.modulus
		return z ^ (z >> 31n)
	}
}
