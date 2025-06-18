import React, { createContext, ReactNode, useMemo } from "react"
import type { Config, ModelSchema, Canvas, ContractAction } from "@canvas-js/core"
import type { Contract } from "@canvas-js/core/contract"

import { useCanvas } from "../useCanvas.js"
import { AuthProvider } from "../auth/AuthContext.js"

interface CanvasContextValue<ModelsT extends ModelSchema = ModelSchema, InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>> {
  app: Canvas<ModelsT, InstanceT> | undefined
}

const CanvasContext = createContext<CanvasContextValue | undefined>(undefined)

export interface CanvasProviderProps<ModelsT extends ModelSchema = ModelSchema, InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>> {
  url: string | null
  config?: Config<ModelsT, InstanceT>
  children: ReactNode
}

export function CanvasProvider<ModelsT extends ModelSchema = ModelSchema, InstanceT extends Contract<ModelsT> = Contract<ModelsT> & Record<string, ContractAction<ModelsT>>>({ url, config, children }: CanvasProviderProps<ModelsT, InstanceT>) {
  const { app } = useCanvas<ModelsT, InstanceT>(url, config)

  // Memoize context value to avoid unnecessary rerenders
  const contextValue = useMemo(() => ({ app }), [app])

  return (
    <CanvasContext.Provider value={contextValue}>
      <AuthProvider>{children}</AuthProvider>
    </CanvasContext.Provider>
  )
}

export { CanvasContext } 