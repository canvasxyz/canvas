// SPDX-License-Identifier: MIT

/**
 * Onchain verification library for Canvas actions and sessions.
 *
 * Typed data signatures for Sessions and Actions should exactly match those at:
 *
 * - @canvas-js/chain-ethereum `src/EIP712Signer.ts` (Session)
 * - @canvas-js/signed-cid `src/eip712codec.ts` (SessionMessage, ActionMessage)
 *
 * Canonically, the chain-ethereum signer asks the user's wallet to sign an
 * EIP712 serialized Session. The session key that was just authorized is then
 * used to sign a Payload<Session>, which is included in a Message<Session>
 * and appended to the execution log.
 *
 * This is why we have we have EIP712 typedefs inside `@canvas-js/chain-ethereum`
 * for Session, and typedefs for SessionMessage and ActionMessage in
 * @canvas-js/signed-cid, but no typedefs for Action.
 */

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CID.sol";

string constant sessionType = "Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
string constant actionType = "Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";
string constant sessionMessageType = "Message(uint256 clock,string[] parents,Session payload,string topic)Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
string constant actionMessageType = "Message(uint256 clock,string[] parents,Action payload,string topic)Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";

bytes32 constant DOMAIN_TYPE_HASH = keccak256("EIP712Domain(string name)");

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

    function _hashStringArray(string[] memory values) internal pure returns (bytes32) {
        bytes memory concatenatedHashes = new bytes(values.length * 32);

        for(uint256 i = 0; i < values.length; i++) {
            bytes32 valueHash = keccak256(bytes(values[i])); // hash each value and concatenate into the array
            for(uint256 j = 0; j < 32; j++) {
                concatenatedHashes[i * 32 + j] = valueHash[j];
            }
        }
        return keccak256(concatenatedHashes);
    }

    function _hashTypedDataV4(bytes32 structHash, string memory name) internal pure returns (bytes32 digest) {
        // TODO: Handle the case where the signer is initialized with a `uint256 chainId`, `address verifyingContract`, `string version`, or `string name`.
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes(name))
        ));
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
    }

    /**
     * Create a CID from a multihash.
     */
    function _createCID(bytes memory multihash) pure internal returns (bytes memory) {
        uint256 digestSize;
        bytes memory digest;
        // this corresponds to the "raw" digest in the multicodec spec
        // https://github.com/multiformats/multicodec/blob/696e701b6cb61f54b67a33b002201450d021f312/table.csv#L41
        (digestSize,digest) = CID.createDigest(0x55, multihash);

        return CID.encodeCID(1, 0x55, digest);
    }

    /**
     * Hash a Session.
     */
    function hashSession(
        Session memory session
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            keccak256(bytes(sessionType)),
            session.address_,
            keccak256(bytes(session.blockhash)),
            session.duration,
            keccak256(bytes(session.publicKey)),
            session.timestamp
        ));
    }

    /**
     * Hash an Action. It is expected that the action's `args` have already been hashed.
     */
    function hashAction(
        Action memory action
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            keccak256(bytes(actionType)),
            action.address_,
            keccak256(action.args),
            keccak256(bytes(action.blockhash)),
            keccak256(bytes(action.name)),
            action.timestamp
        ));
    }

    /**
     * Hash a Message<Session>.
     */
    function hashSessionMessage(
        SessionMessage memory sessionMessage
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                keccak256(bytes(sessionMessageType)),
                sessionMessage.clock,
                _hashStringArray(sessionMessage.parents),
                hashSession(sessionMessage.payload),
                keccak256(bytes(sessionMessage.topic))
            )
        );
    }

    /**
     * Hash a Message<Action>.
     */
    function hashActionMessage(
        ActionMessage memory actionMessage
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                keccak256(bytes(actionMessageType)),
                actionMessage.clock,
                _hashStringArray(actionMessage.parents),
                hashAction(actionMessage.payload),
                keccak256(bytes(actionMessage.topic))
            )
        );
    }

    /**
     * Recover the address that signed a Session.
     */
    function recoverAddressFromSession(
        Session memory session,
        string memory name
    ) public pure returns (address) {
        bytes32 digest = _hashTypedDataV4(hashSession(session), name);

        return ECDSA.recover(digest, session.authorizationData.signature);
    }

    /**
     * Verify a Session.
     */
    function verifySession(
        Session memory session,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) {
        bytes32 digest = _hashTypedDataV4(hashSession(session), name);

        return ECDSA.recover(digest, session.authorizationData.signature) == expectedAddress;
    }

    /**
     * Verify a Message<Session>.
     *
     * Note that Message<Session> is just an envelope for the actual signed Session. To verify that the signing user
     * actually delegated signing authority to the session key, use `recoverAddressFromSession` or `verifySession`.
     *
     * See: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
     */
    function verifySessionMessage(
        SessionMessage memory sessionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) {
        bytes32 digest = _hashTypedDataV4(hashSessionMessage(sessionMessage), name);
        bytes memory cid = _createCID(bytes.concat(digest));

        // truncate cid to 32 bytes
        bytes memory truncatedCid = new bytes(32);
        for(uint256 i = 0; i < 32 && i < cid.length; i++) {
            truncatedCid[i] = cid[i];
        }

        bytes32 truncatedCid32 = bytes32(truncatedCid);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(truncatedCid32, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(truncatedCid32, 28, r, s);
        if (signerV28 == expectedAddress) {
            return true;
        }

        return false;
    }

    /**
     * Verify a Message<Action>.
     * See: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
     */
    function verifyActionMessage(
        ActionMessage memory actionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) {
        bytes32 digest = _hashTypedDataV4(hashActionMessage(actionMessage), name);
        bytes memory cid = _createCID(bytes.concat(digest));

        // truncate cid to 32 bytes
        bytes memory truncatedCid = new bytes(32);
        for(uint256 i = 0; i < 32 && i < cid.length; i++) {
            truncatedCid[i] = cid[i];
        }
        bytes32 truncatedCid32 = bytes32(truncatedCid);


        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(truncatedCid32, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(truncatedCid32, 28, r, s);
        if (signerV28 == expectedAddress) {
            return true;
        }

        return false;
    }
}
