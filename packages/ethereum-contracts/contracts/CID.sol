// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@lazyledger/protobuf3-solidity-lib/contracts/ProtobufLib.sol";

library CID {
  function createDigest(uint64 code, bytes memory digest) internal pure returns (uint256, bytes memory) {
    uint64 size = uint64(digest.length);

    bytes memory codeVarint = ProtobufLib.encode_varint(code);
    bytes memory sizeVarint = ProtobufLib.encode_varint(size);

    uint256 sizeOffset = codeVarint.length;
    uint256 digestOffset = sizeOffset + sizeVarint.length;

    bytes memory data = new bytes(digestOffset + size);

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

  function encodeCID(uint64 version, uint64 code, bytes memory multihash) internal pure returns (bytes memory)  {
    bytes memory versionVarint = ProtobufLib.encode_varint(version);
    bytes memory codeVarint = ProtobufLib.encode_varint(code);

    uint256 codeOffset = versionVarint.length;
    uint256 hashOffset = codeOffset + codeVarint.length;

    bytes memory data = new bytes(hashOffset + multihash.length);

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
