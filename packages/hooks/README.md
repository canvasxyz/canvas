# @canvas-js/hooks

Hooks for using Canvas applications in React.

## Table of Contents

- [`useCanvas`](#usecanvas)
- [`useLiveQuery`](#uselivequery)

## `useCanvas`

The `useCanvas` hook initializes a Canvas application contract inside a React component. It accepts the same `CanvasConfig` object as `Canvas.initialize`.

```ts
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { Forum } from "@canvas-js/templates"

export function MyApp() {
  const { app, error } = useCanvas({
    contract: { topic: "com.example.forum", ...Forum },
    signers: [new SIWESigner({ signer: wallet })],
    location: "myapp",
  })
}
```

## `useLiveQuery`

The `useLiveQuery` hook maintains a reactive frontend query on top of a Canvas application.

You can see a more [complete example here](/readme-core.html#subscribing-to-live-queries).

Example usage:

```ts
import { useLiveQuery } from "@canvas-js/hooks"

export function MyComponent({ app }: { app?: Canvas }) {
  const threads = useLiveQuery<Thread>(app, "threads", {
    offset: page * 10,
    limit: 10,
    orderBy: { timestamp: "desc" },
    where: category === "all" ? undefined : { category },
  })
}
```
