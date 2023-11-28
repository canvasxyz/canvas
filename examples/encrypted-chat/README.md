# Encrypted Chat Example

[Github Link](https://github.com/canvasxyz/canvas/tree/main/examples/encrypted-chat) (`npm i && npm run dev` to run, hosted demo coming soon)

The encrypted chat example implements simple private messaging for
up to 2 people, and can be easily extended to groups of up to ~100 people.

```ts
const models = {
  encryptionKeys: {
    address: "primary",
    key: "string",
  },
  encryptionGroups: {
    id: "primary",
    groupKeys: "string",
    key: "string",
  },
  privateMessages: {
    id: "primary",
    ciphertext: "string",
    group: "string",
    timestamp: "integer",
    $indexes: [["timestamp"]], // ["group", "timestamp"]
  },
}

const actions = {
  registerEncryptionKey: (db, { key }, { address }) => {
    db.set("encryptionKeys", { address, key })
  },
  createEncryptionGroup: (db, { members, groupKeys, groupPublicKey }, { address }) => {
    if (members.indexOf(fromCAIP(address)) === -1) throw new Error()
    const id = members.join()

    db.set("encryptionGroups", {
      id,
      groupKeys: JSON.stringify(groupKeys),
      key: groupPublicKey,
    })
  },
  sendPrivateMessage: (db, { group, ciphertext }, { timestamp, id }) => {
    db.set("privateMessages", { id, ciphertext, group, timestamp })
  },
}
```

### Registering Encryption Keys

Users derive an individual encryption key when they log into the
application, by signing a fixed message. [^1]

The derived entropy is used to create an Ethereum private key/address
pair, and this address is published in the `encryptionKeys` table.

Other users can see which users have registered to receive private
messages by inspecting the table. Anyone holding the Ethereum wallet
can re-derive the encryption key by signing the same message.

### Creating Encryption Groups

Anyone can start a private message by creating a 2-person encryption
group.

- To create an encryption group, we generate another random private key,
  the group encryption key, which will be published in the `key` field
  of `encryptionGroups`.
- We encrypt the group encryption key, using each of the group members'
  individual encryption keys, and store it in `groupKeys`.
- Finally, we identify each encryption group by `id`, the
  lexicographically sorted, concatenated list of addresses in the group.

### Sending Messages

To send a message to a group, we encrypt it using the group key, and
publish it in the `privateMessages` table.

### Further Work

This is a demo; later versions of this protocol might add some of these features:

- Ability for a user to derive multiple encryptionKeys. Right now, we
  assume that wallets correctly implement [RFC-6979](1), and so the
  db.encryptionKeys mapping will never be overwritten, but this assumption
  might be violated in edge cases.
- Requiring individuals to acknowledge that a group was correctly
  created, and/or using a zero-knowledge proof in the
  `createEncryptionGroup` process to show that the group key was
  encrypted correctly to each individual within the group.
- Ratchets to enforce key rotation for groups.
- Privacy-preserving broadcast using protocols like Waku.

[^1]:
    Ethereum wallets implement [RFC-6979](1) so signatures are
    deterministic. To be extra careful, for financial or mission-critical
    applications, you may want to prompt for a signature twice the first
    time seeing a user.

[1]: https://datatracker.ietf.org/doc/html/rfc6979
