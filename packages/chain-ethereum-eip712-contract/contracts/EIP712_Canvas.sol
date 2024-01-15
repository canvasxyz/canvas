//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CID.sol";
import "./ECDSA_Verify.sol";

/*
    struct Action {
        string _type;
        address _address;
        string name;
        bytes args; // ABI encoded args
        uint256 timestamp;
        address _blockhash;
    }

    struct MessageWithAction {
        string topic;
        uint256 clock;
        string[] parents;
        Action payload;
    }

    struct Session {
        address address_;
	    address blockhash;
        uint256 duration;
	    bytes publicKey;
        uint256 timestamp;
    }
*/

string constant sessionType = "Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
bytes32 constant sessionTypedDataHash = keccak256(bytes(sessionType));

string constant messageSessionType = "Message(uint256 clock,string[] parents,Session payload,string topic)Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)";
bytes32 constant messageSessionTypedDataHash = keccak256(bytes(messageSessionType));

bytes32 constant emptyDomainSeparator = keccak256(abi.encode(keccak256("EIP712Domain()")));

contract EIP712_Canvas{

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

    function getStructHashForSession(address address_,
        string memory blockhash_,
        uint256 duration,
        string memory publicKey,
        uint256 timestamp) public pure returns (bytes32) {
        return keccak256(abi.encode(
            sessionTypedDataHash, // keccak hash of typed data
            address_,
            keccak256(bytes(blockhash_)),
            duration,
            keccak256(bytes(publicKey)),
            timestamp
        ));
    }

    function recoverAddressFromSession(
        address address_,
        string memory blockhash_,
        uint256 duration,
        string memory publicKey,
        uint256 timestamp,
        bytes memory signature
    ) public pure returns (address){
        bytes32 digest = _hashTypedDataV4(getStructHashForSession(address_, blockhash_, duration, publicKey, timestamp));

        return ECDSA.recover(digest, signature);
    }

    function getStructHashForMessageSession(
        uint256 clock,
        string[] memory parents,
        string memory topic,
        address address_,
        string memory blockhash_,
        uint256 duration,
        string memory publicKey,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return
        keccak256(
            abi.encode(
                messageSessionTypedDataHash, // keccak hash of typed data
                clock,
                hashArrayOfStrings(parents),
                getStructHashForSession(
                    address_,
                    blockhash_,
                    duration,
                    publicKey,
                    timestamp
                ),
                keccak256(bytes(topic))
            )
        );
    }

    function createCIDEip712CodecNoneDigest(bytes memory multihash) pure internal returns (bytes memory) {
        uint256 digestSize;
        bytes memory digest;
        (digestSize,digest) = CID.createDigest(0xff, multihash);

        return CID.encodeCID(1, 712, digest);
    }

    function recoverAddressFromHash(
        bytes32 cidHash,
        bytes memory signature
    ) public pure returns (address){

        // this is basically the same thing as calling ecrecover on the r, s and v values
        address signer;
        (signer,) = ECDSA.tryRecover(cidHash, signature);

        return signer;
    }

    function getCIDForMessageSession(
        uint256 clock,
        string[] memory parents,
        string memory topic,
        address address_,
        string memory blockhash_,
        uint256 duration,
        string memory publicKey,
        uint256 timestamp
    ) public pure returns (bytes memory) {
        bytes32 digest = _hashTypedDataV4(getStructHashForMessageSession(clock, parents, topic, address_, blockhash_, duration, publicKey, timestamp));
        return createCIDEip712CodecNoneDigest(bytes.concat(digest));
    }

    function verifyAddressForMessageSession(
        uint256 clock,
        string[] memory parents,
        string memory topic,
        address address_,
        string memory blockhash_,
        uint256 duration,
        string memory publicKey,
        uint256 timestamp,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool){
        bytes32 digest = _hashTypedDataV4(getStructHashForMessageSession(clock, parents, topic, address_, blockhash_, duration, publicKey, timestamp));
        bytes memory cid = createCIDEip712CodecNoneDigest(bytes.concat(digest));

        return ECDSA_Verify.verify(sha256(cid), signature, expectedAddress);
    }
}
