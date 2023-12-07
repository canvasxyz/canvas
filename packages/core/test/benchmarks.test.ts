import test from "ava"

import { createLibp2p } from "libp2p"
import { nanoid } from "nanoid"
import pDefer, { DeferredPromise } from "p-defer"

import { Canvas, Contract } from "@canvas-js/core"

import { getDirectory } from "./utils.js"

test("no-op", (t) => t.pass())
