//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CID.sol";
import "./ECDSA_Verify.sol";

string constant sessionType = "Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
bytes32 constant sessionTypedDataHash = keccak256(bytes(sessionType));

string constant actionType = "Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";
bytes32 constant actionTypedDataHash = keccak256(bytes(actionType));

string constant messageSessionType = "Message(uint256 clock,string[] parents,Session payload,string topic)Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
bytes32 constant messageSessionTypedDataHash = keccak256(bytes(messageSessionType));

string constant messageActionType = "Message(uint256 clock,string[] parents,Action payload,string topic)Action(address address,bytes args,string blockhash,string name,uint256 timestamp)";
bytes32 constant messageActionTypedDataHash = keccak256(bytes(messageActionType));

bytes32 constant emptyDomainSeparator = keccak256(abi.encode(keccak256("EIP712Domain()")));

contract EIP712_Canvas{

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

    function hashArrayOfStrings(string[] memory values) internal pure returns (bytes32) {
        bytes memory concatenatedHashes = new bytes(values.length * 32);

        for(uint256 i = 0; i < values.length; i++) {
            // generate the hash of the value
            bytes32 valueHash = keccak256(bytes(values[i]));
            // add it to the concatenated hashes
            for(uint256 j = 0; j < 32; j++) {
                concatenatedHashes[i * 32 + j] = valueHash[j];
            }
        }
        return keccak256(concatenatedHashes);
    }

    function toTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32 digest) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }
    }

    function _hashTypedDataV4(bytes32 structHash) internal pure returns (bytes32 digest) {
        return toTypedDataHash(emptyDomainSeparator, structHash);
    }

    function createCIDEip712CodecNoneDigest(bytes memory multihash) pure internal returns (bytes memory) {
        uint256 digestSize;
        bytes memory digest;
        (digestSize,digest) = CID.createDigest(0xff, multihash);

        return CID.encodeCID(1, 712, digest);
    }


    function getStructHashForSession(
        Session memory session
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            sessionTypedDataHash, // keccak hash of typed data
            session.address_,
            keccak256(bytes(session.blockhash_)),
            session.duration,
            keccak256(bytes(session.publicKey)),
            session.timestamp
        ));
    }

    function getStructHashForAction(
        Action memory action
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            actionTypedDataHash,
            action.address_,
            keccak256(action.args),
            keccak256(bytes(action.blockhash_)),
            keccak256(bytes(action.name)),
            action.timestamp
        ));
    }

    function recoverAddressFromSession(
        Session memory session,
        bytes memory signature
    ) public pure returns (address){
        bytes32 digest = _hashTypedDataV4(getStructHashForSession(session));

        return ECDSA.recover(digest, signature);
    }

    function getStructHashForMessageSession(
        MessageSession memory messageSession
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                messageSessionTypedDataHash, // keccak hash of typed data
                messageSession.clock,
                hashArrayOfStrings(messageSession.parents),
                getStructHashForSession(messageSession.payload),
                keccak256(bytes(messageSession.topic))
            )
        );
    }

    function getStructHashForMessageAction(
        MessageAction memory messageAction
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                messageActionTypedDataHash, // keccak hash of typed data
                messageAction.clock,
                hashArrayOfStrings(messageAction.parents),
                getStructHashForAction(messageAction.payload),
                keccak256(bytes(messageAction.topic))
            )
        );
    }

    function verifyAddressForMessageSession(
        MessageSession memory messageSession,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool){
        bytes32 digest = _hashTypedDataV4(getStructHashForMessageSession(messageSession));
        bytes memory cid = createCIDEip712CodecNoneDigest(bytes.concat(digest));

        return ECDSA_Verify.verify(sha256(cid), signature, expectedAddress);
    }

    function verifyAddressForMessageAction(
        MessageAction memory messageAction,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool){
        bytes32 digest = _hashTypedDataV4(getStructHashForMessageAction(messageAction));
        bytes memory cid = createCIDEip712CodecNoneDigest(bytes.concat(digest));

        return ECDSA_Verify.verify(sha256(cid), signature, expectedAddress);
    }
}
