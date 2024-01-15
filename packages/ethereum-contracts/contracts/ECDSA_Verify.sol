//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.19;

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
    enum VerifyError {
      NoError,
      InvalidSignature,
      InvalidSignatureLength,
      InvalidSignatureS
    }

    /**
     * @dev The signature derives the `address(0)`.
     */
    error ECDSAInvalidSignature();

    /**
     * @dev The signature has an invalid length.
     */
    error ECDSAInvalidSignatureLength(uint256 length);

    /**
     * @dev The signature has an S value that is in the upper half order.
     */
    error ECDSAInvalidSignatureS(bytes32 s);

    function tryVerify(bytes32 hash, bytes memory signature, address expectedAddress) internal pure returns (bool, VerifyError, bytes32) {
      if (signature.length != 64) {
        return (false, VerifyError.InvalidSignatureLength, bytes32(signature.length));
      }

      bytes32 r;
      bytes32 s;
      // ecrecover takes the signature parameters, and the only way to get them
      // currently is to use assembly.
      /// @solidity memory-safe-assembly
      assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
      }

      // don't accept signatures where s is in the upper end
      // see: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.1/contracts/utils/cryptography/ECDSA.sol#L128
      if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
          return (false, VerifyError.InvalidSignatureS, s);
      }


      // If the signature is valid (and not malleable), return the signer address

      // the 64 byte signature does not encode the "v" recovery value, which can be either 27 or 28
      // therefore try to recover the address using both possible values
      // and return true if one of the recovered addresses matches

      address signerV27 = ecrecover(hash, 27, r, s);

      if (signerV27 == address(0)) {
          return (false, VerifyError.InvalidSignature, bytes32(0));
      }

      if(signerV27 == expectedAddress) {
        return (true, VerifyError.NoError, bytes32(0));
      }

      address signerV28 = ecrecover(hash, 28, r, s);

      if (signerV28 == address(0)) {
          return (false, VerifyError.InvalidSignature, bytes32(0));
      }

      if(signerV28 == expectedAddress) {
        return (true, VerifyError.NoError, bytes32(0));
      }

      return (false, VerifyError.NoError, bytes32(0));
  }

  function verify(bytes32 hash, bytes memory signature, address expectedAddress) internal pure returns (bool) {
    (bool isVerified, VerifyError error, bytes32 errorArg) = tryVerify(hash, signature, expectedAddress);
    _throwError(error, errorArg);
    return isVerified;
  }

    /**
    * @dev Optionally reverts with the corresponding custom error according to the `error` argument provided.
    */
  function _throwError(VerifyError error, bytes32 errorArg) private pure {
      if (error == VerifyError.NoError) {
          return; // no error: do nothing
      } else if (error == VerifyError.InvalidSignature) {
          revert ECDSAInvalidSignature();
      } else if (error == VerifyError.InvalidSignatureLength) {
          revert ECDSAInvalidSignatureLength(uint256(errorArg));
      } else if (error == VerifyError.InvalidSignatureS) {
          revert ECDSAInvalidSignatureS(errorArg);
      }
    }
}
