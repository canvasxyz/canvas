// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CID.sol";

contract CID_Test {
  function createDigest(uint64 code, bytes memory digest) public pure returns (uint256, bytes memory) {
    return CID.createDigest(code, digest);
  }
  function encodeCID(uint64 version, uint64 code, bytes memory multihash) public pure returns (bytes memory)  {
    return CID.encodeCID(version, code, multihash);
  }
}
