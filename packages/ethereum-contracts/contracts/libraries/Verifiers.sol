// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./EIP712Signer.sol";
import "./Hashers.sol";

/**
 * Signature verifiers for the onchain encodings of
 * Message<Action>, Message<Session>, and Session.
 */
library Verifiers {
    /**
     * Recover the user's wallet address that authorized a Session.
     */
    function recoverAddressFromSession(
        EIP712Signer.Session memory session,
        string memory topic
    ) public pure returns (address) {
        bytes32 digest = Hashers.hashSession(session, topic);
        return ECDSA.recover(digest, session.authorizationData.signature);
    }

    /**
     * Verify a Session object, in which a user authorizes a publicKey
     * to post actions on their behalf.
     */
    function verifySession(
        EIP712Signer.Session memory session,
        address userAddress,
        string memory name
    ) public pure returns (bool) {
        bytes32 digest = Hashers.hashSession(session, name);
        return ECDSA.recover(digest, session.authorizationData.signature) == userAddress;
    }

    /**
     * Verify a [Message<Session>, Signature].
     *
     * The Signature for a `Message<Session>` must be produced by the address
     * corresponding to the publicKey authorized by the Session object.
     *
     * Note that Message<Session> is just an envelope for the actual signed Session.
     * You should still verify that the signing user actually delegated authority
     * to the session key, using `recoverAddressFromSession` or `verifySession`.
     */
    function verifySessionMessageSignature(
        EIP712Signer.SessionMessage memory sessionMessage,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 digest = Hashers.hashSessionMessage(sessionMessage, sessionMessage.topic);
        require(sessionMessage.payload.publicKey.length == 64, "sessionMessage.payload.publicKey must be an uncompressed 64-byte pubkey");
        require(
            address(uint160(uint256(keccak256(sessionMessage.payload.publicKey)))) == sessionMessage.payload.sessionAddress,
            "sessionMessage.payload.sessionAddress must match sessionMessage.paylaod.publicKey"
        );

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(digest, 27, r, s);
        if (signerV27 == sessionMessage.payload.sessionAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(digest, 28, r, s);
        if (signerV28 == sessionMessage.payload.sessionAddress) {
            return true;
        }

        return false;
    }

    /**
     * Verify a [Message<Action>, Signature].
     */
    function verifyActionMessageSignature(
        EIP712Signer.ActionMessage memory actionMessage,
        bytes memory signature,
        address sessionAddress
    ) public pure returns (bool) {
        bytes32 digest = Hashers.hashActionMessage(actionMessage, actionMessage.topic);

        bytes32 r;
        bytes32 s;
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
        }

        address signerV27 = ECDSA.recover(digest, 27, r, s);
        if (signerV27 == sessionAddress) {
            return true;
        }

        address signerV28 = ECDSA.recover(digest, 28, r, s);
        if (signerV28 == sessionAddress) {
            return true;
        }

        return false;
    }

    /**
     * Verify a [Message<Session>, Signature] and [Message<Action>, Signature]
     * pair, checking that the session tuple authorized the action tuple.
     */
    function verifyDelegateActionPair(
        EIP712Signer.SessionMessage memory sessionMessage,
        bytes memory sessionMessageSignature,
        EIP712Signer.ActionMessage memory actionMessage,
        bytes memory actionMessageSignature
    ) public pure returns (bool) {
        string memory topic = sessionMessage.topic;

        require(
            keccak256(abi.encodePacked((sessionMessage.topic))) == keccak256(abi.encodePacked((actionMessage.topic))),
            "Session and Action must be for the same topic"
        );
        require(
            verifySession(sessionMessage.payload, sessionMessage.payload.userAddress, topic),
            "Session must be signed by wallet address"
        );
        require(
            verifySessionMessageSignature(sessionMessage, sessionMessageSignature),
            "Session message must be signed by session address"
        );
        require(
            verifyActionMessageSignature(actionMessage, actionMessageSignature, sessionMessage.payload.sessionAddress),
            "Action message must be signed by session address"
        );

        // enforce invariants
        uint256 sessionExpirationTime = sessionMessage.payload.timestamp + sessionMessage.payload.duration;
        require(
            actionMessage.payload.timestamp <= sessionExpirationTime,
            "Session was expired at the time of action"
        );
        require(
                actionMessage.payload.timestamp >= sessionMessage.payload.timestamp,
            "Session was created after the action"
        );

        return true;
    }
}
