import test from "ava"

import { encodeAddress, decodeAddress } from "@canvas-js/core"

test("eth address", (t) => {
	const chain = "eth"
	const chainId = 1
	const address = "0x834502F7674EfD11c2Af6DE5eCEf41b2ceE36DD8"
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address)), address)
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address.toLowerCase())), address)
})

test("cosmos address", (t) => {
	const chain = "cosmos"
	const chainId = "cosmoshub-4"
	const address = "cosmos1mnyn7x24xj6vraxeeq56dfkxa009tvhgknhm04"
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address)), address)
})

test("evmos address", (t) => {
	const chain = "cosmos"
	const chainId = "evmos_9001-2"
	const address = "evmos1z3t55m0l9h0eupuz3dp5t5cypyv674jj7mz2jw"
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address)), address)
})

test("solana address", (t) => {
	const chain = "solana"
	const chainId = 1
	const address = "6TkKqq15wXjqEjNg9zqTKADwuVATR9dW3rkNnsYme1ea"
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address)), address)
})

test("substrate address", (t) => {
	const chain = "substrate"
	const chainId = 1
	const address = "5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV"
	t.is(decodeAddress(chain, chainId, encodeAddress(chain, chainId, address)), address)
})
