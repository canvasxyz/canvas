# @canvas-js/interfaces

This package includes interfaces for Canvas signed data. Most
developers should not use this directly, except to import TypeScript
types when copying signed data to other databases and data stores.


### Default Canvas types

* **[Action](https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/actions.ts)**:
  An object that carries the signed data, signature, and optionally a `session` field
  if the payload was signed using a session address.
* **[ActionPayload](https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/actions.ts)**:
  The default signed data for a user interaction. This includes a function call and its arguments.
* **[Session](https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/sessions.ts)**:
  An object that carries the signed data and signature for a session.
* **[SessionPayload](https://github.com/canvasxyz/canvas/blob/main/packages/interfaces/src/sessions.ts)**:
  The default signed data for initiating a session. This includes
  a signature, timestamp, and for applications that read from blockchain data,
  it also includes a blockhash to tie the session to a specific block on
  the chain.

Collectively, we refer to actions and sessions as **messages**. When
replicating Canvas data across nodes, we typically store messages in a
[MessageStore](https://github.com/canvasxyz/canvas/blob/main/packages/core/src/messageStore.ts),
which stores them in a database and [MST](https://github.com/canvasxyz/okra).


### Custom Canvas types

Canvas will also support custom action payloads. More documentation on
this will be included in an upcoming release.
