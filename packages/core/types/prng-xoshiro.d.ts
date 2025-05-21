declare class Generator256 {
	constructor(s1: bigint, s2: bigint, s3: bigint, s4: bigint)

	/**
	 * Returns a random BigInt in the range 0 to n (exclusive).
	 * If n is not provided, it defaults to 0xFFFFFFFFFFFFFFFFn.
	 */
	nextBigInt(n?: bigint): bigint
}

declare class Generator128 {
	constructor(seedLo: number, seedHi: number)

	/**
	 * Returns a random number in the range 0 to n (exclusive).
	 * If n is not provided, it defaults to 0xFFFFFFFF.
	 */
	nextNumber(n?: number): number
}

declare module "prng-xoshiro" {
	export class XoShiRo256StarStar extends Generator256 {}
	export class XoShiRo256PlusPlus extends Generator256 {}
	export class XoShiRo256Plus extends Generator256 {}

	export class XoShiRo128StarStar extends Generator128 {}
	export class XoShiRo128PlusPlus extends Generator128 {}
	export class XoShiRo128Plus extends Generator128 {}
}
