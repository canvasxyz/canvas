# Upgrading Applications

When you use `canvas run --network-explorer`, the node will serve a
management interface, similar to the Firebase web interface, that
shows you the current database and contract.

If you also add `--admin` followed by an admin Ethereum address[^1], you
can use the explorer to live-update your backend:

[^1]: This requires an Ethereum wallet like Metamask or Rabby. We also
plan to introduce an admin password option soon.

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

Hard-forked applications have topics like `example.xyz#ffae63ab95cc5483`,
where the hash identifies the snapshot of the application.

Hard-fork applications must run inside the QuickJS VM with a text
contract. For now, we recommend that clients of hard-fork applications
[fetch the contract from a server](/5-deployment.html#cli-application-with-snapshot)
when starting.

**Note**: Once you hard-fork an application, you cannot switch back to soft-fork
execution without losing all your previous data, and all users' previous actions.
