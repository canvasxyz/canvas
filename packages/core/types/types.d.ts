declare module "espree" {
	function parse(
		code: string,
		options?: {
			range?: boolean
			loc?: boolean
			comment?: boolean
			tokens?: boolean
			ecmaVersion: number | "latest"
			allowReserved?: boolean
			sourceType?: "script" | "module" | "commonjs"
			ecmaFeatures?: {
				jsx?: boolean
				globalReturn?: boolean
				impliedStrict?: boolean
			}
		},
	): any
}
