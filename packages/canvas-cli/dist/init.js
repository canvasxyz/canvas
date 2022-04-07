import * as fs from "node:fs";
import * as path from "node:path";
import { create as createIPFSHTTPClient } from "ipfs-http-client";
export default async function init(args) {
    const ipfs = createIPFSHTTPClient();
    const appPath = path.resolve(args.path);
    if (fs.existsSync(appPath)) {
        throw new Error("path already exists");
    }
    fs.mkdirSync(appPath);
    await fs.promises.writeFile(path.resolve(appPath, "spec.mjs"), ipfs.cat(args.cid));
    await fs.promises.writeFile(path.resolve(appPath, "spec.cid"), args.cid);
    console.log(`Initialized app ${args.cid} in ${appPath}/*`);
}
