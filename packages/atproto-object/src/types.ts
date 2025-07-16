export type HandlerContext = { commit: FirehoseCommitEvent } | null

export type AtConfig = {
	nsid: string
	filter?: (creator: string, rkey: string, post: any, commit?: FirehoseCommitEvent) => boolean
	handler?: (this: HandlerContext, creator: string, rkey: string, post: any, db: any) => void
}

export type AtInit = string[] | Array<{ table: string; $type: string }> | Record<string, AtConfig | string>

export type FirehoseFrameHeader = {
	op: number // 1 = message, -1 = error
	t?: string // message type (e.g., "#commit")
}

export type FirehoseErrorFrame = {
	error: string
	message?: string
}

export type FirehoseCommitEvent = {
	seq: number
	repo: string // DID
	time: string
	rev: string // Current revision TID
	since: string | null // Previous revision TID (this is what we want!)
	commit: string // CID
	tooBig: boolean
	blocks: Uint8Array // CAR data
	ops: Array<{
		action: "create" | "update" | "delete"
		path: string
		cid?: string
	}>
	blobs: string[] // CID array
}

export type FirehoseIdentityEvent = {
	seq: number
	did: string
	time: string
	handle?: string
}

export type FirehoseAccountEvent = {
	seq: number
	did: string
	time: string
	active: boolean
	status?: string
}

export type FirehoseInfoEvent = {
	name: string
	message?: string
}

export type FirehoseEvent =
	| {
			kind: "commit"
			commit: FirehoseCommitEvent
	  }
	| {
			kind: "identity"
			identity: FirehoseIdentityEvent
	  }
	| {
			kind: "account"
			account: FirehoseAccountEvent
	  }
	| {
			kind: "info"
			info: FirehoseInfoEvent
	  }
	| {
			kind: "error"
			error: FirehoseErrorFrame
	  }

export type FromLexicon<T> = T extends {
	defs: { main: { record: { properties: infer P; required?: infer Required extends string[] } } }
}
	? {
			[K in keyof P as K extends Required[number] ? K : never]: any
		} & {
			[K in keyof P as K extends Required[number] ? never : K]?: any
		}
	: any
