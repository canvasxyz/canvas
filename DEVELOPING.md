# Developer Guide

### Building

Canvas is configured as a composite TypeScript project using project
references and must be compiled with build mode turned on. Build all
core packages in parallel with:

```
npm run dev
```

### Using a development instance of Canvas

To use your local development version of Canvas in the CLI:

```
./install.sh
```

This will put a stub shell script at `$(npm config get prefix)/bin/canvas`
that calls `node ${PWD}/packages/cli/index.js $@`.

Note that if you are using system Node, writing to /usr/local/bin/canvas
will require sudo. In that case, you should install
[NVM](https://github.com/nvm-sh/nvm#installing-and-updating) and set your
default Node with `nvm alias default v18`.

### Publishing to NPM

Before publishing, make sure the project is in a clean state and passes tests:

```
$ npm run clean
$ npm run build
$ npm run test
```

Make sure you've commited your changes:

```
$ git status
$ git add .
$ git commit -m "made some changes"
```

There is a bug in the NPM CLI that causes some workspace packages to not update their dependencies to other workspace packages to the new version. As a workaround, we have a custom script in `version.sh` that sets the version and dependencies for all the modules in `packages/` and `examples/`. Pass an explicit a `0.0.X` version number as the first argument:

```
$ ./version.sh 0.0.X
```

Then make a manual commit just for the version bump, and publish the packages together:

```
$ git add .
$ git commit -m "v0.0.X"
$ npm run publish
```

When the bug is fixed, we should be able to replace the `version.sh` script with `npm version --git-tag-version=false --workspaces=true --include-workspace-root=true --workspaces-update=true --save --save-exact`.

### Linting and Code Formatting

We use `prettier` for code formatting. You should install the relevant
prettier extension for your code editor, which will automatically
rewrite files as you save them.

To format all code using prettier:

```
prettier -w .
```

### Testing

Run `npm run test` to run all unit tests in all packages.

Run e.g. `npx ava packages/core` to run unit tests in one module.

To run unit tests in one file:

```
npx ava packages/core/test/lib/canvas.test.js
```

To run an individual test:

```
npx ava packages/core/test/lib/canvas.test.js -m "reject an invalid message"
```
