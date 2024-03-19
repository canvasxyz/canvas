// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// EIP712 formats defined by the Eip712Signer session-signer class
// and Secp256k1DelegateSigner action-signer class, which ask users
// to sign flattened versions of the EIP712_Canvas data structures.
//
// These *do not* match the structs defined later in this library.
//
// See packages/chain-ethereum/src/eip712/Eip712Signer.ts
// for the exact implementation.

string constant sessionDataType = "SessionData(string topic,address sessionAddress,uint64 duration,uint64 timestamp,string blockhash)";

string constant authorizationDataType = "AuthorizationData(bytes signature)";
string constant sessionType = "Session(address address,string publicKey,AuthorizationData authorizationData,uint64 duration,uint64 timestamp,string blockhash)AuthorizationData(bytes signature)";
string constant sessionMessageType = "Message(string topic,uint64 clock,string[] parents,Session payload)Session(address address,string publicKey,AuthorizationData authorizationData,uint64 duration,uint64 timestamp,string blockhash)AuthorizationData(bytes signature)";

string constant actionType = "Action(address address,bytes args,string name,uint64 timestamp,string blockhash)";
string constant actionMessageType = "Message(string topic,uint64 clock,string[] parents,Action payload)Action(address address,bytes args,string name,uint64 timestamp,string blockhash)";

bytes32 constant DOMAIN_TYPE_HASH = keccak256("EIP712Domain(string name)");

library EIP712_Canvas {
    struct AuthorizationData {
        bytes signature;
    }

    struct Session {
        address userAddress;
        address sessionAddress;
        AuthorizationData authorizationData;
        string blockhash;
        string publicKey;
        uint64 duration;
        uint64 timestamp;
    }

    struct SessionMessage {
        uint64 clock;
        string[] parents;
        string topic;
        Session payload;
    }

    struct Action {
        address userAddress;
        address sessionAddress;
        bytes args;
        string blockhash;
        string publicKey;
        string name;
        uint64 timestamp;
    }

    struct ActionMessage {
        uint64 clock;
        string[] parents;
        string topic;
        Action payload;
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

    /**
     * Hash a Message<Session>.
     */
    function hashSessionMessage(
        SessionMessage memory sessionMessage,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(sessionMessageType)),
                keccak256(bytes(topic)),
                sessionMessage.clock,
                _hashStringArray(sessionMessage.parents),
                keccak256(abi.encode(
                    keccak256(abi.encodePacked(sessionType)),
                    sessionMessage.payload.sessionAddress, //?
                    sessionMessage.payload.publicKey,
                    keccak256(abi.encode(
                        keccak256(abi.encodePacked(authorizationDataType)),
                        sessionMessage.payload.authorizationData.signature
                    )),
                    sessionMessage.payload.duration,
                    sessionMessage.payload.timestamp,
                    keccak256(bytes(sessionMessage.payload.blockhash))
                ))
            )
        );
        //Session(address address,string publicKey,AuthorizationData authorizationData,uint64 duration,uint64 timestamp,string blockhash)AuthorizationData(bytes signature)";

        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
        return digest;
    }

    /**
     * Hash a Message<Action>.
     */
    function hashActionMessage(
        ActionMessage memory actionMessage,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));

        bytes32[] memory arr;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(actionMessageType)),
                keccak256(bytes(topic)),
                actionMessage.clock,
                _hashStringArray(actionMessage.parents),
                keccak256(abi.encode(
                    keccak256(abi.encodePacked(actionType)),
                    actionMessage.payload.userAddress,
                    keccak256(actionMessage.payload.args),
                    keccak256(bytes(actionMessage.payload.name)),
                    actionMessage.payload.timestamp,
                    keccak256(bytes(actionMessage.payload.blockhash))
                ))
            )
        );

        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
        return digest;
    }

    /**
     * Recover the address that signed a Session.
     */
    function encodeDataFromSession(
        Session memory session,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(sessionDataType)),
                keccak256(bytes(topic)),
                session.sessionAddress,
                session.duration,
                session.timestamp,
                keccak256(bytes(session.blockhash))
            )
        );

        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
        return digest;
    }


    function recoverAddressFromSession(
        Session memory session,
        string memory topic
    ) public pure returns (address) {
        bytes32 digest = encodeDataFromSession(session, topic);
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
        bytes32 digest = encodeDataFromSession(session, name);

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
        bytes32 digest = hashSessionMessage(sessionMessage, name);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(digest, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(digest, 28, r, s);
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
        bytes32 digest = hashActionMessage(actionMessage, name);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(digest, 27, r, s);
        if (signerV27 == expectedAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(digest, 28, r, s);
        if (signerV28 == expectedAddress) {
            return true;
        }

        return false;
    }
}
