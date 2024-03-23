// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./libraries/Verifiers.sol";
import "./libraries/EIP712Signer.sol";

contract Test {
    mapping(bytes32 => bool) public appliedActionHashes;
    mapping(string => uint256) public upvotes;

    /**
     * Test that we correctly recover the user's wallet address that
     * signed a new session's authorization data.
     */
    function recoverAddressFromSession(
        EIP712Signer.Session memory session,
        string memory name
    ) public pure returns (address) {
        return Verifiers.recoverAddressFromSession(session, name);
    }

    /**
     * Test that we correctly recover a Canvas session pubkey address that
     * signed a Message<Session>, and that it matches the `publicKey` value
     * within the session.
     */
    function verifySessionMessageSignature(
        EIP712Signer.SessionMessage memory sessionMessage,
        bytes memory signature
    ) public pure returns (bool) {
        return Verifiers.verifySessionMessageSignature(sessionMessage, signature);
    }

    /**
     * Test that we correctly recover a Canvas session pubkey address that
     * signed a Message<Action>.
     */
    function verifyActionMessageSignature(
        EIP712Signer.ActionMessage memory actionMessage,
        bytes memory signature,
        address sessionAddress
    ) public pure returns (bool) {
        return Verifiers.verifyActionMessageSignature(actionMessage, signature, sessionAddress);
    }

    /**
     * Verify that an offchain interaction was taken with a valid `Session`,
     * `[Message<Session>, Signature]`, and `[Message<Action>, Signature]`.
     * Enforces that the `Session` pubkey must have been used to create
     * both `Signature` objects.
     */
    function claimUpvoted(
        EIP712Signer.SessionMessage memory sessionMessage,
        bytes memory sessionMessageSignature,
        EIP712Signer.ActionMessage memory actionMessage,
        bytes memory actionMessageSignature
    ) public returns (bool)    {

        // Hash the `Action` object to identify each action. This is
        // just used to uniquely identify actions, and has nothing to
        // do with the cryptographic verification we're doing.
        bytes32 actionHash = keccak256(abi.encode(
                keccak256(abi.encodePacked(EIP712Signer.actionType)),
                actionMessage.payload.userAddress,
                keccak256(actionMessage.payload.args),
                keccak256(bytes(actionMessage.payload.name)),
                actionMessage.payload.timestamp,
                keccak256(bytes(actionMessage.payload.blockhash))
        ));
        require(
            !appliedActionHashes[actionHash],
            "Action has already been processed"
        );

        // verify signatures:
        require(
            Verifiers.verifyDelegateActionPair(sessionMessage, sessionMessageSignature, actionMessage, actionMessageSignature),
            "Verification failed"
        );

        // action validation:
        (string memory arg1name, string memory postId) = abi.decode(actionMessage.payload.args, (string, string));
        require(
            keccak256(abi.encodePacked(actionMessage.payload.name)) == keccak256(abi.encodePacked("upvote")),
            "Action name must be 'upvote'"
        );
        require(
            keccak256(abi.encodePacked(arg1name)) == keccak256((abi.encodePacked("post_id"))),
            "Action argument name must be 'post_id'"
        );
        require(
            keccak256(abi.encodePacked(actionMessage.topic)) == keccak256(abi.encodePacked("example:contract")),
            "Action name must be 'upvote'"
        );

        // Now, increase a counter stored on this contract by +1, and
        // save the hash of the action in a mapping on the contract's storage,
        // so someone can't submit the same action twice.
        upvotes[postId] += 1;
        appliedActionHashes[actionHash] = true;

        return true;
    }
}
