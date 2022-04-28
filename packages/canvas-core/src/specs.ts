/**
 * Specs
 *
 * Specs may be provided as strings or objects. These are the types for
 * constructing them as objects.
 */

import type { ModelType } from "./models.js"

export type RouteType = string

export type ActionType = (...args: any[]) => void

export type SpecModels = Record<string, Record<string, ModelType>>
export type SpecRoutes = Record<string, RouteType>
export type SpecActions = Record<string, ActionType>

export type ObjectSpec = { models: SpecModels; routes: SpecRoutes; actions: SpecActions }
