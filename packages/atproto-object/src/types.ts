export type AtConfig = {
	nsid: string
	filter?: (nsid: string, rkey: string, post: any) => boolean
	handler?: (nsid: string, rkey: string, post: any, db: any) => void
}

export type AtInit = string[] | Array<{ table: string, $type: string }> | Record<string, AtConfig | string>

export type JetstreamEvent = {
	did: string
	time_us: number
	kind: 'commit' | 'identity' | 'account'
	commit?: {
		rev: string
		operation: 'create' | 'update' | 'delete'
		collection: string
		rkey: string
		record?: any
		cid?: string
	}
	identity?: {
		did: string
		handle: string
		seq: number
		time: string
	}
	account?: {
		active: boolean
		did: string
		seq: number
		time: string
	}
}