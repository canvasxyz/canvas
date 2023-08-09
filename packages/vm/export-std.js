#!/usr/bin/env node

import { resolve } from "node:path";
import {
  createWriteStream,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { Readable } from "node:stream";

import { CarWriter } from "@ipld/car";

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";
import * as cbor from "@ipld/dag-cbor";

function* walk(path) {
  for (const name of readdirSync(resolve(...path))) {
    const stats = statSync(resolve(...path, name));
    if (stats.isDirectory()) {
      yield* walk([...path, name]);
    } else {
      yield [...path, name];
    }
  }
}

const modules = {};

const blocks = [];
for (const path of walk(["std"])) {
  const bytes = readFileSync(resolve(...path));
  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, raw.code, hash);
  modules[path.slice(1).join("/")] = cid;
  blocks.push({ cid, bytes });
}

const root = cbor.encode(modules);
const rootHash = await sha256.digest(root);
const rootCID = CID.create(1, cbor.code, rootHash);

const { writer, out } = CarWriter.create(rootCID);
Readable.from(out).pipe(createWriteStream("example.car"));
await writer.put({ cid: rootCID, bytes: root });
for (const block of blocks) {
  await writer.put(block);
}
await writer.close();
