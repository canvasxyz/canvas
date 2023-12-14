# @canvas-js/hooks

Hooks for using Canvas applications in React.

## Table of Contents

- [`useCanvas`](#usecanvas)
- [`useLiveQuery`](#uselivequery)
- [`useTick`](#usetick)

## `useCanvas`

The `useCanvas` hook initializes a Canvas application contract inside a React component. It accepts the same `CanvasConfig` object as `Canvas.initialize` in `@canvas-js/core`.

```ts
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { useCanvas } from "@canvas-js/hooks"
import { Forum } from "@canvas-js/templates"

export function MyApp() {
  const { app, error } = useCanvas({
    contract: { topic: "com.example.forum", ...Forum },
    signers: [new SIWESigner({ signer: wallet })],
    topic: "myapp",
  })
}
```

Note that `app` might be null the first time the hook runs.

## `useLiveQuery`

The `useLiveQuery` hook maintains a live-updated frontend query on top of a Canvas application.

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

## `useTick`

`useTick(app: Canvas, condition: string | null, interval: number)`

The `useTick` hook calls a `tick()` action on a contract at a regular interval.

Ticking happens client-side. Here are a few considerations:

* Ticking will only run if the user has started a session.
* If a client observes that any other user on the log has called tick()
  within the last `interval`, their tick will be skipped.
* Contracts will stop ticking if no clients are online.

Note that useTick() does not do any special accounting for networking -
it is possible that if two users start their timers at around the same time, their
clocks will be synchronized and each will emit tick() events around the same time.

You should account for this in your application logic.

### Conditional Ticking

Ticking can be configured to only run when a certain condition in the database is true.

```ts
const models = {
  state: {
    gameOver: "boolean"
  }
}

const actions = {
  toggleGameStart: (db) => {
    const { gameOver } = await db.state.get()
    db.state.set({ gameOver: !gameOver })
  }
  tick: (db} => {
    // ...
  }
}

const { app } = useCanvas({
  contract: { models, actions }
})

useTick(app, '!state.gameOver', 1000)
```

The condition can be any query of the form `model.field` or `!model.field`.

If would prefer not to use a condition, you can also leave it null.

```ts
useTick(app, null, 1000)
```
