# @canvas-js/next

This package provides the `canvas-next` command line tool, for
running Next.js Canvas monorepos with a combined frontend and backend.

To use canvas-next, start with an existing Next.js application
(e.g. using [create-next-app](https://nextjs.org/docs/api-reference/create-next-app))
and install the package:

```
npx create-next-app@latest my-app
cd my-app
npm install @canvas-js/next
```

Inside package.json, replace `next start` with `canvas-next`:

```
scripts": {
  "dev": "canvas-next",
  "build": "next build",
  "start": "NODE_ENV=production CANVAS_PATH=./ canvas-next",
  "lint": "next lint"
}
```

Now, `npm run dev` will automatically look for `spec.canvas.js` in your
project's root directory, and start a non-persistent development server.

`npm run start` will start a production server.

MIT (c) 2023 Canvas Technology Corporation