// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "base58-solidity/contracts/Base58.sol";
import "@lazyledger/protobuf3-solidity-lib/contracts/ProtobufLib.sol";

library Utils {
  function bytesSlice(bytes memory data, uint startIndex, uint endIndex ) internal pure returns (bytes memory) {
    bytes memory result = new bytes(endIndex-startIndex);
    for(uint i = startIndex; i < endIndex; i++) {
        result[i-startIndex] = data[i];
    }
    return result;
  }

  function substring(string memory str, uint startIndex, uint endIndex) internal pure returns (string memory) {
    // Only works for string encodings where one character = one byte (e.g. ASCII)
    bytes memory strBytes = bytes(str);
    bytes memory result = bytesSlice(strBytes, startIndex, endIndex);
    return string(result);
  }

  function getPublicKeyFromDidKey(
      string memory didKey
  ) internal pure returns (bytes memory) {
      string memory publicKeyData = substring(didKey, 9, bytes(didKey).length);
      bytes memory publicKeyBytes = Base58.decodeFromString(publicKeyData);
      (, uint64 varintLength, ) = ProtobufLib.decode_varint(0, publicKeyBytes);

      return Utils.bytesSlice(publicKeyBytes, varintLength, publicKeyBytes.length);
  }

  function computeAddressFromPublicKey(
    bytes memory publicKey
  ) internal pure returns (address) {
    return address(keccak256(publicKey));
  }
}
