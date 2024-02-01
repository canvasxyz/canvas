# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by verifiable signers, e.g. `EIP712Signer`.

### Usage

```
import "@canvas-js/ethereum-contracts/EIP712_Canvas.sol";

// TODO
```

### API

```
library EIP712_Canvas {
    struct AuthorizationData {
        bytes signature;
    }

    struct Session {
        address address_;
        string blockhash;
        AuthorizationData authorizationData;
        uint256 duration;
        string publicKey;
        uint256 timestamp;
    }

    struct Action {
        address address_;
        bytes args;
        string blockhash;
        string name;
        uint256 timestamp;
    }

    struct SessionMessage {
        uint256 clock;
        string[] parents;
        Session payload;
        string topic;
    }

    struct ActionMessage {
        uint256 clock;
        string[] parents;
        Action payload;
        string topic;
    }

    function hashSession(
        Session memory session
    ) public pure returns (bytes32) { ...}

    function hashAction(
        Action memory action
    ) public pure returns (bytes32) { ... }

    function hashSessionMessage(
        SessionMessage memory sessionMessage
    ) public pure returns (bytes32) { ... }

    function hashActionMessage(
        ActionMessage memory actionMessage
    ) public pure returns (bytes32) { ... }

    function recoverAddressFromSession(
        Session memory session,
        string memory name
    ) public pure returns (address) { ... }

    function verifySession(
        Session memory session,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) { ... }

    function verifySessionMessage(
        SessionMessage memory sessionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) { ... }

    function verifyActionMessage(
        ActionMessage memory actionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) { ... }
```

### Internal APIs

- `library CID`: Utilities.
  - `createDigest`: Creates a concatenated "<code><digest>" bytearray.
  - `encodeCID`: Creates a concatenated "<version><code><multihash>" bytearray.
- `contract CID_Test`: Exports CID functions for use in the test suite.
- `contract EIP712_Canvas_Test`: Exports EIP712 Canvas functions for use in the test suite.
- `contract Contract_Test`: An example smart contract that validates Canvas actions and sessions and updates its own state.
