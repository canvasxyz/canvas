//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Varint.sol";

library CID {
  function createDigest(uint64 code, bytes memory digest) internal pure returns (uint256, bytes memory) {
      uint256 size = digest.length;
      uint256 sizeOffset = Varint.get_length(code);
      uint256 digestOffset = sizeOffset + Varint.get_length(size);

      bytes memory data = new bytes(digestOffset + size);

      bytes memory codeVarint = Varint.encode(code);
      bytes memory sizeVarint = Varint.encode(size);

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

  function encodeCID(uint256 version, uint256 code, bytes memory multihash) internal pure returns (bytes memory)  {
      uint256 codeOffset = Varint.get_length(version);
      uint256 hashOffset = codeOffset + Varint.get_length(code);
      bytes memory data = new bytes(hashOffset + multihash.length);

      bytes memory versionVarint = Varint.encode(version);
      bytes memory codeVarint = Varint.encode(code);

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
