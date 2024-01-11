//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

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

    function get_varint_length(uint256 n) pure internal returns (uint256) {
        uint256 tmp = n;
        uint256 num_bytes = 1;
        while (tmp > 0x7F) {
            tmp = tmp >> 7;
            num_bytes += 1;
        }
        return num_bytes;
    }

    function encode_varint(uint256 n) internal pure returns (bytes memory) {
        // Count the number of groups of 7 bits
        // We need this pre-processing step since Solidity doesn't allow dynamic memory resizing
        uint256 num_bytes = get_varint_length(n);

        bytes memory buf = new bytes(num_bytes);

        uint256 tmp = n;
        for (uint256 i = 0; i < num_bytes; i++) {
            // Set the first bit in the byte for each group of 7 bits
            buf[i] = bytes1(0x80 | uint8(tmp & 0x7F));
            tmp = tmp >> 7;
        }
        // Unset the first bit of the last byte
        buf[num_bytes - 1] &= 0x7F;

        return buf;
    }

    function createDigest(uint64 code, bytes memory digest) pure external returns (uint256, bytes memory) {
        uint256 size = digest.length;
        uint256 sizeOffset = get_varint_length(code);
        uint256 digestOffset = sizeOffset + get_varint_length(size);

        bytes memory data = new bytes(digestOffset + size);

        bytes memory codeVarint = encode_varint(code);
        bytes memory sizeVarint = encode_varint(size);

        // we can't just use slices because they are not supported by bytes memory
        for(uint256 i = 0; i < codeVarint.length; i++) {
            data[i] = codeVarint[i];
        }

        for(uint256 i = 0; i < sizeVarint.length; i++) {
            data[sizeOffset+i] = sizeVarint[i];
        }

        for(uint256 i = 0; i<digest.length; i++) {
            data[digestOffset + i] = digest[i];
        }

        return (digestOffset + size, data);
    }

    function encodeCID(uint256 version, uint256 code, bytes memory multihash) pure external returns (bytes memory)  {
        uint256 codeOffset = get_varint_length(version);
        uint256 hashOffset = codeOffset + get_varint_length(code);
        bytes memory data = new bytes(hashOffset + multihash.length);

        bytes memory versionVarint = encode_varint(version);
        bytes memory codeVarint = encode_varint(code);

        for(uint256 i = 0; i < versionVarint.length; i++) {
            data[i] = versionVarint[i];
        }

        for(uint256 i = 0; i < codeVarint.length; i++) {
            data[codeOffset + i] = codeVarint[i];
        }

        for(uint256 i = 0; i < multihash.length; i++) {
            data[hashOffset + i] = multihash[i];
        }

        return data;
    }
}
