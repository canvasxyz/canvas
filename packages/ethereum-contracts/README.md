# @canvas-js/ethereum-contracts

Contracts for onchain verification of Canvas messages created by verifiable signers, e.g. `EIP712Signer`.

### Usage

```
import "@canvas-js/ethereum-contracts/EIP712_Canvas.sol";

// TODO
```

### API

```
contract EIP712_Canvas {
    struct Session {
        address address_;
        string blockhash_;
        uint256 duration;
        string publicKey;
        uint256 timestamp;
    }

    struct Action {
        address address_;
        bytes args;
        string blockhash_;
        string name;
        uint256 timestamp;
    }

    struct MessageSession {
        uint256 clock;
        string[] parents;
        Session payload;
        string topic;
    }

    struct MessageAction {
        uint256 clock;
        string[] parents;
        Action payload;
        string topic;
    }

    function getStructHashForSession(
        Session memory session
    ) public pure returns (bytes32) { ... }

    function getStructHashForAction(
        Action memory action
    ) public pure returns (bytes32) { ... }

    function recoverAddressFromSession(
        Session memory session,
        bytes memory signature
    ) public pure returns (address) { ... }

    function getStructHashForMessageSession(
        MessageSession memory messageSession
    ) public pure returns (bytes32) { ... }

    function getStructHashForMessageAction(
        MessageAction memory messageAction
    ) public pure returns (bytes32) { ... }

    function verifyAddressForMessageSession(
        MessageSession memory messageSession,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) { ... }

    function verifyAddressForMessageAction(
        MessageAction memory messageAction,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) { ... }
```

### Internal APIs

* `library CID`: Utilities.
    * `createDigest`: Creates a concatenated "<code><digest>" bytearray.
    * `encodeCID`: Creates a concatenated "<version><code><multihash>" bytearray.
* `library ECDSA_Verify`: Checks ECDSA signatures: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.1/contracts/utils/cryptography/ECDSA.sol
* `library Varint`: Implements the variable length integer used by Multiformats/Protobufs: https://github.com/multiformats/unsigned-varint
* `contract CID_External`: Exports CID functions for testing/external usage.
