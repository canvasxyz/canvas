import { useContext } from "react"
import type { ModelSchema, Canvas, ContractAction } from "@canvas-js/core"
import type { Contract } from "@canvas-js/core/contract"
import { QueryParams } from "@canvas-js/modeldb"

import { CanvasContext } from "./provider.js"
import { useLiveQuery as _useLiveQuery } from "../useLiveQuery.js"
import { useClock as _useClock } from "../useClock.js"
import { useRemoteClock as _useRemoteClock } from "../useRemoteClock.js"
import { useSyncStatus as _useSyncStatus } from "../useSyncStatus.js"
import { useSIWE as _useSIWE } from "../auth/useSIWE.js"
import { useSIWF as _useSIWF } from "../auth/useSIWF.js"

export function useApp<ModelsT extends ModelSchema = ModelSchema, InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>>() {
  const context = useContext(CanvasContext)
  if (!context) throw new Error("useCanvasApp must be used within a CanvasProvider")
  return context.app as Canvas<ModelsT, InstanceT> | undefined
}

export function useLiveQuery<ModelsT extends ModelSchema, K extends keyof ModelsT & string, Q extends QueryParams | null | undefined>(modelName: K, query?: Q | null) {
  const app = useApp<ModelsT>()
  return _useLiveQuery(app, modelName, query)
}

export function useClock() {
  const app = useApp()
  return _useClock(app)
}

export function useRemoteClock() {
  const app = useApp()
  return _useRemoteClock(app)
}

export function useSyncStatus() {
  const app = useApp()
  return _useSyncStatus(app)
}

export function useSIWE() {
  const app = useApp()
  return _useSIWE(app)
}

export function useSIWF() {
  const app = useApp()
  return _useSIWF(app)
} 