import esbuild from 'esbuild';

esbuild.build({
  bundle: true,
  entryPoints: ['server.ts'],
  external: ['express'],
  minify: true,
  outfile: 'dist/server.js',
  sourcemap: 'inline',
  target: ['node18'], // or your target Node.js version
  tsconfig: 'tsconfig.json',
  platform: 'node',
}).catch(() => process.exit(1));