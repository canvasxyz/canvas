//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./CID.sol";

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

bytes32 constant sessionTypedDataHash = keccak256("Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)");

bytes32 constant emptyDomainSeparator = keccak256(abi.encode(keccak256("EIP712Domain()")));

contract EIP712_Canvas{

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

    function recoverAddressFromHash(
        bytes32 cidHash,
        bytes memory signature
    ) public pure returns (address){

        // this is basically the same thing as calling ecrecover on the r, s and v values
        address signer;
        (signer,) = ECDSA.tryRecover(cidHash, signature);

        return signer;
    }

    function createCIDEip712CodecNoneDigest(bytes memory multihash) pure external returns (bytes memory) {
        uint256 digestSize;
        bytes memory digest;
        (digestSize,digest) = CID.createDigest(0, multihash);

        return CID.encodeCID(1, 712, digest);
    }
}