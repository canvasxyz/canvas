import * as fs from "node:fs";
import * as path from "node:path";
import { App } from "canvas-core";
export default async function run(args) {
    const multihash = fs.readFileSync(path.resolve(args.path, "spec.cid"), "utf-8");
    await App.initialize({ multihash, path: args.path, port: args.port });
}
