// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EIP712Signer.sol";

/**
 * EIP712 typed data hashers for the onchain encodings of
 * Message<Action>, Message<Session>, and Session.
 */
library Hashers {
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
        EIP712Signer.SessionMessage memory sessionMessage,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712Signer.DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(EIP712Signer.sessionMessageType)),
                keccak256(bytes(topic)),
                sessionMessage.clock,
                _hashStringArray(sessionMessage.parents),
                keccak256(abi.encode(
                    keccak256(abi.encodePacked(EIP712Signer.sessionType)),
                    sessionMessage.payload.userAddress,
                    keccak256(bytes(sessionMessage.payload.publicKey)),
                    keccak256(abi.encode(
                        keccak256(abi.encodePacked(EIP712Signer.authorizationDataType)),
                        keccak256(sessionMessage.payload.authorizationData.signature)
                    )),
                    sessionMessage.payload.duration,
                    sessionMessage.payload.timestamp,
                    keccak256(bytes(sessionMessage.payload.blockhash))
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
     * Hash a Message<Action>.
     */
    function hashActionMessage(
        EIP712Signer.ActionMessage memory actionMessage,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712Signer.DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(EIP712Signer.actionMessageType)),
                keccak256(bytes(topic)),
                actionMessage.clock,
                _hashStringArray(actionMessage.parents),
                keccak256(abi.encode(
                    keccak256(abi.encodePacked(EIP712Signer.actionType)),
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
    function hashSession(
        EIP712Signer.Session memory session,
        string memory topic
    ) public pure returns (bytes32 digest) {
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712Signer.DOMAIN_TYPE_HASH,
            keccak256(bytes(topic))
        ));
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(EIP712Signer.sessionDataType)),
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
}
