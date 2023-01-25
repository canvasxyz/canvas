import type { Chain, ChainId } from "./contracts.js"
import type { Action } from "./actions.js"
import type { Session } from "./sessions.js"

export interface Verifier {
	match(chain: Chain, chainId: ChainId): boolean
	verifyAction(action: Action): Promise<void>
	verifySession(session: Session): Promise<void>
}
