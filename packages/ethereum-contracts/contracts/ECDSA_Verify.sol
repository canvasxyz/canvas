//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * This library is adapted from OpenZeppelin's ECDSA recovery implementation
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.1/contracts/utils/cryptography/ECDSA.sol
 *
 * An ECDSA signature consists of two parts r and s, and an optional third part v (in the set {27,28}) which is used
 * when recovering an address/publicKey from a signature and signed value.
 *
 * If we just want to verify signatures, (i.e. check that for a given signature, signed value and expected
 * address that the expected address could have signed the value), then we don't need the third v part.
 * This can be done by attempting to recover the address with both possible values of v and checking
 * the recovered address against the expected address.
 */


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
