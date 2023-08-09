#!/usr/bin/env node

import { createReadStream } from "node:fs";
import assert from "node:assert";
import { CarReader } from "@ipld/car";

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";
import * as cbor from "@ipld/dag-cbor";

const reader = await CarReader.fromIterable(createReadStream("example.car"));

const [rootCID] = await reader.getRoots();
assert(rootCID !== undefined && rootCID.code === cbor.code);
const root = await reader.get(rootCID);
assert(root !== undefined);
const modules = cbor.decode(root.bytes);
console.log(modules);
