import * as t from "io-ts"

import { ModelType, modelTypeType } from "./models.js"

/**
 * Specs
 *
 * Specs may be provided as strings or objects. These are the types for
 * constructing them as objects.
 */

export type RouteType = string

export type ActionType = (...args: any[]) => void

export type SpecModels = Record<string, Record<string, ModelType>>
export type SpecRoutes = Record<string, RouteType>
export type SpecActions = Record<string, ActionType>

export type ObjectSpec = { models: SpecModels; routes: SpecRoutes; actions: SpecActions }

export const specModelsType = t.record(t.string, t.record(t.string, modelTypeType))
export const specActionsType = t.record(t.string, t.Function)
export const specRoutesType = t.record(t.string, t.string)

export const objectSpecType = t.type({
	models: specModelsType,
	actions: specActionsType,
	routes: specRoutesType,
})

export const stringSpecType = t.string
