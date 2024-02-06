// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./EIP712_Canvas.sol";

string constant topic = "example:contract";

contract Contract_Test {

  mapping(bytes32 => bool) public appliedActionHashes;
  mapping(string => uint256) public upvotes;

  /**
   * Verify that an offchain interaction was taken by `expectedAddress`,
   * with a valid session, session message, action, and action message.
   */
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
      "Action has already been processed"
    );

    // verify signatures:
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

    // invariants:
    uint256 sessionExpirationTime = sessionMessage.payload.timestamp + sessionMessage.payload.duration;
    require(
      actionMessage.payload.timestamp < sessionExpirationTime,
      "Invalid action: Signed by a session that was expired at the time of action"
    );
    require(
        actionMessage.payload.timestamp >= sessionMessage.payload.timestamp,
      "Invalid action: Signed by a session after the action"
    );

    // action validation:
    (string memory arg1name, string memory postId) = abi.decode(actionMessage.payload.args, (string, string));
    require(
      keccak256(abi.encodePacked(actionMessage.payload.name)) == keccak256(abi.encodePacked("upvote")),
      "Action name must be 'upvote'"
    );
    require(
      keccak256(abi.encodePacked(arg1name)) == keccak256((abi.encodePacked("post_id"))),
      "Action argument name must be 'post_id'"
    );

    // Now, increase a counter stored on this contract by +1, and
    // save the hash of the action in a mapping on the contract's storage,
    // so someone can't submit the same action twice.
    upvotes[postId] += 1;
    appliedActionHashes[actionHash] = true;

    return true;
  }

}
