import { JSValue } from "@canvas-js/utils"
import { Predicate, ModelAPI } from "../types.js"
import { getValueAtPath } from "./utils.js"
import { AbstractModelDB } from "@canvas-js/modeldb"

export type PredicateFilter = { path: string[]; match: string }

export const resolvePredicateToFilters = (pred: Predicate) => {
	const filters: PredicateFilter[] = []
	const visit = (before: string[], pred: Predicate) => {
		const entries = Object.entries(pred)

		for (const [key, value] of entries) {
			if (Array.isArray(value)) {
				for (const match of value) {
					filters.push({ path: [...before, key], match })
				}
			} else {
				visit([...before, key], value)
			}
		}
	}
	visit([], pred)

	return filters
}

export const matchesAnyFilter = async (
	filters: PredicateFilter[],
	record: JSValue,
	rkey: string,
	creator: string,
	db: AbstractModelDB,
) => {
	for (const { path, match } of filters) {
		if (path[0] === "$creator" && path.length === 1) {
			if ((await db.get(match, creator)) !== null) {
				return true
			} else {
				return false
			}
		} else if (path[0] === "$rkey" && path.length === 1) {
			if ((await db.get(match, rkey)) !== null) {
				return true
			} else {
				return false
			}
		}
		const value = getValueAtPath(record, path)

		if (value === null || value === undefined) {
			continue
		}
		if (typeof value !== "string") {
			console.log(`expected a string at ${path.join(".")}, got ${typeof value} instead`) // TODO: logger
			continue
		} else {
			if ((await db.get(match, value)) !== null) {
				return true
			}
		}
	}
	return false
}
