type AtConfig = Record<
	string,
	| string
	| {
			nsid: string
			filter: (nsid: string, rkey: string, post: any) => boolean
			handler?: (nsid: string, rkey: string, post: any, db: any) => void
	  }
>

export class AtObject {
	constructor(
		config:
			| string[]
			| Array<{
					table: string
					$type: string
			  }>
			| AtConfig,
	) {
		// TODO
	}
}
