// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * Solidity implementations of the `canvas-action-eip712` and
 * `canvas-session-eip712` codecs for Message<Action>,
 * Message<Session>, and Session, defined in the EIP712Signer
 * and Secp256k1DelegateSigner in the chain-ethereum package.
 *
 * This package also includes typed data formats used by the
 * EIP712Signer and Secp256k1DelegateSigner signers in
 * packages/chain-ethereum, which match the signTypedData calls in
 * EIP712Signer.ts and Secp256k1DelegateSigner.ts.
 *
 * They *do not* exactly match the structs, nor do they match
 * the TypeScript definitions of Session, Message<Session>, and
 * Message<Action> in packages/interfaces.
 *
 * TODO: Disambiguate `address` vs. `userAddress` and
 * `sessionAddress`, and `sessionAddress` vs. `publicKey`, after
 * which we can make the structs match the signTypedData formats.
 */
library EIP712Signer {
    bytes32 constant DOMAIN_TYPE_HASH = keccak256("EIP712Domain(string name)");

    string constant sessionDataType = "SessionData(string topic,address sessionAddress,uint64 duration,uint64 timestamp,string blockhash)";

    string constant authorizationDataType = "AuthorizationData(bytes signature)";
    string constant sessionType = "Session(address userAddress,bytes publicKey,AuthorizationData authorizationData,uint64 duration,uint64 timestamp,string blockhash)AuthorizationData(bytes signature)";
    string constant sessionMessageType = "Message(string topic,uint64 clock,string[] parents,Session payload)AuthorizationData(bytes signature)Session(address userAddress,bytes publicKey,AuthorizationData authorizationData,uint64 duration,uint64 timestamp,string blockhash)";

    string constant actionType = "Action(address userAddress,bytes args,string name,uint64 timestamp,string blockhash)";
    string constant actionMessageType = "Message(string topic,uint64 clock,string[] parents,Action payload)Action(address userAddress,bytes args,string name,uint64 timestamp,string blockhash)";

    struct AuthorizationData {
        bytes signature;
    }

    struct Session {
        address userAddress;
        address sessionAddress;
        AuthorizationData authorizationData;
        string blockhash;
        bytes publicKey;
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
        bytes publicKey;
        string name;
        uint64 timestamp;
    }

    struct ActionMessage {
        uint64 clock;
        string[] parents;
        string topic;
        Action payload;
    }
}
