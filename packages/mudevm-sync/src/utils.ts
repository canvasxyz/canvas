import { PropertyType } from "@canvas-js/modeldb"
import { AbiType } from "abitype"

// to use https://abitype.dev/api/zod
export const abiTypeToModelType = (abitype: string) => {
    return "string" as PropertyType
}

export const encode: (data: string | bigint, abitype: AbiType) => string | number = (
    data,
    abitype
  ) => {
    if (typeof data === "bigint") {
      return data.toString()
    } else {
      return data
    }
}