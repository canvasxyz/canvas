#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import run from "./run.js";
const args = yargs(hideBin(process.argv))
    .command("run", "Launch a Canvas app", {
    spec: { type: "string", demandOption: true, desc: "Hash of the spec to run" },
    port: { type: "number", default: 8000, desc: "Port to bind the core API" },
}, run)
    .demandCommand(1, "")
    .recommendCommands()
    .strict()
    .help()
    .parse();
