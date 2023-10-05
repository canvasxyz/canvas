# @canvas-js/cr-mudevm-sync

⚡️ Offchain applications built on libp2p, MUD, and the EVM.

This module allows you to write offchain applications on chains running MUD,
with logic defined inside systems and tables declared inside mud.config.ts.

Offchain actions can _read_ from onchain data and _write_ to offchain-synced tables.
This is like ephemeral tables with `offchainOnly: true`, except that sync happens
entirely over libp2p and actions don't require gas.

You can use this to write messaging systems, gasless governance systems,
state channels, and offchain orderbooks.

### Tutorial

To get started, configure a table `MyTable` in mud.config.ts with `offchainOnly: true`,
and a system to write to the table.

```typescript
export default mudConfig({
  systems: {
    MySystem: {
      name: "messaging",
      openAccess: true
    }
  },
  tables: {
    MyTable: {
      valueSchema: {
        from: "address",
        message: "string",
      },
      offchainOnly: true,
    }
  }
})
```

For now, you should return a table data `struct` to write to tables. This will be replaced
with the standard MUD table API later; see 'Improvements' for how this would work.

```solidity
contract MySystem is System {
  function sendOffchainMessage(string memory message) public returns (MyTableData memory) {
    // ...
    return MyTableData(_msgSender(), message);
  }
}
```

To sync, query, and write to the table on the client-side:

```tsx
import { useCanvas, useLiveQuery } from "@canvas-js/cr-mudevm-sync"
import mudConfig from "contracts/mud.config"
import { getNetworkConfig } from "./mud/getNetworkConfig"

// Dictionary of ABIs for all systems you would like to make callable offchain:
const systemAbis = import.meta.glob("./../../contracts/out/*System.sol/*.abi.json", { as: "raw" })

export const App = () => {
  const app = useCanvas({
    world: {
      mudConfig,
      publicClient: mud.network.publicClient,
      worldContract: mud.network.worldContract,
      getPrivateKey: () => getNetworkConfig().then((n) => n.privateKey),
    },
    systemAbis,
    offline: true,
  })

  const messages = useLiveQuery(app?.db, "MyTable", { where: { ... } })

  return <div>{messages.map(msg => <div>{msg.content}</div>)}</div>
}
```

Instead of `worldContract.write.doAction([arg0])`, now use `app.actions.doAction({ arg0: val0 })`.
This will execute instantly and sync over libp2p between blocks.

### State Channels

TBD

### Reading from Tables

TBD

### Improvements

Many of these improvements require a MUD plugin for config/typing changes.

* [ ] Add state override for Table.set() calls, so we can write to offchain tables using the normal
  table API and return custom packed effects with multiple set() calls.
* [ ] Support Canvas db.get() calls inside the EVM.
* [ ] Find a better API for getting system ABIs. Components are exposed directly but not systems right now.
* [ ] Find a better API for getting the burner private key.
* [ ] Add config option for specifying exactly which tables to sync (`offchainSync: true`).
* [ ] Add config option for specifying exactly which systems to sync (`contract System is OffchainSystem`).
* [ ] Support extended table operations on dynamic arrays.
* [ ] Add other Canvas config options including libp2p config.