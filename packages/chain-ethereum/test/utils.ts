import { Action, ActionArguments, Message, Signer } from "@canvas-js/interfaces"

export async function createMessage(
	signer: Signer,
	topic: string,
	name: string,
	args: ActionArguments
): Promise<Message<Action>> {
	const { chain, address } = signer
	const session = await signer.getSession()
	const timestamp = Date.now()
	const action: Action = {
		chain: chain,
		address: address,
		session: session,
		name,
		args,
		topic,
		timestamp,
		blockhash: null,
	}
	return { clock: 0, parents: [], payload: action }
}
