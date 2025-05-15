# Upgrading Applications

Upgrading a peer-to-peer application is slightly more complex than
upgrading an application coordinated by a central server.

We have functional but minimal support for two ways to upgrade applications:

* [Soft-fork upgrades](#soft-forks), where an application gets *extended* with actions that wouldn't be accepted in the pre-upgrade application. This requires reasoning about actions, and taking care to not introduce changes that would cause peers to go out of sync.
* [Hard-fork upgrades](#hard-forks), where the application gets switched to a new contract and peer-to-peer mesh entirely. Hard forks start from scratch, from a flattened, compacted snapshot of the existing application history.

Regular, soft-forked applications have a topic like `example.xyz`, while hard-forked applications have a topic like `example.canvas.xyz#ffae63ab95cc5483`.

## Using the Network Explorer

When you use `canvas run --network-explorer`, the node will serve a
management interface, similar to the Firebase web interface, that
shows you the current database and contract.

If you also add `--admin` followed by an admin Ethereum address[^1], you
can use the explorer to live-update your backend:

[^1]: This requires an Ethereum wallet like
[Metamask](https://metamask.io/) or [Rabby](https://rabby.io/).

![Contract code](/contract_code.png)

Edit your contract and press "Build" to compile an updated
contract.

This will run an esbuild bundler that catches syntax errors,
validates your new contract's models, and shows you transformations
to be applied to the database.

You can now decide whether you want to proceed with the upgrade:

![Run migrations](/run_migrations.png)

## Soft Forks

If you apply the upgrade **without retaining a snapshot**, this will
make your application reset and re-apply actions from the start.

This will start the application in soft-fork mode, with the same topic as before, e.g. `example.xyz`.

Soft-fork applications start from an empty database, and attempt to
replay the entire history of actions every time.

> [!TIP]
> You should take care to ensure that the new application accepts all
> actions from the previous application. Otherwise, those actions will be lost,
> as well as any actions following them.
>
> For this reason, we discourage developers from soft-forking
> applications in production at this time, until further
> protections are in place.

## Hard Forks

If you apply the upgrade **while retaining a snapshot**, this will
make your application restart from a hard fork snapshot, which holds
the initial database state of the application.

Creating a snapshot causes the server to append a #hash to the end of
your topic, so `example.canvas.xyz` would become
`example.canvas.xyz#ffae63ab95cc5483`.

Each snapshotted application runs on its own mesh. The snapshotted
application will *not* sync with apps on the original topic without a
snapshot, since this is a hard fork.

For now, we recommend that clients of hard-fork applications fetch the
contract from a server when starting, by using the `useContract` hook
without `contract` or `topic`, in their local client code:

```ts
const app = useCanvas("ws://app.example.xyz", {
  signers: [new SIWESigner()]
})
```

This will ensure that your local application always stays in sync with
the server.

> [!TIP]
> We are actively working on several backwards-compatible improvements to the
> snapshot system, that will make it easier to understand the data flow
> between different versions of your application.
