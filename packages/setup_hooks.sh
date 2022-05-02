# Use `npm link` to ensure examples import the same react package as canvas-hooks.
cd canvas-hooks/node_modules/react && npm link
cd -
cd example && npm link react
cd -
