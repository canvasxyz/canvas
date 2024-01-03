//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract EIP712_Canvas is EIP712{

    bytes32 immutable sessionTypedDataHash;

    constructor(string memory domainName, string memory signatureVersion) EIP712(domainName,signatureVersion) {
        sessionTypedDataHash = keccak256(bytes("Session(address address,string blockhash,uint256 duration,string publicKey,uint256 timestamp)"));
    }

    struct Action {
        string _type;
        address _address;
        string name;
        bytes args; // ABI encoded args
        uint256 timestamp;
        address _blockhash;
    }

    struct MessageWithAction {
        string topic;
        uint256 clock;
        string[] parents;
        Action payload;
    }

    struct Session {
        address address_;
	    address blockhash;
        uint256 duration;
	    bytes publicKey;
        uint256 timestamp;
    }

    /// Returns the address of the signer of that the ticket
    // function getSigner( string calldata eventName, uint256 price, bytes memory signature) public view returns (address){
    //     Ticket memory ticket = Ticket(eventName,price);
    //     address signer = _verify(ticket, signature);
    //     return signer;
    // }

    // SessionMessage is such a bad name
    function _verifySession(Session memory session, bytes memory signature) internal view returns (address){
        // bytes32 digest = _hashSession(session);


        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    sessionTypedDataHash, // keccak hash of typed data
                    session.address_,
                    session.blockhash,
                    session.duration,
                    session.publicKey,
                    session.timestamp
                )
            )
        );

        return ECDSA.recover(digest, signature);
    }

    /// @notice Verifies the signature for a given Ticket, returning the address of the signer.
    /// @dev Will revert if the signature is invalid.
    /// @param ticket A ticket describing an event
    /// @param signature The ticket seller signature
    // function _verify(Ticket memory ticket, bytes memory signature) internal view returns (address){
    //     bytes32 digest = _hashTypedData(ticket);
    //     return ECDSA.recover(digest, signature);
    // }

    /// @notice Returns a hash of a given Ticket, prepared using EIP712 typed data hashing rules.
    /// @param ticket A ticket describing an event
    // function _hashTypedData(Ticket memory ticket) internal view returns (bytes32){
        // return _hashTypedDataV4(
        //     keccak256(
        //         abi.encode(
        //             typedDataHash, // keccak hash of typed data
        //             keccak256(bytes(ticket.eventName)), // encoding string to get its hash
        //             ticket.price //uint value
        //         )
        //     )
        // );
    // }
}
