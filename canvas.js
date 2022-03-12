import 'ses';
import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import { ethers } from "ethers";

// hub server related
import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import config from './server/webpack.dev.config.js';
import Knex from 'knex';

import crypto from 'crypto';
import bs58 from 'bs58';

import { Loader } from './server/loader.js';


const USAGE = `Canvas: everlasting applications

$ node canvas.js [spec]

  Canvas accepts specs in a few formats:
   test.canvas.js           Local spec.
   /ipfs/Qm...              Loads a spec from IPFS. Unsafe.

  Optional arguments:
   --run-tests              Looks for a corresponding .canvas.tests.js, runs them, and then quits.
   --reset-database         Resets the database, and then quits.
   --verbose                Prints SQL debug output to console.

  To upload a local spec to ipfs, run 'ipfs add test.canvas.js'.
`;

const quit = (msg) => {
  if (msg) {
    console.error(msg);
  }
  console.log(USAGE);
  process.exit(1);
}

if (process.argv.length < 3) {
  quit();
}

// TODO: use a proper argv parser
const optionalArgs = process.argv.slice(2, process.argv.length - 1);
optionalArgs.forEach((oarg) => {
  if (['--run-tests', '--reset-database', '--verbose'].indexOf(oarg) === -1) {
    quit('Invalid argument: ' + oarg);
  }
});
const shouldRunTests = optionalArgs.includes('--run-tests');
const shouldResetDatabase = optionalArgs.includes('--reset-database'); // TODO: unimplemented
const shouldRunVerboseMode = optionalArgs.includes('--verbose'); // TODO: unimplemented

const specArg = process.argv[process.argv.length - 1];

if (specArg.startsWith('-')) {
  quit("Must provide a valid spec filename!");
} else if (specArg.startsWith('/ipfs/')) {
  quit("IPFS not supported yet!"); // TODO: unimplemented
} else if (specArg.startsWith('/ipns/')) {
  quit("IPNS not supported yet!"); // TODO: unimplemented
}

const filename = process.argv[process.argv.length - 1];
if (!filename.endsWith('.canvas.js')) {
  quit("Spec names must end in .canvas.js");
}

const file = fs.readFile(filename, 'utf8', async (err, spec) => {
  if (err) {
    return quit("Spec file not found, or could not be read");
  }

  const app = express();
  app.use(cors());

  // Get a multihash for the spec
  const hashFunction = Buffer.from('12', 'hex'); // 0x20
  const digest = crypto.createHash('sha256').update(spec).digest();
  const digestSize = Buffer.from(digest.byteLength.toString(16), 'hex'); // 20
  const combined = Buffer.concat([hashFunction, digestSize, digest]);
  const multihash = bs58.encode(combined);
  console.log(`Serving ${filename} at /apps/${multihash}`);

  // Serve api routes for application hub
  app.get('/info', (req, res, next) => {
    res.json({
        multihash,
        specSize: spec.length,
    });
  });

  app.get('/actions/:multihash', (req, res, next) => {
    const knex = Knex({
        client: 'better-sqlite3',
        connection: {
            filename: `db/${multihash}.sqlite`
        }
    });
    res.json({
        multihash: req.params.multihash,
        actions: [],
    });
  });

  // Serve static files for application hub
  const compiler = webpack(config);
  app.use(webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath
  }));
  app.use(webpackHotMiddleware(compiler));

  const DIST_DIR = path.dirname(fileURLToPath(import.meta.url));
  const HTML_FILE = path.join(DIST_DIR, 'server/static/index.html');
  app.get('/', (req, res, next) => {
    compiler.outputFileSystem.readFile(HTML_FILE, (err, result) => {
      if (err) {
        next(err);
        return;
      }
      res.set('content-type', 'text/html');
      res.send(result);
      res.end();
    });
  });

  // See https://github.com/endojs/endo/tree/master/packages/ses
  //
  // Lock down globals, then inject the loader into a new compartment
  // and execute the spec to get sandboxed execution. The SES
  // compartment means that the spec is executed in an environment
  // with its own globals.
  //
  // Later we should use Deno or OS-level VMs to gain more security.
  lockdown();

  // Install the spec inside an SES compartment
  app.use(bodyParser.json());
  const loader = new Loader(app, multihash, shouldRunVerboseMode);
  const c = new Compartment({
    canvas: loader,
    // TODO: these objects aren't hardened. We should refactor to only
    // expose bidirectional message-passing calls to the spec for
    // model setup, view setup, and action functions
  });
  await c.evaluate(spec);

  loader.syncDB().then(async (loader) => {
    loader.server().listen(8000, async () => {
      console.log('Server listening on port 8000');

      if (shouldRunTests) {
          const testsFilename = filename.replace(/\.canvas\.js$/, '.canvas.tests.js');
          console.log(testsFilename);
          const testsFile = fs.readFile(testsFilename, 'utf8', async (err, tests) => {
              if (err) {
                  console.log("Test file not found, or could not be read");
                  process.exit(1);
              }

              const c = new Compartment({
                  axios,
                  ethers,
                  console: {
                      log: console.log
                  },
                  multihash,
                  // TODO: these objects aren't hardened. We should refactor to only
                  // expose bidirectional message-passing calls to the spec for
                  // model setup, view setup, and action functions
              });
              await c.evaluate(tests);
              process.exit(0);
          });
      }
    });
  });
});
