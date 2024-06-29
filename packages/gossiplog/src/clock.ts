import { assert } from "@canvas-js/utils"

// const N1 = 1 << 7
// const N2 = 1 << 14
// const N3 = 1 << 21
// const N4 = 1 << 28
// const N5 = 1 << 35
// const N6 = 1 << 42
// const N7 = 1 << 49
// const N8 = 1 << 56
// const N9 = 1 << 63

// export function encodingLength(value: number) {
// 	if (value < N1) return 1
// 	if (value < N2) return 2
// 	if (value < N3) return 3
// 	if (value < N4) return 4
// 	if (value < N5) return 5
// 	if (value < N6) return 6
// 	if (value < N7) return 7
// 	if (value < N8) return 8
// 	if (value < N9) return 9
// 	return 10
// }

export function encodeClock(key: Uint8Array, clock: number): number {
	assert(key.byteLength >= 8)
	assert(clock <= Number.MAX_SAFE_INTEGER)

	if (clock <= 0x7f) {
		key[0] = clock
		return 1
	}

	const bits = clock.toString(2)
	const payload: string[] = []
	for (let end = bits.length; end > 0; end -= 8) {
		const start = Math.max(0, end - 8)
		payload.push(bits.slice(start, end))
	}

	assert(payload.length > 0)
	assert(payload.length < 8)

	const head = payload.pop()!

	if (payload.length + 1 + head.length <= 8) {
		const prefix = "1".repeat(payload.length) + "0"
		payload.push(prefix.padEnd(8 - head.length, "0") + head)
	} else {
		payload.push(head.padStart(8, "0"))
		const prefix = "1".repeat(payload.length) + "0"
		payload.push(prefix.padEnd(8, "0"))
	}

	for (let i = 0; i < payload.length; i++) {
		const j = payload.length - 1 - i
		key[i] = parseInt(payload[j], 2)
	}

	return payload.length
}

export function decodeClock(key: Uint8Array): [clock: number, byteLength: number] {
	assert(key.byteLength >= 8)

	if (key[0] <= 0x7f) {
		return [key[0], 1]
	}

	const head = key[0].toString(2)
	const sep = head.indexOf("0")
	assert(sep > 0)

	const payload = [head.slice(sep)]
	for (let i = 0; i < sep; i++) {
		payload.push(key[i + 1].toString(2).padStart(8, "0"))
	}

	const clock = parseInt(payload.join(""), 2)
	return [clock, payload.length]
}
