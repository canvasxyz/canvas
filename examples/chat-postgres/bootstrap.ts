import { register } from "ts-node";
import { pathToFileURL } from "url";

register({
  project: "./tsconfig.json",
  transpileOnly: true,
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import(pathToFileURL("./server.ts").href);