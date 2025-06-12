export const formatHeads = (heads: string[] | null | undefined) => {
	if (heads === null || heads === undefined) return "(none)"
	if (heads.length === 0) return "--"
	return heads.map((head: string) => `${head.slice(0, 5)}`).join(", ")
}
