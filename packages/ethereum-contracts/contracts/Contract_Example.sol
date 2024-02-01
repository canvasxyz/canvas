// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EIP712_Canvas.sol";

string constant topic = "example:contract";

contract Contract_Example {


  mapping(bytes32 => bool) public appliedActionHashes;
  uint256 public upvotes;

  function claimUpvoted(
    address expectedAddress,
    EIP712_Canvas.SessionMessage memory sessionMessage,
    bytes memory sessionMessageSignature,
    EIP712_Canvas.ActionMessage memory actionMessage,
    bytes memory actionMessageSignature
  ) public returns (bool)  {

    bytes32 actionHash = EIP712_Canvas.hashAction(actionMessage.payload);

    require(
      !appliedActionHashes[actionHash],
      "Each action can only be applied once"
    );

    // verify the signatures
    require(
      EIP712_Canvas.verifySession(sessionMessage.payload, sessionMessage.payload.address_, topic),
      "Session must be signed by wallet address"
    );
    require(
      EIP712_Canvas.verifySessionMessage(sessionMessage, sessionMessageSignature, expectedAddress, topic),
      "Session message must be signed by session address"
    );
    require(
      EIP712_Canvas.verifyActionMessage(actionMessage, actionMessageSignature, expectedAddress, topic),
      "Action message must be signed by session address"
    );

    uint256 sessionExpirationTime = sessionMessage.payload.timestamp + sessionMessage.payload.duration;
    require(
      actionMessage.payload.timestamp < sessionExpirationTime,
      "Action must have been signed by a session that has not expired"
    );

    // validate the action name

    // validate the action args
    // TODO: how do we do this?

    // Now, increase a counter stored on this contract by +1, and
    // save the hash of the action in a mapping on the contract's storage,
    // so someone can't submit the same action twice.
    appliedActionHashes[actionHash] = true;
    upvotes += 1;

    return true;
  }

}
