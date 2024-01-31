// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./EIP712_Canvas.sol";

/**
 * This contract imports functions defined in EIP712_Canvas.sol so that they can called
 * from the automated tests
 */

contract EIP712_Canvas_External {
    function recoverAddressFromSession(
        EIP712_Canvas.Session memory session,
        bytes memory signature
    ) public pure returns (address) {
        return EIP712_Canvas.recoverAddressFromSession(session, signature);
    }

    function verifySessionMessage(
        EIP712_Canvas.SessionMessage memory sessionMessage,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) {
        return EIP712_Canvas.verifySessionMessage(sessionMessage, signature, expectedAddress);
    }

    function verifyActionMessage(
        EIP712_Canvas.ActionMessage memory actionMessage,
        bytes memory signature,
        address expectedAddress
    ) public pure returns (bool) {
        return EIP712_Canvas.verifyActionMessage(actionMessage, signature, expectedAddress);
    }
}
