# Upgrading Applications

Canvas has functional but minimal support for upgrading applications right now.

We're working to smooth out the rough edges around application
upgrades this year, and provide an experience that matches traditional
databases.

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

## Soft Forks: Upgrading development applications

If you apply the upgrade **without retaining a snapshot**, this will
make your application reset and re-apply actions from the start.

This will start the application in soft-fork mode, with a topic like `example.xyz`.

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

## Hard Forks: Upgrading immutable applications

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
