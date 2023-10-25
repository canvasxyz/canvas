const N1 = 1n << 7n
const N2 = 1n << 14n
const N3 = 1n << 21n
const N4 = 1n << 28n
const N5 = 1n << 35n
const N6 = 1n << 42n
const N7 = 1n << 49n
const N8 = 1n << 56n
const N9 = 1n << 63n

export function encodingLength(value: bigint) {
	if (value < N1) return 1
	if (value < N2) return 2
	if (value < N3) return 3
	if (value < N4) return 4
	if (value < N5) return 5
	if (value < N6) return 6
	if (value < N7) return 7
	if (value < N8) return 8
	if (value < N9) return 9
	return 10
}

export function encodeClock(key: Uint8Array, clock: bigint): number {
	if (clock === 0n) {
		key[0] = 0
		return 1
	}

	const sets: number[] = []
	while (clock > 0) {
		sets.push(Number(clock & 0x7fn))
		clock >>= 7n
	}

	for (let i = 0; i < sets.length; i++) {
		let byte = sets[i]
		if (i > 0) {
			byte |= 0x80
		}

		key[sets.length - 1 - i] = byte
	}

	return sets.length
}

export function decodeClock(key: Uint8Array): [bigint, number] {
	const sets: number[] = []
	for (const byte of key) {
		sets.push(byte & 0x7f)
		if (byte & 0x80) {
			continue
		} else {
			break
		}
	}

	const num = sets.reduce((num, set, i) => {
		const pow = 7 * (sets.length - 1 - i)
		const val = BigInt(set) << BigInt(pow)
		return num + val
	}, 0n)

	return [num, sets.length]
}

// const b = (v) => v.toString(2).padStart(8, "0");
// const h = (v) => v.toString(16).padStart(4, "0");
// function e(v) {
//   const buf = encode(v);
//   console.log(
//     `${h(v)} => [ ${Array.from(buf).map(b).join(", ")} ] (${decode(buf)})`,
//   );
// }

// e(0);
// e(255);
// e(256);

// // console.log(255, encode(255));
// // console.log(256, encode(256));
