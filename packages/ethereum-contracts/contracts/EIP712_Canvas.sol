// SPDX-License-Identifier: MIT

/**
 * Onchain verification library for Canvas actions and sessions.
 *
 * Typed data signatures for Sessions and Actions should exactly match those at:
 *
 * - @canvas-js/chain-ethereum `src/EIP712Signer.ts` (Session)
 * - @canvas-js/signed-cid `src/eip712codec.ts` (MessageSession, MessageAction)
 *
 * Canonically, the chain-ethereum signer asks the user's wallet to sign an
 * EIP712 serialized Session. The session key that was just authorized is then
 * used to sign a Payload<Session>, which is included in a Message<Session>
 * and appended to the execution log.
 *
 * This is why we have we have EIP712 typedefs inside `@canvas-js/chain-ethereum`
 * for Session, and typedefs for MessageSession and MessageAction in
 * @canvas-js/signed-cid, but no typedefs for Action.
 */

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CID.sol";

string constant sessionType = "Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
string constant actionType = "Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";
string constant messageSessionType = "Message(uint256 clock,string[] parents,Session payload,string topic)Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
string constant messageActionType = "Message(uint256 clock,string[] parents,Action payload,string topic)Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";

// TODO: Handle the case where the signer is initialized with a `uint256 chainId`, `address verifyingContract`, `string version`, or `string name`.
bytes32 constant emptyDomainSeparator = keccak256(abi.encode(keccak256("EIP712Domain()")));

contract EIP712_Canvas {
    struct Session {
        address address_;
        string blockhash;
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

    function _hashTypedDataV4(bytes32 structHash) internal pure returns (bytes32 digest) {
        return _toTypedDataHash(emptyDomainSeparator, structHash);
    }

    function _toTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32 digest) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
    }

    function createCIDEip712CodecNoneDigest(bytes memory multihash) pure internal returns (bytes memory) {
        uint256 digestSize;
        bytes memory digest;
        (digestSize,digest) = CID.createDigest(0xff, multihash);

        return CID.encodeCID(1, 712, digest);
    }


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

    function recoverAddressFromSession(
        Session memory session,
        bytes memory signature
    ) public pure returns (address) {
        bytes32 digest = _hashTypedDataV4(hashSession(session));

        return ECDSA.recover(digest, signature);
    }

    function hashMessageSession(
        MessageSession memory messageSession
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                keccak256(bytes(messageSessionType)),
                messageSession.clock,
                _hashStringArray(messageSession.parents),
                hashSession(messageSession.payload),
                keccak256(bytes(messageSession.topic))
            )
        );
    }

    function hashMessageAction(
        MessageAction memory messageAction
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                keccak256(bytes(messageActionType)),
                messageAction.clock,
                _hashStringArray(messageAction.parents),
                hashAction(messageAction.payload),
                keccak256(bytes(messageAction.topic))
            )
        );
    }

    function verifyAddressForMessageSession(
        MessageSession memory messageSession,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) {
        bytes32 digest = _hashTypedDataV4(hashMessageSession(messageSession));
        bytes memory cid = createCIDEip712CodecNoneDigest(bytes.concat(digest));
        bytes32 hash = sha256(cid);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(hash, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(hash, 28, r, s);
        if (signerV28 == expectedAddress) {
            return true;
        }

        return false;
    }

    function verifyAddressForMessageAction(
        MessageAction memory messageAction,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) {
        bytes32 digest = _hashTypedDataV4(hashMessageAction(messageAction));
        bytes memory cid = createCIDEip712CodecNoneDigest(bytes.concat(digest));
        bytes32 hash = sha256(cid);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(hash, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(hash, 28, r, s);
        if (signerV28 == expectedAddress) {
            return true;
        }

        return false;
    }
}
