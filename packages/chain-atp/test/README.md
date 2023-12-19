# `chain-atp` tests

These tests make use of test fixtures that have been captured from responses from a Bluesky PDS and the [DID PLC Directory](https://web.plc.directory/).

To update these test fixtures, run the command `npm run generate-test-data` from inside the `chain-atp` package (or from the root of this monorepo using `npm run generate-test-data -w=packages/chain-atp`). When prompted, enter the identifier (e.g. `somebody.bsky.social`) and an app password of a Bluesky account. The script makes a number of changes to the fixture files, which should be checked into the repository:

- `test/fixture.json` is updated
- `test/plcOperationLog.json` is updated
- A new file `test/archives/<rkey>.car` is created. The other files in the archives directory should be deleted.

To confirm that the fixture update has worked, run `npm run test` for this package.
