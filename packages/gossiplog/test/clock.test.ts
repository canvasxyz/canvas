import test from "ava"

import { toString } from "uint8arrays"
import { encodeClock, decodeClock } from "@canvas-js/gossiplog"

/**

| input   | input (binary)             | output (binary)            | output (hex)  |
| ------- | -------------------------- | -------------------------- | ------------- |
| 0       | 00000000                   | 00000000                   | 0x00          |
| 1       | 00000001                   | 00000001                   | 0x01          |
| 2       | 00000002                   | 00000010                   | 0x02          |
| 127     | 01111111                   | 01111111                   | 0x7f          |
| 128     | 10000000                   | 10000000 10000000          | 0x8080        |
| 129     | 10000001                   | 10000000 10000001          | 0x8081        |
| 255     | 11111111                   | 10000000 11111111          | 0x80ff        |
| 256     | 00000001 00000000          | 10000001 00000000          | 0x8100        |
| 1234    | 00000100 11010010          | 10000100 11010010          | 0x84d2        |
| 16383   | 00111111 11111111          | 10111111 11111111          | 0xbfff        |
| 16384   | 01000000 00000000          | 11000000 01000000 00000000 | 0xc04000      |
| 1398101 | 00010101 01010101 01010101 | 11010101 01010101 01010101 | 0xd55555      |

| value            | value (binary)             | encoded bytes (binary)              | encoded bytes (hex) |
| ---------------- | -------------------------- | ----------------------------------- | ------------------- |
| 2097151          | 00011111 11111111 11111111 | 11011111 11111111 11111111          | 0xdfffff            |
| 2097152          | 00100000 00000000 00000000 | 11100000 00100000 00000000 00000000 | 0xe0200000          |
| 2796202          | 00101010 10101010 10101010 | 11100000 00101010 10101010 10101010 | 0xe02aaaaa          |

| value            | value (binary)
| ---------------- | -------------------------------------------------------------- |
| 9007199254740991 | 00011111 11111111 11111111 11111111 11111111 11111111 11111111 |
| encoded bytes (binary)                                                  |                    |
| ----------------------------------------------------------------------- | ------------------ |
| 11111110 00011111 11111111 11111111 11111111 11111111 11111111 11111111 | 0xfe1fffffffffffff |
*/

test("clock encoding fixtures", (t) => {
	const key = new Uint8Array(8)

	const testClock = (clock: number, expectedHex: string) => {
		const encodingLength = expectedHex.length / 2
		t.is(encodeClock(key, clock), encodingLength, `encodingLength ${clock}`)
		t.is(toString(key.subarray(0, encodingLength), "hex"), expectedHex, `encodeClock ${clock}`)
		t.deepEqual(decodeClock(key), [clock, encodingLength], `decodeClock ${clock}`)
	}

	testClock(0, "00")
	testClock(1, "01")
	testClock(2, "02")
	testClock(127, "7f")
	testClock(128, "8080")
	testClock(129, "8081")
	testClock(255, "80ff")
	testClock(256, "8100")
	testClock(1234, "84d2")
	testClock(16383, "bfff")
	testClock(16384, "c04000")
	testClock(1398101, "d55555")

	testClock(2097151, "dfffff")
	testClock(2097152, "e0200000")
	testClock(2796202, "e02aaaaa")

	testClock(9007199254740991, "fe1fffffffffffff")
})
