//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library ECDSA_Verify {

    function verify(bytes32 hash, bytes memory signature, address expectedAddress) internal pure returns (bool) {
      bytes32 r;
      bytes32 s;
      // we need to pass v, r and s in separately
      // so the signature has to be split into r and s components
      /// @solidity memory-safe-assembly
      assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
      }

      address signerV27 = ECDSA.recover(hash, 27, r, s);
      if(signerV27 == expectedAddress) {
        return true;
      }

      address signerV28 = ECDSA.recover(hash, 28, r, s);
      if(signerV28 == expectedAddress) {
        return true;
      }

      return false;
  }
}
