import test from "ava"

import { Canvas } from "@canvas-js/core"
import fs from "fs"

test("build a contract in node", async (t) => {
  const contract = `const a: number = 1;
console.log(a);
  `

  const expectedBuild = `var a = 1;
console.log(a);`
  
  const { originalContract, build } = await Canvas.buildContract(contract)
  t.is(originalContract, contract)
  t.is(expectedBuild, build.trimEnd())
})

test("build a contract by location in node", async (t) => {
  const contract = `const a: number = 1;
console.log(a);
  `

  const expectedBuild = `var a = 1;
console.log(a);`
  
  const location = '/tmp/canvas-virtual-contract.ts'
  fs.writeFileSync(location, contract)

  const { originalContract, build } = await Canvas.buildContractByLocation(location)
  t.is(originalContract, contract)
  t.is(expectedBuild, build.trimEnd())
})