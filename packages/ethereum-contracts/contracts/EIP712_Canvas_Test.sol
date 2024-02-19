// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./EIP712_Canvas.sol";

/**
 * This contract imports functions defined in EIP712_Canvas.sol so that they can called
 * from the automated tests
 */

contract EIP712_Canvas_Test {
    function recoverAddressFromSession(
        EIP712_Canvas.Session memory session,
        string memory name
    ) public pure returns (address) {
        return EIP712_Canvas.recoverAddressFromSession(session, name);
    }

    function verifySessionMessage(
        EIP712_Canvas.SessionMessage memory sessionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) {
        return EIP712_Canvas.verifySessionMessage(sessionMessage, signature, expectedAddress, name);
    }

    function verifyActionMessage(
        EIP712_Canvas.ActionMessage memory actionMessage,
        bytes memory signature,
        address expectedAddress,
        string memory name
    ) public pure returns (bool) {
        return EIP712_Canvas.verifyActionMessage(actionMessage, signature, expectedAddress, name);
    }
}
