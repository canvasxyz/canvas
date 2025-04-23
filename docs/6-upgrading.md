# Upgrading Applications

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

This will start the application in soft-fork mode, with a topic like `example.xyz`.

Soft-fork applications start from an empty database, and are
recommended for getting started.

## Hard Forks

If you apply the upgrade **while retaining a snapshot**, this will
make your application restart from a hard fork snapshot, which holds
the initial database state of the application.

Creating a snapshot causes the server to append a #hash to the end of
your topic, so an topic like `chat-example.canvas.xyz` would become:

```
chat-example.canvas.xyz#ffae63ab95cc5483
```

Each snapshotted application runs on its own mesh. The snapshotted
application will *not* sync with applications on the topic
`chat-example.canvas.xyz`.

For now, we recommend that clients of hard-fork applications
[fetch the contract](/5-deployment.html#cli-application-with-snapshot)
from a server when starting.
