const N1 = 1 << 7
const N2 = 1 << 14
const N3 = 1 << 21
const N4 = 1 << 28
const N5 = 1 << 35
const N6 = 1 << 42
const N7 = 1 << 49
const N8 = 1 << 56
const N9 = 1 << 63

export function encodingLength(value: number) {
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

export function encodeClock(key: Uint8Array, clock: number): number {
	if (clock === 0) {
		key[0] = 0
		return 1
	}

	const sets: number[] = []
	while (clock > 0) {
		sets.push(Number(clock & 0x7f))
		clock >>= 7
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

export function decodeClock(key: Uint8Array): [clock: number, byteLength: number] {
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
		const val = set << pow
		return num + val
	}, 0)

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
