import type { Signature } from "./Signature.js"

export interface Signer<T = any> {
	sign(value: T): Signature
}
